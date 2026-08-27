import { PERFILES, ORDEN } from "../src/perfiles.js";
import { cotizar, presupuestar, r2, textoCliente, textoPresupuesto, preciosPresupuesto, etiquetaCliente, preciosVenta } from "../src/motor.js";
import { PRECIOS } from "../src/precios.js";
import * as L from "../src/lista-publicada.js";
import { MODELOS } from "../src/modelos.js";
import * as H from "../src/historial.js";
import * as ML from "../src/mercadolibre.js";
import * as Ficha from "../src/ficha.js";
import { leerNumero } from "../src/motor.js";

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

// ── Ítems que se sacan del desglose ──────────────────────────────────────────
{
  const completo = cotizar(PERFILES.t58, { enchapado: true, secciones: 6, ancho: 0.35, bandeja: 800 });
  chk("Sacar ítems", "Techo 1/3HP completo", 147.40, completo.base);
  chkOk("Sacar ítems", "Sin exclusiones no hay nada que aclarar", completo.noIncluye.length === 0);

  const sinCobre = cotizar(PERFILES.t58, { enchapado: true, secciones: 6, ancho: 0.35, bandeja: 800,
    excluidos: ["Salida de cobre"] });
  chk("Sacar ítems", "Sin la salida de cobre descuenta $8", 139.40, sinCobre.base);
  chkOk("Sacar ítems", "La línea sigue a la vista con su importe",
        sinCobre.desglose.some(d => d.concepto === "Salida de cobre" && d.importe === 8 && d.excluido));

  const dos = cotizar(PERFILES.t58, { enchapado: true, secciones: 6, ancho: 0.35, bandeja: 800,
    excluidos: ["Salida de cobre", "Bandeja plástica 800mm"] });
  chk("Sacar ítems", "Sacando dos", 95.90, dos.base);
  chkOk("Sacar ítems", "Las dos quedan anotadas", dos.noIncluye.length === 2, dos.noIncluye.join(" / "));

  // Un ventilador también se puede sacar.
  const sinVent = cotizar(PERFILES.t58, { enchapado: true, secciones: 6, ancho: 0.35, bandeja: 800,
    excluidos: ["1 × ventilador 250mm"] });
  chk("Sacar ítems", "Sin el ventilador descuenta $37,50", 109.90, sinVent.base);

  // Lo derivado no se puede destildar: no lleva casillero.
  const bt = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, bajaTemp: true, cantidad: 2 });
  chkOk("Sacar ítems", "La baja temperatura no es un componente",
        !bt.desglose.find(d => /Baja temperatura/.test(d.concepto)).componente);
  chkOk("Sacar ítems", "La cantidad tampoco",
        !bt.desglose.find(d => /unidades/.test(d.concepto)).componente);

  // La baja temperatura se aplica sobre lo que quedó.
  const btSinVent = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9,
    bajaTemp: true, excluidos: ["2 × ventilador 300mm"] });
  chk("Sacar ítems", "Baja temperatura sobre la base ya recortada", r2((416.70 + 30) * 1.8), btSinVent.total);

  // El texto lo aclara.
  PRECIOS.venta.dolarOficial = 1515;
  const t = textoCliente(PERFILES.t58, dos, ["iva"]);
  chkOk("Sacar ítems", "El texto avisa qué no incluye",
        t.includes("No incluye: salida de cobre, bandeja plástica 800mm"), t.split("\n")[3]);
  const limpio = textoCliente(PERFILES.t58, completo, ["iva"]);
  chkOk("Sacar ítems", "Sin exclusiones no aparece la aclaración", !limpio.includes("No incluye"));
  PRECIOS.venta.dolarOficial = null;
}

// ── Los 15 productos cotizan ─────────────────────────────────────────────────
// Barrido de todo el catálogo con valores válidos: ninguno puede quedar trabado.
{
  const entradas = {
    ev:   { secciones: 6, ancho: 0.5 },
    oli:  { secciones: 9, ancho: 0.5 },
    resp: { secciones: 4, ancho: 0.6 },
    fd:   { secciones: 4, ancho: 0.5 },
    fs:   { secciones: 4, ancho: 0.5 },
    fc:   { secciones: 12, ancho: 0.36 },
    col:  { secDobles: 4, ancho: 2.3 },
    cub:  { hp: 0.75, bateria: "3F4C", ancho: 0.85 },
    rcam: { hp: 0.5, secDobles: 4, ancho: 1 },
    t58:  { secciones: 6, ancho: 0.35, bandeja: 800 },
    t38:  { secciones: 16, ancho: 0.33, bandeja: 800 },
    car:  { dobles: false, ancho: 1.2, cantVent: 2 },
    da:   { secciones: 5, ancho: 0.6 },
    pt:   { secciones: 3, ancho: 0.8 },
    cond: { hp: 0.25 }
  };
  const esperados = {
    ev: 97.50, oli: 100.25, resp: 77.00, fd: 115.50, fs: 133.50, fc: 144.18,
    col: 220.80, cub: 263.70, rcam: 231, t58: 147.40, t38: 232.60,
    car: 241.80, da: 195.80, pt: 152.60, cond: 64.80
  };
  for (const pid of ORDEN) {
    const c = cotizar(PERFILES[pid], { enchapado: true, ...entradas[pid] });
    chk("Todos cotizan", `${PERFILES[pid].nombre}`, esperados[pid], c.base);
    chkOk("Todos cotizan", `${pid} sin avisos`, c.avisos.length === 0, c.avisos.map(a => a.msg).join(" | "));
  }
  // Los valores por defecto del perfil tienen que alcanzar para cotizar:
  // la columna para batea no puede quedar trabada por el campo de uniones.
  const sinUniones = cotizar(PERFILES.col, { secDobles: 4, ancho: 2.3 });
  chk("Todos cotizan", "Columna sin tocar uniones", 220.80, sinUniones.base);
  chkOk("Todos cotizan", "El perfil trae uniones por defecto", PERFILES.col.defaults.uniones === 0);
}

