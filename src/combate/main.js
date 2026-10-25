// Kinhold — campo de pruebas de combate, v2
import * as THREE from 'three';
import { Luchador, IA, azar, angulo, T,
  ARMAS, ARMADURAS, NOMBRE_LINEA, NOMBRE_ZONA, LINEAS, ESPEJO, RITMO } from './logica.js';
import { crearCombatiente, ponerArma, animarCombatiente, pintarHeridas, sacudir, Rastro, Particulas,
  modeloFlecha, modeloPiedra, modeloPoste, modeloDiana } from './modelos.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { crearDecorado } from '../mundo/decorado.js';
import * as sonido from './sonido.js';
import { RegistroAcciones, ejecutarCombate, avanzarProyectil } from '../logica/acciones.js';
import { REGISTRO_COMBATE, VERSION_COMBATE } from './registro.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';

// lo primero: la página fija en el idioma elegido (antes de rellenar nada desde el código)
traducirPagina();
botonesIdioma(document.getElementById('menu'));

const $ = (id) => document.getElementById(id);
const esTactil = matchMedia('(pointer: coarse)').matches;
const CLAVE = 'kinhold_combate_v2';

// ---------------- Opciones ----------------
// Armas que puede llevar el rival (solo cuerpo a cuerpo)
const ARMAS_RIVAL = { igual: { nombre: 'Como la tuya' }, espada_larga: ARMAS.espada_larga, espada_escudo: ARMAS.espada_escudo, palo: ARMAS.palo };
const opc = cargarOpciones();
function cargarOpciones() {
  const def = { modo: 'duelo', arma: 'espada_larga', armadura: 'lino', armaduraRival: 'lino', armaRival: 'igual', dificultad: 'aprendiz', sonido: true };
  try {
    const o = { ...def, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') };
    if (!RITMO[o.dificultad]) o.dificultad = 'aprendiz';
    if (!ARMAS_RIVAL[o.armaRival]) o.armaRival = 'igual'; // guardados de antes de la v4 no lo tienen
    if (!ARMAS[o.arma]) o.arma = 'espada_larga';
    return o;
  } catch (e) { return def; }
}
function guardarOpciones() { try { localStorage.setItem(CLAVE, JSON.stringify(opc)); } catch (e) { /* sin almacenamiento */ } }
function armaDelRival() {
  if (opc.armaRival !== 'igual' && ARMAS_RIVAL[opc.armaRival]) return opc.armaRival;
  return ARMAS[opc.arma].tipo === 'cuerpo' ? opc.arma : 'espada_larga';
}
// Qué ayudas visuales da cada dificultad
const AYUDAS = {
  aprendiz: { amenaza: true, verde: true },
  normal:   { amenaza: true, verde: false },
  realista: { amenaza: false, verde: false },
};

// ---------------- Escena ----------------
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0); // el cielo lo pinta la página (un degradado CSS no cuesta nada dibujarlo)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
prepararRenderer(renderer); // sombras blandas, sRGB y ACES: los de la escena común
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
// cielo, sol, luz del cielo y niebla del estilo v5 (src/mundo/ambiente.js); la sombra sigue al jugador
const ambiente = crearAmbiente(escena, { fondoPagina: true, alcance: 25, mapa: 2048, niebla: [60, 170] });
// decorado común (src/mundo/decorado.js): liza de tierra pisada en el centro, hierba alrededor y bosque
escena.add(crearDecorado({ semilla: 11, llano: 45, lejos: 200, arboles: 160, bosqueDesde: 30, bosqueHasta: 140,
  hierba: 1100, flores: 300, hierbaDesde: 9, hierbaHasta: 34, tierra: 8, rocas: 24 }).raiz);
const particulas = new Particulas(escena);
const rastroJ = new Rastro(escena), rastroR = new Rastro(escena);

// ---------------- Estado de la partida ----------------
const rnd = azar(Date.now() & 0xffff);
let jugador, rival, ia, mJugador, mRival;
let objetos = [], proyectiles = [], dianas = [], postes = [];
// Toda herida pasa por las acciones con autor (golpe, disparo) y queda en el registro.
const registroAcciones = new RegistroAcciones(2000);
let ctxCombate = { luchadores: {}, r: rnd };
let stats, terminado = false;
let pausa = 0, pausas = 0; // pausa de impacto (s) y cuántas ha habido
let temblor = 0;        // sacudida de cámara (m)
let reloj = 0;

