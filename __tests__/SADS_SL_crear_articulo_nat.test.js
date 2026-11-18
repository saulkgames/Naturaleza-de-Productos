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
    NOMBRE_LARGO: 'El nombre generado excede 60 caracteres; revise el patrón de nombre de la naturaleza.',
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
    custpage_peso: '125.5',
    custpage_conversion: '125.5'
});

const FAMILIA_UNICA = Object.freeze({
    id: 1, desde_id: null, desde_orden: null, desde_tipo: null, hasta_id: null, hasta_orden: null, hasta_tipo: null,
    precio_id: 68, margen_id: 7, precio_nombre: 'FAM68'
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
    if (/from\s+customrecord_sads_nat_familia\b/i.test(sql)) return copiar(datos.familias);
    if (/from\s+customrecord_sads_espesor\b/i.test(sql)) return copiar(datos.espesores);
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
        familias: [FAMILIA_UNICA],
        espesores: [],
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
            './domain/SADS_naturaleza_familias',
            './infra/SADS_naturaleza_articulo_ns'
        ]);
    });

    test('declara los supuestos como constantes con nombre', () => {
        expect(fuente).toMatch(/const LONGITUD_MAXIMA_ITEMID = 60;/);
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
                'custrecord_sads_naturaleza_patron_cod',
                'custrecord_sads_naturaleza_tipo_esp',
                'custrecord_sads_naturaleza_campo_med'
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
            custitem_drt_ci_precio_teorico: 125.5,
            custitem_alm_articulo_conversionunidad: 125.5,
            custitem_pfp_famprecios_: '68',
            custitem_pfp_fammargenes_: '7',
            itemid: 'PLACA A36 0.25 IN 4 X 2 FT',
            displayname: 'PL-0.25-4X2',
            vendorname: 'PL-0.25-4X2',
            purchasedescription: 'PLACA A36 0.25 IN 4 X 2 FT',
            salesdescription: 'PLACA A36 0.25 IN 4 X 2 FT',
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
        expect(log.audit.mock.calls[0][0].details).toBe(
            'ID: 777. Código: PL-0.25-4X2. Configuración: 11. Estado: Inactivo. Espesor: . Familia de precio: FAM68. Conversión: 125.5.'
        );
        expect(formulario.campos.custpage_familia_texto.defaultValue).toBe('FAM68');
        expect(formulario.campos.custpage_conversion_texto.defaultValue).toBe('125.5');
        expect(formulario.campos.custpage_espesor_texto).toBeUndefined();
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
        expect(valoresAsignados.displayname).toBe('PL-0.25-4X2');
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

    test('D-19: nombre (itemid) de más de 60 caracteres: repite el paso 2 con el mensaje de longitud', () => {
        const { copia } = prepararEscenario({ configuracion: {
            custrecord_sads_naturaleza_config: JSON_PLACAS,
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: `${'X'.repeat(55)}-{custitem_pl_espesor}-{custitem_pl_largo}X{custitem_pl_ancho}`,
            custrecord_sads_naturaleza_patron_cod: PATRON_CODIGO
        } });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.NOMBRE_LARGO]);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('un nombre (itemid) de exactamente 60 caracteres se acepta', () => {
        const { copia } = prepararEscenario({ configuracion: {
            custrecord_sads_naturaleza_config: '["custitem_pl_ancho"]',
            custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
            custrecord_sads_naturaleza_patron_nom: `${'X'.repeat(59)}{custitem_pl_ancho}`,
            custrecord_sads_naturaleza_patron_cod: 'N {custitem_pl_ancho}'
        } });
        ejecutar(solicitudCrear({ custpage_configuracion: '11', custpage_par_0: '2', custpage_peso: '1', custpage_conversion: '1' }));
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

describe('formatos de marcador: placa TA36 (D-13 a D-15)', () => {
    const CONFIGURACION_TA36 = Object.freeze({
        custrecord_sads_naturaleza_config: JSON_PLACAS,
        custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
        custrecord_sads_naturaleza_patron_nom: "Placa Acero TA36 {custitem_pl_espesor:fraccion16}'' {custitem_pl_ancho}'x{custitem_pl_largo}'",
        custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_pl_espesor:centesimas3}{custitem_pl_ancho}{custitem_pl_largo}'
    });
    const CAMPOS_TA36 = Object.freeze({
        custitem_pl_ancho: { label: 'Ancho', type: 'integer' },
        custitem_pl_espesor: { label: 'Espesor', type: 'float' },
        custitem_pl_largo: { label: 'Largo', type: 'integer' }
    });
    const CAPTURA_TA36 = Object.freeze({
        custpage_configuracion: '11',
        custpage_par_0: '6',
        custpage_par_1: '0.5',
        custpage_par_2: '20',
        custpage_peso: '1225.5',
        custpage_conversion: '1225.5'
    });

    test('alta de placa 1/2 x 6 x 20: código PLA36050620 y nombre con fracción', () => {
        const { copia, valoresAsignados } = prepararEscenario({ configuracion: CONFIGURACION_TA36, campos: CAMPOS_TA36 });
        const formulario = ejecutar(solicitudCrear(CAPTURA_TA36));
        expect(valoresAsignados.displayname).toBe('PLA36050620');
        expect(valoresAsignados.vendorname).toBe('PLA36050620');
        expect(valoresAsignados.itemid).toBe("Placa Acero TA36 1/2'' 6'x20'");
        expect(valoresAsignados.custitem_pl_espesor).toBe(0.5);
        expect(copia.save).toHaveBeenCalledTimes(1);
        expect(formulario.campos.custpage_codigo.defaultValue).toBe('PLA36050620');
    });

    test('3/8 se trunca a 037 en el código y se escribe 3/8 en el nombre', () => {
        const { valoresAsignados } = prepararEscenario({ configuracion: CONFIGURACION_TA36, campos: CAMPOS_TA36 });
        ejecutar(solicitudCrear(Object.assign({}, CAPTURA_TA36, { custpage_par_1: '0.375', custpage_par_0: '4', custpage_par_2: '10' })));
        expect(valoresAsignados.displayname).toBe('PLA36037410');
        expect(valoresAsignados.itemid).toBe("Placa Acero TA36 3/8'' 4'x10'");
    });

    test('un espesor que no es múltiplo de 1/16 repite el paso 2 con mensaje y no guarda', () => {
        const { copia } = prepararEscenario({ configuracion: CONFIGURACION_TA36, campos: CAMPOS_TA36 });
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_TA36, { custpage_par_1: '0.3' })));
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(textosDeMensajes(formulario)).toEqual(['Espesor: el valor no corresponde a una fracción de 1/16 de pulgada.']);
        expect(formulario.campos.custpage_par_1.defaultValue).toBe('0.3');
        expect(copia.save).not.toHaveBeenCalled();
        expect(consultaDeDuplicado()).toEqual([]);
    });

    test('un espesor de 10 o más repite el paso 2 con el mensaje de 3 dígitos', () => {
        const { copia } = prepararEscenario({ configuracion: CONFIGURACION_TA36, campos: CAMPOS_TA36 });
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_TA36, { custpage_par_1: '10' })));
        expect(textosDeMensajes(formulario)).toEqual(['Espesor: el valor no cabe en 3 dígitos de centésimas (de 0.01 a 9.99).']);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('un lado con decimales en un campo entero repite el paso 2 (D-15)', () => {
        const { copia } = prepararEscenario({ configuracion: CONFIGURACION_TA36, campos: CAMPOS_TA36 });
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_TA36, { custpage_par_0: '6.5' })));
        expect(textosDeMensajes(formulario)).toEqual(['Ancho: capture un número entero mayor que 0.']);
        expect(formulario.campos.custpage_par_0.type).toBe(FieldType.INTEGER);
        expect(copia.save).not.toHaveBeenCalled();
    });
});

