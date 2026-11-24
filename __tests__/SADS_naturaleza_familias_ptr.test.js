const familias = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_familias');

// Rangos de familias de PTR cuadrado (D-21, D-22) contra la familia que hoy tienen los artículos de la cuenta.
// Datos: búsquedas del usuario del 2026-11-18 (ID interno, lado en pulgadas, espesor, familia de precio).

const TIPO_PTR = 'ptr';
const ORDEN = Object.freeze({
    C20: 0.0359, C18: 0.0478, C16: 0.0598, C14: 0.0747, C12: 0.1046, C11: 0.1196, C10: 0.1345, C09: 0.1495, C07: 0.1793,
    E18: 0.1875, E25: 0.25, E31: 0.3125, E37: 0.375, E50: 0.5
});

let consecutivo = 0;
const linea = (espesorDesde, espesorHasta, medidaDesde, medidaHasta, familia) => {
    consecutivo += 1;
    return {
        id: String(consecutivo),
        desdeId: espesorDesde, hastaId: espesorHasta,
        desdeOrden: ORDEN[espesorDesde], hastaOrden: ORDEN[espesorHasta],
        desdeTipo: TIPO_PTR, hastaTipo: TIPO_PTR,
        medidaDesde, medidaHasta,
        familiaPrecioId: familia, familiaMargenId: 'margen', familiaPrecioNombre: `FAM ${familia}`
    };
};

const FAMILIAS_PTRC = [
    linea('C20', 'C18', 0.5, 0.625, '020'),
    linea('C20', 'C18', 0.75, 6, '022'),
    linea('C16', 'C16', 0.5, 6, '098'),
    linea('C14', 'C14', 0.5, 3.5, '023'),
    linea('C14', 'C14', 4, 6, '024'),
    linea('C12', 'C10', 0.5, 3, '023'),
    linea('C12', 'C10', 3.5, 6, '024'),
    linea('C09', 'C09', 0.5, 1.75, '023'),
    linea('C09', 'E50', 2, 6, '024')
];

const FAMILIAS_MPPTRC = [
    linea('C14', 'C14', 0.5, 6, '023'),
    linea('C12', 'C09', 0.5, 3, '023'),
    linea('C12', 'C09', 3.5, 6, '024'),
    linea('C07', 'E50', 0.5, 6, '024')
];

const PTRC = [
    [11181, 1, 'C10', '023'],
    [11182, 1, 'C11', '023'],
    [11183, 1, 'C12', '023'],
    [1481, 1, 'C14', '023'],
    [11184, 1, 'C14', '023'],
    [11549, 1, 'C16', '098'],
    [11550, 1, 'C18', '022'],
    [11551, 1, 'C20', '022'],
    [11190, 1.5, 'C09', '023'],
    [11185, 1.5, 'C10', '023'],
    [11186, 1.5, 'C11', '023'],
    [11187, 1.5, 'C12', '023'],
    [11189, 1.5, 'C14', '023'],
    [11554, 1.5, 'C16', '098'],
    [11555, 1.5, 'C18', '022'],
    [11556, 1.5, 'C20', '022'],
    [11192, 1.25, 'C10', '023'],
    [11193, 1.25, 'C11', '023'],
    [11194, 1.25, 'C12', '023'],
    [1490, 1.25, 'C14', '023'],
    [11195, 1.25, 'C14', '023'],
    [11558, 1.25, 'C16', '098'],
    [1316, 1.25, 'C18', '022'],
    [11557, 1.25, 'C20', '022'],
    [18700, 1.75, 'C14', '023'],
    [11198, 1.75, 'C14', '023'],
    [11563, 0.5, 'C18', '020'],
    [11564, 0.5, 'C20', '020'],
    [11200, 2, 'C10', '023'],
    [11201, 2, 'C11', '023'],
    [11202, 2, 'C12', '023'],
    [13018, 2, 'C14', '023'],
    [11204, 2, 'C14', '023'],
    [11574, 2, 'C16', '098'],
    [11575, 2, 'C18', '022'],
    [11203, 2, 'C09', '024'],
    [11205, 2, 'E25', '024'],
    [11206, 2, 'E18', '024'],
    [11217, 2.5, 'E25', '024'],
    [11208, 2.5, 'C10', '023'],
    [11209, 2.5, 'C11', '023'],
    [11210, 2.5, 'C12', '023'],
    [11216, 2.5, 'C14', '023'],
    [11218, 2.5, 'E18', '024'],
    [11219, 2.25, 'C14', '023'],
    [11228, 3, 'C09', '024'],
    [11225, 3, 'C10', '023'],
    [11226, 3, 'C11', '023'],
    [11227, 3, 'C14', '023'],
    [11229, 3, 'E25', '024'],
    [11230, 3, 'E18', '024'],
    [11233, 3.5, 'C10', '024'],
    [11234, 3.5, 'C11', '024'],
    [11235, 3.5, 'C14', '023'],
    [11236, 3.5, 'E25', '024'],
    [11232, 3.5, 'E18', '024'],
    [11237, 0.75, 'C14', '023'],
    [11584, 0.75, 'C18', '022'],
    [11585, 0.75, 'C20', '022'],
    [11251, 4, 'E25', '024'],
    [11249, 4, 'C09', '024'],
    [11246, 4, 'C10', '024'],
    [11247, 4, 'C11', '024'],
    [11248, 4, 'C14', '024'],
    [11253, 4, 'E18', '024'],
    [11508, 5, 'E25', '024'],
    [11254, 5, 'E18', '024'],
    [10447, 5, 'E18', '024'],
    [11807, 0.625, 'C16', '098']
];

