const fs = require('fs');
const path = require('path');

jest.mock('N/search', () => {
    const stub = jest.requireActual('N/search');
    return { create: jest.fn(), Type: stub.Type, Operator: stub.Operator };
});
jest.mock('N/error', () => ({ create: jest.fn() }));
jest.mock('N/log', () => ({ audit: jest.fn(), debug: jest.fn(), error: jest.fn(), emergency: jest.fn() }));

const search = require('N/search');
const error = require('N/error');
const log = require('N/log');
const userEvent = require('SuiteScripts/SADS_Naturaleza_Productos/SADS_UE_naturaleza_config');

const RUTA_UE = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'SADS_UE_naturaleza_config.js'
);

const TIPOS_EVENTO = Object.freeze({
    CREATE: 'create',
    EDIT: 'edit',
    XEDIT: 'xedit',
    DELETE: 'delete',
    COPY: 'copy',
    VIEW: 'view'
});

const JSON_PLACAS = '["custitem_pl_ancho","custitem_pl_espesor","custitem_pl_largo"]';
const PATRON_CODIGO = 'PL-{custitem_pl_espesor}-{custitem_pl_largo}X{custitem_pl_ancho}';
const PATRON_NOMBRE = 'PLACA A36 {custitem_pl_espesor} IN {custitem_pl_largo} X {custitem_pl_ancho} FT';
const ID_PLANTILLA = 901;

const CONFIGURACION_VALIDA = Object.freeze({
    custrecord_sads_naturaleza_config: JSON_PLACAS,
    custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
    custrecord_sads_naturaleza_patron_nom: PATRON_NOMBRE,
    custrecord_sads_naturaleza_patron_cod: PATRON_CODIGO
});

const crearRegistroFalso = (valores, camposEnviados) => ({
    getValue: jest.fn((opciones) => (
        Object.prototype.hasOwnProperty.call(valores, opciones.fieldId) ? valores[opciones.fieldId] : ''
    )),
    getFields: jest.fn(() => (camposEnviados === undefined ? Object.keys(valores) : camposEnviados.slice()))
});

// RN6-02: si la prueba no define Parámetros para Valor de Unidades, se usa el primer ID del JSON.
const conValorDeUnidades = (valores) => {
    if (valores === null || Object.prototype.hasOwnProperty.call(valores, 'custrecord_sads_naturaleza_valor_unid')) return valores;
    let ids = null;
    try {
        ids = JSON.parse(valores.custrecord_sads_naturaleza_config);
    } catch (errorDeJson) {
        ids = null;
    }
    if (!Array.isArray(ids) || ids.length === 0 || typeof ids[0] !== 'string') return valores;
    return Object.assign({ custrecord_sads_naturaleza_valor_unid: JSON.stringify([ids[0]]) }, valores);
};

const crearContexto = ({ tipo = TIPOS_EVENTO.CREATE, nuevos = CONFIGURACION_VALIDA, anteriores = null, enviados } = {}) => ({
    type: tipo,
    UserEventType: TIPOS_EVENTO,
    newRecord: crearRegistroFalso(conValorDeUnidades(nuevos), enviados),
    oldRecord: anteriores === null ? null : crearRegistroFalso(conValorDeUnidades(anteriores))
});

const prepararArticulos = (existentes = { [String(ID_PLANTILLA)]: 'inventoryitem' }) => {
    search.create.mockImplementation((definicion) => {
        const id = definicion.filters[0][2];
        const tipo = existentes[id];
        return { run: () => ({ getRange: () => (tipo === undefined ? [] : [{ id, recordType: tipo }]) }) };
    });
    error.create.mockImplementation((opciones) => {
        const creado = new Error(opciones.message);
        creado.name = opciones.name;
        creado.notifyOff = opciones.notifyOff;
        return creado;
    });
};

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (capturado) {
        return capturado;
    }
    throw new Error('Se esperaba un error');
};

const esperarRechazo = (contexto) => {
    const rechazo = capturarError(() => userEvent.beforeSubmit(contexto));
    expect(rechazo.name).toBe('CONFIGURACION_NATURALEZA_INVALIDA');
    expect(rechazo.message).toMatch(/^La configuración no es válida: /);
    expect(error.create).toHaveBeenCalledTimes(1);
    expect(error.create.mock.calls[0][0].notifyOff).toBe(true);
    expect(log.error).not.toHaveBeenCalled();
    return rechazo.message.replace(/^La configuración no es válida: /, '').split('; ');
};

