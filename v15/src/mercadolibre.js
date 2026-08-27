// Publicación en MercadoLibre a través del bot de GZ.
// El bot corre 24/7, tiene el token de ML y crea la publicación a partir de una
// plantilla. Acá sólo se arma el pedido y se muestra lo que responde.

import { fmtHP } from "./motor.js";

export const ML = {
  url: "https://gzbot.duckdns.org/publicar",
  plantilla: "MLA2029099995",
  maxTitulo: 60,
  precioMin: 50000,
  precioMax: 5000000,
  horasPausa: 24
};

const LLAVE_CLAVE = "gz15.mlClave";

// La clave no puede estar en el repositorio: la app es pública. Se la pedimos al
// usuario una vez y queda en su dispositivo, igual que los dólares.
export const leerClave = () => localStorage.getItem(LLAVE_CLAVE) || "";
export const guardarClave = c => localStorage.setItem(LLAVE_CLAVE, c.trim());
export const borrarClave = () => localStorage.removeItem(LLAVE_CLAVE);

// Nombre genérico por producto. ML igual lo reescribe a Tipo Título.
export const FAMILIA = {
  ev:   "EVAPORADOR ESTÁTICO",
  oli:  "EVAPORADOR ESTÁTICO COMPACTO",
  resp: "RESPALDAR ESTÁTICO",
  fd:   "FORZADOR LATERAL",
  fs:   "FORZADOR LATERAL",
  fc:   "FORZADOR LATERAL COMPACTO",
  col:  "COLUMNA PARA BATEA",
  cub:  "FORZADOR CÚBICO",
  rcam: "FORZADOR DE RESPALDO",
  t58:  "FORZADOR DE TECHO",
  t38:  "FORZADOR DE TECHO",
  car:  "RESPALDO PARA CARNICERAS",
  da:   "FORZADOR DOBLE ATAQUE",
  pt:   "FORZADOR DE PISO",
  cond: "CONDENSADOR"
};

// "A MEDIDA - FORZADOR LATERAL - JUAN X". El nombre del producto queda siempre
// entero; el del cliente se recorta a lo que entre. Nunca se pasa de 60.
export function tituloML(pid, cliente = "") {
  const base = `A MEDIDA - ${FAMILIA[pid] || "EQUIPO"}`;
  const nombre = (cliente || "").trim().toUpperCase();
  if (!nombre) return base;
  const libre = ML.maxTitulo - base.length - 3;      // 3 = " - "
  if (libre < 4) return base;                        // no entra nada útil
  return `${base} - ${nombre.length > libre ? nombre.slice(0, libre - 1).trimEnd() + "…" : nombre}`;
}

export const vencimiento = (horas = ML.horasPausa) => new Date(Date.now() + horas * 3600e3);

export function descripcionML(perfil, cot, vence = vencimiento()) {
  const e = cot.entrada;
  const partes = [perfil.nombre];
  if (e.hp) partes[0] += ` ${fmtHP(e.hp)}HP`;
  if (e.modelo) partes[0] += ` ${e.modelo}`;
  if (perfil.medida) partes.push(perfil.medida(e).replace(" sec x ", " secciones x "));

  const aclara = [];
  if (perfil.chapa && !e.enchapado && perfil.textoSinChapa) aclara.push(perfil.textoSinChapa);
  if (e.reforzado) aclara.push("con ventiladores 300mm reforzados");
  if (e.bajaTemp && perfil.bajaTemp) aclara.push("incluye opcional de baja temperatura");
  if (e.colector) aclara.push("con colector y distribuidor");
  if (e.extra && e.extra.importe) aclara.push(`con ${((e.extra.nombre || "adicional").trim()).toLowerCase()}`);
  for (const o of perfil.opciones || []) {
    const t = e[o.id] ? o.si : o.no;
    if (t) aclara.push((e[o.id] ? "con " : "sin ") + (typeof t === "function" ? t(e) : t));
  }
  if (cot.noIncluye?.length) aclara.push(`no incluye ${cot.noIncluye.map(x => x.toLowerCase()).join(", ")}`);
  if (e.cantidad > 1) aclara.push(`${e.cantidad} unidades`);

  const f = vence.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const h = vence.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return [
    partes.join("\n"),
    aclara.length ? aclara.map(a => a.charAt(0).toUpperCase() + a.slice(1) + ".").join("\n") : null,
    "Fabricación: 2 a 3 días hábiles.",
    `Publicación válida hasta el ${f} a las ${h}.`
  ].filter(Boolean).join("\n\n");
}

export function revisar({ titulo, precio }) {
  const problemas = [];
  if (titulo.length > ML.maxTitulo) problemas.push(`El título tiene ${titulo.length} caracteres y el máximo es ${ML.maxTitulo}.`);
  if (!Number.isFinite(precio) || precio <= 0) problemas.push("No hay un precio de MercadoLibre calculado.");
  else if (precio < ML.precioMin) problemas.push(`El precio (${precio.toLocaleString("es-AR")}) está por debajo del mínimo que acepta el bot ($${ML.precioMin.toLocaleString("es-AR")}).`);
  else if (precio > ML.precioMax) problemas.push(`El precio (${precio.toLocaleString("es-AR")}) supera el máximo que acepta el bot ($${ML.precioMax.toLocaleString("es-AR")}).`);
  return problemas;
}

// El bot siempre contesta JSON con un campo ok. No hay que comparar el texto del
// error contra cadenas fijas: se muestra tal cual viene.
export async function publicar({ titulo, descripcion, precio, clave_idempotencia }, apiKey) {
  let r;
  try {
    r = await fetch(ML.url, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo, descripcion, precio,
        plantilla: ML.plantilla,
        clave_idempotencia,
        pausar_a_las_horas: ML.horasPausa
      })
    });
  } catch {
    return { ok: false, error: "No se pudo llegar al servidor. Revisá la conexión e intentá de nuevo — con el mismo botón, que no duplica la publicación." };
  }
  let d;
  try { d = await r.json(); }
  catch { return { ok: false, error: `El servidor respondió ${r.status} sin datos utilizables.` }; }
  // El 409 (duplicado reciente) trae item_id y link de la publicación que ya existe:
  // no es un error que haya que arreglar, es información con un link útil.
  if (!d.ok) return { ...d, ok: false, error: d.error || `Error ${r.status}.`, codigo: r.status };
  return { ...d, codigo: r.status };
}
