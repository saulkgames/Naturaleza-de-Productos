/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Adaptador de NetSuite para el precio del artículo nuevo (RN4-01, RN4-06, RN4-08).
 * Lee los cargos de la copia de la plantilla, consulta monedas (C-7), escribe los campos de precio y la matriz
 * de niveles de precio, y lee el campo fórmula de precio final. No contiene la fórmula del precio.
 */
define(['N/query', 'N/search', 'N/log', '../domain/SADS_naturaleza_config_formato'], (query, search, log, formato) => {
    // Cargos sin sourcing que el artículo nuevo hereda de la plantilla (RN4-01).
    const CAMPOS_CARGOS = Object.freeze({
        porcentajeFlete: 'custitem_drt_ci_flete',
        porcentajeManiobras: 'custitem_drt_ci_maniobras',
        porcentajeSeguro: 'custitem_drt_ci_cargo_seguro',
        fletePorKg: 'custitem_cargofijo_flete',
        maniobraPorKg: 'custitem_alm_cargofijo_maniobra',
        cargoCompensatorio: 'custitem26'
    });

    const CAMPO_MONEDA_COTIZACION = 'custitem_moneda_cotizacion';

    const CAMPOS_PRECIO = Object.freeze({
        PRECIO_COTIZACION: 'custitemalm_articulo_preciocotizacion',
        MARGEN: 'custitem_drt_ci_margen_para_venta',
        PRECIO_FINAL_ALMACENADO: 'custitem11',
        PRECIO_FINAL_FORMULA: 'custitem_alm_art_preciofinal'
    });

    // Supuesto S4-03: nivel "Precio base" = ID 1; el precio se escribe en la moneda MXN; sublistas price{ID de moneda}.
    const NIVEL_PRECIO_BASE = '1';
    const SIMBOLO_MONEDA_PRECIO = 'MXN';
    const PREFIJO_SUBLISTA_PRECIO = 'price';
    const PATRON_SUBLISTA_PRECIO = /^price[0-9]+$/;
    const CAMPO_NIVEL = 'pricelevel';
    const CAMPO_MATRIZ = 'price';
    const SIN_LINEA = -1;
    const CELDA_VACIA = '';

    // C-7. Todas las monedas: son pocas y basta una consulta para el tipo de cambio y la moneda del precio (S4-02).
    const SQL_MONEDAS = `
        SELECT cur.id AS id, cur.symbol AS simbolo, cur.exchangerate AS tipo_cambio
        FROM currency cur`;

    const MENSAJES = Object.freeze({
        SIN_MONEDA_PRECIO: `No se encontró una única moneda ${SIMBOLO_MONEDA_PRECIO} para el precio base.`,
        SIN_SUBLISTA: `La plantilla no tiene precios en ${SIMBOLO_MONEDA_PRECIO}.`,
        SIN_NIVEL_BASE: `La plantilla no tiene el nivel Precio base en ${SIMBOLO_MONEDA_PRECIO}.`
    });

    const TITULO_LOG_FORMULA = 'Crear artículo por naturaleza: lectura del precio fórmula';

    const errorDeConfiguracion = (mensaje) => formato.crearErrorDeDominio(formato.ERRORES.CONFIGURACION_INVALIDA, mensaje);

    const aCadena = (valor) => (valor === null || valor === undefined ? '' : String(valor));

    const numeroONulo = (valor) => {
        if (aCadena(valor).trim() === '') return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    };

    const textoONulo = (valor) => {
        const texto = aCadena(valor).trim();
        return texto === '' ? null : texto;
    };

    /**
     * Lee de la copia de la plantilla los cargos y la moneda de cotización (RN4-01).
     * Los porcentajes se devuelven como los entrega getValue (S4-01).
     * @param {record.Record} copia - Copia en memoria de la plantilla.
     * @returns {{porcentajeFlete: ?number, porcentajeManiobras: ?number, porcentajeSeguro: ?number, fletePorKg: ?number,
     * maniobraPorKg: ?number, cargoCompensatorio: ?number, monedaCotizacionId: ?string}} Vacío = null.
     */
    const leerCargos = (copia) => {
        const cargos = {};
        Object.keys(CAMPOS_CARGOS).forEach((llave) => {
            cargos[llave] = numeroONulo(copia.getValue({ fieldId: CAMPOS_CARGOS[llave] }));
        });
        cargos.monedaCotizacionId = textoONulo(copia.getValue({ fieldId: CAMPO_MONEDA_COTIZACION }));
        return cargos;
    };

    /**
     * Consulta las monedas (C-7) y resuelve el tipo de cambio de la moneda de cotización y la moneda del precio.
     * @param {?string} monedaCotizacionId - ID interno de la moneda de cotización; null si la plantilla no la tiene.
     * @returns {{tipoCambio: ?number, monedaPrecioId: string}} tipoCambio null si la moneda no existe o no tiene tipo de cambio.
     * @throws {Error} CONFIGURACION_INVALIDA si no hay exactamente una moneda MXN.
     */
    const cargarMonedas = (monedaCotizacionId) => {
        const filas = query.runSuiteQL({ query: SQL_MONEDAS, params: [] }).asMappedResults();
        const delPrecio = filas.filter((fila) => aCadena(fila.simbolo).trim().toUpperCase() === SIMBOLO_MONEDA_PRECIO);
        if (delPrecio.length !== 1) throw errorDeConfiguracion(MENSAJES.SIN_MONEDA_PRECIO);
        const deCotizacion = monedaCotizacionId === null
            ? []
            : filas.filter((fila) => aCadena(fila.id) === String(monedaCotizacionId));
        return {
            tipoCambio: deCotizacion.length === 1 ? numeroONulo(deCotizacion[0].tipo_cambio) : null,
            monedaPrecioId: aCadena(delPrecio[0].id)
        };
    };

    const sublistasDePrecio = (copia) => (copia.getSublists() || [])
        .map((sublista) => aCadena(sublista))
        .filter((sublista) => PATRON_SUBLISTA_PRECIO.test(sublista));

    const columnasDe = (copia, sublistId) => {
        const columnas = Number(copia.getMatrixHeaderCount({ sublistId, fieldId: CAMPO_MATRIZ }));
        return Number.isFinite(columnas) && columnas > 0 ? columnas : 1;
    };

    /**
     * Escribe el precio en la copia antes del save (RN4-06, RN4-07): precio de cotización, margen, custitem11 y la
     * matriz de precios. La celda del nivel Precio base en MXN, columna 0, recibe el precio final; toda otra celda de
     * todas las monedas y niveles queda vacía. Valida la sublista y el nivel antes de escribir.
     * @param {record.Record} copia - Copia en memoria de la plantilla (modo estándar).
     * @param {Object} datos
     * @param {{precioCotizacion: number, margen: number}} datos.entradas - Entradas del cálculo.
     * @param {{precioFinal: number}} datos.calculo - Resultado de precio.calcular.
     * @param {string} datos.monedaPrecioId - ID interno de la moneda MXN (cargarMonedas).
     * @returns {void}
     * @throws {Error} CONFIGURACION_INVALIDA si la plantilla no tiene la sublista MXN o el nivel Precio base.
     */
    const asignarPrecio = (copia, { entradas, calculo, monedaPrecioId }) => {
        const sublistas = sublistasDePrecio(copia);
        const sublistaBase = `${PREFIJO_SUBLISTA_PRECIO}${monedaPrecioId}`;
        if (sublistas.indexOf(sublistaBase) === SIN_LINEA) throw errorDeConfiguracion(MENSAJES.SIN_SUBLISTA);
        const lineaBase = copia.findSublistLineWithValue({ sublistId: sublistaBase, fieldId: CAMPO_NIVEL, value: NIVEL_PRECIO_BASE });
        if (lineaBase === SIN_LINEA) throw errorDeConfiguracion(MENSAJES.SIN_NIVEL_BASE);
        copia.setValue({ fieldId: CAMPOS_PRECIO.PRECIO_COTIZACION, value: entradas.precioCotizacion });
        copia.setValue({ fieldId: CAMPOS_PRECIO.MARGEN, value: entradas.margen });
        copia.setValue({ fieldId: CAMPOS_PRECIO.PRECIO_FINAL_ALMACENADO, value: calculo.precioFinal });
        sublistas.forEach((sublistId) => {
            const columnas = columnasDe(copia, sublistId);
            const lineas = copia.getLineCount({ sublistId });
            for (let line = 0; line < lineas; line += 1) {
                for (let column = 0; column < columnas; column += 1) {
                    const esCeldaBase = sublistId === sublistaBase && line === lineaBase && column === 0;
                    copia.setMatrixSublistValue({
                        sublistId,
                        fieldId: CAMPO_MATRIZ,
                        column,
                        line,
                        value: esCeldaBase ? calculo.precioFinal : CELDA_VACIA
                    });
                }
            }
        });
    };

    /**
     * Lee el campo fórmula de precio final del artículo guardado (RN4-08, S4-05). Costo: 1 unidad.
     * No lanza errores: si la lectura falla, registra el error y devuelve null.
     * @param {string} tipoRegistro - Tipo de registro del artículo.
     * @param {string|number} articuloId - ID interno del artículo.
     * @returns {?number} Valor del campo fórmula; null si no se pudo leer o está vacío.
     */
    const leerPrecioFormula = (tipoRegistro, articuloId) => {
        try {
            const campos = search.lookupFields({
                type: tipoRegistro,
                id: articuloId,
                columns: [CAMPOS_PRECIO.PRECIO_FINAL_FORMULA]
            });
            return numeroONulo((campos || {})[CAMPOS_PRECIO.PRECIO_FINAL_FORMULA]);
        } catch (error) {
            log.error({
                title: TITULO_LOG_FORMULA,
                details: `Artículo: ${articuloId}. ${aCadena(error && error.name)}: ${aCadena(error && error.message)}`
            });
            return null;
        }
    };

    return {
        leerCargos,
        cargarMonedas,
        asignarPrecio,
        leerPrecioFormula
    };
});