describe('duplicados (RN-08)', () => {
    test('P-11: con un artículo existente muestra la página de duplicado sin guardar', () => {
        const { copia } = prepararEscenario({
            duplicados: [{ id: ID_DUPLICADO, codigo: 'PL-0.25-4X2', nombre: 'PLACA A36 0.25 IN 4 X 2 FT', inactivo: 'T' }]
        });
        const formulario = ejecutar(solicitudCrear(CAPTURA_VALIDA));

        expect(formulario.title).toContain('Artículo existente');
        expect(formulario.mensajes).toHaveLength(1);
        expect(formulario.mensajes[0].type).toBe(message.Type.INFORMATION);
        expect(formulario.mensajes[0].message).toBe(MENSAJES.DUPLICADO);
        expect(formulario.campos.custpage_codigo.defaultValue).toBe('PL-0.25-4X2');
        expect(formulario.campos.custpage_estado.defaultValue).toBe('Inactivo');
        expect(formulario.campos.custpage_nombre.defaultValue).toBe('PLACA A36 0.25 IN 4 X 2 FT');
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

describe('iteración B: espesor por catálogo, familias, peso, conversión y descripciones', () => {
    const CONFIGURACION_B = Object.freeze({
        custrecord_sads_naturaleza_config: '["custitem_sads_nat_pla_lado_a","custitem_sads_nat_pla_lado_b","custitem_sads_nat_espesor"]',
        custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
        custrecord_sads_naturaleza_patron_nom: "Placa Acero TA36 {custitem_sads_nat_espesor:texto} {custitem_sads_nat_pla_lado_a}'x{custitem_sads_nat_pla_lado_b}'",
        custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_pla_lado_a}{custitem_sads_nat_pla_lado_b}',
        custrecord_sads_naturaleza_tipo_esp: [{ value: '1', text: 'Fracción de pulgada' }]
    });
    const CAMPOS_B = Object.freeze({
        custitem_sads_nat_pla_lado_a: { label: 'Lado A', type: 'integer' },
        custitem_sads_nat_pla_lado_b: { label: 'Lado B', type: 'integer' },
        custitem_sads_nat_espesor: { label: 'Espesor', type: 'select' }
    });
    const ESPESORES = Object.freeze([
        { id: 501, nombre: '3/16"', texto: "3/16''", codigo: '018', orden: 0.1875 },
        { id: 502, nombre: '1/2"', texto: "1/2''", codigo: '050', orden: 0.5 },
        { id: 504, nombre: '3/4"', texto: "3/4''", codigo: '075', orden: 0.75 },
        { id: 509, nombre: '2"', texto: "2''", codigo: '200', orden: 2 }
    ]);
    const rango = (id, desde, hasta, precio, nombre) => ({
        id, desde_id: desde, desde_orden: desde === 501 ? 0.1875 : 0.75, desde_tipo: 1,
        hasta_id: hasta, hasta_orden: hasta === 503 ? 0.625 : 1.5, hasta_tipo: 1,
        precio_id: precio, margen_id: precio + 100, precio_nombre: nombre
    });
    const FAMILIAS_PLACA = Object.freeze([rango(1, 501, 503, 68, 'FAM68'), rango(2, 504, 505, 69, 'FAM069')]);
    const CAPTURA_B = Object.freeze({
        custpage_configuracion: '11',
        custpage_par_0: '6',
        custpage_par_1: '20',
        custpage_par_2: '502',
        custpage_peso: '1225.5',
        custpage_conversion: '1225.5'
    });
    const escenarioB = (ajustes = {}) => prepararEscenario(Object.assign({
        configuracion: CONFIGURACION_B, campos: CAMPOS_B, espesores: ESPESORES, familias: FAMILIAS_PLACA
    }, ajustes));
    const consultaDe = (tabla) => consultasEjecutadas().filter((consulta) => new RegExp(`from\\s+${tabla}\\b`, 'i').test(consulta.query));

    test('paso 2: el espesor es un select obligatorio del catálogo y se pide la conversión', () => {
        escenarioB();
        const formulario = ejecutar(solicitudParametros({ custpage_configuracion: '11' }));
        expect(formulario.campos.custpage_par_2).toMatchObject({ type: FieldType.SELECT, isMandatory: true, label: 'Espesor' });
        expect(formulario.campos.custpage_par_2.opciones.map((opcion) => opcion.text)).toEqual(['', '3/16"', '1/2"', '3/4"', '2"']);
        expect(formulario.campos.custpage_par_0.type).toBe(FieldType.INTEGER);
        expect(formulario.campos.custpage_conversion).toMatchObject({
            type: FieldType.FLOAT, isMandatory: true, label: 'Conversión unidad de compra a base'
        });
        expect(consultaDe('customrecord_sads_espesor')[0].params).toEqual(['1']);
        expect(consultaDe('customrecord_sads_nat_familia')[0].params).toEqual(['11']);
    });

    test('P3-10: alta de placa 1/2 × 6 × 20 asigna espesor, peso, conversión, familias y descripciones', () => {
        const { copia, valoresAsignados } = escenarioB();
        const formulario = ejecutar(solicitudCrear(CAPTURA_B));
        expect(valoresAsignados).toMatchObject({
            custitem_sads_nat_pla_lado_a: 6,
            custitem_sads_nat_pla_lado_b: 20,
            custitem_sads_nat_espesor: 502,
            weight: 1225.5,
            custitem_drt_ci_precio_teorico: 1225.5,
            custitem_alm_articulo_conversionunidad: 1225.5,
            custitem_pfp_famprecios_: '68',
            custitem_pfp_fammargenes_: '168',
            itemid: "Placa Acero TA36 1/2'' 6'x20'",
            displayname: 'PLA36050620',
            vendorname: 'PLA36050620',
            purchasedescription: "Placa Acero TA36 1/2'' 6'x20'",
            salesdescription: "Placa Acero TA36 1/2'' 6'x20'",
            isinactive: true
        });
        expect(copia.save).toHaveBeenCalledTimes(1);
        expect(formulario.campos.custpage_espesor_texto.defaultValue).toBe('1/2"');
        expect(formulario.campos.custpage_familia_texto.defaultValue).toBe('FAM68');
        expect(consultaDeDuplicado()[0].params).toEqual(['11', 6, 20, 502]);
    });

    test('RN3-04: un espesor de 3/4 toma la segunda familia', () => {
        const { valoresAsignados } = escenarioB();
        ejecutar(solicitudCrear(Object.assign({}, CAPTURA_B, { custpage_par_2: '504' })));
        expect(valoresAsignados.custitem_pfp_famprecios_).toBe('69');
        expect(valoresAsignados.displayname).toBe('PLA36075620');
    });

    test('RN3-04: un espesor fuera de todos los rangos muestra error de configuración y no guarda', () => {
        const { copia } = escenarioB();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_B, { custpage_par_2: '509' })));
        esperarPaginaDeError(formulario, 'No hay una familia de precios única para este espesor en la naturaleza.');
        expect(copia.save).not.toHaveBeenCalled();
    });

    test.each(['999', '', '0.5'])('P3-08: espesor %p fuera del catálogo repite el paso 2 sin guardar', (espesor) => {
        const { copia } = escenarioB();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_B, { custpage_par_2: espesor })));
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(textosDeMensajes(formulario)).toEqual(['Espesor: elija un valor de la lista.']);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test.each([undefined, '', '0', '-3'])('P3-11: conversión %p repite el paso 2 con el valor previo y sin guardar', (conversion) => {
        const { copia } = escenarioB();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA_B, { custpage_conversion: conversion })));
        expect(textosDeMensajes(formulario)).toEqual([
            'Conversión unidad de compra a base: capture un número mayor que 0 con punto decimal, por ejemplo 0.25.'
        ]);
        expect(formulario.campos.custpage_par_2.opciones.filter((opcion) => opcion.isSelected).map((opcion) => opcion.value)).toEqual(['502']);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test.each([
        ['sin familias', { familias: [] }, 'La naturaleza no tiene familias de precio configuradas.'],
        ['sin espesores activos', { espesores: [] }, 'No hay espesores activos para el tipo de esta naturaleza.'],
        ['sin tipo de espesor', { configuracion: Object.assign({}, CONFIGURACION_B, { custrecord_sads_naturaleza_tipo_esp: [] }) },
            'La naturaleza usa espesor pero no tiene tipo de espesor.']
    ])('P3-17: %s muestra la página de error de configuración', (descripcion, ajuste, mensaje) => {
        escenarioB(ajuste);
        esperarPaginaDeError(ejecutar(solicitudParametros({ custpage_configuracion: '11' })), mensaje);
    });

    test('P3-18: una naturaleza sin espesor usa su familia única', () => {
        const { valoresAsignados } = prepararEscenario();
        ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(valoresAsignados.custitem_pfp_famprecios_).toBe('68');
        expect(consultaDe('customrecord_sads_espesor')).toEqual([]);
    });

    test('una naturaleza sin espesor con familias por rango no puede crear', () => {
        const { copia } = prepararEscenario({ familias: FAMILIAS_PLACA });
        esperarPaginaDeError(ejecutar(solicitudCrear(CAPTURA_VALIDA)), 'No hay una familia de precios única para este espesor en la naturaleza.');
        expect(copia.save).not.toHaveBeenCalled();
    });
});

