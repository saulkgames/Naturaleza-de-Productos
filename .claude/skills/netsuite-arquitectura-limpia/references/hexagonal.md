# Ports and Adapters (Arquitectura Hexagonal) en SuiteScript 2.1

Fuente: Alistair Cockburn, "Hexagonal Architecture" (2005), también publicado como "Ports and Adapters". Redacción propia.

## Contenido

1. Conceptos
2. Catálogo HX- (para el modo Revisión)
3. Mapa de adaptadores en NetSuite
4. Definir un puerto en JavaScript
5. Ejemplo completo por capas
6. Diferencias con Clean Architecture

## 1. Conceptos

| Concepto | Definición propia | En SuiteScript |
|---|---|---|
| Aplicación | El interior: reglas y casos de uso, ignorante de quién la llama y de dónde vienen los datos | `domain/` y `application/` |
| Puerto | Una conversación con propósito entre la aplicación y el exterior, definida desde el punto de vista de la aplicación | Contrato JSDoc con nombre de negocio |
| Adaptador | Traduce entre una tecnología concreta y un puerto | Entry points y módulos de `infrastructure/` |
| Lado primario (driving) | Quien inicia la conversación con la aplicación | Usuario en formulario, evento de registro, horario, sistema externo |
| Lado secundario (driven) | A quien la aplicación llama | Base de datos de NetSuite, correo, API externa, File Cabinet |
| Dependencia configurable | La aplicación recibe sus adaptadores desde fuera | Inyección en el entry point |

Cockburn propone que la aplicación pueda ser ejecutada igual por un usuario, un programa, una prueba automatizada o un script por lotes.
En NetSuite esto es literal: la misma regla puede dispararse desde UI, CSV import, web services, Map/Reduce o una prueba Jest.

## 2. Catálogo HX-

| ID | Regla | Señal de violación | Severidad típica |
|---|---|---|---|
| HX-01 | Los adaptadores primarios solo traducen | Reglas de negocio en `beforeSubmit`, `onRequest`, `map` | Media |
| HX-02 | Los puertos tienen nombre de negocio | Puertos llamados `SuiteQLHelper`, `RecordUtils` | Baja |
| HX-03 | La aplicación no conoce la tecnología del adaptador | Un caso de uso que construye SuiteQL o arma filtros de `N/search` | Alta |
| HX-04 | Cada puerto secundario tiene al menos dos adaptadores posibles | No existe doble de prueba para el repositorio; solo se prueba en sandbox | Media |
| HX-05 | Los puertos usados en bucles exponen operación por lote | `obtenerPrecio(articuloId)` llamado por cada línea | Alta por gobernanza |
| HX-06 | El composition root está en el entry point | `new` o `crear()` de adaptadores dentro de casos de uso | Media |
| HX-07 | El contexto de ejecución se filtra en el adaptador primario | El caso de uso consulta `runtime.executionContext` | Media |
| HX-08 | Los adaptadores traducen errores de infraestructura | Un `SSS_*` de NetSuite llega crudo a la regla de negocio | Media |

## 3. Mapa de adaptadores en NetSuite

### Adaptadores primarios

| Tipo de script | Actor | Responsabilidad del adaptador |
|---|---|---|
| User Event | Guardado o carga de registro | Filtrar `context.type` y contexto; mapear `newRecord`; aplicar resultado |
| Client Script | Usuario en el formulario | Mapear `currentRecord`; mostrar mensajes; no bloquear con lógica pesada |
| Suitelet | Usuario en página propia | Traducir `request` y construir la respuesta o el formulario |
| RESTlet | Sistema externo | Validar y traducir el cuerpo; mapear errores a respuestas |
| Map/Reduce | Proceso por lotes | `getInputData` define el universo; `map` y `reduce` delegan por elemento; `summarize` reporta |
| Scheduled | Horario | Igual que Map/Reduce para volúmenes pequeños y lineales |
| Workflow Action | Workflow | Traducir parámetros del workflow y devolver el valor esperado |
| Mass Update | Usuario por lote | Delegar por registro |
| Prueba Jest | Desarrollador o CI | Llamar al caso de uso con adaptadores en memoria |

