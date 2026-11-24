# Tarea: Creador de artículos por naturaleza de producto — iteración A

Origen: `planes/2026-11-12_creador-articulos-naturaleza_plan_v1.md` (aprobado 2026-11-13).
Alcance: iteración A del plan (creación sin cálculo de precios). El cálculo de precios es la iteración B y se especificará en un plan v2.

## Rol
Eres un desarrollador senior de SuiteScript 2.1 para NetSuite y SuiteCloud Development Framework (SDF).
Implementas exactamente el diseño aprobado que sigue.
No cambies reglas de negocio ni IDs.
Si detectas una contradicción o un dato faltante, detente y repórtalo en lugar de suponer.
Todo dato marcado como "supuesto" debe quedar aislado en una constante o función con nombre, para corregirlo en sandbox sin tocar reglas.

## Contexto
- Empresa: grupo industrial mexicano multi-subsidiaria (acero y hielo). NetSuite OneWorld. Giro de esta solución: comercializadora de acero (Almetal).
- Proyecto SDF de tipo Account Customization (`src/manifest.xml`). authId de sandbox: `Almetal_SB`.
- Pruebas: Jest 30 con `@oracle/suitecloud-unit-testing` (ya en `devDependencies`); `suitecloud.config.js` ejecuta Jest antes de `project:deploy`. Comando: `npm test`.
- Solución existente que se conserva:
  - Campo de artículo `custitem_sads_naturaleza_producto`: SELECT al registro `customrecord_sads_naturaleza_productos`; obligatorio.
  - El registro guarda en `custrecord_sads_naturaleza_config` (CLOBTEXT) un arreglo JSON de IDs de campo de artículo.
  - `SADS_CS_item_dynamic_mandatory.js` marca esos campos como obligatorios en pantalla.
  - `SADS_UE_item_dynamic_mandatory.js` (`beforeSubmit` CREATE/EDIT) bloquea el guardado con `MISSING_DYNAMIC_MANDATORY_FIELDS` si un ID del JSON viene vacío. Corre con `customrole_sads_naturaleza_config_exec`; su `executioncontext` incluye SUITELET. Deployments: INVENTORYITEM en RELEASED; NONINVENTORYITEM, OTHERCHARGEITEM, SERVICEITEM, KITITEM e ITEMGROUP en TESTING.
- Solución que se retira: Suitelet de alta de configuración `SADS_SL_naturaleza_config.js`. Su consulta de campos falló en sandbox (`Record 'customfield' was not found`) y el usuario descartó el método. Ahora los usuarios técnicos crean los registros de configuración y capturan el JSON a mano.
- Problema: dar de alta una medida nueva de placa obliga a capturar todo el formulario de artículo, aunque solo cambian medidas, nombre, código, precio y peso.
- Objetivo: un Suitelet donde un usuario con permiso elige la naturaleza, captura sus parámetros (placas: largo, ancho, espesor) y el peso; el script copia el artículo plantilla de la naturaleza y crea el artículo nuevo con nombre y código generados por patrón.
- Contrato de formato que no debe romperse: texto JSON que al parsear da un arreglo no vacío de cadenas; cada cadena es un ID de campo del artículo. Lo leen el CS y el UE existentes.
- No modificar: `SADS_CS_item_dynamic_mandatory.js`, `SADS_UE_item_dynamic_mandatory.js`, `testt.js`, `domain/SADS_naturaleza_config_formato.js`, `__tests__/SADS_naturaleza_config_formato.test.js`, `__tests__/sample-test.js`, `custitem_sads_naturaleza_producto.xml`, `customlist_sads_naturaleza_productos.xml`, `customscript_sads_cs_item_dynamic_mandat.xml`, `customscript_sads_ue_item_dynamic_mandat.xml`, `manifest.xml`, `deploy.xml`.

## Entregables
| Acción | Archivo | Tipo | scriptid | Ruta |
|---|---|---|---|---|
| Nuevo | `SADS_SL_crear_articulo_nat.js` | Suitelet 2.1 (entry point) | `customscript_sads_sl_crear_articulo_nat` | `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/` |
| Nuevo | `SADS_UE_naturaleza_config.js` | UserEvent 2.1 (entry point) | `customscript_sads_ue_naturaleza_config` | misma carpeta |
| Nuevo | `SADS_naturaleza_patron.js` | Módulo AMD sin `N/` | — | `.../domain/` |
| Nuevo | `SADS_naturaleza_parametros.js` | Módulo AMD sin `N/` | — | `.../domain/` |
| Nuevo | `customscript_sads_sl_crear_articulo_nat.xml` | Object XML (script, parámetro, deployment) | — | `src/Objects/` |
| Nuevo | `customscript_sads_ue_naturaleza_config.xml` | Object XML (script, deployment) | — | `src/Objects/` |
| Nuevo | `SADS_SL_crear_articulo_nat.md` | Documentación | — | carpeta del Suitelet |
| Nuevo | `SADS_naturaleza_patron.test.js`, `SADS_naturaleza_parametros.test.js`, `SADS_SL_crear_articulo_nat.test.js`, `SADS_UE_naturaleza_config.test.js` | Jest | — | `__tests__/` |
| Modificar | `customrecord_sads_naturaleza_productos.xml` | Object XML | — | `src/Objects/` |
| Modificar | `customrole_sads_naturaleza_config_exec.xml` | Object XML | — | `src/Objects/` |
| Modificar | `README.md` | Documentación | — | raíz |
| Eliminar | `SADS_SL_naturaleza_config.js`, `SADS_SL_naturaleza_config.md`, `domain/SADS_naturaleza_alta_reglas.js` | — | — | carpeta del proyecto |
| Eliminar | `customscript_sads_sl_naturaleza_config.xml`, `customlist_sads_tipos_articulo.xml` | — | — | `src/Objects/` |
| Eliminar | `SADS_SL_naturaleza_config.test.js`, `SADS_naturaleza_alta_reglas.test.js` | — | — | `__tests__/` |
Orden: leer primero `SADS_SL_naturaleza_config.js` y `__tests__/SADS_SL_naturaleza_config.test.js` para portar helpers y el patrón de mocks (PT-09); eliminar después.

