// Kinhold — visor de los bocetos del mapa del mundo (canvas 2D, sin three.js).
// El mapa lo genera la lógica pura (src/logica/mapa.js) por pasos, enseñando el progreso; aquí solo se dibuja.
import { generar, clasificarBioma, BIOMAS, ROCAS, VETAS, LADO_KM, anchoRio, claseRio, fbm, resumen } from '../logica/mapa.js';
import { VERSION_MAPA, REGISTRO_MAPA } from './registro.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';

const $ = (id) => document.getElementById(id);
const lienzo = $('lienzo'), ctx = lienzo.getContext('2d');
const movil = Math.min(innerWidth, innerHeight) < 700;
const R = movil ? 1024 : 1536;                       // resolución de la imagen del mapa (px)
let N = 256;
const LADO = () => (mapa ? mapa.lado : LADO_KM);
let mapa = null, fondo = 'relieve';
const capas = { rios: true, paises: true, vetas: false };
const imagenes = {};                                 // fondo → canvas ya pintado
let rios = [];                                       // polilíneas de ríos en km, con su clase
const vista = { x: 0, y: 0, z: 1 };                  // desplazamiento (px de pantalla) y zoom
let escalaBase = 1;

// ---------- generar ----------
function semillaInicial() {
  const q = new URLSearchParams(location.search).get('semilla');
  return q && /^\d+$/.test(q) ? Number(q) : 2;
}
let lado = Number(new URLSearchParams(location.search).get('lado')) === 188 ? 188 : 256;   // propuesta: 256 km (ver notas)
let trabajo = 0;
function crear(semilla) {
  const mio = ++trabajo;
  $('semilla').value = semilla; $('cargando').hidden = false;
  $('lado').value = String(lado);
  const g = generar(semilla, { lado });
  const t0 = performance.now();
  const seguir = () => {
    if (mio !== trabajo) return;
    const r = g.next();
    if (r.done) {
      mapa = r.value; N = mapa.N; window.__mapa.msGenerar = Math.round(performance.now() - t0);
      for (const k in imagenes) delete imagenes[k];
      prepararRios(); encuadrar(); datosGenerales(); pintar();
      $('cargando').hidden = true; window.__mapa.listo = true;
      const u = new URL(location.href); u.searchParams.set('semilla', semilla); u.searchParams.set('lado', lado); history.replaceState(null, '', u);
      return;
    }
    $('fase').textContent = tr(r.value.fase); $('barra').firstElementChild.style.width = `${Math.round(r.value.avance * 100)}%`;
    setTimeout(seguir, 0);
  };
  window.__mapa.listo = false;
  setTimeout(seguir, 30);
}

// ---------- muestreo del mapa ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function bilineal(arr, gx, gy) {
  gx = clamp(gx, 0, N - 1.001); gy = clamp(gy, 0, N - 1.001);
  const x = Math.floor(gx), y = Math.floor(gy), fx = gx - x, fy = gy - y, i = y * N + x;
  return arr[i] * (1 - fx) * (1 - fy) + arr[i + 1] * fx * (1 - fy) + arr[i + N] * (1 - fx) * fy + arr[i + N + 1] * fx * fy;
}
// celda vecina con el borde deformado por ruido, para que biomas, rocas y países no salgan en escalones
function celdaDeformada(gx, gy) {
  const dx = (fbm(gx * 0.35, gy * 0.35, 901, 3) - 0.5) * 2.2, dy = (fbm(gx * 0.35 + 50, gy * 0.35, 902, 3) - 0.5) * 2.2;
  const x = clamp(Math.round(gx + dx - 0.5), 0, N - 1), y = clamp(Math.round(gy + dy - 0.5), 0, N - 1);
  return y * N + x;
}
const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ALTURAS = [[0, [116, 132, 90]], [400, [140, 146, 100]], [900, [158, 148, 108]], [1500, [154, 132, 104]], [2200, [136, 124, 116]], [2800, [176, 172, 166]], [3200, [226, 226, 222]]];
function colorAltura(h) {
  for (let k = 1; k < ALTURAS.length; k++) if (h < ALTURAS[k][0]) return mezclar(ALTURAS[k - 1][1], ALTURAS[k][1], (h - ALTURAS[k - 1][0]) / (ALTURAS[k][0] - ALTURAS[k - 1][0]));
  return ALTURAS[ALTURAS.length - 1][1];
}
const TINTE_PAIS = [[190, 120, 90], [100, 130, 170], [170, 160, 90], [120, 160, 120], [160, 110, 160]];

