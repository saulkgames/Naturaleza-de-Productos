const fs = require('fs');
const path = require('path');

jest.mock('N/query', () => ({ runSuiteQL: jest.fn() }));
jest.mock('N/record', () => ({ create: jest.fn() }));
jest.mock('N/ui/serverWidget', () => {
    const stub = jest.requireActual('N/ui/serverWidget');
    return {
        createForm: jest.fn(),
        FieldType: stub.FieldType,
        FieldDisplayType: stub.FieldDisplayType,
        SublistType: stub.SublistType
    };
});
jest.mock('N/ui/message', () => ({ Type: jest.requireActual('N/ui/message').Type }));
jest.mock('N/runtime', () => ({
    getCurrentScript: jest.fn(),
    getCurrentUser: jest.fn(),
    Permission: jest.requireActual('N/runtime').Permission
}));
jest.mock('N/url', () => ({ resolveScript: jest.fn(), resolveRecord: jest.fn() }));
jest.mock('N/log', () => ({ audit: jest.fn(), debug: jest.fn(), error: jest.fn(), emergency: jest.fn() }));

const query = require('N/query');
const record = require('N/record');
const serverWidget = require('N/ui/serverWidget');
const message = require('N/ui/message');
const runtime = require('N/runtime');
const url = require('N/url');
const log = require('N/log');
const formato = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_config_formato');
const reglas = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_alta_reglas');
const suitelet = require('SuiteScripts/SADS_Naturaleza_Productos/SADS_SL_naturaleza_config');

const { FieldType, FieldDisplayType, SublistType } = serverWidget;

const RUTA_SUITELET = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'SADS_SL_naturaleza_config.js'
);

const REGISTRO_CONFIGURACION = 'customrecord_sads_naturaleza_productos';
const SUBLISTA = 'custpage_campos';
const SCRIPT_ID = 'customscript_sads_sl_naturaleza_config';
const DEPLOYMENT_ID = 'customdeploy_sads_sl_naturaleza_config';
const URL_SUITELET = '/app/site/hosting/scriptlet.nl?script=101&deploy=1';
const URL_SUITELET_ESCAPADA = '/app/site/hosting/scriptlet.nl?script=101&amp;deploy=1';
const URL_REGISTRO = '/app/common/custom/custrecordentry.nl?rectype=55&id=501';
const URL_REGISTRO_ESCAPADA = '/app/common/custom/custrecordentry.nl?rectype=55&amp;id=501';
const ID_REGISTRO_CREADO = 501;

const MENSAJES = Object.freeze({
    GENERICO: 'No fue posible completar la operación. Contacte al administrador.',
    SIN_NATURALEZAS: 'Todas las naturalezas ya tienen configuración.',
    SIN_TIPOS: 'No hay tipos de artículo activos.',
    CATALOGO_VACIO: 'No hay campos personalizados activos para este tipo de artículo.',
    CREACION_DESHABILITADA: 'La creación está deshabilitada en este despliegue.',
    CREADA: 'La configuración se creó correctamente.',
    SELECCION_VACIA: 'Marque al menos un campo.',
    NATURALEZA_INVALIDA: 'La naturaleza seleccionada no es válida.',
    NATURALEZA_NO_DISPONIBLE: 'La naturaleza seleccionada no está disponible o ya tiene configuración.',
    TIPO_NO_DISPONIBLE: 'El tipo de artículo seleccionado no está disponible.',
    CAMPO_NO_CITABLE: 'Uno de los campos marcados no pertenece al catálogo del tipo de artículo seleccionado.'
});

const NATURALEZAS = [
    { id: 1, nombre: 'Placas de Acero' },
    { id: 7, nombre: 'Naturaleza de prueba' }
];

const TIPOS = [
    { id: 3, nombre: 'Kit', scriptid: 'VAL_SADS_TA_KIT' },
    { id: 5, nombre: 'Servicio', scriptid: 'VAL_SADS_TA_SERV' }
];

const CAMPOS_ARTICULO = [
    { scriptid: 'CUSTITEM_PESO', etiqueta: 'Peso' },
    { scriptid: 'CUSTITEM_SADS_NATURALEZA_PRODUCTO', etiqueta: 'Naturaleza de producto' },
    { scriptid: 'CUSTITEM_COLOR', etiqueta: 'Color' },
    { scriptid: 'CUSTITEM_SOLO_SERVICIO', etiqueta: 'Solo servicio' }
];

const CAMPOS_DEL_KIT = ['itemid', 'displayname', 'CUSTITEM_PESO', 'custitem_color', 'custitem_sads_naturaleza_producto'];

