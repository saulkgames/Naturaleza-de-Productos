/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @description Crea artículos de una naturaleza de producto copiando el artículo plantilla de su configuración.
 * Paso 1: naturaleza con plantilla. Paso 2: parámetros de la naturaleza y peso. Creación: valida, genera
 * código y nombre con los patrones, busca duplicados y guarda la copia de la plantilla.
 * Iteración B: espesor por catálogo, familias de precio y margen por rango de espesor, peso, conversión y descripciones.
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
    './infra/SADS_naturaleza_articulo_ns'
], (serverWidget, message, search, query, record, runtime, url, log, formato, patron, parametros, familias, articulos) => {
    const REGISTRO_CONFIGURACION = 'customrecord_sads_naturaleza_productos';

    const CAMPOS_CONFIGURACION = Object.freeze({
        JSON: 'custrecord_sads_naturaleza_config',
        PLANTILLA: 'custrecord_sads_naturaleza_plantilla',
        PATRON_NOMBRE: 'custrecord_sads_naturaleza_patron_nom',
        PATRON_CODIGO: 'custrecord_sads_naturaleza_patron_cod',
        TIPO_ESPESOR: 'custrecord_sads_naturaleza_tipo_esp'
    });

    // S3-06: el parámetro de catálogo (espesor) se identifica por el ID de su campo de artículo.
    const CAMPO_ESPESOR = 'custitem_sads_nat_espesor';
    const REGISTRO_ESPESOR = 'customrecord_sads_espesor';
    const REGISTRO_FAMILIA = 'customrecord_sads_nat_familia';

    // D-18: en cada par, el lado menor no puede superar al mayor. Solo aplica si ambos IDs están en el JSON.
    const PARES_DE_LADOS = Object.freeze([
        Object.freeze({ menor: 'custitem_sads_nat_pla_lado_a', mayor: 'custitem_sads_nat_pla_lado_b' })
    ]);

    // Supuesto S-04: IDs de campo válidos en inventoryitem; S-15: vendorname como campo de cuerpo.
    const CAMPOS_ARTICULO = Object.freeze({
        NATURALEZA: 'custitem_sads_naturaleza_producto',
        CODIGO: 'itemid',
        NOMBRE: 'displayname',
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

    // Supuesto S-14: longitud máxima de itemid.
    const LONGITUD_MAXIMA_CODIGO = 60;

    // Supuesto S-16: IDs internos de weightunit; se usa solo si getText no devuelve texto (PT-11).
    const UNIDADES_PESO_RESPALDO = Object.freeze({
        1: 'lb',
        2: 'oz',
        3: 'kg',
        4: 'g'
    });

    const PARAMETRO_CREAR_ACTIVO = 'custscript_sads_sl_art_activo';
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
        CONVERSION_TEXTO: 'custpage_conversion_texto'
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
        'SELECT art.id AS id, art.itemid AS codigo, art.isinactive AS inactivo',
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

    // C-4. Líneas activas de familias por rango con orden y tipo de sus espesores.
    const SQL_FAMILIAS = `
        SELECT fam.id AS id,
               fam.custrecord_sads_natfam_desde AS desde_id, des.custrecord_sads_esp_orden AS desde_orden,
               des.custrecord_sads_esp_tipo AS desde_tipo,
               fam.custrecord_sads_natfam_hasta AS hasta_id, has.custrecord_sads_esp_orden AS hasta_orden,
               has.custrecord_sads_esp_tipo AS hasta_tipo,
               fam.custrecord_sads_natfam_precio AS precio_id, fam.custrecord_sads_natfam_margen AS margen_id,
               BUILTIN.DF(fam.custrecord_sads_natfam_precio) AS precio_nombre
        FROM ${REGISTRO_FAMILIA} fam
        LEFT JOIN ${REGISTRO_ESPESOR} des ON des.id = fam.custrecord_sads_natfam_desde
        LEFT JOIN ${REGISTRO_ESPESOR} has ON has.id = fam.custrecord_sads_natfam_hasta
        WHERE fam.isinactive = 'F'
          AND fam.custrecord_sads_natfam_config = ?
        ORDER BY des.custrecord_sads_esp_orden`;

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
        CODIGO_LARGO: `El código generado excede ${LONGITUD_MAXIMA_CODIGO} caracteres; revise el patrón de la naturaleza.`,
        COLUMNA_NO_PERMITIDA: 'La configuración de esta naturaleza contiene un ID de campo no válido para buscar duplicados.',
        DUPLICADO: 'Ya existe un artículo con esta naturaleza y estos parámetros.',
        CREADO: 'El artículo se creó correctamente.',
        GENERICO: 'No fue posible completar la operación. Contacte al administrador.'
    });

    const TITULOS_LOG = Object.freeze({
        CREADO: 'Crear artículo por naturaleza: artículo creado',
        DUPLICADO: 'Crear artículo por naturaleza: duplicado',
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
     * @returns {{ids: string[], plantillaId: ?string, patronNombre: string, patronCodigo: string, tipoEspesorId: ?string}}
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
                CAMPOS_CONFIGURACION.TIPO_ESPESOR
            ]
        });
        const plantilla = aCadena(campos[CAMPOS_CONFIGURACION.PLANTILLA]).trim();
        return {
            ids: formato.parsearConfiguracion(campos[CAMPOS_CONFIGURACION.JSON]),
            plantillaId: PATRON_ID_INTERNO.test(plantilla) ? plantilla : null,
            patronNombre: aCadena(campos[CAMPOS_CONFIGURACION.PATRON_NOMBRE]),
            patronCodigo: aCadena(campos[CAMPOS_CONFIGURACION.PATRON_CODIGO]),
            tipoEspesorId: valorDeSeleccion(campos[CAMPOS_CONFIGURACION.TIPO_ESPESOR])
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
        familiaPrecioId: aCadena(fila.precio_id),
        familiaMargenId: aCadena(fila.margen_id),
        familiaPrecioNombre: aCadena(fila.precio_nombre)
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
     * @returns {?{id: string, codigo: string, inactivo: boolean}} Primer artículo encontrado o null.
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
     * @param {string} datos.codigo - Código generado.
     * @param {string} datos.nombre - Nombre generado; también es código de proveedor (D-10) y descripciones (RN3-12).
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
        copia.setValue({ fieldId: CAMPOS_ARTICULO.CODIGO, value: codigo });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.NOMBRE, value: nombre });
        copia.setValue({ fieldId: CAMPOS_ARTICULO.CODIGO_PROVEEDOR, value: nombre });
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
     * @param {Array<{id: string, nombre: string}>} datos.espesores - Catálogo de C-3; vacío si la naturaleza no usa espesor.
     * @param {*} datos.pesoPrevio - Peso capturado antes.
     * @param {*} datos.conversionPrevia - Conversión capturada antes.
     * @param {string[]} datos.errores - Mensajes de validación.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirPaso2 = ({
        configuracion, definicion, unidadPeso, espesores, valoresPrevios, pesoPrevio, conversionPrevia, errores, urlInicio
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
                    opciones: espesores,
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
     * @param {string} datos.urlArticulo - URL del artículo creado.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirConfirmacion = ({ codigo, nombre, inactivo, espesor, familiaPrecio, conversion, urlArticulo, urlInicio }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.CONFIRMACION);
        agregarAviso(form, { tipo: message.Type.CONFIRMATION, titulo: TITULOS_AVISO.CREADO, lineas: [MENSAJES.CREADO] });
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
        agregarEnlacesFinales(form, { urlArticulo, urlInicio });
        return form;
    };

    /**
     * Construye la página de artículo existente (RN-08).
     * @param {Object} datos
     * @param {string} datos.codigo - Código del artículo existente.
     * @param {boolean} datos.inactivo - Estado del artículo existente.
     * @param {?string} datos.urlArticulo - URL del artículo existente; null si no se resolvió su tipo.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirDuplicado = ({ codigo, inactivo, urlArticulo, urlInicio }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.DUPLICADO);
        agregarAviso(form, { tipo: message.Type.INFORMATION, titulo: TITULOS_AVISO.DUPLICADO, lineas: [MENSAJES.DUPLICADO] });
        agregarResumenDelArticulo(form, { codigo, nombre: null, inactivo });
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
        const encontrados = definicion.filter((parametro) => parametro.tipo === parametros.TIPOS_SOPORTADOS.CATALOGO);
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
        return {
            configuracion,
            ids: leida.ids,
            patronNombre: leida.patronNombre,
            patronCodigo: leida.patronCodigo,
            tipoRegistro,
            copia,
            definicion,
            espesores,
            lineasDeFamilia
        };
    };

    const mostrarPaso2 = (preparacion, { valoresPrevios, pesoPrevio, conversionPrevia, errores }) => construirPaso2({
        configuracion: preparacion.configuracion,
        definicion: preparacion.definicion,
        unidadPeso: leerUnidadDePeso(preparacion.copia),
        espesores: preparacion.espesores,
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
            inactivo: duplicado.inactivo,
            urlArticulo: tipoRegistro === null ? null : urlDelArticulo(tipoRegistro, duplicado.id),
            urlInicio: urlDelSuitelet()
        });
    };

    const guardarArticulo = (preparacion, { valores, peso, conversion, espesor, familia, codigo, nombre }) => {
        const activo = leerCrearActivo();
        const configuracionId = preparacion.configuracion.id;
        asignarValores(preparacion.copia, {
            configuracionId, ids: preparacion.ids, valores, peso, conversion, familia, codigo, nombre, activo
        });
        const articuloId = preparacion.copia.save({ ignoreMandatoryFields: false });
        const nombreEspesor = espesor === null ? '' : espesor.nombre;
        log.audit({
            title: TITULOS_LOG.CREADO,
            details: `ID: ${articuloId}. Código: ${codigo}. Configuración: ${configuracionId}. Estado: ${textoDeEstado(!activo)}. `
                + `Espesor: ${nombreEspesor}. Familia de precio: ${familia.familiaPrecioNombre}. Conversión: ${conversion}.`
        });
        return construirConfirmacion({
            codigo,
            nombre,
            inactivo: !activo,
            espesor: espesor === null ? null : espesor.nombre,
            familiaPrecio: familia.familiaPrecioNombre,
            conversion,
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

    const textosDelEspesor = (espesor) => (espesor === null ? {} : {
        [CAMPO_ESPESOR]: { codigo: espesor.codigo, texto: espesor.texto }
    });

    const atenderCreacion = (solicitud) => {
        const eleccion = elegirConfiguracion(solicitud);
        if (eleccion.configuracion === null) return paso1ConNaturalezaInvalida(eleccion);
        const preparacion = prepararNaturaleza(eleccion.configuracion);
        const valoresCrudos = preparacion.definicion.map((parametro, posicion) => leerParametro(solicitud, campoDeParametro(posicion)));
        const pesoCrudo = leerParametro(solicitud, CAMPOS_FORMULARIO.PESO);
        const conversionCruda = aCadena(leerParametro(solicitud, CAMPOS_FORMULARIO.CONVERSION));
        const repetirPaso2 = (errores) => mostrarPaso2(preparacion, {
            valoresPrevios: valoresCrudos, pesoPrevio: pesoCrudo, conversionPrevia: conversionCruda, errores
        });
        const captura = parametros.validarValores({
            parametros: preparacion.definicion,
            valoresCrudos,
            pesoCrudo,
            conversionCruda,
            opcionesCatalogo: preparacion.espesores.map((espesor) => espesor.id)
        });
        if (!captura.valido) return repetirPaso2(captura.errores);
        const erroresDeFormato = validarFormatosDeCaptura(preparacion, captura.valores);
        if (erroresDeFormato.length > 0) return repetirPaso2(erroresDeFormato);
        const espesor = espesorElegido(preparacion, captura.valores);
        const familia = familias.resolver({ lineas: preparacion.lineasDeFamilia, orden: espesor === null ? null : espesor.orden });
        const textos = textosDelEspesor(espesor);
        const codigo = patron.aplicar({ patron: preparacion.patronCodigo, valores: captura.valores, textos });
        const nombre = patron.aplicar({ patron: preparacion.patronNombre, valores: captura.valores, textos });
        if (codigo.length > LONGITUD_MAXIMA_CODIGO) return repetirPaso2([MENSAJES.CODIGO_LARGO]);
        const criterios = parametros.armarCriteriosDuplicado({ ids: preparacion.ids, valores: captura.valores });
        asegurarColumnasPermitidas(criterios, preparacion.ids);
        const duplicado = buscarDuplicado(preparacion.configuracion.id, criterios);
        if (duplicado !== null) return mostrarDuplicado({ configuracionId: preparacion.configuracion.id, duplicado });
        return guardarArticulo(preparacion, {
            valores: captura.valores, peso: captura.peso, conversion: captura.conversion, espesor, familia, codigo, nombre
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
