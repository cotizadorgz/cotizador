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
// Explicaciones que se ven al tocar un renglón del desglose. Salen del panel de
// precios, así que si cambiás un valor la explicación lo dice al instante.
const listaTabla = (obj, pre = "", pos = "") =>
  Object.entries(obj).map(([k, v]) => `${pre}${k}${pos} = $${v}`).join(" · ");
const usd = n => `$${String(n).replace(".", ",")}`;

// Markup por tamaño, compartido por el evaporador estático y el respaldar.
const MARKUP_ESTATICO = [[5, 4], [8, 6], [12, 8], [14, 10], [16, 12]];

const medidaSec = e => `${e.secciones} sec x ${fmtM(e.ancho)}m`;
const medidaDobles = e => `${e.secDobles} sec x ${fmtM(e.ancho)}m`;

// Campos de entrada de cada producto, como datos. La pantalla los dibuja sola.
const N = (id, label, step = 0.01, ej, si) => ({ id, label, tipo: "num", step, ej, si });
const S = (id, label, opciones, si) => ({ id, label, tipo: "select", opciones, si });
const A = ej => ({ id: "ancho", label: "Ancho de batería", tipo: "num", step: 0.01, unidad: "m", ej });
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
    campos: [N("secciones","Secciones",1,"ej. 6"), A("ej. 0.50")],
    ventDefault: sinVent,
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.seccionSimple58,
      nota: `${usd(P.tarifas.seccionSimple58)} por sección por metro de ancho` }),
    adicionales: (e, P) => [
      { concepto: "Curvas", importe: e.secciones * P.adicionales.curvasPorSeccion, nota: `${usd(P.adicionales.curvasPorSeccion)} por sección · acá ${e.secciones}` },
      { concepto: "Markup por tamaño", importe: tramo(MARKUP_ESTATICO, e.secciones),
        nota: "3 a 5 sec = $4 · 6 a 8 = $6 · 9 a 12 = $8 · 13 a 14 = $10 · 15 a 16 = $12" }
    ],
    ajustePost: base => redondeo075(base)
  },

  oli: {
    id: "oli", nombre: "Evaporador estático compacto 3/8\"", familia: "estatico",
    ref: "Ref: 8 sec = 1/3HP · 12 sec = 1/2HP · 16 sec = 3/4HP · 20 sec = 1HP",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1,"ej. 9"), A("ej. 0.50")],
    ventDefault: sinVent,
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.compacto38 }),
    adicionales: (e, P) => [
      { concepto: "Curvas", importe: e.secciones * P.adicionales.curvasPorSeccion },
      { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.oli, nota: "Importe fijo, no depende del tamaño" }
    ]
  },

  resp: {
    id: "resp", nombre: "Respaldar estático 5/8\"", familia: "estatico",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1,"ej. 4"), A("ej. 0.60")],
    ventDefault: sinVent,
    // Misma fórmula que el evaporador estático (21/08/2026). Antes era
    // sec × 30 × ancho × 1,04, sin curvas ni markup.
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.seccionSimple58,
      nota: `${usd(P.tarifas.seccionSimple58)} por sección por metro de ancho` }),
    adicionales: (e, P) => [
      { concepto: "Curvas", importe: e.secciones * P.adicionales.curvasPorSeccion, nota: `${usd(P.adicionales.curvasPorSeccion)} por sección · acá ${e.secciones}` },
      { concepto: "Markup por tamaño", importe: tramo(MARKUP_ESTATICO, e.secciones),
        nota: "3 a 5 sec = $4 · 6 a 8 = $6 · 9 a 12 = $8 · 13 a 14 = $10 · 15 a 16 = $12" }
    ]
  },

  fd: {
    id: "fd", nombre: "Forzador lateral doble 5/8\"", familia: "lateral",
    medida: medidaSec,
    campos: [N("secciones","Secciones dobles",1,"ej. 4"), A("ej. 0.50")],
    chapa: true,
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v200", 1) : sinVent()),
    bateria: (e, P, av) => e.enchapado
      ? { concepto: `Batería enchapada ${e.secciones} sec × ${num(e.ancho)}m`, importe: deTabla(P.precioMetro.lateralDoble, e.secciones, av, "Lateral doble") * e.ancho,
          nota: `Precio por metro según secciones: ${listaTabla(P.precioMetro.lateralDoble)}. Los costados ya están adentro.` }
      : { concepto: `Batería ${e.secciones} sec dobles × ${num(e.ancho)}m`, importe: e.secciones * P.tarifas.seccionDoble * e.ancho,
          nota: `${usd(P.tarifas.seccionDoble)} por sección doble por metro de ancho` },
    // Los costados ya están dentro del precio/metro enchapado: no se suman.
    adicionales: (e, P) => e.enchapado ? [] : [
      { concepto: "Costados de aluminio", importe: tramo(P.adicionales.costadosAluminio.fd, e.secciones),
        nota: `${usd(P.adicionales.costadosAluminio.fd[0][1])} de 2 a ${P.adicionales.costadosAluminio.fd[0][0]} secciones · ${usd(P.adicionales.costadosAluminio.fd[1][1])} de ${P.adicionales.costadosAluminio.fd[0][0] + 1} a ${P.adicionales.costadosAluminio.fd[1][0]}` }
    ]
  },

  fs: {
    id: "fs", nombre: "Forzador lateral simple 5/8\"", familia: "lateral",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1,"ej. 4"), A("ej. 0.50")],
    chapa: true,
    textoSinChapa: "sin enchapar y sin ventilador",
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v200", 1) : sinVent()),
    bateria: (e, P, av) => e.enchapado
      ? { concepto: `Batería enchapada ${e.secciones} sec × ${num(e.ancho)}m`, importe: deTabla(P.precioMetro.lateralSimple, e.secciones, av, "Lateral simple") * e.ancho,
          nota: `Precio por metro según secciones: ${listaTabla(P.precioMetro.lateralSimple)}. Los costados ya están adentro.` }
      : { concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * P.tarifas.seccionSimple58 * e.ancho },
    adicionales: (e, P) => e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.fs, nota: "Sólo en la versión sin enchapar: en la enchapada ya van dentro del precio/metro" }]
  },

  fc: {
    id: "fc", nombre: "Forzador lateral compacto 3/8\"", familia: "lateral",
    ref: "Ref: 8 sec = 1/3HP · 12 sec = 1/2HP · 16 sec = 3/4HP · 20 sec = 1HP",
    medida: medidaSec,
    campos: [N("secciones","Secciones",1,"ej. 12"), A("ej. 0.36")],
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
      ...(e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.fc, nota: "Sólo en la versión sin enchapar: en la enchapada ya van dentro del precio/metro" }])
    ]
  },

  col: {
    id: "col", nombre: "Columna para batea 5/8\"", familia: "columna",
    medida: medidaDobles,
    campos: [N("secDobles","Secciones dobles",1,"ej. 4"), A("ej. 2.30"), N("uniones","Uniones",1,"0")],
    defaults: { uniones: 0 },
    ventDefault: sinVent,
    bateria: (e, P) => ({ concepto: `Batería ${e.secDobles} sec dobles × ${num(e.ancho)}m`, importe: e.secDobles * e.ancho * P.tarifas.seccionDoble,
      nota: `${usd(P.tarifas.seccionDoble)} por sección doble por metro de ancho` }),
    adicionales: (e, P) => [{ concepto: `Uniones (${e.uniones})`, importe: e.uniones * P.adicionales.uniones, nota: `${usd(P.adicionales.uniones)} cada una` }]
  },

  cub: {
    id: "cub", nombre: "Forzador cúbico de cámara", familia: "camara",
    campos: [HP([0.75,1,1.5,2,2.5,3,4,5,6]),
      S("bateria","Batería", ["3F4C","4F4C","4F6C","5F6C","6F6C"].map(k => [k, k]), e => e.enchapado),
      N("secDobles","Secciones dobles",1,"ej. 15", e => !e.enchapado), A("ej. 1.00")],
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
      ? [{ concepto: `Columnas y distribuidores (${fmtHP(e.hp)}HP)`, importe: tramo(P.colDist.cubico, e.hp),
          nota: "Arranca en 2HP. 2 y 2,5HP = $30 · 3 y 4HP = $40 · 5HP = $45 · 6HP = $50" }]
      : [
          { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.cub, nota: "Sólo sin enchapar. En la versión enchapada ya están en el precio/metro" },
          { concepto: `Columnas y distribuidores (${fmtHP(e.hp)}HP)`, importe: tramo(P.colDist.cubicoSC, e.hp),
          nota: "Sin enchapar paga $10 más en cada tramo. Arranca en 2HP: 2 y 2,5HP = $40 · 3 y 4HP = $50 · 5HP = $55 · 6HP = $60" }
        ]
  },

  rcam: {
    id: "rcam", nombre: "Forzador respaldo de cámara", familia: "camara",
    campos: [HP([0.5, 0.75, 1, 1.5, 2, 3]), N("secDobles","Secciones dobles",1,"ej. 10"), A("ej. 1.00")],
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
      ...(e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.rcam, nota: "Sólo sin enchapar. En la versión enchapada ya están en el precio/metro" }]),
      { concepto: `Columnas y distribuidores (${fmtHP(e.hp)}HP)`, importe: tramo(P.colDist.rcam, e.hp),
        nota: "Arranca en 2HP. 2HP = $30 · 3HP = $40. Es igual con y sin enchapado" }
    ]
  },

  t58: {
    id: "t58", nombre: "Forzador de techo 5/8\"", familia: "techo",
    campos: [N("secciones","Secciones",1,"ej. 8"), A("ej. 0.35"), BANDEJA()],
    chapa: true,
    textoSinChapa: "sin bandeja plástica y sin ventilador",
    defaults: { bandeja: 800 },
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v250", 1) : sinVent()),
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.seccionDoble }),
    adicionales: (e, P, av) => [
      { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.t58, nota: "Van en las dos versiones: la bandeja no los reemplaza" },
      { concepto: "Salida de cobre", importe: P.adicionales.salidaCu, nota: "Importe fijo por equipo" },
      ...(e.enchapado ? [{ concepto: `Bandeja plástica ${e.bandeja}mm`, importe: deTabla(P.adicionales.bandeja, e.bandeja, av, "Bandeja"),
          nota: `800mm = ${usd(P.adicionales.bandeja[800])} · 1000mm = ${usd(P.adicionales.bandeja[1000])}` }] : [])
    ]
  },

  t38: {
    id: "t38", nombre: "Forzador de techo 3/8\"", familia: "techo",
    campos: [N("secciones","Secciones",1,"ej. 24"), A("ej. 0.33"), BANDEJA()],
    chapa: true,
    textoSinChapa: "sin bandeja plástica y sin ventilador",
    defaults: { bandeja: 800 },
    ventTarifa: "fija",
    ventDefault: e => (e.enchapado ? v("v250", 1) : sinVent()),
    bateria: (e, P) => ({ concepto: `Batería ${e.secciones} sec × ${num(e.ancho)}m`, importe: e.secciones * e.ancho * P.tarifas.compacto38 }),
    adicionales: (e, P, av) => [
      { concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.t38, nota: "Van en las dos versiones: la bandeja no los reemplaza" },
      { concepto: "Columnas y distribuidores", importe: P.adicionales.colDistTecho38, nota: "Importe fijo en los de techo 3/8\"" },
      { concepto: "Curvas", importe: P.adicionales.curvas, nota: "Importe fijo en los de techo 3/8\"" },
      ...(e.enchapado ? [{ concepto: `Bandeja plástica ${e.bandeja}mm`, importe: deTabla(P.adicionales.bandeja, e.bandeja, av, "Bandeja") }] : [])
    ]
  },

  car: {
    id: "car", nombre: "Respaldo para carniceras", familia: "carniceras",
    campos: [S("dobles","Batería", [[false,"3 secciones simples"],[true,"4 secciones dobles"]]), A("ej. 1.40")],
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
    campos: [S("secciones","Secciones dobles", [[5,"5"],[6,"6"],[7,"7"]]), A("ej. 0.60")],
    ventTarifa: "fija",
    ventDefault: () => v("v200", 2),
    bateria: (e, P, av) => ({
      concepto: `Batería ${e.secciones} sec dobles × ${num(e.ancho)}m`,
      importe: deTabla(P.precioMetro.dobleAtaque, e.secciones, av, "Doble ataque") * e.ancho
    }),
    adicionales: (e, P) => [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.da, nota: "Importe fijo" }]
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
      ? [{ concepto: "Base", importe: deTabla(P.condensadores.base, e.hp, av, "Base de condensador"),
          nota: `${usd(P.condensadores.base[0.25])} hasta 1/2HP · ${usd(P.condensadores.base[0.75])} en 3/4 y 1HP` }]
      : []
  },

  pt: {
    id: "pt", nombre: "Forzador de piso para torteras", familia: "piso",
    medida: medidaSec,
    campos: [S("secciones","Secciones", [[3,"3"],[4,"4"]]), A("ej. 1.25")],
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
    adicionales: (e, P) => e.enchapado ? [] : [{ concepto: "Costados de aluminio", importe: P.adicionales.costadosAluminio.pt, nota: "Sólo sin enchapar" }]
  }
};

export const ORDEN = ["ev", "oli", "resp", "fd", "fs", "fc", "col", "cub", "rcam", "t58", "t38", "car", "da", "pt", "cond"];