// ---------- pintar el fondo (una vez por fondo; luego se reutiliza) ----------
function pintarFondo(cual) {
  if (imagenes[cual]) return imagenes[cual];
  const c = document.createElement('canvas'); c.width = c.height = R;
  const g = c.getContext('2d'), img = g.createImageData(R, R), d = img.data;
  const f = N / R, kmPx = LADO() / R;
  const alt = new Float32Array(R * R), tierraPx = new Uint8Array(R * R), celdas = new Int32Array(R * R);
  for (let py = 0; py < R; py++) for (let px = 0; px < R; px++) {
    const gx = (px + 0.5) * f - 0.5, gy = (py + 0.5) * f - 0.5, i = py * R + px;
    // la costa sale de la forma continua (no de las celdas): curvas en vez de escalones
    // (empujada hacia la máscara limpia de tierra, para que no reaparezcan las motas que quitó el filtro)
    const t = bilineal(mapa.forma, gx, gy) + (bilineal(mapa.tierra, gx, gy) - 0.5) * 10 + (fbm(px * kmPx / 2.5, py * kmPx / 2.5, 77, 3) - 0.5) * 4;
    tierraPx[i] = t > 0 ? 1 : 0;
    const h = bilineal(mapa.h, gx, gy);
    alt[i] = tierraPx[i] ? Math.max(1, h + (fbm(px * kmPx / 2.2, py * kmPx / 2.2, 79, 4) - 0.5) * (40 + h * 0.12)) : 0;
    celdas[i] = celdaDeformada(gx + 0.5, gy + 0.5);
  }
  const paso = kmPx * 1000;
  for (let py = 0; py < R; py++) for (let px = 0; px < R; px++) {
    const i = py * R + px, o = i * 4;
    let col;
    if (!tierraPx[i]) {
      col = mezclar([112, 140, 148], [64, 90, 108], clamp(distMar(px, py, tierraPx) / 26, 0, 1));
    } else {
      const ci = celdas[i];
      if (cual === 'biomas') {
        // bioma por píxel con la temperatura de su altura de detalle: las lindes siguen el relieve
        const gx = (px + 0.5) * f - 0.5, gy = (py + 0.5) * f - 0.5;
        const T = bilineal(mapa.temp, gx, gy) - (alt[i] - bilineal(mapa.h, gx, gy)) * 0.0065;
        const P = bilineal(mapa.lluvia, gx, gy) * (0.85 + 0.3 * fbm(px * kmPx / 3, py * kmPx / 3, 83, 3));
        col = BIOMAS[clasificarBioma(T, P, mapa.pend[ci], alt[i], mapa.A[ci] / (mapa.celda * mapa.celda))].color;
      }
      else if (cual === 'roca') col = (ROCAS[mapa.roca[ci]] || ROCAS.caliza).color;
      else col = colorAltura(alt[i]);
      // sombreado: luz del noroeste
      const xa = Math.max(px - 1, 0), xb = Math.min(px + 1, R - 1), ya = Math.max(py - 1, 0), yb = Math.min(py + 1, R - 1);
      const dzx = (alt[py * R + xb] - alt[py * R + xa]) / (2 * paso), dzy = (alt[yb * R + px] - alt[ya * R + px]) / (2 * paso);
      const nx = -dzx * 1.6, ny = -dzy * 1.6, nl = Math.hypot(nx, ny, 1);
      const luz = (nx * -0.55 + ny * -0.55 + 0.63) / nl;
      const s = clamp(0.62 + 0.62 * (luz - 0.45), 0.35, 1.25);
      col = [col[0] * s, col[1] * s, col[2] * s];
      // fronteras: los países se tiñen poco y la raya es oscura
      if (capas.paises) {
        const p = mapa.pais[ci];
        if (p >= 0) col = mezclar(col, TINTE_PAIS[p], 0.12);
        const vecino = (j) => { const v = mapa.pais[celdas[j]]; return v < 0 ? p : v; };   // sin país (mar, islas sueltas): sin raya
        if (p >= 0 && ((px + 1 < R && tierraPx[i + 1] && vecino(i + 1) !== p) || (py + 1 < R && tierraPx[i + R] && vecino(i + R) !== p))) col = [70, 44, 38];
      }
    }
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  imagenes[cual] = c;
  return c;
}
// distancia aproximada al litoral para el color del mar (se calcula una vez por fondo)
let distCache = null;
function distMar(px, py, tierraPx) {
  if (!distCache || distCache.t !== tierraPx) {
    const D = new Float32Array(R * R).fill(1e9), q = [];
    for (let i = 0; i < R * R; i++) if (tierraPx[i]) { D[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) { const c = q[k], x = c % R, y = (c / R) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + a, yy = y + b; if (xx < 0 || yy < 0 || xx >= R || yy >= R) continue; const j = yy * R + xx; if (D[j] > D[c] + 1) { D[j] = D[c] + 1; q.push(j); } } }
    distCache = { t: tierraPx, D };
  }
  return distCache.D[py * R + px] * (1024 / R);
}

// ---------- ríos: polilíneas suavizadas en km ----------
function prepararRios() {
  const { tierra, rec, A } = mapa, NN = N * N, km = LADO() / N, MIN = 40e6;
  const centro = (i) => { const x = i % N, y = (i / N) | 0; return [(x + 0.5 + mapa.jx[i]) * km, (y + 0.5 + mapa.jy[i]) * km]; };
  const tieneArriba = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) if (tierra[i] && A[i] >= MIN && tierra[rec[i]]) tieneArriba[rec[i]] = 1;
  const visto = new Uint8Array(NN); rios = [];
  for (let i = 0; i < NN; i++) {
    if (!tierra[i] || A[i] < MIN || tieneArriba[i]) continue;
    let c = i; const pts = [];
    for (;;) {
      pts.push({ p: centro(c), a: A[c] });
      if (visto[c] || !tierra[c]) break;
      visto[c] = 1; c = rec[c];
    }
    // entra en otro río o en el mar: el último punto es la unión
    rios.push(chaikin(pts));
  }
  // los que nacen en un río ya trazado (afluentes que llegan a la vez) también se dibujan por tramos
  for (let i = 0; i < NN; i++) if (tierra[i] && A[i] >= MIN && !visto[i]) { visto[i] = 1; rios.push(chaikin([{ p: centro(i), a: A[i] }, { p: centro(rec[i]), a: A[rec[i]] }])); }
}
function chaikin(pts) {
  let r = pts;
  for (let k = 0; k < 2; k++) {
    if (r.length < 3) break;
    const n = [r[0]];
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      n.push({ p: [a.p[0] * 0.75 + b.p[0] * 0.25, a.p[1] * 0.75 + b.p[1] * 0.25], a: a.a });
      n.push({ p: [a.p[0] * 0.25 + b.p[0] * 0.75, a.p[1] * 0.25 + b.p[1] * 0.75], a: b.a });
    }
    n.push(r[r.length - 1]); r = n;
  }
  return r;
}
const GROSOR = { arroyo: 0.7, rio: 1.5, grande: 2.8 };