const configuracionCon = (ajuste) => Object.assign({}, CONFIGURACION_VALIDA, ajuste);

beforeEach(() => {
    jest.resetAllMocks();
    prepararArticulos();
});

describe('estructura del módulo', () => {
    const fuente = fs.readFileSync(RUTA_UE, 'utf8');

    test('exporta solo beforeSubmit', () => {
        expect(Object.keys(userEvent)).toEqual(['beforeSubmit']);
    });

    test('declara el encabezado de UserEventScript 2.1 con alcance SameAccount', () => {
        expect(fuente).toMatch(/@NApiVersion 2\.1\b/);
        expect(fuente).toMatch(/@NScriptType UserEventScript\b/);
        expect(fuente).toMatch(/@NModuleScope SameAccount\b/);
    });

    test('depende solo de N/error, N/log, el dominio y el adaptador', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        const dependencias = definicion[1]
            .split(',')
            .map((dependencia) => dependencia.trim().replace(/^['"]|['"]$/g, ''))
            .filter((dependencia) => dependencia !== '');
        expect(dependencias).toEqual([
            'N/error',
            'N/log',
            './domain/SADS_naturaleza_config_formato',
            './domain/SADS_naturaleza_patron',
            './domain/SADS_naturaleza_parametros',
            './domain/SADS_naturaleza_mapa_medidas',
            './domain/SADS_naturaleza_corte',
            './infra/SADS_naturaleza_articulo_ns'
        ]);
    });

    test('no usa encadenamiento opcional, fusión de nulos ni console', () => {
        expect(fuente).not.toMatch(/\?\./);
        expect(fuente).not.toMatch(/\?\?/);
        expect(fuente).not.toMatch(/\bconsole\./);
    });
});

describe('tipos de evento', () => {
    test.each([TIPOS_EVENTO.CREATE, TIPOS_EVENTO.EDIT, TIPOS_EVENTO.XEDIT])('valida en %s', (tipo) => {
        const contexto = crearContexto({
            tipo,
            nuevos: configuracionCon({ custrecord_sads_naturaleza_config: 'no es json' }),
            anteriores: CONFIGURACION_VALIDA
        });
        esperarRechazo(contexto);
    });

    test.each([TIPOS_EVENTO.DELETE, TIPOS_EVENTO.COPY, TIPOS_EVENTO.VIEW])('no hace nada en %s', (tipo) => {
        const contexto = crearContexto({ tipo, nuevos: configuracionCon({ custrecord_sads_naturaleza_config: 'no es json' }) });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
        expect(contexto.newRecord.getValue).not.toHaveBeenCalled();
        expect(search.create).not.toHaveBeenCalled();
    });
});

describe('P-17: reglas RN-12 a RN-16', () => {
    test('configuración válida con plantilla: guarda sin error', () => {
        expect(() => userEvent.beforeSubmit(crearContexto())).not.toThrow();
        expect(error.create).not.toHaveBeenCalled();
        expect(search.create).toHaveBeenCalledTimes(1);
        expect(search.create.mock.calls[0][0].filters).toEqual([['internalid', search.Operator.ANYOF, '901']]);
    });

    test('configuración válida sin plantilla ni patrones: guarda sin buscar artículos', () => {
        const contexto = crearContexto({ nuevos: { custrecord_sads_naturaleza_config: JSON_PLACAS } });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
        expect(search.create).not.toHaveBeenCalled();
    });

    test('patrones sin plantilla se permiten sin validar', () => {
        const contexto = crearContexto({ nuevos: {
            custrecord_sads_naturaleza_config: JSON_PLACAS,
            custrecord_sads_naturaleza_patron_cod: '{malo',
            custrecord_sads_naturaleza_patron_nom: '{custitem_otro}'
        } });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
    });

    test.each([
        ['texto no JSON', 'no es json', 'La configuración no tiene formato JSON válido.'],
        ['arreglo vacío', '[]', 'La configuración debe incluir al menos un ID de campo.'],
        ['objeto', '{"a":1}', 'La configuración debe ser un arreglo JSON.'],
        ['campo vacío', '', 'La configuración no tiene formato JSON válido.']
    ])('RN-12: JSON inválido (%s) rechaza con el mensaje del contrato y no evalúa más reglas', (descripcion, json, mensaje) => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_config: json, custrecord_sads_naturaleza_patron_cod: '' })
        }));
        expect(errores).toEqual([mensaje]);
        expect(search.create).not.toHaveBeenCalled();
    });

    test('RN-13: un ID inseguro se rechaza por su posición', () => {
        const errores = esperarRechazo(crearContexto({
            nuevos: { custrecord_sads_naturaleza_config: '["custitem_a","CUSTITEM_B"]' }
        }));
        expect(errores).toEqual(['El ID de campo en la posición 2 solo puede contener minúsculas, dígitos y guion bajo.']);
    });

    test('RN-14: plantilla sin patrones se rechaza por cada patrón', () => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_patron_nom: '', custrecord_sads_naturaleza_patron_cod: '   ' })
        }));
        expect(errores).toEqual([
            'Patrón de código: es obligatorio cuando hay artículo plantilla.',
            'Patrón de nombre: es obligatorio cuando hay artículo plantilla.'
        ]);
    });

    test('RN-15: un marcador fuera del JSON se rechaza', () => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_patron_cod: 'PL-{custitem_otro}' })
        }));
        expect(errores).toEqual(['Patrón de código: El marcador {custitem_otro} no es un ID de la configuración.']);
    });

    test('RN-15: llaves sin cerrar o vacías se rechazan', () => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionCon({
                custrecord_sads_naturaleza_patron_cod: 'PL-{custitem_pl_largo',
                custrecord_sads_naturaleza_patron_nom: 'PLACA {}'
            })
        }));
        expect(errores).toEqual([
            'Patrón de código: El patrón tiene una llave { sin cerrar.',
            'Patrón de nombre: El patrón tiene un marcador vacío {}.'
        ]);
    });

    test.each(['abc', '0', '-5', '1.5', '01'])('RN-16: plantilla no entera %p se rechaza sin citarla ni buscarla', (plantilla) => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_plantilla: plantilla })
        }));
        expect(errores).toEqual(['El artículo plantilla debe ser un ID interno numérico.']);
        expect(search.create).not.toHaveBeenCalled();
    });

    test('RN-16: plantilla inexistente se rechaza citando su ID', () => {
        prepararArticulos({});
        const errores = esperarRechazo(crearContexto());
        expect(errores).toEqual(['El artículo plantilla 901 no existe.']);
    });

    test('acumula los errores de RN-13 a RN-16 en un solo mensaje', () => {
        prepararArticulos({});
        const errores = esperarRechazo(crearContexto({
            nuevos: {
                custrecord_sads_naturaleza_config: '["custitem_a","custitem-b"]',
                custrecord_sads_naturaleza_plantilla: '901',
                custrecord_sads_naturaleza_patron_cod: '{custitem_x}',
                custrecord_sads_naturaleza_patron_nom: ''
            }
        }));
        expect(errores).toEqual([
            'El ID de campo en la posición 2 solo puede contener minúsculas, dígitos y guion bajo.',
            'El artículo plantilla 901 no existe.',
            'Patrón de código: El marcador {custitem_x} no es un ID de la configuración.',
            'Patrón de nombre: es obligatorio cuando hay artículo plantilla.'
        ]);
    });
});

