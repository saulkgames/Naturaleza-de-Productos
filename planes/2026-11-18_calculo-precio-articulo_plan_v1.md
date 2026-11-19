# Cálculo del precio en el Suitelet de creación de artículos por naturaleza

## Contexto
Hoy el precio de un artículo se fija en dos pasos externos: un script copia el campo fórmula de precio final a `custitem11` (Precio Final Almacenado) y otro paso lo pasa al nivel "Precio base".
Los artículos creados por el Suitelet no pasan por esos pasos: el script DRT ya no corre en contexto SUITELET (commit 0febee8) y conservan los precios de la plantilla.
Objetivo: que el Suitelet calcule el precio con la misma cadena de fórmulas, lo guarde en `custitem11` y en el nivel Precio base, en el mismo `save` del artículo.
Fuente: objetos descargados en `src/Objects/Calculo de Precio/` (commit efbea4a) y `src/FileCabinet/SuiteScripts/drt_item_ue.js`.
Decisiones del usuario: vaciar los demás niveles de precio; cargos tomados de la plantilla; si falta un dato no se crea el artículo; los objetos de terceros quedan solo como referencia (fuera del deploy).

## 1. Mapa mental de la cadena de precios (comprensión)
```
PRECIO DEL ARTÍCULO
├─ Entradas
│  ├─ Familia de precios (custitem_pfp_famprecios_) ─ sourcing ─► custitemalm_articulo_preciocotizacion   [P]
│  │     origen: customrecord_pfp_famprecios.custrecord_drt_ci_f_precio (Precio Base de Cálculo, CURRENCY)
│  ├─ Familia de márgenes (custitem_pfp_fammargenes_) ─ sourcing ─► custitem_drt_ci_margen_para_venta     [M, %]
│  │     origen: customrecord_pfp_fammargenes_.custrecord_drt_ci_m_margen (FLOAT, 20 = 20 %)
│  ├─ Moneda de cotización (custitem_moneda_cotizacion) ─ sourcing ─► custitem_drt_ci_exchangerate        [TC]
│  │     origen: tipo de cambio predeterminado del registro de moneda (no almacenado)
│  ├─ Conversión unidad cotización→base: custitem_alm_articulo_conversionunidad                          [C]  (Suitelet)
│  ├─ Peso teórico kg: custitem_drt_ci_precio_teorico                                                    [W]  (Suitelet)
│  └─ Cargos por artículo, sin sourcing (heredados de la plantilla)
│     ├─ % Flete custitem_drt_ci_flete [pf] · % Maniobras custitem_drt_ci_maniobras [pm] · % Seguro custitem_drt_ci_cargo_seguro [ps]
│     ├─ Flete p/kg custitem_cargofijo_flete [Ff] · Maniobra p/kg custitem_alm_cargofijo_maniobra [Fm]
│     └─ Cargo compensatorio custitem26 [CC] (único con NVL a 0)
├─ Fórmulas (campos no almacenados)
│  ├─ PBU   custitem_alm_preciounitario_base   = P × TC × C
│  ├─ Flete custitem9  = Ff × W + custitem10 (= P × TC × pf)
│  ├─ Man.  custitem7  = Fm × W + custitem_drt_ci_maniobras_mxn (= P × TC × pm)
│  ├─ Cargos custitem_alm_cargos_importetotal = custitem9 + custitem7
│  ├─ PMC   custitem_articulo_preciomascargo  = Cargos + PBU
│  ├─ Seg.  custitem_drt_ci_cargo_seguro_mxn  = PMC × ps
│  ├─ PSM   custitem_precio_sinmargen         = Seg. + PMC
│  ├─ Util. custitem_alm_art_imp_utilidad     = PSM × (100 / (100 − M) − 1)
│  └─ PF    custitem_alm_art_preciofinal      = CEIL(ROUND((PSM + Util. + NVL(CC,0)) × 4, 6)) / 4   (sin IVA; múltiplo de 0.25)
├─ Salidas
│  ├─ custitem11 (Precio Final Almacenado, CURRENCY almacenado) = PF        ← hoy: script DRT (paso 1)
│  └─ Nivel "Precio base", moneda MXN = custitem11                          ← hoy: paso 2
└─ Fuera de la cadena actual
   ├─ custitem8 (Total seguro fijo = custitem_cargo_fijo_seguro × W): se calcula pero no se suma
   ├─ custitem_alm_articulo_basedelcalculo (P × TC): solo informativo
   └─ custitem_alm_preciofinal_almacenado, custitem_alm_preciofinal_cargos, custitem_drt_ci_* (precio_final, integrado,
      sin_margen, spot, spot_in, extranjero, promedio, moneda_precio, familia, cargos_flete_mxn), custitem_alm_temporada_articulo,
      custitemalm_articulo_moneda_venta, custitemalm_articulo_unidadcotizacion
```
Caso sintético de control (P 25, TC 1, C 6.1, W 6.1, Ff 0.35, Fm 0.20, % en 0, CC vacío, M 20): PBU 152.5; cargos 3.355; PSM 155.855; utilidad 38.96375; PF = 195.00.

