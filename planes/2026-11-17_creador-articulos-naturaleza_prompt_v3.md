# Tarea: Creador de artículos por naturaleza — iteración B (espesores, familias, peso, conversión y descripciones)

Origen: `planes/2026-11-17_creador-articulos-naturaleza_plan_v5.md` (aprobado 2026-11-17).
Base de código: rama `claude/pensive-goldberg-r9d1tl`, commit `a5363ea` o posterior.
Prompts previos: `planes/2026-11-12_creador-articulos-naturaleza_prompt_v2.md` (iteración A). Este prompt lo complementa; no lo reemplaza en lo que no cambia.

## Rol
Eres un desarrollador senior de SuiteScript 2.1 para NetSuite y SuiteCloud Development Framework (SDF).
Implementas exactamente el diseño aprobado que sigue.
No cambies reglas de negocio ni IDs.
Si detectas una contradicción o un dato faltante, detente y repórtalo en lugar de suponer.
Todo dato marcado como "supuesto" queda aislado en una constante con nombre, para corregirlo en sandbox sin tocar reglas.

## Contexto
- Empresa: grupo industrial mexicano multi-subsidiaria (acero y hielo). NetSuite OneWorld. Giro: comercializadora de acero.
- Proyecto SDF Account Customization (`src/manifest.xml`). Sandbox: authId `Almetal_SB`.
- Pruebas: Jest 30 con `@oracle/suitecloud-unit-testing`; `npm test`; `suitecloud.config.js` corre Jest antes de `project:deploy`.
- Iteración A desplegada y probada en sandbox (2026-11-17):
  - Suitelet `SADS_SL_crear_articulo_nat.js`: paso 1 naturaleza (C-1); paso 2 un campo FLOAT/INTEGER por ID del JSON de la configuración + peso; creación copiando la plantilla (`record.copy`, modo estándar, una sola copia por solicitud); escribe naturaleza, parámetros, `weight`, `itemid`, `displayname`, `vendorname` = nombre, `upccode`/`mpn` vacíos, `isinactive` = negación de `custscript_sads_sl_art_activo`; duplicados C-2; confirmación.
  - UE `SADS_UE_naturaleza_config.js`: valida RN-12 a RN-17 del registro de configuración en CREATE/EDIT/XEDIT.
  - Dominio: `domain/SADS_naturaleza_config_formato.js` (no tocar), `domain/SADS_naturaleza_patron.js` (marcadores `{id}` y `{id:formato}` con `FORMATOS` `centesimas3` y `fraccion16`; `validar`, `validarFormatos`, `aplicar`, `formatearValor`), `domain/SADS_naturaleza_parametros.js` (`TIPOS_SOPORTADOS` float/integer, `validarIds`, `validarDefinicion`, `validarValores`, `armarCriteriosDuplicado`).
  - Adaptador `infra/SADS_naturaleza_articulo_ns.js` (`resolverTipoRegistroArticulo`, solo `N/search`): sin cambio.
  - Configuración de placas en la cuenta (id 1): JSON `["custitem_sads_nat_pla_lado_a","custitem_sads_nat_pla_lado_b","custitem_sads_nat_pla_espesor"]`, plantilla 10928.
- Problema de la iteración A: el artículo nuevo hereda de la plantilla familias, conversión y precios; el espesor es un número libre que no cubre calibres ni cédulas.
- Objetivo: espesor elegido de un catálogo; familia de precio y de margen según rango de espesor; peso y conversión capturados; descripciones = nombre. La cadena existente (campos fórmula + workflow) calcula el precio a partir de familia y conversión; no se toca.
- No modificar: `SADS_CS_item_dynamic_mandatory.js`, `SADS_UE_item_dynamic_mandatory.js`, `testt.js`, `domain/SADS_naturaleza_config_formato.js` y su prueba, `infra/SADS_naturaleza_articulo_ns.js`, `manifest.xml`, `deploy.xml`, los XML de CS/UE de artículo, del rol y de los campos `custitem_sads_nat_pla_*`.

