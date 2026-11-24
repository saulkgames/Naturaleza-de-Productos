const fs = require('fs');
const path = require('path');

jest.mock('N/query', () => ({ runSuiteQL: jest.fn() }));
jest.mock('N/search', () => ({ lookupFields: jest.fn() }));
jest.mock('N/log', () => ({ audit: jest.fn(), debug: jest.fn(), error: jest.fn(), emergency: jest.fn() }));

const query = require('N/query');
const search = require('N/search');
const log = require('N/log');
const precioNs = require('SuiteScripts/SADS_Naturaleza_Productos/infra/SADS_naturaleza_precio_ns');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'infra', 'SADS_naturaleza_precio_ns.js'
);

const MONEDAS = Object.freeze([
    { id: 1, simbolo: 'MXN', tipo_cambio: 1 },
    { id: 2, simbolo: 'USD', tipo_cambio: 18.25 },
    { id: 3, simbolo: 'EUR', tipo_cambio: null }
]);

const prepararMonedas = (filas) => {
    query.runSuiteQL.mockReturnValue({ asMappedResults: () => filas.map((fila) => Object.assign({}, fila)) });
};

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba un error');
};

// Copia con matriz de precios: { price1: [{ nivel, celdas: [] }], ... }.
const crearCopia = ({ valores = {}, matriz = {}, columnas = 1, otrasSublistas = ['itemvendor'] } = {}) => {
    const celdas = {};
    const copia = {
        valoresAsignados: {},
        celdas,
        getValue: jest.fn((opciones) => (Object.prototype.hasOwnProperty.call(valores, opciones.fieldId) ? valores[opciones.fieldId] : '')),
        setValue: jest.fn((opciones) => {
            copia.valoresAsignados[opciones.fieldId] = opciones.value;
        }),
        getSublists: jest.fn(() => otrasSublistas.concat(Object.keys(matriz))),
        findSublistLineWithValue: jest.fn((opciones) => {
            const lineas = matriz[opciones.sublistId] || [];
            return lineas.map((linea) => String(linea)).indexOf(String(opciones.value));
        }),
        getMatrixHeaderCount: jest.fn(() => columnas),
        getLineCount: jest.fn((opciones) => (matriz[opciones.sublistId] || []).length),
        setMatrixSublistValue: jest.fn((opciones) => {
            celdas[`${opciones.sublistId}|${opciones.line}|${opciones.column}`] = opciones.value;
        })
    };
    return copia;
};

const ENTRADAS = Object.freeze({ precioCotizacion: 25, margen: 20 });
const CALCULO = Object.freeze({ precioFinal: 195 });

beforeEach(() => {
    jest.resetAllMocks();
});