## Estructura de archivos
```
src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/
├── SADS_CS_item_dynamic_mandatory.js          (no tocar)
├── SADS_UE_item_dynamic_mandatory.js          (no tocar)
├── SADS_SL_crear_articulo_nat.js              (nuevo)
├── SADS_SL_crear_articulo_nat.md              (nuevo)
├── SADS_UE_naturaleza_config.js               (nuevo)
├── testt.js                                   (no tocar)
└── domain/
    ├── SADS_naturaleza_config_formato.js      (no tocar)
    ├── SADS_naturaleza_patron.js              (nuevo)
    └── SADS_naturaleza_parametros.js          (nuevo)
src/Objects/
├── customrecord_sads_naturaleza_productos.xml       (modificar)
├── customrole_sads_naturaleza_config_exec.xml       (modificar)
├── customscript_sads_sl_crear_articulo_nat.xml      (nuevo)
└── customscript_sads_ue_naturaleza_config.xml       (nuevo)
__tests__/
├── SADS_naturaleza_config_formato.test.js     (no tocar)
├── SADS_naturaleza_patron.test.js             (nuevo)
├── SADS_naturaleza_parametros.test.js         (nuevo)
├── SADS_SL_crear_articulo_nat.test.js         (nuevo)
├── SADS_UE_naturaleza_config.test.js          (nuevo)
└── sample-test.js                             (no tocar)
```
Se conserva la convención plana existente; no crear `entrypoints/`.

## Arquitectura
- Nivel 1: reglas puras en `domain/` sin imports `N/`; los entry points conservan el acceso a `N/` en funciones locales con nombre.
- Dependencias: SL → `patron`, `parametros`, `formato`. UE → `patron`, `parametros`, `formato`. `patron` → `formato`. `parametros` → `formato`. Ningún módulo de `domain/` importa `N/*`.
- Datos que cruzan hacia `domain/`: solo objetos planos (nunca `record.Record`, `Field`, `ResultSet`, `request` ni `context`).
- Sin estado a nivel de módulo usado como caché.
- Patrones de diseño: ninguno.

| Caso de uso | Intención | Entrada | Salida | Reglas |
|---|---|---|---|---|
| Crear artículo de naturaleza | Dar de alta una medida nueva sin capturar el formulario completo | `configuracionId`, valores de parámetros, peso | ID y código del artículo; o errores; o artículo duplicado | RN-01 a RN-11 |
| Validar configuración | Impedir configuraciones que rompan CS, UE o el Suitelet | Registro de configuración en `beforeSubmit` | Guardado o error | RN-12 a RN-15 |

## Modelo de datos
### Existentes
| Registro | Campo | ID | Tipo | Estado |
|---|---|---|---|---|
| Config naturaleza | Nombre | `name` | Texto | Verificado (`includename` = T) |
| Config naturaleza | Naturaleza | `custrecord_sads_naturaleza_lista` | SELECT | Verificado |
| Config naturaleza | Configuración | `custrecord_sads_naturaleza_config` | CLOBTEXT | Verificado |
| Config naturaleza | Inactivo | `isinactive` | Checkbox | Supuesto S-01 (columna SuiteQL) |
| Artículo | Naturaleza | `custitem_sads_naturaleza_producto` | SELECT al registro de configuración | Verificado |
| Artículo | Código | `itemid` | Texto, obligatorio | Supuesto S-04 para `inventoryitem` |
| Artículo | Nombre para mostrar | `displayname` | Texto | Supuesto S-04 |
| Artículo | Peso | `weight` | Float | Supuesto S-04 |
| Artículo | Unidad de peso | `weightunit` | SELECT | Supuesto S-04; solo se lee su texto |
| Artículo | Inactivo | `isinactive` | Checkbox | Supuesto S-04 |
| Artículo | Parámetros | `custitem_*` que capturan los usuarios técnicos | Decimal o entero | Supuesto: no existen en el repo |

### Cambios a `customrecord_sads_naturaleza_productos.xml`
1. Agregar tres `customrecordcustomfield`. Elementos iguales a `custrecord_sads_naturaleza_lista`, salvo lo indicado:
   | scriptid | `fieldtype` | `selectrecordtype` | `label` | `ismandatory` | `description` |
   |---|---|---|---|---|---|
   | `custrecord_sads_naturaleza_plantilla` | SELECT | Tipo de registro Artículo (supuesto S-06) | Artículo Plantilla | F | Artículo que se copia al crear artículos de esta naturaleza. |
   | `custrecord_sads_naturaleza_patron_nom` | TEXT | vacío | Patrón de Nombre | F | Patrón del nombre para mostrar; marcadores {id_campo} de los IDs de la configuración. |
   | `custrecord_sads_naturaleza_patron_cod` | TEXT | vacío | Patrón de Código | F | Patrón del código (Item Name/Number); marcadores {id_campo} de los IDs de la configuración. |
   En los dos TEXT, `onparentdelete` vacío. S-06: confirma el valor de `selectrecordtype` para artículo con la documentación de SDF o importando un campo SELECT de artículo existente; si no puedes confirmarlo, detente y repórtalo.
