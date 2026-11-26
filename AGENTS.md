# AGENTS.md — Mapa del proyecto Naturaleza de Productos

Guía para agentes de IA. Leer este archivo primero; abrir otros solo según la sección 3 (mapa de consulta).
Estado verificado el 2026-11-26 sobre la rama `claude/pensive-goldberg-r9d1tl` (commit `23df9c2`). Si algo aquí contradice el código, manda el código; corregir este archivo.

## 1. Qué es
Personalización NetSuite (SuiteCloud SDF, Account Customization, SuiteScript 2.1) para Almetal.
Cada **naturaleza de producto** (placa, PTR, lámina) se define como configuración, no como código: parámetros del artículo, artículo plantilla, patrón de código y patrón de nombre.
Un Suitelet crea artículos copiando la plantilla; dos User Events validan configuración y familias; un Client Script y un User Event hacen obligatorios los parámetros al editar artículos.

| Dato | Valor |
|---|---|
| Idioma de código, comentarios, mensajes y docs | Español de México (identificadores sin acentos) |
| Prefijo de scripts y objetos propios | `SADS_` / `sads_` |
| Ambientes | Sandbox `Almetal_SB` y producción. Este entorno no tiene cuenta NetSuite: no se puede desplegar ni validar contra NetSuite |
| Pruebas | Jest 30 + `@oracle/suitecloud-unit-testing`; 16 suites, 675 pruebas, todas aprobadas (2026-11-26) |
| Estado productivo | Desplegado según el responsable; el repositorio no registra fecha ni commit. PR a `main` pendiente (`main` va 42 commits atrás) |

Seis naturalezas incluidas: Placas de Acero, PTRC, MPPTRC, PTRR, MPPTRR y Lámina Negra (LNE). Detalle en `README.md` §1.1.

## 2. Reglas para el agente (ahorro de tokens, sin bucles, sin sobreingeniería)
1. Leer primero este archivo y solo el archivo que la tarea exige. No explorar `.claude/skills/` ni `node_modules/` salvo que la tarea lo pida.
2. No leer `SADS_SL_crear_articulo_nat.js` (1177 líneas) completo: buscar la función con Grep (sección 5) y leer ese rango.
3. No leer `README.md` (460 líneas) completo: usar `grep -n '^#'` y leer la sección necesaria. La doc técnica detallada está en `SADS_SL_crear_articulo_nat.md`.
4. Ignorar `README.pdf`, `docs/*.pdf`, `package-lock.json` y `planes/` antiguos (v1 a v4 y prompts v1/v2 están superados; vigentes en sección 3).
5. Cambio mínimo: modificar solo lo pedido. Sin capas, patrones, abstracciones, dependencias ni archivos nuevos que la tarea no necesite. Nivel de arquitectura vigente: 1 (README §3.2); puertos y adaptadores formales están descartados.
6. Una regla de negocio nueva va en `domain/` (puro) con su prueba; el entry point solo orquesta.
7. Antes de editar: localizar el código con Grep y verificar que el comportamiento pedido no existe ya.
8. Tras editar: `npx jest <suite afectada>`; antes de cerrar, `npx jest` completo. Máximo 2 intentos de corrección por la misma falla; si persiste, detenerse y reportar la causa y lo probado.
9. No inventar IDs internos, scriptids, valores de lista, cifras ni fundamentos fiscales. Si falta el dato, declararlo y pedirlo.
10. No ejecutar `suitecloud` ni `project:deploy`/`project:validate` (sin cuenta). No crear Pull Request sin petición explícita del usuario.
11. Tono de respuesta: español de México, lacónico y neutro; una idea por oración; tablas cuando haya varias variables; distinguir hecho verificado de inferencia.
12. Datos confidenciales (RFC, cuentas bancarias, saldos, nómina, clientes y proveedores) no se escriben en código, pruebas, ejemplos ni documentos de este repositorio.

