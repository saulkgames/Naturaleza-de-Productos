# Tarea: Naturaleza Perfiles Estructurales Huecos (HSS)

Versión del prompt: v2 (2026-11-27). Cambio respecto de v1: se incluye la validación lado A ≥ lado B (RN-HSS-04).

## Rol
Eres un desarrollador senior de SuiteScript 2.1 y SuiteCloud SDF.
Implementas exactamente el diseño aprobado `planes/2026-11-26_hss_plan_v4.md`.
No cambies reglas de negocio, scriptids ni IDs internos.
Si detectas una contradicción o un dato faltante, detente y repórtalo en lugar de suponer.

## Contexto
- Repositorio: personalización SDF Account Customization de NetSuite para Almetal (distribución de acero). Lee primero `AGENTS.md` y respeta sus reglas (secciones 2, 7, 10 y 11).
- Una naturaleza de producto es configuración, no código (AD-02): registro `customrecord_sads_naturaleza_productos`, líneas de familia `customrecord_sads_nat_familia`, catálogo `customrecord_sads_espesor`.
- Problema: HSS se vendía en pieza de 12.20 m y de 6.10 m con la misma clave (`…1220`). Se requiere una clave por largo y crear las piezas de 6.10 m con el Suitelet `SADS_SL_crear_articulo_nat.js`.
- Ningún formato de patrón vigente escribe el largo 12.20 como `1220`; `centesimas3` admite solo 0.01–9.99. Se agrega el formato `centesimas4`.
- El tipo de espesor "Pared de PTR" ya tiene E12–E50, pero su texto usa `1/4''` y no tiene E62 ni E75. Se crea el tipo "Pared de HSS".
- Este entorno no tiene cuenta NetSuite: no ejecutes `suitecloud`, `project:deploy` ni `project:validate`.

## Entregables
| Archivo | Cambio |
|---|---|
| `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_patron.js` | Formato `centesimas4` |
| `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/SADS_SL_crear_articulo_nat.js` | Un par nuevo en `PARES_DE_LADOS` (RN-HSS-04) |
| `src/Objects/Config/customlist_sads_naturaleza_productos.xml` | Valor `val_sads_natlist_hss` |
| `src/Objects/Config/customlist_sads_tipo_espesor.xml` | Valor `val_sads_tesp_hss` |
| `src/Objects/Config/customrecord_sads_espesor.xml` | 8 instancias `val_sads_esp_hss_*` |
| `src/Objects/Config/customrecord_sads_naturaleza_productos.xml` | Instancia `val_sads_nat_config_record_hss` |
| `src/Objects/Config/customrecord_sads_nat_familia.xml` | 2 instancias `val_sads_espesor_config_hss_1` y `_2` |
| `src/manifest.xml` | 3 dependencias DRT nuevas |
| `__tests__/SADS_naturaleza_patron.test.js` | Casos de `centesimas4`; actualizar lista de formatos y mensajes de "Formatos válidos" |
| `__tests__/SADS_naturaleza_hss.test.js` | Suite nueva (modelo: `__tests__/SADS_naturaleza_lne.test.js`) |
| `__tests__/SADS_objetos_portables.test.js` | 3 scriptids DRT nuevos en la lista verificada |
| `__tests__/SADS_SL_crear_articulo_nat.test.js` | Casos P-13 a P-15 (modelo: prueba D-18 existente) |
| `docs/importacion/2026-11-26_hss_actualizacion_articulos.csv` | CSV para actualizar 71 artículos existentes |
| `planes/prompt_patrones_codigo_nombre.md` | Fila de `centesimas4` en la tabla de formatos |
| `README.md`, `AGENTS.md`, `docs/Naturaleza_de_Productos_Guia_Funcional.md`, `SADS_SL_crear_articulo_nat.md` | Conteos, naturaleza HSS, decisión del formato nuevo |

No crees scripts, capas, puertos ni archivos fuera de esta lista.

