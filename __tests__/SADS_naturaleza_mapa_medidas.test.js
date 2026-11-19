const fs = require('fs');
const path = require('path');

const mapaMedidas = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_mapa_medidas');
const familias = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_familias');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain', 'SADS_naturaleza_mapa_medidas.js'
);
const RUTA_CONFIG = path.join(__dirname, '..', 'src', 'Objects', 'Config');
const leerXml = (archivo) => fs.readFileSync(path.join(RUTA_CONFIG, archivo), 'utf8');

const instancias = (xml) => Array.from(xml.matchAll(/<instance scriptid="([^"]+)">([\s\S]*?)<\/instance>/g))
    .map((coincidencia) => ({ scriptid: coincidencia[1], cuerpo: coincidencia[2] }));
const campo = (cuerpo, id) => {
    const coincidencia = cuerpo.match(new RegExp(`<${id}>([^<]*)</${id}>`));
    return coincidencia === null ? '' : coincidencia[1];
};
const referencia = (valor) => valor.replace(/^\[scriptid=[a-z0-9_]+\./, '').replace(/\]$/, '');
const numero = (valor) => (valor === '' ? null : Number(valor));

// Mapa desplegado (Objects/Config/customrecord_sads_mapa_medidas_ptrr.xml).
const MAPA = instancias(leerXml('customrecord_sads_mapa_medidas_ptrr.xml')).map(({ scriptid, cuerpo }) => ({
    id: scriptid,
    nombre: campo(cuerpo, 'name').replace(/&quot;/g, '"'),
    ladoMayor: numero(campo(cuerpo, 'custrecord_sads_medptrr_lado_mayor')),
    ladoMenor: numero(campo(cuerpo, 'custrecord_sads_medptrr_lado_menor')),
    codigo: campo(cuerpo, 'custrecord_sads_medptrr_codigo')
}));

const ORDEN_POR_ESPESOR = instancias(leerXml('customrecord_sads_espesor.xml')).reduce((mapa, { scriptid, cuerpo }) => Object.assign(mapa, {
    [scriptid]: { orden: Number(campo(cuerpo, 'custrecord_sads_esp_orden')), codigo: campo(cuerpo, 'custrecord_sads_esp_codigo') }
}), {});
const ESPESOR_POR_CODIGO = Object.keys(ORDEN_POR_ESPESOR)
    .filter((scriptid) => /^val_sads_esp_ptr_/.test(scriptid))
    .reduce((mapa, scriptid) => Object.assign(mapa, { [ORDEN_POR_ESPESOR[scriptid].codigo]: ORDEN_POR_ESPESOR[scriptid].orden }), {});

const FAMILIA_POR_SCRIPTID = Object.freeze({
    val_26687_5490848_sb1_614: '022',
    val_263837_5490848_945: '098',
    val_26688_5490848_sb1_408: '023',
    val_26689_5490848_sb1_515: '024'
});

const lineasDe = (configuracion) => instancias(leerXml('customrecord_sads_nat_familia.xml'))
    .filter(({ cuerpo }) => referencia(campo(cuerpo, 'custrecord_sads_natfam_config')) === configuracion)
    .map(({ scriptid, cuerpo }) => {
        const desde = ORDEN_POR_ESPESOR[referencia(campo(cuerpo, 'custrecord_sads_natfam_desde'))];
        const hasta = ORDEN_POR_ESPESOR[referencia(campo(cuerpo, 'custrecord_sads_natfam_hasta'))];
        return {
            id: scriptid, desdeId: 'd', hastaId: 'h', desdeOrden: desde.orden, hastaOrden: hasta.orden, desdeTipo: 'ptr', hastaTipo: 'ptr',
            medidaDesde: numero(campo(cuerpo, 'custrecord_sads_natfam_med_desde')),
            medidaHasta: numero(campo(cuerpo, 'custrecord_sads_natfam_med_hasta')),
            familiaPrecioId: FAMILIA_POR_SCRIPTID[referencia(campo(cuerpo, 'custrecord_sads_natfam_precio'))],
            familiaMargenId: referencia(campo(cuerpo, 'custrecord_sads_natfam_margen'))
        };
    });

