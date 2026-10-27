// Evaporadores a medida: de lo que dice el cliente a lo que hay que fabricar.
//
// Este archivo NO cotiza: traduce. Toma el relevamiento y el código de batería que
// Gabriel ya escribe a mano en el papel del taller —"3F8C x 28cm"— y devuelve la
// geometría del paquete, los metros de caño, el HP que eso da y las medidas del
// conjunto terminado para ver si entra en el hueco. El precio lo sigue haciendo
// motor.js con los perfiles de siempre: acá no hay ni una fórmula de plata.
//
// Todo lo geométrico sale de PRECIOS.aletas, que ya estaba cargado para la ficha
// técnica: si mañana cambia el paso de una aleta, esto lo dice solo.

import { PRECIOS } from "./precios.js";
import { PERFILES } from "./perfiles.js";
import { r2, fmtHP } from "./motor.js";

// 6.72 → "6,72". Todo lo que se muestra pasa por acá.
const num = n => String(r2(Number(n))).replace(".", ",");
export const cm = mm => `${num(r2(mm / 10))} cm`;

// ── El código de batería ─────────────────────────────────────────────────────
// "3F8C" = 3 filas de 8 caños. Es la misma notación que ya usa el cúbico
// ("3F4C" … "6F6C") y la que Gabriel escribe en la orden de trabajo.
//
// Con regex y no por posición de carácter: ficha.js lee hoy `codigo[2]`, que anda
// hasta "6F6C" y con "4F10C" agarra el "1" y devuelve 4 caños en vez de 10. En los
// equipos a medida los códigos de dos dígitos van a aparecer seguido.
const RE_BATERIA = /^\s*(\d{1,2})\s*F\s*(\d{1,2})\s*C\s*$/i;

export function leerBateria(codigo) {
  const m = RE_BATERIA.exec(String(codigo ?? ""));
  if (!m) return null;
  const filas = +m[1], canos = +m[2];
  if (!filas || !canos) return null;
  return {
    filas, canos,
    total: filas * canos,
    // El precio se cobra por sección y una sección son 2 caños. Si el total es
    // impar queda media sección: se avisa, no se redondea en silencio.
    secciones: (filas * canos) / 2,
    codigo: `${filas}F${canos}C`
  };
}

// ── Geometría del paquete de aletas ──────────────────────────────────────────
// Las tres medidas salen en mm y con nombres neutros, porque cuál es el alto y
// cuál el fondo depende de dónde se monta el equipo (ver ORIENTACION):
//
//   espesor → filas apiladas sobre el ANCHO de aleta   3 × 25 = 75 mm
//   frente  → caños repartidos sobre el PASO           8 × 29 = 232 mm
//   largo   → el codo a codo, que es un dato           280 mm
//
// Los 75 mm son los "7,5 cm" que midió Gabriel en el equipo de Acosta.
export function paquete({ aleta, bateria, largoMm }, P = PRECIOS) {
  const b = leerBateria(bateria);
  const a = P.aletas[aleta];
  const largo = Number(largoMm);
  if (!b || !a || !largo) return null;
  return {
    bateria: b, aleta, cano: a.cano, paso: a.paso, anchoAleta: a.ancho,
    espesorMm: b.filas * a.ancho,
    frenteMm: b.canos * a.paso,
    largoMm: largo,
    canos: b.total,
    metrosCano: r2(b.total * largo / 1000),
    secciones: b.secciones
  };
}

// ── Metros de caño por HP ────────────────────────────────────────────────────
// Regla de Gabriel. La de cámaras cierra sola contra el catálogo ya cargado: los
// 16 modelos de cúbico y respaldo dan entre 12,6 y 16 m/HP, y el cúbico 1HP y el
// 3HP dan 13,60 y 14,00 clavados. Las de heladera son ORIENTATIVAS: el techo 5/8"
// del catálogo va de 7,0 a 12,7 m/HP y el 3/8" pide ~30, así que los HP de la
// lista de heladeras no salieron de esta regla. Por eso el HP sugerido se muestra
// al lado del de la unidad condensadora, nunca en lugar del precio.
export function metrosPorHP({ aplicacion, aleta }, t) {
  const compacta = aleta === "compacta";                  // 3/8"
  if (aplicacion === "camara") {
    if (compacta) {
      return { metros: null, nota: 'Las cámaras van siempre en 5/8": no hay regla para 3/8"' };
    }
    return { metros: t.camara58, nota: `cámara, 5/8" → ${num(t.camara58)} m por HP` };
  }
  if (!compacta) return { metros: t.heladera58, nota: `heladera, 5/8" → ${num(t.heladera58)} m por HP` };
  const metros = r2(t.heladera58 * t.factor38);
  return {
    metros,
    nota: `heladera, 3/8" → ${num(t.heladera58)} × ${num(t.factor38)} = ${num(metros)} m por HP`
  };
}

// Escalera comercial de HP. Fuera de esto no se inventa un intermedio: se muestra
// el exacto al lado, que es el que manda para decidir si alcanza.
export const ESCALERA_HP = [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6];