function nuevaPartida() {
  for (const o of objetos) escena.remove(o);
  for (const p of proyectiles) escena.remove(p.malla);
  objetos = []; proyectiles = []; dianas = []; postes = [];
  terminado = false; pausa = 0; temblor = 0;
  $('final').hidden = true;
  stats = { golpes: 0, heridasDadas: 0, paradas: 0, perfectas: 0, maestros: 0, recibidas: 0, flechas: 0, aciertos: 0, puntos: 0 };
  const ritmo = RITMO[opc.dificultad] || 1;
  jugador = new Luchador({ nombre: 'Tú', arma: opc.arma, armadura: opc.armadura, ritmo, x: 0, z: -2, rot: 0 });
  if (mJugador) escena.remove(mJugador);
  mJugador = crearCombatiente({ armadura: opc.armadura, colorCinta: 0x2f6fb0 });
  ponerArma(mJugador, opc.arma);
  escena.add(mJugador);
  rival = null; ia = null;
  if (mRival) { escena.remove(mRival); mRival = null; }
  if (opc.modo === 'duelo' || opc.modo === 'carga') {
    const armaRival = armaDelRival();
    const dist = opc.modo === 'carga' ? 40 : 3.5;
    rival = new Luchador({ nombre: 'Rival', arma: armaRival, armadura: opc.armaduraRival, ritmo, x: 0, z: -2 + dist, rot: Math.PI });
    ia = new IA(rival, opc.dificultad, azar((Date.now() >> 3) & 0xffff));
    ia.carga = opc.modo === 'carga';
    if (opc.modo === 'carga') ia.esperaAtaque = 0.5;
    mRival = crearCombatiente({ armadura: opc.armaduraRival, colorCinta: 0xe2b93b });
    ponerArma(mRival, armaRival);
    escena.add(mRival);
  }
  if (opc.modo === 'practicas') {
    const poste = modeloPoste(); poste.position.set(-3, 0, -2); escena.add(poste); objetos.push(poste);
    const dummy = new Luchador({ nombre: 'Poste', x: -3, z: -2, rot: Math.PI });
    dummy.recibirHerida = (zona, sev, tipo) => ({ zona, gravedad: sev < 0.35 ? 'leve' : sev < 0.75 ? 'grave' : 'muy grave', tipo });
    postes.push(dummy);
    for (const [d, x] of [[10, -4], [20, 0], [35, 5]]) {
      const m = modeloDiana(0.6); m.position.set(x, 1.3, -2 + d); m.rotation.y = Math.PI; escena.add(m); objetos.push(m);
      dianas.push({ x, y: 1.3, z: -2 + d, nx: 0, nz: -1, radio: 0.6, distancia: d });
    }
    jugador.z = -3.6; jugador.x = 0;
  }
  ctxCombate = { luchadores: { jugador }, r: rnd };
  if (rival) ctxCombate.luchadores.rival = rival;
  if (postes[0]) ctxCombate.luchadores.poste = postes[0];
  cam.yaw = Math.PI + LADO_CAMARA; cam.manual = -99;
  lineasRegistro.length = 0;
  registrar(textoInicio());
  ajustarControles();
  actualizarPanel();
}
function textoInicio() {
  if (opc.modo === 'practicas') return tr('Prácticas: poste a la izquierda, dianas a 10, 20 y 35 m.');
  if (opc.modo === 'carga') return tr('Carga: el rival corre hacia ti desde 40 m. Dispara antes de que llegue.');
  if (ARMAS[opc.arma].tipo !== 'cuerpo') return tr('Duelo a distancia: mantén pulsado para tensar y suelta.');
  return tr('Duelo. Haz clic o toca una zona de la rosa para golpear por ese lado.');
}

// ---------------- Registro ----------------
const lineasRegistro = [];
function registrar(txt, tipo = '') {
  lineasRegistro.unshift({ txt, tipo });
  lineasRegistro.length = Math.min(lineasRegistro.length, 4);
  $('registro').innerHTML = lineasRegistro.map((l, i) => `<div class="${l.tipo}" style="opacity:${1 - i * 0.2}">${l.txt}</div>`).join('');
}

// ---------------- Cámara ----------------
// Detrás del hombro derecho. En duelo solo se recoloca si el rival se sale mucho del encuadre
// (margen muerto) y no la has movido tú en los últimos 3 s.
const LADO_CAMARA = 0.6;
const cam = { yaw: Math.PI + LADO_CAMARA, pitch: 0.82, dist: 10, manual: -99, recolocando: false, k: 0 };
function actualizarCamara(dt) {
  const obj = objetivoCercano();
  if (obj && jugador.def.tipo === 'cuerpo' && reloj - cam.manual > 3) {
    const ideal = angulo(jugador, obj) + Math.PI + LADO_CAMARA;
    let d = ideal - cam.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > 0.5) cam.recolocando = true;
    if (Math.abs(d) < 0.08) cam.recolocando = false;
    if (cam.recolocando) cam.yaw += d * Math.min(1, dt * 2.5);
  }
  // en duelo la cámara se acerca y baja un poco y encuadra a los dos
  const enDuelo = obj && jugador.def.tipo === 'cuerpo' ? 1 : 0;
  cam.k += (enDuelo - cam.k) * Math.min(1, dt * 3);
  temblor = Math.max(0, temblor - dt * 0.8);
  const sx = (Math.random() - 0.5) * temblor, sy = (Math.random() - 0.5) * temblor;
  const fm = obj ? 0.35 * cam.k : 0;
  const ox = jugador.x + (obj ? (obj.x - jugador.x) * fm : 0), oy = 1.2, oz = jugador.z + (obj ? (obj.z - jugador.z) * fm : 0);
  const dist = cam.dist * (1 - 0.3 * cam.k), pitch = cam.pitch - 0.2 * cam.k;
  const cp = Math.cos(pitch);
  camara.position.set(ox + Math.sin(cam.yaw) * cp * dist + sx, oy + Math.sin(pitch) * dist + sy, oz + Math.cos(cam.yaw) * cp * dist);
  camara.lookAt(ox + sx * 0.5, oy, oz);
  ambiente.seguir(jugador.x, jugador.z);
}