describe('medidas de placa con ancho fijo y orden de lados (D-16 a D-18)', () => {
    const CONFIGURACION_LADOS = Object.freeze({
        custrecord_sads_naturaleza_config: '["custitem_sads_nat_pla_lado_a","custitem_sads_nat_pla_lado_b","custitem_sads_nat_espesor"]',
        custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
        custrecord_sads_naturaleza_patron_nom: "Placa Acero TA36 {custitem_sads_nat_espesor:texto} {custitem_sads_nat_pla_lado_a}'x{custitem_sads_nat_pla_lado_b}'",
        custrecord_sads_naturaleza_patron_cod: 'PLA36{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_pla_lado_a:entero1}{custitem_sads_nat_pla_lado_b:entero2}',
        custrecord_sads_naturaleza_tipo_esp: [{ value: '1', text: 'Fracción de pulgada' }]
    });
    const CAMPOS_LADOS = Object.freeze({
        custitem_sads_nat_pla_lado_a: { label: 'Lado A', type: 'float' },
        custitem_sads_nat_pla_lado_b: { label: 'Lado B', type: 'float' },
        custitem_sads_nat_espesor: { label: 'Espesor', type: 'select' }
    });
    const ESPESORES_LADOS = Object.freeze([{ id: 9, nombre: '1/2"', texto: "1/2''", codigo: '050', orden: 0.5 }]);
    const CAPTURA = Object.freeze({
        custpage_configuracion: '11',
        custpage_par_0: '7',
        custpage_par_1: '7',
        custpage_par_2: '9',
        custpage_peso: '500',
        custpage_conversion: '500'
    });
    const escenario = () => prepararEscenario({ configuracion: CONFIGURACION_LADOS, campos: CAMPOS_LADOS, espesores: ESPESORES_LADOS });

    test('placa 1/2 x 7 x 7 genera el código con terminación 707', () => {
        const { valoresAsignados, copia } = escenario();
        ejecutar(solicitudCrear(CAPTURA));
        expect(valoresAsignados.displayname).toBe('PLA36050707');
        expect(valoresAsignados.itemid).toBe("Placa Acero TA36 1/2'' 7'x7'");
        expect(copia.save).toHaveBeenCalledTimes(1);
    });

    test('placa 1/2 x 6 x 20 conserva la terminación 620', () => {
        const { valoresAsignados } = escenario();
        ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_0: '6', custpage_par_1: '20' })));
        expect(valoresAsignados.displayname).toBe('PLA36050620');
    });

    test('D-17: Lado A de 10 repite el paso 2 sin guardar', () => {
        const { copia } = escenario();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_0: '10', custpage_par_1: '20' })));
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(textosDeMensajes(formulario)).toEqual(['Lado A: capture un número entero de 1 a 9.']);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('D-17: Lado B con decimales repite el paso 2', () => {
        const { copia } = escenario();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_1: '7.5' })));
        expect(textosDeMensajes(formulario)).toEqual(['Lado B: capture un número entero de 1 a 99.']);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('D-18: Lado A mayor que Lado B repite el paso 2 con valores previos y sin buscar duplicados', () => {
        const { copia } = escenario();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_0: '8', custpage_par_1: '6' })));
        expect(textosDeMensajes(formulario)).toEqual(['Lado A no puede ser mayor que Lado B.']);
        expect(formulario.campos.custpage_par_0.defaultValue).toBe('8');
        expect(consultaDeDuplicado()).toEqual([]);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('el orden de lados no aplica si la naturaleza no tiene ambos lados', () => {
        const { copia } = prepararEscenario();
        ejecutar(solicitudCrear(CAPTURA_VALIDA));
        expect(copia.save).toHaveBeenCalledTimes(1);
    });
});

