// Kinhold — hito 1: construcción
import * as THREE from 'three';
import { Mundo, clave, centroLocal, localAMundo, mundoALocal, RADIO_MOJON, geometriaTejados, escaleraAndando, trampillaCerrada, progresoEscalera, centroMundo, tiempoObra, MAX_RATO, plantaObra, clasePeso, andamioEn, poleaPara, polipastoPara } from '../logica/construccion.js';
import { RegistroAcciones, ejecutar, seAbre, AUTOR_LOCAL, acabarObra } from '../logica/acciones.js';
import { PIEZAS, DECORACION, MATERIALES, MODULO, ALTURA } from '../logica/piezas.js';
import { modeloPieza, mojon as modeloMojon, decoracion as modeloDeco, mat, P, rellenoTejado, rampaVaras, troncoSuelto, POLEA, POLIPASTO, colgarPolipasto, tornoSuelto } from './modelos.js';
import { crearJugador } from './personaje.js';
import { personajeElegido } from '../demo/eleccion.js';
import { REGISTRO, VERSION } from './registro.js';
import { t } from './textos.js';
import { tr, traducirPagina, botonesIdioma } from '../idioma.js';
import { prepararRenderer, crearAmbiente } from '../mundo/ambiente.js';
import { crearDecorado } from '../mundo/decorado.js';
import { vigilar, ofrecerGente } from '../mundo/rendimiento.js';
import { conectarEnLinea } from './en_linea.js';
import { cargarInventarios, guardarInventarios, ejecutarInventario } from '../logica/inventario.js';

// lo primero: la página fija en el idioma elegido (antes de rellenar nada desde el código)
traducirPagina();
botonesIdioma(document.getElementById('menu'));
// En el móvil, los botones de modo van debajo del menú de arriba; en otros idiomas (ruso) el menú
// ocupa más filas, así que se colocan según lo que mida de verdad en vez de a una altura fija.
function colocarModos() {
  const modos = document.getElementById('modos'), menu = document.getElementById('menu');
  if (!modos || !menu) return;
  if (innerWidth > 640) { modos.style.top = ''; return; }
  modos.style.top = Math.max(120, Math.ceil(menu.getBoundingClientRect().bottom) + 10) + 'px';
}
// El aviso va justo debajo del menú de arriba (que en el móvil, y más en inglés o en ruso, ocupa varias filas)
// y, en el móvil, a la izquierda de los botones de modo, para no tapar nada.
function colocarAviso() {
  const a = document.getElementById('aviso'), sup = document.getElementById('superior'), modos = document.getElementById('modos');
  if (!a || !sup) return;
  a.style.top = Math.ceil(sup.getBoundingClientRect().bottom) + 8 + 'px';
  if (innerWidth > 640) { a.style.left = a.style.transform = a.style.maxWidth = ''; return; }
  const izq = 10, der = modos && !modos.hidden ? modos.getBoundingClientRect().left - 8 : innerWidth - 10;
  a.style.left = izq + 'px'; a.style.transform = 'none'; a.style.maxWidth = Math.max(140, der - izq) + 'px';
}
function colocarTodo() { colocarModos(); colocarAviso(); }
colocarTodo();
addEventListener('resize', colocarTodo);
// si el menú cambia de tamaño (la demo añade «Menú» y los fps, o cambia el idioma), se recoloca
if (window.ResizeObserver && document.getElementById('superior')) new ResizeObserver(colocarTodo).observe(document.getElementById('superior'));

const CLAVE_GUARDADO = 'kinhold_h1_v1';
// «Jugar en línea» (?enlinea=1): el mundo es el del servidor; nada se guarda en el navegador (src/juego/en_linea.js)
const EN_LINEA = new URLSearchParams(location.search).get('enlinea') === '1';
let enLinea = null;
const $ = (id) => document.getElementById(id);

// ---------------- Estado ----------------
let mundo = EN_LINEA ? new Mundo() : cargar();
// Toda acción que cambia el mundo pasa por la lógica pura con su autor y queda anotada (src/logica/acciones.js).
let registroAcciones = new RegistroAcciones();
function accion(a) {
  if (enLinea) { const r = enLinea.red.accion(a); mundo = enLinea.red.mundo; return r; }
  return ejecutar(mundo, registroAcciones, { autor: AUTOR_LOCAL, ...a });
}
// Lo que lleva el jugador (inventario por huecos, src/logica/inventario.js): también por acciones con autor.
// Por ahora solo cuenta para ir más despacio cargado; el panel para cogerlo y verlo llega en el hito 2.
const almacen = (() => { try { return localStorage; } catch (e) { return null; } })();
const inventarios = almacen ? cargarInventarios(almacen) : cargarInventarios({ getItem: () => null });
function accionInventario(a) {
  const r = ejecutarInventario(inventarios, registroAcciones, { autor: AUTOR_LOCAL, ...a });
  if (r.ok && almacen) guardarInventarios(almacen, inventarios);
  return r;
}
const inventario = () => inventarios.de(AUTOR_LOCAL);
const estado = {
  modo: 'mover',            // mover | construir | desmontar
  sel: { clase: 'pieza', tipo: 'cim_piedra' },
  planta: 0,
  rotLibre: 0,               // giro de la primera pieza de una construcción (rad)
  dir: 0,                    // orientación de tejado, hastial, escalera
  puntero: null,             // {x,z,y} en el mundo
  candidato: null,
  pendienteDesmontar: null,  // {c, key} o {deco}
  esTactil: matchMedia('(pointer: coarse)').matches,
};

function cargar() {
  try {
    const txt = localStorage.getItem(CLAVE_GUARDADO);
    if (txt) return Mundo.importar(JSON.parse(txt));
  } catch (e) { /* sin almacenamiento */ }
  return new Mundo();
}
function guardar() {
  if (EN_LINEA) return;
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(mundo.exportar())); } catch (e) { /* sin almacenamiento */ }
}

// ---------------- Escena ----------------
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0); // el cielo lo pinta la página (un degradado CSS no cuesta nada dibujarlo)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
prepararRenderer(renderer); // sombras blandas, sRGB y ACES: los de la escena común
vigilar(renderer); // fotogramas, triángulos y memoria (src/mundo/rendimiento.js)
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
// cielo, sol, luz del cielo y niebla del estilo v5 (src/mundo/ambiente.js); la sombra sigue al jugador
const ambiente = crearAmbiente(escena, { fondoPagina: true, alcance: 30, mapa: 2048, niebla: [70, 200] });

// decorado común (src/mundo/decorado.js): llano para construir, bosque, hierba y rocas con colisión.
// Como la prueba de estilo v5: hierba densa con flores desde el centro, matorrales, calvas de tierra pisada,
// rocas y algunos árboles sueltos más cerca. Donde se construye, la hierba, las flores y las matas se esconden
// (decorado.despejar, en reconstruir) para que no asomen por los cimientos.
const decorado = crearDecorado({ semilla: 7, llano: 60, lejos: 230, arboles: 220, bosqueDesde: 28, bosqueHasta: 175,
  hierba: 3200, flores: 900, hierbaDesde: 0, hierbaHasta: 46, rocas: 40, rocasDesde: 9, matas: 45, matasDesde: 7,
  sueltos: 10, sueltosDesde: 22, calvas: 14, claro: (x, z) => Math.hypot(x, z - 4) > 1.5 }); // sin nada en el sitio de salida
escena.add(decorado.raiz);
const obstaculos = decorado.obstaculos; // {x,z,r}

// ---------------- Personaje y cámara ----------------
// personaje del taller propio: la versión publicada vive en jugar/construccion/, los modelos en recursos/personajes/taller-v10/
const RECURSOS_MH = new URLSearchParams(location.search).get('recursosMH') || '../../recursos/personajes/taller-v10/';
// el personaje elegido en el visor (cuerpo y ropa); si no se ha elegido ninguno, camisa y calzas de lino (GDD)
const elegido = personajeElegido();
const jugador = elegido ? crearJugador(RECURSOS_MH, elegido.sexo, elegido.capas, elegido.aspecto) : crearJugador(RECURSOS_MH);
escena.add(jugador.raiz);
const pj = { x: 0, y: 0, z: 4, k: 0, rot: Math.PI, vel: 0 };
const cam = { yaw: Math.PI * 0.25, pitch: 0.9, dist: 16 };

// Gente de prueba, solo para medir el rendimiento con varios personajes (botón de la demo): personajes del taller
// que pasean en corro alrededor de donde estás. No son jugadores ni cambian el mundo: solo se dibujan.
const ROPA_PRUEBA = { hombre: [['tunica'], ['gambeson'], ['gambeson', 'cota', 'sobreveste'], []], mujer: [['vestido'], ['vestido', 'gambeson'], []] };
const gente = [];
ofrecerGente({
  cuantos: () => gente.length,
  poner(n) {
    while (gente.length > n) escena.remove(gente.pop().j.raiz);
    while (gente.length < n) {
      const i = gente.length, sexo = i % 2 ? 'mujer' : 'hombre', ropas = ROPA_PRUEBA[sexo];
      const j = crearJugador(RECURSOS_MH, sexo, ropas[Math.floor(i / 2) % ropas.length]);
      escena.add(j.raiz);
      gente.push({ j, cx: pj.x, cz: pj.z, radio: 3 + (i % 4) * 1.2, ang: i * 2.4, sentido: i % 3 ? 1 : -1 });
    }
  },
});
function moverGente(dt) {
  for (const g of gente) {
    g.ang += g.sentido * 0.97 * dt / g.radio; // a paso de andar (0,97 m/s)
    g.j.raiz.position.set(g.cx + Math.cos(g.ang) * g.radio, 0, g.cz + Math.sin(g.ang) * g.radio);
    g.j.raiz.rotation.y = -g.ang + (g.sentido > 0 ? 0 : Math.PI); // mirando hacia donde anda
    g.j.animar(0.97, dt);
  }
}

function actualizarCamara() {
  const objetivo = new THREE.Vector3(pj.x, pj.y + 1.2, pj.z);
  const cp = Math.cos(cam.pitch);
  camara.position.set(
    objetivo.x + Math.sin(cam.yaw) * cp * cam.dist,
    objetivo.y + Math.sin(cam.pitch) * cam.dist,
    objetivo.z + Math.cos(cam.yaw) * cp * cam.dist);
  camara.lookAt(objetivo);
  ambiente.seguir(pj.x, pj.z);
}