// RelacionPTRR_Familias.csv (usuario, 2026-11-19): ID interno, código del proveedor, espesor y familia de precio actual.
// Fuera de la tabla: 11222 PTRR201C12 (se corrige a mano), 13833 y 39405 PTRR604CE12, 1549 "x Metro" (MU PEDACERIA)
// y los descontinuados con sufijo "des" (1545, 1546, 8904, 1554, 1555, 1556).
const PTRR = [
    [11552, '100', 'C18', '022'], [11553, '100', 'C20', '022'], [11191, '150', 'C14', '023'], [11559, '125', 'C18', '022'],
    [11560, '125', 'C20', '022'], [11561, '175', 'C18', '022'], [11562, '175', 'C20', '022'], [11199, '200', 'C14', '023'],
    [11565, '200', 'C16', '098'], [11568, '200', 'C18', '022'], [11569, '200', 'C20', '022'], [11573, '250', 'C14', '023'],
    [11576, '250', 'C18', '022'], [11577, '250', 'C20', '022'], [11578, '249', 'C18', '022'], [11579, '249', 'C20', '022'],
    [11580, '225', 'C18', '022'], [11581, '225', 'C20', '022'], [11231, '300', 'C14', '023'], [11582, '300', 'C18', '022'],
    [11583, '300', 'C20', '022'], [11220, '302', 'C10', '023'], [11221, '302', 'C11', '023'], [11223, '302', 'C14', '023'],
    [11224, '302', 'E18', '024'], [11250, '400', 'C14', '024'], [11586, '400', 'C18', '022'], [11587, '400', 'C20', '022'],
    [12389, '402', 'E18', '024'], [11238, '402', 'C10', '024'], [11606, '402', 'C11', '024'], [11607, '402', 'C14', '024'],
    [11608, '402', 'E25', '024'], [11242, '403', 'C09', '024'], [11239, '403', 'C10', '024'], [11240, '403', 'C11', '024'],
    [11241, '403', 'C14', '024'], [11243, '403', 'E25', '024'], [11245, '403', 'E18', '024'], [11255, '502', 'E18', '024'],
    [10690, '502', 'E12', '024'], [11256, '503', 'C11', '024'], [11257, '503', 'E25', '024'], [12393, '503', 'E18', '024'],
    [11261, '602', 'E25', '024'], [11262, '602', 'E18', '024'], [11258, '602', 'C11', '024'], [11259, '602', 'C14', '024'],
    [12469, '603', 'C11', '024'], [11264, '604', 'E25', '024'], [11265, '604', 'E18', '024'], [11263, '604', 'C11', '024']
];

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba un error');
};

const fila = (id, ladoMayor, ladoMenor, codigo, nombre = `M${id}`) => ({ id, nombre, ladoMayor, ladoMenor, codigo });

