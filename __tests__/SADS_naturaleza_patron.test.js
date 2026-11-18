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
        expect(Object.keys(patron).sort()).toEqual([
            'ERRORES',
            'FORMATOS',
            'aplicar',
            'extraerMarcadores',
            'formatearNumero',
            'formatearValor',
            'validar',
            'validarFormatos'
        ]);
    });
});

describe('formatos de marcador (D-13, D-14, RN-17)', () => {
    const IDS_TA36 = ['custitem_pl_ancho', 'custitem_pl_espesor', 'custitem_pl_largo'];
    const CODIGO_TA36 = 'PLA36{custitem_pl_espesor:centesimas3}{custitem_pl_ancho}{custitem_pl_largo}';
    const NOMBRE_TA36 = "Placa Acero TA36 {custitem_pl_espesor:fraccion16}'' {custitem_pl_ancho}'x{custitem_pl_largo}'";
    const VALORES_TA36 = Object.freeze({ custitem_pl_espesor: 0.5, custitem_pl_ancho: 6, custitem_pl_largo: 20 });

    test('FORMATOS está congelado con centesimas3, fraccion16, entero1, entero2, codigo y texto', () => {
        expect(Object.isFrozen(patron.FORMATOS)).toBe(true);
        expect(patron.FORMATOS).toEqual({
            CENTESIMAS_3: 'centesimas3', FRACCION_16: 'fraccion16', ENTERO_1: 'entero1', ENTERO_2: 'entero2',
            DECIMAL_2: 'decimal2', CODIGO: 'codigo', TEXTO: 'texto'
        });
    });

    test('ejemplo de placa TA36: código PLA36050620 y nombre con fracción', () => {
        expect(patron.aplicar({ patron: CODIGO_TA36, valores: VALORES_TA36 })).toBe('PLA36050620');
        expect(patron.aplicar({ patron: NOMBRE_TA36, valores: VALORES_TA36 })).toBe("Placa Acero TA36 1/2'' 6'x20'");
    });

    test('los patrones TA36 son válidos contra los IDs del JSON', () => {
        expect(patron.validar({ patron: CODIGO_TA36, idsPermitidos: IDS_TA36 })).toEqual({ valido: true, errores: [] });
        expect(patron.validar({ patron: NOMBRE_TA36, idsPermitidos: IDS_TA36 })).toEqual({ valido: true, errores: [] });
    });

    test.each([
        [0.5, '050'],
        [0.25, '025'],
        [0.375, '037'],
        [0.1875, '018'],
        [0.0625, '006'],
        [0.9375, '093'],
        [0.29, '029'],
        [0.57, '057'],
        [1, '100'],
        [1.25, '125'],
        [9.99, '999'],
        [0.01, '001']
    ])('D-13: centesimas3 de %p → %p (truncado)', (numero, esperado) => {
        expect(patron.formatearValor(numero, 'centesimas3')).toBe(esperado);
    });

    test.each([10, 12.5, 0.005, 0.009, 0, -0.5])('D-13: centesimas3 de %p no cabe y devuelve null', (numero) => {
        expect(patron.formatearValor(numero, 'centesimas3')).toBeNull();
    });

    test('D-13: los dieciseisavos de 1/16 a 1 producen códigos distintos', () => {
        const codigos = Array.from({ length: 16 }, (valor, indice) => patron.formatearValor((indice + 1) / 16, 'centesimas3'));
        expect(new Set(codigos).size).toBe(16);
        expect(codigos[15]).toBe('100');
    });

    test.each([
        [0.5, '1/2'],
        [0.25, '1/4'],
        [0.75, '3/4'],
        [0.375, '3/8'],
        [0.1875, '3/16'],
        [0.0625, '1/16'],
        [0.625, '5/8'],
        [1, '1'],
        [2, '2'],
        [1.25, '1 1/4'],
        [1.5, '1 1/2'],
        [2.4375, '2 7/16']
    ])('D-14: fraccion16 de %p → %p', (numero, esperado) => {
        expect(patron.formatearValor(numero, 'fraccion16')).toBe(esperado);
    });

    test.each([0.3, 0.03125, 0.1, 1.33])('D-14: fraccion16 de %p no es múltiplo de 1/16 y devuelve null', (numero) => {
        expect(patron.formatearValor(numero, 'fraccion16')).toBeNull();
    });

    test('formatearValor sin formato usa el decimal de RN-07', () => {
        expect(patron.formatearValor(2.5, null)).toBe('2.5');
    });

    test('formatearValor lanza PATRON_INVALIDO con un formato desconocido o un número inválido', () => {
        esperarPatronInvalido(() => patron.formatearValor(1, 'mayusculas'));
        esperarPatronInvalido(() => patron.formatearValor(NaN, 'centesimas3'));
        esperarPatronInvalido(() => patron.formatearValor('0.5', 'fraccion16'));
    });

    test('extraerMarcadores devuelve IDs únicos sin el formato', () => {
        expect(patron.extraerMarcadores(`${CODIGO_TA36} {custitem_pl_espesor:fraccion16}`)).toEqual([
            'custitem_pl_espesor', 'custitem_pl_ancho', 'custitem_pl_largo'
        ]);
    });

    test.each([
        ['{:centesimas3}', 'El patrón tiene un marcador sin ID de campo antes de los dos puntos.'],
        ['{custitem_pl_espesor:}', 'El patrón tiene un marcador con formato vacío después de los dos puntos.']
    ])('estructura inválida %p', (texto, mensaje) => {
        const error = esperarPatronInvalido(() => patron.extraerMarcadores(texto));
        expect(error.message).toBe(mensaje);
        expect(patron.validar({ patron: texto, idsPermitidos: IDS_TA36 })).toEqual({ valido: false, errores: [mensaje] });
    });

    test('validar reporta un formato desconocido citando formato e ID con la lista de formatos', () => {
        const resultado = patron.validar({ patron: 'PL{custitem_pl_espesor:fraccion}', idsPermitidos: IDS_TA36 });
        expect(resultado).toEqual({
            valido: false,
            errores: ['El formato fraccion del marcador {custitem_pl_espesor} no existe. Formatos válidos: centesimas3, fraccion16, entero1, entero2, decimal2, codigo, texto.']
        });
    });

    test('validar no cita un formato no citable', () => {
        const resultado = patron.validar({ patron: '{custitem_pl_espesor:<b>x</b>}', idsPermitidos: IDS_TA36 });
        expect(resultado.errores).toEqual(['Un marcador del patrón tiene un formato que no existe. Formatos válidos: centesimas3, fraccion16, entero1, entero2, decimal2, codigo, texto.']);
    });

    test('validar reporta ID fuera del JSON y formato desconocido a la vez', () => {
        const resultado = patron.validar({ patron: '{custitem_otro:centesimas3}{custitem_pl_largo:xx}', idsPermitidos: IDS_TA36 });
        expect(resultado.errores).toEqual([
            'El marcador {custitem_otro} no es un ID de la configuración.',
            'El formato xx del marcador {custitem_pl_largo} no existe. Formatos válidos: centesimas3, fraccion16, entero1, entero2, decimal2, codigo, texto.'
        ]);
    });

    test('aplicar lanza PATRON_INVALIDO si el valor no cabe en el formato o el formato no existe', () => {
        const fuera = esperarPatronInvalido(() => patron.aplicar({ patron: NOMBRE_TA36, valores: Object.assign({}, VALORES_TA36, { custitem_pl_espesor: 0.3 }) }));
        expect(fuera.message).toBe('El valor del marcador {custitem_pl_espesor} no cabe en el formato fraccion16.');
        esperarPatronInvalido(() => patron.aplicar({ patron: '{custitem_pl_espesor:xx}', valores: VALORES_TA36 }));
    });

    describe('validarFormatos', () => {
        const etiquetas = { custitem_pl_espesor: 'Espesor', custitem_pl_ancho: 'Ancho', custitem_pl_largo: 'Largo' };

        test('acepta valores que caben en sus formatos', () => {
            expect(patron.validarFormatos({ patron: NOMBRE_TA36, valores: VALORES_TA36, etiquetas })).toEqual({ valido: true, errores: [] });
            expect(patron.validarFormatos({ patron: CODIGO_TA36, valores: VALORES_TA36, etiquetas })).toEqual({ valido: true, errores: [] });
        });

        test('reporta con la etiqueta un espesor que no es múltiplo de 1/16', () => {
            const valores = Object.assign({}, VALORES_TA36, { custitem_pl_espesor: 0.3 });
            expect(patron.validarFormatos({ patron: NOMBRE_TA36, valores, etiquetas })).toEqual({
                valido: false,
                errores: ['Espesor: el valor no corresponde a una fracción de 1/16 de pulgada.']
            });
        });

        test('reporta con la etiqueta un espesor que no cabe en 3 dígitos', () => {
            const valores = Object.assign({}, VALORES_TA36, { custitem_pl_espesor: 10 });
            expect(patron.validarFormatos({ patron: CODIGO_TA36, valores, etiquetas }).errores).toEqual([
                'Espesor: el valor no cabe en 3 dígitos de centésimas (de 0.01 a 9.99).'
            ]);
        });

        test('reporta una vez por campo y formato y usa el ID si falta la etiqueta', () => {
            const resultado = patron.validarFormatos({
                patron: '{custitem_pl_espesor:fraccion16}-{custitem_pl_espesor:fraccion16}',
                valores: { custitem_pl_espesor: 0.3 },
                etiquetas: {}
            });
            expect(resultado.errores).toEqual(['custitem_pl_espesor: el valor no corresponde a una fracción de 1/16 de pulgada.']);
        });

        test('ignora estructura inválida, formatos desconocidos y valores faltantes (los reporta aplicar)', () => {
            expect(patron.validarFormatos({ patron: '{x', valores: {}, etiquetas })).toEqual({ valido: true, errores: [] });
            expect(patron.validarFormatos({ patron: '{custitem_a:xx}', valores: { custitem_a: 0.3 }, etiquetas })).toEqual({ valido: true, errores: [] });
            expect(patron.validarFormatos({ patron: NOMBRE_TA36, valores: {}, etiquetas })).toEqual({ valido: true, errores: [] });
            expect(patron.validarFormatos()).toEqual({ valido: true, errores: [] });
        });
    });
});

