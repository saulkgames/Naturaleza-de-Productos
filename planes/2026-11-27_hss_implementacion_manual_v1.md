# Plan de implementación manual: naturaleza HSS en producción — v1

## 0. Control
| Campo | Valor |
|---|---|
| Fecha | 2026-11-27 |
| Versión | v1 |
| Base | `planes/2026-11-26_hss_plan_v4.md`, `planes/2026-11-26_hss_prompt_v2.md` |
| Ambiente | Producción, sin sandbox ni deploy SDF |
| Objetivo | Implementar HSS creando los objetos en la interfaz y por importación CSV, sin que un deploy posterior con objetos desactualizados rompa producción |

## 1. Por qué el orden importa (hechos verificados en el repositorio)
| Hecho | Fuente | Implicación |
|---|---|---|
| "Naturaleza de Producto" del artículo selecciona el registro de configuración, no la lista. | `src/Objects/Config/custitem_sads_naturaleza_producto.xml:45` | El CSV de artículos se importa después de crear y activar la configuración HSS. |
| El User Event de artículo exige, en creación, edición e importación CSV, todos los campos del JSON de la configuración. | `SADS_UE_item_dynamic_mandatory.js:31-80`; contexto `CSVIMPORT` en su deployment | El CSV de alineación lleva los 4 parámetros en la misma fila. |
| Los campos de espesor y de PTR aplican solo a artículos de inventario. | XML de `custitem_sads_nat_espesor` y `custitem_sads_nat_ptr_*` | Una fila de un HSS que no sea inventario falla. |
| El User Event de configuración valida el patrón y que exista la plantilla. | `SADS_UE_naturaleza_config.js:93-101` | El formato `centesimas4` debe estar en producción antes de guardar la configuración HSS. |
| El Suitelet muestra solo configuraciones activas con plantilla. | `SADS_SL_crear_articulo_nat.js:136-140` | Crear la configuración inactiva la oculta a los usuarios hasta terminar. |
| `project:deploy` ejecuta Jest; la prueba de portabilidad rechaza scriptids propios de la forma `val_<n>_<cuenta>`. | `suitecloud.config.js`; `__tests__/SADS_objetos_portables.test.js:92` | Los objetos creados en la interfaz con scriptid generado bloquean el deploy hasta tratarlos en el repositorio. |
| Un deploy sobrescribe los JS del File Cabinet y las instancias que vienen en los XML. | `AGENTS.md` §10 | Si el repositorio no tiene `centesimas4` o trae XML viejos, un deploy rompe HSS o borra las familias de corte capturadas en la interfaz. |

## 1.1 Estado sincronizado de producción (commit `16d0b3e`, 2026-11-27)
| Hecho | Efecto en este plan |
|---|---|
| La lista de naturalezas ya tiene el valor "HSS" con scriptid generado `val_9238736_5490848_810`. | B.2 está hecho; no crear otro valor. La configuración usa "HSS" en "Naturalezas de Productos". Confirma que la interfaz asigna scriptids generados (R-M3). |
| La lista tiene un segundo valor "Placas de Acero" con scriptid `1` (numérico), además de `val_sads_natlist_pla36`. | Riesgo R-M8. No usarlo para HSS. |
| Placas de Acero tiene una 11.ª familia de corte, `customlist_familias_de_corte.val_9225208_5490848_865`, que no está en `src/Objects/Terceros/customlist_familias_de_corte.xml` ni en la prueba de portabilidad. | Se resuelve en la Fase D. |
| `npx jest`: 3 pruebas de `SADS_objetos_portables.test.js` fallan (672 de 675 aprobadas) por los tres puntos anteriores. | `project:deploy` ejecuta Jest y hoy queda bloqueado desde esta rama. Es una protección: no saltarla. Se corrige en la Fase D. |

## 2. Regla de seguridad
Queda prohibido ejecutar `suitecloud project:deploy` contra producción desde el inicio de la Fase A hasta cerrar la Fase D.
Registrar esta prohibición en el canal del equipo y en `README.md` §7.