// ── Colector y distribuidor a mano ───────────────────────────────────────────
{
  const base = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55 });
  chk("Colector a mano", "Sin colector", 104.40, base.base);
  const con = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55, colector: 45.50 });
  chk("Colector a mano", "Con colector de $45,50", 149.90, con.base);
  chkOk("Colector a mano", "Aparece como renglón propio",
        con.desglose.some(d => d.concepto === "Colector y distribuidor" && d.importe === 45.50));
  chkOk("Colector a mano", "Queda marcado como manual, no lo dibuja el motor",
        con.desglose.find(d => d.concepto === "Colector y distribuidor").manual === true);
  chkOk("Colector a mano", "El texto al cliente lo aclara",
        etiquetaCliente(PERFILES.fd, con.entrada).includes("con colector y distribuidor"),
        etiquetaCliente(PERFILES.fd, con.entrada));
  chkOk("Colector a mano", "Sin colector no aclara nada",
        !etiquetaCliente(PERFILES.fd, base.entrada).includes("colector"));
  // Se puede sacar como cualquier otro componente.
  const sacado = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55,
    colector: 45.50, excluidos: ["Colector y distribuidor"] });
  chk("Colector a mano", "Destildado no suma", 104.40, sacado.base);
  // Y en un producto que ya trae col/dist propio conviven sin pisarse.
  const cub = cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9, colector: 20 });
  chk("Colector a mano", "En el cúbico se suma al col/dist automático", r2(578.70 + 20), cub.base);
}

// ── Ítem libre ───────────────────────────────────────────────────────────────
{
  const base = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55 });
  const con = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55,
    extra: { nombre: "Patas reforzadas", importe: 32.50 } });
  chk("Ítem libre", "Suma al total", 136.90, con.base);
  chkOk("Ítem libre", "Sale con el nombre que le pusiste",
        con.desglose.some(d => d.concepto === "Patas reforzadas" && d.importe === 32.50));
  chkOk("Ítem libre", "El texto al cliente lo nombra",
        etiquetaCliente(PERFILES.fd, con.entrada).includes("con patas reforzadas"),
        etiquetaCliente(PERFILES.fd, con.entrada));

  // Sin nombre se cobra igual, pero identificado.
  const anonimo = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55,
    extra: { nombre: "", importe: 32.50 } });
  chk("Ítem libre", "Sin nombre suma igual", 136.90, anonimo.base);
  chkOk("Ítem libre", "Sin nombre se llama Adicional, nunca queda sin identificar",
        anonimo.desglose.some(d => d.concepto === "Adicional"));

  // Sin importe no aparece.
  const vacio = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55,
    extra: { nombre: "Algo", importe: 0 } });
  chk("Ítem libre", "Sin importe no suma nada", base.base, vacio.base);
  chkOk("Ítem libre", "Sin importe no aparece en el desglose", !vacio.desglose.some(d => d.manual));

  // Los dos libres juntos.
  const dos = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55,
    colector: 45.50, extra: { nombre: "Patas reforzadas", importe: 32.50 } });
  chk("Ítem libre", "Colector e ítem libre juntos", 182.40, dos.base);
  chkOk("Ítem libre", "Los dos se aclaran en el texto",
        etiquetaCliente(PERFILES.fd, dos.entrada).includes("colector y distribuidor") &&
        etiquetaCliente(PERFILES.fd, dos.entrada).includes("patas reforzadas"));
}

