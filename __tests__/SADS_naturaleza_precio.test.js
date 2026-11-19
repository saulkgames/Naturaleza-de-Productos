const fs = require('fs');
const path = require('path');

const precio = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_precio');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain', 'SADS_naturaleza_precio.js'
);

// U-1: caso sintético de control del plan (sección 1).
const CASO_SINTETICO = Object.freeze({
    precioCotizacion: 25,
    tipoCambio: 1,
    conversion: 6.1,
    peso: 6.1,
    porcentajeFlete: 0,
    porcentajeManiobras: 0,
    porcentajeSeguro: 0,
    fletePorKg: 0.35,
    maniobraPorKg: 0.2,
    cargoCompensatorio: null,
    margen: 20
});

// U-4: caso con porcentajes, cotización en moneda extranjera y cargo compensatorio.
const CASO_CON_PORCENTAJES = Object.freeze({
    precioCotizacion: 1.1,
    tipoCambio: 18,
    conversion: 30,
    peso: 30,
    porcentajeFlete: 2,
    porcentajeManiobras: 1,
    porcentajeSeguro: 0.5,
    fletePorKg: 0.35,
    maniobraPorKg: 0.2,
    cargoCompensatorio: 5,
    margen: 25
});

const ETIQUETAS = Object.freeze({
    precioCotizacion: 'Precio Base de Cálculo de la familia de precios',
    tipoCambio: 'Tipo de cambio de la moneda de cotización',
    conversion: 'Conversión de unidad de cotización a base',
    peso: 'Peso',
    porcentajeFlete: '% Flete de la plantilla',
    porcentajeManiobras: '% Maniobras de la plantilla',
    porcentajeSeguro: '% Cargos Seguro de la plantilla',
    fletePorKg: 'Flete p/kg de la plantilla',
    maniobraPorKg: 'Maniobra p/kg de la plantilla',
    margen: 'Margen de la familia de márgenes'
});

const con = (ajustes) => Object.assign({}, CASO_SINTETICO, ajustes);

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba un error');
};

const esperarPrecioInvalido = (entradas) => {
    const error = capturarError(() => precio.calcular(entradas));
    expect(error.name).toBe('PRECIO_INVALIDO');
    expect(error.esErrorDeDominio).toBe(true);
    return error.message;
};

