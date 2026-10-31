// Kinhold — el mapa del rey en el juego (valravnx, 31 oct): Whitholm es la isla del rey y está cartografiada; el mapa se
// lleva desde que apareces. Se abre con M (o el botón «Mapa» en el móvil) y enseña la costa, las comarcas con su
// nombre, los ríos, la ciudad del rey (en Strandvang) y dónde estás tú, con hacia dónde miras. Sin viaje rápido: solo se
// mira. Se arrastra para moverlo y se acerca con la rueda o con dos dedos.
//
// La imagen de fondo (papel, mar, tierra, fronteras) la calcula src/juego/mapa_rey_pintar.js a pasos cortos en cuanto
// el mundo está listo, sin parar el juego; si lo abres antes de que acabe, se termina de golpe («Desplegando el
// mapa…»). Encima se dibujan, nítidos a cualquier zoom, los montes, los árboles, los ríos, los nombres, la ciudad, el
// título con su rosa de los vientos y la escala, y tu marca.
import { pintarMapaRey, COMARCA_REY } from './mapa_rey_pintar.js';
import { CIUDAD_REY } from '../logica/whitholm.js';
import { tr } from '../idioma.js';

const TINTA = '#3a2a1e', PAPEL = '#ead8ae', ROJO = '#8c2a1e', AGUA = '#45677a';
const LETRA = 'Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';
const CSS = `
#mapaRey{position:fixed;inset:0;z-index:40;background:rgba(20,16,12,.82);touch-action:none}
#mapaRey canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab}
#mapaRey canvas.arrastrando{cursor:grabbing}
#mapaRey .mr-botones{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));display:flex;gap:6px}
#mapaRey .mr-botones button{padding:7px 12px;font-size:13px}
#mapaRey .mr-ayuda{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom,0px));font-size:12px;color:#d8c9a8;background:rgba(36,30,24,.7);padding:4px 10px;border-radius:8px;white-space:nowrap}
#mapaRey .mr-desplegando{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:italic 16px ${LETRA};color:#ead8ae}
`;