## 3. Fase 0 — Respaldo y verificaciones previas
| # | Acción | Resultado esperado |
|---|---|---|
| 0.1 | Descargar del File Cabinet de producción `SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_patron.js` y `SADS_SL_crear_articulo_nat.js`. | Copias de respaldo fechadas. |
| 0.2 | Exportar los 72 HSS de la búsqueda 4978 agregando columnas: tipo de artículo, Nombre de proveedor (vendorname), Naturaleza de Producto, SADS PTR Lado Pulgadas, SADS PTR Lado Menor Pulgadas, SADS PTR Largo Metros, SADS Espesor. | Respaldo para revertir las importaciones. |
| 0.3 | Exportar la lista de registros SADS - Naturaleza de Productos, SADS - Espesor y las líneas de familia. | Respaldo de configuración. |
| 0.4 | Confirmar que el artículo 41233 está activo y es de inventario. | Plantilla válida. |
| 0.5 | Confirmar que los 71 HSS en alcance son de inventario. | Sin filas rechazadas en la Fase C. |
| 0.6 | Confirmar los scriptids `customrecord_pfp_famprecios.val_26690_5490848_sb1_301` (FAM 025), `customrecord_pfp_famprecios.val_26691_5490848_sb1_988` (FAM 026) y `customrecord_pfp_fammargenes_.val_5420301_5490848_458` (HSS). | Familias correctas. |
| 0.7 | Confirmar que existen en "Familias de Corte" los 70 valores `HSS <a>"x<b>"x<espesor>"` de los 71 artículos. | Familias de corte disponibles. |
| 0.8 | Revisar en el respaldo 0.2 el vendorname de 10717 y 41233. | Decidir si se corrige a mano (sección 8, R-M5). |

## 4. Fase A — Código (repositorio → File Cabinet de producción)
| # | Acción | Control |
|---|---|---|
| A.1 | Ejecutar `planes/2026-11-27_hss_prompt_v3.md` (solo código) en la rama de trabajo. | `npx jest` completo en verde; commit. |
| A.2 | Comparar cada respaldo de 0.1 contra la versión del repositorio anterior al cambio. | Si difieren en algo distinto de lo esperado, detenerse: producción tiene cambios que el repositorio no tiene. |
| A.3 | Reemplazar en el File Cabinet `domain/SADS_naturaleza_patron.js` con la versión nueva. | El formato nuevo es aditivo: no cambia los demás formatos. |
| A.4 | Reemplazar `SADS_SL_crear_articulo_nat.js` con la versión nueva. | Solo cambia `PARES_DE_LADOS`. |
| A.5 | Prueba de no regresión: abrir el Suitelet, elegir PTRC y PTRR, capturar y llegar a la confirmación. Guardar solo si se requiere un artículo real. | Mismo comportamiento que antes. |
Reversión: volver a subir los archivos de 0.1.

## 5. Fase B — Objetos en la interfaz de producción
| # | Objeto | Dónde | Valores |
|---|---|---|---|
| B.1 | Valor "Pared de HSS" | Personalización → Listas → SADS - Tipo de Espesor | Si la pantalla permite capturar el ID de script, usar `val_sads_tesp_hss`; si no, anotar el que asigne NetSuite. |
| B.2 | Valor "HSS" | Lista de naturalezas (`customlist_sads_naturaleza_productos`) | Ya existe en producción (`val_9238736_5490848_810`). Sin acción. |
| B.3 | 8 espesores | Configuración → Importar/Exportar → Importar registros CSV → Registros personalizados → SADS - Espesor; manejo "Agregar" | `docs/importacion/2026-11-27_hss_espesores.csv`. Mapear las 5 columnas por nombre. "Tipo de Espesor" se resuelve por nombre. |
| B.4 | Configuración HSS, marcada como inactiva | Nuevo registro SADS - Naturaleza de Productos | Tabla 5.1 |
| B.5 | 2 líneas de familia | Sublista de líneas de familia de la configuración | Tabla 5.2 |
| B.6 | Familias de corte | Campo "Familias de Corte" de la configuración | Los 70 valores de 0.7 |
| B.7 | Activar la configuración | Desmarcar "Inactivo" | Desde este momento HSS aparece en el Suitelet; seguir de inmediato con la Fase C. |

