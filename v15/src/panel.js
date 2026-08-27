// Panel de precios. Recorre PRECIOS y arma un campo por cada número editable.
// No hay una lista de campos escrita a mano: si mañana aparece un producto nuevo
// en precios.js, sus números aparecen solos acá.

import { PRECIOS } from "./precios.js";
import { PERFILES } from "./perfiles.js";
import { MODELOS } from "./modelos.js";
import { cotizar, r2, fmtUSD, fmtHP, leerNumero } from "./motor.js";
import * as L from "./lista-publicada.js";

const LLAVE = "gz15.precios";

// Estos no se tocan desde acá: los dos dólares viven en la cabecera.
const EXCLUIR = ["venta.dolarOficial", "venta.dolarML"];

// Las rutas son arrays, no strings con puntos: los condensadores tienen claves
// como 0.25 y 0.33, y separar por punto rompía el camino.
const clave = ruta => JSON.stringify(ruta);
const desdeClave = k => (k.startsWith("[") ? JSON.parse(k) : k.split("."));

const GRUPOS = {
  ventiladores: "Ventiladores",
  tarifas: "Tarifas por sección y metro",
  adicionales: "Adicionales",
  colDist: "Columnas y distribuidores",
  bateriaCubicoEnchapado: "Batería del cúbico enchapado ($/metro)",
  precioMetro: "Precio por metro — tablas enchapadas",
  condensadores: "Condensadores",
  ajustes: "Ajustes nombrados",
  rangos: "Rangos válidos",
  bajaTemperatura: "Baja temperatura",
  markupEstatico: "Markup por tamaño — estático y respaldar",
  aletas: "Geometría de las aletas",
  separacionEspecial: "Separación especial de los compactos (mm)",
  hpCompacto: "Secciones a HP en los compactos",
  frigoriasPorHP: "Frigorías por HP",
  wattPorFrigoria: "Watts por frigoría",
  venta: "Venta"
};

// Los tramos de col/dist se cortan por HP, pero los del markup del estático y los
// costados del lateral doble se cortan por SECCIONES: rotularlos "hasta 5HP" hacía
// leer mal la tabla.
const TRAMOS_POR_SECCION = ["markupEstatico", "fd"];
const topeTramo = (ruta, n) =>
  TRAMOS_POR_SECCION.includes(ruta[ruta.length - 1]) ? `${n} sec` : `${fmtHP(n)}HP`;

// ── Recorrido del árbol ──────────────────────────────────────────────────────
const esTramos = v => Array.isArray(v) && v.length > 0 &&
  v.every(x => Array.isArray(x) && x.length === 2 && typeof x[1] === "number");

function hojas(obj, prefijo = [], salida = []) {
  for (const [k, valor] of Object.entries(obj)) {
    const ruta = [...prefijo, k];
    if (EXCLUIR.includes(ruta.join("."))) continue;
    if (typeof valor === "number") salida.push({ ruta, valor, tipo: "numero" });
    else if (esTramos(valor)) salida.push({ ruta, valor, tipo: "tramos" });
    else if (valor && typeof valor === "object") hojas(valor, ruta, salida);
  }
  return salida;
}

export function leerEn(obj, ruta) {
  return ruta.reduce((o, k) => o?.[k], obj);
}

export function escribirEn(obj, ruta, valor) {
  const partes = [...ruta];
  const ultima = partes.pop();
  const destino = partes.reduce((o, k) => o[k], obj);
  destino[ultima] = valor;
}

// ── Persistencia ─────────────────────────────────────────────────────────────
export const leerCambios = () => JSON.parse(localStorage.getItem(LLAVE) || "{}");

export function aplicarCambios(cambios = leerCambios()) {
  for (const [k, valor] of Object.entries(cambios)) {
    try { escribirEn(PRECIOS, desdeClave(k), valor); } catch { /* ruta que ya no existe */ }
  }
}

function guardarCambio(ruta, valor) {
  const cambios = leerCambios();
  cambios[clave(ruta)] = valor;
  localStorage.setItem(LLAVE, JSON.stringify(cambios));
  escribirEn(PRECIOS, ruta, valor);
}