// ---------- dibujar ----------
function encuadrar() {
  const W = innerWidth, H = innerHeight;
  escalaBase = Math.min(W, H) / R;
  vista.z = 1; vista.x = (W - R * escalaBase) / 2; vista.y = (H - R * escalaBase) / 2;
}
function pintar() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  if (lienzo.width !== Math.round(W * dpr)) { lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#405a6c'; ctx.fillRect(0, 0, W, H);
  if (!mapa) return;
  const s = escalaBase * vista.z;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(pintarFondo(fondo), vista.x, vista.y, R * s, R * s);
  const kmAPx = (R / LADO()) * s, aPant = (p) => [vista.x + p[0] * kmAPx, vista.y + p[1] * kmAPx];
  if (capas.rios) {
    ctx.strokeStyle = 'rgb(70,104,128)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const zf = Math.sqrt(vista.z);
    for (const r of rios) for (let k = 0; k < r.length - 1; k++) {
      const a = aPant(r[k].p), b = aPant(r[k + 1].p);
      ctx.lineWidth = GROSOR[claseRio(anchoRio(r[k].a))] * zf * (movil ? 0.9 : 1);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  if (capas.vetas) {
    const km = LADO() / N, t = 3.2 * Math.sqrt(vista.z);
    for (const v of mapa.vetas) {
      const [x, y] = aPant([(v.x + 0.5) * km, (v.y + 0.5) * km]);
      ctx.beginPath();
      if (v.tipo === 'hierroPantano') { ctx.fillStyle = '#b5652e'; ctx.arc(x, y, t * 0.8, 0, Math.PI * 2); }
      else if (v.tipo === 'hierroVeta') { ctx.fillStyle = '#8a2a1c'; ctx.moveTo(x, y - t * 1.2); ctx.lineTo(x + t, y + t * 0.8); ctx.lineTo(x - t, y + t * 0.8); ctx.closePath(); }
      else { ctx.fillStyle = '#1c1a18'; ctx.rect(x - t * 0.7, y - t * 0.7, t * 1.4, t * 1.4); }
      ctx.fill(); ctx.strokeStyle = 'rgba(255,240,220,.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }
  if (capas.paises) {
    ctx.font = `600 ${movil ? 11 : 13}px system-ui, sans-serif`; ctx.textAlign = 'center';
    const km = LADO() / N;
    mapa.centros.forEach((c, k) => {
      const [x, y] = aPant([(c % N + 0.5) * km, (((c / N) | 0) + 0.5) * km]);
      const t = tr('País {n}', { n: k + 1 });
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,30,24,.75)'; ctx.strokeText(t, x, y); ctx.fillStyle = '#f4ead8'; ctx.fillText(t, x, y);
    });
  }
  // escala: 20 km
  const l = 20 * kmAPx, x0 = 16, y0 = $('datos').getBoundingClientRect().top - 12;
  ctx.fillStyle = 'rgba(36,30,24,.8)'; ctx.fillRect(x0 - 6, y0 - 16, l + 12, 26);
  ctx.strokeStyle = '#f1e8d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + l, y0); ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y0 + 4); ctx.moveTo(x0 + l, y0 - 4); ctx.lineTo(x0 + l, y0 + 4); ctx.stroke();
  ctx.fillStyle = '#f1e8d8'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('20 km', x0 + l / 2, y0 - 5);
  leyenda();
}
function leyenda() {
  const filas = [];
  const fila = (c, t) => filas.push(`<div><i style="background:rgb(${c.map(Math.round).join(',')})"></i>${t}</div>`);
  if (fondo === 'biomas') for (const b of Object.values(BIOMAS)) fila(b.color, tr(b.nombre));
  else if (fondo === 'roca') for (const r of Object.values(ROCAS)) fila(r.color, tr(r.nombre));
  else for (const [h, c] of ALTURAS) fila(c, `${h.toLocaleString('es')} m`);
  if (capas.rios) for (const [k, t] of [['grande', 'Gran río (más de 40 m)'], ['rio', 'Río (5 a 40 m)'], ['arroyo', 'Arroyo (menos de 5 m)']])
    filas.push(`<div><i style="background:rgb(70,104,128);height:${GROSOR[k] + 1}px"></i>${tr(t)}</div>`);
  if (capas.vetas) {
    filas.push(`<div><i style="background:#b5652e;border-radius:50%"></i>${tr(VETAS.hierroPantano.nombre)}</div>`);
    filas.push(`<div><i style="background:#8a2a1c;clip-path:polygon(50% 0,100% 100%,0 100%)"></i>${tr(VETAS.hierroVeta.nombre)}</div>`);
    filas.push(`<div><i style="background:#1c1a18"></i>${tr(VETAS.carbon.nombre)}</div>`);
  }
  $('leyenda').innerHTML = filas.join('');
}
function datosGenerales() {
  const r = resumen(mapa); window.__mapa.resumen = r;
  $('datos').innerHTML = tr('Semilla {s} · mundo de {l} × {l} km · tierra {t} km² · cumbre más alta {c} m · la isla está a {i} km de la costa más cercana · desembocan {g} grandes ríos y {r} ríos. Toca el mapa para ver qué hay en cada sitio.',
    { s: mapa.semilla, l: mapa.lado, t: r.tierraKm2.toLocaleString('es'), c: r.cumbre.toLocaleString('es'), g: r.bocas.grande, r: r.bocas.rio, i: r.separacionIsla });
}

// ---------- tocar: qué hay aquí ----------
function info(cx, cy) {
  const s = escalaBase * vista.z, px = (cx - vista.x) / s, py = (cy - vista.y) / s;
  if (px < 0 || py < 0 || px >= R || py >= R) return;
  const gx = px * N / R, gy = py * N / R, i = clamp(Math.floor(gy), 0, N - 1) * N + clamp(Math.floor(gx), 0, N - 1);
  const kmx = (gx * LADO() / N).toFixed(1), kmy = (gy * LADO() / N).toFixed(1);
  if (!mapa.tierra[i]) { $('datos').innerHTML = tr('Mar · {x}, {y} km', { x: kmx, y: kmy }); return; }
  const h = Math.round(bilineal(mapa.h, gx - 0.5, gy - 0.5)), ancho = anchoRio(mapa.A[i]);
  const partes = [tr('{h} m de altura', { h: h.toLocaleString('es') }), tr(BIOMAS[mapa.bioma[i]].nombre), tr(ROCAS[mapa.roca[i]].nombre), mapa.pais[i] >= 0 ? tr('País {n}', { n: mapa.pais[i] + 1 }) : tr('isla sin país')];
  if (mapa.A[i] >= 40e6) partes.push(tr({ arroyo: 'arroyo de {a} m', rio: 'río de {a} m', grande: 'gran río de {a} m' }[claseRio(ancho)], { a: Math.round(ancho) }));
  partes.push(tr('{t} °C de media', { t: Math.round(mapa.temp[i]) }));
  $('datos').innerHTML = `<b>${partes.join(' · ')}</b> · ${kmx}, ${kmy} km`;
  window.__mapa.ultimaInfo = $('datos').textContent;
}

// ---------- mover y ampliar (ratón, rueda y dos dedos) ----------
const punteros = new Map(); let arrastre = null, pinza = null, movido = 0;
lienzo.addEventListener('pointerdown', (e) => { lienzo.setPointerCapture(e.pointerId); punteros.set(e.pointerId, { x: e.clientX, y: e.clientY }); movido = 0;
  if (punteros.size === 1) arrastre = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y };
  if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pinza = { d: Math.hypot(a.x - b.x, a.y - b.y), z: vista.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: vista.x, vy: vista.y }; arrastre = null; } });
lienzo.addEventListener('pointermove', (e) => {
  if (!punteros.has(e.pointerId)) return; punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinza && punteros.size === 2) { const [a, b] = [...punteros.values()]; const z = clamp(pinza.z * Math.hypot(a.x - b.x, a.y - b.y) / pinza.d, 1, 12);
    vista.x = pinza.cx - (pinza.cx - pinza.vx) * z / pinza.z; vista.y = pinza.cy - (pinza.cy - pinza.vy) * z / pinza.z; vista.z = z; movido = 99; pintar(); }
  else if (arrastre) { movido = Math.max(movido, Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y)); vista.x = arrastre.vx + e.clientX - arrastre.x; vista.y = arrastre.vy + e.clientY - arrastre.y; pintar(); }
});
const soltar = (e) => { if (punteros.has(e.pointerId) && punteros.size === 1 && movido < 6 && mapa) info(e.clientX, e.clientY); punteros.delete(e.pointerId); if (punteros.size < 2) pinza = null; if (!punteros.size) arrastre = null; };
lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);
lienzo.addEventListener('wheel', (e) => { e.preventDefault(); const z = clamp(vista.z * Math.exp(-e.deltaY * 0.0015), 1, 12);
  vista.x = e.clientX - (e.clientX - vista.x) * z / vista.z; vista.y = e.clientY - (e.clientY - vista.y) * z / vista.z; vista.z = z; pintar(); }, { passive: false });
