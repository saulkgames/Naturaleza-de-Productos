/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Valida cada línea de familias de precio y margen por rango de espesor antes de guardarla
 * (registro hijo de la configuración de naturaleza): rango completo, del tipo de la naturaleza y sin traslape (RN3-05 a RN3-07).
 */
define([
    'N/error',
    'N/query',
    'N/log',
    './domain/SADS_naturaleza_config_formato',
    './domain/SADS_naturaleza_familias'
], (error, query, log, formato, familias) => {
    const NOMBRE_ERROR = 'FAMILIA_NATURALEZA_INVALIDA';
    const PREFIJO_MENSAJE = 'La familia por espesor no es válida: ';
    const SEPARADOR_ERRORES = '; ';
    const CASILLA_MARCADA = 'T';
    const ID_INEXISTENTE = 0;

    const REGISTRO_CONFIGURACION = 'customrecord_sads_naturaleza_productos';
    const REGISTRO_ESPESOR = 'customrecord_sads_espesor';
    const REGISTRO_FAMILIA = 'customrecord_sads_nat_familia';

    const CAMPOS_FAMILIA = Object.freeze({
        CONFIGURACION: 'custrecord_sads_natfam_config',
        DESDE: 'custrecord_sads_natfam_desde',
        HASTA: 'custrecord_sads_natfam_hasta',
        PRECIO: 'custrecord_sads_natfam_precio',
        MARGEN: 'custrecord_sads_natfam_margen',
        INACTIVO: 'isinactive'
    });

    // C-5. Supuesto S3-11: columnas SuiteQL con el mismo nombre que el scriptid de los campos.
    const SQL_TIPO_NATURALEZA = `
        SELECT cfg.custrecord_sads_naturaleza_tipo_esp AS tipo
        FROM ${REGISTRO_CONFIGURACION} cfg
        WHERE cfg.id = ?`;

    const SQL_HERMANAS = `
        SELECT fam.id AS id,
               fam.custrecord_sads_natfam_desde AS desde_id, des.custrecord_sads_esp_orden AS desde_orden,
               des.custrecord_sads_esp_tipo AS desde_tipo,
               fam.custrecord_sads_natfam_hasta AS hasta_id, has.custrecord_sads_esp_orden AS hasta_orden,
               has.custrecord_sads_esp_tipo AS hasta_tipo,
               fam.custrecord_sads_natfam_precio AS precio_id, fam.custrecord_sads_natfam_margen AS margen_id
        FROM ${REGISTRO_FAMILIA} fam
        LEFT JOIN ${REGISTRO_ESPESOR} des ON des.id = fam.custrecord_sads_natfam_desde
        LEFT JOIN ${REGISTRO_ESPESOR} has ON has.id = fam.custrecord_sads_natfam_hasta
        WHERE fam.isinactive = 'F'
          AND fam.custrecord_sads_natfam_config = ?
          AND fam.id <> ?`;

    // C-6. Orden y tipo de los espesores de la propia línea.
    const SQL_ESPESORES_DE_LINEA = `
        SELECT esp.id AS id, esp.custrecord_sads_esp_orden AS orden, esp.custrecord_sads_esp_tipo AS tipo
        FROM ${REGISTRO_ESPESOR} esp
        WHERE esp.id IN (?, ?)`;

    const TITULO_LOG_ERROR = 'Validación de familia por espesor: error inesperado';

    const aCadena = (valor) => (valor === null || valor === undefined ? '' : String(valor));

    const textoONulo = (valor) => {
        const texto = aCadena(valor).trim();
        return texto === '' ? null : texto;
    };

    const numeroONulo = (valor) => {
        const texto = textoONulo(valor);
        if (texto === null) return null;
        const numero = Number(texto);
        return Number.isFinite(numero) ? numero : null;
    };

    const describirError = (errorCapturado) => {
        if (errorCapturado === null || typeof errorCapturado !== 'object') return aCadena(errorCapturado);
        return `${aCadena(errorCapturado.name)}: ${aCadena(errorCapturado.message)}\n${aCadena(errorCapturado.stack)}`;
    };

    const ejecutarConsulta = (sql, valores) => query.runSuiteQL({ query: sql, params: valores }).asMappedResults();

    const debeValidar = (context) => {
        const tipos = context.UserEventType;
        return [tipos.CREATE, tipos.EDIT, tipos.XEDIT].indexOf(context.type) !== -1;
    };

    // PT-07: en XEDIT, newRecord solo trae los campos enviados; el resto se toma de oldRecord.
    const leerValorFinal = (context, campo) => {
        if (context.type !== context.UserEventType.XEDIT) return context.newRecord.getValue({ fieldId: campo });
        const enviados = context.newRecord.getFields();
        if (Array.isArray(enviados) && enviados.indexOf(campo) !== -1) return context.newRecord.getValue({ fieldId: campo });
        return context.oldRecord ? context.oldRecord.getValue({ fieldId: campo }) : null;
    };

    /**
     * Lee el estado final de la línea.
     * @param {Object} context - Contexto de beforeSubmit.
     * @returns {{id: ?string, configuracionId: ?string, desdeId: ?string, hastaId: ?string,
     * familiaPrecioId: ?string, familiaMargenId: ?string, inactiva: boolean}} Objeto plano.
     */
    const leerLinea = (context) => {
        const inactivo = leerValorFinal(context, CAMPOS_FAMILIA.INACTIVO);
        return {
            id: textoONulo(context.newRecord.id),
            configuracionId: textoONulo(leerValorFinal(context, CAMPOS_FAMILIA.CONFIGURACION)),
            desdeId: textoONulo(leerValorFinal(context, CAMPOS_FAMILIA.DESDE)),
            hastaId: textoONulo(leerValorFinal(context, CAMPOS_FAMILIA.HASTA)),
            familiaPrecioId: textoONulo(leerValorFinal(context, CAMPOS_FAMILIA.PRECIO)),
            familiaMargenId: textoONulo(leerValorFinal(context, CAMPOS_FAMILIA.MARGEN)),
            inactiva: inactivo === true || aCadena(inactivo) === CASILLA_MARCADA
        };
    };

    /**
     * Lee el tipo de espesor de la configuración padre (C-5).
     * @param {?string} configuracionId
     * @returns {?string} ID del tipo de espesor o null.
     */
    const leerTipoNaturaleza = (configuracionId) => {
        if (configuracionId === null) return null;
        const filas = ejecutarConsulta(SQL_TIPO_NATURALEZA, [configuracionId]);
        return filas.length === 0 ? null : textoONulo(filas[0].tipo);
    };

    /**
     * Lee las demás líneas activas de la misma configuración (C-5).
     * @param {?string} configuracionId
     * @param {?string} lineaId - ID de la propia línea; null en CREATE.
     * @returns {Object[]} Líneas planas para domain/SADS_naturaleza_familias.
     */
    const leerHermanas = (configuracionId, lineaId) => {
        if (configuracionId === null) return [];
        return ejecutarConsulta(SQL_HERMANAS, [configuracionId, lineaId === null ? ID_INEXISTENTE : lineaId]).map((fila) => ({
            id: aCadena(fila.id),
            desdeId: textoONulo(fila.desde_id),
            hastaId: textoONulo(fila.hasta_id),
            desdeOrden: numeroONulo(fila.desde_orden),
            hastaOrden: numeroONulo(fila.hasta_orden),
            desdeTipo: textoONulo(fila.desde_tipo),
            hastaTipo: textoONulo(fila.hasta_tipo),
            familiaPrecioId: aCadena(fila.precio_id),
            familiaMargenId: aCadena(fila.margen_id)
        }));
    };

    /**
     * Completa la línea con orden y tipo de sus espesores desde y hasta (C-6).
     * @param {Object} linea - Resultado de leerLinea.
     * @returns {Object} Línea plana para domain/SADS_naturaleza_familias.
     */
    const completarEspesores = (linea) => {
        const completa = Object.assign({ desdeOrden: null, hastaOrden: null, desdeTipo: null, hastaTipo: null }, linea);
        if (linea.desdeId === null && linea.hastaId === null) return completa;
        const filas = ejecutarConsulta(SQL_ESPESORES_DE_LINEA, [
            linea.desdeId === null ? ID_INEXISTENTE : linea.desdeId,
            linea.hastaId === null ? ID_INEXISTENTE : linea.hastaId
        ]);
        filas.forEach((fila) => {
            const id = aCadena(fila.id);
            if (id === linea.desdeId) {
                completa.desdeOrden = numeroONulo(fila.orden);
                completa.desdeTipo = textoONulo(fila.tipo);
            }
            if (id === linea.hastaId) {
                completa.hastaOrden = numeroONulo(fila.orden);
                completa.hastaTipo = textoONulo(fila.tipo);
            }
        });
        return completa;
    };

    /**
     * Rechaza el guardado de una línea de familia que viole RN3-05 a RN3-07. Solo actúa en CREATE, EDIT y XEDIT.
     * Una línea inactiva no se valida.
     * @param {Object} context - Contexto de beforeSubmit.
     * @returns {void}
     * @throws {Error} FAMILIA_NATURALEZA_INVALIDA con los errores unidos por "; ";
     * o el error inesperado original, después de registrarlo con log.error.
     */
    const beforeSubmit = (context) => {
        if (!debeValidar(context)) return;
        let resultado;
        try {
            const linea = leerLinea(context);
            if (linea.inactiva) return;
            resultado = familias.validarLinea({
                linea: completarEspesores(linea),
                hermanas: leerHermanas(linea.configuracionId, linea.id),
                tipoNaturaleza: leerTipoNaturaleza(linea.configuracionId)
            });
        } catch (errorInesperado) {
            log.error({ title: TITULO_LOG_ERROR, details: describirError(errorInesperado) });
            throw errorInesperado;
        }
        if (resultado.valido) return;
        throw error.create({
            name: NOMBRE_ERROR,
            message: `${PREFIJO_MENSAJE}${resultado.errores.join(SEPARADOR_ERRORES)}`,
            notifyOff: true
        });
    };

    return { beforeSubmit };
});