## 2. Hallazgos
| ID | Hallazgo | Efecto |
|---|---|---|
| H-01 | `custitem10` y `custitem_drt_ci_maniobras_mxn` aplican el % a P × TC sin multiplicar por C, y se suman a cargos por pieza (× W). | Con % distinto de 0 se mezclan unidades. Se replica tal cual; no se corrige. |
| H-02 | `custitem8` (cargo fijo de seguro × W) no entra en `custitem_alm_cargos_importetotal`. | El cargo fijo de seguro no afecta el precio. Se replica tal cual. |
| H-03 | El tipo de cambio es el predeterminado del registro de moneda, no la tabla por fecha. | Precio en MXN depende de la última actualización de la moneda. |
| H-04 | `custitem_alm_art_preciofinal.xml` existe en `Objects/Config` y en `Objects/Calculo de Precio`. | `project:deploy` falla por scriptid repetido. |
| H-05 | Las líneas de familia de placas (`customrecord_sads_nat_familia.xml`, instancias val_8428201… y val_8428204…) apuntan a `val_8427261_5490848_sb1_888`; la configuración de placas en el proyecto ahora es `val_sads_nat_config_record_pla36`. | Deploy falla por referencia inexistente, o crea una segunda configuración de placas. |
| H-06 | `drt_item_ue.js` llama `drt_item_cm.setPreciosFinales` (módulo no incluido) en beforeLoad (view) y afterSubmit. | Al editar el artículo en la UI, DRT recalcula; coincide con el Suitelet solo si RN4-04 se cumple. |
| H-07 | Las familias tienen la casilla "Actualizar Articulo" (`custrecord_drt_ci_f_actualiazcion`, `custrecord_drt_ci_m_actualizacion`). | Un proceso DRT fuera del repo recalcula artículos al cambiar la familia; incluirá los artículos nuevos. |

## 3. Arquitectura
Nivel 1, igual que el resto del proyecto: regla pura en `domain/`, acceso a NetSuite en `infra/`, el Suitelet orquesta.
| Archivo | Cambio |
|---|---|
| `domain/SADS_naturaleza_precio.js` (nuevo) | Cálculo puro sin `N/`. |
| `infra/SADS_naturaleza_precio_ns.js` (nuevo) | Lectura de cargos de la copia, consulta de monedas, escritura de campos y matriz de precios, lectura del campo fórmula. Depende de `N/query` y `N/search`; recibe el `Record`. |
| `SADS_SL_crear_articulo_nat.js` | C-4 ampliada, orquestación y confirmación. |

### 3.1 Dominio `SADS_naturaleza_precio`
| Firma | Responsabilidad |
|---|---|
| `ERRORES = { PRECIO_INVALIDO }` | Error de dominio con `formato.crearErrorDeDominio` (`domain/SADS_naturaleza_config_formato.js`). |
| `calcular(entradas)` → `{ precioUnitarioBase, totalFletes, totalManiobras, cargos, precioMasCargos, importeSeguro, precioSinMargen, utilidad, precioFinal }` | Aplica la tabla de la sección 1. Entradas: `precioCotizacion, tipoCambio, conversion, peso, porcentajeFlete, porcentajeManiobras, porcentajeSeguro, fletePorKg, maniobraPorKg, cargoCompensatorio, margen`. Porcentajes en unidades de % (5 = 5 %); divide entre 100 (S4-01). |
| `redondearACuarto(valor)` | `ceil(round(valor × 4, 6)) / 4`. |
| `coincide(calculado, guardado)` | Diferencia absoluta ≤ 0.005. |
Errores (mensajes con etiquetas legibles, separador ":" como en el resto del dominio): dato faltante (lista de etiquetas), margen ≥ 100, precio final ≤ 0.

### 3.2 Infraestructura `SADS_naturaleza_precio_ns`
| Firma | Responsabilidad |
|---|---|
| `leerCargos(copia)` | `getValue` de pf, pm, ps, Ff, Fm, CC y `custitem_moneda_cotizacion`; vacío → null. |
| `cargarMonedas(monedaCotizacionId)` | C-7: `currency` id, symbol, exchangerate; filtro `id = ? OR symbol = 'MXN'`. Devuelve `{ tipoCambio, monedaPrecioId }`. Sin moneda MXN o sin cotización → error de configuración. |
| `asignarPrecio(copia, { entradas, calculo, monedaPrecioId })` | `custitemalm_articulo_preciocotizacion` = P; `custitem_drt_ci_margen_para_venta` = M; `custitem11` = PF; matriz de precios (RN4-06). |
| `leerPrecioFormula(tipoRegistro, articuloId)` | `search.lookupFields` de `custitem_alm_art_preciofinal`; error → null y `log.error` (no bloquea). |
Matriz de precios: sublistas `getSublists()` que cumplen `^price\d+$`; columnas con `getMatrixHeaderCount`; línea del nivel 1 en `price{MXN}`, columna 0 = PF; toda otra celda = vacío (`setMatrixSublistValue`). Sin línea del nivel 1 en MXN → error antes de guardar.

