import { PERFILES } from "../src/perfiles.js";
import { cotizar, presupuestar, r2, textoCliente, textoPresupuesto, preciosPresupuesto, etiquetaCliente, preciosVenta } from "../src/motor.js";
import { PRECIOS } from "../src/precios.js";
import * as L from "../src/lista-publicada.js";
import { MODELOS } from "../src/modelos.js";
import * as H from "../src/historial.js";

const res = { ok: 0, fail: 0, casos: [], grupos: {} };

function chk(grupo, etiqueta, esperado, obtenido, extra = "") {
  const pasa = r2(obtenido) === r2(esperado);
  res[pasa ? "ok" : "fail"]++;
  res.grupos[grupo] ??= { ok: 0, fail: 0 };
  res.grupos[grupo][pasa ? "ok" : "fail"]++;
  res.casos.push({ grupo, etiqueta, esperado: r2(esperado), obtenido: r2(obtenido), pasa, extra });
}

const usd = (perfil, entrada) => cotizar(PERFILES[perfil], entrada).base;

// ── Laterales ────────────────────────────────────────────────────────────────
for (const [tabla, perfil, ench, nombre] of [
  [L.FD_CC, "fd", true,  "Lateral doble enchapado"],
  [L.FD_SC, "fd", false, "Lateral doble SIN enchapar"],
  [L.FS_CC, "fs", true,  "Lateral simple enchapado"],
  [L.FS_SC, "fs", false, "Lateral simple SIN enchapar"]
]) {
  for (const sec of Object.keys(tabla)) {
    for (const anchoStr of Object.keys(tabla[sec])) {
      const ancho = parseFloat(anchoStr);
      chk(nombre, `${sec} sec × ${ancho}m`, tabla[sec][anchoStr],
          usd(perfil, { secciones: +sec, ancho, enchapado: ench }));
    }
  }
}

// ── Cámara ───────────────────────────────────────────────────────────────────
for (const m of L.CUB) {
  chk("Cúbico enchapado", m.et, m.cc, usd("cub", { enchapado: true, hp: m.hp, bateria: m.bateria, ancho: m.ancho }));
  chk("Cúbico sin enchapar", m.et, m.sc, usd("cub", { enchapado: false, hp: m.hp, secDobles: m.secDobles, ancho: m.ancho }));
}
for (const m of L.RCAM) {
  chk("Respaldo cámara enchapado", m.et, m.cc, usd("rcam", { enchapado: true, hp: m.hp, secDobles: m.secDobles, ancho: m.ancho }));
  chk("Respaldo cámara sin enchapar", m.et, m.sc, usd("rcam", { enchapado: false, hp: m.hp, secDobles: m.secDobles, ancho: m.ancho }));
}

// ── Techo, carniceras, piso ──────────────────────────────────────────────────
for (const m of L.T58) chk("Techo 5/8\"", m.et, m.cc, usd("t58", { enchapado: true, secciones: m.secciones, ancho: m.ancho, bandeja: m.bandeja }));
for (const m of L.T38) chk("Techo 3/8\"", m.et, m.cc, usd("t38", { enchapado: true, secciones: m.secciones, ancho: m.ancho, bandeja: m.bandeja }));
for (const m of L.CAR) chk("Carniceras", m.et, m.cc, usd("car", { dobles: m.dobles, ancho: m.ancho, cantVent: m.cantVent }));
for (const m of L.PT)  chk("Piso torteras", m.et, m.cc, usd("pt", { enchapado: true, secciones: m.secciones, ancho: m.ancho }));

