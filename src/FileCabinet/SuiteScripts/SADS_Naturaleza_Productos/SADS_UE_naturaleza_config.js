/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Valida la captura manual del registro de configuración de Naturaleza de Productos antes de guardarlo:
 * JSON de parámetros, artículo plantilla, patrones de nombre y código, tipo de espesor y mapa de medidas
 * (RN-12 a RN-17, RN3-08, RN3-09, RN5-05).
 */
define([
    'N/error',
    'N/log',
    './domain/SADS_naturaleza_config_formato',
    './domain/SADS_naturaleza_patron',
    './domain/SADS_naturaleza_parametros',
    './domain/SADS_naturaleza_mapa_medidas',
    './infra/SADS_naturaleza_articulo_ns'
], (error, log, formato, patron, parametros, mapaMedidas, articulos) => {
    const NOMBRE_ERROR = 'CONFIGURACION_NATURALEZA_INVALIDA';
    const PREFIJO_MENSAJE = 'La configuración no es válida: ';
    const SEPARADOR_ERRORES = '; ';
    const PATRON_ID_INTERNO = /^[1-9][0-9]*$/;

    const CAMPOS_CONFIGURACION = Object.freeze({
        JSON: 'custrecord_sads_naturaleza_config',
        PLANTILLA: 'custrecord_sads_naturaleza_plantilla',
        PATRON_NOMBRE: 'custrecord_sads_naturaleza_patron_nom',
        PATRON_CODIGO: 'custrecord_sads_naturaleza_patron_cod',
        TIPO_ESPESOR: 'custrecord_sads_naturaleza_tipo_esp',
        CAMPO_MEDIDA: 'custrecord_sads_naturaleza_campo_med',
        MAPA_MEDIDAS: 'custrecord_sads_naturaleza_mapa_med'
    });

    // RN5-05: campos del artículo que llena el mapa de medidas.
    const CAMPOS_DEL_MAPA = Object.freeze(['custitem_sads_nat_ptr_lado', 'custitem_sads_nat_ptr_lado_b']);
    const CASILLA_MARCADA = 'T';

    // S3-06: campo de artículo del catálogo de espesores; sus marcadores solo admiten codigo o texto (RN3-09).
    const CAMPO_ESPESOR = 'custitem_sads_nat_espesor';

    const ETIQUETAS_PATRON = Object.freeze({
        CODIGO: 'Patrón de código',
        NOMBRE: 'Patrón de nombre'
    });

    const MENSAJES = Object.freeze({
        PLANTILLA_NO_NUMERICA: 'El artículo plantilla debe ser un ID interno numérico.',
        PLANTILLA_INEXISTENTE: (id) => `El artículo plantilla ${id} no existe.`,
        PATRON_OBLIGATORIO: (etiqueta) => `${etiqueta}: es obligatorio cuando hay artículo plantilla.`,
        SIN_TIPO_ESPESOR: 'La configuración usa espesor y requiere Tipo de Espesor.',
        CAMPO_MEDIDA_FUERA: 'El Campo de Medida para Familias debe ser uno de los IDs de la configuración.',
        MAPA_SIN_CAMPOS: 'Con el Mapa de Medidas PTRR, el JSON debe incluir custitem_sads_nat_ptr_lado y custitem_sads_nat_ptr_lado_b.'
    });

    const TITULO_LOG_ERROR = 'Validación de configuración de naturaleza: error inesperado';

    const aCadena = (valor) => (valor === null || valor === undefined ? '' : String(valor));

    const esCasillaMarcada = (valor) => valor === true || aCadena(valor) === CASILLA_MARCADA;

    const describirError = (errorCapturado) => {
        if (errorCapturado === null || typeof errorCapturado !== 'object') return aCadena(errorCapturado);
        return `${aCadena(errorCapturado.name)}: ${aCadena(errorCapturado.message)}\n${aCadena(errorCapturado.stack)}`;
    };

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
     * Lee el estado final de los campos validados.
     * @param {Object} context - Contexto de beforeSubmit.
     * @returns {{json: *, plantilla: string, patronNombre: string, patronCodigo: string, tipoEspesor: string}} Objeto plano.
     */
    const leerConfiguracion = (context) => ({
        tipoEspesor: aCadena(leerValorFinal(context, CAMPOS_CONFIGURACION.TIPO_ESPESOR)).trim(),
        campoMedida: aCadena(leerValorFinal(context, CAMPOS_CONFIGURACION.CAMPO_MEDIDA)).trim(),
        usaMapa: esCasillaMarcada(leerValorFinal(context, CAMPOS_CONFIGURACION.MAPA_MEDIDAS)),
        json: leerValorFinal(context, CAMPOS_CONFIGURACION.JSON),
        plantilla: aCadena(leerValorFinal(context, CAMPOS_CONFIGURACION.PLANTILLA)).trim(),
        patronNombre: aCadena(leerValorFinal(context, CAMPOS_CONFIGURACION.PATRON_NOMBRE)),
        patronCodigo: aCadena(leerValorFinal(context, CAMPOS_CONFIGURACION.PATRON_CODIGO))
    });

    // RN-16: el ID se cita solo si es numérico.
    const validarPlantilla = (plantilla) => {
        if (!PATRON_ID_INTERNO.test(plantilla)) return [MENSAJES.PLANTILLA_NO_NUMERICA];
        if (articulos.resolverTipoRegistroArticulo(plantilla) === null) return [MENSAJES.PLANTILLA_INEXISTENTE(plantilla)];
        return [];
    };

    // RN-14, RN-15, RN3-09 y RN5-05: con el mapa, {mapa:codigo} y {mapa:texto} son marcadores de catálogo permitidos.
    const validarPatron = (texto, etiqueta, ids, usaMapa) => {
        if (texto.trim() === '') return [MENSAJES.PATRON_OBLIGATORIO(etiqueta)];
        const idsCatalogo = (ids.indexOf(CAMPO_ESPESOR) === -1 ? [] : [CAMPO_ESPESOR]).concat(usaMapa ? [mapaMedidas.MARCADOR] : []);
        const idsPermitidos = usaMapa ? ids.concat([mapaMedidas.MARCADOR]) : ids;
        return patron.validar({ patron: texto, idsPermitidos, idsCatalogo }).errores.map((mensaje) => `${etiqueta}: ${mensaje}`);
    };

    // RN5-05.
    const validarMapa = (ids, usaMapa) => (
        usaMapa && CAMPOS_DEL_MAPA.some((campo) => ids.indexOf(campo) === -1) ? [MENSAJES.MAPA_SIN_CAMPOS] : []
    );

    // D-21: el campo de medida para familias, si existe, es un ID del JSON.
    const validarCampoMedida = (ids, campoMedida) => (
        campoMedida !== '' && ids.indexOf(campoMedida) === -1 ? [MENSAJES.CAMPO_MEDIDA_FUERA] : []
    );

    // RN3-08.
    const validarTipoEspesor = (ids, tipoEspesor) => (
        ids.indexOf(CAMPO_ESPESOR) !== -1 && tipoEspesor === '' ? [MENSAJES.SIN_TIPO_ESPESOR] : []
    );

    /**
     * Aplica RN-12 a RN-17, RN3-08 y RN3-09 al estado final del registro.
     * @param {{json: *, plantilla: string, patronNombre: string, patronCodigo: string, tipoEspesor: string}} configuracion
     * @returns {string[]} Mensajes de error; vacío si la configuración es válida.
     */
    const validarConfiguracion = ({ json, plantilla, patronNombre, patronCodigo, tipoEspesor, campoMedida, usaMapa }) => {
        let ids;
        try {
            ids = formato.parsearConfiguracion(json);
        } catch (errorDeFormato) {
            if (!formato.esErrorDeDominio(errorDeFormato)) throw errorDeFormato;
            return [errorDeFormato.message];
        }
        const errores = parametros.validarIds(ids).errores
            .concat(validarTipoEspesor(ids, tipoEspesor))
            .concat(validarCampoMedida(ids, campoMedida))
            .concat(validarMapa(ids, usaMapa));
        if (plantilla === '') return errores;
        return errores
            .concat(validarPlantilla(plantilla))
            .concat(validarPatron(patronCodigo, ETIQUETAS_PATRON.CODIGO, ids, usaMapa))
            .concat(validarPatron(patronNombre, ETIQUETAS_PATRON.NOMBRE, ids, usaMapa));
    };

    /**
     * Rechaza el guardado de una configuración que viole RN-12 a RN-17, RN3-08 o RN3-09. Solo actúa en CREATE, EDIT y XEDIT.
     * Sin plantilla, los patrones se permiten sin validar.
     * @param {Object} context - Contexto de beforeSubmit.
     * @returns {void}
     * @throws {Error} CONFIGURACION_NATURALEZA_INVALIDA con los errores unidos por "; ";
     * o el error inesperado original, después de registrarlo con log.error.
     */
    const beforeSubmit = (context) => {
        if (!debeValidar(context)) return;
        let errores;
        try {
            errores = validarConfiguracion(leerConfiguracion(context));
        } catch (errorInesperado) {
            log.error({ title: TITULO_LOG_ERROR, details: describirError(errorInesperado) });
            throw errorInesperado;
        }
        if (errores.length === 0) return;
        throw error.create({
            name: NOMBRE_ERROR,
            message: `${PREFIJO_MENSAJE}${errores.join(SEPARADOR_ERRORES)}`,
            notifyOff: true
        });
    };

    return { beforeSubmit };
});