// ── Explicaciones del desglose ───────────────────────────────────────────────
{
  const c = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55 });
  const nota = concepto => c.desglose.find(d => d.concepto.includes(concepto))?.nota;
  chkOk("Explicaciones", "Los costados explican su rango",
        nota("Costados") === "$8 de 2 a 5 secciones · $12 de 6 a 7", nota("Costados"));
  chkOk("Explicaciones", "La batería explica su tarifa",
        (nota("Batería") || "").includes("por sección doble por metro"), nota("Batería"));
  const ench = cotizar(PERFILES.fd, { enchapado: true, secciones: 7, ancho: 0.55 });
  const nEnch = ench.desglose.find(d => d.concepto.includes("Batería")).nota;
  chkOk("Explicaciones", "La batería enchapada muestra la tabla de precio/metro",
        nEnch.includes("2 = $83") && nEnch.includes("7 = $248"), nEnch);
  chkOk("Explicaciones", "El ventilador explica el markup",
        ench.desglose.find(d => /ventilador/.test(d.concepto)).nota.includes("50%"));
  const t = cotizar(PERFILES.t58, { enchapado: true, secciones: 6, ancho: 0.35, bandeja: 800 });
  chkOk("Explicaciones", "La bandeja muestra los dos tamaños",
        t.desglose.find(d => /Bandeja/.test(d.concepto)).nota.includes("1000mm"));
  const cub = cotizar(PERFILES.cub, { enchapado: true, hp: 3, bateria: "5F6C", ancho: 1.4 });
  chkOk("Explicaciones", "El col/dist explica que arranca en 2HP",
        cub.desglose.find(d => /Columnas/.test(d.concepto)).nota.includes("Arranca en 2HP"));
}

// ── Respaldar con la fórmula del estático ────────────────────────────────────
// Cambio del 21/08/2026: antes era sec × 30 × ancho × 1,04, sin curvas ni markup.
{
  const casos = [[2, 0.40, 28.50], [4, 0.60, 77.00], [6, 0.50, 97.50], [8, 1.00, 248.00]];
  for (const [sec, ancho, esperado] of casos) {
    chk("Respaldar", `${sec} sec × ${ancho}m`, esperado, cotizar(PERFILES.resp, { secciones: sec, ancho }).base);
  }
  chkOk("Respaldar", "Ya no lleva el factor 1,04", !("respaldarFactor" in PRECIOS.tarifas));
  // Con la misma medida tiene que dar lo mismo que el evaporador estático.
  for (const [sec, ancho] of [[4, 0.6], [6, 0.5], [9, 0.6]]) {
    const ev = cotizar(PERFILES.ev, { secciones: sec, ancho }).base;
    const re = cotizar(PERFILES.resp, { secciones: sec, ancho }).base;
    chk("Respaldar", `${sec}×${ancho} da igual que el estático`, ev, re);
  }
  const d = cotizar(PERFILES.resp, { secciones: 4, ancho: 0.6 }).desglose;
  chkOk("Respaldar", "Ahora lleva curvas y markup",
        d.some(x => x.concepto === "Curvas") && d.some(x => x.concepto === "Markup por tamaño"));

  // 27/08/2026: el respaldar cortaba en 8 secciones y hacían falta 9 o más.
  // Ahora llega hasta 16, igual que el estático, que es la misma fórmula.
  chk("Respaldar", "9 sec × 0,60m (antes no cotizaba)", 172.25,
      cotizar(PERFILES.resp, { secciones: 9, ancho: 0.6 }).base);
  chk("Respaldar", "12 sec × 1,00m", 371, cotizar(PERFILES.resp, { secciones: 12, ancho: 1 }).base);
  for (const sec of [9, 10, 12, 14, 16, 18, 20]) {
    chkOk("Respaldar", `${sec} secciones entra en el rango`,
          cotizar(PERFILES.resp, { secciones: sec, ancho: 0.6 }).avisos.length === 0);
  }
  chkOk("Respaldar", "21 secciones sigue avisando",
        cotizar(PERFILES.resp, { secciones: 21, ancho: 0.6 }).avisos.some(a => a.nivel === "error"));
  chk("Respaldar", "16 sec da igual que el estático",
      cotizar(PERFILES.ev, { secciones: 16, ancho: 0.8 }).base,
      cotizar(PERFILES.resp, { secciones: 16, ancho: 0.8 }).base);
}

