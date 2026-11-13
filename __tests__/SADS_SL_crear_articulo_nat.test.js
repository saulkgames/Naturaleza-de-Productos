const fs = require('fs');
const path = require('path');

jest.mock('N/search', () => {
    const stub = jest.requireActual('N/search');
    return { create: jest.fn(), lookupFields: jest.fn(), Type: stub.Type, Operator: stub.Operator };
});
jest.mock('N/query', () => ({ runSuiteQL: jest.fn() }));
jest.mock('N/record', () => ({ copy: jest.fn() }));
jest.mock('N/ui/serverWidget', () => {
    const stub = jest.requireActual('N/ui/serverWidget');
    return {
        createForm: jest.fn(),
        FieldType: stub.FieldType,
        FieldDisplayType: stub.FieldDisplayType
    };
});
jest.mock('N/ui/message', () => ({ Type: jest.requireActual('N/ui/message').Type }));
jest.mock('N/runtime', () => ({ getCurrentScript: jest.fn() }));
jest.mock('N/url', () => ({ resolveScript: jest.fn(), resolveRecord: jest.fn() }));
jest.mock('N/log', () => ({ audit: jest.fn(), debug: jest.fn(), error: jest.fn(), emergency: jest.fn() }));

const search = require('N/search');
const query = require('N/query');
const record = require('N/record');
const serverWidget = require('N/ui/serverWidget');
const message = require('N/ui/message');
const runtime = require('N/runtime');
const url = require('N/url');
const log = require('N/log');
const suitelet = require('SuiteScripts/SADS_Naturaleza_Productos/SADS_SL_crear_articulo_nat');

const { FieldType, FieldDisplayType } = serverWidget;

const RUTA_SUITELET = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'SADS_SL_crear_articulo_nat.js'
);

const REGISTRO_CONFIGURACION = 'customrecord_sads_naturaleza_productos';
const SCRIPT_ID = 'customscript_sads_sl_crear_articulo_nat';
const DEPLOYMENT_ID = 'customdeploy_sads_sl_crear_articulo_nat';
const URL_SUITELET = '/app/site/hosting/scriptlet.nl?script=201&deploy=1';
const URL_SUITELET_ESCAPADA = '/app/site/hosting/scriptlet.nl?script=201&amp;deploy=1';
const URL_ARTICULO = '/app/common/item/item.nl?id=777&e=F';
const URL_ARTICULO_ESCAPADA = '/app/common/item/item.nl?id=777&amp;e=F';
const ID_PLANTILLA = '901';
const ID_ARTICULO_CREADO = 777;
const ID_DUPLICADO = 950;

const MENSAJES = Object.freeze({
    GENERICO: 'No fue posible completar la operación. Contacte al administrador.',
    SIN_CONFIGURACIONES: 'No hay naturalezas con artículo plantilla configurado.',
    NATURALEZA_INVALIDA: 'La naturaleza seleccionada no es válida o ya no está disponible.',
    PLANTILLA_INEXISTENTE: 'El artículo plantilla de esta naturaleza no existe.',
    CODIGO_LARGO: 'El código generado excede 60 caracteres; revise el patrón de la naturaleza.',
    DUPLICADO: 'Ya existe un artículo con esta naturaleza y estos parámetros.',
    CREADO: 'El artículo se creó correctamente.'
});

const CONFIGURACIONES = [
    { id: 11, nombre: 'Placas A36' },
    { id: 12, nombre: 'Placas inoxidables' }
];

const JSON_PLACAS = '["custitem_pl_ancho","custitem_pl_espesor","custitem_pl_largo"]';
const PATRON_CODIGO = 'PL-{custitem_pl_espesor}-{custitem_pl_largo}X{custitem_pl_ancho}';
const PATRON_NOMBRE = 'PLACA A36 {custitem_pl_espesor} IN {custitem_pl_largo} X {custitem_pl_ancho} FT';

const CAMPOS_PLANTILLA = Object.freeze({
    custitem_pl_ancho: { label: 'Ancho', type: 'float' },
    custitem_pl_espesor: { label: 'Espesor', type: 'float' },
    custitem_pl_largo: { label: 'Largo', type: 'float' }
});

const CAPTURA_VALIDA = Object.freeze({
    custpage_configuracion: '11',
    custpage_par_0: '2',
    custpage_par_1: '0.25',
    custpage_par_2: '4',
    custpage_peso: '125.5'
});

const enlace = (destinoEscapado, texto) => `<p><a href="${destinoEscapado}">${texto}</a></p>`;

const registrarSinDuplicar = (contenedor, id, elemento) => {
    if (Object.prototype.hasOwnProperty.call(contenedor, id)) throw new Error(`ID duplicado en el formulario: ${id}`);
    contenedor[id] = elemento;
    return elemento;
};

