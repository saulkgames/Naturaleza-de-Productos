const fs = require('fs');
const path = require('path');

const patron = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_patron');
const familias = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_familias');

// Lámina Negra (LNE): configuración, calibres y líneas de familia desplegados contra RelacionLNE_familias.xlsx (2026-11-19).
const RUTA_CONFIG = path.join(__dirname, '..', 'src', 'Objects', 'Config');
const leerXml = (archivo) => fs.readFileSync(path.join(RUTA_CONFIG, archivo), 'utf8');
const instancias = (xml) => Array.from(xml.matchAll(/<instance scriptid="([^"]+)">([\s\S]*?)<\/instance>/g))
    .map((coincidencia) => ({ scriptid: coincidencia[1], cuerpo: coincidencia[2] }));
const campo = (cuerpo, id) => {
    const coincidencia = cuerpo.match(new RegExp(`<${id}>([^<]*)</${id}>`));
    return coincidencia === null ? '' : coincidencia[1];
};
const decodificar = (texto) => texto.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const referencia = (valor) => valor.replace(/^\[scriptid=[a-z0-9_]+\./, '').replace(/\]$/, '');

const CONFIGURACION = instancias(leerXml('customrecord_sads_naturaleza_productos.xml'))
    .filter(({ scriptid }) => scriptid === 'val_sads_nat_config_record_lne')[0].cuerpo;
const CALIBRES = instancias(leerXml('customrecord_sads_espesor.xml'))
    .filter(({ scriptid }) => /^val_sads_esp_lne_c/.test(scriptid))
    .reduce((mapa, { scriptid, cuerpo }) => Object.assign(mapa, {
        [scriptid]: {
            codigo: campo(cuerpo, 'custrecord_sads_esp_codigo'),
            texto: campo(cuerpo, 'custrecord_sads_esp_texto'),
            nombre: campo(cuerpo, 'name'),
            orden: Number(campo(cuerpo, 'custrecord_sads_esp_orden'))
        }
    }), {});
const CALIBRE_POR_CODIGO = Object.keys(CALIBRES).reduce((mapa, id) => Object.assign(mapa, { [CALIBRES[id].codigo]: CALIBRES[id] }), {});

// Familias DRT de LNE (scriptid → número de familia, deducido de los rangos y de la tabla del usuario).
const FAMILIA = Object.freeze({
    val_26682_5490848_sb1_726: '017', val_135478_5490848_666: '089', val_26683_5490848_sb1_769: '018',
    val_135481_5490848_142: '092', val_135477_5490848_178: '088', val_135479_5490848_671: '090', val_135480_5490848_658: '091'
});

const LINEAS = instancias(leerXml('customrecord_sads_nat_familia.xml'))
    .filter(({ cuerpo }) => referencia(campo(cuerpo, 'custrecord_sads_natfam_config')) === 'val_sads_nat_config_record_lne')
    .map(({ scriptid, cuerpo }) => {
        const desde = CALIBRES[referencia(campo(cuerpo, 'custrecord_sads_natfam_desde'))];
        const hasta = CALIBRES[referencia(campo(cuerpo, 'custrecord_sads_natfam_hasta'))];
        return {
            id: scriptid, desdeId: 'd', hastaId: 'h', desdeOrden: desde.orden, hastaOrden: hasta.orden, desdeTipo: 'cal', hastaTipo: 'cal',
            medidaDesde: Number(campo(cuerpo, 'custrecord_sads_natfam_med_desde')),
            medidaHasta: Number(campo(cuerpo, 'custrecord_sads_natfam_med_hasta')),
            familiaPrecioId: FAMILIA[referencia(campo(cuerpo, 'custrecord_sads_natfam_precio'))],
            familiaMargenId: referencia(campo(cuerpo, 'custrecord_sads_natfam_margen'))
        };
    });

