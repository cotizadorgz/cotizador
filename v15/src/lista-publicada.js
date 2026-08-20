// Valores publicados. Fuente: LISTA DE PRECIOS MAYO 2026 v3 + tablas de la v14.
// Este archivo es el contrato: si el motor no reproduce estos números, el motor está mal.
// Lo usan la suite de regresión y el panel de precios, para avisar cuando una edición
// deja de coincidir con la lista impresa.

export const FD_CC = {
  2: { 0.40: 70.70, 0.45: 74.85, 0.50: 79.00, 0.55: 83.15, 0.60: 87.30 },
  3: { 0.40: 87.90, 0.45: 94.20, 0.50: 100.50, 0.55: 106.80, 0.60: 113.10 },
  4: { 0.40: 99.90, 0.45: 107.70, 0.50: 115.50, 0.55: 123.30, 0.60: 131.10 },
  5: { 0.40: 112.70, 0.45: 122.10, 0.50: 131.50, 0.55: 140.90, 0.60: 150.30 },
  6: { 0.40: 124.70, 0.45: 135.60, 0.50: 146.50, 0.55: 157.40, 0.60: 168.30 },
  7: { 0.40: 136.70, 0.45: 149.10, 0.50: 161.50, 0.55: 173.90, 0.60: 186.30 }
};

// Tabla presente en la v14 pero nunca usada por el código. Sirve para dirimir
// la pregunta abierta #2: ¿el lateral doble sin enchapar va a $30 o a $24 por sección?
export const FD_SC = {
  2: { 0.40: 27.20, 0.45: 29.60, 0.50: 32.00, 0.55: 34.40, 0.60: 36.80 },
  3: { 0.40: 36.80, 0.45: 40.40, 0.50: 44.00, 0.55: 47.60, 0.60: 51.20 },
  4: { 0.40: 46.40, 0.45: 51.20, 0.50: 56.00, 0.55: 60.80, 0.60: 65.60 },
  5: { 0.40: 56.00, 0.45: 62.00, 0.50: 68.00, 0.55: 74.00, 0.60: 80.00 },
  6: { 0.40: 69.60, 0.45: 76.80, 0.50: 84.00, 0.55: 91.20, 0.60: 98.40 },
  7: { 0.40: 79.20, 0.45: 87.60, 0.50: 96.00, 0.55: 104.40, 0.60: 112.80 }
};

export const FS_CC = {
  2: { 0.40: 79.50, 0.45: 84.75, 0.50: 90.00, 0.55: 95.25, 0.60: 100.50 },
  3: { 0.40: 93.10, 0.45: 100.05, 0.50: 107.00, 0.55: 113.95, 0.60: 120.90 },
  4: { 0.40: 114.30, 0.45: 123.90, 0.50: 133.50, 0.55: 143.10, 0.60: 152.70 },
  5: { 0.40: 127.10, 0.45: 138.30, 0.50: 149.50, 0.55: 160.70, 0.60: 171.90 }
};

export const FS_SC = {
  2: { 0.40: 32.00, 0.45: 35.00, 0.50: 38.00, 0.55: 41.00, 0.60: 44.00 },
  3: { 0.40: 44.00, 0.45: 48.50, 0.50: 53.00, 0.55: 57.50, 0.60: 62.00 },
  4: { 0.40: 56.00, 0.45: 62.00, 0.50: 68.00, 0.55: 74.00, 0.60: 80.00 },
  5: { 0.40: 68.00, 0.45: 75.50, 0.50: 83.00, 0.55: 90.50, 0.60: 98.00 }
};

export const CUB = [
  { et: "3/4HP — 3F4C x0,85m", hp: 0.75, bateria: "3F4C", secDobles: 6,  ancho: 0.85, cc: 263.70,  sc: 132.40 },
  { et: "1HP — 4F4C x0,85m",   hp: 1,    bateria: "4F4C", secDobles: 8,  ancho: 0.85, cc: 314.70,  sc: 173.20 },
  { et: "1,5HP — 4F6C x0,8m",  hp: 1.5,  bateria: "4F6C", secDobles: 12, ancho: 0.80, cc: 436.00,  sc: 240.40 },
  { et: "2HP — 5F6C x0,9m",    hp: 2,    bateria: "5F6C", secDobles: 15, ancho: 0.90, cc: 578.70,  sc: 374.00 },
  { et: "2,5HP — 5F6C x1,05m", hp: 2.5,  bateria: "5F6C", secDobles: 15, ancho: 1.05, cc: 648.15,  sc: 428.00 },
  { et: "3HP — 5F6C x1,4m",    hp: 3,    bateria: "5F6C", secDobles: 15, ancho: 1.40, cc: 886.20,  sc: 564.00 },
  { et: "4HP — 6F6C x1,5m",    hp: 4,    bateria: "6F6C", secDobles: 18, ancho: 1.50, cc: 1058.50, sc: 708.00 },
  { et: "5HP — 6F6C x1,9m",    hp: 5,    bateria: "6F6C", secDobles: 18, ancho: 1.90, cc: 1348.30, sc: 885.80 },
  { et: "6HP — 6F6C x2,2m",    hp: 6,    bateria: "6F6C", secDobles: 18, ancho: 2.20, cc: 1583.40, sc: 1020.40 }
];

