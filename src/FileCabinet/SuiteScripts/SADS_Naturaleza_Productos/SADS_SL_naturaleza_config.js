/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @description Alta de registros de configuración de Naturaleza de Productos sin capturar JSON.
 * Paso 1: naturaleza disponible y tipo de artículo. Paso 2: campos personalizados de artículo
 * aplicables al tipo. El registro solo se crea si el parámetro custscript_sads_sl_permitir_alta está en T.
 */
define([
    'N/ui/serverWidget',
    'N/ui/message',
    'N/query',
    'N/record',
    'N/runtime',
    'N/url',
    'N/log',
    './domain/SADS_naturaleza_config_formato',
    './domain/SADS_naturaleza_alta_reglas'
], (serverWidget, message, query, record, runtime, url, log, formato, reglas) => {
    const REGISTRO_CONFIGURACION = 'customrecord_sads_naturaleza_productos';
    const CAMPO_CONFIG_NOMBRE = 'name';
    const CAMPO_CONFIG_NATURALEZA = 'custrecord_sads_naturaleza_lista';
    const CAMPO_CONFIG_TIPO_ARTICULO = 'custrecord_sads_naturaleza_tipo_art';
    const CAMPO_CONFIG_JSON = 'custrecord_sads_naturaleza_config';
    const LISTA_NATURALEZAS = 'customlist_sads_naturaleza_productos';
    const LISTA_TIPOS_ARTICULO = 'customlist_sads_tipos_articulo';
    const CAMPO_GATILLO = 'custitem_sads_naturaleza_producto';
    const PARAMETRO_PERMITIR_ALTA = 'custscript_sads_sl_permitir_alta';
    const PERMISO_REGISTRO_PERSONALIZADO = 'LIST_CUSTRECORDENTRY';
    const METODO_POST = 'POST';
    const CASILLA_MARCADA = 'T';

    const CAMPOS_FORMULARIO = Object.freeze({
        NATURALEZA: 'custpage_naturaleza',
        TIPO_ARTICULO: 'custpage_tipo_art',
        NATURALEZA_TEXTO: 'custpage_naturaleza_texto',
        TIPO_ARTICULO_TEXTO: 'custpage_tipo_art_texto',
        ACCION: 'custpage_accion',
        ENLACE_INICIO: 'custpage_enlace_inicio',
        NOMBRE_CREADO: 'custpage_nombre_creado',
        TIPO_CREADO: 'custpage_tipo_creado',
        CONFIGURACION_CREADA: 'custpage_configuracion_creada',
        ENLACE_REGISTRO: 'custpage_enlace_registro'
    });

    const SUBLISTA_CAMPOS = Object.freeze({
        ID: 'custpage_campos',
        SELECCION: 'custpage_sel',
        ETIQUETA: 'custpage_etiqueta',
        ID_CAMPO: 'custpage_id'
    });

    const ACCIONES = Object.freeze({
        CATALOGO: 'catalogo',
        CREAR: 'crear'
    });

    // Supuestos por confirmar en sandbox (iteración A): columnas SuiteQL de las listas y de customfield,
    // valor de fieldtype de los campos de artículo y prefijo de su scriptid.
    const FIELDTYPE_CAMPO_ARTICULO = 'ITEM';
    const PATRON_SCRIPTID_CAMPO_ARTICULO = 'custitem%';

    // RN-01: el anti-join no filtra isinactive del registro de configuración; uno inactivo también ocupa la naturaleza.
    const SQL_NATURALEZAS_DISPONIBLES = `
        SELECT lista.id AS id, lista.name AS nombre
        FROM ${LISTA_NATURALEZAS} lista
        WHERE lista.isinactive = 'F'
          AND NOT EXISTS (
              SELECT 1
              FROM ${REGISTRO_CONFIGURACION} cfg
              WHERE cfg.${CAMPO_CONFIG_NATURALEZA} = lista.id
          )
        ORDER BY lista.name`;

    const SQL_TIPOS_ARTICULO = `
        SELECT tipo.id AS id, tipo.name AS nombre, tipo.scriptid AS scriptid
        FROM ${LISTA_TIPOS_ARTICULO} tipo
        WHERE tipo.isinactive = 'F'
        ORDER BY tipo.name`;

    const SQL_CAMPOS_ARTICULO = `
        SELECT cf.scriptid AS scriptid, cf.name AS etiqueta
        FROM customfield cf
        WHERE cf.isinactive = 'F'
          AND cf.fieldtype = ?
          AND LOWER(cf.scriptid) LIKE ?
        ORDER BY cf.name`;

    const TITULOS_FORMULARIO = Object.freeze({
        PASO_1: 'Alta de configuración de naturaleza - Paso 1 de 2',
        PASO_2: 'Alta de configuración de naturaleza - Paso 2 de 2',
        CONFIRMACION: 'Alta de configuración de naturaleza - Configuración creada',
        ERROR: 'Alta de configuración de naturaleza'
    });

    const ETIQUETAS = Object.freeze({
        NATURALEZA: 'Naturaleza de producto',
        TIPO_ARTICULO: 'Tipo de artículo',
        ACCION: 'Acción',
        SUBLISTA: 'Campos personalizados de artículo',
        SELECCION: 'Obligatorio',
        ETIQUETA: 'Campo',
        ID_CAMPO: 'ID del campo',
        NOMBRE: 'Nombre',
        CONFIGURACION: 'Configuración guardada (JSON)',
        BOTON_SIGUIENTE: 'Siguiente',
        BOTON_CREAR: 'Crear configuración',
        ENLACE_REGRESAR: 'Regresar',
        ENLACE_CREAR_OTRA: 'Crear otra',
        ENLACE_REGISTRO: 'Ver registro'
    });

    const TITULOS_AVISO = Object.freeze({
        REVISAR: 'Revise la información',
        SIN_OPCIONES: 'Sin opciones disponibles',
        SIN_CAMPOS: 'Sin campos disponibles',
        CREACION_DESHABILITADA: 'Creación deshabilitada',
        CREADA: 'Configuración creada',
        ERROR: 'No fue posible continuar'
    });

    const MENSAJES = Object.freeze({
        SIN_NATURALEZAS: 'Todas las naturalezas ya tienen configuración.',
        SIN_TIPOS: 'No hay tipos de artículo activos.',
        CATALOGO_VACIO: 'No hay campos personalizados activos para este tipo de artículo.',
        CREACION_DESHABILITADA: 'La creación está deshabilitada en este despliegue.',
        CREADA: 'La configuración se creó correctamente.',
        GENERICO: 'No fue posible completar la operación. Contacte al administrador.'
    });

    const TITULOS_LOG = Object.freeze({
        ALTA: 'Alta de configuración de naturaleza',
        TIPO_SIN_CREACION: 'Alta de configuración: no se pudo crear en memoria el tipo de artículo',
        ERROR_DE_DOMINIO: 'Alta de configuración: error de dominio',
        ERROR_INESPERADO: 'Alta de configuración: error inesperado'
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

    const ejecutarConsulta = (sql, parametros) => query.runSuiteQL({ query: sql, params: parametros }).asMappedResults();

    /**
     * Carga las opciones de alta con Q-1 y Q-2. Es la única fuente de naturalezas y tipos en todos los pasos.
     * @returns {{naturalezas: Array<{id: string, nombre: string}>,
     * tipos: Array<{id: string, nombre: string, scriptid: string}>}} Objetos planos; scriptid en minúsculas.
     */
    const cargarOpcionesDeAlta = () => ({
        naturalezas: ejecutarConsulta(SQL_NATURALEZAS_DISPONIBLES, []).map((fila) => ({
            id: String(fila.id),
            nombre: aCadena(fila.nombre)
        })),
        tipos: ejecutarConsulta(SQL_TIPOS_ARTICULO, []).map((fila) => ({
            id: String(fila.id),
            nombre: aCadena(fila.nombre),
            scriptid: String(fila.scriptid).toLowerCase()
        }))
    });

    const leerCamposDelTipo = (tipoRegistro) => {
        let articulo;
        try {
            articulo = record.create({ type: tipoRegistro, isDynamic: true });
        } catch (error) {
            log.error({
                title: TITULOS_LOG.TIPO_SIN_CREACION,
                details: `Tipo de registro: ${tipoRegistro}. ${describirError(error)}`
            });
            throw error;
        }
        return new Set(articulo.getFields().map((idCampo) => String(idCampo).toLowerCase()));
    };

    /**
     * Devuelve los campos de Q-3 presentes en un artículo del tipo creado en memoria y nunca guardado (estrategia E2).
     * Supuesto: getFields() incluye los custitem aplicables al tipo y excluye los no aplicables.
     * @param {string} tipoRegistro - Tipo de registro resuelto por el dominio.
     * @returns {Array<{id: string, etiqueta: *}>} IDs en minúsculas; etiqueta tomada de Q-3.
     * @throws {Error} El error de record.create, después de registrarlo con el tipo de registro (R-17).
     */
    const obtenerCamposAplicables = (tipoRegistro) => {
        const definidos = ejecutarConsulta(SQL_CAMPOS_ARTICULO, [FIELDTYPE_CAMPO_ARTICULO, PATRON_SCRIPTID_CAMPO_ARTICULO])
            .map((fila) => ({ id: String(fila.scriptid).toLowerCase(), etiqueta: fila.etiqueta }));
        const presentes = leerCamposDelTipo(tipoRegistro);
        return definidos.filter((campo) => presentes.has(campo.id));
    };

    /**
     * Crea el registro de configuración sin ignorar campos obligatorios.
     * @param {Object} datos
     * @param {string} datos.nombre - Texto de la naturaleza tomado de Q-1 (RN-12).
     * @param {string} datos.naturalezaId - ID interno validado de la naturaleza.
     * @param {string} datos.tipoArticuloId - ID interno validado del tipo de artículo (RN-11).
     * @param {string} datos.json - Configuración generada por formato.serializarConfiguracion.
     * @returns {number} ID interno del registro creado.
     */
    const crearConfiguracion = ({ nombre, naturalezaId, tipoArticuloId, json }) => {
        const configuracion = record.create({ type: REGISTRO_CONFIGURACION });
        configuracion.setValue({ fieldId: CAMPO_CONFIG_NOMBRE, value: nombre });
        configuracion.setValue({ fieldId: CAMPO_CONFIG_NATURALEZA, value: naturalezaId });
        configuracion.setValue({ fieldId: CAMPO_CONFIG_TIPO_ARTICULO, value: tipoArticuloId });
        configuracion.setValue({ fieldId: CAMPO_CONFIG_JSON, value: json });
        return configuracion.save({ ignoreMandatoryFields: false });
    };

    /**
     * Indica si se muestra el enlace al registro creado (R-07).
     * Supuesto: bajo runasrole, getCurrentUser() puede reflejar el rol de ejecución; se confirma en sandbox.
     * @returns {boolean} true si el permiso LIST_CUSTRECORDENTRY es VIEW o mayor; false si no lo es o si la consulta falla.
     */
    const usuarioPuedeVerRegistro = () => {
        try {
            const nivel = runtime.getCurrentUser().getPermission({ name: PERMISO_REGISTRO_PERSONALIZADO });
            return nivel >= runtime.Permission.VIEW;
        } catch (errorDePermiso) {
            return false;
        }
    };

    /**
     * Lee el parámetro que separa la iteración A (vista previa) de la B (creación).
     * @returns {boolean} true solo si el parámetro vale true o 'T'.
     */
    const leerPermitirAlta = () => {
        const valor = runtime.getCurrentScript().getParameter({ name: PARAMETRO_PERMITIR_ALTA });
        return valor === true || valor === 'T';
    };

    const urlDelSuitelet = () => {
        const script = runtime.getCurrentScript();
        return url.resolveScript({ scriptId: script.id, deploymentId: script.deploymentId });
    };

    const urlDelRegistro = (idRegistro) => url.resolveRecord({
        recordType: REGISTRO_CONFIGURACION,
        recordId: idRegistro,
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

    const agregarTextoDeSoloLectura = (form, { id, etiqueta, valor, tipoCampo }) => {
        const campo = form.addField({ id, label: etiqueta, type: tipoCampo });
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

    const agregarSublistaDeCampos = (form, { catalogo, idsMarcados }) => {
        const sublista = form.addSublist({
            id: SUBLISTA_CAMPOS.ID,
            label: ETIQUETAS.SUBLISTA,
            type: serverWidget.SublistType.LIST
        });
        sublista.addMarkAllButtons();
        const seleccion = sublista.addField({
            id: SUBLISTA_CAMPOS.SELECCION,
            label: ETIQUETAS.SELECCION,
            type: serverWidget.FieldType.CHECKBOX
        });
        seleccion.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
        sublista.addField({ id: SUBLISTA_CAMPOS.ETIQUETA, label: ETIQUETAS.ETIQUETA, type: serverWidget.FieldType.TEXT });
        sublista.addField({ id: SUBLISTA_CAMPOS.ID_CAMPO, label: ETIQUETAS.ID_CAMPO, type: serverWidget.FieldType.TEXT });
        const marcados = new Set(idsMarcados.map((id) => aCadena(id).trim().toLowerCase()));
        catalogo.forEach((campo, linea) => {
            if (marcados.has(campo.id)) {
                sublista.setSublistValue({ id: SUBLISTA_CAMPOS.SELECCION, line: linea, value: CASILLA_MARCADA });
            }
            // NetSuite pinta como HTML las columnas TEXT de una sublista LIST; la etiqueta la edita quien personaliza campos.
            sublista.setSublistValue({ id: SUBLISTA_CAMPOS.ETIQUETA, line: linea, value: escaparHtml(campo.etiqueta) });
            sublista.setSublistValue({ id: SUBLISTA_CAMPOS.ID_CAMPO, line: linea, value: campo.id });
        });
    };

    /**
     * Construye el paso 1: naturaleza disponible y tipo de artículo.
     * @param {Object} datos
     * @param {{naturalezas: Array<{id: string, nombre: string}>, tipos: Array<{id: string, nombre: string}>}}
     * datos.opciones - Resultado de cargarOpcionesDeAlta.
     * @param {*} datos.naturalezaId - Valor enviado antes; queda seleccionado si sigue disponible.
     * @param {*} datos.tipoId - Valor enviado antes; queda seleccionado si sigue disponible.
     * @param {string[]} datos.errores - Mensajes de validación.
     * @returns {serverWidget.Form}
     */
    const construirPaso1 = ({ opciones, naturalezaId, tipoId, errores }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.PASO_1);
        if (errores.length > 0) {
            agregarAviso(form, { tipo: message.Type.ERROR, titulo: TITULOS_AVISO.REVISAR, lineas: errores });
        }
        const faltantes = [
            opciones.naturalezas.length === 0 ? MENSAJES.SIN_NATURALEZAS : null,
            opciones.tipos.length === 0 ? MENSAJES.SIN_TIPOS : null
        ].filter((texto) => texto !== null);
        if (faltantes.length > 0) {
            agregarAviso(form, { tipo: message.Type.INFORMATION, titulo: TITULOS_AVISO.SIN_OPCIONES, lineas: faltantes });
            return form;
        }
        agregarSeleccion(form, {
            id: CAMPOS_FORMULARIO.NATURALEZA,
            etiqueta: ETIQUETAS.NATURALEZA,
            opciones: opciones.naturalezas,
            valorPrevio: naturalezaId
        });
        agregarSeleccion(form, {
            id: CAMPOS_FORMULARIO.TIPO_ARTICULO,
            etiqueta: ETIQUETAS.TIPO_ARTICULO,
            opciones: opciones.tipos,
            valorPrevio: tipoId
        });
        agregarCampoOculto(form, { id: CAMPOS_FORMULARIO.ACCION, etiqueta: ETIQUETAS.ACCION, valor: ACCIONES.CATALOGO });
        form.addSubmitButton({ label: ETIQUETAS.BOTON_SIGUIENTE });
        return form;
    };

    /**
     * Construye el paso 2: naturaleza y tipo de solo lectura y sublista de campos con casillas.
     * @param {Object} datos
     * @param {{id: string, nombre: string}} datos.naturaleza - Naturaleza recalculada.
     * @param {{id: string, nombre: string}} datos.tipo - Tipo de artículo recalculado.
     * @param {Array<{id: string, etiqueta: string}>} datos.catalogo - Resultado de reglas.filtrarCatalogo.
     * @param {Array<*>} datos.idsMarcados - IDs cuyas casillas se muestran marcadas.
     * @param {string[]} datos.errores - Mensajes de validación.
     * @param {boolean} datos.permitirAlta - Muestra el botón Crear si es true y el catálogo no está vacío.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirPaso2 = ({ naturaleza, tipo, catalogo, idsMarcados, errores, permitirAlta, urlInicio }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.PASO_2);
        if (errores.length > 0) {
            agregarAviso(form, { tipo: message.Type.ERROR, titulo: TITULOS_AVISO.REVISAR, lineas: errores });
        }
        if (!permitirAlta) {
            agregarAviso(form, {
                tipo: message.Type.WARNING,
                titulo: TITULOS_AVISO.CREACION_DESHABILITADA,
                lineas: [MENSAJES.CREACION_DESHABILITADA]
            });
        }
        agregarTextoDeSoloLectura(form, {
            id: CAMPOS_FORMULARIO.NATURALEZA_TEXTO,
            etiqueta: ETIQUETAS.NATURALEZA,
            valor: naturaleza.nombre,
            tipoCampo: serverWidget.FieldType.TEXT
        });
        agregarTextoDeSoloLectura(form, {
            id: CAMPOS_FORMULARIO.TIPO_ARTICULO_TEXTO,
            etiqueta: ETIQUETAS.TIPO_ARTICULO,
            valor: tipo.nombre,
            tipoCampo: serverWidget.FieldType.TEXT
        });
        agregarCampoOculto(form, { id: CAMPOS_FORMULARIO.NATURALEZA, etiqueta: ETIQUETAS.NATURALEZA, valor: naturaleza.id });
        agregarCampoOculto(form, { id: CAMPOS_FORMULARIO.TIPO_ARTICULO, etiqueta: ETIQUETAS.TIPO_ARTICULO, valor: tipo.id });
        agregarCampoOculto(form, { id: CAMPOS_FORMULARIO.ACCION, etiqueta: ETIQUETAS.ACCION, valor: ACCIONES.CREAR });
        agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_INICIO, texto: ETIQUETAS.ENLACE_REGRESAR, destino: urlInicio });
        if (catalogo.length === 0) {
            agregarAviso(form, {
                tipo: message.Type.INFORMATION,
                titulo: TITULOS_AVISO.SIN_CAMPOS,
                lineas: [MENSAJES.CATALOGO_VACIO]
            });
            return form;
        }
        agregarSublistaDeCampos(form, { catalogo, idsMarcados });
        if (permitirAlta) form.addSubmitButton({ label: ETIQUETAS.BOTON_CREAR });
        return form;
    };

    /**
     * Construye la confirmación del alta.
     * @param {Object} datos
     * @param {string} datos.nombre - Nombre guardado.
     * @param {string} datos.tipoArticulo - Texto del tipo de artículo guardado.
     * @param {string} datos.json - Configuración guardada.
     * @param {?string} datos.urlRegistro - URL del registro; null si el usuario no puede verlo.
     * @param {string} datos.urlInicio - URL del paso 1.
     * @returns {serverWidget.Form}
     */
    const construirConfirmacion = ({ nombre, tipoArticulo, json, urlRegistro, urlInicio }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.CONFIRMACION);
        agregarAviso(form, { tipo: message.Type.CONFIRMATION, titulo: TITULOS_AVISO.CREADA, lineas: [MENSAJES.CREADA] });
        agregarTextoDeSoloLectura(form, {
            id: CAMPOS_FORMULARIO.NOMBRE_CREADO,
            etiqueta: ETIQUETAS.NOMBRE,
            valor: nombre,
            tipoCampo: serverWidget.FieldType.TEXT
        });
        agregarTextoDeSoloLectura(form, {
            id: CAMPOS_FORMULARIO.TIPO_CREADO,
            etiqueta: ETIQUETAS.TIPO_ARTICULO,
            valor: tipoArticulo,
            tipoCampo: serverWidget.FieldType.TEXT
        });
        agregarTextoDeSoloLectura(form, {
            id: CAMPOS_FORMULARIO.CONFIGURACION_CREADA,
            etiqueta: ETIQUETAS.CONFIGURACION,
            valor: json,
            tipoCampo: serverWidget.FieldType.LONGTEXT
        });
        if (urlRegistro !== null) {
            agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_REGISTRO, texto: ETIQUETAS.ENLACE_REGISTRO, destino: urlRegistro });
        }
        agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_INICIO, texto: ETIQUETAS.ENLACE_CREAR_OTRA, destino: urlInicio });
        return form;
    };

    const construirPaginaDeError = ({ mensaje, urlInicio }) => {
        const form = crearFormulario(TITULOS_FORMULARIO.ERROR);
        agregarAviso(form, { tipo: message.Type.ERROR, titulo: TITULOS_AVISO.ERROR, lineas: [mensaje] });
        if (urlInicio !== null) {
            agregarEnlace(form, { id: CAMPOS_FORMULARIO.ENLACE_INICIO, texto: ETIQUETAS.ENLACE_REGRESAR, destino: urlInicio });
        }
        return form;
    };

    const leerParametro = (solicitud, nombre) => (solicitud.parameters || {})[nombre];

    const leerEleccion = (solicitud) => ({
        naturalezaId: leerParametro(solicitud, CAMPOS_FORMULARIO.NATURALEZA),
        tipoId: leerParametro(solicitud, CAMPOS_FORMULARIO.TIPO_ARTICULO)
    });

    const leerValorDeLinea = (solicitud, columna, linea) => solicitud.getSublistValue({
        group: SUBLISTA_CAMPOS.ID,
        name: columna,
        line: linea
    });

    const leerIdsMarcados = (solicitud) => {
        const totalLineas = Number(solicitud.getLineCount({ group: SUBLISTA_CAMPOS.ID }));
        const ids = [];
        for (let linea = 0; linea < totalLineas; linea += 1) {
            if (leerValorDeLinea(solicitud, SUBLISTA_CAMPOS.SELECCION, linea) === CASILLA_MARCADA) {
                ids.push(leerValorDeLinea(solicitud, SUBLISTA_CAMPOS.ID_CAMPO, linea));
            }
        }
        return ids;
    };

    const obtenerCatalogo = (tipo) => {
        const { tipoRegistro } = reglas.resolverTipoArticulo(tipo.scriptid);
        return reglas.filtrarCatalogo({ campos: obtenerCamposAplicables(tipoRegistro), idsExcluidos: [CAMPO_GATILLO] });
    };

    const construirPasoInicial = () => construirPaso1({
        opciones: cargarOpcionesDeAlta(),
        naturalezaId: '',
        tipoId: '',
        errores: []
    });

    const atenderCatalogo = (solicitud) => {
        const { naturalezaId, tipoId } = leerEleccion(solicitud);
        const opciones = cargarOpcionesDeAlta();
        const eleccion = reglas.validarEleccion({
            naturalezaId,
            tipoId,
            naturalezas: opciones.naturalezas,
            tipos: opciones.tipos
        });
        if (!eleccion.valido) return construirPaso1({ opciones, naturalezaId, tipoId, errores: eleccion.errores });
        return construirPaso2({
            naturaleza: eleccion.naturaleza,
            tipo: eleccion.tipo,
            catalogo: obtenerCatalogo(eleccion.tipo),
            idsMarcados: [],
            errores: [],
            permitirAlta: leerPermitirAlta(),
            urlInicio: urlDelSuitelet()
        });
    };

    const registrarAlta = ({ naturalezaId, naturalezas, alta }) => {
        const json = formato.serializarConfiguracion(alta.idsNormalizados);
        const nombre = reglas.resolverNombre({ naturalezaId, naturalezas });
        const idRegistro = crearConfiguracion({
            nombre,
            naturalezaId: alta.naturaleza.id,
            tipoArticuloId: alta.tipo.id,
            json
        });
        log.audit({
            title: TITULOS_LOG.ALTA,
            details: `ID: ${idRegistro}. Nombre: ${nombre}. Tipo de artículo: ${alta.tipo.nombre}. `
                + `Campos: ${alta.idsNormalizados.length}.`
        });
        return construirConfirmacion({
            nombre,
            tipoArticulo: alta.tipo.nombre,
            json,
            urlRegistro: usuarioPuedeVerRegistro() ? urlDelRegistro(idRegistro) : null,
            urlInicio: urlDelSuitelet()
        });
    };

    const atenderCreacion = (solicitud) => {
        const { naturalezaId, tipoId } = leerEleccion(solicitud);
        const idsSeleccionados = leerIdsMarcados(solicitud);
        const opciones = cargarOpcionesDeAlta();
        const { naturalezas, tipos } = opciones;
        const eleccion = reglas.validarEleccion({ naturalezaId, tipoId, naturalezas, tipos });
        if (!eleccion.valido) return construirPaso1({ opciones, naturalezaId, tipoId, errores: eleccion.errores });
        const paso2 = {
            naturaleza: eleccion.naturaleza,
            tipo: eleccion.tipo,
            catalogo: obtenerCatalogo(eleccion.tipo),
            permitirAlta: leerPermitirAlta(),
            urlInicio: urlDelSuitelet()
        };
        if (!paso2.permitirAlta) {
            return construirPaso2(Object.assign({}, paso2, { idsMarcados: idsSeleccionados, errores: [] }));
        }
        const alta = reglas.validarAlta({
            naturalezaId,
            tipoId,
            naturalezas,
            tipos,
            idsSeleccionados,
            catalogo: paso2.catalogo
        });
        if (!alta.valido) {
            return construirPaso2(Object.assign({}, paso2, { idsMarcados: alta.idsNormalizados, errores: alta.errores }));
        }
        return registrarAlta({ naturalezaId, naturalezas, alta });
    };

    const atenderSolicitud = (solicitud) => {
        if (solicitud.method !== METODO_POST) return construirPasoInicial();
        const accion = aCadena(leerParametro(solicitud, CAMPOS_FORMULARIO.ACCION)).trim();
        if (accion === ACCIONES.CATALOGO) return atenderCatalogo(solicitud);
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
     * catalogo muestra el paso 2, crear registra el alta y cualquier otro valor muestra el paso 1.
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
