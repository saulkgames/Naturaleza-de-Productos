// Los objetos que se despliegan no deben depender de IDs generados por una cuenta (por ejemplo, el sandbox),
// para que el proyecto se instale en producción sin referencias rotas ni registros duplicados.
const fs = require('fs');
const path = require('path');

const RAIZ_SRC = path.join(__dirname, '..', 'src');
const RUTA_DEPLOY = path.join(RAIZ_SRC, 'deploy.xml');

// scriptid generado por NetSuite: val_<número>_<cuenta>[_sb1]_<número>.
const PATRON_ID_DE_CUENTA = /^val_[0-9]+_[0-9]+/;
const PATRON_ID_NUMERICO = /^[0-9]+$/;

// Registros de familias DRT (otra personalización) referenciados por las líneas de familia.
// Verificados por el usuario el 2026-11-19: existen en producción con el mismo scriptid.
// Una familia nueva se agrega aquí solo después de verificar su scriptid en ambas cuentas.
const REFERENCIAS_EXTERNAS_VERIFICADAS = Object.freeze([
    'customrecord_pfp_famprecios.val_26730_5490848_sb1_968',
    'customrecord_pfp_famprecios.val_135356_5490848_790',
    'customrecord_pfp_famprecios.val_26685_5490848_sb1_980',
    'customrecord_pfp_famprecios.val_26687_5490848_sb1_614',
    'customrecord_pfp_famprecios.val_263837_5490848_945',
    'customrecord_pfp_famprecios.val_26688_5490848_sb1_408',
    'customrecord_pfp_famprecios.val_26689_5490848_sb1_515',
    'customrecord_pfp_fammargenes_.val_5474627_5490848_847',
    'customrecord_pfp_fammargenes_.val_5522235_5490848_713',
    'customrecord_pfp_fammargenes_.val_6067916_5490848_922',
    // Lámina Negra: verificadas por el usuario el 2026-11-19.
    'customrecord_pfp_famprecios.val_26682_5490848_sb1_726',
    'customrecord_pfp_famprecios.val_135478_5490848_666',
    'customrecord_pfp_famprecios.val_26683_5490848_sb1_769',
    'customrecord_pfp_famprecios.val_135481_5490848_142',
    'customrecord_pfp_famprecios.val_135477_5490848_178',
    'customrecord_pfp_famprecios.val_135479_5490848_671',
    'customrecord_pfp_famprecios.val_135480_5490848_658',
    'customrecord_pfp_fammargenes_.val_5500436_5490848_831'
]);

const carpetasDesplegadas = () => {
    const deploy = fs.readFileSync(RUTA_DEPLOY, 'utf8');
    const objetos = deploy.match(/<objects>([\s\S]*?)<\/objects>/)[1];
    return Array.from(objetos.matchAll(/<path>~\/(Objects\/[^<*]+?)\/?\*?<\/path>/g)).map((coincidencia) => coincidencia[1]);
};

const archivosXml = (carpeta) => {
    const ruta = path.join(RAIZ_SRC, carpeta);
    return fs.readdirSync(ruta, { withFileTypes: true }).reduce((archivos, entrada) => {
        const completa = path.join(carpeta, entrada.name);
        if (entrada.isDirectory()) return archivos.concat(archivosXml(completa));
        return entrada.name.endsWith('.xml') ? archivos.concat([completa]) : archivos;
    }, []);
};

const ARCHIVOS = carpetasDesplegadas().reduce((todos, carpeta) => todos.concat(archivosXml(carpeta)), []);

const leer = (archivo) => fs.readFileSync(path.join(RAIZ_SRC, archivo), 'utf8');

const esIdDeCuenta = (id) => PATRON_ID_DE_CUENTA.test(id) || PATRON_ID_NUMERICO.test(id);

// Objeto raíz de cada XML desplegado y los scriptid de sus valores de lista o instancias.
const definiciones = () => ARCHIVOS.reduce((mapa, archivo) => {
    const contenido = leer(archivo);
    const raiz = contenido.match(/^\s*<[a-z]+ scriptid="([^"]+)"/);
    if (raiz === null) return mapa;
    const hijos = Array.from(contenido.matchAll(/<(?:customvalue|instance) scriptid="([^"]+)"/g)).map((coincidencia) => coincidencia[1]);
    return Object.assign(mapa, { [raiz[1]]: (mapa[raiz[1]] || []).concat(hijos) });
}, {});

const referenciasCompuestas = () => ARCHIVOS.reduce((lista, archivo) => lista.concat(
    Array.from(leer(archivo).matchAll(/\[scriptid=([a-z0-9_]+)\.([^\]]+)\]/g))
        .map((coincidencia) => ({ archivo, objeto: coincidencia[1], id: coincidencia[2] }))
), []);

describe('alcance del despliegue', () => {
    test('deploy.xml despliega solo las carpetas propias', () => {
        expect(carpetasDesplegadas()).toEqual(['Objects/Config', 'Objects/Naturalezas', 'Objects/Scripts']);
        expect(ARCHIVOS.length).toBeGreaterThan(0);
    });
});

describe('IDs portables en los objetos desplegados', () => {
    test('ningún scriptid definido tiene formato generado por la cuenta ni es numérico', () => {
        const encontrados = ARCHIVOS.reduce((lista, archivo) => lista.concat(
            Array.from(leer(archivo).matchAll(/scriptid="([^"]+)"/g))
                .map((coincidencia) => coincidencia[1])
                .filter(esIdDeCuenta)
                .map((id) => `${archivo}: ${id}`)
        ), []);
        expect(encontrados).toEqual([]);
    });

    test('ninguna referencia apunta a un ID de cuenta, salvo las familias DRT verificadas en producción', () => {
        const referencias = ARCHIVOS.reduce((lista, archivo) => lista.concat(
            Array.from(leer(archivo).matchAll(/\[scriptid=([a-z0-9_]+)\.([^\]]+)\]/g))
                .map((coincidencia) => ({ archivo, objeto: coincidencia[1], id: coincidencia[2] }))
        ), []);
        const deCuenta = referencias.filter((referencia) => esIdDeCuenta(referencia.id));
        const noPermitidas = deCuenta
            .map((referencia) => `${referencia.objeto}.${referencia.id}`)
            .filter((referencia) => REFERENCIAS_EXTERNAS_VERIFICADAS.indexOf(referencia) === -1);
        expect(noPermitidas).toEqual([]);
        deCuenta.forEach((referencia) => {
            expect(['customrecord_pfp_famprecios', 'customrecord_pfp_fammargenes_']).toContain(referencia.objeto);
        });
    });

    test('la lista de familias verificadas no tiene sobrantes: cada una se usa', () => {
        const contenido = ARCHIVOS.map(leer).join('\n');
        REFERENCIAS_EXTERNAS_VERIFICADAS.forEach((referencia) => {
            expect(contenido).toContain(`[scriptid=${referencia}]`);
        });
    });

    test('cada referencia a un valor o instancia de un objeto del proyecto existe en el proyecto', () => {
        const definidos = definiciones();
        const rotas = referenciasCompuestas()
            .filter((referencia) => REFERENCIAS_EXTERNAS_VERIFICADAS.indexOf(`${referencia.objeto}.${referencia.id}`) === -1)
            .filter((referencia) => !Object.prototype.hasOwnProperty.call(definidos, referencia.objeto)
                || definidos[referencia.objeto].indexOf(referencia.id) === -1)
            .map((referencia) => `${referencia.archivo}: ${referencia.objeto}.${referencia.id}`);
        expect(rotas).toEqual([]);
    });
});
