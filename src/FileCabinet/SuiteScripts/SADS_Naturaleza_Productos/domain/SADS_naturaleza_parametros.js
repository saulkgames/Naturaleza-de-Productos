/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Parámetros de una naturaleza de producto: IDs de campo del JSON de configuración,
 * definición de cada campo, valores capturados en el Suitelet y criterios de duplicado.
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define(['./SADS_naturaleza_config_formato'], (formato) => {
    /**
     * Nombres de los errores de dominio del módulo. Cada valor es igual a su llave.
     * @type {Readonly<{PARAMETRO_INVALIDO: string}>}
     */
    const ERRORES = Object.freeze({
        PARAMETRO_INVALIDO: 'PARAMETRO_INVALIDO'
    });

    /**
     * Tipos de parámetro admitidos. Supuesto S-03: float e integer son valores de Field.type en minúsculas.
     * catalogo es el campo de espesor, que el entry point identifica por su ID (S3-06).
     * @type {Readonly<{FLOAT: string, INTEGER: string, CATALOGO: string}>}
     */
    const TIPOS_SOPORTADOS = Object.freeze({
        FLOAT: 'float',
        INTEGER: 'integer',
        CATALOGO: 'catalogo'
    });

    const PATRON_ID_SEGURO = /^[a-z0-9_]+$/;
    const PATRON_NUMERO_CAPTURADO = /^\d+(\.\d+)?$/;
    const ETIQUETA_PESO = 'Peso';
    const ETIQUETA_CONVERSION = 'Conversión unidad de compra a base';
    const MAXIMO_PARAMETROS_CATALOGO = 1;

    const MENSAJES = Object.freeze({
        IDS_NO_ES_LISTA: 'La configuración debe ser una lista de IDs de campo.',
        PARAMETROS_NO_ES_LISTA: 'La naturaleza no tiene parámetros definidos.',
        ID_PARA_CONSULTA: 'Un ID de parámetro no es válido para buscar duplicados.',
        VALOR_FALTANTE: 'Falta el valor de un parámetro para buscar duplicados.',
        UN_SOLO_CATALOGO: 'La configuración admite un solo campo de espesor.'
    });

    const errorDeParametro = (mensaje) => formato.crearErrorDeDominio(ERRORES.PARAMETRO_INVALIDO, mensaje);

    const tienePropiedad = (objeto, llave) => (
        objeto !== null && typeof objeto === 'object' && Object.prototype.hasOwnProperty.call(objeto, llave)
    );

    const normalizarTipo = (tipo) => (tipo === null || tipo === undefined ? null : String(tipo).toLowerCase());

    const esTipoSoportado = (tipo) => Object.keys(TIPOS_SOPORTADOS).some((llave) => TIPOS_SOPORTADOS[llave] === tipo);

    const nombreDelCampo = (id, posicion) => (esIdentificadorSeguro(id) ? id : `en la posición ${posicion + 1}`);

    const etiquetaVisible = ({ id, etiqueta }) => {
        const texto = etiqueta === null || etiqueta === undefined ? '' : String(etiqueta).trim();
        if (texto !== '') return texto;
        return typeof id === 'string' ? id : '';
    };

    const mensajeNumeroInvalido = (etiqueta) => `${etiqueta}: capture un número mayor que 0 con punto decimal, por ejemplo 0.25.`;

    const mensajeEnteroInvalido = (etiqueta) => `${etiqueta}: capture un número entero mayor que 0.`;

    const mensajeCatalogoInvalido = (etiqueta) => `${etiqueta}: elija un valor de la lista.`;

    const leerOpcionDeCatalogo = (crudo, opciones) => {
        if (typeof crudo !== 'string') return null;
        const texto = crudo.trim();
        if (texto === '' || opciones.indexOf(texto) === -1) return null;
        const numero = Number(texto);
        return Number.isFinite(numero) ? numero : null;
    };

    /**
     * Convierte una captura en número positivo (RN-04, PT-04).
     * @param {*} crudo - Valor enviado por el formulario.
     * @returns {?number} Número finito mayor que 0, o null si la captura no cumple ^\d+(\.\d+)?$ tras trim.
     */
    const leerNumeroPositivo = (crudo) => {
        if (typeof crudo !== 'string') return null;
        const texto = crudo.trim();
        if (!PATRON_NUMERO_CAPTURADO.test(texto)) return null;
        const numero = Number(texto);
        return Number.isFinite(numero) && numero > 0 ? numero : null;
    };

    /**
     * Indica si un ID de campo se puede usar como nombre de columna SuiteQL (RN-13, R-04).
     * @param {*} id - ID de campo.
     * @returns {boolean} true solo si id es cadena y cumple ^[a-z0-9_]+$.
     */
    const esIdentificadorSeguro = (id) => typeof id === 'string' && PATRON_ID_SEGURO.test(id);

    /**
     * Valida los IDs del JSON de configuración (RN-13). No lanza errores.
     * @param {string[]} ids - IDs parseados por formato.parsearConfiguracion.
     * @returns {{valido: boolean, errores: string[]}} Un ID inseguro se reporta por su posición, sin citar su texto.
     */
    const validarIds = (ids) => {
        if (!Array.isArray(ids)) return { valido: false, errores: [MENSAJES.IDS_NO_ES_LISTA] };
        const errores = [];
        ids.forEach((id, posicion) => {
            if (!esIdentificadorSeguro(id)) {
                errores.push(`El ID de campo en la posición ${posicion + 1} solo puede contener minúsculas, dígitos y guion bajo.`);
            }
        });
        return { valido: errores.length === 0, errores };
    };

    /**
     * Valida que cada parámetro exista en el artículo plantilla y sea decimal, entero o el catálogo de espesor
     * (RN-03, R-12, RN3-02). Admite un solo parámetro de catálogo. No lanza errores.
     * @param {Array<{id: string, etiqueta: string, tipo: ?string}>} parametros - tipo null si el campo no existe en la copia.
     * @returns {{valido: boolean, errores: string[]}}
     */
    const validarDefinicion = (parametros) => {
        if (!Array.isArray(parametros) || parametros.length === 0) {
            return { valido: false, errores: [MENSAJES.PARAMETROS_NO_ES_LISTA] };
        }
        const errores = [];
        parametros.forEach((parametro, posicion) => {
            const tipo = normalizarTipo(parametro.tipo);
            const campo = nombreDelCampo(parametro.id, posicion);
            if (tipo === null) {
                errores.push(`El campo ${campo} no existe en el artículo plantilla.`);
            } else if (!esTipoSoportado(tipo)) {
                errores.push(`El campo ${campo} no es decimal ni entero.`);
            }
        });
        const catalogos = parametros.filter((parametro) => normalizarTipo(parametro.tipo) === TIPOS_SOPORTADOS.CATALOGO);
        if (catalogos.length > MAXIMO_PARAMETROS_CATALOGO) errores.push(MENSAJES.UN_SOLO_CATALOGO);
        return { valido: errores.length === 0, errores };
    };

    /**
     * Valida los valores capturados, el peso y la conversión (RN-04, RN-05, PT-04, RN3-02, RN3-11). No lanza errores.
     * @param {Object} datos
     * @param {Array<{id: string, etiqueta: string, tipo: string}>} datos.parametros - Definición validada.
     * @param {Array<*>} datos.valoresCrudos - Capturas alineadas por índice con parametros.
     * @param {*} datos.pesoCrudo - Captura del peso.
     * @param {*} [datos.conversionCruda] - Captura de la conversión; si se omite (undefined) no se evalúa.
     * @param {string[]} [datos.opcionesCatalogo] - IDs internos permitidos para el parámetro de catálogo.
     * @param {Object<string, string[]>} [datos.opcionesPorCatalogo] - IDs permitidos por ID de parámetro de catálogo;
     * tiene prioridad sobre opcionesCatalogo (el espesor y el mapa de medidas, RN5-01).
     * @returns {{valido: boolean, errores: string[], valores: Object<string, number>, peso: ?number, conversion: ?number}}
     * valores incluye solo los parámetros válidos (el catálogo como número); peso y conversion son null si no son válidos.
     */
    const validarValores = ({ parametros, valoresCrudos, pesoCrudo, conversionCruda, opcionesCatalogo, opcionesPorCatalogo } = {}) => {
        const definidos = Array.isArray(parametros) ? parametros : [];
        const crudos = Array.isArray(valoresCrudos) ? valoresCrudos : [];
        const aTextos = (lista) => (Array.isArray(lista) ? lista.map((opcion) => String(opcion)) : []);
        const opciones = aTextos(opcionesCatalogo);
        const opcionesDe = (id) => (tienePropiedad(opcionesPorCatalogo, id) ? aTextos(opcionesPorCatalogo[id]) : opciones);
        const errores = [];
        const valores = {};
        definidos.forEach((parametro, posicion) => {
            const etiqueta = etiquetaVisible(parametro);
            if (normalizarTipo(parametro.tipo) === TIPOS_SOPORTADOS.CATALOGO) {
                const opcion = leerOpcionDeCatalogo(crudos[posicion], opcionesDe(parametro.id));
                if (opcion === null) errores.push(mensajeCatalogoInvalido(etiqueta));
                else valores[parametro.id] = opcion;
                return;
            }
            const numero = leerNumeroPositivo(crudos[posicion]);
            const esEntero = normalizarTipo(parametro.tipo) === TIPOS_SOPORTADOS.INTEGER;
            if (numero === null) {
                errores.push(esEntero ? mensajeEnteroInvalido(etiqueta) : mensajeNumeroInvalido(etiqueta));
            } else if (esEntero && !Number.isInteger(numero)) {
                errores.push(mensajeEnteroInvalido(etiqueta));
            } else {
                valores[parametro.id] = numero;
            }
        });
        const peso = leerNumeroPositivo(pesoCrudo);
        if (peso === null) errores.push(mensajeNumeroInvalido(ETIQUETA_PESO));
        let conversion = null;
        if (conversionCruda !== undefined) {
            conversion = leerNumeroPositivo(conversionCruda);
            if (conversion === null) errores.push(mensajeNumeroInvalido(ETIQUETA_CONVERSION));
        }
        return { valido: errores.length === 0, errores, valores, peso, conversion };
    };

    /**
     * Valida que en cada par de lados el menor no supere al mayor (D-18). No lanza errores.
     * Un par se evalúa solo si ambos IDs tienen valor numérico.
     * @param {Object} datos
     * @param {Object<string, number>} datos.valores - Valores validados por ID.
     * @param {Object<string, string>} datos.etiquetas - Etiqueta visible por ID; si falta se usa el ID.
     * @param {Array<{menor: string, mayor: string}>} datos.pares - IDs del lado menor y del lado mayor.
     * @returns {{valido: boolean, errores: string[]}}
     */
    const validarOrdenDeLados = ({ valores, etiquetas, pares } = {}) => {
        const listaDePares = Array.isArray(pares) ? pares : [];
        const tieneNumero = (id) => tienePropiedad(valores, id) && typeof valores[id] === 'number' && Number.isFinite(valores[id]);
        const etiquetaDe = (id) => (tienePropiedad(etiquetas, id) ? etiquetaVisible({ id, etiqueta: etiquetas[id] }) : id);
        const errores = listaDePares
            .filter((par) => tieneNumero(par.menor) && tieneNumero(par.mayor) && valores[par.menor] > valores[par.mayor])
            .map((par) => `${etiquetaDe(par.menor)} no puede ser mayor que ${etiquetaDe(par.mayor)}.`);
        return { valido: errores.length === 0, errores };
    };

    /**
     * Arma los criterios de la consulta de duplicados (RN-08) en el orden del JSON.
     * @param {Object} datos
     * @param {string[]} datos.ids - IDs del JSON recalculado.
     * @param {Object<string, number>} datos.valores - Valores validados por ID.
     * @returns {Array<{columna: string, valor: number}>}
     * @throws {Error} PARAMETRO_INVALIDO si un ID no es seguro o falta su valor numérico.
     */
    const armarCriteriosDuplicado = ({ ids, valores } = {}) => {
        if (!Array.isArray(ids) || ids.length === 0) throw errorDeParametro(MENSAJES.ID_PARA_CONSULTA);
        return ids.map((id) => {
            if (!esIdentificadorSeguro(id)) throw errorDeParametro(MENSAJES.ID_PARA_CONSULTA);
            if (!tienePropiedad(valores, id) || typeof valores[id] !== 'number' || !Number.isFinite(valores[id])) {
                throw errorDeParametro(MENSAJES.VALOR_FALTANTE);
            }
            return { columna: id, valor: valores[id] };
        });
    };

    return {
        ERRORES,
        TIPOS_SOPORTADOS,
        esIdentificadorSeguro,
        validarIds,
        validarDefinicion,
        validarValores,
        validarOrdenDeLados,
        armarCriteriosDuplicado
    };
});
