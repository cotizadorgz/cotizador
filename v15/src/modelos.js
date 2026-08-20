// Catálogo de modelos publicados. Es lo que la app ofrece en el desplegable cuando
// el cliente pide "un cúbico de 2HP". El ancho de cada modelo es el de la BATERÍA,
// que es el que usa la fórmula — no el de la columna ANCHO de la lista, que es el
// gabinete. Fuera de estos modelos se cotiza en modo libre, pidiendo el ancho de batería.

export const MODELOS = {
  cub: [
    { et: "3/4HP — 3F4C",  hp: 0.75, bateria: "3F4C", secDobles: 6,  ancho: 0.85 },
    { et: "1HP — 4F4C",    hp: 1,    bateria: "4F4C", secDobles: 8,  ancho: 0.85 },
    { et: "1,5HP — 4F6C",  hp: 1.5,  bateria: "4F6C", secDobles: 12, ancho: 0.80 },
    { et: "2HP — 5F6C",    hp: 2,    bateria: "5F6C", secDobles: 15, ancho: 0.90 },
    { et: "2,5HP — 5F6C",  hp: 2.5,  bateria: "5F6C", secDobles: 15, ancho: 1.05 },
    { et: "3HP — 5F6C",    hp: 3,    bateria: "5F6C", secDobles: 15, ancho: 1.40 },
    { et: "4HP — 6F6C",    hp: 4,    bateria: "6F6C", secDobles: 18, ancho: 1.50 },
    { et: "5HP — 6F6C",    hp: 5,    bateria: "6F6C", secDobles: 18, ancho: 1.90 },
    { et: "6HP — 6F6C",    hp: 6,    bateria: "6F6C", secDobles: 18, ancho: 2.20 }
  ],
  rcam: [
    { et: "1/2HP mini — 4 dobles", hp: 0.5,  secDobles: 4,  ancho: 1.00 },
    { et: "3/4HP — 6 dobles",      hp: 0.75, secDobles: 6,  ancho: 0.85 },
    { et: "1HP — 7 dobles",        hp: 1,    secDobles: 7,  ancho: 0.95 },
    { et: "1HP — 10 dobles",       hp: 1,    secDobles: 10, ancho: 0.70 },
    { et: "1,5HP — 10 dobles",     hp: 1.5,  secDobles: 10, ancho: 0.98 },
    { et: "2HP — 10 dobles",       hp: 2,    secDobles: 10, ancho: 1.20 },
    { et: "3HP — 15 dobles",       hp: 3,    secDobles: 15, ancho: 1.40 }
  ],
  // La lista publica los dos primeros juntos como "1/3-1/2 HP": valen igual.
  t58: [
    { et: "1/3HP",  hp: 0.33, secciones: 6,  ancho: 0.35, bandeja: 800 },
    { et: "1/2HP",  hp: 0.5,  secciones: 6,  ancho: 0.35, bandeja: 800 },
    { et: "3/4HP",  hp: 0.75, secciones: 8,  ancho: 0.35, bandeja: 1000 },
    { et: "1HP",    hp: 1,    secciones: 10, ancho: 0.35, bandeja: 1000 }
  ],
  t38: [
    { et: "1/3HP",  hp: 0.33, secciones: 16, ancho: 0.33, bandeja: 800 },
    { et: "1/2HP",  hp: 0.5,  secciones: 24, ancho: 0.33, bandeja: 800 },
    { et: "3/4HP",  hp: 0.75, secciones: 32, ancho: 0.33, bandeja: 1000 },
    { et: "1HP",    hp: 1,    secciones: 40, ancho: 0.33, bandeja: 1000 }
  ],
  car: [
    { et: "Mod.73 — 1/2HP",  modelo: "Mod.73",  dobles: false, ancho: 1.20, cantVent: 2 },
    { et: "Mod.93 — 3/4HP",  modelo: "Mod.93",  dobles: false, ancho: 1.40, cantVent: 2 },
    { et: "Mod.104 — 3/4HP", modelo: "Mod.104", dobles: false, ancho: 1.60, cantVent: 2 },
    { et: "Mod.124 — 1HP",   modelo: "Mod.124", dobles: false, ancho: 1.80, cantVent: 3 },
    { et: "Mod.154 — 1,5HP", modelo: "Mod.154", dobles: true,  ancho: 2.20, cantVent: 4 }
  ],
  pt: [
    { et: "1/3HP — 0,80m",  hp: 0.33, secciones: 3, ancho: 0.80 },
    { et: "1/3HP — 0,90m",  hp: 0.33, secciones: 3, ancho: 0.90 },
    { et: "1/3HP — 1,00m",  hp: 0.33, secciones: 3, ancho: 1.00 },
    { et: "1/3HP — 1,10m",  hp: 0.33, secciones: 3, ancho: 1.10 },
    { et: "1/2HP — 1,20m",  hp: 0.5,  secciones: 3, ancho: 1.20 },
    { et: "1/2HP — 1,25m",  hp: 0.5,  secciones: 3, ancho: 1.25 },
    { et: "1/2HP — 1,30m",  hp: 0.5,  secciones: 3, ancho: 1.30 },
    { et: "1/2HP — 1,50m",  hp: 0.5,  secciones: 3, ancho: 1.50 },
    { et: "3/4HP — 1,60m",  hp: 0.75, secciones: 3, ancho: 1.60 },
    { et: "3/4HP — 1,70m",  hp: 0.75, secciones: 3, ancho: 1.70 }
  ]
};

// Productos que además del catálogo aceptan medida libre. En modo libre el campo
// de ancho pide siempre el ancho de BATERÍA.
export const ACEPTA_LIBRE = ["cub", "rcam", "t58", "t38", "car", "pt"];
