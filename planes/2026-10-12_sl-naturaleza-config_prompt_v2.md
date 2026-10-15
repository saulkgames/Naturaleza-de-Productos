# Tarea: Suitelet de alta de configuración de Naturaleza de Productos

Origen: `planes/2026-10-12_sl-naturaleza-config_plan_v3.md` (aprobado 2026-10-12).

## Rol
Eres un desarrollador senior de SuiteScript 2.1 para NetSuite y SuiteCloud Development Framework (SDF).
Implementas exactamente el diseño aprobado que sigue.
No cambies reglas de negocio ni IDs.
Si detectas una contradicción o un dato faltante, detente y repórtalo en lugar de suponer.
Todo dato marcado como "supuesto" debe quedar aislado en una constante o función con nombre, para corregirlo en sandbox sin tocar reglas.

## Contexto
- Empresa: grupo industrial mexicano multi-subsidiaria (acero y hielo). NetSuite OneWorld.
- Proyecto SDF de tipo Account Customization (`src/manifest.xml`, `projecttype="ACCOUNTCUSTOMIZATION"`). authId de sandbox: `Almetal_SB`.
- Existe una solución que hace obligatorios campos de artículo según una "naturaleza de producto":
  - Campo de artículo `custitem_sads_naturaleza_producto` (SELECT al registro `customrecord_sads_naturaleza_productos`).
  - El registro guarda en `custrecord_sads_naturaleza_config` (CLOBTEXT) un arreglo JSON de IDs de campo de artículo.
  - `SADS_CS_item_dynamic_mandatory.js` y `SADS_UE_item_dynamic_mandatory.js` leen ese texto con `search.lookupFields`, lo parsean con `JSON.parse`, verifican `Array.isArray` y usan cada cadena como `fieldId`.
- Problema: el JSON se captura a mano; un error de sintaxis desactiva la validación en silencio.
- Objetivo: un Suitelet para usuario final que cree registros de configuración sin teclear JSON, filtrando campos por tipo de artículo y sin duplicar naturalezas.
- Contrato de formato que no debe romperse: texto JSON que al parsear da un arreglo de cadenas; cada cadena es un ID interno de campo de artículo.
- No modificar: `SADS_CS_item_dynamic_mandatory.js`, `SADS_UE_item_dynamic_mandatory.js`, `testt.js`, `custitem_sads_naturaleza_producto.xml`, `customlist_sads_naturaleza_productos.xml`.

## Entregables
| Archivo | Tipo | scriptid | Ruta |
|---|---|---|---|
| `SADS_SL_naturaleza_config.js` | Suitelet 2.1 (entry point) | `customscript_sads_sl_naturaleza_config` | `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/` |
| `SADS_naturaleza_config_formato.js` | Módulo AMD sin `N/` | — | `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/domain/` |
| `SADS_naturaleza_alta_reglas.js` | Módulo AMD sin `N/` | — | `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/domain/` |
| `customscript_sads_sl_naturaleza_config.xml` | Object XML (script + deployment) | — | `src/Objects/` |
| `customrole_sads_naturaleza_config_exec.xml` | Object XML (rol) | `customrole_sads_naturaleza_config_exec` | `src/Objects/` |
| `customlist_sads_tipos_articulo.xml` | Object XML (lista) | `customlist_sads_tipos_articulo` | `src/Objects/` |
| `customrecord_sads_naturaleza_productos.xml` | Object XML (modificación) | — | `src/Objects/` |
| `SADS_naturaleza_config_formato.test.js` | Jest | — | `__tests__/` |
| `SADS_naturaleza_alta_reglas.test.js` | Jest | — | `__tests__/` |
| `SADS_SL_naturaleza_config.test.js` | Jest con stubs de `N/` | — | `__tests__/` |
| `SADS_SL_naturaleza_config.md` | Notas de implementación y despliegue | — | `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/` |