export function montarMapaRey({ paisaje, comarcas, posicion, alAbrir = () => {}, esTactil = false }) {
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
  function paso(presupuesto) {
    if (datos) return true;
    if (!gen) gen = pintarMapaRey(paisaje, comarcas, { filas: 4 });
    const t0 = performance.now();
    while (performance.now() - t0 < presupuesto) {
      const a = performance.now(), r = gen.next();
      msMaxPaso = Math.max(msMaxPaso, performance.now() - a);
      if (!r.done) avance = r.value.avance;
      if (r.done) { datos = r.value; hacerFondo(); msPintar += performance.now() - t0; return true; }
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
    if (preparando || datos) return;
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
  function hacerFondo() {
    const c = document.createElement('canvas'); c.width = datos.ancho; c.height = datos.alto;
    c.getContext('2d').putImageData(new ImageData(datos.rgba, datos.ancho, datos.alto), 0, 0);
    fondo = c;
  }

  // ---------- vista: km del mundo → píxeles de pantalla ----------
  const vista = { s: 1, x: 0, y: 0 };   // px por km y dónde cae el km (0, 0)
  const kmAPant = (x, y) => [vista.x + x * vista.s, vista.y + y * vista.s];
  function encuadrar() {
    const W = innerWidth, H = innerHeight, cu = datos.cuadro, m = 8;
    vista.s = Math.min((W - 2 * m) / (cu.x1 - cu.x0), (H - 2 * m) / (cu.y1 - cu.y0));
    vista.x = (W - (cu.x1 - cu.x0) * vista.s) / 2 - cu.x0 * vista.s;
    vista.y = (H - (cu.y1 - cu.y0) * vista.s) / 2 - cu.y0 * vista.s;
    vista.base = vista.s;
  }
  function limitar() {
    const cu = datos.cuadro, W = innerWidth, H = innerHeight;
    vista.s = Math.max(vista.base, Math.min(vista.base * 8, vista.s));
    const [ax, ay] = kmAPant(cu.x0, cu.y0), [bx, by] = kmAPant(cu.x1, cu.y1);
    // el papel no se puede sacar de la pantalla: su borde entra como mucho hasta el 45 % (así cualquier sitio de la isla
    // se puede poner en el centro); entero, va centrado
    const hx = W * 0.45, hy = H * 0.45;
    if (bx - ax <= W) vista.x += (W - bx - ax) / 2; else { if (ax > hx) vista.x -= ax - hx; if (bx < W - hx) vista.x += W - hx - bx; }
    if (by - ay <= H) vista.y += (H - by - ay) / 2; else { if (ay > hy) vista.y -= ay - hy; if (by < H - hy) vista.y += H - hy - by; }
  }
  function zoom(f, cx, cy) {
    const s0 = vista.s; vista.s *= f; limitar(); const k = vista.s / s0;
    vista.x = cx - (cx - vista.x) * k; vista.y = cy - (cy - vista.y) * k; limitar(); pintar();
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
    lineas(s); rios(s); montes(s); arboles(s, t); ciudad(s); nombres(s); marco(ox, oy, aw, ah, s); jugador(s);
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
  function nombres(s) {
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
    const titulo = tr('Whitholm').toUpperCase(), tp = 26 * u;
    ctx.font = `700 ${tp}px ${LETRA}`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${5 * u}px`;
    const ancho = ctx.measureText(titulo).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const tx = ox + 22 + ancho / 2, ty = oy + 22 + tp * 0.7;
    etiqueta(titulo, tx, ty, tp, '700', TINTA, 5 * u);
    ctx.strokeStyle = TINTA; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(tx - ancho * 0.45, ty + tp * 0.5); ctx.lineTo(tx + ancho * 0.45, ty + tp * 0.5); ctx.stroke();
    etiqueta(tr('la isla del rey'), tx, ty + tp * 0.95, 14 * u, 'italic 600', ROJO);
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
    const km = s < 10 ? 10 : s < 30 ? 5 : 2, largo = km * s, ex = ox + aw - 24 * u - largo, ey = oy + ah - 26 * u;
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
    if (!datos) { aviso.hidden = false; requestAnimationFrame(() => setTimeout(() => { while (!paso(1000)); aviso.hidden = true; encuadrar(); pintar(); }, 0)); }
    else { encuadrar(); pintar(); }
    clearInterval(reloj); reloj = setInterval(pintar, 250);   // tu marca se mueve si andas con el mapa abierto
  }
  function cerrar() { raiz.hidden = true; clearInterval(reloj); reloj = null; }
  const alternar = () => (raiz.hidden ? abrir() : cerrar());
  raiz.querySelector('.mr-cerrar').addEventListener('click', cerrar);
  raiz.querySelector('.mr-yo').addEventListener('click', () => { if (datos) centrarEnMi(); });

  const dedos = new Map(); let pinza = 0;
  lienzo.addEventListener('pointerdown', (e) => {
    lienzo.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); lienzo.classList.add('arrastrando');
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinza = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  lienzo.addEventListener('pointermove', (e) => {
    const d = dedos.get(e.pointerId); if (!d || !datos) return;
    if (dedos.size === 2) {
      d.x = e.clientX; d.y = e.clientY;
      const [a, b] = [...dedos.values()], n = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinza > 0) zoom(n / pinza, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinza = n; return;
    }
    vista.x += e.clientX - d.x; vista.y += e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; limitar(); pintar();
  });
  const soltar = (e) => { dedos.delete(e.pointerId); pinza = 0; if (!dedos.size) lienzo.classList.remove('arrastrando'); };
  lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('wheel', (e) => { e.preventDefault(); if (datos) zoom(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  addEventListener('resize', () => { if (!raiz.hidden && datos) { encuadrar(); pintar(); } });

  return {
    abrir, cerrar, alternar, preparar, centrarEnMi, zoom,
    get abierto() { return !raiz.hidden; }, get listo() { return !!datos; }, get datos() { return datos; },
    get vista() { return { ...vista }; }, get marca() { return marca; }, kmAPant,
    get medida() { return { msPintar: Math.round(msPintar), msMaxPaso: Math.round(msMaxPaso), avance: datos ? 1 : Math.round(avance * 100) / 100 }; },
  };
}
