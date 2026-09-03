import { PRECIOS } from "./precios.js";
import { PERFILES, ORDEN } from "./perfiles.js";
import { MODELOS } from "./modelos.js";
import { cotizar, preciosVenta, preciosPresupuesto, textoCliente, textoPresupuesto, etiquetaCliente, fmtARS, fmtUSD, r2, leerNumero } from "./motor.js";
import { aplicarCambios, dibujarPanel } from "./panel.js";
import * as H from "./historial.js";
import * as ML from "./mercadolibre.js";
import * as Ficha from "./ficha.js";

// Se sube a mano en cada publicación. Sirve para confirmar de un vistazo que el
// navegador cargó la versión nueva y no una copia guardada.
export const VERSION = "16.8";

const $ = id => document.getElementById(id);
const fmtHPtexto = h => ({ 0.25: "1/4", 0.33: "1/3", 0.5: "1/2", 0.75: "3/4" })[h] || String(h).replace(".", ",");
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// ── Persistencia ─────────────────────────────────────────────────────────────
// Los dos dólares se guardan por dispositivo. Si la API falla, la app arranca con
// el último valor conocido en vez de quedarse vacía como la v14.
// Los precios editados en el panel se aplican antes de dibujar nada.
aplicarCambios();

const LLAVE = "gz15.dolares";
const guardado = JSON.parse(localStorage.getItem(LLAVE) || "{}");
PRECIOS.venta.dolarOficial = guardado.oficial ?? null;
PRECIOS.venta.dolarML = guardado.ml ?? PRECIOS.venta.dolarML;

function guardarDolares(parcial) {
  const datos = { ...JSON.parse(localStorage.getItem(LLAVE) || "{}"), ...parcial };
  localStorage.setItem(LLAVE, JSON.stringify(datos));
}
const fechaCorta = iso => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

async function traerDolarOficial() {
  const estado = $("dolarOficialEstado");
  for (const [url, leer] of [
    ["https://dolarapi.com/v1/dolares/oficial", d => d?.venta],
    ["https://api.bluelytics.com.ar/v2/latest", d => d?.oficial?.value_sell]
  ]) {
    try {
      const valor = leer(await (await fetch(url)).json());
      if (valor) {
        PRECIOS.venta.dolarOficial = parseFloat(valor);
        $("dolarOficial").value = Math.round(PRECIOS.venta.dolarOficial);
        guardarDolares({ oficial: PRECIOS.venta.dolarOficial, oficialFecha: new Date().toISOString() });
        estado.className = ""; estado.textContent = "actualizado hoy";
        render(); return;
      }
    } catch { /* probamos la que sigue */ }
  }
  estado.className = "err";
  estado.textContent = guardado.oficialFecha ? `sin conexión · último del ${fechaCorta(guardado.oficialFecha)}` : "sin conexión · cargalo a mano";
}

// ── Presupuesto ──────────────────────────────────────────────────────────────
// Se guarda en el dispositivo: si cerrás la app en la mitad de un pedido, sigue ahí.
const LLAVE_PED = "gz15.presupuesto";
const pedidoGuardado = JSON.parse(localStorage.getItem(LLAVE_PED) || '{"lineas":[],"embalaje":0}');

// ── Orden de la grilla ───────────────────────────────────────────────────────
// Se guarda por dispositivo. Si más adelante aparece un producto nuevo, se agrega
// al final en vez de perderse.
const LLAVE_ORDEN = "gz15.orden";

function ordenGuardado() {
  let guardado = [];
  try { guardado = JSON.parse(localStorage.getItem(LLAVE_ORDEN) || "[]"); } catch { /* nada */ }
  const validos = guardado.filter(id => ORDEN.includes(id));
  return [...validos, ...ORDEN.filter(id => !validos.includes(id))];
}

// ── Estado de la pantalla ────────────────────────────────────────────────────
const estado = {
  pid: null, modo: "modelo", modelo: 0, entrada: {}, vents: null,
  filas: new Set(), eligiendo: false, calculado: false, excluidos: [],
  colectorActivo: false, colectorMonto: 0, coolerActivo: false,
  // Ítems libres: siempre hay al menos una fila vacía a la vista, y se agregan las
  // que hagan falta. Antes era uno solo (extraActivo / extraNombre / extraMonto).
  extras: [{ activo: false, nombre: "", monto: 0 }],
  orden: [], customizando: false, claveCotizacion: null, hpFicha: null,
  lineas: pedidoGuardado.lineas || [],
  // El embalaje arranca en 0 salvo que hayas dejado un pedido a medio armar:
  // ahí se restaura junto con los ítems.
  embalaje: (pedidoGuardado.lineas || []).length ? (pedidoGuardado.embalaje || 0) : 0,
  cliente: (pedidoGuardado.lineas || []).length ? (pedidoGuardado.cliente || "") : ""
};

const guardarPedido = () =>
  localStorage.setItem(LLAVE_PED, JSON.stringify({
    lineas: estado.lineas, embalaje: estado.embalaje, cliente: estado.cliente
  }));

const perfilActual = () => PERFILES[estado.pid];
const tieneCatalogo = pid => !!MODELOS[pid];
const camposVisibles = () => perfilActual().campos.filter(c => !c.si || c.si(estado.entrada));

function entradaDesdeModelo(pid, i) {
  const { et, ...resto } = MODELOS[pid][i];
  return { ...resto };
}

function elegirProducto(pid) {
  estado.pid = pid;
  estado.eligiendo = false;
  estado.calculado = false;
  estado.hpFicha = null;
  estado.modo = tieneCatalogo(pid) ? "modelo" : "libre";
  estado.modelo = 0;
  estado.vents = null;
  $("cantidad").value = 1;   // la cantidad es de cada ítem, no se arrastra
  // Los valores por defecto del perfil (por ejemplo uniones: 0) tienen que llegar
  // al formulario: si no, el campo queda vacío y Calcular no se habilita nunca.
  estado.entrada = { enchapado: true, bajaTemp: false, reforzado: false,
    ...(PERFILES[pid].defaults || {}),
    ...(tieneCatalogo(pid) ? entradaDesdeModelo(pid, 0) : {}) };
  // Valores de arranque para los productos sin catálogo.
  for (const c of PERFILES[pid].campos) {
    if (estado.entrada[c.id] === undefined) {
      estado.entrada[c.id] = c.tipo === "select" ? c.opciones[0][0] : "";
    }
  }
  render();
}