2. Quitar el `customrecordcustomfield` `custrecord_sads_naturaleza_tipo_art`.
3. En `custrecord_sads_naturaleza_config`, reemplazar el ejemplo de `help` por uno que cumpla el contrato, con IDs ficticios: `["custitem_pl_ancho","custitem_pl_espesor","custitem_pl_largo"]`.
4. No cambiar `accesstype`, `includename` ni los demás elementos.

### Cambios a `customrole_sads_naturaleza_config_exec.xml`
Una sola permission: `LIST_CUSTRECORDENTRY` con `permlevel` VIEW. Quitar `ADMI_CUSTITEMFIELD` y `LIST_ITEM`. No cambiar nombre ni scriptid. Nunca usar ADMINISTRATOR.

### Nuevo `customscript_sads_sl_crear_articulo_nat.xml`
- `scriptfile`: `[/SuiteScripts/SADS_Naturaleza_Productos/SADS_SL_crear_articulo_nat.js]`.
- Nombre: "SADS SL Crear Artículo por Naturaleza". Descripción: crea artículos de una naturaleza copiando su plantilla.
- Parámetro `custscript_sads_sl_art_activo`: CHECKBOX, default F, etiqueta "Crear artículos activos", descripción "F: el artículo se crea inactivo (iteración A). T: se crea activo."
- Deployment `customdeploy_sads_sl_crear_articulo_nat`: `status` RELEASED; `isonline` F; sin `runasrole`; `allroles` F; `allemployees` F; `audslctrole` vacío (audiencia la configura el cliente); `loglevel` AUDIT; `title` "SADS - Crear Artículo por Naturaleza"; valor del parámetro F.

### Nuevo `customscript_sads_ue_naturaleza_config.xml`
- `scriptfile`: `[/SuiteScripts/SADS_Naturaleza_Productos/SADS_UE_naturaleza_config.js]`.
- Nombre: "SADS UE Validación Config Naturaleza".
- Deployment `customdeploy_sads_ue_naturaleza_config`: `recordtype` = el registro `customrecord_sads_naturaleza_productos` (referencia `[scriptid=customrecord_sads_naturaleza_productos]`, supuesto S-07); `status` RELEASED; `allroles` T; `allemployees` T; sin `runasrole`; `eventtype` vacío; `executioncontext` igual al de los deployments de `customscript_sads_ue_item_dynamic_mandat.xml`; `loglevel` AUDIT.

### Campos del formulario del Suitelet
| ID | Tipo | Paso | Uso |
|---|---|---|---|
| `custpage_configuracion` | SELECT (paso 1) / HIDDEN (paso 2) | 1 y 2 | ID del registro de configuración |
| `custpage_accion` | HIDDEN | 1 y 2 | `parametros` / `crear` |
| `custpage_naturaleza_texto` | TEXT INLINE | 2 | Nombre de la configuración |
| `custpage_par_<n>` | FLOAT o INTEGER según el tipo del campo | 2 | Valor del parámetro en la posición `n` del JSON (0, 1, 2, …) |
| `custpage_peso` | FLOAT | 2 | Peso manual |
| `custpage_enlace_*` | INLINEHTML | 2, confirmación, duplicado, error | Enlaces con URL resuelta por NetSuite y texto fijo |
Los campos de parámetro usan el índice del JSON, no el ID del `custitem`.

### Ejemplo de configuración (IDs ficticios)
| Campo | Valor |
|---|---|
| `custrecord_sads_naturaleza_config` | `["custitem_pl_ancho","custitem_pl_espesor","custitem_pl_largo"]` |
| `custrecord_sads_naturaleza_patron_cod` | `PL-{custitem_pl_espesor}-{custitem_pl_largo}X{custitem_pl_ancho}` |
| `custrecord_sads_naturaleza_patron_nom` | `PLACA A36 {custitem_pl_espesor} IN {custitem_pl_largo} X {custitem_pl_ancho} FT` |
| Resultado con espesor 0.25, largo 4, ancho 2 | Código `PL-0.25-4X2`; nombre `PLACA A36 0.25 IN 4 X 2 FT` |

## Especificación por componente

### `domain/SADS_naturaleza_patron.js`
Sin imports `N/`. Importa `formato`. Exporta `ERRORES = { PATRON_INVALIDO }` (congelado; valor igual a la llave) y crea sus errores con `formato.crearErrorDeDominio` (PT-03).
Marcador: `{` + ID + `}`; el ID no está vacío y no contiene llaves.
| Función | Entrada | Salida | Regla |
|---|---|---|---|
| `extraerMarcadores(patron)` | `string` | `string[]` | IDs en orden de primera aparición, sin duplicados. Lanza `PATRON_INVALIDO` si `patron` no es cadena, contiene `{}` o queda alguna llave fuera de un marcador (sin abrir o sin cerrar). |
| `validar({patron, idsPermitidos})` | `string`, `string[]` | `{valido, errores[]}` | RN-14, RN-15. Errores: patrón vacío tras `trim`; estructura inválida; cada marcador que no está en `idsPermitidos`. El mensaje cita el marcador solo si cumple `^[a-z0-9_]+$`. No lanza. |
| `aplicar({patron, valores})` | `string`, `{[id]: number}` | `string` | RN-06, RN-07. Sustituye cada ocurrencia de cada marcador por `formatearNumero(valor)`; recorta el resultado. Lanza `PATRON_INVALIDO` si falta un valor o el resultado queda vacío. Sustitución literal: sin `eval`, sin `Function` y sin construir expresiones regulares con texto del patrón. |
| `formatearNumero(numero)` | `number` | `string` | RN-07 y PT-05: `toFixed(6)`, luego quitar ceros finales y punto final (2.50 → `2.5`; 4 → `4`; 0.125 → `0.125`). Lanza `PATRON_INVALIDO` si no es número finito. |
Mensajes en español.

