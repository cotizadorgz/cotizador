// Andamio de la prueba de evaporadores a medida. Página aparte: NO toca ningún
// archivo de la calculadora, no registra el service worker y no escribe ninguna de
// las llaves de la app. Su estado vive en gz15.prueba-amedida y nada más.
//
// Cuando la prueba esté cerrada, este archivo se tira: los números de PRUEBA se van
// a precios.js (para que el panel los edite solo) y el dibujo se vuelve una tarjeta
// dentro de index.html. Lo que sobrevive tal cual es src/amedida.js.

import { PRECIOS } from "./precios.js";
import { cotizar, preciosVenta, r2, fmtUSD, fmtARS, fmtHP, leerNumero } from "./motor.js";
import { aplicarCambios } from "./panel.js";
import * as A from "./amedida.js";

// Los precios editados en el panel de la app se respetan: la prueba cotiza con lo
// que Gabriel tenga cargado, no con los de fábrica.
aplicarCambios();

// El dólar se LEE de la app, nunca se escribe. Si todavía no hay ninguno cargado,
// las columnas en pesos salen con guión en vez de inventar una cotización.
{
  const d = JSON.parse(localStorage.getItem("gz15.dolares") || "{}");
  PRECIOS.venta.dolarOficial = d.oficial ?? null;
  PRECIOS.venta.dolarML = d.ml ?? PRECIOS.venta.dolarML;
}

// ── Los números que todavía no están definidos ───────────────────────────────
// A propósito NO están en precios.js: se tocan desde la misma página mientras se
// decide cuánto valen. El cooler y la bandeja arrancan en 0 y la prueba avisa —
// no se inventa un precio, que es el criterio de toda la app (bug #6 de la v14).
const PRUEBA_FABRICA = {
  cooler: 0,             // costo del cooler, USD. Pendiente: lo pasa Gabriel
  bandejaAMedida: 0,     // bandeja de chapa hecha a medida, USD. Pendiente
  coolerEspesorMm: 38,   // el cuadrado de la foto: ~120 × 120 × 38 mm
  chapaMm: 7,            // lo que le suman chapa y bandeja al alto del conjunto
  bandejaAnchoMm: 148,   // el costado de la bandeja: en el dibujo, 380 − 232
  camara58: 14,          // m de caño 5/8" por HP en cámara — cierra con el catálogo
  heladera58: 11,        // m de caño 5/8" por HP en heladera — orientativo
  factor38: 1.8          // el 3/8" pide "80% más" — a revisar
};

const CAMPOS_PRUEBA = [
  ["cooler",          "Costo del cooler (USD)",          "pendiente"],
  ["bandejaAMedida",  "Bandeja a medida (USD)",          "pendiente"],
  ["coolerEspesorMm", "Espesor del cooler (mm)",         ""],
  ["chapaMm",         "Chapa y bandeja, al alto (mm)",   ""],
  ["bandejaAnchoMm",  "Bandeja al costado (mm)",         ""],
  ["camara58",        "Cámara 5/8\" — m por HP",         ""],
  ["heladera58",      "Heladera 5/8\" — m por HP",       ""],
  ["factor38",        "Factor del 3/8\"",                ""]
];

const LLAVE = "gz15.prueba-amedida";

const leerGuardado = () => { try { return JSON.parse(localStorage.getItem(LLAVE) || "{}"); } catch { return {}; } };
const guardado = leerGuardado();

const PRUEBA = { ...PRUEBA_FABRICA, ...(guardado.numeros || {}) };

// ── Estado ───────────────────────────────────────────────────────────────────
const FABRICA = {
  tipo: "exhibidora", medidasEquipo: "", mercaderia: "", temperatura: "",
  hueco: { fondo: "", ancho: "", alto: "" },
  hpUC: "", cliente: "",
  aleta: "compacta", montaje: "techo", bateria: "", largoCm: "",
  coolers: 0, conBandeja: true, cantidad: 1
};
const d = { ...FABRICA, ...(guardado.diseno || {}), hueco: { ...FABRICA.hueco, ...(guardado.diseno?.hueco || {}) } };

const guardar = () => localStorage.setItem(LLAVE, JSON.stringify({ numeros: PRUEBA, diseno: d }));

