// Aviso de despacho: de la foto del remito de Vía Cargo al mensaje para el comprador.
//
// Lo que se midió sobre remitos reales (octubre 2026), y por qué cada campo sale de
// donde sale:
//
//   Nº de guía   → del CÓDIGO DE BARRAS, no del texto. Es un Code 128, que lleva
//                  checksum obligatorio: si decodifica, el número está bien por
//                  construcción. Además se contrasta contra el texto del OCR. Dos
//                  lecturas de distinto origen que coinciden es lo más cerca de "no
//                  puede fallar" que se llega sin tipear.
//   Destino      → OCR. Leyó "CoLoN - SAN MARTIN(ENTO24)": bien salvo O/0. Con
//                  ENTREGA A DOMICILIO el destino es la localidad del comprador, no
//                  la sucursal: "HUDSON(CDS11)" es donde llega, pero va a Florencio
//                  Varela.
//   Destinatario → OCR. Leyó "EDUARDO PENDOLA" exacto.
//   Total        → El impreso casi nunca se lee: está finito y pisado por la caja
//                  verde. Se propone la suma de los importes de las líneas —que el
//                  OCR sí lee bien— y se avisa para que se confirme a mano. En los
//                  cuatro remitos de octubre la suma dio exacto el total impreso.
//
// El mensaje va por la mensajería de MercadoLibre, que corta en 350 caracteres y
// rechaza la foto del remito por los datos de contacto (teléfonos, CUIT, domicilios).
// Por eso se manda texto, y sólo lo que el comprador necesita para retirar.

// ── El mensaje ───────────────────────────────────────────────────────────────
export const LIMITE_ML = 350;

export const pesos = n =>
  (n == null || n === "" || !Number.isFinite(Number(n))) ? "" : "$" + Math.round(Number(n)).toLocaleString("es-AR");

// 4.5 → "4,5"; 17 → "17"
export const kilos = n => {
  const v = aNumero(n);
  return v == null ? "" : v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
};

// "999039578401" → "9990-3957-8401". El filtro de ML a veces toma 12 dígitos
// seguidos por un teléfono y rechaza el mensaje; con guiones pasa.
export const guiaConGuiones = g => String(g || "").replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1-");

export const hoy = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const tx = v => String(v ?? "").trim();

// Los renglones con dato vacío se omiten, salvo los cuatro que no pueden faltar
// (ver CAMPOS): un mensaje sin remito o sin peso igual sirve.
export function mensaje(d) {
  const guia = d.guiones ? guiaConGuiones(d.guia) : tx(d.guia);
  const bultos = Math.max(1, parseInt(d.bultos, 10) || 1);
  const kg = kilos(d.peso);
  const destino = tx(d.destino) + (d.domicilio && tx(d.destino) ? " (entrega a domicilio)" : "");
  return [
    "Hola! Ya despachamos tu pedido por Vía Cargo.",
    `Guía: ${guia}`,
    tx(d.remito) && `Remito: ${tx(d.remito)}`,
    tx(d.fecha) && `Fecha: ${tx(d.fecha)}`,
    `Destino: ${destino}`,
    `Destinatario: ${tx(d.destinatario)}`,
    `${bultos} bulto${bultos === 1 ? "" : "s"}` + (kg ? ` - ${kg} kg` : ""),
    `Total a abonar en destino: ${pesos(aNumero(d.total))}`,
    "Avisanos cuando lo recibas. Gracias!"
  ].filter(l => l !== "" && l !== false && l != null).join("\n");
}

// En los cuatro remitos de octubre 2026 el total fue redondo en miles (21.000,
// 78.000, 21.000, 32.000) aunque las líneas tengan centavos. Una suma que no cierra en
// miles es casi seguro un importe mal leído: en una foto con un pliegue, el OCR leyó
// 14.349,99 donde decía 14.949,99 y la suma dio 20.400. Sólo avisa, no corrige.
export const totalRedondo = n => Number.isFinite(n) && Math.round(n) % 1000 === 0;

export const CAMPOS = ["guia", "destino", "destinatario", "total"];
export const faltantes = d => CAMPOS.filter(c => d[c] == null || String(d[c]).trim() === "");