### `domain/SADS_naturaleza_parametros.js`
Sin imports `N/`. Importa `formato`. Exporta `ERRORES = { PARAMETRO_INVALIDO }` (congelado) y `TIPOS_SOPORTADOS` (congelado; valores `float` e `integer`, supuesto S-03 sobre los valores de `Field.type`).
| Función | Entrada | Salida | Regla |
|---|---|---|---|
| `esIdentificadorSeguro(id)` | `*` | `boolean` | `true` solo si es cadena y cumple `^[a-z0-9_]+$`. |
| `validarIds(ids)` | `string[]` | `{valido, errores[]}` | RN-13. Un ID inseguro se reporta por su posición (1, 2, …), sin reflejar su texto. No lanza. |
| `validarDefinicion(parametros)` | `{id, etiqueta, tipo}[]` | `{valido, errores[]}` | RN-03 y R-12: `tipo` null = el campo no existe en la plantilla ("El campo <id> no existe en el artículo plantilla."); tipo fuera de `TIPOS_SOPORTADOS` = "El campo <id> no es decimal ni entero." No lanza. |
| `validarValores({parametros, valoresCrudos, pesoCrudo})` | `{id, etiqueta, tipo}[]`, `*[]` alineado por índice, `*` | `{valido, errores[], valores: {[id]: number}, peso: ?number}` | RN-04, RN-05 y PT-04. Cada valor: cadena que tras `trim` cumple `^\d+(\.\d+)?$`, número finito mayor que 0; si `tipo` es `integer`, además entero. Peso: misma forma y mayor que 0. Mensajes citan la etiqueta, por ejemplo "Largo: capture un número mayor que 0 con punto decimal, por ejemplo 0.25." No lanza. |
| `armarCriteriosDuplicado({ids, valores})` | `string[]`, `{[id]: number}` | `{columna, valor}[]` | RN-08. Orden del JSON. Lanza `PARAMETRO_INVALIDO` si un ID no es seguro o falta su valor. |

### `SADS_SL_crear_articulo_nat.js`
Encabezado: `@NApiVersion 2.1`, `@NScriptType Suitelet`, `@NModuleScope SameAccount`.
Módulos: `N/ui/serverWidget`, `N/ui/message`, `N/search`, `N/query`, `N/record`, `N/runtime`, `N/url`, `N/log`, `./domain/SADS_naturaleza_config_formato`, `./domain/SADS_naturaleza_patron`, `./domain/SADS_naturaleza_parametros`.
IDs, textos SQL, mensajes y supuestos como constantes con nombre al inicio del archivo: `LONGITUD_MAXIMA_CODIGO` = 60 (S-14), columna `recordtype` (S-13), IDs de campos y `custpage_*`.

Despacho en `onRequest`:
- GET → paso 1.
- POST con `custpage_accion` = `parametros` → paso 2.
- POST con `custpage_accion` = `crear` → creación.
- Cualquier otro valor → paso 1.
- try/catch global igual al Suitelet retirado: error de dominio (`formato.esErrorDeDominio`) → página de error con su mensaje; cualquier otro error → `log.error` con detalle y mensaje genérico "No fue posible completar la operación. Contacte al administrador." Nunca mostrar el mensaje crudo de NetSuite.

Paso 1:
1. `cargarConfiguraciones()` (C-1).
2. Sin filas: aviso informativo "No hay naturalezas con artículo plantilla configurado." y sin botón Siguiente.
3. SELECT `custpage_configuracion` obligatorio con opción vacía inicial; texto = `name`; HIDDEN `custpage_accion` = `parametros`; botón "Siguiente".
4. Si viene de un error: valor previo seleccionado y aviso de error.

Preparación común (paso 2 y creación):
1. Leer `custpage_configuracion`; recalcular C-1; validar que sea entero positivo y esté en C-1 (RN-11). Si no: paso 1 con "La naturaleza seleccionada no es válida o ya no está disponible."
2. `leerConfiguracion(id)`; `formato.parsearConfiguracion` del JSON; `parametros.validarIds`. Si falta plantilla o algún patrón, o los IDs no son válidos: error de dominio con mensaje de configuración (defensa; el UE de configuración debería impedirlo).
3. `resolverTipoRegistroArticulo(plantillaId)` (PT-01).
4. `record.copy` de la plantilla en modo estándar (no dinámico, para no disparar sourcing sobre valores copiados). Una sola copia por solicitud (PT-02).
5. `describirParametros(copia, ids)`; `parametros.validarDefinicion`. Error: error de dominio con los mensajes.

