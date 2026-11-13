/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Patrones de nombre y código de los artículos creados por naturaleza.
 * Un marcador es una llave de apertura, un ID de campo no vacío sin llaves y una llave de cierre: {custitem_x}.
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define(['./SADS_naturaleza_config_formato'], (formato) => {
    /**
     * Nombres de los errores de dominio del módulo. Cada valor es igual a su llave.
     * @type {Readonly<{PATRON_INVALIDO: string}>}
     */
    const ERRORES = Object.freeze({
        PATRON_INVALIDO: 'PATRON_INVALIDO'
    });

    const APERTURA = '{';
    const CIERRE = '}';
    const DECIMALES_DE_FORMATO = 6;
    const PATRON_ID_CITABLE = /^[a-z0-9_]+$/;

    const MENSAJES = Object.freeze({
        NO_ES_TEXTO: 'El patrón debe ser texto.',
        VACIO: 'El patrón está vacío.',
        SIN_CERRAR: 'El patrón tiene una llave { sin cerrar.',
        SIN_ABRIR: 'El patrón tiene una llave } sin abrir.',
        MARCADOR_VACIO: 'El patrón tiene un marcador vacío {}.',
        MARCADOR_NO_PERMITIDO: 'Un marcador del patrón no es un ID de la configuración.',
        VALOR_FALTANTE: 'Falta el valor de un marcador del patrón.',
        RESULTADO_VACIO: 'El patrón generó un texto vacío.',
        NUMERO_INVALIDO: 'El valor de un marcador debe ser un número finito.'
    });

    const errorDePatron = (mensaje) => formato.crearErrorDeDominio(ERRORES.PATRON_INVALIDO, mensaje);

    const esCitable = (id) => typeof id === 'string' && PATRON_ID_CITABLE.test(id);

    const marcadorNoPermitido = (id) => (
        esCitable(id) ? `El marcador {${id}} no es un ID de la configuración.` : MENSAJES.MARCADOR_NO_PERMITIDO
    );

    const valorFaltante = (id) => (
        esCitable(id) ? `Falta el valor del marcador {${id}}.` : MENSAJES.VALOR_FALTANTE
    );

    const tienePropiedad = (objeto, llave) => (
        objeto !== null && typeof objeto === 'object' && Object.prototype.hasOwnProperty.call(objeto, llave)
    );

    /**
     * Extrae los IDs de los marcadores de un patrón.
     * @param {string} patron - Texto del patrón.
     * @returns {string[]} IDs en orden de primera aparición, sin duplicados.
     * @throws {Error} PATRON_INVALIDO si patron no es cadena, contiene {}, o queda una llave sin abrir o sin cerrar.
     */
    const extraerMarcadores = (patron) => {
        if (typeof patron !== 'string') throw errorDePatron(MENSAJES.NO_ES_TEXTO);
        const marcadores = [];
        let posicion = 0;
        while (posicion < patron.length) {
            const caracter = patron.charAt(posicion);
            if (caracter === CIERRE) throw errorDePatron(MENSAJES.SIN_ABRIR);
            if (caracter !== APERTURA) {
                posicion += 1;
            } else {
                const cierre = patron.indexOf(CIERRE, posicion + 1);
                if (cierre === -1) throw errorDePatron(MENSAJES.SIN_CERRAR);
                const id = patron.slice(posicion + 1, cierre);
                if (id === '') throw errorDePatron(MENSAJES.MARCADOR_VACIO);
                if (id.indexOf(APERTURA) !== -1) throw errorDePatron(MENSAJES.SIN_CERRAR);
                if (marcadores.indexOf(id) === -1) marcadores.push(id);
                posicion = cierre + 1;
            }
        }
        return marcadores;
    };

    /**
     * Valida un patrón contra los IDs de la configuración (RN-14, RN-15). No lanza errores.
     * @param {Object} datos
     * @param {string} datos.patron - Texto del patrón.
     * @param {string[]} datos.idsPermitidos - IDs del JSON de la configuración.
     * @returns {{valido: boolean, errores: string[]}} Un mensaje por patrón vacío, por estructura inválida
     * o por cada marcador que no está en idsPermitidos. Un marcador se cita solo si cumple ^[a-z0-9_]+$.
     */
    const validar = ({ patron, idsPermitidos } = {}) => {
        if (typeof patron !== 'string' || patron.trim() === '') return { valido: false, errores: [MENSAJES.VACIO] };
        let marcadores;
        try {
            marcadores = extraerMarcadores(patron);
        } catch (errorDeEstructura) {
            if (!formato.esErrorDeDominio(errorDeEstructura)) throw errorDeEstructura;
            return { valido: false, errores: [errorDeEstructura.message] };
        }
        const permitidos = Array.isArray(idsPermitidos) ? idsPermitidos : [];
        const errores = marcadores
            .filter((id) => permitidos.indexOf(id) === -1)
            .map((id) => marcadorNoPermitido(id));
        return { valido: errores.length === 0, errores };
    };

    /**
     * Da formato a un número para un patrón (RN-07): toFixed(6) sin ceros finales ni punto final.
     * @param {number} numero - Número finito.
     * @returns {string} Por ejemplo 2.5 → '2.5', 4 → '4', 0.125 → '0.125'.
     * @throws {Error} PATRON_INVALIDO si numero no es un número finito.
     */
    const formatearNumero = (numero) => {
        if (typeof numero !== 'number' || !Number.isFinite(numero)) throw errorDePatron(MENSAJES.NUMERO_INVALIDO);
        const texto = numero.toFixed(DECIMALES_DE_FORMATO);
        if (texto.indexOf('.') === -1) return texto;
        const sinCeros = texto.replace(/0+$/, '').replace(/\.$/, '');
        return sinCeros === '-0' ? '0' : sinCeros;
    };

    /**
     * Sustituye cada marcador por el valor de su parámetro (RN-06, RN-07). Sustitución literal, sin evaluación.
     * @param {Object} datos
     * @param {string} datos.patron - Texto del patrón.
     * @param {Object<string, number>} datos.valores - Valor numérico por ID de campo.
     * @returns {string} Texto resultante recortado.
     * @throws {Error} PATRON_INVALIDO si el patrón es inválido, falta el valor de un marcador,
     * un valor no es número finito o el resultado queda vacío.
     */
    const aplicar = ({ patron, valores } = {}) => {
        const marcadores = extraerMarcadores(patron);
        const resultado = marcadores.reduce((texto, id) => {
            if (!tienePropiedad(valores, id)) throw errorDePatron(valorFaltante(id));
            return texto.split(`${APERTURA}${id}${CIERRE}`).join(formatearNumero(valores[id]));
        }, patron).trim();
        if (resultado === '') throw errorDePatron(MENSAJES.RESULTADO_VACIO);
        return resultado;
    };

    return {
        ERRORES,
        extraerMarcadores,
        validar,
        aplicar,
        formatearNumero
    };
});