const crearCampoFalso = (definicion) => {
    const campo = {
        id: definicion.id,
        label: definicion.label,
        type: definicion.type,
        opciones: [],
        tipoDeDespliegue: null,
        isMandatory: false,
        defaultValue: undefined,
        addSelectOption: jest.fn((opcion) => {
            campo.opciones.push(opcion);
        }),
        updateDisplayType: jest.fn((opciones) => {
            campo.tipoDeDespliegue = opciones.displayType;
            return campo;
        })
    };
    return campo;
};

const crearFormularioFalso = (definicion) => {
    const formulario = {
        title: definicion.title,
        campos: {},
        mensajes: [],
        botones: [],
        addField: jest.fn((campo) => registrarSinDuplicar(formulario.campos, campo.id, crearCampoFalso(campo))),
        addSubmitButton: jest.fn((boton) => {
            formulario.botones.push(boton.label);
            return {};
        }),
        addPageInitMessage: jest.fn((mensaje) => {
            formulario.mensajes.push(mensaje);
        })
    };
    return formulario;
};

const crearSolicitud = (metodo, parametros = {}) => ({ method: metodo, parameters: parametros });

const solicitudGet = () => crearSolicitud('GET');

const solicitudParametros = (parametros) => crearSolicitud('POST', Object.assign({ custpage_accion: 'parametros' }, parametros));

const solicitudCrear = (parametros) => crearSolicitud('POST', Object.assign({ custpage_accion: 'crear' }, parametros));

const crearErrorNetSuite = (nombre, mensaje) => {
    const error = new Error(mensaje);
    error.name = nombre;
    return error;
};

const filasPara = (sql, datos) => {
    const copiar = (filas) => filas.map((fila) => Object.assign({}, fila));
    if (/from\s+customrecord_sads_naturaleza_productos\b/i.test(sql)) return copiar(datos.configuraciones);
    if (/from\s+item\b/i.test(sql)) return copiar(datos.duplicados);
    throw new Error(`Consulta no esperada en la prueba: ${sql}`);
};

const prepararEscenario = (ajustes = {}) => {
    const datos = Object.assign({
        configuraciones: CONFIGURACIONES,
        configuracion: {
            custrecord_sads_naturaleza_config: JSON_PLACAS,
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: PATRON_NOMBRE,
            custrecord_sads_naturaleza_patron_cod: PATRON_CODIGO
        },
        tipos: { [ID_PLANTILLA]: 'inventoryitem', [String(ID_DUPLICADO)]: 'inventoryitem' },
        campos: CAMPOS_PLANTILLA,
        textoUnidad: 'kg',
        errorTextoUnidad: null,
        valorUnidad: '3',
        duplicados: [],
        crearActivo: false,
        errorDeConsulta: null,
        errorAlGuardar: null,
        errorUrlSuitelet: null
    }, ajustes);

    serverWidget.createForm.mockImplementation((definicion) => crearFormularioFalso(definicion));
    query.runSuiteQL.mockImplementation((consulta) => {
        if (datos.errorDeConsulta !== null) throw datos.errorDeConsulta;
        return { asMappedResults: () => filasPara(consulta.query, datos) };
    });
    search.lookupFields.mockImplementation(() => Object.assign({}, datos.configuracion));
    search.create.mockImplementation((definicion) => {
        const id = definicion.filters[0][2];
        const tipo = datos.tipos[id];
        return {
            run: () => ({
                getRange: () => (tipo === undefined || tipo === null ? [] : [{ id, recordType: tipo }])
            })
        };
    });

    const valoresAsignados = {};
    const copia = {
        getField: jest.fn((opciones) => {
            const campo = datos.campos[opciones.fieldId];
            return campo === undefined ? null : Object.assign({ id: opciones.fieldId }, campo);
        }),
        getText: jest.fn(() => {
            if (datos.errorTextoUnidad !== null) throw datos.errorTextoUnidad;
            return datos.textoUnidad;
        }),
        getValue: jest.fn(() => datos.valorUnidad),
        setValue: jest.fn((opciones) => {
            valoresAsignados[opciones.fieldId] = opciones.value;
        }),
        save: jest.fn(() => {
            if (datos.errorAlGuardar !== null) throw datos.errorAlGuardar;
            return ID_ARTICULO_CREADO;
        })
    };
    record.copy.mockReturnValue(copia);

    runtime.getCurrentScript.mockReturnValue({
        id: SCRIPT_ID,
        deploymentId: DEPLOYMENT_ID,
        getParameter: jest.fn((parametro) => (parametro.name === 'custscript_sads_sl_art_activo' ? datos.crearActivo : null))
    });
    url.resolveScript.mockImplementation(() => {
        if (datos.errorUrlSuitelet !== null) throw datos.errorUrlSuitelet;
        return URL_SUITELET;
    });
    url.resolveRecord.mockReturnValue(URL_ARTICULO);
    return { copia, valoresAsignados };
};