Paso 2:
1. Preparación común.
2. Formulario: `custpage_naturaleza_texto` INLINE; HIDDEN `custpage_configuracion` y `custpage_accion` = `crear`; un campo `custpage_par_<n>` por parámetro (FLOAT o INTEGER según tipo), obligatorio, etiqueta = etiqueta del campo; `custpage_peso` FLOAT obligatorio con etiqueta "Peso (<texto de weightunit de la plantilla>)"; botón "Crear artículo"; enlace "Regresar" al paso 1.
3. Si viene de un error de validación: valores previos como `defaultValue` y aviso con los errores.
4. Texto que viene de NetSuite (etiquetas, nombres, unidades) se escapa con `escaparHtml` antes de usarse en etiquetas o avisos.

Creación:
1. Preparación común.
2. Leer `custpage_par_<n>` para `n` = 0 … número de parámetros − 1 y `custpage_peso`; `parametros.validarValores`. Error: paso 2 con errores y valores previos.
3. `patron.aplicar` del patrón de código y del de nombre. Si el código excede `LONGITUD_MAXIMA_CODIGO`: paso 2 con "El código generado excede 60 caracteres; revise el patrón de la naturaleza." (PT-06).
4. `parametros.armarCriteriosDuplicado`; `buscarDuplicado` (C-2). Si hay fila: página de duplicado; `log.audit` con el ID existente; no se guarda nada.
5. Sobre la misma copia: `custitem_sads_naturaleza_producto` = ID de la configuración; cada parámetro = su valor numérico; `weight` = peso; `itemid` = código; `displayname` = nombre; `isinactive` = negación de `leerCrearActivo()` (RN-10).
6. `save` con `ignoreMandatoryFields: false`.
7. `log.audit`: ID, código, ID de configuración, activo/inactivo.
8. Confirmación.

Página de duplicado: título del formulario; aviso informativo "Ya existe un artículo con esta naturaleza y estos parámetros."; código y estado (Activo/Inactivo) en campos INLINE; enlace "Ver artículo" (`url.resolveRecord` con el tipo de `resolverTipoRegistroArticulo` del artículo existente); enlace "Crear otro".
Confirmación: aviso de confirmación "El artículo se creó correctamente."; código, nombre y estado en campos INLINE; enlace "Ver artículo"; enlace "Crear otro".

Funciones del entry point:
| Función | Entrada | Salida | Responsabilidad |
|---|---|---|---|
| `onRequest(context)` | — | — | Despacho y manejo global de errores |
| `cargarConfiguraciones()` | — | `{id, nombre}[]` | C-1 |
| `leerConfiguracion(configuracionId)` | `string` | `{ids: string[], plantillaId: ?string, patronNombre: string, patronCodigo: string}` | `search.lookupFields` del registro de configuración |
| `resolverTipoRegistroArticulo(articuloId)` | `string` | `string` | PT-01: `search.lookupFields` sobre ITEM con la columna `recordtype` (S-13). Alternativa si falla en sandbox: búsqueda de ITEM por `internalid` y `result.recordType`. |
| `describirParametros(copia, ids)` | `record.Record`, `string[]` | `{id, etiqueta, tipo}[]` | `getField`; `tipo` null si el campo no existe |
| `buscarDuplicado(configuracionId, criterios)` | `string`, `{columna, valor}[]` | `{id, codigo, inactivo}` o null | C-2 |
| `asignarValores(copia, datos)` | `record.Record`, objeto plano | — | Paso 5 de la creación |
| `leerCrearActivo()` | — | `boolean` | `true` solo si el parámetro vale `true` o `'T'` |
| `construirPaso1` / `construirPaso2` / `construirConfirmacion` / `construirDuplicado` / `construirPaginaDeError` | objetos planos | `serverWidget.Form` | Solo presentación |

Consultas (`query.runSuiteQL`; todo valor variable como parámetro `?`):
| ID | Tabla | Campos | Filtros | Orden | Volumen |
|---|---|---|---|---|---|
| C-1 | `customrecord_sads_naturaleza_productos` | `id`, `name` | `isinactive = 'F'`; `custrecord_sads_naturaleza_plantilla` no nulo | `name` | Decenas |
| C-2 | `item` | `id`, `itemid`, `isinactive` | `custitem_sads_naturaleza_producto` = ID de configuración; por cada criterio, columna = valor; sin filtro de inactivos | `id` | 0 a 1 fila |
En C-2 cada nombre de columna se usa solo si pasa `parametros.esIdentificadorSeguro` y pertenece al JSON recalculado; si no, error (R-04). Supuesto S-02: las columnas `custitem_*` existen en la tabla `item`.

### `SADS_UE_naturaleza_config.js`
Encabezado: `@NApiVersion 2.1`, `@NScriptType UserEventScript`, `@NModuleScope SameAccount`.
Módulos: `N/error`, `N/log`, `./domain/SADS_naturaleza_config_formato`, `./domain/SADS_naturaleza_patron`, `./domain/SADS_naturaleza_parametros`.
`beforeSubmit`:
1. Solo CREATE, EDIT y XEDIT; otros tipos terminan sin hacer nada.
2. Leer JSON, plantilla y patrones. En XEDIT, un campo presente en `newRecord.getFields()` se lee de `newRecord`; si no, de `oldRecord` (PT-07).
3. RN-12: `formato.parsearConfiguracion`; si lanza, error con su mensaje y no se evalúan RN-13 a RN-15.
4. RN-13: `parametros.validarIds`.
5. RN-14: si hay plantilla, ambos patrones son obligatorios.
6. RN-15: con plantilla, `patron.validar` de cada patrón contra los IDs del JSON.
7. Patrones sin plantilla: se permiten sin validar.
8. Con errores: `error.create` con `name` `CONFIGURACION_NATURALEZA_INVALIDA`, mensaje "La configuración no es válida: " más los errores unidos por "; ", `notifyOff` true. Sin `log.error` para estos errores.
9. Error inesperado (no de dominio): `log.error` con detalle y relanzar.

