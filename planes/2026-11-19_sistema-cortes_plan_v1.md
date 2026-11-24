# Artículos listos para el Sistema de Cortes

## Contexto
El Sistema de Cortes valida y compara artículos con 5 campos. Los artículos creados por el Suitelet de naturalezas deben salir con esos campos llenos para poder cortarse (por ejemplo, 4'x10' Cal.20 → dos de 4'x5').
Decisiones del usuario: la familia de corte la elige el usuario en el paso 2, de las familias que el usuario técnico marcó para la naturaleza; el valor de unidades es el producto de parámetros definidos en la naturaleza; el espesor se escribe con cero a la izquierda (0.0478).

## Campos del artículo
| Campo | Valor | Origen |
|---|---|---|
| `custitem_alm_corte` (Disponible para corte) | T | Fijo |
| `usebins` (Utilizar depósitos) | T | Fijo |
| `custitem_value_per_units` (Valor de unidades) | Producto de los parámetros de la naturaleza | Placas y LNE: lado A × lado B (4×10 = 40); PTRC, MPPTRC, PTRR, MPPTRR: largo en m (6, 3, 1) |
| `custitemalm_articulo_espesor` (texto) | Orden del espesor elegido, decimal con cero y sin ceros finales: `0.0478`, `0.5`, `1` | Registro SADS - Espesor; `patron.formatearNumero` |
| `custitem_famili_de_corte_item` | Valor elegido en el paso 2 | `customlist_familias_de_corte` |

## Objetos
| Objeto | Cambio |
|---|---|
| `customrecord_sads_naturaleza_productos` | Campo `custrecord_sads_naturaleza_fam_corte` (MULTISELECT a `customlist_familias_de_corte`, "Familias de Corte"). Campo `custrecord_sads_naturaleza_valor_unid` (TEXT, JSON de IDs a multiplicar, "Parámetros para Valor de Unidades"). |
| Instancias de configuración | Valor de unidades: placas y LNE `["…_lado_a","…_lado_b"]`; PTR `["custitem_sads_nat_ptr_largo"]`. Familias de corte: las captura el usuario técnico en la UI (sus IDs no están en el proyecto); después se descarga el objeto. |
| `manifest.xml` | Dependencia `customlist_familias_de_corte`. |

## Comportamiento
1. Paso 2: SELECT obligatorio "Familia de Corte" con solo las familias marcadas en la naturaleza (C-9: `BUILTIN.DF` de cada ID). Sin familias marcadas: error de configuración "La naturaleza no tiene familias de corte. Solicite el alta a un usuario con permiso sobre la lista Familias de Corte."
2. La familia elegida se valida contra las de la naturaleza (RN-11).
3. Valor de unidades: `domain/SADS_naturaleza_corte.js` multiplica los valores ya validados (incluye los lados que llena el mapa de PTRR). Redondeo a 6 decimales para evitar ruido.
4. Espesor: solo si la naturaleza usa espesor; sin espesor el campo conserva el valor de la plantilla.
5. UE de configuración: con plantilla, `valor_unid` obligatorio, JSON válido y cada ID dentro del JSON de parámetros; familias de corte obligatorias.
6. Confirmación muestra familia de corte y valor de unidades.

## Archivos
`SADS_SL_crear_articulo_nat.js`, `SADS_UE_naturaleza_config.js`, nuevo `domain/SADS_naturaleza_corte.js`, objetos de configuración, pruebas (dominio con los 8 ejemplos del usuario, Suitelet, UE) y documentación (sección 4H).

## Riesgos
| Enunciado | Consecuencia | Mitigación |
|---|---|---|
| Familias de corte capturadas en la UI y no en el XML | Un deploy del XML sin descargar antes las borra | Descargar el objeto de configuración después de capturarlas |
| Rol del usuario sin permiso de ver la lista | El SELECT queda vacío | Revisar permisos en sandbox |

## Verificación
`npm test` en verde. Sandbox: LNE 4'x10' Cal.18 → valor 40, espesor 0.0478, familia elegida, corte T, depósitos T; PTR 1"x1/2" Cal.18 a 6.00m → valor 6.
