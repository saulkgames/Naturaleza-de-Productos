const fs = require('fs');
const path = require('path');

const corte = require('SuiteScripts/SADS_Naturaleza_Productos/domain/SADS_naturaleza_corte');

const RUTA_MODULO = path.join(
    __dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SADS_Naturaleza_Productos', 'domain', 'SADS_naturaleza_corte.js'
);

const LADOS = Object.freeze(['lado_a', 'lado_b']);
const LARGO = Object.freeze(['largo']);

// Ejemplos del usuario (2026-11-19): nombre, parámetros, valores, orden del espesor, valor de unidades y espesor esperados.
const EJEMPLOS = [
    ["Lamina Negra 4' x 10' C18", LADOS, { lado_a: 4, lado_b: 10 }, 0.0478, 40, '0.0478'],
    ['Placa Acero TA36 6\' x 20\' 1"', LADOS, { lado_a: 6, lado_b: 20 }, 1, 120, '1'],
    ["Lamina Negra 3' x 10' C20", LADOS, { lado_a: 3, lado_b: 10 }, 0.0359, 30, '0.0359'],
    ['Placa Acero TA36 2\' x 5\' 1/2"', LADOS, { lado_a: 2, lado_b: 5 }, 0.5, 10, '0.5'],
    ['PTR 1" x 1/2" Cal.18 a 6.00m', LARGO, { largo: 6 }, 0.0478, 6, '0.0478'],
    ['Media Pieza PTR 1" x 1/2" Cal.18 a 3.00m', LARGO, { largo: 3 }, 0.0478, 3, '0.0478'],
    ['PTR 1" x 1/2" Cal.18 a 1.00m', LARGO, { largo: 1 }, 0.0478, 1, '0.0478'],
    ['Media Pieza PTR 2 1/2" x 2 1/2" Cal.10 a 3.00m', LARGO, { largo: 3 }, 0.1345, 3, '0.1345']
];

const capturarError = (funcion) => {
    try {
        funcion();
    } catch (error) {
        return error;
    }
    throw new Error('Se esperaba un error');
};

describe('estructura del módulo', () => {
    test('depende solo del dominio y exporta la especificación', () => {
        const fuente = fs.readFileSync(RUTA_MODULO, 'utf8');
        expect(fuente.match(/define\(\s*\[([^\]]*)\]/)[1].trim()).toBe("'./SADS_naturaleza_config_formato', './SADS_naturaleza_patron'");
        expect(fuente).not.toMatch(/['"]N\//);
        expect(Object.keys(corte).sort()).toEqual(['ERRORES', 'calcularValorDeUnidades', 'leerParametrosDeValor', 'textoDeEspesor']);
    });
});

describe('ejemplos del usuario', () => {
    EJEMPLOS.forEach(([nombre, ids, valores, orden, valor, espesor]) => {
        test(`${nombre}: valor ${valor}, espesor ${espesor}`, () => {
            expect(corte.calcularValorDeUnidades({ ids, valores })).toBe(valor);
            expect(corte.textoDeEspesor(orden)).toBe(espesor);
        });
    });
});

describe('calcularValorDeUnidades (RN6-03)', () => {
    test('redondea el ruido de punto flotante a 6 decimales', () => {
        expect(corte.calcularValorDeUnidades({ ids: LADOS, valores: { lado_a: 0.1, lado_b: 3 } })).toBe(0.3);
    });

    test('valor faltante o lista vacía', () => {
        [{ ids: LADOS, valores: { lado_a: 4 } }, { ids: [], valores: {} }, {}].forEach((datos) => {
            expect(capturarError(() => corte.calcularValorDeUnidades(datos)).name).toBe('CORTE_INVALIDO');
        });
    });
});

describe('leerParametrosDeValor (RN6-02)', () => {
    const IDS = ['custitem_a', 'custitem_b', 'custitem_espesor'];

    test('lista válida', () => {
        expect(corte.leerParametrosDeValor('["custitem_a","custitem_b"]', IDS))
            .toEqual({ valido: true, errores: [], ids: ['custitem_a', 'custitem_b'] });
    });

    test('vacío, no JSON o ID ajeno', () => {
        ['', null, 'custitem_a', '[]'].forEach((texto) => {
            expect(corte.leerParametrosDeValor(texto, IDS).errores)
                .toEqual(['Parámetros para Valor de Unidades: capture una lista JSON de IDs de la configuración.']);
        });
        expect(corte.leerParametrosDeValor('["custitem_a","custitem_x","Mal ID"]', IDS).errores).toEqual([
            'Parámetros para Valor de Unidades: custitem_x no es un ID de la configuración.',
            'Parámetros para Valor de Unidades: un ID no pertenece a la configuración.'
        ]);
    });
});
