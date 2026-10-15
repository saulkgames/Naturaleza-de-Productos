# Patrones de diseño GoF en SuiteScript 2.1

Fuente: Erich Gamma, Richard Helm, Ralph Johnson y John Vlissides, *Design Patterns: Elements of Reusable Object-Oriented Software* (1994). Redacción propia.

## Contenido

1. Principios previos
2. Catálogo DP- (para el modo Revisión)
3. Aplicabilidad de los 23 patrones en SuiteScript
4. Patrones de alta aplicabilidad con ejemplo
5. Patrones que no son GoF pero se usan junto con ellos

## 1. Principios previos

| Principio | Traducción a SuiteScript |
|---|---|
| Programar contra interfaces, no contra implementaciones | Los casos de uso dependen de contratos JSDoc (puertos), no de módulos `N/` |
| Preferir composición sobre herencia | Objetos creados por fábricas y combinados; evitar jerarquías de clases profundas |
| Encapsular lo que varía | Lo que cambia por cliente, subsidiaria, artículo o regla fiscal se aísla en una estrategia |

Un patrón se justifica por una variación concreta que existe o que el requerimiento anuncia.
Aplicar un patrón "por si acaso" es sobreingeniería (DP-01).

## 2. Catálogo DP-

| ID | Regla | Señal de violación | Severidad típica |
|---|---|---|---|
| DP-01 | Patrón justificado por una variación real | Fábricas y estrategias con una sola implementación y sin variación prevista | Media |
| DP-02 | Condicionales por tipo repetidos sugieren Strategy | El mismo `switch (tipoCliente)` en varios lugares | Media |
| DP-03 | Integraciones externas detrás de Adapter | `N/https` y formato del tercero mezclados con reglas | Media |
| DP-04 | Sin Singleton con estado mutable | Variables de módulo usadas como caché o contador | Alta |
| DP-05 | Facade sin acumular responsabilidades | Una "librería de utilidades" de cientos de funciones sin relación | Media |
| DP-06 | No reimplementar lo que la plataforma ya ofrece | Template Method que replica las etapas de Map/Reduce; Observer que replica User Events | Baja |
| DP-07 | Nombre del patrón visible cuando ayuda a entender | Una estrategia llamada `Helper2` | Baja |

## 3. Aplicabilidad de los 23 patrones en SuiteScript

### Creacionales

| Patrón | Aplicabilidad | Uso típico | Riesgo |
|---|---|---|---|
| Factory Method | Alta | Crear el adaptador o la estrategia según subsidiaria, tipo de transacción o ambiente | Fábricas sin variación (DP-01) |
| Abstract Factory | Media | Familias de adaptadores coherentes (por ejemplo, todo lo de un PAC o de un banco) | Complejidad para pocas variantes |
| Builder | Media | Construir payloads complejos de integración o Advanced PDF paso a paso | Innecesario para objetos pequeños |
| Prototype | Baja | Copiar configuraciones base | La plataforma ya tiene `record.copy` para registros |
| Singleton | Evitar | — | Estado de módulo sin ciclo de vida controlado (DP-04) |

### Estructurales

| Patrón | Aplicabilidad | Uso típico | Riesgo |
|---|---|---|---|
| Adapter | Alta | Traducir APIs externas y módulos `N/` a puertos de negocio | Ninguno relevante |
| Facade | Alta | Interfaz simple sobre operaciones `N/record` de varios pasos | Crecimiento sin cohesión (DP-05) |
| Decorator | Media | Agregar bitácora, medición de gobernanza o reintentos a un adaptador sin modificarlo | Cadenas largas difíciles de depurar |
| Proxy | Media | Carga diferida o caché de una consulta costosa dentro de una ejecución | Confundir con caché entre ejecuciones; para eso existe `N/cache` |
| Composite | Baja | Estructuras jerárquicas (listas de materiales, jerarquías de artículos) | Recursión con costo de gobernanza |
| Bridge | Baja | Separar abstracción de implementación cuando ambas varían | Rara vez se justifica en scripts |
| Flyweight | Baja | Compartir datos inmutables repetidos en grandes volúmenes | Ganancia marginal en memoria |

### De comportamiento

| Patrón | Aplicabilidad | Uso típico | Riesgo |
|---|---|---|---|
| Strategy | Alta | Reglas de precio, margen, recargo o retención por tipo de cliente, artículo o subsidiaria | Ninguno relevante |
| Chain of Responsibility | Alta | Validaciones encadenadas en `beforeSubmit` o en un RESTlet | Orden implícito; documentarlo y probarlo |
| Command | Media | Encapsular operaciones para encolarlas o procesarlas en Map/Reduce | Sobrecarga para operaciones únicas |
| Template Method | Media | Pipelines de importación con pasos fijos y variaciones por origen | No duplicar las etapas de Map/Reduce (DP-06) |
| State | Media | Ciclos de vida de registros personalizados (pedido de corte, solicitud de aprobación) | Si ya existe un workflow, no duplicarlo |
| Specification (no GoF) | Media | Reglas de elegibilidad combinables | Ver sección 5 |
| Observer | Baja | Notificaciones internas dentro de una ejecución | Los User Events y workflows ya cumplen ese rol (DP-06) |
| Mediator | Baja | Coordinar campos interdependientes en Client Script complejos | Puede ocultar dependencias |
| Iterator | Baja | El lenguaje y `ResultSet.each` o `PagedData` ya lo resuelven | — |
| Visitor | Baja | Operaciones sobre estructuras heterogéneas | Rígido ante nuevos tipos |
| Memento | Baja | Deshacer en Client Script | Rara vez requerido |
| Interpreter | Baja | Pequeños lenguajes de reglas configurables | Alto costo de mantenimiento |

