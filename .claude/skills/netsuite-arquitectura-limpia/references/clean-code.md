# Clean Code aplicado a SuiteScript 2.1

Fuente: Robert C. Martin, *Clean Code: A Handbook of Agile Software Craftsmanship* (2008). Redacción propia.

## Contenido

1. Catálogo CC- (reglas con identificador para el modo Revisión)
2. Olores de código frecuentes en SuiteScript
3. Manejo de errores con `N/error`
4. Comentarios y JSDoc

## 1. Catálogo CC-

| ID | Regla | Por qué importa | Forma en SuiteScript | Señal de violación | Severidad típica |
|---|---|---|---|---|---|
| CC-01 | Nombres que revelan intención | El lector no debería necesitar el contexto del autor | `const importeRecargo`, no `const x2` ni `const tmp` | Variables de una letra fuera de índices cortos; abreviaturas propias | Baja |
| CC-02 | Nombres del dominio, no de la plataforma, en capas internas | Las reglas se discuten con usuarios de negocio | `ordenDeVenta.lineas`, no `rec.getSublistValue(...)` dentro de una regla | Términos `N/` en `domain/` o `application/` | Media |
| CC-03 | IDs internos como constantes con nombre | Un `custbody_x` repetido es un error de captura esperando ocurrir | `const CAMPO = Object.freeze({ RECARGO: 'custcol_recargo' })` en el adaptador | El mismo ID literal en más de un lugar | Media |
| CC-04 | Funciones pequeñas con una sola responsabilidad | Una función que hace tres cosas obliga a probar tres cosas juntas | Funciones de pocas líneas; el entry point solo delega | Entry points de cientos de líneas | Alta en entry points |
| CC-05 | Un nivel de abstracción por función | Mezclar política con detalle oculta la política | `aplicarRecargos()` no mezcla reglas de negocio con `setSublistValue` | Reglas y llamadas `N/` intercaladas | Media |
| CC-06 | Pocos argumentos; objetos con nombre cuando son más de dos | Argumentos posicionales se invierten sin aviso | `calcular({ cantidad, precio, recargo })` | Funciones con 4 o más parámetros posicionales | Baja |
| CC-07 | Sin argumentos bandera | Un booleano que cambia el comportamiento es dos funciones | `calcularConIva()` y `calcularSinIva()`, o Strategy | `calcular(datos, true, false)` | Baja |
| CC-08 | Separar comandos de consultas | Una función que lee y escribe sorprende al reutilizarla | `obtenerPolitica()` no escribe; `registrarPolitica()` no devuelve datos de negocio | Funciones `get*` que llaman `record.save` o `submitFields` | Media |
| CC-09 | Sin efectos secundarios ocultos | El costo en gobernanza de un efecto oculto se descubre en producción | Toda escritura `N/` vive en un adaptador con nombre explícito | Una función de cálculo que también guarda | Alta |
| CC-10 | No repetir conocimiento (DRY) | Dos copias de una regla divergen | La regla vive en `domain/` y la usan cliente y servidor | El mismo cálculo en `cs_*.js` y en `ue_*.js` | Alta si es regla fiscal o de precio |
| CC-11 | Errores como excepciones, no como códigos de retorno | Un código ignorado deja datos inconsistentes | `throw error.create({...})` o errores de dominio propios | Funciones que devuelven `-1`, `false` o `'ERROR'` para señalar falla | Media |
| CC-12 | No devolver ni pasar `null` sin contrato | Obliga a verificaciones dispersas | Devolver objeto vacío, lista vacía o resultado tipado `{ encontrado: false }` | `if (x != null)` repetido en cadena | Baja |
| CC-13 | Límites con código de terceros envueltos | Un cambio de API externa no debe propagarse | Cliente de PAC o banco detrás de un adaptador | `https.post` directo en un caso de uso | Media |
| CC-14 | Pruebas limpias y rápidas | Pruebas lentas no se ejecutan | Jest sobre `domain/` y `application/` sin cuenta NetSuite | Solo hay pruebas manuales en sandbox | Media |
| CC-15 | Formato vertical coherente | El código se lee de arriba hacia abajo | Funciones de alto nivel arriba, detalles abajo; el `return` del `define` al final | Helpers declarados entre entry points | Baja |
| CC-16 | Sin código muerto ni comentado | Confunde sobre qué está vigente | Borrar; el historial queda en Git | Bloques comentados de versiones anteriores | Baja |
| CC-17 | Regla del Boy Scout | Mejoras pequeñas y continuas evitan reescrituras | Cada cambio deja el archivo un poco mejor, sin mezclarlo con cambios de negocio | — | — |