## 3. Mapa de consulta (qué abrir según la tarea)
| Tarea | Abrir |
|---|---|
| Visión general, riesgos, despliegue, decisiones AD-01 a AD-18 | `README.md` (por sección) |
| Flujo del Suitelet, consultas SuiteQL C-x, reglas RNx, permisos, troubleshooting | `src/FileCabinet/SuiteScripts/SADS_Naturaleza_Productos/SADS_SL_crear_articulo_nat.md` (secciones 4B–4H por tema, 8 reglas, 15 troubleshooting) |
| Lenguaje funcional para usuarios | `docs/Naturaleza_de_Productos_Guia_Funcional.md` |
| Diseño de precio | `planes/2026-11-18_calculo-precio-articulo_plan_v1.md` |
| PTR rectangular y mapa de medidas | `planes/2026-11-19_ptr-rectangular-mapa-medidas_plan_v1.md` |
| Lámina Negra | `planes/2026-11-19_lamina-negra_plan_v1.md` |
| Sistema de Cortes | `planes/2026-11-19_sistema-cortes_plan_v1.md` |
| Diseño vigente del creador de artículos | `planes/2026-11-17_creador-articulos-naturaleza_plan_v5.md` y `…_prompt_v3.md` |
| Sintaxis de patrones de código y nombre | `planes/prompt_patrones_codigo_nombre.md` |
| CS y UE de obligatoriedad (notas originales, nombres desactualizados) | `SADS_item_dynamic_mandatory.md` |
| Skills de NetSuite disponibles | `.claude/skills/<nombre>/SKILL.md`: leer solo el `SKILL.md` de la skill aplicable |

## 4. Estructura del repositorio
```
.
├── AGENTS.md  README.md  LICENSE
├── package.json  jest.config.js  jsconfig.json  suitecloud.config.js   # config; project.json está en .gitignore
├── __tests__/                       # 16 suites Jest (una por módulo)
├── docs/                            # guía funcional (md + pdf)
├── planes/                          # planes y prompts de diseño (fecha_tema_vN.md)
├── .claude/skills/                  # skills de NetSuite (no tocar)
└── src/
    ├── manifest.xml  deploy.xml
    ├── Objects/
    │   ├── Config/                  # 15 XML: registros, listas, campos base, rol  → se despliega
    │   ├── Naturalezas/             # 7 campos custitem por naturaleza             → se despliega
    │   ├── Scripts/                 # 5 scripts con sus deployments                → se despliega
    │   ├── Calculo de Precio/       # 41 campos de artículo, referencia            → NO se despliega
    │   └── Terceros/                # lista de cortes y script DRT, referencia     → NO se despliega
    └── FileCabinet/SuiteScripts/
        ├── drt_item_ue.js           # tercero, NO se despliega, no editar
        └── SADS_Naturaleza_Productos/   # único folder de código que se despliega
            ├── SADS_SL_crear_articulo_nat.js     # Suitelet de creación (entry point)
            ├── SADS_UE_naturaleza_config.js      # UE: valida la configuración
            ├── SADS_UE_nat_familia.js            # UE: valida líneas de familia
            ├── SADS_UE_item_dynamic_mandatory.js # UE de artículo: parámetros obligatorios en servidor
            ├── SADS_CS_item_dynamic_mandatory.js # CS de artículo: obligatorios en pantalla
            ├── domain/   # reglas puras, sin N/
            └── infra/    # adaptadores con N/search, N/query, N/record, N/log
```

### 4.1 Módulos de dominio y adaptadores
| Módulo | Exporta | Úsalo para |
|---|---|---|
| `domain/SADS_naturaleza_config_formato` | `ERRORES, crearErrorDeDominio, esErrorDeDominio, serializarConfiguracion, parsearConfiguracion, esConfiguracionValida` | Contrato del JSON de parámetros; errores de dominio. Lo importan casi todos |
| `domain/SADS_naturaleza_patron` | `ERRORES, FORMATOS, extraerMarcadores, validar, validarFormatos, aplicar, formatearNumero, formatearValor` | Patrones de código y nombre; lista cerrada de formatos |
| `domain/SADS_naturaleza_parametros` | `ERRORES, esIdentificadorSeguro, validarIds, validarDefinicion, validarValores, validarOrdenDeLados, armarCriteriosDuplicado` | IDs seguros, captura, orden de lados, criterios de duplicado |
| `domain/SADS_naturaleza_familias` | `ERRORES, esUnica, validarLinea, resolver` | Familia de precio y margen por rango de espesor y medida |
| `domain/SADS_naturaleza_precio` | `ERRORES, TOLERANCIA, calcular, redondearACuarto, coincide` | Cadena de fórmulas de precio; redondeo a 0.25 |
| `domain/SADS_naturaleza_corte` | `ERRORES, leerParametrosDeValor, calcularValorDeUnidades, textoDeEspesor` | Datos del Sistema de Cortes |
| `domain/SADS_naturaleza_mapa_medidas` | `ERRORES, MARCADOR, validarFilas, buscar, valoresDe, textosDe` | Medida PTR rectangular y marcador `{mapa:codigo}` |
| `infra/SADS_naturaleza_articulo_ns` | `resolverTipoRegistroArticulo` | Tipo de registro desde el ID interno del artículo |
| `infra/SADS_naturaleza_precio_ns` | `leerCargos, cargarMonedas, asignarPrecio, leerPrecioFormula` | Cargos, monedas y matriz de precios del artículo |