describe('estructura del módulo', () => {
    const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');

    test('solo depende del formato de dominio y exporta la especificación', () => {
        expect(fuente.match(/define\(\s*\[([^\]]*)\]/)[1].trim()).toBe("'./SADS_naturaleza_config_formato'");
        expect(fuente).not.toMatch(/['"]N\//);
        expect(Object.keys(mapaMedidas).sort()).toEqual(['ERRORES', 'MARCADOR', 'buscar', 'textosDe', 'validarFilas', 'valoresDe']);
        expect(mapaMedidas.MARCADOR).toBe('mapa');
    });
});

describe('validarFilas (RN5-02)', () => {
    test('filas correctas', () => {
        expect(mapaMedidas.validarFilas([fila('1', 3, 2, '302'), fila('2', 3, 1.5, '300')])).toEqual({ valido: true, errores: [] });
    });

    test('mapa vacío', () => {
        expect(mapaMedidas.validarFilas([]).errores).toEqual(['El mapa de medidas no tiene medidas activas.']);
    });

    test('lados o código no válidos, lados invertidos, código y medida repetidos', () => {
        expect(mapaMedidas.validarFilas([
            fila('1', 3, 2, '302', 'A'),
            fila('2', null, 2, '303', 'B'),
            fila('3', 2, 3, '304', 'C'),
            fila('4', 4, 2, '302', 'D'),
            fila('5', 3, 2.0000001, '305', 'E'),
            fila('6', 4, 3, 'R-403', 'F')
        ]).errores).toEqual([
            'La medida B del mapa necesita lado mayor y lado menor mayores que 0 y un código de letras y dígitos.',
            'La medida C del mapa tiene el lado menor mayor que el lado mayor.',
            'El código 302 se repite en el mapa de medidas.',
            'La medida E se repite en el mapa de medidas.',
            'La medida F del mapa necesita lado mayor y lado menor mayores que 0 y un código de letras y dígitos.'
        ]);
    });
});

describe('buscar, valoresDe y textosDe (RN5-03, RN5-04)', () => {
    const filas = [fila('7', 3, 2, '302', '3" x 2" (R-302)')];

    test('la medida elegida llena los lados y el marcador', () => {
        const elegida = mapaMedidas.buscar(filas, 7);
        expect(mapaMedidas.valoresDe(elegida, { mayor: 'lado', menor: 'lado_b' })).toEqual({ lado: 3, lado_b: 2 });
        expect(mapaMedidas.textosDe(elegida)).toEqual({ mapa: { codigo: '302', texto: '3" x 2" (R-302)' } });
    });

    test('un ID fuera del mapa es error de dominio', () => {
        [undefined, '', '8'].forEach((id) => {
            const error = capturarError(() => mapaMedidas.buscar(filas, id));
            expect(error.name).toBe('MAPA_INVALIDO');
            expect(error.message).toBe('La medida elegida no está en el mapa de medidas.');
        });
    });
});

describe('mapa desplegado contra el catálogo del proveedor y los artículos existentes', () => {
    test('24 medidas válidas con scriptid val_sads_medptrr_r<código>', () => {
        expect(MAPA).toHaveLength(24);
        expect(mapaMedidas.validarFilas(MAPA)).toEqual({ valido: true, errores: [] });
        MAPA.forEach((medida) => expect(medida.id).toBe(`val_sads_medptrr_r${medida.codigo}`));
    });

    test('ejemplos del catálogo: R-302 = 3" x 2"; R-249 = 2 1/2" x 1 1/4"; R-155 = 1 1/2" x 1/2"', () => {
        const porCodigo = (codigo) => MAPA.filter((medida) => medida.codigo === codigo)[0];
        expect(porCodigo('302')).toMatchObject({ ladoMayor: 3, ladoMenor: 2, nombre: '3" x 2" (R-302)' });
        expect(porCodigo('249')).toMatchObject({ ladoMayor: 2.5, ladoMenor: 1.25, nombre: '2 1/2" x 1 1/4" (R-249)' });
        expect(porCodigo('155')).toMatchObject({ ladoMayor: 1.5, ladoMenor: 0.5 });
    });

    test(`los ${PTRR.length} artículos tienen su código en el mapa`, () => {
        const codigos = MAPA.map((medida) => medida.codigo);
        expect(PTRR.filter(([, codigo]) => codigos.indexOf(codigo) === -1)).toEqual([]);
    });

    ['val_sads_nat_config_record_ptrr', 'val_sads_nat_config_record_mpptrr'].forEach((configuracion) => {
        test(`${configuracion}: cada artículo recibe su familia actual por espesor y lado mayor del mapa`, () => {
            const lineas = lineasDe(configuracion);
            expect(lineas).toHaveLength(5);
            const distintas = PTRR.filter(([, codigo, espesor, esperada]) => {
                const medida = MAPA.filter((elemento) => elemento.codigo === codigo)[0];
                const linea = familias.resolver({ lineas, orden: ESPESOR_POR_CODIGO[espesor], medida: medida.ladoMayor });
                return linea.familiaPrecioId !== esperada;
            });
            expect(distintas).toEqual([]);
        });
    });

    test('margen: PTR en PTRR y PTR Media Pieza en MPPTRR', () => {
        expect(lineasDe('val_sads_nat_config_record_ptrr').map((linea) => linea.familiaMargenId))
            .toEqual(Array(5).fill('val_5522235_5490848_713'));
        expect(lineasDe('val_sads_nat_config_record_mpptrr').map((linea) => linea.familiaMargenId))
            .toEqual(Array(5).fill('val_6067916_5490848_922'));
    });
});
