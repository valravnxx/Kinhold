// Kinhold — el mapa del rey en el juego (valravnx, 31 oct): Whitholm es la isla del rey y está cartografiada; el mapa se
// lleva desde que apareces. Se abre con M (o el botón «Mapa» en el móvil) y enseña la costa, las comarcas con su
// nombre, los ríos, la ciudad del rey (en Strandvang) y dónde estás tú, con hacia dónde miras. Sin viaje rápido: solo se
// mira. Se arrastra para moverlo y se acerca con la rueda o con dos dedos.
// El panel del admin (src/juego/panel_admin.js) le pone una capa encima (ponerCapa): pinta a los demás jugadores y
// recibe los clics en el mapa (en metros del mundo) para ir ahí; sin capa, el mapa es solo para mirar.
//
// La imagen de fondo (papel, mar, tierra, fronteras) la calcula src/juego/mapa_rey_pintar.js a pasos cortos en cuanto
// el mundo está listo, sin parar el juego; si lo abres antes de que acabe, se termina de golpe («Desplegando el
// mapa…»). Encima se dibujan, nítidos a cualquier zoom, los montes, los árboles, los ríos, los nombres, la ciudad, el
// título con su rosa de los vientos y la escala, y tu marca.
// Las zonas (valravnx, 4 nov): al acercarlo salen los lindes de las zonas de cada comarca (src/juego/mapa_zonas.js, que
// los saca a pasos en cuanto hacen falta) y, a cualquier zoom, tu tierra (la zona entera de tu mojón) de color, con su
// borde y el mojón.
// Las zonas tomadas (valravnx, 8 nov): las de los demás mojones, cada dueño de un color (apagado, el mismo para todos
// los que miran: sale de su autor) con su mojón; las de quien te ha invitado a construir, del color de la tuya y, de
// cerca, «Te han invitado». Sin nombres: el mapa no dice de quién es cada una.
// El continente (valravnx, 5 nov: «en el panel de admin ponme el mapa de todo el continente… que quiero poder explorar
// libre»): con una capa que lo pide (continente: true, la del panel del admin), el mapa es el del continente entero,
// con menos detalle por km (se hace la primera vez que se abre así), y se acerca y se mueve por todo él.
import { pintarMapaRey, COMARCA_REY, cuadroContinente, PX_KM_CONTINENTE } from './mapa_rey_pintar.js';
import { CIUDAD_REY } from '../logica/whitholm.js';
import { CONTINENTE, nombreRegion } from '../logica/mapa.js';
import { tr } from '../idioma.js';
import { crearZonasMapa, coloresDeDuenos, ROJO_TIERRA } from './mapa_zonas.js';
import { POR_QUE } from '../logica/zonas_rey.js';

const TINTA = '#3a2a1e', PAPEL = '#ead8ae', ROJO = '#8c2a1e', AGUA = '#45677a', ORO = [190, 140, 40];
const LETRA = 'Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';
const CSS = `
#mapaRey{position:fixed;inset:0;z-index:40;background:rgba(20,16,12,.94);touch-action:none}
#mapaRey canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab}
#mapaRey canvas.arrastrando{cursor:grabbing}
#mapaRey .mr-botones{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));display:flex;gap:6px}
#mapaRey .mr-botones button{padding:7px 12px;font-size:13px}
#mapaRey .mr-ayuda{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom,0px));font-size:12px;color:#d8c9a8;background:rgba(36,30,24,.7);padding:4px 10px;border-radius:8px;white-space:nowrap}
#mapaRey .mr-desplegando{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:italic 16px ${LETRA};color:#ead8ae}
`;

// Desde este zoom (px por km) salen los lindes de las zonas; del todo a partir de ZONAS_LLENO.
export const ZONAS_DESDE = 28, ZONAS_LLENO = 42;
// Hasta dónde se acerca (valravnx, 4 nov: «permitiría ampliar más»): 8 veces la isla entera o, si es más, 150 px por km
// (en el móvil, la isla entera es más pequeña y 8 veces se quedaba corto para ver tu zona).
export const ZOOM_MAX_PX_KM = 150;