Dependencias: el Suitelet usa todos; el UE de configuración usa patrón, parámetros, formato, corte, mapa y artículo_ns; el UE de familias usa familias y formato. Todos los módulos de dominio dependen de `formato`.

## 5. Localizador del Suitelet (`SADS_SL_crear_articulo_nat.js`)
Todo está dentro de un `define`; buscar con `grep -n "const <nombre>"`.
| Necesidad | Función (aprox. línea) |
|---|---|
| Entrada y despacho | `onRequest` (1164), `atenderSolicitud` (1127) |
| Pantallas | `construirPaso1` (604), `construirPaso2` (643), `construirConfirmacion` (733), `construirDuplicado` (772), `construirPaginaDeError` (787) |
| Consultas SuiteQL | `SQL_*` (constantes), `cargarConfiguraciones` (313), `leerConfiguracion` (326), `cargarEspesores` (361), `cargarFamilias` (374), `cargarMapaMedidas` (395) |
| Preparar naturaleza | `prepararNaturaleza` (871), `mostrarPaso2` (910), `atenderParametros` (924) |
| Duplicados | `armarConsultaDuplicado` (425), `buscarDuplicado` (446), `mostrarDuplicado` (932) |
| Crear el artículo | `atenderCreacion` (1072), `asignarValores` (479), `guardarArticulo` (989) |
| Precio | `calcularPrecio` (959), `verificarPrecioGuardado` (979) |
| Validaciones de captura | `validarFormatosDeCaptura` (1032), `espesorElegido` (1043), `medidaElegida` (1052), `familiaDeCorteElegida` (1063), `validarCampoMedida` (840) |
| Errores y escape | `registrarError` (1135), `mensajeParaUsuario` (1142), `escaparHtml` (273) |

Los números de línea son referencia: pueden desplazarse; confirmar con Grep.

## 6. Modelo de datos (IDs reales)
| Objeto | ID | Notas |
|---|---|---|
| Configuración de naturaleza | `customrecord_sads_naturaleza_productos` | Campos: `…_lista`, `…_plantilla` (ID interno del artículo), `…_patron_cod`, `…_patron_nom`, `…_tipo_esp`, `…_campo_med`, `…_mapa_med`, `…_fam_corte`, `…_valor_unid`; el JSON de parámetros es un arreglo de IDs de campo de artículo |
| Líneas de familia | `customrecord_sads_nat_familia` | Hijo de la configuración; rango de espesor y de medida → familia de precio y de margen; sin rango = familia única |
| Catálogo de espesores | `customrecord_sads_espesor` | Texto, segmento de código, orden de grosor; tipos en `customlist_sads_tipo_espesor` |
| Mapa de medidas PTRR | `customrecord_sads_mapa_medidas_ptrr` | Lado mayor, lado menor, código del proveedor |
| Lista de naturalezas | `customlist_sads_naturaleza_productos` | |
| Campo de naturaleza en artículo | `custitem_sads_naturaleza_producto` | Obligatorio; aplica a 6 tipos de artículo |
| Campos de parámetros | `custitem_sads_nat_{pla,lne}_lado_{a,b}`, `custitem_sads_nat_ptr_{lado,lado_b,largo}`, `custitem_sads_nat_espesor` | Lados de placa/LNE en pies; PTR en pulgadas, largo en metros |
| Familias DRT (de otra personalización) | `custitem_pfp_famprecios_`, `custitem_pfp_fammargenes_` | El Suitelet las escribe; se despliegan desde `Config` |
| Datos de corte (fuera del repo) | `custitem_alm_corte`, `custitem_famili_de_corte_item`, `custitem_value_per_units`, `custitemalm_articulo_espesor`, `custitem_drt_ci_precio_teorico` | Deben existir en la cuenta |
| Rol del UE de artículo | `customrole_sads_naturaleza_config_exec` | `runasrole` |
| Scripts | `customscript_sads_sl_crear_articulo_nat`, `…_ue_naturaleza_config`, `…_ue_nat_familia`, `…_cs_item_dynamic_mandat`, `…_ue_item_dynamic_mandat` | CS y UE de artículo: 6 deployments cada uno |
| Parámetro de despliegue | `custscript_sads_sl_art_activo` | F en XML: los artículos nacen inactivos |

