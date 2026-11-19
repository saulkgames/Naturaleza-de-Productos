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

    test('TIPOS_SOPORTADOS está congelado con float, integer y catalogo (S-03, S3-06)', () => {
        expect(Object.isFrozen(parametros.TIPOS_SOPORTADOS)).toBe(true);
        expect(parametros.TIPOS_SOPORTADOS).toEqual({ FLOAT: 'float', INTEGER: 'integer', CATALOGO: 'catalogo' });
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
        expect(parametros.validarValores()).toEqual({
            valido: false, errores: [MENSAJE_NUMERO('Peso')], valores: {}, peso: null, conversion: null
        });
    });
});

describe('catálogo de espesor y conversión (iteración B)', () => {
    const DEFINICION_PLACA = Object.freeze([
        { id: 'custitem_sads_nat_pla_lado_a', etiqueta: 'Lado A', tipo: 'integer' },
        { id: 'custitem_sads_nat_pla_lado_b', etiqueta: 'Lado B', tipo: 'integer' },
        { id: 'custitem_sads_nat_espesor', etiqueta: 'Espesor', tipo: 'catalogo' }
    ]);
    const OPCIONES = Object.freeze(['501', '502', '503']);
    const validar = (ajustes) => parametros.validarValores(Object.assign({
        parametros: DEFINICION_PLACA,
        valoresCrudos: ['6', '20', '502'],
        pesoCrudo: '1225.5',
        conversionCruda: '1225.5',
        opcionesCatalogo: OPCIONES
    }, ajustes));

    test('validarDefinicion acepta un parámetro de catálogo', () => {
        expect(parametros.validarDefinicion(DEFINICION_PLACA)).toEqual({ valido: true, errores: [] });
    });

    test('validarDefinicion rechaza más de un parámetro de catálogo', () => {
        const resultado = parametros.validarDefinicion(DEFINICION_PLACA.concat([{ id: 'custitem_otro', etiqueta: 'Otro', tipo: 'catalogo' }]));
        expect(resultado).toEqual({ valido: false, errores: ['La configuración admite un solo campo de espesor.'] });
    });

    test('RN3-02: un espesor del catálogo se guarda como número y la conversión se devuelve', () => {
        const resultado = validar();
        expect(resultado.valido).toBe(true);
        expect(resultado.valores).toEqual({ custitem_sads_nat_pla_lado_a: 6, custitem_sads_nat_pla_lado_b: 20, custitem_sads_nat_espesor: 502 });
        expect(resultado.peso).toBe(1225.5);
        expect(resultado.conversion).toBe(1225.5);
    });

    test('RN3-02: acepta opciones numéricas y espacios alrededor', () => {
        expect(validar({ valoresCrudos: ['6', '20', ' 503 '], opcionesCatalogo: [501, 503] }).valores.custitem_sads_nat_espesor).toBe(503);
    });

    test.each(['999', '', 'abc', undefined, '0.5'])('P3-08: espesor %p fuera del catálogo se rechaza', (crudo) => {
        const resultado = validar({ valoresCrudos: ['6', '20', crudo] });
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toEqual(['Espesor: elija un valor de la lista.']);
        expect(resultado.valores).not.toHaveProperty('custitem_sads_nat_espesor');
    });

    test('sin opciones de catálogo, cualquier espesor se rechaza', () => {
        expect(validar({ opcionesCatalogo: undefined }).errores).toEqual(['Espesor: elija un valor de la lista.']);
    });

    test.each(['', '0', '-1', 'abc', '1,5', null])('P3-11: conversión %p se rechaza', (conversionCruda) => {
        const resultado = validar({ conversionCruda });
        expect(resultado.valido).toBe(false);
        expect(resultado.conversion).toBeNull();
        expect(resultado.errores).toEqual([
            'Conversión unidad de compra a base: capture un número mayor que 0 con punto decimal, por ejemplo 0.25.'
        ]);
    });

    test('conversión omitida (undefined) no se evalúa', () => {
        const resultado = validar({ conversionCruda: undefined });
        expect(resultado.valido).toBe(true);
        expect(resultado.conversion).toBeNull();
    });

    test('los criterios de duplicado incluyen el ID del espesor', () => {
        expect(parametros.armarCriteriosDuplicado({
            ids: DEFINICION_PLACA.map((parametro) => parametro.id),
            valores: validar().valores
        })).toEqual([
            { columna: 'custitem_sads_nat_pla_lado_a', valor: 6 },
            { columna: 'custitem_sads_nat_pla_lado_b', valor: 20 },
            { columna: 'custitem_sads_nat_espesor', valor: 502 }
        ]);
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
            'validarOrdenDeLados',
            'validarValores'
        ]);
    });
});

describe('validarOrdenDeLados (D-18)', () => {
    const PARES = [{ menor: 'custitem_sads_nat_pla_lado_a', mayor: 'custitem_sads_nat_pla_lado_b' }];
    const ETIQUETAS = { custitem_sads_nat_pla_lado_a: 'Lado A', custitem_sads_nat_pla_lado_b: 'Lado B' };
    const validar = (a, b, ajustes = {}) => parametros.validarOrdenDeLados(Object.assign({
        valores: { custitem_sads_nat_pla_lado_a: a, custitem_sads_nat_pla_lado_b: b },
        etiquetas: ETIQUETAS,
        pares: PARES
    }, ajustes));

    test.each([[6, 20], [7, 7]])('A = %p y B = %p es válido', (a, b) => {
        expect(validar(a, b)).toEqual({ valido: true, errores: [] });
    });

    test('A mayor que B se rechaza con las etiquetas', () => {
        expect(validar(8, 6)).toEqual({ valido: false, errores: ['Lado A no puede ser mayor que Lado B.'] });
    });

    test('sin etiquetas usa los IDs', () => {
        expect(validar(8, 6, { etiquetas: undefined }).errores)
            .toEqual(['custitem_sads_nat_pla_lado_a no puede ser mayor que custitem_sads_nat_pla_lado_b.']);
    });

    test('un par con un valor faltante no se evalúa', () => {
        expect(parametros.validarOrdenDeLados({ valores: { custitem_sads_nat_pla_lado_a: 8 }, etiquetas: ETIQUETAS, pares: PARES }).valido).toBe(true);
    });

    test('no lanza con argumentos ausentes', () => {
        expect(parametros.validarOrdenDeLados()).toEqual({ valido: true, errores: [] });
    });
});

describe('validarValores con opciones por catálogo (RN5-01)', () => {
    const DEFINICION = Object.freeze([
        { id: 'mapa', etiqueta: 'Medida', tipo: 'catalogo' },
        { id: 'custitem_sads_nat_ptr_largo', etiqueta: 'Largo', tipo: 'float' },
        { id: 'custitem_sads_nat_espesor', etiqueta: 'Espesor', tipo: 'catalogo' }
    ]);
    const validar = (valoresCrudos) => parametros.validarValores({
        parametros: DEFINICION,
        valoresCrudos,
        pesoCrudo: '10',
        opcionesPorCatalogo: { mapa: [501, 502], custitem_sads_nat_espesor: ['31'] }
    });

    test('cada catálogo se valida contra sus propias opciones', () => {
        expect(validar(['502', '6', '31'])).toMatchObject({ valido: true, valores: { mapa: 502, custitem_sads_nat_ptr_largo: 6, custitem_sads_nat_espesor: 31 } });
    });

    test('una opción de otro catálogo se rechaza', () => {
        expect(validar(['31', '6', '501']).errores).toEqual(['Medida: elija un valor de la lista.', 'Espesor: elija un valor de la lista.']);
    });
});
