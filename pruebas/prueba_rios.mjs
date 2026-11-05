// Pruebas de los ríos de verdad (valravnx, 5 nov): las uniones (el afluente llega al cauce del río al que entra y su
// agua, a la altura de ese río), el río nace estrecho, el doble de ancho que antes (arroyo hasta 8 m, que se vadea; río
// de más, que se nada salvo en sus vados). Ejecutar: node pruebas/prueba_rios.mjs
// Con MUTAR=1 no se unen los afluentes (como antes) y con MUTAR=2 el cauce es de hierba (sin lecho): tiene que fallar.
if (process.env.MUTAR === '1') globalThis.__sinUnirRios = true;
if (process.env.MUTAR === '2') globalThis.__sinLecho = true;
const { generarMapa, SEMILLA_MUNDO, LADO_MUNDO, anchoRio, ARROYO_HASTA } = await import('../src/logica/mapa.js');
const { crearPaisaje } = await import('../src/logica/paisaje.js');
const { ISLA } = await import('../src/logica/whitholm.js');
const { colorJuego } = await import('../src/mundo/color_suelo.js');

let bien = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') { if (cond) bien++; else mal++; console.log(`  ${cond ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`); }

const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }), pai = crearPaisaje(mapa);
const enIsla = (q) => q.p[0] * 1000 > ISLA.x0 && q.p[0] * 1000 < ISLA.x1 && q.p[1] * 1000 > ISLA.z0 && q.p[1] * 1000 < ISLA.z1;
const rios = pai.rios.filter(r => r.some(enIsla));
const km = mapa.lado / mapa.N, N = mapa.N;
const entra = (r) => { const e = r[r.length - 1].p, c = Math.floor(e[1] / km) * N + Math.floor(e[0] / km); return !!mapa.tierra[c]; };

console.log('Las uniones');
{
  const dSeg = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-12, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2)); return Math.hypot(p[0] - a[0] - vx * u, p[1] - a[1] - vy * u) * 1000; };
  const huecos = [];
  for (const r of rios) {
    if (!entra(r)) continue;
    const e = r[r.length - 1].p; let d = Infinity;
    for (const o of pai.rios) if (o !== r) for (let k = 0; k < o.length - 1; k++) d = Math.min(d, dSeg(e, o[k].p, o[k + 1].p));
    huecos.push(d);
  }
  comprobar('en Whitholm hay afluentes que entran en otro río', huecos.length >= 8, `${huecos.length}`);
  comprobar('todos llegan al cauce del río al que entran (a menos de 1 m; antes, de media a 77 m)', huecos.every(h => h < 1), huecos.map(h => h.toFixed(1)).join(' '));
  // el agua del afluente en la unión, a la altura del río (en el juego: lo que dice agua() en el punto de la unión y un
  // poco río abajo por el río grande); y río arriba del afluente, nunca más baja que en la unión
  let escalones = 0, subidas = 0, n = 0;
  for (const r of rios) {
    if (!r.une) continue; n++;
    const e = r[r.length - 1].p, x = e[0] * 1000, y = e[1] * 1000, tr = pai.riosEn(x - 400, y - 400, x + 400, y + 400);
    const enUnion = pai.agua(x, y, tr), q = r[Math.max(0, r.length - 3)], antes = pai.agua(q.p[0] * 1000, q.p[1] * 1000, tr);
    if (enUnion === null) { escalones++; continue; }
    if (Math.abs(r[r.length - 1].h - r.une.h) > 0.01 && r[r.length - 1].h !== r[r.length - 2].h) escalones++;
    if (antes !== null && antes < enUnion - 0.05) subidas++;
  }
  comprobar('en cada unión hay agua y el afluente llega a la altura del río', n >= 8 && escalones === 0, `${escalones} de ${n} con escalón o sin agua`);
  comprobar('el afluente nunca sube al llegar a la unión', subidas === 0, `${subidas} de ${n}`);
}

console.log('El tamaño');
{
  const anchos = [], viejos = [];
  for (const r of rios) for (let k = 1; k < r.length - 1; k++) {
    const q = r[k]; if (!enIsla(q)) continue;
    const x = q.p[0] * 1000, y = q.p[1] * 1000, c = pai.rioCerca(x, y, pai.riosEn(x - 50, y - 50, x + 50, y + 50));
    if (c.dm < 1) { anchos.push(c.ancho); if (q.d > 900) viejos.push(Math.max(2, anchoRio(q.a))); }
  }
  anchos.sort((a, b) => a - b); viejos.sort((a, b) => a - b);
  const med = anchos[anchos.length >> 1], max = anchos[anchos.length - 1], medViejo = viejos[viejos.length >> 1];
  comprobar('el doble de ancho que antes (la mediana, de unos 3,7 m a unos 7)', med > medViejo * 1.6 && med > 6, `mediana ${med.toFixed(1)} m (antes ${medViejo.toFixed(1)})`);
  comprobar('el río mayor de Whitholm, de unos 22 m', max > 18 && max < 26, `${max.toFixed(1)} m`);
  const arroyos = anchos.filter(a => a < ARROYO_HASTA).length / anchos.length;
  comprobar('más o menos la mitad son arroyos (hasta 8 m) y la otra mitad ríos', arroyos > 0.3 && arroyos < 0.7, `${Math.round(arroyos * 100)} % arroyos`);
}

