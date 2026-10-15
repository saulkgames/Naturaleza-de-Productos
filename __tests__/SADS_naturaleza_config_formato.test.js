const fs = require('fs');
const path = require('path');
const formato = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_config_formato');

const { ERRORES } = formato;

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain',
    'SADS_naturaleza_config_formato.js'
);

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba que la función lanzara un error.');
};

const esperarConfiguracionInvalida = (funcion) => {
    const error = capturarError(funcion);
    expect(error).toBeInstanceOf(Error);
    expect(formato.esErrorDeDominio(error)).toBe(true);
    expect(error.name).toBe(ERRORES.CONFIGURACION_INVALIDA);
    expect(typeof error.message).toBe('string');
    expect(error.message.trim()).not.toBe('');
    return error;
};

// Réplica de la lectura de SADS_CS_item_dynamic_mandatory.js y SADS_UE_item_dynamic_mandatory.js
// (texto no vacío, JSON.parse, Array.isArray; el CS además exige al menos un elemento) más el contrato
// "arreglo de cadenas": cada elemento es una cadena que conserva contenido tras el trim() que aplica el UE.
const aceptadoPorCsUe = (texto) => {
    if (!texto) return false;
    let valor;
    try {
        valor = JSON.parse(texto);
    } catch (error) {
        return false;
    }
    return Array.isArray(valor)
        && valor.length > 0
        && valor.every((fieldId) => typeof fieldId === 'string' && String(fieldId).trim() !== '');
};

describe('ERRORES', () => {
    test('está congelado y contiene los tres errores de dominio con valor igual a su nombre', () => {
        expect(Object.isFrozen(ERRORES)).toBe(true);
        expect(ERRORES).toEqual({
            CONFIGURACION_INVALIDA: 'CONFIGURACION_INVALIDA',
            TIPO_ARTICULO_DESCONOCIDO: 'TIPO_ARTICULO_DESCONOCIDO',
            NATURALEZA_NO_DISPONIBLE: 'NATURALEZA_NO_DISPONIBLE'
        });
    });
});

describe('crearErrorDeDominio y esErrorDeDominio', () => {
    test('crea un Error con name, message y marca de dominio', () => {
        const error = formato.crearErrorDeDominio(ERRORES.TIPO_ARTICULO_DESCONOCIDO, 'Mensaje de prueba.');
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('TIPO_ARTICULO_DESCONOCIDO');
        expect(error.message).toBe('Mensaje de prueba.');
        expect(error.esErrorDeDominio).toBe(true);
        expect(formato.esErrorDeDominio(error)).toBe(true);
    });

    test('cada llamada crea una instancia nueva', () => {
        const primero = formato.crearErrorDeDominio(ERRORES.CONFIGURACION_INVALIDA, 'Uno.');
        const segundo = formato.crearErrorDeDominio(ERRORES.CONFIGURACION_INVALIDA, 'Uno.');
        expect(primero).not.toBe(segundo);
    });

    test('esErrorDeDominio es true para un objeto con la marca exacta', () => {
        expect(formato.esErrorDeDominio({ esErrorDeDominio: true })).toBe(true);
    });

    test.each([
        ['un Error nativo', new Error('x')],
        ['un TypeError', new TypeError('x')],
        ['un Error con name de dominio pero sin marca', Object.assign(new Error('x'), { name: 'CONFIGURACION_INVALIDA' })],
        ['null', null],
        ['undefined', undefined],
        ['una cadena', 'CONFIGURACION_INVALIDA'],
        ['un número', 1],
        ['un objeto sin marca', {}],
        ['una marca de texto', { esErrorDeDominio: 'true' }],
        ['una marca numérica', { esErrorDeDominio: 1 }],
        ['una marca falsa', { esErrorDeDominio: false }]
    ])('esErrorDeDominio es false para %s', (descripcion, valor) => {
        expect(formato.esErrorDeDominio(valor)).toBe(false);
    });

    test('esErrorDeDominio no lanza aunque leer la marca falle', () => {
        const conLecturaFallida = Object.defineProperty({}, 'esErrorDeDominio', {
            get: () => {
                throw new Error('lectura');
            }
        });
        const proxyConLecturaFallida = new Proxy({}, {
            get: () => {
                throw new Error('lectura');
            }
        });
        expect(formato.esErrorDeDominio(conLecturaFallida)).toBe(false);
        expect(formato.esErrorDeDominio(proxyConLecturaFallida)).toBe(false);
    });
});