const masCercano = hp =>
  ESCALERA_HP.reduce((a, b) => (Math.abs(b - hp) < Math.abs(a - hp) ? b : a));

export function hpSugerido({ aplicacion, aleta, metrosCano }, tabla) {
  const { metros, nota } = metrosPorHP({ aplicacion, aleta }, tabla);
  if (!metros || !metrosCano) return { hp: null, exacto: null, metrosPorHP: metros, nota };
  const exacto = metrosCano / metros;
  return { hp: masCercano(exacto), exacto: r2(exacto), metrosPorHP: metros, nota };
}

// El evaporador tiene que poder absorber lo que entrega la unidad condensadora.
// Si da menos, faltan metros de caño y se dice cuántos.
export function contraLaUnidad(hp, hpUC, metrosPorHP) {
  if (!hp?.exacto || !hpUC) return null;
  const alcanza = hp.exacto >= hpUC;
  return {
    alcanza,
    faltanMetros: alcanza ? 0 : r2((hpUC - hp.exacto) * metrosPorHP),
    texto: alcanza ? "alcanza para la unidad condensadora"
                   : `queda corto: faltan ${num(r2((hpUC - hp.exacto) * metrosPorHP))} m de caño`
  };
}

// ── Dónde se monta y cómo cae sobre el hueco ─────────────────────────────────
export const MONTAJES = [
  ["techo",    "De techo"],
  ["lateral",  "Lateral"],
  ["respaldo", "Respaldo de cámara"],
  ["piso",     "De piso"],
  ["estatico", "Estático (sin forzar)"]
];

// Cuál de las tres medidas del paquete es el alto, cuál el ancho y cuál el fondo,
// y sobre cuál se apilan los coolers. El techo está confirmado contra el dibujo de
// Acosta: 232 de frente sobre el ancho, 75 de espesor sobre el alto, 280 de largo
// sobre el fondo, y los coolers sumando al alto (75 + 38 + chapa = 120).
export const ORIENTACION = {
  techo:    { espesor: "alto",  frente: "ancho", largo: "fondo", coolers: "alto"  },
  lateral:  { espesor: "fondo", frente: "alto",  largo: "ancho", coolers: "fondo" },
  respaldo: { espesor: "fondo", frente: "alto",  largo: "ancho", coolers: "fondo" },
  piso:     { espesor: "alto",  frente: "fondo", largo: "ancho", coolers: "alto"  },
  estatico: { espesor: "fondo", frente: "alto",  largo: "ancho", coolers: null    }
};

// Montaje + familia de aleta → el perfil que pone el precio. Tabla de datos, no
// una cadena de if: agregar una combinación es agregar un renglón.
export const RUTEO = {
  "techo|compacta": "t38",    "techo|doble": "t58",
  "lateral|compacta": "fc",   "lateral|doble": "fd",   "lateral|simple": "fs",
  "estatico|compacta": "oli", "estatico|simple": "ev",
  "piso|doble": "pt",         "respaldo|doble": "rcam"
};

// Nombre corto para el papel del taller, como lo escribe Gabriel a mano.
export const NOMBRE_TALLER = {
  t38: "Forz Techo 3/8",     t58: "Forz Techo 5/8",
  fc:  "Forz Lateral 3/8",   fd:  "Forz Lateral Doble", fs: "Forz Lateral Simple",
  oli: "Evap Estático 3/8",  ev:  "Evap Estático 5/8",
  pt:  "Forz Piso",          rcam: "Forz Respaldo Cámara"
};

// ── El conjunto terminado ────────────────────────────────────────────────────
// Decisión de Gabriel: el chequeo de que entre se hace contra el equipo COMPLETO,
// no contra el paquete pelado. Los sumandos quedan a la vista para ver qué recortar
// cuando no entra. La cuenta del alto es la que hizo él a mano en el equipo de
// Acosta: paquete 75 + cooler 38 + chapa 7 = 120 mm.
export function conjunto({ paquete: p, montaje, coolers = 0, coolerEspesorMm = 0,
                           chapaMm = 0, bandejaAnchoMm = 0 }) {
  if (!p) return null;
  const o = ORIENTACION[montaje];
  if (!o) return null;

  const dim = { alto: 0, ancho: 0, fondo: 0 };
  const partes = { alto: [], ancho: [], fondo: [] };
  const sumar = (donde, etiqueta, mm) => {
    if (!donde || !mm) return;
    dim[donde] += mm;
    partes[donde].push({ etiqueta, mm });
  };

  sumar(o.espesor, "paquete", p.espesorMm);
  sumar(o.frente, "paquete", p.frenteMm);
  sumar(o.largo, "codo a codo", p.largoMm);
  // Los coolers se apilan sobre el mismo eje que atraviesa el aire.
  if (coolers > 0) sumar(o.coolers, `${coolers > 1 ? "coolers" : "cooler"}`, coolerEspesorMm);
  sumar(o.coolers, "chapa y bandeja", chapaMm);
  // La bandeja colectora va al lado del paquete: en el dibujo de Acosta los 380 de
  // ancho son 232 de paquete + 148 de bandeja.
  sumar(o.frente, "bandeja al costado", bandejaAnchoMm);

  return { ...dim, partes };
}

