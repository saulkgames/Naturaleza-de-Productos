/******************************************************************
 * * DisrupTT * DisrupTT Developers *
 * ****************************************************************
 * Date: 06/2024
 * Script name: DRT - Item UE
 * Script id: customscript_drt_item_ue
 * Deployment id:
 * Applied to:
 * File: drt_item_ue.js
 ******************************************************************/
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
    'N/record',
    'N/redirect',
    'N/runtime',
    'N/search',
    'SuiteScripts/DRT - Custom Module/drt_item_cm',
],
    /**
 * @param{record} record
 * @param{redirect} redirect
 * @param{runtime} runtime
 * @param{search} search
 */
    (
        record,
        redirect,
        runtime,
        search,
        drt_item_cm,
    ) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            try {
                const typeEvent = scriptContext.type;
                if(typeEvent == 'view'){
                    drt_item_cm.setPreciosFinales(scriptContext, 'true');
                }
            } catch (error) {
                log.error(`beforeLoad error`, `${JSON.stringify(error)}`);
            }
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            try {
                
            } catch (error) {
                log.error(`beforeSubmit error`, `${JSON.stringify(error)}`);
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            try {
                drt_item_cm.setPreciosFinales(scriptContext, 'false');
            } catch (error) {
                log.error(`afterSubmit error`, `${JSON.stringify(error)}`);
            }
        }

        return {
            beforeLoad,
            beforeSubmit,
            afterSubmit,
        }

    });