const ejecutar = (solicitud) => {
    const respuesta = { writePage: jest.fn(), write: jest.fn() };
    suitelet.onRequest({ request: solicitud, response: respuesta });
    expect(respuesta.writePage).toHaveBeenCalledTimes(1);
    expect(respuesta.write).not.toHaveBeenCalled();
    return respuesta.writePage.mock.calls[0][0];
};

const textosDeMensajes = (formulario) => formulario.mensajes.map((mensaje) => mensaje.message);

const textoDePagina = (formulario) => JSON.stringify({
    titulo: formulario.title,
    mensajes: formulario.mensajes,
    campos: Object.keys(formulario.campos).map((id) => {
        const campo = formulario.campos[id];
        return { id, etiqueta: campo.label, valor: campo.defaultValue, opciones: campo.opciones };
    })
});

const consultasEjecutadas = () => query.runSuiteQL.mock.calls.map((llamada) => llamada[0]);

const consultaDeDuplicado = () => consultasEjecutadas().filter((consulta) => /from\s+item\b/i.test(consulta.query));

const esperarPaginaDeError = (formulario, mensaje) => {
    expect(formulario.title).toBe('Crear artículo por naturaleza');
    expect(formulario.mensajes).toHaveLength(1);
    expect(formulario.mensajes[0].type).toBe(message.Type.ERROR);
    expect(formulario.mensajes[0].message).toBe(mensaje);
    expect(formulario.botones).toEqual([]);
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('estructura del módulo', () => {
    const fuente = fs.readFileSync(RUTA_SUITELET, 'utf8');

    test('exporta solo onRequest', () => {
        expect(Object.keys(suitelet)).toEqual(['onRequest']);
        expect(typeof suitelet.onRequest).toBe('function');
    });

    test('declara el encabezado de Suitelet 2.1 con alcance SameAccount', () => {
        expect(fuente).toMatch(/@NApiVersion 2\.1\b/);
        expect(fuente).toMatch(/@NScriptType Suitelet\b/);
        expect(fuente).toMatch(/@NModuleScope SameAccount\b/);
    });

    test('depende solo de los módulos N/ de la especificación, del dominio y del adaptador', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        expect(definicion).not.toBeNull();
        const dependencias = definicion[1]
            .split(',')
            .map((dependencia) => dependencia.trim().replace(/^['"]|['"]$/g, ''))
            .filter((dependencia) => dependencia !== '');
        expect(dependencias).toEqual([
            'N/ui/serverWidget',
            'N/ui/message',
            'N/search',
            'N/query',
            'N/record',
            'N/runtime',
            'N/url',
            'N/log',
            './domain/SADS_naturaleza_config_formato',
            './domain/SADS_naturaleza_patron',
            './domain/SADS_naturaleza_parametros',
            './infra/SADS_naturaleza_articulo_ns'
        ]);
    });

    test('declara los supuestos como constantes con nombre', () => {
        expect(fuente).toMatch(/const LONGITUD_MAXIMA_CODIGO = 60;/);
        expect(fuente).toMatch(/const CAMPOS_A_LIMPIAR = Object\.freeze\(\['upccode', 'mpn'\]\);/);
        expect(fuente).toMatch(/const UNIDADES_PESO_RESPALDO = Object\.freeze\(/);
    });

    test('no usa encadenamiento opcional, fusión de nulos, console ni modo dinámico', () => {
        expect(fuente).not.toMatch(/\?\./);
        expect(fuente).not.toMatch(/\?\?/);
        expect(fuente).not.toMatch(/\bconsole\./);
        expect(fuente).not.toMatch(/isDynamic:\s*true/);
    });

    test('no reimplementa la búsqueda del tipo de registro (PT-10)', () => {
        expect(fuente).not.toMatch(/search\.create\(/);
        expect(fuente).not.toMatch(/recordtype/);
    });
});

describe('paso 1 (GET)', () => {
    test('muestra las naturalezas con plantilla en un select obligatorio con opción vacía y botón Siguiente', () => {
        prepararEscenario();
        const formulario = ejecutar(solicitudGet());

        expect(formulario.title).toContain('Paso 1 de 2');
        expect(formulario.mensajes).toEqual([]);
        expect(formulario.campos.custpage_configuracion).toMatchObject({ type: FieldType.SELECT, isMandatory: true });
        expect(formulario.campos.custpage_configuracion.opciones).toEqual([
            { value: '', text: '' },
            { value: '11', text: 'Placas A36', isSelected: false },
            { value: '12', text: 'Placas inoxidables', isSelected: false }
        ]);
        expect(formulario.campos.custpage_accion).toMatchObject({
            defaultValue: 'parametros',
            tipoDeDespliegue: FieldDisplayType.HIDDEN
        });
        expect(formulario.botones).toEqual(['Siguiente']);
        expect(record.copy).not.toHaveBeenCalled();
        expect(search.lookupFields).not.toHaveBeenCalled();
    });

    test('C-1 filtra activos con plantilla, ordena por nombre y no recibe parámetros', () => {
        prepararEscenario();
        ejecutar(solicitudGet());
        const consultas = consultasEjecutadas();
        expect(consultas).toHaveLength(1);
        expect(consultas[0].query).toMatch(/FROM customrecord_sads_naturaleza_productos cfg/);
        expect(consultas[0].query).toMatch(/cfg\.isinactive = 'F'/);
        expect(consultas[0].query).toMatch(/cfg\.custrecord_sads_naturaleza_plantilla IS NOT NULL/);
        expect(consultas[0].query).toMatch(/ORDER BY cfg\.name/);
        expect(consultas[0].params).toEqual([]);
    });

    test('P-09: sin configuraciones muestra un aviso informativo sin select ni botón', () => {
        prepararEscenario({ configuraciones: [] });
        const formulario = ejecutar(solicitudGet());
        expect(formulario.mensajes).toHaveLength(1);
        expect(formulario.mensajes[0].type).toBe(message.Type.INFORMATION);
        expect(formulario.mensajes[0].message).toBe(MENSAJES.SIN_CONFIGURACIONES);
        expect(formulario.campos.custpage_configuracion).toBeUndefined();
        expect(formulario.botones).toEqual([]);
    });

    test.each([undefined, '', 'otra', 'CREAR'])('un POST con acción %p muestra el paso 1', (accion) => {
        prepararEscenario();
        const formulario = ejecutar(crearSolicitud('POST', { custpage_accion: accion, custpage_configuracion: '11' }));
        expect(formulario.title).toContain('Paso 1 de 2');
        expect(formulario.mensajes).toEqual([]);
        expect(record.copy).not.toHaveBeenCalled();
    });
});

describe('validación de la naturaleza elegida (RN-11)', () => {
    test.each(['abc', '0', '-11', '11.0', '011', ' ', '', undefined, '99', '11 OR 1=1'])(
        'P-10: %p muestra el paso 1 con error y no lee la configuración',
        (valor) => {
            prepararEscenario();
            const formulario = ejecutar(solicitudParametros({ custpage_configuracion: valor }));
            expect(formulario.title).toContain('Paso 1 de 2');
            expect(formulario.mensajes).toHaveLength(1);
            expect(formulario.mensajes[0].type).toBe(message.Type.ERROR);
            expect(formulario.mensajes[0].message).toBe(MENSAJES.NATURALEZA_INVALIDA);
            expect(formulario.botones).toEqual(['Siguiente']);
            expect(search.lookupFields).not.toHaveBeenCalled();
            expect(record.copy).not.toHaveBeenCalled();
        }
    );

    test('P-10 en la creación: no lee la configuración ni guarda', () => {
        prepararEscenario();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_VALIDA, { custpage_configuracion: '99' })));
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.NATURALEZA_INVALIDA]);
        expect(record.copy).not.toHaveBeenCalled();
    });

    test('una configuración inactivada después del paso 1 ya no es válida', () => {
        prepararEscenario({ configuraciones: [{ id: 12, nombre: 'Placas inoxidables' }] });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.NATURALEZA_INVALIDA]);
    });

    test('el paso 1 con error conserva las opciones de C-1 y no selecciona un valor ajeno', () => {
        prepararEscenario();
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '99' }));
        expect(formulario.campos.custpage_configuracion.opciones).toEqual([
            { value: '', text: '' },
            { value: '11', text: 'Placas A36', isSelected: false },
            { value: '12', text: 'Placas inoxidables', isSelected: false }
        ]);
    });
});

