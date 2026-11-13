const fs = require('fs');
const path = require('path');

const patron = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_patron');
const formato = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_config_formato');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain', 'SADS_naturaleza_patron.js'
);

const IDS_EJEMPLO = ['custitem_pl_ancho', 'custitem_pl_espesor', 'custitem_pl_largo'];
const PATRON_CODIGO = 'PL-{custitem_pl_espesor}-{custitem_pl_largo}X{custitem_pl_ancho}';
const PATRON_NOMBRE = 'PLACA A36 {custitem_pl_espesor} IN {custitem_pl_largo} X {custitem_pl_ancho} FT';
const VALORES_EJEMPLO = Object.freeze({ custitem_pl_espesor: 0.25, custitem_pl_largo: 4, custitem_pl_ancho: 2 });

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba un error');
};

const esperarPatronInvalido = (funcion) => {
    const error = capturarError(funcion);
    expect(error.name).toBe('PATRON_INVALIDO');
    expect(formato.esErrorDeDominio(error)).toBe(true);
    expect(typeof error.message).toBe('string');
    expect(error.message).not.toBe('');
    return error;
};

describe('ERRORES', () => {
    test('está congelado y contiene PATRON_INVALIDO con valor igual a su nombre', () => {
        expect(Object.isFrozen(patron.ERRORES)).toBe(true);
        expect(patron.ERRORES).toEqual({ PATRON_INVALIDO: 'PATRON_INVALIDO' });
    });

    test('no altera los errores del módulo de formato (PT-03)', () => {
        expect(Object.keys(formato.ERRORES)).toHaveLength(3);
    });
});

describe('extraerMarcadores', () => {
    test('devuelve los IDs en orden de primera aparición', () => {
        expect(patron.extraerMarcadores(PATRON_CODIGO)).toEqual(['custitem_pl_espesor', 'custitem_pl_largo', 'custitem_pl_ancho']);
    });

    test('no repite IDs', () => {
        expect(patron.extraerMarcadores('{custitem_a}-{custitem_b}-{custitem_a}')).toEqual(['custitem_a', 'custitem_b']);
    });

    test('un patrón sin marcadores devuelve un arreglo vacío', () => {
        expect(patron.extraerMarcadores('PLACA FIJA')).toEqual([]);
        expect(patron.extraerMarcadores('')).toEqual([]);
    });

    test.each([
        ['llave sin cerrar', '{custitem_x'],
        ['llave sin cerrar al final', 'PL-{custitem_a}-{'],
        ['marcador vacío', 'PL-{}'],
        ['llave de cierre sin apertura', 'PL-custitem_a}'],
        ['llave anidada', '{custitem_{a}}'],
        ['apertura dentro de un marcador', '{custitem_a{custitem_b}']
    ])('P-03: lanza PATRON_INVALIDO con %s', (descripcion, texto) => {
        esperarPatronInvalido(() => patron.extraerMarcadores(texto));
    });

    test.each([null, undefined, 12, {}, []])('lanza PATRON_INVALIDO si el patrón no es cadena: %p', (valor) => {
        esperarPatronInvalido(() => patron.extraerMarcadores(valor));
    });
});

describe('validar', () => {
    test('acepta los patrones del ejemplo contra los IDs del JSON', () => {
        expect(patron.validar({ patron: PATRON_CODIGO, idsPermitidos: IDS_EJEMPLO })).toEqual({ valido: true, errores: [] });
        expect(patron.validar({ patron: PATRON_NOMBRE, idsPermitidos: IDS_EJEMPLO })).toEqual({ valido: true, errores: [] });
    });

    test('acepta un patrón sin marcadores', () => {
        expect(patron.validar({ patron: 'PLACA', idsPermitidos: IDS_EJEMPLO }).valido).toBe(true);
    });

    test.each(['', '   ', null, undefined, 5])('rechaza un patrón vacío o que no es texto: %p', (valor) => {
        const resultado = patron.validar({ patron: valor, idsPermitidos: IDS_EJEMPLO });
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toEqual(['El patrón está vacío.']);
    });

    test.each(['{custitem_x', 'PL-{}', 'PL}'])('P-03: rechaza la estructura inválida %p sin lanzar', (texto) => {
        const resultado = patron.validar({ patron: texto, idsPermitidos: IDS_EJEMPLO });
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(1);
    });

    test('P-03: reporta cada marcador fuera del JSON y cita solo los IDs citables', () => {
        const resultado = patron.validar({
            patron: '{custitem_x}-{custitem_pl_largo}-{<b>malo</b>}-{custitem_x}',
            idsPermitidos: IDS_EJEMPLO
        });
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toEqual([
            'El marcador {custitem_x} no es un ID de la configuración.',
            'Un marcador del patrón no es un ID de la configuración.'
        ]);
        expect(resultado.errores.join(' ')).not.toContain('<b>');
    });

    test('sin IDs permitidos, todo marcador es un error', () => {
        expect(patron.validar({ patron: '{custitem_a}', idsPermitidos: undefined }).valido).toBe(false);
    });

    test('no lanza con argumentos ausentes', () => {
        expect(patron.validar()).toEqual({ valido: false, errores: ['El patrón está vacío.'] });
    });
});

