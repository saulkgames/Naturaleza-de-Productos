/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Familias de precio y de margen por rango de espesor de una naturaleza (RN3-04 a RN3-07).
 * Una línea sin espesor desde ni hasta es familia única. Los rangos usan el orden (grosor) del espesor, inclusivo.
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define(['./SADS_naturaleza_config_formato'], (formato) => {
    /**
     * Nombres de los errores de dominio del módulo. Cada valor es igual a su llave.
     * @type {Readonly<{FAMILIA_INVALIDA: string}>}
     */
    const ERRORES = Object.freeze({
        FAMILIA_INVALIDA: 'FAMILIA_INVALIDA'
    });

    const MENSAJES = Object.freeze({
        SIN_FAMILIA: 'No hay una familia de precios única para este espesor en la naturaleza.',
        PRECIO_OBLIGATORIO: 'La familia de precio es obligatoria.',
        MARGEN_OBLIGATORIO: 'La familia de margen es obligatoria.',
        RANGO_INCOMPLETO: 'Capture espesor desde y espesor hasta, o deje ambos vacíos para una familia única.',
        UNICA_CON_HERMANAS: 'Una familia única (sin rango) debe ser la única línea activa de la naturaleza.',
        RANGO_CON_UNICA: 'La naturaleza ya tiene una familia única: inactívela antes de agregar rangos.',
        NATURALEZA_SIN_ESPESOR: 'La naturaleza no usa espesor: solo admite una familia única sin rango.',
        TIPO_DISTINTO: 'Los espesores desde y hasta deben ser del tipo de espesor de la naturaleza.',
        RANGO_INVERTIDO: 'El espesor desde debe ser menor o igual que el espesor hasta.',
        TRASLAPE: 'El rango se traslapa con otra línea de la naturaleza.'
    });

    const errorDeFamilia = (mensaje) => formato.crearErrorDeDominio(ERRORES.FAMILIA_INVALIDA, mensaje);

    const tieneValor = (valor) => valor !== null && valor !== undefined && String(valor).trim() !== '';

    const tieneDesde = (linea) => tieneValor(linea.desdeId) || tieneValor(linea.desdeOrden);

    const tieneHasta = (linea) => tieneValor(linea.hastaId) || tieneValor(linea.hastaOrden);

    const aTexto = (valor) => (tieneValor(valor) ? String(valor) : null);

    const seTraslapan = (a, b) => a.desdeOrden <= b.hastaOrden && b.desdeOrden <= a.hastaOrden;

    /**
     * Indica si una línea es familia única: sin espesor desde ni hasta (RN3-05).
     * @param {{desdeId: ?string, hastaId: ?string, desdeOrden: ?number, hastaOrden: ?number}} linea
     * @returns {boolean}
     */
    const esUnica = (linea) => !tieneDesde(linea) && !tieneHasta(linea);

    const erroresDeRango = ({ linea, hermanas, tipoNaturaleza }) => {
        if (tipoNaturaleza === null) return [MENSAJES.NATURALEZA_SIN_ESPESOR];
        const errores = [];
        if (aTexto(linea.desdeTipo) !== tipoNaturaleza || aTexto(linea.hastaTipo) !== tipoNaturaleza) {
            errores.push(MENSAJES.TIPO_DISTINTO);
        }
        if (Number(linea.desdeOrden) > Number(linea.hastaOrden)) errores.push(MENSAJES.RANGO_INVERTIDO);
        if (hermanas.some((hermana) => esUnica(hermana))) errores.push(MENSAJES.RANGO_CON_UNICA);
        const traslapada = hermanas
            .filter((hermana) => !esUnica(hermana))
            .some((hermana) => seTraslapan(linea, hermana));
        if (traslapada) errores.push(MENSAJES.TRASLAPE);
        return errores;
    };

    /**
     * Valida una línea de familia contra las demás líneas activas de su configuración (RN3-05 a RN3-07). No lanza errores.
     * @param {Object} datos
     * @param {Object} datos.linea - Línea plana: desdeId, hastaId, desdeOrden, hastaOrden, desdeTipo, hastaTipo,
     * familiaPrecioId, familiaMargenId.
     * @param {Object[]} datos.hermanas - Demás líneas activas de la misma configuración, sin la propia.
     * @param {?string} datos.tipoNaturaleza - Tipo de espesor de la naturaleza; null si no usa espesor.
     * @returns {{valido: boolean, errores: string[]}}
     */
    const validarLinea = ({ linea, hermanas, tipoNaturaleza } = {}) => {
        const actual = linea || {};
        const otras = Array.isArray(hermanas) ? hermanas : [];
        const tipo = aTexto(tipoNaturaleza);
        const errores = [];
        if (!tieneValor(actual.familiaPrecioId)) errores.push(MENSAJES.PRECIO_OBLIGATORIO);
        if (!tieneValor(actual.familiaMargenId)) errores.push(MENSAJES.MARGEN_OBLIGATORIO);
        if (tieneDesde(actual) !== tieneHasta(actual)) {
            errores.push(MENSAJES.RANGO_INCOMPLETO);
        } else if (esUnica(actual)) {
            if (otras.length > 0) errores.push(MENSAJES.UNICA_CON_HERMANAS);
        } else {
            erroresDeRango({ linea: actual, hermanas: otras, tipoNaturaleza: tipo }).forEach((mensaje) => errores.push(mensaje));
        }
        return { valido: errores.length === 0, errores };
    };

    /**
     * Resuelve la línea de familia que aplica a un espesor (RN3-04, RN3-07).
     * @param {Object} datos
     * @param {Object[]} datos.lineas - Líneas activas de la configuración.
     * @param {?number} datos.orden - Orden del espesor elegido; null si la naturaleza no usa espesor.
     * @returns {Object} La única línea que aplica.
     * @throws {Error} FAMILIA_INVALIDA si ninguna línea aplica o aplica más de una.
     */
    const resolver = ({ lineas, orden } = {}) => {
        const activas = Array.isArray(lineas) ? lineas : [];
        const conOrden = typeof orden === 'number' && Number.isFinite(orden);
        const candidatas = conOrden
            ? activas.filter((linea) => esUnica(linea) || (linea.desdeOrden <= orden && orden <= linea.hastaOrden))
            : activas.filter((linea) => esUnica(linea));
        if (candidatas.length !== 1 || (!conOrden && activas.length !== 1)) throw errorDeFamilia(MENSAJES.SIN_FAMILIA);
        return candidatas[0];
    };

    return {
        ERRORES,
        esUnica,
        validarLinea,
        resolver
    };
});