### Reglas de negocio
| ID | Regla |
|---|---|
| RN-01 | El paso 1 ofrece solo registros de configuración activos con plantilla asignada. |
| RN-02 | Los parámetros de una naturaleza son los IDs del JSON de su configuración, en el orden del JSON. |
| RN-03 | Cada parámetro es obligatorio y su campo debe ser decimal o entero; otro tipo es error de configuración. |
| RN-04 | Cada valor de parámetro es un número finito mayor que 0, con punto decimal; no se aceptan comas ni texto. El mínimo de 2 pies de largo y ancho lo impone el `minvalue` del `custitem` (supuesto S-08). |
| RN-05 | El peso es obligatorio, numérico y mayor que 0; la unidad de peso se copia de la plantilla. |
| RN-06 | Código = patrón de código con cada `{id}` sustituido por el valor del parámetro; nombre = patrón de nombre igual. Se recorta el resultado; vacío es error. |
| RN-07 | Formato numérico en patrones: sin ceros a la derecha ni punto final (2.50 → 2.5; 4.0 → 4); punto decimal. |
| RN-08 | Si existe un artículo, activo o inactivo, con la misma naturaleza y valores iguales en todos los parámetros, no se crea y se muestra el existente. |
| RN-09 | El artículo nuevo es copia de la plantilla; el script solo escribe naturaleza, parámetros, peso, código, nombre, estado inactivo y (iteración B) precios. |
| RN-10 | Con `custscript_sads_sl_art_activo` = F el artículo se crea inactivo; con T, activo. |
| RN-11 | Naturaleza, configuración, parámetros y plantilla se recalculan en cada POST; del formulario solo se toman el ID de configuración (entero validado contra C-1) y los valores capturados. |
| RN-12 | El JSON de configuración cumple el contrato de `formato.parsearConfiguracion`. |
| RN-13 | Cada ID del JSON cumple `^[a-z0-9_]+$`. |
| RN-14 | Si la configuración tiene plantilla, los dos patrones son obligatorios. |
| RN-15 | Cada marcador de un patrón es un ID del JSON; llaves sin cerrar o vacías son error. |
Unidades: largo y ancho en pies; espesor en pulgadas; el script no convierte unidades. Los valores se guardan como se capturan.

## Precisiones respecto del plan v1
No cambian reglas de negocio; resuelven detalles de implementación.
| ID | Precisión | Motivo |
|---|---|---|
| PT-01 | `resolverTipoRegistroArticulo` con `search.lookupFields` sobre ITEM y columna `recordtype` (S-13); alternativa: búsqueda por `internalid` y `result.recordType`. Se usa para la plantilla y para el enlace del duplicado. | `record.copy` y `url.resolveRecord` exigen el tipo de registro; la configuración solo guarda el ID. |
| PT-02 | Una sola copia por solicitud: se describe, se valida y, en la creación, se guarda la misma. | Ahorra un `record.copy`. |
| PT-03 | `PATRON_INVALIDO` y `PARAMETRO_INVALIDO` se declaran en sus módulos y se crean con `formato.crearErrorDeDominio`. | La prueba existente exige que `formato.ERRORES` tenga exactamente 3 nombres. |
| PT-04 | Captura numérica con `^\d+(\.\d+)?$` tras `trim`; si el campo es entero, el valor debe ser entero. | Precisa RN-04. |
| PT-05 | `formatearNumero`: `toFixed(6)`, sin ceros finales ni punto final. | Precisa RN-07; evita notación exponencial. |
| PT-06 | Longitud de `itemid` contra `LONGITUD_MAXIMA_CODIGO` = 60 (S-14). | Mensaje claro en lugar del error genérico de `save`. |
| PT-07 | UE en XEDIT: campo en `newRecord.getFields()` → `newRecord`; si no → `oldRecord`. | Validar el estado final. |
| PT-08 | No crear `domain/SADS_naturaleza_calculo_precios.js`. | Iteración B, plan v2. |
| PT-09 | Portar del Suitelet retirado `aCadena`, `escaparHtml`, `describirError`, `agregarAviso`, `agregarCampoOculto`, `agregarTextoDeSoloLectura`, `agregarEnlace`, `urlDelSuitelet`, `urlDelSuiteletOmitible`, `registrarError` y `mensajeParaUsuario` antes de eliminarlo. | Reutilizar código ya probado. |

## Restricciones técnicas
- SuiteScript 2.1; solo los módulos `N/` listados por archivo.
- Gobernanza (límite 1,000 por ejecución; costos de `record.copy` y `save` de artículo: supuesto S-05):
  | Solicitud | Operaciones | Estimado |
  |---|---|---|
  | Paso 1 | C-1 | ~10 |
  | Paso 2 | C-1 + 2 `lookupFields` + `record.copy` | ~22 |
  | Creación | Paso 2 + C-2 + `save` | ~52 |
  | Duplicado | Paso 2 + C-2 + `lookupFields` | ~33 |
  No optimizar ni agregar caché.