// ── Las tres secciones ──────────────────────────────────────────────────────
// Pendiente #2 de la ficha: referencia para identificar un equipo ya armado.
{
  const R = Ficha.referenciaSecciones();
  chk("Las tres secciones", "Son tres", 3, R.length);
  const porId = Object.fromEntries(R.map(s => [s.id, s]));

  for (const [id, alto, cm, cano] of [
    ["simple", 160, "16 cm", '5/8"'], ["doble", 60, "6 cm", '5/8"'], ["compacta", 55, "5,5 cm", '3/8"']
  ]) {
    chk("Las tres secciones", `${id}: alto en mm`, alto, porId[id].alto);
    chkOk("Las tres secciones", `${id}: se muestra ${cm}`, Ficha.altoEnCm(porId[id].alto) === cm,
          Ficha.altoEnCm(porId[id].alto));
    chkOk("Las tres secciones", `${id}: caño ${cano}`, porId[id].cano === cano);
  }

  // La aleta de 4 mm es sólo de los compactos.
  chk("Las tres secciones", "La separación especial es 4 mm", 4, porId.compacta.separacionEspecial);
  chkOk("Las tres secciones", "Simple y doble no tienen separación especial",
        porId.simple.separacionEspecial === null && porId.doble.separacionEspecial === null);

  // Los productos salen de los perfiles: tienen que coincidir con lo documentado.
  const tiene = (id, pid) => porId[id].productos.some(t => t.startsWith(PERFILES[pid].nombre));
  for (const pid of ["ev", "resp", "fs"]) chkOk("Las tres secciones", `${pid} es simple`, tiene("simple", pid));
  for (const pid of ["fd", "col", "cub", "rcam", "t58", "da", "pt"]) chkOk("Las tres secciones", `${pid} es doble`, tiene("doble", pid));
  for (const pid of ["oli", "fc", "t38", "cond"]) chkOk("Las tres secciones", `${pid} es compacta`, tiene("compacta", pid));

  // Las carniceras cambian de sección según el modelo: van en las dos, con la aclaración.
  chkOk("Las tres secciones", "Carniceras simples aclara el modelo",
        porId.simple.productos.some(t => /carniceras \(3 secciones simples\)/i.test(t)),
        porId.simple.productos.join(" · "));
  chkOk("Las tres secciones", "Carniceras dobles aclara el modelo",
        porId.doble.productos.some(t => /carniceras \(4 secciones dobles\)/i.test(t)),
        porId.doble.productos.join(" · "));

  // Ningún producto con aleta puede quedar afuera de la tarjeta.
  const dentro = new Set(R.flatMap(s => s.productos.map(t => t.replace(/ \(.*\)$/, ""))));
  for (const pid of ORDEN) {
    if (!PERFILES[pid].aleta) continue;
    chkOk("Las tres secciones", `${pid} figura en alguna sección`, dentro.has(PERFILES[pid].nombre));
  }

  // Sale de los perfiles, no de una lista a mano: si cambia la aleta, cambia la tarjeta.
  const inventado = { xx: { id: "xx", nombre: "Producto nuevo", aleta: "doble" } };
  chkOk("Las tres secciones", "Un producto nuevo aparece solo",
        Ficha.referenciaSecciones(PRECIOS, inventado, ["xx"])
          .find(s => s.id === "doble").productos.includes("Producto nuevo"));
}

// ── Huecos del respaldo de cámara ───────────────────────────────────────────
// Pendiente #6. El de 5 secciones dobles salió de la tabla hermana: el lateral doble
// comparte con respaldo de cámara los tres valores que las dos tablas tienen y publica
// 5 → 188. Los de 11, 13 y 14 no tienen dato: se avisa, no se inventan.
{
  const pm = PRECIOS.precioMetro;
  for (const sec of [4, 6, 7]) {
    chk("Huecos rcam", `${sec} dobles vale igual en las dos tablas`,
        pm.lateralDoble[sec], pm.respaldoCamara[sec]);
  }
  chk("Huecos rcam", "El 5 se toma del lateral doble", pm.lateralDoble[5], pm.respaldoCamara[5]);
  chk("Huecos rcam", "5 dobles = $188 por metro", 188, pm.respaldoCamara[5]);

  // 188 × 0,85 + 2×v250 (75) + col/dist 3/4HP (0)
  const c = cotizar(PERFILES.rcam, { enchapado: true, hp: 0.75, secDobles: 5, ancho: 0.85 });
  chk("Huecos rcam", "5 dobles × 0,85m cotiza", 234.80, c.base);
  chkOk("Huecos rcam", "5 dobles ya no avisa", c.avisos.length === 0);

  // Los tres que siguen sin dato tienen que seguir frenando la cotización.
  for (const sec of [11, 13, 14]) {
    const f = cotizar(PERFILES.rcam, { enchapado: true, hp: 2, secDobles: sec, ancho: 1.2 });
    chkOk("Huecos rcam", `${sec} dobles avisa que no hay precio publicado`,
          f.avisos.some(a => a.nivel === "error" && /no hay precio publicado/.test(a.msg)));
  }
  // Sin enchapar no hay tabla: se cotiza por sección doble, así que los huecos no existen.
  chk("Huecos rcam", "11 dobles sin enchapar cotiza igual", 356.80,
      cotizar(PERFILES.rcam, { enchapado: false, hp: 2, secDobles: 11, ancho: 1.2 }).base);
}

