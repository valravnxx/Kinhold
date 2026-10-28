// Kinhold — campo de pruebas de combate, v2
import * as THREE from 'three';
import { Luchador, IA, azar, angulo, T,
  ARMAS, ARMADURAS, NOMBRE_LINEA, NOMBRE_ZONA, LINEAS, ESPEJO, RITMO } from './logica.js';
import { crearCombatiente, ponerArma, animarCombatiente, pintarHeridas, sacudir, Rastro, Particulas,
  modeloFlecha, modeloPiedra, modeloPoste, modeloDiana } from './modelos.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { crearDecorado } from '../mundo/decorado.js';
import { vigilar } from '../mundo/rendimiento.js';
import * as sonido from './sonido.js';
import { RegistroAcciones, ejecutarCombate, avanzarProyectil } from '../logica/acciones.js';
import { REGISTRO_COMBATE, VERSION_COMBATE } from './registro.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';
import { personajeElegido, capasDuelo } from '../demo/eleccion.js';
import { normalizarAspecto } from '../logica/aspecto.js';
import { CAPAS_ARMADURA } from './taller.js';
import { tipoToque, arrastrarLibre, seguirApuntado, GIRO_POR_PX } from './tactil.js';
import { conectarDuelo } from './en_linea.js';
import { aplicarFoto, avanzarCopia, resultadoDeEvento, rivalCercano, PREDICCION } from '../logica/combate_cliente.js';

// lo primero: la página fija en el idioma elegido (antes de rellenar nada desde el código)
traducirPagina();
botonesIdioma(document.getElementById('menu'));

const $ = (id) => document.getElementById(id);
const esTactil = matchMedia('(pointer: coarse)').matches;
const CLAVE = 'kinhold_combate_v2';
// personaje del taller propio: la versión publicada vive en jugar/combate/, los modelos en recursos/personajes/taller-v9/
const RECURSOS_MH = new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/taller-v9/';
// «Duelo en línea» (?enlinea=1): el rival es otro jugador y los golpes los resuelve el servidor (src/combate/en_linea.js)
const EN_LINEA = new URLSearchParams(location.search).get('enlinea') === '1';

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
vigilar(renderer); // fotogramas, triángulos y memoria (src/mundo/rendimiento.js)
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
// cielo, sol, luz del cielo y niebla del estilo v5 (src/mundo/ambiente.js); la sombra sigue al jugador
const ambiente = crearAmbiente(escena, { fondoPagina: true, alcance: 25, mapa: 2048, niebla: [60, 170] });
// decorado común (src/mundo/decorado.js): liza de tierra pisada en el centro y, alrededor, como la prueba de
// estilo v5: hierba densa con flores, matorrales, calvas de tierra, rocas, árboles sueltos y el bosque
escena.add(crearDecorado({ semilla: 11, llano: 45, lejos: 200, arboles: 160, bosqueDesde: 30, bosqueHasta: 140,
  hierba: 2400, flores: 650, hierbaDesde: 9, hierbaHasta: 36, tierra: 8, rocas: 30, rocasDesde: 12, matas: 36, matasDesde: 12,
  sueltos: 10, sueltosDesde: 17, calvas: 8 }).raiz);
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

