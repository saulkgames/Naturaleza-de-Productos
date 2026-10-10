/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Intercepta el guardado del Artículo para validar que los campos dinámicos
 * requeridos no vengan vacíos. Actúa como barrera a nivel servidor.
 */
define(['N/search', 'N/error', 'N/log'], (search, error, log) => {

    const CONFIG = {
        TRIGGER_FIELD: 'custitem_sads_naturaleza_producto',
        CUSTOM_RECORD: 'customrecord_sads_naturaleza_productos',
        FIELDIDS_ARRAY: 'custrecord_sads_naturaleza_config'
    };

    /**
     * Verifica si un valor se considera vacío en el contexto de NetSuite.
     * @param {any} val - Valor a evaluar
     * @returns {boolean}
     */
    const isEmpty = (val) => {
        if (val === null || val === undefined || val === '') return true;
        if (Array.isArray(val) && val.length === 0) return true;
        return false;
    };

    /**
     * Entry point: beforeSubmit
     * @param {Object} context
     */
    const beforeSubmit = (context) => {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        const newRecord = context.newRecord;
        const triggerValue = newRecord.getValue({ fieldId: CONFIG.TRIGGER_FIELD });

        if (!triggerValue) return;

        try {
            const lookupResult = search.lookupFields({
                type: CONFIG.CUSTOM_RECORD,
                id: triggerValue,
                columns: [CONFIG.FIELDIDS_ARRAY]
            });

            const rawJsonString = lookupResult[CONFIG.FIELDIDS_ARRAY];
            if (!rawJsonString) return;

            const targetFields = JSON.parse(rawJsonString);
            if (!Array.isArray(targetFields)) return;

            const requiredFieldsArray = JSON.parse(rawJsonString);
            let missingFields = [];

            requiredFieldsArray.forEach(fieldId => {
                const fieldValue = newRecord.getValue({ fieldId: String(fieldId).trim() });

                log.audit({
                    title: `Evaluando campo: ${fieldId}`,
                    details: `Valor leído: [${fieldValue}] | Tipo de dato: ${typeof fieldValue}`
                });

                if (fieldValue === null || fieldValue === undefined || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)) {
                    missingFields.push(fieldId);
                }
            });

            targetFields.forEach(fieldId => {
                const val = newRecord.getValue({ fieldId: fieldId });
                if (isEmpty(val)) {
                    missingFields.push(fieldId);
                }
            });

            if (missingFields.length > 0) {
                throw error.create({
                    name: 'MISSING_DYNAMIC_MANDATORY_FIELDS',
                    message: `Operación cancelada. El valor seleccionado en el campo gatillo requiere que los siguientes campos tengan información: ${missingFields.join(', ')}`,
                    notifyOff: true
                });
            }

        } catch (e) {
            if (e.name === 'MISSING_DYNAMIC_MANDATORY_FIELDS') {
                throw e;
            }

            log.error({
                title: 'Error procesando validación UE',
                details: e.message || e.toString()
            });
        }

    };


    return {
        beforeSubmit: beforeSubmit
    };
});