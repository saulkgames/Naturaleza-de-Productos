# PTR rectangular (PTRR y MPPTRR): medida elegida de un mapa del proveedor

## Contexto
El código de PTR rectangular usa el número del catálogo del proveedor (R-302 → `PTRR302…`); no sale de una fórmula (59 de 60 medidas del CSV coinciden con el catálogo; 11222 se corrige a mano).
Decisión del usuario: en PTRR y MPPTRR la medida no se captura; se elige de un mapa. El registro elegido llena los lados del artículo y aporta el código para el patrón. El orden de lados deja de validarse.

## Objetos
| Objeto | Detalle |
|---|---|
| `customrecord_sads_mapa_medidas_ptrr` "SADS - Mapa de Medidas PTRR" | Campos: lado mayor y lado menor (FLOAT, pulgadas), código del proveedor (texto, `302`). Nombre visible = `3" x 2" (R-302)`. 25 instancias de la tabla del proveedor con scriptid `val_sads_medptrr_r<código>` (`val_sads_medptrr_r302`). |
| `custitem_sads_nat_ptr_lado_b` | Ya creado por el usuario; se descarga al proyecto. `custitem_sads_nat_ptr_lado` = lado mayor. |
| Configuración: campo nuevo `custrecord_sads_naturaleza_mapa_med` (checkbox "Usar mapa de medidas PTRR") | Solo PTRR y MPPTRR. |
| Espesor `val_sads_esp_ptr_e12` | 1/8", código `E12`, texto `1/8''`, orden 0.125 (DR-2). |
| Lista de naturalezas | `val_sads_natlist_ptrr` (existe) y `val_sads_natlist_mpptrr` (nuevo). |
| Configuraciones | `val_sads_nat_config_record_ptrr` (plantilla 11560) y `val_sads_nat_config_record_mpptrr` (plantilla 12679); JSON `["custitem_sads_nat_ptr_lado","custitem_sads_nat_ptr_lado_b","custitem_sads_nat_ptr_largo","custitem_sads_nat_espesor"]`; campo de medida = `custitem_sads_nat_ptr_lado`. |
| Familias | 5 líneas por configuración (tabla abajo); margen PTR y PTR Media Pieza (supuesto S5-01 para media pieza). |

## Comportamiento en el Suitelet
1. Con el mapa activo, el paso 2 muestra un SELECT obligatorio "Medida" con los registros activos del mapa (consulta C-8) en lugar de los dos campos de lado; largo y espesor se capturan igual.
2. El ID elegido se valida contra C-8. Del registro salen lado mayor → `custitem_sads_nat_ptr_lado`, lado menor → `custitem_sads_nat_ptr_lado_b` y el código.
3. Marcador reservado `{mapa:codigo}` en el patrón de código; el UE de configuración lo acepta solo con el mapa activo.
4. Nombre con los lados llenados: `PTR {custitem_sads_nat_ptr_lado:fraccion16}" x {custitem_sads_nat_ptr_lado_b:fraccion16}" {custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m`.
5. Familias por lado mayor; duplicados por los valores numéricos de los lados (C-2 sin cambio).
Ejemplo: Medida `3" x 2" (R-302)`, Cal.14, 6 m → `PTRR302C14` / `PTR 3" x 2" Cal.14 a 6.00m`.

Familias (del CSV; margen PTR):
| Espesor | Lado mayor | Familia |
|---|---|---|
| Cal.20–Cal.18 | todos | FAM 022 |
| Cal.16 | todos | FAM 098 |
| Cal.14–Cal.09 | 0.5–3 | FAM 023 |
| Cal.14–Cal.09 | 3.5–8 | FAM 024 |
| 3/16"–1/2" | todos | FAM 024 |
1/8" (orden 0.125) cae en Cal.14–Cal.09: con lado mayor ≤ 3 daría FAM 023; los artículos actuales de 1/8" son de 5" y 6" (FAM 024).

## Código
| Archivo | Cambio |
|---|---|
| `domain/SADS_naturaleza_patron.js` | Marcador reservado `{mapa:codigo}`. |
| `domain/SADS_naturaleza_parametros.js` | Valores de lados provistos por el mapa en lugar de captura. |
| `SADS_SL_crear_articulo_nat.js` | C-8, SELECT de medida, llenado de lados y código. |
| `SADS_UE_naturaleza_config.js` | Validación del marcador y del mapa. |
| Pruebas | Las 25 medidas del mapa contra el CSV; flujo PTRR/MPPTRR; familias contra el CSV; IDs portables. |
| Documentación | Sección 4F. |

## Verificación
`npm test` en verde; sandbox: `PTRR302C14` desde el mapa; un ID de medida manipulado se rechaza.