// ---------------- Rosa de golpes ----------------
// Cinco zonas sobre el rival: haces clic o tocas donde quieres golpear.
// Izquierda/derecha son las de tu pantalla (con la cámara a tu espalda, son tu izquierda y tu derecha).
let lineaSel = 'alto';
const rosa = { x: 0, y: 0, r: 85, visible: false };
function objetivoCercano() {
  const o = rival && !rival.fuera ? rival : postes[0];
  if (!o) return null;
  return Math.hypot(o.x - jugador.x, o.z - jugador.z) < 7 ? o : null;
}
function lineaDesdePantalla(x, y) {
  const dx = x - rosa.x, dy = y - rosa.y, d = Math.hypot(dx, dy);
  if (d < rosa.r * 0.36) return 'estocada';
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'alto' : 'bajo';
  return dx < 0 ? 'izquierda' : 'derecha';
}
function actualizarRosa() {
  const obj = objetivoCercano();
  const el = $('rosa');
  rosa.visible = !!obj && jugador.def.tipo === 'cuerpo' && !jugador.fuera && !terminado;
  el.hidden = !rosa.visible;
  if (!rosa.visible) return;
  const v = new THREE.Vector3(obj.x, 1.3, obj.z).project(camara);
  rosa.r = esTactil ? 80 : 85;
  rosa.x = THREE.MathUtils.clamp((v.x + 1) / 2 * innerWidth, rosa.r + 8, innerWidth - rosa.r - 8);
  rosa.y = THREE.MathUtils.clamp((1 - v.y) / 2 * innerHeight, rosa.r + 60, innerHeight - rosa.r - 8);
  el.style.transform = `translate(${Math.round(rosa.x - rosa.r)}px, ${Math.round(rosa.y - rosa.r)}px)`;
  el.style.width = el.style.height = rosa.r * 2 + 'px';
  // tu línea elegida, el golpe que viene, la ventana de parada perfecta y la de golpe maestro
  const ay = AYUDAS[opc.dificultad] || AYUDAS.normal;
  const viene = rival && rival.accion === 'preparando';
  const amenaza = viene && ay.amenaza ? ESPEJO[rival.linea] : null;
  const verde = !!amenaza && ay.verde && rival.hastaImpacto() <= T.ventanaPerfecta;
  const maestro = !!amenaza && ay.verde && !verde && rival.progreso() <= T.ventanaMaestro;
  for (const l of LINEAS) {
    const s = el.querySelector(`[data-l="${l}"]`);
    s.classList.toggle('sel', l === lineaSel);
    s.classList.toggle('amenaza', l === amenaza && !verde);
    s.classList.toggle('verde', l === amenaza && verde);
    s.classList.toggle('maestro', l === amenaza && maestro);
  }
  el.classList.toggle('contra', jugador.puedeContraatacar());
  el.classList.toggle('preparando', jugador.accion === 'preparando');
  el.classList.toggle('parando', !!jugador.bloqueando);
  const pista = $('pistaRosa');
  pista.textContent = tr(jugador.puedeContraatacar() ? '¡Contraataca!' : verde ? '¡Para ahora!' : maestro ? 'Golpe maestro: golpea ese lado' : jugador.bloqueando ? 'Parando' : '');
}

// ---------------- Entrada ----------------
const teclas = new Set();
let apuntado = null;
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase(); teclas.add(k);
  sonido.activarSonido();
  if (k === ' ') { e.preventDefault(); if (!e.repeat) parar(true); }
  if (k === 'enter' && terminado) nuevaPartida();
  const atajos = { '8': 'alto', '4': 'izquierda', '6': 'derecha', '2': 'bajo', '5': 'estocada' };
  if (atajos[k] && !e.repeat) { lineaSel = atajos[k]; atacar(atajos[k]); }
});
addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); teclas.delete(k); if (k === ' ') parar(false); });
addEventListener('blur', () => { teclas.clear(); parar(false); });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function puntoApuntado(cx, cy) {
  const r = lienzo.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camara);
  const blancos = [];
  if (rival && !rival.fuera) blancos.push({ x: rival.x, z: rival.z, y: 1.3, r: 0.6 });
  for (const d of dianas) blancos.push({ x: d.x, z: d.z, y: d.y, r: d.radio + 0.2 });
  for (const b of blancos) if (ray.ray.distanceToPoint(new THREE.Vector3(b.x, b.y, b.z)) < b.r) return { x: b.x, y: b.y, z: b.z, persona: true };
  const pto = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pto)) return null;
  return { x: pto.x, y: 0, z: pto.z };
}
function parar(activo) {
  if (!jugador || jugador.def.tipo !== 'cuerpo') return;
  jugador.bloquear(activo);
  $('btnParar').classList.toggle('activo', !!jugador.bloqueando);
}

