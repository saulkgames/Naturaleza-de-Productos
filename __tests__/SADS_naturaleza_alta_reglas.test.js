const fs = require('fs');
const path = require('path');
const formato = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_config_formato');
const reglas = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_alta_reglas');

const { ERRORES } = formato;
const { TIPOS_ARTICULO } = reglas;

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain',
    'SADS_naturaleza_alta_reglas.js'
);

const RUTA_LISTA_TIPOS = path.join(__dirname, '..', 'src', 'Objects', 'customlist_sads_tipos_articulo.xml');

const RUTA_NOTAS_DESPLIEGUE = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'SADS_SL_naturaleza_config.md'
);

const RUTAS_XML_CS_UE = Object.freeze([
    path.join(__dirname, '..', 'src', 'Objects', 'customscript_sads_cs_item_dynamic_mandat.xml'),
    path.join(__dirname, '..', 'src', 'Objects', 'customscript_sads_ue_item_dynamic_mandat.xml')
]);

const MENSAJE_SELECCION_VACIA = 'Marque al menos un campo.';
const CAMPO_GATILLO = 'custitem_sads_naturaleza_producto';

const MAPA_ESPERADO = Object.freeze({
    val_sads_ta_inv: 'inventoryitem',
    val_sads_ta_noinv: 'noninventoryitem',
    val_sads_ta_otro: 'otherchargeitem',
    val_sads_ta_serv: 'serviceitem',
    val_sads_ta_kit: 'kititem',
    val_sads_ta_grupo: 'itemgroup'
});

const SCRIPTID_SUBTIPOS_ANTIGUOS = Object.freeze([
    'val_sads_ta_noinv_venta',
    'val_sads_ta_noinv_reventa',
    'val_sads_ta_noinv_compra',
    'val_sads_ta_otro_venta',
    'val_sads_ta_otro_reventa',
    'val_sads_ta_otro_compra',
    'val_sads_ta_serv_venta',
    'val_sads_ta_serv_reventa',
    'val_sads_ta_serv_compra'
]);

const crearCollatorEspanol = () => new Intl.Collator('es', { sensitivity: 'base' });

const RUTAS_COMPARADOR = [
    ['Intl.Collator español', crearCollatorEspanol],
    ['respaldo con collator null', () => null]
];

const clonar = (valor) => {
    if (Array.isArray(valor)) return valor.map(clonar);
    if (valor !== null && typeof valor === 'object') {
        return Object.keys(valor).reduce((copia, llave) => {
            copia[llave] = clonar(valor[llave]);
            return copia;
        }, {});
    }
    return valor;
};

const congelar = (valor) => {
    if (valor !== null && typeof valor === 'object' && !Object.isFrozen(valor)) {
        Object.keys(valor).forEach((llave) => congelar(valor[llave]));
        Object.freeze(valor);
    }
    return valor;
};

const prepararEntradaInmutable = (valor) => ({ entrada: congelar(clonar(valor)), original: clonar(valor) });

const NATURALEZAS = congelar([
    { id: '1', nombre: 'Placas de Acero' },
    { id: '7', nombre: 'Naturaleza de prueba' }
]);

const TIPOS = congelar([
    { id: '3', nombre: 'Kit', scriptid: 'val_sads_ta_kit' },
    { id: '5', nombre: 'Servicio', scriptid: ' VAL_SADS_TA_SERV ' },
    { id: '9', nombre: 'Tipo sin mapa', scriptid: 'val_sads_ta_sin_mapa' },
    { id: '11', nombre: 'Tipo sin scriptid' }
]);

const CATALOGO = congelar([
    { id: 'custitem_color', etiqueta: 'Color' },
    { id: 'custitem_peso', etiqueta: 'Peso' }
]);

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba que la función lanzara un error.');
};

const esperarErrorDeDominio = (funcion, nombre) => {
    const error = capturarError(funcion);
    expect(error).toBeInstanceOf(Error);
    expect(formato.esErrorDeDominio(error)).toBe(true);
    expect(error.name).toBe(nombre);
    expect(error.message.trim()).not.toBe('');
    return error;
};

const esperarErrorDeProgramacion = (funcion) => {
    const error = capturarError(funcion);
    expect(error).toBeInstanceOf(TypeError);
    expect(formato.esErrorDeDominio(error)).toBe(false);
    return error;
};

const eleccionValida = (cambios) => Object.assign(
    { naturalezaId: '1', tipoId: '3', naturalezas: NATURALEZAS, tipos: TIPOS },
    cambios
);

const altaValida = (cambios) => Object.assign(
    eleccionValida(),
    { idsSeleccionados: ['custitem_peso'], catalogo: CATALOGO },
    cambios
);