// [ID interno, lado A (pies), lado B (pies), calibre, código actual, familia actual]. Fuera: 1127 y 10821 (sufijo IN).
const LNE = [
    [13045, 3, 5, 'C10', 'LNE305C10', '017'], [10786, 3, 6, 'C10', 'LNE306C10', '017'], [10787, 3, 6, 'C12', 'LNE306C12', '017'],
    [10788, 3, 6, 'C14', 'LNE306C14', '089'], [10789, 3, 6, 'C16', 'LNE306C16', '018'], [10790, 3, 6, 'C18', 'LNE306C18', '018'],
    [10791, 3, 6, 'C20', 'LNE306C20', '018'], [10792, 3, 8, 'C10', 'LNE308C10', '017'], [10793, 3, 8, 'C12', 'LNE308C12', '017'],
    [10795, 3, 8, 'C14', 'LNE308C14', '089'], [10796, 3, 8, 'C16', 'LNE308C16', '018'], [10797, 3, 8, 'C18', 'LNE308C18', '018'],
    [10798, 3, 8, 'C20', 'LNE308C20', '018'], [10776, 3, 10, 'C10', 'LNE310C10', '017'], [10777, 3, 10, 'C12', 'LNE310C12', '017'],
    [10778, 3, 10, 'C14', 'LNE310C14', '089'], [10779, 3, 10, 'C16', 'LNE310C16', '018'], [10780, 3, 10, 'C18', 'LNE310C18', '018'],
    [10782, 3, 10, 'C20', 'LNE310C20', '018'], [10783, 3, 10, 'C22', 'LNE310C22', '018'], [10784, 3, 10, 'C24', 'LNE310C24', '018'],
    [10785, 3, 10, 'C26', 'LNE310C26', '092'], [12702, 4, 5, 'C10', 'LNE405C10', '088'], [12820, 4, 5, 'C12', 'LNE405C12', '088'],
    [10810, 4, 6, 'C10', 'LNE406C10', '088'], [10811, 4, 6, 'C12', 'LNE406C12', '088'], [10813, 4, 6, 'C14', 'LNE406C14', '090'],
    [10814, 4, 6, 'C16', 'LNE406C16', '091'], [10815, 4, 6, 'C18', 'LNE406C18', '091'], [10816, 4, 6, 'C20', 'LNE406C20', '091'],
    [10817, 4, 8, 'C10', 'LNE408C10', '088'], [10818, 4, 8, 'C12', 'LNE408C12', '088'], [10819, 4, 8, 'C14', 'LNE408C14', '090'],
    [13669, 4, 8, 'C16', 'LNE408C16', '091'], [10822, 4, 8, 'C18', 'LNE408C18', '091'], [10823, 4, 8, 'C20', 'LNE408C20', '091'],
    [12359, 4, 8, 'C24', 'LNE408C24', '091'], [10825, 4, 8, 'C26', 'LNE408C26', '092'], [10800, 4, 10, 'C10', 'LNE410C10', '088'],
    [10801, 4, 10, 'C12', 'LNE410C12', '088'], [10802, 4, 10, 'C14', 'LNE410C14', '090'], [10803, 4, 10, 'C16', 'LNE410C16', '091'],
    [10804, 4, 10, 'C18', 'LNE410C18', '091'], [10809, 4, 10, 'C20', 'LNE410C20', '091'], [10824, 4, 10, 'C22', 'LNE410C22', '091'],
    [10820, 4, 10, 'C24', 'LNE410C24', '091'], [10799, 4, 10, 'C26', 'LNE410C26', '092']
];

const generar = (texto, ladoA, ladoB, calibre) => patron.aplicar({
    patron: decodificar(texto),
    valores: { custitem_sads_nat_lne_lado_a: ladoA, custitem_sads_nat_lne_lado_b: ladoB, custitem_sads_nat_espesor: 1 },
    textos: { custitem_sads_nat_espesor: { codigo: calibre.codigo, texto: calibre.texto } }
});

describe('Lámina Negra: configuración desplegada', () => {
    test('el campo de medida es el Lado A (ancho), no el espesor', () => {
        expect(campo(CONFIGURACION, 'custrecord_sads_naturaleza_campo_med')).toBe('custitem_sads_nat_lne_lado_a');
    });

    test('16 calibres con texto sin espacio (Cal.10) y nombre con sufijo - LNE', () => {
        const ids = Object.keys(CALIBRES);
        expect(ids).toHaveLength(16);
        ids.forEach((id) => {
            const numero = id.slice(-2);
            expect(CALIBRES[id]).toMatchObject({ codigo: `C${numero}`, texto: `Cal.${numero}`, nombre: `Cal.${numero} - LNE` });
        });
    });

    test('8 líneas de familia sin traslape, margen Lamina Negra', () => {
        expect(LINEAS).toHaveLength(8);
        LINEAS.forEach((linea) => {
            const hermanas = LINEAS.filter((otra) => otra.id !== linea.id);
            expect(familias.validarLinea({ linea: Object.assign({}, linea, { familiaPrecioId: 'p', familiaMargenId: 'm' }), hermanas, tipoNaturaleza: 'cal' }).errores)
                .toEqual([]);
            expect(linea.familiaMargenId).toBe('val_5500436_5490848_831');
        });
    });
});

describe(`Lámina Negra: los ${LNE.length} artículos de la tabla`, () => {
    test('el patrón de código reproduce el código actual', () => {
        const distintos = LNE.filter(([, ladoA, ladoB, calibre, codigo]) => (
            generar(campo(CONFIGURACION, 'custrecord_sads_naturaleza_patron_cod'), ladoA, ladoB, CALIBRE_POR_CODIGO[calibre]) !== codigo
        ));
        expect(distintos).toEqual([]);
    });

    test('cada artículo recibe su familia actual por calibre y ancho', () => {
        const distintos = LNE.filter(([, ladoA, , calibre, , esperada]) => (
            familias.resolver({ lineas: LINEAS, orden: CALIBRE_POR_CODIGO[calibre].orden, medida: ladoA }).familiaPrecioId !== esperada
        ));
        expect(distintos).toEqual([]);
    });

    test('nombre: Lamina Negra 3\'x6\' Cal.10', () => {
        expect(generar(campo(CONFIGURACION, 'custrecord_sads_naturaleza_patron_nom'), 3, 6, CALIBRE_POR_CODIGO.C10))
            .toBe("Lamina Negra 3'x6' Cal.10");
    });

    test('huecos: Cal.15 y Cal.28 en ambos anchos y Cal.07 en 4\' no tienen familia', () => {
        [[3, 'C15'], [4, 'C15'], [3, 'C28'], [4, 'C28'], [4, 'C07']].forEach(([ladoA, calibre]) => {
            expect(() => familias.resolver({ lineas: LINEAS, orden: CALIBRE_POR_CODIGO[calibre].orden, medida: ladoA }))
                .toThrow('No hay una familia de precios única para este espesor en la naturaleza.');
        });
    });
});