## Entregables
| Acción | Archivo | Tipo | scriptid | Ruta |
|---|---|---|---|---|
| Nuevo | `customlist_sads_tipo_espesor.xml` | Lista | `customlist_sads_tipo_espesor` | `src/Objects/` |
| Nuevo | `customrecord_sads_espesor.xml` | Registro personalizado | `customrecord_sads_espesor` | `src/Objects/` |
| Nuevo | `custitem_sads_nat_espesor.xml` | Campo de artículo | `custitem_sads_nat_espesor` | `src/Objects/` |
| Nuevo | `customrecord_sads_nat_familia.xml` | Registro personalizado hijo | `customrecord_sads_nat_familia` | `src/Objects/` |
| Nuevo | `SADS_UE_nat_familia.js` | UserEvent 2.1 | `customscript_sads_ue_nat_familia` | `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/` |
| Nuevo | `customscript_sads_ue_nat_familia.xml` | Script y deployment | — | `src/Objects/` |
| Nuevo | `domain/SADS_naturaleza_familias.js` | Módulo AMD sin `N/` | — | carpeta del proyecto |
| Modificar | `customrecord_sads_naturaleza_productos.xml` | Agregar `custrecord_sads_naturaleza_tipo_esp` | — | `src/Objects/` |
| Modificar | `SADS_SL_crear_articulo_nat.js` | Suitelet | — | carpeta del proyecto |
| Modificar | `SADS_UE_naturaleza_config.js` | UserEvent | — | carpeta del proyecto |
| Modificar | `domain/SADS_naturaleza_patron.js`, `domain/SADS_naturaleza_parametros.js` | Dominio | — | carpeta del proyecto |
| Nuevo/Modificar | Pruebas Jest de cada archivo anterior | Jest | — | `__tests__/` |
| Modificar | `SADS_SL_crear_articulo_nat.md`, `README.md` | Documentación | — | — |

## Estructura de archivos
```
src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/
├── SADS_SL_crear_articulo_nat.js        (modificar)
├── SADS_UE_naturaleza_config.js         (modificar)
├── SADS_UE_nat_familia.js               (nuevo)
├── infra/SADS_naturaleza_articulo_ns.js (no tocar)
└── domain/
    ├── SADS_naturaleza_config_formato.js (no tocar)
    ├── SADS_naturaleza_patron.js         (modificar)
    ├── SADS_naturaleza_parametros.js     (modificar)
    └── SADS_naturaleza_familias.js       (nuevo)
__tests__/
├── SADS_naturaleza_familias.test.js     (nuevo)
├── SADS_UE_nat_familia.test.js          (nuevo)
└── (actualizar) patron, parametros, SL, UE de configuración
```
Convención plana existente; no crear `entrypoints/` ni `application/`.

## Arquitectura
- Nivel 1: reglas puras en `domain/` sin `N/`; los entry points conservan el acceso a `N/` en funciones locales con nombre; solo objetos planos cruzan a `domain/`.
- Dependencias: SL → `patron`, `parametros`, `familias`, `formato`, `infra/articulo_ns`. UE config → `patron`, `parametros`, `formato`, `infra/articulo_ns`. UE familia → `familias`, `formato`. `patron`, `parametros` y `familias` → `formato`.
- Errores de dominio nuevos: `familias.ERRORES = { FAMILIA_INVALIDA }`, creados con `formato.crearErrorDeDominio`. `formato.ERRORES` no cambia (su prueba exige 3 nombres).
- Patrones de diseño: ninguno.

| Caso de uso | Entrada | Salida | Reglas |
|---|---|---|---|
| Crear artículo de naturaleza | Configuración, parámetros, espesor, peso, conversión | Artículo, duplicado o errores | RN-01 a RN-17, RN3-01, RN3-02, RN3-04, RN3-07, RN3-09 a RN3-13 |
| Validar configuración | Registro de configuración | Guardado o error | RN-12 a RN-17, RN3-08, RN3-09 |
| Validar familia por rango | Registro de familia | Guardado o error | RN3-05, RN3-06 |

## Modelo de datos
### Existentes
| Registro | Campo | ID | Tipo | Estado |
|---|---|---|---|---|
| Artículo | Descripción de compra | `purchasedescription` | Texto largo | Supuesto S3-01 |
| Artículo | Descripción de venta | `salesdescription` | Texto largo | Supuesto S3-01 |
| Artículo | Peso informativo (kg) | `custitem_drt_ci_precio_teorico` | Decimal | Uso confirmado por el usuario; tipo supuesto S3-02 |
| Artículo | Peso | `weight` | Float | Verificado (iteración A) |
| Artículo | Conversión unidad de compra a base | `custitem_alm_articulo_conversionunidad` | Decimal | Dato del usuario; tipo supuesto S3-03 |
| Artículo | Familia de precio | `custitem_pfp_famprecios_` | SELECT a `customrecord_pfp_famprecios` | ID dato del usuario; tipo supuesto |
| Artículo | Familia de margen | `custitem_pfp_fammargenes_` | SELECT a `customrecord_pfp_fammargenes_` | ID dato del usuario; tipo supuesto |
| Familia de precios | — | `customrecord_pfp_famprecios` | Registro personalizado | Dato del usuario |
| Familia de márgenes | — | `customrecord_pfp_fammargenes_` | Registro personalizado | Dato del usuario |
Los IDs de familias terminan en guion bajo; copiarlos exactos.