describe('TIPOS_ARTICULO', () => {
    test('contiene exactamente los 6 scriptid de la lista con su tipo de registro', () => {
        expect(Object.keys(TIPOS_ARTICULO)).toHaveLength(6);
        expect(Object.keys(TIPOS_ARTICULO).sort()).toEqual(Object.keys(MAPA_ESPERADO).sort());
        Object.keys(MAPA_ESPERADO).forEach((scriptid) => {
            expect(TIPOS_ARTICULO[scriptid]).toEqual({ tipoRegistro: MAPA_ESPERADO[scriptid] });
        });
    });

    test('las llaves están en minúsculas y no hay tipos de registro repetidos', () => {
        Object.keys(TIPOS_ARTICULO).forEach((scriptid) => expect(scriptid).toBe(scriptid.toLowerCase()));
        const tiposRegistro = Object.keys(TIPOS_ARTICULO).map((scriptid) => TIPOS_ARTICULO[scriptid].tipoRegistro);
        expect(new Set(tiposRegistro).size).toBe(6);
    });

    test('las llaves coinciden exactamente y en orden con los scriptid de customlist_sads_tipos_articulo.xml', () => {
        const xml = fs.readFileSync(RUTA_LISTA_TIPOS, 'utf8');
        const scriptidsXml = Array.from(xml.matchAll(/<customvalue scriptid="([^"]+)">/g), (coincidencia) => coincidencia[1]);
        expect(scriptidsXml).toEqual(Object.keys(MAPA_ESPERADO));
        expect(Object.keys(TIPOS_ARTICULO)).toEqual(scriptidsXml);
    });

    test('el mapa y cada entrada están congelados', () => {
        expect(Object.isFrozen(TIPOS_ARTICULO)).toBe(true);
        Object.keys(TIPOS_ARTICULO).forEach((scriptid) => expect(Object.isFrozen(TIPOS_ARTICULO[scriptid])).toBe(true));
    });
});

describe('SADS_SL_naturaleza_config.md sincronizado con el mapa y los deployments', () => {
    const leerNotas = () => fs.readFileSync(RUTA_NOTAS_DESPLIEGUE, 'utf8');

    const leerFilasValoresLista = (notas) => {
        const lineas = notas.split(/\r?\n/);
        const inicio = lineas.findIndex((linea) => linea.startsWith('### Valores de `customlist_sads_tipos_articulo`'));
        expect(inicio).toBeGreaterThanOrEqual(0);
        return lineas.slice(inicio + 1)
            .map((linea) => linea.match(/^\| `([^`]+)` \| [^|]+ \| `([^`]+)` \|/))
            .filter((coincidencia) => coincidencia !== null)
            .map((coincidencia) => ({ scriptid: coincidencia[1], tipoRegistro: coincidencia[2] }));
    };

    const leerDeploymentsCsUe = () => RUTAS_XML_CS_UE.reduce((deployments, ruta) => deployments.concat(
        Array.from(
            fs.readFileSync(ruta, 'utf8').matchAll(/<scriptdeployment scriptid="([^"]+)">[\s\S]*?<recordtype>([^<]+)<\/recordtype>/g),
            (coincidencia) => ({ scriptid: coincidencia[1], recordtype: coincidencia[2] })
        )
    ), []);

    test('la tabla de valores coincide en orden con TIPOS_ARTICULO y su tipo de registro', () => {
        const filas = leerFilasValoresLista(leerNotas());
        expect(filas.map((fila) => fila.scriptid)).toEqual(Object.keys(TIPOS_ARTICULO));
        filas.forEach((fila) => expect(fila.tipoRegistro).toBe(TIPOS_ARTICULO[fila.scriptid].tipoRegistro));
    });

    test('fuera de P-04 solo cita scriptid vigentes; en P-04 los antiguos son de subtipo', () => {
        leerNotas().split(/\r?\n/).forEach((linea) => {
            const citados = Array.from(linea.matchAll(/val_sads_ta_[a-z_]+/g), (coincidencia) => coincidencia[0]);
            const desconocidos = citados.filter((scriptid) => !Object.prototype.hasOwnProperty.call(TIPOS_ARTICULO, scriptid));
            if (linea.startsWith('| P-04 |')) {
                desconocidos.forEach((scriptid) => expect(SCRIPTID_SUBTIPOS_ANTIGUOS).toContain(scriptid));
            } else {
                expect(desconocidos).toEqual([]);
            }
        });
    });

    test('la reversión de Otro cargo inactiva val_sads_ta_otro y retira sus deployments del CS y del UE', () => {
        const deploymentsOtroCargo = leerDeploymentsCsUe()
            .filter((deployment) => deployment.recordtype === 'OTHERCHARGEITEM')
            .map((deployment) => deployment.scriptid);
        expect(deploymentsOtroCargo).toHaveLength(2);
        const pasoReversion = leerNotas().split(/\r?\n/)
            .find((linea) => linea.includes('R-17') && linea.includes('`val_sads_ta_otro`') && linea.includes('inactivar'));
        expect(pasoReversion).toBeDefined();
        deploymentsOtroCargo.forEach((scriptid) => expect(pasoReversion).toContain(`\`${scriptid}\``));
    });

    test('la liberación por tipo cita todos los deployments del CS y del UE', () => {
        const notas = leerNotas();
        const deployments = leerDeploymentsCsUe();
        expect(deployments).toHaveLength(12);
        deployments.forEach((deployment) => expect(notas).toContain(`\`${deployment.scriptid}\``));
        ['R-12', 'R-19', 'R-20', 'P-20'].forEach((referencia) => expect(notas).toContain(referencia));
    });

    test('cita el plan v4 y el prompt v3 como origen', () => {
        const notas = leerNotas();
        expect(notas).toContain('2026-10-12_sl-naturaleza-config_plan_v4.md');
        expect(notas).toContain('2026-10-12_sl-naturaleza-config_prompt_v3.md');
        expect(notas).not.toMatch(/plan_v3|plan v3|prompt v2/);
    });
});

