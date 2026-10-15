# Plantilla del plan de desarrollo

Usar estas secciones en este orden. Omitir una sección solo si no aplica y declararlo con "No aplica: <motivo>".

```
# Plan: <nombre de la solución> — v<n>

## 0. Control
| Campo | Valor |
|---|---|
| Fecha | |
| Versión | |
| Estado | Borrador / En revisión / Aprobado |
| Solicitante | |
| Entidades afectadas | Subsidiarias |

Historial de cambios: una línea por versión.

## 1. Objetivo
Problema, resultado esperado y métrica de éxito.

## 2. Alcance
Incluye / No incluye. Subsidiarias, roles, formularios.

## 3. Situación actual
Proceso y objetos existentes. Scripts o workflows que ya actúan sobre los mismos registros.

## 4. Arquitectura de la solución
| Componente | Tipo | ID propuesto (scriptid) | Disparador | Responsabilidad |
Justificación del tipo de script frente a alternativas.
Diagrama Mermaid del flujo general.

### 4.1 Nivel de arquitectura
Nivel 0, 1, 2 o 3 y justificación con las señales que lo determinan.

### 4.2 Capas, casos de uso y puertos
Solo para nivel 1 o superior.
| Caso de uso | Intención de negocio | Entrada | Salida | Reglas RN-xx |
| Puerto | Dirección (entrada/salida) | Operaciones (firma) | Lote (Sí/No) | Adaptador | Módulo N/ |

### 4.3 Patrones de diseño
| Patrón | Dónde | Variación que resuelve | Alternativa descartada |
"No aplica: motivo" si no se usa ninguno.

### 4.4 Estructura de archivos por capa
Árbol `entrypoints/`, `application/`, `domain/`, `infrastructure/`, `shared/` según el nivel.
Diagrama Mermaid de dependencias con flechas hacia adentro.

## 5. Modelo de datos
### 5.1 Registros y campos existentes
| Registro | Campo | ID interno | Tipo | Uso | Verificado/Supuesto |
### 5.2 Objetos nuevos
Registros personalizados, campos, listas, parámetros de script.
| Objeto | ID propuesto | Tipo | Aplica a | Obligatorio | Default | Regla |

## 6. Lógica por componente
Para cada componente:
- Punto(s) de entrada y condiciones de ejecución (tipo de evento, contexto de ejecución).
- Pasos numerados en lenguaje natural.
- Funciones: nombre, entradas, salidas, responsabilidad (sin cuerpo).
- Consultas: tabla, campos, filtros, joins, orden, volumen esperado.
- Reglas de negocio numeradas (RN-01, RN-02…).
- Redondeo, unidades de medida y moneda cuando aplique.

## 7. Gobernanza y rendimiento
| Componente | Operación | Unidades por operación | Operaciones por ejecución | Total estimado | Límite |
Estrategia si se excede: rescheduling, Map/Reduce, lotes.

## 8. Manejo de errores y bitácora
Qué se registra, dónde (log, registro personalizado), a quién se notifica, cómo se reintenta.

## 9. Seguridad y permisos
Roles que ejecutan, rol de ejecución del script, permisos mínimos, datos confidenciales.

## 10. Consideraciones fiscales
Solo si aplica. Obligación + fundamento (artículo, regla RMF, guía de llenado). Si no hay fundamento verificado, marcar "supuesto a validar con fiscal".

## 11. Riesgos
| ID | Enunciado | Fundamento | Consecuencia | Mitigación |

## 12. Plan de pruebas
| Caso | RN | Capa (dominio/aplicación/infraestructura/sandbox) | Datos de entrada | Resultado esperado | Tipo (feliz/borde/error) |
Las reglas de dominio se prueban con Jest sin cuenta NetSuite; solo la integración completa requiere sandbox.

## 13. Despliegue
Ambiente (sandbox → producción), orden de despliegue, deployments, parámetros, datos iniciales, reversión.

## 14. Decisiones abiertas
| ID | Pregunta | Opciones | Bloqueante (Sí/No) |

## 15. Supuestos y fuentes
Supuestos numerados. Fuentes: consultas realizadas, archivos revisados, documentación.
```
