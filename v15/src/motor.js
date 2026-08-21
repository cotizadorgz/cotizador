// Núcleo del cotizador. No conoce ningún producto en particular:
// recibe un perfil (datos) + una entrada y devuelve el desglose.
//
//   base  = batería + ventiladores + adicionales
//   total = base × factorBT × cantidad + embalaje
//
// El embalaje nunca se multiplica por el factor de baja temperatura ni por la cantidad.

import { PRECIOS, costoVentilador } from "./precios.js";

export const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// Evaporador estático 5/8": si el decimal es ≥ 0,75 redondea para arriba.
export function redondeo075(n) {
  const dec = r2(n) - Math.floor(r2(n));
  return dec >= 0.75 ? Math.ceil(r2(n)) : r2(n);
}

export const VENT_CERO = { v200: 0, v250: 0, v300: 0 };

const costoTexto = (tipo, tarifa, P) => {
  const base = tarifa === "fija" ? P.ventiladores.costoFijo : P.ventiladores.tipos[tipo].costo;
  return `$${String(base).replace(".", ",")}`;
};

export function calcularVentiladores(vents, tarifa, P = PRECIOS) {
  const items = [];
  let total = 0;
  for (const tipo of Object.keys(P.ventiladores.tipos)) {
    const cant = vents?.[tipo] || 0;
    if (!cant) continue;
    const unit = r2(costoVentilador(tipo, tarifa, P));
    const imp = r2(cant * unit);
    items.push({
      concepto: `${cant} × ventilador ${P.ventiladores.tipos[tipo].nombre}`,
      unitario: unit, importe: imp,
      nota: `Costo ${costoTexto(tipo, tarifa, P)} + ${(P.ventiladores.markup - 1) * 100}% = ${unit.toFixed(2).replace(".", ",")} cada uno`
    });
    total = r2(total + imp);
  }
  return { items, total };
}

function validarRangos(perfil, e, avisos, P) {
  const rangos = P.rangos?.[perfil.id] || {};
  for (const [campo, [min, max]] of Object.entries(rangos)) {
    const v = e[campo];
    if (v == null) { avisos.push({ nivel: "error", msg: `Falta ${campo}` }); continue; }
    if (v < min || v > max) {
      avisos.push({ nivel: "error", msg: `${campo} = ${v} fuera del rango válido (${min} a ${max}) para ${perfil.nombre}` });
    }
  }
}

export function cotizar(perfil, entrada, P = PRECIOS) {
  const avisos = [];
  const e = {
    cantidad: 1, embalaje: 0, bajaTemp: false, enchapado: true,
    ...perfil.defaults, ...entrada
  };
  if (e.vents === undefined) e.vents = perfil.ventDefault ? perfil.ventDefault(e, P) : { ...VENT_CERO };

  validarRangos(perfil, e, avisos, P);

  // Se puede sacar un componente del presupuesto sin cambiar el producto: la línea
  // sigue a la vista con su importe, pero no suma. Los renglones derivados —baja
  // temperatura, cantidad, embalaje— no se pueden destildar: son consecuencia.
  const excluidos = new Set(e.excluidos || []);
  const marcar = c => ({ ...c, componente: true, excluido: excluidos.has(c.concepto) });

  const bateria = perfil.bateria(e, P, avisos);
  const bat = marcar({ ...bateria, importe: r2(bateria.importe) });

  const tarifa = typeof perfil.ventTarifa === "function" ? perfil.ventTarifa(e) : (perfil.ventTarifa || "real");
  const vent = calcularVentiladores(e.vents, tarifa, P);
  vent.items = vent.items.map(marcar);
  vent.total = r2(vent.items.filter(i => !i.excluido).reduce((s, i) => s + i.importe, 0));

  const adicionales = (perfil.adicionales ? perfil.adicionales(e, P, avisos) : [])
    .filter(a => a && a.importe)
    .map(a => marcar({ ...a, importe: r2(a.importe) }));

  if (e.colector) {
    adicionales.push(marcar({
      concepto: "Colector y distribuidor", importe: r2(e.colector), manual: true,
      nota: "Importe libre: lo ponés vos según el equipo"
    }));
  }

  // Ítem libre: nombre e importe los pone el usuario. Si no le pone nombre se
  // cobra igual, pero como "Adicional" — nunca como un cargo sin identificar.
  if (e.extra && e.extra.importe) {
    adicionales.push(marcar({
      concepto: (e.extra.nombre || "").trim() || "Adicional",
      importe: r2(e.extra.importe), manual: true,
      nota: "Ítem agregado a mano para esta cotización"
    }));
  }

  for (const aj of P.ajustes || []) {
    if (aj.perfil !== perfil.id) continue;
    if (Object.entries(aj.condicion).every(([k, v]) => e[k] === v)) {
      adicionales.push(marcar({ concepto: aj.concepto, importe: r2(aj.importe), ajuste: aj.id,
        nota: "Diferencia entre la lista impresa y la fórmula. Sin explicar todavía." }));
    }
  }

  let base = r2((bat.excluido ? 0 : bat.importe) + vent.total +
    adicionales.filter(a => !a.excluido).reduce((s, a) => s + a.importe, 0));
  if (perfil.ajustePost) base = perfil.ajustePost(base, e, P);

  if (e.reforzado && !perfil.reforzable) {
    avisos.push({ nivel: "error", msg: `${perfil.nombre} no lleva ventiladores 300mm reforzados` });
  }
  if (e.bajaTemp && !perfil.bajaTemp) {
    avisos.push({ nivel: "error", msg: `${perfil.nombre} no admite baja temperatura` });
  }
  const factorBT = (e.bajaTemp && perfil.bajaTemp) ? P.bajaTemperatura : 1;
  const baseFinal = r2(base * factorBT);
  const total = r2(baseFinal * e.cantidad + e.embalaje);

  return {
    perfil: perfil.id, entrada: e, avisos,
    bateria: bat, ventiladores: vent, adicionales,
    noIncluye: [bat, ...vent.items, ...adicionales].filter(c => c.excluido).map(c => c.concepto),
    base, factorBT, baseFinal, cantidad: e.cantidad, embalaje: r2(e.embalaje), total,
    desglose: [
      bat,
      ...vent.items,
      ...adicionales,
      ...(factorBT !== 1 ? [{ concepto: `Baja temperatura × ${factorBT.toFixed(2).replace('.', ',')}`, importe: r2(baseFinal - base) }] : []),
      ...(e.cantidad !== 1 ? [{ concepto: `× ${e.cantidad} unidades`, importe: r2(baseFinal * (e.cantidad - 1)) }] : []),
      ...(e.embalaje ? [{ concepto: "Embalaje (por pedido)", importe: r2(e.embalaje) }] : [])
    ]
  };
}