describe('resolverTipoArticulo (P-04)', () => {
    const casos = Object.keys(MAPA_ESPERADO).map((scriptid) => [scriptid, MAPA_ESPERADO[scriptid]]);

    test.each(casos)('resuelve %s a %s', (scriptid, tipoRegistro) => {
        expect(reglas.resolverTipoArticulo(scriptid)).toEqual({ tipoRegistro });
    });

    test.each(casos)('resuelve %s escrito en mayúsculas', (scriptid, tipoRegistro) => {
        expect(reglas.resolverTipoArticulo(scriptid.toUpperCase())).toEqual({ tipoRegistro });
    });

    test.each(casos)('resuelve %s con espacios y mayúsculas mezcladas', (scriptid, tipoRegistro) => {
        const mezclado = `  ${scriptid.charAt(0).toUpperCase()}${scriptid.slice(1, 8)}${scriptid.slice(8).toUpperCase()}\t`;
        expect(reglas.resolverTipoArticulo(mezclado)).toEqual({ tipoRegistro });
    });

    test('devuelve una copia nueva que no altera el mapa', () => {
        const resuelto = reglas.resolverTipoArticulo('val_sads_ta_kit');
        expect(resuelto).not.toBe(TIPOS_ARTICULO.val_sads_ta_kit);
        expect(Object.isFrozen(resuelto)).toBe(false);
        resuelto.tipoRegistro = 'alterado';
        expect(reglas.resolverTipoArticulo('val_sads_ta_kit')).toEqual({ tipoRegistro: 'kititem' });
        expect(TIPOS_ARTICULO.val_sads_ta_kit.tipoRegistro).toBe('kititem');
    });

    test.each([
        ['val_inexistente'],
        ['VAL_INEXISTENTE'],
        [''],
        ['   '],
        [null],
        [undefined],
        ['constructor'],
        ['__proto__'],
        ['toString'],
        ['hasOwnProperty']
    ])('lanza TIPO_ARTICULO_DESCONOCIDO con %p', (valor) => {
        esperarErrorDeDominio(() => reglas.resolverTipoArticulo(valor), ERRORES.TIPO_ARTICULO_DESCONOCIDO);
    });

    test.each(SCRIPTID_SUBTIPOS_ANTIGUOS.map((scriptid) => [scriptid]))(
        'lanza TIPO_ARTICULO_DESCONOCIDO con el scriptid antiguo de subtipo %s',
        (scriptid) => {
            esperarErrorDeDominio(() => reglas.resolverTipoArticulo(scriptid), ERRORES.TIPO_ARTICULO_DESCONOCIDO);
            esperarErrorDeDominio(
                () => reglas.resolverTipoArticulo(` ${scriptid.toUpperCase()} `),
                ERRORES.TIPO_ARTICULO_DESCONOCIDO
            );
        }
    );

    test('el mensaje no incluye el scriptid recibido', () => {
        const error = capturarError(() => reglas.resolverTipoArticulo('val_inexistente'));
        expect(error.message).not.toContain('val_inexistente');
    });
});

