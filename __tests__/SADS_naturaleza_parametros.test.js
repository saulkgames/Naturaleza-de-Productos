const fs = require('fs');
const path = require('path');

const parametros = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_parametros');
const formato = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_config_formato');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain', 'SADS_naturaleza_parametros.js'
);

const DEFINICION = Object.freeze([
    { id: 'custitem_pl_ancho', etiqueta: 'Ancho', tipo: 'float' },
    { id: 'custitem_pl_espesor', etiqueta: 'Espesor', tipo: 'float' },
    { id: 'custitem_pl_largo', etiqueta: 'Largo', tipo: 'float' }
]);

const MENSAJE_NUMERO = (etiqueta) => `${etiqueta}: capture un número mayor que 0 con punto decimal, por ejemplo 0.25.`;
const MENSAJE_ENTERO = (etiqueta) => `${etiqueta}: capture un número entero mayor que 0.`;

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba un error');
};

const esperarParametroInvalido = (funcion) => {
    const error = capturarError(funcion);
    expect(error.name).toBe('PARAMETRO_INVALIDO');
    expect(formato.esErrorDeDominio(error)).toBe(true);
    return error;
};

describe('constantes', () => {
    test('ERRORES está congelado y contiene PARAMETRO_INVALIDO', () => {
        expect(Object.isFrozen(parametros.ERRORES)).toBe(true);
        expect(parametros.ERRORES).toEqual({ PARAMETRO_INVALIDO: 'PARAMETRO_INVALIDO' });
    });

    test('TIPOS_SOPORTADOS está congelado con float e integer (S-03)', () => {
        expect(Object.isFrozen(parametros.TIPOS_SOPORTADOS)).toBe(true);
        expect(Object.values(parametros.TIPOS_SOPORTADOS).sort()).toEqual(['float', 'integer']);
    });
});

describe('esIdentificadorSeguro', () => {
    test.each([
        ['custitem_a', true],
        ['custitem-a', false],
        ['custitem_a; drop', false],
        ['CUSTITEM_A', false],
        ['custitem_pl_largo2', true],
        ['', false],
        [' custitem_a', false],
        ['custitem.a', false],
        [null, false],
        [undefined, false],
        [12, false],
        [['custitem_a'], false]
    ])('P-05: %p → %p', (id, esperado) => {
        expect(parametros.esIdentificadorSeguro(id)).toBe(esperado);
    });
});

describe('validarIds', () => {
    test('acepta IDs seguros', () => {
        expect(parametros.validarIds(['custitem_a', 'custitem_b'])).toEqual({ valido: true, errores: [] });
    });

    test('P-05: reporta cada ID inseguro por su posición sin reflejar su texto', () => {
        const resultado = parametros.validarIds(['custitem_a', 'custitem-a', 'custitem_a; drop', 'CUSTITEM_A']);
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toEqual([
            'El ID de campo en la posición 2 solo puede contener minúsculas, dígitos y guion bajo.',
            'El ID de campo en la posición 3 solo puede contener minúsculas, dígitos y guion bajo.',
            'El ID de campo en la posición 4 solo puede contener minúsculas, dígitos y guion bajo.'
        ]);
        expect(resultado.errores.join(' ')).not.toMatch(/custitem|drop/i);
    });

    test.each([null, undefined, 'custitem_a', {}])('no lanza y rechaza una entrada que no es arreglo: %p', (valor) => {
        expect(parametros.validarIds(valor).valido).toBe(false);
    });
});

describe('validarDefinicion', () => {
    test('acepta decimales y enteros', () => {
        const definicion = [
            { id: 'custitem_a', etiqueta: 'A', tipo: 'float' },
            { id: 'custitem_b', etiqueta: 'B', tipo: 'integer' },
            { id: 'custitem_c', etiqueta: 'C', tipo: 'FLOAT' }
        ];
        expect(parametros.validarDefinicion(definicion)).toEqual({ valido: true, errores: [] });
    });

    test('P-12 / R-12: rechaza un campo ausente y uno de tipo texto', () => {
        const resultado = parametros.validarDefinicion([
            { id: 'custitem_a', etiqueta: 'A', tipo: null },
            { id: 'custitem_b', etiqueta: 'B', tipo: 'text' },
            { id: 'custitem_c', etiqueta: 'C', tipo: 'float' }
        ]);
        expect(resultado).toEqual({
            valido: false,
            errores: [
                'El campo custitem_a no existe en el artículo plantilla.',
                'El campo custitem_b no es decimal ni entero.'
            ]
        });
    });

    test('no cita un ID inseguro', () => {
        const resultado = parametros.validarDefinicion([{ id: '<b>x</b>', etiqueta: 'X', tipo: undefined }]);
        expect(resultado.errores).toEqual(['El campo en la posición 1 no existe en el artículo plantilla.']);
    });

    test.each([[], null, undefined])('rechaza una definición vacía o ausente: %p', (valor) => {
        expect(parametros.validarDefinicion(valor).valido).toBe(false);
    });
});