// Totales de un presupuesto. Los pesos se acumulan YA redondeados línea por línea:
// si el cliente suma lo que ve, tiene que darle exactamente el total que le pasamos.
// La pantalla y el texto copiado salen los dos de acá, así nunca difieren.
export function preciosPresupuesto(lineas, embalaje = 0, P = PRECIOS) {
  return preciosVenta(1, P).map(f => {
    const enPesos = !!f.dolar;
    const importe = usd => (enPesos ? Math.round(usd * f.factor * f.dolar) : r2(usd * f.factor));
    const detalle = lineas.map(l => ({ etiqueta: l.etiqueta, importe: importe(l.total) }));
    if (embalaje) detalle.push({ etiqueta: "Embalaje", importe: importe(embalaje) });
    const total = detalle.reduce((s, d) => r2(s + d.importe), 0);
    const usd = r2(lineas.reduce((s, l) => s + l.total, 0) + embalaje);
    return { ...f, detalle, enPesos, usd: r2(usd * f.factor), ars: enPesos ? total : null, total };
  });
}

export function textoPresupuesto(lineas, embalaje, filas = ["lista"], P = PRECIOS, meta = {}) {
  const dof = P.venta.dolarOficial;
  const bloques = preciosPresupuesto(lineas, embalaje, P).filter(f => filas.includes(f.id)).map(f => {
    const mostrar = n => (f.enPesos ? fmtARS(n) : fmtUSD(n));
    // Con un solo ítem el encabezado es el producto, no la palabra "Presupuesto".
    const solo = lineas.length === 1;
    const partes = [`*${solo ? lineas[0].etiqueta : `${lineas.length} ítems`}*`];
    for (let i = 0; i < f.detalle.length; i++) {
      const d = f.detalle[i];
      const nombre = solo && d.etiqueta === lineas[0].etiqueta ? "Equipo" : d.etiqueta;
      const falta = lineas[i]?.noIncluye;
      partes.push(`• ${nombre} → ${mostrar(d.importe)}` + (falta && falta.length ? `\n  _sin ${listaFalta(falta)}_` : ""));
    }
    partes.push(`*Total: ${mostrar(f.total)}*${f.id === "iva" || f.id === "ml" ? " (IVA incluido)" : f.id === "lista" ? " (no incluye IVA)" : ""}`);
    if (f.id !== "ml" && dof) partes.push(`_Dólar oficial: ${fmtARS(dof)}_`);
    return partes.join("\n");
  }).join("\n\n");
  return `${encabezado(meta)}\n\n${bloques}`;
}

// Presupuesto multi-ítem: el embalaje es uno por pedido, no por ítem.
export function presupuestar(items, embalajePedido = 0, P = PRECIOS) {
  const lineas = items.map(({ perfil, entrada }) =>
    cotizar(perfil, { ...entrada, embalaje: 0 }, P));
  const subtotal = r2(lineas.reduce((s, l) => s + l.total, 0));
  return { lineas, subtotal, embalaje: r2(embalajePedido), total: r2(subtotal + embalajePedido) };
}