// Ratón: clic izquierdo golpea la zona bajo el cursor; derecho mantenido para; central gira la cámara
let botonPulsado = -1, ultimoX = 0;
lienzo.addEventListener('contextmenu', e => e.preventDefault());
lienzo.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return;
  sonido.activarSonido();
  try { lienzo.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  botonPulsado = e.button; ultimoX = e.clientX;
  if (e.button === 0) {
    if (jugador.def.tipo === 'distancia') { jugador.empezarTensar(); apuntado = puntoApuntado(e.clientX, e.clientY); }
    else if (rosa.visible) { lineaSel = lineaDesdePantalla(e.clientX, e.clientY); atacar(lineaSel); }
  } else if (e.button === 2) parar(true);
});
lienzo.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  if (jugador.def.tipo === 'distancia') apuntado = puntoApuntado(e.clientX, e.clientY);
  else if (rosa.visible) lineaSel = lineaDesdePantalla(e.clientX, e.clientY);
  moverReticula(e.clientX, e.clientY);
  if (botonPulsado === 1) { cam.yaw -= (e.clientX - ultimoX) * 0.006; cam.manual = reloj; }
  ultimoX = e.clientX;
});
lienzo.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') return;
  if (botonPulsado === 0 && jugador.def.tipo === 'distancia') disparar();
  if (botonPulsado === 2) parar(false);
  botonPulsado = -1;
});
lienzo.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 5, 22); }, { passive: false });

// Táctil: tocar la rosa golpea esa zona; con arco, mantener tensa y soltar dispara; dos dedos giran la cámara
const toques = new Map();
lienzo.addEventListener('touchstart', (e) => {
  e.preventDefault();
  sonido.activarSonido();
  for (const t of e.changedTouches) {
    toques.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (toques.size > 1) continue;
    if (jugador.def.tipo === 'distancia') { jugador.empezarTensar(); apuntado = puntoApuntado(t.clientX, t.clientY); moverReticula(t.clientX, t.clientY); }
    else if (rosa.visible && Math.hypot(t.clientX - rosa.x, t.clientY - rosa.y) < rosa.r * 1.5) {
      lineaSel = lineaDesdePantalla(t.clientX, t.clientY); atacar(lineaSel);
    }
  }
}, { passive: false });
lienzo.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length >= 2) {
    let dx = 0, n = 0;
    for (const t of e.touches) { const q = toques.get(t.identifier); if (q) { dx += t.clientX - q.x; n++; } }
    if (n) { cam.yaw -= dx / n * 0.006; cam.manual = reloj; }
  }
  for (const t of e.touches) {
    const q = toques.get(t.identifier); if (!q) continue;
    q.x = t.clientX; q.y = t.clientY;
    if (jugador.def.tipo === 'distancia' && e.touches.length === 1) { apuntado = puntoApuntado(t.clientX, t.clientY); moverReticula(t.clientX, t.clientY); }
  }
}, { passive: false });
const finToque = (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) toques.delete(t.identifier);
  if (jugador.def.tipo === 'distancia' && toques.size === 0) disparar();
};
lienzo.addEventListener('touchend', finToque, { passive: false });
lienzo.addEventListener('touchcancel', finToque, { passive: false });

// Joystick (táctil)
const joy = { vx: 0, vy: 0, id: null };
{
  const zona = $('joystick'), pomo = $('pomo');
  const mover = (e) => {
    if (e.pointerId !== joy.id) return;
    const r = zona.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = 45, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.vx = dx / max; joy.vy = dy / max;
    pomo.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  zona.addEventListener('pointerdown', (e) => { zona.setPointerCapture(e.pointerId); joy.id = e.pointerId; mover(e); sonido.activarSonido(); });
  zona.addEventListener('pointermove', mover);
  const soltar = () => { joy.id = null; joy.vx = joy.vy = 0; pomo.style.transform = ''; };
  zona.addEventListener('pointerup', soltar); zona.addEventListener('pointercancel', soltar);
}
{
  const b = $('btnParar');
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); sonido.activarSonido(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* nada */ } parar(true); });
  const fin = () => parar(false);
  b.addEventListener('pointerup', fin); b.addEventListener('pointercancel', fin);
}

// Retícula del arco: se cierra al tensar y se abre cuando el pulso empieza a temblar
let reticulaPuesta = false;
function moverReticula(x, y) { const r = $('reticula'); r.style.left = x + 'px'; r.style.top = y + 'px'; reticulaPuesta = true; }
function actualizarReticula() {
  const r = $('reticula');
  r.hidden = jugador.def.tipo !== 'distancia' || terminado;
  if (r.hidden) return;
  if (!reticulaPuesta) moverReticula(innerWidth / 2, innerHeight * 0.42);
  let tam = 48;
  if (jugador.accion === 'tensando') tam = 48 - 32 * jugador.tension + Math.min(40, Math.max(0, jugador.tTenso - T.temblorDesde) * 25);
  r.style.width = r.style.height = Math.round(tam) + 'px';
  r.classList.toggle('lista', jugador.accion === 'tensando' && jugador.tension >= 1 && jugador.tTenso <= T.temblorDesde);
  r.classList.toggle('tiembla', jugador.tTenso > T.temblorDesde && jugador.accion === 'tensando');
}