describe('validarValores', () => {
    const validarUno = (crudo, tipo = 'float') => parametros.validarValores({
        parametros: [{ id: 'custitem_pl_largo', etiqueta: 'Largo', tipo }],
        valoresCrudos: [crudo],
        pesoCrudo: '12.5'
    });

    test.each([
        ['4', 4],
        ['4.5', 4.5],
        [' 0.25 ', 0.25],
        ['10', 10]
    ])('P-06: acepta %p como %p', (crudo, esperado) => {
        const resultado = validarUno(crudo);
        expect(resultado.valido).toBe(true);
        expect(resultado.errores).toEqual([]);
        expect(resultado.valores).toEqual({ custitem_pl_largo: esperado });
    });

    test.each(['4,5', 'abc', '0', '-1', '', 'Infinity', '0.0', '.5', '5.', '1e3', '4 5', null, undefined, 4])(
        'P-06: rechaza %p con mensaje que cita la etiqueta',
        (crudo) => {
            const resultado = validarUno(crudo);
            expect(resultado.valido).toBe(false);
            expect(resultado.errores).toEqual([MENSAJE_NUMERO('Largo')]);
            expect(resultado.valores).toEqual({});
        }
    );

    test('un campo entero rechaza decimales y acepta enteros', () => {
        expect(validarUno('2.5', 'integer').errores).toEqual([MENSAJE_ENTERO('Largo')]);
        expect(validarUno('abc', 'integer').errores).toEqual([MENSAJE_ENTERO('Largo')]);
        expect(validarUno('3', 'integer').valores).toEqual({ custitem_pl_largo: 3 });
        expect(validarUno('3.0', 'integer').valores).toEqual({ custitem_pl_largo: 3 });
    });

    test.each([
        ['', false],
        ['0', false],
        ['-1', false],
        [undefined, false],
        ['12.5', true]
    ])('P-07: peso %p → válido %p', (pesoCrudo, valido) => {
        const resultado = parametros.validarValores({
            parametros: DEFINICION,
            valoresCrudos: ['2', '0.25', '4'],
            pesoCrudo
        });
        expect(resultado.valido).toBe(valido);
        if (valido) {
            expect(resultado.peso).toBe(12.5);
            expect(resultado.errores).toEqual([]);
        } else {
            expect(resultado.peso).toBeNull();
            expect(resultado.errores).toEqual([MENSAJE_NUMERO('Peso')]);
        }
    });

    test('alinea valores por índice y acumula todos los errores', () => {
        const resultado = parametros.validarValores({
            parametros: DEFINICION,
            valoresCrudos: ['2', 'x'],
            pesoCrudo: '0'
        });
        expect(resultado.valido).toBe(false);
        expect(resultado.valores).toEqual({ custitem_pl_ancho: 2 });
        expect(resultado.errores).toEqual([MENSAJE_NUMERO('Espesor'), MENSAJE_NUMERO('Largo'), MENSAJE_NUMERO('Peso')]);
    });

    test('usa el ID si la etiqueta está vacía', () => {
        const resultado = parametros.validarValores({
            parametros: [{ id: 'custitem_a', etiqueta: '  ', tipo: 'float' }],
            valoresCrudos: ['x'],
            pesoCrudo: '1'
        });
        expect(resultado.errores).toEqual([MENSAJE_NUMERO('custitem_a')]);
    });

    test('no lanza con argumentos ausentes', () => {
        expect(parametros.validarValores()).toEqual({ valido: false, errores: [MENSAJE_NUMERO('Peso')], valores: {}, peso: null });
    });
});

describe('armarCriteriosDuplicado', () => {
    test('P-08: arma los criterios en el orden del JSON', () => {
        const criterios = parametros.armarCriteriosDuplicado({
            ids: ['custitem_pl_ancho', 'custitem_pl_espesor', 'custitem_pl_largo'],
            valores: { custitem_pl_largo: 4, custitem_pl_ancho: 2, custitem_pl_espesor: 0.25 }
        });
        expect(criterios).toEqual([
            { columna: 'custitem_pl_ancho', valor: 2 },
            { columna: 'custitem_pl_espesor', valor: 0.25 },
            { columna: 'custitem_pl_largo', valor: 4 }
        ]);
    });

    test('lanza PARAMETRO_INVALIDO con un ID inseguro', () => {
        esperarParametroInvalido(() => parametros.armarCriteriosDuplicado({
            ids: ['custitem_a; drop'],
            valores: { 'custitem_a; drop': 1 }
        }));
    });

    test('lanza PARAMETRO_INVALIDO si falta un valor o no es número', () => {
        esperarParametroInvalido(() => parametros.armarCriteriosDuplicado({ ids: ['custitem_a'], valores: {} }));
        esperarParametroInvalido(() => parametros.armarCriteriosDuplicado({ ids: ['custitem_a'], valores: { custitem_a: '4' } }));
        esperarParametroInvalido(() => parametros.armarCriteriosDuplicado({ ids: ['toString'], valores: {} }));
    });

    test('lanza PARAMETRO_INVALIDO sin IDs', () => {
        esperarParametroInvalido(() => parametros.armarCriteriosDuplicado({ ids: [], valores: {} }));
        esperarParametroInvalido(() => parametros.armarCriteriosDuplicado());
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
        expect(Object.keys(parametros).sort()).toEqual([
            'ERRORES',
            'TIPOS_SOPORTADOS',
            'armarCriteriosDuplicado',
            'esIdentificadorSeguro',
            'validarDefinicion',
            'validarIds',
            'validarValores'
        ]);
    });
});