export const RCAM = [
  { et: "1/2HP mini — 4 dobles x1,0m", hp: 0.5,  secDobles: 4,  ancho: 1.00, cc: 231.00, sc: 106.00 },
  { et: "3/4HP — 6 dobles x0,85m",     hp: 0.75, secDobles: 6,  ancho: 0.85, cc: 260.30, sc: 132.40 },
  { et: "1HP — 7 dobles x0,95m",       hp: 1,    secDobles: 7,  ancho: 0.95, cc: 310.60, sc: 169.60 },
  { et: "1HP — 10 dobles x0,7m",       hp: 1,    secDobles: 10, ancho: 0.70, cc: 312.30, sc: 178.00 },
  { et: "1,5HP — 10 dobles x0,98m",    hp: 1.5,  secDobles: 10, ancho: 0.98, cc: 464.22, sc: 245.20 },
  // Lista publicada: 588,80. La fórmula sola da 568,80 — la diferencia va como ajuste nombrado.
  { et: "2HP — 10 dobles x1,2m",       hp: 2,    secDobles: 10, ancho: 1.20, cc: 588.80, sc: 328.00 },
  { et: "3HP — 15 dobles x1,4m",       hp: 3,    secDobles: 15, ancho: 1.40, cc: 891.80, sc: 554.00 }
];

export const T58 = [
  { et: "1/3HP — 6 sec x0,35m x800mm",  secciones: 6,  ancho: 0.35, bandeja: 800,  cc: 147.40 },
  { et: "1/2HP — 6 sec x0,35m x800mm",  secciones: 6,  ancho: 0.35, bandeja: 800,  cc: 147.40 },
  { et: "3/4HP — 8 sec x0,35m x1000mm", secciones: 8,  ancho: 0.35, bandeja: 1000, cc: 172.45 },
  { et: "1HP — 10 sec x0,35m x1000mm",  secciones: 10, ancho: 0.35, bandeja: 1000, cc: 189.25 }
];

export const T38 = [
  { et: "1/3HP — 16 sec x0,33m x800mm",  secciones: 16, ancho: 0.33, bandeja: 800,  cc: 232.60 },
  { et: "1/2HP — 24 sec x0,33m x800mm",  secciones: 24, ancho: 0.33, bandeja: 800,  cc: 285.40 },
  { et: "3/4HP — 32 sec x0,33m x1000mm", secciones: 32, ancho: 0.33, bandeja: 1000, cc: 346.45 },
  { et: "1HP — 40 sec x0,33m x1000mm",   secciones: 40, ancho: 0.33, bandeja: 1000, cc: 399.25 }
];

export const CAR = [
  { et: "Mod.73 — 1/2HP — 3 sec x1,2m",  dobles: false, ancho: 1.20, cantVent: 2, cc: 241.80 },
  { et: "Mod.93 — 3/4HP — 3 sec x1,4m",  dobles: false, ancho: 1.40, cantVent: 2, cc: 269.60 },
  { et: "Mod.104 — 3/4HP — 3 sec x1,6m", dobles: false, ancho: 1.60, cantVent: 2, cc: 297.40 },
  { et: "Mod.124 — 1HP — 3 sec x1,8m",   dobles: false, ancho: 1.80, cantVent: 3, cc: 362.70 },
  { et: "Mod.154 — 1,5HP — 4 sec x2,2m", dobles: true,  ancho: 2.20, cantVent: 4, cc: 493.20 }
];

// La lista dice "3x200" pero el precio publicado es el de 2 ventiladores.
export const PT = [
  { et: "1/2HP — 3 sec x1,25m", secciones: 3, ancho: 1.25, cc: 196.25 }
];
