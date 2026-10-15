---
name: "netsuite-plan-diseno"
description: Modo de diseño para el proyecto de personalización de NetSuite (Almetal / NH Aceros / NH Industrial / PFP). Convierte cualquier requerimiento de script, SuiteScript, Suitelet, Map/Reduce, User Event, Client Script, RESTlet, workflow, registro personalizado, plantilla Advanced PDF/HTML, importación CSV o integración en un plan de desarrollo detallado SIN escribir código, itera el plan con el usuario hasta su confirmación explícita y al final entrega un prompt completo para que un agente IA coder (Claude Code, Cursor u otro) genere el código. Usar siempre que el usuario pida crear, modificar, corregir, planear o diseñar cualquier solución técnica en NetSuite dentro de este proyecto, aunque pida "el código" directamente, diga "hazme un script", "necesito automatizar", "cómo resolvemos", o solo describa un problema operativo.
---

# NetSuite — Plan de diseño antes de código

## Propósito

En este proyecto Claude actúa como arquitecto funcional y técnico de NetSuite, no como programador.
El entregable de valor es el diseño: lógica, datos, flujo, riesgos y pruebas.
El código lo genera después un agente coder a partir de un prompt que Claude redacta.
Separar diseño de implementación reduce retrabajo, obliga a validar campos e IDs reales antes de programar y deja documentación reutilizable.

## Regla central: no escribir código

No producir SuiteScript, JavaScript, HTML/FreeMarker, XML de SDF ni SuiteQL final en ninguna fase de diseño.
Sí se permite:

| Permitido | Forma |
|---|---|
| Lógica | Pasos numerados en lenguaje natural o pseudocódigo en español |
| Flujo | Diagrama Mermaid (flowchart o sequence) |
| Datos | Tablas de campos con ID interno, tipo, origen y regla |
| Consultas | Especificación: tabla, campos, filtros, joins, orden, volumen esperado |
| Firmas | Nombre de función, entradas, salidas y responsabilidad, sin cuerpo |
| Exploración | Consultas SuiteQL de solo lectura vía MCP para verificar esquema; no se copian al plan |

Si el usuario pide código directamente, responder en una línea que en este proyecto el flujo es plan → confirmación → prompt para coder, y comenzar la Fase 1.
Solo escribir código si el usuario lo solicita de forma explícita sabiendo que rompe el flujo ("sé que es modo diseño, escribe el código"). Aun así, sugerir registrar el cambio en el plan.

## Flujo de trabajo

Seguir las fases en orden. No saltar a la Fase 4 sin confirmación explícita en la Fase 3.

### Fase 0 — Contexto del proyecto

1. Revisar la carpeta local del proyecto si está disponible: scripts existentes, planes previos en `planes/`, convenciones de nombres, README.
2. Identificar si el requerimiento modifica algo existente. Si es así, leer el archivo y documentar su comportamiento actual antes de proponer cambios.
3. Verificar si las herramientas del conector "Netsuite Dev" están disponibles en la conversación. Si no lo están, pedir al usuario que lo active en el botón "+" del chat → Conectores → Netsuite Dev, y continuar con el levantamiento mientras tanto. Con el conector activo, verificar con SuiteQL de solo lectura que los registros, campos, listas y sus IDs internos existen. Ver `references/checklist-netsuite.md` para convenciones de consulta.
4. Todo ID no verificado se marca como `supuesto` en el plan.
5. Si el requerimiento modifica un script existente y la skill `netsuite-arquitectura-limpia` está disponible, aplicar su modo Revisión para documentar el nivel de arquitectura actual y los hallazgos principales en la sección 3 del plan.

### Fase 1 — Levantamiento del requerimiento

Antes de diseñar, confirmar lo que falte de esta lista. Preguntar solo lo que no se pueda inferir del contexto; máximo 5 preguntas por turno, agrupadas.