describe('formatos de catálogo codigo y texto (RN3-09)', () => {
    const IDS = ['custitem_sads_nat_pla_lado_a', 'custitem_sads_nat_pla_lado_b', 'custitem_sads_nat_espesor'];
    const CATALOGO = ['custitem_sads_nat_espesor'];
    const CODIGO = 'PLA36{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_pla_lado_a}{custitem_sads_nat_pla_lado_b}';
    const NOMBRE = "Placa Acero TA36 {custitem_sads_nat_espesor:texto} {custitem_sads_nat_pla_lado_a}'x{custitem_sads_nat_pla_lado_b}'";
    const VALORES = Object.freeze({ custitem_sads_nat_pla_lado_a: 6, custitem_sads_nat_pla_lado_b: 20, custitem_sads_nat_espesor: 502 });
    const TEXTOS = Object.freeze({ custitem_sads_nat_espesor: { codigo: '050', texto: "1/2''" } });

    test('P3-09: código PLA36050620 y nombre con el texto del espesor', () => {
        expect(patron.aplicar({ patron: CODIGO, valores: VALORES, textos: TEXTOS })).toBe('PLA36050620');
        expect(patron.aplicar({ patron: NOMBRE, valores: VALORES, textos: TEXTOS })).toBe("Placa Acero TA36 1/2'' 6'x20'");
    });

    test('los patrones de placa son válidos con el espesor como catálogo', () => {
        expect(patron.validar({ patron: CODIGO, idsPermitidos: IDS, idsCatalogo: CATALOGO })).toEqual({ valido: true, errores: [] });
        expect(patron.validar({ patron: NOMBRE, idsPermitidos: IDS, idsCatalogo: CATALOGO })).toEqual({ valido: true, errores: [] });
    });

    test('P3-16: el campo de catálogo sin formato o con formato numérico se rechaza', () => {
        expect(patron.validar({ patron: 'PL{custitem_sads_nat_espesor}', idsPermitidos: IDS, idsCatalogo: CATALOGO }).errores).toEqual([
            'El marcador {custitem_sads_nat_espesor} es un catálogo y requiere el formato codigo o texto.'
        ]);
        expect(patron.validar({ patron: 'PL{custitem_sads_nat_espesor:centesimas3}', idsPermitidos: IDS, idsCatalogo: CATALOGO }).valido).toBe(false);
    });

    test('P3-16: codigo o texto en un campo que no es catálogo se rechaza una vez', () => {
        const resultado = patron.validar({
            patron: '{custitem_sads_nat_pla_lado_a:codigo}{custitem_sads_nat_pla_lado_b:codigo}',
            idsPermitidos: IDS,
            idsCatalogo: CATALOGO
        });
        expect(resultado.errores).toEqual(['El formato codigo solo aplica al campo de espesor.']);
    });

    test('sin idsCatalogo, codigo y texto se rechazan', () => {
        expect(patron.validar({ patron: CODIGO, idsPermitidos: IDS }).errores).toEqual(['El formato codigo solo aplica al campo de espesor.']);
    });

    test('aplicar lanza PATRON_INVALIDO si falta el texto del espesor o viene vacío', () => {
        const sinTextos = esperarPatronInvalido(() => patron.aplicar({ patron: CODIGO, valores: VALORES }));
        expect(sinTextos.message).toBe('Falta el texto del espesor para el marcador {custitem_sads_nat_espesor}.');
        esperarPatronInvalido(() => patron.aplicar({
            patron: CODIGO, valores: VALORES, textos: { custitem_sads_nat_espesor: { codigo: ' ', texto: 'x' } }
        }));
    });

    test('formatearValor no admite formatos de catálogo', () => {
        esperarPatronInvalido(() => patron.formatearValor(1, 'codigo'));
    });

    test('validarFormatos ignora codigo y texto', () => {
        expect(patron.validarFormatos({ patron: NOMBRE, valores: VALORES, etiquetas: {} })).toEqual({ valido: true, errores: [] });
    });
});