describe('filtrarCatalogo (P-05)', () => {
    test('excluye el campo gatillo, elimina duplicados conservando el primero y ordena por etiqueta', () => {
        const campos = [
            { id: 'custitem_peso', etiqueta: 'Peso' },
            { id: 'CUSTITEM_SADS_NATURALEZA_PRODUCTO', etiqueta: 'Naturaleza de producto' },
            { id: ' custitem_color ', etiqueta: ' Color ' },
            { id: 'custitem_peso', etiqueta: 'Peso duplicado' },
            { id: 'CUSTITEM_COLOR', etiqueta: 'Color en mayúsculas' },
            { id: 'custitem_ancho', etiqueta: 'ancho' },
            { id: CAMPO_GATILLO, etiqueta: 'Naturaleza de producto' }
        ];
        expect(reglas.filtrarCatalogo({ campos, idsExcluidos: [CAMPO_GATILLO] })).toEqual([
            { id: 'custitem_ancho', etiqueta: 'ancho' },
            { id: 'custitem_color', etiqueta: 'Color' },
            { id: 'custitem_peso', etiqueta: 'Peso' }
        ]);
    });

    test('normaliza los IDs excluidos antes de comparar', () => {
        const campos = [{ id: CAMPO_GATILLO, etiqueta: 'Naturaleza' }, { id: 'custitem_peso', etiqueta: 'Peso' }];
        expect(reglas.filtrarCatalogo({ campos, idsExcluidos: ['  CUSTITEM_SADS_NATURALEZA_PRODUCTO '] }))
            .toEqual([{ id: 'custitem_peso', etiqueta: 'Peso' }]);
    });

    test('descarta IDs vacíos y usa el ID como etiqueta cuando la etiqueta queda vacía', () => {
        const campos = [
            { id: '   ', etiqueta: 'Sin ID' },
            { id: null, etiqueta: 'ID nulo' },
            { etiqueta: 'Sin propiedad id' },
            { id: 'custitem_sin_etiqueta', etiqueta: '   ' },
            { id: 'custitem_etiqueta_nula', etiqueta: null },
            { id: 'custitem_etiqueta_ausente' },
            { id: 'custitem_numero', etiqueta: 42 }
        ];
        expect(reglas.filtrarCatalogo({ campos })).toEqual([
            { id: 'custitem_numero', etiqueta: '42' },
            { id: 'custitem_etiqueta_ausente', etiqueta: 'custitem_etiqueta_ausente' },
            { id: 'custitem_etiqueta_nula', etiqueta: 'custitem_etiqueta_nula' },
            { id: 'custitem_sin_etiqueta', etiqueta: 'custitem_sin_etiqueta' }
        ]);
    });

    test('ignora elementos que no son objeto', () => {
        const campos = [null, undefined, 5, 'custitem_texto', true, { id: 'custitem_ok', etiqueta: 'OK' }];
        expect(reglas.filtrarCatalogo({ campos })).toEqual([{ id: 'custitem_ok', etiqueta: 'OK' }]);
    });

    test('ordena por etiqueta sin distinguir mayúsculas y desempata por ID', () => {
        const campos = [
            { id: 'custitem_c', etiqueta: 'alfa' },
            { id: 'custitem_b', etiqueta: 'Beta' },
            { id: 'custitem_a', etiqueta: 'ALFA' },
            { id: 'custitem_d', etiqueta: 'Alfa' }
        ];
        expect(reglas.filtrarCatalogo({ campos })).toEqual([
            { id: 'custitem_a', etiqueta: 'ALFA' },
            { id: 'custitem_c', etiqueta: 'alfa' },
            { id: 'custitem_d', etiqueta: 'Alfa' },
            { id: 'custitem_b', etiqueta: 'Beta' }
        ]);
    });

    test('el orden del resultado no depende del orden de entrada', () => {
        const campos = [
            { id: 'custitem_z', etiqueta: 'Peso' },
            { id: 'custitem_y', etiqueta: 'peso' },
            { id: 'custitem_x', etiqueta: 'Ancho' },
            { id: 'custitem_w', etiqueta: 'Color' },
            { id: 'custitem_v', etiqueta: '' }
        ];
        const esperado = reglas.filtrarCatalogo({ campos });
        expect(esperado.map((campo) => campo.id))
            .toEqual(['custitem_x', 'custitem_w', 'custitem_v', 'custitem_y', 'custitem_z']);
        expect(reglas.filtrarCatalogo({ campos: campos.slice().reverse() })).toEqual(esperado);
        expect(reglas.filtrarCatalogo({ campos: campos.slice(2).concat(campos.slice(0, 2)) })).toEqual(esperado);
    });

    test.each([
        ['sin argumento', undefined],
        ['null', null],
        ['un objeto vacío', {}],
        ['listas nulas', { campos: null, idsExcluidos: null }]
    ])('devuelve [] con entradas ausentes: %s', (descripcion, entrada) => {
        expect(reglas.filtrarCatalogo(entrada)).toEqual([]);
    });

    test('sin idsExcluidos no excluye ningún campo', () => {
        expect(reglas.filtrarCatalogo({ campos: [{ id: CAMPO_GATILLO, etiqueta: 'Naturaleza' }] }))
            .toEqual([{ id: CAMPO_GATILLO, etiqueta: 'Naturaleza' }]);
    });

    test.each([
        ['campos como cadena', { campos: 'custitem_peso' }],
        ['campos como objeto', { campos: { id: 'custitem_peso', etiqueta: 'Peso' } }],
        ['idsExcluidos como cadena', { campos: [], idsExcluidos: CAMPO_GATILLO }]
    ])('lanza TypeError, no error de dominio, si una lista no es arreglo: %s', (descripcion, entrada) => {
        esperarErrorDeProgramacion(() => reglas.filtrarCatalogo(entrada));
    });

    test('no muta la entrada y devuelve objetos nuevos', () => {
        const { entrada, original } = prepararEntradaInmutable({
            campos: [
                { id: 'CUSTITEM_PESO', etiqueta: ' Peso ' },
                { id: CAMPO_GATILLO, etiqueta: 'Naturaleza' },
                { id: 'custitem_color', etiqueta: 'Color' }
            ],
            idsExcluidos: [CAMPO_GATILLO]
        });
        const resultado = reglas.filtrarCatalogo(entrada);
        expect(entrada).toStrictEqual(original);
        expect(resultado).toEqual([
            { id: 'custitem_color', etiqueta: 'Color' },
            { id: 'custitem_peso', etiqueta: 'Peso' }
        ]);
        resultado.forEach((campo) => expect(entrada.campos).not.toContain(campo));
    });
});