// ── Bugs de la v14 que la v15 tiene que dejar arreglados ─────────────────────
{
  // #1 Baja temperatura no debe inflar el embalaje: base×1,8 + emb, no (base+emb)×1,8
  const c = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, bajaTemp: true, embalaje: 50 });
  chk("Bugs v14", "Baja temp no infla el embalaje", r2(578.70 * 1.8 + 50), c.total, "v14 daba " + r2((578.70 + 50) * 1.8));
  chk("Bugs v14", "Baja temp no aplica al embalaje (v14 cobraba de más)", 40, r2(r2((578.70 + 50) * 1.8) - c.total));
}
{
  // Decisión #6: $25 fijo en compactos/carniceras/piso; precio real en cámara.
  const fc = cotizar(PERFILES.fc, { enchapado: true, secciones: 8, ancho: 0.5, vents: { v200: 0, v250: 0, v300: 1 } });
  chk("Decisiones", "v300 en lateral compacto cobra $37,50 (tarifa fija)", 37.50, fc.ventiladores.total);
  const cub = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9 });
  chk("Decisiones", "v300 en cúbico cobra $66 (precio real)", 132, cub.ventiladores.total);
}
{
  // Decisión #10: el embalaje es uno por pedido, no por unidad.
  const c = cotizar(PERFILES.da, { secciones: 6, ancho: 0.6, cantidad: 3, embalaje: 40 });
  const unit = cotizar(PERFILES.da, { secciones: 6, ancho: 0.6 }).base;
  chk("Decisiones", "Embalaje una sola vez con cantidad 3", r2(unit * 3 + 40), c.total);
  const p = presupuestar([
    { perfil: PERFILES.da, entrada: { secciones: 6, ancho: 0.6 } },
    { perfil: PERFILES.da, entrada: { secciones: 5, ancho: 0.6 } }
  ], 40);
  chk("Decisiones", "Multi-ítem: un embalaje por pedido", r2(p.subtotal + 40), p.total);
}
{
  // #6 de los bugs: nada de fallbacks silenciosos. Fuera de tabla → aviso, no un número inventado.
  const c = cotizar(PERFILES.fd, { secciones: 9, ancho: 0.5, enchapado: true });
  chk("Bugs v14", "Fuera de rango avisa en vez de inventar", 1, c.avisos.length ? 1 : 0, c.avisos.map(a => a.msg).join(" | "));
  const ok = cotizar(PERFILES.fd, { secciones: 4, ancho: 0.5, enchapado: true });
  chk("Bugs v14", "Dentro de rango no avisa nada", 0, ok.avisos.length);
}
{
  // Baja temperatura sólo donde corresponde.
  const c = cotizar(PERFILES.ev, { secciones: 6, ancho: 0.5, bajaTemp: true });
  chk("Bugs v14", "Baja temp rechazada en producto que no la admite", 1, c.avisos.length ? 1 : 0);
}

// ── Respuestas del 19/08/2026 ────────────────────────────────────────────────
function chkOk(grupo, etiqueta, cond, extra = "") {
  res[cond ? "ok" : "fail"]++;
  res.grupos[grupo] ??= { ok: 0, fail: 0 };
  res.grupos[grupo][cond ? "ok" : "fail"]++;
  res.casos.push({ grupo, etiqueta, esperado: "sí", obtenido: cond ? "sí" : "no", pasa: cond, extra });
}