describe('estructura del módulo', () => {
    const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');

    test('el define solo declara el módulo de formato y el archivo no referencia módulos N/', () => {
        const definicion = fuente.match(/define\(\s*\[([^\]]*)\]/);
        expect(definicion[1].trim()).toBe("'./SADS_naturaleza_config_formato'");
        expect(fuente).not.toMatch(/['"]N\//);
        expect(fuente).not.toMatch(/\?\./);
        expect(fuente).not.toMatch(/\?\?/);
    });

    test('exporta las funciones de la especificación', () => {
        expect(Object.keys(precio).sort()).toEqual(['ERRORES', 'TOLERANCIA', 'calcular', 'coincide', 'redondearACuarto']);
        expect(precio.TOLERANCIA).toBe(0.005);
    });
});

describe('calcular (RN4-01, RN4-04)', () => {
    test('U-1: caso sintético con su desglose', () => {
        const resultado = precio.calcular(CASO_SINTETICO);
        expect(resultado.precioUnitarioBase).toBeCloseTo(152.5, 10);
        expect(resultado.totalFletes).toBeCloseTo(2.135, 10);
        expect(resultado.totalManiobras).toBeCloseTo(1.22, 10);
        expect(resultado.cargos).toBeCloseTo(3.355, 10);
        expect(resultado.precioMasCargos).toBeCloseTo(155.855, 10);
        expect(resultado.importeSeguro).toBe(0);
        expect(resultado.precioSinMargen).toBeCloseTo(155.855, 10);
        expect(resultado.utilidad).toBeCloseTo(38.96375, 10);
        expect(resultado.precioFinal).toBe(195);
    });

    test('U-4: porcentajes sobre P × TC sin conversión (H-01), seguro sobre precio más cargos y cargo compensatorio', () => {
        const resultado = precio.calcular(CASO_CON_PORCENTAJES);
        expect(resultado.precioUnitarioBase).toBeCloseTo(594, 10);
        expect(resultado.totalFletes).toBeCloseTo(10.5 + 0.396, 10);
        expect(resultado.totalManiobras).toBeCloseTo(6 + 0.198, 10);
        expect(resultado.precioMasCargos).toBeCloseTo(611.094, 10);
        expect(resultado.importeSeguro).toBeCloseTo(3.05547, 10);
        expect(resultado.precioSinMargen).toBeCloseTo(614.14947, 10);
        expect(resultado.utilidad).toBeCloseTo(204.71649, 8);
        expect(resultado.precioFinal).toBe(824);
    });

    test('acepta números como texto, como los devuelve SuiteQL', () => {
        const comoTexto = {};
        Object.keys(CASO_SINTETICO).forEach((llave) => {
            comoTexto[llave] = CASO_SINTETICO[llave] === null ? '' : String(CASO_SINTETICO[llave]);
        });
        expect(precio.calcular(comoTexto).precioFinal).toBe(195);
    });

    test('el margen 0 deja la utilidad en 0', () => {
        const resultado = precio.calcular(con({ margen: 0 }));
        expect(resultado.utilidad).toBe(0);
        expect(resultado.precioFinal).toBe(156);
    });

    test('el cargo compensatorio se suma después de la utilidad', () => {
        expect(precio.calcular(con({ cargoCompensatorio: 0.04 })).precioFinal).toBe(195);
        expect(precio.calcular(con({ cargoCompensatorio: 0.24 })).precioFinal).toBe(195.25);
    });
});

describe('datos faltantes (RN4-02)', () => {
    Object.keys(ETIQUETAS).forEach((llave) => {
        test(`sin ${llave} no calcula y nombra el dato`, () => {
            [null, undefined, '', '  ', 'abc'].forEach((valor) => {
                expect(esperarPrecioInvalido(con({ [llave]: valor })))
                    .toBe(`Faltan datos para calcular el precio: ${ETIQUETAS[llave]}.`);
            });
        });
    });

    test('lista todos los datos faltantes en orden fijo', () => {
        expect(esperarPrecioInvalido(con({ margen: null, precioCotizacion: '', peso: undefined })))
            .toBe('Faltan datos para calcular el precio: Precio Base de Cálculo de la familia de precios, Peso, '
                + 'Margen de la familia de márgenes.');
        expect(esperarPrecioInvalido(undefined)).toMatch(/^Faltan datos para calcular el precio: /);
    });

    test('el cargo compensatorio vacío cuenta como 0 (NVL)', () => {
        [null, undefined, ''].forEach((valor) => {
            expect(precio.calcular(con({ cargoCompensatorio: valor })).precioFinal).toBe(195);
        });
    });

    test('los mensajes no usan ";" (separador de mensajes del Suitelet)', () => {
        expect(esperarPrecioInvalido(con({ margen: null, peso: null }))).not.toMatch(/;/);
    });
});

describe('márgenes y precios no válidos (RN4-03)', () => {
    test('margen de 100 o mayor', () => {
        [100, 120].forEach((margen) => {
            expect(esperarPrecioInvalido(con({ margen }))).toBe('El margen de la familia de márgenes debe ser menor que 100.');
        });
    });

    test('margen 99.9 sí calcula', () => {
        expect(precio.calcular(con({ margen: 99.9 })).precioFinal).toBeGreaterThan(0);
    });

    test('precio final cero o negativo', () => {
        const sinPrecio = con({ precioCotizacion: 0, fletePorKg: 0, maniobraPorKg: 0 });
        expect(esperarPrecioInvalido(sinPrecio)).toBe('El precio calculado debe ser mayor que cero.');
        expect(esperarPrecioInvalido(con({ precioCotizacion: -30 }))).toBe('El precio calculado debe ser mayor que cero.');
    });

    test('precio de cotización 0 con cargos produce precio positivo', () => {
        expect(precio.calcular(con({ precioCotizacion: 0 })).precioFinal).toBe(4.25);
    });
});

describe('redondearACuarto (RN4-05)', () => {
    test('un múltiplo exacto de 0.25 se conserva', () => {
        [0.25, 1, 195, 195.75, 824].forEach((valor) => {
            expect(precio.redondearACuarto(valor)).toBe(valor);
        });
    });

    test('cualquier excedente visible sube al siguiente cuarto', () => {
        expect(precio.redondearACuarto(195.0000003)).toBe(195.25);
        expect(precio.redondearACuarto(194.81875)).toBe(195);
        expect(precio.redondearACuarto(195.01)).toBe(195.25);
        expect(precio.redondearACuarto(195.26)).toBe(195.5);
    });

    test('el ruido menor a 1e-6 después de multiplicar por 4 no sube', () => {
        expect(precio.redondearACuarto(195.0000001)).toBe(195);
        expect(precio.redondearACuarto(0.1 + 0.2 + 0.2)).toBe(0.5);
    });
});

describe('coincide (RN4-08)', () => {
    test('dentro de la tolerancia', () => {
        expect(precio.coincide(195, 195)).toBe(true);
        expect(precio.coincide(195, '195.00')).toBe(true);
        expect(precio.coincide(195, 195.005)).toBe(true);
        expect(precio.coincide(195, 194.995)).toBe(true);
    });

    test('fuera de la tolerancia o sin número', () => {
        expect(precio.coincide(195, 195.25)).toBe(false);
        expect(precio.coincide(195, 195.0051)).toBe(false);
        expect(precio.coincide(195, null)).toBe(false);
        expect(precio.coincide(195, '')).toBe(false);
        expect(precio.coincide(undefined, 195)).toBe(false);
    });
});