// libera en la tarjeta gráfica lo que se quita (dianas, postes, flechas): si no, cada flecha dejaba su malla ocupando memoria
function liberar(obj) { obj.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
function nuevaPartida() {
  for (const o of objetos) { escena.remove(o); liberar(o); }
  for (const p of proyectiles) { escena.remove(p.malla); liberar(p.malla); }
  objetos = []; proyectiles = []; dianas = []; postes = [];
  terminado = false; pausa = 0; temblor = 0;
  $('final').hidden = true;
  stats = { golpes: 0, heridasDadas: 0, paradas: 0, perfectas: 0, maestros: 0, recibidas: 0, flechas: 0, aciertos: 0, puntos: 0 };
  // en línea, el ritmo es el del servidor («normal» para todos, decisión provisional del combate en el servidor)
  const ritmo = EN_LINEA ? RITMO.normal : RITMO[opc.dificultad] || 1;
  // en línea, cada uno sale en un punto al azar del corro de la liza, mirando al centro
  const sitio = EN_LINEA ? (() => { const a = rnd() * Math.PI * 2; return { x: Math.sin(a) * 1.75, z: Math.cos(a) * 1.75, rot: a + Math.PI }; })() : { x: 0, z: -2, rot: 0 };
  if (EN_LINEA && jugador) Object.assign(sitio, { x: jugador.x, z: jugador.z, rot: jugador.rot }); // otra partida: donde estaba
  jugador = new Luchador({ nombre: 'Tú', arma: opc.arma, armadura: opc.armadura, ritmo, ...sitio });
  if (EN_LINEA) jugador.liza = true;
  if (mJugador) escena.remove(mJugador);
  // el jugador es el personaje elegido en el visor (cuerpo y ropa), con la armadura del duelo encima; el rival, el de siempre
  mJugador = crearCombatiente({ armadura: opc.armadura, colorCinta: 0x46607e, recursos: RECURSOS_MH, ...aspectoPropio() });
  ponerArma(mJugador, opc.arma);
  escena.add(mJugador);
  rival = null; ia = null;
  if (mRival && !EN_LINEA) { escena.remove(mRival); }
  mRival = null;
  if (EN_LINEA) {
    // el rival es otro jugador (red.otros); al cambiar de arma o armadura, el servidor y los demás lo saben
    if (red) { red.mandarEquipo(); red.mandarAspecto(); }
  } else if (opc.modo === 'duelo' || opc.modo === 'carga') {
    const armaRival = armaDelRival();
    const dist = opc.modo === 'carga' ? 40 : 3.5;
    rival = new Luchador({ nombre: 'Rival', arma: armaRival, armadura: opc.armaduraRival, ritmo, x: 0, z: -2 + dist, rot: Math.PI });
    ia = new IA(rival, opc.dificultad, azar((Date.now() >> 3) & 0xffff));
    ia.carga = opc.modo === 'carga';
    if (opc.modo === 'carga') ia.esperaAtaque = 0.5;
    mRival = crearCombatiente({ armadura: opc.armaduraRival, colorCinta: 0xb3923f, recursos: RECURSOS_MH });
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
  if (EN_LINEA) predHasta = -1;
  if (rival) ctxCombate.luchadores.rival = rival;
  if (postes[0]) ctxCombate.luchadores.poste = postes[0];
  cam.yaw = Math.PI + LADO_CAMARA; cam.manual = -99;
  lineasRegistro.length = 0;
  registrar(textoInicio());
  ajustarControles();
  actualizarPanel();
}
// cuerpo y ropa propios (los del visor de personaje) con la armadura del duelo encima
function aspectoPropio() {
  const elegido = personajeElegido();
  return elegido ? { sexo: elegido.sexo, capas: capasDuelo(elegido.capas, opc.armadura, CAPAS_ARMADURA), aspecto: elegido.aspecto } : {};
}
function textoInicio() {
  if (EN_LINEA) return tr('Duelo en línea: tu rival es otro jugador y los golpes los resuelve el servidor.');
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
// teclas de mover por su posición física (e.code): con la distribución rusa W escribe «ц» y antes no movía
const TECLAS_FISICAS = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', ShiftLeft: 'shift', ShiftRight: 'shift' };
const nombreTecla = (e) => TECLAS_FISICAS[e.code] || (e.key || '').toLowerCase();
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'SELECT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = nombreTecla(e); teclas.add(k);
  sonido.activarSonido();
  if (k === ' ') { e.preventDefault(); if (!e.repeat) parar(true); }
  if (k === 'enter' && terminado) otraPartida();
  const atajos = { '8': 'alto', '4': 'izquierda', '6': 'derecha', '2': 'bajo', '5': 'estocada' };
  if (atajos[k] && !e.repeat) { lineaSel = atajos[k]; atacar(atajos[k]); }
});
addEventListener('keyup', (e) => { const k = nombreTecla(e); teclas.delete(k); teclas.delete((e.key || '').toLowerCase()); if (k === ' ') parar(false); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { teclas.clear(); parar(false); } });
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
  const antes = jugador.bloqueando;
  jugador.bloquear(activo);
  if (EN_LINEA && (activo || antes) && red) { red.intencion({ que: 'parar', activo: !!activo }); if (activo) predHasta = reloj + PREDICCION; }
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
    if (jugador.def.tipo === 'distancia') { tensar(); apuntado = puntoApuntado(e.clientX, e.clientY); }
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

// Táctil (GDD): tocar la rosa golpea esa zona; arrastrar un dedo por zona libre gira la cámara (un toque sin
// arrastrar no la mueve); con arco, mantener tensa, arrastrar apunta y soltar dispara, y la cámara sigue hacia
// donde apuntas si llevas el dedo cerca del borde. Dos dedos también giran la cámara.
// Se usan los dedos que tocan el lienzo (targetTouches): el del joystick no cuenta.
const toques = new Map();
let dedoArco = null;   // { x, y } del dedo que tensa el arco, para que la cámara le siga
lienzo.addEventListener('touchstart', (e) => {
  e.preventDefault();
  sonido.activarSonido();
  for (const t of e.changedTouches) {
    const q = { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, arrastre: false, tipo: 'otro' };
    toques.set(t.identifier, q);
    if (toques.size > 1) continue;
    q.tipo = tipoToque({ distancia: jugador.def.tipo === 'distancia', rosaVisible: rosa.visible, x: t.clientX, y: t.clientY, rosa });
    if (q.tipo === 'arco') { tensar(); dedoArco = q; apuntado = puntoApuntado(t.clientX, t.clientY); moverReticula(t.clientX, t.clientY); }
    else if (q.tipo === 'rosa') { lineaSel = lineaDesdePantalla(t.clientX, t.clientY); atacar(lineaSel); }
  }
}, { passive: false });
lienzo.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const propios = e.targetTouches;
  if (propios.length >= 2) {
    let dx = 0, n = 0;
    for (const t of propios) { const q = toques.get(t.identifier); if (q) { dx += t.clientX - q.x; n++; } }
    if (n) { cam.yaw -= dx / n * GIRO_POR_PX; cam.manual = reloj; }
    for (const t of propios) { const q = toques.get(t.identifier); if (q) { q.x = t.clientX; q.y = t.clientY; q.arrastre = true; } }
    return;
  }
  for (const t of propios) {
    const q = toques.get(t.identifier); if (!q) continue;
    if (q.tipo === 'libre') {
      const giro = arrastrarLibre(q, t.clientX, t.clientY);
      if (giro) { cam.yaw += giro; cam.manual = reloj; }
      continue;
    }
    q.x = t.clientX; q.y = t.clientY;
    if (q.tipo === 'arco') { apuntado = puntoApuntado(t.clientX, t.clientY); moverReticula(t.clientX, t.clientY); }
  }
}, { passive: false });
const finToque = (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) { if (toques.get(t.identifier) === dedoArco) dedoArco = null; toques.delete(t.identifier); }
  if (jugador.def.tipo === 'distancia' && toques.size === 0) disparar();
};
lienzo.addEventListener('touchend', finToque, { passive: false });
lienzo.addEventListener('touchcancel', finToque, { passive: false });
// con el arco tenso, la cámara sigue al dedo que apunta cerca del borde (se llama en cada paso)
function seguirDedoArco(dt) {
  if (!dedoArco || jugador.def.tipo !== 'distancia' || jugador.accion !== 'tensando') return;
  const giro = seguirApuntado(dedoArco.x, innerWidth, dt);
  if (!giro) return;
  cam.yaw += giro; cam.manual = reloj;
  apuntado = puntoApuntado(dedoArco.x, dedoArco.y);
}

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
// En línea, lo que hace el jugador se ve enseguida en su copia y se manda al servidor como intención.
function tensar() {
  if (!jugador.empezarTensar()) return false;
  if (EN_LINEA && red) { red.intencion({ que: 'tensar' }); predHasta = reloj + PREDICCION; }
  return true;
}
function atacar(linea) {
  if (terminado || jugador.def.tipo !== 'cuerpo') return false;
  if (EN_LINEA && (!red || red.estado !== 'conectado')) return false;
  const preparaba = jugador.accion === 'preparando';
  const contra = jugador.puedeContraatacar();
  if (!jugador.atacar(linea)) return false;
  if (EN_LINEA) { red.intencion({ que: 'atacar', linea }); predHasta = reloj + PREDICCION; }
  if (preparaba) registrar(tr('Finta: cambias a {l}', { l: tr(NOMBRE_LINEA[linea]).toLowerCase() }), 'aviso');
  else { stats.golpes++; if (contra) registrar(tr('Contraataque: solo se para con una parada perfecta'), 'aviso'); }
  $('btnParar').classList.remove('activo');
  return true;
}
function disparar() {
  // en línea se manda siempre que se suelta (también flojo: así el servidor deja de tensar)
  if (EN_LINEA && jugador.accion === 'tensando' && red) {
    const obj = apuntado || { x: jugador.x + Math.sin(jugador.rot) * 20, y: 0, z: jugador.z + Math.cos(jugador.rot) * 20 };
    red.intencion({ que: 'soltar', x: obj.x, y: obj.y || 0, z: obj.z }); predHasta = reloj + PREDICCION;
  }
  const tiro = jugador.soltar();
  if (!tiro) {
    if (jugador.cancelado === 'flojo') { registrar(tr('Demasiado flojo: el tiro se cancela (hace falta tensar al menos la mitad)'), 'aviso'); jugador.cancelado = null; }
    return;
  }
  const obj = apuntado || { x: jugador.x + Math.sin(jugador.rot) * 20, y: 0, z: jugador.z + Math.cos(jugador.rot) * 20 };
  if (EN_LINEA) { stats.flechas++; sonido.cuerda(); return; } // la flecha la tira el servidor (llega como «disparo»)
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
  if (EN_LINEA) { tickEnLinea(dt, dtReal); return; }
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
  seguirDedoArco(dtReal);
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
  proyectiles = proyectiles.filter(pr => { if (pr.vida <= 0) { escena.remove(pr.malla); liberar(pr.malla); return false; } return true; });
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
  // en línea, un rival que ya estaba caído cuando volviste a empezar no cuenta otra vez como victoria
  const rivalCae = rival.fuera && !yaVencidos.has(rival);
  if (jugador.fuera || rivalCae) {
    terminado = true;
    parar(false);
    const gana = rivalCae && !jugador.fuera;
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

// ---------------- Duelo en línea ----------------
// El rival es otro jugador. Lo que se ve de cada luchador es una copia que se pone al día con el servidor
// (src/logica/combate_cliente.js); los golpes, las heridas y las flechas solo llegan como eventos del servidor.
let red = null;
let predHasta = -1;                   // hasta cuándo (reloj) se respeta la acción propia antes de seguir al servidor
let ultimaFotoPropia = null;          // para volver a lo del servidor si rechaza lo que se hizo aquí
const otros = new Map();              // autor → { L, m, clave, vel, visto }
const flechasRed = [];                // flechas que ha tirado el servidor, solo para verlas volar
let yaVencidos = new Set();           // copias de rivales que ya estaban caídos al volver a empezar
function conectar() {
  const marca = document.createElement('span');
  marca.id = 'estadoRed';
  marca.style.cssText = 'pointer-events:auto;align-self:center;background:rgba(20,18,14,.72);color:#e8d9b0;border-radius:9px;padding:6px 9px;font-size:12px';
  $('menu').prepend(marca);
  red = conectarDuelo({
    aspecto: () => ({ sexo: 'hombre', capas: [], ...aspectoPropio() }),
    equipo: () => ({ arma: opc.arma, armadura: opc.armadura }),
    alEstado: (t) => { marca.textContent = t; },
    avisar: (t, tipo) => registrar(t, tipo),
    alMensaje: recibirRed,
  });
}
const luchadorDe = (autor) => autor === (red && red.yo) ? { L: jugador, m: mJugador } : otros.get(autor);
function quitarOtro(autor) {
  const o = otros.get(autor); if (!o) return;
  escena.remove(o.m); otros.delete(autor);
}
// el modelo de otro jugador, con el cuerpo y la ropa que mandó y la armadura que lleva
function vestirOtro(autor, o) {
  const a = red.aspectos.get(autor) || { sexo: 'hombre', capas: [] };
  const clave = `${a.sexo}:${a.capas.join(',')}:${o.L.armadura}:${JSON.stringify(normalizarAspecto(a.aspecto, a.sexo))}`;
  if (o.m && o.clave === clave) return;
  if (o.m) escena.remove(o.m);
  o.m = crearCombatiente({ armadura: o.L.armadura, colorCinta: 0xb3923f, recursos: RECURSOS_MH, sexo: a.sexo, capas: a.capas, aspecto: a.aspecto });
  o.m.userData.autor = autor; o.m.userData.tipoArma = null;
  o.clave = clave; escena.add(o.m);
}
function fotoDe(f) {
  if (f.autor === red.yo) {
    ultimaFotoPropia = f;
    aplicarFoto(jugador, f, { propio: true, prediciendo: reloj < predHasta });
    return;
  }
  if (!f.liza) { quitarOtro(f.autor); return; }   // los que construyen no están en la liza
  let o = otros.get(f.autor);
  if (!o) {
    o = { L: new Luchador({ nombre: f.autor, arma: f.arma, armadura: f.armadura, ritmo: RITMO.normal }), m: null, clave: null, vel: 0, visto: false };
    otros.set(f.autor, o);
  }
  aplicarFoto(o.L, f);
  vestirOtro(f.autor, o);
}
function recibirRed(msg) {
  if (msg.tipo === 'bienvenida') { for (const f of msg.luchadores || []) fotoDe(f); }
  else if (msg.tipo === 'luchadores') { for (const f of msg.lista) fotoDe(f); }
  else if (msg.tipo === 'aspecto') { const o = otros.get(msg.autor); if (o) vestirOtro(msg.autor, o); }
  else if (msg.tipo === 'combate') { for (const e of msg.eventos) eventoRed(e); }
  else if (msg.tipo === 'combate_rechazo') {
    // lo hecho aquí no ha valido: la copia vuelve a lo que dice el servidor
    predHasta = -1;
    if (ultimaFotoPropia) aplicarFoto(jugador, ultimaFotoPropia, { propio: true, prediciendo: false });
    if (msg.que === 'reiniciar' || msg.que === 'equipar') registrar(tr(msg.motivo), 'mal');
  } else if (msg.tipo === 'sale') { quitarOtro(msg.autor); }
  else if (msg.tipo === 'cortado') { for (const a of [...otros.keys()]) quitarOtro(a); }
}
const eventosRed = [];                // los últimos eventos del servidor (para las pruebas)
function eventoRed(e) {
  const yo = red.yo;
  eventosRed.push(e); if (eventosRed.length > 200) eventosRed.shift();
  if (e.tipo === 'golpe') {
    const at = luchadorDe(e.autor), de = e.objetivo ? luchadorDe(e.objetivo) : null;
    const res = resultadoDeEvento(e);
    if (e.autor === yo) contarYDecir(res, true, e.linea);
    else if (e.objetivo === yo) contarYDecir(res, false, e.linea);
    if (at && (de || res.resultado === 'fallo') && (e.autor === yo || e.objetivo === yo || res.resultado !== 'fallo'))
      efectos(res, at.L, de ? de.L : at.L, at.m, de ? de.m : null);
    if (de && de.L === jugador && !jugador.bloqueando) $('btnParar').classList.remove('activo');
  } else if (e.tipo === 'disparo') {
    const tirador = luchadorDe(e.autor);
    const malla = e.arma === 'arco' ? modeloFlecha() : modeloPiedra();
    malla.position.set(e.x, e.y, e.z); escena.add(malla);
    flechasRed.push({ autor: e.autor, malla, x0: e.x, z0: e.z, v: new THREE.Vector3(e.vx, e.vy, e.vz), activo: true, vida: 12 });
    if (e.autor !== yo && tirador) sonido.cuerda();
  } else if (e.tipo === 'flecha') {
    const f = flechasRed.find(x => x.activo && x.autor === e.autor);
    if (f) { f.activo = false; f.malla.position.set(e.x, e.y, e.z); }
    const deMi = e.autor === yo, aMi = e.objetivo === yo;
    const piedra = e.arma !== 'arco';
    if (e.resultado === 'blanco') {
      if (deMi) stats.aciertos++; if (aMi) stats.recibidas++;
      if (deMi || aMi) registrar(tr(deMi ? 'Aciertas: herida {g} en {z}' : 'Te alcanza: herida {g} en {z}', { g: tr(e.gravedad), z: tr(NOMBRE_ZONA[e.zona]) }), deMi ? 'bien' : 'mal');
      particulas.emitir(e.x, e.y, e.z, 12, 0x8a1410, 2, 9.8, 0.5);
      const herido = luchadorDe(e.objetivo); if (herido && herido.m) sacudir(herido.m, 0.8);
      sonido.corte(); pausa = 0.05;
    } else if (e.resultado === 'escudo') {
      if (aMi) { stats.paradas++; registrar(tr(piedra ? 'Tu escudo para la piedra' : 'Tu escudo para la flecha'), 'bien'); }
      else if (deMi) registrar(tr(piedra ? 'El rival para tu piedra con el escudo' : 'El rival para tu flecha con el escudo'), '');
      particulas.emitir(e.x, e.y, e.z, 8, 0x9a7a52, 2, 9.8, 0.4);
      if (piedra) sonido.golpeSordo(); else sonido.clavar();
    } else if (e.resultado === 'suelo' && deMi && f) registrar(tr('Al suelo a {d} m', { d: Math.round(Math.hypot(e.x - f.x0, e.z - f.z0)) }), '');
  } else if (e.tipo === 'reinicio') {
    if (e.autor === yo) {
      terminado = false; $('final').hidden = true; predHasta = -1;
      // la copia propia, sana ya (el servidor manda su foto en el siguiente tic)
      Object.assign(jugador, { fuera: false, motivoFuera: '', accion: 'libre', tAccion: 0, heridas: [], sangre: 100, cansancio: 0, bloqueando: false, contraHasta: -1 });
      yaVencidos = new Set([...otros.values()].filter(o => o.L.fuera).map(o => o.L));
      stats = { golpes: 0, heridasDadas: 0, paradas: 0, perfectas: 0, maestros: 0, recibidas: 0, flechas: 0, aciertos: 0, puntos: 0 };
      registrar(tr('Vuelves a empezar, sano.'), 'aviso');
    } else if (otros.has(e.autor)) {
      const L = otros.get(e.autor).L;
      yaVencidos.delete(L);
      // su copia, sana ya (su foto llega en el siguiente tic; si no, este fotograma aún lo vería caído)
      Object.assign(L, { fuera: false, motivoFuera: '', accion: 'libre', tAccion: 0, heridas: [], sangre: 100, cansancio: 0, bloqueando: false });
      registrar(tr('Tu rival vuelve a empezar, sano.'), '');
      // si le habías vencido tú, la pelea sigue (con tus heridas): se quita la pantalla final
      if (terminado && !jugador.fuera && L === rival) { terminado = false; $('final').hidden = true; }
    }
  }
}
// Otra partida: en línea lo pide al servidor (solo si estás fuera de combate o no hay nadie en pie cerca)
function otraPartida() {
  if (!EN_LINEA) return nuevaPartida();
  if (red && red.estado === 'conectado') red.intencion({ que: 'reiniciar' });
}
// En línea, cambiar de arma o de armadura no empieza otra partida: se pide al servidor (solo estando libre)
function cambiarEquipo() {
  if (jugador.puedeActuar() && !jugador.bloqueando) { jugador.arma = opc.arma; jugador.armadura = opc.armadura; predHasta = reloj + PREDICCION; }
  if (red) { red.mandarEquipo(); red.mandarAspecto(); }
  ajustarControles();
}
function tickEnLinea(dt, dtReal) {
  avanzarCopia(jugador, dt, jugadorCorre);
  jugador.cancelado = null;
  // el propio: el modelo con la armadura y el arma que lleva su copia (las confirma el servidor)
  if (mJugador.userData.armaduraPuesta !== undefined && mJugador.userData.armaduraPuesta !== jugador.armadura) {
    escena.remove(mJugador);
    mJugador = crearCombatiente({ armadura: jugador.armadura, colorCinta: 0x46607e, recursos: RECURSOS_MH, ...aspectoPropio() });
    escena.add(mJugador);
  }
  mJugador.userData.armaduraPuesta = jugador.armadura;
  if (mJugador.userData.tipoArma !== jugador.arma) { ponerArma(mJugador, jugador.arma); mJugador.userData.tipoArma = jugador.arma; }
  // los demás: dónde están (la presencia, suavizada) y qué hacen (su copia)
  for (const o of otros.values()) o.visto = false;
  for (const e of red.ver()) {
    const o = otros.get(e.autor); if (!o) continue;
    const v = dt > 0 ? Math.hypot(e.x - o.L.x, e.z - o.L.z) / dt : 0;
    o.vel += (Math.min(v, 8) - o.vel) * Math.min(1, dt * 8);
    o.L.x = e.x; o.L.z = e.z;
    if (!o.L.fuera && o.L.accion !== 'aturdido') o.L.rot = e.giro;
    o.visto = true;
  }
  const lista = [...otros.values()].filter(o => o.visto && o.m);
  for (const o of otros.values()) {
    avanzarCopia(o.L, dt);
    if (o.m) o.m.visible = o.visto;
    if (o.m && o.m.userData.tipoArma !== o.L.arma) { ponerArma(o.m, o.L.arma); o.m.userData.tipoArma = o.L.arma; }
  }
  red.rivales = lista.filter(o => !o.L.fuera).length;
  const cerca = rivalCercano(jugador, lista);
  rival = cerca ? cerca.L : null; mRival = cerca ? cerca.m : null;
  if (rival) { // no meterse dentro del otro (solo se aparta el propio: al otro lo mueve su jugador)
    const dx = rival.x - jugador.x, dz = rival.z - jugador.z, d = Math.hypot(dx, dz);
    if (d < 0.75 && d > 1e-6) { jugador.x -= dx / d * (0.75 - d); jugador.z -= dz / d * (0.75 - d); }
  }
  const mag = jugador.velocidadActual || 0;
  red.paso({ x: jugador.x, y: 0, z: jugador.z, giro: jugador.rot, anim: mag > 0.05 ? (jugadorCorre ? 'correr' : 'andar') : 'quieto' });
  // las flechas del servidor, solo para verlas volar (dónde caen lo dice el servidor)
  for (const f of flechasRed) {
    if (f.activo) {
      f.v.y -= 9.8 * dt;
      f.malla.position.addScaledVector(f.v, dt);
      if (f.v.lengthSq() > 1e-6) f.malla.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.v.clone().normalize());
      if (f.malla.position.y < 0) { f.malla.position.y = 0; f.v.set(0, 0, 0); }
    } else f.vida -= dt;
  }
  for (let i = flechasRed.length - 1; i >= 0; i--) if (flechasRed[i].vida <= 0) { escena.remove(flechasRed[i].malla); liberar(flechasRed[i].malla); flechasRed.splice(i, 1); }
  particulas.actualizar(dtReal);
  colocar(mJugador, jugador, mag, dt, rival);
  for (const o of lista) colocar(o.m, o.L, o.vel, dt, jugador);
  rastroJ.actualizar(mJugador, enVuelo(jugador));
  rastroR.actualizar(mRival || mJugador, rival ? enVuelo(rival) : false);
  seguirDedoArco(dtReal);
  actualizarCamara(dtReal);
  actualizarRosa();
  actualizarReticula();
  actualizarPanel();
  comprobarFinal();
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
    bajoElMenu();
    cont.querySelectorAll('.aviso').forEach(b => b.onclick = () => { const a = av[+b.dataset.i]; $('detalle').hidden = false; $('detalle').innerHTML = `<b>${a.t}</b><br>${a.d}`; });
  }
  $('estado').textContent = tr(ARMAS[jugador.arma].nombre) + (jugador.bloqueando ? ' · ' + tr('parando') : '');
}
// los avisos van debajo de los botones de arriba (en el móvil, con «Menú», los fps y el estado de la red, ocupan
// varias filas y los avisos quedaban encima de ellos)
function bajoElMenu() {
  const m = $('menu'); if (!m) return;
  $('avisos').style.top = Math.max(64, Math.round(m.getBoundingClientRect().bottom + 10)) + 'px';
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
  el.onchange = () => { opc[clave] = el.value; guardarOpciones(); if (EN_LINEA) cambiarEquipo(); else nuevaPartida(); el.blur(); };
}
selector('selModo', { duelo: { nombre: 'Duelo' }, carga: { nombre: 'Carga desde 40 m' }, practicas: { nombre: 'Prácticas (poste y dianas)' } }, 'modo');
selector('selArma', ARMAS, 'arma');
selector('selArmadura', ARMADURAS, 'armadura');
selector('selArmaduraRival', ARMADURAS, 'armaduraRival');
selector('selArmaRival', ARMAS_RIVAL, 'armaRival');
selector('selDificultad', { aprendiz: { nombre: 'Aprendiz (lento, con avisos)' }, normal: { nombre: 'Normal (solo ves el lado)' }, realista: { nombre: 'Realista (sin avisos)' } }, 'dificultad');
$('chkSonido').checked = opc.sonido;
$('chkSonido').onchange = (e) => { opc.sonido = e.target.checked; guardarOpciones(); sonido.silenciar(!opc.sonido); };
$('btnOtra').onclick = () => otraPartida();
$('btnReiniciar').onclick = () => otraPartida();
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
// en línea, lo del rival lo pone el otro jugador: fuera de las opciones (también el modo: siempre duelo)
if (EN_LINEA) for (const id of ['selModo', 'selArmaduraRival', 'selArmaRival']) { $(id).hidden = true; const l = document.querySelector(`label[for="${id}"]`); if (l) l.hidden = true; }
function redimensionar() { bajoElMenu(); renderer.setSize(innerWidth, innerHeight, false); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); }
addEventListener('resize', redimensionar);
redimensionar();
if (EN_LINEA) conectar();
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
  get ctx() { return ctxCombate; }, registroAcciones, escena, renderer, camara, render() { renderer.render(escena, camara); },
  get dedoArco() { return dedoArco; }, nuevaPartida, atacar, disparar, lanzar, tick, registrar, parar, lineaDesdePantalla,
  configurar(o) { Object.assign(opc, o); nuevaPartida(); },
  apuntar(x, y, z) { apuntado = { x, y, z }; },
  get red() { return red; }, get otros() { return otros; }, eventosRed, otraPartida, EN_LINEA,
};