describe('paso 2 (POST parametros)', () => {
    test('muestra un campo obligatorio por parámetro en el orden del JSON y el peso con la unidad', () => {
        prepararEscenario();
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));

        expect(formulario.title).toContain('Paso 2 de 2');
        expect(formulario.mensajes).toEqual([]);
        expect(formulario.campos.custpage_naturaleza_texto).toMatchObject({
            defaultValue: 'Placas A36',
            tipoDeDespliegue: FieldDisplayType.INLINE
        });
        expect(formulario.campos.custpage_configuracion).toMatchObject({
            defaultValue: '11',
            tipoDeDespliegue: FieldDisplayType.HIDDEN
        });
        expect(formulario.campos.custpage_accion).toMatchObject({
            defaultValue: 'crear',
            tipoDeDespliegue: FieldDisplayType.HIDDEN
        });
        expect(formulario.campos.custpage_par_0).toMatchObject({ label: 'Ancho', type: FieldType.FLOAT, isMandatory: true });
        expect(formulario.campos.custpage_par_1).toMatchObject({ label: 'Espesor', type: FieldType.FLOAT, isMandatory: true });
        expect(formulario.campos.custpage_par_2).toMatchObject({ label: 'Largo', type: FieldType.FLOAT, isMandatory: true });
        expect(formulario.campos.custpage_par_3).toBeUndefined();
        expect(formulario.campos.custpage_peso).toMatchObject({ label: 'Peso (kg)', type: FieldType.FLOAT, isMandatory: true });
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Regresar'));
        expect(formulario.botones).toEqual(['Crear artículo']);
    });

    test('lee la configuración con lookupFields y copia la plantilla una vez en modo estándar', () => {
        const { copia } = prepararEscenario();
        ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(search.lookupFields).toHaveBeenCalledTimes(1);
        expect(search.lookupFields).toHaveBeenCalledWith({
            type: REGISTRO_CONFIGURACION,
            id: '11',
            columns: [
                'custrecord_sads_naturaleza_config',
                'custrecord_sads_naturaleza_plantilla',
                'custrecord_sads_naturaleza_patron_nom',
                'custrecord_sads_naturaleza_patron_cod'
            ]
        });
        expect(record.copy).toHaveBeenCalledTimes(1);
        expect(record.copy).toHaveBeenCalledWith({ type: 'inventoryitem', id: ID_PLANTILLA, isDynamic: false });
        expect(copia.save).not.toHaveBeenCalled();
        expect(copia.setValue).not.toHaveBeenCalled();
    });

    test('un campo entero se muestra como INTEGER', () => {
        prepararEscenario({
            campos: Object.assign({}, CAMPOS_PLANTILLA, { custitem_pl_largo: { label: 'Largo', type: 'integer' } })
        });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.campos.custpage_par_2.type).toBe(FieldType.INTEGER);
    });

    test('escapa las etiquetas que vienen de NetSuite', () => {
        prepararEscenario({
            campos: Object.assign({}, CAMPOS_PLANTILLA, { custitem_pl_largo: { label: '<b>Largo</b>', type: 'float' } }),
            textoUnidad: '<i>kg</i>'
        });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.campos.custpage_par_2.label).toBe('&lt;b&gt;Largo&lt;/b&gt;');
        expect(formulario.campos.custpage_peso.label).toBe('Peso (&lt;i&gt;kg&lt;/i&gt;)');
    });

    test('P-22: si getText falla usa el mapa de respaldo de la unidad', () => {
        prepararEscenario({ errorTextoUnidad: crearErrorNetSuite('SSS_INVALID_FIELD', 'getText falló'), valorUnidad: '1' });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.campos.custpage_peso.label).toBe('Peso (lb)');
        expect(log.error).not.toHaveBeenCalled();
    });

    test('P-22: si getText viene vacío usa el mapa de respaldo', () => {
        prepararEscenario({ textoUnidad: '', valorUnidad: 3 });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.campos.custpage_peso.label).toBe('Peso (kg)');
    });

    test('P-22: sin texto ni valor conocido usa la etiqueta genérica', () => {
        prepararEscenario({ errorTextoUnidad: new Error('falla'), valorUnidad: '99' });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.campos.custpage_peso.label).toBe('Peso (unidad de la plantilla)');
    });
});

