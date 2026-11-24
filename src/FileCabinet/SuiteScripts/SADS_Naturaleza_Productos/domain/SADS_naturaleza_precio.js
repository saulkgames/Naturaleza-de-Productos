/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Precio de venta sin IVA del artículo nuevo (RN4-01 a RN4-05, RN4-08).
 * Replica la cadena de campos fórmula de la cuenta: custitem_alm_preciounitario_base, custitem10, custitem9,
 * custitem_drt_ci_maniobras_mxn, custitem7, custitem_alm_cargos_importetotal, custitem_articulo_preciomascargo,
 * custitem_drt_ci_cargo_seguro_mxn, custitem_precio_sinmargen, custitem_alm_art_imp_utilidad y custitem_alm_art_preciofinal.
 * Si una de esas fórmulas cambia en la cuenta, este módulo debe cambiar igual (R4-01).
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define(['./SADS_naturaleza_config_formato'], (formato) => {
    /**
     * Nombres de los errores de dominio del módulo. Cada valor es igual a su llave.
     * @type {Readonly<{PRECIO_INVALIDO: string}>}
     */
    const ERRORES = Object.freeze({
        PRECIO_INVALIDO: 'PRECIO_INVALIDO'
    });

    // RN4-02: entradas obligatorias con la etiqueta que se muestra al usuario. El cargo compensatorio no es obligatorio.
    const ETIQUETAS_OBLIGATORIAS = Object.freeze({
        precioCotizacion: 'Precio Base de Cálculo de la familia de precios',
        tipoCambio: 'Tipo de cambio de la moneda de cotización',
        conversion: 'Conversión de unidad de cotización a base',
        peso: 'Peso',
        porcentajeFlete: '% Flete de la plantilla',
        porcentajeManiobras: '% Maniobras de la plantilla',
        porcentajeSeguro: '% Cargos Seguro de la plantilla',
        fletePorKg: 'Flete p/kg de la plantilla',
        maniobraPorKg: 'Maniobra p/kg de la plantilla',
        margen: 'Margen de la familia de márgenes'
    });

    const MENSAJES = Object.freeze({
        FALTANTES: (etiquetas) => `Faltan datos para calcular el precio: ${etiquetas.join(', ')}.`,
        MARGEN: 'El margen de la familia de márgenes debe ser menor que 100.',
        PRECIO_NO_POSITIVO: 'El precio calculado debe ser mayor que cero.'
    });

    const MARGEN_MAXIMO = 100;
    const CIEN = 100;
    const CUARTOS = 4;
    const DECIMALES_DEL_REDONDEO = 6;

    /**
     * Diferencia máxima aceptada entre el precio calculado y el campo fórmula (RN4-08).
     * @type {number}
     */
    const TOLERANCIA = 0.005;
    const HOLGURA_FLOTANTE = 1e-9;

    const errorDePrecio = (mensaje) => formato.crearErrorDeDominio(ERRORES.PRECIO_INVALIDO, mensaje);

    const aNumeroONulo = (valor) => {
        if (valor === null || valor === undefined || String(valor).trim() === '') return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    };

    // Equivale a ROUND(valor, decimales) de la fórmula: mitad lejos de cero.
    const redondear = (valor, decimales) => {
        const factor = Math.pow(10, decimales);
        const signo = valor < 0 ? -1 : 1;
        return (signo * Math.round(Math.abs(valor) * factor)) / factor;
    };

    /**
     * Redondea hacia arriba al múltiplo de 0.25, como custitem_alm_art_preciofinal (RN4-05):
     * CEIL(ROUND(valor * 4, 6)) / 4.
     * @param {number} valor
     * @returns {number}
     */
    const redondearACuarto = (valor) => Math.ceil(redondear(valor * CUARTOS, DECIMALES_DEL_REDONDEO)) / CUARTOS;

    const leerEntradas = (entradas) => {
        const origen = entradas || {};
        const leidas = {};
        const faltantes = [];
        Object.keys(ETIQUETAS_OBLIGATORIAS).forEach((llave) => {
            leidas[llave] = aNumeroONulo(origen[llave]);
            if (leidas[llave] === null) faltantes.push(ETIQUETAS_OBLIGATORIAS[llave]);
        });
        if (faltantes.length > 0) throw errorDePrecio(MENSAJES.FALTANTES(faltantes));
        const cargoCompensatorio = aNumeroONulo(origen.cargoCompensatorio);
        leidas.cargoCompensatorio = cargoCompensatorio === null ? 0 : cargoCompensatorio;
        return leidas;
    };

    /**
     * Calcula el precio de venta sin IVA con la cadena de campos fórmula (RN4-01 a RN4-05).
     * Los porcentajes llegan en unidades de % (5 = 5 %), como los devuelve getValue (S4-01).
     * No redondea los valores intermedios (S4-07).
     * @param {Object} entradas
     * @param {number} entradas.precioCotizacion - P: custrecord_drt_ci_f_precio de la familia de precios.
     * @param {number} entradas.tipoCambio - TC: tipo de cambio predeterminado de la moneda de cotización.
     * @param {number} entradas.conversion - C: custitem_alm_articulo_conversionunidad.
     * @param {number} entradas.peso - W: custitem_drt_ci_precio_teorico (kg).
     * @param {number} entradas.porcentajeFlete - custitem_drt_ci_flete.
     * @param {number} entradas.porcentajeManiobras - custitem_drt_ci_maniobras.
     * @param {number} entradas.porcentajeSeguro - custitem_drt_ci_cargo_seguro.
     * @param {number} entradas.fletePorKg - custitem_cargofijo_flete.
     * @param {number} entradas.maniobraPorKg - custitem_alm_cargofijo_maniobra.
     * @param {?number} [entradas.cargoCompensatorio] - custitem26; vacío cuenta como 0.
     * @param {number} entradas.margen - M: custrecord_drt_ci_m_margen de la familia de márgenes (20 = 20 %).
     * @returns {{precioUnitarioBase: number, totalFletes: number, totalManiobras: number, cargos: number,
     * precioMasCargos: number, importeSeguro: number, precioSinMargen: number, utilidad: number, precioFinal: number}}
     * @throws {Error} PRECIO_INVALIDO si falta una entrada obligatoria, el margen es >= 100 o el precio final es <= 0.
     */
    const calcular = (entradas) => {
        const e = leerEntradas(entradas);
        if (e.margen >= MARGEN_MAXIMO) throw errorDePrecio(MENSAJES.MARGEN);
        const precioEnMonedaBase = e.precioCotizacion * e.tipoCambio;
        const precioUnitarioBase = precioEnMonedaBase * e.conversion;
        const totalFletes = (e.fletePorKg * e.peso) + (precioEnMonedaBase * (e.porcentajeFlete / CIEN));
        const totalManiobras = (e.maniobraPorKg * e.peso) + (precioEnMonedaBase * (e.porcentajeManiobras / CIEN));
        const cargos = totalFletes + totalManiobras;
        const precioMasCargos = cargos + precioUnitarioBase;
        const importeSeguro = precioMasCargos * (e.porcentajeSeguro / CIEN);
        const precioSinMargen = importeSeguro + precioMasCargos;
        const utilidad = precioSinMargen * ((CIEN / (CIEN - e.margen)) - 1);
        const precioFinal = redondearACuarto(precioSinMargen + utilidad + e.cargoCompensatorio);
        if (!(precioFinal > 0)) throw errorDePrecio(MENSAJES.PRECIO_NO_POSITIVO);
        return {
            precioUnitarioBase,
            totalFletes,
            totalManiobras,
            cargos,
            precioMasCargos,
            importeSeguro,
            precioSinMargen,
            utilidad,
            precioFinal
        };
    };

    /**
     * Indica si el precio guardado coincide con el valor de un campo fórmula (RN4-08). No lanza errores.
     * @param {*} calculado
     * @param {*} guardado
     * @returns {boolean} false si alguno no es número.
     */
    const coincide = (calculado, guardado) => {
        const a = aNumeroONulo(calculado);
        const b = aNumeroONulo(guardado);
        if (a === null || b === null) return false;
        return Math.abs(a - b) <= TOLERANCIA + HOLGURA_FLOTANTE;
    };

    return {
        ERRORES,
        TOLERANCIA,
        calcular,
        redondearACuarto,
        coincide
    };
});