// ---------------- Acciones ----------------
function atacar(linea) {
  if (terminado || jugador.def.tipo !== 'cuerpo') return false;
  const preparaba = jugador.accion === 'preparando';
  const contra = jugador.puedeContraatacar();
  if (!jugador.atacar(linea)) return false;
  if (preparaba) registrar(tr('Finta: cambias a {l}', { l: tr(NOMBRE_LINEA[linea]).toLowerCase() }), 'aviso');
  else { stats.golpes++; if (contra) registrar(tr('Contraataque: solo se para con una parada perfecta'), 'aviso'); }
  $('btnParar').classList.remove('activo');
  return true;
}
function disparar() {
  const tiro = jugador.soltar();
  if (!tiro) {
    if (jugador.cancelado === 'flojo') { registrar(tr('Demasiado flojo: el tiro se cancela (hace falta tensar al menos la mitad)'), 'aviso'); jugador.cancelado = null; }
    return;
  }
  const obj = apuntado || { x: jugador.x + Math.sin(jugador.rot) * 20, y: 0, z: jugador.z + Math.cos(jugador.rot) * 20 };
  lanzar('jugador', obj, tiro);
  stats.flechas++;
  sonido.cuerda();
}
function lanzar(autor, obj, tiro) {
  const r = ejecutarCombate(ctxCombate, registroAcciones, { autor, tipo: 'disparo', x: obj.x, y: obj.y || 0, z: obj.z, tension: tiro.tension, tTenso: tiro.tTenso });
  if (!r.ok) return;
  const p = r.proyectil, tirador = ctxCombate.luchadores[autor];
  const malla = tirador.arma === 'arco' ? modeloFlecha() : modeloPiedra();
  malla.position.set(p.x, p.y, p.z);
  escena.add(malla);
  proyectiles.push({ p, malla, vida: 12 });
}

// ---------------- Peso de los golpes: pausa, chispas, sangre, sacudida y sonido ----------------
function efectos(res, at, de, mAt, mDe) {
  if (res.resultado !== 'fallo' && res.resultado !== 'nada') pausas++;
  const c = { x: (at.x + de.x) / 2, y: 1.35, z: (at.z + de.z) / 2 };
  switch (res.resultado) {
    case 'parada':
      particulas.emitir(c.x, c.y, c.z, 14, 0xffd27a, 3.5, 6, 0.35);
      pausa = 0.05; temblor = Math.max(temblor, 0.04); sonido.acero(0.8); if (mDe) sacudir(mDe, 0.5); break;
    case 'parada perfecta':
      particulas.emitir(c.x, c.y, c.z, 26, 0xfff0b0, 5, 6, 0.5);
      pausa = 0.09; temblor = Math.max(temblor, 0.07); sonido.acero(1.2); if (mAt) sacudir(mAt, 1.2); break;
    case 'golpe maestro':
      particulas.emitir(c.x, c.y, c.z, 30, 0xffe08a, 5.5, 6, 0.5);
      pausa = 0.1; temblor = Math.max(temblor, 0.08); sonido.acero(1.3); if (mAt) sacudir(mAt, 1.4); break;
    case 'herida': {
      const y = res.zona === 'cabeza' ? 1.72 : res.zona.startsWith('pierna') ? 0.6 : 1.25;
      const n = { leve: 8, grave: 16, 'muy grave': 28 }[res.gravedad] || 8;
      const madera = !mDe; // el poste
      particulas.emitir(de.x, y, de.z, n, madera ? 0x9a7a52 : res.tipo === 'contundente' ? 0x6a4a3a : 0x8a1410, 2.5, 9.8, 0.6);
      pausa = res.gravedad === 'leve' ? 0.05 : 0.08; temblor = Math.max(temblor, res.gravedad === 'muy grave' ? 0.12 : 0.06);
      if (madera || res.tipo === 'contundente') sonido.golpeSordo(); else sonido.corte();
      if (mDe) sacudir(mDe, res.gravedad === 'leve' ? 0.6 : 1.2);
      break;
    }
    case 'fallo': sonido.silbido(); break;
  }
}