describe('estructura del módulo', () => {
    const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');

    test('depende de N/query, N/search, N/log y del formato de dominio', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        const dependencias = definicion[1].split(',').map((d) => d.trim().replace(/^['"]|['"]$/g, ''));
        expect(dependencias).toEqual(['N/query', 'N/search', 'N/log', '../domain/SADS_naturaleza_config_formato']);
        expect(fuente).not.toMatch(/\?\./);
        expect(fuente).not.toMatch(/\?\?/);
        expect(fuente).not.toMatch(/\bconsole\./);
    });

    test('exporta las funciones de la especificación', () => {
        expect(Object.keys(precioNs).sort()).toEqual(['asignarPrecio', 'cargarMonedas', 'leerCargos', 'leerPrecioFormula']);
    });
});

describe('leerCargos (RN4-01)', () => {
    test('lee los cargos y la moneda de cotización de la copia', () => {
        const copia = crearCopia({
            valores: {
                custitem_drt_ci_flete: 2,
                custitem_drt_ci_maniobras: 0,
                custitem_drt_ci_cargo_seguro: 0.5,
                custitem_cargofijo_flete: 0.35,
                custitem_alm_cargofijo_maniobra: '0.20',
                custitem26: '',
                custitem_moneda_cotizacion: 2
            }
        });
        expect(precioNs.leerCargos(copia)).toEqual({
            porcentajeFlete: 2,
            porcentajeManiobras: 0,
            porcentajeSeguro: 0.5,
            fletePorKg: 0.35,
            maniobraPorKg: 0.2,
            cargoCompensatorio: null,
            monedaCotizacionId: '2'
        });
    });

    test('valores vacíos o no numéricos quedan en null', () => {
        const copia = crearCopia({ valores: { custitem_drt_ci_flete: null, custitem_cargofijo_flete: 'x' } });
        const cargos = precioNs.leerCargos(copia);
        expect(cargos.porcentajeFlete).toBeNull();
        expect(cargos.fletePorKg).toBeNull();
        expect(cargos.monedaCotizacionId).toBeNull();
    });
});

describe('cargarMonedas (C-7)', () => {
    test('una consulta sin parámetros; tipo de cambio de la cotización y moneda MXN', () => {
        prepararMonedas(MONEDAS);
        expect(precioNs.cargarMonedas('2')).toEqual({ tipoCambio: 18.25, monedaPrecioId: '1' });
        expect(query.runSuiteQL).toHaveBeenCalledTimes(1);
        const consulta = query.runSuiteQL.mock.calls[0][0];
        expect(consulta.params).toEqual([]);
        expect(consulta.query).toMatch(/from\s+currency\b/i);
        expect(consulta.query).toMatch(/exchangerate/);
    });

    test('cotización en MXN usa su propio tipo de cambio', () => {
        prepararMonedas(MONEDAS);
        expect(precioNs.cargarMonedas('1')).toEqual({ tipoCambio: 1, monedaPrecioId: '1' });
    });

    test('sin moneda de cotización, inexistente o sin tipo de cambio: tipoCambio null', () => {
        prepararMonedas(MONEDAS);
        expect(precioNs.cargarMonedas(null).tipoCambio).toBeNull();
        expect(precioNs.cargarMonedas('99').tipoCambio).toBeNull();
        expect(precioNs.cargarMonedas('3').tipoCambio).toBeNull();
    });

    test('sin MXN o con dos MXN: error de configuración', () => {
        [[MONEDAS[1]], MONEDAS.concat([{ id: 9, simbolo: 'mxn', tipo_cambio: 1 }])].forEach((filas) => {
            prepararMonedas(filas);
            const error = capturarError(() => precioNs.cargarMonedas('2'));
            expect(error.name).toBe('CONFIGURACION_INVALIDA');
            expect(error.esErrorDeDominio).toBe(true);
            expect(error.message).toBe('No se encontró una única moneda MXN para el precio base.');
        });
    });
});

describe('asignarPrecio (RN4-06)', () => {
    test('escribe precio de cotización, margen, custitem11 y solo la celda base en MXN', () => {
        const copia = crearCopia({ matriz: { price1: ['1', '2', '5'], price2: ['1', '2'] } });
        precioNs.asignarPrecio(copia, { entradas: ENTRADAS, calculo: CALCULO, monedaPrecioId: '1' });
        expect(copia.valoresAsignados).toEqual({
            custitemalm_articulo_preciocotizacion: 25,
            custitem_drt_ci_margen_para_venta: 20,
            custitem11: 195
        });
        expect(copia.celdas).toEqual({
            'price1|0|0': 195,
            'price1|1|0': '',
            'price1|2|0': '',
            'price2|0|0': '',
            'price2|1|0': ''
        });
        expect(copia.findSublistLineWithValue).toHaveBeenCalledWith({ sublistId: 'price1', fieldId: 'pricelevel', value: '1' });
        copia.setMatrixSublistValue.mock.calls.forEach((llamada) => expect(llamada[0].fieldId).toBe('price'));
    });

    test('el nivel base puede no ser la primera línea; con precios por cantidad vacía las demás columnas', () => {
        const copia = crearCopia({ matriz: { price1: ['3', '1'] }, columnas: 3 });
        precioNs.asignarPrecio(copia, { entradas: ENTRADAS, calculo: CALCULO, monedaPrecioId: '1' });
        expect(copia.celdas['price1|1|0']).toBe(195);
        expect(Object.keys(copia.celdas)).toHaveLength(6);
        expect(Object.keys(copia.celdas).filter((celda) => copia.celdas[celda] !== '')).toEqual(['price1|1|0']);
    });

    test('un conteo de columnas no válido se trata como una columna', () => {
        const copia = crearCopia({ matriz: { price1: ['1'] }, columnas: -1 });
        precioNs.asignarPrecio(copia, { entradas: ENTRADAS, calculo: CALCULO, monedaPrecioId: '1' });
        expect(copia.celdas).toEqual({ 'price1|0|0': 195 });
    });

    test('ignora sublistas que no son de precios', () => {
        const copia = crearCopia({ matriz: { price1: ['1'] }, otrasSublistas: ['itemvendor', 'pricelevels', 'price1x'] });
        precioNs.asignarPrecio(copia, { entradas: ENTRADAS, calculo: CALCULO, monedaPrecioId: '1' });
        expect(copia.getLineCount.mock.calls.map((llamada) => llamada[0].sublistId)).toEqual(['price1']);
    });

    test('sin sublista MXN o sin nivel base: error antes de escribir', () => {
        [
            { matriz: { price2: ['1'] }, mensaje: 'La plantilla no tiene precios en MXN.' },
            { matriz: { price1: ['2', '3'] }, mensaje: 'La plantilla no tiene el nivel Precio base en MXN.' }
        ].forEach(({ matriz, mensaje }) => {
            const copia = crearCopia({ matriz });
            const error = capturarError(() => precioNs.asignarPrecio(copia, { entradas: ENTRADAS, calculo: CALCULO, monedaPrecioId: '1' }));
            expect(error.name).toBe('CONFIGURACION_INVALIDA');
            expect(error.message).toBe(mensaje);
            expect(copia.setValue).not.toHaveBeenCalled();
            expect(copia.setMatrixSublistValue).not.toHaveBeenCalled();
        });
    });
});

describe('leerPrecioFormula (RN4-08)', () => {
    test('lee custitem_alm_art_preciofinal con lookupFields', () => {
        search.lookupFields.mockReturnValue({ custitem_alm_art_preciofinal: '195.00' });
        expect(precioNs.leerPrecioFormula('inventoryitem', 777)).toBe(195);
        expect(search.lookupFields).toHaveBeenCalledWith({
            type: 'inventoryitem',
            id: 777,
            columns: ['custitem_alm_art_preciofinal']
        });
    });

    test('vacío devuelve null', () => {
        search.lookupFields.mockReturnValue({ custitem_alm_art_preciofinal: '' });
        expect(precioNs.leerPrecioFormula('inventoryitem', 777)).toBeNull();
    });

    test('un error se registra y devuelve null', () => {
        search.lookupFields.mockImplementation(() => {
            throw Object.assign(new Error('Campo no disponible'), { name: 'SSS_INVALID_SRCH_COL' });
        });
        expect(precioNs.leerPrecioFormula('inventoryitem', 777)).toBeNull();
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.error.mock.calls[0][0].details).toBe('Artículo: 777. SSS_INVALID_SRCH_COL: Campo no disponible');
    });
});