## Estructura de archivos
```
src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/
├── SADS_CS_item_dynamic_mandatory.js         (existente, no tocar)
├── SADS_UE_item_dynamic_mandatory.js         (existente, no tocar)
├── SADS_SL_naturaleza_config.js              (nuevo)
├── SADS_SL_naturaleza_config.md              (nuevo)
└── domain/
    ├── SADS_naturaleza_config_formato.js     (nuevo)
    └── SADS_naturaleza_alta_reglas.js        (nuevo)
src/Objects/
├── customrecord_sads_naturaleza_productos.xml (modificar)
├── customlist_sads_tipos_articulo.xml         (nuevo)
├── customrole_sads_naturaleza_config_exec.xml (nuevo)
└── customscript_sads_sl_naturaleza_config.xml (nuevo)
__tests__/
├── SADS_naturaleza_config_formato.test.js
├── SADS_naturaleza_alta_reglas.test.js
└── SADS_SL_naturaleza_config.test.js
```
Se conserva la convención plana existente; no crear `entrypoints/`.

## Arquitectura
- Nivel 1: reglas puras en `domain/` sin imports `N/`; el entry point conserva el acceso a `N/` en funciones locales con nombre.
- Dependencias: Suitelet → `domain/formato` y `domain/alta_reglas`; `alta_reglas` → `formato`. Ningún módulo de `domain/` importa `N/*`.
- Un caso de uso: "Crear configuración de naturaleza". Entrada: `naturalezaId`, `tipoArticuloId`, `idsSeleccionados[]`. Salida: ID de registro, nombre, JSON; o lista de errores.
- Patrones: ninguno. El mapa de tipos es una tabla de datos.
- Datos que cruzan hacia `domain/`: solo objetos planos (nunca `record.Record`, `ResultSet`, `request` ni `context`).
- Sin estado a nivel de módulo usado como caché.

## Modelo de datos
### Existentes
| Registro | Campo | ID | Tipo | Estado |
|---|---|---|---|---|
| Config naturaleza | Naturaleza | `custrecord_sads_naturaleza_lista` | SELECT a `customlist_sads_naturaleza_productos` | Verificado |
| Config naturaleza | Configuración | `custrecord_sads_naturaleza_config` | CLOBTEXT | Verificado |
| Config naturaleza | Inactivo | `isinactive` | Checkbox | Supuesto |
| Lista naturalezas | — | `id`, `name`, `isinactive` | Columnas SuiteQL | Supuesto |
| Definición de campo | — | tabla `customfield`: `scriptid`, `name`, `isinactive`, `fieldtype` | Columnas SuiteQL | Supuesto |
| Artículo | Campo gatillo | `custitem_sads_naturaleza_producto` | SELECT | Verificado |

### Cambios a `customrecord_sads_naturaleza_productos.xml`
1. `<includename>T</includename>` (hoy es F).
2. Nuevo `customrecordcustomfield` `custrecord_sads_naturaleza_tipo_art`: `fieldtype` SELECT; `selectrecordtype` `[scriptid=customlist_sads_tipos_articulo]`; `ismandatory` T; `label` "Tipo de Artículo"; `accesslevel` 2; `searchlevel` 2; `showinlist` T; `storevalue` T; demás elementos iguales a `custrecord_sads_naturaleza_lista`.
3. No cambiar `accesstype` (CUSTRECORDENTRYPERM) ni los campos existentes.

### Nueva `customlist_sads_tipos_articulo.xml`
Nombre "SADS - Tipos de Artículo", `isordered` T. Valores:
| scriptid | Texto | Tipo de registro (mapa en dominio) | Estado |
|---|---|---|---|
| `val_sads_ta_inv` | Inventariable | `inventoryitem` | Supuesto (no está en la referencia de Oracle) |
| `val_sads_ta_noinv_venta` | No inventariable - Venta | `noninventorysaleitem` | Referencia Oracle |
| `val_sads_ta_noinv_reventa` | No inventariable - Reventa | `noninventoryresaleitem` | Referencia Oracle |
| `val_sads_ta_noinv_compra` | No inventariable - Compra | `noninventorypurchaseitem` | Supuesto |
| `val_sads_ta_otro_venta` | Otro cargo - Venta | `otherchargesaleitem` | Supuesto (R-17) |
| `val_sads_ta_otro_reventa` | Otro cargo - Reventa | `otherchargeresaleitem` | Supuesto (R-17) |
| `val_sads_ta_otro_compra` | Otro cargo - Compra | `otherchargepurchaseitem` | Supuesto (R-17) |
| `val_sads_ta_serv_venta` | Servicio - Venta | `servicesaleitem` | Referencia Oracle |
| `val_sads_ta_serv_reventa` | Servicio - Reventa | `serviceresaleitem` | Referencia Oracle |
| `val_sads_ta_serv_compra` | Servicio - Compra | `servicepurchaseitem` | Supuesto |
| `val_sads_ta_kit` | Kit | `kititem` | Referencia Oracle |
| `val_sads_ta_grupo` | Grupo de artículos | `itemgroup` | Referencia Oracle |
Son 12 valores. El mapa se indexa por `scriptid` en minúsculas, nunca por ID interno.
R-17: la referencia de Oracle marca `otherchargeitem` como no programable desde servidor. Si `record.create` falla para un tipo, el Suitelet debe mostrar el mensaje genérico de error y registrar el tipo en `log.error`; no debe construir un catálogo parcial.