describe('errores de configuración (preparación común)', () => {
    test('plantilla inexistente: página de error de dominio y sin copia', () => {
        prepararEscenario({ tipos: {} });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        esperarPaginaDeError(formulario, MENSAJES.PLANTILLA_INEXISTENTE);
        expect(record.copy).not.toHaveBeenCalled();
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Regresar'));
    });

    test.each([
        ['plantilla vacía', { custrecord_sads_naturaleza_plantilla: '' }],
        ['plantilla no numérica', { custrecord_sads_naturaleza_plantilla: 'abc' }],
        ['patrón de nombre vacío', { custrecord_sads_naturaleza_patron_nom: '  ' }],
        ['patrón de código vacío', { custrecord_sads_naturaleza_patron_cod: '' }]
    ])('%s: página de error de configuración incompleta', (descripcion, ajuste) => {
        prepararEscenario({ configuracion: Object.assign({
            custrecord_sads_naturaleza_config: JSON_PLACAS,
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: PATRON_NOMBRE,
            custrecord_sads_naturaleza_patron_cod: PATRON_CODIGO
        }, ajuste) });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.mensajes[0].message).toMatch(/^La configuración de esta naturaleza está incompleta/);
        expect(record.copy).not.toHaveBeenCalled();
    });

    test('JSON inválido: muestra el mensaje del contrato de formato', () => {
        prepararEscenario({ configuracion: {
            custrecord_sads_naturaleza_config: '{no es json',
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: PATRON_NOMBRE,
            custrecord_sads_naturaleza_patron_cod: PATRON_CODIGO
        } });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        esperarPaginaDeError(formulario, 'La configuración no tiene formato JSON válido.');
    });

    test('ID inseguro en el JSON: error sin reflejar el ID', () => {
        prepararEscenario({ configuracion: {
            custrecord_sads_naturaleza_config: '["custitem_a; drop"]',
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: '{custitem_a}',
            custrecord_sads_naturaleza_patron_cod: '{custitem_a}'
        } });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.mensajes[0].message).toMatch(/^La configuración de esta naturaleza no es válida: /);
        expect(textoDePagina(formulario)).not.toContain('drop');
        expect(record.copy).not.toHaveBeenCalled();
    });

    test('P-12: parámetro de tipo texto o ausente en la copia muestra error de configuración', () => {
        prepararEscenario({
            campos: {
                custitem_pl_ancho: { label: 'Ancho', type: 'text' },
                custitem_pl_espesor: { label: 'Espesor', type: 'float' }
            }
        });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        esperarPaginaDeError(
            formulario,
            'La configuración de esta naturaleza no es válida: El campo custitem_pl_ancho no es decimal ni entero.; '
                + 'El campo custitem_pl_largo no existe en el artículo plantilla.'
        );
        expect(record.copy.mock.results[0].value.save).not.toHaveBeenCalled();
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.error.mock.calls[0][0].title).toMatch(/error de dominio/);
    });

    test('P-12 en la creación: no guarda', () => {
        const { copia } = prepararEscenario({ campos: { custitem_pl_ancho: { label: 'Ancho', type: 'text' } } });
        ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(copia.save).not.toHaveBeenCalled();
        expect(consultaDeDuplicado()).toEqual([]);
    });
});