// ---------------- Construcciones en pantalla ----------------
const raizConstr = new THREE.Group();
escena.add(raizConstr);
const raizDeco = new THREE.Group();
escena.add(raizDeco);
let mallaMojon = null, anilloTierra = null;
// el material del anillo de la tierra es siempre el mismo: si se tirara al rehacer, se volvería a compilar su sombreador
const MAT_ANILLO = new THREE.MeshBasicMaterial({ color: 0xf2e3b5, transparent: true, opacity: 0.55, depthWrite: false });
const registroMallas = []; // {obj, c, key, deco}

function transformarPieza(obj, p) {
  const l = centroLocal(p);
  obj.position.set(l.lx, p.k * ALTURA, l.lz);
  let ry = 0;
  if (['e', 'b', 'p', 'g', 'q', 'w'].includes(p.hueco) && p.d === 1) ry = -Math.PI / 2;
  if (p.hueco === 'g' && p.dir % 2 === 1) ry += Math.PI;
  if (p.hueco === 'r' || p.hueco === 'l' || p.hueco === 't') ry = -(p.dir || 0) * Math.PI / 2;
  obj.rotation.y = ry;
}
// las hojas que se abren (puertas, portones, contraventanas, trampillas) se llaman «hoja»; las que no giran como una
// puerta llevan su giro en userData.abre ({ eje, ang })
function aplicarAperturas(obj, p) {
  obj.traverse(o => {
    if (o.name !== 'hoja') return;
    const a = o.userData.abre;
    if (a) o.rotation[a.eje] = p.abierta ? a.ang : 0;
    else o.rotation.y = p.abierta ? -Math.PI / 2 : 0;
  });
}

// Libera en la tarjeta gráfica las mallas que se quitan. Sin esto, cada vez que se colocaba o se quitaba algo se
// rehacían todas las piezas y las viejas se quedaban ocupando memoria gráfica: tras un rato construyendo, el móvil
// se quedaba sin ella y la pantalla en blanco aunque fuera a más de 80 fps (lo vio valravnx). Los materiales son
// compartidos (salen de una caché) y no se liberan.
function liberar(obj) { if (window.__sinLiberar) return; obj.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); } // __sinLiberar: solo para comprobar que la prueba de la fuga falla
// Esconde la hierba, las flores y las matas bajo lo construido en la planta baja y bajo los muebles del suelo.
function despejarDecorado() {
  if (window.__sinDespejar) return; // solo para comprobar que la prueba de la hierba bajo lo construido falla
  const circ = [];
  for (const c of mundo.construcciones) for (const p of c.piezas.values()) {
    if (p.k !== 0) continue;
    const l = centroLocal(p), m = localAMundo(c, l.lx, l.lz);
    circ.push([m.x, m.z, p.hueco === 'f' ? MODULO * 0.78 : MODULO * 0.45]);
  }
  for (const d of mundo.decoracion) if (d.y < 0.3) circ.push([d.x, d.z, 0.8]);
  if (mundo.mojon) circ.push([mundo.mojon.x, mundo.mojon.z, 0.9]);
  estado.plantasOcultas = decorado.despejar((x, z) => circ.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r));
}
// suelos y cimientos de troncos: qué casillas de al lado tienen el mismo suelo terminado, para juntarse con ellas
const TIPOS_QUE_SE_JUNTAN = new Set(['suelo_tronco', 'cim_tronco']);
function contextoSuelo(c, p) {
  if (p.hueco === 'w') { // contraventana: en qué muro va y cuál es su lado de fuera (el que no da a un suelo de la casa)
    const m = c.piezas.get(clave('e', p.i, p.j, p.k, p.d));
    const delante = p.d === 0 ? [p.i, p.j] : [p.i - 1, p.j], detras = p.d === 0 ? [p.i, p.j - 1] : [p.i, p.j]; // +z y -z locales
    const suelo = ([i, j]) => c.piezas.has(clave('f', i, j, p.k));
    return { muro: m && m.tipo, fuera: suelo(delante) && !suelo(detras) ? -1 : 1 };
  }
  if (p.hueco !== 'f' || !TIPOS_QUE_SE_JUNTAN.has(p.tipo) || p.obra) return undefined;
  const igual = (di, dj) => { const q = c.piezas.get(clave('f', p.i + di, p.j + dj, p.k)); return !!q && q.tipo === p.tipo && !q.obra; };
  return { vecinos: { xn: igual(-1, 0), xp: igual(1, 0), zn: igual(0, -1), zp: igual(0, 1) } };
}
// el objeto 3D de una pieza (tj: su tejado, de geometriaTejados)
function objPieza(c, key, p, tj) {
  const obj = modeloPieza(p.tipo, tj || contextoSuelo(c, p));
  transformarPieza(obj, p);
  aplicarAperturas(obj, p);
  if (tj) {
    obj.position.y += tj.arranque * P.subidaTejado;
    for (const rel of tj.rellenos) obj.add(rellenoTejado(rel, tj.arranque));
  }
  if (p.obra) vestirObra(obj, p);
  obj.userData = { c, key, k: p.k };
  obj.traverse(o => { if (o.isMesh) o.userData.ref = obj; });
  return obj;
}
// Rehace solo una pieza (una obra que avanza un cuarto). Rehacer todo lo construido cada vez que avanzaba una obra
// tiraba los fotogramas mientras se construía (lo vio valravnx jugando en línea el 27 oct): con una cabaña, cada
// vez son cientos de milisegundos, y más en el móvil.
function rehacerPieza(idC, key) {
  const i = registroMallas.findIndex(m => m.c && m.c.id === idC && m.key === key);
  const c = mundo.construcciones.find(x => x.id === idC), p = c && c.piezas.get(key);
  if (window.__rehacerTodo || i < 0 || !p || !registroMallas[i].obj.parent) { reconstruir(); return; } // __rehacerTodo: solo para que falle su prueba
  const viejo = registroMallas[i].obj, g = viejo.parent;
  window.__rehechos.pieza++;
  const obj = objPieza(c, key, p, geometriaTejados(c).get(key));
  obj.visible = viejo.visible;
  g.remove(viejo); liberar(viejo); g.add(obj);
  registroMallas[i] = { obj, c, key };
}
window.__rehechos = { todo: 0, pieza: 0 }; // cuántas veces se rehace todo o una pieza (para la prueba)
function reconstruir() {
  window.__rehechos.todo++;
  for (const r of [raizConstr, raizDeco]) for (const h of r.children) liberar(h);
  raizConstr.clear(); raizDeco.clear();
  registroMallas.length = 0;
  for (const c of mundo.construcciones) {
    const g = new THREE.Group();
    g.position.set(c.ox, 0, c.oz);
    g.rotation.y = c.rot;
    g.userData.c = c;
    const tejados = geometriaTejados(c);
    for (const [key, p] of c.piezas) {
      const obj = objPieza(c, key, p, tejados.get(key));
      g.add(obj);
      registroMallas.push({ obj, c, key });
    }
    raizConstr.add(g);
  }
  for (const d of mundo.decoracion) {
    const obj = modeloDeco(d.tipo);
    obj.position.set(d.x, d.y, d.z);
    obj.rotation.y = d.rot;
    obj.userData = { deco: d };
    obj.traverse(o => { if (o.isMesh) o.userData.ref = obj; });
    raizDeco.add(obj);
    registroMallas.push({ obj, deco: d });
  }
  despejarDecorado();
  if (mallaMojon) { escena.remove(mallaMojon); liberar(mallaMojon); mallaMojon = null; }
  if (anilloTierra) { escena.remove(anilloTierra); liberar(anilloTierra); anilloTierra = null; }
  if (mundo.mojon) {
    mallaMojon = modeloMojon();
    mallaMojon.position.set(mundo.mojon.x, 0, mundo.mojon.z);
    escena.add(mallaMojon);
    const anillo = new THREE.Mesh(new THREE.RingGeometry(RADIO_MOJON - 0.15, RADIO_MOJON, 96), MAT_ANILLO);
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.set(mundo.mojon.x, 0.03, mundo.mojon.z);
    anilloTierra = anillo;
    escena.add(anillo);
  }
  actualizarUI();
}

// ---------------- Obras ----------------
// Una obra a medias (GDD, «Obras»): se ve la pieza muy tenue, como un trazado, dentro de un armazón de varas
// atadas que la envuelve (cuatro pies derechos, largueros arriba y abajo y una riostra en cruz por cara).
// Cuanto más trabajo lleva, menos tenue se ve la pieza.
const MAT_ARMAZON = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
const MAT_ATADURA = new THREE.MeshLambertMaterial({ color: 0xb8a27a });
const matsObra = new Map();
function matObra(base, nivel) {
  const b = Array.isArray(base) ? base[0] : base, k = nivel + ':' + (b?.map?.uuid || 'liso') + (b?.vertexColors ? 'v' : '');
  if (!matsObra.has(k)) matsObra.set(k, new THREE.MeshLambertMaterial({ color: 0xd8ccb4, emissive: 0x1a140c, vertexColors: !!b?.vertexColors,
    map: b?.map || null, transparent: true, opacity: 0.42 + 0.12 * nivel, depthWrite: false }));
  return matsObra.get(k);
}
function vara(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), largo = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, largo, 6), MAT_ARMAZON);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}
function vestirObra(obj, p) {
  const total = tiempoObra(p.tipo), nivel = Math.min(4, Math.floor(4 * p.obra.trabajo / total)); // 0..4
  obj.traverse(o => { if (o.isMesh) { o.material = matObra(o.material, nivel); o.castShadow = false; o.renderOrder = 1; } });
  // caja de la pieza en sus propios ejes, un poco más holgada
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), caja = new THREE.Box3();
  obj.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); caja.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); } });
  if (caja.isEmpty()) return;
  const h = 0.06, x0 = caja.min.x - h, x1 = caja.max.x + h, z0 = caja.min.z - h, z1 = caja.max.z + h;
  const y0 = Math.max(0, caja.min.y), y1 = Math.max(caja.max.y + 0.08, y0 + 0.5), r = 0.035;
  const g = new THREE.Group(); g.name = 'armazon';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const esq = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (const [x, z] of esq) g.add(vara(V(x, y0, z), V(x, y1 + 0.12, z), r));
  for (let i = 0; i < 4; i++) {
    const [xa, za] = esq[i], [xb, zb] = esq[(i + 1) % 4];
    if (Math.hypot(xb - xa, zb - za) < 0.5) continue; // la cara estrecha de un muro: basta con los pies
    for (const y of [y0 + 0.1, y1]) g.add(vara(V(xa, y, za), V(xb, y, zb), r * 0.85));
    g.add(vara(V(xa, y0 + 0.1, za), V(xb, y1, zb), r * 0.7)); // riostra
    for (const [x, z] of [[xa, za], [xb, zb]]) for (const y of [y0 + 0.1, y1]) {
      const at = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.07, 6), MAT_ATADURA); at.position.set(x, y, z); g.add(at);
    }
  }
  obj.add(g);
}