// ---------------- Bucle ----------------
const relojTHREE = new THREE.Clock();
function paso() {
  const dtReal = Math.min(relojTHREE.getDelta(), 0.05);
  tick(dtReal);
  renderer.render(escena, camara);
  requestAnimationFrame(paso);
}
let jugadorCorre = false;
function tick(dtReal) {
  // la pausa de impacto congela el combate unas centésimas; la cámara y las partículas siguen
  let dt = dtReal;
  if (pausa > 0) { pausa -= dtReal; dt = 0; }
  reloj += dt;
  moverJugador(dt);
  const evJ = jugador.actualizar(dt, jugadorCorre);
  if (jugador.cancelado === 'correr') { registrar(tr('Al echar a correr aflojas el arco'), 'aviso'); jugador.cancelado = null; }
  let vR = 0;
  if (rival) {
    const m = ia.pensar(dt, jugador);
    if (m.mx || m.mz) { vR = rival.velocidad(m.correr); rival.x += m.mx * vR * dt; rival.z += m.mz * vR * dt; }
    const evR = rival.actualizar(dt, m.correr);
    for (const e of evR) if (e.tipo === 'impacto') {
      const res = ejecutarCombate(ctxCombate, registroAcciones, { autor: 'rival', tipo: 'golpe', objetivo: 'jugador', linea: e.linea });
      if (!res.ok) continue;
      contarYDecir(res, false, e.linea);
      efectos(res, rival, jugador, mRival, mJugador);
      if (!jugador.bloqueando) $('btnParar').classList.remove('activo');
    }
    separar(jugador, rival);
  }
  for (const e of evJ) if (e.tipo === 'impacto') {
    const objetivo = rival || postes[0];
    if (!objetivo) { sonido.silbido(); continue; }
    const res = ejecutarCombate(ctxCombate, registroAcciones, { autor: 'jugador', tipo: 'golpe', objetivo: rival ? 'rival' : 'poste', linea: e.linea });
    if (!res.ok) continue;
    contarYDecir(res, true, e.linea);
    efectos(res, jugador, objetivo, mJugador, rival ? mRival : null);
  }
  moverProyectiles(dt);
  particulas.actualizar(dtReal);
  colocar(mJugador, jugador, jugador.velocidadActual || 0, dt, rival);
  if (rival) colocar(mRival, rival, vR, dt, jugador);
  rastroJ.actualizar(mJugador, enVuelo(jugador));
  if (rival) rastroR.actualizar(mRival, enVuelo(rival)); else rastroR.actualizar(mJugador, false);
  actualizarCamara(dtReal);
  actualizarRosa();
  actualizarReticula();
  actualizarPanel();
  comprobarFinal();
}
const enVuelo = (L) => L.accion === 'golpeando' || (L.accion === 'preparando' && L.progreso() > 0.8);
function contarYDecir(res, delJugador, linea) {
  if (delJugador) {
    if (res.resultado === 'herida') {
      stats.heridasDadas++;
      if (!rival) registrar(tr('Poste: {l} a {z} · golpe {g} · fuerza {f}%', { l: tr(NOMBRE_LINEA[linea]).toLowerCase(), z: tr(NOMBRE_ZONA[res.zona]), g: tr(res.gravedad), f: Math.min(100, Math.round(res.sev * 100)) }), 'bien');
      else registrar(tr(res.nota === 'imparable' ? 'Tu contraataque entra: {g} en {z}' : res.nota === 'guardia rota' ? 'Hieres al rival: {g} en {z} (está agotado y su parada cede)' : 'Hieres al rival: {g} en {z}', { g: tr(res.gravedad), z: tr(NOMBRE_ZONA[res.zona]) }), 'bien');
    } else if (res.resultado === 'parada') registrar(tr('El rival para tu golpe'), '');
    else if (res.resultado === 'parada perfecta') registrar(tr('El rival para en el momento justo: quedas descolocado'), 'mal');
    else if (res.resultado === 'golpe maestro') registrar(tr('¡Golpe maestro del rival! Desvía el tuyo'), 'mal');
    else if (res.resultado === 'fallo') registrar(tr('Golpe al aire: fuera de alcance'), '');
  } else {
    if (res.resultado === 'herida') { stats.recibidas++; registrar(tr(res.nota === 'imparable' ? 'Te hieren: {g} en {z} (era un contraataque: solo lo para una parada perfecta)' : res.nota === 'guardia rota' ? 'Te hieren: {g} en {z} (estás agotado y tu parada cede)' : 'Te hieren: {g} en {z}', { g: tr(res.gravedad), z: tr(NOMBRE_ZONA[res.zona]) }), 'mal'); }
    else if (res.resultado === 'parada') { stats.paradas++; registrar(tr('Paras el golpe'), ''); }
    else if (res.resultado === 'parada perfecta') { stats.paradas++; stats.perfectas++; registrar(tr('¡Parada perfecta! Contraataca ya'), 'bien'); }
    else if (res.resultado === 'golpe maestro') { stats.maestros++; registrar(tr('¡Golpe maestro! Desvías su golpe y el tuyo entra'), 'bien'); }
    else if (res.resultado === 'fallo') registrar(tr('El rival golpea al aire'), '');
  }
}
function moverJugador(dt) {
  let ax = 0, az = 0;
  if (teclas.has('w') || teclas.has('arrowup')) az -= 1;
  if (teclas.has('s') || teclas.has('arrowdown')) az += 1;
  if (teclas.has('a') || teclas.has('arrowleft')) ax -= 1;
  if (teclas.has('d') || teclas.has('arrowright')) ax += 1;
  ax += joy.vx; az += joy.vy;
  if (teclas.has('q')) { cam.yaw += dt * 1.6; cam.manual = reloj; }
  if (teclas.has('e')) { cam.yaw -= dt * 1.6; cam.manual = reloj; }
  const mag = Math.min(1, Math.hypot(ax, az));
  const corriendo = teclas.has('shift') && mag > 0.1;
  jugadorCorre = corriendo;
  const v = jugador.velocidad(corriendo) * mag;
  jugador.velocidadActual = mag > 0.05 ? v : 0;
  const obj = objetivoCercano();
  const encarado = obj && jugador.def.tipo === 'cuerpo';
  if (mag > 0.05) {
    let dx, dz;
    const n = Math.hypot(ax, az);
    if (encarado) {
      // encarado: adelante/atrás acerca o aleja del rival; los lados lo rodean
      const a = angulo(jugador, obj);
      const fx = Math.sin(a), fz = Math.cos(a), rx = -Math.cos(a), rz = Math.sin(a);
      dx = (-az * fx + ax * rx) / n; dz = (-az * fz + ax * rz) / n;
    } else {
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      dx = (ax * c + az * s) / n; dz = (-ax * s + az * c) / n;
      if (jugador.accion !== 'tensando') jugador.rot = girarHacia(jugador.rot, Math.atan2(dx, dz), dt);
    }
    jugador.x += dx * v * dt; jugador.z += dz * v * dt;
  }
  if (encarado) jugador.rot = girarHacia(jugador.rot, angulo(jugador, obj), dt * 1.4);
  if (jugador.accion === 'tensando' && apuntado) jugador.rot = girarHacia(jugador.rot, angulo(jugador, apuntado), dt * 1.4);
}
function moverProyectiles(dt) {
  for (const pr of proyectiles) {
    if (pr.p.activo) {
      const res = avanzarProyectil(ctxCombate, registroAcciones, pr.p, dt, [jugador, rival].filter(Boolean), dianas);
      pr.malla.position.set(pr.p.x, pr.p.y, pr.p.z);
      pr.malla.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(pr.p.vx, pr.p.vy, pr.p.vz).normalize());
      if (res) {
        if (res.tipo === 'blanco') {
          const acierto = res.luchador === rival;
          if (acierto) stats.aciertos++; else stats.recibidas++;
          registrar(tr(acierto ? 'Aciertas: herida {g} en {z}' : 'Te alcanza: herida {g} en {z}', { g: tr(res.gravedad), z: tr(NOMBRE_ZONA[res.zona]) }), acierto ? 'bien' : 'mal');
          particulas.emitir(pr.p.x, pr.p.y, pr.p.z, 12, 0x8a1410, 2, 9.8, 0.5);
          sacudir(acierto ? mRival : mJugador, 0.8); sonido.corte(); pausa = 0.05;
        }
        if (res.tipo === 'escudo') {
          const mio = res.luchador === jugador;
          if (mio) stats.paradas++;
          registrar(tr(mio ? (pr.p.arma === 'arco' ? 'Tu escudo para la flecha' : 'Tu escudo para la piedra') : (pr.p.arma === 'arco' ? 'El rival para tu flecha con el escudo' : 'El rival para tu piedra con el escudo')), mio ? 'bien' : '');
          particulas.emitir(pr.p.x, pr.p.y, pr.p.z, 8, 0x9a7a52, 2, 9.8, 0.4);
          sacudir(mio ? mJugador : mRival, 0.4);
          if (pr.p.arma === 'arco') sonido.clavar(); else sonido.golpeSordo();
        }
        if (res.tipo === 'diana') { stats.aciertos++; stats.puntos += res.puntos; registrar(tr('Diana a {d} m: {p} puntos', { d: res.diana.distancia, p: res.puntos }), 'bien'); sonido.clavar(); }
        if (res.tipo === 'suelo') registrar(tr('Al suelo a {d} m', { d: Math.round(pr.p.recorrido) }), '');
      }
    } else pr.vida -= dt;
  }
  proyectiles = proyectiles.filter(pr => { if (pr.vida <= 0) { escena.remove(pr.malla); return false; } return true; });
}
function girarHacia(actual, objetivo, k) {
  let d = objetivo - actual;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return actual + d * Math.min(1, k * 10);
}
function separar(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.75;
  if (d < min && d > 1e-6) { const e = (min - d) / 2; a.x -= dx / d * e; a.z -= dz / d * e; b.x += dx / d * e; b.z += dz / d * e; }
}
function colocar(m, L, v, dt, otro) {
  m.position.set(L.x, 0, L.z);
  m.rotation.y = L.rot;
  pintarHeridas(m, L.heridas);
  // al parar, la hoja se coloca por el lado del golpe que viene
  const lineaParada = otro && otro.accion === 'preparando' ? ESPEJO[otro.linea] : 'estocada';
  animarCombatiente(m, L, dt, v, L.factorPiernas() < 0.9, lineaParada);
}
function comprobarFinal() {
  if (terminado || !rival) return;
  if (jugador.fuera || rival.fuera) {
    terminado = true;
    parar(false);
    const gana = rival.fuera && !jugador.fuera;
    $('tituloFinal').textContent = tr(gana ? 'Has vencido' : 'Has caído');
    $('motivoFinal').textContent = gana ? tr('El rival: {m}.', { m: tr(rival.motivoFuera).toLowerCase() }) : `${tr(jugador.motivoFuera)}.`;
    $('statsFinal').innerHTML = [
      ['Golpes lanzados', stats.golpes], ['Heridas causadas', stats.heridasDadas], ['Golpes parados', stats.paradas],
      ['Paradas perfectas', stats.perfectas], ['Golpes maestros', stats.maestros], ['Heridas recibidas', stats.recibidas],
      ...(stats.flechas ? [['Tiros', stats.flechas], ['Aciertos', stats.aciertos]] : []),
    ].map(([k, v]) => `<div><span>${tr(k)}</span><b>${v}</b></div>`).join('');
    $('final').hidden = false;
  }
}

