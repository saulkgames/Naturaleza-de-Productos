/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Familias de precio y de margen por rango de espesor y, opcional, por rango de una medida (RN3-04 a RN3-07, D-21).
 * Una línea sin rangos es familia única. Los rangos son inclusivos; el de espesor usa el orden (grosor) del espesor.
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
        RANGO_INCOMPLETO: 'Capture espesor desde y espesor hasta, o deje ambos vacíos.',
        MEDIDA_INCOMPLETA: 'Capture medida desde y medida hasta, o deje ambas vacías.',
        NATURALEZA_SIN_ESPESOR: 'La naturaleza no usa espesor: no admite rango de espesor.',
        TIPO_DISTINTO: 'Los espesores desde y hasta deben ser del tipo de espesor de la naturaleza.',
        RANGO_INVERTIDO: 'El espesor desde debe ser menor o igual que el espesor hasta.',
        MEDIDA_INVERTIDA: 'La medida desde debe ser menor o igual que la medida hasta.',
        TRASLAPE: 'El rango se traslapa con otra línea de la naturaleza.'
    });

    const errorDeFamilia = (mensaje) => formato.crearErrorDeDominio(ERRORES.FAMILIA_INVALIDA, mensaje);

    const tieneValor = (valor) => valor !== null && valor !== undefined && String(valor).trim() !== '';

    const tieneDesde = (linea) => tieneValor(linea.desdeId) || tieneValor(linea.desdeOrden);

    const tieneHasta = (linea) => tieneValor(linea.hastaId) || tieneValor(linea.hastaOrden);

    const tieneEspesor = (linea) => tieneDesde(linea) || tieneHasta(linea);

    const tieneMedida = (linea) => tieneValor(linea.medidaDesde) || tieneValor(linea.medidaHasta);

    const aTexto = (valor) => (tieneValor(valor) ? String(valor) : null);

    const esNumero = (valor) => typeof valor === 'number' && Number.isFinite(valor);

    // Un rango vacío cubre todos los valores.
    const rangoDeEspesor = (linea) => (tieneEspesor(linea)
        ? { desde: Number(linea.desdeOrden), hasta: Number(linea.hastaOrden) }
        : { desde: -Infinity, hasta: Infinity });

    const rangoDeMedida = (linea) => (tieneMedida(linea)
        ? { desde: Number(linea.medidaDesde), hasta: Number(linea.medidaHasta) }
        : { desde: -Infinity, hasta: Infinity });

    const rangosSeTraslapan = (a, b) => a.desde <= b.hasta && b.desde <= a.hasta;

    // D-21: dos líneas chocan si se traslapan en espesor y en medida.
    const lineasSeTraslapan = (a, b) => rangosSeTraslapan(rangoDeEspesor(a), rangoDeEspesor(b))
        && rangosSeTraslapan(rangoDeMedida(a), rangoDeMedida(b));

    const contiene = (rango, valor) => rango.desde <= valor && valor <= rango.hasta;

    /**
     * Indica si una línea es familia única: sin rango de espesor ni de medida (RN3-05).
     * @param {Object} linea - Línea plana.
     * @returns {boolean}
     */
    const esUnica = (linea) => !tieneEspesor(linea) && !tieneMedida(linea);

    const erroresDeEspesor = (linea, tipoNaturaleza) => {
        if (!tieneEspesor(linea)) return [];
        if (tieneDesde(linea) !== tieneHasta(linea)) return [MENSAJES.RANGO_INCOMPLETO];
        if (tipoNaturaleza === null) return [MENSAJES.NATURALEZA_SIN_ESPESOR];
        const errores = [];
        if (aTexto(linea.desdeTipo) !== tipoNaturaleza || aTexto(linea.hastaTipo) !== tipoNaturaleza) {
            errores.push(MENSAJES.TIPO_DISTINTO);
        }
        if (Number(linea.desdeOrden) > Number(linea.hastaOrden)) errores.push(MENSAJES.RANGO_INVERTIDO);
        return errores;
    };

    const erroresDeMedida = (linea) => {
        if (!tieneMedida(linea)) return [];
        if (!tieneValor(linea.medidaDesde) || !tieneValor(linea.medidaHasta)) return [MENSAJES.MEDIDA_INCOMPLETA];
        return Number(linea.medidaDesde) > Number(linea.medidaHasta) ? [MENSAJES.MEDIDA_INVERTIDA] : [];
    };

    /**
     * Valida una línea de familia contra las demás líneas activas de su configuración (RN3-05 a RN3-07, D-21).
     * Dos líneas chocan si se traslapan en espesor y en medida; un rango vacío cubre todo, así que una línea
     * sin rangos (familia única) choca con cualquier otra. No lanza errores.
     * @param {Object} datos
     * @param {Object} datos.linea - Línea plana: desdeId, hastaId, desdeOrden, hastaOrden, desdeTipo, hastaTipo,
     * medidaDesde, medidaHasta, familiaPrecioId, familiaMargenId.
     * @param {Object[]} datos.hermanas - Demás líneas activas de la misma configuración, sin la propia.
     * @param {?string} datos.tipoNaturaleza - Tipo de espesor de la naturaleza; null si no usa espesor.
     * @returns {{valido: boolean, errores: string[]}}
     */
    const validarLinea = ({ linea, hermanas, tipoNaturaleza } = {}) => {
        const actual = linea || {};
        const otras = Array.isArray(hermanas) ? hermanas : [];
        const errores = [];
        if (!tieneValor(actual.familiaPrecioId)) errores.push(MENSAJES.PRECIO_OBLIGATORIO);
        if (!tieneValor(actual.familiaMargenId)) errores.push(MENSAJES.MARGEN_OBLIGATORIO);
        const deRango = erroresDeEspesor(actual, aTexto(tipoNaturaleza)).concat(erroresDeMedida(actual));
        deRango.forEach((mensaje) => errores.push(mensaje));
        if (deRango.length === 0 && otras.some((hermana) => lineasSeTraslapan(actual, hermana))) {
            errores.push(MENSAJES.TRASLAPE);
        }
        return { valido: errores.length === 0, errores };
    };

    /**
     * Resuelve la línea de familia que aplica a un espesor y a una medida (RN3-04, RN3-07, D-21).
     * Una línea aplica si el orden del espesor cae en su rango de espesor (o no tiene) y la medida cae en su
     * rango de medida (o no tiene).
     * @param {Object} datos
     * @param {Object[]} datos.lineas - Líneas activas de la configuración.
     * @param {?number} datos.orden - Orden del espesor elegido; null si la naturaleza no usa espesor.
     * @param {?number} [datos.medida] - Valor del campo de medida; null si la naturaleza no lo usa.
     * @returns {Object} La única línea que aplica.
     * @throws {Error} FAMILIA_INVALIDA si ninguna línea aplica o aplica más de una.
     */
    const resolver = ({ lineas, orden, medida } = {}) => {
        const activas = Array.isArray(lineas) ? lineas : [];
        const aplica = (linea) => {
            const espesorOk = !tieneEspesor(linea) || (esNumero(orden) && contiene(rangoDeEspesor(linea), orden));
            const medidaOk = !tieneMedida(linea) || (esNumero(medida) && contiene(rangoDeMedida(linea), medida));
            return espesorOk && medidaOk;
        };
        const candidatas = activas.filter(aplica);
        if (candidatas.length !== 1) throw errorDeFamilia(MENSAJES.SIN_FAMILIA);
        return candidatas[0];
    };

    return {
        ERRORES,
        esUnica,
        validarLinea,
        resolver
    };
});
