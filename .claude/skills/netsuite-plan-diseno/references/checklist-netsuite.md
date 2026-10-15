# Checklist NetSuite para diseño

Aplicar cada punto relevante durante la Fase 0 y la Fase 2.

## Exploración de esquema vía MCP
- Usar SuiteQL como método principal.
- Filtrar activos con `isinactive = 'F'`.
- Resolver valores de despliegue con `BUILTIN.DF()`.
- Evitar `ns_getSuiteQLMetadata` (devuelve 403 en esta cuenta); explorar con consultas directas a las tablas.
- Usar `pageSize: 1000` para conjuntos grandes.
- Solo lectura. Nunca crear, editar ni borrar registros durante el diseño.

## Selección de tipo de script
| Necesidad | Tipo sugerido |
|---|---|
| Validar o calcular en pantalla | Client Script |
| Reaccionar al guardar/cargar un registro | User Event |
| Procesar lotes grandes o recuperables | Map/Reduce |
| Tarea programada pequeña y lineal | Scheduled |
| Pantalla o herramienta interna | Suitelet |
| Integración externa | RESTlet |
| Acción dentro de un workflow | Workflow Action |
| Actualización masiva guiada | Mass Update |

## Límites de gobernanza de referencia (SuiteScript 2.x)
Verificar contra la documentación vigente de Oracle antes de cerrar el plan.

| Tipo | Unidades por ejecución |
|---|---|
| Client, User Event, Suitelet, Workflow Action | 1,000 |
| RESTlet | 5,000 |
| Scheduled | 10,000 |
| Map/Reduce | getInputData 10,000; map 1,000; reduce 5,000; summarize 10,000 (por invocación) |
| Mass Update | 1,000 por registro |

## Puntos de diseño obligatorios
- Versión: SuiteScript 2.1 salvo razón documentada.
- Multi-subsidiaria: definir cómo se comporta en cada RFC; no asumir una sola subsidiaria.
- Multi-moneda y tipo de cambio si hay importes.
- Unidades de medida: unidad base contra unidad de venta/compra.
- Redondeo: número de decimales y momento en que se aplica (por línea o total).
- Recargos o importes fijos: definir si se aplican una vez por línea o por unidad.
- Contexto de ejecución: UI, CSV import, web services, otros scripts; definir en cuáles corre.
- Recursividad: evitar que un User Event dispare otro sobre el mismo registro sin control.
- Idempotencia: la ejecución repetida no debe duplicar efectos.
- Parámetros de script en lugar de valores fijos (IDs, correos, cuentas).
- Concurrencia: dos usuarios o dos ejecuciones sobre el mismo registro.
- Compatibilidad con scripts y workflows existentes sobre el mismo registro.
- Formato de entrega: SDF o carga manual; estructura de carpetas en File Cabinet.

## Arquitectura
Criterio completo en la skill `netsuite-arquitectura-limpia`. Resumen para cuando no esté disponible:

| Nivel | Cuándo | Qué aplicar |
|---|---|---|
| 0 | Script pequeño, una regla, sin reutilización ni integraciones | Código limpio en un solo archivo |
| 1 | Reglas que conviene probar o reutilizar | Reglas puras en `domain/`; el entry point conserva el acceso a `N/` |
| 2 | Varias reglas, varios tipos de script o integración externa | Casos de uso, puertos y adaptadores |
| 3 | Módulos compartidos entre proyectos | Nivel 2 con contratos versionados |

- Las reglas de negocio no importan módulos `N/`.
- Solo los entry points se referencian en `scriptfile`; mover o renombrar uno exige actualizar el Object XML.
- Un puerto usado en un bucle expone operación por lote.

## Fiscal (solo si aplica)
- CFDI 4.0, Complemento Carta Porte, retenciones, nómina: citar artículo o regla al afirmar una obligación.
- Señalar riesgo de no deducibilidad, discrepancia o multa cuando exista.
- No afirmar cumplimiento sin base.

## Confidencialidad
- No incluir RFC, cuentas bancarias, saldos ni datos de nómina reales en el plan ni en el prompt.
- Usar marcadores: `<RFC_SUBSIDIARIA>`, `<ID_CUENTA>`.
