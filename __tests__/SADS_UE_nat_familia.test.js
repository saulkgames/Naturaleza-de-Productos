const fs = require('fs');
const path = require('path');

jest.mock('N/query', () => ({ runSuiteQL: jest.fn() }));
jest.mock('N/error', () => ({ create: jest.fn() }));
jest.mock('N/log', () => ({ audit: jest.fn(), debug: jest.fn(), error: jest.fn(), emergency: jest.fn() }));

const query = require('N/query');
const error = require('N/error');
const log = require('N/log');
const userEvent = require('SuiteScripts/SADS_Naturaleza_Productos/SADS_UE_nat_familia');

const RUTA_UE = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'SADS_UE_nat_familia.js'
);

const TIPOS_EVENTO = Object.freeze({ CREATE: 'create', EDIT: 'edit', XEDIT: 'xedit', DELETE: 'delete' });

const ESPESORES = Object.freeze({
    501: { orden: 0.1875, tipo: 1 },
    503: { orden: 0.625, tipo: 1 },
    504: { orden: 0.75, tipo: 1 },
    505: { orden: 1.5, tipo: 1 },
    601: { orden: 3.42, tipo: 2 }
});

const hermana = (id, desde, hasta) => ({
    id,
    desde_id: desde,
    desde_orden: desde === null ? null : ESPESORES[desde].orden,
    desde_tipo: desde === null ? null : ESPESORES[desde].tipo,
    hasta_id: hasta,
    hasta_orden: hasta === null ? null : ESPESORES[hasta].orden,
    hasta_tipo: hasta === null ? null : ESPESORES[hasta].tipo,
    precio_id: 68,
    margen_id: 7
});

const LINEA_NUEVA = Object.freeze({
    custrecord_sads_natfam_config: '11',
    custrecord_sads_natfam_desde: '504',
    custrecord_sads_natfam_hasta: '505',
    custrecord_sads_natfam_precio: '69',
    custrecord_sads_natfam_margen: '8',
    isinactive: false
});

const prepararConsultas = ({ tipo = 1, hermanas = [hermana(1, 501, 503)] } = {}) => {
    query.runSuiteQL.mockImplementation((consulta) => {
        const sql = consulta.query;
        let filas;
        if (/from\s+customrecord_sads_naturaleza_productos\b/i.test(sql)) filas = [{ tipo }];
        else if (/from\s+customrecord_sads_nat_familia\b/i.test(sql)) filas = hermanas;
        else if (/from\s+customrecord_sads_espesor\b/i.test(sql)) {
            filas = consulta.params
                .filter((id) => Object.prototype.hasOwnProperty.call(ESPESORES, id))
                .map((id) => Object.assign({ id: Number(id) }, ESPESORES[id]));
        } else throw new Error(`Consulta no esperada: ${sql}`);
        return { asMappedResults: () => filas.map((fila) => Object.assign({}, fila)) };
    });
    error.create.mockImplementation((opciones) => {
        const creado = new Error(opciones.message);
        creado.name = opciones.name;
        creado.notifyOff = opciones.notifyOff;
        return creado;
    });
};

const crearRegistroFalso = (valores, id, enviados) => ({
    id,
    getValue: jest.fn((opciones) => (Object.prototype.hasOwnProperty.call(valores, opciones.fieldId) ? valores[opciones.fieldId] : '')),
    getFields: jest.fn(() => (enviados === undefined ? Object.keys(valores) : enviados.slice()))
});

const crearContexto = ({ tipo = TIPOS_EVENTO.CREATE, nuevos = LINEA_NUEVA, anteriores = null, id = undefined } = {}) => ({
    type: tipo,
    UserEventType: TIPOS_EVENTO,
    newRecord: crearRegistroFalso(nuevos, id),
    oldRecord: anteriores === null ? null : crearRegistroFalso(anteriores, id)
});

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
    expect(rechazo.name).toBe('FAMILIA_NATURALEZA_INVALIDA');
    expect(error.create.mock.calls[0][0].notifyOff).toBe(true);
    expect(log.error).not.toHaveBeenCalled();
    return rechazo.message.replace(/^La familia por espesor no es válida: /, '').split('; ');
};

const lineaCon = (ajuste) => Object.assign({}, LINEA_NUEVA, ajuste);

beforeEach(() => {
    jest.resetAllMocks();
    prepararConsultas();
});