### Nuevos
`customlist_sads_tipo_espesor` ("SADS - Tipo de Espesor"), valores con scriptid propio:
| scriptid del valor | Valor |
|---|---|
| `val_sads_tesp_fraccion` | Fracción de pulgada |
| `val_sads_tesp_calibre` | Calibre |
| `val_sads_tesp_mm` | Milímetros |
| `val_sads_tesp_cedula` | Cédula |

`customrecord_sads_espesor` ("SADS - Espesor"; `includename` T; `accesstype` CUSTRECORDENTRYPERM; mismo formato de XML que `customrecord_sads_naturaleza_productos.xml`):
| scriptid | Tipo | Obligatorio | Etiqueta | Regla |
|---|---|---|---|---|
| `name` | Texto | Sí | Nombre | Texto del select en el Suitelet, por ejemplo `1/2"`, `Cal 10`. |
| `custrecord_sads_esp_tipo` | SELECT a `[scriptid=customlist_sads_tipo_espesor]` | Sí | Tipo de Espesor | RN3-01 |
| `custrecord_sads_esp_texto` | TEXT, `maxlength` 30 | Sí | Texto para Nombre | Lo escribe `{id:texto}` (RN3-09). |
| `custrecord_sads_esp_codigo` | TEXT, `maxlength` 10 | Sí | Segmento para Código | Solo `A-Z` y `0-9`; lo escribe `{id:codigo}` (RN3-09). Único por tipo (RN3-03). |
| `custrecord_sads_esp_orden` | FLOAT, `minvalue` 0.0001 | Sí | Orden (grosor) | Grosor equivalente; define rangos. Único por tipo (RN3-03). Help: "Fracciones: pulgadas decimales (1/2 = 0.5). Milímetros: el número. Calibres: grosor nominal en mm. Cédulas: número de cédula." |
RN3-03 (unicidad de código y orden por tipo) se documenta para los técnicos; no requiere script en esta entrega.

`custitem_sads_nat_espesor` ("SADS Espesor"): SELECT a `[scriptid=customrecord_sads_espesor]`; `ismandatory` F; `appliestoinventory` T (los demás tipos de artículo F, igual que `custitem_sads_nat_pla_espesor.xml`); `subtab` ITEMMAIN; `storevalue` T.

`custrecord_sads_naturaleza_tipo_esp` en `customrecord_sads_naturaleza_productos.xml`: SELECT a `[scriptid=customlist_sads_tipo_espesor]`; `ismandatory` F; etiqueta "Tipo de Espesor"; descripción "Tipo de espesor que ofrece el Suitelet para esta naturaleza (RN3-01)."; resto de elementos iguales a `custrecord_sads_naturaleza_lista` salvo `onparentdelete` vacío.

`customrecord_sads_nat_familia` ("SADS - Familia por Espesor"; `includename` F; `accesstype` CUSTRECORDENTRYPERM; `allowinlineediting` T para editar desde la sublista del padre, supuesto S3-10):
| scriptid | Tipo | Obligatorio | Etiqueta | Regla |
|---|---|---|---|---|
| `custrecord_sads_natfam_config` | SELECT a `[scriptid=customrecord_sads_naturaleza_productos]`, `isparent` T, `onparentdelete` NO_ACTION | Sí | Configuración de Naturaleza | Padre; NetSuite la muestra como sublista de la configuración. |
| `custrecord_sads_natfam_desde` | SELECT a `[scriptid=customrecord_sads_espesor]` | No | Espesor Desde | RN3-05, RN3-06 |
| `custrecord_sads_natfam_hasta` | SELECT a `[scriptid=customrecord_sads_espesor]` | No | Espesor Hasta | RN3-05, RN3-06 |
| `custrecord_sads_natfam_precio` | SELECT a `[scriptid=customrecord_pfp_famprecios]` | Sí | Familia de Precio | Se escribe en `custitem_pfp_famprecios_` |
| `custrecord_sads_natfam_margen` | SELECT a `[scriptid=customrecord_pfp_fammargenes_]` | Sí | Familia de Margen | Se escribe en `custitem_pfp_fammargenes_` |
Si `customrecord_pfp_famprecios` o `customrecord_pfp_fammargenes_` no están en el proyecto, el `selectrecordtype` a un objeto fuera del proyecto puede fallar en `project:validate`; reportarlo y proponer `object:import` de esos registros en lugar de inventar su XML.

`customscript_sads_ue_nat_familia.xml`: nombre "SADS UE Validación Familia por Espesor"; deployment `customdeploy_sads_ue_nat_familia`; `recordtype` `[scriptid=customrecord_sads_nat_familia]`; RELEASED; `allroles` T; `allemployees` T; sin `runasrole`; `executioncontext` igual al de `customscript_sads_ue_naturaleza_config.xml`; `loglevel` AUDIT.

