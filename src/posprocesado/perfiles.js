// Kinhold — perfiles gráficos y gradación de color (lógica pura, sin three.js: se prueba en Node).
//
// valravnx, 4 nov: seis perfiles, de móvil de gama baja a PC de gama alta, con el posprocesado del estilo:
// oclusión ambiental (rincones y contactos), mapeo tonal (paso de luz a sombra), gradación de color (identidad del
// mundo), brillo moderado (las luces se difuminan), niebla (profundidad), desenfoque puntual (solo en escenas
// concretas) y haces de luz (opcionales). Antes de construirlo se miró cómo lo hacen otros: en three.js, la librería
// «postprocessing» junta los efectos en una sola pasada (menos dibujos de pantalla completa, que es lo que cuesta en el
// móvil) y «n8ao» da la oclusión ambiental más barata y limpia que hay para three.js, con media resolución y modos de
// calidad. Esas dos, con versión fija (package.json).
//
// GDD (apartado 3): ningún ajuste gráfico esconde ni cambia lo que importa para jugar. Por eso la niebla (lo lejos que
// se ve) y el mundo que se dibuja son los mismos en los seis: lo que cambia es la calidad de lo que ya se ve. El
// desenfoque de profundidad nunca está puesto mientras se juega (solo en escenas concretas: el visor del personaje, una
// vista de cerca). El de maqueta (12 nov, a prueba; src/posprocesado/maqueta.js) va por la altura en la pantalla, deja
// nítida la franja del centro y se quita en Ajustes: lo llevan los perfiles con «desenfoque».

// Cada perfil:
//   res: resolución del dibujo respecto a la pantalla (tope; con el aparato que tenga menos, la del aparato)
//   sombras: lado del mapa de sombras del sol (px); blandas: sombras de borde suave
//   ao: modo de calidad de n8ao (null: sin oclusión ambiental); aoMedia: a media resolución
//   brillo: niveles del brillo de las luces (null: sin brillo)
//   rayos: muestras de los haces de luz (null: sin haces)
//   suavizado: 'ninguno' | 'smaa-bajo' | 'smaa-medio' | 'smaa-alto' | 'msaa-4' | 'msaa-8'
//   desenfoque: si se puede usar el desenfoque puntual
//   objetivo: fotogramas por segundo a los que apunta (GDD: 30 en Android de gama media, 60 en PC)
//   naturaleza (valravnx, 11 nov: «¿por qué has dejado el modelo hiperlowpoly en gráficos máximos?»): hasta qué
//     distancia (m) los árboles, las matas y las rocas de Meshy van con su modelo de cerca, con textura (cerca), y hasta
//     cuál con el de más detalle (alto, 0: nunca); más allá, el de media distancia y el de lejos (src/mundo/naturaleza_meshy.js)
//   horizonte (valravnx, 5 nov): la isla entera, basta, detrás del terreno de cerca (src/mundo/horizonte.js); paso:
//     cada cuántos 100 m va un punto (4: cada 400 m, 2: cada 200, 1: cada 100). null: solo el terreno de cerca
export const PERFILES = [
  { id: 'movil-1', nombre: 'Móvil básico', res: 0.75, sombras: 512, blandas: false, ao: null, aoMedia: true, brillo: null, rayos: null, suavizado: 'ninguno', desenfoque: false, naturaleza: { cerca: 12, alto: 0 }, objetivo: 30 },
  { id: 'movil-2', nombre: 'Móvil medio', res: 1, sombras: 1024, blandas: false, ao: 'Performance', aoMedia: true, brillo: 4, rayos: null, suavizado: 'smaa-bajo', desenfoque: true, naturaleza: { cerca: 16, alto: 0 }, objetivo: 30 },
  { id: 'movil-3', nombre: 'Móvil alto y tableta', res: 1.5, sombras: 1024, blandas: true, ao: 'Low', aoMedia: true, brillo: 6, rayos: null, suavizado: 'smaa-medio', desenfoque: true, naturaleza: { cerca: 22, alto: 8 }, objetivo: 30, horizonte: { paso: 2 } },
  { id: 'pc-1', nombre: 'PC básico', res: 1, sombras: 2048, blandas: true, ao: 'Medium', aoMedia: true, brillo: 6, rayos: 32, suavizado: 'smaa-alto', desenfoque: true, naturaleza: { cerca: 24, alto: 8 }, objetivo: 60, horizonte: { paso: 2 } },
  { id: 'pc-2', nombre: 'PC medio', res: 1.5, sombras: 2048, blandas: true, ao: 'High', aoMedia: false, brillo: 8, rayos: 60, suavizado: 'msaa-4', desenfoque: true, naturaleza: { cerca: 40, alto: 16 }, objetivo: 60, horizonte: { paso: 2 } },
  { id: 'pc-3', nombre: 'PC alto', res: 2, sombras: 4096, blandas: true, ao: 'Ultra', aoMedia: false, brillo: 8, rayos: 90, suavizado: 'msaa-8', desenfoque: true, naturaleza: { cerca: 60, alto: 30 }, objetivo: 60, horizonte: { paso: 1 } },
];
export const perfil = (id) => PERFILES.find(p => p.id === id) || PERFILES[2];