// ── Markup por tamaño: tabla del panel, sin estirar el último tramo ──────────
// Pendiente #3: arriba de 16 secciones el markup se estancaba en $12 sin avisar.
{
  chkOk("Markup por tamaño", "La tabla vive en el panel, no en el código",
        Array.isArray(PRECIOS.markupEstatico) && PRECIOS.markupEstatico.length === 7);
  const tope = PRECIOS.markupEstatico[PRECIOS.markupEstatico.length - 1];
  chk("Markup por tamaño", "El último tramo es 20 sec = $16", 20, tope[0]);
  chk("Markup por tamaño", "Importe del último tramo", 16, tope[1]);

  // Los tramos suben de a $2 y no se saltean: la serie no puede quedar rota.
  PRECIOS.markupEstatico.forEach(([, imp], i) => {
    if (i) chk("Markup por tamaño", `El tramo ${i + 1} sube $2`, 2, imp - PRECIOS.markupEstatico[i - 1][1]);
  });

  for (const [sec, esperado] of [[3, 4], [5, 4], [6, 6], [8, 6], [9, 8], [12, 8], [13, 10], [14, 10], [15, 12], [16, 12], [17, 14], [18, 14], [19, 16], [20, 16]]) {
    const m = cotizar(PERFILES.ev, { secciones: sec, ancho: 0.5 }).desglose
      .find(x => x.concepto === "Markup por tamaño");
    chk("Markup por tamaño", `${sec} sec`, esperado, m.importe);
  }

  // Arriba del tope no se estira el importe: avisa, igual que cualquier otra tabla.
  for (const perfil of ["ev", "resp"]) {
    const c = cotizar(PERFILES[perfil], { secciones: 22, ancho: 0.5 });
    chkOk("Markup por tamaño", `${perfil}: 22 sec avisa que falta el tramo`,
          c.avisos.some(a => a.nivel === "error" && /Markup por tamaño/.test(a.msg)));
    chkOk("Markup por tamaño", `${perfil}: 20 sec cotiza sin avisos`,
          cotizar(PERFILES[perfil], { secciones: 20, ancho: 0.5 }).avisos.length === 0);
  }

  // La explicación se arma sola desde la tabla: no puede quedar desactualizada.
  const nota = cotizar(PERFILES.ev, { secciones: 6, ancho: 0.5 }).desglose
    .find(x => x.concepto === "Markup por tamaño").nota;
  chkOk("Markup por tamaño", "La explicación sale de la tabla",
        nota.includes("hasta 5 sec = $4") && nota.includes("19 a 20 sec = $16"), nota);

  // Editarlo desde el panel tiene que cambiar el precio Y la explicación.
  const original = PRECIOS.markupEstatico;
  PRECIOS.markupEstatico = [...original, [24, 18]];
  const c24 = cotizar(PERFILES.ev, { secciones: 22, ancho: 1 });
  const m24 = c24.desglose.find(x => x.concepto === "Markup por tamaño");
  chk("Markup por tamaño", "Con el tramo nuevo, 22 sec cobra $18", 18, m24.importe);
  chkOk("Markup por tamaño", "Con el tramo nuevo ya no avisa por el markup",
        !c24.avisos.some(a => /Markup por tamaño/.test(a.msg)));
  chkOk("Markup por tamaño", "La explicación toma el tramo nuevo", m24.nota.includes("21 a 24 sec = $18"), m24.nota);
  PRECIOS.markupEstatico = original;
  chk("Markup por tamaño", "La tabla vuelve a su lugar", 16,
      cotizar(PERFILES.ev, { secciones: 20, ancho: 0.5 }).desglose
        .find(x => x.concepto === "Markup por tamaño").importe);
}