{
  // Ventilador 300mm reforzado: $60 + 50% = $90, sólo en cúbico y respaldo de cámara.
  const c = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, reforzado: true });
  chk("Reforzado", "Cúbico 2HP con reforzados: 2 × $90", 180, c.ventiladores.total);
  chk("Reforzado", "Cúbico 2HP con reforzados — base", r2(463 * 0.9 + 180 + 30), c.base);
  const r = cotizar(PERFILES.rcam, { enchapado: true, hp: 2, secDobles: 10, ancho: 1.2, reforzado: true });
  chk("Reforzado", "Respaldo cámara 2HP con reforzados (incluye ajuste $20)", r2(339 * 1.2 + 180 + 30 + 20), r.base);
  const sin = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9 });
  chk("Reforzado", "La casilla suma $48 sobre el v300 común", 48, r2(c.base - sin.base));
  // Al tildar, los ventiladores por defecto se van: sólo quedan los reforzados elegidos.
  const tres = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, reforzado: true, cantReforzados: 3 });
  chk("Reforzado", "3 reforzados elegidos a mano", 270, tres.ventiladores.total);
  chkOk("Reforzado", "No queda ningún ventilador por defecto mezclado", tres.ventiladores.items.length === 1);
  const chico = cotizar(PERFILES.cub, { enchapado: true, hp: 0.75, bateria: "3F4C", ancho: 0.85, reforzado: true, cantReforzados: 2 });
  chk("Reforzado", "Modelo chico: se descuentan los 2×v250 y entran 2 reforzados", 180, chico.ventiladores.total);
  chk("Reforzado", "Modelo chico — base", r2(222 * 0.85 + 180), chico.base);
  const mal = cotizar(PERFILES.fd, { secciones: 4, ancho: 0.5, enchapado: true, reforzado: true });
  chkOk("Reforzado", "Rechazado en un producto que no lo admite", mal.avisos.some(a => /reforzados/.test(a.msg)));
}
{
  // Col/dist arranca recién en 2HP, en cúbico y en respaldo de cámara.
  const a = cotizar(PERFILES.cub, { enchapado: false, hp: 1.5, secDobles: 12, ancho: 0.8 });
  chkOk("Col/dist desde 2HP", "Cúbico 1,5HP no lleva col/dist", !a.adicionales.some(x => /Columnas/.test(x.concepto) && x.importe));
  const b = cotizar(PERFILES.cub, { enchapado: false, hp: 2, secDobles: 15, ancho: 0.9 });
  chk("Col/dist desde 2HP", "Cúbico 2HP sin enchapar: col/dist $40", 40, b.adicionales.find(x => /Columnas/.test(x.concepto)).importe);
  const d = cotizar(PERFILES.rcam, { enchapado: false, hp: 1.5, secDobles: 10, ancho: 0.98 });
  chkOk("Col/dist desde 2HP", "Respaldo cámara 1,5HP no lleva col/dist", !d.adicionales.some(x => /Columnas/.test(x.concepto) && x.importe));
}
{
  // Piso torteras 4 secciones: 2 ventiladores por defecto hasta 1,20m.
  const c = cotizar(PERFILES.pt, { enchapado: true, secciones: 4, ancho: 1.2 });
  chk("Piso torteras", "4 sec × 1,20m — 2 ventiladores", 75, c.ventiladores.total);
  chk("Piso torteras", "4 sec × 1,20m — base", r2(129.33 * 1.2 + 75), c.base);
  const libre = cotizar(PERFILES.pt, { enchapado: true, secciones: 4, ancho: 1.2, vents: { v200: 4, v250: 0, v300: 0 } });
  chk("Piso torteras", "Cantidad elegida a mano manda sobre el default", 150, libre.ventiladores.total);
  const ancho = cotizar(PERFILES.pt, { enchapado: true, secciones: 4, ancho: 1.5 });
  chk("Piso torteras", "4 sec × 1,50m — arranca igual en 2, sin aviso", 75, ancho.ventiladores.total);
  chkOk("Piso torteras", "4 sec por encima de 1,20m no molesta con avisos", ancho.avisos.length === 0);
}
{
  // Texto para el cliente: sin medidas, sin secciones, sin decir "enchapado".
  PRECIOS.venta.dolarOficial = 1400;
  const c = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9 });
  const t = textoCliente(PERFILES.cub, c, ["lista", "iva"]);
  chkOk("Texto al cliente", "No dice el ancho", !t.includes("0,9") && !t.includes("0.9"), t.split("\n")[0]);
  chkOk("Texto al cliente", "No dice las secciones ni la batería", !/5F6C|sec/i.test(t));
  chkOk("Texto al cliente", "No dice que es enchapado", !/enchapad/i.test(t));
  chkOk("Texto al cliente", "Dice el HP", t.includes("2HP"));
  const sc = cotizar(PERFILES.cub, { enchapado: false, hp: 2, secDobles: 15, ancho: 0.9 });
  chkOk("Texto al cliente", "Sí aclara sin enchapar y sin ventilador",
        etiquetaCliente(PERFILES.cub, sc.entrada).includes("sin enchapar y sin ventilador"));
  const t58 = cotizar(PERFILES.t58, { enchapado: false, secciones: 8, ancho: 0.35 });
  chkOk("Texto al cliente", "En techo aclara sin bandeja plástica",
        etiquetaCliente(PERFILES.t58, t58.entrada).includes("sin bandeja plástica"));
  const bt = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, bajaTemp: true });
  chkOk("Texto al cliente", "Aclara la baja temperatura", etiquetaCliente(PERFILES.cub, bt.entrada).includes("Baja Temperatura"));
  const rf = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, reforzado: true });
  chkOk("Texto al cliente", "Aclara los ventiladores reforzados", etiquetaCliente(PERFILES.cub, rf.entrada).includes("reforzados"));
  PRECIOS.venta.dolarOficial = null;
}
{
  // El dólar oficial va en todos los textos copiados menos el de MercadoLibre.
  PRECIOS.venta.dolarOficial = 1400;
  const cot = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9 });
  for (const id of ["lista", "m5", "iva"]) {
    chkOk("Dólar en el texto", `Aparece en "${id}"`, textoCliente(PERFILES.cub, cot, [id]).includes("Dólar oficial"));
  }
  chkOk("Dólar en el texto", "No aparece en MercadoLibre", !textoCliente(PERFILES.cub, cot, ["ml"]).includes("Dólar oficial"));
  chkOk("Dólar en el texto", "Con las 4 filas juntas aparece 3 veces",
        (textoCliente(PERFILES.cub, cot, ["lista", "m5", "iva", "ml"]).match(/Dólar oficial/g) || []).length === 3);
  PRECIOS.venta.dolarOficial = null;

  const n = preciosVenta(100).map(r => r.nombre);
  chkOk("Columnas", "Nombres reales de las 4 columnas",
        n[0] === "Precio de lista" && n[1] === "Sin factura" && n[2] === "Con factura" && n[3] === "MercadoLibre", n.join(" · "));
}

