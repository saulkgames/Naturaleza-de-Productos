# Tarea: Naturaleza HSS — Fase A (solo código)

Versión del prompt: v3 (2026-11-27). Deriva del prompt v2. Cambio: la implementación de objetos es manual en producción (`planes/2026-11-27_hss_implementacion_manual_v1.md`); este prompt cubre solo código, pruebas y documentación. No se crean ni modifican XML de objetos.

## Rol
Eres un desarrollador senior de SuiteScript 2.1 y SuiteCloud SDF.
Implementas exactamente el diseño aprobado `planes/2026-11-26_hss_plan_v4.md`, limitado a la Fase A del plan manual.
No cambies reglas de negocio, scriptids ni IDs internos.
Si detectas una contradicción o un dato faltante, detente y repórtalo en lugar de suponer.

## Contexto
- Lee primero `AGENTS.md` y respeta sus reglas (secciones 2, 7, 10 y 11).
- La naturaleza HSS se configurará a mano en producción. Su configuración guardará los patrones de abajo y el User Event `SADS_UE_naturaleza_config.js` los valida con `domain/SADS_naturaleza_patron.js`; por eso el formato `centesimas4` debe existir antes.
- Los archivos resultantes se subirán a mano al File Cabinet de producción: `domain/SADS_naturaleza_patron.js` y `SADS_SL_crear_articulo_nat.js`. Cualquier otro cambio en esos archivos se subiría a producción; limita los cambios a lo especificado.
- Este entorno no tiene cuenta NetSuite: no ejecutes `suitecloud`, `project:deploy` ni `project:validate`.

## Entregables
| Archivo | Cambio |
|---|---|
| `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_patron.js` | Formato `centesimas4` |
| `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/SADS_SL_crear_articulo_nat.js` | Un par nuevo en `PARES_DE_LADOS` (RN-HSS-04) |
| `__tests__/SADS_naturaleza_patron.test.js` | Casos de `centesimas4`; lista de formatos y mensajes "Formatos válidos"; casos HSS con los patrones literales (P-03 a P-05, P-09) |
| `__tests__/SADS_naturaleza_familias.test.js` | Casos P-06 y P-07 con las 2 líneas HSS como objetos en memoria |
| `__tests__/SADS_SL_crear_articulo_nat.test.js` | Casos P-13 a P-15 (modelo: prueba D-18 existente) |
| `planes/prompt_patrones_codigo_nombre.md` | Fila de `centesimas4` en la tabla de formatos |
| `README.md` | Decisión del formato nuevo (siguiente D-xx libre), par de lados y aviso en §7: deploy SDF prohibido hasta la Fase D del plan manual |
| `SADS_SL_crear_articulo_nat.md` | D-18 menciona el par de PTR; formato `centesimas4` |
| `AGENTS.md` | Conteo de pruebas y suites; aviso de deploy prohibido |

Fuera de alcance en esta fase: XML de `src/Objects/`, `src/manifest.xml`, `__tests__/SADS_objetos_portables.test.js`, suite `SADS_naturaleza_hss.test.js` que lee XML, CSV de importación (ya existen en `docs/importacion/`). Se hacen en la Fase D.
No crees scripts, capas, puertos ni archivos fuera de esta lista.

## Arquitectura
Nivel 1 vigente. Dos cambios de código: un formateador en la tabla `FORMATEADORES` de `domain/SADS_naturaleza_patron.js` y un par en la constante `PARES_DE_LADOS` del Suitelet. La regla de orden ya existe (`parametros.validarOrdenDeLados`, D-18). El dominio no importa `N/`.
`SADS_UE_naturaleza_config.js` y el Suitelet usan el mismo módulo de patrón; confirma con Grep que no tienen lista de formatos propia y repórtalo si la tienen.

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

