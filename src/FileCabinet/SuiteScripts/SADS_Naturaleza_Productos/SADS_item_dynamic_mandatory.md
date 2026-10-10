# Notas de Implementación: Validación Dinámica de Campos en Artículos

## Archivos
* `item_dynamic_mandatory_cs.js` (Client Script - v2.1)
* `item_dynamic_mandatory_ue.js` (User Event Script - v2.1)

## Dependencias
* `N/search`: Para consultar la configuración en el custom record.
* `N/log`: Para registrar errores de parseo o campos ocultos.
* `N/error`: Para detener la transacción en el User Event.

## Detalles de la Implementación

El objetivo de este desarrollo es controlar qué campos son obligatorios en un Item dependiendo de la selección que se haga en un campo de clasificación específico. 

Para lograr esto, la lógica lee un JSON (un arreglo de IDs de campos) guardado en un Custom Record y aplica la restricción tanto en la interfaz de usuario como en el servidor. 

### Lógica del Client Script (UI)
El script de cliente reacciona en la carga de la página (`pageInit`) y cada vez que cambia el campo gatillo (`fieldChanged`). 

* **Caché en memoria:** Cuando el usuario selecciona una opción, el script hace un `search.lookupFields` para traer el JSON. Para no penalizar el rendimiento si el usuario cambia opciones varias veces, el arreglo ya parseado se guarda en un objeto `lookupCache`.
* **Búsqueda sincrónica:** Por definición del requerimiento, la búsqueda es síncrona. Esto significa que habrá un bloqueo imperceptible en la UI al seleccionar una opción por primera vez.
* **Seguridad de campos:** Cuando intentamos hacer un campo obligatorio usando `getField`, lo metemos en un bloque `try/catch`. Si el campo está oculto por el layout o no pertenece al sub-tipo de artículo actual, NetSuite tira error. Con el `catch` evitamos que se rompa el script y lo registramos en los logs.
* **Reset de estado:** Tenemos un arreglo temporal `appliedMandatoryFields` que guarda los campos que hicimos obligatorios. Si el usuario cambia la opción del gatillo, primero iteramos este arreglo para devolver esos campos a opcional antes de aplicar las nuevas reglas. 

### Lógica del User Event (Servidor)
Sirve como validación final para integraciones, CSV imports o si el script de cliente falla. Corre en `beforeSubmit` solo para Creación y Edición.

* Funciona casi igual que el cliente: saca el ID del gatillo, busca el JSON y lo parsea.
* Luego revisa si los campos solicitados en el JSON vienen vacíos (se valida null, string vacío y arreglos vacíos para campos de selección múltiple).
* **Control de error:** Si faltan campos, levanta un `error.create` nativo. Para ahorrar unidades de gobernanza, el mensaje de error muestra directamente los IDs internos de los campos faltantes, en lugar de gastar recursos tratando de averiguar su etiqueta de interfaz.

## Instrucciones de Despliegue

1. Cargar ambos scripts en el File Cabinet.
2. Crear un registro de Script para el Client Script y otro para el User Event.
3. Desplegarlos sobre el registro de Item (o el subtipo específico como Inventory Item, según aplique).
4. **IMPORTANTE:** Antes de guardar, abre el código de ambos scripts y reemplaza las constantes en el objeto `CONFIG` con los IDs internos reales de la cuenta:
   * `[ID_CAMPO_GATILLO]`: El ID del campo de selección en el artículo.
   * `[ID_CUSTOM_RECORD]`: El ID interno del registro personalizado que guarda las reglas.
   * `[ID_CAMPO_JSON]`: El ID del campo de texto donde se pega el arreglo `["custitem1", "custitem2"]`.

## Consideraciones de Gobernanza
* **Client Script:** No consume gobernanza, pero usar `search.lookupFields` síncrono consume tiempo de CPU en el navegador. La caché en memoria mitiga esto.
* **User Event:** Consume exactamente 1 unidad de gobernanza por el `search.lookupFields`. Es un impacto mínimo e ideal para eventos `beforeSubmit`.