// ---------------- Resaltados ----------------
// Fantasma y resaltados con el estilo v5: la pieza conserva su textura y su color horneado (se ve qué es y cómo
// quedará) con un velo apagado encima: verde si cabe, rojo si no; al desmontar, naranja lo que se quita y rojo lo que caería.
const VELOS = {
  ok: { color: 0xd4efc6, emissive: 0x2a4a28, veladura: true }, mal: { color: 0xffb4a6, emissive: 0x58180f, veladura: true },
  rojo: { color: 0xf09a88, emissive: 0x52150e }, naranja: { color: 0xf3c486, emissive: 0x47290a },
};
const matsVelo = new Map();
function matVelo(base, clase) {
  const b = Array.isArray(base) ? base[0] : base, k = clase + ':' + (b?.map?.uuid || 'liso') + (b?.vertexColors ? 'v' : '');
  if (!matsVelo.has(k)) {
    const v = VELOS[clase];
    matsVelo.set(k, new THREE.MeshLambertMaterial({ color: v.color, emissive: v.emissive, vertexColors: !!b?.vertexColors, map: b?.map || null,
      transparent: !!v.veladura, opacity: v.veladura ? 0.62 : 1, depthWrite: !v.veladura }));
  }
  return matsVelo.get(k);
}
let resaltados = [];
function resaltar(obj, clase) {
  obj.traverse(o => {
    if (o.isMesh) {
      if (!o.userData.matOriginal) o.userData.matOriginal = o.material;
      o.material = matVelo(o.userData.matOriginal, clase);
      resaltados.push(o);
    }
  });
}
function limpiarResaltado() {
  for (const o of resaltados) if (o.userData.matOriginal) { o.material = o.userData.matOriginal; delete o.userData.matOriginal; }
  resaltados = [];
}
function objDe(c, key) { const r = registroMallas.find(m => m.c === c && m.key === key); return r && r.obj; }

// ---------------- Fantasma de colocación ----------------
let fantasma = null, fantasmaTipo = null, fantasmaForma = null;
function velarFantasma() {
  fantasma.traverse(o => { if (o.isMesh) { o.userData.matBase = o.material; o.material = matVelo(o.material, 'ok'); o.castShadow = false; o.renderOrder = 2; } });
}
// el remate de tejado cambia de forma según los tramos de al lado (limatesa o limahoya): el fantasma también
function formaFantasma(forma) {
  if (!fantasma || forma === fantasmaForma) return;
  const viejo = fantasma;
  fantasma = modeloPieza(estado.sel.tipo, { forma });
  fantasma.position.copy(viejo.position); fantasma.quaternion.copy(viejo.quaternion); fantasma.scale.copy(viejo.scale);
  fantasma.visible = viejo.visible;
  escena.remove(viejo); liberar(viejo);
  velarFantasma(); escena.add(fantasma);
  fantasmaForma = forma;
}
function prepararFantasma() {
  const tipo = estado.modo === 'construir' ? estado.sel.clase + ':' + estado.sel.tipo : null;
  if (tipo === fantasmaTipo) return;
  if (fantasma) { escena.remove(fantasma); liberar(fantasma); fantasma = null; }
  fantasmaTipo = tipo; fantasmaForma = null;
  if (!tipo) return;
  if (estado.sel.clase === 'pieza') fantasma = modeloPieza(estado.sel.tipo);
  else if (estado.sel.clase === 'deco') fantasma = modeloDeco(estado.sel.tipo);
  else fantasma = modeloMojon();
  if (estado.sel.clase === 'pieza' && PIEZAS[estado.sel.tipo].esquina) fantasmaForma = 'tesa';
  velarFantasma();
  fantasma.visible = false;
  escena.add(fantasma);
}
function pintarFantasma(valido) {
  if (!fantasma) return;
  fantasma.traverse(o => { if (o.isMesh) o.material = matVelo(o.userData.matBase, valido ? 'ok' : 'mal'); });
}

// Evalúa lo que pasaría al colocar en el puntero actual y lo muestra.
function evaluarColocacion() {
  limpiarResaltado();
  prepararFantasma();
  estado.candidato = null;
  if (estado.modo !== 'construir' || !estado.puntero || !fantasma) { if (fantasma) fantasma.visible = false; mostrarAviso(''); return; }
  const { x, z } = estado.puntero;
  const sel = estado.sel;
  fantasma.visible = true;
  if (sel.clase === 'mojon') {
    fantasma.position.set(x, 0, z); fantasma.rotation.set(0, 0, 0);
    const v = mundo.mojon ? { ok: false, motivo: t('yaMojon') } : mundo.puedePagar(PIEZAS.mojon.coste) ? { ok: true } : { ok: false, motivo: t('faltanMateriales') };
    pintarFantasma(v.ok); mostrarAviso(v.ok ? '' : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'mojon', x, z, v };
    return;
  }
  if (sel.clase === 'deco') {
    const y = estado.puntero.ySuperficie || 0;
    fantasma.position.set(x, y, z); fantasma.rotation.set(0, estado.rotDeco || 0, 0);
    let v = { ok: true };
    if (!mundo.mojon) v = { ok: false, motivo: t('primeroMojon') };
    else if (!mundo.dentroDeTierra(x, z)) v = { ok: false, motivo: t('fueraTierra') };
    else if (!mundo.puedePagar(DECORACION[sel.tipo].coste)) v = { ok: false, motivo: t('faltanMateriales') };
    pintarFantasma(v.ok); mostrarAviso(v.ok ? '' : tr(v.motivo), !v.ok);
    estado.candidato = { tipo: 'deco', x, y, z, v };
    return;
  }
  const datos = { pieza: sel.tipo, x, z, k: estado.planta, rot: estado.rotLibre, dir: estado.dir };
  const cand = mundo.candidata(datos.pieza, x, z, datos.k, datos.rot, datos.dir);
  const v = mundo.validar(cand, true); // se pone el marco de la obra: el material se lleva después
  // colocar el fantasma en la rejilla de su construcción
  const c = cand.construccion;
  const tmp = new THREE.Group();
  tmp.position.set(c.ox, 0, c.oz); tmp.rotation.y = c.rot; tmp.updateMatrixWorld();
  const local = new THREE.Object3D();
  transformarPieza(local, cand.pieza);
  tmp.add(local); tmp.updateMatrixWorld(true);
  local.matrixWorld.decompose(fantasma.position, fantasma.quaternion, fantasma.scale);
  if (cand.pieza.hueco === 'r' && !cand.nueva && v.ok) {
    // el tramo continúa la pendiente de los vecinos: arranca más alto
    c.piezas.set(v.clave, cand.pieza);
    const tj = geometriaTejados(c).get(v.clave);
    c.piezas.delete(v.clave);
    if (tj) fantasma.position.y += tj.arranque * P.subidaTejado;
    if (tj && tj.forma) formaFantasma(tj.forma);
  }
  pintarFantasma(v.ok);
  if (!v.ok && v.debil) {
    const o = objDe(c, v.debil);
    if (o) resaltar(o, 'rojo');
    const pd = c.piezas.get(v.debil) || cand.pieza;
    mostrarAviso(`${tr(v.motivo)} ${t('puntoDebil')}: ${tr(PIEZAS[pd.tipo].nombre)} (${Math.round(v.carga)} / ${v.cap} kg)`, true);
  } else {
    mostrarAviso(v.ok ? (cand.nueva ? t('nuevaConstruccion') : '') : tr(v.motivo), !v.ok);
  }
  estado.candidato = { tipo: 'pieza', cand, v, datos };
}

function colocar() {
  const ca = estado.candidato;
  if (!ca) return;
  if (!ca.v.ok) { mostrarAviso(tr(ca.v.motivo), true); return; }
  let r;
  if (ca.tipo === 'mojon') r = accion({ tipo: 'mojon', x: ca.x, z: ca.z });
  else if (ca.tipo === 'deco') r = accion({ tipo: 'decorar', pieza: estado.sel.tipo, x: ca.x, y: ca.y, z: ca.z, rot: estado.rotDeco || 0 });
  else r = accion({ tipo: 'colocar', ...ca.datos });
  if (r.ok) {
    if (ca.tipo === 'mojon') { estado.sel = { clase: 'pieza', tipo: 'cim_piedra' }; marcarSeleccion(); }
    guardar(); reconstruir(); evaluarColocacion();
    if (r.obra) mostrarAviso(t('marcoPuesto'));
  } else mostrarAviso(tr(r.motivo), true);
}

// ---------------- Desmontar ----------------
function evaluarDesmontaje(hit) {
  limpiarResaltado();
  estado.pendienteDesmontar = null;
  if (!hit) { mostrarAviso(''); return; }
  const obj = hit.object.userData.ref;
  if (!obj) { mostrarAviso(''); return; }
  if (obj.userData.deco) {
    resaltar(obj, 'naranja');
    estado.pendienteDesmontar = { deco: obj.userData.deco };
    mostrarAviso(`${tr(DECORACION[obj.userData.deco.tipo].nombre)}: ${t('recuperas75')}`);
    return;
  }
  const { c, key } = obj.userData;
  const pre = mundo.previsualizarDesmontaje(c, key);
  resaltar(obj, 'naranja');
  for (const k2 of pre.caen || []) { const o = objDe(c, k2); if (o) resaltar(o, 'rojo'); }
  if (!pre.ok) {
    const o = objDe(c, pre.debil); if (o) resaltar(o, 'rojo');
    mostrarAviso(tr(pre.motivo), true);
    return;
  }
  estado.pendienteDesmontar = { c, key, caen: pre.caen.length };
  const nombre = tr(PIEZAS[c.piezas.get(key).tipo].nombre);
  mostrarAviso(pre.caen.length === 1 ? `${nombre}: ${t('caera1')}` : pre.caen.length ? `${nombre}: ${t('caeran')} ${pre.caen.length} ${t('piezasEncima')}` : `${nombre}: ${t('recuperas75')}`, pre.caen.length > 0);
}
function confirmarDesmontaje() {
  const pd = estado.pendienteDesmontar;
  if (!pd) return;
  let r;
  if (pd.deco) r = accion({ tipo: 'quitar', id: pd.deco.id });
  else r = accion({ tipo: 'desmontar', construccion: pd.c.id, clave: pd.key });
  estado.pendienteDesmontar = null;
  if (r.ok) {
    const dev = Object.entries(r.devuelto || {}).map(([m, n]) => `+${n} ${tr(MATERIALES[m]).toLowerCase()}`).join(', ');
    guardar(); reconstruir();
    mostrarAviso(`${t('desmontado')}${dev ? ': ' + dev : ''}${r.caen && r.caen.length ? ' · ' + r.caen.length + ' ' + (r.caen.length === 1 ? t('destruida1') : t('destruidas')) : ''}`);
  } else mostrarAviso(tr(r.motivo), true);
  limpiarResaltado();
  $('confirmar').hidden = true;
}