## 4. Patrones de alta aplicabilidad con ejemplo

### Strategy: recargo según política

```javascript
// domain/estrategiasRecargo.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    const ESTRATEGIAS = Object.freeze({
        FIJO_POR_LINEA: ({ politica }) => politica.valor,
        PORCENTAJE: ({ cantidad, precioUnitario, politica }) => cantidad * precioUnitario * politica.valor,
    });

    const obtener = (tipo) => {
        const estrategia = ESTRATEGIAS[tipo];
        if (!estrategia) throw new Error(`Estrategia de recargo no registrada: ${tipo}`);
        return estrategia;
    };

    return { obtener };
});
```

Agregar un tipo nuevo es agregar una entrada al mapa (OCP), no editar condicionales dispersos.

### Chain of Responsibility: validaciones antes de guardar

```javascript
// domain/validacionesOrden.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    // Cada validación devuelve un arreglo de errores; el orden importa y está explícito.
    const VALIDACIONES = [
        (orden) => (orden.lineas.length ? [] : ['La orden no tiene líneas']),
        (orden) => orden.lineas.filter((l) => l.cantidad <= 0).map((l) => `Línea ${l.indice + 1}: cantidad inválida`),
    ];

    const validar = (orden) => VALIDACIONES.flatMap((v) => v(orden));

    return { validar };
});
```

Variante de cadena que recolecta todos los errores en lugar de detenerse en el primero; útil para mostrar al usuario todo lo que debe corregir.

### Adapter: integración externa

```javascript
// infrastructure/timbradoPACHttp.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/https'], (https) => {
    /**
     * Implementa el puerto ServicioDeTimbrado.
     * @param {{url:string, encabezados:Object}} config  Valores leídos de parámetros o secretos por el entry point.
     */
    const crear = ({ url, encabezados }) => ({
        timbrar(comprobante) {
            const respuesta = https.post({ url, headers: encabezados, body: JSON.stringify(comprobante) });
            if (respuesta.code !== 200) {
                return { exito: false, motivo: `HTTP ${respuesta.code}` };
            }
            const cuerpo = JSON.parse(respuesta.body);
            return { exito: true, uuid: cuerpo.uuid };
        },
    });

    return { crear };
});
```

El formato del tercero (`cuerpo.uuid`) es ilustrativo. El caso de uso solo conoce `{ exito, uuid, motivo }`.
Credenciales y manejo seguro de la llamada se revisan con el puerto P-02.

### Decorator: medir gobernanza de un adaptador

```javascript
// infrastructure/conMedicionDeGobernanza.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/log'], (runtime, log) => {
    const envolver = (adaptador, nombre) =>
        Object.fromEntries(Object.entries(adaptador).map(([metodo, fn]) => [metodo, (...args) => {
            const antes = runtime.getCurrentScript().getRemainingUsage();
            const resultado = fn(...args);
            const consumidas = antes - runtime.getCurrentScript().getRemainingUsage();
            log.debug({ title: `${nombre}.${metodo}`, details: `unidades: ${consumidas}` });
            return resultado;
        }]));

    return { envolver };
});
```

Útil en sandbox para validar las estimaciones del plan; se retira o se desactiva por parámetro en producción.

### Factory Method: adaptador según ambiente

```javascript
// entrypoints/... dentro del composition root
const servicioTimbrado = parametros.modoPruebas
    ? timbradoSimulado.crear()
    : timbradoPACHttp.crear({ url: parametros.urlPAC, encabezados });
```

La decisión vive en el composition root; el caso de uso no sabe si está en pruebas.

## 5. Patrones que no son GoF pero se usan junto con ellos

| Patrón | Origen | Uso en SuiteScript |
|---|---|---|
| Repository | Fowler, Evans (DDD) | Adaptador secundario de lectura y escritura de un agregado |
| Specification | Evans y Fowler | Reglas de elegibilidad combinables con `y`, `o`, `no` |
| Unit of Work | Fowler | Rara vez aplica: NetSuite guarda registro por registro, sin transacciones multi-registro |
| Anti-Corruption Layer | Evans (DDD) | Capa de adaptadores que protege el dominio del modelo de un sistema externo |

Unit of Work merece la advertencia: NetSuite no ofrece transacciones que abarquen varios registros.
El diseño debe asumir guardados parciales y definir idempotencia y compensación.