describe('creación (POST crear)', () => {
    test('P-13: alta válida con parámetro F asigna valores, guarda y confirma', () => {
        const { copia, valoresAsignados } = prepararEscenario();
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));

        expect(valoresAsignados).toEqual({
            custitem_sads_naturaleza_producto: '11',
            custitem_pl_ancho: 2,
            custitem_pl_espesor: 0.25,
            custitem_pl_largo: 4,
            weight: 125.5,
            itemid: 'PL-0.25-4X2',
            displayname: 'PLACA A36 0.25 IN 4 X 2 FT',
            vendorname: 'PLACA A36 0.25 IN 4 X 2 FT',
            upccode: '',
            mpn: '',
            isinactive: true
        });
        expect(copia.save).toHaveBeenCalledTimes(1);
        expect(copia.save).toHaveBeenCalledWith({ ignoreMandatoryFields: false });
        expect(record.copy).toHaveBeenCalledTimes(1);

        expect(formulario.title).toContain('Artículo creado');
        expect(formulario.mensajes).toHaveLength(1);
        expect(formulario.mensajes[0].type).toBe(message.Type.CONFIRMATION);
        expect(formulario.mensajes[0].message).toBe(MENSAJES.CREADO);
        expect(formulario.campos.custpage_codigo).toMatchObject({ defaultValue: 'PL-0.25-4X2', tipoDeDespliegue: FieldDisplayType.INLINE });
        expect(formulario.campos.custpage_nombre).toMatchObject({ defaultValue: 'PLACA A36 0.25 IN 4 X 2 FT' });
        expect(formulario.campos.custpage_estado).toMatchObject({ defaultValue: 'Inactivo' });
        expect(url.resolveRecord).toHaveBeenCalledWith({ recordType: 'inventoryitem', recordId: ID_ARTICULO_CREADO, isEditMode: false });
        expect(formulario.campos.custpage_enlace_articulo.defaultValue).toBe(enlace(URL_ARTICULO_ESCAPADA, 'Ver artículo'));
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Crear otro'));

        expect(log.audit).toHaveBeenCalledTimes(1);
        expect(log.audit.mock.calls[0][0].details).toBe('ID: 777. Código: PL-0.25-4X2. Configuración: 11. Estado: Inactivo.');
        expect(log.error).not.toHaveBeenCalled();
    });

    test('el save ocurre después de asignar todos los valores', () => {
        const { copia } = prepararEscenario();
        ejecutar(solicitudCrear(CAPTURA_VALIDA));
        const ultimoSetValue = Math.max(...copia.setValue.mock.invocationCallOrder);
        expect(copia.save.mock.invocationCallOrder[0]).toBeGreaterThan(ultimoSetValue);
    });

    test('RN-10: con el parámetro en T el artículo se crea activo', () => {
        const { valoresAsignados } = prepararEscenario({ crearActivo: 'T' });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(valoresAsignados.isinactive).toBe(false);
        expect(formulario.campos.custpage_estado.defaultValue).toBe('Activo');
    });

    test.each([false, 'F', null, undefined, 'true'])('RN-10: el parámetro %p crea el artículo inactivo', (valor) => {
        const { valoresAsignados } = prepararEscenario({ crearActivo: valor });
        ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(valoresAsignados.isinactive).toBe(true);
    });

    test('C-2 usa columnas del JSON validadas y todos los valores como parámetros', () => {
        prepararEscenario();
        ejecutar(solicitudCrear(CAPTURA_VALIDA));
        const consultas = consultaDeDuplicado();
        expect(consultas).toHaveLength(1);
        expect(consultas[0].query).toMatch(/FROM item art/);
        expect(consultas[0].query).toMatch(/WHERE art\.custitem_sads_naturaleza_producto = \?/);
        expect(consultas[0].query).toMatch(/AND art\.custitem_pl_ancho = \?\nAND art\.custitem_pl_espesor = \?\nAND art\.custitem_pl_largo = \?/);
        expect(consultas[0].query).not.toMatch(/isinactive\s*=/);
        expect(consultas[0].query).toMatch(/ORDER BY art\.id/);
        expect(consultas[0].params).toEqual(['11', 2, 0.25, 4]);
    });

    test('RN-11: ignora valores del formulario que no son el ID de configuración ni las capturas', () => {
        const { valoresAsignados } = prepararEscenario();
        ejecutar(solicitudCrear(Object.assign({}, CAPTURA_VALIDA, {
            custpage_par_3: '99',
            custpage_codigo: 'FALSO',
            custpage_naturaleza_texto: 'Otra'
        })));
        expect(valoresAsignados.itemid).toBe('PL-0.25-4X2');
        expect(Object.values(valoresAsignados)).not.toContain(99);
    });

    test('valores inválidos: repite el paso 2 con errores y valores previos, sin buscar ni guardar', () => {
        const { copia } = prepararEscenario();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_VALIDA, {
            custpage_par_1: '0,25',
            custpage_peso: '0'
        })));
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(formulario.mensajes).toHaveLength(1);
        expect(formulario.mensajes[0].type).toBe(message.Type.ERROR);
        expect(formulario.mensajes[0].message).toBe(
            'Espesor: capture un número mayor que 0 con punto decimal, por ejemplo 0.25.<br>'
                + 'Peso: capture un número mayor que 0 con punto decimal, por ejemplo 0.25.'
        );
        expect(formulario.campos.custpage_par_0.defaultValue).toBe('2');
        expect(formulario.campos.custpage_par_1.defaultValue).toBe('0,25');
        expect(formulario.campos.custpage_peso.defaultValue).toBe('0');
        expect(consultaDeDuplicado()).toEqual([]);
        expect(copia.save).not.toHaveBeenCalled();
        expect(record.copy).toHaveBeenCalledTimes(1);
    });

    test('los mensajes de validación escapan la etiqueta del campo', () => {
        prepararEscenario({
            campos: Object.assign({}, CAMPOS_PLANTILLA, { custitem_pl_ancho: { label: '<script>x</script>', type: 'float' } })
        });
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_VALIDA, { custpage_par_0: 'abc' })));
        expect(formulario.mensajes[0].message).toContain('&lt;script&gt;x&lt;/script&gt;');
        expect(formulario.mensajes[0].message).not.toContain('<script>');
    });

    test('código de más de 60 caracteres: repite el paso 2 con el mensaje de longitud', () => {
        const { copia } = prepararEscenario({ configuracion: {
            custrecord_sads_naturaleza_config: JSON_PLACAS,
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: PATRON_NOMBRE,
            custrecord_sads_naturaleza_patron_cod: `${'X'.repeat(55)}-{custitem_pl_espesor}-{custitem_pl_largo}X{custitem_pl_ancho}`
        } });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.CODIGO_LARGO]);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('un código de exactamente 60 caracteres se acepta', () => {
        const { copia } = prepararEscenario({ configuracion: {
            custrecord_sads_naturaleza_config: '["custitem_pl_ancho"]',
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: 'N {custitem_pl_ancho}',
            custrecord_sads_naturaleza_patron_cod: `${'X'.repeat(59)}{custitem_pl_ancho}`
        } });
        ejecutar(solicitudCrear({ custpage_configuracion: '11', custpage_par_0: '2', custpage_peso: '1' }));
        expect(copia.save).toHaveBeenCalledTimes(1);
    });

    test('un patrón con marcador fuera del JSON muestra la página de error de dominio sin guardar', () => {
        const { copia } = prepararEscenario({ configuracion: {
            custrecord_sads_naturaleza_config: JSON_PLACAS,
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: PATRON_NOMBRE,
            custrecord_sads_naturaleza_patron_cod: 'PL-{custitem_otro}'
        } });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));
        esperarPaginaDeError(formulario, 'Falta el valor del marcador {custitem_otro}.');
        expect(copia.save).not.toHaveBeenCalled();
    });
});

