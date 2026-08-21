// Panel de precios — TODO lo editable vive acá.
// Ningún número de este archivo debería estar hardcodeado en motor.js ni en perfiles.js.
// Base: LISTA DE PRECIOS MAYO 2026 v3. Precios en USD sin IVA.

export const PRECIOS = {
  version: "mayo-2026-v3",
  actualizado: "2026-08-19",

  ventiladores: {
    tipos: {
      v200: { nombre: "200mm", costo: 25 },
      v250: { nombre: "250mm", costo: 25 },
      v300: { nombre: "300mm", costo: 44 },
      // Sólo cúbico y respaldo de cámara, por casilla. Reemplaza al ventilador
      // por defecto manteniendo la cantidad. 60 × 1,5 = $90.
      v300r: { nombre: "300mm reforzado", costo: 60, soloEn: ["cub", "rcam"] }
    },
    markup: 1.5,
    // Decisión 19/08/2026: en los perfiles con tarifa "fija" el ventilador
    // se cobra siempre a este costo, sin importar el tipo elegido.
    // En los perfiles con tarifa "real" se usa el costo del tipo (v300 = 44 → $66).
    costoFijo: 25
  },

  // $ por sección por metro de ancho
  tarifas: {
    seccionSimple58: 30,      // evaporador estático, respaldar, lateral simple s/ench.
    seccionDoble: 24,         // cúbico, respaldo cámara, columna batea, lateral doble s/ench., techo 5/8"
    compacto38: 20,           // compactos y laterales compactos s/ench., techo 3/8"
    lateralCompactoEnch: 24,  // lateral compacto 3/8" enchapado
    respaldarFactor: 1.04,
    pisoTorteras: { ench3: 97, ench4: 129.33, sc3: 72, sc4: 96 }
  },

  adicionales: {
    // Costados de aluminio. Es el mismo concepto en todos los productos: el importe
    // cambia según cuánto aluminio lleva cada uno. En las versiones enchapadas no se
    // cobran aparte — ya van dentro del precio/metro.
    costadosAluminio: {
      pt: 5,
      oli: 8, fs: 8, fc: 8, t58: 8, t38: 8, da: 8,
      cub: 10, rcam: 10,
      fd: [[5, 8], [7, 12]]      // por secciones: hasta 5 → $8 · 6 y 7 → $12
    },
    salidaCu: 8,
    curvas: 8,                   // techo 3/8"
    curvasPorSeccion: 0.25,      // evaporadores y compactos
    colDistTecho38: 30,
    uniones: 8,                  // columna para batea
    bandeja: { 800: 43.5, 1000: 51.75 }
  },

  // Columnas y distribuidores por HP. Tramos: [hpMax, importe] evaluados en orden.
  colDist: {
    cubico:   [[1.75, 0], [2.5, 30], [4, 40], [5, 45], [6, 50]],
    // Pendiente #3: el cúbico sin enchapar paga $10 más en cada tramo que tiene col/dist.
    // Por debajo de 2HP no lleva col/dist y el +10 tampoco aparece. En respaldo de
    // cámara el col/dist es igual en las dos versiones. Sin confirmar si es a propósito.
    cubicoSC: [[1.75, 0], [2.5, 40], [4, 50], [5, 55], [6, 60]],
    rcam:     [[1.75, 0], [2, 30], [3, 40]]
  },

  // Batería enchapada del cúbico: no tiene fórmula, es tabla. Clave = filasFcolumnasC.
  bateriaCubicoEnchapado: {
    "3F4C": 222, "4F4C": 282, "4F6C": 380, "5F6C": 463, "6F6C": 547
  },

  // $ por metro según secciones — tablas enchapadas publicadas
  precioMetro: {
    lateralDoble:   { 2: 83,  3: 126, 4: 156, 5: 188, 6: 218, 7: 248 },
    lateralSimple:  { 2: 105, 3: 139, 4: 192, 5: 224 },
    dobleAtaque:    { 5: 188, 6: 218, 7: 248 },
    respaldoCamara: { 4: 156, 6: 218, 7: 248, 8: 275, 9: 306, 10: 339, 12: 403, 15: 467 },
    carnicerasSimple: 139,   // 3 secciones simples
    carnicerasDoble:  156    // 4 secciones dobles
  },

  // Condensadores. Precio fijo por modelo, sin fórmula ni medida.
  // El ventilador y la base son opcionales y dependen del modelo.
  condensadores: {
    precio:     { 0.25: 64.80, 0.33: 92.20, 0.5: 119.60, 0.75: 204.50, 1: 266 },
    base:       { 0.25: 15,    0.33: 15,    0.5: 15,     0.75: 20,     1: 20 },
    ventilador: { 0.25: "v200", 0.33: "v200", 0.5: "v200", 0.75: "v300", 1: "v300" }
  },

  // Ajustes nombrados: diferencias contra la lista publicada que no tienen fórmula.
  // Se suman al final y se muestran con nombre en el desglose. Borrables desde el panel.
  ajustes: [
    {
      id: "rcam-2hp-20",
      perfil: "rcam",
      // Decisión 19/08/2026: la lista publica 588,80 y la fórmula da 568,80.
      // Se adopta la lista. El origen del +$20 sigue sin explicarse.
      condicion: { enchapado: true, hp: 2, secDobles: 10 },
      concepto: "Ajuste 2HP s/ explicar (lista mayo 2026)",
      importe: 20
    }
  ],

  // Mínimo y máximo que acepta cada producto. Fuera de esto el motor no cotiza:
  // avisa. Es lo que impide que un error de tipeo salga como precio.
  // (c) = confirmado por Gabriel · el resto son provisorios y se pueden ampliar acá.
  rangos: {
    ev:   { secciones: [3, 16],  ancho: [0.2, 3] },
    oli:  { secciones: [4, 40],  ancho: [0.2, 3] },
    resp: { secciones: [2, 8],   ancho: [0.2, 3] },
    fd:   { secciones: [2, 7],   ancho: [0.3, 1.5] },   // ancho (c): nunca más de 1,50m
    fs:   { secciones: [2, 5],   ancho: [0.3, 1.5] },   // ancho (c)
    fc:   { secciones: [4, 40],  ancho: [0.2, 1.5] },   // ancho (c)
    col:  { secDobles: [1, 20],  ancho: [0.2, 9] },     // ancho (c): las columnas llegan a 9m
    cub:  { ancho: [0.5, 3] },
    rcam: { secDobles: [4, 15],  ancho: [0.5, 3] },
    t58:  { secciones: [4, 20],  ancho: [0.2, 1] },     // ancho (c): nunca más de 1m
    t38:  { secciones: [8, 60],  ancho: [0.2, 1] },     // ancho (c)
    car:  { ancho: [0.5, 3] },
    da:   { secciones: [5, 7],   ancho: [0.5, 0.8] },
    pt:   { secciones: [3, 4],   ancho: [0.5, 2.5] }
  },

  bajaTemperatura: 1.8,   // aplica sobre la base, nunca sobre el embalaje

  venta: {
    ivaPorcentaje: 10.5,
    comisionML: 0.29,     // ML retiene 29% → se divide por 0,71
    dolarOficial: null,   // se persiste; null = todavía sin valor conocido
    dolarML: 1600,        // semilla inicial; se persiste al editarlo
    // Nombres reales de cada columna (19/08/2026). El "+5%" y el "+10,5%" son las
    // dos que ve el cliente: sin factura sale 5,5% más barato que con factura.
    columnas: {
      lista: "Precio de lista",
      m5:    "Sin factura",
      iva:   "Con factura",
      ml:    "MercadoLibre"
    }
  }
};