// ---------------- Raycast ----------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function rayoDesde(clientX, clientY) {
  const r = lienzo.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camara);
  return ray;
}
function punteroDesde(clientX, clientY) {
  const rr = rayoDesde(clientX, clientY);
  if (estado.modo === 'construir' && estado.sel.clase === 'deco') {
    // la decoración se apoya en los suelos o cimientos de la planta en la que estás, o en el terreno. Solo cuentan
    // los de tu planta: el suelo de arriba (oculto o no) nunca recibe el clic (lo vio valravnx: la cama se iba al
    // altillo estando debajo). Las obras a medias tampoco.
    const objetivos = registroMallas.filter(m => {
      const p = m.c && m.c.piezas.get(m.key);
      return p && p.hueco === 'f' && p.k === pj.k && !p.obra && m.obj.visible;
    }).map(m => m.obj);
    const hits = rr.intersectObjects(objetivos, true);
    if (hits.length) return { x: hits[0].point.x, z: hits[0].point.z, ySuperficie: hits[0].point.y };
    if (pj.k > 0) return null; // arriba, fuera de los suelos de tu planta no hay dónde ponerla
  }
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -estado.planta * ALTURA * (estado.sel.clase === 'pieza' ? 1 : 0));
  const pto = new THREE.Vector3();
  if (!rr.ray.intersectPlane(plano, pto)) return null;
  return { x: pto.x, z: pto.z, ySuperficie: 0 };
}
function piezaBajo(clientX, clientY) {
  const rr = rayoDesde(clientX, clientY);
  const objs = registroMallas.filter(m => m.obj.visible).map(m => m.obj);
  const hits = rr.intersectObjects(objs, true).filter(h => h.object.visible && h.object.userData.ref && h.object.userData.ref.visible);
  return hits[0] || null;
}

// ---------------- Entrada: teclado ----------------
// Las teclas se leen por su posición física (e.code), no por la letra que escribe: con la distribución rusa
// (o cualquier otra) W escribe «ц» y antes no movía (lo vio valravnx el 27 oct). Lo que no está en la tabla
// (+, - y demás) sigue por la letra. Al perder el foco se sueltan todas, para que ninguna se quede pulsada.
const TECLAS_FISICAS = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', KeyR: 'r', KeyB: 'b', KeyX: 'x', KeyF: 'f',
  ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
  ShiftLeft: 'shift', ShiftRight: 'shift', PageUp: 'pageup', PageDown: 'pagedown', Escape: 'escape',
  NumpadAdd: '+', NumpadSubtract: '-',
};
const nombreTecla = (e) => TECLAS_FISICAS[e.code] || (e.key || '').toLowerCase();
const teclas = new Set();
addEventListener('blur', () => teclas.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) teclas.clear(); });
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return; // atajos del navegador (Ctrl+W, etc.): no mueven
  const k = nombreTecla(e);
  teclas.add(k);
  if (k === 'r') girar();
  if (k === 'b') cambiarModo(estado.modo === 'construir' ? 'mover' : 'construir');
  if (k === 'x') cambiarModo(estado.modo === 'desmontar' ? 'mover' : 'desmontar');
  if (k === 'pageup' || k === '+') cambiarPlanta(1);
  if (k === 'pagedown' || k === '-') cambiarPlanta(-1);
  if (k === 'f') usar();
  if (k === 'escape') cambiarModo('mover');
});
addEventListener('keyup', (e) => {
  teclas.delete(nombreTecla(e));
  teclas.delete((e.key || '').toLowerCase()); // por si se pulsó con otra distribución y se suelta con esta
  if (e.key === 'Shift') teclas.delete('shift');
});

// ---------------- Entrada: ratón y táctil ----------------
const punteros = new Map(); // pointerId -> {x,y,x0,y0,t0}
let arrastrando = false, pinzaDist = 0;
lienzo.addEventListener('contextmenu', e => e.preventDefault());
lienzo.addEventListener('pointerdown', (e) => {
  lienzo.setPointerCapture(e.pointerId);
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), boton: e.button });
  arrastrando = false;
  if (punteros.size === 2) {
    const [a, b] = [...punteros.values()];
    pinzaDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
lienzo.addEventListener('pointermove', (e) => {
  const p = punteros.get(e.pointerId);
  if (!p) {
    // ratón sin pulsar: mover el puntero de construcción
    if (e.pointerType === 'mouse') alPasar(e.clientX, e.clientY);
    return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) arrastrando = true;
  if (punteros.size === 2) {
    const [a, b] = [...punteros.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinzaDist) cam.dist = THREE.MathUtils.clamp(cam.dist * (pinzaDist / d), 6, 34);
    pinzaDist = d;
    cam.yaw -= dx * 0.004;
    return;
  }
  const rotarCamara = e.pointerType !== 'mouse' || p.boton === 2 || p.boton === 1 || (p.boton === 0 && estado.modo === 'mover');
  if (arrastrando && rotarCamara) {
    cam.yaw -= dx * 0.006;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.45, 1.35);
  }
  if (e.pointerType === 'mouse' && p.boton === 0 && estado.modo === 'construir') alPasar(e.clientX, e.clientY);
});
lienzo.addEventListener('pointerup', (e) => {
  const p = punteros.get(e.pointerId);
  punteros.delete(e.pointerId);
  if (punteros.size < 2) pinzaDist = 0;
  if (!p || arrastrando) return;
  // toque o clic sin arrastre
  if (e.pointerType === 'mouse' && p.boton !== 0) return;
  if (estado.modo === 'desmontar') {
    // el clic o el toque elige la pieza o el mueble y lo deja fijo hasta confirmar o cancelar
    elegirDesmontaje(e.clientX, e.clientY);
    return;
  }
  alPasar(e.clientX, e.clientY);
  if (e.pointerType === 'mouse' && estado.modo === 'construir') colocar();
});
lienzo.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 6, 34);
}, { passive: false });

function alPasar(cx, cy) {
  if (estado.modo === 'construir') {
    estado.puntero = punteroDesde(cx, cy);
    evaluarColocacion();
  } else if (estado.modo === 'desmontar' && $('confirmar').hidden) {
    // pasar el ratón solo enseña qué se quitaría; si ya hay algo elegido esperando confirmación, no se toca
    evaluarDesmontaje(piezaBajo(cx, cy));
  }
}
function elegirDesmontaje(cx, cy) {
  $('confirmar').hidden = true;
  evaluarDesmontaje(piezaBajo(cx, cy));
  if (estado.pendienteDesmontar) $('confirmar').hidden = false;
}