describe('RN-17: formatos de marcador', () => {
    test('los patrones TA36 con formatos se aceptan', () => {
        const contexto = crearContexto({ nuevos: configuracionCon({
            custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_pl_espesor:centesimas3}{custitem_pl_ancho}{custitem_pl_largo}',
            custrecord_sads_naturaleza_patron_nom: "Placa Acero TA36 {custitem_pl_espesor:fraccion16}'' {custitem_pl_ancho}'x{custitem_pl_largo}'"
        }) });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
    });

    test('un formato desconocido se rechaza citando la lista de formatos', () => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_pl_espesor:centesimas}' })
        }));
        expect(errores).toEqual([
            'Patrón de código: El formato centesimas del marcador {custitem_pl_espesor} no existe. Formatos válidos: centesimas3, fraccion16, entero1, entero2, decimal2, codigo, texto.'
        ]);
    });

    test('un marcador con formato vacío se rechaza', () => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_patron_nom: 'Placa {custitem_pl_espesor:}' })
        }));
        expect(errores).toEqual(['Patrón de nombre: El patrón tiene un marcador con formato vacío después de los dos puntos.']);
    });
});

describe('P-18: XEDIT', () => {
    test('un XEDIT que solo cambia el patrón valida contra el JSON y la plantilla de oldRecord', () => {
        const contexto = crearContexto({
            tipo: TIPOS_EVENTO.XEDIT,
            nuevos: { custrecord_sads_naturaleza_patron_cod: 'PL-{custitem_pl_largo}' },
            anteriores: CONFIGURACION_VALIDA
        });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
        expect(contexto.newRecord.getValue).toHaveBeenCalledTimes(1);
        expect(contexto.oldRecord.getValue).toHaveBeenCalledWith({ fieldId: 'custrecord_sads_naturaleza_config' });
        expect(contexto.oldRecord.getValue).toHaveBeenCalledWith({ fieldId: 'custrecord_sads_naturaleza_plantilla' });
    });

    test('un XEDIT con un marcador ausente del JSON guardado se rechaza', () => {
        const errores = esperarRechazo(crearContexto({
            tipo: TIPOS_EVENTO.XEDIT,
            nuevos: { custrecord_sads_naturaleza_patron_cod: 'PL-{custitem_nuevo}' },
            anteriores: CONFIGURACION_VALIDA
        }));
        expect(errores).toEqual(['Patrón de código: El marcador {custitem_nuevo} no es un ID de la configuración.']);
    });

    test('un XEDIT que cambia el JSON valida los patrones guardados contra el JSON nuevo', () => {
        const errores = esperarRechazo(crearContexto({
            tipo: TIPOS_EVENTO.XEDIT,
            nuevos: { custrecord_sads_naturaleza_config: '["custitem_pl_ancho","custitem_pl_largo"]' },
            anteriores: CONFIGURACION_VALIDA
        }));
        expect(errores).toEqual([
            'Patrón de código: El marcador {custitem_pl_espesor} no es un ID de la configuración.',
            'Patrón de nombre: El marcador {custitem_pl_espesor} no es un ID de la configuración.'
        ]);
    });

    test('un XEDIT que vacía la plantilla deja de exigir patrones', () => {
        const contexto = crearContexto({
            tipo: TIPOS_EVENTO.XEDIT,
            nuevos: { custrecord_sads_naturaleza_plantilla: '' },
            anteriores: configuracionCon({ custrecord_sads_naturaleza_patron_cod: '{malo' })
        });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
    });

    test('en EDIT se lee todo de newRecord', () => {
        const contexto = crearContexto({ tipo: TIPOS_EVENTO.EDIT, anteriores: configuracionCon({ custrecord_sads_naturaleza_config: '[]' }) });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
        expect(contexto.oldRecord.getValue).not.toHaveBeenCalled();
    });
});

