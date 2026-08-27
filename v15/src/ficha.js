// Ficha técnica. Frigorías y watts salen de reglas exactas; la superficie, de la
// geometría real de las aletas medida sobre equipos armados.
//
//   frigorías = HP × 1.890            (a Dt 8 °C)
//   watts     = frigorías × 1,163     (kcal/h → W)
//   superficie = caños × (paso × ancho de aleta) × (largo ÷ separación) × 2 caras

import { PRECIOS } from "./precios.js";
import { fmtHP } from "./motor.js";

const num = n => n.toLocaleString("es-AR");
const dec = (n, d = 2) => n.toFixed(d).replace(".", ",");

// true cuando la ficha no puede calcular frigorías porque falta el HP.
export function faltaHP(perfil, cot, P = PRECIOS) {
  const d = datos(perfil, cot, P);
  return !!d && d.hp == null;
}

export function tipoAleta(perfil, e) {
  return typeof perfil.aleta === "function" ? perfil.aleta(e) : perfil.aleta;
}

export function datos(perfil, cot, P = PRECIOS, hpManual = null) {
  const e = cot.entrada;
  const tipo = tipoAleta(perfil, e);
  if (!tipo) return null;                     // producto sin ficha (condensador sin medida)
  const a = P.aletas[tipo];
  const separacion = e.aletaFina && tipo === "compacta" ? P.separacionEspecial : a.separacion;

  // El cúbico enchapado a medida no trae secDobles: sólo la batería tipo "5F6C".
  // De ahí salen las filas y los caños por fila, y con eso las secciones dobles.
  const deBateria = e.bateria ? (+e.bateria[0] * +e.bateria[2]) / 2 : null;
  const secciones = perfil.seccionesFicha ? perfil.seccionesFicha(e)
    : (e.secDobles ?? e.secciones ?? deBateria);
  // El condensador tiene HP pero no medida: la ficha sale sin superficie ni construcción.
  const conGeometria = !!(secciones && e.ancho);
  const canos = conGeometria ? secciones * 2 : null;
  const aletas = conGeometria ? Math.round(e.ancho * 1000 / separacion) : null;
  const superficie = conGeometria ? canos * (a.paso * a.ancho / 1e6) * aletas * 2 : null;

  const vents = Object.entries(cot.entrada.vents || {}).filter(([, n]) => n > 0);
  // El HP a mano es sólo para la ficha: no toca el precio. Se usa cuando el producto
  // no lo tiene como dato (estáticos, laterales, columna, doble ataque, carniceras)
  // o cuando las secciones caen fuera de la tabla de los compactos.
  const hp = e.hp ?? (tipo === "compacta" ? P.hpCompacto[secciones] ?? null : null) ?? hpManual;
  const frigorias = hp ? Math.round(hp * P.frigoriasPorHP) : null;
  if (!conGeometria && !frigorias) return null;

  return {
    hp, tipo, separacion, canos, aletas, superficie, frigorias,
    cano: a.cano,
    watts: frigorias ? Math.round(frigorias * P.wattPorFrigoria / 100) * 100 : null,
    motor: vents.length ? P.ventiladores.tipos[vents[0][0]].nombre.replace("mm", "") : null,
    motores: vents.reduce((n, [, c]) => n + c, 0),
    largoCm: conGeometria ? Math.round(e.ancho * 100) : null,
    filas: e.bateria ? +e.bateria[0] : null,
    porFila: e.bateria ? +e.bateria[2] : null
  };
}

export function filas(perfil, cot, P = PRECIOS, hpManual = null) {
  const d = datos(perfil, cot, P, hpManual);
  if (!d) return null;
  const construccion = !d.canos ? null
    : d.filas ? `${d.canos} caños x ${d.largoCm} cm (${d.filas} Filas x ${d.porFila} Caños)`
    : `${d.canos} caños x ${d.largoCm} cm`;
  return [
    ["Potencia Sugerida", d.hp ? `${fmtHP(d.hp)} HP` : null],
    ["Frig./Hora", d.frigorias ? `${num(d.frigorias)} - Dt = 8 °C` : null],
    ["Sup. Intercambio", d.superficie ? `~${dec(d.superficie, 1)} m²` : null],
    ["Separación Aletas", d.superficie ? `${d.separacion} mm` : null],
    ["Motor", d.motor ? `Ø ${d.motor}` : null],
    ["Cant. Motores", d.motores || null],
    ["Diam. Caño", d.cano],
    ["Construcción", construccion],
    ["Capacidad en Watts", d.watts ? `${num(d.watts)} W (a Dt 8K)` : null]
  ].filter(([, v]) => v != null && v !== "");
}

export function texto(perfil, cot, P = PRECIOS, hpManual = null) {
  const f = filas(perfil, cot, P, hpManual);
  if (!f) return null;
  const e = cot.entrada;
  const d = datos(perfil, cot, P, hpManual);
  let titulo = perfil.nombre;
  if (d.hp) titulo += ` ${fmtHP(d.hp)}HP`;
  if (e.bateria) titulo += ` — ${e.bateria} x ${dec(e.ancho, 2)}m`;
  else if (perfil.medida) titulo += ` — ${perfil.medida(e)}`;
  // Etiqueta en negrita y valor al lado, un renglón por fila. Alinear con espacios
  // no sirve: WhatsApp no usa monoespaciada y las columnas quedarían corridas.
  return [`*${titulo}*`, "", ...f.map(([k, v]) => `*${k}:* ${v}`)].join("\n");
}