// ── Verificación contra la lista impresa ─────────────────────────────────────
// Después de tocar un precio, esto dice si algún modelo publicado dejó de dar
// el número de la lista. Es la red de seguridad de todo el panel.
export function verificar() {
  const fallas = [];
  const contra = { cub: L.CUB, rcam: L.RCAM, t58: L.T58, t38: L.T38, car: L.CAR };
  for (const [pid, publicados] of Object.entries(contra)) {
    MODELOS[pid].forEach((m, i) => {
      const { et, ...entrada } = m;
      const base = cotizar(PERFILES[pid], { ...entrada, enchapado: true }).base;
      if (r2(base) !== r2(publicados[i].cc)) fallas.push({ que: `${PERFILES[pid].nombre} · ${et}`, lista: publicados[i].cc, ahora: base });
    });
  }
  for (const m of L.CUB) {
    const base = cotizar(PERFILES.cub, { enchapado: false, hp: m.hp, secDobles: m.secDobles, ancho: m.ancho }).base;
    if (r2(base) !== r2(m.sc)) fallas.push({ que: `Cúbico sin enchapar · ${m.et}`, lista: m.sc, ahora: base });
  }
  for (const m of L.RCAM) {
    const base = cotizar(PERFILES.rcam, { enchapado: false, hp: m.hp, secDobles: m.secDobles, ancho: m.ancho }).base;
    if (r2(base) !== r2(m.sc)) fallas.push({ que: `Respaldo cámara sin enchapar · ${m.et}`, lista: m.sc, ahora: base });
  }
  for (const sec of Object.keys(L.FD_CC)) {
    for (const ancho of Object.keys(L.FD_CC[sec])) {
      const base = cotizar(PERFILES.fd, { secciones: +sec, ancho: +ancho, enchapado: true }).base;
      if (r2(base) !== r2(L.FD_CC[sec][ancho])) fallas.push({ que: `Lateral doble · ${sec} sec × ${ancho}m`, lista: L.FD_CC[sec][ancho], ahora: base });
    }
  }
  return fallas;
}

// ── Dibujo ───────────────────────────────────────────────────────────────────
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
// Los tramos por HP se muestran como "1/2HP" y no como "0.5".
const segmento = k => (/^\d+(\.\d+)?$/.test(k) && parseFloat(k) <= 20 ? fmtHP(parseFloat(k)) + "HP" : k);
const bonito = ruta => ruta.slice(1).map(segmento).join(" · ").replace(/\bml\b/, "MercadoLibre");