// ── MercadoLibre ─────────────────────────────────────────────────────────────
// Sólo lo que se arma del lado nuestro. No se llama al endpoint: publicar crea una
// publicación de verdad en la cuenta y eso no se hace desde una suite de tests.
{
  // Peor caso de cada producto: las medidas más grandes que acepta cada rango.
  const peor = {
    ev:{secciones:20,ancho:3}, oli:{secciones:40,ancho:3}, resp:{secciones:20,ancho:3},
    fd:{secciones:7,ancho:1.5}, fs:{secciones:5,ancho:1.5}, fc:{secciones:40,ancho:1.5},
    col:{secDobles:20,ancho:9,uniones:0}, cub:{hp:2.5,bateria:"5F6C",ancho:3},
    rcam:{hp:1.5,secDobles:15,ancho:3}, t58:{hp:0.75,secciones:20,ancho:1,bandeja:1000},
    t38:{hp:0.33,secciones:60,ancho:1,bandeja:800}, car:{dobles:true,ancho:3,cantVent:4},
    da:{secciones:7,ancho:0.8}, pt:{hp:0.75,secciones:4,ancho:2.5}, cond:{hp:0.25}
  };
  let mayor = 0;
  for (const pid of ORDEN) {
    const c = cotizar(PERFILES[pid], { enchapado: true, ...peor[pid] });
    const t = ML.tituloML(pid, c.entrada, PERFILES[pid]);
    mayor = Math.max(mayor, t.length);
    chkOk("MercadoLibre", `${pid} entra en 60`, t.length <= ML.ML.maxTitulo, `${t.length}: ${t}`);
    // ML pausó una publicación por empezar con el modificador: nunca más.
    chkOk("MercadoLibre", `${pid} arranca por el producto`, /^(Evaporador|Condensador)/.test(t), t);
    chkOk("MercadoLibre", `${pid} no arranca con "A Medida"`, !/^A Medida/i.test(t), t);
  }
  chkOk("MercadoLibre", `Peor título de todos: ${mayor} caracteres`, mayor <= 60);

  // La especificación identifica el equipo: HP si lo tiene, medida si no.
  const cub = cotizar(PERFILES.cub, { enchapado: true, hp: 4, bateria: "6F6C", ancho: 1.5 });
  chkOk("MercadoLibre", "Con HP lo usa en el título",
        ML.tituloML("cub", cub.entrada, PERFILES.cub) === "Evaporador Forzado Cúbico 4 Hp A Medida",
        ML.tituloML("cub", cub.entrada, PERFILES.cub));
  const col = cotizar(PERFILES.col, { secDobles: 4, ancho: 1.7, uniones: 0 });
  chkOk("MercadoLibre", "Sin HP usa la medida",
        ML.tituloML("col", col.entrada, PERFILES.col) === "Evaporador Columna Para Batea 4x1,70 Mtrs A Medida",
        ML.tituloML("col", col.entrada, PERFILES.col));
  const car = cotizar(PERFILES.car, { dobles: true, ancho: 2.2, cantVent: 4 });
  chkOk("MercadoLibre", "Carniceras saca las secciones del perfil",
        ML.tituloML("car", car.entrada, PERFILES.car).includes("4x2,20 Mtrs"),
        ML.tituloML("car", car.entrada, PERFILES.car));

  // Validaciones antes de mandar
  chkOk("MercadoLibre", "Frena un título largo", ML.revisar({ titulo: "x".repeat(61), precio: 200000 }).length === 1);
  chkOk("MercadoLibre", "Frena un precio bajo", ML.revisar({ titulo: "ok", precio: 49999 }).length === 1);
  chkOk("MercadoLibre", "Frena un precio alto", ML.revisar({ titulo: "ok", precio: 5000001 }).length === 1);
  chkOk("MercadoLibre", "Deja pasar lo válido", ML.revisar({ titulo: "ok", precio: 200000 }).length === 0);
  chkOk("MercadoLibre", "Frena si no hay precio", ML.revisar({ titulo: "ok", precio: 0 }).length === 1);

  // La descripción lleva el detalle que el título no puede llevar
  const c = cotizar(PERFILES.fd, { enchapado: false, secciones: 7, ancho: 0.55,
    colector: 45.50, excluidos: ["Costados de aluminio"] });
  const d = ML.descripcionML(PERFILES.fd, c, new Date("2026-08-27T20:46:00-03:00"));
  chkOk("MercadoLibre", "La descripción trae el producto y la medida",
        d.includes("Forzador lateral doble") && d.includes("7 secciones x 0,55m"), d.split("\n")[1]);
  chkOk("MercadoLibre", "Trae las aclaraciones", d.includes("Sin enchapar") && d.includes("colector"));
  chkOk("MercadoLibre", "Avisa lo que no incluye", d.includes("No incluye costados de aluminio"));
  chkOk("MercadoLibre", "Trae el plazo de fabricación", d.includes("2 a 3 días"));
  chkOk("MercadoLibre", "Trae el vencimiento", d.includes("27/08/2026") && d.includes("20:46"));
}

// ── Respuestas del bot ───────────────────────────────────────────────────────
// Con fetch simulado: nunca se toca el servidor real desde los tests.
{
  const fetchReal = globalThis.fetch;
  const simular = (status, cuerpo) => {
    globalThis.fetch = async () => ({ status, json: async () => cuerpo });
  };
  const correr = async () => ML.publicar(
    { titulo: "A MEDIDA - FORZADOR LATERAL", descripcion: "x", precio: 200000, clave_idempotencia: "cot-1" },
    "clave-de-prueba");

  const casos = [];
  simular(200, { ok: true, item_id: "MLA123", titulo: "A Medida - Forzador Lateral",
                 link: "https://x/MLA123", precio: 200000, pausa_programada: "2026-08-27T20:46:04-03:00" });
  casos.push(["200 devuelve el link y el id", await correr(), r => r.ok && r.link === "https://x/MLA123" && r.item_id === "MLA123"]);

  simular(409, { ok: false, error: "Ya publicaste eso hace 2 min", item_id: "MLA999", link: "https://x/MLA999" });
  casos.push(["409 conserva el link del duplicado", await correr(), r => !r.ok && r.codigo === 409 && r.link === "https://x/MLA999"]);

  simular(401, { ok: false, error: "Clave incorrecta." });
  casos.push(["401 marca el código para pedir otra clave", await correr(), r => !r.ok && r.codigo === 401]);

  simular(400, { ok: false, error: "El título tiene 63 caracteres y el máximo es 60." });
  casos.push(["400 devuelve el texto listo para mostrar", await correr(), r => !r.ok && r.error.includes("63 caracteres")]);

  globalThis.fetch = async () => { throw new Error("sin red"); };
  casos.push(["Sin conexión avisa que se puede reintentar", await correr(), r => !r.ok && /reintentar|conexión/i.test(r.error)]);

  globalThis.fetch = fetchReal;
  for (const [nombre, r, ok] of casos) chkOk("Respuestas del bot", nombre, ok(r), JSON.stringify(r).slice(0, 90));
}

