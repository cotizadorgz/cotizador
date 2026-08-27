// Historial. Cada vez que se copia algo para el cliente queda registrado solo,
// con la fecha y el dólar de ese día. No hay que acordarse de guardar nada.
//
// Se guarda el texto tal cual salió: es el registro honesto de lo que se mandó.
// Volver a cotizar hoy es otra cosa, y para eso está "Recargar".

const LLAVE = "gz15.historial";
const TOPE = 200;   // más que esto no entra: se van cayendo los más viejos

export function leer(llave = LLAVE) {
  try { return JSON.parse(localStorage.getItem(llave) || "[]"); } catch { return []; }
}

export function registrar(entrada, llave = LLAVE) {
  const lista = leer(llave);
  lista.unshift({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), ...entrada });
  localStorage.setItem(llave, JSON.stringify(lista.slice(0, TOPE)));
  return lista[0];
}

// Se usa cuando una cotización ya registrada termina publicándose en MercadoLibre:
// se le pega el link a la entrada que corresponde, en vez de duplicarla.
export function actualizarPorClave(clave, cambios, llave = LLAVE) {
  if (!clave) return null;
  const lista = leer(llave);
  const i = lista.findIndex(e => e.claveML === clave);
  if (i < 0) return null;
  lista[i] = { ...lista[i], ...cambios };
  localStorage.setItem(llave, JSON.stringify(lista));
  return lista[i];
}

export function borrar(id, llave = LLAVE) {
  localStorage.setItem(llave, JSON.stringify(leer(llave).filter(e => e.id !== id)));
}

export function vaciar(llave = LLAVE) {
  localStorage.removeItem(llave);
}

// Agrupa por día, en orden: primero lo de hoy.
export function porDia(llave = LLAVE) {
  const grupos = new Map();
  for (const e of leer(llave)) {
    const dia = e.fecha.slice(0, 10);
    (grupos.get(dia) ?? grupos.set(dia, []).get(dia)).push(e);
  }
  return [...grupos.entries()];
}

export function fechaLarga(iso) {
  const d = new Date(iso), hoy = new Date();
  const mismoDia = (a, b) => a.toDateString() === b.toDateString();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, hoy)) return "Hoy";
  if (mismoDia(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

export const hora = iso => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
