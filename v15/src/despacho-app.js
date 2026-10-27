// Pantalla del aviso de despacho dentro del cotizador: foto del remito de Vía Cargo →
// mensaje para el comprador de MercadoLibre. La lectura vive en despacho.js; acá sólo
// la entrada de la foto, el formulario y el mensaje.
//
// Las librerías se bajan del CDN RECIÉN cuando hacen falta, no al abrir la app: el
// código de barras nativo no baja nada, ZXing son ~250KB y sólo cae en iPhone, y
// Tesseract (~6MB) sólo si está tildado leer el resto. Sin ellas funciona igual:
// tipeás los campos.

import * as D from "./despacho.js";

const LLAVE = "gz15.despacho";
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

function leerGuardado() {
  try {
    const g = JSON.parse(localStorage.getItem(LLAVE) || "null");
    if (g) return g;
    // Lo que se aprendió en la página de prueba no se pierde.
    const viejo = JSON.parse(localStorage.getItem("gz15.prueba-despacho") || "{}");
    return { aprendidos: viejo.aprendidos || {} };
  } catch { return {}; }
}
const guardado = leerGuardado();

const VACIO = () => ({
  guia: "", remito: "", fecha: D.hoy(), destino: "", destinatario: "",
  bultos: 1, peso: "", total: "", domicilio: false,
  // De dónde salió cada campo, para mostrarlo y para no pisar lo tipeado.
  origen: {},
  destinoCrudo: "", img: null, leyendo: false
});

const estado = {
  ...VACIO(),
  guiones: !!guardado.guiones,
  // Destinos ya corregidos a mano: la segunda vez que mandás a Colón sale con acento.
  aprendidos: guardado.aprendidos || {}
};

const guardar = () => {
  try { localStorage.setItem(LLAVE, JSON.stringify({ aprendidos: estado.aprendidos, guiones: estado.guiones })); }
  catch { /* sin almacenamiento: se pierde lo aprendido, nada más */ }
};

// ── Carga diferida de librerías ──────────────────────────────────────────────
const cdn = src => new Promise((ok, mal) => {
  const s = document.createElement("script");
  s.src = src; s.onload = ok; s.onerror = () => mal(new Error("no se pudo bajar " + src));
  document.head.appendChild(s);
});

let zxing = null;
async function cargarZxing() {
  if (zxing) return zxing;
  await cdn("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js");
  zxing = globalThis.ZXingBrowser || null;
  return zxing;
}

let tess = null;
async function cargarTesseract() {
  if (tess) return tess;
  await cdn("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
  tess = globalThis.Tesseract || null;
  return tess;
}

// ── Entrada de la foto: cámara, arrastrar, elegir y pegar ────────────────────
function tomarArchivo(file) {
  if (!file || !file.type.startsWith("image/")) {
    avisar("Eso no es una imagen. Mandá la foto del remito.", "error");
    return;
  }
  const img = new Image();
  img.onload = () => {
    Object.assign(estado, { ...VACIO(), img });
    dibujarFoto(); procesar();
  };
  img.onerror = () => avisar("No se pudo abrir la imagen.", "error");
  img.src = URL.createObjectURL(file);
}

function engancharEntrada() {
  const zona = $("despZona");
  $("despArchivo").onchange = e => tomarArchivo(e.target.files[0]);
  $("despCamara").onchange = e => tomarArchivo(e.target.files[0]);
  $("despBtnElegir").onclick = () => $("despArchivo").click();
  $("despBtnCamara").onclick = () => $("despCamara").click();

  for (const ev of ["dragenter", "dragover"]) {
    zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add("encima"); });
  }
  for (const ev of ["dragleave", "drop"]) {
    zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove("encima"); });
  }
  zona.addEventListener("drop", e => tomarArchivo(e.dataTransfer?.files?.[0]));

  // Pegar con Ctrl+V / Cmd+V. Sólo con la caja abierta: el resto de la app no
  // tiene nada que hacer con una imagen pegada.
  addEventListener("paste", e => {
    if (!$("cajaDespacho").open) return;
    const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if (it) { e.preventDefault(); tomarArchivo(it.getAsFile()); }
  });
}