### Nuevo `customrole_sads_naturaleza_config_exec.xml`
Nombre "SADS - Ejecución Config Naturaleza". No se asigna a usuarios; solo se usa como `runasrole`.
| permkey | permlevel |
|---|---|
| `LIST_CUSTRECORDENTRY` | CREATE |
| `ADMI_CUSTITEMFIELD` | VIEW |
| `LIST_ITEM` | VIEW |
No agregar otros permisos. Nunca usar ADMINISTRATOR.

### Nuevo `customscript_sads_sl_naturaleza_config.xml`
- `scriptfile`: `[/SuiteScripts/SADS_Naturaleza_Productos/SADS_SL_naturaleza_config.js]`.
- Nombre: "SADS SL Alta Configuración Naturaleza".
- Parámetro `custscript_sads_sl_permitir_alta`: CHECKBOX, default F, etiqueta "Permitir creación". F = iteración A (vista previa sin botón Crear); T = iteración B.
- Deployment `customdeploy_sads_sl_naturaleza_config`: `status` RELEASED; `isonline` F; `runasrole` `[scriptid=customrole_sads_naturaleza_config_exec]`; `allroles` F; sin `audslctrole` (audiencia vacía; la configura el cliente); `loglevel` AUDIT; `title` "SADS - Alta de Configuración de Naturaleza".

## Especificación por componente

### `domain/SADS_naturaleza_config_formato.js`
Dueño único del contrato JSON. Sin imports `N/`.
| Función | Entrada | Salida | Regla |
|---|---|---|---|
| `serializarConfiguracion(ids)` | `string[]` | `string` | Recorta espacios, descarta vacíos, elimina duplicados, ordena ascendente por ID, `JSON.stringify` sin espacios. Si el resultado es un arreglo vacío o no pasa `esConfiguracionValida`, lanza error de dominio. |
| `parsearConfiguracion(texto)` | `string` | `string[]` | Lanza error de dominio si no es JSON, no es arreglo, está vacío o algún elemento no es cadena no vacía. |
| `esConfiguracionValida(texto)` | `string` | `boolean` | `true` solo si `parsearConfiguracion` no lanza. |
Error de dominio: objeto `Error` con `name` = `CONFIGURACION_INVALIDA` y mensaje en español. Exportar una fábrica para crearlo.

### `domain/SADS_naturaleza_alta_reglas.js`
Sin imports `N/`. Puede importar `formato`.
| Función | Entrada | Salida | Reglas |
|---|---|---|---|
| `resolverTipoArticulo(scriptidValor)` | `string` | `{tipoRegistro}` | RN-10. Comparación en minúsculas. Lanza error de dominio `TIPO_ARTICULO_DESCONOCIDO` si no existe en el mapa. |
| `filtrarCatalogo({campos, idsExcluidos})` | `campos: {id, etiqueta}[]`, `idsExcluidos: string[]` | `{id, etiqueta}[]` | RN-05. IDs en minúsculas; sin duplicados; orden por etiqueta y luego por ID. |
| `validarEleccion({naturalezaId, tipoId, naturalezas, tipos})` | ids crudos (string) y listas `{id, nombre}` / `{id, nombre, scriptid}` | `{valido, errores[]}` | RN-08, RN-09. Ids enteros positivos; pertenencia a la lista; el `scriptid` del tipo existe en el mapa. |
| `validarAlta({naturalezaId, tipoId, naturalezas, tipos, idsSeleccionados, catalogo})` | igual + `string[]`, `{id, etiqueta}[]` | `{valido, errores[]}` | RN-02, RN-06, RN-08, RN-09, RN-13. Incluye `validarEleccion`. |
| `resolverNombre({naturalezaId, naturalezas})` | — | `string` | RN-12 |
Mensajes de error en español, sin IDs internos de NetSuite salvo el ID de campo seleccionado.