// ── Ficha técnica ────────────────────────────────────────────────────────────
{
  const dat = (pid, e) => Ficha.datos(PERFILES[pid], cotizar(PERFILES[pid], { enchapado: true, ...e }));

  // Contra la tabla de referencia del cúbico 3HP
  // A medida y enchapado: sólo hay batería, sin secDobles. La ficha tiene que salir igual.
  const c3 = dat("cub", { hp: 3, bateria: "5F6C", ancho: 1.40 });
  chkOk("Ficha técnica", "Cúbico a medida deduce los caños de la batería", c3.canos === 30, String(c3.canos));
  chk("Ficha técnica", "Cúbico 3HP — frigorías", 5670, c3.frigorias);
  chk("Ficha técnica", "Cúbico 3HP — watts", 6600, c3.watts);
  chk("Ficha técnica", "Cúbico 3HP — caños", 30, c3.canos);
  chkOk("Ficha técnica", "Cúbico 3HP — superficie 30,2 m²", Math.abs(c3.superficie - 30.24) < 0.01, String(c3.superficie));

  const c4 = dat("cub", { hp: 4, bateria: "6F6C", ancho: 1.50 });
  chk("Ficha técnica", "Cúbico 4HP — frigorías", 7560, c4.frigorias);
  chk("Ficha técnica", "Cúbico 4HP — watts", 8800, c4.watts);
  chk("Ficha técnica", "Cúbico 4HP — motores", 3, c4.motores);
  chkOk("Ficha técnica", "Cúbico 4HP — Ø300, no Ø350", c4.motor === "300", c4.motor);

  // Compactos: el HP sale de la tabla de secciones
  const comp = dat("fc", { secciones: 12, ancho: 0.36 });
  chk("Ficha técnica", "Compacto 12 sec = 1/2HP", 945, comp.frigorias);
  chkOk("Ficha técnica", "Compacto usa caño 3/8\"", comp.cano === '3/8"');
  chk("Ficha técnica", "Compacto — separación 8 mm", 8, comp.separacion);
  const fina = dat("fc", { secciones: 12, ancho: 0.36, aletaFina: true });
  chk("Ficha técnica", "Aleta de 4 mm duplica la superficie", r2(comp.superficie * 2), r2(fina.superficie));
  chkOk("Ficha técnica", "Fuera de la tabla no inventa HP", dat("fc", { secciones: 14, ancho: 0.36 }).frigorias === null);

  // Cada producto con su aleta
  const aletas = { ev:"simple", oli:"compacta", resp:"simple", fd:"doble", fs:"simple",
    fc:"compacta", col:"doble", cub:"doble", rcam:"doble", t58:"doble", t38:"compacta",
    da:"doble", pt:"doble", cond:"compacta" };
  for (const [pid, esperada] of Object.entries(aletas)) {
    chkOk("Ficha técnica", `${pid} lleva aleta ${esperada}`,
          Ficha.tipoAleta(PERFILES[pid], {}) === esperada, Ficha.tipoAleta(PERFILES[pid], {}));
  }
  chkOk("Ficha técnica", "Carniceras simples llevan aleta simple", Ficha.tipoAleta(PERFILES.car, { dobles: false }) === "simple");
  chkOk("Ficha técnica", "Carnicera Mod.154 lleva aleta doble", Ficha.tipoAleta(PERFILES.car, { dobles: true }) === "doble");

  // El condensador no tiene medida: sale sin superficie pero con frigorías
  const cond = dat("cond", { hp: 0.5 });
  chkOk("Ficha técnica", "Condensador sin superficie pero con frigorías",
        cond.superficie === null && cond.frigorias === 945);

  // HP cargado a mano: completa la ficha de los productos que no lo tienen
  const sinHP = cotizar(PERFILES.fd, { enchapado: true, secciones: 4, ancho: 0.5 });
  chkOk("Ficha técnica", "El lateral doble avisa que le falta el HP", Ficha.faltaHP(PERFILES.fd, sinHP));
  const conHP = Ficha.datos(PERFILES.fd, sinHP, PRECIOS, 0.5);
  chk("Ficha técnica", "Con 1/2HP a mano da 945 frigorías", 945, conHP.frigorias);
  chk("Ficha técnica", "Y 1.100 watts", 1100, conHP.watts);
  chkOk("Ficha técnica", "La superficie no cambia por el HP",
        conHP.superficie === Ficha.datos(PERFILES.fd, sinHP).superficie);
  chkOk("Ficha técnica", "El título del texto incluye el HP a mano",
        Ficha.texto(PERFILES.fd, sinHP, PRECIOS, 0.5).startsWith('*Forzador lateral doble 5/8" 1/2HP'));
  chkOk("Ficha técnica", "Los que ya traen HP no lo piden",
        !Ficha.faltaHP(PERFILES.cub, cotizar(PERFILES.cub, { enchapado: true, hp: 2, bateria: "5F6C", ancho: 0.9 })));
  chkOk("Ficha técnica", "El compacto con secciones de tabla tampoco lo pide",
        !Ficha.faltaHP(PERFILES.fc, cotizar(PERFILES.fc, { enchapado: true, secciones: 12, ancho: 0.36 })));
  chkOk("Ficha técnica", "El compacto fuera de tabla sí lo pide",
        Ficha.faltaHP(PERFILES.fc, cotizar(PERFILES.fc, { enchapado: true, secciones: 14, ancho: 0.36 })));

  // El texto va en formato WhatsApp: negritas, no columnas con espacios
  const t = Ficha.texto(PERFILES.cub, cotizar(PERFILES.cub, { enchapado: true, hp: 4, bateria: "6F6C", ancho: 1.5 }));
  chkOk("Ficha técnica", "El texto usa negritas de WhatsApp", t.includes("*Potencia Sugerida:* 4 HP"), t.split("\n")[2]);
  chkOk("Ficha técnica", "No alinea con espacios", !/ {3}/.test(t));
  chkOk("Ficha técnica", "Ninguna línea pasa de 60 caracteres",
        t.split("\n").every(l => l.length <= 60), String(Math.max(...t.split("\n").map(l => l.length))));

  // Los 15 productos: o dan ficha o la niegan, nunca a medias
  const casos = { ev:{secciones:6,ancho:0.5}, oli:{secciones:12,ancho:0.5}, resp:{secciones:9,ancho:0.6},
    fd:{secciones:4,ancho:0.5}, fs:{secciones:4,ancho:0.5}, fc:{secciones:12,ancho:0.36},
    col:{secDobles:4,ancho:2.3}, cub:{hp:4,bateria:"6F6C",ancho:1.5}, rcam:{hp:3,secDobles:15,ancho:1.4},
    t58:{hp:0.75,secciones:8,ancho:0.35,bandeja:1000}, t38:{hp:0.5,secciones:24,ancho:0.33,bandeja:800},
    car:{dobles:true,ancho:2.2,cantVent:4}, da:{secciones:6,ancho:0.6},
    pt:{hp:0.5,secciones:3,ancho:1.25}, cond:{hp:0.5} };
  for (const pid of ORDEN) {
    const c = cotizar(PERFILES[pid], { enchapado: true, ...casos[pid] });
    const f = Ficha.filas(PERFILES[pid], c);
    const d = f && Ficha.datos(PERFILES[pid], c);
    chkOk("Ficha técnica", `${pid} arma su ficha`, Array.isArray(f) && f.length >= 4, f ? `${f.length} filas` : "null");
    // Los que tienen HP tienen que traer frigorías y watts; los que no, la geometría.
    if (d && d.hp) chkOk("Ficha técnica", `${pid} con HP trae frigorías y watts`, !!(d.frigorias && d.watts));
    else if (d) chkOk("Ficha técnica", `${pid} sin HP igual trae la superficie`, d.superficie > 0, String(d.superficie));
  }
}