const MPPTRC = [
    [39404, 2.5, 'C10', '023'],
    [25481, 2.25, 'C14', '023'],
    [14267, 5, 'E25', '024'],
    [12940, 4, 'C10', '024'],
    [12563, 1, 'C14', '023'],
    [1486, 1.5, 'C10', '024'],
    [12562, 1.5, 'C14', '023'],
    [12733, 1.5, 'C09', '023'],
    [12561, 1.25, 'C14', '023'],
    [14003, 1.75, 'C14', '023'],
    [12565, 2, 'C14', '023'],
    [12896, 2, 'E25', '024'],
    [12568, 2, 'E18', '024'],
    [12778, 2.5, 'C14', '023'],
    [12776, 2.5, 'E25', '024'],
    [12696, 2.5, 'E18', '024'],
    [12936, 3, 'C11', '023'],
    [12566, 3, 'C14', '023'],
    [12912, 3, 'E18', '023'],
    [35663, 3.5, 'C14', '023'],
    [12687, 3.5, 'E25', '024'],
    [12816, 3, 'E25', '024'],
    [12906, 0.75, 'C14', '023'],
    [12567, 4, 'C14', '023'],
    [12678, 4, 'E25', '024'],
    [12965, 4, 'E18', '024']
];

const resolverFamilia = (lineas, lado, espesor) => familias.resolver({ lineas, orden: ORDEN[espesor], medida: lado }).familiaPrecioId;

const diferencias = (lineas, filas) => filas
    .filter(([, lado, espesor, familia]) => resolverFamilia(lineas, lado, espesor) !== familia)
    .map(([id]) => id);

describe('familias de PTR cuadrado contra los artículos existentes', () => {
    test('las líneas de PTRC no se traslapan', () => {
        FAMILIAS_PTRC.forEach((actual) => {
            const hermanas = FAMILIAS_PTRC.filter((otra) => otra !== actual);
            expect(familias.validarLinea({ linea: actual, hermanas, tipoNaturaleza: TIPO_PTR })).toEqual({ valido: true, errores: [] });
        });
    });

    test('las líneas de MPPTRC no se traslapan', () => {
        FAMILIAS_MPPTRC.forEach((actual) => {
            const hermanas = FAMILIAS_MPPTRC.filter((otra) => otra !== actual);
            expect(familias.validarLinea({ linea: actual, hermanas, tipoNaturaleza: TIPO_PTR })).toEqual({ valido: true, errores: [] });
        });
    });

    test(`PTRC: los ${PTRC.length} artículos reciben la familia que hoy tienen`, () => {
        expect(diferencias(FAMILIAS_PTRC, PTRC)).toEqual([]);
    });

    test(`MPPTRC: los ${MPPTRC.length} artículos reciben la familia que hoy tienen, salvo 2 excepciones conocidas`, () => {
        expect(diferencias(FAMILIAS_MPPTRC, MPPTRC)).toEqual([1486, 12912]);
    });

    test('ejemplos: 1" Cal.14 → FAM 023; 4" Cal.14 → FAM 024; 1/2" Cal.18 → FAM 020; 3" 1/4" → FAM 024', () => {
        expect(resolverFamilia(FAMILIAS_PTRC, 1, 'C14')).toBe('023');
        expect(resolverFamilia(FAMILIAS_PTRC, 4, 'C14')).toBe('024');
        expect(resolverFamilia(FAMILIAS_PTRC, 0.5, 'C18')).toBe('020');
        expect(resolverFamilia(FAMILIAS_PTRC, 3, 'E25')).toBe('024');
    });

    test('un lado sin rango (3 1/4" Cal.10) no tiene familia', () => {
        expect(() => resolverFamilia(FAMILIAS_PTRC, 3.25, 'C10')).toThrow('No hay una familia de precios única');
    });
});
