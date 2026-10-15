# Pruebas en una arquitectura limpia de SuiteScript

Fuentes: Robert C. Martin, *Clean Code* (capítulo de pruebas unitarias) y *Clean Architecture* (límites y pruebas); Michael Feathers, *Working Effectively with Legacy Code* (2004) para pruebas de caracterización. Redacción propia.

## Contenido

1. Qué se prueba en cada capa
2. Herramientas
3. Pruebas de dominio sin dobles
4. Pruebas de casos de uso con adaptadores en memoria
5. Pruebas de contrato de puertos
6. Pruebas de caracterización para código legado
7. Atributos de una buena prueba

## 1. Qué se prueba en cada capa

| Capa | Tipo de prueba | Necesita NetSuite | Necesita dobles de `N/` |
|---|---|---|---|
| `domain/` | Unitaria | No | No |
| `application/` | Unitaria con adaptadores en memoria | No | No |
| `infrastructure/` | Unitaria con dobles de módulos `N/`, más prueba de contrato | No | Sí |
| `entrypoints/` | Prueba ligera de cableado, o manual en sandbox | Opcional | Sí |
| Sistema completo | Prueba en sandbox con datos controlados | Sí | No |

La mayor parte del valor está en las dos primeras filas, y son las más baratas.
Esa es la razón práctica de la regla de dependencia.

## 2. Herramientas

| Herramienta | Uso | Nota |
|---|---|---|
| Jest | Ejecutor de pruebas | — |
| `@oracle/suitecloud-unit-testing` | Configuración de Jest para proyectos SDF y dobles de los módulos `N/` | Verificar versión y alias de rutas en el `jest.config.js` del proyecto; las rutas de importación de los ejemplos dependen de esa configuración |
| Skill `netsuite-sdf-safe-guide`, principio 6 | Guía de Oracle sobre pruebas de SuiteApps | Puerto P-01 |

## 3. Pruebas de dominio sin dobles

```javascript
// __tests__/domain/recargo.test.js
import recargo from 'SuiteScripts/proyecto/domain/recargo';

describe('calcularRecargoLinea', () => {
    test('un recargo fijo se aplica una vez por línea, no por unidad', () => {
        const r = recargo.calcularRecargoLinea({
            cantidad: 10, precioUnitario: 50, politica: { tipo: 'FIJO_POR_LINEA', valor: 25 },
        });
        expect(r).toBe(25);
    });

    test('un recargo porcentual se redondea a dos decimales', () => {
        const r = recargo.calcularRecargoLinea({
            cantidad: 3, precioUnitario: 33.33, politica: { tipo: 'PORCENTAJE', valor: 0.015 },
        });
        expect(r).toBe(1.5);
    });

    test('un tipo de política desconocido se rechaza', () => {
        expect(() => recargo.calcularRecargoLinea({
            cantidad: 1, precioUnitario: 1, politica: { tipo: 'OTRO', valor: 1 },
        })).toThrow('no soportado');
    });
});
```

Cada regla de negocio del plan (RN-xx) debería tener al menos una prueba en esta capa.

## 4. Pruebas de casos de uso con adaptadores en memoria

```javascript
// __tests__/application/aplicarRecargos.test.js
import aplicarRecargos from 'SuiteScripts/proyecto/application/aplicarRecargos';

const politicasEnMemoria = (datos) => ({
    obtenerPorClientes: (ids) => new Map(ids.filter((id) => datos[id]).map((id) => [id, datos[id]])),
});
const bitacoraNula = { info: () => {} };

test('sin política para el cliente no se aplica recargo', () => {
    const casoDeUso = aplicarRecargos.crear({ politicas: politicasEnMemoria({}), bitacora: bitacoraNula });
    const r = casoDeUso.ejecutar({ clienteId: 7, lineas: [{ indice: 0, cantidad: 1, precioUnitario: 10 }] });
    expect(r).toEqual({ aplicado: false, lineas: [] });
});
```

Los adaptadores en memoria son objetos simples.
No se necesitan bibliotecas de mocks porque el caso de uso depende de puertos, no de `N/`.

## 5. Pruebas de contrato de puertos

Garantizan la sustitución de Liskov (CA-04): el adaptador real y el de pruebas se comportan igual ante las mismas entradas.

```javascript
// __tests__/contratos/politicasDeRecargo.contrato.js
export const contratoPoliticasDeRecargo = (nombre, crearAdaptador) => {
    describe(`Contrato PoliticasDeRecargo: ${nombre}`, () => {
        test('con lista vacía devuelve un Map vacío', () => {
            expect(crearAdaptador().obtenerPorClientes([]).size).toBe(0);
        });
        test('las políticas devueltas tienen tipo y valor numérico', () => {
            const r = crearAdaptador().obtenerPorClientes([1]);
            r.forEach((p) => {
                expect(['FIJO_POR_LINEA', 'PORCENTAJE']).toContain(p.tipo);
                expect(typeof p.valor).toBe('number');
            });
        });
    });
};
```

El contrato se ejecuta contra el adaptador en memoria y contra el adaptador SuiteQL con el doble de `N/query`.

## 6. Pruebas de caracterización para código legado

Una prueba de caracterización no verifica lo que el código debería hacer, sino lo que hace hoy.
Fija el comportamiento antes de refactorizar para detectar cualquier cambio no intencional.

| Paso | Acción |
|---|---|
| 1 | Elegir entradas representativas: casos normales, bordes, datos incompletos y los casos que hoy producen errores conocidos |
| 2 | Si la lógica está atada a `N/`, extraer primero la función con el mínimo cambio posible (sin reescribirla) para poder invocarla |
| 3 | Ejecutar y registrar la salida actual como resultado esperado, aunque parezca incorrecta |
| 4 | Marcar con un comentario las salidas que parecen defectos; se corrigen después, en un cambio aparte |
| 5 | Refactorizar con las pruebas en verde en cada paso |

Si extraer la función ya exige cambios riesgosos, documentar la caracterización como casos manuales en sandbox y avanzar con pasos más pequeños.

## 7. Atributos de una buena prueba

| Atributo | Significado | Señal de incumplimiento |
|---|---|---|
| Rápida | Se ejecuta en segundos | Requiere sandbox para probar una regla |
| Independiente | No depende del orden ni de otras pruebas | Estado compartido entre pruebas |
| Repetible | Mismo resultado en cualquier ambiente | Usa la fecha actual sin un puerto `Reloj` |
| Autoverificable | Pasa o falla sin inspección manual | Revisar el log para saber si funcionó |
| Oportuna | Se escribe junto con el código | Pruebas agregadas meses después |