## Arquitectura
Nivel 1 vigente. Hay dos cambios de código: un formateador agregado a la tabla `FORMATEADORES` de `domain/SADS_naturaleza_patron.js`, que ya actúa como Strategy, y un par en la constante `PARES_DE_LADOS` del Suitelet. La regla de orden ya existe en el dominio (`parametros.validarOrdenDeLados`, D-18); no se agrega lógica nueva. El dominio no importa `N/`.
`SADS_UE_naturaleza_config.js` y el Suitelet usan el mismo módulo; reconocen `centesimas4` sin cambios propios. Confírmalo con Grep; si alguno tiene una lista de formatos propia, repórtalo.

## Especificación: formato `centesimas4`
| Atributo | Regla |
|---|---|
| Constante | `FORMATOS.CENTESIMAS_4 = 'centesimas4'` (objeto congelado) |
| Entrada válida | Número de 0.01 a 99.99 cuyo valor en centésimas es entero exacto. Usar `aMillonesimas` y `MILLONESIMAS_POR_CENTESIMA` como `formatearDecimal2` para evitar error de punto flotante |
| Salida | Centésimas con 4 dígitos y ceros a la izquierda |
| Fuera de formato | ≤ 0, > 99.99 o con más de 2 decimales → `null` |
| Mensaje de captura | `<etiqueta>: capture un número de 0.01 a 99.99 con máximo 2 decimales.` (mapa de mensajes junto a `CENTESIMAS_3`) |
| Diferencia con `centesimas3` | No trunca: rechaza |
| Documentación | Comentario JSDoc de `FORMATOS` con la nueva decisión (siguiente ID D-xx libre del README) |
El orden de `FORMATOS_VALIDOS` cambia el texto "Formatos válidos: …"; agrega `centesimas4` después de `centesimas3` y actualiza las pruebas que comparan ese texto.

## Especificación: validación de lados (RN-HSS-04)
| Atributo | Regla |
|---|---|
| Archivo | `SADS_SL_crear_articulo_nat.js`, constante `PARES_DE_LADOS` (cerca de la línea 66; confirmar con Grep) |
| Cambio | Agregar, congelado como el par de placas, `{ menor: 'custitem_sads_nat_ptr_lado_b', mayor: 'custitem_sads_nat_ptr_lado' }` |
| Mecanismo existente | `validarFormatosDeCaptura` filtra los pares cuyos dos IDs están en la configuración y llama a `parametros.validarOrdenDeLados` (D-18). No modificar esas funciones |
| Efecto en HSS | Lado B > lado A repite el paso 2 con el mensaje de orden de lados construido con las etiquetas de los parámetros (por ejemplo `SADS PTR Lado Menor Pulgadas no puede ser mayor que SADS PTR Lado Pulgadas.`; reporta el texto real obtenido), conserva valores capturados y no busca duplicados ni guarda |
| Lado A = lado B | Válido (HSS cuadrado) |
| Efecto en PTRR y MPPTRR | Ninguno: usan los mismos dos campos, pero `medidaElegida` llena ambos lados desde el mapa antes de validar y las 24 filas del mapa cumplen mayor ≥ menor. Las pruebas existentes de PTRR deben seguir pasando sin cambios |
| PTRC y MPPTRC | No aplica: su configuración no incluye `custitem_sads_nat_ptr_lado_b` |
| Comentario | Actualiza el comentario de la constante citando D-18 y RN-HSS-04 |
Actualiza también la tabla de reglas de `SADS_SL_crear_articulo_nat.md` (D-18) para mencionar el par de PTR.

## Modelo de datos
### Lista de naturalezas
`val_sads_natlist_hss`, valor "Perfiles Estructurales Huecos (HSS)", `isinactive` F, abreviatura vacía (igual a los existentes).

### Tipo de espesor
`val_sads_tesp_hss`, valor "Pared de HSS".