// Joystick táctil
const joy = { activo: false, id: null, cx: 0, cy: 0, vx: 0, vy: 0 };
{
  const zona = $('joystick'), pomo = $('pomo');
  zona.addEventListener('pointerdown', (e) => {
    zona.setPointerCapture(e.pointerId);
    const r = zona.getBoundingClientRect();
    joy.activo = true; joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
    moverJoy(e);
  });
  const moverJoy = (e) => {
    if (!joy.activo || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    const max = 45, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.vx = dx / max; joy.vy = dy / max;
    pomo.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  zona.addEventListener('pointermove', moverJoy);
  const soltar = () => { joy.activo = false; joy.vx = joy.vy = 0; pomo.style.transform = ''; };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);
}

// ---------------- Acciones ----------------
function cambiarModo(m) {
  estado.modo = m;
  estado.pendienteDesmontar = null;
  $('confirmar').hidden = true;
  limpiarResaltado();
  if (m !== 'construir' && fantasma) fantasma.visible = false;
  if (m === 'construir' && !estado.puntero) {
    // en táctil, empezar con el puntero delante del personaje
    estado.puntero = { x: pj.x + Math.sin(pj.rot) * 3, z: pj.z + Math.cos(pj.rot) * 3, ySuperficie: 0 };
  }
  if (m === 'construir') evaluarColocacion(); else mostrarAviso('');
  actualizarUI();
}
function girar() {
  const sel = estado.sel;
  if (estado.modo !== 'construir') return;
  if (sel.clase === 'pieza') {
    const h = PIEZAS[sel.tipo].hueco;
    const nueva = !estado.candidato || !estado.candidato.cand || estado.candidato.cand.nueva;
    if (h === 'r' || h === 'l') estado.dir = (estado.dir + 1) % 4;
    else if (h === 'g') estado.dir = (estado.dir + 1) % 2;
    // el giro libre solo cuenta para la primera pieza de una construcción nueva
    else if (nueva) estado.rotLibre = (estado.rotLibre + Math.PI / 12) % (Math.PI * 2);
    if (nueva && (h === 'r' || h === 'l' || h === 'g')) estado.rotLibre = (estado.rotLibre + Math.PI / 12) % (Math.PI * 2);
  } else estado.rotDeco = ((estado.rotDeco || 0) + Math.PI / 12) % (Math.PI * 2);
  evaluarColocacion();
}
function cambiarPlanta(d) {
  estado.planta = THREE.MathUtils.clamp(estado.planta + d, 0, 3);
  $('planta').textContent = `${t('planta')} ${estado.planta}`;
  evaluarColocacion();
}

// Usar: puertas y escaleras cercanas
function interactivoCercano() {
  let mejor = null, md = 1.8;
  for (const c of mundo.construcciones) {
    for (const [key, p] of c.piezas) {
      if (p.obra) continue;
      const puerta = seAbre(p);
      const esc = p.hueco === 'l' && !PIEZAS[p.tipo].andando; // la de tablas se sube andando
      if (!puerta && !esc) continue;
      const m = localAMundo(c, centroLocal(p).lx, centroLocal(p).lz);
      const d = Math.hypot(m.x - pj.x, m.z - pj.z);
      let mismaPlanta = p.k === pj.k || (esc && p.k === pj.k - 1) || (p.hueco === 't' && p.k === pj.k + 1); // la trampilla, también desde abajo
      // en una pila de andamios, estando en una plataforma con otro andamio encima, Usar sube (no baja)
      if (PIEZAS[p.tipo].andamio && p.k === pj.k - 1 && andamioEn(c, p.i, p.j, pj.k)) mismaPlanta = false;
      if (mismaPlanta && d < md) { md = d; mejor = { c, key, p, tipo: puerta ? 'puerta' : 'escalera' }; }
    }
  }
  return mejor;
}
// árbol al alcance del hacha (a menos de 1 m de su tronco), en la planta baja
function arbolCercano() {
  if (pj.k !== 0) return null;
  let mejor = null, md = 1.0;
  for (const o of obstaculos) {
    if (!o.arbol) continue;
    const d = Math.hypot(o.x - pj.x, o.z - pj.z) - o.r;
    if (d < md) { md = d; mejor = o; }
  }
  return mejor;
}
// obra a medias al alcance: en tu planta o la de encima (un muro o un tejado que se apoya en lo que pisas)
function obraCercana() {
  let mejor = null, md = 2.3;
  for (const c of mundo.construcciones) for (const [key, p] of c.piezas) {
    if (!p.obra || p.k < pj.k || p.k > pj.k + 1) continue;
    const m = centroMundo(c, p), d = Math.hypot(m.x - pj.x, m.z - pj.z);
    if (d < md) { md = d; mejor = { c, key, p }; }
  }
  return mejor;
}
// Usar junto a una obra: le llevas lo que le falta y, si ya lo tiene todo, te pones a construir (moverse lo para).
// Si la obra está en alto (GDD, «Obras»): lo ligero se lleva a mano subiendo por la escalera (hay que estar en su
// planta) y lo pesado se sube rodándolo por dos varas con una cuerda, de uno en uno (aquí juegas solo: entre dos,
// cuando haya más gente).
const hayQueSubir = (p, m) => plantaObra(p) > 0 && clasePeso(m) !== 'ligero';
function usarObra(o) {
  const { c, key, p } = o;
  const faltan = mundo.faltaEntregar(p);
  let entregado = false, escalera = null;
  for (const f of faltan) {
    if (hayQueSubir(p, f.m)) continue;
    const r = accion({ tipo: 'entregar', construccion: c.id, clave: key, material: f.m, cantidad: f.n, desde: pj.k });
    if (r.ok) { entregado = true; continue; }
    if (r.escalera) { escalera = r; continue; }
    const que = mundo.faltaEntregar(p).map(x => `${x.n} ${tr(MATERIALES[x.m]).toLowerCase()}`).join(', ');
    guardar(); actualizarUI();
    mostrarAviso(`${t('faltanMateriales')} ${t('leFalta')}: ${que}`, true);
    return;
  }
  if (entregado) { guardar(); actualizarUI(); }
  estado.talando = null;
  const m = centroMundo(c, p); pj.rot = Math.atan2(m.x - pj.x, m.z - pj.z);
  const pesado = mundo.faltaEntregar(p).find(f => hayQueSubir(p, f.m)) || (p.obra.subida && { m: p.obra.subida.material });
  if (pesado) {
    // con una polea o un polipasto colgado de una viga de esta construcción (a la altura de la obra o más arriba), se
    // usa el que esté más cerca de la obra: de la polea se tira; con el polipasto se da vueltas al torno. Si no hay
    // ninguno, se rueda por dos varas. Lo muy pesado, solo con el polipasto (y hasta que otra persona guía la carga,
    // no pasa de la mitad).
    const dist = (a) => { const u = centroLocal(a), v = centroLocal(p); return Math.hypot(u.lx - v.lx, u.lz - v.lz); };
    let q = clasePeso(pesado.m) === 'muy_pesado' ? null : poleaPara(c, p), qp = polipastoPara(c, p);
    if (q && qp) { if (dist(qp) < dist(q)) q = null; else qp = null; }
    estado.obrando = { c, key, subir: pesado.m, metodo: q ? 'polea' : qp || clasePeso(pesado.m) === 'muy_pesado' ? 'polipasto' : 'varas' };
    if (q) ponerPolea(c, q, p); else if (qp) ponerPolipasto(c, qp, p); else ponerRampa(c, p);
    avisoSubida(p, pesado.m, 0, entregado);
    return;
  }
  if (escalera) {
    const que = mundo.faltaEntregar(p).map(x => `${x.n} ${tr(MATERIALES[x.m]).toLowerCase()}`).join(', ');
    mostrarAviso(`${tr(escalera.motivo)} ${t('leFalta')}: ${que}`, true);
    return;
  }
  estado.obrando = { c, key };
  mostrarAviso(`${entregado ? t('materialEntregado') + ' ' : ''}${t('construyendo')} ${Math.round(100 * p.obra.trabajo / tiempoObra(p.tipo))} %`);
}
function avisoSubida(p, m, progreso, entregado = false, esperaAyuda = false) {
  const quedan = (mundo.faltaEntregar(p).find(f => f.m === m) || { n: 0 }).n;
  const metodo = estado.obrando && estado.obrando.metodo;
  const como = metodo === 'polea' ? t('subiendoPolea') : metodo === 'polipasto' ? t('subiendoPolipasto') : t('subiendoRodando');
  mostrarAviso(`${entregado ? t('materialEntregado') + ' ' : ''}${como} ${tr(MATERIALES[m] || m).toLowerCase()} (${t('quedan')} ${quedan}): ${Math.round(100 * progreso)} %${esperaAyuda ? ' ' + t('esperaGuia') : ''}`);
}
// Las dos varas apoyadas en el borde de la planta de la obra, del lado en el que estás, y el tronco rodando por ellas
// (dos cuerdas lo abrazan y van hasta arriba). Se quita al terminar de subir o al dejarlo.
const MAT_CUERDA = new THREE.MeshLambertMaterial({ color: 0xb59a6a });
let rampa = null;
function quitarRampa() {
  if (!rampa) return;
  escena.remove(rampa.g);
  if (rampa.tipo === 'polipasto') { const o = mallaDe(rampa.c, rampa.qkey); if (o) colgarPolipasto(o, POLIPASTO.yEje - POLIPASTO.bajada, 0.25); }
  rampa = null;
}
const mallaDe = (c, key) => (registroMallas.find(m => m.c === c && m.key === key) || {}).obj;
function ponerRampa(c, p) {
  quitarRampa();
  const m = centroMundo(c, p);
  let nx = pj.x - m.x, nz = pj.z - m.z; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
  let ox = 0, oz = 0;
  // en un muro, del lado de la cara (no por el canto), y un poco a un lado para que tú quedes junto a las varas
  if (p.hueco === 'e') {
    const a = c.rot + (p.d === 0 ? 0 : -Math.PI / 2); // a lo largo del muro
    const ax = Math.cos(a), az = -Math.sin(a), lado = Math.sign(nx * -az + nz * ax) || 1;
    nx = -az * lado; nz = ax * lado;
    const lat = (pj.x - m.x) * ax + (pj.z - m.z) * az, s = lat > 0 ? -1 : 1;
    ox = ax * s * 0.5; oz = az * s * 0.5;
  }
  const alto = plantaObra(p) * ALTURA + P.superficieSuelo, largo = alto * 0.85;
  const g = new THREE.Group(); g.name = 'rampa';
  g.position.set(m.x + ox + nx * (largo + 0.2), 0, m.z + oz + nz * (largo + 0.2));
  g.rotation.y = Math.atan2(-nx, -nz);
  g.add(rampaVaras(alto));
  const tronco = troncoSuelto(); g.add(tronco);
  const cuerdas = [-0.4, 0.4].map(x => { const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), MAT_CUERDA); cu.userData.x = x; g.add(cu); return cu; });
  escena.add(g);
  rampa = { g, tronco, cuerdas, alto, largo, t: 0, meta: 0 };
  moverRampa(0);
}
// Subir con la polea: el tronco cuelga de la cuerda, atado por el centro, un poco por fuera de la viga (del lado en
// el que estás), y sube en vertical hasta la planta de la obra; el otro cabo baja de la roldana hasta tus manos.
function cuerdaEntre(cu, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  cu.position.copy(a).addScaledVector(d, 0.5); cu.scale.set(1, Math.max(0.01, d.length()), 1);
  cu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
function ponerPolea(c, q, p) {
  quitarRampa();
  const m = centroMundo(c, q), rot = c.rot + (q.d === 1 ? -Math.PI / 2 : 0);
  const g = new THREE.Group(); g.name = 'polea_subiendo';
  g.position.set(m.x, 0, m.z); g.rotation.y = rot;
  // lado de la viga en el que estás (z local del grupo)
  const lz = (pj.x - m.x) * Math.sin(rot) + (pj.z - m.z) * Math.cos(rot);
  const lado = Math.sign(lz) || 1;
  const tronco = troncoSuelto(); g.add(tronco);
  const cuerdas = [0, 1].map(() => { const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5), MAT_CUERDA); g.add(cu); return cu; });
  escena.add(g);
  const yEje = q.k * ALTURA + POLEA.yEje;
  rampa = { tipo: 'polea', g, tronco, cuerdas, lado, yEje, bajo: 0.35, alto: plantaObra(p) * ALTURA + P.superficieSuelo + 0.3, t: 0, meta: 0 };
  moverRampa(0);
}
// Subir con el polipasto: el torno se pone en el suelo delante de ti, a lo ancho; el tronco (o el sillar) cuelga del
// gancho del motón de abajo, que baja hasta él y sube con él; el cabo de tirar va del motón de arriba al tambor, que
// gira mientras sube. El polipasto es la pieza misma (su motón de abajo se mueve con colgarPolipasto).
function ponerPolipasto(c, q, p) {
  quitarRampa();
  const m = centroMundo(c, q), qkey = clave('q', q.i, q.j, q.k, q.d);
  const g = new THREE.Group(); g.name = 'polipasto_subiendo';
  // el torno, a 0,95 m delante de ti, mirando al polipasto
  const dx = m.x - pj.x, dz = m.z - pj.z, l = Math.hypot(dx, dz) || 1;
  const torno = tornoSuelto();
  torno.position.set(pj.x + dx / l * 0.95, pj.y, pj.z + dz / l * 0.95); torno.rotation.y = Math.atan2(dx, dz);
  g.add(torno);
  // la carga: cuelga bajo la viga, del lado en el que estás
  const rot = c.rot + (q.d === 1 ? -Math.PI / 2 : 0);
  const lz = (pj.x - m.x) * Math.sin(rot) + (pj.z - m.z) * Math.cos(rot), lado = Math.sign(lz) || 1;
  const carga = new THREE.Group(); carga.position.set(m.x, 0, m.z); carga.rotation.y = rot;
  const tronco = troncoSuelto(); carga.add(tronco);
  const eslinga = [0, 1].map(() => { const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 1, 5), MAT_CUERDA); carga.add(cu); return cu; });
  g.add(carga);
  escena.add(g);
  const base = q.k * ALTURA;
  rampa = { tipo: 'polipasto', g, c, qkey, torno, carga, tronco, eslinga, lado, base, bajo: 0.35, alto: plantaObra(p) * ALTURA + P.superficieSuelo + 0.3, t: 0, meta: 0, giro: 0 };
  moverRampa(0);
}
// t: 0 al pie, 1 arriba. El tronco va subiendo poco a poco hacia lo que lleva la subida.
function moverRampa(dt) {
  if (!rampa) return;
  rampa.t += Math.max(-1, Math.min(1, rampa.meta - rampa.t)) * Math.min(1, dt * 2.5);
  if (rampa.tipo === 'polipasto') {
    const { tronco, eslinga, base, bajo, alto, t: k, torno, c, qkey } = rampa;
    const fuera = 0.6 * rampa.lado;
    const tope = base + POLIPASTO.yEje - 1.2; // lo más alto que llega la carga, con el motón de abajo junto al de arriba
    const y = bajo + k * (Math.min(alto, tope) - bajo);
    tronco.position.set(0, y, fuera); tronco.rotation.set(0, 0, 0);
    // eslinga: del gancho a los dos lados del tronco
    const gancho = new THREE.Vector3(0, y + 0.5, fuera);
    eslinga.forEach((cu, n) => cuerdaEntre(cu, gancho, new THREE.Vector3((n ? 0.3 : -0.3), y + P.radioTronco, fuera)));
    // el tambor gira con lo que sube
    const tambor = torno.getObjectByName('tambor');
    if (tambor) tambor.rotation.x = -k * 9;
    const o = mallaDe(c, qkey);
    if (o) {
      o.updateWorldMatrix(true, false);
      const ojo = new THREE.Vector3(); tambor.getWorldPosition(ojo); ojo.y += 0.11;
      colgarPolipasto(o, y - base + 0.5 + 0.33, 0, o.worldToLocal(ojo), fuera);
    }
    return;
  }
  if (rampa.tipo === 'polea') {
    const { tronco, cuerdas, lado, yEje, bajo, alto, t: k, g } = rampa, fuera = 0.55 * lado;
    const y = bajo + k * (Math.min(alto, yEje - 0.45) - bajo);
    tronco.position.set(0, y, fuera); tronco.rotation.set(0, 0, 0);
    // cabo del tronco: de la roldana al tronco; cabo de tirar: de la roldana a tus manos
    cuerdaEntre(cuerdas[0], new THREE.Vector3(0, yEje - 0.12, 0.13 * lado), new THREE.Vector3(0, y + P.radioTronco, fuera));
    const manos = g.worldToLocal(new THREE.Vector3(pj.x, pj.y + 1.25, pj.z));
    cuerdaEntre(cuerdas[1], new THREE.Vector3(0, yEje - 0.12, -0.13 * lado), manos);
    return;
  }
  const { tronco, cuerdas, alto, largo, t: k } = rampa, r = P.radioTronco + 0.05;
  const ang = Math.atan2(alto, largo);
  const y = k * alto + r * Math.cos(ang), z = k * largo - r * Math.sin(ang) * 0.2;
  tronco.position.set(0, y, z);
  tronco.rotation.x = -k * Math.hypot(alto, largo) / P.radioTronco; // rueda
  for (const cu of cuerdas) {
    const a = new THREE.Vector3(cu.userData.x, y + 0.05, z), b = new THREE.Vector3(cu.userData.x, alto + 0.05, largo + 0.3);
    const d = new THREE.Vector3().subVectors(b, a);
    cu.position.copy(a).addScaledVector(d, 0.5); cu.scale.set(1, Math.max(0.01, d.length()), 1);
    cu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
}
// cada medio segundo construyendo se manda un rato de trabajo. Cuenta el tiempo de reloj de verdad, no el del
// fotograma (que se recorta a 0,05 s): con pocos fotogramas por segundo la obra no debe ir más lenta.
function pasoObra() {
  const o = estado.obrando;
  if (!o) return;
  const ahora = performance.now();
  if (o.desde === undefined) o.desde = ahora;
  const seg = (ahora - o.desde) / 1000;
  if (seg < 0.5) return;
  if (o.subir) { // subiendo un tronco por las varas
    const r = accion({ tipo: 'subir', construccion: o.c.id, clave: o.key, material: o.subir, segundos: Math.min(seg, MAX_RATO), metodo: o.metodo || 'varas' });
    o.desde = ahora;
    if (!r.ok) { estado.obrando = null; quitarRampa(); mostrarAviso(tr(r.motivo), true); return; }
    guardar(); actualizarUI();
    const p = o.c.piezas.get(o.key);
    if (rampa) rampa.meta = r.progreso;
    if (r.subido) {
      if (rampa) { rampa.t = 0; rampa.meta = 0; }
      if (!mundo.faltaEntregar(p).some(f => f.m === o.subir)) { estado.obrando = null; quitarRampa(); usarObra({ c: o.c, key: o.key, p }); return; }
    }
    avisoSubida(p, o.subir, r.subido ? 0 : r.progreso, false, !!r.esperaAyuda);
    return;
  }
  const r = accion({ tipo: 'trabajar', construccion: o.c.id, clave: o.key, segundos: Math.min(seg, MAX_RATO) });
  o.desde = ahora;
  if (!r.ok) { estado.obrando = null; mostrarAviso(tr(r.motivo), true); return; }
  guardar();
  if (r.terminada) {
    estado.obrando = null; reconstruir();
    mostrarAviso(`${tr(PIEZAS[o.c.piezas.get(o.key).tipo].nombre)}: ${t('obraTerminada')}`);
    return;
  }
  // la pieza se va viendo menos tenue a cada cuarto de la obra
  const cuarto = Math.floor(4 * r.progreso);
  if (cuarto !== o.cuarto) { o.cuarto = cuarto; rehacerPieza(o.c.id, o.key); }
  mostrarAviso(`${t('construyendo')} ${Math.round(100 * r.progreso)} %`);
}
function usar() {
  const ob = obraCercana();
  const it = interactivoCercano();
  // al pie de un andamio, con la obra más arriba que tú, Usar sube al andamio (desde allí se le lleva el material)
  const subirAndamio = it && PIEZAS[it.p.tipo].andamio && it.p.k === pj.k && ob && ob.p.k > pj.k;
  if (ob && !subirAndamio) { usarObra(ob); return; }
  if (!it) {
    // junto a un árbol, se tala (por ahora solo el gesto: la madera llega con la recolección)
    const a = arbolCercano();
    if (a) { estado.talando = a; pj.rot = Math.atan2(a.x - pj.x, a.z - pj.z); mostrarAviso(t('talando')); return; }
    mostrarAviso(t('nadaQueUsar')); return;
  }
  if (it.tipo === 'puerta') {
    if (it.p.hueco === 't' && it.p.abierta && dentroDeCasilla(it.c, it.p)) { mostrarAviso(t('apartateTrampilla'), true); return; }
    const r = accion({ tipo: 'usar', construccion: it.c.id, clave: it.key });
    if (!r.ok) { mostrarAviso(tr(r.motivo), true); return; }
    guardar(); reconstruir();
    mostrarAviso(it.p.abierta ? t('abierta') : t('cerrada'));
    return;
  }
  // escalera: subir si estás en su planta, bajar si estás encima
  const { c, p } = it;
  if (PIEZAS[p.tipo].andamio) { usarAndamio(c, p); return; }
  if (pj.k === p.k) {
    const destinos = [[p.i, p.j], [p.i + 1, p.j], [p.i - 1, p.j], [p.i, p.j + 1], [p.i, p.j - 1]];
    for (const [i, j] of destinos) {
      if (c.piezas.has(clave('f', i, j, p.k + 1)) || andamioEn(c, i, j, p.k)) {
        // quedas en el suelo de arriba, pero pegado a la escalera para poder volver a bajar
        const le = centroLocal(p);
        const lx = (i + 0.5) * MODULO + (le.lx - (i + 0.5) * MODULO) * 0.4;
        const lz = (j + 0.5) * MODULO + (le.lz - (j + 0.5) * MODULO) * 0.4;
        const m = localAMundo(c, lx, lz);
        pj.x = m.x; pj.z = m.z; pj.k = p.k + 1;
        mostrarAviso(`${t('subes')} ${pj.k}`);
        return;
      }
    }
    mostrarAviso(t('sinSueloArriba'), true);
  } else {
    const m = localAMundo(c, centroLocal(p).lx, centroLocal(p).lz);
    pj.x = m.x; pj.z = m.z; pj.k = p.k;
    mostrarAviso(`${t('bajas')} ${pj.k}`);
  }
}

// Andamio (GDD, «Obras»): Usar al pie sube por su escalerilla a la plataforma, que está a la altura del suelo de la
// planta de encima; arriba, si hay otro andamio encima, sube a ese; en lo alto de la pila, baja hasta el pie.
function usarAndamio(c, p) {
  const m = centroMundo(c, p);
  if (pj.k === p.k) {
    pj.x = m.x; pj.z = m.z; pj.k = p.k + 1;
    mostrarAviso(`${t('subesAndamio')} ${pj.k}`);
    return;
  }
  let k = p.k;
  while (k > 0 && andamioEn(c, p.i, p.j, k - 1)) k--;
  // al pie del andamio de abajo, por fuera (por la escalerilla, lejos del muro)
  const pie = andamioEn(c, p.i, p.j, k) || p, ang = c.rot - (pie.dir || 0) * Math.PI / 2;
  const f = MODULO / 2 + 0.45;
  pj.x = m.x - Math.sin(ang) * f; pj.z = m.z - Math.cos(ang) * f; pj.k = k;
  mostrarAviso(`${t('bajas')} ${pj.k}`);
}

// ¿Está el jugador en la casilla de esta pieza (la de una trampilla: encima de su escalera)?
function dentroDeCasilla(c, p) {
  const l = mundoALocal(c, pj.x, pj.z);
  return Math.floor(l.lx / MODULO) === p.i && Math.floor(l.lz / MODULO) === p.j;
}
// ---------------- Movimiento y colisiones ----------------
function segmentosBloqueo(k) {
  const segs = []; // [x1,z1,x2,z2]
  const circulos = obstaculos.filter(o => !o.oculto); // las matas escondidas bajo lo construido no chocan
  for (const c of mundo.construcciones) {
    for (const [key, p] of c.piezas) {
      if (p.k !== k || p.obra) continue; // una obra es solo un armazón: no corta el paso
      if (p.hueco === 'v') {
        const m = localAMundo(c, p.i * MODULO, p.j * MODULO);
        circulos.push({ x: m.x, z: m.z, r: 0.16 });
        continue;
      }
      if (p.hueco === 'l' && PIEZAS[p.tipo].andando && trampillaCerrada(c, p.i, p.j, p.k)) {
        // escalera con la trampilla de arriba cerrada: no se puede subir, así que la casilla no se pisa
        const esq = [[p.i, p.j], [p.i + 1, p.j], [p.i + 1, p.j + 1], [p.i, p.j + 1]].map(([a, b]) => localAMundo(c, a * MODULO, b * MODULO));
        for (let n = 0; n < 4; n++) segs.push([esq[n].x, esq[n].z, esq[(n + 1) % 4].x, esq[(n + 1) % 4].z]);
        continue;
      }
      if (p.hueco !== 'e') continue;
      const def = PIEZAS[p.tipo];
      if (def.portón && p.abierta) continue;
      const a = p.d === 0 ? [p.i * MODULO, p.j * MODULO] : [p.i * MODULO, p.j * MODULO];
      const b = p.d === 0 ? [(p.i + 1) * MODULO, p.j * MODULO] : [p.i * MODULO, (p.j + 1) * MODULO];
      const pa = localAMundo(c, a[0], a[1]), pb = localAMundo(c, b[0], b[1]);
      if (def.conPuerta) {
        const puertaP = c.piezas.get(clave('p', p.i, p.j, p.k, p.d));
        const f = (P.anchoPuerta / 2) / MODULO;
        const m1 = { x: pa.x + (pb.x - pa.x) * (0.5 - f), z: pa.z + (pb.z - pa.z) * (0.5 - f) };
        const m2 = { x: pa.x + (pb.x - pa.x) * (0.5 + f), z: pa.z + (pb.z - pa.z) * (0.5 + f) };
        segs.push([pa.x, pa.z, m1.x, m1.z], [m2.x, m2.z, pb.x, pb.z]);
        if (puertaP && !puertaP.abierta) segs.push([m1.x, m1.z, m2.x, m2.z]);
      } else segs.push([pa.x, pa.z, pb.x, pb.z]);
    }
  }
  return { segs, circulos };
}
function resolverColision(x, z, k) {
  const R = 0.32;
  const { segs, circulos } = segmentosBloqueo(k);
  for (let it = 0; it < 3; it++) {
    for (const [x1, z1, x2, z2] of segs) {
      const dx = x2 - x1, dz = z2 - z1;
      const l2 = dx * dx + dz * dz;
      let u = ((x - x1) * dx + (z - z1) * dz) / l2;
      u = Math.max(0, Math.min(1, u));
      const px = x1 + u * dx, pz = z1 + u * dz;
      const ex = x - px, ez = z - pz, d = Math.hypot(ex, ez);
      const lim = R + 0.14;
      if (d < lim && d > 1e-6) { x = px + ex / d * lim; z = pz + ez / d * lim; }
    }
    for (const o of circulos) {
      const ex = x - o.x, ez = z - o.z, d = Math.hypot(ex, ez), lim = R + o.r;
      if (d < lim && d > 1e-6) { x = o.x + ex / d * lim; z = o.z + ez / d * lim; }
    }
  }
  return { x, z };
}
// altura del suelo bajo el jugador en su planta; baja de planta si no hay suelo
// Escalera de tablas bajo el jugador: se sube andando. Devuelve { k, y } o null.
// Si vienes por debajo del tramo alto (o caes por el hueco desde arriba muy por encima), no cuenta.
function escaleraBajoJugador() {
  for (const c of mundo.construcciones) {
    const l = mundoALocal(c, pj.x, pj.z);
    const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
    for (const k0 of [pj.k, pj.k - 1]) {
      if (k0 < 0) continue;
      const p = escaleraAndando(c, i, j, k0);
      if (!p || trampillaCerrada(c, i, j, k0)) continue; // con la trampilla cerrada, la escalera no sube
      const t = progresoEscalera(p, l.lx, l.lz);
      const base = c.piezas.has(clave('f', i, j, k0)) ? (k0 === 0 ? P.superficieCimiento : P.superficieSuelo) : 0;
      const y0 = k0 * ALTURA + base, y1 = (k0 + 1) * ALTURA + P.superficieSuelo;
      const y = y0 + t * (y1 - y0);
      if (pj.k === k0 && y - pj.y > 0.8) continue; // estás debajo de la escalera, no encima
      return { k: t > 0.5 ? k0 + 1 : k0, y };
    }
  }
  return null;
}
function alturaSuelo() {
  const e = escaleraBajoJugador();
  if (e) { pj.k = e.k; return e.y; }
  for (let k = pj.k; k >= 0; k--) {
    for (const c of mundo.construcciones) {
      const l = mundoALocal(c, pj.x, pj.z);
      const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
      const f = c.piezas.get(clave('f', i, j, k));
      if (f && !f.obra) { pj.k = k; return k * ALTURA + (k === 0 ? P.superficieCimiento : P.superficieSuelo); }
      if (k > 0 && trampillaCerrada(c, i, j, k - 1)) { pj.k = k; return k * ALTURA + P.superficieSuelo; } // la trampilla cerrada se pisa
      if (k > 0 && andamioEn(c, i, j, k - 1)) { pj.k = k; return k * ALTURA + P.superficieSuelo; } // plataforma del andamio
    }
    if (k === 0) { pj.k = 0; return 0; }
  }
  return 0;
}

// planta en la que está un mueble, por su altura (los del suelo de arriba están a una altura de planta o más)
const plantaDeco = (d) => Math.max(0, Math.floor((d.y + 0.3) / ALTURA));

const reloj = new THREE.Clock();
function paso() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  // entrada de movimiento relativa a la cámara
  let ax = 0, az = 0;
  if (teclas.has('w') || teclas.has('arrowup')) az -= 1;
  if (teclas.has('s') || teclas.has('arrowdown')) az += 1;
  if (teclas.has('a') || teclas.has('arrowleft')) ax -= 1;
  if (teclas.has('d') || teclas.has('arrowright')) ax += 1;
  ax += joy.vx; az += joy.vy;
  if (teclas.has('q')) cam.yaw += dt * 1.6;
  if (teclas.has('e')) cam.yaw -= dt * 1.6;
  const mag = Math.min(1, Math.hypot(ax, az));
  const correr = teclas.has('shift');
  const vel = (correr ? 6 : 3.6) * mag * inventario().velocidad(); // cargado al máximo en todo, al 80% (GDD)
  if (mag > 0.05) {
    estado.talando = null; // moverse deja de talar
    if (estado.obrando) { estado.obrando = null; mostrarAviso(t('dejasObra')); } // y de construir
    const s = Math.sin(cam.yaw), co = Math.cos(cam.yaw);
    const dx = (ax * co + az * s) / Math.hypot(ax, az);
    const dz = (-ax * s + az * co) / Math.hypot(ax, az);
    let nx = pj.x + dx * vel * dt, nz = pj.z + dz * vel * dt;
    const r = resolverColision(nx, nz, pj.k);
    pj.x = THREE.MathUtils.clamp(r.x, -190, 190); pj.z = THREE.MathUtils.clamp(r.z, -190, 190);
    const objetivoRot = Math.atan2(dx, dz);
    let dr = objetivoRot - pj.rot;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    pj.rot += dr * Math.min(1, dt * 12);
    // en táctil, el puntero de construcción acompaña al personaje
    if (estado.esTactil && estado.modo === 'construir' && estado.punteroSigue) {
      estado.puntero = { x: pj.x + Math.sin(pj.rot) * 3, z: pj.z + Math.cos(pj.rot) * 3, ySuperficie: 0 };
      evaluarColocacion();
    }
  }
  pj.vel = vel;
  const yObjetivo = alturaSuelo();
  pj.y += (yObjetivo - pj.y) * Math.min(1, dt * 14);
  jugador.raiz.position.set(pj.x, pj.y, pj.z);
  jugador.raiz.rotation.y = pj.rot;
  pasoObra();
  if (rampa && !(estado.obrando && estado.obrando.subir)) quitarRampa(); // se dejó de subir (moverse, reiniciar…)
  moverRampa(dt);
  jugador.animar(mag > 0.05 ? vel : 0, dt, !!estado.talando || !!estado.obrando);

  // interiores: ocultar plantas superiores y tejados si estás bajo techo, y también los muebles de esas plantas
  // (antes se veían los del piso de arriba estando abajo; lo vio valravnx el 27 oct)
  let bajoTecho = false;
  for (const g of raizConstr.children) {
    const c = g.userData.c;
    const l = mundoALocal(c, pj.x, pj.z);
    const i = Math.floor(l.lx / MODULO), j = Math.floor(l.lz / MODULO);
    let techo = false;
    for (let k = pj.k + 1; k <= 4 && !techo; k++) if (c.piezas.has(clave('f', i, j, k)) || c.piezas.has(clave('r', i, j, k))) techo = true;
    if (techo) bajoTecho = true;
    for (const obj of g.children) obj.visible = !techo || obj.userData.k <= pj.k;
  }
  for (const obj of raizDeco.children) obj.visible = !bajoTecho || plantaDeco(obj.userData.deco) <= pj.k;
  const it = interactivoCercano();
  $('btnUsar').classList.toggle('activo', !!it || !!arbolCercano() || !!obraCercana());

  moverGente(dt);
  if (enLinea) enLinea.paso(dt, { x: pj.x, y: pj.y, z: pj.z, giro: pj.rot, anim: mag > 0.05 ? (vel < 1.8 ? 'andar' : 'correr') : (estado.talando || estado.obrando ? 'talar' : 'quieto') });
  actualizarCamara();
  renderer.render(escena, camara);
  requestAnimationFrame(paso);
}