export function costoVentilador(tipo, tarifa, P = PRECIOS) {
  const v = P.ventiladores.tipos[tipo];
  if (!v) throw new Error(`Ventilador desconocido: ${tipo}`);
  const costo = tarifa === "fija" ? P.ventiladores.costoFijo : v.costo;
  return costo * P.ventiladores.markup;
}

export function tramo(tabla, hp) {
  for (const [hpMax, importe] of tabla) if (hp <= hpMax) return importe;
  return tabla[tabla.length - 1][1];
}

// Piso torteras: cantidad de ventiladores por defecto según ancho. Siempre editable.
// La cantidad es libre en los dos casos: esto es sólo el valor con el que arranca.
export const PT_VENT_CANT = {
  3: a => (a >= 1.6 ? 3 : 2),   // regla de la lista publicada
  4: a => 2                     // siempre 2; la cantidad se elige libre
};

// Ventiladores por defecto. Cantidad por HP; tipo según el producto.
// Los rangos de secciones/ancho son provisionales (pendiente #7): cortan el cálculo
// con un aviso en vez de inventar un precio, que es lo que hacía la v14.
export const VENT_DEFAULTS = {
  cubico: { tipo: hp => (hp <= 1 ? "v250" : "v300"),
            cant: { 0.75: 2, 1: 2, 1.5: 2, 2: 2, 2.5: 2, 3: 3, 4: 3, 5: 4, 6: 5 } },
  // La lista publica 2x250 para 3/4HP y 1HP; la v14 ponía 2x200. Mismo precio ($25),
  // se adopta el texto de la lista.
  rcam:   { tipo: hp => (hp <= 1 ? "v250" : "v300"),
            cant: { 0.5: 2, 0.75: 2, 1: 2, 1.5: 2, 2: 2, 3: 3 } }
};