### Espesores (`customrecord_sads_espesor`, tipo `val_sads_tesp_hss`)
| scriptid | `name` | `custrecord_sads_esp_codigo` | `custrecord_sads_esp_texto` | `custrecord_sads_esp_orden` |
|---|---|---|---|---|
| `val_sads_esp_hss_e12` | `1/8" - HSS` | E12 | `1/8"` | .125 |
| `val_sads_esp_hss_e18` | `3/16" - HSS` | E18 | `3/16"` | .1875 |
| `val_sads_esp_hss_e25` | `1/4" - HSS` | E25 | `1/4"` | .25 |
| `val_sads_esp_hss_e31` | `5/16" - HSS` | E31 | `5/16"` | .3125 |
| `val_sads_esp_hss_e37` | `3/8" - HSS` | E37 | `3/8"` | .375 |
| `val_sads_esp_hss_e50` | `1/2" - HSS` | E50 | `1/2"` | .5 |
| `val_sads_esp_hss_e62` | `5/8" - HSS` | E62 | `5/8"` | .625 |
| `val_sads_esp_hss_e75` | `3/4" - HSS` | E75 | `3/4"` | .75 |
Comillas como `&quot;` en XML, igual que los espesores de placa.

### Configuración `val_sads_nat_config_record_hss`
| Campo | Valor |
|---|---|
| `name` | Perfiles Estructurales Huecos (HSS) |
| `custrecord_sads_naturaleza_lista` | `customlist_sads_naturaleza_productos.val_sads_natlist_hss` |
| `custrecord_sads_naturaleza_config` | `["custitem_sads_nat_ptr_lado","custitem_sads_nat_ptr_lado_b","custitem_sads_nat_ptr_largo","custitem_sads_nat_espesor"]` |
| `custrecord_sads_naturaleza_plantilla` | 41233 |
| `custrecord_sads_naturaleza_patron_cod` | `HSS{custitem_sads_nat_ptr_lado:entero2}{custitem_sads_nat_ptr_lado_b:entero2}{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_ptr_largo:centesimas4}` |
| `custrecord_sads_naturaleza_patron_nom` | `HSS {custitem_sads_nat_ptr_lado}"x{custitem_sads_nat_ptr_lado_b}"x{custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m` |
| `custrecord_sads_naturaleza_tipo_esp` | `customlist_sads_tipo_espesor.val_sads_tesp_hss` |
| `custrecord_sads_naturaleza_campo_med` | `custitem_sads_nat_ptr_lado` |
| `custrecord_sads_naturaleza_mapa_med` | F |
| `custrecord_sads_naturaleza_valor_unid` | `["custitem_sads_nat_ptr_largo"]` |
| `custrecord_sads_naturaleza_fam_corte` | Vacío: los valores HSS de `customlist_familias_de_corte` no están en el repositorio; se marcan en la cuenta |
Resto de campos e `isinactive` igual que la instancia de PTRC.