describe('duplicados (RN-08)', () => {
    test('P-11: con un artículo existente muestra la página de duplicado sin guardar', () => {
        const { copia } = prepararEscenario({ duplicados: [{ id: ID_DUPLICADO, codigo: 'PL-0.25-4X2', inactivo: 'T' }] });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));

        expect(formulario.title).toContain('Artículo existente');
        expect(formulario.mensajes).toHaveLength(1);
        expect(formulario.mensajes[0].type).toBe(message.Type.INFORMATION);
        expect(formulario.mensajes[0].message).toBe(MENSAJES.DUPLICADO);
        expect(formulario.campos.custpage_codigo.defaultValue).toBe('PL-0.25-4X2');
        expect(formulario.campos.custpage_estado.defaultValue).toBe('Inactivo');
        expect(formulario.campos.custpage_nombre).toBeUndefined();
        expect(url.resolveRecord).toHaveBeenCalledWith({ recordType: 'inventoryitem', recordId: String(ID_DUPLICADO), isEditMode: false });
        expect(formulario.campos.custpage_enlace_articulo.defaultValue).toBe(enlace(URL_ARTICULO_ESCAPADA, 'Ver artículo'));
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Crear otro'));

        expect(copia.save).not.toHaveBeenCalled();
        expect(copia.setValue).not.toHaveBeenCalled();
        expect(log.audit).toHaveBeenCalledTimes(1);
        expect(log.audit.mock.calls[0][0].details).toContain(`Artículo existente: ${ID_DUPLICADO}`);
    });

    test('un duplicado activo se muestra como Activo', () => {
        prepararEscenario({ duplicados: [{ id: ID_DUPLICADO, codigo: 'PL-0.25-4X2', inactivo: 'F' }] });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(formulario.campos.custpage_estado.defaultValue).toBe('Activo');
    });

    test('si no se resuelve el tipo del duplicado se omite el enlace al artículo', () => {
        prepararEscenario({
            duplicados: [{ id: ID_DUPLICADO, codigo: 'PL-0.25-4X2', inactivo: 'F' }],
            tipos: { [ID_PLANTILLA]: 'inventoryitem' }
        });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(formulario.campos.custpage_enlace_articulo).toBeUndefined();
        expect(url.resolveRecord).not.toHaveBeenCalled();
    });
});

