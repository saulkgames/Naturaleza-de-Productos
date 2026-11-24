/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Patrones de nombre y código de los artículos creados por naturaleza.
 * Un marcador es {id} o {id:formato}: una llave de apertura, un ID de campo no vacío sin llaves,
 * opcionalmente dos puntos y un formato de FORMATOS, y una llave de cierre.
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

    /**
     * Formatos de marcador (D-13, D-14). Sin formato, el número se escribe en decimal (RN-07).
     * centesimas3: centésimas truncadas a 3 dígitos (0.5 → 050; 0.375 → 037).
     * fraccion16: fracción reducida hasta dieciseisavos (0.5 → 1/2; 1.25 → 1 1/4).
     * entero1: entero de 1 dígito, 1 a 9 (D-17). entero2: entero de 2 dígitos con cero a la izquierda, 1 a 99 (7 → 07) (D-16).
     * decimal2: número mayor que 0 con exactamente 2 decimales (6 → 6.00; 6.1 → 6.10) (D-20).
     * codigo y texto: segmento de código y texto del espesor elegido en el catálogo (RN3-09); solo para el campo de espesor.
     * @type {Readonly<{CENTESIMAS_3: string, FRACCION_16: string, ENTERO_1: string, ENTERO_2: string, DECIMAL_2: string, CODIGO: string, TEXTO: string}>}
     */
    const FORMATOS = Object.freeze({
        CENTESIMAS_3: 'centesimas3',
        FRACCION_16: 'fraccion16',
        ENTERO_1: 'entero1',
        ENTERO_2: 'entero2',
        DECIMAL_2: 'decimal2',
        CODIGO: 'codigo',
        TEXTO: 'texto'
    });

    const APERTURA = '{';
    const CIERRE = '}';
    const SEPARADOR_FORMATO = ':';
    const DECIMALES_DE_FORMATO = 6;
    const MILLONESIMAS_POR_UNIDAD = 1000000;
    const MILLONESIMAS_POR_CENTESIMA = 10000;
    const MILLONESIMAS_POR_DIECISEISAVO = 62500;
    const DIECISEISAVOS_POR_UNIDAD = 16;
    const DIGITOS_CENTESIMAS = 3;
    const CENTESIMAS_MINIMAS = 1;
    const CENTESIMAS_MAXIMAS = 999;
    const ENTERO_MINIMO = 1;
    const ENTERO_1_MAXIMO = 9;
    const ENTERO_2_MAXIMO = 99;
    const DIGITOS_ENTERO_2 = 2;
    const DECIMALES_DECIMAL_2 = 2;
    const PATRON_ID_CITABLE = /^[a-z0-9_]+$/;

    const MENSAJES = Object.freeze({
        NO_ES_TEXTO: 'El patrón debe ser texto.',
        VACIO: 'El patrón está vacío.',
        SIN_CERRAR: 'El patrón tiene una llave { sin cerrar.',
        SIN_ABRIR: 'El patrón tiene una llave } sin abrir.',
        MARCADOR_VACIO: 'El patrón tiene un marcador vacío {}.',
        MARCADOR_SIN_ID: 'El patrón tiene un marcador sin ID de campo antes de los dos puntos.',
        FORMATO_VACIO: 'El patrón tiene un marcador con formato vacío después de los dos puntos.',
        MARCADOR_NO_PERMITIDO: 'Un marcador del patrón no es un ID de la configuración.',
        FORMATO_DESCONOCIDO: 'Un marcador del patrón tiene un formato que no existe.',
        VALOR_FALTANTE: 'Falta el valor de un marcador del patrón.',
        VALOR_FUERA_DE_FORMATO: 'El valor de un marcador no cabe en su formato.',
        RESULTADO_VACIO: 'El patrón generó un texto vacío.',
        NUMERO_INVALIDO: 'El valor de un marcador debe ser un número finito.',
        FORMATO_DE_CATALOGO: 'El formato codigo o texto requiere el espesor elegido.',
        CATALOGO_SIN_FORMATO: 'Un marcador de catálogo requiere el formato codigo o texto.',
        FORMATO_SOLO_CATALOGO: 'El formato codigo o texto solo aplica al campo de espesor.',
        TEXTO_FALTANTE: 'Falta el texto del espesor elegido para un marcador del patrón.'
    });

    const FORMATOS_DE_CATALOGO = [FORMATOS.CODIGO, FORMATOS.TEXTO];

    const FORMATOS_VALIDOS = Object.keys(FORMATOS).map((llave) => FORMATOS[llave]);

    const LISTA_DE_FORMATOS = `Formatos válidos: ${FORMATOS_VALIDOS.join(', ')}.`;

    const MENSAJES_DE_CAPTURA = Object.freeze({
        [FORMATOS.CENTESIMAS_3]: (etiqueta) => `${etiqueta}: el valor no cabe en 3 dígitos de centésimas (de 0.01 a 9.99).`,
        [FORMATOS.FRACCION_16]: (etiqueta) => `${etiqueta}: el valor no corresponde a una fracción de 1/16 de pulgada.`,
        [FORMATOS.ENTERO_1]: (etiqueta) => `${etiqueta}: capture un número entero de ${ENTERO_MINIMO} a ${ENTERO_1_MAXIMO}.`,
        [FORMATOS.ENTERO_2]: (etiqueta) => `${etiqueta}: capture un número entero de ${ENTERO_MINIMO} a ${ENTERO_2_MAXIMO}.`,
        [FORMATOS.DECIMAL_2]: (etiqueta) => `${etiqueta}: capture un número mayor que 0 con máximo ${DECIMALES_DECIMAL_2} decimales.`
    });

    const errorDePatron = (mensaje) => formato.crearErrorDeDominio(ERRORES.PATRON_INVALIDO, mensaje);

    const esCitable = (texto) => typeof texto === 'string' && PATRON_ID_CITABLE.test(texto);

    const esFormatoValido = (nombre) => nombre === null || FORMATOS_VALIDOS.indexOf(nombre) !== -1;

    const tienePropiedad = (objeto, llave) => (
        objeto !== null && typeof objeto === 'object' && Object.prototype.hasOwnProperty.call(objeto, llave)
    );

    const marcadorNoPermitido = (id) => (
        esCitable(id) ? `El marcador {${id}} no es un ID de la configuración.` : MENSAJES.MARCADOR_NO_PERMITIDO
    );

    const formatoDesconocido = ({ id, formato: nombre }) => (
        esCitable(id) && esCitable(nombre)
            ? `El formato ${nombre} del marcador {${id}} no existe. ${LISTA_DE_FORMATOS}`
            : `${MENSAJES.FORMATO_DESCONOCIDO} ${LISTA_DE_FORMATOS}`
    );

    const esFormatoDeCatalogo = (nombre) => FORMATOS_DE_CATALOGO.indexOf(nombre) !== -1;

    const catalogoSinFormato = (id) => (
        esCitable(id) ? `El marcador {${id}} es un catálogo y requiere el formato codigo o texto.` : MENSAJES.CATALOGO_SIN_FORMATO
    );

    const formatoSoloCatalogo = (nombre) => (
        esCitable(nombre) ? `El formato ${nombre} solo aplica al campo de espesor.` : MENSAJES.FORMATO_SOLO_CATALOGO
    );

    const textoFaltante = (id) => (
        esCitable(id) ? `Falta el texto del espesor para el marcador {${id}}.` : MENSAJES.TEXTO_FALTANTE
    );

    const valorFaltante = (id) => (esCitable(id) ? `Falta el valor del marcador {${id}}.` : MENSAJES.VALOR_FALTANTE);

    const valorFueraDeFormato = ({ id, formato: nombre }) => (
        esCitable(id) ? `El valor del marcador {${id}} no cabe en el formato ${nombre}.` : MENSAJES.VALOR_FUERA_DE_FORMATO
    );

    const leerMarcador = (contenido) => {
        const separador = contenido.indexOf(SEPARADOR_FORMATO);
        if (separador === -1) return { id: contenido, formato: null };
        const id = contenido.slice(0, separador);
        const nombre = contenido.slice(separador + 1);
        if (id === '') throw errorDePatron(MENSAJES.MARCADOR_SIN_ID);
        if (nombre === '') throw errorDePatron(MENSAJES.FORMATO_VACIO);
        return { id, formato: nombre };
    };

    /**
     * Divide un patrón en texto literal y marcadores.
     * @param {string} patron
     * @returns {Array<{texto: string}|{id: string, formato: ?string}>}
     * @throws {Error} PATRON_INVALIDO si la estructura de llaves o de un marcador es inválida.
     */
    const dividirPatron = (patron) => {
        if (typeof patron !== 'string') throw errorDePatron(MENSAJES.NO_ES_TEXTO);
        const partes = [];
        let literal = '';
        let posicion = 0;
        while (posicion < patron.length) {
            const caracter = patron.charAt(posicion);
            if (caracter === CIERRE) throw errorDePatron(MENSAJES.SIN_ABRIR);
            if (caracter !== APERTURA) {
                literal += caracter;
                posicion += 1;
            } else {
                const cierre = patron.indexOf(CIERRE, posicion + 1);
                if (cierre === -1) throw errorDePatron(MENSAJES.SIN_CERRAR);
                const contenido = patron.slice(posicion + 1, cierre);
                if (contenido === '') throw errorDePatron(MENSAJES.MARCADOR_VACIO);
                if (contenido.indexOf(APERTURA) !== -1) throw errorDePatron(MENSAJES.SIN_CERRAR);
                if (literal !== '') partes.push({ texto: literal });
                literal = '';
                partes.push(leerMarcador(contenido));
                posicion = cierre + 1;
            }
        }
        if (literal !== '') partes.push({ texto: literal });
        return partes;
    };

    const marcadoresDe = (partes) => partes.filter((parte) => tienePropiedad(parte, 'id'));

    const unicosPor = (elementos, llave) => {
        const vistos = [];
        return elementos.filter((elemento) => {
            const clave = llave(elemento);
            if (vistos.indexOf(clave) !== -1) return false;
            vistos.push(clave);
            return true;
        });
    };

    const claveDeMarcador = (marcador) => `${marcador.id}${SEPARADOR_FORMATO}${marcador.formato === null ? '' : marcador.formato}`;

    const validarNumero = (numero) => {
        if (typeof numero !== 'number' || !Number.isFinite(numero)) throw errorDePatron(MENSAJES.NUMERO_INVALIDO);
    };

    const aMillonesimas = (numero) => Math.round(numero * MILLONESIMAS_POR_UNIDAD);

    // D-13: truncado en centésimas; se redondea antes a millonésimas para evitar el error de punto flotante (0.29 → 029).
    const formatearCentesimas3 = (numero) => {
        const centesimas = Math.floor(aMillonesimas(numero) / MILLONESIMAS_POR_CENTESIMA);
        if (centesimas < CENTESIMAS_MINIMAS || centesimas > CENTESIMAS_MAXIMAS) return null;
        return String(centesimas).padStart(DIGITOS_CENTESIMAS, '0');
    };

    // D-14: el denominador es potencia de 2; dividir entre 2 mientras el numerador sea par reduce la fracción.
    const formatearFraccion16 = (numero) => {
        const millonesimas = aMillonesimas(numero);
        if (millonesimas < 0 || millonesimas % MILLONESIMAS_POR_DIECISEISAVO !== 0) return null;
        const dieciseisavos = millonesimas / MILLONESIMAS_POR_DIECISEISAVO;
        const entero = Math.floor(dieciseisavos / DIECISEISAVOS_POR_UNIDAD);
        let numerador = dieciseisavos % DIECISEISAVOS_POR_UNIDAD;
        let denominador = DIECISEISAVOS_POR_UNIDAD;
        if (numerador === 0) return String(entero);
        while (numerador % 2 === 0) {
            numerador /= 2;
            denominador /= 2;
        }
        const fraccion = `${numerador}/${denominador}`;
        return entero === 0 ? fraccion : `${entero} ${fraccion}`;
    };

    /**
     * Da formato a un número para un patrón (RN-07): toFixed(6) sin ceros finales ni punto final.
     * @param {number} numero - Número finito.
     * @returns {string} Por ejemplo 2.5 → '2.5', 4 → '4', 0.125 → '0.125'.
     * @throws {Error} PATRON_INVALIDO si numero no es un número finito.
     */
    const esEnteroEnRango = (numero, maximo) => Number.isInteger(numero) && numero >= ENTERO_MINIMO && numero <= maximo;

    // D-17: un dígito.
    const formatearEntero1 = (numero) => (esEnteroEnRango(numero, ENTERO_1_MAXIMO) ? String(numero) : null);

    // D-16: dos dígitos con cero a la izquierda (7 → 07).
    const formatearEntero2 = (numero) => (
        esEnteroEnRango(numero, ENTERO_2_MAXIMO) ? String(numero).padStart(DIGITOS_ENTERO_2, '0') : null
    );

    // D-20: se redondea antes a millonésimas para evitar el error de punto flotante (6.1 → 6.10).
    const formatearDecimal2 = (numero) => {
        const millonesimas = aMillonesimas(numero);
        if (millonesimas <= 0 || millonesimas % MILLONESIMAS_POR_CENTESIMA !== 0) return null;
        return (millonesimas / MILLONESIMAS_POR_UNIDAD).toFixed(DECIMALES_DECIMAL_2);
    };

    const formatearNumero = (numero) => {
        validarNumero(numero);
        const texto = numero.toFixed(DECIMALES_DE_FORMATO);
        if (texto.indexOf('.') === -1) return texto;
        const sinCeros = texto.replace(/0+$/, '').replace(/\.$/, '');
        return sinCeros === '-0' ? '0' : sinCeros;
    };

    const FORMATEADORES = Object.freeze({
        [FORMATOS.CENTESIMAS_3]: formatearCentesimas3,
        [FORMATOS.FRACCION_16]: formatearFraccion16,
        [FORMATOS.ENTERO_1]: formatearEntero1,
        [FORMATOS.ENTERO_2]: formatearEntero2,
        [FORMATOS.DECIMAL_2]: formatearDecimal2
    });

    /**
     * Escribe un número con un formato de marcador.
     * @param {number} numero - Número finito.
     * @param {?string} nombre - Formato numérico de FORMATOS o null para el decimal de RN-07.
     * @returns {?string} Texto formateado; null si el número no cabe en el formato.
     * @throws {Error} PATRON_INVALIDO si numero no es un número finito, el formato no existe o es de catálogo.
     */
    const formatearValor = (numero, nombre) => {
        validarNumero(numero);
        if (nombre === null) return formatearNumero(numero);
        if (!esFormatoValido(nombre)) throw errorDePatron(`${MENSAJES.FORMATO_DESCONOCIDO} ${LISTA_DE_FORMATOS}`);
        if (esFormatoDeCatalogo(nombre)) throw errorDePatron(MENSAJES.FORMATO_DE_CATALOGO);
        return FORMATEADORES[nombre](numero);
    };

    /**
     * Extrae los IDs de los marcadores de un patrón.
     * @param {string} patron - Texto del patrón.
     * @returns {string[]} IDs en orden de primera aparición, sin duplicados ni formato.
     * @throws {Error} PATRON_INVALIDO si patron no es cadena, contiene {}, {:formato} o {id:},
     * o queda una llave sin abrir o sin cerrar.
     */
    const extraerMarcadores = (patron) => unicosPor(marcadoresDe(dividirPatron(patron)), (marcador) => marcador.id)
        .map((marcador) => marcador.id);

    /**
     * Valida un patrón contra los IDs de la configuración y los formatos (RN-14, RN-15, RN-17, RN3-09). No lanza errores.
     * @param {Object} datos
     * @param {string} datos.patron - Texto del patrón.
     * @param {string[]} datos.idsPermitidos - IDs del JSON de la configuración.
     * @param {string[]} [datos.idsCatalogo] - IDs de parámetros de catálogo (el espesor); solo admiten codigo o texto.
     * @returns {{valido: boolean, errores: string[]}} Un mensaje por patrón vacío, por estructura inválida,
     * por cada marcador que no está en idsPermitidos, por cada formato que no existe y por cada formato
     * que no corresponde al tipo de parámetro. Un ID o formato se cita solo si cumple ^[a-z0-9_]+$.
     */
    const validar = ({ patron, idsPermitidos, idsCatalogo } = {}) => {
        if (typeof patron !== 'string' || patron.trim() === '') return { valido: false, errores: [MENSAJES.VACIO] };
        let marcadores;
        try {
            marcadores = marcadoresDe(dividirPatron(patron));
        } catch (errorDeEstructura) {
            if (!formato.esErrorDeDominio(errorDeEstructura)) throw errorDeEstructura;
            return { valido: false, errores: [errorDeEstructura.message] };
        }
        const permitidos = Array.isArray(idsPermitidos) ? idsPermitidos : [];
        const erroresDeId = unicosPor(marcadores, (marcador) => marcador.id)
            .filter((marcador) => permitidos.indexOf(marcador.id) === -1)
            .map((marcador) => marcadorNoPermitido(marcador.id));
        const catalogo = Array.isArray(idsCatalogo) ? idsCatalogo : [];
        const unicos = unicosPor(marcadores, claveDeMarcador);
        const erroresDeFormato = unicos
            .filter((marcador) => !esFormatoValido(marcador.formato))
            .map((marcador) => formatoDesconocido(marcador));
        const erroresDeCatalogo = unicos
            .filter((marcador) => esFormatoValido(marcador.formato))
            .map((marcador) => {
                const esCatalogo = catalogo.indexOf(marcador.id) !== -1;
                if (esCatalogo && !esFormatoDeCatalogo(marcador.formato)) return catalogoSinFormato(marcador.id);
                if (!esCatalogo && esFormatoDeCatalogo(marcador.formato)) return formatoSoloCatalogo(marcador.formato);
                return null;
            })
            .filter((mensaje) => mensaje !== null);
        const errores = erroresDeId.concat(erroresDeFormato, unicosPor(erroresDeCatalogo, (mensaje) => mensaje));
        return { valido: errores.length === 0, errores };
    };

    /**
     * Revisa que cada valor capturado quepa en el formato de sus marcadores (D-13, D-14). No lanza errores.
     * No reporta estructura inválida, formatos desconocidos ni valores faltantes: esos los reporta aplicar.
     * @param {Object} datos
     * @param {string} datos.patron - Texto del patrón.
     * @param {Object<string, number>} datos.valores - Valor numérico por ID de campo.
     * @param {Object<string, string>} datos.etiquetas - Etiqueta visible por ID de campo; si falta se usa el ID.
     * @returns {{valido: boolean, errores: string[]}} Un mensaje por campo y formato, con la etiqueta del campo.
     */
    const validarFormatos = ({ patron, valores, etiquetas } = {}) => {
        let marcadores;
        try {
            marcadores = marcadoresDe(dividirPatron(patron));
        } catch (errorDeEstructura) {
            if (!formato.esErrorDeDominio(errorDeEstructura)) throw errorDeEstructura;
            return { valido: true, errores: [] };
        }
        const errores = unicosPor(marcadores, claveDeMarcador)
            .filter((marcador) => (
                marcador.formato !== null
                && esFormatoValido(marcador.formato)
                && !esFormatoDeCatalogo(marcador.formato)
                && tienePropiedad(valores, marcador.id)
                && typeof valores[marcador.id] === 'number'
                && Number.isFinite(valores[marcador.id])
                && FORMATEADORES[marcador.formato](valores[marcador.id]) === null
            ))
            .map((marcador) => {
                const etiqueta = tienePropiedad(etiquetas, marcador.id) ? String(etiquetas[marcador.id]) : marcador.id;
                return MENSAJES_DE_CAPTURA[marcador.formato](etiqueta);
            });
        return { valido: errores.length === 0, errores };
    };

    /**
     * Sustituye cada marcador por el valor de su parámetro con su formato (RN-06, RN-07, RN-17, RN3-09).
     * Sustitución literal, sin evaluación.
     * @param {Object} datos
     * @param {string} datos.patron - Texto del patrón.
     * @param {Object<string, number>} datos.valores - Valor numérico por ID de campo.
     * @param {Object<string, {codigo: string, texto: string}>} [datos.textos] - Textos del espesor elegido por ID de campo.
     * @returns {string} Texto resultante recortado.
     * @throws {Error} PATRON_INVALIDO si el patrón es inválido, falta el valor de un marcador, un valor no es número
     * finito, un formato no existe, un valor no cabe en su formato, falta el texto de catálogo o el resultado queda vacío.
     */
    const aplicar = ({ patron, valores, textos } = {}) => {
        const resultado = dividirPatron(patron).map((parte) => {
            if (!tienePropiedad(parte, 'id')) return parte.texto;
            if (!esFormatoValido(parte.formato)) throw errorDePatron(formatoDesconocido(parte));
            if (esFormatoDeCatalogo(parte.formato)) {
                const elegido = tienePropiedad(textos, parte.id) ? textos[parte.id] : null;
                const texto = tienePropiedad(elegido, parte.formato) ? String(elegido[parte.formato]) : '';
                if (texto.trim() === '') throw errorDePatron(textoFaltante(parte.id));
                return texto;
            }
            if (!tienePropiedad(valores, parte.id)) throw errorDePatron(valorFaltante(parte.id));
            const texto = formatearValor(valores[parte.id], parte.formato);
            if (texto === null) throw errorDePatron(valorFueraDeFormato(parte));
            return texto;
        }).join('').trim();
        if (resultado === '') throw errorDePatron(MENSAJES.RESULTADO_VACIO);
        return resultado;
    };

    return {
        ERRORES,
        FORMATOS,
        extraerMarcadores,
        validar,
        validarFormatos,
        aplicar,
        formatearNumero,
        formatearValor
    };
});