Longitudes de scriptid ≤ 40 caracteres en todos los casos.

### Ejemplo de datos (placas; IDs de espesor ficticios)
| Espesor | Texto | Código | Orden |
|---|---|---|---|
| 3/16" | 3/16'' | 018 | 0.1875 |
| 1/2" | 1/2'' | 050 | 0.5 |
| 5/8" | 5/8'' | 062 | 0.625 |
| 3/4" | 3/4'' | 075 | 0.75 |
| 1 1/2" | 1 1/2'' | 150 | 1.5 |

| Desde | Hasta | Familia de precio | Familia de margen |
|---|---|---|---|
| 3/16" | 5/8" | FAM68 | margen 1 |
| 3/4" | 1 1/2" | FAM069 | margen 2 |

Configuración de placas en v3:
| Campo | Valor |
|---|---|
| JSON | `["custitem_sads_nat_pla_lado_a","custitem_sads_nat_pla_lado_b","custitem_sads_nat_espesor"]` |
| Tipo de espesor | Fracción de pulgada |
| Patrón de código | `PLA36{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_pla_lado_a}{custitem_sads_nat_pla_lado_b}` |
| Patrón de nombre | `Placa Acero TA36 {custitem_sads_nat_espesor:texto} {custitem_sads_nat_pla_lado_a}'x{custitem_sads_nat_pla_lado_b}'` |
| Resultado con 1/2", 6, 20 | Código `PLA36050620`; nombre, descripción de compra y de venta `Placa Acero TA36 1/2'' 6'x20'`; familia FAM68 |

## Especificación por componente

### `domain/SADS_naturaleza_familias.js` (nuevo)
Sin `N/`. Importa `formato`. Exporta `ERRORES = { FAMILIA_INVALIDA }` (congelado).
Línea plana: `{id: string, desdeOrden: ?number, hastaOrden: ?number, desdeTipo: ?string, hastaTipo: ?string, familiaPrecioId: string, familiaMargenId: string, familiaPrecioNombre: string}`.
| Función | Entrada | Salida | Regla |
|---|---|---|---|
| `esUnica(linea)` | Línea | `boolean` | Sin desde ni hasta. |
| `validarLinea({linea, hermanas, tipoNaturaleza})` | Línea, demás líneas activas de la misma configuración, tipo de espesor de la naturaleza (`?string`) | `{valido, errores[]}`; no lanza | RN3-05: desde y hasta van juntos o ninguno; una línea única exige que no haya hermanas, y una línea con rango exige que ninguna hermana sea única. RN3-06: `desdeOrden ≤ hastaOrden`; desde y hasta del `tipoNaturaleza`; sin traslape con hermanas (inclusivo: [a,b] y [b,c] traslapan). RN3-07: si `tipoNaturaleza` es null, solo se permite línea única. Familias de precio y margen obligatorias. |
| `resolver({lineas, orden})` | Líneas activas; `orden` del espesor o null si la naturaleza no usa espesor | Línea | RN3-04: con `orden`, la única línea con `desdeOrden ≤ orden ≤ hastaOrden`, o la línea única si es la única línea. Sin `orden`, exige una sola línea y que sea única (RN3-07). Lanza `FAMILIA_INVALIDA` si no hay coincidencia o hay más de una; mensaje "No hay una familia de precios única para este espesor en la naturaleza." |

### `domain/SADS_naturaleza_patron.js` (modificar)
- `FORMATOS` agrega `CODIGO: 'codigo'` y `TEXTO: 'texto'`.
- `validar({patron, idsPermitidos, idsCatalogo})`: `idsCatalogo` (`string[]`, default `[]`) son los IDs de parámetros de catálogo (el espesor). RN3-09: un marcador de un ID de catálogo debe llevar formato `codigo` o `texto`; un marcador de otro ID no puede llevar `codigo` ni `texto`. Mensajes: "El marcador {<id>} es un catálogo y requiere el formato codigo o texto." y "El formato <formato> solo aplica al campo de espesor." (citar solo textos que cumplan `^[a-z0-9_]+$`).
- `aplicar({patron, valores, textos})`: `textos` = `{[id]: {codigo: string, texto: string}}`. `{id:codigo}` y `{id:texto}` escriben `textos[id].codigo` o `textos[id].texto` tal cual. Lanza `PATRON_INVALIDO` si falta `textos[id]` o el texto está vacío. El resto sin cambio.
- `validarFormatos`: ignora `codigo` y `texto`.
- Las pruebas existentes deben seguir pasando; actualizar solo la de llaves exportadas si cambia.