describe('formatos entero1 y entero2 (D-16, D-17)', () => {
    const IDS = ['custitem_sads_nat_pla_lado_a', 'custitem_sads_nat_pla_lado_b', 'custitem_sads_nat_espesor'];
    const CATALOGO = ['custitem_sads_nat_espesor'];
    const CODIGO = 'PLA36{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_pla_lado_a:entero1}{custitem_sads_nat_pla_lado_b:entero2}';
    const TEXTOS = Object.freeze({ custitem_sads_nat_espesor: { codigo: '050', texto: "1/2''" } });

    test.each([[7, '7'], [1, '1'], [9, '9']])('entero1 de %p → %p', (numero, esperado) => {
        expect(patron.formatearValor(numero, 'entero1')).toBe(esperado);
    });

    test.each([0, 10, 6.5, -1])('entero1 de %p no cabe', (numero) => {
        expect(patron.formatearValor(numero, 'entero1')).toBeNull();
    });

    test.each([[7, '07'], [1, '01'], [20, '20'], [99, '99']])('entero2 de %p → %p', (numero, esperado) => {
        expect(patron.formatearValor(numero, 'entero2')).toBe(esperado);
    });

    test.each([0, 100, 6.5, -7])('entero2 de %p no cabe', (numero) => {
        expect(patron.formatearValor(numero, 'entero2')).toBeNull();
    });

    test('placa 1/2 x 7 x 7 termina en 707 y 6 x 20 en 620', () => {
        const valores = { custitem_sads_nat_espesor: 9, custitem_sads_nat_pla_lado_a: 7, custitem_sads_nat_pla_lado_b: 7 };
        expect(patron.aplicar({ patron: CODIGO, valores, textos: TEXTOS })).toBe('PLA36050707');
        expect(patron.aplicar({
            patron: CODIGO, valores: Object.assign({}, valores, { custitem_sads_nat_pla_lado_a: 6, custitem_sads_nat_pla_lado_b: 20 }), textos: TEXTOS
        })).toBe('PLA36050620');
    });

    test('el patrón con entero1 y entero2 es válido en los lados y no en el espesor', () => {
        expect(patron.validar({ patron: CODIGO, idsPermitidos: IDS, idsCatalogo: CATALOGO })).toEqual({ valido: true, errores: [] });
        expect(patron.validar({ patron: '{custitem_sads_nat_espesor:entero2}', idsPermitidos: IDS, idsCatalogo: CATALOGO }).errores)
            .toEqual(['El marcador {custitem_sads_nat_espesor} es un catálogo y requiere el formato codigo o texto.']);
    });

    test('validarFormatos reporta lados fuera de rango con su etiqueta', () => {
        const resultado = patron.validarFormatos({
            patron: CODIGO,
            valores: { custitem_sads_nat_espesor: 9, custitem_sads_nat_pla_lado_a: 10, custitem_sads_nat_pla_lado_b: 100 },
            etiquetas: { custitem_sads_nat_pla_lado_a: 'Lado A', custitem_sads_nat_pla_lado_b: 'Lado B' }
        });
        expect(resultado.errores).toEqual(['Lado A: capture un número entero de 1 a 9.', 'Lado B: capture un número entero de 1 a 99.']);
    });
});