// ── Medidas en el texto al cliente ───────────────────────────────────────────
{
  const et = (pid, e) => etiquetaCliente(PERFILES[pid], cotizar(PERFILES[pid], { enchapado: true, ...e }).entrada);
  const conMedida = {
    ev:   [{ secciones: 6, ancho: 0.5 },  "Evaporador estático 5/8\" 6 sec x 0,50m"],
    fd:   [{ secciones: 5, ancho: 0.4 },  "Forzador lateral doble 5/8\" 5 sec x 0,40m"],
    col:  [{ secDobles: 3, ancho: 3.7, uniones: 2 }, "Columna para batea 5/8\" 3 sec x 3,70m"],
    da:   [{ secciones: 6, ancho: 0.6 },  "Forzador doble ataque 6 sec x 0,60m"],
    pt:   [{ secciones: 3, ancho: 1.25, hp: 0.5 }, "Forzador de piso para torteras 1/2HP 3 sec x 1,25m"]
  };
  for (const [pid, [entrada, esperado]] of Object.entries(conMedida)) {
    chkOk("Medidas en el texto", `${pid} lleva la medida`, et(pid, entrada) === esperado, et(pid, entrada));
  }
  // Estos no la llevan nunca.
  const sinMedida = {
    cub:  [{ hp: 2, bateria: "5F6C", ancho: 0.9 }, "Forzador cúbico de cámara 2HP"],
    rcam: [{ hp: 2, secDobles: 10, ancho: 1.2 }, "Forzador respaldo de cámara 2HP"],
    t58:  [{ hp: 0.75, secciones: 8, ancho: 0.35, bandeja: 1000 }, "Forzador de techo 5/8\" 3/4HP"],
    t38:  [{ hp: 0.5, secciones: 24, ancho: 0.33, bandeja: 800 }, "Forzador de techo 3/8\" 1/2HP"],
    car:  [{ dobles: false, ancho: 1.8, cantVent: 3, modelo: "Mod.124" }, "Respaldo para carniceras Mod.124"]
  };
  for (const [pid, [entrada, esperado]] of Object.entries(sinMedida)) {
    chkOk("Medidas en el texto", `${pid} NO lleva la medida`, et(pid, entrada) === esperado, et(pid, entrada));
  }
  chkOk("Medidas en el texto", "Siempre dos decimales",
        et("ev", { secciones: 6, ancho: 0.5 }).includes("0,50m") && et("col", { secDobles: 3, ancho: 3.7, uniones: 0 }).includes("3,70m"));
}