- Contextos: Suitelet solo UI; UE de configuración en todos los contextos del deployment.
- Regla de dependencia: `domain/` no importa `N/*`.
- Entry points con funciones pequeñas; las decisiones de negocio viven en `domain/`.
- Sin INLINEHTML con datos del usuario ni de registros; solo URL resueltas por NetSuite (escapadas) y texto fijo.
- Nombres de columna SQL solo desde IDs validados (R-04); valores siempre como parámetros.
- No modificar `domain/SADS_naturaleza_config_formato.js` ni su prueba.
- JSDoc en funciones exportadas y en las funciones del entry point. Sin comentarios que narren el código.
- Sin datos reales confidenciales (RFC, cuentas, saldos, clientes).
- Validar el proyecto con `suitecloud project:validate` si hay cuenta disponible; si no, decirlo en la respuesta.

## Criterios de aceptación
`npm test` en verde, sin cuenta NetSuite. Las pruebas existentes de `formato` siguen pasando sin cambios.
Mocks: `jest.mock` de cada módulo `N/` con el patrón de `__tests__/SADS_SL_naturaleza_config.test.js` (leerlo antes de eliminarlo); `N/search.lookupFields`, `N/query.runSuiteQL` y `N/record.copy` como `jest.fn`; la copia como objeto falso con `getField`, `getText`, `setValue` y `save`.
| Caso | Capa | Entrada | Resultado esperado |
|---|---|---|---|
| P-01 | patrón | Patrón de código del ejemplo con espesor 0.25, largo 4, ancho 2 | `PL-0.25-4X2` |
| P-02 | patrón | 2.50, 4.0, 0.125 | `2.5`, `4`, `0.125` |
| P-03 | patrón | `{custitem_x`, `{}`, marcador fuera del JSON | Error `PATRON_INVALIDO` / `valido` false |
| P-04 | patrón | Patrón que produce solo espacios | Error `PATRON_INVALIDO` |
| P-05 | parámetros | `custitem_a`, `custitem-a`, `custitem_a; drop`, `CUSTITEM_A` | Solo el primero es seguro |
| P-06 | parámetros | `"4"`, `"4.5"`, `"4,5"`, `"abc"`, `"0"`, `"-1"`, `""`, `"Infinity"` | Válidos solo los dos primeros |
| P-07 | parámetros | Peso vacío, 0, negativo, válido | Error en los tres primeros |
| P-08 | parámetros | IDs y valores | Criterios en orden del JSON |
| P-09 | SL | C-1 sin filas | Paso 1 con aviso, sin botón |
| P-10 | SL | `custpage_configuracion` no entero o fuera de C-1 | Paso 1 con error |
| P-11 | SL | C-2 devuelve un artículo | Página de duplicado; `save` no llamado |
| P-12 | SL | Parámetro de tipo texto o ausente en la copia | Página de error de configuración |
| P-13 | SL | Alta válida con parámetro F | `setValue` de naturaleza, parámetros, `weight`, `itemid`, `displayname` e `isinactive` T; `save` llamado; confirmación |
| P-16 | SL | `save` lanza error | Mensaje genérico; el texto del error no aparece en la página; `log.error` llamado |
| P-17 | UE config | JSON inválido; ID inseguro; plantilla sin patrones; marcador fuera del JSON; configuración válida | Error `CONFIGURACION_NATURALEZA_INVALIDA` en los cuatro primeros; sin error en el último |
| P-18 | UE config | XEDIT que solo cambia el patrón | Valida contra el JSON de `oldRecord` |
Agregar además, para cada módulo nuevo de `domain/`, una prueba de regla de dependencia (el archivo no referencia módulos `N/`), igual a la de `SADS_naturaleza_config_formato.test.js`.
Pruebas en sandbox (las ejecuta el equipo; documentarlas en el `.md`):
| Caso | Entrada | Resultado esperado |
|---|---|---|
| P-14 | Alta de una placa | Cuentas, impuestos, claves SAT, subsidiarias y unidades iguales a la plantilla |
| P-15 | Largo 1.5 con `minvalue` 2 en el campo | `save` rechaza; mensaje genérico; confirma S-08 |
| P-19 | Usuario en audiencia sin `LIST_ITEM` CREATE | No crea; mensaje genérico |
| P-20 | Re-despliegue | Audiencia vacía; se re-aplica |
| P-21 | Artículo creado abierto en la UI | El CS marca los parámetros como obligatorios |

## Documentación
`SADS_SL_crear_articulo_nat.md`, con el estilo del `.md` del Suitelet retirado: resumen; arquitectura (Mermaid); flujo; guía para usuarios técnicos (crear `custitem` de parámetros con `minvalue`, capturar JSON, plantilla y patrones, ejemplo ficticio, recomendación de incluir todos los parámetros en el patrón de código); campos del formulario; consultas C-1 y C-2 descritas; reglas RN-01 a RN-15; rol y permisos; despliegue; supuestos S-01 a S-14; riesgos R-01 a R-12; troubleshooting; bitácora; pruebas.
`README.md`: actualizar resumen, arquitectura, objetos SDF, estructura de archivos, pruebas, despliegue y documentación a la solución nueva; quitar referencias al Suitelet de alta y a la lista de tipos; conservar la licencia.