describe('errores inesperados', () => {
    test('un error de la búsqueda se registra con log.error y se relanza', () => {
        const original = new Error('SSS_SEARCH_ERROR');
        search.create.mockImplementation(() => {
            throw original;
        });
        const capturado = capturarError(() => userEvent.beforeSubmit(crearContexto()));
        expect(capturado).toBe(original);
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.error.mock.calls[0][0].details).toContain('SSS_SEARCH_ERROR');
        expect(error.create).not.toHaveBeenCalled();
    });

    test('un error al leer el registro se registra y se relanza', () => {
        const contexto = crearContexto();
        contexto.newRecord.getValue.mockImplementation(() => {
            throw new Error('lectura');
        });
        expect(() => userEvent.beforeSubmit(contexto)).toThrow('lectura');
        expect(log.error).toHaveBeenCalledTimes(1);
    });
});

describe('iteración B: tipo de espesor y formatos de catálogo (RN3-08, RN3-09)', () => {
    const JSON_B = '["custitem_sads_nat_pla_lado_a","custitem_sads_nat_pla_lado_b","custitem_sads_nat_espesor"]';
    const CONFIGURACION_B = Object.freeze({
        custrecord_sads_naturaleza_config: JSON_B,
        custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
        custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_pla_lado_a}{custitem_sads_nat_pla_lado_b}',
        custrecord_sads_naturaleza_patron_nom: "Placa Acero TA36 {custitem_sads_nat_espesor:texto} {custitem_sads_nat_pla_lado_a}'x{custitem_sads_nat_pla_lado_b}'",
        custrecord_sads_naturaleza_tipo_esp: '1'
    });
    const configuracionB = (ajuste) => Object.assign({}, CONFIGURACION_B, ajuste);

    test('la configuración de placas con espesor por catálogo se acepta', () => {
        expect(() => userEvent.beforeSubmit(crearContexto({ nuevos: CONFIGURACION_B }))).not.toThrow();
    });

    test('P3-13: JSON con espesor sin tipo de espesor se rechaza, con o sin plantilla', () => {
        expect(esperarRechazo(crearContexto({ nuevos: configuracionB({ custrecord_sads_naturaleza_tipo_esp: '' }) })))
            .toEqual(['La configuración usa espesor y requiere Tipo de Espesor.']);
        jest.clearAllMocks();
        prepararArticulos();
        expect(esperarRechazo(crearContexto({ nuevos: { custrecord_sads_naturaleza_config: JSON_B } })))
            .toEqual(['La configuración usa espesor y requiere Tipo de Espesor.']);
    });

    test('un tipo de espesor sin campo de espesor en el JSON se acepta', () => {
        expect(() => userEvent.beforeSubmit(crearContexto({ nuevos: configuracionCon({ custrecord_sads_naturaleza_tipo_esp: '1' }) })))
            .not.toThrow();
    });

    test('P3-16: el espesor sin formato y codigo en otro campo se rechazan', () => {
        const errores = esperarRechazo(crearContexto({
            nuevos: configuracionB({
                custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_sads_nat_espesor}',
                custrecord_sads_naturaleza_patron_nom: 'Placa {custitem_sads_nat_pla_lado_a:texto}'
            })
        }));
        expect(errores).toEqual([
            'Patrón de código: El marcador {custitem_sads_nat_espesor} es un catálogo y requiere el formato codigo o texto.',
            'Patrón de nombre: El formato texto solo aplica al campo de espesor.'
        ]);
    });

    test('XEDIT que solo cambia el tipo de espesor a vacío se rechaza con el JSON guardado', () => {
        const errores = esperarRechazo(crearContexto({
            tipo: TIPOS_EVENTO.XEDIT,
            nuevos: { custrecord_sads_naturaleza_tipo_esp: '' },
            anteriores: CONFIGURACION_B
        }));
        expect(errores).toEqual(['La configuración usa espesor y requiere Tipo de Espesor.']);
    });
});

