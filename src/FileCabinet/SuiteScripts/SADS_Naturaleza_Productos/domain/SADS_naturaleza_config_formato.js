/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Contrato de formato de custrecord_sads_naturaleza_config: texto JSON con un arreglo
 * no vacío de IDs de campo de artículo, el mismo que leen SADS_CS_item_dynamic_mandatory.js y
 * SADS_UE_item_dynamic_mandatory.js. Define además los errores de dominio de la configuración.
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define([], () => {
    /**
     * Nombres de los errores de dominio. Cada valor es igual a su llave.
     * @type {Readonly<{CONFIGURACION_INVALIDA: string, TIPO_ARTICULO_DESCONOCIDO: string, NATURALEZA_NO_DISPONIBLE: string}>}
     */
    const ERRORES = Object.freeze({
        CONFIGURACION_INVALIDA: 'CONFIGURACION_INVALIDA',
        TIPO_ARTICULO_DESCONOCIDO: 'TIPO_ARTICULO_DESCONOCIDO',
        NATURALEZA_NO_DISPONIBLE: 'NATURALEZA_NO_DISPONIBLE'
    });

    const MENSAJES = Object.freeze({
        NO_ES_LISTA: 'La configuración debe ser una lista de IDs de campo.',
        SIN_CAMPOS: 'La configuración debe incluir al menos un ID de campo.',
        NO_ES_TEXTO: 'La configuración debe ser texto en formato JSON.',
        JSON_INVALIDO: 'La configuración no tiene formato JSON válido.',
        NO_ES_ARREGLO: 'La configuración debe ser un arreglo JSON.',
        ELEMENTO_INVALIDO: 'Cada elemento de la configuración debe ser un ID de campo no vacío.',
        RESULTADO_INVALIDO: 'La configuración generada no cumple el formato esperado.'
    });

    /**
     * Crea un error de dominio.
     * @param {string} nombre - Uno de los valores de ERRORES.
     * @param {string} mensaje - Mensaje en español apto para mostrarse al usuario.
     * @returns {Error} Error con name = nombre, message = mensaje y esErrorDeDominio = true.
     */
    const crearErrorDeDominio = (nombre, mensaje) => {
        const errorDeDominio = new Error(mensaje);
        errorDeDominio.name = nombre;
        errorDeDominio.esErrorDeDominio = true;
        return errorDeDominio;
    };

    /**
     * Indica si un valor capturado es un error de dominio. No lanza errores.
     * @param {*} valor - Valor capturado en un catch.
     * @returns {boolean} true solo si valor es un objeto no nulo con esErrorDeDominio === true.
     */
    const esErrorDeDominio = (valor) => {
        try {
            return typeof valor === 'object' && valor !== null && valor.esErrorDeDominio === true;
        } catch (errorDeLectura) {
            return false;
        }
    };

    const errorDeConfiguracionInvalida = (mensaje) => crearErrorDeDominio(ERRORES.CONFIGURACION_INVALIDA, mensaje);

    const compararPorCodigo = (a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    };

    const esCadenaConContenido = (valor) => typeof valor === 'string' && valor.trim() !== '';

    /**
     * Lee el texto de una configuración y verifica el contrato de formato.
     * @param {string} texto - Texto JSON guardado en la configuración.
     * @returns {string[]} Arreglo parseado, sin transformar.
     * @throws {Error} CONFIGURACION_INVALIDA si texto no es cadena, no es JSON válido, no es arreglo,
     * es un arreglo vacío o algún elemento no es una cadena con contenido tras trim().
     */
    const parsearConfiguracion = (texto) => {
        if (typeof texto !== 'string') throw errorDeConfiguracionInvalida(MENSAJES.NO_ES_TEXTO);
        let valor;
        try {
            valor = JSON.parse(texto);
        } catch (errorDeSintaxis) {
            throw errorDeConfiguracionInvalida(MENSAJES.JSON_INVALIDO);
        }
        if (!Array.isArray(valor)) throw errorDeConfiguracionInvalida(MENSAJES.NO_ES_ARREGLO);
        if (valor.length === 0) throw errorDeConfiguracionInvalida(MENSAJES.SIN_CAMPOS);
        if (!valor.every((elemento) => esCadenaConContenido(elemento))) {
            throw errorDeConfiguracionInvalida(MENSAJES.ELEMENTO_INVALIDO);
        }
        return valor;
    };

    /**
     * Indica si un texto cumple el contrato de formato. No lanza errores.
     * @param {string} texto - Texto JSON.
     * @returns {boolean} true si parsearConfiguracion no lanza; false en cualquier otro caso.
     */
    const esConfiguracionValida = (texto) => {
        try {
            parsearConfiguracion(texto);
            return true;
        } catch (errorDeFormato) {
            return false;
        }
    };

    /**
     * Genera el texto JSON de una configuración (RN-07).
     * Ignora null y undefined, convierte cada elemento con String(), recorta espacios, descarta vacíos
     * y duplicados, y ordena por código de carácter. No cambia mayúsculas ni minúsculas.
     * @param {Array<*>} ids - IDs de campo de artículo.
     * @returns {string} Arreglo JSON sin espacios, por ejemplo '["custitem_b","upccode"]'.
     * @throws {Error} CONFIGURACION_INVALIDA si ids no es arreglo, si no queda ningún ID o si el texto
     * generado no pasa esConfiguracionValida.
     */
    const serializarConfiguracion = (ids) => {
        if (!Array.isArray(ids)) throw errorDeConfiguracionInvalida(MENSAJES.NO_ES_LISTA);
        const recortados = ids
            .filter((id) => id !== null && id !== undefined)
            .map((id) => String(id).trim())
            .filter((id) => id !== '');
        const ordenados = Array.from(new Set(recortados)).sort(compararPorCodigo);
        if (ordenados.length === 0) throw errorDeConfiguracionInvalida(MENSAJES.SIN_CAMPOS);
        const texto = JSON.stringify(ordenados);
        if (!esConfiguracionValida(texto)) throw errorDeConfiguracionInvalida(MENSAJES.RESULTADO_INVALIDO);
        return texto;
    };

    return {
        ERRORES,
        crearErrorDeDominio,
        esErrorDeDominio,
        serializarConfiguracion,
        parsearConfiguracion,
        esConfiguracionValida
    };
});