describe('serializarConfiguracion', () => {
    test('P-01: elimina duplicados y ordena ascendente por ID', () => {
        expect(formato.serializarConfiguracion(['upccode', 'custitem_b', 'custitem_b'])).toBe('["custitem_b","upccode"]');
    });

    test('recorta espacios, ignora null y undefined y descarta vacíos antes de eliminar duplicados', () => {
        const ids = [' custitem_a ', null, 'custitem_a', undefined, '', '   ', '\tupccode\n'];
        expect(formato.serializarConfiguracion(ids)).toBe('["custitem_a","upccode"]');
    });

    test('ordena por código de carácter, no por idioma, y conserva mayúsculas y minúsculas', () => {
        const ids = ['custitem_b', 'custitem_á', 'custitem_a2', 'custitem_B', 'custitem_a10'];
        expect(formato.serializarConfiguracion(ids))
            .toBe('["custitem_B","custitem_a10","custitem_a2","custitem_b","custitem_á"]');
    });

    test('distingue IDs que solo difieren en mayúsculas', () => {
        expect(formato.serializarConfiguracion(['custitem_a', 'CUSTITEM_A'])).toBe('["CUSTITEM_A","custitem_a"]');
    });

    test('convierte con String() los elementos que no son cadena', () => {
        expect(formato.serializarConfiguracion([10, 'custitem_a'])).toBe('["10","custitem_a"]');
    });

    test('el texto generado no tiene espacios y lo acepta esConfiguracionValida', () => {
        const texto = formato.serializarConfiguracion(['upccode', 'custitem_a', 'custitem_c']);
        expect(texto).not.toMatch(/\s/);
        expect(formato.esConfiguracionValida(texto)).toBe(true);
    });

    test.each([
        ['un arreglo vacío', []],
        ['solo espacios', ['  ']],
        ['solo null, undefined y vacíos', [null, undefined, '', ' ']]
    ])('P-03: lanza CONFIGURACION_INVALIDA con %s', (descripcion, ids) => {
        esperarConfiguracionInvalida(() => formato.serializarConfiguracion(ids));
    });

    test.each([
        ['una cadena', 'custitem_a'],
        ['un texto JSON', '["custitem_a"]'],
        ['un objeto', {}],
        ['un objeto parecido a arreglo', { length: 1, 0: 'custitem_a' }],
        ['un número', 5],
        ['null', null],
        ['undefined', undefined]
    ])('lanza CONFIGURACION_INVALIDA si la entrada no es arreglo: %s', (descripcion, valor) => {
        esperarConfiguracionInvalida(() => formato.serializarConfiguracion(valor));
    });

    test('no muta el arreglo recibido', () => {
        const ids = ['upccode', ' custitem_b ', 'custitem_b', null];
        const copia = ids.slice();
        Object.freeze(ids);
        expect(formato.serializarConfiguracion(ids)).toBe('["custitem_b","upccode"]');
        expect(ids).toStrictEqual(copia);
    });

    test('lanza CONFIGURACION_INVALIDA si el texto generado no pasa esConfiguracionValida', () => {
        const espia = jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => '[1]');
        try {
            esperarConfiguracionInvalida(() => formato.serializarConfiguracion(['custitem_a']));
        } finally {
            espia.mockRestore();
        }
    });
});

