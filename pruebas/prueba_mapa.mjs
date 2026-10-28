// Pruebas del generador del mapa del mundo (lógica pura, src/logica/mapa.js).
// Uso: node pruebas/prueba_mapa.mjs        MUTAR=1 estropea el resultado a propósito: tiene que fallar.
import { generarMapa, resumen, anchoRio, claseRio, BIOMAS, ROCAS, REGIONES, CONTINENTE, nombreRegion, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje, PENDIENTE_ANDAR } from '../src/logica/paisaje.js';

let bien = 0, mal = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ` — ${d}` : '')); c ? bien++ : mal++; };
const MUTAR = !!process.env.MUTAR;

const huella = (m) => { let h = 0; for (let i = 0; i < m.h.length; i += 7) h = (h * 31 + Math.round(m.h[i])) | 0; return h; };

for (const [semilla, lado] of [[66172, 256], [7, 256], [42, 256], [3, 188]]) {
  const t0 = Date.now(), m = generarMapa(semilla, { lado }), ms = Date.now() - t0;
  const N = m.N, NN = N * N, r = resumen(m), n = `semilla ${semilla}, ${lado} km`;
  if (MUTAR) { m.separacionIsla = 4; m.vetas.push({ tipo: 'granCarbon', x: 0, y: 0 }); m.vetas = m.vetas.filter(v => v.tipo !== 'hierroVeta'); const i = m.tierra.indexOf(1); m.rec[i] = i; m.pais.fill(1, 0, NN / 2); }
  console.log(`${n}: ${ms} ms · ${JSON.stringify(r)}`);
  if (semilla === 66172) comprobar(`${n}: la misma semilla da el mismo mundo`, huella(generarMapa(66172, { lado })) === huella(m));
  comprobar(`${n}: hay tierra y mar (entre el 30 y el 60 % de tierra)`, r.fraccionTierra > 0.3 && r.fraccionTierra < 0.6, `${(r.fraccionTierra * 100).toFixed(0)} %`);
  comprobar(`${n}: cumbres de unos 3.000 m`, r.cumbre > 2200 && r.cumbre < 3900, `${r.cumbre} m`);
  comprobar(`${n}: la isla grande queda a más de 20 km de mar de cualquier otra costa`, m.separacionIsla >= 20, `${Math.round(m.separacionIsla)} km`);
  // la isla es un país entero y solo ese
  const ci = m.centros[0]; let fuera = 0, dentro = 0;
  for (let i = 0; i < NN; i++) if (m.pais[i] === 0) dentro++;
  comprobar(`${n}: la isla es una región entera (la 1)`, m.pais[ci] === 0 && dentro > 0, `${Math.round(dentro * (m.celda / 1000) ** 2)} km²`);
  // todo el agua llega al mar: siguiendo la receptora desde cualquier celda de tierra se llega al mar sin dar vueltas
  let atascadas = 0;
  for (let i = 0; i < NN; i++) { if (!m.tierra[i]) continue; let c = i, k = 0; while (m.tierra[c] && k < NN) { const s = m.rec[c]; if (s < 0 || s === c) { k = NN; break; } c = s; k++; } if (k >= NN) atascadas++; }
  comprobar(`${n}: toda la lluvia llega al mar (sin ciclos ni hoyos sin salida)`, atascadas === 0, `${atascadas} celdas atascadas`);
  // países: cinco, y los del continente de tamaño parecido
  const cont = r.areaPais.slice(1), media = cont.reduce((a, b) => a + b, 0) / cont.length;
  comprobar(`${n}: cinco países, los del continente parecidos (±35 %)`, r.areaPais.every(a => a > 0) && cont.every(a => Math.abs(a / media - 1) < 0.35), r.areaPais.join(' / ') + ' km²');
  let sinPais = 0, mitad = 0; for (let i = 0; i < NN; i++) if (m.tierra[i]) { if (m.pais[i] < 0) sinPais++; } else if (m.pais[i] >= 0) mitad++;
  comprobar(`${n}: el mar no es de ningún país`, mitad === 0, `${mitad} celdas de mar con país`);
  comprobar(`${n}: casi toda la tierra tiene país (salvo islas sueltas)`, sinPais < NN * 0.04, `${sinPais} celdas sin país`);
  // biomas y roca en toda la tierra
  let malBioma = 0; for (let i = 0; i < NN; i++) if (m.tierra[i] && (!BIOMAS[m.bioma[i]] || !ROCAS[m.roca[i]])) malBioma++;
  comprobar(`${n}: cada sitio de tierra tiene bioma y roca`, malBioma === 0, `${malBioma} sin`);
  // vetas: las grandes donde tocan, separadas y pocas; las pequeñas, cerca de cualquier sitio con país
  const ok = { hierroPantano: (i) => m.bioma[i] === 'turbera', hierroVeta: (i) => m.tierra[i] === 1, carbon: (i) => m.tierra[i] === 1,
    granHierro: (i) => m.roca[i] === 'granito' || m.roca[i] === 'pizarra', granCarbon: (i) => m.roca[i] === 'arenisca' };
  const malas = m.vetas.filter(v => !ok[v.tipo](v.y * N + v.x));
  comprobar(`${n}: cada veta en su sitio (grandes de hierro en granito o pizarra, de carbón en arenisca, pantano en turberas)`, malas.length === 0, `${m.vetas.length} vetas, ${malas.length} mal puestas`);
  for (const [tipo, nombre] of [['granHierro', 'hierro'], ['granCarbon', 'carbón']]) {
    const g = m.vetas.filter(v => v.tipo === tipo); let minSep = Infinity;
    for (const a of g) for (const b of g) if (a !== b) minSep = Math.min(minSep, Math.hypot(a.x - b.x, a.y - b.y) * m.celda / 1000);
    comprobar(`${n}: pocas grandes vetas de ${nombre} (2 a 8) y a más de 45 km entre sí`, g.length >= 2 && g.length <= 8 && minSep > 45, `${g.length}, a ${Math.round(minSep)} km como poco`);
  }
  for (const [tipos, nombre] of [[['hierroVeta', 'granHierro'], 'hierro'], [['carbon', 'granCarbon'], 'carbón']]) {
    const vs = m.vetas.filter(v => tipos.includes(v.tipo)); let max = 0;
    for (let i = 0; i < NN; i += 3) if (m.tierra[i] && m.pais[i] >= 0) { const x = i % N + 0.5, y = Math.floor(i / N) + 0.5; let d = 1e9;
      for (const v of vs) d = Math.min(d, Math.hypot(v.x + 0.5 - x, v.y + 0.5 - y)); max = Math.max(max, d * m.celda / 1000); }
    comprobar(`${n}: desde cualquier sitio con país hay ${nombre} a menos de 25 km`, max < 25, `el más lejano a ${max.toFixed(1)} km`);
  }
  // ríos
  comprobar(`${n}: desembocan ríos (de más de 5 m)`, r.bocas.rio + r.bocas.grande >= 10, JSON.stringify(r.bocas));
  if (semilla === 66172) {
    // de cerca, los ríos van por valles y no por zanjas: perfiles de ±300 m a lo ancho de muchos puntos de río
    const pai = crearPaisaje(m), pend = [];
    let aguaBien = 0, aguaN = 0;
    for (const rio of pai.rios) for (let k = 0; k < rio.length - 1; k += 21) {
      const a = rio[k], b = rio[k + 1], px = a.p[0] * 1000, py = a.p[1] * 1000, L = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) * 1000 || 1;
      const nx = -(b.p[1] - a.p[1]) * 1000 / L, ny = (b.p[0] - a.p[0]) * 1000 / L, tr = pai.riosEn(px - 400, py - 400, px + 400, py + 400);
      const h = []; for (let d = -300; d <= 300; d += 10) h.push(pai.altura(px + nx * d, py + ny * d, tr));
      if (MUTAR) h[30] -= 50;                               // una zanja como las de antes: tiene que saltar
      let maxp = 0; for (let i = 1; i < h.length; i++) maxp = Math.max(maxp, Math.abs(h[i] - h[i - 1]) / 10);
      pend.push(maxp);
      // el agua cubre el lecho y queda por debajo de la orilla
      const w = pai.agua(px, py, tr), ancho = Math.max(2, anchoRio(Math.max(a.a, b.a)));
      if (w === null && pai.altura(px, py, tr) < 0.5) continue;   // en la desembocadura ya es el mar
      aguaN++; if (w !== null && w > pai.altura(px, py, tr) && w < pai.altura(px + nx * (ancho / 2 + 3), py + ny * (ancho / 2 + 3), tr)) aguaBien++;
    }
    pend.sort((x, y) => x - y);
    const p90 = pend[Math.floor(pend.length * 0.9)], p99 = pend[Math.floor(pend.length * 0.99)];
    comprobar(`${n}: junto a los ríos no hay zanjas (pendiente más fuerte a ±300 m: el 90 % por debajo de 1, el 99 % por debajo de 2,5)`, p90 < 1 && p99 < 2.5, `${pend.length} perfiles · p90 ${p90.toFixed(2)} · p99 ${p99.toFixed(2)}`);
    // la costa de cerca no es una pared: perfiles de ±600 m cada 2 m a través de la línea de costa
    const saltos = [];
    for (let y = 20; y < N - 20; y += 4) for (let x = 20; x < N - 20; x += 4) {
      const i = y * N + x; if (!m.tierra[i] || (m.tierra[i + 1] && m.tierra[i - 1] && m.tierra[i + N] && m.tierra[i - N])) continue;
      const cx0 = (x + 0.5) * m.celda, cy0 = (y + 0.5) * m.celda; let peor = 0;
      for (let a = 0; a < 6.28; a += 1.57) { let prev = null; for (let d = -600; d <= 600; d += 2) { const hh = pai.altura(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d) + (MUTAR && d === 0 ? 80 : 0); if (prev !== null) peor = Math.max(peor, Math.abs(hh - prev) / 2); prev = hh; } }
      saltos.push(peor);
    }
    saltos.sort((x, y) => x - y);
    const s90 = saltos[Math.floor(saltos.length * 0.9)], smax = saltos[saltos.length - 1];
    comprobar(`${n}: la costa de cerca no sale en saltos verticales (pendiente más fuerte a través de la costa: el 90 % por debajo de 6, ninguna por encima de 40; un acantilado empinado sí)`, s90 < 6 && smax < 40, `${saltos.length} costas · p90 ${s90.toFixed(1)} · máx. ${smax.toFixed(1)}`);
    // la roca dura y empinada se rompe en paredes (cortados y escarpes); la blanda, no. MUTAR: todo arenisca, sin paredes
    const paiR = MUTAR ? crearPaisaje({ ...m, roca: m.roca.map(() => 'arenisca') }) : pai;
    let pared = 0, puntos = 0;
    for (let y = -1500; y < 1500; y += 15) for (let x = -1500; x < 1500; x += 15) {
      const a = paiR.altura(120600 + x, 151900 + y, null, true), b = paiR.altura(120602 + x, 151900 + y, null, true);
      if (a > 0) { puntos++; if (Math.abs(b - a) / 2 > PENDIENTE_ANDAR) pared++; }
    }
    comprobar(`${n}: en la montaña de pizarra hay cortados (paredes que no se suben andando) en un 5 a 35 % del suelo`, pared / puntos > 0.05 && pared / puntos < 0.35, `${(pared / puntos * 100).toFixed(1)} % de ${puntos} puntos`);
    // las laderas de montaña son continuas (no en escalones): en 20 sitios de montaña alta repartidos por el mundo, cuántas
    // veces por km se pasa de suelo a pared; la mediana tiene que ser baja (los afloramientos, con sus cortados, son pocos).
    // MUTAR: afloramientos por todas partes (como estaba antes) y tiene que saltar
    const paiL = MUTAR ? crearPaisaje(m, { afloramientos: 0 }) : pai, porSitio = [], altos = [];
    for (let i = 0; i < NN; i++) if (m.tierra[i] && m.h[i] > 1500 && (m.roca[i] === 'granito' || m.roca[i] === 'pizarra' || m.roca[i] === 'caliza')) altos.push(i);
    for (let k = 0; k < 20; k++) {
      const i = altos[Math.floor((k + 0.5) / 20 * altos.length)], sx = (i % N + 0.5) * m.celda, sy = (Math.floor(i / N) + 0.5) * m.celda;
      let b = 0; for (let a = 0; a < 6.28; a += 1.57) { let prev = paiL.altura(sx, sy, null, true), e = false;
        for (let d = 2; d <= 600; d += 2) { const h = paiL.altura(sx + Math.cos(a) * d, sy + Math.sin(a) * d, null, true), p = Math.abs(h - prev) / 2 > PENDIENTE_ANDAR; if (p && !e) b++; e = p; prev = h; } }
      porSitio.push(b / 2.4);
    }
    porSitio.sort((x, y) => x - y);
    const mediana = porSitio[10];
    comprobar(`${n}: las laderas de montaña no van en escalones (en 20 sitios de montaña, la mediana por debajo de 8 paredes por km)`, mediana < 8, `mediana ${mediana.toFixed(1)} por km · máx. ${porSitio[19].toFixed(1)} (un afloramiento)`);
    comprobar(`${n}: el agua del río cubre el lecho y queda bajo la orilla`, aguaBien / aguaN > 0.97, `${aguaBien} de ${aguaN}`);
  }
}
// la regla del ancho de los ríos (los gruesos del GDD)
comprobar('ancho de río: 10 km² → unos 2 m (arroyo)', Math.round(anchoRio(10e6)) === 2 && claseRio(anchoRio(10e6)) === 'arroyo');
comprobar('ancho de río: 1.000 km² → unos 20 m (río)', Math.round(anchoRio(1000e6)) === 20 && claseRio(anchoRio(1000e6)) === 'rio');
comprobar('ancho de río: 10.000 km² → unos 63 m (gran río)', Math.round(anchoRio(10000e6)) === 63 && claseRio(anchoRio(10000e6)) === 'grande');