### `domain/SADS_naturaleza_parametros.js` (modificar)
- `TIPOS_SOPORTADOS` agrega `CATALOGO: 'catalogo'`.
- `validarDefinicion`: acepta tipo `catalogo`; error si hay más de un parámetro de catálogo ("La configuración admite un solo campo de espesor.").
- `validarValores({parametros, valoresCrudos, pesoCrudo, conversionCruda, opcionesCatalogo})`:
  - `opcionesCatalogo`: `string[]` de IDs internos permitidos para el parámetro de catálogo.
  - Parámetro `catalogo`: el valor crudo, tras `trim`, debe estar en `opcionesCatalogo`; si no, "<etiqueta>: elija un valor de la lista." (RN3-02). Se guarda en `valores[id]` como `Number`.
  - Conversión: misma regla que el peso (PT-04, mayor que 0); mensaje "Conversión unidad de compra a base: capture un número mayor que 0 con punto decimal, por ejemplo 0.25." (RN3-11).
  - Salida agrega `conversion: ?number`.
- `armarCriteriosDuplicado`: sin cambio (el ID del espesor es numérico).

### `SADS_SL_crear_articulo_nat.js` (modificar)
Constantes nuevas al inicio:
| Constante | Valor | Origen |
|---|---|---|
| `CAMPO_ESPESOR` | `custitem_sads_nat_espesor` | S3-06 |
| `CAMPOS_ARTICULO.PESO_INFORMATIVO` | `custitem_drt_ci_precio_teorico` | Usuario |
| `CAMPOS_ARTICULO.CONVERSION` | `custitem_alm_articulo_conversionunidad` | Usuario |
| `CAMPOS_ARTICULO.FAMILIA_PRECIO` | `custitem_pfp_famprecios_` | Usuario |
| `CAMPOS_ARTICULO.FAMILIA_MARGEN` | `custitem_pfp_fammargenes_` | Usuario |
| `CAMPOS_ARTICULO.DESCRIPCION_COMPRA` | `purchasedescription` | S3-01 |
| `CAMPOS_ARTICULO.DESCRIPCION_VENTA` | `salesdescription` | S3-01 |
| `CAMPOS_CONFIGURACION.TIPO_ESPESOR` | `custrecord_sads_naturaleza_tipo_esp` | Nuevo |
| `CAMPOS_FORMULARIO.CONVERSION` | `custpage_conversion` | Nuevo |
| `CAMPOS_FORMULARIO.ESPESOR_TEXTO`, `FAMILIA_TEXTO`, `CONVERSION_TEXTO` | `custpage_espesor_texto`, `custpage_familia_texto`, `custpage_conversion_texto` | Confirmación |

Preparación común (agregar a la existente, en este orden):
1. `leerConfiguracion` también lee `custrecord_sads_naturaleza_tipo_esp` (`lookupFields` devuelve arreglo para SELECT: tomar `[0].value` o null).
2. `describirParametros`: si el ID es `CAMPO_ESPESOR`, tipo = `catalogo` (sin depender de `Field.type`).
3. Si hay parámetro de catálogo: sin tipo de espesor → error de configuración "La naturaleza usa espesor pero no tiene tipo de espesor." (RN3-08); `cargarEspesores(tipoId)` (C-3); catálogo vacío → error de configuración "No hay espesores activos para el tipo de esta naturaleza.".
4. `cargarFamilias(configuracionId)` (C-4). Sin líneas → error de configuración "La naturaleza no tiene familias de precio configuradas.".

Paso 2:
1. Parámetro de catálogo: SELECT obligatorio con opción vacía; opciones de C-3 en orden de `orden`; texto = `name`; `isSelected` para el valor previo.
2. `custpage_peso`: sin cambio.
3. `custpage_conversion`: FLOAT obligatorio; etiqueta "Conversión unidad de compra a base"; valor previo si hay error.

Creación (después de `validarValores` y antes de `validarFormatos` de iteración A):
1. `validarValores` con `opcionesCatalogo` = IDs de C-3 y `conversionCruda`. Error: paso 2 con errores y valores previos.
2. Si hay espesor: buscar su fila en C-3 → `orden`, `texto`, `codigo`, `nombre`.
3. `familias.resolver({lineas: C-4, orden})` (orden null si la naturaleza no usa espesor). Error de dominio → página de error con su mensaje.
4. `patron.aplicar` con `textos = {[CAMPO_ESPESOR]: {codigo, texto}}`.
5. Duplicado C-2: sin cambio (incluye el ID del espesor como criterio).
6. `asignarValores` agrega, sobre la misma copia:
   | Campo | Valor | Regla |
   |---|---|---|
   | `custitem_drt_ci_precio_teorico` | Peso | RN3-10 |
   | `weight` | Peso | RN3-10 |
   | `custitem_alm_articulo_conversionunidad` | Conversión | RN3-11 |
   | `custitem_pfp_famprecios_` | `familiaPrecioId` de la línea | RN3-04 |
   | `custitem_pfp_fammargenes_` | `familiaMargenId` de la línea | RN3-04 |
   | `purchasedescription` | Nombre generado | RN3-12 |
   | `salesdescription` | Nombre generado | RN3-12 |
   El espesor se escribe como cualquier parámetro (`custitem_sads_nat_espesor` = ID).
