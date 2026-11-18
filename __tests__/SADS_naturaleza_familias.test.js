const fs = require('fs');
const path = require('path');

const familias = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_familias');
const formato = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_config_formato');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain', 'SADS_naturaleza_familias.js'
);

const TIPO_FRACCION = '1';
const TIPO_CALIBRE = '2';

const linea = (id, desde, hasta, ajustes = {}) => Object.assign({
    id,
    desdeId: desde === null ? null : `e${desde}`,
    hastaId: hasta === null ? null : `e${hasta}`,
    desdeOrden: desde,
    hastaOrden: hasta,
    desdeTipo: desde === null ? null : TIPO_FRACCION,
    hastaTipo: hasta === null ? null : TIPO_FRACCION,
    familiaPrecioId: `p${id}`,
    familiaMargenId: `m${id}`,
    familiaPrecioNombre: `FAM${id}`
}, ajustes);

const PLACAS = Object.freeze([linea('68', 0.1875, 0.625), linea('69', 0.75, 1.5)]);

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba un error');
};

const esperarFamiliaInvalida = (funcion) => {
    const error = capturarError(funcion);
    expect(error.name).toBe('FAMILIA_INVALIDA');
    expect(formato.esErrorDeDominio(error)).toBe(true);
    expect(error.message).toBe('No hay una familia de precios única para este espesor en la naturaleza.');
};

describe('ERRORES y esUnica', () => {
    test('ERRORES está congelado', () => {
        expect(Object.isFrozen(familias.ERRORES)).toBe(true);
        expect(familias.ERRORES).toEqual({ FAMILIA_INVALIDA: 'FAMILIA_INVALIDA' });
    });

    test('una línea sin desde ni hasta es única', () => {
        expect(familias.esUnica(linea('1', null, null))).toBe(true);
        expect(familias.esUnica(linea('1', 0.25, 0.5))).toBe(false);
        expect(familias.esUnica({ desdeId: '', hastaId: undefined, desdeOrden: null, hastaOrden: null })).toBe(true);
    });
});

describe('resolver (RN3-04, RN3-07)', () => {
    test('P3-01: orden 0.5 resuelve la primera línea', () => {
        expect(familias.resolver({ lineas: PLACAS, orden: 0.5 }).id).toBe('68');
    });

    test.each([[0.1875, '68'], [0.625, '68'], [0.75, '69'], [1.5, '69']])('P3-02: extremo %p resuelve la línea %p', (orden, id) => {
        expect(familias.resolver({ lineas: PLACAS, orden }).id).toBe(id);
    });

    test.each([2.0, 0.7, 0.1])('P3-03: orden %p fuera de rangos lanza FAMILIA_INVALIDA', (orden) => {
        esperarFamiliaInvalida(() => familias.resolver({ lineas: PLACAS, orden }));
    });

    test('P3-06: una sola línea única aplica a cualquier orden y a orden null', () => {
        const unica = [linea('7', null, null)];
        expect(familias.resolver({ lineas: unica, orden: 3 }).id).toBe('7');
        expect(familias.resolver({ lineas: unica, orden: null }).id).toBe('7');
    });

    test('RN3-07: sin orden se exige una sola línea y que sea única', () => {
        esperarFamiliaInvalida(() => familias.resolver({ lineas: PLACAS, orden: null }));
        esperarFamiliaInvalida(() => familias.resolver({ lineas: [linea('1', null, null), linea('2', null, null)], orden: null }));
    });

    test('rangos traslapados que coinciden lanzan FAMILIA_INVALIDA', () => {
        esperarFamiliaInvalida(() => familias.resolver({ lineas: [linea('1', 0.25, 0.5), linea('2', 0.5, 0.75)], orden: 0.5 }));
    });

    test('una línea única junto con rangos lanza FAMILIA_INVALIDA', () => {
        esperarFamiliaInvalida(() => familias.resolver({ lineas: PLACAS.concat([linea('9', null, null)]), orden: 0.5 }));
    });

    test('sin líneas lanza FAMILIA_INVALIDA', () => {
        esperarFamiliaInvalida(() => familias.resolver({ lineas: [], orden: 0.5 }));
        esperarFamiliaInvalida(() => familias.resolver());
    });
});