### 5.1 Configuración HSS
| Campo (etiqueta) | Valor |
|---|---|
| Nombre | Perfiles Estructurales Huecos (HSS) |
| Naturalezas de Productos | HSS |
| Configuración de Campos Obligatorios | `["custitem_sads_nat_ptr_lado","custitem_sads_nat_ptr_lado_b","custitem_sads_nat_ptr_largo","custitem_sads_nat_espesor"]` |
| Artículo Plantilla (ID interno) | 41233 |
| Patrón de Código | `HSS{custitem_sads_nat_ptr_lado:entero2}{custitem_sads_nat_ptr_lado_b:entero2}{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_ptr_largo:centesimas4}` |
| Patrón de Nombre | `HSS {custitem_sads_nat_ptr_lado}"x{custitem_sads_nat_ptr_lado_b}"x{custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m` |
| Tipo de Espesor | Pared de HSS |
| Campo de Medida para Familias | `custitem_sads_nat_ptr_lado` |
| Usar Mapa de Medidas PTRR | No |
| Parámetros para Valor de Unidades | `["custitem_sads_nat_ptr_largo"]` |
Si al guardar aparece "El formato centesimas4 … no existe", la Fase A no quedó aplicada.

### 5.2 Líneas de familia
| Línea | Espesor desde / hasta | Medida desde | Medida hasta | Familia de precio | Familia de margen |
|---|---|---|---|---|---|
| 1 | Vacío | 1 | 10 | FAM 025 - PTR HSS HASTA 10" | HSS |
| 2 | Vacío | 12 | 99 | FAM 026 - PTR HSS 12" EN ADELANTE | HSS |
Un lado A de 11" queda sin familia y el Suitelet lo rechaza.

