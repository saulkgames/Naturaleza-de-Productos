# Clean Architecture aplicada a SuiteScript 2.1

Fuente: Robert C. Martin, *Clean Architecture: A Craftsman's Guide to Software Structure and Design* (2017). Redacción propia.

## Contenido

1. Catálogo CA- (para el modo Revisión)
2. SOLID traducido a SuiteScript
3. Capas y regla de dependencia
4. Humble Object y entry points
5. Límites (boundaries) y cruce de datos
6. Principios de componentes (nivel 3)

## 1. Catálogo CA-

| ID | Regla | Señal de violación en SuiteScript | Severidad típica |
|---|---|---|---|
| CA-01 | Regla de dependencia: lo interno no conoce lo externo | `define(['N/record', ...])` en un módulo de `domain/` o `application/` | Alta |
| CA-02 | Responsabilidad única por módulo (SRP) | Un módulo cambia cuando cambia la regla de precio y también cuando cambia el formato del PDF | Media |
| CA-03 | Abierto a extensión, cerrado a modificación (OCP) | Agregar un tipo de cliente obliga a editar un `switch` en varios archivos | Media |
| CA-04 | Sustitución de Liskov (LSP) | Un adaptador alterno de un puerto devuelve formas distintas o lanza errores que el original no lanza | Alta |
| CA-05 | Segregación de interfaces (ISP) | Un puerto con quince operaciones de las que cada caso de uso usa dos | Baja |
| CA-06 | Inversión de dependencias (DIP) | El caso de uso importa el repositorio concreto en lugar de recibir el puerto | Alta |
| CA-07 | Entidades y reglas sin conocimiento de transporte | Reglas que reciben `context`, `newRecord` o `request` | Alta |
| CA-08 | Casos de uso como intención de negocio | Un "servicio" genérico con métodos sin relación entre sí | Media |
| CA-09 | Datos que cruzan límites como objetos planos | Pasar `record.Record` o `ResultSet` a capas internas | Alta |
| CA-10 | Entry point como Humble Object | Lógica condicional de negocio dentro del entry point | Media |
| CA-11 | Arquitectura que "grita" el dominio | Carpetas nombradas por tipo de script (`userevents/`, `suitelets/`) en lugar de capacidades de negocio en proyectos grandes | Baja |
| CA-12 | Decisiones de plataforma diferidas | Elegir `N/search` o `N/query` dentro de la regla en lugar de en el adaptador | Media |

## 2. SOLID traducido a SuiteScript

| Principio | Idea en una oración | Traducción a SuiteScript | Cuándo no forzarlo |
|---|---|---|---|
| SRP | Un módulo debe responder a un solo actor o fuente de cambio | Separar la regla de recargo (la pide Comercial) del formato de bitácora (lo pide TI) | Scripts de nivel 0 |
| OCP | Agregar comportamiento sin editar lo que ya funciona | Estrategias registradas en un mapa por tipo de cliente o subsidiaria | Cuando solo existe una variante y no hay indicios de otra |
| LSP | Cualquier implementación de un contrato debe poder sustituir a otra | El repositorio en memoria de las pruebas y el de SuiteQL devuelven la misma forma y los mismos errores | — |
| ISP | Nadie debe depender de operaciones que no usa | Puertos pequeños por necesidad: `PoliticasDeRecargo`, `Bitacora`, `Notificador` | Puertos con dos o tres operaciones cohesivas |
| DIP | Las políticas no dependen de los detalles; ambos dependen de abstracciones | El caso de uso recibe `{ politicas, bitacora }`; el entry point decide qué implementación pasar | — |

## 3. Capas y regla de dependencia

Correspondencia entre los círculos de Martin y las carpetas de un proyecto SDF:

| Círculo en el libro | Carpeta | Ejemplo |
|---|---|---|
| Entities | `domain/` | `calcularRecargoLinea`, `validarLimiteCredito` |
| Use Cases | `application/` | `aplicarRecargosAOrden`, `conciliarPagosDelDia` |
| Interface Adapters | `infrastructure/` y `entrypoints/` | Repositorio SuiteQL, mapeo de `newRecord` a objeto plano, formato de respuesta de RESTlet |
| Frameworks & Drivers | Módulos `N/*` y la propia plataforma | `N/record`, `N/query`, `N/https`, motor de despliegue |

En SuiteScript los adaptadores de interfaz y los entry points suelen fusionarse en proyectos de nivel 2.
Separarlos tiene sentido cuando el mismo caso de uso se expone por varios entry points con traducciones distintas.

## 4. Humble Object y entry points

Humble Object: separar el código difícil de probar (atado a la plataforma) del fácil de probar, dejando el primero tan simple que casi no necesite pruebas.

Un entry point humilde hace solo esto:

1. Filtrar tipo de evento y contexto de ejecución.
2. Leer parámetros de script.
3. Construir adaptadores e inyectarlos en el caso de uso.
4. Traducir el registro o la petición a un objeto plano.
5. Ejecutar el caso de uso.
6. Traducir el resultado a escritura en el registro, respuesta HTTP o error.

Si un entry point tiene un `if` que expresa una regla de negocio, esa regla está en la capa equivocada.

## 5. Límites y cruce de datos

| Qué cruza el límite | Forma correcta | Forma incorrecta |
|---|---|---|
| Datos de una transacción | `{ id, clienteId, subsidiariaId, lineas: [{ indice, articuloId, cantidad, precioUnitario }] }` | El objeto `record.Record` |
| Resultados de consulta | Arreglo de objetos planos con nombres de dominio | `query.ResultSet` o `search.Result` |
| Configuración | Objeto con valores ya leídos de parámetros | Llamadas a `runtime` dentro de la regla |
| Errores | Errores de dominio con código | `N/error` dentro de `domain/` |

Los mapeos entre la forma de NetSuite y la forma del dominio viven en `infrastructure/` y se prueban con dobles de los módulos `N/`.

## 6. Principios de componentes (nivel 3)

Aplican cuando hay librerías compartidas entre proyectos o SuiteApps.

| Principio | Idea | Aplicación |
|---|---|---|
| REP (reuso/liberación) | Lo que se reutiliza se versiona y se libera junto | Librería compartida con versión y changelog |
| CCP (cierre común) | Lo que cambia junto va junto | Reglas fiscales de un mismo complemento en un mismo componente |
| CRP (reuso común) | No obligar a depender de lo que no se usa | No mezclar utilidades de PDF con reglas de precios |
| ADP (dependencias acíclicas) | Sin ciclos entre componentes | Revisar que `infrastructure/` de un proyecto no importe `entrypoints/` de otro |
| SDP (dependencias estables) | Depender en dirección de lo más estable | Proyectos dependen de la librería de dominio, no al revés |
| SAP (abstracciones estables) | Lo estable debe ser abstracto | Contratos de puertos estables; implementaciones libres de cambiar |