// ---------------- Interfaz ----------------
const CATEGORIAS = [
  ['tierra', t('catTierra')], ['base', t('catBase')], ['estructura', t('catEstructura')], ['muro', t('catMuros')],
  ['tejado', t('catTejados')], ['acceso', t('catAcceso')], ['exterior', t('catExterior')], ['deco', t('catDeco')],
];
let categoria = 'base';
function construirBarra() {
  const tabs = $('pestanas'); tabs.innerHTML = '';
  for (const [id, nombre] of CATEGORIAS) {
    const b = document.createElement('button');
    b.textContent = nombre; b.dataset.cat = id;
    b.className = id === categoria ? 'sel' : '';
    b.onclick = () => { categoria = id; construirBarra(); };
    tabs.appendChild(b);
  }
  const lista = $('piezas'); lista.innerHTML = '';
  const entradas = categoria === 'deco'
    ? Object.entries(DECORACION).map(([k, d]) => ({ clase: 'deco', tipo: k, def: d }))
    : Object.entries(PIEZAS).filter(([, d]) => d.cat === categoria).map(([k, d]) => ({ clase: k === 'mojon' ? 'mojon' : 'pieza', tipo: k, def: d }));
  for (const e of entradas) {
    const b = document.createElement('button');
    b.className = 'pieza' + (estado.sel.tipo === e.tipo ? ' sel' : '');
    const coste = Object.entries(e.def.coste).map(([m, n]) => `${n} ${tr(MATERIALES[m]).toLowerCase()}`).join(' · ');
    b.innerHTML = `<b>${tr(e.def.nombre)}</b><small>${coste}</small>`;
    b.onclick = () => {
      estado.sel = { clase: e.clase, tipo: e.tipo };
      estado.dir = 0;
      if (estado.modo !== 'construir') cambiarModo('construir');
      construirBarra(); evaluarColocacion();
    };
    lista.appendChild(b);
  }
}
function marcarSeleccion() { categoria = estado.sel.clase === 'deco' ? 'deco' : (estado.sel.clase === 'mojon' ? 'tierra' : PIEZAS[estado.sel.tipo].cat); construirBarra(); }

