/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @description Crea artículos de una naturaleza de producto copiando el artículo plantilla de su configuración.
 * Paso 1: naturaleza con plantilla. Paso 2: parámetros de la naturaleza y peso. Creación: valida, genera
 * código y nombre con los patrones, busca duplicados y guarda la copia de la plantilla.
 * Iteración B: espesor por catálogo, familias de precio y margen por rango de espesor, peso, conversión y descripciones.
 * Cálculo de precio (plan 2026-11-18): precio de venta sin IVA en custitem11 y en el nivel Precio base MXN, en el mismo save.
 */
define([
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
    './domain/SADS_naturaleza_precio',
    './domain/SADS_naturaleza_mapa_medidas',
    './infra/SADS_naturaleza_articulo_ns',
    './infra/SADS_naturaleza_precio_ns'
], (serverWidget, message, search, query, record, runtime, url, log, formato, patron, parametros, familias, precio, mapaMedidas,
    articulos, precioNs) => {
    const REGISTRO_CONFIGURACION = 'customrecord_sads_naturaleza_productos';

    const CAMPOS_CONFIGURACION = Object.freeze({
        JSON: 'custrecord_sads_naturaleza_config',
        PLANTILLA: 'custrecord_sads_naturaleza_plantilla',
        PATRON_NOMBRE: 'custrecord_sads_naturaleza_patron_nom',
        PATRON_CODIGO: 'custrecord_sads_naturaleza_patron_cod',
        TIPO_ESPESOR: 'custrecord_sads_naturaleza_tipo_esp',
        CAMPO_MEDIDA: 'custrecord_sads_naturaleza_campo_med',
        MAPA_MEDIDAS: 'custrecord_sads_naturaleza_mapa_med'
    });

    // RN5-01: el mapa de medidas de PTR rectangular llena estos campos del artículo.
    const REGISTRO_MAPA_MEDIDAS = 'customrecord_sads_mapa_medidas_ptrr';
    const CAMPOS_DEL_MAPA = Object.freeze({ mayor: 'custitem_sads_nat_ptr_lado', menor: 'custitem_sads_nat_ptr_lado_b' });

    // S3-06: el parámetro de catálogo (espesor) se identifica por el ID de su campo de artículo.
    const CAMPO_ESPESOR = 'custitem_sads_nat_espesor';
    const REGISTRO_ESPESOR = 'customrecord_sads_espesor';
    const REGISTRO_FAMILIA = 'customrecord_sads_nat_familia';
    const REGISTRO_FAMILIA_PRECIO = 'customrecord_pfp_famprecios';
    const REGISTRO_FAMILIA_MARGEN = 'customrecord_pfp_fammargenes_';

    // D-18: en cada par, el lado menor no puede superar al mayor. Solo aplica si ambos IDs están en el JSON.
    const PARES_DE_LADOS = Object.freeze([
        Object.freeze({ menor: 'custitem_sads_nat_pla_lado_a', mayor: 'custitem_sads_nat_pla_lado_b' })
    ]);

    // Supuesto S-04: IDs de campo válidos en inventoryitem; S-15: vendorname como campo de cuerpo.
    const CAMPOS_ARTICULO = Object.freeze({
        NATURALEZA: 'custitem_sads_naturaleza_producto',
        // D-19: en la empresa itemid guarda el nombre largo; displayname y vendorname guardan el código.
        NOMBRE_ARTICULO: 'itemid',
        CODIGO_PARA_MOSTRAR: 'displayname',
        PESO: 'weight',
        UNIDAD_PESO: 'weightunit',
        INACTIVO: 'isinactive',
        CODIGO_PROVEEDOR: 'vendorname',
        PESO_INFORMATIVO: 'custitem_drt_ci_precio_teorico',
        CONVERSION: 'custitem_alm_articulo_conversionunidad',
        FAMILIA_PRECIO: 'custitem_pfp_famprecios_',
        FAMILIA_MARGEN: 'custitem_pfp_fammargenes_',
        DESCRIPCION_COMPRA: 'purchasedescription',
        DESCRIPCION_VENTA: 'salesdescription'
    });

    // D-11: campos de proveedor heredados de la plantilla que se dejan vacíos.
    const CAMPOS_A_LIMPIAR = Object.freeze(['upccode', 'mpn']);

    // Supuesto S-14: longitud máxima de itemid, que recibe el nombre generado (D-19).
    const LONGITUD_MAXIMA_ITEMID = 60;

    // Supuesto S-16: IDs internos de weightunit; se usa solo si getText no devuelve texto (PT-11).
    const UNIDADES_PESO_RESPALDO = Object.freeze({
        1: 'lb',
        2: 'oz',
        3: 'kg',
        4: 'g'
    });

    const PARAMETRO_CREAR_ACTIVO = 'custscript_sads_sl_art_activo';
    const DECIMALES_PRECIO = 2;
    const METODO_POST = 'POST';
    const CASILLA_MARCADA = 'T';
    const PATRON_ID_INTERNO = /^[1-9][0-9]*$/;

    const CAMPOS_FORMULARIO = Object.freeze({
        CONFIGURACION: 'custpage_configuracion',
        ACCION: 'custpage_accion',
        NATURALEZA_TEXTO: 'custpage_naturaleza_texto',
        PESO: 'custpage_peso',
        CONVERSION: 'custpage_conversion',
        CODIGO: 'custpage_codigo',
        NOMBRE: 'custpage_nombre',
        ESTADO: 'custpage_estado',
        ENLACE_INICIO: 'custpage_enlace_inicio',
        ENLACE_ARTICULO: 'custpage_enlace_articulo',
        ESPESOR_TEXTO: 'custpage_espesor_texto',
        FAMILIA_TEXTO: 'custpage_familia_texto',
        CONVERSION_TEXTO: 'custpage_conversion_texto',
        PRECIO_TEXTO: 'custpage_precio_texto'
    });

    const PREFIJO_CAMPO_PARAMETRO = 'custpage_par_';

    const ACCIONES = Object.freeze({
        PARAMETROS: 'parametros',
        CREAR: 'crear'
    });

    // Supuesto S-01: columnas SuiteQL del registro de configuración.
    const SQL_CONFIGURACIONES = `
        SELECT cfg.id AS id, cfg.name AS nombre
        FROM ${REGISTRO_CONFIGURACION} cfg
        WHERE cfg.isinactive = 'F'
          AND cfg.${CAMPOS_CONFIGURACION.PLANTILLA} IS NOT NULL
        ORDER BY cfg.name`;

    // Supuesto S-02: columnas custitem_* en la tabla item. Los criterios se agregan con columnas validadas.
    const SQL_DUPLICADO_BASE = [
        'SELECT art.id AS id, art.displayname AS codigo, art.itemid AS nombre, art.isinactive AS inactivo',
        'FROM item art',
        `WHERE art.${CAMPOS_ARTICULO.NATURALEZA} = ?`
    ];
    const SQL_DUPLICADO_ORDEN = 'ORDER BY art.id';

    // C-3. Supuesto S3-11: columnas SuiteQL con el mismo nombre que el scriptid de los campos.
    const SQL_ESPESORES = `
        SELECT esp.id AS id, esp.name AS nombre, esp.custrecord_sads_esp_texto AS texto,
               esp.custrecord_sads_esp_codigo AS codigo, esp.custrecord_sads_esp_orden AS orden
        FROM ${REGISTRO_ESPESOR} esp
        WHERE esp.isinactive = 'F'
          AND esp.custrecord_sads_esp_tipo = ?
        ORDER BY esp.custrecord_sads_esp_orden`;

    // C-4. Líneas activas de familias por rango con orden y tipo de sus espesores, precio de cotización y margen (RN4-01).
    const SQL_FAMILIAS = `
        SELECT fam.id AS id,
               fam.custrecord_sads_natfam_desde AS desde_id, des.custrecord_sads_esp_orden AS desde_orden,
               des.custrecord_sads_esp_tipo AS desde_tipo,
               fam.custrecord_sads_natfam_hasta AS hasta_id, has.custrecord_sads_esp_orden AS hasta_orden,
               has.custrecord_sads_esp_tipo AS hasta_tipo,
               fam.custrecord_sads_natfam_med_desde AS medida_desde, fam.custrecord_sads_natfam_med_hasta AS medida_hasta,
               fam.custrecord_sads_natfam_precio AS precio_id, fam.custrecord_sads_natfam_margen AS margen_id,
               BUILTIN.DF(fam.custrecord_sads_natfam_precio) AS precio_nombre,
               fpr.custrecord_drt_ci_f_precio AS precio_cotizacion, fma.custrecord_drt_ci_m_margen AS margen
        FROM ${REGISTRO_FAMILIA} fam
        LEFT JOIN ${REGISTRO_ESPESOR} des ON des.id = fam.custrecord_sads_natfam_desde
        LEFT JOIN ${REGISTRO_ESPESOR} has ON has.id = fam.custrecord_sads_natfam_hasta
        LEFT JOIN ${REGISTRO_FAMILIA_PRECIO} fpr ON fpr.id = fam.custrecord_sads_natfam_precio
        LEFT JOIN ${REGISTRO_FAMILIA_MARGEN} fma ON fma.id = fam.custrecord_sads_natfam_margen
        WHERE fam.isinactive = 'F'
          AND fam.custrecord_sads_natfam_config = ?
        ORDER BY des.custrecord_sads_esp_orden`;

    // C-8. Medidas activas del mapa de PTR rectangular (RN5-01).
    const SQL_MAPA_MEDIDAS = `
        SELECT med.id AS id, med.name AS nombre, med.custrecord_sads_medptrr_lado_mayor AS lado_mayor,
               med.custrecord_sads_medptrr_lado_menor AS lado_menor, med.custrecord_sads_medptrr_codigo AS codigo
        FROM ${REGISTRO_MAPA_MEDIDAS} med
        WHERE med.isinactive = 'F'
        ORDER BY med.custrecord_sads_medptrr_lado_mayor, med.custrecord_sads_medptrr_lado_menor`;

    const TITULOS_FORMULARIO = Object.freeze({
        PASO_1: 'Crear artículo por naturaleza - Paso 1 de 2',
        PASO_2: 'Crear artículo por naturaleza - Paso 2 de 2',
        CONFIRMACION: 'Crear artículo por naturaleza - Artículo creado',
        DUPLICADO: 'Crear artículo por naturaleza - Artículo existente',
        ERROR: 'Crear artículo por naturaleza'
    });

    const ETIQUETAS = Object.freeze({
        NATURALEZA: 'Naturaleza de producto',
        ACCION: 'Acción',
        PESO_CON_UNIDAD: (unidad) => `Peso (${unidad})`,
        PESO_SIN_UNIDAD: 'Peso (unidad de la plantilla)',
        CONVERSION: 'Conversión unidad de compra a base',
        ESPESOR: 'Espesor',
        FAMILIA_PRECIO: 'Familia de precio',
        MEDIDA: 'Medida',
        PRECIO: 'Precio base (MXN, sin IVA)',
        CODIGO: 'Código',
        NOMBRE: 'Nombre',
        ESTADO: 'Estado',
        ACTIVO: 'Activo',
        INACTIVO: 'Inactivo',
        BOTON_SIGUIENTE: 'Siguiente',
        BOTON_CREAR: 'Crear artículo',
        ENLACE_REGRESAR: 'Regresar',
        ENLACE_CREAR_OTRO: 'Crear otro',
        ENLACE_ARTICULO: 'Ver artículo'
    });

    const TITULOS_AVISO = Object.freeze({
        REVISAR: 'Revise la información',
        SIN_OPCIONES: 'Sin naturalezas disponibles',
        DUPLICADO: 'Artículo existente',
        CREADO: 'Artículo creado',
        PRECIO_DISTINTO: 'Revise el precio',
        ERROR: 'No fue posible continuar'
    });

    const MENSAJES = Object.freeze({
        SIN_CONFIGURACIONES: 'No hay naturalezas con artículo plantilla configurado.',
        NATURALEZA_INVALIDA: 'La naturaleza seleccionada no es válida o ya no está disponible.',
        CONFIGURACION_INCOMPLETA: 'La configuración de esta naturaleza está incompleta: falta el artículo plantilla o un patrón. '
            + 'Contacte a un usuario técnico.',
        CONFIGURACION_INVALIDA: (errores) => `La configuración de esta naturaleza no es válida: ${errores.join('; ')}`,
        PLANTILLA_INEXISTENTE: 'El artículo plantilla de esta naturaleza no existe.',
        SIN_TIPO_ESPESOR: 'La naturaleza usa espesor pero no tiene tipo de espesor.',
        SIN_ESPESORES: 'No hay espesores activos para el tipo de esta naturaleza.',
        SIN_FAMILIAS: 'La naturaleza no tiene familias de precio configuradas.',
        CAMPO_MEDIDA_INVALIDO: 'El campo de medida para familias debe ser un parámetro numérico de la configuración.',
        MAPA_SIN_CAMPOS: 'La configuración usa el mapa de medidas: el JSON debe incluir custitem_sads_nat_ptr_lado y '
            + 'custitem_sads_nat_ptr_lado_b como parámetros numéricos.',
        MAPA_INVALIDO: (errores) => `El mapa de medidas no es válido: ${errores.join('; ')}`,
        NOMBRE_LARGO: `El nombre generado excede ${LONGITUD_MAXIMA_ITEMID} caracteres; revise el patrón de nombre de la naturaleza.`,
        COLUMNA_NO_PERMITIDA: 'La configuración de esta naturaleza contiene un ID de campo no válido para buscar duplicados.',
        DUPLICADO: 'Ya existe un artículo con esta naturaleza y estos parámetros.',
        CREADO: 'El artículo se creó correctamente.',
        PRECIO_DISTINTO: (calculado, formula) => `El precio guardado (${calculado}) difiere del campo fórmula PRECIO FINAL `
            + `(${formula}). Revise las fórmulas de precio de la cuenta contra el Suitelet.`,
        GENERICO: 'No fue posible completar la operación. Contacte al administrador.'
    });

    const TITULOS_LOG = Object.freeze({
        CREADO: 'Crear artículo por naturaleza: artículo creado',
        DUPLICADO: 'Crear artículo por naturaleza: duplicado',
        PRECIO_DISTINTO: 'Crear artículo por naturaleza: precio distinto de la fórmula',
        ERROR_DE_DOMINIO: 'Crear artículo por naturaleza: error de dominio',
        ERROR_INESPERADO: 'Crear artículo por naturaleza: error inesperado'
    });

    const ENTIDADES_HTML = Object.freeze({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
    });

    const aCadena = (valor) => (valor === null || valor === undefined ? '' : String(valor));

    const escaparHtml = (valor) => aCadena(valor).replace(/[&<>"']/g, (caracter) => ENTIDADES_HTML[caracter]);

    const describirError = (error) => {
        if (error === null || typeof error !== 'object') return aCadena(error);
        return `${aCadena(error.name)}: ${aCadena(error.message)}\n${aCadena(error.stack)}`;
    };

    const errorDeConfiguracion = (mensaje) => formato.crearErrorDeDominio(formato.ERRORES.CONFIGURACION_INVALIDA, mensaje);

    const ejecutarConsulta = (sql, valores) => query.runSuiteQL({ query: sql, params: valores }).asMappedResults();

    const textoONulo = (valor) => {
        const texto = aCadena(valor).trim();
        return texto === '' ? null : texto;
    };

    const numeroONulo = (valor) => {
        const texto = textoONulo(valor);
        if (texto === null) return null;
        const numero = Number(texto);
        return Number.isFinite(numero) ? numero : null;
    };

    const esCasillaMarcada = (valor) => valor === true || aCadena(valor) === CASILLA_MARCADA;

    // search.lookupFields devuelve los SELECT como arreglo de {value, text}.
    const valorDeSeleccion = (valor) => {
        if (Array.isArray(valor)) return valor.length > 0 ? textoONulo(valor[0].value) : null;
        return textoONulo(valor);
    };

    /**
     * Carga las configuraciones activas con artículo plantilla (C-1, RN-01).
     * @returns {Array<{id: string, nombre: string}>} Objetos planos ordenados por nombre.
     */
    const cargarConfiguraciones = () => ejecutarConsulta(SQL_CONFIGURACIONES, []).map((fila) => ({
        id: aCadena(fila.id),
        nombre: aCadena(fila.nombre)
    }));

    /**
     * Lee el JSON, la plantilla y los patrones de una configuración con search.lookupFields.
     * @param {string} configuracionId - ID interno validado contra C-1.
     * @returns {{ids: string[], plantillaId: ?string, patronNombre: string, patronCodigo: string, tipoEspesorId: ?string,
     * campoMedida: ?string}}
     * plantillaId es null si está vacía o no es un entero positivo; tipoEspesorId es null si no está capturado.
     * @throws {Error} CONFIGURACION_INVALIDA si el JSON no cumple el contrato de formato.
     */
    const leerConfiguracion = (configuracionId) => {
        const campos = search.lookupFields({
            type: REGISTRO_CONFIGURACION,
            id: configuracionId,
            columns: [
                CAMPOS_CONFIGURACION.JSON,
                CAMPOS_CONFIGURACION.PLANTILLA,
                CAMPOS_CONFIGURACION.PATRON_NOMBRE,
                CAMPOS_CONFIGURACION.PATRON_CODIGO,
                CAMPOS_CONFIGURACION.TIPO_ESPESOR,
                CAMPOS_CONFIGURACION.CAMPO_MEDIDA,
                CAMPOS_CONFIGURACION.MAPA_MEDIDAS
            ]
        });
        const plantilla = aCadena(campos[CAMPOS_CONFIGURACION.PLANTILLA]).trim();
        return {
            ids: formato.parsearConfiguracion(campos[CAMPOS_CONFIGURACION.JSON]),
            plantillaId: PATRON_ID_INTERNO.test(plantilla) ? plantilla : null,
            patronNombre: aCadena(campos[CAMPOS_CONFIGURACION.PATRON_NOMBRE]),
            patronCodigo: aCadena(campos[CAMPOS_CONFIGURACION.PATRON_CODIGO]),
            tipoEspesorId: valorDeSeleccion(campos[CAMPOS_CONFIGURACION.TIPO_ESPESOR]),
            campoMedida: textoONulo(campos[CAMPOS_CONFIGURACION.CAMPO_MEDIDA]),
            usaMapa: esCasillaMarcada(campos[CAMPOS_CONFIGURACION.MAPA_MEDIDAS])
        };
    };

    /**
     * Carga el catálogo de espesores activos de un tipo (C-3, RN3-01).
     * @param {string} tipoId - ID interno del tipo de espesor.
     * @returns {Array<{id: string, nombre: string, texto: string, codigo: string, orden: ?number}>} Ordenado por orden.
     */
    const cargarEspesores = (tipoId) => ejecutarConsulta(SQL_ESPESORES, [tipoId]).map((fila) => ({
        id: aCadena(fila.id),
        nombre: aCadena(fila.nombre),
        texto: aCadena(fila.texto),
        codigo: aCadena(fila.codigo),
        orden: numeroONulo(fila.orden)
    }));

    /**
     * Carga las líneas activas de familias por rango de una configuración (C-4).
     * @param {string} configuracionId - ID interno de la configuración.
     * @returns {Object[]} Líneas planas para domain/SADS_naturaleza_familias.
     */
    const cargarFamilias = (configuracionId) => ejecutarConsulta(SQL_FAMILIAS, [configuracionId]).map((fila) => ({
        id: aCadena(fila.id),
        desdeId: textoONulo(fila.desde_id),
        hastaId: textoONulo(fila.hasta_id),
        desdeOrden: numeroONulo(fila.desde_orden),
        hastaOrden: numeroONulo(fila.hasta_orden),
        desdeTipo: textoONulo(fila.desde_tipo),
        hastaTipo: textoONulo(fila.hasta_tipo),
        medidaDesde: numeroONulo(fila.medida_desde),
        medidaHasta: numeroONulo(fila.medida_hasta),
        familiaPrecioId: aCadena(fila.precio_id),
        familiaMargenId: aCadena(fila.margen_id),
        familiaPrecioNombre: aCadena(fila.precio_nombre),
        precioCotizacion: numeroONulo(fila.precio_cotizacion),
        margen: numeroONulo(fila.margen)
    }));

    /**
     * Carga las medidas activas del mapa de PTR rectangular (C-8, RN5-01).
     * @returns {Array<{id: string, nombre: string, ladoMayor: ?number, ladoMenor: ?number, codigo: string}>}
     */
    const cargarMapaMedidas = () => ejecutarConsulta(SQL_MAPA_MEDIDAS, []).map((fila) => ({
        id: aCadena(fila.id),
        nombre: aCadena(fila.nombre),
        ladoMayor: numeroONulo(fila.lado_mayor),
        ladoMenor: numeroONulo(fila.lado_menor),
        codigo: aCadena(fila.codigo).trim()
    }));

    /**
     * Resuelve el tipo de registro de un artículo con el adaptador compartido (PT-01, PT-10).
     * @param {string} articuloId - ID interno del artículo.
     * @returns {?string} Tipo de registro o null si el artículo no existe.
     */
    const resolverTipoRegistroArticulo = (articuloId) => articulos.resolverTipoRegistroArticulo(articuloId);

    /**
     * Describe los parámetros de la naturaleza con los campos de la copia de la plantilla (S-03).
     * El campo de espesor se describe como catálogo sin depender de Field.type (S3-06).
     * @param {record.Record} copia - Copia en memoria de la plantilla.
     * @param {string[]} ids - IDs del JSON de configuración.
     * @returns {Array<{id: string, etiqueta: string, tipo: ?string}>} tipo null si el campo no existe en la copia.
     */
    const describirParametros = (copia, ids) => ids.map((id) => {
        const campo = copia.getField({ fieldId: id });
        if (campo === null || campo === undefined) return { id, etiqueta: id, tipo: null };
        const etiqueta = aCadena(campo.label).trim();
        const tipo = id === CAMPO_ESPESOR ? parametros.TIPOS_SOPORTADOS.CATALOGO : aCadena(campo.type).trim().toLowerCase();
        return { id, etiqueta: etiqueta === '' ? id : etiqueta, tipo: tipo === '' ? null : tipo };
    });

    const armarConsultaDuplicado = (criterios) => SQL_DUPLICADO_BASE
        .concat(criterios.map((criterio) => `AND art.${criterio.columna} = ?`))
        .concat([SQL_DUPLICADO_ORDEN])
        .join('\n');

    const asegurarColumnasPermitidas = (criterios, ids) => {
        const permitidas = criterios.every((criterio) => (
            parametros.esIdentificadorSeguro(criterio.columna) && ids.indexOf(criterio.columna) !== -1
        ));
        if (!permitidas) throw errorDeConfiguracion(MENSAJES.COLUMNA_NO_PERMITIDA);
    };

    /**
     * Busca un artículo, activo o inactivo, con la misma naturaleza y los mismos valores de parámetros (C-2, RN-08).
     * Cada columna se valida con parametros.esIdentificadorSeguro; los valores van como parámetros (R-04).
     * @param {string} configuracionId - ID interno de la configuración.
     * @param {Array<{columna: string, valor: number}>} criterios - Resultado de parametros.armarCriteriosDuplicado.
     * @returns {?{id: string, codigo: string, nombre: string, inactivo: boolean}} Primer artículo encontrado o null;
     * codigo = displayname y nombre = itemid (D-19).
     * @throws {Error} CONFIGURACION_INVALIDA si una columna no es un identificador seguro.
     */
    const buscarDuplicado = (configuracionId, criterios) => {
        if (!criterios.every((criterio) => parametros.esIdentificadorSeguro(criterio.columna))) {
            throw errorDeConfiguracion(MENSAJES.COLUMNA_NO_PERMITIDA);
        }
        const filas = ejecutarConsulta(
            armarConsultaDuplicado(criterios),
            [configuracionId].concat(criterios.map((criterio) => criterio.valor))
        );
        if (filas.length === 0) return null;
        const fila = filas[0];
        return {
            id: aCadena(fila.id),
            codigo: aCadena(fila.codigo),
            nombre: aCadena(fila.nombre),
            inactivo: fila.inactivo === true || aCadena(fila.inactivo) === CASILLA_MARCADA
        };
    };

    /**
     * Escribe en la copia de la plantilla los valores del artículo nuevo (RN-09, RN-10, PT-12, RN3-10 a RN3-13).
     * @param {record.Record} copia - Copia en memoria de la plantilla.
     * @param {Object} datos
     * @param {string} datos.configuracionId - ID interno de la configuración.
     * @param {string[]} datos.ids - IDs de los parámetros.
     * @param {Object<string, number>} datos.valores - Valor por ID.
     * @param {number} datos.peso - Peso capturado (kg).
     * @param {number} datos.conversion - Conversión de unidad de compra a base.
     * @param {{familiaPrecioId: string, familiaMargenId: string}} datos.familia - Línea resuelta por familias.resolver.
     * @param {string} datos.codigo - Código generado; va a displayname y a vendorname (D-19).
     * @param {string} datos.nombre - Nombre generado; va a itemid y a las descripciones de compra y venta (D-19, RN3-12).
     * @param {boolean} datos.activo - Resultado de leerCrearActivo.
     * @returns {void}
     */
    const asignarValores = (copia, { configuracionId, ids, valores, peso, conversion, familia, codigo, nombre, activo }) => {
        copia.setValue({ fieldId: CAMPOS_ARTICULO.NATURALEZA, value: configuracionId });
        ids.forEach((id) => {
            copia.setValue({ fieldId: id, value: valores[id] });
        });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.PESO, value: peso });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.PESO_INFORMATIVO, value: peso });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.CONVERSION, value: conversion });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.FAMILIA_PRECIO, value: familia.familiaPrecioId });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.FAMILIA_MARGEN, value: familia.familiaMargenId });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.NOMBRE_ARTICULO, value: nombre });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.CODIGO_PARA_MOSTRAR, value: codigo });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.CODIGO_PROVEEDOR, value: codigo });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.DESCRIPCION_COMPRA, value: nombre });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.DESCRIPCION_VENTA, value: nombre });
        CAMPOS_A_LIMPIAR.forEach((id) => {
            copia.setValue({ fieldId: id, value: '' });
        });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.INACTIVO, value: !activo });
    };

    /**
     * Lee el parámetro que decide si el artículo se crea activo (RN-10).
     * @returns {boolean} true solo si el parámetro vale true o 'T'.
     */
    const leerCrearActivo = () => {
        const valor = runtime.getCurrentScript().getParameter({ name: PARAMETRO_CREAR_ACTIVO });
        return valor === true || valor === CASILLA_MARCADA;
    };

    const leerTextoSeguro = (lector) => {
        try {
            return aCadena(lector()).trim();
        } catch (errorDeLectura) {
            return '';
        }
    };

    // PT-11: getText sobre una copia en modo estándar puede fallar o no devolver texto.
    const leerUnidadDePeso = (copia) => {
        const texto = leerTextoSeguro(() => copia.getText({ fieldId: CAMPOS_ARTICULO.UNIDAD_PESO }));
        if (texto !== '') return texto;
        const valor = leerTextoSeguro(() => copia.getValue({ fieldId: CAMPOS_ARTICULO.UNIDAD_PESO }));
        return Object.prototype.hasOwnProperty.call(UNIDADES_PESO_RESPALDO, valor) ? UNIDADES_PESO_RESPALDO[valor] : null;
    };

    const urlDelSuitelet = () => {
        const script = runtime.getCurrentScript();
        return url.resolveScript({ scriptId: script.id, deploymentId: script.deploymentId });
    };

    const urlDelArticulo = (tipoRegistro, articuloId) => url.resolveRecord({
        recordType: tipoRegistro,
        recordId: articuloId,
        isEditMode: false
    });

    const crearFormulario = (titulo) => serverWidget.createForm({ title: titulo });

    const agregarAviso = (form, { tipo, titulo, lineas }) => {
        form.addPageInitMessage({
            type: tipo,
            title: escaparHtml(titulo),
            message: lineas.map((linea) => escaparHtml(linea)).join('<br>')
        });
    };

    const agregarCampoOculto = (form, { id, etiqueta, valor }) => {
        const campo = form.addField({ id, label: etiqueta, type: serverWidget.FieldType.TEXT });
        campo.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        campo.defaultValue = valor;
    };

    const agregarTextoDeSoloLectura = (form, { id, etiqueta, valor }) => {
        const campo = form.addField({ id, label: etiqueta, type: serverWidget.FieldType.TEXT });
        campo.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        campo.defaultValue = valor;
    };

    // El HTML solo lleva una URL resuelta por NetSuite y texto fijo; ningún dato del usuario ni de registros.
    const agregarEnlace = (form, { id, texto, destino }) => {
        const campo = form.addField({ id, label: texto, type: serverWidget.FieldType.INLINEHTML });
        campo.defaultValue = `<p><a href="${escaparHtml(destino)}">${escaparHtml(texto)}</a></p>`;
    };

    const agregarSeleccion = (form, { id, etiqueta, opciones, valorPrevio }) => {
        const campo = form.addField({ id, label: etiqueta, type: serverWidget.FieldType.SELECT });
        campo.isMandatory = true;
        campo.addSelectOption({ value: '', text: '' });
        const previo = aCadena(valorPrevio).trim();
        opciones.forEach((opcion) => {
            campo.addSelectOption({ value: opcion.id, text: opcion.nombre, isSelected: opcion.id === previo });
        });
    };

    const agregarCampoNumerico = (form, { id, etiqueta, entero, valorPrevio }) => {
        const campo = form.addField({
            id,
            label: escaparHtml(etiqueta),
            type: entero ? serverWidget.FieldType.INTEGER : serverWidget.FieldType.FLOAT
        });
        campo.isMandatory = true;
        const previo = aCadena(valorPrevio).trim();
        if (previo !== '') campo.defaultValue = previo;
    };

    const textoDeEstado = (inactivo) => (inactivo ? ETIQUETAS.INACTIVO : ETIQUETAS.ACTIVO);

    const etiquetaDePeso = (unidad) => (unidad === null ? ETIQUETAS.PESO_SIN_UNIDAD : ETIQUETAS.PESO_CON_UNIDAD(unidad));

    const campoDeParametro = (posicion) => `${PREFIJO_CAMPO_PARAMETRO}${posicion}`;

    /**
     * Construye el paso 1: selección de la naturaleza.
     * @param {Object} datos
     * @param {Array<{id: string, nombre: string}>} datos.configuraciones - Resultado de C-1.
     * @param {*} datos.configuracionId - Valor enviado antes; queda seleccionado si sigue en C-1.
     * @param {string[]} datos.errores - Mensajes de validación.
     * @returns {serverWidget.Form}
     */
    const construirPaso1 = ({ configuraciones, configuracionId, errores }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.PASO_1);
        if (errores.length > 0) {
            agregarAviso(form, { tipo: message.Type.ERROR, titulo: TITULOS_AVISO.REVISAR, lineas: errores });
        }
        if (configuraciones.length === 0) {
            agregarAviso(form, {
                tipo: message.Type.INFORMATION,
                titulo: TITULOS_AVISO.SIN_OPCIONES,
                lineas: [MENSAJES.SIN_CONFIGURACIONES]
            });
            return form;
        }
        agregarSeleccion(form, {
            id: CAMPOS_FORMULARIO.CONFIGURACION,
            etiqueta: ETIQUETAS.NATURALEZA,
            opciones: configuraciones,
            valorPrevio: configuracionId
        });
        agregarCampoOculto(form, { id: CAMPOS_FORMULARIO.ACCION, etiqueta: ETIQUETAS.ACCION, valor: ACCIONES.PARAMETROS });
        form.addSubmitButton({ label: ETIQUETAS.BOTON_SIGUIENTE });
        return form;
    };

    /**
     * Construye el paso 2: un campo por parámetro y el peso.
     * @param {Object} datos
     * @param {{id: string, nombre: string}} datos.configuracion - Configuración elegida (C-1).
     * @param {Array<{id: string, etiqueta: string, tipo: string}>} datos.definicion - Parámetros validados.
     * @param {?string} datos.unidadPeso - Unidad de peso de la plantilla o null.
     * @param {Array<*>} datos.valoresPrevios - Capturas previas alineadas por índice.
     * @param {Object<string, Array<{id: string, nombre: string}>>} datos.catalogos - Opciones por ID de parámetro de catálogo:
     * espesores de C-3 y medidas de C-8 (RN5-01).
     * @param {*} datos.pesoPrevio - Peso capturado antes.
     * @param {*} datos.conversionPrevia - Conversión capturada antes.
     * @param {string[]} datos.errores - Mensajes de validación.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirPaso2 = ({
        configuracion, definicion, unidadPeso, catalogos, valoresPrevios, pesoPrevio, conversionPrevia, errores, urlInicio
    }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.PASO_2);
        if (errores.length > 0) {
            agregarAviso(form, { tipo: message.Type.ERROR, titulo: TITULOS_AVISO.REVISAR, lineas: errores });
        }
        agregarTextoDeSoloLectura(form, {
            id: CAMPOS_FORMULARIO.NATURALEZA_TEXTO,
            etiqueta: ETIQUETAS.NATURALEZA,
            valor: configuracion.nombre
        });
        agregarCampoOculto(form, {
            id: CAMPOS_FORMULARIO.CONFIGURACION,
            etiqueta: ETIQUETAS.NATURALEZA,
            valor: configuracion.id
        });
        agregarCampoOculto(form, { id: CAMPOS_FORMULARIO.ACCION, etiqueta: ETIQUETAS.ACCION, valor: ACCIONES.CREAR });
        definicion.forEach((parametro, posicion) => {
            if (parametro.tipo === parametros.TIPOS_SOPORTADOS.CATALOGO) {
                agregarSeleccion(form, {
                    id: campoDeParametro(posicion),
                    etiqueta: escaparHtml(parametro.etiqueta),
                    opciones: catalogos[parametro.id] || [],
                    valorPrevio: valoresPrevios[posicion]
                });
                return;
            }
            agregarCampoNumerico(form, {
                id: campoDeParametro(posicion),
                etiqueta: parametro.etiqueta,
                entero: parametro.tipo === parametros.TIPOS_SOPORTADOS.INTEGER,
                valorPrevio: valoresPrevios[posicion]
            });
        });
        agregarCampoNumerico(form, {
            id: CAMPOS_FORMULARIO.PESO,
            etiqueta: etiquetaDePeso(unidadPeso),
            entero: false,
            valorPrevio: pesoPrevio
        });
        agregarCampoNumerico(form, {
            id: CAMPOS_FORMULARIO.CONVERSION,
            etiqueta: ETIQUETAS.CONVERSION,
            entero: false,
            valorPrevio: conversionPrevia
        });
        agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_INICIO, texto: ETIQUETAS.ENLACE_REGRESAR, destino: urlInicio });
        form.addSubmitButton({ label: ETIQUETAS.BOTON_CREAR });
        return form;
    };

    const agregarResumenDelArticulo = (form, { codigo, nombre, inactivo }) => {
        agregarTextoDeSoloLectura(form, { id: CAMPOS_FORMULARIO.CODIGO, etiqueta: ETIQUETAS.CODIGO, valor: codigo });
        if (nombre !== null) {
            agregarTextoDeSoloLectura(form, { id: CAMPOS_FORMULARIO.NOMBRE, etiqueta: ETIQUETAS.NOMBRE, valor: nombre });
        }
        agregarTextoDeSoloLectura(form, { id: CAMPOS_FORMULARIO.ESTADO, etiqueta: ETIQUETAS.ESTADO, valor: textoDeEstado(inactivo) });
    };

    const agregarEnlacesFinales = (form, { urlArticulo, urlInicio }) => {
        if (urlArticulo !== null) {
            agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_ARTICULO, texto: ETIQUETAS.ENLACE_ARTICULO, destino: urlArticulo });
        }
        agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_INICIO, texto: ETIQUETAS.ENLACE_CREAR_OTRO, destino: urlInicio });
    };

    /**
     * Construye la confirmación del alta.
     * @param {Object} datos
     * @param {string} datos.codigo - Código guardado.
     * @param {string} datos.nombre - Nombre guardado.
     * @param {boolean} datos.inactivo - Estado guardado.
     * @param {?string} datos.espesor - Nombre del espesor elegido; null si la naturaleza no usa espesor.
     * @param {string} datos.familiaPrecio - Nombre de la familia de precio asignada.
     * @param {number} datos.conversion - Conversión guardada.
     * @param {string} datos.precio - Precio base guardado con 2 decimales.
     * @param {?string} datos.advertencia - Aviso de precio distinto del campo fórmula (RN4-08); null si no aplica.
     * @param {string} datos.urlArticulo - URL del artículo creado.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirConfirmacion = ({
        codigo, nombre, inactivo, espesor, familiaPrecio, conversion, precio: precioBase, advertencia, urlArticulo, urlInicio
    }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.CONFIRMACION);
        agregarAviso(form, { tipo: message.Type.CONFIRMATION, titulo: TITULOS_AVISO.CREADO, lineas: [MENSAJES.CREADO] });
        if (advertencia !== null) {
            agregarAviso(form, { tipo: message.Type.WARNING, titulo: TITULOS_AVISO.PRECIO_DISTINTO, lineas: [advertencia] });
        }
        agregarResumenDelArticulo(form, { codigo, nombre, inactivo });
        if (espesor !== null) {
            agregarTextoDeSoloLectura(form, { id: CAMPOS_FORMULARIO.ESPESOR_TEXTO, etiqueta: ETIQUETAS.ESPESOR, valor: espesor });
        }
        agregarTextoDeSoloLectura(form, { id: CAMPOS_FORMULARIO.FAMILIA_TEXTO, etiqueta: ETIQUETAS.FAMILIA_PRECIO, valor: familiaPrecio });
        agregarTextoDeSoloLectura(form, {
            id: CAMPOS_FORMULARIO.CONVERSION_TEXTO,
            etiqueta: ETIQUETAS.CONVERSION,
            valor: aCadena(conversion)
        });
        agregarTextoDeSoloLectura(form, { id: CAMPOS_FORMULARIO.PRECIO_TEXTO, etiqueta: ETIQUETAS.PRECIO, valor: precioBase });
        agregarEnlacesFinales(form, { urlArticulo, urlInicio });
        return form;
    };

    /**
     * Construye la página de artículo existente (RN-08).
     * @param {Object} datos
     * @param {string} datos.codigo - Código del artículo existente.
     * @param {string} datos.nombre - Nombre (itemid) del artículo existente.
     * @param {boolean} datos.inactivo - Estado del artículo existente.
     * @param {?string} datos.urlArticulo - URL del artículo existente; null si no se resolvió su tipo.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirDuplicado = ({ codigo, nombre, inactivo, urlArticulo, urlInicio }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.DUPLICADO);
        agregarAviso(form, { tipo: message.Type.INFORMATION, titulo: TITULOS_AVISO.DUPLICADO, lineas: [MENSAJES.DUPLICADO] });
        agregarResumenDelArticulo(form, { codigo, nombre, inactivo });
        agregarEnlacesFinales(form, { urlArticulo, urlInicio });
        return form;
    };

    /**
     * Construye la página de error.
     * @param {Object} datos
     * @param {string} datos.mensaje - Mensaje de dominio o mensaje genérico.
     * @param {?string} datos.urlInicio - URL del paso 1; null si no se pudo resolver.
     * @returns {serverWidget.Form}
     */
    const construirPaginaDeError = ({ mensaje, urlInicio }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.ERROR);
        agregarAviso(form, { tipo: message.Type.ERROR, titulo: TITULOS_AVISO.ERROR, lineas: [mensaje] });
        if (urlInicio !== null) {
            agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_INICIO, texto: ETIQUETAS.ENLACE_REGRESAR, destino: urlInicio });
        }
        return form;
    };

    const leerParametro = (solicitud, nombre) => (solicitud.parameters || {})[nombre];

    const construirPasoInicial = () => construirPaso1({
        configuraciones: cargarConfiguraciones(),
        configuracionId: '',
        errores: []
    });

    // RN-11: del formulario solo se toma el ID de configuración, validado contra C-1 en cada POST.
    const elegirConfiguracion = (solicitud) => {
        const configuraciones = cargarConfiguraciones();
        const configuracionId = aCadena(leerParametro(solicitud, CAMPOS_FORMULARIO.CONFIGURACION)).trim();
        const encontradas = PATRON_ID_INTERNO.test(configuracionId)
            ? configuraciones.filter((configuracion) => configuracion.id === configuracionId)
            : [];
        return {
            configuraciones,
            configuracionId,
            configuracion: encontradas.length > 0 ? encontradas[0] : null
        };
    };

    const paso1ConNaturalezaInvalida = ({ configuraciones, configuracionId }) => construirPaso1({
        configuraciones,
        configuracionId,
        errores: [MENSAJES.NATURALEZA_INVALIDA]
    });

    const parametroDeCatalogo = (definicion) => {
        const encontrados = definicion.filter((parametro) => parametro.id === CAMPO_ESPESOR
            && parametro.tipo === parametros.TIPOS_SOPORTADOS.CATALOGO);
        return encontrados.length > 0 ? encontrados[0] : null;
    };

    // RN3-01, RN3-08: el catálogo solo se carga si la naturaleza usa espesor.
    const cargarCatalogo = (definicion, tipoEspesorId) => {
        if (parametroDeCatalogo(definicion) === null) return [];
        if (tipoEspesorId === null) throw errorDeConfiguracion(MENSAJES.SIN_TIPO_ESPESOR);
        const espesores = cargarEspesores(tipoEspesorId);
        if (espesores.length === 0) throw errorDeConfiguracion(MENSAJES.SIN_ESPESORES);
        return espesores;
    };

    // D-21: el campo de medida para familias debe ser un parámetro numérico del JSON.
    const validarCampoMedida = (campoMedida, definicion) => {
        if (campoMedida === null) return;
        const numericos = [parametros.TIPOS_SOPORTADOS.FLOAT, parametros.TIPOS_SOPORTADOS.INTEGER];
        const valido = definicion.some((parametro) => parametro.id === campoMedida && numericos.indexOf(parametro.tipo) !== -1);
        if (!valido) throw errorDeConfiguracion(MENSAJES.CAMPO_MEDIDA_INVALIDO);
    };

    // RN5-01: con el mapa, los dos lados deben ser parámetros numéricos del JSON; el mapa se valida completo (RN5-02).
    const cargarMapa = (definicion) => {
        const numericos = [parametros.TIPOS_SOPORTADOS.FLOAT, parametros.TIPOS_SOPORTADOS.INTEGER];
        const esNumerico = (id) => definicion.some((parametro) => parametro.id === id && numericos.indexOf(parametro.tipo) !== -1);
        if (!esNumerico(CAMPOS_DEL_MAPA.mayor) || !esNumerico(CAMPOS_DEL_MAPA.menor)) throw errorDeConfiguracion(MENSAJES.MAPA_SIN_CAMPOS);
        const medidas = cargarMapaMedidas();
        const revision = mapaMedidas.validarFilas(medidas);
        if (!revision.valido) throw errorDeConfiguracion(MENSAJES.MAPA_INVALIDO(revision.errores));
        return medidas;
    };

    // RN5-01: en el paso 2 los lados no se capturan; se elige una medida del mapa.
    const definicionConMapa = (definicion) => [{
        id: mapaMedidas.MARCADOR,
        etiqueta: ETIQUETAS.MEDIDA,
        tipo: parametros.TIPOS_SOPORTADOS.CATALOGO
    }].concat(definicion.filter((parametro) => parametro.id !== CAMPOS_DEL_MAPA.mayor && parametro.id !== CAMPOS_DEL_MAPA.menor));

    const opcionesPorCatalogo = (preparacion) => ({
        [CAMPO_ESPESOR]: preparacion.espesores,
        [mapaMedidas.MARCADOR]: preparacion.medidas
    });

    // Preparación común del paso 2 y de la creación: una sola copia de la plantilla por solicitud (PT-02).
    const prepararNaturaleza = (configuracion) => {
        const leida = leerConfiguracion(configuracion.id);
        const ids = parametros.validarIds(leida.ids);
        if (leida.plantillaId === null || leida.patronNombre.trim() === '' || leida.patronCodigo.trim() === '') {
            throw errorDeConfiguracion(MENSAJES.CONFIGURACION_INCOMPLETA);
        }
        if (!ids.valido) throw errorDeConfiguracion(MENSAJES.CONFIGURACION_INVALIDA(ids.errores));
        const tipoRegistro = resolverTipoRegistroArticulo(leida.plantillaId);
        if (tipoRegistro === null) throw errorDeConfiguracion(MENSAJES.PLANTILLA_INEXISTENTE);
        const copia = record.copy({ type: tipoRegistro, id: leida.plantillaId, isDynamic: false });
        const definicion = describirParametros(copia, leida.ids);
        const revision = parametros.validarDefinicion(definicion);
        if (!revision.valido) throw errorDeConfiguracion(MENSAJES.CONFIGURACION_INVALIDA(revision.errores));
        const espesores = cargarCatalogo(definicion, leida.tipoEspesorId);
        const lineasDeFamilia = cargarFamilias(configuracion.id);
        if (lineasDeFamilia.length === 0) throw errorDeConfiguracion(MENSAJES.SIN_FAMILIAS);
        validarCampoMedida(leida.campoMedida, definicion);
        const medidas = leida.usaMapa ? cargarMapa(definicion) : [];
        return {
            configuracion,
            ids: leida.ids,
            patronNombre: leida.patronNombre,
            patronCodigo: leida.patronCodigo,
            tipoRegistro,
            copia,
            definicion,
            espesores,
            lineasDeFamilia,
            campoMedida: leida.campoMedida,
            medidas,
            captura: leida.usaMapa ? definicionConMapa(definicion) : definicion
        };
    };

    const mostrarPaso2 = (preparacion, { valoresPrevios, pesoPrevio, conversionPrevia, errores }) => construirPaso2({
        configuracion: preparacion.configuracion,
        definicion: preparacion.captura,
        unidadPeso: leerUnidadDePeso(preparacion.copia),
        catalogos: opcionesPorCatalogo(preparacion),
        valoresPrevios,
        pesoPrevio,
        conversionPrevia,
        errores,
        urlInicio: urlDelSuitelet()
    });

    const atenderParametros = (solicitud) => {
        const eleccion = elegirConfiguracion(solicitud);
        if (eleccion.configuracion === null) return paso1ConNaturalezaInvalida(eleccion);
        return mostrarPaso2(prepararNaturaleza(eleccion.configuracion), {
            valoresPrevios: [], pesoPrevio: '', conversionPrevia: '', errores: []
        });
    };

    const mostrarDuplicado = ({ configuracionId, duplicado }) => {
        log.audit({
            title: TITULOS_LOG.DUPLICADO,
            details: `Configuración: ${configuracionId}. Artículo existente: ${duplicado.id}. Código: ${duplicado.codigo}.`
        });
        const tipoRegistro = resolverTipoRegistroArticulo(duplicado.id);
        return construirDuplicado({
            codigo: duplicado.codigo,
            nombre: duplicado.nombre,
            inactivo: duplicado.inactivo,
            urlArticulo: tipoRegistro === null ? null : urlDelArticulo(tipoRegistro, duplicado.id),
            urlInicio: urlDelSuitelet()
        });
    };

    const formatearPrecio = (valor) => Number(valor).toFixed(DECIMALES_PRECIO);

    /**
     * Calcula el precio del artículo nuevo antes de guardar (RN4-01 a RN4-03, RN4-07).
     * @param {Object} preparacion - Resultado de prepararNaturaleza.
     * @param {Object} datos
     * @param {Object} datos.familia - Línea resuelta por familias.resolver, con precioCotizacion y margen (C-4).
     * @param {number} datos.peso - Peso capturado (kg).
     * @param {number} datos.conversion - Conversión capturada.
     * @returns {{entradas: Object, calculo: Object, monedaPrecioId: string}}
     * @throws {Error} PRECIO_INVALIDO si falta un dato o el resultado no es válido; CONFIGURACION_INVALIDA sin moneda MXN.
     */
    const calcularPrecio = (preparacion, { familia, peso, conversion }) => {
        const cargos = precioNs.leerCargos(preparacion.copia);
        const monedas = precioNs.cargarMonedas(cargos.monedaCotizacionId);
        const entradas = {
            precioCotizacion: familia.precioCotizacion,
            tipoCambio: monedas.tipoCambio,
            conversion,
            peso,
            porcentajeFlete: cargos.porcentajeFlete,
            porcentajeManiobras: cargos.porcentajeManiobras,
            porcentajeSeguro: cargos.porcentajeSeguro,
            fletePorKg: cargos.fletePorKg,
            maniobraPorKg: cargos.maniobraPorKg,
            cargoCompensatorio: cargos.cargoCompensatorio,
            margen: familia.margen
        };
        return { entradas, calculo: precio.calcular(entradas), monedaPrecioId: monedas.monedaPrecioId };
    };

    // RN4-08: el artículo ya está guardado; una diferencia solo se avisa y se registra.
    const verificarPrecioGuardado = (tipoRegistro, articuloId, precioFinal) => {
        const formula = precioNs.leerPrecioFormula(tipoRegistro, articuloId);
        if (formula === null || precio.coincide(precioFinal, formula)) return null;
        log.audit({
            title: TITULOS_LOG.PRECIO_DISTINTO,
            details: `ID: ${articuloId}. Precio calculado: ${formatearPrecio(precioFinal)}. Campo fórmula: ${formatearPrecio(formula)}.`
        });
        return MENSAJES.PRECIO_DISTINTO(formatearPrecio(precioFinal), formatearPrecio(formula));
    };

    const guardarArticulo = (preparacion, { valores, peso, conversion, espesor, familia, codigo, nombre, precioCalculado }) => {
        const activo = leerCrearActivo();
        const configuracionId = preparacion.configuracion.id;
        asignarValores(preparacion.copia, {
            configuracionId, ids: preparacion.ids, valores, peso, conversion, familia, codigo, nombre, activo
        });
        precioNs.asignarPrecio(preparacion.copia, precioCalculado);
        const articuloId = preparacion.copia.save({ ignoreMandatoryFields: false });
        const precioFinal = precioCalculado.calculo.precioFinal;
        const nombreEspesor = espesor === null ? '' : espesor.nombre;
        log.audit({
            title: TITULOS_LOG.CREADO,
            details: `ID: ${articuloId}. Código: ${codigo}. Configuración: ${configuracionId}. Estado: ${textoDeEstado(!activo)}. `
                + `Espesor: ${nombreEspesor}. Familia de precio: ${familia.familiaPrecioNombre}. Conversión: ${conversion}. `
                + `Precio base: ${formatearPrecio(precioFinal)}.`
        });
        const advertencia = verificarPrecioGuardado(preparacion.tipoRegistro, articuloId, precioFinal);
        return construirConfirmacion({
            codigo,
            nombre,
            inactivo: !activo,
            espesor: espesor === null ? null : espesor.nombre,
            familiaPrecio: familia.familiaPrecioNombre,
            conversion,
            precio: formatearPrecio(precioFinal),
            advertencia,
            urlArticulo: urlDelArticulo(preparacion.tipoRegistro, articuloId),
            urlInicio: urlDelSuitelet()
        });
    };

    const etiquetasDe = (definicion) => {
        const etiquetas = {};
        definicion.forEach((parametro) => {
            etiquetas[parametro.id] = parametro.etiqueta;
        });
        return etiquetas;
    };

    // D-13, D-14, D-16, D-17: un valor que no cabe en el formato de su marcador se corrige en el paso 2, no es error de configuración.
    // D-18: el orden de los lados también se corrige en el paso 2.
    const validarFormatosDeCaptura = (preparacion, valores) => {
        const etiquetas = etiquetasDe(preparacion.definicion);
        const pares = PARES_DE_LADOS.filter((par) => preparacion.ids.indexOf(par.menor) !== -1 && preparacion.ids.indexOf(par.mayor) !== -1);
        const errores = [preparacion.patronCodigo, preparacion.patronNombre]
            .map((texto) => patron.validarFormatos({ patron: texto, valores, etiquetas }).errores)
            .reduce((todos, propios) => todos.concat(propios), [])
            .concat(parametros.validarOrdenDeLados({ valores, etiquetas, pares }).errores);
        return errores.filter((mensaje, posicion) => errores.indexOf(mensaje) === posicion);
    };

    // RN3-02: el espesor elegido ya fue validado contra C-3; se buscan su orden y sus textos.
    const espesorElegido = (preparacion, valores) => {
        const catalogo = parametroDeCatalogo(preparacion.definicion);
        if (catalogo === null) return null;
        const elegido = String(valores[catalogo.id]);
        const encontrados = preparacion.espesores.filter((espesor) => espesor.id === elegido);
        return encontrados.length > 0 ? encontrados[0] : null;
    };

    // RN5-03: el ID elegido ya fue validado contra C-8.
    const medidaElegida = (preparacion, valores) => (Object.prototype.hasOwnProperty.call(valores, mapaMedidas.MARCADOR)
        ? mapaMedidas.buscar(preparacion.medidas, valores[mapaMedidas.MARCADOR])
        : null);

    // RN5-03: la medida llena los lados; el ID del mapa no es campo del artículo.
    const completarConMedida = (valores, medida) => {
        Object.assign(valores, mapaMedidas.valoresDe(medida, CAMPOS_DEL_MAPA));
        delete valores[mapaMedidas.MARCADOR];
    };

    const textosDelEspesor = (espesor) => (espesor === null ? {} : {
        [CAMPO_ESPESOR]: { codigo: espesor.codigo, texto: espesor.texto }
    });

    const atenderCreacion = (solicitud) => {
        const eleccion = elegirConfiguracion(solicitud);
        if (eleccion.configuracion === null) return paso1ConNaturalezaInvalida(eleccion);
        const preparacion = prepararNaturaleza(eleccion.configuracion);
        const valoresCrudos = preparacion.captura.map((parametro, posicion) => leerParametro(solicitud, campoDeParametro(posicion)));
        const pesoCrudo = leerParametro(solicitud, CAMPOS_FORMULARIO.PESO);
        const conversionCruda = aCadena(leerParametro(solicitud, CAMPOS_FORMULARIO.CONVERSION));
        const repetirPaso2 = (errores) => mostrarPaso2(preparacion, {
            valoresPrevios: valoresCrudos, pesoPrevio: pesoCrudo, conversionPrevia: conversionCruda, errores
        });
        const captura = parametros.validarValores({
            parametros: preparacion.captura,
            valoresCrudos,
            pesoCrudo,
            conversionCruda,
            opcionesPorCatalogo: {
                [CAMPO_ESPESOR]: preparacion.espesores.map((espesor) => espesor.id),
                [mapaMedidas.MARCADOR]: preparacion.medidas.map((medida) => medida.id)
            }
        });
        if (!captura.valido) return repetirPaso2(captura.errores);
        const medida = medidaElegida(preparacion, captura.valores);
        if (medida !== null) completarConMedida(captura.valores, medida);
        const erroresDeFormato = validarFormatosDeCaptura(preparacion, captura.valores);
        if (erroresDeFormato.length > 0) return repetirPaso2(erroresDeFormato);
        const espesor = espesorElegido(preparacion, captura.valores);
        const familia = familias.resolver({
            lineas: preparacion.lineasDeFamilia,
            orden: espesor === null ? null : espesor.orden,
            medida: preparacion.campoMedida === null ? null : captura.valores[preparacion.campoMedida]
        });
        const textos = Object.assign(textosDelEspesor(espesor), medida === null ? {} : mapaMedidas.textosDe(medida));
        const codigo = patron.aplicar({ patron: preparacion.patronCodigo, valores: captura.valores, textos });
        const nombre = patron.aplicar({ patron: preparacion.patronNombre, valores: captura.valores, textos });
        if (nombre.length > LONGITUD_MAXIMA_ITEMID) return repetirPaso2([MENSAJES.NOMBRE_LARGO]);
        const criterios = parametros.armarCriteriosDuplicado({ ids: preparacion.ids, valores: captura.valores });
        asegurarColumnasPermitidas(criterios, preparacion.ids);
        const duplicado = buscarDuplicado(preparacion.configuracion.id, criterios);
        if (duplicado !== null) return mostrarDuplicado({ configuracionId: preparacion.configuracion.id, duplicado });
        const precioCalculado = calcularPrecio(preparacion, { familia, peso: captura.peso, conversion: captura.conversion });
        return guardarArticulo(preparacion, {
            valores: captura.valores, peso: captura.peso, conversion: captura.conversion, espesor, familia, codigo, nombre, precioCalculado
        });
    };

    const atenderSolicitud = (solicitud) => {
        if (solicitud.method !== METODO_POST) return construirPasoInicial();
        const accion = aCadena(leerParametro(solicitud, CAMPOS_FORMULARIO.ACCION)).trim();
        if (accion === ACCIONES.PARAMETROS) return atenderParametros(solicitud);
        if (accion === ACCIONES.CREAR) return atenderCreacion(solicitud);
        return construirPasoInicial();
    };

    const registrarError = (error) => {
        log.error({
            title: formato.esErrorDeDominio(error) ? TITULOS_LOG.ERROR_DE_DOMINIO : TITULOS_LOG.ERROR_INESPERADO,
            details: describirError(error)
        });
    };

    const mensajeParaUsuario = (error) => (formato.esErrorDeDominio(error) ? aCadena(error.message) : MENSAJES.GENERICO);

    // Dentro del catch global un segundo error no debe escapar con el mensaje crudo de NetSuite.
    const urlDelSuiteletOmitible = () => {
        try {
            return urlDelSuitelet();
        } catch (error) {
            registrarError(error);
            return null;
        }
    };

    /**
     * Punto de entrada del Suitelet. GET muestra el paso 1. POST despacha por custpage_accion:
     * parametros muestra el paso 2, crear crea el artículo y cualquier otro valor muestra el paso 1.
     * Todo error capturado se registra con log.error. La página muestra el mensaje solo si es un error de dominio;
     * para cualquier otro error muestra un mensaje genérico.
     * @param {Object} context
     * @param {Object} context.request - ServerRequest del Suitelet.
     * @param {Object} context.response - ServerResponse del Suitelet.
     * @returns {void}
     */
    const onRequest = (context) => {
        try {
            context.response.writePage(atenderSolicitud(context.request));
        } catch (error) {
            registrarError(error);
            context.response.writePage(construirPaginaDeError({
                mensaje: mensajeParaUsuario(error),
                urlInicio: urlDelSuiteletOmitible()
            }));
        }
    };

    return { onRequest };
});
