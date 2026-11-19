// Kinhold — prueba del castillo del rey (lógica): un jugador anda el recorrido del que ataca, de la calle a la cámara del
// alcaide (explanada, barbacana, puente, puerta, patios, escalera del homenaje y su caracol), con el terreno de verdad y
// el foso cavado, y en cada sitio está a la altura que toca: sin atravesar muros ni quedarse atascado ni caerse.
// El recorrido lo escribe herramientas/castillo_rey/ruta.py. MUTAR=1: el castillo no se pisa (la prueba tiene que fallar).
import fs from 'fs';
import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje, PENDIENTE_ANDAR } from '../src/logica/paisaje.js';
import { alturaMundo } from '../src/logica/whitholm.js';
import { nivelar } from '../src/logica/nivelado.js';
import { crearChoquesCastillo, MARCAS_FOSO, ORIGEN_CASTILLO as O } from '../src/logica/castillo_rey.js';
const t0 = Date.now();
const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }); const paisaje = crearPaisaje(mapa);
const suelo = nivelar(alturaMundo(paisaje), MARCAS_FOSO);
const datos = JSON.parse(fs.readFileSync(new URL('../docs/recursos/mundo/castillo-rey-v2/colision.json', import.meta.url)));
const C = crearChoquesCastillo(datos, { dx: -O.x, dz: -O.z });   // quien pregunta va en el mundo
console.log('mundo listo en', Date.now() - t0, 'ms');
const RUTAS = JSON.parse(fs.readFileSync(new URL('./datos/recorrido_castillo_rey.json', import.meta.url)));
const alt = (x, z, y) => { const t = suelo(x, z), c = process.env.MUTAR ? null : C.altura(x, z, y); return c !== null && c > t - 0.05 ? { y: c, castillo: true } : { y: t, castillo: false }; };
let fallos = 0, puntos = 0;
for (const [nombreRuta, ruta] of Object.entries(RUTAS)) {
  console.log('—', nombreRuta);
  puntos += ruta.length;
  let x = ruta[0][0], z = ruta[0][1], y = suelo(x, z);
  for (let i = 1; i < ruta.length; i++) {
    const [tx, tz, ey, nombre] = ruta[i];
    let pasos = 0, atascado = 0;
    while (Math.hypot(tx - x, tz - z) > 0.08) {
      const d = Math.hypot(tx - x, tz - z), st = Math.min(0.06, d);
      let nx = x + (tx - x) / d * st, nz = z + (tz - z) / d * st;
      const r = C.apartar(nx, nz, y); nx = r.x; nz = r.z;
      const a = alt(nx, nz, y);
      const sobreCastillo = alt(x, z, y).castillo || a.castillo;
      const ok = C.cabe(nx, nz, y) && !C.cruzaMuro(x, z, nx, nz, y) && (sobreCastillo || (a.y - y) / Math.max(1e-6, Math.hypot(nx - x, nz - z)) <= PENDIENTE_ANDAR || a.y - y < 0.05);
      if (ok) { x = nx; z = nz; y = a.y; atascado = 0; } else atascado++;
      if (++pasos > 4000 || atascado > 60) break;
    }
    const llega = Math.hypot(tx - x, tz - z) <= 0.1;
    const bien = llega && (ey === null || Math.abs(y - ey) < 0.25);
    if (!bien) fallos++;
    if ((nombre && nombre !== '~') || !bien || process.env.TODO) console.log(bien ? 'bien' : 'MAL ', `#${i}`, nombre === '~' ? '' : nombre, 'y =', y.toFixed(2), ey !== null ? `(esperada ${ey})` : '', llega ? '' : `· atascado a ${Math.hypot(tx - x, tz - z).toFixed(2)} m en (${x.toFixed(2)}, ${z.toFixed(2)})`);
    if (!llega) { x = tx; z = tz; y = alt(x, z, ey ?? y).y; }
  }
}
console.log(fallos ? `✗ Castillo del rey: ${fallos} fallos en el recorrido` : `✓ Castillo del rey: recorrido entero (${puntos} puntos) sin atascarse ni caerse`);
process.exit(fallos ? 1 : 0);