### 3.3 Suitelet
1. C-4 agrega `LEFT JOIN customrecord_pfp_famprecios` (→ `precio_cotizacion`) y `LEFT JOIN customrecord_pfp_fammargenes_` (→ `margen`); `cargarFamilias` los entrega como `precioCotizacion` y `margen`.
2. `atenderCreacion`: después de C-2 sin duplicado, arma entradas (línea de familia, `cargarMonedas`, `leerCargos(copia)`, peso, conversión) y llama `precio.calcular`. Error de dominio → página de error; no hay `save`.
3. `guardarArticulo`: `asignarValores` + `asignarPrecio`; un solo `save`; `leerPrecioFormula`; si no coincide → `log.audit` "Precio distinto de la fórmula" y aviso WARNING en la confirmación; el artículo queda creado.
4. Confirmación y `log.audit` agregan "Precio base (MXN)".

## 4. Reglas de negocio
| ID | Regla | Prueba |
|---|---|---|
| RN4-01 | P y M salen de la línea de familia resuelta; TC de la moneda de cotización de la copia; C y W capturados; pf, pm, ps, Ff, Fm, CC de la plantilla. | U-1, S-1 |
| RN4-02 | Cualquier entrada vacía, salvo CC, impide crear; el mensaje nombra los campos. | U-2, S-2 |
| RN4-03 | M ≥ 100 o PF ≤ 0 impide crear. | U-3 |
| RN4-04 | El cálculo replica la sección 1 sin redondeos intermedios (S4-07). | U-1, U-4, P4-01 |
| RN4-05 | PF = múltiplo de 0.25 hacia arriba tras redondear ×4 a 6 decimales. | U-5 |
| RN4-06 | Se escriben P, M, `custitem11` = PF y Precio base MXN = PF; las demás celdas de todas las monedas y niveles quedan vacías. | S-3, P4-02 |
| RN4-07 | Un solo `save`; el cálculo ocurre antes del `save`. | S-1 |
| RN4-08 | Tras guardar, si `custitem_alm_art_preciofinal` difiere de PF > 0.005, aviso y log; no se revierte. | S-4, P4-01 |

## 5. Objetos y deploy
1. `src/deploy.xml`: `files` = `~/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/*`; `objects` = `~/Objects/Config/*`, `~/Objects/Naturalezas/*`, `~/Objects/Scripts/*`.
2. Mover `src/Objects/Scripts/customscript_drt_item_ue.xml` a `src/Objects/Terceros/`; `Calculo de Precio` y `Terceros` quedan como referencia.
3. Borrar `src/Objects/Config/custitem_alm_art_preciofinal.xml` (H-04); queda la copia de `Calculo de Precio`; la dependencia en `manifest.xml` se mantiene.
4. H-05: corregir la referencia de las dos líneas de placas al scriptid que confirme el usuario en la cuenta (paso previo 1).

## 6. Gobernanza
| Solicitud | Antes | Después |
|---|---|---|
| Creación | ~81 | ~92 (C-7 +10, `lookupFields` +1); límite 1,000 |

## 7. Supuestos (se verifican en sandbox)
| ID | Supuesto | Verificación |
|---|---|---|
| S4-01 | `getValue` de un campo PERCENT devuelve unidades de % (5 = 5 %); la fórmula SQL usa la fracción. | P4-01 con un artículo con % distinto de 0 |
| S4-02 | `currency.exchangerate` en SuiteQL es el valor que usa `STDRECORDCURRENCYEXCHANGERATE`. | P4-01 con cotización en USD |
| S4-03 | Sublista `price{ID de moneda}`; nivel Precio base = ID 1; moneda de precio con símbolo MXN. | SuiteQL `pricelevel` y `currency` |
| S4-04 | `setMatrixSublistValue` columna 0 funciona en modo estándar con o sin precios por cantidad. | P4-02 |
| S4-05 | `lookupFields` devuelve el valor de un campo fórmula no almacenado. | P4-01 |
| S4-06 | `custitem_alm_articulo_conversionunidad` (CURRENCY) conserva los decimales capturados. | P4-03 con conversión de 3 decimales |
| S4-07 | Las fórmulas que leen otras fórmulas no redondean el valor intermedio. | P4-01 |
| S4-08 | El paso 1 actual copia `custitem_alm_art_preciofinal` a `custitem11`. | Revisar `drt_item_cm.js` si el usuario lo descarga |