describe('formatearNumero', () => {
    test.each([
        [2.5, '2.5'],
        [2.50, '2.5'],
        [4.0, '4'],
        [4, '4'],
        [0.125, '0.125'],
        [0.25, '0.25'],
        [10, '10'],
        [100, '100'],
        [1.000001, '1.000001'],
        [3.1000004, '3.1'],
        [-0, '0']
    ])('P-02: %p → %p', (numero, esperado) => {
        expect(patron.formatearNumero(numero)).toBe(esperado);
    });

    test('nunca usa notación exponencial en valores pequeños', () => {
        expect(patron.formatearNumero(0.0000005)).not.toMatch(/e/i);
    });

    test.each([NaN, Infinity, -Infinity, '4', null, undefined])('lanza PATRON_INVALIDO con %p', (valor) => {
        esperarPatronInvalido(() => patron.formatearNumero(valor));
    });
});

describe('aplicar', () => {
    test('P-01: genera el código y el nombre del ejemplo', () => {
        expect(patron.aplicar({ patron: PATRON_CODIGO, valores: VALORES_EJEMPLO })).toBe('PL-0.25-4X2');
        expect(patron.aplicar({ patron: PATRON_NOMBRE, valores: VALORES_EJEMPLO })).toBe('PLACA A36 0.25 IN 4 X 2 FT');
    });

    test('sustituye todas las ocurrencias de un marcador', () => {
        expect(patron.aplicar({ patron: '{custitem_a}x{custitem_a}', valores: { custitem_a: 2.5 } })).toBe('2.5x2.5');
    });

    test('recorta el resultado', () => {
        expect(patron.aplicar({ patron: '  PL {custitem_a}  ', valores: { custitem_a: 3 } })).toBe('PL 3');
    });

    test('la sustitución es literal: caracteres especiales de expresiones regulares no se interpretan', () => {
        expect(patron.aplicar({ patron: '$&.*+?^(){custitem_a}[]|\\', valores: { custitem_a: 1 } })).toBe('$&.*+?^()1[]|\\');
    });

    test('ignora valores que no tienen marcador', () => {
        expect(patron.aplicar({ patron: 'PL-{custitem_a}', valores: { custitem_a: 1, custitem_b: 2 } })).toBe('PL-1');
    });

    test('P-04: lanza PATRON_INVALIDO si el resultado queda vacío', () => {
        const error = esperarPatronInvalido(() => patron.aplicar({ patron: '    ', valores: {} }));
        expect(error.message).toBe('El patrón generó un texto vacío.');
    });

    test('lanza PATRON_INVALIDO si falta un valor y cita el marcador citable', () => {
        const error = esperarPatronInvalido(() => patron.aplicar({ patron: PATRON_CODIGO, valores: { custitem_pl_espesor: 1 } }));
        expect(error.message).toBe('Falta el valor del marcador {custitem_pl_largo}.');
    });

    test('no cita un marcador no citable', () => {
        const error = esperarPatronInvalido(() => patron.aplicar({ patron: '{<x>}', valores: {} }));
        expect(error.message).not.toContain('<x>');
    });

    test('no toma valores heredados del prototipo', () => {
        esperarPatronInvalido(() => patron.aplicar({ patron: '{toString}', valores: {} }));
    });

    test.each(['{custitem_x', 'PL-{}', 'PL}'])('lanza PATRON_INVALIDO con estructura inválida %p', (texto) => {
        esperarPatronInvalido(() => patron.aplicar({ patron: texto, valores: { custitem_x: 1 } }));
    });

    test('lanza PATRON_INVALIDO si un valor no es número finito', () => {
        esperarPatronInvalido(() => patron.aplicar({ patron: '{custitem_a}', valores: { custitem_a: '4' } }));
        esperarPatronInvalido(() => patron.aplicar({ patron: '{custitem_a}', valores: { custitem_a: NaN } }));
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

    test('no usa eval, Function ni RegExp construida con texto', () => {
        expect(fuente).not.toMatch(/\beval\s*\(/);
        expect(fuente).not.toMatch(/\bnew\s+Function\b/);
        expect(fuente).not.toMatch(/\bnew\s+RegExp\b/);
        expect(fuente).not.toMatch(/\bRegExp\s*\(/);
    });

    test('exporta las funciones de la especificación', () => {
        expect(Object.keys(patron).sort()).toEqual(['ERRORES', 'aplicar', 'extraerMarcadores', 'formatearNumero', 'validar']);
    });
});
