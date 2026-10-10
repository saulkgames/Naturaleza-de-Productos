/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @description Controla la obligatoriedad dinámica de campos en la UI del registro de Artículo basándose en una regla JSON almacenada en un Custom Record.
 */
define(['N/search', 'N/log'], (search, log) => {

    const CONFIG = {
        TRIGGER_FIELD: 'custitem_sads_naturaleza_producto',
        CUSTOM_RECORD: 'customrecord_sads_naturaleza_productos',
        FIELDIDS_ARRAY: 'custrecord_sads_naturaleza_config'
    };

    let appliedMandatoryFields = [];
    let lookupCache = {};

    /**
     * Resetea los campos que previamente se hicieron obligatorios.
     * @param {import('N/currentRecord').CurrentRecord} currentRecord - El registro actual
     */
    const resetPreviousFields = (currentRecord) => {
        if (appliedMandatoryFields.length === 0) return;

        appliedMandatoryFields.forEach(fieldId => {
            try {
                const field = currentRecord.getField({ fieldId: fieldId });
                if (field) {
                    field.isMandatory = false;
                }
            } catch (e) {
                log.debug('Campo no accesible para reset', fieldId);
            }
        });

        appliedMandatoryFields = [];
    };

    /**
     * Aplica la lógica de campos obligatorios basándose en el valor del campo gatillo.
     * @param {Object} context 
     * @param {import('N/currentRecord').CurrentRecord} context.currentRecord
     */
    const applyMandatoryRules = (context) => {
        const currentRecord = context.currentRecord;
        const triggerValue = currentRecord.getValue({ fieldId: CONFIG.TRIGGER_FIELD });

        resetPreviousFields(currentRecord);

        if (!triggerValue) return;

        let targetFields = [];

        try {
            if (lookupCache[triggerValue]) {
                targetFields = lookupCache[triggerValue];
            } else {
                const lookupParams = {
                    type: CONFIG.CUSTOM_RECORD,
                    id: triggerValue,
                    columns: [CONFIG.FIELDIDS_ARRAY]
                };
                const lookupResult = search.lookupFields(lookupParams);

                const jsonString = lookupResult[CONFIG.FIELDIDS_ARRAY];
                if (jsonString) {
                    targetFields = JSON.parse(jsonString);
                    lookupCache[triggerValue] = targetFields;
                }
            }

            if (Array.isArray(targetFields) && targetFields.length > 0) {
                targetFields.forEach(fieldId => {
                    try {
                        const field = currentRecord.getField({ fieldId: fieldId });
                        if (field) {
                            field.isMandatory = true;
                            field.isDisabled = false;
                            appliedMandatoryFields.push(fieldId);
                        }
                    } catch (e) {
                        log.debug('Campo no expuesto en UI', fieldId);
                    }
                });
            }
        } catch (e) {
            log.error({
                title: 'Error al aplicar reglas dinámicas',
                details: e.message || e.toString()
            });
        }
    };

    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    const pageInit = (context) => {
        applyMandatoryRules(context);
    };

    /**
     * Function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    const fieldChanged = (context) => {
        if (context.fieldId === CONFIG.TRIGGER_FIELD) {
            applyMandatoryRules(context);
        }
    };

    /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
    const saveRecord = (context) => {
        const currentRecord = context.currentRecord;
        let missingFields = [];

        // appliedMandatoryFields es el arreglo donde guardamos los IDs que hicimos obligatorios
        if (appliedMandatoryFields.length > 0) {
            appliedMandatoryFields.forEach(fieldId => {
                const val = currentRecord.getValue({ fieldId: fieldId });
                // Validación estricta
                if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
                    missingFields.push(fieldId);
                }
            });
        }

        if (missingFields.length > 0) {
            alert(`⚠️ Faltan campos obligatorios: \n${missingFields.join('\n')}\nPor favor, complételos.`);
            return false; // Retornar false bloquea el guardado nativamente
        }
        return true;
    };

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };
});