// ── Código de barras ─────────────────────────────────────────────────────────
// La franja de arriba a la derecha, donde está el código en el remito de Vía Cargo.
// Recortar importa: ZXing no decodifica la hoja entera pero sí la franja.
export const ZONA_CODIGO = { x0: 0.5, y0: 0.0, x1: 1.0, y1: 0.12 };

export function recortar(img, z, escala = 1, filtro = "none") {
  const sx = z.x0 * img.naturalWidth, sy = z.y0 * img.naturalHeight;
  const sw = (z.x1 - z.x0) * img.naturalWidth, sh = (z.y1 - z.y0) * img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = Math.round(sw * escala); c.height = Math.round(sh * escala);
  // Para el OCR, el canvas común: con willReadFrequently y suavizado "high" el mismo
  // recorte salía "1447244" en vez de "14.472,44" (medido). Al código de barras le
  // da igual.
  const paraOcr = filtro !== "none";
  const x = c.getContext("2d", paraOcr ? undefined : { willReadFrequently: true });
  if (!paraOcr) x.imageSmoothingQuality = "high";
  x.filter = filtro;
  x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

// Un número de guía plausible: 10 a 15 dígitos.
export const esGuia = v => /^\d{10,15}$/.test(String(v || "").trim());

// Lee el código de barras probando, en orden, lo que menos cuesta:
//   1. BarcodeDetector nativo (Chrome, Android, la PC) — sin descargar nada
//   2. ZXing desde CDN (iPhone: Safari no tiene BarcodeDetector)
// En cada motor se prueba la hoja entera y después la franja a 1x y 2x.
export async function leerCodigo(img, cargarZxing) {
  const intentos = [
    ["hoja", () => recortar(img, { x0: 0, y0: 0, x1: 1, y1: 1 })],
    ["franja", () => recortar(img, ZONA_CODIGO)],
    ["franja x2", () => recortar(img, ZONA_CODIGO, 2)],
    ["franja x4", () => recortar(img, ZONA_CODIGO, 4)]
  ];

  if ("BarcodeDetector" in globalThis) {
    try {
      const det = new BarcodeDetector({ formats: ["code_128", "code_39", "itf", "ean_13"] });
      for (const [donde, hacer] of intentos) {
        const r = await det.detect(hacer());
        const bueno = r.find(b => esGuia(b.rawValue));
        if (bueno) return { guia: bueno.rawValue, motor: "BarcodeDetector", formato: bueno.format, donde };
      }
    } catch { /* seguimos con ZXing */ }
  }

  try {
    const Z = await cargarZxing();
    if (Z) {
      const rdr = new Z.BrowserMultiFormatReader();
      for (const [donde, hacer] of intentos) {
        try {
          const res = rdr.decodeFromCanvas(hacer());
          if (res && esGuia(res.getText())) return { guia: res.getText(), motor: "ZXing", donde };
        } catch { /* probamos el recorte que sigue */ }
      }
    }
  } catch { /* sin código */ }

  return null;
}

// ── Zonas para el OCR ────────────────────────────────────────────────────────
// La hoja entera lee mal los importes (se come centavos y renglones). Recortada y
// ampliada en gris, la tabla de servicios sale casi perfecta. Medido en dos remitos
// reales de octubre: x3 en gris con contraste fue lo mejor.
export const ZONAS_OCR = {
  servicios:    { x0: 0,    y0: 0.47, x1: 1, y1: 0.72, escala: 3, filtro: "grayscale(1) contrast(1.6)" },
  // Segunda pasada, sólo si en la primera quedó algún importe ilegible.
  servicios2:   { x0: 0,    y0: 0.47, x1: 1, y1: 0.72, escala: 2, filtro: "grayscale(1)", reintento: "servicios" },
  destinatario: { x0: 0.48, y0: 0.20, x1: 1, y1: 0.45, escala: 2, filtro: "grayscale(1) contrast(1.6)" }
};

// Junta las tres lecturas. Cada zona manda en lo suyo y la hoja entera cubre lo que
// falte: la guía y el remito sólo están en la hoja; el destinatario la hoja lo lee
// mejor (en la zona se mezcla con "Señor/es"); el destino y la localidad salen
// limpios de la zona; los importes, sólo de la tabla.
export function leerRemito({ hoja = "", servicios = "", servicios2 = "", destinatario = "" }, aprendidos = {}) {
  const h = leerTexto(hoja, aprendidos);
  let s = servicios ? leerTexto(servicios, aprendidos) : {};
  // De las dos pasadas de la tabla, la que leyó todos los importes.
  if (servicios2 && (s.ilegibles?.length || s.totalPropuesto == null)) {
    const s2 = leerTexto(servicios2, aprendidos);
    if (s2.totalPropuesto != null && !s2.ilegibles?.length) s = s2;
  }
  const d = destinatario ? leerTexto(destinatario, aprendidos) : {};
  const out = { ...h };
  out.domicilio = !!(h.domicilio || s.domicilio);
  // Los importes van en bloque: mezclar líneas de dos lecturas duplicaría la suma.
  if (s.totalPropuesto != null) {
    for (const k of ["totalPropuesto", "importes", "reembolso", "ilegibles"]) out[k] = s[k];
  }
  out.totalImpreso = s.totalImpreso ?? h.totalImpreso;
  if (s.peso != null) out.peso = s.peso;
  if (d.localidad) out.localidad = d.localidad;
  if (d.destino && !out.domicilio) { out.destino = d.destino; out.destinoCrudo = d.destinoCrudo; }
  if (!out.destinatario && d.destinatario) out.destinatario = d.destinatario;
  // Con domicilio se recalcula con la localidad que haya quedado.
  if (out.domicilio && out.localidad) {
    out.destinoCrudo = "DOMICILIO " + out.localidad.toUpperCase();
    out.destino = aprendidos[out.destinoCrudo] || out.localidad;
  }
  return out;
}

// ── Texto del remito ─────────────────────────────────────────────────────────
const limpiar = t => String(t || "").replace(/\s+/g, " ").trim();

// Códigos de provincia que usa Vía Cargo en el destino: COLON - SAN MARTIN(ENT024).
// Vistos en remitos reales: ENT, NQN, LPM (La Pampa) y CDS (Hudson, conurbano sur).
// Editable: si aparece uno que no está, se agrega acá y el destino sale bien solo.
export const PROVINCIAS = {
  BUE: "BA", CDS: "BA", CAP: "CABA", ENT: "ER", SFE: "SF", COR: "CBA", MZA: "MZA",
  TUC: "TUC", SAL: "SAL", CHA: "CHA", MIS: "MIS", RNE: "RN", NQN: "NQN",
  CHU: "CHU", SCR: "SC", TDF: "TF", LPA: "LP", LPM: "LP", SLU: "SL", SJU: "SJ",
  CAT: "CAT", LRJ: "LR", SGO: "SE", JUJ: "JUJ", FSA: "FSA", CTE: "CTE"
};

// "COLON - SAN MARTIN(ENT024)" → "Colón - San Martín (ER)". Los acentos no se
// pueden adivinar: se escriben una vez y la app los recuerda (ver aprendidos).
export function formatearDestino(crudo, aprendidos = {}) {
  const t = limpiar(crudo);
  if (!t) return "";
  if (aprendidos[t]) return aprendidos[t];
  // El OCR confunde O con 0: "(ENTO24)" en vez de "(ENT024)". Se tolera.
  const m = /^(.*?)\(?\s*([A-Za-z]{3})\s*[A-Za-z0-9]{0,4}\s*\)?$/.exec(t);
  const cuerpo = m ? m[1] : t;
  const prov = m ? PROVINCIAS[m[2].toUpperCase()] : null;
  const bonito = cuerpo.replace(/[-–]/g, " - ").split(/\s+/)
    .map(p => (p === "-" ? "-" : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ").trim();
  return prov ? `${bonito} (${prov})` : bonito;
}

export const titulo = t => limpiar(t).split(/\s+/)
  .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");

// "14.949,99" → 14949.99
export function aNumero(txt) {
  if (typeof txt === "number") return Number.isFinite(txt) ? txt : null;
  const t = String(txt ?? "").replace(/[^\d.,]/g, "");
  if (!t) return null;
  // "4.5" tipeado a mano es decimal, no miles: sólo hay miles con 3 dígitos detrás.
  if (/^\d+\.\d{1,2}$/.test(t)) return parseFloat(t);
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Un importe como lo deja el OCR: "14.949,99", "100,000,00", "14:349;99", "11.477.55".
// El último separador seguido de dos dígitos es el de los centavos; los demás son de
// miles. Sin separadores ("14949997") no se adivina: devuelve null.
export function importe(trozo) {
  const m = /^[^\d]{0,3}(\d{1,3}(?:[.,:;]\d{3})*)[.,:;](\d{2})(?!\d)/.exec(String(trozo || "").trim());
  return m ? parseFloat(m[1].replace(/[.,:;]/g, "") + "." + m[2]) : null;
}

// Saca lo que se pueda del texto que devolvió el OCR. Cada campo trae de dónde
// salió, para poder mostrarlo y para no tapar lo que ya tocó el usuario.
export function leerTexto(texto, aprendidos = {}) {
  const t = String(texto || "");
  const out = {};

  const g = /GUIA\s*N[oº°.]*\s*[:.]?\s*(\d{10,15})/i.exec(t);
  if (g) out.guiaTexto = g[1];

  // REMITO 5535-52386. El OCR a veces se come el guión o mete un espacio.
  const r = /REMITO\s*[:.]?\s*(\d{4})\s*[-–—]?\s*(\d{5})/i.exec(t);
  if (r) out.remito = `${r[1]}-${r[2]}`;

  // El peso de la encomienda: "ENCOMIENDA 4,50 Kg". Se toma el primero con Kg.
  // Tolera "6:00 Kg" y "6,00 — Kg", que es como lo deja el OCR.
  const k = /(\d{1,3})(?:[.,:;](\d{1,2}))?\s*[—–-]?\s*K\s*g\b/i.exec(t);
  if (k) out.peso = parseFloat(k[1] + "." + (k[2] || "0"));

  // Con entrega a domicilio el destino útil es la localidad del destinatario: la
  // última línea "Localidad" del remito (la primera es la del remitente).
  out.domicilio = /ENTREGA\s+A\s+DOMICILIO|DOMICILIO\s*\$/i.test(t);
  // El OCR suele juntar las dos en un renglón ("Localidad MUÑIZ Localidad COLON"):
  // se corta en la última palabra Localidad y se toma lo que sigue.
  // Y a veces el valor queda un renglón ARRIBA de la palabra ("FLORENCIO VARELA\n
  // Localidad"): si después no hay nada, se mira el renglón anterior.
  const partes = t.split(/Localidad/i);
  if (partes.length > 1) {
    const LETRAS = /([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ .]{2,40})/;
    const despues = partes[partes.length - 1].split("\n")[0];
    let m = new RegExp("^\\s*[:.]?\\s*" + LETRAS.source).exec(despues);
    if (!m || m[1].trim().length < 3) {
      const antes = partes[partes.length - 2].split("\n");
      const previo = antes[antes.length - 1].trim() || antes[antes.length - 2] || "";
      m = new RegExp(LETRAS.source + "\\s*$").exec(previo.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ .]+$/, ""));
    }
    const loc = m ? m[1].trim() : "";
    if (loc.length > 2) out.localidad = titulo(loc);
  }

  // Destino. El OCR junta el del remitente y el del destinatario en una sola línea
  // ("DESTINQuR1z(BUE171) DESTINO CoLoN - SAN MARTIN(ENTO24)") y además hay un
  // "CONTADO DESTINO" que no es un destino. Por eso no se ancla en la palabra
  // DESTINO sino en el CÓDIGO DE PROVINCIA entre paréntesis, que es inconfundible,
  // y se toma el último: el del destinatario siempre va después del de origen.
  // El código del destino lleva números detrás —(BUE171), (ENT024)— y el de la
  // línea "Localidad COLON (ENT)" no. Exigir esos 2 a 4 caracteres es lo que
  // distingue uno de otro: sin eso agarraba la localidad del remitente.
  const codigos = [...t.matchAll(/\(\s*([A-Za-z]{3})\s*([A-Za-z0-9]{2,4})\s*\)/g)];
  // Primero los que están en una línea que dice DESTINO; si no hay, el último.
  const conDestino = codigos.filter(c => {
    const ini = t.lastIndexOf("\n", c.index) + 1;
    return /DESTINO/i.test(t.slice(ini, c.index));
  });
  const elegidos = conDestino.length ? conDestino : codigos;
  if (elegidos.length) {
    const ult = elegidos[elegidos.length - 1];
    const antes = t.slice(0, ult.index);
    const corte = Math.max(antes.toUpperCase().lastIndexOf("DESTINO"), antes.lastIndexOf("\n"));
    const cuerpo = antes.slice(corte < 0 ? 0 : corte).replace(/^\n/, "").replace(/^DESTINO[\s:]*/i, "");
    const crudo = limpiar(cuerpo + ult[0]);
    if (crudo.length > 4 && crudo.length < 60) {
      out.destinoCrudo = crudo;
      out.destino = formatearDestino(crudo, aprendidos);
    }
  }
  // A domicilio: la sucursal no le dice nada al comprador, la localidad sí.
  if (out.domicilio && out.localidad) {
    out.destinoCrudo = "DOMICILIO " + out.localidad.toUpperCase();
    out.destino = aprendidos[out.destinoCrudo] || out.localidad;
  }

  // Destinatario. Misma historia: "Señor/esszequIPAMIENTO DE Señor/es _ EDUARDO
  // PENDOLA" viene en un solo renglón. Se busca la ÚLTIMA aparición de "Señor" y se
  // toma lo que sigue hasta el fin de esa línea.
  const marcas = [...t.matchAll(/Se[ñn]or/gi)];
  if (marcas.length) {
    const u = marcas[marcas.length - 1];
    const resto = t.slice(u.index + u[0].length).split("\n")[0]
      .replace(/^\s*\/?\s*e?s?\b/i, "")
      .replace(/^[\s:_.\-]+/, "");
    const nombre = (/^[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s.]{3,40}/.exec(resto) || [])[0];
    if (nombre) out.destinatario = titulo(nombre);
  }

  // Importes, renglón por renglón. El total impreso casi nunca se lee: se propone la
  // suma de las líneas del servicio y se marca como propuesto.
  //   ENCOMIENDA ... $ 14.949,99            → flete
  //   P. REEMBOLSO $ 100.000,00 $ 6.050,00  → el primero es el reembolso (plata que
  //                                           Vía Cargo cobra para el remitente, NO
  //                                           va); el segundo es la comisión, que sí
  //   ENTREGA A DOMICILIO $ 11.477,55       → va
  //   $ 32.000,00 Total                     → el total impreso, para contrastar
  const lineas = [], ilegibles = [];
  let vReemb = null;
  for (const renglon of t.split("\n")) {
    if (!renglon.includes("$")) continue;
    const trozos = renglon.split("$").slice(1);
    const montos = trozos.map(importe);
    if (/Total/i.test(renglon)) {
      const v = montos.find(m => m != null);
      if (v != null) out.totalImpreso = v;
      continue;
    }
    if (/REEMBOLSO/i.test(renglon)) {
      vReemb = montos[0];
      montos.slice(1).forEach((m, i) => m != null ? lineas.push(m) : ilegibles.push(trozos[i + 1].trim()));
      continue;
    }
    // Un renglón de servicio lleva un solo importe: el último.
    const ult = montos[montos.length - 1];
    if (ult != null) lineas.push(ult);
    else if (/\d{3}/.test(trozos[trozos.length - 1])) ilegibles.push(trozos[trozos.length - 1].trim());
  }
  if (lineas.length) {
    out.totalPropuesto = Math.round(lineas.reduce((a, n) => a + n, 0));
    out.importes = lineas;
  }
  if (vReemb != null) out.reembolso = vReemb;
  if (ilegibles.length) out.ilegibles = ilegibles;
  return out;
}
