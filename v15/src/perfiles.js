// Los 14 productos, cada uno como perfil de datos. Ninguno es una rama de if/else
// del motor: el motor sólo sabe sumar batería + ventiladores + adicionales.

import { PRECIOS, VENT_DEFAULTS, PT_VENT_CANT, tramo } from "./precios.js";
import { redondeo075, VENT_CERO, fmtHP, fmtM } from "./motor.js";

const v = (tipo, cant) => ({ ...VENT_CERO, [tipo]: cant });
const num = n => String(n).replace(".", ",");   // 0.9 → 0,9 en el desglose

// Medida que sale en el texto al cliente: "5 sec x 0,40m". Los productos que no la
// declaran no la muestran: cúbico, respaldo de cámara, carniceras, condensador y los
// dos de techo — en el techo el ancho es el de la batería, igual en todos los modelos,
// así que no le dice nada al cliente.
const medidaSec = e => `${e.secciones} sec x ${fmtM(e.ancho)}m`;
const medidaDobles = e => `${e.secDobles} sec x ${fmtM(e.ancho)}m`;

// Campos de entrada de cada producto, como datos. La pantalla los dibuja sola.
const N = (id, label, step = 0.01, si) => ({ id, label, tipo: "num", step, si });
const S = (id, label, opciones, si) => ({ id, label, tipo: "select", opciones, si });
const A = () => ({ id: "ancho", label: "Ancho de batería", tipo: "num", step: 0.01, unidad: "m" });
const HP = lista => S("hp", "HP", lista.map(h => [h, fmtHP(h)]));
const BANDEJA = () => S("bandeja", "Bandeja plástica", [[800, "800 mm"], [1000, "1000 mm"]], e => e.enchapado);
const sinVent = () => ({ ...VENT_CERO });

function deTabla(tabla, clave, avisos, que) {
  const val = tabla[clave];
  if (val === undefined) {
    avisos.push({ nivel: "error", msg: `${que}: no hay precio publicado para ${clave}. Cargalo en el panel antes de cotizar.` });
    return 0;
  }
  return val;
}