## Patrones HSS (literales para las pruebas)
| Patrón | Valor |
|---|---|
| Código | `HSS{custitem_sads_nat_ptr_lado:entero2}{custitem_sads_nat_ptr_lado_b:entero2}{custitem_sads_nat_espesor:codigo}{custitem_sads_nat_ptr_largo:centesimas4}` |
| Nombre | `HSS {custitem_sads_nat_ptr_lado}"x{custitem_sads_nat_ptr_lado_b}"x{custitem_sads_nat_espesor:texto} a {custitem_sads_nat_ptr_largo:decimal2}m` |
| IDs de la configuración | `["custitem_sads_nat_ptr_lado","custitem_sads_nat_ptr_lado_b","custitem_sads_nat_ptr_largo","custitem_sads_nat_espesor"]` |
Espesores HSS (código → texto): E12 `1/8"`, E18 `3/16"`, E25 `1/4"`, E31 `5/16"`, E37 `3/8"`, E50 `1/2"`, E62 `5/8"`, E75 `3/4"`; orden .125, .1875, .25, .3125, .375, .5, .625, .75.
Líneas de familia HSS (en memoria): sin rango de espesor; medida 1–10 → familia de precio "FAM 025", 12–99 → "FAM 026"; margen "HSS". En las pruebas usa identificadores descriptivos, no los scriptids de la cuenta.

## Datos de prueba
Origen: búsqueda guardada de artículos 4978 (2026-11-26), 71 artículos en alcance.
Formato: [ID interno, lado A (pulg), lado B (pulg), espesor, largo (m), código esperado]. Nombre esperado: `HSS <a>"x<b>"x<texto del espesor> a <largo con 2 decimales>m`.
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

## Reglas de negocio
| RN | Regla |
|---|---|
| RN-HSS-01 | Código = `HSS` + lado A (2 dígitos) + lado B (2 dígitos) + código de espesor + largo en centésimas (4 dígitos). |
| RN-HSS-02 | Nombre = `HSS <a>"x<b>"x<espesor> a <largo con 2 decimales>m`. |
| RN-HSS-03 | Lado A ≤ 10 → FAM 025; lado A ≥ 12 → FAM 026; margen HSS; lado A 11 → sin familia. |
| RN-HSS-04 | Lado A ≥ lado B; lado B mayor que lado A repite el paso 2 del Suitelet. |
| RN-HSS-06 | El largo admite máximo 2 decimales. |

## Restricciones técnicas
- Español de México en código, mensajes y documentos; identificadores sin acentos.
- Formato de código: 4 espacios, comillas simples, punto y coma, funciones flecha, `const`, `Object.freeze`.
- En `SADS_naturaleza_patron.js` solo se agrega el formato y sus mensajes; en el Suitelet solo el par de `PARES_DE_LADOS` y su comentario. Ningún otro cambio en esos dos archivos.
- No tocar `src/Objects/`, `Calculo de Precio/`, `Terceros/`, `drt_item_ue.js`, CS ni UE de artículo.
- No inventar IDs. No escribir claves SAT, peso ni impuestos.
- Máximo 2 intentos de corrección por la misma falla; si persiste, detente y reporta.

## Criterios de aceptación
| Caso | Entrada | Esperado |
|---|---|---|
| P-01 | `centesimas4` de 12.2, 6.1, 3, 99.99, 0.01 | `1220`, `0610`, `0300`, `9999`, `0001` |
| P-02 | `centesimas4` de 0, -1, 100, 6.125, 0.005 | `null` |
| P-03 | 71 filas con el patrón de código | Código igual al esperado |
| P-04 | 71 filas con el patrón de nombre | Nombre igual al esperado |
| P-05 | Lado 16, lado B 16, E50, largo 6.1 | `HSS1616E500610` y `HSS 16"x16"x1/2" a 6.10m` |
| P-06 | `familias.resolver` con lado A 4, 10, 12, 18 | FAM 025, FAM 025, FAM 026, FAM 026; margen HSS |
| P-07 | `familias.resolver` con lado A 11 | Lanza SIN_FAMILIA |
| P-09 | `patron.validar` con ambos patrones y los IDs de la configuración | Válido |
| P-12 | `npx jest` completo | Todas las suites aprobadas; reportar conteo final |
| P-13 | Suitelet, configuración HSS simulada, lado A 4, lado B 6 | Repite paso 2 con el mensaje de orden de lados; conserva valores; sin consulta de duplicado; sin `save` |
| P-14 | Suitelet, configuración HSS simulada, lado A 6, lado B 6 | Pasa la validación de lados |
| P-15 | Pruebas existentes de PTRR con mapa | Sin cambios y aprobadas |

## Formato de respuesta esperado
1. Lista de archivos modificados.
2. Diff resumido de `SADS_naturaleza_patron.js` y `SADS_SL_crear_articulo_nat.js` (se subirán a mano a producción).
3. Desviaciones respecto del diseño, con justificación.
4. Tabla de criterios con resultado.
5. Salida resumida de `npx jest` (suites y pruebas).