describe('validarLinea (RN3-05, RN3-06, RN3-07)', () => {
    test('acepta un rango sin traslape del tipo de la naturaleza', () => {
        expect(familias.validarLinea({ linea: PLACAS[1], hermanas: [PLACAS[0]], tipoNaturaleza: TIPO_FRACCION }))
            .toEqual({ valido: true, errores: [] });
    });

    test('acepta una familia única sola, con o sin tipo de espesor', () => {
        expect(familias.validarLinea({ linea: linea('1', null, null), hermanas: [], tipoNaturaleza: null }).valido).toBe(true);
        expect(familias.validarLinea({ linea: linea('1', null, null), hermanas: [], tipoNaturaleza: TIPO_FRACCION }).valido).toBe(true);
    });

    test('P3-04: una familia única con hermanas es inválida', () => {
        expect(familias.validarLinea({ linea: linea('1', null, null), hermanas: PLACAS, tipoNaturaleza: TIPO_FRACCION }).errores)
            .toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });

    test('P3-04: un rango con una hermana única es inválido', () => {
        expect(familias.validarLinea({ linea: PLACAS[0], hermanas: [linea('1', null, null)], tipoNaturaleza: TIPO_FRACCION }).errores)
            .toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });

    test('P3-05: rangos [0.25–0.5] y [0.5–0.75] se traslapan', () => {
        expect(familias.validarLinea({
            linea: linea('2', 0.5, 0.75), hermanas: [linea('1', 0.25, 0.5)], tipoNaturaleza: TIPO_FRACCION
        }).errores).toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });

    test('P3-07: desde mayor que hasta es inválido', () => {
        expect(familias.validarLinea({ linea: linea('1', 0.75, 0.25), hermanas: [], tipoNaturaleza: TIPO_FRACCION }).errores)
            .toEqual(['El espesor desde debe ser menor o igual que el espesor hasta.']);
    });

    test('P3-07: desde o hasta de otro tipo es inválido', () => {
        expect(familias.validarLinea({
            linea: linea('1', 0.25, 0.5, { desdeTipo: TIPO_CALIBRE }), hermanas: [], tipoNaturaleza: TIPO_FRACCION
        }).errores).toEqual(['Los espesores desde y hasta deben ser del tipo de espesor de la naturaleza.']);
    });

    test('RN3-05: desde sin hasta es inválido', () => {
        expect(familias.validarLinea({ linea: linea('1', 0.25, null), hermanas: [], tipoNaturaleza: TIPO_FRACCION }).errores)
            .toEqual(['Capture espesor desde y espesor hasta, o deje ambos vacíos.']);
    });

    test('RN3-07: una naturaleza sin espesor no admite rangos', () => {
        expect(familias.validarLinea({ linea: PLACAS[0], hermanas: [], tipoNaturaleza: null }).errores)
            .toEqual(['La naturaleza no usa espesor: no admite rango de espesor.']);
    });

    test('familias de precio y margen son obligatorias', () => {
        expect(familias.validarLinea({
            linea: linea('1', null, null, { familiaPrecioId: '', familiaMargenId: null }), hermanas: [], tipoNaturaleza: null
        }).errores).toEqual(['La familia de precio es obligatoria.', 'La familia de margen es obligatoria.']);
    });

    test('acepta tipos numéricos y de texto como equivalentes', () => {
        expect(familias.validarLinea({ linea: PLACAS[0], hermanas: [], tipoNaturaleza: 1 }).valido).toBe(true);
    });

    test('no lanza con argumentos ausentes', () => {
        expect(familias.validarLinea().valido).toBe(false);
    });
});

describe('regla de dependencia', () => {
    const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');

    test('el define solo declara el módulo de formato y el archivo no referencia módulos N/', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        expect(definicion).not.toBeNull();
        expect(definicion[1].trim()).toBe("'./SADS_naturaleza_config_formato'");
        expect(fuente).not.toMatch(/['"]N\//);
    });

    test('exporta las funciones de la especificación', () => {
        expect(Object.keys(familias).sort()).toEqual(['ERRORES', 'esUnica', 'resolver', 'validarLinea']);
    });
});

describe('rango de medida (D-21)', () => {
    const conMedida = (id, desde, hasta, medidaDesde, medidaHasta) => linea(id, desde, hasta, { medidaDesde, medidaHasta });

    test('resolver usa espesor y medida', () => {
        const lineas = [conMedida('23', 0.1875, 0.625, 0.5, 3.5), conMedida('24', 0.1875, 0.625, 4, 6)];
        expect(familias.resolver({ lineas, orden: 0.5, medida: 1 }).id).toBe('23');
        expect(familias.resolver({ lineas, orden: 0.5, medida: 4 }).id).toBe('24');
        esperarFamiliaInvalida(() => familias.resolver({ lineas, orden: 0.5, medida: 3.75 }));
        esperarFamiliaInvalida(() => familias.resolver({ lineas, orden: 0.5, medida: null }));
    });

    test('una naturaleza sin espesor puede usar solo rangos de medida', () => {
        const lineas = [conMedida('1', null, null, 0.5, 2), conMedida('2', null, null, 2.5, 6)];
        expect(familias.resolver({ lineas, orden: null, medida: 3 }).id).toBe('2');
        expect(familias.validarLinea({ linea: lineas[0], hermanas: [lineas[1]], tipoNaturaleza: null })).toEqual({ valido: true, errores: [] });
    });

    test('mismo rango de espesor con medidas distintas no se traslapa', () => {
        expect(familias.validarLinea({
            linea: conMedida('2', 0.1875, 0.625, 4, 6), hermanas: [conMedida('1', 0.1875, 0.625, 0.5, 3.5)], tipoNaturaleza: TIPO_FRACCION
        }).valido).toBe(true);
    });

    test('traslape en espesor y en medida se rechaza', () => {
        expect(familias.validarLinea({
            linea: conMedida('2', 0.25, 0.75, 3, 6), hermanas: [conMedida('1', 0.1875, 0.625, 0.5, 3.5)], tipoNaturaleza: TIPO_FRACCION
        }).errores).toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });

    test('una línea sin rango de medida cubre todas las medidas', () => {
        expect(familias.validarLinea({
            linea: linea('2', 0.25, 0.5), hermanas: [conMedida('1', 0.1875, 0.625, 0.5, 3.5)], tipoNaturaleza: TIPO_FRACCION
        }).errores).toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });

    test('medida incompleta o invertida se rechaza', () => {
        expect(familias.validarLinea({ linea: conMedida('1', 0.25, 0.5, 1, null), hermanas: [], tipoNaturaleza: TIPO_FRACCION }).errores)
            .toEqual(['Capture medida desde y medida hasta, o deje ambas vacías.']);
        expect(familias.validarLinea({ linea: conMedida('1', 0.25, 0.5, 4, 2), hermanas: [], tipoNaturaleza: TIPO_FRACCION }).errores)
            .toEqual(['La medida desde debe ser menor o igual que la medida hasta.']);
    });

    test('esUnica considera también la medida', () => {
        expect(familias.esUnica(conMedida('1', null, null, 1, 2))).toBe(false);
    });
});