function dibujarFoto() {
  const c = $("despFoto");
  c.innerHTML = "";
  if (!estado.img) { $("despZona").hidden = false; return; }
  $("despZona").hidden = true;
  const i = new Image();
  i.src = estado.img.src;
  i.alt = "Remito";
  c.appendChild(i);
}

// ── Lectura ──────────────────────────────────────────────────────────────────
const avisos = [];
function avisar(msg, nivel = "aviso") { avisos.push({ msg, nivel }); dibujarAvisos(); }
function limpiarAvisos() { avisos.length = 0; dibujarAvisos(); }

function dibujarAvisos() {
  const c = $("despAvisos"); c.innerHTML = "";
  for (const a of avisos) c.appendChild(el("div", "aviso" + (a.nivel === "error" ? " error" : a.nivel === "ok" ? " ok" : ""), a.msg));
}

// El número de guía es el que no puede fallar: se lee del código de barras (Code 128,
// con checksum) y se contrasta contra el texto del OCR. Coincidencia = verde.
async function procesar() {
  if (!estado.img || estado.leyendo) return;
  estado.leyendo = true;
  limpiarAvisos();
  $("despEstado").textContent = "Leyendo el código de barras…";
  render();

  const cod = await D.leerCodigo(estado.img, cargarZxing);
  if (cod) {
    estado.guia = cod.guia;
    estado.origen.guia = { via: "barras", motor: cod.motor, confirmado: false };
    avisar(`Guía leída del código de barras: ${cod.guia}`, "ok");
  } else {
    estado.origen.guia = { via: "nada" };
    avisar("No se pudo leer el código de barras. Cargá el número de guía a mano y revisalo contra el remito.", "error");
  }
  $("despEstado").textContent = "";
  estado.leyendo = false;
  render();

  if ($("despConOcr").checked) leerElResto();
}