describe('formatos entero1 y entero2 en la configuración (D-16, D-17)', () => {
    test('el patrón de código con entero1 y entero2 en los lados se acepta', () => {
        const contexto = crearContexto({ nuevos: {
            custrecord_sads_naturaleza_config: '["custitem_sads_nat_pla_lado_a","custitem_sads_nat_pla_lado_b","custitem_sads_nat_espesor"]',
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_pla_lado_a:entero1}{custitem_sads_nat_pla_lado_b:entero2}',
            custrecord_sads_naturaleza_patron_nom: "Placa Acero TA36 {custitem_sads_nat_espesor:texto} {custitem_sads_nat_pla_lado_a}'x{custitem_sads_nat_pla_lado_b}'",
            custrecord_sads_naturaleza_tipo_esp: '1'
        } });
        expect(() => userEvent.beforeSubmit(contexto)).not.toThrow();
    });
});

describe('campo de medida para familias (D-21)', () => {
    test('un campo de medida del JSON se acepta', () => {
        expect(() => userEvent.beforeSubmit(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_campo_med: 'custitem_pl_largo' })
        }))).not.toThrow();
    });

    test('el espesor como campo de medida se rechaza (caso Lámina Negra)', () => {
        expect(esperarRechazo(crearContexto({
            nuevos: configuracionCon({
                custrecord_sads_naturaleza_config: '["custitem_sads_nat_lne_lado_a","custitem_sads_nat_lne_lado_b","custitem_sads_nat_espesor"]',
                custrecord_sads_naturaleza_patron_cod: 'LNE{custitem_sads_nat_lne_lado_a:entero1}{custitem_sads_nat_lne_lado_b:entero2}'
                    + '{custitem_sads_nat_espesor:codigo}',
                custrecord_sads_naturaleza_patron_nom: "Lamina Negra {custitem_sads_nat_lne_lado_a}'x{custitem_sads_nat_lne_lado_b}' "
                    + '{custitem_sads_nat_espesor:texto}',
                custrecord_sads_naturaleza_tipo_esp: '2',
                custrecord_sads_naturaleza_campo_med: 'custitem_sads_nat_espesor'
            })
        }))).toEqual(['El Campo de Medida para Familias debe ser un parámetro numérico, no el espesor: '
            + 'el espesor ya elige la familia por su rango.']);
    });

    test('un campo de medida fuera del JSON se rechaza', () => {
        expect(esperarRechazo(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_campo_med: 'custitem_otro' })
        }))).toEqual(['El Campo de Medida para Familias debe ser uno de los IDs de la configuración.']);
    });
});

