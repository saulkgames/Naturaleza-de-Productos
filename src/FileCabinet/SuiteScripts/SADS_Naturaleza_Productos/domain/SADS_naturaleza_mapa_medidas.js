/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Mapa de medidas del proveedor (PTR rectangular). La medida elegida llena el lado mayor y el lado menor
 * del artículo y aporta el código del proveedor al marcador {mapa:codigo} (RN5-01 a RN5-05).
 * Módulo de dominio: no importa módulos de NetSuite.
 */
define(['./SADS_naturaleza_config_formato'], (formato) => {
    /**
     * Nombres de los errores de dominio del módulo. Cada valor es igual a su llave.
     * @type {Readonly<{MAPA_INVALIDO: string}>}
     */
    const ERRORES = Object.freeze({
        MAPA_INVALIDO: 'MAPA_INVALIDO'
    });

    /**
     * ID reservado del marcador del mapa en los patrones: {mapa:codigo} y {mapa:texto}.
     * @type {string}
     */
    const MARCADOR = 'mapa';

    const PATRON_CODIGO = /^[0-9A-Za-z]+$/;
    const MILLONESIMAS = 1000000;

    const MENSAJES = Object.freeze({
        SIN_MEDIDAS: 'El mapa de medidas no tiene medidas activas.',
        MEDIDA_INVALIDA: (nombre) => `La medida ${nombre} del mapa necesita lado mayor y lado menor mayores que 0 y un código de letras y dígitos.`,
        LADOS_INVERTIDOS: (nombre) => `La medida ${nombre} del mapa tiene el lado menor mayor que el lado mayor.`,
        CODIGO_REPETIDO: (codigo) => `El código ${codigo} se repite en el mapa de medidas.`,
        MEDIDA_REPETIDA: (nombre) => `La medida ${nombre} se repite en el mapa de medidas.`,
        NO_ENCONTRADA: 'La medida elegida no está en el mapa de medidas.'
    });

    const aCadena = (valor) => (valor === null || valor === undefined ? '' : String(valor).trim());

    const esPositivo = (valor) => typeof valor === 'number' && Number.isFinite(valor) && valor > 0;

    const claveDeLados = (fila) => `${Math.round(fila.ladoMayor * MILLONESIMAS)}x${Math.round(fila.ladoMenor * MILLONESIMAS)}`;

    const nombreDe = (fila) => (aCadena(fila.nombre) === '' ? aCadena(fila.id) : aCadena(fila.nombre));

    /**
     * Valida las filas del mapa (RN5-02). No lanza errores.
     * @param {Array<{id: string, nombre: string, ladoMayor: ?number, ladoMenor: ?number, codigo: string}>} filas
     * @returns {{valido: boolean, errores: string[]}}
     */
    const validarFilas = (filas) => {
        const lista = Array.isArray(filas) ? filas : [];
        if (lista.length === 0) return { valido: false, errores: [MENSAJES.SIN_MEDIDAS] };
        const errores = [];
        const codigos = [];
        const lados = [];
        lista.forEach((fila) => {
            const codigo = aCadena(fila.codigo);
            if (!esPositivo(fila.ladoMayor) || !esPositivo(fila.ladoMenor) || !PATRON_CODIGO.test(codigo)) {
                errores.push(MENSAJES.MEDIDA_INVALIDA(nombreDe(fila)));
                return;
            }
            if (fila.ladoMenor > fila.ladoMayor) errores.push(MENSAJES.LADOS_INVERTIDOS(nombreDe(fila)));
            if (codigos.indexOf(codigo) !== -1) errores.push(MENSAJES.CODIGO_REPETIDO(codigo));
            if (lados.indexOf(claveDeLados(fila)) !== -1) errores.push(MENSAJES.MEDIDA_REPETIDA(nombreDe(fila)));
            codigos.push(codigo);
            lados.push(claveDeLados(fila));
        });
        return { valido: errores.length === 0, errores };
    };

    /**
     * Busca la medida elegida por su ID interno (RN5-03).
     * @param {Object[]} filas - Filas del mapa.
     * @param {*} id - ID interno elegido.
     * @returns {Object} La fila encontrada.
     * @throws {Error} MAPA_INVALIDO si el ID no está en el mapa.
     */
    const buscar = (filas, id) => {
        const lista = Array.isArray(filas) ? filas : [];
        const encontradas = lista.filter((fila) => aCadena(fila.id) !== '' && aCadena(fila.id) === aCadena(id));
        if (encontradas.length !== 1) throw formato.crearErrorDeDominio(ERRORES.MAPA_INVALIDO, MENSAJES.NO_ENCONTRADA);
        return encontradas[0];
    };

    /**
     * Valores de los campos del artículo que llena la medida (RN5-03).
     * @param {Object} fila - Medida elegida.
     * @param {{mayor: string, menor: string}} campos - IDs de campo del lado mayor y del lado menor.
     * @returns {Object<string, number>}
     */
    const valoresDe = (fila, campos) => ({ [campos.mayor]: fila.ladoMayor, [campos.menor]: fila.ladoMenor });

    /**
     * Textos del marcador {mapa:codigo} y {mapa:texto} (RN5-04).
     * @param {Object} fila - Medida elegida.
     * @returns {Object<string, {codigo: string, texto: string}>}
     */
    const textosDe = (fila) => ({ [MARCADOR]: { codigo: aCadena(fila.codigo), texto: aCadena(fila.nombre) } });

    return {
        ERRORES,
        MARCADOR,
        validarFilas,
        buscar,
        valoresDe,
        textosDe
    };
});
