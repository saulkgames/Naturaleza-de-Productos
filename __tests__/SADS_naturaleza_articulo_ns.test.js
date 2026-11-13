const fs = require('fs');
const path = require('path');

jest.mock('N/search', () => {
    const stub = jest.requireActual('N/search');
    return { create: jest.fn(), Type: stub.Type, Operator: stub.Operator };
});

const search = require('N/search');
const articulos = require('SuiteScripts/SADS_Naturaleza_Productos/infra/SADS_naturaleza_articulo_ns');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'infra', 'SADS_naturaleza_articulo_ns.js'
);

const prepararBusqueda = (resultados) => {
    const getRange = jest.fn(() => resultados);
    const run = jest.fn(() => ({ getRange }));
    search.create.mockReturnValue({ run });
    return { run, getRange };
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('resolverTipoRegistroArticulo', () => {
    test('con un resultado devuelve su recordType', () => {
        const { getRange } = prepararBusqueda([{ id: '901', recordType: 'inventoryitem' }]);
        expect(articulos.resolverTipoRegistroArticulo('901')).toBe('inventoryitem');
        expect(search.create).toHaveBeenCalledWith({
            type: search.Type.ITEM,
            filters: [['internalid', search.Operator.ANYOF, '901']],
            columns: []
        });
        expect(getRange).toHaveBeenCalledWith({ start: 0, end: 1 });
    });

    test('sin resultados devuelve null', () => {
        prepararBusqueda([]);
        expect(articulos.resolverTipoRegistroArticulo('902')).toBeNull();
    });

    test('un resultado sin recordType devuelve null', () => {
        prepararBusqueda([{ id: '903', recordType: '' }]);
        expect(articulos.resolverTipoRegistroArticulo('903')).toBeNull();
    });

    test('convierte el ID a cadena en el filtro', () => {
        prepararBusqueda([{ id: '904', recordType: 'kititem' }]);
        expect(articulos.resolverTipoRegistroArticulo(904)).toBe('kititem');
        expect(search.create.mock.calls[0][0].filters[0][2]).toBe('904');
    });

    test('propaga el error de la búsqueda', () => {
        search.create.mockImplementation(() => {
            throw new Error('SSS_SEARCH_ERROR');
        });
        expect(() => articulos.resolverTipoRegistroArticulo('905')).toThrow('SSS_SEARCH_ERROR');
    });
});

describe('estructura del módulo', () => {
    const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');

    test('solo depende de N/search y exporta solo resolverTipoRegistroArticulo', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        expect(definicion).not.toBeNull();
        expect(definicion[1].trim()).toBe("'N/search'");
        expect(Object.keys(articulos)).toEqual(['resolverTipoRegistroArticulo']);
    });

    test('declara el encabezado 2.1 con alcance SameAccount', () => {
        expect(fuente).toMatch(/@NApiVersion 2\.1\b/);
        expect(fuente).toMatch(/@NModuleScope SameAccount\b/);
    });
});
