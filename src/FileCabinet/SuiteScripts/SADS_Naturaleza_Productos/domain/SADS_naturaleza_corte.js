/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Datos del artículo para el Sistema de Cortes (RN6-01 a RN6-05): valor de unidades como producto de
 * parámetros de la naturaleza y espesor como texto decimal.
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define(['./SADS_naturaleza_config_formato', './SADS_naturaleza_patron'], (formato, patron) => {
    /**
     * Nombres de los errores de dominio del módulo. Cada valor es igual a su llave.
     * @type {Readonly<{CORTE_INVALIDO: string}>}
     */
    const ERRORES = Object.freeze({
        CORTE_INVALIDO: 'CORTE_INVALIDO'
    });

    const DECIMALES = 6;

    const MENSAJES = Object.freeze({
        SIN_PARAMETROS: 'Parámetros para Valor de Unidades: capture una lista JSON de IDs de la configuración.',
        FUERA: (id) => `Parámetros para Valor de Unidades: ${id} no es un ID de la configuración.`,
        FUERA_SIN_ID: 'Parámetros para Valor de Unidades: un ID no pertenece a la configuración.',
        VALOR_FALTANTE: 'Falta el valor de un parámetro para calcular el valor de unidades.'
    });

    const PATRON_ID_CITABLE = /^[a-z0-9_]+$/;

    const errorDeCorte = (mensaje) => formato.crearErrorDeDominio(ERRORES.CORTE_INVALIDO, mensaje);

    /**
     * Lee y valida los parámetros del valor de unidades contra los IDs de la configuración (RN6-02). No lanza errores.
     * @param {*} texto - JSON capturado en custrecord_sads_naturaleza_valor_unid.
     * @param {string[]} idsConfiguracion - IDs del JSON de parámetros.
     * @returns {{valido: boolean, errores: string[], ids: string[]}}
     */
    const leerParametrosDeValor = (texto, idsConfiguracion) => {
        let ids;
        try {
            ids = formato.parsearConfiguracion(texto);
        } catch (errorDeFormato) {
            if (!formato.esErrorDeDominio(errorDeFormato)) throw errorDeFormato;
            return { valido: false, errores: [MENSAJES.SIN_PARAMETROS], ids: [] };
        }
        const permitidos = Array.isArray(idsConfiguracion) ? idsConfiguracion : [];
        const errores = ids
            .filter((id) => permitidos.indexOf(id) === -1)
            .map((id) => (PATRON_ID_CITABLE.test(id) ? MENSAJES.FUERA(id) : MENSAJES.FUERA_SIN_ID));
        return { valido: errores.length === 0, errores, ids };
    };

    /**
     * Valor de unidades: producto de los valores de los parámetros, redondeado a 6 decimales (RN6-03).
     * @param {Object} datos
     * @param {string[]} datos.ids - Parámetros a multiplicar.
     * @param {Object<string, number>} datos.valores - Valores validados del artículo (incluye los lados del mapa).
     * @returns {number} Por ejemplo 4 × 10 = 40; largo 6 = 6.
     * @throws {Error} CORTE_INVALIDO si falta un valor numérico o la lista está vacía.
     */
    const calcularValorDeUnidades = ({ ids, valores } = {}) => {
        if (!Array.isArray(ids) || ids.length === 0) throw errorDeCorte(MENSAJES.SIN_PARAMETROS);
        const producto = ids.reduce((acumulado, id) => {
            const valor = valores !== null && typeof valores === 'object' ? valores[id] : undefined;
            if (typeof valor !== 'number' || !Number.isFinite(valor)) throw errorDeCorte(MENSAJES.VALOR_FALTANTE);
            return acumulado * valor;
        }, 1);
        const factor = Math.pow(10, DECIMALES);
        return Math.round(producto * factor) / factor;
    };

    /**
     * Espesor como texto para custitemalm_articulo_espesor (RN6-04): decimal con cero y sin ceros finales.
     * @param {number} orden - Orden del espesor elegido (pulgadas decimales).
     * @returns {string} 0.0478 → '0.0478'; 0.5 → '0.5'; 1 → '1'.
     */
    const textoDeEspesor = (orden) => patron.formatearNumero(orden);

    return {
        ERRORES,
        leerParametrosDeValor,
        calcularValorDeUnidades,
        textoDeEspesor
    };
});