describe('manejo global de errores', () => {
    test('P-16: si save lanza error muestra el mensaje genérico sin el texto crudo y registra el error', () => {
        prepararEscenario({
            errorAlGuardar: crearErrorNetSuite('MISSING_DYNAMIC_MANDATORY_FIELDS', 'Faltan campos: custitem_secreto')
        });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));
        esperarPaginaDeError(formulario, MENSAJES.GENERICO);
        expect(textoDePagina(formulario)).not.toContain('custitem_secreto');
        expect(textoDePagina(formulario)).not.toContain('MISSING_DYNAMIC_MANDATORY_FIELDS');
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.error.mock.calls[0][0].title).toMatch(/error inesperado/);
        expect(log.error.mock.calls[0][0].details).toContain('custitem_secreto');
        expect(log.audit).not.toHaveBeenCalled();
    });

    test('un error de SuiteQL muestra el mensaje genérico', () => {
        prepararEscenario({ errorDeConsulta: crearErrorNetSuite('SSS_SEARCH_ERROR_OCCURRED', 'Record x was not found') });
        const formulario = ejecutar(solicitudGet());
        esperarPaginaDeError(formulario, MENSAJES.GENERICO);
        expect(textoDePagina(formulario)).not.toContain('was not found');
    });

    test('si la URL del Suitelet también falla, la página de error se muestra sin enlace', () => {
        prepararEscenario({
            errorDeConsulta: new Error('primero'),
            errorUrlSuitelet: new Error('segundo')
        });
        const formulario = ejecutar(solicitudGet());
        esperarPaginaDeError(formulario, MENSAJES.GENERICO);
        expect(formulario.campos.custpage_enlace_inicio).toBeUndefined();
        expect(log.error).toHaveBeenCalledTimes(2);
    });

    test('un error que no es objeto también se muestra con el mensaje genérico', () => {
        prepararEscenario();
        record.copy.mockImplementation(() => {
            throw 'texto crudo'; // eslint-disable-line no-throw-literal
        });
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        esperarPaginaDeError(formulario, MENSAJES.GENERICO);
        expect(textoDePagina(formulario)).not.toContain('texto crudo');
    });
});