export const PERFILES = {

  ev: {
    id: "ev", nombre: "Evaporador estático 5/8\"", familia: "estatico",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1), A()],
    ventDefault: sinVent,
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.seccionSimple58 }),
    adicionales: (e, P) => [
      { concepto: "Curvas", importe: e.secciones * P.adicionales.curvasPorSeccion },
      { concepto: "Markup por tamaño", importe: tramo([[5, 4], [8, 6], [12, 8], [14, 10], [16, 12]], e.secciones) }
    ],
    ajustePost: base => redondeo075(base)
  },

  oli: {
    id: "oli", nombre: "Evaporador estático compacto 3/8\"", familia: "estatico",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1), A()],
    ventDefault: sinVent,
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.compacto38 }),
    adicionales: (e, P) => [
      { concepto: "Curvas", importe: e.secciones * P.adicionales.curvasPorSeccion },
      { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.oli }
    ]
  },

  resp: {
    id: "resp", nombre: "Respaldar estático 5/8\"", familia: "estatico",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1), A()],
    ventDefault: sinVent,
    bateria: (e, P) => ({
      concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m (× ${P.tarifas.respaldarFactor})`,
      importe: e.secciones * P.tarifas.seccionSimple58 * e.ancho * P.tarifas.respaldarFactor
    })
  },

  fd: {
    id: "fd", nombre: "Forzador lateral doble 5/8\"", familia: "lateral",
    medida: medidaSec,
    campos: [N("secciones","Secciones dobles",1), A()],
    chapa: true,
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v200", 1) : sinVent()),
    bateria: (e, P, av) => e.enchapado
      ? { concepto: `Batería enchapada ${e.secciones} sec × ${num(e.ancho)}m`, importe: deTabla(P.precioMetro.lateralDoble, e.secciones, av, "Lateral doble") * e.ancho }
      : { concepto: `Batería ${e.secciones} sec dobles × ${num(e.ancho)}m`, importe: e.secciones * P.tarifas.seccionDoble * e.ancho },
    // Los costados ya están dentro del precio/metro enchapado: no se suman.
    adicionales: (e, P) => e.enchapado ? [] : [
      { concepto: "Costados de aluminio", importe: tramo(P.adicionales.costadosAluminio.fd, e.secciones) }
    ]
  },

  fs: {
    id: "fs", nombre: "Forzador lateral simple 5/8\"", familia: "lateral",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1), A()],
    chapa: true,
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v200", 1) : sinVent()),
    bateria: (e, P, av) => e.enchapado
      ? { concepto: `Batería enchapada ${e.secciones} sec × ${num(e.ancho)}m`, importe: deTabla(P.precioMetro.lateralSimple, e.secciones, av, "Lateral simple") * e.ancho }
      : { concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * P.tarifas.seccionSimple58 * e.ancho },
    adicionales: (e, P) => e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.fs }]
  },

  fc: {
    id: "fc", nombre: "Forzador lateral compacto 3/8\"", familia: "lateral",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1), A()],
    chapa: true,
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v250", 1) : sinVent()),
    bateria: (e, P) => ({
      concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`,
      importe: e.secciones * e.ancho * (e.enchapado ? P.tarifas.lateralCompactoEnch : P.tarifas.compacto38)
    }),
    adicionales: (e, P) => [
      { concepto: "Curvas", importe: e.secciones * P.adicionales.curvasPorSeccion },
      ...(e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.fc }])
    ]
  },

  col: {
    id: "col", nombre: "Columna para batea 5/8\"", familia: "columna",
    medida: medidaDobles,
    campos: [N("secDobles","Secciones dobles",1), A(), N("uniones","Uniones",1)],
    defaults: { uniones: 0 },
    ventDefault: sinVent,
    bateria: (e, P) => ({ concepto: `Batería ${e.secDobles} sec dobles × ${num(e.ancho)}m`, importe: e.secDobles * e.ancho * P.tarifas.seccionDoble }),
    adicionales: (e, P) => [{ concepto: `Uniones (${e.uniones})`, importe: e.uniones * P.adicionales.uniones }]
  },

  cub: {
    id: "cub", nombre: "Forzador cúbico de cámara", familia: "camara",
    campos: [HP([0.75,1,1.5,2,2.5,3,4,5,6]),
      S("bateria","Batería", ["3F4C","4F4C","4F6C","5F6C","6F6C"].map(k => [k, k]), e => e.enchapado),
      N("secDobles","Secciones dobles",1, e => !e.enchapado), A()],
    chapa: true, bajaTemp: true, reforzable: true,
    ventTipos: ["v250", "v300", "v300r"],
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "real",
    ventDefault: (e) => {
      if (!e.enchapado) return sinVent();
      const d = VENT_DEFAULTS.cubico, cant = d.cant[e.hp] || 0;
      // Al tildar reforzado se van los ventiladores por defecto y entran N reforzados.
      // N arranca en la cantidad del modelo pero se elige a mano.
      return e.reforzado ? v("v300r", e.cantReforzados ?? cant) : v(d.tipo(e.hp), cant);
    },
    bateria: (e, P, av) => e.enchapado
      ? { concepto: `Batería enchapada ${e.bateria} × ${num(e.ancho)}m`, importe: deTabla(P.bateriaCubicoEnchapado, e.bateria, av, "Cúbico enchapado") * e.ancho }
      : { concepto: `Batería ${e.secDobles} sec dobles × ${num(e.ancho)}m`, importe: e.secDobles * P.tarifas.seccionDoble * e.ancho },
    adicionales: (e, P) => e.enchapado
      ? [{ concepto: `Columnas y distribuidores (${e.hp}HP)`, importe: tramo(P.colDist.cubico, e.hp) }]
      : [
          { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.cub },
          { concepto: `Columnas y distribuidores (${e.hp}HP)`, importe: tramo(P.colDist.cubicoSC, e.hp) }
        ]
  },

  rcam: {
    id: "rcam", nombre: "Forzador respaldo de cámara", familia: "camara",
    campos: [HP([0.5,0.75,1,1.5,2,3]), N("secDobles","Secciones dobles",1), A()],
    chapa: true, bajaTemp: true, reforzable: true,
    ventTipos: ["v250", "v300", "v300r"],
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "real",
    ventDefault: (e) => {
      if (!e.enchapado) return sinVent();
      const d = VENT_DEFAULTS.rcam, cant = d.cant[e.hp] || 0;
      return e.reforzado ? v("v300r", e.cantReforzados ?? cant) : v(d.tipo(e.hp), cant);
    },
    bateria: (e, P, av) => e.enchapado
      ? { concepto: `Batería enchapada ${e.secDobles} sec dobles × ${num(e.ancho)}m`, importe: deTabla(P.precioMetro.respaldoCamara, e.secDobles, av, "Respaldo de cámara") * e.ancho }
      : { concepto: `Batería ${e.secDobles} sec dobles × ${num(e.ancho)}m`, importe: e.secDobles * P.tarifas.seccionDoble * e.ancho },
    adicionales: (e, P) => [
      ...(e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.rcam }]),
      { concepto: `Columnas y distribuidores (${e.hp}HP)`, importe: tramo(P.colDist.rcam, e.hp) }
    ]
  },

  t58: {
    id: "t58", nombre: "Forzador de techo 5/8\"", familia: "techo",
    campos: [N("secciones","Secciones",1), A(), BANDEJA()],
    chapa: true,
    textoSinChapa: "sin bandeja plástica y sin ventilador",
    defaults: { bandeja: 800 },
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v250", 1) : sinVent()),
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.seccionDoble }),
    adicionales: (e, P, av) => [
      { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.t58 },
      { concepto: "Salida de cobre", importe: P.adicionales.salidaCu },
      ...(e.enchapado ? [{ concepto: `Bandeja plástica ${e.bandeja}mm`, importe: deTabla(P.adicionales.bandeja, e.bandeja, av, "Bandeja") }] : [])
    ]
  },

  t38: {
    id: "t38", nombre: "Forzador de techo 3/8\"", familia: "techo",
    campos: [N("secciones","Secciones",1), A(), BANDEJA()],
    chapa: true,
    textoSinChapa: "sin bandeja plástica y sin ventilador",
    defaults: { bandeja: 800 },
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v250", 1) : sinVent()),
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.compacto38 }),
    adicionales: (e, P, av) => [
      { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.t38 },
      { concepto: "Columnas y distribuidores", importe: P.adicionales.colDistTecho38 },
      { concepto: "Curvas", importe: P.adicionales.curvas },
      ...(e.enchapado ? [{ concepto: `Bandeja plástica ${e.bandeja}mm`, importe: deTabla(P.adicionales.bandeja, e.bandeja, av, "Bandeja") }] : [])
    ]
  },

  car: {
    id: "car", nombre: "Respaldo para carniceras", familia: "carniceras",
    campos: [S("dobles","Batería", [[false,"3 secciones simples"],[true,"4 secciones dobles"]]), A()],
    defaults: { dobles: false },
    ventTarifa: "fija",
    ventDefault: e => v("v250", e.cantVent ?? 2),
    bateria: (e, P) => ({
      concepto: `Batería ${e.dobles ? "4 sec dobles" : "3 sec simples"} × ${num(e.ancho)}m`,
      importe: (e.dobles ? P.precioMetro.carnicerasDoble : P.precioMetro.carnicerasSimple) * e.ancho
    })
  },

  da: {
    id: "da", nombre: "Forzador doble ataque", familia: "lateral",
    medida: medidaSec,
    campos: [S("secciones","Secciones dobles", [[5,"5"],[6,"6"],[7,"7"]]), A()],
    ventTarifa: "fija",
    ventDefault: () => v("v200", 2),
    bateria: (e, P, av) => ({
      concepto: `Batería ${e.secciones} sec dobles × ${num(e.ancho)}m`,
      importe: deTabla(P.precioMetro.dobleAtaque, e.secciones, av, "Doble ataque") * e.ancho
    }),
    adicionales: (e, P) => [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.da }]
  },

  cond: {
    id: "cond", nombre: "Condensador", familia: "condensador",
    campos: [HP([0.25, 0.33, 0.5, 0.75, 1])],
    // Dos casillas: el ventilador y la base se cobran aparte del precio fijo.
    // En el texto al cliente se leen como "con base y ventilador de 200mm".
    opciones: [
      { id: "conVentilador", label: "Con ventilador", orden: 2, no: "ventilador",
        si: (e, P) => {
          const tipo = Object.keys(e.vents || {}).find(k => e.vents[k] > 0) || P.condensadores.ventilador[e.hp];
          const cant = e.vents?.[tipo] || 1;
          const nombre = P.ventiladores.tipos[tipo]?.nombre ?? tipo;
          return cant > 1 ? `${cant} ventiladores de ${nombre}` : `ventilador de ${nombre}`;
        } },
      { id: "conBase", label: "Con base", orden: 1, si: "base" }
    ],
    ventTarifa: "real",
    ventTipos: ["v200", "v300"],
    ventDefault: (e, P) => (e.conVentilador ? v(P.condensadores.ventilador[e.hp], 1) : sinVent()),
    bateria: (e, P, av) => ({
      concepto: `Condensador ${fmtHP(e.hp)}HP`,
      importe: deTabla(P.condensadores.precio, e.hp, av, "Condensador")
    }),
    adicionales: (e, P, av) => e.conBase
      ? [{ concepto: "Base", importe: deTabla(P.condensadores.base, e.hp, av, "Base de condensador") }]
      : []
  },

  pt: {
    id: "pt", nombre: "Forzador de piso para torteras", familia: "piso",
    medida: medidaSec,
    campos: [S("secciones","Secciones", [[3,"3"],[4,"4"]]), A()],
    chapa: true,
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v200", (PT_VENT_CANT[e.secciones] || (() => 0))(e.ancho)) : sinVent()),
    bateria: (e, P, av) => {
      const t = P.tarifas.pisoTorteras;
      const pm = e.enchapado ? (e.secciones === 3 ? t.ench3 : t.ench4) : (e.secciones === 3 ? t.sc3 : t.sc4);
      if (e.secciones !== 3 && e.secciones !== 4) av.push({ nivel: "error", msg: "Piso torteras: sólo 3 o 4 secciones" });
      return { concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: pm * e.ancho };
    },
    adicionales: (e, P) => e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.pt }]
  }
};

export const ORDEN = ["ev", "oli", "resp", "fd", "fs", "fc", "col", "cub", "rcam", "t58", "t38", "car", "da", "pt", "cond"];