describe('parsearConfiguracion', () => {
    test('devuelve el arreglo parseado sin ordenar, recortar, deduplicar ni cambiar mayúsculas', () => {
        expect(formato.parsearConfiguracion('["custitem_b","CUSTITEM_A"," upccode ","custitem_b"]'))
            .toEqual(['custitem_b', 'CUSTITEM_A', ' upccode ', 'custitem_b']);
    });

    test('devuelve un arreglo nuevo en cada llamada', () => {
        const texto = '["custitem_a"]';
        const primero = formato.parsearConfiguracion(texto);
        primero.push('custitem_agregado');
        expect(formato.parsearConfiguracion(texto)).toEqual(['custitem_a']);
    });

    test.each(['[a,b]', '{}', '[1]', '', '[]'])('P-02: lanza CONFIGURACION_INVALIDA con %j', (texto) => {
        esperarConfiguracionInvalida(() => formato.parsearConfiguracion(texto));
    });

    test.each([
        '["custitem_a",1]',
        '[null]',
        '[""]',
        '["   "]',
        '[["custitem_a"]]',
        '[{"id":"custitem_a"}]',
        '"custitem_a"',
        'null',
        'true',
        '1',
        "['custitem_a']",
        '["custitem_a",]',
        '[',
        '   '
    ])('lanza CONFIGURACION_INVALIDA con %j', (texto) => {
        esperarConfiguracionInvalida(() => formato.parsearConfiguracion(texto));
    });

    test.each([
        ['null', null],
        ['undefined', undefined],
        ['un número', 1],
        ['un arreglo', ['custitem_a']],
        ['un objeto', {}]
    ])('lanza CONFIGURACION_INVALIDA si la entrada no es cadena: %s', (descripcion, valor) => {
        esperarConfiguracionInvalida(() => formato.parsearConfiguracion(valor));
    });

    test('el mensaje no expone el error crudo de JSON.parse', () => {
        const error = esperarConfiguracionInvalida(() => formato.parsearConfiguracion('[a,b]'));
        expect(error.message).not.toMatch(/Unexpected|position|SyntaxError/);
    });
});

describe('esConfiguracionValida', () => {
    test.each(['[a,b]', '{}', '[1]', '', '[]'])('P-02: es false con %j', (texto) => {
        expect(formato.esConfiguracionValida(texto)).toBe(false);
    });

    test.each(['["custitem_a"]', '["custitem_b","upccode"]'])('es true con %j', (texto) => {
        expect(formato.esConfiguracionValida(texto)).toBe(true);
    });

    test.each([
        [null],
        [undefined],
        [1],
        [true],
        [{}],
        [['custitem_a']],
        [Symbol('custitem_a')],
        [() => '["custitem_a"]']
    ])('es false y no lanza con una entrada que no es cadena (caso %#)', (valor) => {
        expect(() => formato.esConfiguracionValida(valor)).not.toThrow();
        expect(formato.esConfiguracionValida(valor)).toBe(false);
    });
});

describe('compatibilidad con la lectura de SADS_CS_item_dynamic_mandatory y SADS_UE_item_dynamic_mandatory', () => {
    test.each([
        ['["custitem_a"]', true],
        ['["custitem_b","upccode"]', true],
        ['[ "custitem_a" , "upccode" ]', true],
        [' ["custitem_a"]\n', true],
        ['["CUSTITEM_A"]', true],
        ['[" custitem_a "]', true],
        ['["custitem_b","custitem_a","custitem_b"]', true],
        ['', false],
        ['   ', false],
        ['[a,b]', false],
        ["['custitem_a']", false],
        ['["custitem_a",]', false],
        ['[', false],
        ['undefined', false],
        ['{}', false],
        ['{"0":"custitem_a"}', false],
        ['"custitem_a"', false],
        ['1', false],
        ['true', false],
        ['null', false],
        ['[]', false],
        ['[1]', false],
        ['[null]', false],
        ['[true]', false],
        ['[{}]', false],
        ['[["custitem_a"]]', false],
        ['["custitem_a",1]', false],
        ['[""]', false],
        ['["  "]', false]
    ])('%j: esConfiguracionValida y la lectura del CS/UE coinciden (%s)', (texto, esperado) => {
        expect(aceptadoPorCsUe(texto)).toBe(esperado);
        expect(formato.esConfiguracionValida(texto)).toBe(esperado);
    });

    test.each([
        [['upccode', 'custitem_b', 'custitem_b']],
        [[' custitem_a ', 'CUSTITEM_Z', 'custitem_m']],
        [['custitem_unico']]
    ])('el texto serializado de %j se lee igual en el CS (sin trim) y en el UE (con trim)', (ids) => {
        const texto = formato.serializarConfiguracion(ids);
        const leidoPorCs = JSON.parse(texto);
        const leidoPorUe = JSON.parse(texto).map((fieldId) => String(fieldId).trim());
        expect(aceptadoPorCsUe(texto)).toBe(true);
        expect(leidoPorCs).toEqual(leidoPorUe);
        expect(formato.parsearConfiguracion(texto)).toEqual(leidoPorCs);
    });
});

describe('regla de dependencia', () => {
    test('el define no declara dependencias y el archivo no referencia módulos N/', () => {
        const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        expect(definicion).not.toBeNull();
        expect(definicion[1].trim()).toBe('');
        expect(fuente).not.toMatch(/['"`]N\//);
    });
});
