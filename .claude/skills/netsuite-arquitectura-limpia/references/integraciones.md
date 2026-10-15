# Integraciones: puertos hacia otras skills

Esta skill no contiene reglas de plataforma.
Cuando las necesita, las solicita por un puerto con nombre de negocio.
Este archivo es el único adaptador: si Oracle renombra o reorganiza sus skills, solo cambia esta tabla.

Mapeo verificado contra la versión 1.0 de las skills de Oracle instaladas en octubre de 2026.

## Puertos

| Puerto | Necesidad | Skill (adaptador) | Archivos de interés | Uso típico desde esta skill |
|---|---|---|---|---|
| P-01 | Gobernanza, límites, concurrencia, rendimiento y pruebas | `netsuite-sdf-safe-guide` | `references/02-governance-usage-units.md`, `references/03-performance-optimization.md`, `references/06-testing-suiteapps.md`, `references/appendices/appendix-concurrency-cheatsheet.md` | Estimar operaciones `N/` por puerto; elegir tipo de script |
| P-02 | Seguridad de adaptadores (entrada, salida, credenciales, RESTlet, archivos) | `netsuite-owasp-secure-coding` | `references/01-injection-prevention.md`, `references/08-api-restlet-security.md`, `references/appendices/appendix-suitescript-security-patterns.md` | Revisar adaptadores `N/https`, RESTlets y Suitelets |
| P-03 | Existencia y tipo de registros y campos | `netsuite-suitescript-records-reference` | `references/records.json`, `references/record-index.md` | Validar IDs usados en mapeos y consultas |
| P-04 | Permisos y rol de ejecución | `netsuite-sdf-roles-and-permissions` | `references/permissions.json` | Permisos mínimos del deployment |
| P-05 | Migración de SuiteScript 1.0 o 2.0 a 2.1 | `netsuite-suitescript-upgrade` | `references/api-mapping.json`, `references/breaking-changes.md` | Paso R1 de refactorización |
| P-06 | Object XML y despliegue SDF | `netsuite-sdf-safe-guide` | Secciones de plantillas XML del SKILL.md | Generar o revisar XML de entry points |
| P-07 | Componentes UIF para SPA | `netsuite-uif-spa-reference` | `references/core.d.ts`, `references/component.d.ts` | Adaptadores primarios de tipo SPA |
| P-08 | Documentación del proyecto | `netsuite-sdf-project-documentation` | SKILL.md | Documentar la arquitectura después de un refactor |

## Advertencias conocidas de los adaptadores

| Puerto | Advertencia | Fundamento | Cómo compensar |
|---|---|---|---|
| P-03 | 128 de 272 registros no tienen campos en `records.json` | Medido en la versión 1.0 | Si el registro no tiene campos, verificar con SuiteQL de solo lectura por el conector "Netsuite Dev"; si no está disponible, marcar `supuesto` |
| P-03 | No existe el registro `inventoryitem`; `item`, `noninventorysaleitem`, `noninventoryresaleitem`, `otherchargeitem`, `servicesaleitem` y `serviceresaleitem` tienen 0 campos | Medido en la versión 1.0 | Igual que el anterior |
| P-03 | `invoice`, `customerpayment`, `itemfulfillment`, `itemreceipt`, `inventoryadjustment` e `inventorytransfer` no tienen sublistas | Medido en la versión 1.0 | Igual que el anterior para campos de línea |
| P-03 | `record-index.md` reporta campos en 36 registros donde `records.json` tiene 0 | Medido en la versión 1.0 | Considerar `records.json` como fuente; el índice solo orienta |
| P-06 | El ejemplo de truncado de script ID declara 40 caracteres y tiene 42 | `customscript_` (13) más el sufijo del ejemplo (29) | Contar la longitud final del ID en lugar de seguir el ejemplo |
| P-06 | La skill renombra archivos `.js` automáticamente al normalizar nombres | Sección Process Flow del SKILL.md | En esta skill, renombrar o mover un entry point requiere confirmación explícita; esa regla prevalece |
| Varios | Las skills de Oracle citan skills inexistentes (`netsuite-sdf-leading-practices`, `netsuite-suitescript-reference`, `netsuite-sdf-education`, `netsuite-suitescript-learning`) | Menciones en texto | Usar los nombres de esta tabla |

## Cuando un adaptador no está disponible

1. Declarar que la skill no está disponible en la sesión.
2. Continuar con el criterio de diseño de esta skill.
3. Marcar como `supuesto` todo dato de plataforma que dependía del puerto.
4. Listar en la salida qué validaciones quedaron pendientes.