7. `log.audit` de alta agrega espesor, familia de precio y conversión.
8. Confirmación agrega campos INLINE de espesor (nombre), familia de precio (nombre) y conversión.

Funciones nuevas:
| Función | Entrada | Salida | Responsabilidad |
|---|---|---|---|
| `cargarEspesores(tipoId)` | `string` | `{id, nombre, texto, codigo, orden}[]` | C-3 |
| `cargarFamilias(configuracionId)` | `string` | Líneas planas del dominio `familias` | C-4 |

Consultas (`query.runSuiteQL`, valores siempre como `?`):
| ID | Tabla | Campos | Filtros | Joins | Orden | Volumen |
|---|---|---|---|---|---|---|
| C-3 | `customrecord_sads_espesor` | `id`, `name`, `custrecord_sads_esp_texto`, `custrecord_sads_esp_codigo`, `custrecord_sads_esp_orden` | `isinactive = 'F'`; `custrecord_sads_esp_tipo = ?` | — | orden | Decenas |
| C-4 | `customrecord_sads_nat_familia` (alias f) | `f.id`, orden y tipo de desde y hasta, `f.custrecord_sads_natfam_precio`, `f.custrecord_sads_natfam_margen`, `BUILTIN.DF(f.custrecord_sads_natfam_precio)` | `f.isinactive = 'F'`; `f.custrecord_sads_natfam_config = ?` | LEFT JOIN `customrecord_sads_espesor` dos veces (desde y hasta) | orden desde | 1 a 5 |
Supuesto S3-11: columnas SuiteQL de los registros nuevos con los mismos nombres que su scriptid.

Gobernanza estimada: paso 2 ~51 unidades; creación ~81 (más el workflow existente, supuesto S3-05); límite 1,000. Sin caché ni optimización.

### `SADS_UE_naturaleza_config.js` (modificar)
1. Leer además `custrecord_sads_naturaleza_tipo_esp` con la misma regla XEDIT (PT-07).
2. RN3-08: si el JSON incluye `custitem_sads_nat_espesor` y no hay tipo de espesor: "La configuración usa espesor y requiere Tipo de Espesor."
3. RN3-09: `patron.validar` recibe `idsCatalogo` = `["custitem_sads_nat_espesor"]` si está en el JSON.
4. Familias: no se validan aquí (supuesto S3-07).
5. Mismo formato de error `CONFIGURACION_NATURALEZA_INVALIDA`.

### `SADS_UE_nat_familia.js` (nuevo)
Encabezado `@NApiVersion 2.1`, `@NScriptType UserEventScript`, `@NModuleScope SameAccount`. Módulos: `N/error`, `N/query`, `N/log`, `./domain/SADS_naturaleza_config_formato`, `./domain/SADS_naturaleza_familias`.
`beforeSubmit`:
1. Solo CREATE, EDIT y XEDIT.
2. Leer configuración, desde, hasta, familia de precio, familia de margen e inactivo; en XEDIT, campo no enviado → `oldRecord`.
3. Línea inactiva: terminar sin validar.
4. C-5: tipo de espesor de la configuración padre y demás líneas activas de la misma configuración (excluir el propio `id` en EDIT/XEDIT), con orden y tipo de desde y hasta (misma forma que C-4).
5. C-6: orden y tipo de los espesores desde y hasta de la propia línea.
6. `familias.validarLinea`.
7. Error: `error.create` `FAMILIA_NATURALEZA_INVALIDA`, mensaje "La familia por espesor no es válida: " + errores unidos por "; ", `notifyOff` T; sin `log.error`.
8. Error inesperado: `log.error` y relanzar.
Supuesto S3-09: el UE del hijo se ejecuta cuando la línea se guarda desde la sublista del padre. Si no, el Suitelet sigue protegido por `familias.resolver`.