### `SADS_SL_naturaleza_config.js`
Encabezado: `@NApiVersion 2.1`, `@NScriptType Suitelet`, `@NModuleScope SameAccount`.
Módulos: `N/ui/serverWidget`, `N/ui/message`, `N/query`, `N/record`, `N/runtime`, `N/url`, `N/log`, `./domain/SADS_naturaleza_config_formato`, `./domain/SADS_naturaleza_alta_reglas`.
IDs como constantes con nombre al inicio del archivo (registro, campos, listas, parámetro, IDs `custpage_*`).

Despacho en `onRequest`:
- GET → paso 1.
- POST con `custpage_accion` = `catalogo` → paso 2.
- POST con `custpage_accion` = `crear` → creación (solo si el parámetro `custscript_sads_sl_permitir_alta` = T; si no, re-mostrar paso 2 con mensaje "Creación deshabilitada").
- Cualquier otro valor → paso 1.
- try/catch global: error de dominio → mensaje del error; cualquier otro error → `log.error` con detalle y página con mensaje genérico "No fue posible completar la operación. Contacte al administrador." Nunca mostrar el mensaje crudo de NetSuite.

Paso 1 (`construirPaso1`):
1. `cargarOpcionesDeAlta()`.
2. Si no hay naturalezas: mensaje informativo "Todas las naturalezas ya tienen configuración." y sin botón Siguiente.
3. SELECT `custpage_naturaleza` (obligatorio, opción vacía inicial) y SELECT `custpage_tipo_art` (obligatorio, opción vacía inicial), poblados con `addSelectOption`.
4. Campo HIDDEN `custpage_accion` = `catalogo`. Botón submit "Siguiente".
5. Si viene de un error: valores previos seleccionados y mensaje con `form.addPageInitMessage`.

Paso 2 (`construirPaso2`):
1. `cargarOpcionesDeAlta()`; `validarEleccion`. Error → paso 1 con mensaje y valores previos.
2. `resolverTipoArticulo(scriptid del tipo)`; `obtenerCamposAplicables(tipoRegistro)`; `filtrarCatalogo` excluyendo `custitem_sads_naturaleza_producto`.
3. Naturaleza y tipo como campos de texto en modo INLINE (texto visible) más HIDDEN con sus IDs.
4. Si el catálogo está vacío: mensaje "No hay campos personalizados activos para este tipo de artículo." y sin botón Crear.
5. Sublista `custpage_campos` tipo LIST con `addMarkAllButtons`; columnas `custpage_sel` (CHECKBOX, ENTRY), `custpage_etiqueta` (TEXT), `custpage_id` (TEXT).
6. HIDDEN `custpage_accion` = `crear`. Botón submit "Crear configuración" solo si el parámetro está en T.
7. Enlace "Regresar" al paso 1: URL de `url.resolveScript` del propio script y deployment, en un campo INLINEHTML estático; no incluir datos del usuario en ese HTML.
8. Si viene de un error de creación: casillas previas marcadas y mensaje.

Creación:
1. Leer `custpage_naturaleza`, `custpage_tipo_art` (HIDDEN) y líneas con `custpage_sel` = `T` vía `request.getLineCount` / `request.getSublistValue`.
2. Recalcular `cargarOpcionesDeAlta()` y el catálogo del tipo. No confiar en ningún dato del formulario salvo los IDs a validar.
3. `validarAlta`. Error → paso 2 con mensaje y selección previa.
4. `serializarConfiguracion(idsSeleccionados)`.
5. `crearConfiguracion`: `record.create` de `customrecord_sads_naturaleza_productos`; `name` = `resolverNombre`; `custrecord_sads_naturaleza_lista`; `custrecord_sads_naturaleza_tipo_art`; `custrecord_sads_naturaleza_config`; `save` con `ignoreMandatoryFields: false`.
6. `log.audit`: ID, nombre, tipo, número de campos.
7. `construirConfirmacion`: nombre, tipo, JSON guardado (campo de texto largo INLINE), enlace al registro (`url.resolveRecord`) solo si `usuarioPuedeVerRegistro()` es `true`, enlace "Crear otra" al paso 1.

