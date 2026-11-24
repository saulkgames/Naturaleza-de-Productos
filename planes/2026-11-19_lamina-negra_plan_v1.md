# Lámina Negra (LNE): corrección de la configuración

## Contexto
Error: "El campo de medida para familias debe ser un parámetro numérico de la configuración."
Causa: en `val_sads_nat_config_record_lne`, "Campo de Medida para Familias" = `custitem_sads_nat_espesor` (un catálogo, no un número).
Las líneas de familia ya usan Medida 3–3 y 4–4: es el ancho (Lado A). El campo correcto es `custitem_sads_nat_lne_lado_a`.
Simulación con `RelacionLNE_familias.xlsx` y el campo corregido: las 49 filas reciben su familia actual (3': FAM 017/089/018/092; 4': FAM 088/090/091/092).

## Cambios
1. `customrecord_sads_naturaleza_productos.xml`: `custrecord_sads_naturaleza_campo_med` de LNE = `custitem_sads_nat_lne_lado_a` (el usuario lo cambia también en la cuenta).
2. `customrecord_sads_espesor.xml`, 16 calibres LNE: texto sin espacio (`Cal.07` … `Cal.28`, igual que los artículos actuales) y nombre `Cal.10 - LNE` para distinguirlos de los calibres de PTR.
3. `SADS_UE_naturaleza_config.js`: rechazar `custitem_sads_nat_espesor` como campo de medida ("El Campo de Medida para Familias debe ser un parámetro numérico, no el espesor."), para que el error salga al guardar y no al crear. Prueba nueva.
4. Prueba `__tests__/SADS_objetos_portables.test.js`: agregar las 8 familias DRT de LNE a la lista verificada (confirmado: mismo scriptid en producción). Revisar que el manifiesto las declare.
5. Prueba `__tests__/SADS_naturaleza_lne.test.js`: lee la configuración, líneas y calibres del XML y comprueba con las 49 filas del archivo el código (`LNE{a:entero1}{b:entero2}{espesor:codigo}`) y la familia.
6. Documentación: sección 4G (LNE) y hallazgos.

## Hallazgos (sin cambio, se informan)
| Hallazgo | Efecto |
|---|---|
| Cal.15 y Cal.28 no están en ningún rango | El Suitelet no crea esos calibres. |
| 4' cubre Cal.13–Cal.08; 3' cubre Cal.13–Cal.07 | Cal.07 en 4' no tiene familia. |
| El nombre generado es `Lamina Negra 3'x6' Cal.10`; varios actuales dicen `3'x 6'` o `4' x6'` | Formato nuevo uniforme; los existentes no cambian. |
| Excepciones de margen: 12702 Media Pieza Lamina, 12820 MU PEDACERIA | El Suitelet asigna "Lamina Negra". |

## Verificación
`npm test` en verde; en sandbox, crear 3'x6' Cal.10 → `LNE306C10`, FAM 017.