async function leerElResto() {
  if (!estado.img) return;
  const est = $("despEstado");
  est.textContent = "Bajando el lector de texto (la primera vez tarda)…";
  let T;
  try { T = await cargarTesseract(); }
  catch { est.textContent = ""; avisar("No se pudo bajar el lector de texto. Cargá los campos a mano.", "error"); return; }
  if (!T) { est.textContent = ""; return; }

  // Tres pasadas: la hoja entera (guía, remito, destinatario) y dos zonas ampliadas
  // (tabla de importes y destino), que la hoja entera lee mal. Ver ZONAS_OCR.
  const textos = {};
  try {
    const w = await T.createWorker("spa");
    est.textContent = "Leyendo el remito (1 de 3)…";
    textos.hoja = (await w.recognize(estado.img.src)).data.text;
    let i = 2;
    for (const [nombre, z] of Object.entries(D.ZONAS_OCR)) {
      // El reintento sólo corre si la primera pasada dejó algún importe sin leer.
      if (z.reintento && !D.leerTexto(textos[z.reintento]).ilegibles?.length) continue;
      est.textContent = z.reintento ? "Releyendo los importes…" : `Leyendo el remito (${i++} de 3)…`;
      textos[nombre] = (await w.recognize(D.recortar(estado.img, z, z.escala, z.filtro))).data.text;
    }
    await w.terminate();
  } catch (e) {
    est.textContent = ""; avisar("El lector de texto falló: " + e, "error"); return;
  }
  est.textContent = "";

  const d = D.leerRemito(textos, estado.aprendidos);
  const poner = (campo, valor, via = "texto") => {
    if (valor == null || valor === "" || estado.origen[campo]?.via === "mano") return;
    estado[campo] = valor; estado.origen[campo] = { via };
  };

  // Contraste del número de guía: dos lecturas de distinto origen.
  if (d.guiaTexto) {
    if (estado.origen.guia?.via === "barras") {
      if (d.guiaTexto === estado.guia) {
        estado.origen.guia.confirmado = true;
        avisar("Guía verificada: el código de barras y el texto del remito dan el mismo número.", "ok");
      } else {
        avisar(`OJO con la guía: el código de barras dice ${estado.guia} y el texto dice ${d.guiaTexto}. Revisala contra el remito antes de mandar.`, "error");
      }
    } else if (!estado.guia) {
      poner("guia", d.guiaTexto);
      avisar(`Guía leída del texto (sin código de barras): ${d.guiaTexto}. Verificala contra el remito.`, "error");
    }
  }

  poner("remito", d.remito);
  poner("peso", d.peso != null ? D.kilos(d.peso) : null);
  poner("destinatario", d.destinatario);
  if (d.destino) { poner("destino", d.destino); estado.destinoCrudo = d.destinoCrudo || ""; }
  if (estado.origen.domicilio?.via !== "mano") estado.domicilio = !!d.domicilio;
  if (d.domicilio) avisar("El remito dice ENTREGA A DOMICILIO: el destino es la localidad del comprador, no la sucursal.");

  // El total impreso casi nunca se lee: se propone la suma de las líneas y se avisa.
  if (d.totalPropuesto) {
    poner("total", d.totalPropuesto, "suma");
    const lineas = d.importes.map(D.pesos).join(" + ");
    if (d.totalImpreso != null && Math.round(d.totalImpreso) === d.totalPropuesto) {
      estado.origen.total = { via: "verificado" };
      avisar(`Total verificado: la suma de las líneas (${lineas}) da el total impreso.`, "ok");
    } else if (d.totalImpreso != null) {
      avisar(`OJO con el total: las líneas suman ${D.pesos(d.totalPropuesto)} pero el impreso parece ${D.pesos(d.totalImpreso)}. Revisalo contra el remito.`, "error");
    } else if (!D.totalRedondo(d.totalPropuesto)) {
      avisar(`OJO con el total: las líneas suman ${D.pesos(d.totalPropuesto)} (${lineas}), y el total de Vía Cargo siempre viene redondo en miles. Seguro algún importe se leyó mal: copialo del remito.`, "error");
    } else {
      avisar(`Total propuesto ${D.pesos(d.totalPropuesto)}: es la suma de las líneas del servicio (${lineas}). Confirmalo contra el remito.`);
    }
  } else {
    avisar("No pude leer ningún importe. Cargá el total a mano.", "error");
  }
  if (d.ilegibles?.length) {
    avisar(`Hay ${d.ilegibles.length === 1 ? "un importe que no se pudo leer" : d.ilegibles.length + " importes que no se pudieron leer"} (${d.ilegibles.join(", ")}): no está en la suma. Cargá el total a mano.`, "error");
  }
  if (d.reembolso) {
    avisar(`El remito tiene P. REEMBOLSO ${D.pesos(d.reembolso)}. No va en el total ni en el mensaje.`);
  }
  render();
}

// ── Formulario y mensaje ─────────────────────────────────────────────────────
const CAMPOS_FORM = [
  ["guia", "Nº de guía", "numeric", "999038945331"],
  ["remito", "Remito", "text", "5535-52386"],
  ["fecha", "Fecha", "text", "dd/mm/aaaa"],
  ["destino", "Destino", "text", "Colón - San Martín (ER)"],
  ["destinatario", "Destinatario", "text", ""],
  ["bultos", "Bultos", "numeric", "1"],
  ["peso", "Peso (kg)", "decimal", "4,5"],
  ["total", "Total a abonar en destino", "numeric", "21000"]
];
const ORIGEN_TEXTO = {
  texto: "del texto, revisalo", suma: "sumado de las líneas, confirmalo",
  verificado: "verificado", mano: "a mano"
};