Funciones del entry point:
| Función | Entrada | Salida | Responsabilidad |
|---|---|---|---|
| `onRequest(context)` | — | — | Despacho y manejo global de errores |
| `cargarOpcionesDeAlta()` | — | `{naturalezas: {id, nombre}[], tipos: {id, nombre, scriptid}[]}` | Q-1 y Q-2; única fuente para todos los pasos |
| `obtenerCamposAplicables(tipoRegistro)` | `string` | `{id, etiqueta}[]` | Q-3 ∩ campos de `record.create` en memoria (estrategia E2) |
| `crearConfiguracion({nombre, naturalezaId, tipoArticuloId, json})` | — | `number` | Escritura del registro |
| `usuarioPuedeVerRegistro()` | — | `boolean` | `runtime.getCurrentUser().getPermission({ name: 'LIST_CUSTRECORDENTRY' })` ≥ VIEW. Supuesto: bajo `runasrole` puede reflejar el rol de ejecución; aislar en esta función. |
| `leerPermitirAlta()` | — | `boolean` | Parámetro de script |
| `construirPaso1` / `construirPaso2` / `construirConfirmacion` | objetos planos | `serverWidget.Form` | Solo presentación |

Consultas (`query.runSuiteQL`, con parámetros `?` cuando haya valores variables; nunca concatenar entrada del usuario):
| ID | Tabla | Campos | Filtros | Orden |
|---|---|---|---|---|
| Q-1 | `customlist_sads_naturaleza_productos` | `id`, `name` | `isinactive = 'F'` y `NOT EXISTS` en `customrecord_sads_naturaleza_productos` con `custrecord_sads_naturaleza_lista` = id de la lista (sin filtrar `isinactive` del registro de configuración) | `name` |
| Q-2 | `customlist_sads_tipos_articulo` | `id`, `name`, `scriptid` | `isinactive = 'F'` | `name` |
| Q-3 | `customfield` | `scriptid`, `name` | `isinactive = 'F'`; `fieldtype = 'ITEM'` (supuesto); `scriptid` que inicia con `custitem` (sin distinguir mayúsculas) | `name` |
Normalizar todo `scriptid` a minúsculas antes de comparar.
Estrategia E2 en `obtenerCamposAplicables`: `record.create({ type: tipoRegistro, isDynamic: true })` sin guardar; tomar `getFields()`; conservar solo IDs de Q-3 presentes en ese conjunto; etiqueta desde Q-3.
Los textos SQL y los valores supuestos (`fieldtype`, columnas) van en constantes con nombre para corregirlos en sandbox.

Reglas de negocio:
| ID | Regla |
|---|---|
| RN-01 | Solo se ofrecen naturalezas activas sin registro de configuración, activo o inactivo. |
| RN-02 | Si al crear ya existe registro para la naturaleza, se rechaza. |
| RN-03 | El catálogo contiene solo campos personalizados de artículo activos. |
| RN-04 | El catálogo contiene solo campos aplicables al tipo de registro elegido. |
| RN-05 | Se excluye `custitem_sads_naturaleza_producto`. |
| RN-06 | Debe marcarse al menos un campo. |
| RN-07 | JSON = arreglo de cadenas, sin duplicados, orden ascendente por ID, sin espacios. |
| RN-08 | La naturaleza enviada es entera y pertenece a las disponibles recalculadas. |
| RN-09 | El tipo enviado es entero, está activo y su `scriptid` existe en el mapa. |
| RN-10 | Cada valor de la lista de tipos se resuelve a un tipo de registro por `scriptid`. |
| RN-11 | El tipo de artículo se guarda en `custrecord_sads_naturaleza_tipo_art`. |
| RN-12 | `name` = texto de la naturaleza tomado de Q-1 recalculada. |
| RN-13 | Todo ID enviado existe en el catálogo recalculado del tipo. |
| RN-14 | Solo creación; no se reciben ni cargan IDs de registros de configuración. |

## Restricciones técnicas
- SuiteScript 2.1; solo los módulos `N/` listados.
- Gobernanza: Suitelet 1,000 unidades; estimado ≤ ~45 por solicitud. No optimizar ni agregar caché.
- Contexto: solo UI vía Suitelet.
- Regla de dependencia: `domain/` no importa `N/*`.
- Entry point: funciones pequeñas; la lógica de decisión de negocio vive en `domain/`.
- Sin INLINEHTML con datos del usuario. Los textos que vienen de NetSuite se muestran en campos TEXT/INLINE, no en HTML.
- Sin datos reales confidenciales.
- JSDoc en funciones exportadas. Sin comentarios que narren el código.
- Validar el proyecto con `suitecloud project:validate` si está disponible.