### Reglas de negocio
Vigentes de iteración A: RN-01 a RN-17 (ver prompt v2 y `SADS_SL_crear_articulo_nat.md`).
Nuevas:
| ID | Regla |
|---|---|
| RN3-01 | El catálogo de espesores de una naturaleza son los espesores activos del tipo de espesor de su configuración; naturalezas del mismo tipo ven los mismos espesores. |
| RN3-02 | El espesor del artículo se elige del catálogo de su naturaleza; un ID fuera del catálogo se rechaza. |
| RN3-03 | En un mismo tipo, código y orden de espesor son únicos (responsabilidad de los técnicos en esta entrega). |
| RN3-04 | Familia de precio y de margen del artículo = las de la única línea cuyo rango contiene el orden del espesor (inclusivo). |
| RN3-05 | Una línea sin desde ni hasta es familia única y debe ser la única línea activa; desde y hasta van juntos o ninguno. |
| RN3-06 | Rangos sin traslape; desde ≤ hasta por orden; ambos del tipo de espesor de la naturaleza. |
| RN3-07 | Si la naturaleza no usa espesor, se exige una sola línea de familia única. |
| RN3-08 | Si el JSON incluye `custitem_sads_nat_espesor`, la configuración requiere tipo de espesor. |
| RN3-09 | `{id:codigo}` y `{id:texto}` escriben el código y el texto del espesor elegido; solo aplican al campo de espesor, y el campo de espesor solo admite esos formatos. |
| RN3-10 | El peso capturado (kg) se escribe en `custitem_drt_ci_precio_teorico` (informativo) y en `weight`. |
| RN3-11 | La conversión de unidad de compra a base es obligatoria y > 0; se escribe en `custitem_alm_articulo_conversionunidad`. |
| RN3-12 | `purchasedescription` y `salesdescription` = nombre generado (`displayname`). |
| RN3-13 | Ningún otro campo se escribe; el resto viene de la plantilla. |

## Restricciones técnicas
- SuiteScript 2.1; solo los módulos `N/` listados por archivo.
- `domain/` no importa `N/*`.
- Sin `?.`, `??` ni `console` (las pruebas de estructura existentes lo verifican).
- INLINEHTML solo con URL resuelta por NetSuite y texto fijo; texto de NetSuite escapado en etiquetas y avisos.
- Nombres de columna SuiteQL solo desde constantes o IDs validados; valores como `?`.
- JSDoc en funciones exportadas y del entry point.
- Sin datos reales confidenciales.
- Validar con `suitecloud project:validate` si hay cuenta; si no, decirlo.

## Criterios de aceptación
`npm test` en verde, sin cuenta NetSuite; ninguna prueba existente se elimina; las pruebas del SL y del UE de configuración se ajustan a los mocks nuevos (C-3, C-4, campo de tipo de espesor) sin bajar su cobertura.
| Caso | Capa | Entrada | Resultado esperado |
|---|---|---|---|
| P3-01 | familias | Orden 0.5; rangos [0.1875–0.625] y [0.75–1.5] | Primera línea |
| P3-02 | familias | Orden 0.625 y 0.75 | Línea 1 y línea 2 (extremos inclusivos) |
| P3-03 | familias | Orden 2.0 | `FAMILIA_INVALIDA` |
| P3-04 | familias | Línea única + otra línea | `validarLinea` inválido |
| P3-05 | familias | [0.25–0.5] y [0.5–0.75] | Traslape inválido |
| P3-06 | familias | Una sola línea única | `resolver` la devuelve para cualquier orden y para orden null |
| P3-07 | familias | desde con orden mayor que hasta; desde de otro tipo | Inválido |
| P3-08 | SL | Espesor fuera de C-3 | Paso 2 con "elija un valor de la lista"; `save` no llamado |
| P3-09 | patron | `{custitem_sads_nat_espesor:codigo}` y `:texto` con 1/2" | `050` y `1/2''`; código completo `PLA36050620` |
| P3-10 | SL | Alta válida de placa 1/2" × 6 × 20, peso 1225.5, conversión 1225.5 | `setValue` de espesor, peso en `weight` y `custitem_drt_ci_precio_teorico`, conversión, familias FAM68, `purchasedescription` y `salesdescription` = nombre; `save` llamado |
| P3-11 | SL | Conversión vacía, 0, negativa | Paso 2 con error; `save` no llamado |
| P3-13 | UE config | JSON con espesor sin tipo | `CONFIGURACION_NATURALEZA_INVALIDA` |
| P3-14 | UE familia | Línea traslapada; línea única con hermanas; tipo distinto | `FAMILIA_NATURALEZA_INVALIDA` |
| P3-16 | patron/UE config | `{custitem_sads_nat_espesor}` sin formato; `{custitem_sads_nat_pla_lado_a:codigo}` | Rechazo RN3-09 |
| P3-17 | SL | Naturaleza sin familias o sin espesores activos | Página de error de configuración |
| P3-18 | SL | Naturaleza sin espesor y una línea única | Familias de la línea asignadas |
| P3-19 | UE familia | XEDIT que solo cambia "hasta" | Valida con el resto de campos de `oldRecord` |
Regla de dependencia: prueba de que `domain/SADS_naturaleza_familias.js` no referencia módulos `N/`.
Pruebas en sandbox (las ejecuta el equipo; documentarlas):
| Caso | Resultado esperado |
|---|---|
| P3-12 | Alta de placa 1/2" × 6 × 20: el workflow calcula el precio base igual al de un artículo equivalente capturado a mano (R3-01). |
| P3-15 | Cotización con el artículo nuevo muestra el nombre como descripción. |