function dibujarCampos() {
  const c = $("despCampos"); c.innerHTML = "";
  for (const [campo, etiqueta, modo, ejemplo] of CAMPOS_FORM) {
    const lab = el("label");
    const tit = el("span", null, etiqueta);
    const o = estado.origen[campo];
    if (campo === "guia" && o?.via === "barras") {
      tit.appendChild(el("em", o.confirmado ? "sello ok" : "sello",
        o.confirmado ? " verificada" : " del código de barras"));
    } else if (o?.via && o.via !== "nada") {
      tit.appendChild(el("em", "sello " + (o.via === "verificado" ? "ok" : "aviso"), " " + (ORIGEN_TEXTO[o.via] || o.via)));
    }
    lab.appendChild(tit);
    const inp = el("input");
    inp.type = "text"; inp.inputMode = modo; inp.placeholder = ejemplo;
    inp.value = estado[campo] ?? "";
    inp.oninput = () => {
      estado[campo] = inp.value;
      estado.origen[campo] = { via: "mano" };
      // Si corregís el destino, queda aprendido para el próximo envío al mismo lugar.
      if (campo === "destino" && estado.destinoCrudo && inp.value.trim()) {
        estado.aprendidos[estado.destinoCrudo] = inp.value.trim();
        guardar();
      }
      dibujarMensaje();
    };
    lab.appendChild(inp);
    c.appendChild(lab);
  }
  $("despDomicilio").checked = estado.domicilio;
  $("despDomicilio").parentElement.dataset.on = String(estado.domicilio);
  $("despGuiones").checked = estado.guiones;
  $("despGuiones").parentElement.dataset.on = String(estado.guiones);
}

function dibujarMensaje() {
  const falta = D.faltantes(estado);
  const texto = D.mensaje(estado);
  $("despMensaje").textContent = texto;
  $("despBtnCopiar").disabled = falta.length > 0;
  const largo = texto.length;
  const cuenta = $("despCuenta");
  cuenta.textContent = `${largo} / ${D.LIMITE_ML} caracteres`;
  cuenta.className = "desp-cuenta" + (largo > D.LIMITE_ML ? " pasado" : "");
  const etiquetas = Object.fromEntries(CAMPOS_FORM.map(([c, e]) => [c, e]));
  $("despFaltan").textContent = falta.length
    ? `Falta cargar: ${falta.map(f => etiquetas[f].toLowerCase()).join(", ")}`
    : largo > D.LIMITE_ML ? `Se pasa por ${largo - D.LIMITE_ML}: MercadoLibre no lo va a dejar mandar.` : "";
}

function render() {
  dibujarCampos();
  dibujarMensaje();
  $("despResumen").textContent = estado.guia ? `Guía ${estado.guia}` : "Remito de Vía Cargo";
}

export function montarDespacho() {
  engancharEntrada();

  $("despDomicilio").onchange = e => {
    estado.domicilio = e.target.checked;
    estado.origen.domicilio = { via: "mano" };
    e.target.parentElement.dataset.on = String(estado.domicilio);
    dibujarMensaje();
  };
  $("despConOcr").onchange = e => { e.target.parentElement.dataset.on = String(e.target.checked); };
  $("despGuiones").onchange = e => {
    estado.guiones = e.target.checked;
    e.target.parentElement.dataset.on = String(estado.guiones);
    guardar(); dibujarMensaje();
  };

  $("despBtnCopiar").onclick = async () => {
    const t = D.mensaje(estado);
    try { await navigator.clipboard.writeText(t); }
    catch { prompt("Copiá el mensaje:", t); return; }
    const b = $("despBtnCopiar"), antes = b.textContent;
    b.textContent = "✓ Copiado";
    setTimeout(() => { b.textContent = antes; }, 1800);
  };

  $("despBtnLeerResto").onclick = leerElResto;

  $("despBtnLimpiar").onclick = () => {
    Object.assign(estado, VACIO());
    $("despArchivo").value = ""; $("despCamara").value = "";
    limpiarAvisos(); dibujarFoto(); render();
  };

  dibujarFoto();
  render();
}
