/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Reglas de alta de la configuración de naturaleza de producto: tipo de registro por tipo
 * de artículo, catálogo de campos, validación de la elección y de la alta, y nombre del registro.
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define(['./SADS_naturaleza_config_formato'], (formato) => {
    /**
     * @typedef {Object} OpcionNaturaleza
     * @property {(string|number)} id - ID interno del valor de la lista de naturalezas.
     * @property {string} nombre - Texto del valor.
     */

    /**
     * @typedef {Object} OpcionTipo
     * @property {(string|number)} id - ID interno del valor de la lista de tipos de artículo.
     * @property {string} nombre - Texto del valor.
     * @property {string} scriptid - scriptid del valor; llave de TIPOS_ARTICULO.
     */

    /**
     * @typedef {Object} CampoCatalogo
     * @property {string} id - ID de campo de artículo en minúsculas.
     * @property {string} etiqueta - Texto visible del campo.
     */

    /**
     * Tipo de registro por valor de customlist_sads_tipos_articulo, indexado por scriptid en minúsculas.
     * Se indexa por scriptid porque el ID interno del valor cambia entre sandbox y producción.
     * Son tipos base sin subtipo Venta/Reventa/Compra; el catálogo refleja el subtipo que NetSuite asigne
     * por omisión al crear el artículo en memoria (R-19).
     * Supuestos por confirmar en sandbox (iteración A): inventoryitem, noninventoryitem y serviceitem no están
     * en la referencia de Oracle; otherchargeitem figura en ella como no programable desde servidor (R-17).
     * @type {Readonly<Object<string, Readonly<{tipoRegistro: string}>>>}
     */
    const TIPOS_ARTICULO = Object.freeze({
        val_sads_ta_inv: Object.freeze({ tipoRegistro: 'inventoryitem' }),
        val_sads_ta_noinv: Object.freeze({ tipoRegistro: 'noninventoryitem' }),
        val_sads_ta_otro: Object.freeze({ tipoRegistro: 'otherchargeitem' }),
        val_sads_ta_serv: Object.freeze({ tipoRegistro: 'serviceitem' }),
        val_sads_ta_kit: Object.freeze({ tipoRegistro: 'kititem' }),
        val_sads_ta_grupo: Object.freeze({ tipoRegistro: 'itemgroup' })
    });

    const PATRON_ID_INTERNO = /^[1-9][0-9]*$/;

    // Un mensaje solo cita IDs con forma de ID de campo, para no reflejar en la página
    // texto arbitrario enviado en el formulario.
    const PATRON_ID_CAMPO_CITABLE = /^[a-z0-9_]+$/;

    const MENSAJES = Object.freeze({
        NATURALEZA_INVALIDA: 'La naturaleza seleccionada no es válida.',
        NATURALEZA_NO_DISPONIBLE: 'La naturaleza seleccionada no está disponible o ya tiene configuración.',
        NATURALEZA_SIN_NOMBRE: 'La naturaleza seleccionada no tiene texto en la lista de naturalezas.',
        TIPO_INVALIDO: 'El tipo de artículo seleccionado no es válido.',
        TIPO_NO_DISPONIBLE: 'El tipo de artículo seleccionado no está disponible.',
        TIPO_SIN_REGISTRO: 'El tipo de artículo seleccionado no tiene un tipo de registro configurado.',
        SELECCION_VACIA: 'Marque al menos un campo.',
        CAMPO_NO_CITABLE_FUERA_DE_CATALOGO: 'Uno de los campos marcados no pertenece al catálogo del tipo de artículo seleccionado.'
    });

    const aCadena = (valor) => (valor === null || valor === undefined ? '' : String(valor));

    const aTexto = (valor) => aCadena(valor).trim();

    const normalizarClave = (valor) => aTexto(valor).toLowerCase();

    const leerId = (elemento) => (elemento !== null && typeof elemento === 'object' ? elemento.id : undefined);

    const comoLista = (valor, nombreParametro) => {
        if (valor === null || valor === undefined) return [];
        if (!Array.isArray(valor)) throw new TypeError(`El parámetro ${nombreParametro} debe ser un arreglo.`);
        return valor;
    };

    const normalizarClaves = (valores, nombreParametro) => Array.from(new Set(
        comoLista(valores, nombreParametro)
            .map((valor) => normalizarClave(valor))
            .filter((clave) => clave !== '')
    ));

    const compararPorCodigo = (a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    };

    const MARCAS_COMBINANTES = /[̀-ͯ]/g;

    // '{' sigue a 'z' en código, así la ñ queda después de toda la n y antes de la o.
    // NFC previo para que una ñ ya descompuesta (n + U+0303) también se sustituya.
    const claveDeRespaldo = (etiqueta) => etiqueta
        .normalize('NFC')
        .toLowerCase()
        .replace(/ñ/g, 'n{')
        .normalize('NFD')
        .replace(MARCAS_COMBINANTES, '');

    const compararEtiquetasDeRespaldo = (a, b) => compararPorCodigo(claveDeRespaldo(a), claveDeRespaldo(b));

    // Un collator sin datos de español (ICU reducido) trata la ñ como n; se rechaza y se usa el respaldo.
    const esCollatorEspanolUtil = (collator) => {
        if (collator === null || collator === undefined || typeof collator.compare !== 'function') return false;
        try {
            return collator.compare('ñ', 'nz') > 0
                && collator.compare('ñ', 'o') < 0
                && collator.compare('Á', 'a') === 0;
        } catch (error) {
            return false;
        }
    };

    /**
     * Crea el comparador del catálogo: orden alfabético español por etiqueta, sin distinguir mayúsculas ni
     * acentos, con la ñ entre la n y la o; desempate por ID con comparación por código.
     * Función pura: no conserva estado entre llamadas.
     * @param {?{compare: function(string, string): number}} collator - Intl.Collator('es', { sensitivity: 'base' }).
     * Si es null, no tiene compare, lanza o no ordena como español, se usa el respaldo determinista
     * (minúsculas, ñ como n{, sin diacríticos por NFD).
     * @returns {function({id: string, etiqueta: string}, {id: string, etiqueta: string}): number}
     */
    const crearComparadorEtiquetas = (collator) => {
        const compararEtiquetas = esCollatorEspanolUtil(collator)
            ? (a, b) => collator.compare(a, b)
            : compararEtiquetasDeRespaldo;
        return (a, b) => compararEtiquetas(a.etiqueta, b.etiqueta) || compararPorCodigo(a.id, b.id);
    };

    const crearCollatorEspanol = () => {
        if (typeof Intl === 'undefined' || typeof Intl.Collator !== 'function') return null;
        try {
            return new Intl.Collator('es', { sensitivity: 'base' });
        } catch (error) {
            return null;
        }
    };

    const compararCampos = crearComparadorEtiquetas(crearCollatorEspanol());

    const normalizarEtiqueta = (etiqueta, id) => {
        const texto = aTexto(etiqueta);
        return texto === '' ? id : texto;
    };

    const buscarTipoArticulo = (scriptidValor) => {
        const clave = normalizarClave(scriptidValor);
        return Object.prototype.hasOwnProperty.call(TIPOS_ARTICULO, clave) ? TIPOS_ARTICULO[clave] : null;
    };

    const normalizarIdInterno = (valor) => {
        if (typeof valor !== 'string' && typeof valor !== 'number') return null;
        const texto = String(valor).trim();
        return PATRON_ID_INTERNO.test(texto) ? texto : null;
    };

    const buscarPorId = (opciones, idTexto) => {
        const encontrada = opciones.find((opcion) => aTexto(leerId(opcion)) === idTexto);
        return encontrada === undefined ? null : Object.assign({}, encontrada);
    };

    const evaluarNaturaleza = (naturalezaId, naturalezas) => {
        const idTexto = normalizarIdInterno(naturalezaId);
        if (idTexto === null) return { naturaleza: null, error: MENSAJES.NATURALEZA_INVALIDA };
        const naturaleza = buscarPorId(naturalezas, idTexto);
        return { naturaleza, error: naturaleza === null ? MENSAJES.NATURALEZA_NO_DISPONIBLE : null };
    };

    const evaluarTipo = (tipoId, tipos) => {
        const idTexto = normalizarIdInterno(tipoId);
        if (idTexto === null) return { tipo: null, error: MENSAJES.TIPO_INVALIDO };
        const tipo = buscarPorId(tipos, idTexto);
        if (tipo === null) return { tipo: null, error: MENSAJES.TIPO_NO_DISPONIBLE };
        return { tipo, error: buscarTipoArticulo(tipo.scriptid) === null ? MENSAJES.TIPO_SIN_REGISTRO : null };
    };

    const mensajeCampoFueraDeCatalogo = (id) => (PATRON_ID_CAMPO_CITABLE.test(id)
        ? `El campo ${id} no pertenece al catálogo del tipo de artículo seleccionado.`
        : MENSAJES.CAMPO_NO_CITABLE_FUERA_DE_CATALOGO);

    /**
     * Resuelve el tipo de registro de un valor de la lista de tipos de artículo (RN-10).
     * @param {string} scriptidValor - scriptid del valor; se normaliza con String(), trim() y toLowerCase().
     * @returns {{tipoRegistro: string}} Copia nueva de la entrada de TIPOS_ARTICULO.
     * @throws {Error} TIPO_ARTICULO_DESCONOCIDO si el valor está vacío, es null o no existe en TIPOS_ARTICULO.
     */
    const resolverTipoArticulo = (scriptidValor) => {
        const tipoArticulo = buscarTipoArticulo(scriptidValor);
        if (tipoArticulo === null) {
            throw formato.crearErrorDeDominio(formato.ERRORES.TIPO_ARTICULO_DESCONOCIDO, MENSAJES.TIPO_SIN_REGISTRO);
        }
        return { tipoRegistro: tipoArticulo.tipoRegistro };
    };

    /**
     * Arma el catálogo de campos que se ofrece al usuario (RN-05).
     * @param {Object} entrada
     * @param {Array<{id: *, etiqueta: *}>} [entrada.campos] - Campos aplicables al tipo; ausente equivale a [].
     * @param {Array<*>} [entrada.idsExcluidos] - IDs que no se ofrecen; ausente equivale a [].
     * @returns {CampoCatalogo[]} Arreglo nuevo: IDs en minúsculas, sin vacíos, sin excluidos y sin duplicados
     * (se conserva el primero); etiqueta recortada o el ID si queda vacía; orden alfabético español por etiqueta
     * sin distinguir mayúsculas ni acentos y luego por ID (ver crearComparadorEtiquetas).
     * @throws {TypeError} Si campos o idsExcluidos están presentes y no son arreglos.
     */
    const filtrarCatalogo = (entrada) => {
        const { campos, idsExcluidos } = entrada || {};
        const excluidos = new Set(normalizarClaves(idsExcluidos, 'idsExcluidos'));
        const incluidos = new Set();
        const catalogo = [];
        comoLista(campos, 'campos').forEach((campo) => {
            const id = normalizarClave(leerId(campo));
            if (id === '' || excluidos.has(id) || incluidos.has(id)) return;
            incluidos.add(id);
            catalogo.push({ id, etiqueta: normalizarEtiqueta(campo.etiqueta, id) });
        });
        return catalogo.sort(compararCampos);
    };

    /**
     * Valida la naturaleza y el tipo de artículo elegidos contra las opciones recalculadas (RN-02, RN-08, RN-09).
     * Un ID es válido solo si es cadena o número y String(id).trim() cumple ^[1-9][0-9]*$.
     * @param {Object} entrada
     * @param {(string|number)} entrada.naturalezaId - ID de naturaleza enviado.
     * @param {(string|number)} entrada.tipoId - ID de tipo de artículo enviado.
     * @param {OpcionNaturaleza[]} [entrada.naturalezas] - Naturalezas disponibles; ausente equivale a [].
     * @param {OpcionTipo[]} [entrada.tipos] - Tipos de artículo activos; ausente equivale a [].
     * @returns {{valido: boolean, errores: string[], naturaleza: ?OpcionNaturaleza, tipo: ?OpcionTipo}}
     * naturaleza y tipo son copias de las opciones encontradas en su lista, o null.
     * @throws {TypeError} Si naturalezas o tipos están presentes y no son arreglos.
     */
    const validarEleccion = (entrada) => {
        const { naturalezaId, tipoId, naturalezas, tipos } = entrada || {};
        const evaluacionNaturaleza = evaluarNaturaleza(naturalezaId, comoLista(naturalezas, 'naturalezas'));
        const evaluacionTipo = evaluarTipo(tipoId, comoLista(tipos, 'tipos'));
        const errores = [evaluacionNaturaleza.error, evaluacionTipo.error].filter((error) => error !== null);
        return {
            valido: errores.length === 0,
            errores,
            naturaleza: evaluacionNaturaleza.naturaleza,
            tipo: evaluacionTipo.tipo
        };
    };

    /**
     * Valida la alta completa (RN-02, RN-06, RN-08, RN-09, RN-13). Incluye todos los errores de validarEleccion.
     * @param {Object} entrada
     * @param {(string|number)} entrada.naturalezaId - ID de naturaleza enviado.
     * @param {(string|number)} entrada.tipoId - ID de tipo de artículo enviado.
     * @param {OpcionNaturaleza[]} [entrada.naturalezas] - Naturalezas disponibles; ausente equivale a [].
     * @param {OpcionTipo[]} [entrada.tipos] - Tipos de artículo activos; ausente equivale a [].
     * @param {Array<*>} [entrada.idsSeleccionados] - IDs de campo marcados; ausente equivale a [].
     * @param {CampoCatalogo[]} [entrada.catalogo] - Catálogo recalculado del tipo; ausente equivale a [].
     * @returns {{valido: boolean, errores: string[], naturaleza: ?OpcionNaturaleza, tipo: ?OpcionTipo,
     * idsNormalizados: string[], errorDeEleccion: boolean}} idsNormalizados: en minúsculas, sin vacíos ni
     * duplicados, en el orden recibido. errorDeEleccion es true si validarEleccion falló.
     * @throws {TypeError} Si alguna de las listas está presente y no es arreglo.
     */
    const validarAlta = (entrada) => {
        const { naturalezaId, tipoId, naturalezas, tipos, idsSeleccionados, catalogo } = entrada || {};
        const eleccion = validarEleccion({ naturalezaId, tipoId, naturalezas, tipos });
        const idsNormalizados = normalizarClaves(idsSeleccionados, 'idsSeleccionados');
        const idsCatalogo = new Set(comoLista(catalogo, 'catalogo').map((campo) => normalizarClave(leerId(campo))));
        const erroresSeleccion = idsNormalizados.length === 0 ? [MENSAJES.SELECCION_VACIA] : [];
        const erroresCatalogo = idsNormalizados
            .filter((id) => !idsCatalogo.has(id))
            .map((id) => mensajeCampoFueraDeCatalogo(id));
        const errores = eleccion.errores.concat(erroresSeleccion, erroresCatalogo);
        return {
            valido: errores.length === 0,
            errores,
            naturaleza: eleccion.naturaleza,
            tipo: eleccion.tipo,
            idsNormalizados,
            errorDeEleccion: !eleccion.valido
        };
    };

    /**
     * Obtiene el texto de la naturaleza que se usa como nombre del registro (RN-12).
     * @param {Object} entrada
     * @param {(string|number)} entrada.naturalezaId - ID de la naturaleza; se compara como cadena recortada.
     * @param {OpcionNaturaleza[]} [entrada.naturalezas] - Naturalezas recalculadas; ausente equivale a [].
     * @returns {string} Nombre de la naturaleza, sin transformar.
     * @throws {Error} NATURALEZA_NO_DISPONIBLE (error de dominio) si el ID no está en naturalezas.
     * @throws {Error} Error que no es de dominio si la naturaleza encontrada no tiene texto.
     * @throws {TypeError} Si naturalezas está presente y no es arreglo.
     */
    const resolverNombre = (entrada) => {
        const { naturalezaId, naturalezas } = entrada || {};
        const opciones = comoLista(naturalezas, 'naturalezas');
        const idTexto = aTexto(naturalezaId);
        const naturaleza = idTexto === '' ? null : buscarPorId(opciones, idTexto);
        if (naturaleza === null) {
            throw formato.crearErrorDeDominio(formato.ERRORES.NATURALEZA_NO_DISPONIBLE, MENSAJES.NATURALEZA_NO_DISPONIBLE);
        }
        const nombre = aCadena(naturaleza.nombre);
        if (nombre.trim() === '') throw new Error(MENSAJES.NATURALEZA_SIN_NOMBRE);
        return nombre;
    };

    return {
        TIPOS_ARTICULO,
        crearComparadorEtiquetas,
        resolverTipoArticulo,
        filtrarCatalogo,
        validarEleccion,
        validarAlta,
        resolverNombre
    };
});