// ── Utilidades de dibujo ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const num = n => String(r2(Number(n))).replace(".", ",");
const cmDe = mm => num(r2(mm / 10));

function campoTexto(label, valor, alCambiar, { placeholder = "", decimal = false } = {}) {
  const lab = el("label");
  lab.appendChild(el("span", null, label));
  const inp = el("input");
  inp.type = "text";
  if (decimal) inp.inputMode = "decimal";
  inp.placeholder = placeholder;
  inp.value = valor ?? "";
  inp.oninput = () => alCambiar(inp.value);
  lab.appendChild(inp);
  return lab;
}

function campoSelect(label, opciones, valor, alCambiar) {
  const lab = el("label");
  lab.appendChild(el("span", null, label));
  const sel = el("select");
  for (const [v, t] of opciones) {
    const o = el("option", null, t);
    o.value = String(v);
    if (String(valor) === String(v)) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => alCambiar(sel.value);
  lab.appendChild(sel);
  return lab;
}

// ── Los números de prueba ────────────────────────────────────────────────────
function dibujarNumeros() {
  const cont = $("numerosCuerpo");
  cont.innerHTML = "";
  const caja = el("div", "campos");
  for (const [k, etiqueta, pendiente] of CAMPOS_PRUEBA) {
    const falta = pendiente && !PRUEBA[k];
    const lab = campoTexto(etiqueta + (falta ? " — falta" : ""), PRUEBA[k], v => {
      PRUEBA[k] = leerNumero(v) ?? 0;
      guardar(); render(); refrescarResumenNumeros();
    }, { decimal: true });
    if (falta) lab.querySelector("span").style.color = "var(--aviso)";
    if (PRUEBA[k] !== PRUEBA_FABRICA[k]) {
      lab.querySelector("span").appendChild(el("em", "tocado", " editado"));
    }
    caja.appendChild(lab);
  }
  cont.appendChild(caja);

  const acciones = el("div", "panel-acciones");
  const volver = el("button", "peligro", "Volver a los valores de prueba");
  volver.onclick = () => {
    Object.assign(PRUEBA, PRUEBA_FABRICA);
    guardar(); render(); dibujarNumeros();
  };
  acciones.appendChild(volver);
  cont.appendChild(acciones);

  refrescarResumenNumeros();
}

// Sólo el texto: rebuildear los campos le robaría el foco al que estás tipeando.
function refrescarResumenNumeros() {
  const faltan = [];
  if (!PRUEBA.cooler) faltan.push("el cooler");
  if (!PRUEBA.bandejaAMedida) faltan.push("la bandeja");
  $("resumenNumeros").textContent = faltan.length
    ? `falta ${faltan.join(" y ")}`
    : "todo cargado";
}

// ── Relevamiento y diseño ────────────────────────────────────────────────────
function dibujarFormulario() {
  const rel = $("relevamiento");
  rel.innerHTML = "";
  rel.appendChild(campoSelect("Tipo de equipo", A.TIPOS_EQUIPO.map(t => [t[0], t[1]]), d.tipo,
    v => { d.tipo = v; toco(); }));
  rel.appendChild(campoTexto("Medidas del equipo", d.medidasEquipo,
    v => { d.medidasEquipo = v; guardar(); }, { placeholder: "ej. 60 x 60 x 200" }));
  rel.appendChild(campoSelect("Unidad condensadora",
    [["", "— sin definir —"], ...A.ESCALERA_HP.map(h => [h, `${fmtHP(h)} HP`])], d.hpUC,
    v => { d.hpUC = v === "" ? "" : parseFloat(v); toco(); }));
  rel.appendChild(campoTexto("Mercadería", d.mercaderia,
    v => { d.mercaderia = v; guardar(); }, { placeholder: "ej. lácteos, fiambres" }));
  rel.appendChild(campoTexto("Temperatura de trabajo (°C)", d.temperatura,
    v => { d.temperatura = leerNumero(v) ?? ""; guardar(); }, { placeholder: "ej. 2", decimal: true }));
  rel.appendChild(campoTexto("Cliente", d.cliente,
    v => { d.cliente = v; guardar(); render(); }, { placeholder: "ej. Acosta" }));

  const hueco = $("hueco");
  hueco.innerHTML = "";
  for (const [eje, etiqueta] of [["fondo", "Fondo (cm)"], ["ancho", "Ancho (cm)"], ["alto", "Alto (cm)"]]) {
    hueco.appendChild(campoTexto(etiqueta, d.hueco[eje],
      v => { d.hueco[eje] = leerNumero(v) ?? ""; toco(); }, { placeholder: "ej. 32", decimal: true }));
  }

  const dis = $("diseno");
  dis.innerHTML = "";
  const aletas = Object.entries(PRECIOS.aletas).map(([id, a]) => {
    const nombre = { simple: "Simple", doble: "Doble", compacta: "Compacta" }[id] || id;
    return [id, `${nombre} ${a.cano} — ${A.cm(a.alto)} por sección`];
  });
  dis.appendChild(campoSelect("Sección", aletas, d.aleta, v => { d.aleta = v; toco(); }));
  dis.appendChild(campoSelect("Montaje", A.MONTAJES, d.montaje, v => { d.montaje = v; toco(); }));
  dis.appendChild(campoTexto("Batería", d.bateria,
    v => { d.bateria = v.toUpperCase(); toco(); }, { placeholder: "ej. 3F8C" }));
  dis.appendChild(campoTexto("Largo codo a codo (cm)", d.largoCm,
    v => { d.largoCm = leerNumero(v) ?? ""; toco(); }, { placeholder: "ej. 28", decimal: true }));
  dis.appendChild(campoTexto("Coolers", d.coolers,
    v => { d.coolers = Math.max(0, Math.round(leerNumero(v) ?? 0)); toco(); }, { placeholder: "ej. 2" }));
  dis.appendChild(campoTexto("Cantidad de equipos", d.cantidad,
    v => { d.cantidad = Math.max(1, Math.round(leerNumero(v) ?? 1)); toco(); }));

  const ops = $("opciones");
  ops.innerHTML = "";
  const lab = el("label", "chk");
  lab.dataset.on = String(d.conBandeja);
  const chk = el("input"); chk.type = "checkbox"; chk.checked = d.conBandeja;
  chk.onchange = () => { d.conBandeja = chk.checked; toco(); };
  lab.append(chk, el("span", null, "Con bandeja colectora a medida"));
  ops.appendChild(lab);
}

const toco = () => { guardar(); render(); dibujarFormulario(); };

// ── El cálculo y el resultado ────────────────────────────────────────────────
function calcular() {
  const largoMm = d.largoCm === "" ? null : d.largoCm * 10;
  const entrada = { aleta: d.aleta, bateria: d.bateria, largoMm, montaje: d.montaje, hpUC: d.hpUC || null };
  const p = A.paquete(entrada);
  if (!p) return { falta: true };

  const aplicacion = A.aplicacionDe(d.tipo);
  const hp = A.hpSugerido({ aplicacion, aleta: d.aleta, metrosCano: p.metrosCano }, PRUEBA);
  const contra = A.contraLaUnidad(hp, d.hpUC || null, hp.metrosPorHP);

  const c = A.conjunto({
    paquete: p, montaje: d.montaje,
    coolers: d.coolers, coolerEspesorMm: PRUEBA.coolerEspesorMm,
    chapaMm: d.conBandeja ? PRUEBA.chapaMm : 0,
    bandejaAnchoMm: d.conBandeja ? PRUEBA.bandejaAnchoMm : 0
  });
  const hueco = {
    fondo: d.hueco.fondo === "" ? 0 : d.hueco.fondo * 10,
    ancho: d.hueco.ancho === "" ? 0 : d.hueco.ancho * 10,
    alto: d.hueco.alto === "" ? 0 : d.hueco.alto * 10
  };
  const fit = A.entraEnElHueco(c, hueco);

  const ruta = A.entradaParaCotizar(entrada);
  let cot = null, lineas = [], avisos = [];
  if (!ruta) {
    avisos.push({ nivel: "error", msg:
      `No hay ningún producto que cotice un ${d.montaje} con sección ${d.aleta}. ` +
      `Cambiá el montaje o la sección — o hay que agregar la combinación a RUTEO.` });
  }
  if (ruta) {
    // El motor de siempre, pidiendo la versión sin bandeja plástica y sin
    // ventilador: eso deja batería + costados + col/dist + curvas.
    cot = cotizar(ruta.perfil, { ...ruta.entrada, cantidad: 1, embalaje: 0 });
    lineas = cot.desglose.map(l => ({ ...l }));
    avisos = cot.avisos.map(a => ({ ...a }));

    if (p.secciones % 1 !== 0) {
      avisos.push({ nivel: "error", msg: `${p.canos} caños son ${num(p.secciones)} secciones: el total de caños tiene que ser par.` });
    }
    if (d.coolers > 0) {
      const unit = r2(PRUEBA.cooler * PRECIOS.ventiladores.markup);
      lineas.push({ concepto: `${d.coolers} × cooler`, importe: r2(d.coolers * unit), pendiente: !PRUEBA.cooler });
      if (!PRUEBA.cooler) avisos.push({ nivel: "error", msg: "Falta el costo del cooler: cargalo arriba, en Números de prueba." });
    }
    if (d.conBandeja) {
      lineas.push({ concepto: "Bandeja colectora a medida", importe: r2(PRUEBA.bandejaAMedida), pendiente: !PRUEBA.bandejaAMedida });
      if (!PRUEBA.bandejaAMedida) avisos.push({ nivel: "error", msg: "Falta el precio de la bandeja a medida: cargalo arriba, en Números de prueba." });
    }
  }
  const unitario = r2(lineas.reduce((s, l) => s + l.importe, 0));
  const total = r2(unitario * (d.cantidad || 1));
  return { p, hp, contra, c, fit, hueco, ruta, lineas, avisos, unitario, total, aplicacion };
}

function filaDato(tabla, k, v, clase) {
  const tr = el("tr");
  tr.appendChild(el("td", null, k));
  const td = el("td", clase || null, v);
  tr.appendChild(td);
  tabla.appendChild(tr);
  return td;
}

function render() {
  const r = calcular();
  const caja = $("resultado");
  if (r.falta) {
    caja.hidden = true;
    $("pendiente").hidden = false;
    return;
  }
  $("pendiente").hidden = true;
  caja.hidden = false;

  // ── Geometría ──
  const g = $("geometria"); g.innerHTML = "";
  const p = r.p;
  filaDato(g, "Paquete",
    `espesor ${cmDe(p.espesorMm)} cm (${p.bateria.filas} × ${p.anchoAleta} mm) · ` +
    `frente ${cmDe(p.frenteMm)} cm (${p.bateria.canos} × ${p.paso} mm) · ` +
    `largo ${cmDe(p.largoMm)} cm`);
  filaDato(g, "Caño", `${p.canos} caños de ${p.cano} × ${num(p.largoMm / 1000)} m = ${num(p.metrosCano)} m`);
  filaDato(g, "Secciones", `${num(p.secciones)} (para el precio: 2 caños por sección)`);

  const hpTxt = r.hp.hp
    ? `${fmtHP(r.hp.hp)} HP — exacto ${num(r.hp.exacto)} (${r.hp.nota})`
    : r.hp.nota;
  filaDato(g, "Potencia que da", hpTxt);
  if (r.contra) {
    filaDato(g, "Unidad condensadora",
      `${fmtHP(d.hpUC)} HP — ${r.contra.texto}`,
      r.contra.alcanza ? "ok" : "mal");
  }

  // ── Entra o no entra ──
  const e = $("encaje"); e.innerHTML = "";
  for (const eje of ["alto", "ancho", "fondo"]) {
    const partes = r.c.partes[eje].map(x => `${x.etiqueta} ${cmDe(x.mm)}`).join(" + ");
    const disponible = r.hueco[eje];
    let txt = `${cmDe(r.c[eje])} cm`;
    let clase = null;
    if (disponible) {
      const sobra = r.fit.sobra[eje];
      txt += sobra < 0 ? ` en ${cmDe(disponible)} → SE PASA ${cmDe(-sobra)} cm`
                       : ` en ${cmDe(disponible)} → entra, sobran ${cmDe(sobra)} cm`;
      clase = sobra < 0 ? "mal" : "ok";
    } else {
      txt += " — sin hueco cargado";
    }
    const td = filaDato(e, eje[0].toUpperCase() + eje.slice(1), txt, clase);
    if (r.c.partes[eje].length > 1) td.appendChild(el("div", "detalle", partes));
  }

  // ── Cotización ──
  const avisos = $("avisos"); avisos.innerHTML = "";
  for (const a of r.avisos) {
    avisos.appendChild(el("div", "aviso" + (a.nivel === "error" ? " error" : ""), a.msg));
  }

  const t = $("desglose"); t.innerHTML = "";
  t.hidden = !r.ruta;
  $("precios").hidden = !r.ruta;
  $("cotizaComo").textContent = r.ruta
    ? `Cotiza como: ${r.ruta.perfil.nombre} — ${num(r.p.secciones)} sec × ${num(r.ruta.entrada.ancho)}m, sin enchapar`
    : `No hay perfil para ${d.montaje} en sección ${d.aleta}`;
  for (const l of r.lineas) {
    const tr = el("tr");
    tr.appendChild(el("td", null, l.concepto));
    tr.appendChild(el("td", l.pendiente ? "mal" : null, l.pendiente ? "falta el precio" : fmtUSD(l.importe)));
    t.appendChild(tr);
  }
  if (d.cantidad > 1) {
    const tr = el("tr");
    tr.appendChild(el("td", null, `× ${d.cantidad} unidades`));
    tr.appendChild(el("td", null, fmtUSD(r2(r.unitario * (d.cantidad - 1)))));
    t.appendChild(tr);
  }
  const tot = el("tr");
  tot.appendChild(el("td", null, "Total"));
  tot.appendChild(el("td", null, fmtUSD(r.total)));
  t.appendChild(tot);

  const precios = $("precios"); precios.innerHTML = "";
  for (const fila of preciosVenta(r.total)) {
    const div = el("div", "precio-fila" + (fila.id === "ml" ? " ml" : ""));
    div.appendChild(el("div", "tilde", ""));
    const nom = el("div", "nom", fila.nombre);
    nom.appendChild(el("em", null, fila.nota));
    div.appendChild(nom);
    div.appendChild(el("div", "usd", fmtUSD(fila.usd)));
    div.appendChild(el("div", "ars", fila.ars == null ? "—" : fmtARS(fila.ars)));
    precios.appendChild(div);
  }

  $("resumenPrueba").textContent =
    `${p.bateria.codigo} × ${cmDe(p.largoMm)}cm · ${r.hp.hp ? fmtHP(r.hp.hp) + "HP" : "—"} · ` +
    (r.fit.entra ? "entra" : "no entra");

  // Textos para copiar
  $("btnTaller").onclick = () => copiar($("btnTaller"), A.textoTaller(
    { ...d, largoMm: p.largoMm }, r.ruta, d.cliente));
  $("btnRelevamiento").onclick = () => copiar($("btnRelevamiento"), A.textoRelevamiento(
    { ...d, hueco: r.hueco, largoMm: p.largoMm }, r.ruta, r.hp));
}

async function copiar(boton, texto) {
  if (!texto) return;
  try { await navigator.clipboard.writeText(texto); }
  catch { prompt("Copiá este texto:", texto); return; }
  const antes = boton.textContent;
  boton.textContent = "✓ Copiado";
  setTimeout(() => { boton.textContent = antes; }, 1600);
}

// ── Arranque ─────────────────────────────────────────────────────────────────
$("dolarPrueba").textContent = PRECIOS.venta.dolarOficial
  ? `Dólar oficial ${fmtARS(PRECIOS.venta.dolarOficial)} (el que tenés cargado en la app)`
  : "Sin dólar cargado en la app: las columnas en pesos salen con guión";

$("btnEjemplo").onclick = () => {
  Object.assign(d, {
    tipo: "exhibidora", medidasEquipo: "", mercaderia: "",
    temperatura: "", hueco: { fondo: 32, ancho: 54, alto: 8.5 }, hpUC: 0.33,
    cliente: "Acosta", aleta: "compacta", montaje: "techo", bateria: "3F8C",
    largoCm: 28, coolers: 2, conBandeja: true, cantidad: 1
  });
  toco();
};

dibujarNumeros();
dibujarFormulario();
render();