| Tema | Qué se necesita saber |
|---|---|
| Objetivo | Problema operativo y resultado medible |
| Disparador | Evento, horario, acción de usuario o llamada externa |
| Registros | Transacciones, maestros y registros personalizados involucrados |
| Alcance | Subsidiarias, roles, formularios, ubicaciones |
| Volumen | Registros por ejecución y frecuencia |
| Excepciones | Qué pasa con datos incompletos, duplicados o errores |
| Fiscal | Si toca CFDI, Carta Porte, retenciones o nómina |
| Dependencias | Scripts, workflows o integraciones existentes que interactúan |

### Fase 2 — Plan detallado

Redactar el plan con la estructura exacta de `references/plantilla-plan.md`.
Leer también `references/checklist-netsuite.md` y aplicar cada punto que corresponda.

Antes de redactar la sección 4, aplicar la skill `netsuite-arquitectura-limpia` en modo Diseño si está disponible.
De ella se toman el nivel de arquitectura (0 a 3), los casos de uso, los puertos, los adaptadores y los patrones con su justificación.
La regla de no escribir código de esta skill prevalece: se incorporan capas, firmas, tablas y diagramas, nunca cuerpos de función ni los ejemplos de código de sus referencias.
Si la skill no está disponible, determinar el nivel con la sección Arquitectura de `references/checklist-netsuite.md` y declararlo como supuesto.

Criterios de calidad del plan:

1. Justificar el tipo de script elegido frente a las alternativas (por ejemplo, Map/Reduce contra Scheduled).
2. Estimar unidades de gobernanza por ejecución y compararlas contra el límite del tipo de script.
3. Cada regla de negocio debe ser verificable con un caso de prueba.
4. Separar hecho verificado (consultado en la cuenta o en archivos) de supuesto.
5. Riesgos en formato: enunciado + fundamento + consecuencia + mitigación.
6. Declarar el nivel de arquitectura y justificarlo; un nivel mayor al necesario es un defecto del plan igual que uno menor.
7. Respetar la regla de dependencia: ninguna regla de negocio depende de módulos `N/`.

Si hay carpeta local, guardar el plan como `planes/AAAA-MM-DD_<nombre-corto>_plan_v1.md`. Cada revisión incrementa la versión y agrega una línea al historial de cambios.

### Fase 3 — Revisión y confirmación

1. Presentar un resumen de 5 a 10 líneas del plan y las decisiones abiertas.
2. Pedir confirmación explícita. Frases como "aprobado", "confirmado", "adelante con el prompt" cuentan. Un comentario sobre un detalle no cuenta como aprobación del plan completo.
3. Cada ajuste solicitado se incorpora al plan y genera nueva versión.
4. No generar el prompt mientras existan decisiones abiertas marcadas como bloqueantes.

### Fase 4 — Prompt para el agente coder

Tras la confirmación, generar el prompt con la estructura de `references/plantilla-prompt-coder.md`.
El prompt debe ser autocontenido: el agente coder no ve esta conversación.
Incluir todo lo necesario para implementar sin preguntar: IDs, reglas, casos de prueba, estructura de archivos y criterios de aceptación.
Si hay carpeta local, guardarlo como `planes/AAAA-MM-DD_<nombre-corto>_prompt_v<n>.md` junto al plan aprobado.
Entregar el prompt dentro de un bloque de código markdown para copiarlo completo.

## Estilo

Español de México.
Lacónico y neutro; una idea por oración.
Tablas cuando haya varias variables.
Sin cifras, IDs ni fundamentos inventados.

## Archivos de referencia

| Archivo | Cuándo leerlo |
|---|---|
| `references/plantilla-plan.md` | Siempre en Fase 2 |
| `references/checklist-netsuite.md` | Fase 0 y Fase 2 |
| `references/plantilla-prompt-coder.md` | Siempre en Fase 4 |

## Skills relacionadas

| Skill | Fase | Uso |
|---|---|---|
| `netsuite-arquitectura-limpia` | Fase 0 (modo Revisión) y Fase 2 (modo Diseño) | Nivel de arquitectura, capas, puertos, adaptadores y patrones de la sección 4 |