// ── Historial ────────────────────────────────────────────────────────────────
// Con una llave aparte, para no tocar el historial real de quien esté probando.
{
  const K = "gz15.historial.test";
  H.vaciar(K);
  chkOk("Historial", "Arranca vacío", H.leer(K).length === 0);

  const ayer = new Date(Date.now() - 86400000).toISOString();
  H.registrar({ fecha: ayer, tipo: "item", texto: "viejo", lineas: [{ etiqueta: "A", total: 10 }], embalaje: 0, usd: 10, columnas: ["lista"], dolarOficial: 1400 }, K);
  const nueva = H.registrar({ fecha: new Date().toISOString(), tipo: "pedido", texto: "nuevo", lineas: [{ etiqueta: "B", total: 20 }], embalaje: 5, usd: 25, columnas: ["iva"], dolarOficial: 1515 }, K);

  chkOk("Historial", "Lo último queda primero", H.leer(K)[0].texto === "nuevo");
  chkOk("Historial", "Guarda el dólar de ese día", H.leer(K)[1].dolarOficial === 1400);
  chkOk("Historial", "Guarda el texto tal cual se envió", H.leer(K)[0].texto === "nuevo");

  const dias = H.porDia(K);
  chkOk("Historial", "Agrupa por día", dias.length === 2, dias.map(d => d[0]).join(" / "));
  chkOk("Historial", "El día de hoy se llama Hoy", H.fechaLarga(new Date().toISOString()) === "Hoy");
  chkOk("Historial", "El de ayer se llama Ayer", H.fechaLarga(ayer) === "Ayer");

  H.borrar(nueva.id, K);
  chkOk("Historial", "Borra una entrada sola", H.leer(K).length === 1 && H.leer(K)[0].texto === "viejo");

  for (let i = 0; i < 250; i++) H.registrar({ fecha: new Date().toISOString(), texto: "x" + i, lineas: [], embalaje: 0, usd: 0, columnas: [] }, K);
  chkOk("Historial", "No crece sin límite: corta en 200", H.leer(K).length === 200, "quedaron " + H.leer(K).length);
  chkOk("Historial", "Al cortar se van los más viejos", H.leer(K)[0].texto === "x249");

  H.vaciar(K);
  chkOk("Historial", "Vaciar deja la lista en cero", H.leer(K).length === 0);
}