describe('formato decimal2 y patrones de PTR cuadrado (D-20)', () => {
    const IDS = ['custitem_sads_nat_ptr_lado', 'custitem_sads_nat_ptr_largo', 'custitem_sads_nat_espesor'];
    const CODIGO = 'PTRC{custitem_sads_nat_ptr_lado:centesimas3}{custitem_sads_nat_espesor:codigo}';
    const NOMBRE = 'PTR {custitem_sads_nat_ptr_lado:fraccion16}" x {custitem_sads_nat_ptr_lado:fraccion16}" '
        + '{custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m';
    const NOMBRE_MP = 'PTR Media Pieza {custitem_sads_nat_ptr_lado:fraccion16}" x {custitem_sads_nat_ptr_lado:fraccion16}" '
        + '{custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m';
    const ptr = (lado, largo, codigo, texto) => ({
        valores: { custitem_sads_nat_ptr_lado: lado, custitem_sads_nat_ptr_largo: largo, custitem_sads_nat_espesor: 1 },
        textos: { custitem_sads_nat_espesor: { codigo, texto } }
    });

    test.each([[6, '6.00'], [6.1, '6.10'], [3, '3.00'], [0.5, '0.50'], [12.25, '12.25']])('decimal2 de %p → %p', (numero, esperado) => {
        expect(patron.formatearValor(numero, 'decimal2')).toBe(esperado);
    });

    test.each([0, -1, 6.125, 0.001])('decimal2 de %p no cabe', (numero) => {
        expect(patron.formatearValor(numero, 'decimal2')).toBeNull();
    });

    test.each([
        [1, 6, 'C14', 'Cal.14', 'PTRC100C14', 'PTR 1" x 1" Cal.14 a 6.00m'],
        [1.25, 6, 'C12', 'Cal.12', 'PTRC125C12', 'PTR 1 1/4" x 1 1/4" Cal.12 a 6.00m'],
        [3, 6.1, 'E25', "1/4''", 'PTRC300E25', "PTR 3\" x 3\" 1/4'' a 6.10m"],
        [3, 6.1, 'E18', "3/16''", 'PTRC300E18', "PTR 3\" x 3\" 3/16'' a 6.10m"],
        [4, 6, 'C09', 'Cal.09', 'PTRC400C09', 'PTR 4" x 4" Cal.09 a 6.00m']
    ])('PTR lado %p, largo %p, %p → %p / %p', (lado, largo, codigo, texto, codigoEsperado, nombreEsperado) => {
        const datos = ptr(lado, largo, codigo, texto);
        expect(patron.aplicar(Object.assign({ patron: CODIGO }, datos))).toBe(codigoEsperado);
        expect(patron.aplicar(Object.assign({ patron: NOMBRE }, datos))).toBe(nombreEsperado);
    });

    test('media pieza: MPPTRC100C14 / PTR Media Pieza 1" x 1" Cal.14 a 3.00m', () => {
        const datos = ptr(1, 3, 'C14', 'Cal.14');
        expect(patron.aplicar(Object.assign({ patron: `MP${CODIGO}` }, datos))).toBe('MPPTRC100C14');
        expect(patron.aplicar(Object.assign({ patron: NOMBRE_MP }, datos))).toBe('PTR Media Pieza 1" x 1" Cal.14 a 3.00m');
    });

    test('los patrones de PTR son válidos con el espesor como catálogo', () => {
        const catalogo = ['custitem_sads_nat_espesor'];
        expect(patron.validar({ patron: CODIGO, idsPermitidos: IDS, idsCatalogo: catalogo }).valido).toBe(true);
        expect(patron.validar({ patron: NOMBRE, idsPermitidos: IDS, idsCatalogo: catalogo }).valido).toBe(true);
    });

    test('validarFormatos rechaza un largo con más de 2 decimales', () => {
        expect(patron.validarFormatos({
            patron: NOMBRE,
            valores: { custitem_sads_nat_ptr_lado: 1, custitem_sads_nat_ptr_largo: 6.125, custitem_sads_nat_espesor: 1 },
            etiquetas: { custitem_sads_nat_ptr_largo: 'Largo' }
        }).errores).toEqual(['Largo: capture un número mayor que 0 con máximo 2 decimales.']);
    });
});