export function montarMapaRey({ paisaje, comarcas, posicion, tuTierra = () => null, tomadas = () => [], zonasRey = [], alAbrir = () => {}, esTactil = false }) {
  const est = document.createElement('style'); est.textContent = CSS; document.head.appendChild(est);
  const raiz = document.createElement('div'); raiz.id = 'mapaRey'; raiz.hidden = true;
  raiz.innerHTML = `<canvas></canvas><div class="mr-desplegando" hidden></div>
    <div class="mr-botones"><button class="mr-yo"></button><button class="mr-cerrar">✕</button></div><div class="mr-ayuda"></div>`;
  document.body.appendChild(raiz);
  const lienzo = raiz.querySelector('canvas'), ctx = lienzo.getContext('2d');
  const aviso = raiz.querySelector('.mr-desplegando');
  raiz.querySelector('.mr-yo').textContent = tr('Dónde estoy');
  raiz.querySelector('.mr-cerrar').title = tr('Cerrar');
  raiz.querySelector('.mr-ayuda').textContent = esTactil ? tr('Arrastra para moverlo; dos dedos para acercarlo') : tr('Arrastra para moverlo, rueda para acercarlo; M o Esc para cerrar');
  aviso.textContent = tr('Desplegando el mapa…');

  // ---------- preparar el fondo a pasos ----------
  let gen = null, datos = null, fondo = null, msPintar = 0, msMaxPaso = 0, avance = 0;
  // datos y fondo son los del mapa que se ve: la isla (islaD, islaF) o, con una capa que lo pide, el continente
  let islaD = null, islaF = null, contD = null, contF = null, continente = false;
  const usar = () => { if (continente && contD) { datos = contD; fondo = contF; } else { datos = islaD; fondo = islaF; } };
  function paso(presupuesto) {
    if (islaD) return true;
    if (!gen) gen = pintarMapaRey(paisaje, comarcas, { filas: 4 });
    const t0 = performance.now();
    while (performance.now() - t0 < presupuesto) {
      const a = performance.now(), r = gen.next();
      msMaxPaso = Math.max(msMaxPaso, performance.now() - a);
      if (!r.done) avance = r.value.avance;
      if (r.done) { islaD = r.value; hacerFondo(); msPintar += performance.now() - t0; return true; }
    }
    msPintar += performance.now() - t0;
    return false;
  }
  // en segundo plano, en los huecos que deja el juego entre fotograma y fotograma (requestIdleCallback dice cuánto
  // queda de cada hueco; donde no lo hay, cada 16 ms). Cada vez, como mucho el 12 % del tiempo desde la vez anterior
  // (entre 6 y 40 ms): en un móvil que va a 60 fotogramas, unos 6 ms; en una máquina lenta, que tarda 300 ms en cada
  // fotograma, más, para que no tarde minutos
  let preparando = false;
  function preparar() {
    if (preparando || islaD) return;
    preparando = true;
    const hueco = typeof requestIdleCallback === 'function';
    let antes = performance.now();
    const programar = () => (hueco ? requestIdleCallback(seguir, { timeout: 120 }) : setTimeout(seguir, 16));
    const seguir = (dl) => {
      const ahora = performance.now(), porTiempo = Math.max(6, Math.min(40, (ahora - antes) * 0.12));
      const pres = dl && !dl.didTimeout ? Math.max(porTiempo, Math.min(14, dl.timeRemaining())) : porTiempo;
      const hecho = paso(pres); antes = performance.now();
      if (!hecho) programar();
    };
    programar();
  }
  // la imagen de unos datos, en un lienzo
  function lienzoDe(d) {
    const c = document.createElement('canvas'); c.width = d.ancho; c.height = d.alto;
    c.getContext('2d').putImageData(new ImageData(d.rgba, d.ancho, d.alto), 0, 0);
    return c;
  }
  // el continente: de una vez (la primera vez que se pide; unos segundos, como la isla)
  function hacerContinente() {
    if (contD) return;
    const g = pintarMapaRey(paisaje, comarcas, { cuadro: cuadroContinente(), pxKm: PX_KM_CONTINENTE, filas: 64 });
    let r; while (!(r = g.next()).done);
    contD = r.value; contF = lienzoDe(contD);
    contD.regiones = regionesDe(comarcas.mapa);
  }
  // dónde va el nombre de cada región del continente (en km): la celda de esa región más cercana a su centro
  function regionesDe(m) {
    if (!m || !m.pais) return [];
    const { N, lado, pais, tierra } = m, c = lado / N, suma = new Map();
    for (let i = 0; i < N * N; i++) {
      const k = pais[i]; if (k < 0 || !tierra[i]) continue;
      const v = suma.get(k) || [0, 0, 0]; v[0] += (i % N + 0.5) * c; v[1] += (Math.floor(i / N) + 0.5) * c; v[2]++; suma.set(k, v);
    }
    const r = [];
    for (const [k, [sx, sy, n]] of suma) {
      const cx = sx / n, cy = sy / n; let mejor = null, dm = Infinity;
      for (let i = 0; i < N * N; i++) if (pais[i] === k && tierra[i]) {
        const x = (i % N + 0.5) * c, y = (Math.floor(i / N) + 0.5) * c, d = Math.hypot(x - cx, y - cy);
        if (d < dm) { dm = d; mejor = [x, y]; }
      }
      const nombre = nombreRegion(m, k);
      if (mejor && nombre) r.push({ k, isla: k === m.paisIsla, x: mejor[0], y: mejor[1], nombre });
    }
    return r;
  }
  // los nombres de las regiones del continente (Whitholm lleva el suyo encima de la isla): grandes de lejos, y se van
  // desvaneciendo al acercarse, cuando salen los de las comarcas
  const aRegiones = (s) => (datos === contD ? Math.max(0, Math.min(1, (vista.base * 3.2 - s) / (vista.base * 1.4))) : 0);
  function regiones(s) {
    if (datos !== contD || !contD.regiones) return;
    const a = aRegiones(s);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    // (del tamaño del mapa: en el móvil, el continente entero mide unos 370 px y los nombres grandes se pisaban)
    const px = Math.max(10, Math.min(28, s * 3.6));
    for (const e of contD.regiones) {
      const [x, y] = kmAPant(e.x, e.y);
      etiqueta(tr(e.nombre).toUpperCase(), x, y, px, '700', e.isla ? ROJO : TINTA, px * 0.16);
    }
    ctx.restore();
  }
  function hacerFondo() {
    // lo que es tierra, de la imagen del mapa: los lindes de las zonas no van por el agua
    const d = islaD;
    zonas.ponerTierra((x, y) => { const px = Math.floor((x - d.cuadro.x0) * d.pxKm), py = Math.floor((y - d.cuadro.y0) * d.pxKm);
      return px >= 0 && py >= 0 && px < d.ancho && py < d.alto && d.tierra[py * d.ancho + px] === 1; });
    islaF = lienzoDe(d); usar();
  }

  // ---------- las zonas: los lindes, a pasos y solo lo que se ve; tu tierra, una vez ----------
  const zonas = crearZonasMapa(comarcas);
  let trabajando = null;
  function trabajarZonas() {
    if (trabajando || raiz.hidden) return;
    trabajando = setTimeout(() => {
      trabajando = null;
      if (raiz.hidden) return;
      if (zonas.paso(12)) pintar();
      if (zonas.pendientes) trabajarZonas();
    }, 0);
  }
  // la máscara de una zona (tu tierra, una del rey o una tomada), pintada en un lienzo de su color (una vez por máscara
  // y color)
  const lienzos = new WeakMap();
  function tierraDe(t, rgb = ROJO_TIERRA) {
    let porColor = lienzos.get(t.mascara);
    if (!porColor) { porColor = new Map(); lienzos.set(t.mascara, porColor); }
    const k = rgb.join(',');
    if (porColor.has(k)) return porColor.get(k);
    const c = document.createElement('canvas'); c.width = t.n; c.height = t.n;
    const g = c.getContext('2d'), img = g.createImageData(t.n, t.n);
    for (let k = 0; k < t.mascara.length; k++) if (t.mascara[k]) { img.data[k * 4] = rgb[0]; img.data[k * 4 + 1] = rgb[1]; img.data[k * 4 + 2] = rgb[2]; img.data[k * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    porColor.set(k, c);
    return c;
  }

  // ---------- vista: km del mundo → píxeles de pantalla ----------
  const vista = { s: 1, x: 0, y: 0 };   // px por km y dónde cae el km (0, 0)
  const kmAPant = (x, y) => [vista.x + x * vista.s, vista.y + y * vista.s];
  const pantAKm = (x, y) => [(x - vista.x) / vista.s, (y - vista.y) / vista.s];
  let margen = () => ({ arriba: 0, abajo: 0 });
  let capa = null;   // { pintar(ctx, { kmAPant, s, etiqueta }), clic(x, z) en m del mundo, alCerrar() }
  function encuadrar() {
    // (margen: lo que tapan arriba y abajo las pestañas y el pie del menú del juego, que lo pone con ponerMargen)
    const W = innerWidth, cu = datos.cuadro, m = 8, mg = margen(), H = innerHeight - mg.arriba - mg.abajo;
    vista.s = Math.min((W - 2 * m) / (cu.x1 - cu.x0), (H - 2 * m) / (cu.y1 - cu.y0));
    vista.x = (W - (cu.x1 - cu.x0) * vista.s) / 2 - cu.x0 * vista.s;
    vista.y = mg.arriba + (H - (cu.y1 - cu.y0) * vista.s) / 2 - cu.y0 * vista.s;
    vista.base = vista.s;
  }
  function limitar() {
    const cu = datos.cuadro, W = innerWidth, H = innerHeight;
    vista.s = zoomValido(vista.s);
    const [ax, ay] = kmAPant(cu.x0, cu.y0), [bx, by] = kmAPant(cu.x1, cu.y1);
    // el papel no se puede sacar de la pantalla: su borde entra como mucho hasta el 45 % (así cualquier sitio de la isla
    // se puede poner en el centro); entero, va centrado
    const hx = W * 0.45, hy = H * 0.45;
    if (bx - ax <= W) vista.x += (W - bx - ax) / 2; else { if (ax > hx) vista.x -= ax - hx; if (bx < W - hx) vista.x += W - hx - bx; }
    if (by - ay <= H) vista.y += (H - by - ay) / 2; else { if (ay > hy) vista.y -= ay - hy; if (by < H - hy) vista.y += H - hy - by; }
  }
  const zoomValido = (s) => Math.max(vista.base, Math.min(Math.max(vista.base * 8, ZOOM_MAX_PX_KM), s));
  // acerca o aleja dejando quieto el punto (cx, cy) de la pantalla; el papel se recoloca después (antes se recolocaba
  // también a medias, y un acercamiento grande saltaba al borde del pliego)
  function zoom(f, cx, cy) {
    const s0 = vista.s, k = zoomValido(s0 * f) / s0;
    vista.s = s0 * k; vista.x = cx - (cx - vista.x) * k; vista.y = cy - (cy - vista.y) * k; limitar(); pintar();
  }
  // pone el sitio (en km) en el centro, con el zoom f veces el de la isla entera
  function centrarEn(x, y, f) {
    vista.s = vista.base * f; limitar();
    vista.x = innerWidth / 2 - x * vista.s; vista.y = innerHeight / 2 - y * vista.s; limitar(); pintar();
  }
  // al abrirlo: la isla entera; el continente, centrado en ti y a la escala de la isla entera (alejándolo se ve todo)
  function encuadrarAqui() {
    encuadrar();
    if (datos !== contD || !islaD) { pintar(); return; }
    const p = posicion(), cu = contD.cuadro, ci = islaD.cuadro;
    const f = Math.min((cu.x1 - cu.x0) / (ci.x1 - ci.x0), (cu.y1 - cu.y0) / (ci.y1 - ci.y0));
    centrarEn(p ? p.x / 1000 : (ci.x0 + ci.x1) / 2, p ? p.z / 1000 : (ci.y0 + ci.y1) / 2, f);
  }
  function centrarEnMi() {
    const p = posicion(); if (!p) return;
    vista.s = Math.max(vista.s, vista.base * 3); limitar();
    vista.x = innerWidth / 2 - p.x / 1000 * vista.s; vista.y = innerHeight / 2 - p.z / 1000 * vista.s; limitar(); pintar();
  }

  // ---------- dibujar ----------
  function pintar() {
    if (raiz.hidden || !datos) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    if (lienzo.width !== Math.round(W * dpr) || lienzo.height !== Math.round(H * dpr)) { lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cu = datos.cuadro, s = vista.s, [ox, oy] = kmAPant(cu.x0, cu.y0), aw = (cu.x1 - cu.x0) * s, ah = (cu.y1 - cu.y0) * s;
    // el pliego, con su sombra
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; ctx.fillStyle = PAPEL; ctx.fillRect(ox, oy, aw, ah); ctx.restore();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fondo, ox, oy, aw, ah);
    const t = s / datos.pxKm;   // cuántos px de pantalla por px del fondo
    pliego = [ox, oy, ox + aw, oy + ah];
    const tierra = miTierra(), rey = zonasDelRey(), otras = zonasTomadas(tierra);
    for (const r of rey) tierraColor(r, ORO, 0.34);
    for (const o of otras) tierraColor(o, o.rgb, o.invita ? 0.3 : 0.32);
    if (tierra) tierraColor(tierra);
    lineas(s); lindesZonas(s); for (const r of rey) tierraBorde(r, s, 'rgba(128,88,18,.95)', true);
    for (const o of otras) tierraBorde(o, s, o.invita ? 'rgba(150,34,22,.95)' : `rgba(${o.rgb.map(c => Math.round(c * 0.7)).join(',')},.95)`);
    if (tierra) tierraBorde(tierra, s);
    rios(s); montes(s); arboles(s, t); ciudad(s); nombres(s); regiones(s);
    reyNombres(rey, s);
    for (const o of otras) mojonOtro(o, s);
    if (tierra) mojon(s);
    marco(ox, oy, aw, ah, s);
    if (capa && capa.pintar) capa.pintar(ctx, { kmAPant, s, etiqueta });
    jugador(s);
  }
  // un tamaño en km, pasado a px, con un mínimo para que de lejos se siga viendo
  const tam = (km, s, min) => Math.max(min, km * s);

  // la costa entintada y las fronteras de las comarcas, de rayas, como líneas (nítidas a cualquier zoom)
  function trazo(l) { ctx.beginPath(); l.forEach(([x, y], k) => { const [a, b] = kmAPant(x, y); if (k) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.stroke(); }
  function lineas(s) {
    const z = Math.sqrt(s / vista.base);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.min(1.6, 0.8 * z);
    for (const { fuerza, l } of datos.agua) { ctx.strokeStyle = `rgba(56,80,90,${fuerza})`; trazo(l); }
    ctx.strokeStyle = 'rgba(122,40,28,.9)'; ctx.lineWidth = Math.min(2.6, 1.1 * z); ctx.setLineDash([5 * z, 3.5 * z]);
    for (const l of datos.fronteras) trazo(l);
    ctx.setLineDash([]);
    ctx.strokeStyle = TINTA; ctx.lineWidth = Math.min(2.8, 1.2 * z);
    for (const l of datos.costa) trazo(l);
  }
  // los lindes de las zonas, a trazo fino de tinta, al acercarse (de ZONAS_DESDE a ZONAS_LLENO van apareciendo)
  let lindesVistos = 0;
  function lindesZonas(s) {
    lindesVistos = 0;
    if (s < ZONAS_DESDE || window.__mutarZonasMapa) return;   // (la prueba lo rompe a propósito: sin lindes)
    const a = Math.min(1, (s - ZONAS_DESDE) / (ZONAS_LLENO - ZONAS_DESDE));
    const [x0, z0] = pantAKm(0, 0), [x1, z1] = pantAKm(innerWidth, innerHeight);
    const { hay, faltan } = zonas.visibles(x0, z0, x1, z1);
    if (faltan) trabajarZonas();
    ctx.strokeStyle = `rgba(58,42,30,${(0.5 * a).toFixed(3)})`; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    for (const seg of hay) for (let k = 0; k < seg.length; k += 4) {
      const [ax, ay] = kmAPant(seg[k], seg[k + 1]), [bx, by] = kmAPant(seg[k + 2], seg[k + 3]);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); lindesVistos++;
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // tu tierra: la zona entera de tu mojón (en m del mundo, tuTierra()), de color y con su borde
  let tierraVista = null;
  function miTierra() {
    const m = tuTierra(); tierraVista = null; mojonVisto = null;
    if (!m) return null;
    const t = zonas.tierra(m.x, m.z);
    if (t) tierraVista = { zona: t.zona, x: m.x, z: m.z };
    return t ? { ...t, mx: m.x, mz: m.z } : null;
  }
  function tierraColor(t, rgb, alfa = 0.3) {
    const c = tierraDe(t, rgb), h = t.h, [ax, ay] = kmAPant(t.x0 - h / 2, t.z0 - h / 2), [bx, by] = kmAPant(t.x0 - h / 2 + t.n * h, t.z0 - h / 2 + t.n * h);
    ctx.save(); ctx.globalAlpha = alfa; ctx.imageSmoothingEnabled = true; ctx.drawImage(c, ax, ay, bx - ax, by - ay); ctx.restore();
  }
  function tierraBorde(t, s, color = 'rgba(150,34,22,.95)', rayas = false) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, Math.min(3, s / 18)); ctx.lineCap = 'round';
    if (rayas) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let k = 0; k < t.segs.length; k += 4) {
      const [ax, ay] = kmAPant(t.segs[k], t.segs[k + 1]), [bx, by] = kmAPant(t.segs[k + 2], t.segs[k + 3]);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // las zonas tomadas por los demás mojones (valravnx, 8 nov; tomadas(): { x, z en m del mundo, dueno, invita }): cada
  // una del color de su dueño (coloresDeDuenos, con la tuya contada para que salgan iguales para todos); las de quien te
  // ha invitado, del tuyo. La tuya va aparte (miTierra), y si una cae en tu
  // misma zona no se pinta dos veces
  let tomadasVistas = [];
  function zonasTomadas(tierra) {
    tomadasVistas = [];
    if (window.__mutarTomadasMapa) return [];   // (la prueba lo rompe a propósito: sin las zonas tomadas)
    const todas = tomadas() || [], colores = coloresDeDuenos(todas.map(o => o.dueno));
    const out = zonas.tomadas(todas.filter(o => !o.tuya)).filter(o => !tierra || o.zona !== tierra.zona)
      .map(o => ({ ...o, rgb: o.invita ? ROJO_TIERRA : colores.get(o.dueno) }));
    tomadasVistas = out.map(o => ({ zona: o.zona, invita: o.invita, rgb: o.rgb, mojon: null }));
    return out;
  }
  // el mojón de una zona tomada, como el tuyo pero con el color de su dueño; de cerca, si te ha invitado, «Te han invitado»
  function mojonOtro(o, s) {
    const [x, y] = kmAPant(o.mx / 1000, o.mz / 1000), r = Math.max(5, Math.min(9, s * 0.18));
    const v = tomadasVistas.find(t => t.zona === o.zona); if (v) v.mojon = { x, y };
    const borde = o.invita ? ROJO : `rgb(${o.rgb.map(c => Math.round(c * 0.75)).join(',')})`;
    piedra(x, y, r, borde);
    if (o.invita && s >= ZONAS_DESDE) etiqueta(tr('Te han invitado'), x, y + r * 0.9 + 9, 12, 'italic 700', ROJO);
  }
  // las zonas del rey (valravnx, 4 nov: la de la gran veta, la de la ciudad y la de la salida; src/logica/zonas_rey.js):
  // de oro viejo, con el borde a rayas y, de cerca, «Zona del rey» y por qué. No se reclaman; en ellas recoge cualquiera.
  let reyVistas = [];
  function zonasDelRey() { return zonasRey && zonasRey.length && !window.__mutarZonasRey ? zonas.rey(zonasRey) : []; }   // (la prueba lo rompe a propósito)
  function reyNombres(rey, s) {
    reyVistas = rey.map(r => ({ id: r.zona, por: r.por }));
    if (s < ZONAS_DESDE) return;
    for (const r of rey) {
      // el letrero, en lo alto de la zona (por encima de su sitio, para no tapar la ciudad ni tu mojón)
      let zmin = Infinity, xs = 0, n = 0;
      for (let j = 0; j < r.n && zmin === Infinity; j++) for (let i = 0; i < r.n; i++) if (r.mascara[j * r.n + i]) { zmin = r.z0 + j * r.h; xs += r.x0 + i * r.h; n++; }
      if (!n) continue;
      const [x, y] = kmAPant(xs / n, zmin + 0.12);
      etiqueta(tr('Zona del rey'), x, y + 8, 13, 'italic 700', '#6e4a0e');
      etiqueta(tr(POR_QUE[r.por] || ''), x, y + 24, 11, 'italic 400', '#6e4a0e');
    }
  }
  // tu mojón: una piedra hincada, de perfil, y de cerca «Tu tierra»
  let mojonVisto = null;
  function mojon(s) {
    const m = tierraVista; if (!m) return;
    const [x, y] = kmAPant(m.x / 1000, m.z / 1000), r = Math.max(6, Math.min(11, s * 0.22));
    mojonVisto = { x, y };
    piedra(x, y, r, ROJO);
    if (s >= ZONAS_DESDE) etiqueta(tr('Tu tierra'), x, y + r * 0.9 + 9, 13, 'italic 700', ROJO);
  }
  // una piedra hincada, de perfil, con su cruz labrada y su sombra, con el borde del color dado
  function piedra(x, y, r, color) {
    ctx.save(); ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(70,50,34,.3)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.95, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.5, y - r * 1.5); ctx.quadraticCurveTo(x, y - r * 2.15, x + r * 0.5, y - r * 1.5); ctx.lineTo(x + r * 0.5, y); ctx.closePath();
    ctx.fillStyle = '#d9c7a0'; ctx.fill(); ctx.lineWidth = Math.max(1.4, r / 5); ctx.strokeStyle = color; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * 0.22, y - r * 1.1); ctx.lineTo(x + r * 0.22, y - r * 1.1); ctx.moveTo(x, y - r * 1.35); ctx.lineTo(x, y - r * 0.85); ctx.lineWidth = Math.max(1, r / 7); ctx.stroke();   // la cruz labrada
    ctx.restore();
  }
  function rios(s) {
    ctx.strokeStyle = AGUA; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const z = Math.sqrt(s / vista.base);
    for (const r of datos.rios) for (let k = 0; k < r.length - 1; k++) {
      const a = r[k], b = r[k + 1];
      ctx.lineWidth = Math.min(3.6, 0.55 + Math.sqrt(Math.max(a[2], 2)) / 4.5) * z;
      const [x1, y1] = kmAPant(a[0], a[1]), [x2, y2] = kmAPant(b[0], b[1]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  // montes de perfil: la ladera del lado de la luz (noroeste, a la izquierda) en papel y la de la sombra rayada
  function montes(s) {
    for (const [x, y, a] of datos.montes) {
      const w = tam(0.95 + 0.75 * a, s, 7), h = w * (0.5 + 0.35 * a), [cx, cy] = kmAPant(x, y);
      const l = cx - w / 2, r = cx + w / 2, pk = cx + w * 0.06, top = cy - h;
      ctx.beginPath(); ctx.moveTo(l, cy); ctx.quadraticCurveTo(cx - w * 0.22, cy - h * 0.55, pk, top); ctx.quadraticCurveTo(cx + w * 0.24, cy - h * 0.5, r, cy); ctx.closePath();
      ctx.fillStyle = 'rgba(226,206,164,.94)'; ctx.fill();
      // la sombra: la mitad derecha, rayada
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(96,70,46,.34)'; ctx.fillRect(pk, top, r - pk, h);
      ctx.strokeStyle = 'rgba(70,50,34,.55)'; ctx.lineWidth = Math.max(0.6, w / 40);
      const n = Math.max(3, Math.round(w / 4));
      for (let k = 1; k <= n; k++) { const u = k / (n + 1), x0 = pk + (r - pk) * u * 0.9; ctx.beginPath(); ctx.moveTo(x0, top + h * 0.15 + h * u * 0.4); ctx.lineTo(x0 + w * 0.06, cy); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = TINTA; ctx.lineWidth = Math.max(0.8, w / 26);
      ctx.beginPath(); ctx.moveTo(l, cy); ctx.quadraticCurveTo(cx - w * 0.22, cy - h * 0.55, pk, top); ctx.quadraticCurveTo(cx + w * 0.24, cy - h * 0.5, r, cy); ctx.stroke();
    }
  }
  // árboles: copa redonda (caducifolios, encinas) o en punta (coníferas), con su tronco; de lejos, menos y más pequeños
  function arboles(s, t) {
    const r0 = tam(0.2, s, 2.2), salto = s < vista.base * 1.6 ? 2 : 1;
    ctx.lineWidth = Math.max(0.6, r0 / 5); ctx.strokeStyle = 'rgba(40,46,28,.85)';
    for (let k = 0; k < datos.arboles.length; k += salto) {
      const [x, y, tipo] = datos.arboles[k], [cx, cy] = kmAPant(x, y);
      if (cx < -10 || cy < -10 || cx > innerWidth + 10 || cy > innerHeight + 10) continue;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r0 * 0.7); ctx.stroke();   // el tronco
      ctx.beginPath();
      if (tipo === 'conifera') { ctx.moveTo(cx - r0 * 0.7, cy - r0 * 0.5); ctx.lineTo(cx, cy - r0 * 2.4); ctx.lineTo(cx + r0 * 0.7, cy - r0 * 0.5); ctx.closePath(); ctx.fillStyle = 'rgba(70,92,62,.9)'; }
      else { ctx.arc(cx, cy - r0 * 1.25, r0 * 0.85, 0, Math.PI * 2); ctx.fillStyle = 'rgba(104,122,66,.9)'; }
      ctx.fill(); ctx.stroke();
    }
  }
  // la ciudad del rey: una villa amurallada de perfil, como en las cartas: lienzo de muralla con almenas, dos torres
  // en los extremos y, detrás, la torre del rey y los tejados rojos de las casas, sobre su sombra
  function ciudad(s) {
    const [cx, cy] = kmAPant(CIUDAD_REY.x / 1000, CIUDAD_REY.z / 1000), r = tam(0.5, s, 13);
    const piedra = '#e6d2a6', tinta = TINTA, teja = '#a8432c';
    ctx.save(); ctx.lineJoin = 'miter'; ctx.lineWidth = Math.max(1, r / 14); ctx.strokeStyle = tinta;
    ctx.fillStyle = 'rgba(70,50,34,.22)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.05, r * 1.25, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    const caja = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); };
    const tejado = (x, y, w, h) => { ctx.fillStyle = teja; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    // detrás: casas y la torre del rey
    caja(cx - r * 0.75, cy - r * 0.75, r * 0.45, r * 0.4, piedra); tejado(cx - r * 0.8, cy - r * 0.75, r * 0.55, r * 0.32);
    caja(cx + r * 0.32, cy - r * 0.7, r * 0.42, r * 0.35, piedra); tejado(cx + r * 0.27, cy - r * 0.7, r * 0.52, r * 0.3);
    caja(cx - r * 0.18, cy - r * 1.2, r * 0.36, r * 0.85, piedra); tejado(cx - r * 0.25, cy - r * 1.2, r * 0.5, r * 0.5);
    ctx.fillStyle = ROJO; ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.7); ctx.lineTo(cx, cy - r * 1.95); ctx.lineTo(cx + r * 0.28, cy - r * 1.86); ctx.lineTo(cx, cy - r * 1.78); ctx.fill();   // el pendón
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.7); ctx.lineTo(cx, cy - r * 1.95); ctx.stroke();
    // delante: la muralla con almenas y sus dos torres
    caja(cx - r, cy - r * 0.42, r * 2, r * 0.42, piedra);
    ctx.fillStyle = piedra;
    for (let k = 0; k < 5; k++) caja(cx - r * 0.7 + k * r * 0.33, cy - r * 0.54, r * 0.16, r * 0.12, piedra);
    for (const x of [cx - r * 1.12, cx + r * 0.78]) { caja(x, cy - r * 0.78, r * 0.34, r * 0.78, piedra); tejado(x - r * 0.04, cy - r * 0.78, r * 0.42, r * 0.34); }
    ctx.fillStyle = tinta; ctx.beginPath(); ctx.moveTo(cx - r * 0.13, cy); ctx.lineTo(cx - r * 0.13, cy - r * 0.2); ctx.arc(cx, cy - r * 0.2, r * 0.13, Math.PI, 0); ctx.lineTo(cx + r * 0.13, cy); ctx.fill();   // la puerta
    ctx.restore();
    etiqueta(tr('Ciudad del rey'), cx, cy + Math.max(12, r * 0.75), Math.max(12, Math.min(19, r * 0.9)), 'italic 700', ROJO);
  }
  // un texto con su halo de papel; nunca se sale del pliego (si no cabe donde va, se corre hacia dentro)
  let pliego = null;
  function etiqueta(texto, x, y, px, peso, color, espacio = 0) {
    ctx.font = `${peso} ${px}px ${LETRA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${espacio}px`;
    if (pliego) {
      const m = ctx.measureText(texto).width / 2 + 4, a = pliego[0] + 12 + m, b = pliego[2] - 12 - m;
      x = a > b ? (pliego[0] + pliego[2]) / 2 : Math.max(a, Math.min(b, x));
    }
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 3.2); ctx.strokeStyle = 'rgba(236,222,186,.9)'; ctx.strokeText(texto, x, y);
    ctx.fillStyle = color; ctx.fillText(texto, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  // los nombres de las comarcas: de cerca tapaban tu tierra (valravnx, 4 nov), así que se van desvaneciendo mientras
  // aparecen los lindes de las zonas y desde ZONAS_LLENO no salen
  let nombresVistos = 1;
  function nombres(s) {
    nombresVistos = window.__mutarNombresMapa ? 1 : Math.max(0, Math.min(1, (ZONAS_LLENO - s) / (ZONAS_LLENO - ZONAS_DESDE)));
    nombresVistos *= 1 - aRegiones(s);   // (en el continente, de lejos, van los de las regiones)
    if (nombresVistos <= 0) return;
    ctx.save(); ctx.globalAlpha = nombresVistos;
    try { nombresDentro(s); } finally { ctx.restore(); }
  }
  function nombresDentro(s) {
    const px = Math.max(12, Math.min(30, s * 0.62));
    for (const e of datos.etiquetas) {
      const [x, y] = kmAPant(e.x, e.y), n = comarcas.nombres[e.k];
      etiqueta(tr(n).toUpperCase(), x, y, px, '600', TINTA, px * 0.18);
      if (e.k === COMARCA_REY) etiqueta(tr('tierras del rey'), x, y + px * 1.05, Math.max(10, px * 0.68), 'italic 700', ROJO);
    }
  }
  // el marco del pliego, el título con la rosa de los vientos y la escala, en el mar de las esquinas
  function marco(ox, oy, aw, ah, s) {
    ctx.strokeStyle = TINTA; ctx.lineWidth = 2.2; ctx.strokeRect(ox + 5, oy + 5, aw - 10, ah - 10);
    ctx.lineWidth = 0.8; ctx.strokeRect(ox + 9, oy + 9, aw - 18, ah - 18);
    const u = Math.max(0.7, Math.min(2.2, s / 9));   // tamaño de lo del marco
    // el título, arriba a la izquierda (mar abierto), siempre dentro del pliego
    const cont = datos === contD, titulo = tr(cont ? CONTINENTE : 'Whitholm').toUpperCase(), tp = 26 * u;
    ctx.font = `700 ${tp}px ${LETRA}`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${5 * u}px`;
    const ancho = ctx.measureText(titulo).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const tx = ox + 22 + ancho / 2, ty = oy + 22 + tp * 0.7;
    etiqueta(titulo, tx, ty, tp, '700', TINTA, 5 * u);
    ctx.strokeStyle = TINTA; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(tx - ancho * 0.45, ty + tp * 0.5); ctx.lineTo(tx + ancho * 0.45, ty + tp * 0.5); ctx.stroke();
    etiqueta(tr(cont ? 'el continente' : 'la isla del rey'), tx, ty + tp * 0.95, 14 * u, 'italic 600', ROJO);
    // la rosa de los vientos, abajo a la izquierda
    const rx = ox + 48 * u, ry = oy + ah - 56 * u, R = 30 * u;
    ctx.save(); ctx.translate(rx, ry);
    ctx.strokeStyle = TINTA; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const largo = k % 2 ? R * 0.55 : R, a = k * Math.PI / 4;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -largo); ctx.lineTo(largo * 0.14, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = k === 0 ? ROJO : TINTA; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -largo); ctx.lineTo(-largo * 0.14, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = PAPEL; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    etiqueta('N', rx, ry - R - 9 * u, 13 * u, '700', ROJO);
    // la escala: 5 km a tramos, abajo a la derecha
    const km = s < 4 ? 50 : s < 10 ? 10 : s < 30 ? 5 : 2, largo = km * s, ex = ox + aw - 24 * u - largo, ey = oy + ah - 26 * u;
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? PAPEL : TINTA; ctx.fillRect(ex + largo * k / 4, ey, largo / 4, 5 * u); }
    ctx.strokeStyle = TINTA; ctx.lineWidth = 0.8; ctx.strokeRect(ex, ey, largo, 5 * u);
    etiqueta(`${km} km`, ex + largo / 2, ey - 9 * u, 11 * u, 'italic 600', TINTA);
  }
  // tú: una flecha roja hacia donde miras, con un círculo alrededor para encontrarla de un vistazo
  let marca = null;
  function jugador(s) {
    const p = posicion(); if (!p) { marca = null; return; }
    if (window.__mutarMapaRey) p.x += 3000;   // (la prueba lo rompe a propósito: la marca, 3 km al este)
    const [x, y] = kmAPant(p.x / 1000, p.z / 1000), R = Math.max(9, Math.min(16, s * 0.5));
    marca = { x, y };
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(140,30,22,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * 1.6, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(Math.atan2(Math.cos(p.rot), Math.sin(p.rot)) - Math.PI / 2 + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(R * 0.62, R * 0.72); ctx.lineTo(0, R * 0.38); ctx.lineTo(-R * 0.62, R * 0.72); ctx.closePath();
    ctx.fillStyle = '#b3261c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f4e6c2'; ctx.stroke();
    ctx.restore();
  }

  // ---------- abrir, cerrar, arrastrar y acercar ----------
  let reloj = null;
  function abrir() {
    if (!raiz.hidden) return;
    alAbrir();
    raiz.hidden = false;
    if (!islaD || (continente && !contD)) { aviso.hidden = false; requestAnimationFrame(() => setTimeout(() => { while (!paso(1000)); if (continente) hacerContinente(); usar(); aviso.hidden = true; encuadrarAqui(); }, 0)); }
    else { usar(); encuadrarAqui(); }
    clearInterval(reloj); reloj = setInterval(pintar, 250);   // tu marca se mueve si andas con el mapa abierto
  }
  function cerrar() { if (raiz.hidden) return; raiz.hidden = true; clearInterval(reloj); reloj = null; if (capa && capa.alCerrar) capa.alCerrar(); }
  const alternar = () => (raiz.hidden ? abrir() : cerrar());
  raiz.querySelector('.mr-cerrar').addEventListener('click', cerrar);
  raiz.querySelector('.mr-yo').addEventListener('click', () => { if (datos) centrarEnMi(); });

  const dedos = new Map(); let pinza = 0, toque = null;   // toque: dónde empezó un clic (si no se arrastra, es un clic)
  lienzo.addEventListener('pointerdown', (e) => {
    lienzo.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); lienzo.classList.add('arrastrando');
    toque = dedos.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinza = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  lienzo.addEventListener('pointermove', (e) => {
    const d = dedos.get(e.pointerId); if (!d || !datos) return;
    if (toque && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) >= 6) toque = null;
    if (dedos.size === 2) {
      d.x = e.clientX; d.y = e.clientY;
      const [a, b] = [...dedos.values()], n = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinza > 0) zoom(n / pinza, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinza = n; return;
    }
    vista.x += e.clientX - d.x; vista.y += e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; limitar(); pintar();
  });
  const soltar = (e) => {
    if (e.type === 'pointerup' && toque && dedos.size === 1 && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 6 && capa && capa.clic && datos) {
      const [x, y] = pantAKm(e.clientX, e.clientY); capa.clic(x * 1000, y * 1000);
    }
    if (dedos.size !== 1) toque = null;
    dedos.delete(e.pointerId); pinza = 0; if (!dedos.size) lienzo.classList.remove('arrastrando'); };
  lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('wheel', (e) => { e.preventDefault(); if (datos) zoom(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  addEventListener('resize', () => { if (!raiz.hidden && datos) { encuadrar(); pintar(); } });

  return {
    abrir, cerrar, alternar, preparar, centrarEnMi, centrarEn, zoom, pantAKm,
    ponerMargen(f) { margen = f; },
    ponerCapa(c) {
      capa = c; lienzo.style.cursor = c && c.clic ? 'crosshair' : '';
      // la del panel del admin pide el continente; sin ella, la isla (si ya está abierto, se vuelve a encuadrar)
      const antes = continente; continente = !!(c && c.continente);
      if (continente !== antes && !raiz.hidden) { if (continente && !contD) { cerrar(); abrir(); return; } usar(); if (datos) { encuadrarAqui(); return; } }
      pintar();
    }, pintar: () => pintar(), get continente() { return continente && datos === contD; },
    get abierto() { return !raiz.hidden; }, get listo() { return !!datos; }, get datos() { return datos; },
    get vista() { return { ...vista }; }, get marca() { return marca; }, kmAPant,
    // las zonas: cuántos segmentos de lindes se han trazado en la última vez, cuántas teselas faltan y tu tierra
    get zonas() { return { lindes: lindesVistos, pendientes: zonas.pendientes, hechas: zonas.hechas, tierra: tierraVista, mojon: mojonVisto, desde: ZONAS_DESDE, nombres: nombresVistos, rey: reyVistas, tomadas: tomadasVistas }; },
    get medida() { return { msPintar: Math.round(msPintar), msMaxPaso: Math.round(msMaxPaso), avance: datos ? 1 : Math.round(avance * 100) / 100 }; },
  };
}