// ---------------- Avisos a la derecha ----------------
function actualizarPanel() {
  const av = [];
  const sangrado = jugador.heridas.reduce((a, h) => a + h.sangrado, 0);
  if (jugador.cansancio > 30) av.push({ c: jugador.cansancio >= T.guardiaRota ? 'rojo' : 'gris', t: tr('Cansancio'), d: tr('{c}%. Atacar, parar, fintar y fallar cansan; mantener la parada también. Por encima del 70% tus golpes son más lentos y al {r}% tu parada cede.', { c: Math.round(jugador.cansancio), r: T.guardiaRota }), n: jugador.cansancio / 100 });
  if (sangrado > 0.05) av.push({ c: 'rojo', t: tr('Sangrado'), d: tr('Pierdes sangre. Te queda {s}%.', { s: Math.round(jugador.sangre) }), n: 1 - jugador.sangre / 100 });
  for (const h of jugador.heridas) av.push({ c: h.gravedad === 'leve' ? 'naranja' : 'rojo', t: tr('Herida {g}', { g: tr(h.gravedad) }), d: `${tr(NOMBRE_ZONA[h.zona])} (${tr(h.tipo)})${efectoHerida(h.zona)}`, n: h.gravedad === 'leve' ? 0.3 : h.gravedad === 'grave' ? 0.65 : 1 });
  if (jugador.accion === 'aturdido') av.push({ c: 'naranja', t: tr('Descolocado'), d: tr('No puedes atacar ni parar un momento.'), n: 1 });
  const cont = $('avisos');
  const html = av.map((a, i) => `<button class="aviso ${a.c}" data-i="${i}" style="--n:${Math.min(1, a.n).toFixed(2)}"><span></span><em>${a.t}</em></button>`).join('');
  if (cont.dataset.html !== html) {
    cont.dataset.html = html; cont.innerHTML = html;
    cont.querySelectorAll('.aviso').forEach(b => b.onclick = () => { const a = av[+b.dataset.i]; $('detalle').hidden = false; $('detalle').innerHTML = `<b>${a.t}</b><br>${a.d}`; });
  }
  $('estado').textContent = tr(ARMAS[jugador.arma].nombre) + (jugador.bloqueando ? ' · ' + tr('parando') : '');
}
function efectoHerida(z) {
  if (z === 'brazoD') return ': ' + tr('golpes y tiros más lentos y flojos');
  if (z === 'brazoI') return ': ' + tr('algo más lento');
  if (z.startsWith('pierna')) return ': ' + tr('te mueves más despacio');
  if (z === 'torso') return ': ' + tr('sangra mucho');
  return '';
}