### Adaptadores secundarios

| Necesidad (puerto) | Adaptador habitual | Consideración |
|---|---|---|
| Leer datos de registros | `N/query` (SuiteQL parametrizado) o `N/search` | Lote y paginación en el adaptador |
| Leer pocos campos de un registro | `search.lookupFields` | Más barato que cargar el registro completo; confirmar costos con el puerto P-01 |
| Escribir registros | `N/record` (`submitFields`, `load`/`save`) | Una escritura por registro; no esconderla en una consulta |
| Integración externa | `N/https` con credenciales en secretos o parámetros | Revisar con el puerto P-02 |
| Archivos | `N/file` | Rutas en parámetros |
| Correo | `N/email` | Destinatarios en parámetros |
| Bitácora | `N/log` o registro personalizado | El dominio recibe un puerto `Bitacora`, no `log` |
| Fecha y hora actual | `new Date()` envuelto en un puerto `Reloj` | Hace deterministas las pruebas de reglas con fecha |

## 4. Definir un puerto en JavaScript

JavaScript no tiene interfaces. El contrato se declara con JSDoc en `domain/` y se garantiza con pruebas de contrato que ejecutan el mismo conjunto de pruebas contra cada adaptador.

```javascript
// domain/puertos.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    /**
     * @typedef {Object} PoliticaRecargo
     * @property {'FIJO_POR_LINEA'|'PORCENTAJE'} tipo
     * @property {number} valor
     */

    /**
     * Puerto secundario: fuente de políticas de recargo.
     * @typedef {Object} PoliticasDeRecargo
     * @property {(clienteIds: number[]) => Map<number, PoliticaRecargo>} obtenerPorClientes
     */

    /**
     * Puerto secundario: bitácora de negocio.
     * @typedef {Object} Bitacora
     * @property {(evento: string, datos: Object) => void} info
     */

    return {};
});
```

## 5. Ejemplo completo por capas

Caso: aplicar recargos a las líneas de una orden de venta según la política del cliente.
Los IDs de campos y registros son ilustrativos; en un proyecto real se verifican con el puerto P-03 o con SuiteQL de solo lectura.

### Dominio: regla pura

```javascript
// domain/recargo.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    const redondear2 = (n) => Math.round(n * 100) / 100;

    /**
     * Un recargo fijo se aplica una vez por línea, no por unidad.
     * @param {{cantidad:number, precioUnitario:number, politica:{tipo:string, valor:number}}} entrada
     * @returns {number}
     */
    const calcularRecargoLinea = ({ cantidad, precioUnitario, politica }) => {
        if (politica.tipo === 'FIJO_POR_LINEA') return redondear2(politica.valor);
        if (politica.tipo === 'PORCENTAJE') return redondear2(cantidad * precioUnitario * politica.valor);
        throw new Error(`Tipo de política no soportado: ${politica.tipo}`);
    };

    return { calcularRecargoLinea };
});
```

### Aplicación: caso de uso

```javascript
// application/aplicarRecargos.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['../domain/recargo'], (recargo) => {
    /**
     * @param {{politicas: PoliticasDeRecargo, bitacora: Bitacora}} puertos
     */
    const crear = ({ politicas, bitacora }) => ({
        /**
         * @param {{clienteId:number, lineas:Array<{indice:number, cantidad:number, precioUnitario:number}>}} orden
         */
        ejecutar(orden) {
            const politica = politicas.obtenerPorClientes([orden.clienteId]).get(orden.clienteId);
            if (!politica) return { aplicado: false, lineas: [] };

            const lineas = orden.lineas.map((l) => ({
                indice: l.indice,
                recargo: recargo.calcularRecargoLinea({ ...l, politica }),
            }));
            bitacora.info('recargos.calculados', { clienteId: orden.clienteId, lineas: lineas.length });
            return { aplicado: true, lineas };
        },
    });

    return { crear };
});
```