// Lo mismo en todos los perfiles (lo que importa para jugar y la identidad del mundo): la niebla, el mapeo tonal y la
// gradación de color. Los dos últimos van en la misma pasada, así que en el móvil básico no cuestan casi nada.
export const COMUN = { niebla: [45, 130], tono: true, color: true };
// Con horizonte, la niebla de cerca es la misma hasta que llega a «tope» (de ahí no pasa: si llegara a 1 taparía las
// montañas) y lo lejano se va fundiendo con el cielo de detrás hacia «max»: lo que falta, la mitad cada «lejos» metros
// (de verdad). Sin horizonte, como siempre. Lo que cambia, por tanto: más allá de unos 420 m de ti (la niebla del juego
// va de 110 a 700) se ve algo más, y a lo lejos, las montañas.
export const HORIZONTE = { tope: 0.3, max: 0.85, lejos: 10000 };

// Los efectos, en el orden de la tabla de valravnx, con lo que hace cada uno (para la interfaz)
export const EFECTOS = [
  { id: 'ao', nombre: 'Oclusión ambiental', que: 'oscurece rincones, uniones y contactos' },
  { id: 'tono', nombre: 'Mapeo tonal', que: 'el paso entre luces y sombras' },
  { id: 'color', nombre: 'Gradación de color', que: 'la identidad cromática del mundo' },
  { id: 'brillo', nombre: 'Brillo de las luces', que: 'difumina las fuentes de luz' },
  { id: 'niebla', nombre: 'Niebla', que: 'profundidad y distancia' },
  { id: 'desenfoque', nombre: 'Desenfoque', que: 'solo en escenas concretas' },
  { id: 'rayos', nombre: 'Haces de luz', que: 'opcionales, a contraluz' },
];

// Qué efectos lleva un perfil (los interruptores de la prueba empiezan así)
export function efectosDe(p) {
  return { ao: !!p.ao, tono: COMUN.tono, color: COMUN.color, brillo: !!p.brillo, niebla: true, desenfoque: false, rayos: !!p.rayos };
}