## 6. Fase C — Artículos y validación
| # | Acción | Control |
|---|---|---|
| C.1 | Importar `docs/importacion/2026-11-27_hss_correccion_nombres.csv`, registro Artículo de inventario, manejo "Actualizar", clave ID interno. Mapear solo Nombre y Nombre para mostrar; no mapear las columnas "anterior". Probar primero con una fila. | 6 artículos actualizados. |
| C.2 | Importar `docs/importacion/2026-11-27_hss_alineacion_articulos.csv`, mismo manejo. Probar primero con una fila. "Naturaleza de Producto" y "SADS Espesor" se resuelven por nombre. | 71 artículos con naturaleza y parámetros. |
| C.3 | Después de la primera fila de cada importación, revisar el artículo: precios, familias y campos DRT sin cambios no deseados. | Sin efectos de otros User Events. |
| C.4 | Suitelet: crear 8"x4", 1/4", largo 6.1. | Código `HSS0804E250610`, nombre `HSS 8"x4"x1/4" a 6.10m`, FAM 025, margen HSS, valor de unidades 6.1, artículo inactivo. |
| C.5 | Suitelet: 16"x16", 1/2", largo 6.1. | Rechazo por duplicado: ya existe el 41233. |
| C.6 | Suitelet: lado A 4, lado B 6. | Rechazo por orden de lados. |
| C.7 | Revisar y activar el artículo de C.4; crear el resto de piezas de 6.10 m. | ~70 artículos nuevos. |
Reversión: inactivar la configuración HSS; reimportar el respaldo 0.2.

## 7. Fase D — Sincronizar el repositorio con producción
Cierra el riesgo de un deploy con objetos desactualizados.
| # | Acción | Control |
|---|---|---|
| D.1 | Con la CLI autenticada en producción, actualizar desde la cuenta (`suitecloud object:update` con instancias; confirmar la opción con `--help`) `customrecord_sads_naturaleza_productos`, `customrecord_sads_nat_familia`, `customrecord_sads_espesor`, `customlist_sads_naturaleza_productos` y `customlist_sads_tipo_espesor`. | El diff trae HSS y las familias de corte capturadas en la interfaz de todas las naturalezas. |
| D.2 | Resolver las fallas de portabilidad: scriptids generados (`val_9238736_5490848_810`, "Pared de HSS", espesores, configuración y líneas HSS), el valor numérico `1` de la lista y la familia de corte `val_9225208_5490848_865`. Opciones: excepción documentada en la prueba (SDF no renombra scriptids) y agregar la familia de corte a `Terceros/customlist_familias_de_corte.xml`. | Decisión registrada en README; `npx jest` verde; no forzar deploy. |
| D.3 | Agregar las 3 dependencias DRT a `src/manifest.xml` y a `__tests__/SADS_objetos_portables.test.js`. | Prueba verde. |
| D.4 | Agregar `__tests__/SADS_naturaleza_hss.test.js` que lea los XML sincronizados y verifique las 71 filas (tabla del prompt v2). | Prueba verde. |
| D.5 | Actualizar README (conteos, HSS, decisión del formato, fin de la prohibición de deploy) y AGENTS.md. | `npx jest` completo verde; commit. |
Solo después de D.5 se puede volver a desplegar con SDF.

## 8. Riesgos
| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-M1 | Deploy SDF antes de la Fase D. | Un deploy sobrescribe JS y las instancias de los XML (AGENTS.md §10). | Se pierde `centesimas4` o las familias de corte; HSS y otras naturalezas dejan de crear artículos. | Prohibición de la sección 2; Fase D. |
| R-M2 | Prueba directa en producción, sin sandbox. | Decisión operativa. | Un error afecta usuarios reales. | Configuración inactiva hasta B.7; importaciones con una fila de prueba; respaldos de la Fase 0; artículos nacen inactivos. |
| R-M3 | Objetos creados en la interfaz reciben scriptid generado. | La prueba de portabilidad rechaza `val_<n>_<cuenta>` (AD-18). | El deploy queda bloqueado por Jest hasta resolver D.2. | Capturar el ID de script planeado si la pantalla lo permite; si no, D.2. |
| R-M4 | La importación de artículos dispara User Events de terceros (`drt_item_ue`). | Script de terceros en la cuenta. | Cambios no previstos en precios o campos DRT. | Importar primero una fila y revisar (C.3). |
| R-M5 | vendorname de 10717 y 41233 puede conservar el código con `E050`. | D-19: vendorname guarda el código; su valor actual no está en el listado. | Búsquedas por proveedor con el código viejo. | Revisar en 0.8; corregir a mano si aplica. |
| R-M6 | El JS de producción puede diferir del repositorio. | El repositorio no registra el commit desplegado (README §7.2). | Reemplazar archivos revierte cambios de producción. | Comparación A.2 antes de subir. |
| R-M7 | La configuración queda activa sin familias de corte. | RN6-02. | El Suitelet no crea HSS. | B.6 antes de B.7. |
| R-M8 | La lista de naturalezas tiene dos valores "Placas de Acero" (scriptid `1` y `val_sads_natlist_pla36`). | XML sincronizado en `16d0b3e`. | Una configuración o reporte puede apuntar al valor equivocado; la prueba de portabilidad falla por el scriptid numérico. | Verificar en producción qué registros usan el valor `1`; si ninguno, inactivarlo (no borrar). |

## 9. Archivos de importación
| Archivo | Registro | Filas | Columnas |
|---|---|---|---|
| `docs/importacion/2026-11-27_hss_espesores.csv` | SADS - Espesor (Agregar) | 8 | Nombre, Tipo de Espesor, Texto para Nombre, Segmento para Código, Orden (grosor) |
| `docs/importacion/2026-11-27_hss_correccion_nombres.csv` | Artículo de inventario (Actualizar) | 6 | ID interno, Nombre, Nombre para mostrar, más 2 columnas de referencia que no se mapean |
| `docs/importacion/2026-11-27_hss_alineacion_articulos.csv` | Artículo de inventario (Actualizar) | 71 | ID interno, Naturaleza de Producto, SADS PTR Lado Pulgadas, SADS PTR Lado Menor Pulgadas, SADS PTR Largo Metros, SADS Espesor |
Codificación UTF-8, separador coma, comillas dobles escapadas (`"1/4"" - HSS"`).

## 10. Supuestos y fuentes
Supuestos:
1. Los 71 HSS son artículos de inventario (verificar en 0.5).
2. Los valores de "Familias de Corte" HSS existen (verificar en 0.7).
3. La interfaz asigna scriptids generados a los valores de lista: confirmado con el valor "HSS" (`val_9238736_5490848_810`). Se supone igual para instancias de registro personalizado.
4. Las etiquetas de los campos en la cuenta coinciden con las del repositorio; si no, mapear por la etiqueta real.
Fuentes: búsqueda guardada 4978 (2026-11-26); XML sincronizado de producción (commit `16d0b3e`); `npx jest` del 2026-11-27; plan v4; prompt v2; XML y scripts del repositorio citados en la sección 1.
Verificación de los CSV: generados con script desde la búsqueda 4978; 8, 6 y 71 filas; IDs únicos; 10671 excluido; los 71 códigos coinciden con la tabla del prompt v2.
Límite: ningún dato de la cuenta se verificó desde esta sesión (sin conector NetSuite).