describe('mapa de medidas PTRR (RN5-05)', () => {
    const JSON_PTRR = '["custitem_sads_nat_ptr_lado","custitem_sads_nat_ptr_lado_b","custitem_sads_nat_ptr_largo","custitem_sads_nat_espesor"]';
    const PTRR = Object.freeze({
        custrecord_sads_naturaleza_config: JSON_PTRR,
        custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
        custrecord_sads_naturaleza_mapa_med: true,
        custrecord_sads_naturaleza_tipo_esp: '5',
        custrecord_sads_naturaleza_campo_med: 'custitem_sads_nat_ptr_lado',
        custrecord_sads_naturaleza_patron_cod: 'PTRR{mapa:codigo}{custitem_sads_nat_espesor:codigo}',
        custrecord_sads_naturaleza_patron_nom: 'PTR {custitem_sads_nat_ptr_lado:fraccion16}" x {custitem_sads_nat_ptr_lado_b:fraccion16}" '
            + '{custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m'
    });
    const ptrrCon = (ajuste) => Object.assign({}, PTRR, ajuste);

    test('la configuración de PTRR con {mapa:codigo} se acepta (casilla booleana o T)', () => {
        expect(() => userEvent.beforeSubmit(crearContexto({ nuevos: PTRR }))).not.toThrow();
        expect(() => userEvent.beforeSubmit(crearContexto({ nuevos: ptrrCon({ custrecord_sads_naturaleza_mapa_med: 'T' }) })))
            .not.toThrow();
    });

    test('{mapa:codigo} sin la casilla se rechaza como marcador fuera de la configuración', () => {
        expect(esperarRechazo(crearContexto({ nuevos: ptrrCon({ custrecord_sads_naturaleza_mapa_med: false }) })))
            .toEqual([
                'Patrón de código: El marcador {mapa} no es un ID de la configuración.',
                'Patrón de código: El formato codigo solo aplica al campo de espesor.'
            ]);
    });

    test('{mapa} sin formato codigo o texto se rechaza', () => {
        expect(esperarRechazo(crearContexto({
            nuevos: ptrrCon({ custrecord_sads_naturaleza_patron_cod: 'PTRR{mapa}{custitem_sads_nat_espesor:codigo}' })
        }))).toEqual(['Patrón de código: El marcador {mapa} es un catálogo y requiere el formato codigo o texto.']);
    });

    test('con la casilla, el JSON debe incluir los dos lados', () => {
        expect(esperarRechazo(crearContexto({
            nuevos: ptrrCon({
                custrecord_sads_naturaleza_config: '["custitem_sads_nat_ptr_lado","custitem_sads_nat_ptr_largo","custitem_sads_nat_espesor"]',
                custrecord_sads_naturaleza_patron_nom: 'PTR {custitem_sads_nat_ptr_lado:fraccion16}'
            })
        }))).toEqual(['Con el Mapa de Medidas PTRR, el JSON debe incluir custitem_sads_nat_ptr_lado y custitem_sads_nat_ptr_lado_b.']);
    });
});

describe('parámetros para valor de unidades (RN6-02)', () => {
    test('con plantilla son obligatorios y deben ser IDs del JSON', () => {
        expect(esperarRechazo(crearContexto({ nuevos: configuracionCon({ custrecord_sads_naturaleza_valor_unid: '' }) })))
            .toEqual(['Parámetros para Valor de Unidades: capture una lista JSON de IDs de la configuración.']);
        jest.clearAllMocks();
        prepararArticulos();
        expect(esperarRechazo(crearContexto({ nuevos: configuracionCon({ custrecord_sads_naturaleza_valor_unid: '["custitem_otro"]' }) })))
            .toEqual(['Parámetros para Valor de Unidades: custitem_otro no es un ID de la configuración.']);
    });

    test('lados de placa se aceptan', () => {
        expect(() => userEvent.beforeSubmit(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_valor_unid: '["custitem_pl_ancho","custitem_pl_largo"]' })
        }))).not.toThrow();
    });

    test('sin plantilla no se exigen', () => {
        expect(() => userEvent.beforeSubmit(crearContexto({
            nuevos: configuracionCon({ custrecord_sads_naturaleza_plantilla: '', custrecord_sads_naturaleza_valor_unid: '' })
        }))).not.toThrow();
    });
});