## 2. Olores de código frecuentes en SuiteScript

| Olor | Descripción | Corrección |
|---|---|---|
| Entry point obeso | `beforeSubmit` con reglas, consultas y escrituras mezcladas | Extraer reglas a `domain/` y acceso a `N/` a `infrastructure/` (CC-04, HX-01) |
| Números mágicos de gobernanza | `if (runtime.getCurrentScript().getRemainingUsage() < 200)` sin explicación | Constante con nombre y justificación; o rediseñar a Map/Reduce |
| IDs dispersos | `custbody_*` y `customrecord_*` repetidos en varios archivos | Mapa de constantes en el adaptador (CC-03) |
| Búsqueda dentro de bucle | `search.lookupFields` o `record.load` por cada línea | Puerto con operación por lote (HX-05) |
| Lógica de cliente duplicada en servidor | Validación copiada en Client Script y User Event | Regla pura compartida (CC-10) |
| `try/catch` que traga errores | `catch (e) { log.debug(e) }` sin relanzar ni decidir | Manejar, traducir a error de dominio o relanzar (CC-11) |
| Parámetros de script leídos en todas partes | `runtime.getCurrentScript().getParameter` en reglas | Leer en el entry point y pasar como configuración |
| Fechas construidas a mano | Cadenas de fecha concatenadas | Adaptador de fechas que use `N/format`; el dominio recibe `Date` |

## 3. Manejo de errores con `N/error`

Distinguir tres clases de error:

| Clase | Origen | Dónde se lanza | Dónde se maneja |
|---|---|---|---|
| Error de dominio | Una regla de negocio no se cumple | `domain/` o `application/`, con un error propio que no depende de `N/error` | En el entry point, que decide cómo mostrarlo |
| Error de infraestructura | Falla de `N/record`, `N/query`, `N/https` | El adaptador lo captura y lo traduce a un error con nombre de negocio | En el caso de uso o el entry point |
| Error de programación | Contrato violado, dato imposible | Cualquier capa | No se captura para ocultarlo; se registra y se deja fallar |

Ejemplo de error de dominio sin dependencia de `N/`:

```javascript
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    class ErrorDeDominio extends Error {
        constructor(codigo, mensaje, detalle = {}) {
            super(mensaje);
            this.name = 'ErrorDeDominio';
            this.codigo = codigo;
            this.detalle = detalle;
        }
    }
    return { ErrorDeDominio };
});
```

El entry point lo traduce a `N/error` cuando necesita detener el guardado con un mensaje al usuario:

```javascript
// En entrypoints/ue_*.js
try {
    casoDeUso.ejecutar(entrada);
} catch (e) {
    if (e.name === 'ErrorDeDominio') {
        throw error.create({ name: e.codigo, message: e.message, notifyOff: true });
    }
    throw e;
}
```

## 4. Comentarios y JSDoc

| Usar comentario para | No usar comentario para |
|---|---|
| Explicar por qué existe una decisión no obvia (restricción de plataforma, regla fiscal con fundamento) | Repetir lo que el código ya dice |
| Contratos de puertos con `@typedef` | Desactivar código |
| Encabezado obligatorio de SuiteScript (`@NApiVersion`, `@NScriptType`, `@NModuleScope`) | Historial de cambios; para eso existe Git |
| Advertencias de gobernanza o concurrencia | Nombres pobres que el comentario intenta explicar |