### Infraestructura: adaptador secundario

```javascript
// infrastructure/politicasDeRecargoSuiteQL.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/query'], (query) => {
    const crear = () => ({
        obtenerPorClientes(clienteIds) {
            const resultado = new Map();
            if (!clienteIds.length) return resultado;

            const marcadores = clienteIds.map(() => '?').join(', ');
            const filas = query.runSuiteQL({
                query: `SELECT custrecord_pr_cliente AS clienteid,
                               custrecord_pr_tipo    AS tipo,
                               custrecord_pr_valor   AS valor
                          FROM customrecord_politica_recargo
                         WHERE isinactive = 'F'
                           AND custrecord_pr_cliente IN (${marcadores})`,
                params: clienteIds,
            }).asMappedResults();

            filas.forEach((f) => resultado.set(Number(f.clienteid), { tipo: f.tipo, valor: Number(f.valor) }));
            return resultado;
        },
    });

    return { crear };
});
```

### Infraestructura: mapeo entre registro y dominio

```javascript
// infrastructure/mapeoOrdenVenta.js
/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    const CAMPO = Object.freeze({ RECARGO: 'custcol_recargo' });

    const desdeRegistro = (rec) => {
        const total = rec.getLineCount({ sublistId: 'item' });
        const lineas = [];
        for (let i = 0; i < total; i += 1) {
            lineas.push({
                indice: i,
                cantidad: Number(rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i })),
                precioUnitario: Number(rec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i })),
            });
        }
        return { clienteId: Number(rec.getValue({ fieldId: 'entity' })), lineas };
    };

    const escribirRecargos = (rec, resultado) => {
        resultado.lineas.forEach((l) =>
            rec.setSublistValue({ sublistId: 'item', fieldId: CAMPO.RECARGO, line: l.indice, value: l.recargo }));
    };

    return { desdeRegistro, escribirRecargos };
});
```

### Entry point: adaptador primario y composition root

```javascript
// entrypoints/ue_recargos_orden.js
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([
    'N/log',
    '../application/aplicarRecargos',
    '../infrastructure/politicasDeRecargoSuiteQL',
    '../infrastructure/mapeoOrdenVenta',
], (log, aplicarRecargos, politicasSuiteQL, mapeo) => {
    const EVENTOS = ['create', 'edit'];

    const beforeSubmit = (context) => {
        if (!EVENTOS.includes(context.type)) return;

        const casoDeUso = aplicarRecargos.crear({
            politicas: politicasSuiteQL.crear(),
            bitacora: { info: (evento, datos) => log.audit({ title: evento, details: datos }) },
        });

        const resultado = casoDeUso.ejecutar(mapeo.desdeRegistro(context.newRecord));
        if (resultado.aplicado) mapeo.escribirRecargos(context.newRecord, resultado);
    };

    return { beforeSubmit };
});
```

Qué se ganó frente a un User Event de un solo archivo:

| Beneficio | Evidencia en el ejemplo |
|---|---|
| La regla se prueba sin NetSuite | `domain/recargo.js` no importa `N/` |
| El caso de uso se prueba con dobles en memoria | Recibe `politicas` y `bitacora` como parámetros |
| La consulta es por lote | `obtenerPorClientes` recibe arreglo; un Map/Reduce puede reutilizarla |
| La regla se reutiliza en Client Script | Un `cs_*.js` puede importar `domain/recargo` y mostrar el recargo antes de guardar |
| Los IDs viven en un solo lugar | `CAMPO` en el mapeo; la consulta en el adaptador |

## 6. Diferencias con Clean Architecture

| Aspecto | Hexagonal | Clean Architecture |
|---|---|---|
| Forma | Simétrica: lado primario y secundario, sin capas internas prescritas | Círculos concéntricos con capas nombradas |
| Énfasis | Aislar la aplicación de los actores y de la tecnología | Dirección de las dependencias y separación de políticas |
| Uso combinado | Hexagonal define los bordes; Clean Architecture organiza el interior en `domain/` y `application/` | — |