const CATALOGO_KIT = [
    { custpage_etiqueta: 'Color', custpage_id: 'custitem_color' },
    { custpage_etiqueta: 'Peso', custpage_id: 'custitem_peso' }
];

const ELECCION_VALIDA = Object.freeze({ custpage_naturaleza: '1', custpage_tipo_art: '3' });

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

const crearSublistaFalsa = (definicion) => {
    const sublista = {
        id: definicion.id,
        label: definicion.label,
        type: definicion.type,
        campos: {},
        lineas: [],
        conBotonesMarcar: false,
        addField: jest.fn((campo) => registrarSinDuplicar(sublista.campos, campo.id, crearCampoFalso(campo))),
        addMarkAllButtons: jest.fn(() => {
            sublista.conBotonesMarcar = true;
            return [];
        }),
        setSublistValue: jest.fn((opciones) => {
            if (typeof opciones.value !== 'string' || opciones.value === '') {
                throw new Error(`setSublistValue sin valor textual en ${opciones.id}`);
            }
            sublista.lineas[opciones.line] = Object.assign({}, sublista.lineas[opciones.line], {
                [opciones.id]: opciones.value
            });
        })
    };
    return sublista;
};

const crearFormularioFalso = (definicion) => {
    const formulario = {
        title: definicion.title,
        campos: {},
        sublistas: {},
        mensajes: [],
        botones: [],
        addField: jest.fn((campo) => registrarSinDuplicar(formulario.campos, campo.id, crearCampoFalso(campo))),
        addSublist: jest.fn((sublista) => registrarSinDuplicar(
            formulario.sublistas, sublista.id, crearSublistaFalsa(sublista)
        )),
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

const crearSolicitud = ({ metodo, parametros = {}, lineas = null }) => ({
    method: metodo,
    parameters: parametros,
    getLineCount: jest.fn((opciones) => (lineas !== null && opciones.group === SUBLISTA ? lineas.length : -1)),
    getSublistValue: jest.fn((opciones) => {
        const fila = lineas !== null && opciones.group === SUBLISTA ? lineas[opciones.line] : undefined;
        return fila === undefined ? null : fila[opciones.name];
    })
});

const solicitudGet = (parametros) => crearSolicitud({ metodo: 'GET', parametros });

const solicitudCatalogo = (parametros) => crearSolicitud({
    metodo: 'POST',
    parametros: Object.assign({ custpage_accion: 'catalogo' }, parametros)
});

const solicitudCrear = (parametros, lineas) => crearSolicitud({
    metodo: 'POST',
    parametros: Object.assign({ custpage_accion: 'crear' }, parametros),
    lineas
});

const linea = (idCampo, marcada) => ({
    custpage_sel: marcada ? 'T' : 'F',
    custpage_id: idCampo,
    custpage_etiqueta: idCampo
});

const filasPara = (sql, datos) => {
    const copiar = (filas) => filas.map((fila) => Object.assign({}, fila));
    if (/from\s+customlist_sads_naturaleza_productos\b/i.test(sql)) return copiar(datos.naturalezas);
    if (/from\s+customlist_sads_tipos_articulo\b/i.test(sql)) return copiar(datos.tipos);
    if (/from\s+customfield\b/i.test(sql)) return copiar(datos.campos);
    throw new Error(`Consulta no esperada en la prueba: ${sql}`);
};

const prepararEscenario = (ajustes = {}) => {
    const datos = Object.assign({
        naturalezas: NATURALEZAS,
        tipos: TIPOS,
        campos: CAMPOS_ARTICULO,
        camposDelTipo: CAMPOS_DEL_KIT,
        permitirAlta: true,
        permiso: runtime.Permission.VIEW,
        errorDePermiso: null,
        errorDeConsulta: null,
        errorAlCrearArticulo: null,
        errorAlGuardar: null
    }, ajustes);

    serverWidget.createForm.mockImplementation((definicion) => crearFormularioFalso(definicion));
    query.runSuiteQL.mockImplementation((consulta) => {
        if (datos.errorDeConsulta !== null) throw datos.errorDeConsulta;
        return { asMappedResults: () => filasPara(consulta.query, datos) };
    });

    const configuracion = {
        setValue: jest.fn(),
        save: jest.fn(() => {
            if (datos.errorAlGuardar !== null) throw datos.errorAlGuardar;
            return ID_REGISTRO_CREADO;
        })
    };
    const articulo = {
        getFields: jest.fn(() => datos.camposDelTipo.slice()),
        save: jest.fn()
    };
    record.create.mockImplementation((definicion) => {
        if (definicion.type === REGISTRO_CONFIGURACION) return configuracion;
        if (datos.errorAlCrearArticulo !== null) throw datos.errorAlCrearArticulo;
        return articulo;
    });

    runtime.getCurrentScript.mockReturnValue({
        id: SCRIPT_ID,
        deploymentId: DEPLOYMENT_ID,
        getParameter: jest.fn((parametro) => (
            parametro.name === 'custscript_sads_sl_permitir_alta' ? datos.permitirAlta : null
        ))
    });
    runtime.getCurrentUser.mockReturnValue({
        getPermission: jest.fn(() => {
            if (datos.errorDePermiso !== null) throw datos.errorDePermiso;
            return datos.permiso;
        })
    });
    url.resolveScript.mockReturnValue(URL_SUITELET);
    url.resolveRecord.mockReturnValue(URL_REGISTRO);
    return { configuracion, articulo };
};

const ejecutar = (solicitud) => {
    const respuesta = { writePage: jest.fn(), write: jest.fn() };
    suitelet.onRequest({ request: solicitud, response: respuesta });
    expect(respuesta.writePage).toHaveBeenCalledTimes(1);
    expect(respuesta.write).not.toHaveBeenCalled();
    return respuesta.writePage.mock.calls[0][0];
};

const textosDeMensajes = (formulario) => formulario.mensajes.map((mensaje) => mensaje.message);

const lineasDe = (formulario) => formulario.sublistas[SUBLISTA].lineas.map((fila) => Object.assign({}, fila));

const opcionesSeleccionadas = (campo) => campo.opciones.filter((opcion) => opcion.isSelected === true);

const textoDePagina = (formulario) => JSON.stringify({
    titulo: formulario.title,
    mensajes: formulario.mensajes,
    campos: Object.keys(formulario.campos).map((id) => {
        const campo = formulario.campos[id];
        return { id, etiqueta: campo.label, valor: campo.defaultValue, opciones: campo.opciones };
    }),
    sublistas: Object.keys(formulario.sublistas).map((id) => formulario.sublistas[id].lineas)
});

const consultasEjecutadas = () => query.runSuiteQL.mock.calls.map((llamada) => llamada[0]);

const seCreoConfiguracion = () => record.create.mock.calls.some((llamada) => llamada[0].type === REGISTRO_CONFIGURACION);

const crearErrorNetSuite = (nombre, mensaje) => {
    const error = new Error(mensaje);
    error.name = nombre;
    return error;
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

    test('depende solo de los módulos N/ de la especificación y de los dos módulos de dominio', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        expect(definicion).not.toBeNull();
        const dependencias = definicion[1]
            .split(',')
            .map((dependencia) => dependencia.trim().replace(/^['"]|['"]$/g, ''))
            .filter((dependencia) => dependencia !== '');
        expect(dependencias).toEqual([
            'N/ui/serverWidget',
            'N/ui/message',
            'N/query',
            'N/record',
            'N/runtime',
            'N/url',
            'N/log',
            './domain/SADS_naturaleza_config_formato',
            './domain/SADS_naturaleza_alta_reglas'
        ]);
    });

    test('no usa encadenamiento opcional, fusión de nulos ni console', () => {
        expect(fuente).not.toMatch(/\?\./);
        expect(fuente).not.toMatch(/\?\?/);
        expect(fuente).not.toMatch(/\bconsole\./);
    });
});

describe('paso 1 (GET)', () => {
    test('muestra naturalezas y tipos obligatorios con opción vacía inicial y botón Siguiente', () => {
        prepararEscenario();
        const formulario = ejecutar(solicitudGet());

        expect(formulario.title).toContain('Paso 1 de 2');
        expect(formulario.mensajes).toEqual([]);
        expect(formulario.campos.custpage_naturaleza).toMatchObject({ type: FieldType.SELECT, isMandatory: true });
        expect(formulario.campos.custpage_naturaleza.opciones).toEqual([
            { value: '', text: '' },
            { value: '1', text: 'Placas de Acero', isSelected: false },
            { value: '7', text: 'Naturaleza de prueba', isSelected: false }
        ]);
        expect(formulario.campos.custpage_tipo_art).toMatchObject({ type: FieldType.SELECT, isMandatory: true });
        expect(formulario.campos.custpage_tipo_art.opciones).toEqual([
            { value: '', text: '' },
            { value: '3', text: 'Kit', isSelected: false },
            { value: '5', text: 'Servicio', isSelected: false }
        ]);
        expect(formulario.campos.custpage_accion).toMatchObject({
            tipoDeDespliegue: FieldDisplayType.HIDDEN,
            defaultValue: 'catalogo'
        });
        expect(formulario.botones).toEqual(['Siguiente']);
        expect(formulario.sublistas).toEqual({});
        expect(consultasEjecutadas()).toHaveLength(2);
        consultasEjecutadas().forEach((consulta) => expect(consulta.params).toEqual([]));
        expect(record.create).not.toHaveBeenCalled();
        expect(log.error).not.toHaveBeenCalled();
    });

    test('sin naturalezas disponibles muestra el aviso informativo y no ofrece Siguiente', () => {
        prepararEscenario({ naturalezas: [] });
        const formulario = ejecutar(solicitudGet());

        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.INFORMATION, message: MENSAJES.SIN_NATURALEZAS })
        ]);
        expect(formulario.campos).toEqual({});
        expect(formulario.botones).toEqual([]);
    });

    test('sin tipos de artículo activos muestra el aviso informativo y no ofrece Siguiente', () => {
        prepararEscenario({ tipos: [] });
        const formulario = ejecutar(solicitudGet());

        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.INFORMATION, message: MENSAJES.SIN_TIPOS })
        ]);
        expect(formulario.campos).toEqual({});
        expect(formulario.botones).toEqual([]);
    });

    test.each([
        ['GET aunque traiga custpage_accion=crear', 'GET', 'crear'],
        ['POST con una acción desconocida', 'POST', 'borrar'],
        ['POST sin acción', 'POST', undefined]
    ])('%s muestra el paso 1 sin crear nada', (descripcion, metodo, accion) => {
        const { configuracion } = prepararEscenario();
        const formulario = ejecutar(crearSolicitud({
            metodo,
            parametros: Object.assign({ custpage_accion: accion }, ELECCION_VALIDA),
            lineas: [linea('custitem_color', true)]
        }));

        expect(formulario.title).toContain('Paso 1 de 2');
        expect(formulario.botones).toEqual(['Siguiente']);
        expect(record.create).not.toHaveBeenCalled();
        expect(configuracion.save).not.toHaveBeenCalled();
    });
});