Supuestos a listar:
| ID | Supuesto |
|---|---|
| S-01 | Columnas SuiteQL `id`, `name`, `isinactive` y `custrecord_sads_naturaleza_plantilla` del registro de configuración. |
| S-02 | Columnas `custitem_*` disponibles en la tabla `item` de SuiteQL. |
| S-03 | `getField` de la copia expone etiqueta y tipo; valores `float` e `integer` de `Field.type`. |
| S-04 | IDs `itemid`, `displayname`, `weight`, `weightunit`, `isinactive` válidos en `inventoryitem`. |
| S-05 | Costos de gobernanza de `record.copy` y `save` del artículo. |
| S-06 | `selectrecordtype` de artículo para un SELECT de registro personalizado en SDF. |
| S-07 | Referencia del registro personalizado en `recordtype` del deployment del UE. |
| S-08 | `minvalue` del `custitem` se aplica en `save` desde script. |
| S-09 | NetSuite rechaza un `itemid` repetido. |
| S-10 | SDF no borra campos ni listas retirados del proyecto. |
| S-11 | `record.copy` funciona con una plantilla inactiva. |
| S-12 | La localización usa `weight` del artículo para Carta Porte (validar con fiscal). |
| S-13 | Columna `recordtype` en `search.lookupFields` sobre ITEM. |
| S-14 | Longitud máxima de `itemid` de 60 caracteres. |

Riesgos a listar:
| ID | Enunciado | Consecuencia | Mitigación |
|---|---|---|---|
| R-01 | El artículo nuevo hereda las claves SAT de la plantilla (`ClaveProdServ`, `ClaveUnidad`; Anexo 20 CFDI 4.0). | Una clave errónea se replica en cada artículo y en los CFDI que lo facturen. | Revisión fiscal de cada plantilla; P-14. |
| R-02 | En iteración A el artículo conserva los precios de la plantilla. | Venta a precio de otra medida. | Crear inactivo (RN-10); no liberar a producción antes de B. |
| R-03 | Dos usuarios crean la misma medida a la vez. | Duplicado si el código difiere. | Patrón de código con todos los parámetros; unicidad de `itemid` (S-09). |
| R-04 | Los nombres de columna de C-2 vienen del JSON capturado a mano. | Inyección SuiteQL. | RN-13 en el UE y validación repetida en el Suitelet. |
| R-05 | El espesor aparece como decimal (0.25 y no 1/4"). | Nombre poco familiar para ventas. | Cambio aislado en `patron.formatearNumero`. |
| R-06 | Peso capturado a mano. | Peso erróneo en el artículo y, si aplica, en Carta Porte (S-12). | Validación > 0; cálculo automático posterior. |
| R-07 | El mínimo de 2 pies depende de `minvalue` del `custitem` (S-08). | Medidas menores a 2 pies si no se aplica. | P-15; si falla, mínimos en la configuración en plan v2. |
| R-08 | El campo retirado `custrecord_sads_naturaleza_tipo_art` sigue en la cuenta como obligatorio (S-10). | Usuarios técnicos obligados a capturarlo. | Paso manual 3 de despliegue. |
| R-09 | Registros de configuración existentes sin plantilla. | No aparecen en el paso 1; CS/UE siguen funcionando. | Comportamiento esperado. |
| R-10 | `project:deploy` vacía la audiencia del Suitelet. | Usuarios sin acceso. | Re-aplicar audiencia. |
| R-11 | La plantilla puede ser de un tipo cuyo deployment del UE de artículo está en TESTING. | El UE no valida para otros usuarios. | El Suitelet valida RN-03 a RN-05 antes de guardar. |
| R-12 | Un parámetro no aplica al tipo de la plantilla. | El campo no existe en la copia. | Error de configuración con el ID del campo (P-12). |

## Despliegue (documentar en `SADS_SL_crear_articulo_nat.md`)
Iteración A (sandbox `Almetal_SB`):
1. `npm install` y `npm test` en verde.
2. `project:deploy`: registro de configuración modificado, rol reducido, Suitelet y UE nuevos con sus deployments, `custscript_sads_sl_art_activo` = F.
3. En la cuenta: inactivar el script `customscript_sads_sl_naturaleza_config` y su deployment; borrar o inactivar `custrecord_sads_naturaleza_tipo_art` y `customlist_sads_tipos_articulo` (S-10).
4. Usuarios técnicos: crear los `custitem` de parámetros de placa (largo y ancho con `minvalue` 2), definir la plantilla y capturar JSON, plantilla y patrones en el registro de configuración.
5. Configurar la audiencia del Suitelet (roles con `LIST_ITEM` CREATE y `LIST_CUSTRECORDENTRY` VIEW).
6. Ejecutar P-14, P-15, P-19, P-20 y P-21; confirmar S-01 a S-14.
Iteración B (fuera de este prompt): importar a SDF los campos fórmula de precios; plan v2; cálculo de precios; `custscript_sads_sl_art_activo` = T.
Producción: solo después de la iteración B; re-aplicar la audiencia después de cada despliegue.
Reversión: deployment del Suitelet a inactivo; los artículos creados se inactivan a mano; el UE de configuración se puede inactivar sin afectar al CS ni al UE de artículo.

## Formato de respuesta esperado
1. Lista de archivos creados, modificados y eliminados.
2. Código completo por archivo, con encabezado JSDoc (`@NApiVersion`, `@NScriptType`, `@NModuleScope`) donde aplique, incluidos XML y pruebas.
3. Notas de desviación respecto del diseño, con justificación.
4. Checklist de P-01 a P-13 y P-16 a P-18 con resultado, y salida resumida de `npm test`.