## Criterios de aceptación
Pruebas Jest (`npm test`) sin cuenta NetSuite:
| Caso | Capa | Entrada | Resultado esperado |
|---|---|---|---|
| P-01 | formato | `["upccode","custitem_b","custitem_b"]` | `'["custitem_b","upccode"]'` |
| P-02 | formato | `"[a,b]"`, `"{}"`, `"[1]"`, `""`, `"[]"` | `esConfiguracionValida` = false; `parsearConfiguracion` lanza `CONFIGURACION_INVALIDA` |
| P-03 | formato | `[]` y `["  "]` | `serializarConfiguracion` lanza `CONFIGURACION_INVALIDA` |
| P-04 | reglas | Cada uno de los 12 `scriptid` de la lista (también en mayúsculas); `val_inexistente` | Tipo resuelto; error `TIPO_ARTICULO_DESCONOCIDO` |
| P-05 | reglas | Catálogo con `custitem_sads_naturaleza_producto` y duplicados | Excluido; sin duplicados; ordenado por etiqueta |
| P-06 | reglas | Selección vacía | `valido` false con mensaje |
| P-07 | reglas | ID fuera del catálogo | `valido` false con mensaje que cite el ID |
| P-08 | reglas | Naturaleza no disponible, `"abc"`, `"-1"` | `valido` false |
| P-09 | reglas | Tipo inexistente, no entero o con `scriptid` fuera del mapa | `valido` false |
| P-10 | reglas | Naturaleza id 1 con nombre "Placas de Acero" | `"Placas de Acero"` |
| P-11 | entry point | `runSuiteQL` lanza error | Página con mensaje genérico; `log.error` llamado |
| P-12 | entry point | `accion=crear` con validación fallida | Paso 2 con casillas previas marcadas y mensaje |
| P-13 | entry point | `save` lanza error | Mensaje genérico; el texto del error no aparece en la página |
| P-19 | entry point | Parámetro `permitir_alta` = F | Paso 2 sin botón Crear; `accion=crear` no crea registro |
Usar los stubs de `N/` de `@oracle/suitecloud-unit-testing` (ya en `devDependencies`) con `jest.mock` para el entry point.
Pruebas en sandbox (las ejecuta el equipo, documentarlas en el `.md`): catálogo por cada tipo; naturaleza existente no aparece; alta completa y artículo con esa naturaleza exige los campos; usuario en audiencia sin permisos sobre registros; re-despliegue deja la audiencia vacía.

## Despliegue (documentar en `SADS_SL_naturaleza_config.md`)
Iteración A (sandbox `Almetal_SB`):
1. `npm test` en verde (el hook de `suitecloud.config.js` lo ejecuta antes de desplegar).
2. Desplegar: lista de tipos → custom record modificado → rol → script y deployment, con `custscript_sads_sl_permitir_alta` = F.
3. Configurar la audiencia del deployment en la UI.
4. Revisar el catálogo de cada tipo, empezando por los 3 de Otro cargo (R-17; si fallan, inactivar esos 3 valores de la lista). Validar: columnas de Q-3 y `fieldtype`, `scriptid` en Q-2, tipos de registro supuestos, nivel de `LIST_ITEM` (VIEW o CREATE), necesidad de `ADMI_CUSTITEMFIELD`, comportamiento de `usuarioPuedeVerRegistro` bajo `runasrole`.
Iteración B:
5. Parámetro `custscript_sads_sl_permitir_alta` = T; re-aplicar audiencia.
6. Capturar a mano Nombre y Tipo de Artículo en los registros de configuración existentes.
7. Pruebas de alta.
Producción: mismo orden. Cada `project:deploy` deja la audiencia vacía; re-aplicarla.
Reversión: deployment a estado no liberado o inactivo. Los campos nuevos del registro no afectan al CS ni al UE.

## Formato de respuesta esperado
1. Lista de archivos creados o modificados.
2. Código completo por archivo, con encabezado JSDoc (`@NApiVersion`, `@NScriptType`, `@NModuleScope`) donde aplique, incluidos XML y pruebas.
3. Notas de desviación respecto del diseño, con justificación.
4. Checklist de P-01 a P-13 y P-19 indicando cuáles se cubrieron y resultado de `npm test`.