console.log('Nacen estrechos');
{
  let bienN = 0, n = 0;
  for (const r of rios) {
    if (r.length < 6) continue;
    const ancho = (q) => { const x = q.p[0] * 1000, y = q.p[1] * 1000; return pai.rioCerca(x, y, pai.riosEn(x - 50, y - 50, x + 50, y + 50)).ancho; };
    const k = r.findIndex(q => q.d > 1200); if (k < 0) continue;
    n++; if (ancho(r[0]) < ancho(r[k]) * 0.6) bienN++;
  }
  comprobar('donde nace, el río es más estrecho (menos del 60 % de su ancho a 1,2 km)', n > 10 && bienN >= n * 0.9, `${bienN} de ${n}`);
}

console.log('Se vadean los arroyos; los ríos, solo por sus vados');
{
  let arroyosBien = 0, arroyos = 0, riosBien = 0, riosN = 0;
  for (const r of rios) for (let k = 1; k < r.length - 1; k += 2) {
    const q = r[k]; if (!enIsla(q)) continue;
    const x = q.p[0] * 1000, y = q.p[1] * 1000, tr = pai.riosEn(x - 100, y - 100, x + 100, y + 100), c = pai.rioCerca(x, y, tr), h = pai.hondura(x, y, tr);
    if (c.dm > 1 || h === null || h <= 0) continue;
    if (c.ancho < ARROYO_HASTA - 0.5) { arroyos++; if (h <= 0.75) arroyosBien++; }
    else if (c.ancho > ARROYO_HASTA + 0.5) { riosN++; if (h >= 1.2) riosBien++; }
  }
  comprobar('los arroyos se vadean (como mucho 0,75 m de agua en el centro)', arroyos > 50 && arroyosBien >= arroyos * 0.95, `${arroyosBien} de ${arroyos}`);
  comprobar('los ríos, no: en el centro hay que nadar (1,2 m o más, salvo en los vados)', riosN > 30 && riosBien >= riosN * 0.85, `${riosBien} de ${riosN}`);
}

console.log('El lecho: grava y piedra, no hierba');
{
  // en puntos de río de la isla, el color del suelo en el centro del cauce y a 6 m fuera de la orilla: el del centro, sin
  // el verde de la hierba (el verde no pasa del rojo) y más apagado; el de fuera, el de antes
  let lechoBien = 0, fueraBien = 0, n = 0;
  for (const r of rios) for (let k = 2; k < r.length - 1; k += 3) {
    const q = r[k]; if (!enIsla(q)) continue;
    const x = q.p[0] * 1000, y = q.p[1] * 1000, tr = pai.riosEn(x - 100, y - 100, x + 100, y + 100), c = pai.rioCerca(x, y, tr);
    if (c.dm > 1) continue;
    const z = pai.altura(x, y, tr), st = pai.sitio(x, y, z); if (!st || !st.bioma || st.bioma === 'nieve') continue;
    const dentro = colorJuego(st, z, 0.05, 0.05, 0, x, y, [0, 0, 0], c);
    const sinRio = colorJuego(st, z, 0.05, 0.05, 0, x, y, [0, 0, 0], null);
    if (sinRio[1] <= sinRio[0]) continue;   // (solo donde sin el río el suelo sería de hierba, verde)
    n++;
    if (dentro[1] <= dentro[0] * 1.05) lechoBien++;
    const fuera = { dm: c.ancho / 2 + 6, ancho: c.ancho };
    const a = colorJuego(st, z, 0.05, 0.05, 0, x + 1, y, [0, 0, 0], fuera), b2 = colorJuego(st, z, 0.05, 0.05, 0, x + 1, y, [0, 0, 0], null);
    if (Math.abs(a[0] - b2[0]) + Math.abs(a[1] - b2[1]) + Math.abs(a[2] - b2[2]) < 1e-6) fueraBien++;
  }
  comprobar('en el centro del cauce el suelo es de grava y piedra (sin el verde de la hierba)', n > 50 && lechoBien >= n * 0.95, `${lechoBien} de ${n}`);
  comprobar('a 6 m de la orilla, el suelo de siempre', fueraBien >= n, `${fueraBien} de ${n}`);
}

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