## Supuestos (constantes con nombre)
| ID | Supuesto |
|---|---|
| S3-01 | `purchasedescription` y `salesdescription` existen en `inventoryitem` y aceptan el nombre generado. |
| S3-02 | `custitem_drt_ci_precio_teorico` es decimal. |
| S3-03 | `custitem_alm_articulo_conversionunidad` es decimal. |
| S3-04 | Orden de calibres = grosor nominal en mm. |
| S3-05 | El workflow de precios se ejecuta en la creación desde Suitelet. |
| S3-06 | El parámetro de catálogo se identifica por el ID `custitem_sads_nat_espesor`. |
| S3-07 | El UE de configuración no ve las líneas del registro hijo. |
| S3-08 | La audiencia del Suitelet tiene VIEW sobre familias de precio y de margen. |
| S3-09 | El UE del registro hijo se ejecuta al guardar líneas desde la sublista del padre. |
| S3-10 | `allowinlineediting` T permite editar las líneas desde la sublista del padre. |
| S3-11 | Columnas SuiteQL de los registros nuevos con nombre igual a su scriptid. |

## Riesgos (documentar en el `.md`)
| ID | Enunciado | Consecuencia | Mitigación |
|---|---|---|---|
| R3-01 | El workflow de precios podría no ejecutarse cuando el artículo lo crea un script. | Artículo con el precio de la plantilla. | P3-12; revisar contexto del workflow; artículos inactivos hasta pasar P3-12. |
| R3-03 | Rangos que no cubren un espesor del catálogo. | El Suitelet rechaza ese espesor. | Mensaje claro; los técnicos cubren todo el catálogo. |
| R3-05 | Conversión capturada a mano. | Precio erróneo propagado por la cadena. | Validación > 0; confirmación muestra el valor; cálculo automático posterior (DA3-06). |
| R3-06 | Artículos de placa de iteración A usan `custitem_sads_nat_pla_espesor`. | La búsqueda de duplicados v3 no los detecta. | Inactivar o migrar antes de liberar. |
| R3-07 | Orden de calibres mal capturado. | Rangos invertidos. | Orden = grosor en mm. |
| R3-08 | El peso se rotula con la unidad de la plantilla, pero `custitem_drt_ci_precio_teorico` es en kg. | Si una plantilla usa otra unidad, el peso informativo queda en otra unidad. | Plantillas con unidad de peso kg; documentarlo en la guía técnica. |

## Despliegue (documentar en el `.md`)
1. `npm test` en verde; `project:deploy` a `Almetal_SB`.
2. Técnicos: capturar espesores (tipo Fracción de pulgada para placas) y las líneas de familias en la configuración de placas.
3. Actualizar la configuración de placas: JSON, tipo de espesor y patrones con `:codigo` y `:texto` (tabla de ejemplo).
4. Revisar que el workflow de precios se ejecute en creación desde script.
5. Inactivar o borrar los artículos de prueba de iteración A.
6. Ejecutar P3-12 y P3-15; con P3-12 aprobado, cambiar `custscript_sads_sl_art_activo` a T en el deployment (sin código).
7. Producción: después de sandbox; re-aplicar audiencia; capturar espesores y familias (los IDs internos difieren entre cuentas).
Reversión: configuración de placas con JSON y patrones de iteración A; inactivar `customdeploy_sads_ue_nat_familia`.

## Documentación
Actualizar `SADS_SL_crear_articulo_nat.md`: guía técnica (espesores, tipo de espesor, familias, formatos `codigo`/`texto`), campos del formulario, consultas C-3 a C-6, reglas RN3-01 a RN3-13, supuestos S3-01 a S3-11, riesgos, troubleshooting de mensajes nuevos, pruebas.
Actualizar `README.md`: objetos SDF nuevos, estructura de archivos, conteo de pruebas.

## Formato de respuesta esperado
1. Lista de archivos creados, modificados y eliminados.
2. Código completo por archivo, con JSDoc de encabezado donde aplique, incluidos XML y pruebas.
3. Notas de desviación respecto del diseño, con justificación.
4. Checklist P3-01 a P3-19 (sin P3-12 y P3-15) con resultado y salida resumida de `npm test`.