// ── Dibujo ───────────────────────────────────────────────────────────────────
// La grilla de 15 productos ocupa media pantalla de celular. Una vez elegido el
// producto se pliega a un renglón; "Cambiar" la vuelve a abrir.
function dibujarProductos() {
  const abierta = !estado.pid || estado.eligiendo || estado.customizando;
  $("productos").hidden = !abierta;
  $("elegido").hidden = abierta;
  $("btnCustomizar").hidden = !abierta;
  $("btnCustomizar").textContent = estado.customizando ? "Listo" : "Customizar grilla";
  $("btnCustomizar").classList.toggle("activo", estado.customizando);
  if (!abierta) { $("nombreElegido").textContent = perfilActual().nombre; return; }

  const cont = $("productos");
  cont.innerHTML = "";
  cont.classList.toggle("ordenando", estado.customizando);

  estado.orden.forEach((pid, i) => {
    if (!estado.customizando) {
      const b = el("button", null, PERFILES[pid].nombre);
      b.setAttribute("aria-pressed", String(estado.pid === pid));
      b.onclick = () => elegirProducto(pid);
      cont.appendChild(b);
      return;
    }
    // En modo customizar cada producto es un renglón con flechas.
    const fila = el("div", "fila-orden");
    fila.appendChild(el("span", "orden-nombre", PERFILES[pid].nombre));
    const mover = paso => {
      const j = i + paso;
      if (j < 0 || j >= estado.orden.length) return;
      const copia = [...estado.orden];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      estado.orden = copia;
      localStorage.setItem(LLAVE_ORDEN, JSON.stringify(copia));
      dibujarProductos();
    };
    const arriba = el("button", "orden-flecha", "↑"); arriba.title = "Subir";
    const abajo = el("button", "orden-flecha", "↓"); abajo.title = "Bajar";
    arriba.disabled = i === 0;
    abajo.disabled = i === estado.orden.length - 1;
    arriba.onclick = () => mover(-1);
    abajo.onclick = () => mover(1);
    fila.append(arriba, abajo);
    cont.appendChild(fila);
  });

  if (estado.customizando) {
    const reset = el("button", "orden-reset", "Volver al orden original");
    reset.onclick = () => {
      localStorage.removeItem(LLAVE_ORDEN);
      estado.orden = [...ORDEN];
      dibujarProductos();
    };
    cont.appendChild(reset);
  }
}

function dibujarModos() {
  const cont = $("modos");
  if (!tieneCatalogo(estado.pid)) { cont.hidden = true; return; }
  cont.hidden = false; cont.innerHTML = "";
  for (const [modo, etiqueta] of [["modelo", "Modelo de lista"], ["libre", "A medida"]]) {
    const b = el("button", null, etiqueta);
    b.setAttribute("aria-pressed", String(estado.modo === modo));
    b.onclick = () => {
      estado.modo = modo; estado.vents = null;
      if (modo === "modelo") estado.entrada = { ...estado.entrada, ...entradaDesdeModelo(estado.pid, estado.modelo) };
      invalidar(); render();
    };
    cont.appendChild(b);
  }
}

