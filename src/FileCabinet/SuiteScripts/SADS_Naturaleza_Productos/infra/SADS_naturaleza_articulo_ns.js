/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Adaptador de artículos de NetSuite para el creador de artículos por naturaleza.
 * Solo accede a N/search; no contiene reglas de negocio.
 */
define(['N/search'], (search) => {
    const CAMPO_ID_INTERNO = 'internalid';

    /**
     * Resuelve el tipo de registro programable de un artículo por su ID interno (PT-01, S-13).
     * Costo: 10 unidades (ResultSet.getRange).
     * @param {string} articuloId - ID interno del artículo.
     * @returns {?string} recordType del primer resultado, por ejemplo 'inventoryitem'; null si no hay resultado.
     */
    const resolverTipoRegistroArticulo = (articuloId) => {
        const resultados = search.create({
            type: search.Type.ITEM,
            filters: [[CAMPO_ID_INTERNO, search.Operator.ANYOF, String(articuloId)]],
            columns: []
        }).run().getRange({ start: 0, end: 1 });
        if (!Array.isArray(resultados) || resultados.length === 0) return null;
        const tipo = resultados[0].recordType;
        return tipo === null || tipo === undefined || String(tipo) === '' ? null : String(tipo);
    };

    return { resolverTipoRegistroArticulo };
});