describe('paso 2 (POST accion=catalogo)', () => {
    test('arma el catálogo con los campos del artículo en memoria, sin el campo gatillo y ordenado por etiqueta', () => {
        const { articulo } = prepararEscenario();
        const formulario = ejecutar(solicitudCatalogo({ custpage_naturaleza: ' 1 ', custpage_tipo_art: '3' }));

        expect(formulario.title).toContain('Paso 2 de 2');
        expect(formulario.mensajes).toEqual([]);
        expect(record.create).toHaveBeenCalledTimes(1);
        expect(record.create).toHaveBeenCalledWith({ type: 'kititem', isDynamic: true });
        expect(articulo.getFields).toHaveBeenCalledTimes(1);
        expect(articulo.save).not.toHaveBeenCalled();

        const consultaDeCampos = consultasEjecutadas().find((consulta) => /from\s+customfield\b/i.test(consulta.query));
        expect(consultaDeCampos.params).toEqual(['ITEM', 'custitem%']);

        const sublista = formulario.sublistas[SUBLISTA];
        expect(sublista.type).toBe(SublistType.LIST);
        expect(sublista.conBotonesMarcar).toBe(true);
        expect(sublista.campos.custpage_sel).toMatchObject({
            type: FieldType.CHECKBOX,
            tipoDeDespliegue: FieldDisplayType.ENTRY
        });
        expect(sublista.campos.custpage_etiqueta.type).toBe(FieldType.TEXT);
        expect(sublista.campos.custpage_id.type).toBe(FieldType.TEXT);
        expect(lineasDe(formulario)).toEqual(CATALOGO_KIT);

        expect(formulario.campos.custpage_naturaleza_texto).toMatchObject({
            type: FieldType.TEXT,
            tipoDeDespliegue: FieldDisplayType.INLINE,
            defaultValue: 'Placas de Acero'
        });
        expect(formulario.campos.custpage_tipo_art_texto).toMatchObject({
            type: FieldType.TEXT,
            tipoDeDespliegue: FieldDisplayType.INLINE,
            defaultValue: 'Kit'
        });
        expect(formulario.campos.custpage_naturaleza).toMatchObject({
            tipoDeDespliegue: FieldDisplayType.HIDDEN,
            defaultValue: '1'
        });
        expect(formulario.campos.custpage_tipo_art).toMatchObject({
            tipoDeDespliegue: FieldDisplayType.HIDDEN,
            defaultValue: '3'
        });
        expect(formulario.campos.custpage_accion).toMatchObject({
            tipoDeDespliegue: FieldDisplayType.HIDDEN,
            defaultValue: 'crear'
        });
        expect(formulario.campos.custpage_enlace_inicio).toMatchObject({
            type: FieldType.INLINEHTML,
            defaultValue: enlace(URL_SUITELET_ESCAPADA, 'Regresar')
        });
        expect(url.resolveScript).toHaveBeenCalledWith({ scriptId: SCRIPT_ID, deploymentId: DEPLOYMENT_ID });
        expect(formulario.botones).toEqual(['Crear configuración']);
        expect(log.error).not.toHaveBeenCalled();
    });

    test('con una elección inválida regresa al paso 1 con el mensaje y los valores previos', () => {
        prepararEscenario();
        const formulario = ejecutar(solicitudCatalogo({ custpage_naturaleza: 'abc', custpage_tipo_art: '5' }));

        expect(formulario.title).toContain('Paso 1 de 2');
        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.ERROR, message: MENSAJES.NATURALEZA_INVALIDA })
        ]);
        expect(opcionesSeleccionadas(formulario.campos.custpage_naturaleza)).toEqual([]);
        expect(opcionesSeleccionadas(formulario.campos.custpage_tipo_art)).toEqual([
            { value: '5', text: 'Servicio', isSelected: true }
        ]);
        expect(formulario.botones).toEqual(['Siguiente']);
        expect(record.create).not.toHaveBeenCalled();
    });

    test('varios errores se muestran en un solo aviso separados por <br>', () => {
        prepararEscenario();
        const formulario = ejecutar(solicitudCatalogo({ custpage_naturaleza: '-1', custpage_tipo_art: '99' }));

        expect(textosDeMensajes(formulario)).toEqual([
            `${MENSAJES.NATURALEZA_INVALIDA}<br>${MENSAJES.TIPO_NO_DISPONIBLE}`
        ]);
    });

    test('con el catálogo vacío avisa y no ofrece Crear', () => {
        prepararEscenario({ camposDelTipo: ['itemid', 'custitem_sads_naturaleza_producto'] });
        const formulario = ejecutar(solicitudCatalogo(ELECCION_VALIDA));

        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.INFORMATION, message: MENSAJES.CATALOGO_VACIO })
        ]);
        expect(formulario.sublistas).toEqual({});
        expect(formulario.botones).toEqual([]);
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Regresar'));
    });
});