export function preciosVenta(usd, P = PRECIOS) {
  const dof = P.venta.dolarOficial, dml = P.venta.dolarML, C = P.venta.columnas;
  const iva = 1 + P.venta.ivaPorcentaje / 100;
  const fila = (id, nombre, nota, factor, dolar) => ({
    id, nombre, nota, factor, dolar,
    usd: r2(usd * factor), ars: dolar ? Math.round(usd * factor * dolar) : null
  });
  return [
    fila("lista", C.lista, "sin IVA", 1, dof),
    fila("m5", C.m5, "+5% · sin IVA", 1.05, dof),
    fila("iva", C.iva, `IVA ${P.venta.ivaPorcentaje}% incluido`, iva, dof),
    fila("ml", C.ml, `comisión ${Math.round(P.venta.comisionML * 1000) / 10}% · IVA incluido`, 1 / (1 - P.venta.comisionML), dml)
  ];
}

// ── Texto para el cliente ────────────────────────────────────────────────────
// Encabezado común a todo lo que se copia. El nombre del cliente es opcional.
export function encabezado({ cliente, fecha = new Date() } = {}) {
  const dia = fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const nombre = (cliente || "").trim();
  return `*Presupuesto GZ Refrigeración*\n${nombre ? nombre + " · " : ""}${dia} · ${hora}`;
}

// No lleva medidas ni cantidad de secciones. El enchapado no se menciona; sólo se
// aclara cuando el equipo va SIN enchapar / sin bandeja y sin ventilador.
const HP_TEXTO = { 0.25: "1/4", 0.33: "1/3", 0.5: "1/2", 0.75: "3/4" };
export const fmtHP = hp => (HP_TEXTO[hp] || String(hp).replace(".", ","));
export const fmtARS = n => "$ " + Math.round(n).toLocaleString("es-AR");
// El teclado del iPhone en español escribe coma, y un input type=number sólo acepta
// punto: lo tipeado se perdía en silencio. Acá vale cualquiera de los dos.
export const leerNumero = v => {
  if (v == null) return null;
  const t = String(v).trim().replace(",", ".");
  if (t === "") return null;
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
};

export const fmtM = n => Number(n).toFixed(2).replace(".", ",");
export const fmtUSD = n => "USD " + n.toFixed(2).replace(".", ",");

export function etiquetaCliente(perfil, e, P = PRECIOS) {
  let t = perfil.nombre;
  if (e.hp) t += ` ${fmtHP(e.hp)}HP`;
  if (e.modelo) t += ` ${e.modelo}`;
  // Algunos productos se identifican por la medida y otros no: lo decide el perfil.
  if (perfil.medida) t += ` ${perfil.medida(e)}`;
  if (perfil.chapa && !e.enchapado && perfil.textoSinChapa) t += ` — ${perfil.textoSinChapa}`;
  if (e.reforzado) t += " — con ventiladores 300mm reforzados";
  if (e.bajaTemp && perfil.bajaTemp) t += " — incluye opcional Baja Temperatura";
  if (e.colector) t += " — con colector y distribuidor";
  if (e.extra && e.extra.importe) t += ` — con ${((e.extra.nombre || "").trim() || "adicional").toLowerCase()}`;
  // Casillas propias del producto. Las que están puestas se juntan en un solo
  // "con A y B", y las que faltan en un "sin A y B". `orden` decide cómo se leen.
  const con = [], sin = [];
  for (const o of [...(perfil.opciones || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) {
    const puesta = !!e[o.id];
    const txt = puesta ? o.si : o.no;
    if (!txt) continue;
    (puesta ? con : sin).push(typeof txt === "function" ? txt(e, P) : txt);
  }
  if (con.length) t += ` — con ${con.join(" y ")}`;
  if (sin.length) t += ` — sin ${sin.join(" y ")}`;
  if (e.cantidad > 1) t += ` (${e.cantidad} unidades)`;
  return t;
}

// filas = ids de precio elegidos, en el orden en que se muestran.
// "Salida de cobre" → "salida de cobre": van en medio de una frase.
const enMinuscula = t => t.charAt(0).toLowerCase() + t.slice(1);
const listaFalta = lista => (lista || []).map(enMinuscula).join(", ");
const lineaNoIncluye = lista =>
  (lista && lista.length ? `\n_No incluye: ${listaFalta(lista)}_` : "");

export function textoCliente(perfil, cot, filas = ["lista"], P = PRECIOS, meta = {}) {
  const enc = `*${etiquetaCliente(perfil, cot.entrada)}*` + lineaNoIncluye(cot.noIncluye);
  const dof = P.venta.dolarOficial ? `\n_Dólar oficial: ${fmtARS(P.venta.dolarOficial)}_` : "";
  const bloques = preciosVenta(cot.total, P).filter(r => filas.includes(r.id)).map(r => {
    if (r.id === "ml") return `${enc}\n• MercadoLibre ${fmtARS(r.ars)} (IVA incluido)`;
    const cuerpo =
      r.id === "lista" ? `Precio de Lista ${fmtUSD(r.usd)} → *${fmtARS(r.ars)}* (no incluye IVA)`
      : r.id === "iva" ? `• Precio ${fmtUSD(r.usd)} → *${fmtARS(r.ars)}* (IVA incluido)`
      : `• ${fmtUSD(r.usd)} → *${fmtARS(r.ars)}*`;
    return `${enc}\n${cuerpo}${dof}`;
  }).join("\n\n");
  return `${encabezado(meta)}\n\n${bloques}`;
}