## 8. Riesgos
| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R4-01 | La fórmula vive en dos lugares. | Campos fórmula en la cuenta y dominio en el script. | Si se cambia una fórmula, el script calcula otro precio. | RN4-08 avisa; documentar que cambiar la fórmula exige cambiar el dominio. |
| R4-02 | Tipo de cambio desactualizado. | H-03. | Precio MXN incorrecto en familias cotizadas en USD. | Proceso de actualización de monedas (fuera del alcance). |
| R4-03 | Se vacían los demás niveles. | Decisión del usuario. | Un nivel usado en ventas queda sin precio. | P4-02; revisar niveles activos antes de liberar. |
| R4-04 | Precio sin IVA redondeado a 0.25. | Ayuda del campo PF; Anexo 20 CFDI 4.0 (ValorUnitario). | Ninguna nueva: el script conserva el redondeo actual. | RN4-05. |

## 9. Pruebas
Unitarias (Jest, `npm test`):
| ID | Archivo | Caso |
|---|---|---|
| U-1 | `__tests__/SADS_naturaleza_precio.test.js` | Caso sintético → 195.00 y desglose. |
| U-2 | ídem | Cada entrada vacía → error con su etiqueta; CC vacío = 0. |
| U-3 | ídem | M = 100, M > 100, P = 0. |
| U-4 | ídem | Caso con % (P 1.10, TC 18, C 30, W 30, pf 2, pm 1, ps 0.5, Ff 0.35, Fm 0.20, CC 5, M 25) → 824.00. |
| U-5 | ídem | Redondeo: múltiplo exacto se conserva; 0.0000001 arriba sube al siguiente cuarto; ruido < 1e-6 no sube. |
| S-1 a S-4 | `SADS_SL_crear_articulo_nat.test.js` | Creación con precio (orden de `setValue`, matriz, un `save`); dato faltante sin `save`; celdas vacías en otras monedas y niveles; aviso por diferencia con la fórmula. |
| I-1 | `__tests__/SADS_naturaleza_precio_ns.test.js` | C-7 parametrizada; sin MXN → error; `leerPrecioFormula` con error → null. |
Las pruebas actuales de creación se ajustan a C-4 ampliada y C-7.

Sandbox:
| ID | Prueba | Esperado |
|---|---|---|
| P4-01 | Crear PTRC con plantilla 11249 y una placa. | `custitem11` = Precio base MXN = `custitem_alm_art_preciofinal`; sin aviso. |
| P4-02 | Revisar la pestaña de precios del artículo nuevo. | Solo Precio base MXN con valor. |
| P4-03 | Conversión con 3 decimales. | Sin aviso; si aparece, S4-06 es falso y se ajusta. |
| P4-04 | Familia sin Precio Base de Cálculo. | Mensaje y sin artículo. |
Con P4-01 a P4-04 aprobadas, P3-12 queda cubierta y `custscript_sads_sl_art_activo` puede pasar a T (sin código).

## 10. Pasos de ejecución
0. Previo (usuario, no bloquea el código): confirmar en la cuenta el ID de la configuración "Placas de Acero" (H-05); opcional, descargar `SuiteScripts/DRT - Custom Module/drt_item_cm.js` para S4-08.
1. `git pull --ff-only` de `claude/pensive-goldberg-r9d1tl` (trae 0febee8 y efbea4a).
2. Guardar este plan como `planes/2026-11-18_calculo-precio-articulo_plan_v1.md`.
3. Dominio + U-1 a U-5; infra + I-1; Suitelet + S-1 a S-4; ajustar pruebas existentes.
4. Objetos y deploy (sección 5).
5. Documentación: `SADS_SL_crear_articulo_nat.md` (sección 4D cálculo de precio, C-7, RN4, S4, R4, gobernanza, P4) y `README.md` (objetos de referencia, deploy).
6. `npm test` en verde; commit y push a `claude/pensive-goldberg-r9d1tl`.

## Verificación
`npm test` (suites actuales + 2 nuevas) en verde.
Revisión de cifras: U-1 y U-4 coinciden con el cálculo independiente (195.00 y 824.00).
`suitecloud project:validate` sin scriptid duplicado ni referencias rotas (H-04, H-05).
Sandbox: P4-01 a P4-04.
Límite: S4-01 a S4-08 solo se confirman en sandbox; S4-08 depende de un módulo DRT que no está en el repositorio.

## Historial
| Fecha | Cambio |
|---|---|
| 2026-11-19 | H-05 corregido por el usuario (commit 92fc57e). IDs propios de la lista de naturalezas renombrados; prueba de portabilidad; familias DRT pendientes de verificar en producción (sección 4E de la documentación). |