function actualizarUI() {
  const m = $('materiales');
  m.innerHTML = Object.entries(MATERIALES).map(([k, n]) => `<span><b>${mundo.materiales[k] ?? 0}</b> ${tr(n).toLowerCase()}</span>`).join('');
  for (const b of document.querySelectorAll('#modos button')) b.classList.toggle('sel', b.dataset.modo === estado.modo);
  $('barra').hidden = estado.modo !== 'construir';
  $('btnColocar').hidden = !(estado.modo === 'construir' && estado.esTactil);
  $('btnGirar').hidden = estado.modo !== 'construir';
  $('controlPlanta').hidden = estado.modo !== 'construir';
  document.body.classList.toggle('construyendo', estado.modo === 'construir');
  $('planta').textContent = `${t('planta')} ${estado.planta}`;
  if (!mundo.mojon && estado.modo !== 'construir') mostrarAviso(t('consejoMojon'));
}
let temporizadorAviso = null;
function mostrarAviso(txt, error = false) {
  const a = $('aviso');
  a.textContent = txt;
  a.className = error ? 'error' : '';
  a.hidden = !txt;
  colocarAviso();
}

for (const b of document.querySelectorAll('#modos button')) b.onclick = () => cambiarModo(b.dataset.modo);
$('btnGirar').onclick = girar;
$('btnColocar').onclick = colocar;
$('btnSube').onclick = () => cambiarPlanta(1);
$('btnBaja').onclick = () => cambiarPlanta(-1);
$('btnUsar').onclick = usar;
$('btnConfirmar').onclick = confirmarDesmontaje;
$('btnCancelar').onclick = () => { $('confirmar').hidden = true; limpiarResaltado(); estado.pendienteDesmontar = null; mostrarAviso(''); };
$('btnRellenar').onclick = () => { accion({ tipo: 'rellenar', cantidad: 50 }); guardar(); actualizarUI(); evaluarColocacion(); };
{
  let armado = false, tmr = null;
  $('btnReiniciar').onclick = () => {
    if (!armado) {
      armado = true; mostrarAviso(t('confirmaReinicio'), true);
      clearTimeout(tmr); tmr = setTimeout(() => { armado = false; }, 4000);
      return;
    }
    armado = false;
    mundo = new Mundo(); registroAcciones = new RegistroAcciones(); guardar(); reconstruir(); cambiarModo('mover');
  };
}
$('btnRegistro').onclick = () => { $('panelRegistro').hidden = !$('panelRegistro').hidden; $('panelAyuda').hidden = true; };
$('btnAyuda').onclick = () => { $('panelAyuda').hidden = !$('panelAyuda').hidden; $('panelRegistro').hidden = true; };
for (const b of document.querySelectorAll('.cerrar')) b.onclick = () => { b.closest('.panel').hidden = true; };
$('listaRegistro').innerHTML = REGISTRO.map(r => `<li>${tr(r)}</li>`).join('');
$('version').textContent = tr(VERSION);
$('ayudaPC').hidden = estado.esTactil;
$('ayudaTactil').hidden = !estado.esTactil;
$('joystick').hidden = !estado.esTactil;
$('chkSigue').onchange = (e) => { estado.punteroSigue = e.target.checked; };
estado.punteroSigue = false;
$('filaSigue').hidden = !estado.esTactil;