export function dibujarPanel(cont, alCambiar) {
  cont.innerHTML = "";
  const cambios = leerCambios();

  const barra = el("div", "panel-barra");
  const cuenta = el("span", "panel-cuenta");
  const refrescarCuenta = () => {
    const n = Object.keys(leerCambios()).length;
    cuenta.textContent = n ? `${n} precio${n > 1 ? "s" : ""} modificado${n > 1 ? "s" : ""}` : "sin cambios sobre la lista de fábrica";
    cuenta.className = "panel-cuenta" + (n ? " tocado" : "");
  };
  refrescarCuenta();
  barra.appendChild(cuenta);
  cont.appendChild(barra);

  const resultado = el("div", "panel-verif");
  cont.appendChild(resultado);

  const correrVerificacion = () => {
    const fallas = verificar();
    resultado.innerHTML = "";
    if (!fallas.length) {
      resultado.appendChild(el("div", "aviso ok", "Todo coincide con la lista impresa."));
    } else {
      resultado.appendChild(el("div", "aviso error", `${fallas.length} modelo(s) ya no dan el precio publicado:`));
      const t = el("table", "panel-tabla");
      for (const f of fallas.slice(0, 12)) {
        const tr = el("tr");
        tr.appendChild(el("td", null, f.que));
        tr.appendChild(el("td", null, `lista ${fmtUSD(f.lista)} → ahora ${fmtUSD(f.ahora)}`));
        t.appendChild(tr);
      }
      resultado.appendChild(t);
    }
  };

  const acciones = el("div", "panel-acciones");
  const boton = (txt, fn, cls) => { const b = el("button", cls, txt); b.onclick = fn; acciones.appendChild(b); return b; };

  boton("Verificar contra la lista", correrVerificacion);
  boton("Exportar", () => {
    const datos = JSON.stringify({ app: "cotizador-gz", version: PRECIOS.version, fecha: new Date().toISOString(), cambios: leerCambios() }, null, 2);
    const a = el("a");
    a.href = URL.createObjectURL(new Blob([datos], { type: "application/json" }));
    a.download = `precios-gz-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });
  boton("Copiar", async () => {
    await navigator.clipboard.writeText(JSON.stringify({ app: "cotizador-gz", cambios: leerCambios() }));
    cuenta.textContent = "copiado al portapapeles";
  });
  const archivo = el("input"); archivo.type = "file"; archivo.accept = "application/json"; archivo.hidden = true;
  archivo.onchange = async () => {
    if (archivo.files[0]) importar(await archivo.files[0].text());
  };
  cont.appendChild(archivo);
  boton("Importar archivo", () => archivo.click());
  boton("Pegar", () => { const t = prompt("Pegá acá lo que exportaste desde el otro dispositivo:"); if (t) importar(t); });
  boton("Volver a fábrica", () => {
    if (!confirm("Se borran todos los precios que editaste y vuelven los de la lista de mayo 2026. ¿Seguro?")) return;
    localStorage.removeItem(LLAVE);
    location.reload();
  }, "peligro");

  function importar(texto) {
    let datos;
    try { datos = JSON.parse(texto); } catch { alert("Eso no es un archivo de precios válido."); return; }
    if (!datos || datos.app !== "cotizador-gz" || typeof datos.cambios !== "object") {
      alert("Eso no es un archivo de precios del cotizador."); return;
    }
    const n = Object.keys(datos.cambios).length;
    if (!confirm(`Vas a reemplazar tus precios por los del archivo (${n} modificado${n === 1 ? "" : "s"}). ¿Seguro?`)) return;
    localStorage.setItem(LLAVE, JSON.stringify(datos.cambios));
    location.reload();
  }

  cont.appendChild(acciones);

  // Los campos, agrupados por la primera parte de la ruta.
  const porGrupo = {};
  for (const hoja of hojas(PRECIOS)) {
    (porGrupo[hoja.ruta[0]] ??= []).push(hoja);
  }

  for (const [grupo, lista] of Object.entries(porGrupo)) {
    const caja = el("details", "panel-grupo");
    caja.appendChild(el("summary", null, GRUPOS[grupo] || grupo));
    const campos = el("div", "campos");
    for (const hoja of lista) {
      if (hoja.tipo === "tramos") {
        // Una tabla de tramos que cuelga de la raíz no tiene nombre propio que mostrar:
        // el título del grupo ya lo dice.
        const nombre = bonito(hoja.ruta);
        for (let i = 0; i < hoja.valor.length; i++) {
          campos.appendChild(campoNumero([...hoja.ruta, String(i), "1"],
            `${nombre ? nombre + " · " : ""}hasta ${topeTramo(hoja.ruta, hoja.valor[i][0])}`, hoja.valor[i][1]));
        }
      } else {
        campos.appendChild(campoNumero(hoja.ruta, bonito(hoja.ruta) || hoja.ruta, hoja.valor));
      }
    }
    caja.appendChild(campos);
    cont.appendChild(caja);
  }

  function campoDeFabrica(ruta) { return !(clave(ruta) in cambios); }

  function campoNumero(ruta, etiqueta, valor) {
    const lab = el("label");
    const tit = el("span", null, etiqueta);
    if (!campoDeFabrica(ruta)) tit.appendChild(el("em", "tocado", " editado"));
    lab.appendChild(tit);
    const inp = el("input");
    inp.type = "text"; inp.value = valor; inp.inputMode = "decimal";
    inp.onchange = () => {
      const n = leerNumero(inp.value);
      if (n === null) { inp.value = leerEn(PRECIOS, ruta); return; }
      guardarCambio(ruta, n);
      refrescarCuenta();
      tit.querySelector("em") || tit.appendChild(el("em", "tocado", " editado"));
      correrVerificacion();
      alCambiar?.();
    };
    lab.appendChild(inp);
    return lab;
  }
}