describe('PTR cuadrado con familias por espesor y lado (D-19 a D-21)', () => {
    const CONFIGURACION_PTR = Object.freeze({
        custrecord_sads_naturaleza_config: '["custitem_sads_nat_ptr_lado","custitem_sads_nat_ptr_largo","custitem_sads_nat_espesor"]',
        custrecord_sads_naturaleza_plantilla: ID_PLANTILLA,
        custrecord_sads_naturaleza_patron_cod: 'PTRC{custitem_sads_nat_ptr_lado:centesimas3}{custitem_sads_nat_espesor:codigo}',
        custrecord_sads_naturaleza_patron_nom: 'PTR {custitem_sads_nat_ptr_lado:fraccion16}" x {custitem_sads_nat_ptr_lado:fraccion16}" '
            + '{custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m',
        custrecord_sads_naturaleza_tipo_esp: [{ value: '5', text: 'Pared de PTR' }],
        custrecord_sads_naturaleza_campo_med: 'custitem_sads_nat_ptr_lado'
    });
    const CAMPOS_PTR = Object.freeze({
        custitem_sads_nat_ptr_lado: { label: 'Lado', type: 'float' },
        custitem_sads_nat_ptr_largo: { label: 'Largo', type: 'float' },
        custitem_sads_nat_espesor: { label: 'Espesor', type: 'select' }
    });
    const ESPESORES_PTR = Object.freeze([
        { id: 31, nombre: 'Cal.14', texto: 'Cal.14', codigo: 'C14', orden: 0.0747 },
        { id: 40, nombre: '1/4"', texto: "1/4''", codigo: 'E25', orden: 0.25 }
    ]);
    const linea = (id, desdeOrden, hastaOrden, medidaDesde, medidaHasta, precio) => ({
        id, desde_id: id * 10, desde_orden: desdeOrden, desde_tipo: 5, hasta_id: id * 10 + 1, hasta_orden: hastaOrden, hasta_tipo: 5,
        medida_desde: medidaDesde, medida_hasta: medidaHasta, precio_id: precio, margen_id: 900, precio_nombre: `FAM ${precio}`
    });
    const FAMILIAS_PTR = Object.freeze([
        linea(1, 0.0747, 0.0747, 0.5, 3.5, 23),
        linea(2, 0.0747, 0.0747, 4, 6, 24),
        linea(3, 0.1495, 0.5, 2, 6, 24)
    ]);
    const CAPTURA = Object.freeze({
        custpage_configuracion: '11', custpage_par_0: '1', custpage_par_1: '6', custpage_par_2: '31',
        custpage_peso: '10', custpage_conversion: '10'
    });
    const escenario = (ajustes = {}) => prepararEscenario(Object.assign({
        configuracion: CONFIGURACION_PTR, campos: CAMPOS_PTR, espesores: ESPESORES_PTR, familias: FAMILIAS_PTR
    }, ajustes));

    test('PTR 1" Cal.14 a 6.00m: itemid = nombre, displayname = código, FAM 23', () => {
        const { valoresAsignados } = escenario();
        ejecutar(solicitudCrear(CAPTURA));
        expect(valoresAsignados.itemid).toBe('PTR 1" x 1" Cal.14 a 6.00m');
        expect(valoresAsignados.displayname).toBe('PTRC100C14');
        expect(valoresAsignados.vendorname).toBe('PTRC100C14');
        expect(valoresAsignados.custitem_pfp_famprecios_).toBe('23');
    });

    test('PTR 4" Cal.14 toma FAM 24 por el lado', () => {
        const { valoresAsignados } = escenario();
        ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_0: '4' })));
        expect(valoresAsignados.displayname).toBe('PTRC400C14');
        expect(valoresAsignados.custitem_pfp_famprecios_).toBe('24');
    });

    test('PTR 3" 1/4" a 6.10m', () => {
        const { valoresAsignados } = escenario();
        ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_0: '3', custpage_par_1: '6.1', custpage_par_2: '40' })));
        expect(valoresAsignados.itemid).toBe("PTR 3\" x 3\" 1/4'' a 6.10m");
        expect(valoresAsignados.displayname).toBe('PTRC300E25');
        expect(valoresAsignados.custitem_pfp_famprecios_).toBe('24');
    });

    test('un lado sin rango de familia muestra error y no guarda', () => {
        const { copia } = escenario();
        esperarPaginaDeError(ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_0: '3.75' }))),
            'No hay una familia de precios única para este espesor en la naturaleza.');
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('un largo con más de 2 decimales repite el paso 2', () => {
        const { copia } = escenario();
        const formulario = ejecutar(solicitudCrear(Object.assign({}, CAPTURA, { custpage_par_1: '6.125' })));
        expect(textosDeMensajes(formulario)).toEqual(['Largo: capture un número mayor que 0 con máximo 2 decimales.']);
        expect(copia.save).not.toHaveBeenCalled();
    });

    test('un campo de medida que no es parámetro numérico es error de configuración', () => {
        escenario({ configuracion: Object.assign({}, CONFIGURACION_PTR, { custrecord_sads_naturaleza_campo_med: 'custitem_sads_nat_espesor' }) });
        esperarPaginaDeError(ejecutar(solicitudParametros({ custpage_configuracion: '11' })),
            'El campo de medida para familias debe ser un parámetro numérico de la configuración.');
    });
});