function dibujarCatalogo() {
  const cont = $("catalogo");
  if (!tieneCatalogo(estado.pid) || estado.modo !== "modelo") { cont.hidden = true; return; }
  cont.hidden = false; cont.innerHTML = "";
  const lab = el("label"); lab.appendChild(el("span", null, "Modelo"));
  const sel = el("select");
  MODELOS[estado.pid].forEach((m, i) => {
    const o = el("option", null, m.et); o.value = i;
    if (i === estado.modelo) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    estado.modelo = +sel.value; estado.vents = null;
    estado.entrada = { ...estado.entrada, ...entradaDesdeModelo(estado.pid, estado.modelo) };
    invalidar(); render();
  };
  lab.appendChild(sel);
  const caja = el("div", "campos"); caja.appendChild(lab);
  cont.appendChild(caja);
}

function dibujarCampos() {
  // Referencia de secciones a HP: sólo la traen los dos compactos de 3/8".
  const ref = perfilActual().ref;
  $("refHP").hidden = !ref;
  if (ref) $("refHP").textContent = ref;

  const cont = $("campos"); cont.innerHTML = "";
  // En modo catálogo las medidas las fija el modelo: se muestran, no se editan.
  const soloLectura = tieneCatalogo(estado.pid) && estado.modo === "modelo";
  for (const c of camposVisibles()) {
    const lab = el("label");
    const tit = el("span", null, c.label + (c.unidad ? ` (${c.unidad})` : ""));
    lab.appendChild(tit);
    let campo;
    if (c.tipo === "select") {
      campo = el("select");
      for (const [valor, texto] of c.opciones) {
        const o = el("option", null, texto); o.value = String(valor);
        if (String(estado.entrada[c.id]) === String(valor)) o.selected = true;
        campo.appendChild(o);
      }
      campo.onchange = () => {
        const bruto = campo.value;
        estado.entrada[c.id] = bruto === "true" ? true : bruto === "false" ? false : (isNaN(+bruto) ? bruto : +bruto);
        estado.vents = null; invalidar(); render();
      };
    } else {
      const entero = c.step === 1;
      campo = el("input");
      campo.type = entero ? "number" : "text";
      campo.inputMode = entero ? "numeric" : "decimal";
      if (entero) campo.step = 1;
      if (c.ej) campo.placeholder = c.ej;
      campo.value = estado.entrada[c.id] ?? "";
      campo.oninput = () => {
        const n = leerNumero(campo.value);
        estado.entrada[c.id] = campo.value.trim() === "" ? "" : (n ?? "");
        estado.vents = null; invalidar();
      };
    }
    campo.disabled = soloLectura;
    lab.appendChild(campo);
    cont.appendChild(lab);
  }
}

function tildable(id, etiqueta, valor, alCambiar) {
  const lab = el("label", "chk");
  lab.dataset.on = String(valor);
  const inp = el("input"); inp.type = "checkbox"; inp.checked = valor; inp.id = id;
  inp.onchange = () => alCambiar(inp.checked);
  lab.appendChild(inp); lab.appendChild(el("span", null, etiqueta));
  return lab;
}

function dibujarOpciones() {
  const cont = $("opciones"); cont.innerHTML = "";
  const p = perfilActual();
  if (p.chapa) {
    const esTecho = p.familia === "techo";
    cont.appendChild(tildable("enchapado", esTecho ? "Con bandeja plástica y ventilador" : "Enchapado",
      estado.entrada.enchapado, v => { estado.entrada.enchapado = v; estado.vents = null; render(); }));
  }
  if (p.reforzable) {
    cont.appendChild(tildable("reforzado", "Ventiladores 300mm reforzados",
      estado.entrada.reforzado, v => { estado.entrada.reforzado = v; estado.vents = null; render(); }));
  }
  if (p.bajaTemp) {
    cont.appendChild(tildable("bajaTemp", "Baja temperatura (× 1,80)",
      estado.entrada.bajaTemp, v => { estado.entrada.bajaTemp = v; invalidar(); }));
  }
  // Casillas propias del producto, declaradas en el perfil.
  for (const o of p.opciones || []) {
    cont.appendChild(tildable(o.id, o.label, !!estado.entrada[o.id],
      v => { estado.entrada[o.id] = v; estado.vents = null; invalidar(); render(); }));
  }
}

// Los ventiladores que están puestos ahora: los que tocó el usuario, o el default
// del modelo. Se calcula sin depender de que la medida esté cargada.
function ventsActuales() {
  if (estado.vents) return estado.vents;
  try { return perfilActual().ventDefault(estado.entrada, PRECIOS); }
  catch { return { v200: 0, v250: 0, v300: 0, v300r: 0 }; }
}

function dibujarVentiladores() {
  const cont = $("ventiladores"); cont.innerHTML = "";
  const p = perfilActual();
  if (!p.ventTarifa) { cont.hidden = true; return; }
  cont.hidden = false;
  cont.appendChild(el("h3", null, "Ventiladores"));
  const actuales = ventsActuales();
  const tipos = estado.entrada.reforzado ? ["v300r"] : (p.ventTipos || ["v200", "v250", "v300"]);
  for (const tipo of tipos) {
    const def = PRECIOS.ventiladores.tipos[tipo];
    const unit = (p.ventTarifa === "fija" ? PRECIOS.ventiladores.costoFijo : def.costo) * PRECIOS.ventiladores.markup;
    const fila = el("div", "vents-fila");
    const nom = el("div", "nom", def.nombre);
    nom.appendChild(el("div", "precio", `USD ${unit.toFixed(2).replace(".", ",")} c/u`));
    fila.appendChild(nom);
    const st = el("div", "stepper");
    const menos = el("button", null, "−"), mas = el("button", null, "+");
    const cant = el("span", null, String(actuales[tipo] || 0));
    const fijar = n => {
      const base = { ...actuales };
      base[tipo] = Math.max(0, n);
      if (estado.entrada.reforzado) estado.entrada.cantReforzados = base[tipo];
      else estado.vents = base;
      invalidar(); render();
    };
    menos.onclick = () => fijar((actuales[tipo] || 0) - 1);
    mas.onclick = () => fijar((actuales[tipo] || 0) + 1);
    st.append(menos, cant, mas);
    fila.appendChild(st);
    cont.appendChild(fila);
  }
}

function dibujarResultado(cot) {
  const tabla = $("desglose"); tabla.innerHTML = "";
  for (const linea of cot.desglose) {
    if (linea.manual) continue;   // el colector se dibuja aparte, editable
    const tr = el("tr");
    if (linea.ajuste) tr.className = "ajuste";
    if (linea.excluido) tr.classList.add("fuera");
    // Los componentes se pueden sacar; lo derivado de ellos no.
    const celdaTilde = el("td", "col-tilde");
    if (linea.componente) {
      const chk = el("input"); chk.type = "checkbox"; chk.checked = !linea.excluido;
      chk.title = "Sacar del presupuesto";
      chk.onchange = () => {
        estado.excluidos = chk.checked
          ? estado.excluidos.filter(c => c !== linea.concepto)
          : [...estado.excluidos, linea.concepto];
        recalcular();
      };
      celdaTilde.appendChild(chk);
    }
    tr.appendChild(celdaTilde);
    const tdNombre = el("td", null, linea.concepto);
    if (linea.nota) {
      tdNombre.classList.add("con-nota");
      tdNombre.title = "Tocá para ver cómo se calcula";
      tdNombre.onclick = () => {
        const abierta = tr.nextSibling && tr.nextSibling.classList?.contains("nota");
        tabla.querySelectorAll("tr.nota").forEach(n => n.remove());
        if (abierta) return;
        const fila = el("tr", "nota");
        fila.appendChild(el("td"));
        const td = el("td", null, linea.nota); td.colSpan = 2;
        fila.appendChild(td);
        tr.after(fila);
      };
    }
    tr.appendChild(tdNombre);
    tr.appendChild(el("td", null, fmtUSD(linea.importe)));
    tabla.appendChild(tr);
  }
  // Colector y distribuidor: destildado por defecto, con el importe a mano.
  {
    const tr = el("tr", "fila-colector");
    const celda = el("td", "col-tilde");
    const chk = el("input"); chk.type = "checkbox"; chk.checked = estado.colectorActivo;
    chk.onchange = () => { estado.colectorActivo = chk.checked; recalcular(); };
    celda.appendChild(chk);
    tr.appendChild(celda);
    tr.appendChild(el("td", null, "Colector y distribuidor"));
    const tdMonto = el("td");
    const monto = el("input", "monto-libre");
    monto.type = "text"; monto.inputMode = "decimal"; monto.placeholder = "USD";
    monto.value = estado.colectorMonto || "";
    monto.disabled = !estado.colectorActivo;
    monto.oninput = () => {
      estado.colectorMonto = leerNumero(monto.value) || 0;
      if (estado.colectorActivo) recalcularSuave();
    };
    tdMonto.appendChild(monto);
    tr.appendChild(tdMonto);
    tabla.appendChild(tr);
  }
  // Cooler: importe fijo del panel, disponible en los 15 productos.
  {
    const tr = el("tr", "fila-colector");
    const celda = el("td", "col-tilde");
    const chk = el("input"); chk.type = "checkbox"; chk.checked = estado.coolerActivo;
    chk.onchange = () => { estado.coolerActivo = chk.checked; recalcular(); };
    celda.appendChild(chk);
    tr.appendChild(celda);
    tr.appendChild(el("td", null, "Cooler"));
    const td = el("td", estado.coolerActivo ? null : "monto-apagado",
      fmtUSD(PRECIOS.adicionales.cooler));
    tr.appendChild(td);
    tabla.appendChild(tr);
  }
  // Ítems libres: nombre e importe a elección, tantos como hagan falta.
  estado.extras.forEach((ex, i) => {
    const tr = el("tr", "fila-colector");
    const celda = el("td", "col-tilde");
    const chk = el("input"); chk.type = "checkbox"; chk.checked = ex.activo;
    chk.onchange = () => { ex.activo = chk.checked; recalcular(); };
    celda.appendChild(chk);
    tr.appendChild(celda);

    const tdNombre = el("td");
    const nombre = el("input", "nombre-libre");
    nombre.type = "text"; nombre.autocomplete = "off";
    nombre.placeholder = i === 0 ? "Nuevo ítem" : "Otro ítem";
    nombre.value = ex.nombre;
    nombre.disabled = !ex.activo;
    nombre.oninput = () => { ex.nombre = nombre.value; if (ex.activo) recalcularSuave(); };
    tdNombre.appendChild(nombre);
    tr.appendChild(tdNombre);

    const tdMonto = el("td", "celda-libre");
    const monto = el("input", "monto-libre");
    monto.type = "text"; monto.inputMode = "decimal"; monto.placeholder = "USD";
    monto.value = ex.monto || "";
    monto.disabled = !ex.activo;
    monto.oninput = () => { ex.monto = leerNumero(monto.value) || 0; if (ex.activo) recalcularSuave(); };
    tdMonto.appendChild(monto);
    // La primera fila no se puede sacar: es la que deja el desglose como estaba.
    if (i > 0) {
      const quitar = el("button", "quitar-libre", "×");
      quitar.type = "button";
      quitar.title = "Sacar este ítem";
      quitar.onclick = () => { estado.extras.splice(i, 1); recalcular(); };
      tdMonto.appendChild(quitar);
    }
    tr.appendChild(tdMonto);
    tabla.appendChild(tr);
  });
  {
    const tr = el("tr", "fila-agregar");
    tr.appendChild(el("td", "col-tilde"));
    const td = el("td"); td.colSpan = 2;
    const b = el("button", "agregar-libre", "+ Agregar otro ítem");
    b.type = "button";
    // Arranca tildado: si lo agregaste es porque lo vas a cobrar.
    b.onclick = () => { estado.extras.push({ activo: true, nombre: "", monto: 0 }); recalcular(); };
    td.appendChild(b);
    tr.appendChild(td);
    tabla.appendChild(tr);
  }
  if (estado.embalaje) {
    const tr = el("tr");
    tr.appendChild(el("td", "col-tilde"));
    tr.appendChild(el("td", null, "Embalaje (uno por pedido)"));
    tr.appendChild(el("td", null, fmtUSD(estado.embalaje)));
    tabla.appendChild(tr);
  }
  const totalUSD = r2(cot.total + estado.embalaje);
  const total = el("tr");
  total.appendChild(el("td", "col-tilde"));
  total.appendChild(el("td", null, "Total"));
  total.appendChild(el("td", null, fmtUSD(totalUSD)));
  tabla.appendChild(total);
  $("resumenDesglose").textContent = fmtUSD(totalUSD) +
    (cot.noIncluye.length ? ` · ${cot.noIncluye.length} ítem${cot.noIncluye.length > 1 ? "s" : ""} sin incluir` : "");

  dibujarPrecios(cot);
  dibujarFicha(cot);
}

// La ficha sale de la misma cotización: no hay que volver a cargar nada.
function dibujarFicha(cot) {
  const caja = $("cajaFicha");
  const perfil = perfilActual();
  const f = Ficha.filas(perfil, cot, PRECIOS, estado.hpFicha);
  if (!f) { caja.hidden = true; return; }
  caja.hidden = false;

  // Los productos que no traen HP no pueden dar frigorías ni watts. Se ofrece
  // cargarlo a mano: es sólo para la ficha, no cambia el precio.
  const cajaHP = $("fichaHP");
  if (Ficha.faltaHP(perfil, cot)) {
    cajaHP.hidden = false; cajaHP.innerHTML = "";
    const lab = el("label");
    lab.appendChild(el("span", null, "Potencia del equipo (sólo para la ficha)"));
    const sel = el("select");
    const nada = el("option", null, "— sin definir —"); nada.value = "";
    sel.appendChild(nada);
    for (const hp of [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6]) {
      const o = el("option", null, `${fmtHPtexto(hp)} HP`); o.value = String(hp);
      if (estado.hpFicha === hp) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => {
      estado.hpFicha = sel.value === "" ? null : parseFloat(sel.value);
      dibujarFicha(cot);
    };
    lab.appendChild(sel);
    cajaHP.appendChild(lab);
  } else {
    cajaHP.hidden = true;
  }

  const d = Ficha.datos(perfil, cot, PRECIOS, estado.hpFicha);
  $("resumenFicha").textContent = d.frigorias
    ? `${d.frigorias.toLocaleString("es-AR")} frig/h · ${d.superficie.toFixed(1).replace(".", ",")} m²`
    : `${d.superficie.toFixed(1).replace(".", ",")} m² de intercambio`;
  const t = $("fichaTabla"); t.innerHTML = "";
  for (const [k, v] of f) {
    const tr = el("tr");
    tr.appendChild(el("td", null, k));
    tr.appendChild(el("td", null, String(v)));
    t.appendChild(tr);
  }
}

// Mismo cálculo que el presupuesto: un ítem suelto es un pedido de un ítem.
function dibujarPrecios(cot) {
  const cont = $("precios"); cont.innerHTML = "";
  const unaLinea = [{ etiqueta: etiquetaCliente(perfilActual(), cot.entrada), total: cot.total }];
  for (const fila of preciosPresupuesto(unaLinea, estado.embalaje)) {
    const div = el("div", "precio-fila" + (fila.id === "ml" ? " ml" : ""));
    div.dataset.on = String(estado.filas.has(fila.id));
    div.appendChild(el("div", "tilde", estado.filas.has(fila.id) ? "✓" : ""));
    const nom = el("div", "nom", fila.nombre);
    nom.appendChild(el("em", null, fila.nota));
    div.appendChild(nom);
    div.appendChild(el("div", "usd", fmtUSD(fila.usd)));
    div.appendChild(el("div", "ars", fila.ars == null ? "—" : fmtARS(fila.ars)));
    div.onclick = () => {
      estado.filas.has(fila.id) ? estado.filas.delete(fila.id) : estado.filas.add(fila.id);
      render();
    };
    if (fila.id === "ml" && fila.ars) {
      const b = el("button", "btn-ml", "Publicar");
      b.title = "Crear la publicación en MercadoLibre";
      b.onclick = ev => { ev.stopPropagation(); publicarEnML(cot, fila.ars); };
      div.appendChild(b);
    }
    cont.appendChild(div);
  }

  const avisos = $("avisos"); avisos.innerHTML = "";
  for (const a of cot.avisos) {
    avisos.appendChild(el("div", "aviso" + (a.nivel === "error" ? " error" : ""), a.msg));
  }
  $("btnCopiar").disabled = estado.filas.size === 0 || cot.avisos.some(a => a.nivel === "error");
}

// ── Las tres secciones ───────────────────────────────────────────────────────
// No depende de ninguna cotización: es una referencia para identificar un equipo que
// ya existe. Se dibuja una sola vez al arrancar y se rehace si se tocan los precios,
// porque el alto y la separación de aletas son campos del panel.
function dibujarSecciones() {
  const cont = $("seccionesCuerpo"); cont.innerHTML = "";
  const secciones = Ficha.referenciaSecciones();
  $("resumenSecciones").textContent =
    secciones.map(s => `${s.nombre.split(" ")[0].toLowerCase()} ${Ficha.altoEnCm(s.alto)}`).join(" · ");

  for (const s of secciones) {
    const caja = el("div", "secc");
    const tit = el("div", "secc-tit");
    tit.appendChild(el("span", null, `Sección ${s.nombre}`));
    tit.appendChild(el("strong", null, Ficha.altoEnCm(s.alto)));
    caja.appendChild(tit);

    const separacion = `aletas cada ${s.separacion} mm` +
      (s.separacionEspecial ? ` (o ${s.separacionEspecial} mm en las especiales)` : "");
    caja.appendChild(el("div", "secc-datos",
      `Caño ${s.cano} · aleta ${s.paso} × ${s.ancho} mm · ${separacion}`));
    caja.appendChild(el("div", "secc-prods", s.productos.join(" · ")));
    cont.appendChild(caja);
  }
}

// ── Historial ────────────────────────────────────────────────────────────────
function registrarEnHistorial(tipo, lineas, embalaje, texto) {
  H.registrar({
    fecha: new Date().toISOString(), tipo, texto, cliente: estado.cliente || null,
    pid: estado.pid, claveML: estado.claveCotizacion,
    descripcionML: ultima ? ML.descripcionML(perfilActual(), ultima) : null,
    precioML: ultima ? preciosPresupuesto([{ etiqueta: "", total: ultima.total }], embalaje)
      .find(f => f.id === "ml")?.ars : null,
    lineas: lineas.map(l => ({ etiqueta: l.etiqueta, total: l.total })),
    embalaje,
    usd: r2(lineas.reduce((s, l) => s + l.total, 0) + embalaje),
    columnas: [...estado.filas],
    dolarOficial: PRECIOS.venta.dolarOficial,
    dolarML: PRECIOS.venta.dolarML
  });
  dibujarHistorial();
}

function dibujarHistorial() {
  const secc = $("historial");
  const dias = H.porDia();
  secc.hidden = dias.length === 0;
  if (secc.hidden) return;

  const total = dias.reduce((n, [, e]) => n + e.length, 0);
  $("resumenHist").textContent = `${total} cotización${total === 1 ? "" : "es"}`;

  const cont = $("historialCuerpo"); cont.innerHTML = "";
  for (const [, entradas] of dias) {
    cont.appendChild(el("h3", "hist-dia", H.fechaLarga(entradas[0].fecha)));
    for (const e of entradas) {
      const caja = el("details", "hist-item");
      const res = el("summary");
      res.appendChild(el("span", "hist-hora", H.hora(e.fecha)));
      res.appendChild(el("span", "hist-que",
        (e.cliente ? e.cliente + " — " : "") +
        (e.lineas.length === 1 ? e.lineas[0].etiqueta : `Presupuesto de ${e.lineas.length} ítems`)));
      if (e.mlLink) {
        const marca = el("span", "hist-ml", "ML");
        marca.title = "Ya tiene publicación en MercadoLibre";
        res.appendChild(marca);
      }
      res.appendChild(el("span", "hist-monto", fmtUSD(e.usd)));
      // Copiar sin desplegar: el clic no tiene que abrir ni cerrar la entrada.
      const copiar = el("button", "hist-copiar", "Copiar");
      copiar.title = "Copiar esta cotización tal cual se envió";
      copiar.onclick = async ev => {
        ev.preventDefault(); ev.stopPropagation();
        try { await navigator.clipboard.writeText(e.texto); }
        catch { prompt("Copiá este texto:", e.texto); return; }
        const antes = copiar.textContent;
        copiar.textContent = "✓";
        setTimeout(() => { copiar.textContent = antes; }, 1500);
      };
      res.appendChild(copiar);
      caja.appendChild(res);

      const cuerpo = el("div", "hist-cuerpo");
      const pre = el("pre", "hist-texto", e.texto);
      cuerpo.appendChild(pre);
      if (e.mlLink) {
        const a = el("a", "hist-link", e.mlLink);
        a.href = e.mlLink; a.target = "_blank"; a.rel = "noopener";
        cuerpo.appendChild(a);
      }
      cuerpo.appendChild(el("p", "hist-dolar",
        `Dólar oficial de ese día: ${e.dolarOficial ? fmtARS(e.dolarOficial) : "—"}` +
        (e.columnas.includes("ml") ? ` · ML: ${e.dolarML ? fmtARS(e.dolarML) : "—"}` : "")));

      const acciones = el("div", "panel-acciones");
      const btn = (txt, fn, cls) => { const b = el("button", cls, txt); b.onclick = fn; acciones.appendChild(b); };
      btn("Copiar como se envió", async () => {
        try { await navigator.clipboard.writeText(e.texto); } catch { prompt("Copiá este texto:", e.texto); }
      });
      btn("Recargar en el presupuesto", () => {
        if (estado.lineas.length && !confirm("Se reemplaza el presupuesto que tenés armado. ¿Seguro?")) return;
        estado.lineas = e.lineas.map(l => ({ ...l }));
        estado.embalaje = e.embalaje;
        estado.cliente = e.cliente || "";
        $("embalaje").value = e.embalaje;
        $("cliente").value = estado.cliente;
        guardarPedido(); dibujarPresupuesto();
        $("presupuesto").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (e.mlLink) {
        btn("Copiar link de la publicación", async () => {
          try { await navigator.clipboard.writeText(e.mlLink); }
          catch { prompt("Copiá el link:", e.mlLink); }
        });
      }
      if (e.pid && e.precioML && e.descripcionML) {
        btn("Publicar en ML", () => {
          const perfil = PERFILES[e.pid];
          publicarEnML({ entrada: {}, noIncluye: [] }, e.precioML,
            { pid: e.pid, descripcionML: e.descripcionML, claveML: e.claveML });
        });
      }
      btn("Borrar", () => { H.borrar(e.id); dibujarHistorial(); }, "peligro");
      cuerpo.appendChild(acciones);
      caja.appendChild(cuerpo);
      cont.appendChild(caja);
    }
  }

  const vaciar = el("button", "copiar secundario peligro", "Vaciar el historial");
  vaciar.onclick = () => {
    if (!confirm("Se borra todo el historial. ¿Seguro?")) return;
    H.vaciar(); dibujarHistorial();
  };
  cont.appendChild(vaciar);
}

// ── Presupuesto ──────────────────────────────────────────────────────────────
function agregarAlPresupuesto() {
  if (!ultima) return;
  estado.lineas.push({
    pid: estado.pid,
    etiqueta: etiquetaCliente(perfilActual(), ultima.entrada),
    cantidad: ultima.cantidad,
    total: ultima.total,
    noIncluye: ultima.noIncluye
  });
  guardarPedido();
  dibujarPresupuesto();
  $("presupuesto").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function dibujarPresupuesto() {
  const secc = $("presupuesto");
  secc.hidden = estado.lineas.length === 0;
  if (secc.hidden) return;

  const cont = $("lineas"); cont.innerHTML = "";
  const tabla = el("table", "panel-tabla");
  estado.lineas.forEach((l, i) => {
    const tr = el("tr");
    tr.appendChild(el("td", null, l.etiqueta));
    tr.appendChild(el("td", null, fmtUSD(l.total)));
    const quitar = el("button", "quitar", "×");
    quitar.title = "Quitar del presupuesto";
    quitar.onclick = () => { estado.lineas.splice(i, 1); guardarPedido(); dibujarPresupuesto(); };
    const td = el("td"); td.appendChild(quitar); tr.appendChild(td);
    tabla.appendChild(tr);
  });
  if (estado.embalaje) {
    const tr = el("tr");
    tr.appendChild(el("td", null, "Embalaje (uno por pedido)"));
    tr.appendChild(el("td", null, fmtUSD(estado.embalaje)));
    tr.appendChild(el("td"));
    tabla.appendChild(tr);
  }
  cont.appendChild(tabla);

  const filas = $("preciosPedido"); filas.innerHTML = "";
  for (const fila of preciosPresupuesto(estado.lineas, estado.embalaje)) {
    const div = el("div", "precio-fila" + (fila.id === "ml" ? " ml" : ""));
    div.dataset.on = String(estado.filas.has(fila.id));
    div.appendChild(el("div", "tilde", estado.filas.has(fila.id) ? "✓" : ""));
    const nom = el("div", "nom", fila.nombre);
    nom.appendChild(el("em", null, fila.nota));
    div.appendChild(nom);
    div.appendChild(el("div", "usd", fmtUSD(fila.usd)));
    div.appendChild(el("div", "ars", fila.ars == null ? "—" : fmtARS(fila.ars)));
    div.onclick = () => {
      estado.filas.has(fila.id) ? estado.filas.delete(fila.id) : estado.filas.add(fila.id);
      render();
    };
    filas.appendChild(div);
  }
  $("btnCopiarPedido").disabled = estado.filas.size === 0;
}


// ── MercadoLibre ─────────────────────────────────────────────────────────────
function pedirClave() {
  let clave = ML.leerClave();
  if (!clave) {
    clave = prompt("Clave del bot de MercadoLibre.\n\nSe guarda en este dispositivo y no se vuelve a pedir.") || "";
    if (!clave.trim()) return null;
    ML.guardarClave(clave);
  }
  return ML.leerClave();
}

async function publicarEnML(cot, precioARS, entradaHist = null) {
  const perfil = entradaHist ? PERFILES[entradaHist.pid] : perfilActual();
  const pid = perfil.id;
  const vence = ML.vencimiento();
  const titulo = ML.tituloML(pid, cot.entrada, perfil);
  const descripcion = entradaHist?.descripcionML || ML.descripcionML(perfil, cot, vence);
  const precio = Math.round(precioARS);

  const problemas = ML.revisar({ titulo, precio });
  if (problemas.length) { alert(problemas.join("\n\n")); return; }

  const resumen = `Se va a publicar en MercadoLibre:\n\n${titulo}\n$ ${precio.toLocaleString("es-AR")}\n\n` +
    `Se pausa sola a las ${ML.ML.horasPausa} horas.\n\n¿Confirmás?`;
  if (!confirm(resumen)) return;

  const clave = pedirClave();
  if (!clave) return;

  const caja = $("resultadoML");
  caja.hidden = false;
  caja.className = "aviso";
  caja.textContent = "Publicando…";

  const r = await ML.publicar({
    titulo, descripcion, precio,
    clave_idempotencia: entradaHist?.claveML || estado.claveCotizacion || `cot-${Date.now()}`
  }, clave);

  caja.innerHTML = "";

  const conLink = link => {
    const a = el("a", null, link);
    a.href = link; a.target = "_blank"; a.rel = "noopener";
    caja.appendChild(a);
    const copiar = el("button", "hist-copiar", "Copiar el link");
    copiar.onclick = async () => {
      try { await navigator.clipboard.writeText(link); copiar.textContent = "✓ Copiado"; }
      catch { prompt("Copiá el link:", link); }
    };
    caja.appendChild(copiar);
  };

  // Duplicado reciente: la publicación ya existe. No es un error, es un aviso con link.
  if (r.codigo === 409) {
    caja.className = "aviso";
    caja.appendChild(el("div", null, r.error));
    if (r.link) conLink(r.link);
    return;
  }
  if (!r.ok) {
    caja.className = "aviso error";
    caja.appendChild(el("div", null, r.error));
    if (r.codigo === 401) {
      const b = el("button", "hist-copiar", "Cargar otra clave");
      b.onclick = () => { ML.borrarClave(); caja.hidden = true; };
      caja.appendChild(b);
    }
    return;
  }
  caja.className = "aviso ok";
  caja.appendChild(el("div", null, `Publicado: ${r.titulo}`));
  conLink(r.link);

  // Queda pegado al historial, para poder recuperar el link más adelante.
  const datosML = { mlLink: r.link, mlItemId: r.item_id, mlTitulo: r.titulo, mlPausa: r.pausa_programada || null };
  const claveCot = entradaHist?.claveML || estado.claveCotizacion;
  if (!H.actualizarPorClave(claveCot, datosML)) {
    H.registrar({
      fecha: new Date().toISOString(), tipo: "publicacion", cliente: estado.cliente || null,
      texto: `${r.titulo}\n${r.link}`, lineas: [{ etiqueta: r.titulo, total: 0 }],
      embalaje: 0, usd: 0, columnas: [], dolarOficial: PRECIOS.venta.dolarOficial,
      dolarML: PRECIOS.venta.dolarML, claveML: clave, ...datosML
    });
  }
  dibujarHistorial();
  if (r.pausa_programada) {
    const p = new Date(r.pausa_programada);
    caja.appendChild(el("div", "hist-dolar",
      `Se pausa sola el ${p.toLocaleDateString("es-AR")} a las ${p.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`));
  }
}

// ── Ciclo ────────────────────────────────────────────────────────────────────
let ultima = null;

// Cambiar cualquier cosa del producto apaga el resultado: si está en pantalla,
// es porque corresponde a lo que hay cargado ahora.
function invalidar() {
  estado.calculado = false;
  estado.excluidos = [];   // cambian los componentes: los tildes vuelven a empezar
  estado.colectorActivo = false; estado.colectorMonto = 0; estado.coolerActivo = false;
  estado.extras = [{ activo: false, nombre: "", monto: 0 }];
  ultima = null;
  $("resultado").hidden = true;
  $("btnCalcular").disabled = !estado.pid || !entradaCompleta();
}

function entradaCompleta() {
  return camposVisibles().every(c => estado.entrada[c.id] !== "" && estado.entrada[c.id] != null);
}

// Los ítems libres tildados y con importe. Los vacíos no viajan a la cotización.
const extrasActivos = () => estado.extras
  .filter(x => x.activo && x.monto)
  .map(x => ({ nombre: x.nombre, importe: x.monto }));

// Recalcula sin redibujar el desglose, para no robarle el foco al campo del colector.
function recalcularSuave() {
  if (!estado.calculado || !entradaCompleta()) return;
  const entrada = {
    ...estado.entrada,
    cantidad: Math.max(1, leerNumero($("cantidad").value) || 1),
    embalaje: 0,
    excluidos: estado.excluidos,
    colector: estado.colectorActivo ? estado.colectorMonto : 0,
    cooler: estado.coolerActivo,
    extras: extrasActivos()
  };
  if (estado.vents) entrada.vents = estado.vents;
  ultima = cotizar(perfilActual(), entrada);
  const totalUSD = r2(ultima.total + estado.embalaje);
  $("desglose").querySelector("tr:last-child td:last-child").textContent = fmtUSD(totalUSD);
  $("resumenDesglose").textContent = fmtUSD(totalUSD) +
    (ultima.noIncluye.length ? ` · ${ultima.noIncluye.length} ítem${ultima.noIncluye.length > 1 ? "s" : ""} sin incluir` : "");
  dibujarPrecios(ultima);
}

function recalcular() {
  $("btnCalcular").disabled = !estado.pid || !entradaCompleta();
  if (!estado.pid || !estado.calculado || !entradaCompleta()) { $("resultado").hidden = true; $("cajaFicha").hidden = true; ultima = null; return; }
  // El embalaje no es de este ítem sino del pedido: se suma una sola vez abajo.
  const entrada = {
    ...estado.entrada,
    cantidad: Math.max(1, leerNumero($("cantidad").value) || 1),
    embalaje: 0
  };
  if (estado.vents) entrada.vents = estado.vents;
  entrada.excluidos = estado.excluidos;
  entrada.colector = estado.colectorActivo ? estado.colectorMonto : 0;
  entrada.cooler = estado.coolerActivo;
  entrada.extras = extrasActivos();
  ultima = cotizar(perfilActual(), entrada);
  $("resultado").hidden = false;
  dibujarResultado(ultima);
}

function render() {
  dibujarProductos();
  $("config").hidden = !estado.pid;
  if (!estado.pid) { $("resultado").hidden = true; dibujarPresupuesto(); return; }
  $("tituloProducto").textContent = perfilActual().nombre;
  dibujarModos(); dibujarCatalogo(); dibujarCampos(); dibujarOpciones(); dibujarVentiladores();
  recalcular();
  dibujarPresupuesto();
}

$("btnCopiar").onclick = async () => {
  if (!ultima) return;
  const linea = { etiqueta: etiquetaCliente(perfilActual(), ultima.entrada), total: ultima.total };
  // Con embalaje el ítem suelto pasa a ser un pedido de un ítem, para que el
  // embalaje salga como renglón propio en vez de escondido dentro del precio.
  const meta = { cliente: estado.cliente };
  const texto = estado.embalaje
    ? textoPresupuesto([linea], estado.embalaje, [...estado.filas], PRECIOS, meta)
    : textoCliente(perfilActual(), ultima, [...estado.filas], PRECIOS, meta);
  // Se registra primero: el historial es de lo que cotizaste, no de si el
  // portapapeles del sistema funcionó.
  registrarEnHistorial("item", [linea], estado.embalaje, texto);
  try { await navigator.clipboard.writeText(texto); }
  catch { prompt("Copiá este texto:", texto); return; }
  const b = $("btnCopiar"), antes = b.textContent;
  b.textContent = "✓ Copiado";
  setTimeout(() => { b.textContent = antes; }, 1800);
};

$("cantidad").oninput = invalidar;
$("embalaje").oninput = () => {
  estado.embalaje = leerNumero($("embalaje").value) || 0;
  guardarPedido(); recalcular(); dibujarPresupuesto();
};

$("cliente").oninput = () => { estado.cliente = $("cliente").value; guardarPedido(); };

$("btnCalcular").onclick = () => {
  estado.calculado = true;
  // Una clave por cotización: si hay que reintentar, el bot reconoce que es la misma
  // y devuelve la publicación original en vez de crear una segunda.
  estado.claveCotizacion = `cot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  recalcular();
  $("resultado").scrollIntoView({ behavior: "smooth", block: "nearest" });
};

$("btnCopiarFicha").onclick = async () => {
  if (!ultima) return;
  const texto = Ficha.texto(perfilActual(), ultima, PRECIOS, estado.hpFicha);
  try { await navigator.clipboard.writeText(texto); }
  catch { prompt("Copiá la ficha:", texto); return; }
  const b = $("btnCopiarFicha"), antes = b.textContent;
  b.textContent = "✓ Copiada";
  setTimeout(() => { b.textContent = antes; }, 1800);
};

$("btnCambiar").onclick = () => { estado.eligiendo = true; render(); };

$("btnCustomizar").onclick = () => {
  estado.customizando = !estado.customizando;
  if (!estado.customizando && estado.pid) estado.eligiendo = false;
  render();
};

$("btnAgregar").onclick = agregarAlPresupuesto;

$("btnCopiarPedido").onclick = async () => {
  const texto = textoPresupuesto(estado.lineas, estado.embalaje, [...estado.filas], PRECIOS, { cliente: estado.cliente });
  registrarEnHistorial("pedido", estado.lineas, estado.embalaje, texto);
  try { await navigator.clipboard.writeText(texto); }
  catch { prompt("Copiá este texto:", texto); return; }
  const b = $("btnCopiarPedido"), antes = b.textContent;
  b.textContent = "✓ Copiado";
  setTimeout(() => { b.textContent = antes; }, 1800);
};

$("btnVaciar").onclick = () => {
  if (!confirm("Se borran los ítems del presupuesto. ¿Seguro?")) return;
  estado.lineas = []; estado.embalaje = 0; estado.cliente = "";
  $("embalaje").value = 0; $("cliente").value = "";
  guardarPedido(); recalcular(); dibujarPresupuesto();
};

$("dolarOficial").oninput = e => {
  PRECIOS.venta.dolarOficial = leerNumero(e.target.value) || null;
  guardarDolares({ oficial: PRECIOS.venta.dolarOficial, oficialFecha: new Date().toISOString() });
  $("dolarOficialEstado").className = ""; $("dolarOficialEstado").textContent = "cargado a mano";
  recalcular();
};
$("dolarML").oninput = e => {
  PRECIOS.venta.dolarML = leerNumero(e.target.value) || null;
  guardarDolares({ ml: PRECIOS.venta.dolarML, mlFecha: new Date().toISOString() });
  $("dolarMLEstado").textContent = "editado hoy";
  recalcular();
};

$("btnPanel").onclick = () => {
  const panel = $("panel");
  panel.hidden = !panel.hidden;
  $("btnPanel").setAttribute("aria-pressed", String(!panel.hidden));
  if (!panel.hidden) {
    dibujarPanel($("panelCuerpo"), () => { recalcular(); dibujarSecciones(); });
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

// ── Arranque ─────────────────────────────────────────────────────────────────
estado.orden = ordenGuardado();
$("versionPrecios").textContent = `Lista ${PRECIOS.version} · app ${VERSION}`;
if (PRECIOS.venta.dolarOficial) {
  $("dolarOficial").value = Math.round(PRECIOS.venta.dolarOficial);
  $("dolarOficialEstado").textContent = guardado.oficialFecha ? `guardado el ${fechaCorta(guardado.oficialFecha)}` : "guardado";
}
$("dolarML").value = PRECIOS.venta.dolarML ?? "";
$("embalaje").value = estado.embalaje;
$("cliente").value = estado.cliente;
dibujarHistorial();
dibujarSecciones();
$("dolarMLEstado").textContent = guardado.mlFecha ? `editado el ${fechaCorta(guardado.mlFecha)}` : "valor inicial";
render();
traerDolarOficial();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

let promptInstalar = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); promptInstalar = e;
  const b = el("button", "copiar", "Instalar app");
  b.style.maxWidth = "260px";
  b.onclick = async () => { promptInstalar.prompt(); await promptInstalar.userChoice; $("instalar").innerHTML = ""; };
  $("instalar").appendChild(b);
});
