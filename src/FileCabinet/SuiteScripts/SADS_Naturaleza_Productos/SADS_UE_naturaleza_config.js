/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Valida la captura manual del registro de configuración de Naturaleza de Productos antes de guardarlo:
 * JSON de parámetros, artículo plantilla y patrones de nombre y código (RN-12 a RN-17).
 */
define([
    'N/error',
    'N/log',
    './domain/SADS_naturaleza_config_formato',
    './domain/SADS_naturaleza_patron',
    './domain/SADS_naturaleza_parametros',
    './infra/SADS_naturaleza_articulo_ns'
], (error, log, formato, patron, parametros, articulos) => {
    const NOMBRE_ERROR = 'CONFIGURACION_NATURALEZA_INVALIDA';
    const PREFIJO_MENSAJE = 'La configuración no es válida: ';
    const SEPARADOR_ERRORES = '; ';
    const PATRON_ID_INTERNO = /^[1-9][0-9]*$/;

    const CAMPOS_CONFIGURACION = Object.freeze({
        JSON: 'custrecord_sads_naturaleza_config',
        PLANTILLA: 'custrecord_sads_naturaleza_plantilla',
        PATRON_NOMBRE: 'custrecord_sads_naturaleza_patron_nom',
        PATRON_CODIGO: 'custrecord_sads_naturaleza_patron_cod'
    });

    const ETIQUETAS_PATRON = Object.freeze({
        CODIGO: 'Patrón de código',
        NOMBRE: 'Patrón de nombre'
    });

    const MENSAJES = Object.freeze({
        PLANTILLA_NO_NUMERICA: 'El artículo plantilla debe ser un ID interno numérico.',
        PLANTILLA_INEXISTENTE: (id) => `El artículo plantilla ${id} no existe.`,
        PATRON_OBLIGATORIO: (etiqueta) => `${etiqueta}: es obligatorio cuando hay artículo plantilla.`
    });

    const TITULO_LOG_ERROR = 'Validación de configuración de naturaleza: error inesperado';

    const aCadena = (valor) => (valor === null || valor === undefined ? '' : String(valor));

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
     * @returns {{json: *, plantilla: string, patronNombre: string, patronCodigo: string}} Objeto plano.
     */
    const leerConfiguracion = (context) => ({
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

    // RN-14 y RN-15.
    const validarPatron = (texto, etiqueta, ids) => {
        if (texto.trim() === '') return [MENSAJES.PATRON_OBLIGATORIO(etiqueta)];
        return patron.validar({ patron: texto, idsPermitidos: ids }).errores.map((mensaje) => `${etiqueta}: ${mensaje}`);
    };

    /**
     * Aplica RN-12 a RN-17 al estado final del registro.
     * @param {{json: *, plantilla: string, patronNombre: string, patronCodigo: string}} configuracion
     * @returns {string[]} Mensajes de error; vacío si la configuración es válida.
     */
    const validarConfiguracion = ({ json, plantilla, patronNombre, patronCodigo }) => {
        let ids;
        try {
            ids = formato.parsearConfiguracion(json);
        } catch (errorDeFormato) {
            if (!formato.esErrorDeDominio(errorDeFormato)) throw errorDeFormato;
            return [errorDeFormato.message];
        }
        const errores = parametros.validarIds(ids).errores.slice();
        if (plantilla === '') return errores;
        return errores
            .concat(validarPlantilla(plantilla))
            .concat(validarPatron(patronCodigo, ETIQUETAS_PATRON.CODIGO, ids))
            .concat(validarPatron(patronNombre, ETIQUETAS_PATRON.NOMBRE, ids));
    };

    /**
     * Rechaza el guardado de una configuración que viole RN-12 a RN-17. Solo actúa en CREATE, EDIT y XEDIT.
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