describe('P-19: parámetro custscript_sads_sl_permitir_alta', () => {
    test('en F el paso 2 muestra el catálogo sin botón Crear y avisa que la creación está deshabilitada', () => {
        prepararEscenario({ permitirAlta: false });
        const formulario = ejecutar(solicitudCatalogo(ELECCION_VALIDA));

        expect(formulario.title).toContain('Paso 2 de 2');
        expect(lineasDe(formulario)).toEqual(CATALOGO_KIT);
        expect(formulario.botones).toEqual([]);
        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.WARNING, message: MENSAJES.CREACION_DESHABILITADA })
        ]);
    });

    test('en F una solicitud accion=crear no crea el registro y regresa al paso 2 con las casillas enviadas', () => {
        const { configuracion } = prepararEscenario({ permitirAlta: false });
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, [
            linea('custitem_peso', true),
            linea('custitem_color', false)
        ]));

        expect(seCreoConfiguracion()).toBe(false);
        expect(configuracion.setValue).not.toHaveBeenCalled();
        expect(configuracion.save).not.toHaveBeenCalled();
        expect(log.audit).not.toHaveBeenCalled();
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.CREACION_DESHABILITADA]);
        expect(lineasDe(formulario)).toEqual([
            { custpage_etiqueta: 'Color', custpage_id: 'custitem_color' },
            { custpage_sel: 'T', custpage_etiqueta: 'Peso', custpage_id: 'custitem_peso' }
        ]);
        expect(formulario.botones).toEqual([]);
    });

    test.each([
        [true, ['Crear configuración']],
        ['T', ['Crear configuración']],
        [false, []],
        ['F', []],
        [null, []],
        ['', []]
    ])('con el parámetro en %p los botones del paso 2 son %p', (valor, botones) => {
        prepararEscenario({ permitirAlta: valor });
        expect(ejecutar(solicitudCatalogo(ELECCION_VALIDA)).botones).toEqual(botones);
    });
});