describe('crearComparadorEtiquetas (orden alfabético español)', () => {
    const campo = (id, etiqueta) => ({ id, etiqueta });
    const ordenarEtiquetas = (comparador, campos) => campos.slice().sort(comparador).map((c) => c.etiqueta);
    const ordenarIds = (comparador, campos) => campos.slice().sort(comparador).map((c) => c.id);

    describe.each(RUTAS_COMPARADOR)('ruta %s', (descripcion, obtenerCollator) => {
        const comparador = reglas.crearComparadorEtiquetas(obtenerCollator());

        test('Área queda junto a Arancel y antes de Barra', () => {
            const campos = [
                campo('custitem_1', 'Barra'),
                campo('custitem_2', 'Área'),
                campo('custitem_3', 'Zinc'),
                campo('custitem_4', 'Arancel')
            ];
            expect(ordenarEtiquetas(comparador, campos)).toEqual(['Arancel', 'Área', 'Barra', 'Zinc']);
        });

        test('Ñandú queda después de toda palabra con n y antes de Oro', () => {
            const campos = [
                campo('custitem_1', 'Oro'),
                campo('custitem_2', 'Ñandú'),
                campo('custitem_3', 'Nube'),
                campo('custitem_4', 'Nzeta'),
                campo('custitem_5', 'Mango'),
                campo('custitem_6', 'ñu')
            ];
            expect(ordenarEtiquetas(comparador, campos)).toEqual(['Mango', 'Nube', 'Nzeta', 'Ñandú', 'ñu', 'Oro']);
        });

        test('no distingue mayúsculas ni acentos y desempata por ID', () => {
            const campos = [
                campo('custitem_c', 'alfa'),
                campo('custitem_b', 'Beta'),
                campo('custitem_a', 'ALFA'),
                campo('custitem_e', 'Álfa'),
                campo('custitem_d', 'Alfa')
            ];
            expect(ordenarIds(comparador, campos))
                .toEqual(['custitem_a', 'custitem_c', 'custitem_d', 'custitem_e', 'custitem_b']);
        });

        test('el desempate por ID usa comparación por código', () => {
            expect(comparador(campo('custitem_a', 'Peso'), campo('custitem_b', 'PESO'))).toBeLessThan(0);
            expect(comparador(campo('custitem_b', 'peso'), campo('custitem_a', 'Peso'))).toBeGreaterThan(0);
            expect(comparador(campo('custitem_Z', 'Peso'), campo('custitem_a', 'Peso'))).toBeLessThan(0);
            expect(comparador(campo('custitem_a', 'Peso'), campo('custitem_a', 'peso'))).toBe(0);
        });

        test('el resultado no depende del orden de entrada', () => {
            const campos = [
                campo('custitem_1', 'Ñandú'),
                campo('custitem_2', 'nube'),
                campo('custitem_3', 'Área'),
                campo('custitem_4', 'arancel'),
                campo('custitem_5', 'Oro')
            ];
            const esperado = ordenarIds(comparador, campos);
            expect(ordenarIds(comparador, campos.slice().reverse())).toEqual(esperado);
        });
    });

    test('ambas rutas producen el mismo orden', () => {
        const campos = [
            campo('custitem_1', 'Oro'), campo('custitem_2', 'Ñandú'), campo('custitem_3', 'Nube'),
            campo('custitem_4', 'Área'), campo('custitem_5', 'Arancel'), campo('custitem_6', 'Barra'),
            campo('custitem_7', 'barra'), campo('custitem_8', 'Peso neto'), campo('custitem_9', 'Peso')
        ];
        expect(ordenarIds(reglas.crearComparadorEtiquetas(null), campos))
            .toEqual(ordenarIds(reglas.crearComparadorEtiquetas(crearCollatorEspanol()), campos));
    });

    test('el respaldo trata una ñ descompuesta (n + U+0303) igual que la compuesta', () => {
        const comparador = reglas.crearComparadorEtiquetas(null);
        const campos = [campo('custitem_1', 'Oro'), campo('custitem_2', 'Ñandu'), campo('custitem_3', 'Nube')];
        expect(ordenarIds(comparador, campos)).toEqual(['custitem_3', 'custitem_2', 'custitem_1']);
    });

    test.each([
        ['undefined', undefined],
        ['un objeto sin compare', {}],
        ['un compare que lanza', { compare: () => { throw new Error('sin soporte'); } }],
        ['un compare por código sin reglas del español', { compare: (a, b) => (a < b ? -1 : (a > b ? 1 : 0)) }],
        ['un collator sin datos de español', new Intl.Collator('und', { sensitivity: 'base' })]
    ])('usa el respaldo con %s', (descripcion, collator) => {
        const comparador = reglas.crearComparadorEtiquetas(collator);
        const campos = [
            campo('custitem_1', 'Oro'), campo('custitem_2', 'Ñandú'), campo('custitem_3', 'Nube'),
            campo('custitem_4', 'Área'), campo('custitem_5', 'Barra'), campo('custitem_6', 'Arancel')
        ];
        expect(ordenarEtiquetas(comparador, campos)).toEqual(['Arancel', 'Área', 'Barra', 'Nube', 'Ñandú', 'Oro']);
    });

    test('cada llamada crea un comparador independiente y sin estado', () => {
        const primero = reglas.crearComparadorEtiquetas(null);
        const segundo = reglas.crearComparadorEtiquetas(crearCollatorEspanol());
        expect(primero).not.toBe(segundo);
        const a = campo('custitem_a', 'Ñandú');
        const b = campo('custitem_b', 'Nube');
        expect([primero(a, b), primero(a, b), segundo(a, b)].map(Math.sign)).toEqual([1, 1, 1]);
    });

    test('filtrarCatalogo aplica el orden alfabético español', () => {
        const campos = [
            campo('custitem_oro', 'Oro'),
            campo('custitem_nandu', 'Ñandú'),
            campo('custitem_barra', 'Barra'),
            campo('custitem_area', 'Área'),
            campo('custitem_nube', 'Nube'),
            campo('custitem_arancel', 'Arancel')
        ];
        expect(reglas.filtrarCatalogo({ campos }).map((c) => c.id)).toEqual([
            'custitem_arancel', 'custitem_area', 'custitem_barra', 'custitem_nube', 'custitem_nandu', 'custitem_oro'
        ]);
    });
});

