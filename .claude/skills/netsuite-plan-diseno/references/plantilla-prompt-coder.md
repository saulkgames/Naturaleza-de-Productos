# Plantilla del prompt para el agente coder

El prompt se entrega en un bloque de código markdown. Debe ser autocontenido. Estructura:

```
# Tarea: <nombre de la solución>

## Rol
Eres un desarrollador senior de SuiteScript 2.1 para NetSuite. Implementas exactamente el diseño aprobado que sigue. No cambies reglas de negocio ni IDs. Si detectas una contradicción o un dato faltante, detente y repórtalo en lugar de suponer.

## Contexto
- Empresa: grupo industrial mexicano multi-subsidiaria (acero y hielo). NetSuite OneWorld.
- Resumen del problema y objetivo (del plan, sección 1).
- Situación actual relevante (sección 3).

## Entregables
| Archivo | Tipo de script | scriptid | Ruta en el proyecto |
Más: objetos de personalización (XML de SDF o instrucciones de creación manual, según se indique), README de despliegue.

## Estructura de archivos
Árbol de carpetas por capa según la sección 4.4 del plan y nivel de arquitectura declarado.

## Arquitectura
- Nivel de arquitectura (sección 4.1).
- Casos de uso y puertos con sus firmas (sección 4.2).
- Patrones y dónde se aplican (sección 4.3).

## Modelo de datos
Tablas de la sección 5, con IDs internos. Marcar los que son supuestos para que el coder los parametrice.

## Especificación por componente
Para cada archivo:
- Punto(s) de entrada y condiciones.
- Pasos de lógica numerados.
- Funciones con firma y responsabilidad.
- Consultas especificadas (tabla, campos, filtros, joins).
- Reglas de negocio RN-xx.

## Restricciones técnicas
- SuiteScript 2.1, módulos N/* estrictamente necesarios.
- Presupuesto de gobernanza por componente (sección 7) y estrategia al acercarse al límite.
- Parámetros de script para todo valor configurable.
- Manejo de errores y bitácora según sección 8.
- Contextos de ejecución permitidos.
- Sin datos reales confidenciales; usar parámetros.
- Regla de dependencia: `domain/` y `application/` no importan módulos `N/`; solo `infrastructure/` y `entrypoints/` lo hacen.
- Entry points delgados: filtrar evento y contexto, leer parámetros, construir adaptadores, mapear a objetos planos, invocar el caso de uso y aplicar el resultado.
- Puertos usados dentro de bucles exponen operaciones por lote.
- Pruebas Jest para `domain/` y `application/` con adaptadores en memoria.

## Criterios de aceptación
Casos de prueba de la sección 12, cada uno con entrada y resultado esperado.

## Despliegue
Pasos de la sección 13 y plan de reversión.

## Formato de respuesta esperado
1. Lista de archivos creados.
2. Código completo por archivo, con JSDoc de encabezado (@NApiVersion, @NScriptType, @NModuleScope), incluidos los archivos de prueba.
3. Notas de desviación respecto del diseño, si las hubo, con justificación.
4. Checklist de pruebas marcado con qué casos se cubrieron.
```