Reglas de negocio con ID (RN-x, RN3-x … RN6-x, D-x, R4-01): su texto completo está en `SADS_SL_crear_articulo_nat.md` §8 y §17; no reinterpretar sin leerlo.

## 7. Convenciones de código
| Tema | Regla |
|---|---|
| Formato | 4 espacios, comillas simples, punto y coma, funciones flecha, `const`; módulos AMD con `define([...], (...) => {...})` |
| Cabecera | JSDoc con `@NApiVersion 2.1`, `@NModuleScope SameAccount`, `@NScriptType` (solo entry points) y `@description` |
| Dominio | No importa `N/`. Entran y salen objetos planos, nunca `record`, resultados de búsqueda ni `context`. Cada suite de dominio verifica esto leyendo el archivo |
| Errores | Dominio: `formato.crearErrorDeDominio(ERRORES.X, mensaje)`. Mensajes de negocio en español. Los errores técnicos se registran con `log.error` y al usuario se le muestra un mensaje genérico |
| Constantes | `Object.freeze` para `ERRORES`, `MENSAJES` y catálogos; cada `ERRORES.X` igual a su llave |
| Entrada no confiable | Números por expresión regular; espesor y medida contra catálogo; columnas SQL por lista blanca; valores como parámetros SuiteQL; escapar HTML de avisos, etiquetas y enlaces. Sin `eval` ni regex construida con el patrón |
| Gobernanza | Una sola copia de la plantilla por solicitud, modo estándar (AD-07) |
| Pruebas | Una suite por módulo en `__tests__/`; el código se importa con `require('SuiteScripts/SADS_Naturaleza_Productos/...')`; el entry point mockea `N/*` con `jest.mock`; ejemplos con artículos reales |
| Documentos de diseño | `planes/AAAA-MM-DD_tema_planvN.md`; no sobrescribir versiones: crear la siguiente |

## 8. Comandos
```bash
npm ci          # una vez; node_modules no está versionado
npx jest        # todas las suites (~3 s)
npx jest __tests__/SADS_naturaleza_corte.test.js   # una suite
```
`suitecloud project:deploy` ejecuta Jest antes de desplegar (`suitecloud.config.js`). No disponible en este entorno.

## 9. Recetas frecuentes
| Cambio | Pasos mínimos |
|---|---|
| Nueva naturaleza | Sin código: campos `custitem` en `Objects/Naturalezas`, valor en `customlist_sads_naturaleza_productos`, instancia de configuración en `customrecord_sads_naturaleza_productos.xml`, líneas de familia, deployments de CS y UE si es otro tipo de artículo. Actualizar conteos de `README.md` y la prueba `SADS_objetos_portables.test.js` si aplica |
| Formato nuevo de patrón | Agregar en `FORMATOS` de `domain/SADS_naturaleza_patron.js` y su prueba; actualizar `planes/prompt_patrones_codigo_nombre.md` |
| Cambio de cálculo de precio | `domain/SADS_naturaleza_precio.js` y `SADS_naturaleza_precio.test.js`; la fórmula también vive en los campos fórmula de la cuenta (R4-01): avisar al usuario |
| Nuevo campo escrito en el artículo | `asignarValores` del Suitelet, prueba del Suitelet, tabla de `README.md` §2.2 y `SADS_SL_crear_articulo_nat.md` |
| Nueva regla de validación de configuración | Dominio + `SADS_UE_naturaleza_config.js` + suite correspondiente |
| Nuevo objeto SDF | Colocarlo en `Config`, `Naturalezas` o `Scripts` (únicas carpetas desplegadas) con scriptid portable (sin `val_<n>_<cuenta>`); verificar con `SADS_objetos_portables.test.js` |