describe('creación (POST accion=crear)', () => {
    test('crea el registro con nombre, naturaleza, tipo y JSON ordenado; registra log.audit y confirma', () => {
        const { configuracion, articulo } = prepararEscenario();
        const formulario = ejecutar(solicitudCrear(
            Object.assign({ custpage_naturaleza_texto: 'Texto manipulado en el formulario' }, ELECCION_VALIDA),
            [
                linea('custitem_peso', true),
                linea('custitem_color', true),
                linea(' CUSTITEM_PESO ', true),
                linea('custitem_no_marcado', false)
            ]
        ));

        expect(record.create).toHaveBeenCalledWith({ type: 'kititem', isDynamic: true });
        expect(record.create).toHaveBeenCalledWith({ type: REGISTRO_CONFIGURACION });
        expect(articulo.save).not.toHaveBeenCalled();
        expect(configuracion.setValue.mock.calls.map((llamada) => llamada[0])).toEqual([
            { fieldId: 'name', value: 'Placas de Acero' },
            { fieldId: 'custrecord_sads_naturaleza_lista', value: '1' },
            { fieldId: 'custrecord_sads_naturaleza_tipo_art', value: '3' },
            { fieldId: 'custrecord_sads_naturaleza_config', value: '["custitem_color","custitem_peso"]' }
        ]);
        expect(configuracion.save).toHaveBeenCalledTimes(1);
        expect(configuracion.save).toHaveBeenCalledWith({ ignoreMandatoryFields: false });

        const json = configuracion.setValue.mock.calls[3][0].value;
        expect(formato.esConfiguracionValida(json)).toBe(true);
        expect(JSON.parse(json)).toEqual(['custitem_color', 'custitem_peso']);

        expect(log.audit).toHaveBeenCalledTimes(1);
        const auditoria = log.audit.mock.calls[0][0].details;
        expect(auditoria).toContain(`ID: ${ID_REGISTRO_CREADO}`);
        expect(auditoria).toContain('Nombre: Placas de Acero');
        expect(auditoria).toContain('Tipo de artículo: Kit');
        expect(auditoria).toContain('Campos: 2');
        expect(log.error).not.toHaveBeenCalled();

        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.CONFIRMATION, message: MENSAJES.CREADA })
        ]);
        expect(formulario.campos.custpage_nombre_creado).toMatchObject({
            type: FieldType.TEXT,
            tipoDeDespliegue: FieldDisplayType.INLINE,
            defaultValue: 'Placas de Acero'
        });
        expect(formulario.campos.custpage_tipo_creado).toMatchObject({
            type: FieldType.TEXT,
            tipoDeDespliegue: FieldDisplayType.INLINE,
            defaultValue: 'Kit'
        });
        expect(formulario.campos.custpage_configuracion_creada).toMatchObject({
            type: FieldType.LONGTEXT,
            tipoDeDespliegue: FieldDisplayType.INLINE,
            defaultValue: json
        });
        expect(url.resolveRecord).toHaveBeenCalledWith({
            recordType: REGISTRO_CONFIGURACION,
            recordId: ID_REGISTRO_CREADO,
            isEditMode: false
        });
        expect(formulario.campos.custpage_enlace_registro).toMatchObject({
            type: FieldType.INLINEHTML,
            defaultValue: enlace(URL_REGISTRO_ESCAPADA, 'Ver registro')
        });
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Crear otra'));
        expect(formulario.botones).toEqual([]);
        expect(textoDePagina(formulario)).not.toContain('Texto manipulado');
    });

    test.each([
        ['el usuario no tiene permiso de vista sobre el registro', { permiso: runtime.Permission.NONE }],
        ['la consulta del permiso lanza un error', { errorDePermiso: new Error('Permiso no disponible') }]
    ])('si %s, la confirmación no muestra el enlace al registro', (descripcion, ajustes) => {
        const { configuracion } = prepararEscenario(ajustes);
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, [linea('custitem_color', true)]));

        expect(configuracion.save).toHaveBeenCalledTimes(1);
        expect(formulario.campos.custpage_enlace_registro).toBeUndefined();
        expect(url.resolveRecord).not.toHaveBeenCalled();
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Crear otra'));
        expect(log.error).not.toHaveBeenCalled();
    });

    test('P-12: con la validación fallida regresa al paso 2 con las casillas previas marcadas y el mensaje', () => {
        const { configuracion } = prepararEscenario();
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, [
            linea('custitem_color', true),
            linea('custitem_peso', false),
            linea('custitem_inexistente', true)
        ]));

        expect(seCreoConfiguracion()).toBe(false);
        expect(configuracion.save).not.toHaveBeenCalled();
        expect(formulario.title).toContain('Paso 2 de 2');
        expect(formulario.mensajes).toEqual([
            expect.objectContaining({
                type: message.Type.ERROR,
                message: 'El campo custitem_inexistente no pertenece al catálogo del tipo de artículo seleccionado.'
            })
        ]);
        expect(lineasDe(formulario)).toEqual([
            { custpage_sel: 'T', custpage_etiqueta: 'Color', custpage_id: 'custitem_color' },
            { custpage_etiqueta: 'Peso', custpage_id: 'custitem_peso' }
        ]);
        expect(formulario.campos.custpage_naturaleza.defaultValue).toBe('1');
        expect(formulario.campos.custpage_tipo_art.defaultValue).toBe('3');
        expect(formulario.campos.custpage_accion.defaultValue).toBe('crear');
        expect(formulario.botones).toEqual(['Crear configuración']);
    });

    test('RN-06: sin casillas marcadas regresa al paso 2 con el mensaje y no crea', () => {
        const { configuracion } = prepararEscenario();
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, null));

        expect(seCreoConfiguracion()).toBe(false);
        expect(configuracion.save).not.toHaveBeenCalled();
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.SELECCION_VACIA]);
        expect(lineasDe(formulario)).toEqual(CATALOGO_KIT);
    });

    test('RN-02: si la naturaleza ya no está disponible al crear, regresa al paso 1 sin crear', () => {
        const { configuracion } = prepararEscenario({ naturalezas: [{ id: 7, nombre: 'Naturaleza de prueba' }] });
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, [linea('custitem_color', true)]));

        expect(record.create).not.toHaveBeenCalled();
        expect(configuracion.save).not.toHaveBeenCalled();
        expect(formulario.title).toContain('Paso 1 de 2');
        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.ERROR, message: MENSAJES.NATURALEZA_NO_DISPONIBLE })
        ]);
        expect(opcionesSeleccionadas(formulario.campos.custpage_naturaleza)).toEqual([]);
        expect(opcionesSeleccionadas(formulario.campos.custpage_tipo_art)).toEqual([
            { value: '3', text: 'Kit', isSelected: true }
        ]);
        expect(consultasEjecutadas().some((consulta) => /from\s+customfield\b/i.test(consulta.query))).toBe(false);
    });

    test('XSS: un custpage_id malicioso no se refleja sin escapar ni llega a las consultas', () => {
        const { configuracion } = prepararEscenario();
        const malicioso = '<script>alert("x")</script>';
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, [
            linea('custitem_color', true),
            linea(malicioso, true)
        ]));

        expect(seCreoConfiguracion()).toBe(false);
        expect(configuracion.save).not.toHaveBeenCalled();
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.CAMPO_NO_CITABLE]);
        expect(textoDePagina(formulario)).not.toMatch(/<script/i);
        consultasEjecutadas().forEach((consulta) => {
            expect(consulta.query).not.toContain('script>');
            expect(JSON.stringify(consulta.params)).not.toContain('script>');
        });
        expect(lineasDe(formulario)).toEqual([
            { custpage_sel: 'T', custpage_etiqueta: 'Color', custpage_id: 'custitem_color' },
            { custpage_etiqueta: 'Peso', custpage_id: 'custitem_peso' }
        ]);
    });
});