addEventListener('resize', () => { if (mapa) { encuadrar(); pintar(); } });

// ---------- botones ----------
for (const b of document.querySelectorAll('[data-fondo]')) b.onclick = () => { fondo = b.dataset.fondo; document.querySelectorAll('[data-fondo]').forEach(x => x.classList.toggle('on', x === b)); pintar(); };
for (const b of document.querySelectorAll('[data-capa]')) b.onclick = () => { const k = b.dataset.capa; capas[k] = !capas[k]; b.classList.toggle('on', capas[k]); if (k === 'paises') for (const f in imagenes) delete imagenes[f]; pintar(); };
$('lado').onchange = () => { lado = Number($('lado').value); crear(mapa ? mapa.semilla : semillaInicial()); };
$('btnOtra').onclick = () => crear(Math.floor(Math.random() * 99999) + 1);
$('semilla').onchange = () => { const v = parseInt($('semilla').value, 10); if (v > 0) crear(v); };
$('btnLeyenda').onclick = () => { document.body.classList.toggle('conLeyenda'); };
$('btnNotas').onclick = () => { $('notas').hidden = !$('notas').hidden; };
$('notas').innerHTML = `<b>${tr(VERSION_MAPA)}</b><ul>${REGISTRO_MAPA.map(t => `<li>${tr(t)}</li>`).join('')}</ul>`;
traducirPagina(); botonesIdioma($('idiomas'));

window.__mapa = {
  listo: false, crear, info,
  fondo: (f) => document.querySelector(`[data-fondo="${f}"]`).click(),
  capa: (k, v) => { if (capas[k] !== v) document.querySelector(`[data-capa="${k}"]`).click(); },
  ampliar: (z, kmx, kmy) => { const s0 = escalaBase * z, k = R / LADO(); vista.z = z; vista.x = innerWidth / 2 - kmx * k * s0; vista.y = innerHeight / 2 - kmy * k * s0; pintar(); },
  get mapa() { return mapa; },
};
crear(semillaInicial());