## 10. Zonas frágiles y prohibiciones
| Enunciado | Fundamento | Consecuencia |
|---|---|---|
| No desplegar `Calculo de Precio/`, `Terceros/` ni `drt_item_ue.js` | `deploy.xml` los excluye; `SADS_objetos_portables.test.js` lo verifica | Sobrescribiría personalizaciones de terceros en la cuenta |
| No agregar IDs generados por la cuenta (`val_<n>_<cuenta>`) en objetos desplegados | AD-18 | El deploy fallaría o sobrescribiría objetos en producción |
| `Objects/Config/*.xml` de configuración, espesores, líneas de familia y mapa traen datos | Elementos `instances` | Un deploy puede revertir cambios hechos en la UI; descargar el XML antes de desplegar |
| Las familias de corte capturadas en la UI no están en el XML (solo Placas trae 10) | README §8 | Redeploy sin descargar las borra; el Suitelet no crea sin familias de corte (RN6-02) |
| El XML del deployment del Suitelet trae audiencia vacía y `custscript_sads_sl_art_activo` = F | `customscript_sads_sl_crear_articulo_nat.xml` | Un redeploy los restablece |
| IDs internos dependen de la cuenta (plantillas 10928, 11249, 25481, subsidiarias 3 y 4) | README §8 | No asumir los mismos IDs en otra cuenta; no inventar IDs de plantillas |
| El artículo hereda de la plantilla la configuración fiscal (CFDI 4.0: `ClaveProdServ`, `ClaveUnidad`) y peso/conversión se capturan a mano | AD-01; README §8 | No escribir ni alterar claves SAT, peso ni impuestos en código sin pedido explícito y fundamento |
| CS y UE de artículo (`*_item_dynamic_mandatory.js`) no tienen pruebas ni capa de dominio | README §3.4 | Cualquier cambio ahí se valida solo en sandbox; avisar al usuario |

Deuda técnica y hallazgos abiertos (H3-xx, H5-xx): `README.md` §3.4. No resolverlos sin pedido.

## 11. Git
| Regla | Detalle |
|---|---|
| Rama de trabajo | `claude/pensive-goldberg-r9d1tl`; no empujar a otra rama |
| Commits | Solo cuando el usuario lo pida; mensajes en español, imperativos y concretos |
| Pull Request | No crear sin petición explícita; `main` va 42 commits atrás (README §7.3) |
| Excluidos | `node_modules`, `project.json` (authId de la cuenta), `build` |

## 12. Mantenimiento de este archivo
Actualizar `AGENTS.md` en el mismo cambio cuando varíe: un módulo o su API, el conteo de pruebas o suites, las carpetas desplegadas, un ID de objeto o una regla de la sección 10.
No duplicar aquí el contenido de `README.md`: enlazar a la sección.

## 13. Supuestos, fuentes y verificación
| Supuesto | Base |
|---|---|
| Los números de línea de la sección 5 son aproximados al commit `23df9c2` | Búsqueda con Grep el 2026-11-26 |
| El alias `SuiteScripts/...` en las pruebas lo resuelve `SuiteCloudJestConfiguration` | Inferido de los `require` de `__tests__/`; las pruebas pasan |
| Estado productivo y fecha de despliegue | No verificables desde el repositorio (README §7.2, SU-01 a SU-05) |

Fuentes: `README.md`, `SADS_SL_crear_articulo_nat.md`, `package.json`, `jest.config.js`, `suitecloud.config.js`, `src/manifest.xml`, `src/deploy.xml`, listado de `src/` y `__tests__/`, `git log`.
Verificación del 2026-11-26: `npm ci` y `npx jest` → 16 de 16 suites y 675 de 675 pruebas aprobadas. Límite: no se accedió a NetSuite ni se ejecutó `project:validate`.