describe('escape de etiquetas en la sublista', () => {
    test('la etiqueta de un campo con marcado se escribe escapada en la columna TEXT de la sublista LIST', () => {
        prepararEscenario({
            campos: [
                { scriptid: 'CUSTITEM_PESO', etiqueta: '<img src=x onerror=alert(1)> Peso & "kg"' },
                { scriptid: 'CUSTITEM_COLOR', etiqueta: 'Color' }
            ]
        });
        const formulario = ejecutar(solicitudCatalogo(ELECCION_VALIDA));

        const etiquetas = lineasDe(formulario).map((fila) => fila.custpage_etiqueta);
        expect(etiquetas).toContain('&lt;img src=x onerror=alert(1)&gt; Peso &amp; &quot;kg&quot;');
        expect(etiquetas).toContain('Color');
        expect(JSON.stringify(lineasDe(formulario))).not.toContain('<img');
        expect(lineasDe(formulario).map((fila) => fila.custpage_id).sort()).toEqual(['custitem_color', 'custitem_peso']);
    });
});

describe('manejo de errores', () => {
    test('si url.resolveScript también falla dentro del catch, muestra el mensaje genérico sin enlace y no deja escapar el error', () => {
        prepararEscenario({
            errorDeConsulta: crearErrorNetSuite('SSS_SEARCH_ERROR_OCCURRED', 'Detalle interno de la consulta')
        });
        url.resolveScript.mockImplementation(() => {
            throw crearErrorNetSuite('SSS_INVALID_SCRIPTLET_ID', 'Detalle interno de la URL');
        });
        const formulario = ejecutar(solicitudGet());

        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.GENERICO]);
        expect(formulario.campos.custpage_enlace_inicio).toBeUndefined();
        expect(textoDePagina(formulario)).not.toContain('Detalle interno');
        expect(textoDePagina(formulario)).not.toContain('SSS_');
        expect(log.error).toHaveBeenCalledTimes(2);
        expect(log.error.mock.calls[1][0].details).toContain('SSS_INVALID_SCRIPTLET_ID');
    });

    test('P-11: si runSuiteQL lanza, muestra solo el mensaje genérico y registra log.error', () => {
        prepararEscenario({
            errorDeConsulta: crearErrorNetSuite('SSS_SEARCH_ERROR_OCCURRED', 'Detalle interno de la consulta')
        });
        const formulario = ejecutar(solicitudGet());

        expect(formulario.mensajes).toEqual([
            expect.objectContaining({ type: message.Type.ERROR, message: MENSAJES.GENERICO })
        ]);
        expect(textoDePagina(formulario)).not.toContain('Detalle interno');
        expect(textoDePagina(formulario)).not.toContain('SSS_SEARCH_ERROR_OCCURRED');
        expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Regresar'));
        expect(formulario.botones).toEqual([]);
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.error.mock.calls[0][0].details).toContain('SSS_SEARCH_ERROR_OCCURRED: Detalle interno de la consulta');
    });

    test('P-13: si save lanza, muestra solo el mensaje genérico y no registra el alta', () => {
        const errorAlGuardar = crearErrorNetSuite('INVALID_FLD_VALUE', 'Valor inválido para custrecord_sads_naturaleza_config');
        const { configuracion } = prepararEscenario({ errorAlGuardar });
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, [linea('custitem_color', true)]));

        expect(configuracion.save).toHaveBeenCalledTimes(1);
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.GENERICO]);
        expect(textoDePagina(formulario)).not.toContain('INVALID_FLD_VALUE');
        expect(textoDePagina(formulario)).not.toContain('Valor inválido');
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.error.mock.calls[0][0].details).toContain('INVALID_FLD_VALUE');
        expect(log.audit).not.toHaveBeenCalled();
    });

    test('R-17: si record.create del tipo falla, registra el tipo y muestra el mensaje genérico sin catálogo parcial', () => {
        prepararEscenario({
            errorAlCrearArticulo: crearErrorNetSuite('INVALID_RCRD_TYPE', 'Tipo de registro no programable')
        });
        const formulario = ejecutar(solicitudCatalogo(ELECCION_VALIDA));

        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.GENERICO]);
        expect(formulario.sublistas).toEqual({});
        expect(formulario.botones).toEqual([]);
        expect(textoDePagina(formulario)).not.toContain('INVALID_RCRD_TYPE');
        expect(log.error).toHaveBeenCalledWith(expect.objectContaining({
            details: expect.stringContaining('Tipo de registro: kititem')
        }));
    });

    test('un error de dominio muestra su mensaje escapado para HTML y el enlace Regresar', () => {
        prepararEscenario();
        const errorDeDominio = formato.crearErrorDeDominio(
            formato.ERRORES.TIPO_ARTICULO_DESCONOCIDO,
            'Tipo <b>"x"</b> & \'y\''
        );
        const espia = jest.spyOn(reglas, 'resolverTipoArticulo').mockImplementation(() => {
            throw errorDeDominio;
        });
        try {
            const formulario = ejecutar(solicitudCatalogo(ELECCION_VALIDA));

            expect(espia).toHaveBeenCalledWith('val_sads_ta_kit');
            expect(formulario.mensajes).toEqual([
                expect.objectContaining({
                    type: message.Type.ERROR,
                    message: 'Tipo &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#x27;y&#x27;'
                })
            ]);
            expect(formulario.campos.custpage_enlace_inicio.defaultValue).toBe(enlace(URL_SUITELET_ESCAPADA, 'Regresar'));
            expect(formulario.sublistas).toEqual({});
            expect(log.error).toHaveBeenCalledWith(expect.objectContaining({
                details: expect.stringContaining('TIPO_ARTICULO_DESCONOCIDO')
            }));
        } finally {
            espia.mockRestore();
        }
    });

    test('un error que no es de dominio, aunque venga del dominio, muestra solo el mensaje genérico', () => {
        const { configuracion } = prepararEscenario({ naturalezas: [{ id: 1, nombre: '   ' }] });
        const formulario = ejecutar(solicitudCrear(ELECCION_VALIDA, [linea('custitem_color', true)]));

        expect(seCreoConfiguracion()).toBe(false);
        expect(configuracion.save).not.toHaveBeenCalled();
        expect(textosDeMensajes(formulario)).toEqual([MENSAJES.GENERICO]);
        expect(textoDePagina(formulario)).not.toContain('no tiene texto');
        expect(log.error).toHaveBeenCalledTimes(1);
    });
});