// ---------------- Menú ----------------
function selector(id, valores, clave) {
  const el = $(id);
  el.innerHTML = Object.entries(valores).map(([k, v]) => `<option value="${k}">${tr(v.nombre)}</option>`).join('');
  el.value = opc[clave];
  el.onchange = () => { opc[clave] = el.value; guardarOpciones(); nuevaPartida(); el.blur(); };
}
selector('selModo', { duelo: { nombre: 'Duelo' }, carga: { nombre: 'Carga desde 40 m' }, practicas: { nombre: 'Prácticas (poste y dianas)' } }, 'modo');
selector('selArma', ARMAS, 'arma');
selector('selArmadura', ARMADURAS, 'armadura');
selector('selArmaduraRival', ARMADURAS, 'armaduraRival');
selector('selArmaRival', ARMAS_RIVAL, 'armaRival');
selector('selDificultad', { aprendiz: { nombre: 'Aprendiz (lento, con avisos)' }, normal: { nombre: 'Normal (solo ves el lado)' }, realista: { nombre: 'Realista (sin avisos)' } }, 'dificultad');
$('chkSonido').checked = opc.sonido;
$('chkSonido').onchange = (e) => { opc.sonido = e.target.checked; guardarOpciones(); sonido.silenciar(!opc.sonido); };
$('btnOtra').onclick = nuevaPartida;
$('btnReiniciar').onclick = nuevaPartida;
$('btnOpciones').onclick = () => { $('opciones').hidden = !$('opciones').hidden; };
$('btnAyuda').onclick = () => { $('panelAyuda').hidden = !$('panelAyuda').hidden; $('panelRegistro').hidden = true; };
$('btnDecisiones').onclick = () => { $('panelRegistro').hidden = !$('panelRegistro').hidden; $('panelAyuda').hidden = true; };
for (const b of document.querySelectorAll('.cerrar')) b.onclick = () => { b.closest('.panel').hidden = true; };
$('detalle').onclick = () => { $('detalle').hidden = true; };
$('listaRegistro').innerHTML = REGISTRO_COMBATE.map(r => `<li>${tr(r)}</li>`).join('');
$('version').textContent = tr(VERSION_COMBATE);
function ajustarControles() {
  const cuerpo = ARMAS[opc.arma].tipo === 'cuerpo';
  $('btnParar').hidden = !esTactil || !cuerpo;
  $('joystick').hidden = !esTactil;
  $('ayudaPC').hidden = esTactil; $('ayudaTactil').hidden = !esTactil;
}
function redimensionar() { renderer.setSize(innerWidth, innerHeight, false); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); }
addEventListener('resize', redimensionar);
redimensionar();
nuevaPartida();
actualizarCamara(0);
sonido.silenciar(!opc.sonido);
paso();

// acceso para pruebas automáticas
window.__duelo = {
  get jugador() { return jugador; }, get rival() { return rival; }, get ia() { return ia; }, get stats() { return stats; }, opc, cam, rosa,
  get proyectiles() { return proyectiles; }, get terminado() { return terminado; }, get lineaSel() { return lineaSel; },
  get pausa() { return pausa; }, get pausas() { return pausas; },
  get mJugador() { return mJugador; }, get mRival() { return mRival; },
  get ctx() { return ctxCombate; }, registroAcciones,
  nuevaPartida, atacar, disparar, lanzar, tick, registrar, parar, lineaDesdePantalla,
  configurar(o) { Object.assign(opc, o); nuevaPartida(); },
  apuntar(x, y, z) { apuntado = { x, y, z }; },
};