// ── Presupuesto de varios ítems ──────────────────────────────────────────────
{
  PRECIOS.venta.dolarOficial = 1515;
  const cub = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, cantidad: 2 });
  const con = cotizar(PERFILES.cond, { hp: 0.5, conBase: true });
  const lineas = [
    { etiqueta: etiquetaCliente(PERFILES.cub, cub.entrada), total: cub.total },
    { etiqueta: etiquetaCliente(PERFILES.cond, con.entrada), total: con.total }
  ];
  chk("Presupuesto", "Ítem con cantidad 2 no lleva embalaje propio", r2(578.70 * 2), cub.total);
  chk("Presupuesto", "Condensador 1/2HP con base", 134.60, con.total);

  const cols = preciosPresupuesto(lineas, 50);
  chk("Presupuesto", "Total en USD", r2(578.70 * 2 + 134.60 + 50), cols[0].usd);
  // Lo que el cliente puede sumar a mano tiene que dar el total impreso.
  for (const f of cols) {
    chkOk("Presupuesto", `Las líneas suman el total — ${f.nombre}`,
          f.detalle.reduce((s, d) => r2(s + d.importe), 0) === f.total,
          `${f.detalle.map(d => d.importe).join(" + ")} vs ${f.total}`);
  }
  chkOk("Presupuesto", "El embalaje aparece una sola vez",
        cols[0].detalle.filter(d => d.etiqueta === "Embalaje").length === 1);

  const t = textoPresupuesto(lineas, 50, ["iva"]);
  chkOk("Presupuesto", "El texto nombra los dos ítems", t.includes("cúbico") && t.includes("Condensador"));
  chkOk("Presupuesto", "Encabeza con el membrete y la fecha",
        t.startsWith("*Presupuesto GZ Refrigeración*") && /\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}/.test(t), t.split("\n")[1]);
  const conCliente = textoPresupuesto(lineas, 50, ["iva"], PRECIOS, { cliente: "Juan X" });
  chkOk("Presupuesto", "Pone el nombre del cliente cuando lo cargás", conCliente.split("\n")[1].startsWith("Juan X · "), conCliente.split("\n")[1]);
  chkOk("Presupuesto", "Sin cliente arranca directo con la fecha", /^\d{2}\//.test(t.split("\n")[1]), t.split("\n")[1]);
  chkOk("Presupuesto", "No repite la palabra Presupuesto adentro",
        (t.match(/Presupuesto/g) || []).length === 1, t);
  chkOk("Presupuesto", "El texto no dice medidas ni secciones", !/0,9|5F6C|sec\b/.test(t), t);
  chkOk("Presupuesto", "El texto aclara las 2 unidades", t.includes("2 unidades"));

  // Sin embalaje no aparece el renglón.
  chkOk("Presupuesto", "Sin embalaje no hay renglón de embalaje",
        !preciosPresupuesto(lineas, 0)[0].detalle.some(d => d.etiqueta === "Embalaje"));
  PRECIOS.venta.dolarOficial = null;
}