describe('estructura del módulo', () => {
    const fuente = fs.readFileSync(RUTA_UE, 'utf8');

    test('exporta solo beforeSubmit y declara el encabezado de UserEventScript 2.1', () => {
        expect(Object.keys(userEvent)).toEqual(['beforeSubmit']);
        expect(fuente).toMatch(/@NApiVersion 2\.1\b/);
        expect(fuente).toMatch(/@NScriptType UserEventScript\b/);
        expect(fuente).toMatch(/@NModuleScope SameAccount\b/);
    });

    test('depende solo de N/error, N/query, N/log y el dominio', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        const dependencias = definicion[1].split(',').map((d) => d.trim().replace(/^['"]|['"]$/g, '')).filter((d) => d !== '');
        expect(dependencias).toEqual([
            'N/error', 'N/query', 'N/log', './domain/SADS_naturaleza_config_formato', './domain/SADS_naturaleza_familias'
        ]);
        expect(fuente).not.toMatch(/\?\./);
        expect(fuente).not.toMatch(/\?\?/);
        expect(fuente).not.toMatch(/\bconsole\./);
    });
});

describe('beforeSubmit', () => {
    test('una línea con rango sin traslape se acepta', () => {
        expect(() => userEvent.beforeSubmit(crearContexto())).not.toThrow();
        const hermanas = query.runSuiteQL.mock.calls.map((llamada) => llamada[0]).filter((c) => /nat_familia/.test(c.query));
        expect(hermanas[0].params).toEqual(['11', 0]);
    });

    test('en EDIT excluye la propia línea de las hermanas', () => {
        prepararConsultas({ hermanas: [hermana(1, 501, 503)] });
        userEvent.beforeSubmit(crearContexto({ tipo: TIPOS_EVENTO.EDIT, id: 2 }));
        const hermanas = query.runSuiteQL.mock.calls.map((llamada) => llamada[0]).filter((c) => /nat_familia/.test(c.query));
        expect(hermanas[0].params).toEqual(['11', '2']);
    });

    test('P3-14: una línea traslapada se rechaza', () => {
        prepararConsultas({ hermanas: [hermana(1, 501, 504)] });
        expect(esperarRechazo(crearContexto())).toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });

    test('P3-14: una familia única con hermanas se rechaza', () => {
        expect(esperarRechazo(crearContexto({
            nuevos: lineaCon({ custrecord_sads_natfam_desde: '', custrecord_sads_natfam_hasta: '' })
        }))).toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });

    test('P3-14: un espesor de otro tipo se rechaza', () => {
        expect(esperarRechazo(crearContexto({ nuevos: lineaCon({ custrecord_sads_natfam_hasta: '601' }) })))
            .toEqual(['Los espesores desde y hasta deben ser del tipo de espesor de la naturaleza.']);
    });

    test('RN3-07: una naturaleza sin tipo de espesor solo admite familia única', () => {
        prepararConsultas({ tipo: null, hermanas: [] });
        expect(esperarRechazo(crearContexto())).toEqual(['La naturaleza no usa espesor: no admite rango de espesor.']);
        jest.clearAllMocks();
        prepararConsultas({ tipo: null, hermanas: [] });
        expect(() => userEvent.beforeSubmit(crearContexto({
            nuevos: lineaCon({ custrecord_sads_natfam_desde: '', custrecord_sads_natfam_hasta: '' })
        }))).not.toThrow();
    });

    test('P3-19: un XEDIT que solo cambia "hasta" valida con el resto de campos de oldRecord', () => {
        prepararConsultas({ hermanas: [hermana(1, 501, 503)] });
        const contexto = crearContexto({
            tipo: TIPOS_EVENTO.XEDIT,
            id: 2,
            nuevos: { custrecord_sads_natfam_hasta: '503' },
            anteriores: LINEA_NUEVA
        });
        expect(esperarRechazo(contexto)).toEqual(['El espesor desde debe ser menor o igual que el espesor hasta.']);
        expect(contexto.oldRecord.getValue).toHaveBeenCalledWith({ fieldId: 'custrecord_sads_natfam_desde' });
    });

    test('una línea inactiva no se valida', () => {
        expect(() => userEvent.beforeSubmit(crearContexto({ nuevos: lineaCon({ isinactive: 'T', custrecord_sads_natfam_hasta: '' }) })))
            .not.toThrow();
        expect(query.runSuiteQL).not.toHaveBeenCalled();
    });

    test('DELETE no hace nada', () => {
        userEvent.beforeSubmit(crearContexto({ tipo: TIPOS_EVENTO.DELETE }));
        expect(query.runSuiteQL).not.toHaveBeenCalled();
    });

    test('un error de consulta se registra y se relanza', () => {
        query.runSuiteQL.mockImplementation(() => {
            throw new Error('SSS_SEARCH_ERROR');
        });
        expect(() => userEvent.beforeSubmit(crearContexto())).toThrow('SSS_SEARCH_ERROR');
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(error.create).not.toHaveBeenCalled();
    });
});

describe('rango de medida en la línea de familia (D-21)', () => {
    test('mismo espesor con otro rango de lado se acepta', () => {
        prepararConsultas({ hermanas: [Object.assign(hermana(1, 504, 505), { medida_desde: 0.5, medida_hasta: 3.5 })] });
        expect(() => userEvent.beforeSubmit(crearContexto({
            nuevos: lineaCon({ custrecord_sads_natfam_med_desde: 4, custrecord_sads_natfam_med_hasta: 6 })
        }))).not.toThrow();
    });

    test('mismo espesor y lados traslapados se rechaza', () => {
        prepararConsultas({ hermanas: [Object.assign(hermana(1, 504, 505), { medida_desde: 0.5, medida_hasta: 3.5 })] });
        expect(esperarRechazo(crearContexto({
            nuevos: lineaCon({ custrecord_sads_natfam_med_desde: 3, custrecord_sads_natfam_med_hasta: 6 })
        }))).toEqual(['El rango se traslapa con otra línea de la naturaleza.']);
    });
});