// hueco en mm. Devuelve cuánto sobra (positivo) o cuánto se pasa (negativo).
export function entraEnElHueco(c, hueco) {
  if (!c || !hueco) return null;
  const sobra = {};
  let entra = true;
  for (const eje of ["alto", "ancho", "fondo"]) {
    const disponible = Number(hueco[eje]);
    if (!disponible) { sobra[eje] = null; continue; }
    sobra[eje] = r2(disponible - c[eje]);
    if (sobra[eje] < 0) entra = false;
  }
  return { entra, sobra };
}

// ── El puente al cotizador ───────────────────────────────────────────────────
// Devuelve la entrada lista para cotizar() con los perfiles de siempre. Se pide
// SIN enchapado / sin bandeja plástica a propósito: en un equipo a medida la
// bandeja es de chapa hecha a medida (la plástica más chica de la lista es de
// 800mm y el equipo de Acosta mide 380 de ancho) y el ventilador es un cooler,
// no el axial de 250mm que trae el perfil por defecto. Los dos se suman aparte.
export function entradaParaCotizar(d) {
  const pid = RUTEO[`${d.montaje}|${d.aleta}`];
  if (!pid) return null;
  const perfil = PERFILES[pid];
  const p = paquete(d);
  if (!p) return null;
  const campo = perfil.campos.some(c => c.id === "secDobles") ? "secDobles" : "secciones";
  const entrada = { [campo]: p.secciones, ancho: r2(p.largoMm / 1000), enchapado: false };
  // Los perfiles de cámara piden HP para el col/dist: se usa el de la unidad
  // condensadora que dio el cliente.
  if (perfil.campos.some(c => c.id === "hp") && d.hpUC) entrada.hp = d.hpUC;
  return { pid, perfil, entrada, paquete: p };
}

// ── Textos ───────────────────────────────────────────────────────────────────
// El papel del taller, igual al que escribe Gabriel a mano:
//   1 Forz Techo 3/8
//   3F8C x 28cm
//   2 coolers
export function textoTaller(d, ruta, cliente = "") {
  if (!ruta) return null;
  const b = leerBateria(d.bateria);
  const partes = [
    `${d.cantidad || 1} ${NOMBRE_TALLER[ruta.pid] || ruta.perfil.nombre}`,
    `${b.codigo} x ${num(d.largoMm / 10)}cm`
  ];
  if (d.coolers) partes.push(`${d.coolers} cooler${d.coolers > 1 ? "s" : ""}`);
  if (d.conBandeja) partes.push("con bandeja colectora");
  if (cliente.trim()) partes.push(cliente.trim());
  return partes.join("\n");
}

export const TIPOS_EQUIPO = [
  ["exhibidora", "Exhibidora vertical", "heladera"],
  ["mostrador",  "Mostrador",           "heladera"],
  ["isla",       "Isla / freezer",      "heladera"],
  ["bajomesada", "Bajo mesada",         "heladera"],
  ["vitrina",    "Vitrina",             "heladera"],
  ["camara",     "Cámara frigorífica",  "camara"]
];

export const aplicacionDe = tipo =>
  (TIPOS_EQUIPO.find(t => t[0] === tipo) || [])[2] || "heladera";

// Lo que dijo el cliente, para dejar asentado con la cotización.
export function textoRelevamiento(d, ruta, hp) {
  const eq = TIPOS_EQUIPO.find(t => t[0] === d.tipo);
  const l = [];
  const poner = (k, v) => { if (v != null && String(v).trim() !== "") l.push(`*${k}:* ${v}`); };
  poner("Equipo", eq ? eq[1] : d.tipo);
  poner("Medidas del equipo", d.medidasEquipo);
  if (d.hueco?.fondo || d.hueco?.ancho || d.hueco?.alto) {
    poner("Hueco del evaporador",
      `${num(d.hueco.fondo / 10)} fondo x ${num(d.hueco.ancho / 10)} ancho x ${num(d.hueco.alto / 10)} alto (cm)`);
  }
  poner("Unidad condensadora", d.hpUC ? `${fmtHP(d.hpUC)} HP` : null);
  poner("Mercadería", d.mercaderia);
  poner("Temperatura", d.temperatura !== "" && d.temperatura != null ? `${num(d.temperatura)} °C` : null);
  if (ruta) {
    const p = ruta.paquete;
    poner("Batería", `${p.bateria.codigo} x ${num(p.largoMm / 10)}cm — ${p.canos} caños de ${p.cano}`);
    poner("Caño", `${num(p.metrosCano)} m`);
    if (hp?.hp) poner("Potencia que da", `${fmtHP(hp.hp)} HP (${num(hp.exacto)} exacto)`);
  }
  return l.join("\n");
}