// ---------- Gradación de color ----------
// La identidad cromática del estilo v5 (realismo en miniatura, paleta apagada y natural): sombras un poco frías y
// luces un poco cálidas (como la luz de mañana y de tarde de la prueba), algo menos de saturación en los verdes y
// azules para que nada chille, y un poco de contraste en los medios. Trabaja en sRGB, de 0 a 1, como la tabla de
// búsqueda (LUT) que la aplica.
// 12 nov (el aspecto de maqueta: la referencia es más viva y contrastada que la v5): más contraste, luces más cálidas
// y los colores con su fuerza (los verdes, un punto menos que el resto, para que la hierba no chille).
export const GRADACION = { frias: [-0.014, 0.0, 0.028], calidas: [0.042, 0.018, -0.03], sat: 1.05, satVerdes: 0.97, contraste: 1.08 };
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const recorta = (v) => Math.min(1, Math.max(0, v));
export function gradar(r, g, b, G = GRADACION) {
  const l = lum(r, g, b);
  // saturación: menos en los tonos verdes y azules (donde g o b mandan)
  const verde = Math.max(0, Math.min(1, (Math.max(g, b) - r) * 3));
  const s = G.sat + (G.satVerdes - G.sat) * verde;
  r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
  // contraste suave alrededor del gris medio (en sRGB)
  r = 0.5 + (r - 0.5) * G.contraste; g = 0.5 + (g - 0.5) * G.contraste; b = 0.5 + (b - 0.5) * G.contraste;
  // sombras frías y luces cálidas, más fuerte cuanto más lejos del medio
  const sombra = Math.max(0, 1 - l * 2), luz = Math.max(0, l * 2 - 1);
  r += G.frias[0] * sombra + G.calidas[0] * luz;
  g += G.frias[1] * sombra + G.calidas[1] * luz;
  b += G.frias[2] * sombra + G.calidas[2] * luz;
  return [recorta(r), recorta(g), recorta(b)];
}
// Rellena los datos de una tabla neutra (RGBA, lado n, el orden de la librería: r + g·n + b·n²) con la gradación.
export function rellenarTabla(datos, n, G = GRADACION) {
  for (let i = 0; i < datos.length; i += 4) {
    const [r, g, b] = gradar(datos[i], datos[i + 1], datos[i + 2], G);
    datos[i] = r; datos[i + 1] = g; datos[i + 2] = b;
  }
  return datos;
}

// ---------- El perfil de inicio ----------
// Por lo que se sabe del aparato antes de dibujar nada (provisional: luego manda la medida).
// info: { tactil, memoria (GB, navigator.deviceMemory), nucleos, grafica (texto de la tarjeta, si lo da), ancho, alto, dpr }
export function sugerirPerfil(info = {}) {
  const g = String(info.grafica || '').toLowerCase();
  const nucleos = info.nucleos || 4, memoria = info.memoria || 4;
  // sin tarjeta gráfica (el dibujo lo hace el procesador: SwiftShader, llvmpipe), lo más barato que hay
  if (/swiftshader|llvmpipe|software/.test(g)) return 'movil-1';
  if (info.tactil) {
    // móvil o tableta: las gráficas buenas de móvil se reconocen por su nombre
    const buena = /adreno \(tm\) (7[3-9]\d|8\d\d)|adreno.*\b(7[3-9]\d|8\d\d)\b|apple|mali-g7[1-9]|mali-g[89]\d|immortalis|xclipse/.test(g);
    if (buena && memoria >= 6) return 'movil-3';
    if (memoria <= 3 || nucleos <= 4 || /mali-t|mali-g(5|3)\d|adreno.*\b[3-5]\d\d\b|powervr/.test(g)) return 'movil-1';
    return 'movil-2';
  }
  if (/rtx|radeon rx [67]\d\d\d|rx 9\d\d\d|apple m[2-9]/.test(g)) return 'pc-3';
  if (/intel|uhd|iris|vega|radeon\(tm\) graphics/.test(g)) return 'pc-1';
  return 'pc-2';
}

// Por la medida: el perfil más alto que llega a su objetivo, con margen. medidas: { id: ms por fotograma }.
// tactil: solo entre los de móvil (un móvil no pasa a los de PC aunque llegue a 30 en ellos); sin él, todos.
export function elegirPorMedida(medidas, tactil = false, margen = 0.85) {
  let mejor = null;
  for (const p of PERFILES.filter(x => !tactil || x.id.startsWith('movil'))) {
    const ms = medidas[p.id];
    if (!Number.isFinite(ms)) continue;
    if (1000 / ms >= p.objetivo / margen) mejor = p.id;
  }
  return mejor || PERFILES[0].id;
}