describe('validarEleccion', () => {
    test('acepta una naturaleza disponible y un tipo con scriptid en el mapa, y devuelve copias', () => {
        const resultado = reglas.validarEleccion(eleccionValida());
        expect(resultado).toEqual({
            valido: true,
            errores: [],
            naturaleza: { id: '1', nombre: 'Placas de Acero' },
            tipo: { id: '3', nombre: 'Kit', scriptid: 'val_sads_ta_kit' }
        });
        expect(resultado.naturaleza).not.toBe(NATURALEZAS[0]);
        expect(resultado.tipo).not.toBe(TIPOS[0]);
    });

    test('compara los IDs como cadena y recorta espacios', () => {
        const naturalezas = [{ id: 1, nombre: 'Placas de Acero' }];
        const tipos = [{ id: 3, nombre: 'Kit', scriptid: 'val_sads_ta_kit' }];
        const resultado = reglas.validarEleccion({ naturalezaId: ' 1 ', tipoId: 3, naturalezas, tipos });
        expect(resultado.valido).toBe(true);
        expect(resultado.naturaleza).toEqual({ id: 1, nombre: 'Placas de Acero' });
        expect(resultado.tipo).toEqual({ id: 3, nombre: 'Kit', scriptid: 'val_sads_ta_kit' });
    });

    test('acepta un tipo cuyo scriptid viene en mayúsculas y con espacios', () => {
        const resultado = reglas.validarEleccion(eleccionValida({ tipoId: '5' }));
        expect(resultado.valido).toBe(true);
        expect(resultado.tipo).toEqual({ id: '5', nombre: 'Servicio', scriptid: ' VAL_SADS_TA_SERV ' });
    });

    describe('P-08: naturaleza', () => {
        test('rechaza una naturaleza que no está disponible o ya tiene configuración', () => {
            const resultado = reglas.validarEleccion(eleccionValida({ naturalezaId: '2' }));
            expect(resultado.valido).toBe(false);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toMatch(/no está disponible o ya tiene configuración/);
            expect(resultado.naturaleza).toBeNull();
            expect(resultado.tipo).toEqual({ id: '3', nombre: 'Kit', scriptid: 'val_sads_ta_kit' });
        });

        test.each([
            ['abc'],
            ['-1'],
            ['0'],
            ['01'],
            ['1.5'],
            ['1e3'],
            [''],
            ['   '],
            [null],
            [undefined],
            [true],
            [[1]],
            [{ id: 1 }],
            [Number.NaN],
            [1.5],
            [-1]
        ])('rechaza el ID de naturaleza %p', (naturalezaId) => {
            const resultado = reglas.validarEleccion(eleccionValida({ naturalezaId }));
            expect(resultado.valido).toBe(false);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.naturaleza).toBeNull();
        });

        test('rechaza un ID con formato inválido aunque exista una opción con ese texto', () => {
            const naturalezas = [{ id: 'abc', nombre: 'Texto' }, { id: '-1', nombre: 'Negativa' }];
            ['abc', '-1'].forEach((naturalezaId) => {
                expect(reglas.validarEleccion(eleccionValida({ naturalezaId, naturalezas })).valido).toBe(false);
            });
        });
    });

    describe('P-09: tipo de artículo', () => {
        test('rechaza un tipo que no está en la lista de tipos activos', () => {
            const resultado = reglas.validarEleccion(eleccionValida({ tipoId: '4' }));
            expect(resultado.valido).toBe(false);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.tipo).toBeNull();
            expect(resultado.naturaleza).toEqual({ id: '1', nombre: 'Placas de Acero' });
        });

        test.each([['x'], ['-3'], ['3.0'], ['03'], [''], [null], [undefined], [[3]]])(
            'rechaza el ID de tipo %p',
            (tipoId) => {
                const resultado = reglas.validarEleccion(eleccionValida({ tipoId }));
                expect(resultado.valido).toBe(false);
                expect(resultado.errores).toHaveLength(1);
                expect(resultado.tipo).toBeNull();
            }
        );

        test('rechaza un tipo cuyo scriptid no está en el mapa y devuelve la opción encontrada', () => {
            const resultado = reglas.validarEleccion(eleccionValida({ tipoId: '9' }));
            expect(resultado.valido).toBe(false);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.tipo).toEqual({ id: '9', nombre: 'Tipo sin mapa', scriptid: 'val_sads_ta_sin_mapa' });
        });

        test('rechaza un tipo sin scriptid', () => {
            const resultado = reglas.validarEleccion(eleccionValida({ tipoId: '11' }));
            expect(resultado.valido).toBe(false);
            expect(resultado.errores).toHaveLength(1);
        });
    });

    test('reporta un error por cada dato inválido, primero el de naturaleza', () => {
        const resultado = reglas.validarEleccion(eleccionValida({ naturalezaId: '2', tipoId: 'x' }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(2);
        expect(resultado.errores[0]).toMatch(/naturaleza/);
        expect(resultado.errores[1]).toMatch(/tipo de artículo/);
    });

    test('con listas ausentes rechaza la elección sin lanzar', () => {
        const resultado = reglas.validarEleccion({ naturalezaId: '1', tipoId: '3' });
        expect(resultado).toEqual({ valido: false, errores: expect.any(Array), naturaleza: null, tipo: null });
        expect(resultado.errores).toHaveLength(2);
    });

    test.each([[undefined], [null]])('con entrada %p rechaza la elección sin lanzar', (entrada) => {
        const resultado = reglas.validarEleccion(entrada);
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(2);
    });

    test.each([
        ['naturalezas como objeto', { naturalezas: { id: '1', nombre: 'Placas de Acero' } }],
        ['tipos como cadena', { tipos: 'val_sads_ta_kit' }]
    ])('lanza TypeError, no error de dominio, si una lista no es arreglo: %s', (descripcion, cambios) => {
        esperarErrorDeProgramacion(() => reglas.validarEleccion(eleccionValida(cambios)));
    });

    test('los mensajes no incluyen los IDs internos enviados', () => {
        const resultado = reglas.validarEleccion(eleccionValida({ naturalezaId: '987654', tipoId: '876543' }));
        expect(resultado.errores).toHaveLength(2);
        resultado.errores.forEach((mensaje) => {
            expect(mensaje).not.toContain('987654');
            expect(mensaje).not.toContain('876543');
        });
    });

    test('no muta la entrada', () => {
        const { entrada, original } = prepararEntradaInmutable(eleccionValida({ tipoId: '5' }));
        const resultado = reglas.validarEleccion(entrada);
        expect(entrada).toStrictEqual(original);
        resultado.naturaleza.nombre = 'Alterado';
        expect(entrada.naturalezas[0].nombre).toBe('Placas de Acero');
    });
});