function redimensionar() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camara.aspect = w / h; camara.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();
construirBarra();
reconstruir();
actualizarUI();
if (EN_LINEA) iniciarEnLinea();
paso();

// En línea: lo que llega del servidor cambia el mundo; se redibuja solo si cambia lo que se ve (un rato de trabajo
// de otro solo cuando su obra pasa de cuarto o se termina, como las propias).
function iniciarEnLinea() {
  $('btnReiniciar').hidden = true; // el mundo del servidor no se borra desde aquí
  const marca = document.createElement('span');
  marca.id = 'estadoRed';
  marca.style.cssText = 'pointer-events:auto;align-self:center;background:var(--panel);color:var(--acento);border-radius:9px;padding:6px 9px;font-size:12px';
  $('menu').prepend(marca);
  const cuarto = (m, e) => {
    const c = m.construcciones.find(x => x.id === e.datos.construccion), p = c && c.piezas.get(e.datos.clave);
    return !p ? -1 : p.obra ? Math.floor(4 * p.obra.trabajo / tiempoObra(p.tipo)) : 4;
  };
  const vistos = new Map(); // obra → cuarto de trabajo con el que se dibujó
  enLinea = conectarEnLinea({
    escena, recursos: RECURSOS_MH, aspecto: elegido || { sexo: 'hombre', capas: [] },
    avisar: mostrarAviso,
    alEstado: (txt) => { marca.textContent = txt; },
    alCambiar(info, msg) {
      const antes = mundo;
      mundo = enLinea.red.mundo;
      const e = info.entrada;
      let redibujar = info.cambio || antes !== mundo;
      if (e && (e.tipo === 'trabajar' || e.tipo === 'entregar' || e.tipo === 'subir' || e.tipo === 'rellenar')) {
        // el mundo puede ser el mismo objeto antes y después: se compara con el cuarto que se vio la última vez
        redibujar = false;
        if (e.tipo === 'trabajar') {
          const k = e.datos.construccion + '|' + e.datos.clave, n = cuarto(mundo, e), cambia = vistos.get(k) !== n;
          vistos.set(k, n);
          // la obra propia ya la ha redibujado pasoObra; la de otro: solo esa pieza, o todo al terminarse (se junta con las de al lado)
          if (cambia && e.autor !== enLinea.red.yo) { if (n >= 4 || n < 0) redibujar = true; else rehacerPieza(e.datos.construccion, e.datos.clave); }
        }
      }
      if (msg.tipo === 'bienvenida' || info.rechazo) redibujar = true;
      if (redibujar) { reconstruir(); if (estado.modo === 'construir') evaluarColocacion(); }
      if (info.cambio || e) actualizarUI();
    },
  });
}

// acceso para pruebas automáticas
window.__kinhold = {
  get mundo() { return mundo; }, estado, pj, cam, escena, renderer, jugador, obstaculos,
  cambiarModo, colocar, girar, cambiarPlanta, usar, confirmarDesmontaje,
  plantaDeco, get teclas() { return [...teclas]; }, get fantasmaForma() { return fantasmaForma; },
  seleccionar(clase, tipo) { estado.sel = { clase, tipo }; estado.dir = 0; marcarSeleccion(); evaluarColocacion(); },
  apuntar(x, z, y = 0) { estado.puntero = { x, z, ySuperficie: y }; evaluarColocacion(); },
  apuntarPantalla(cx, cy) { estado.puntero = punteroDesde(cx, cy); evaluarColocacion(); return estado.puntero; },
  apuntarPieza(cx, cy) { evaluarDesmontaje(piezaBajo(cx, cy)); },
  proyectar(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camara); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  // atajo de prueba: lleva el material y termina todas las obras a medias, siempre con acciones
  terminarObras() {
    if (enLinea) { // en línea, por el servidor: las mismas acciones que haría el jugador (llevar material y trabajar)
      const obras = []; for (const c of mundo.construcciones) for (const [key, p] of c.piezas) if (p.obra) obras.push([c.id, key]);
      for (const [id, key] of obras) {
        const pieza = () => { const c = mundo.construcciones.find(x => x.id === id); return c && c.piezas.get(key); };
        const planta = plantaObra(pieza());
        for (const f of mundo.faltaEntregar(pieza())) {
          if (planta > 0 && clasePeso(f.m) !== 'ligero') { // lo pesado, a una obra en alto, se sube por las varas
            for (let i = 0; i < 10000 && pieza() && mundo.faltaEntregar(pieza()).some(x => x.m === f.m); i++)
              if (!accion({ tipo: 'subir', construccion: id, clave: key, material: f.m, segundos: MAX_RATO, metodo: 'varas' }).ok) break;
          } else accion({ tipo: 'entregar', construccion: id, clave: key, material: f.m, cantidad: f.n, desde: planta });
        }
        let r = { ok: true };
        for (let i = 0; i < 1000 && r.ok && pieza() && pieza().obra; i++) r = accion({ tipo: 'trabajar', construccion: id, clave: key, segundos: MAX_RATO });
      }
      reconstruir(); return;
    }
    for (const c of mundo.construcciones) for (const [key, p] of [...c.piezas]) if (p.obra) acabarObra(mundo, registroAcciones, AUTOR_LOCAL, c.id, key);
    guardar(); reconstruir();
  },
  obraCercana() { const o = obraCercana(); return o && { c: o.c.id, key: o.key }; },
  get obrando() { return estado.obrando; },
  get rampa() { return rampa && { t: rampa.t, meta: rampa.meta, visible: !!rampa.g.parent, tipo: rampa.tipo || 'varas', yTronco: rampa.tronco.position.y, yMoton: rampa.tipo === 'polipasto' ? mallaDe(rampa.c, rampa.qkey)?.getObjectByName('moton_bajo')?.position.y : undefined, torno: !!(rampa.torno && rampa.torno.parent) }; },
  // atajo de prueba para las capturas: deja la subida quieta a medio camino (sin tarjeta gráfica, un rato llega a 5 s)
  fijarSubida(t) { if (estado.obrando) estado.obrando.desde = performance.now() + 1e9; if (rampa) { rampa.t = rampa.meta = t; moverRampa(0); } },
  seguirSubida() { if (estado.obrando) estado.obrando.desde = performance.now(); },
  interactivoCercano() { const o = interactivoCercano(); return o && { c: o.c.id, key: o.key, tipo: o.tipo }; },
  reiniciar() { mundo = new Mundo(); registroAcciones = new RegistroAcciones(); inventarios.jugadores = {}; reconstruir(); },
  get registroAcciones() { return registroAcciones; },
  accionInventario, get inventario() { return inventario(); },
  get enLinea() { return enLinea; },
  reconstruir() { reconstruir(); },
  render() { renderer.render(escena, camara); },
};