// ---------- nombres del mundo elegido (valravnx, 28 oct): cada nombre cae en su tierra ----------
{
  const m = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }), N = m.N, NN = N * N;
  // MUTAR: los nombres al revés, para comprobar que la prueba lo nota
  const nombre = (k) => MUTAR ? REGIONES[REGIONES.length - 1 - k] : nombreRegion(m, k);
  const st = REGIONES.map(() => ({ n: 0, x: 0, y: 0, t: 0, grande: 0, cumbre: 0 }));
  for (let i = 0; i < NN; i++) { const k = m.pais[i]; if (k < 0) continue; const e = st[k]; e.n++; e.x += i % N; e.y += (i / N) | 0; e.t += m.temp[i];
    if (claseRio(anchoRio(m.A[i])) === 'grande') e.grande++; if (m.h[i] > e.cumbre) e.cumbre = m.h[i]; }
  const de = (nom) => { const k = REGIONES.findIndex((_, j) => nombre(j) === nom); return { k, ...st[k], cx: st[k].x / st[k].n / N, cy: st[k].y / st[k].n / N, tm: st[k].t / st[k].n }; };
  const W = de('Whitholm'), E = de('Eikwold'), R = de('Rudmere'), H = de('Highfell'), S = de('Storaa');
  comprobar('nombres: el continente es Kinland y hay cinco regiones con nombre', CONTINENTE === 'Kinland' && REGIONES.length === 5 && REGIONES.every((_, k) => nombre(k)));
  comprobar('nombres: Whitholm es la isla', W.k === m.paisIsla, `región ${W.k + 1}`);
  comprobar('nombres: Eikwold está al noroeste del continente', E.cx < 0.5 && E.cy < 0.5, `(${E.cx.toFixed(2)}, ${E.cy.toFixed(2)})`);
  comprobar('nombres: Rudmere está al suroeste y es la más cálida del continente', R.cx < 0.5 && R.cy > 0.5 && [E, H, S].every(o => R.tm > o.tm), `(${R.cx.toFixed(2)}, ${R.cy.toFixed(2)}), ${R.tm.toFixed(1)} °C`);
  comprobar('nombres: Highfell tiene la cumbre más alta del mundo', [W, E, R, S].every(o => H.cumbre > o.cumbre), `${Math.round(H.cumbre)} m`);
  comprobar('nombres: Storaa está al sureste y por ella corre el gran río', S.cx > 0.5 && S.cy > 0.5 && [W, E, R, H].every(o => S.grande > o.grande), `${S.grande} celdas de gran río`);
  const otro = generarMapa(7, { lado: 256 });
  comprobar('nombres: en otra semilla no hay nombres (Región N)', nombreRegion(otro, 0) === null && nombreRegion(m, -1) === null);
}
console.log(`\nResultado: ${bien} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