### Líneas de familia (`customrecord_sads_nat_familia`)
| scriptid | config | desde / hasta (espesor) | med_desde | med_hasta | precio | margen |
|---|---|---|---|---|---|---|
| `val_sads_espesor_config_hss_1` | `val_sads_nat_config_record_hss` | vacío | 1 | 10 | `customrecord_pfp_famprecios.val_26690_5490848_sb1_301` (FAM 025 - PTR HSS HASTA 10") | `customrecord_pfp_fammargenes_.val_5420301_5490848_458` (HSS) |
| `val_sads_espesor_config_hss_2` | `val_sads_nat_config_record_hss` | vacío | 12 | 99 | `customrecord_pfp_famprecios.val_26691_5490848_sb1_988` (FAM 026 - PTR HSS 12" EN ADELANTE) | `customrecord_pfp_fammargenes_.val_5420301_5490848_458` (HSS) |
Los 3 scriptids DRT son de otra personalización y existen en sandbox y producción (declarado por el usuario). Decláralos en `src/manifest.xml` como las demás familias DRT y agrégalos a la lista de `SADS_objetos_portables.test.js`.

## Reglas de negocio
| RN | Regla |
|---|---|
| RN-HSS-01 | Código = `HSS` + lado A (2 dígitos) + lado B (2 dígitos) + código de espesor + largo en centésimas (4 dígitos). |
| RN-HSS-02 | Nombre = `HSS <a>"x<b>"x<espesor> a <largo con 2 decimales>m`. |
| RN-HSS-03 | Lado A ≤ 10 → FAM 025; lado A ≥ 12 → FAM 026; margen HSS en ambos; sin dependencia del espesor ni del largo. Lado A 11 → sin familia. |
| RN-HSS-04 | Lado A ≥ lado B; lado B mayor que lado A repite el paso 2 del Suitelet. |
| RN-HSS-05 | Valor de unidades = largo. |
| RN-HSS-06 | El largo admite máximo 2 decimales. |
| RN-HSS-07 | Las familias DRT de HSS están en `manifest.xml` y en la prueba de portabilidad. |
Fuera de alcance: HSS redondo, artículo 10671 (espesor E31E), validación de lados en CS y UE de artículo.

## Datos de la prueba `SADS_naturaleza_hss.test.js`
Origen: búsqueda guardada de artículos 4978 (2026-11-26), 71 artículos en alcance.
Formato: [ID interno, lado A (pulg), lado B (pulg), espesor, largo (m), código esperado].
Los códigos de 10717 y 41233 ya están corregidos (antes `E050`).
```
    [13739, 4, 4, 'E25', 12.2, 'HSS0404E251220'], [11734, 4, 4, 'E31', 12.2, 'HSS0404E311220'], [10721, 4, 4, 'E37', 12.2, 'HSS0404E371220'],
    [10649, 5, 5, 'E25', 12.2, 'HSS0505E251220'], [36385, 5, 5, 'E31', 12.2, 'HSS0505E311220'], [10650, 5, 5, 'E37', 12.2, 'HSS0505E371220'],
    [10723, 6, 4, 'E25', 12.2, 'HSS0604E251220'], [36386, 6, 4, 'E31', 12.2, 'HSS0604E311220'], [10722, 6, 4, 'E37', 12.2, 'HSS0604E371220'],
    [10726, 6, 6, 'E18', 12.2, 'HSS0606E181220'], [10725, 6, 6, 'E25', 12.2, 'HSS0606E251220'], [10728, 6, 6, 'E31', 12.2, 'HSS0606E311220'],
    [10727, 6, 6, 'E37', 12.2, 'HSS0606E371220'], [10724, 6, 6, 'E50', 12.2, 'HSS0606E501220'], [36388, 8, 3, 'E12', 12.2, 'HSS0803E121220'],
    [36389, 8, 3, 'E18', 12.2, 'HSS0803E181220'], [10730, 8, 4, 'E18', 12.2, 'HSS0804E181220'], [10729, 8, 4, 'E25', 12.2, 'HSS0804E251220'],
    [13894, 8, 4, 'E31', 12.2, 'HSS0804E311220'], [10731, 8, 4, 'E37', 12.2, 'HSS0804E371220'], [36390, 8, 4, 'E50', 12.2, 'HSS0804E501220'],
    [10736, 8, 6, 'E18', 12.2, 'HSS0806E181220'], [10735, 8, 6, 'E25', 12.2, 'HSS0806E251220'], [10740, 8, 6, 'E31', 12.2, 'HSS0806E311220'],
    [10739, 8, 6, 'E37', 12.2, 'HSS0806E371220'], [10734, 8, 6, 'E50', 12.2, 'HSS0806E501220'], [10743, 8, 8, 'E18', 12.2, 'HSS0808E181220'],
    [10742, 8, 8, 'E25', 12.2, 'HSS0808E251220'], [10745, 8, 8, 'E31', 12.2, 'HSS0808E311220'], [10744, 8, 8, 'E37', 12.2, 'HSS0808E371220'],
    [10741, 8, 8, 'E50', 12.2, 'HSS0808E501220'], [11659, 10, 4, 'E25', 12.2, 'HSS1004E251220'], [10670, 10, 6, 'E18', 12.2, 'HSS1006E181220'],
    [10672, 10, 6, 'E25', 12.2, 'HSS1006E251220'], [1565, 10, 6, 'E31', 12.2, 'HSS1006E311220'], [36392, 10, 6, 'E37', 12.2, 'HSS1006E371220'],
    [36393, 10, 6, 'E50', 12.2, 'HSS1006E501220'], [10667, 10, 10, 'E18', 12.2, 'HSS1010E181220'], [10653, 10, 10, 'E25', 12.2, 'HSS1010E251220'],
    [10669, 10, 10, 'E31', 12.2, 'HSS1010E311220'], [10668, 10, 10, 'E37', 12.2, 'HSS1010E371220'], [10652, 10, 10, 'E50', 12.2, 'HSS1010E501220'],
    [36262, 12, 6, 'E18', 12.2, 'HSS1206E181220'], [10681, 12, 6, 'E25', 12.2, 'HSS1206E251220'], [36394, 12, 6, 'E37', 12.2, 'HSS1206E371220'],
    [36263, 12, 8, 'E18', 12.2, 'HSS1208E181220'], [10679, 12, 8, 'E25', 12.2, 'HSS1208E251220'], [10680, 12, 8, 'E37', 12.2, 'HSS1208E371220'],
    [36395, 12, 8, 'E50', 12.2, 'HSS1208E501220'], [10674, 12, 12, 'E25', 12.2, 'HSS1212E251220'], [10678, 12, 12, 'E31', 12.2, 'HSS1212E311220'],
    [10677, 12, 12, 'E37', 12.2, 'HSS1212E371220'], [10673, 12, 12, 'E50', 12.2, 'HSS1212E501220'], [11723, 12, 12, 'E62', 12.2, 'HSS1212E621220'],
    [10827, 14, 6, 'E31', 12.2, 'HSS1406E311220'], [10826, 14, 10, 'E31', 12.2, 'HSS1410E311220'], [10716, 14, 14, 'E31', 12.2, 'HSS1414E311220'],
    [10715, 14, 14, 'E37', 12.2, 'HSS1414E371220'], [10711, 14, 14, 'E50', 12.2, 'HSS1414E501220'], [36396, 14, 14, 'E62', 12.2, 'HSS1414E621220'],
    [10720, 16, 8, 'E37', 12.2, 'HSS1608E371220'], [41114, 16, 8, 'E50', 12.2, 'HSS1608E501220'], [41115, 16, 12, 'E31', 12.2, 'HSS1612E311220'],
    [10719, 16, 16, 'E31', 12.2, 'HSS1616E311220'], [10718, 16, 16, 'E37', 12.2, 'HSS1616E371220'], [36397, 16, 16, 'E62', 12.2, 'HSS1616E621220'],
    [36398, 18, 18, 'E50', 12.2, 'HSS1818E501220'], [36399, 18, 18, 'E62', 12.2, 'HSS1818E621220'], [36400, 18, 18, 'E75', 12.2, 'HSS1818E751220'],
    [10717, 16, 16, 'E50', 12.2, 'HSS1616E501220'], [41233, 16, 16, 'E50', 6.1, 'HSS1616E500610'],
```
Nombre esperado de cada fila: `HSS <a>"x<b>"x<texto del espesor> a <largo con 2 decimales>m` (ej. `HSS 6"x4"x3/8" a 12.20m`). Los nombres de 10722, 10679, 10725 y 10826 en la cuenta tienen errores de formato; el esperado es el corregido.
La suite lee configuración, espesores y líneas desde los XML (igual que la de LNE), aplica `patron.aplicar` y `familias.resolver`, y no duplica constantes de configuración.

## Especificación del CSV `docs/importacion/2026-11-26_hss_actualizacion_articulos.csv`
Una fila por artículo de la tabla anterior (71). Codificación UTF-8, separador coma, comillas dobles escapadas.
| Columna | Contenido |
|---|---|
| ID interno | ID del artículo (clave de la importación de actualización) |
| Naturaleza de Producto | Perfiles Estructurales Huecos (HSS) |
| SADS PTR Lado Pulgadas | Lado A |
| SADS PTR Lado B | Lado B (usa la etiqueta real de `custitem_sads_nat_ptr_lado_b.xml`) |
| SADS PTR Largo | Largo (usa la etiqueta real de `custitem_sads_nat_ptr_largo.xml`) |
| Espesor | `name` del registro de espesor HSS (ej. `1/4" - HSS`) |
| Nombre para mostrar | Código esperado |
| Nombre de proveedor | Código esperado (D-19) |
| Nombre | Nombre esperado |
Genera el CSV con un script desechable a partir de los datos de la prueba; no lo escribas a mano. Agrega una nota en `README.md` indicando que debe importarse antes de usar el Suitelet para HSS (riesgo de duplicado del 41233).

## Restricciones técnicas
- Español de México en código, mensajes y documentos; identificadores sin acentos.
- Formato de código: 4 espacios, comillas simples, punto y coma, funciones flecha, `const`, `Object.freeze`.
- scriptids portables: ninguno nuevo de la forma `val_<n>_<cuenta>` salvo las 3 dependencias DRT indicadas.
- No tocar `Calculo de Precio/`, `Terceros/`, `drt_item_ue.js`, CS ni UE de artículo.
- En el Suitelet, el único cambio permitido es el par de `PARES_DE_LADOS` y su comentario.
- No inventar IDs. No escribir claves SAT, peso ni impuestos.
- Máximo 2 intentos de corrección por la misma falla; si persiste, detente y reporta.

## Criterios de aceptación
| Caso | Entrada | Esperado |
|---|---|---|
| P-01 | `centesimas4` de 12.2, 6.1, 3, 99.99, 0.01 | `1220`, `0610`, `0300`, `9999`, `0001` |
| P-02 | `centesimas4` de 0, -1, 100, 6.125, 0.005 | `null` |
| P-03 | 71 filas | Código igual al esperado |
| P-04 | 71 filas | Nombre igual al esperado |
| P-05 | Lado 16, lado B 16, E50, largo 6.1 | `HSS1616E500610` y `HSS 16"x16"x1/2" a 6.10m` |
| P-06 | Lado A 4, 10, 12, 18 | FAM 025, FAM 025, FAM 026, FAM 026; margen HSS |
| P-07 | Lado A 11 | `familias.resolver` lanza SIN_FAMILIA |
| P-08 | `manifest.xml` y prueba de portabilidad | 3 scriptids DRT nuevos declarados |
| P-09 | `patron.validar` con los patrones HSS y los IDs de la configuración | Válido |
| P-10 | 8 espesores HSS | Tipo `val_sads_tesp_hss`, códigos únicos, orden creciente |
| P-11 | Valor de unidades con `corte.calcularValorDeUnidades` y largo 6.1 | 6.1 |
| P-12 | `npx jest` completo | Todas las suites aprobadas; reportar conteo final |
| P-13 | Suitelet, naturaleza HSS, lado A 4, lado B 6 | Repite paso 2 con el mensaje de orden de lados; conserva valores; sin consulta de duplicado; sin `save` |
| P-14 | Suitelet, naturaleza HSS, lado A 6, lado B 6 | Pasa la validación de lados (cuadrado) |
| P-15 | Pruebas existentes de PTRR con mapa | Sin cambios y aprobadas |

## Despliegue (solo documentar en README; no ejecutar)
1. Sandbox: descargar configuración vigente de la cuenta y conciliar con el XML.
2. Deploy SDF.
3. Marcar en la configuración HSS las familias de corte HSS existentes.
4. Importar el CSV de actualización.
5. Prueba en sandbox: crear 8"x4" E25 6.10 m → `HSS0804E250610`, FAM 025, valor de unidades 6.1; intentar 16"x16" E50 6.10 m → rechazo por duplicado (41233); capturar lado A 4, lado B 6 → rechazo por orden de lados.
6. Producción: repetir pasos 1 a 5.
Reversión: inactivar `val_sads_nat_config_record_hss`; el formato nuevo no afecta a otras naturalezas.

## Formato de respuesta esperado
1. Lista de archivos creados y modificados.
2. Resumen de cambios por archivo.
3. Desviaciones respecto del diseño, con justificación.
4. Tabla de criterios P-01 a P-15 con resultado.
5. Salida resumida de `npx jest` (suites y pruebas).
