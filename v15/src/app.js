import { PRECIOS } from "./precios.js";
import { PERFILES, ORDEN } from "./perfiles.js";
import { MODELOS } from "./modelos.js";
import { cotizar, preciosVenta, preciosPresupuesto, textoCliente, textoPresupuesto, etiquetaCliente, fmtARS, fmtUSD, r2 } from "./motor.js";
import { aplicarCambios, dibujarPanel } from "./panel.js";
import * as H from "./historial.js";

// Se sube a mano en cada publicación. Sirve para confirmar de un vistazo que el
// navegador cargó la versión nueva y no una copia guardada.
export const VERSION = "15.4";

const $ = id => document.getElementById(id);
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

// ── Estado de la pantalla ────────────────────────────────────────────────────
const estado = {
  pid: null, modo: "modelo", modelo: 0, entrada: {}, vents: null,
  filas: new Set(), eligiendo: false, calculado: false, excluidos: [],
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
  estado.modo = tieneCatalogo(pid) ? "modelo" : "libre";
  estado.modelo = 0;
  estado.vents = null;
  $("cantidad").value = 1;   // la cantidad es de cada ítem, no se arrastra
  estado.entrada = { enchapado: true, bajaTemp: false, reforzado: false,
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
  const abierta = !estado.pid || estado.eligiendo;
  $("productos").hidden = !abierta;
  $("elegido").hidden = abierta;
  if (!abierta) { $("nombreElegido").textContent = perfilActual().nombre; return; }

  const cont = $("productos"); cont.innerHTML = "";
  for (const pid of ORDEN) {
    const b = el("button", null, PERFILES[pid].nombre);
    b.setAttribute("aria-pressed", String(estado.pid === pid));
    b.onclick = () => elegirProducto(pid);
    cont.appendChild(b);
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
      campo = el("input"); campo.type = "number"; campo.step = c.step; campo.inputMode = "decimal";
      if (c.ej) campo.placeholder = c.ej;
      campo.value = estado.entrada[c.id] ?? "";
      campo.oninput = () => { estado.entrada[c.id] = campo.value === "" ? "" : +campo.value; estado.vents = null; invalidar(); };
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
    tr.appendChild(el("td", null, linea.concepto));
    tr.appendChild(el("td", null, fmtUSD(linea.importe)));
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

  // Mismo cálculo que el presupuesto: un ítem suelto es un pedido de un ítem.
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
    cont.appendChild(div);
  }

  const avisos = $("avisos"); avisos.innerHTML = "";
  for (const a of cot.avisos) {
    avisos.appendChild(el("div", "aviso" + (a.nivel === "error" ? " error" : ""), a.msg));
  }
  $("btnCopiar").disabled = estado.filas.size === 0 || cot.avisos.some(a => a.nivel === "error");
}

// ── Historial ────────────────────────────────────────────────────────────────
function registrarEnHistorial(tipo, lineas, embalaje, texto) {
  H.registrar({
    fecha: new Date().toISOString(), tipo, texto, cliente: estado.cliente || null,
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
      res.appendChild(el("span", "hist-monto", fmtUSD(e.usd)));
      caja.appendChild(res);

      const cuerpo = el("div", "hist-cuerpo");
      const pre = el("pre", "hist-texto", e.texto);
      cuerpo.appendChild(pre);
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


// ── Ciclo ────────────────────────────────────────────────────────────────────
let ultima = null;

// Cambiar cualquier cosa del producto apaga el resultado: si está en pantalla,
// es porque corresponde a lo que hay cargado ahora.
function invalidar() {
  estado.calculado = false;
  estado.excluidos = [];   // cambian los componentes: los tildes vuelven a empezar
  ultima = null;
  $("resultado").hidden = true;
  $("btnCalcular").disabled = !estado.pid || !entradaCompleta();
}

function entradaCompleta() {
  return camposVisibles().every(c => estado.entrada[c.id] !== "" && estado.entrada[c.id] != null);
}

function recalcular() {
  $("btnCalcular").disabled = !estado.pid || !entradaCompleta();
  if (!estado.pid || !estado.calculado || !entradaCompleta()) { $("resultado").hidden = true; ultima = null; return; }
  // El embalaje no es de este ítem sino del pedido: se suma una sola vez abajo.
  const entrada = {
    ...estado.entrada,
    cantidad: Math.max(1, +$("cantidad").value || 1),
    embalaje: 0
  };
  if (estado.vents) entrada.vents = estado.vents;
  entrada.excluidos = estado.excluidos;
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
  estado.embalaje = +$("embalaje").value || 0;
  guardarPedido(); recalcular(); dibujarPresupuesto();
};

$("cliente").oninput = () => { estado.cliente = $("cliente").value; guardarPedido(); };

$("btnCalcular").onclick = () => {
  estado.calculado = true;
  recalcular();
  $("resultado").scrollIntoView({ behavior: "smooth", block: "nearest" });
};

$("btnCambiar").onclick = () => { estado.eligiendo = true; render(); };

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
  PRECIOS.venta.dolarOficial = parseFloat(e.target.value) || null;
  guardarDolares({ oficial: PRECIOS.venta.dolarOficial, oficialFecha: new Date().toISOString() });
  $("dolarOficialEstado").className = ""; $("dolarOficialEstado").textContent = "cargado a mano";
  recalcular();
};
$("dolarML").oninput = e => {
  PRECIOS.venta.dolarML = parseFloat(e.target.value) || null;
  guardarDolares({ ml: PRECIOS.venta.dolarML, mlFecha: new Date().toISOString() });
  $("dolarMLEstado").textContent = "editado hoy";
  recalcular();
};

$("btnPanel").onclick = () => {
  const panel = $("panel");
  panel.hidden = !panel.hidden;
  $("btnPanel").setAttribute("aria-pressed", String(!panel.hidden));
  if (!panel.hidden) {
    dibujarPanel($("panelCuerpo"), recalcular);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

// ── Arranque ─────────────────────────────────────────────────────────────────
$("versionPrecios").textContent = `Lista ${PRECIOS.version} · app ${VERSION}`;
if (PRECIOS.venta.dolarOficial) {
  $("dolarOficial").value = Math.round(PRECIOS.venta.dolarOficial);
  $("dolarOficialEstado").textContent = guardado.oficialFecha ? `guardado el ${fechaCorta(guardado.oficialFecha)}` : "guardado";
}
$("dolarML").value = PRECIOS.venta.dolarML ?? "";
$("embalaje").value = estado.embalaje;
$("cliente").value = estado.cliente;
dibujarHistorial();
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