describe('validarAlta', () => {
    test('acepta una alta válida y normaliza la selección en el orden recibido', () => {
        const idsSeleccionados = [' CUSTITEM_PESO ', 'custitem_color', 'custitem_peso', '', null];
        expect(reglas.validarAlta(altaValida({ idsSeleccionados }))).toEqual({
            valido: true,
            errores: [],
            naturaleza: { id: '1', nombre: 'Placas de Acero' },
            tipo: { id: '3', nombre: 'Kit', scriptid: 'val_sads_ta_kit' },
            idsNormalizados: ['custitem_peso', 'custitem_color'],
            errorDeEleccion: false
        });
    });

    test.each([
        ['vacía', []],
        ['ausente', undefined],
        ['nula', null],
        ['con solo vacíos', ['', '   ', null, undefined]]
    ])('P-06: con selección %s devuelve el mensaje exacto', (descripcion, idsSeleccionados) => {
        const resultado = reglas.validarAlta(altaValida({ idsSeleccionados }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toEqual([MENSAJE_SELECCION_VACIA]);
        expect(resultado.idsNormalizados).toEqual([]);
        expect(resultado.errorDeEleccion).toBe(false);
    });

    test('P-07: rechaza un ID fuera del catálogo y lo cita en el mensaje', () => {
        const resultado = reglas.validarAlta(altaValida({ idsSeleccionados: ['custitem_peso', 'CUSTITEM_INEXISTENTE'] }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(1);
        expect(resultado.errores[0]).toContain('custitem_inexistente');
        expect(resultado.errorDeEleccion).toBe(false);
        expect(resultado.idsNormalizados).toEqual(['custitem_peso', 'custitem_inexistente']);
    });

    test('reporta un error por cada ID fuera del catálogo', () => {
        const resultado = reglas.validarAlta(altaValida({ idsSeleccionados: ['custitem_x1', 'custitem_peso', 'custitem_x2'] }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(2);
        expect(resultado.errores[0]).toContain('custitem_x1');
        expect(resultado.errores[1]).toContain('custitem_x2');
    });

    test('rechaza el campo gatillo cuando el catálogo filtrado ya lo excluyó', () => {
        const catalogo = reglas.filtrarCatalogo({
            campos: CATALOGO.concat([{ id: CAMPO_GATILLO, etiqueta: 'Naturaleza' }]),
            idsExcluidos: [CAMPO_GATILLO]
        });
        const resultado = reglas.validarAlta(altaValida({ idsSeleccionados: [CAMPO_GATILLO], catalogo }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(1);
        expect(resultado.errores[0]).toContain(CAMPO_GATILLO);
    });

    test('compara contra el catálogo de forma normalizada', () => {
        const catalogo = [{ id: ' CUSTITEM_PESO ', etiqueta: 'Peso' }];
        expect(reglas.validarAlta(altaValida({ idsSeleccionados: ['custitem_peso'], catalogo })).valido).toBe(true);
    });

    test('con catálogo ausente rechaza todo ID seleccionado', () => {
        const resultado = reglas.validarAlta(altaValida({ catalogo: undefined }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(1);
        expect(resultado.errores[0]).toContain('custitem_peso');
    });

    test('no cita en el mensaje un ID con caracteres ajenos a un ID de campo', () => {
        const idNoCitable = '<img src=x onerror=alert(1)>';
        const resultado = reglas.validarAlta(altaValida({ idsSeleccionados: [idNoCitable] }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errores).toHaveLength(1);
        expect(resultado.errores[0]).not.toContain('<');
        expect(resultado.errores[0]).not.toContain('onerror');
        expect(resultado.idsNormalizados).toEqual([idNoCitable]);
    });

    test('incluye los errores de validarEleccion y marca errorDeEleccion', () => {
        const entrada = altaValida({ naturalezaId: 'abc', tipoId: '9' });
        const eleccion = reglas.validarEleccion(entrada);
        const resultado = reglas.validarAlta(entrada);
        expect(eleccion.valido).toBe(false);
        expect(resultado.valido).toBe(false);
        expect(resultado.errorDeEleccion).toBe(true);
        expect(resultado.errores).toEqual(eleccion.errores);
        expect(resultado.naturaleza).toBeNull();
        expect(resultado.tipo).toEqual(eleccion.tipo);
        expect(resultado.idsNormalizados).toEqual(['custitem_peso']);
    });

    test('acumula errores de elección y de selección, primero los de elección', () => {
        const resultado = reglas.validarAlta(altaValida({ naturalezaId: '2', idsSeleccionados: ['custitem_x1'] }));
        expect(resultado.valido).toBe(false);
        expect(resultado.errorDeEleccion).toBe(true);
        expect(resultado.errores).toHaveLength(2);
        expect(resultado.errores[0]).toMatch(/no está disponible o ya tiene configuración/);
        expect(resultado.errores[1]).toContain('custitem_x1');
    });

    test('con entrada ausente devuelve errores de elección y de selección sin lanzar', () => {
        const resultado = reglas.validarAlta(undefined);
        expect(resultado.valido).toBe(false);
        expect(resultado.errorDeEleccion).toBe(true);
        expect(resultado.errores).toHaveLength(3);
        expect(resultado.errores[2]).toBe(MENSAJE_SELECCION_VACIA);
        expect(resultado.idsNormalizados).toEqual([]);
    });

    test.each([
        ['idsSeleccionados como cadena', { idsSeleccionados: 'custitem_peso' }],
        ['catalogo como objeto', { catalogo: { id: 'custitem_peso', etiqueta: 'Peso' } }],
        ['tipos como cadena', { tipos: 'val_sads_ta_kit' }]
    ])('lanza TypeError, no error de dominio, si una lista no es arreglo: %s', (descripcion, cambios) => {
        esperarErrorDeProgramacion(() => reglas.validarAlta(altaValida(cambios)));
    });

    test('no muta la entrada', () => {
        const { entrada, original } = prepararEntradaInmutable(altaValida({
            idsSeleccionados: [' CUSTITEM_PESO ', 'custitem_inexistente', 'custitem_peso']
        }));
        const resultado = reglas.validarAlta(entrada);
        expect(entrada).toStrictEqual(original);
        expect(resultado.idsNormalizados).not.toBe(entrada.idsSeleccionados);
    });
});

describe('resolverNombre (P-10)', () => {
    test('devuelve el texto de la naturaleza con id 1', () => {
        const naturalezas = [{ id: '1', nombre: 'Placas de Acero' }];
        expect(reglas.resolverNombre({ naturalezaId: '1', naturalezas })).toBe('Placas de Acero');
    });

    test('compara el ID como cadena', () => {
        expect(reglas.resolverNombre({ naturalezaId: 1, naturalezas: [{ id: '1', nombre: 'Placas de Acero' }] }))
            .toBe('Placas de Acero');
        expect(reglas.resolverNombre({ naturalezaId: ' 1 ', naturalezas: [{ id: 1, nombre: 'Placas de Acero' }] }))
            .toBe('Placas de Acero');
    });

    test('elige la naturaleza correcta entre varias', () => {
        expect(reglas.resolverNombre({ naturalezaId: '7', naturalezas: NATURALEZAS })).toBe('Naturaleza de prueba');
    });

    test.each([
        ['un ID inexistente', { naturalezaId: '2', naturalezas: NATURALEZAS }],
        ['un ID vacío', { naturalezaId: '', naturalezas: NATURALEZAS }],
        ['un ID nulo', { naturalezaId: null, naturalezas: NATURALEZAS }],
        ['la lista ausente', { naturalezaId: '1' }],
        ['la lista vacía', { naturalezaId: '1', naturalezas: [] }],
        ['la entrada ausente', undefined]
    ])('lanza NATURALEZA_NO_DISPONIBLE con %s', (descripcion, entrada) => {
        esperarErrorDeDominio(() => reglas.resolverNombre(entrada), ERRORES.NATURALEZA_NO_DISPONIBLE);
    });

    test('lanza un error que no es de dominio si la naturaleza encontrada no tiene texto', () => {
        const error = capturarError(() => reglas.resolverNombre({ naturalezaId: '1', naturalezas: [{ id: '1', nombre: '  ' }] }));
        expect(error).toBeInstanceOf(Error);
        expect(formato.esErrorDeDominio(error)).toBe(false);
    });

    test('lanza TypeError, no error de dominio, si naturalezas no es arreglo', () => {
        esperarErrorDeProgramacion(() => reglas.resolverNombre({ naturalezaId: '', naturalezas: { id: '1' } }));
    });

    test('no muta la entrada', () => {
        const { entrada, original } = prepararEntradaInmutable({ naturalezaId: '1', naturalezas: NATURALEZAS });
        expect(reglas.resolverNombre(entrada)).toBe('Placas de Acero');
        expect(entrada).toStrictEqual(original);
    });
});

describe('regla de dependencia', () => {
    test('el define solo depende del módulo de formato y el archivo no referencia módulos N/', () => {
        const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        expect(definicion).not.toBeNull();
        const dependencias = definicion[1]
            .split(',')
            .map((dependencia) => dependencia.trim().replace(/^['"]|['"]$/g, ''))
            .filter((dependencia) => dependencia !== '');
        expect(dependencias).toEqual(['./SADS_naturaleza_config_formato']);
        expect(fuente).not.toMatch(/['"`]N\//);
    });
});