// ── Condensadores ────────────────────────────────────────────────────────────
{
  const fijos = { 0.25: 64.80, 0.33: 92.30, 0.5: 119.60, 0.75: 204.50, 1: 266 };
  const etiq  = { 0.25: "1/4", 0.33: "1/3", 0.5: "1/2", 0.75: "3/4", 1: "1" };
  const vent  = { 0.25: 37.50, 0.33: 37.50, 0.5: 37.50, 0.75: 66, 1: 66 };
  const base  = { 0.25: 15, 0.33: 15, 0.5: 15, 0.75: 20, 1: 20 };
  for (const hp of Object.keys(fijos).map(Number)) {
    const solo = cotizar(PERFILES.cond, { hp });
    chk("Condensadores", `${etiq[hp]}HP pelado`, fijos[hp], solo.base);
    chkOk("Condensadores", `${etiq[hp]}HP pelado no trae ventilador`, solo.ventiladores.total === 0);

    const conV = cotizar(PERFILES.cond, { hp, conVentilador: true });
    chk("Condensadores", `${etiq[hp]}HP con ventilador`, fijos[hp] + vent[hp], conV.base);
    chkOk("Condensadores", `${etiq[hp]}HP lleva ${hp <= 0.5 ? "200mm" : "300mm"}`,
          conV.ventiladores.items[0].concepto.includes(hp <= 0.5 ? "200mm" : "300mm"),
          conV.ventiladores.items[0].concepto);

    const conB = cotizar(PERFILES.cond, { hp, conBase: true });
    chk("Condensadores", `${etiq[hp]}HP con base`, fijos[hp] + base[hp], conB.base);

    const todo = cotizar(PERFILES.cond, { hp, conVentilador: true, conBase: true });
    chk("Condensadores", `${etiq[hp]}HP con ventilador y base`, fijos[hp] + vent[hp] + base[hp], todo.base);
    chkOk("Condensadores", `${etiq[hp]}HP sin avisos`, todo.avisos.length === 0, todo.avisos.map(a => a.msg).join(" | "));
  }
  // Un HP que no existe tiene que avisar, no inventar.
  const malo = cotizar(PERFILES.cond, { hp: 2 });
  chkOk("Condensadores", "HP fuera de tabla avisa", malo.avisos.length > 0);
  // Texto al cliente: las casillas se leen juntas, y el ventilador se nombra.
  const et = e => etiquetaCliente(PERFILES.cond, cotizar(PERFILES.cond, e).entrada);
  const conTodo = et({ hp: 0.33, conVentilador: true, conBase: true });
  chkOk("Condensadores", "Con base y ventilador, en un solo texto",
        conTodo === "Condensador 1/3HP — con base y ventilador de 200mm", conTodo);
  const grande = et({ hp: 1, conVentilador: true, conBase: true });
  chkOk("Condensadores", "El 1HP nombra el 300mm",
        grande === "Condensador 1HP — con base y ventilador de 300mm", grande);
  const soloBase = et({ hp: 0.5, conBase: true });
  chkOk("Condensadores", "Sólo base: aclara que no lleva ventilador",
        soloBase === "Condensador 1/2HP — con base — sin ventilador", soloBase);
  const soloVent = et({ hp: 0.25, conVentilador: true });
  chkOk("Condensadores", "Sólo ventilador: no habla de la base",
        soloVent === "Condensador 1/4HP — con ventilador de 200mm", soloVent);
  const pelado = et({ hp: 0.25 });
  chkOk("Condensadores", "Pelado: sólo aclara lo que falta",
        pelado === "Condensador 1/4HP — sin ventilador", pelado);
  // Si se cambia el ventilador a mano, el texto dice el que realmente lleva.
  const dos = etiquetaCliente(PERFILES.cond, cotizar(PERFILES.cond, { hp: 0.33, conVentilador: true, vents: { v200: 2, v250: 0, v300: 0 } }).entrada);
  chkOk("Condensadores", "Nombra la cantidad real de ventiladores",
        dos === "Condensador 1/3HP — con 2 ventiladores de 200mm", dos);
  chkOk("Condensadores", "El 1/4HP se escribe como fracción", et({ hp: 0.25 }).includes("1/4HP"));
}

// El catálogo que ve el usuario en el desplegable tiene que dar el precio publicado.
{
  const contra = { cub: L.CUB, rcam: L.RCAM, t58: L.T58, t38: L.T38, car: L.CAR };
  for (const [pid, publicados] of Object.entries(contra)) {
    MODELOS[pid].forEach((m, i) => {
      const { et, ...entrada } = m;
      const c = cotizar(PERFILES[pid], { ...entrada, enchapado: true });
      chk("Catálogo → lista", `${pid} · ${et}`, publicados[i].cc, c.base);
      chkOk("Catálogo → lista", `${pid} · ${et} sin avisos`, c.avisos.length === 0,
            c.avisos.map(a => a.msg).join(" | "));
    });
  }
  // Piso torteras: el único precio publicado que tenemos es el de 1,25m.
  const pt = MODELOS.pt.find(m => m.ancho === 1.25);
  const { et, ...e } = pt;
  chk("Catálogo → lista", `pt · ${et}`, 196.25, cotizar(PERFILES.pt, { ...e, enchapado: true }).base);
}

export function correr() { return res; }