// ── Coma o punto ─────────────────────────────────────────────────────────────
// El teclado del iPhone en español escribe coma; hay que aceptar las dos.
{
  const casos = [["0,50", 0.5], ["0.50", 0.5], ["3,70", 3.7], ["12", 12], [" 1,25 ", 1.25],
                 ["", null], ["abc", null], [null, null], ["0", 0]];
  for (const [entrada, esperado] of casos) {
    chkOk("Coma o punto", `"${entrada}" → ${esperado}`, leerNumero(entrada) === esperado, String(leerNumero(entrada)));
  }
  const conComa = cotizar(PERFILES.ev, { secciones: 6, ancho: leerNumero("0,50") });
  const conPunto = cotizar(PERFILES.ev, { secciones: 6, ancho: leerNumero("0.50") });
  chk("Coma o punto", "Cotizar con coma da lo mismo que con punto", conPunto.base, conComa.base);
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

  // El link de MercadoLibre se le pega a la cotización que ya estaba registrada.
  H.vaciar(K);
  H.registrar({ fecha: new Date().toISOString(), texto: "x", lineas: [], embalaje: 0,
                usd: 100, columnas: [], claveML: "cot-abc" }, K);
  const pegado = H.actualizarPorClave("cot-abc", { mlLink: "https://x/MLA1", mlItemId: "MLA1" }, K);
  chkOk("Historial", "El link se pega a la entrada que corresponde", pegado?.mlLink === "https://x/MLA1");
  chkOk("Historial", "No duplica la entrada", H.leer(K).length === 1);
  chkOk("Historial", "Con una clave que no existe no rompe ni inventa",
        H.actualizarPorClave("cot-inexistente", { mlLink: "x" }, K) === null && H.leer(K).length === 1);
  chkOk("Historial", "Sin clave tampoco hace nada", H.actualizarPorClave(null, { mlLink: "x" }, K) === null);

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
  const fijos = { 0.25: 64.80, 0.33: 92.20, 0.5: 119.60, 0.75: 204.50, 1: 266 };
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
