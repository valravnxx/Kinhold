// Las imágenes de cada cosa para el panel de fabricar (estudio del panel, aprobado por valravnx el 6 nov): se sacan
// de los mismos modelos que el juego ya dibuja (lo del suelo, lo de la mano, lo de la espalda y las estaciones), con
// la misma luz para todas y el fondo transparente, para que vayan siempre con el estilo v5 y con lo que se ve en el
// mundo. Se empaqueta con esbuild y lo abre herramientas/iconos/sacar.py, que guarda las imágenes.
// Expone window.__iconos = { lista: [{ nombre, propio }], foto(nombre) → dataURL PNG }.
//  - nombre: el tipo del catálogo (rama, hacha_piedra…) o «est_» + la estación (est_piedra_tallar…).
//  - propio: false si aún no tiene su modelo y sale con el hatillo de lino de lo del suelo (el panel lo marca
//    «sin modelo aún»); también el hacha de hierro, que hoy usa el modelo del hacha de mano.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { prepararRenderer } from '../../src/mundo/ambiente.js';
import { materialTex } from '../../src/mundo/estilos.js';
import { modeloDe } from '../../src/juego/suelo.js';
import { MODELO_OBJETO, modeloHachaPiedra } from '../../src/juego/modelos_objetos.js';
import { MODELO_ESTACION, modeloDeposito } from '../../src/juego/estaciones.js';
import { ESTACIONES } from '../../src/logica/fabricacion.js';
import { modeloHacha } from '../../src/juego/personaje.js';
import { loteEnMano, loteEspalda } from '../../src/juego/llevado.js';
import { CATALOGO } from '../../src/logica/inventario.js';
import { PRENDAS } from '../../src/logica/prendas.js';

const TAM = 256;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
prepararRenderer(renderer); renderer.setPixelRatio(1); renderer.setSize(TAM, TAM); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = false;
document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
escena.add(new THREE.HemisphereLight(0xdfe6ee, 0x5a4a36, 1.6));
// la luz (estudio de la interfaz, 7 nov): la principal de arriba a la izquierda, como el resto de la interfaz, y una de
// contra cálida y otra de canto que separan cada cosa de un fondo oscuro (a 60 px se perdían sobre el cuero)
const sol = new THREE.DirectionalLight(0xfff1dc, 2.9); sol.position.set(-3, 5, 4); escena.add(sol);
const contra = new THREE.DirectionalLight(0xffe2b0, 2.2); contra.position.set(4, 3, -3); escena.add(contra);
const canto = new THREE.DirectionalLight(0xffffff, 1.0); canto.position.set(0, -2, -4); escena.add(canto);
const camara = new THREE.PerspectiveCamera(28, 1, 0.01, 100);

const mallas = L => {
  const g = new THREE.Group();
  for (const [tex, geos] of Object.entries(L.cerrar(null, true))) g.add(new THREE.Mesh(mergeGeometries(geos), materialTex(tex)));
  return g;
};
// lo de la mano, tumbado en diagonal y de frente; las herramientas largas (y las hachas: si no, a 60 px eran un palo),
// encuadradas por la cabeza
const LARGAS = new Set(['hacha_mano', 'hacha_piedra', 'hacha_hierro', 'antorcha', 'arpon', 'azada', 'hoz_silex', 'lanza_endurecida', 'pala_madera', 'palo_cavador', 'mayal']);
const enDiagonal = (o, t) => { const g = new THREE.Group(); o.rotation.z = -Math.PI / 4; g.add(o); g.userData.plano = true; g.userData.larga = LARGAS.has(t); return g; };
const deMano = t => enDiagonal(mallas(loteEnMano(t)), t);
// lo de la espalda, con algo dentro para que se vea para qué es
const DENTRO = { lenero: { lena: 9, tronco_corto: 1 }, cesta_recoleccion: { bayas: 9, setas: 6 }, porta_piedras: { piedra: 9 }, carcaj: { flecha: 12 },
  correa_escudo: { escudo: 1 }, fardo: { piel: 8 }, caja_herramientas: { cuchillo: 1, azada: 1 } };
const deEspalda = t => { const g = new THREE.Group(); g.add(mallas(loteEspalda(t, DENTRO[t] || {}).L)); g.rotation.y = 0.5; return g; };
// lo largo y plano tumbado en el suelo (haces, troncos, la piel, la honda): en diagonal y visto casi desde arriba
const ARRIBA = new Set(['fibra', 'junco', 'mimbre', 'piel', 'honda', 'tronco_delgado', 'tronco_largo', 'rama']);
const desdeArriba = o => { const g = new THREE.Group(); o.updateMatrixWorld(true); const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); o.rotation.y += s.x >= s.z ? Math.PI / 4 : -Math.PI / 4; g.add(o); g.userData.arriba = true; return g; };
const delSuelo = (t, n = 3) => modeloDe({ id: 'icono_' + t, cosa: { tipo: t, n } });

// De dónde sale cada imagen. Lo que no está aquí sale con el hatillo del suelo (sin modelo aún).
const SUELO = { rama: 3, piedra: 4, silex: 3, tronco_corto: 2, tronco_delgado: 2, tronco_largo: 2, lena: 6, rastra: 1, carretilla: 1 };
const MANO = ['mineral_hierro', 'vara', 'tabla', 'cuchillo', 'lasca_silex', 'espada', 'escudo', 'palo_cavador', 'arpon', 'pala_madera', 'azada', 'hoz_silex', 'mayal', 'lanza_endurecida', 'antorcha'];
const ESPALDA = ['lenero', 'porta_piedras', 'mochila_bastidor', 'zurron', 'fardo', 'cesta_recoleccion', 'cesto_pescador', 'caja_herramientas', 'carcaj', 'correa_escudo'];
const HACHAS = ['hacha_mano', 'hacha_piedra', 'hacha_hierro'];
const PROVISIONAL = new Set(['hacha_hierro']); // hoy, el modelo del hacha de mano

const fuentes = {};
for (const t of Object.keys(CATALOGO).filter(t => !Object.hasOwn(PRENDAS, t))) {
  if (t === 'hacha_piedra') fuentes[t] = { propio: true, hacer: () => enDiagonal(modeloHachaPiedra(), t) };
  else if (Object.hasOwn(MODELO_OBJETO, t)) fuentes[t] = { propio: true, hacer: () => ARRIBA.has(t) ? desdeArriba(delSuelo(t, 3)) : delSuelo(t, 3) };
  else if (Object.hasOwn(SUELO, t)) fuentes[t] = { propio: true, hacer: () => ARRIBA.has(t) ? desdeArriba(delSuelo(t, SUELO[t])) : delSuelo(t, SUELO[t]) };
  else if (HACHAS.includes(t)) fuentes[t] = { propio: !PROVISIONAL.has(t), hacer: () => enDiagonal(modeloHacha(), t) };
  else if (MANO.includes(t)) fuentes[t] = { propio: true, hacer: () => deMano(t) };
  else if (ESPALDA.includes(t)) fuentes[t] = { propio: true, hacer: () => deEspalda(t) };
  else fuentes[t] = { propio: false, hacer: () => delSuelo(t, 1) };
}
// los almacenajes, llenos a medias (que se vea para qué es cada uno)
const LLENOS = { acopio_troncos: { tronco_delgado: 7 }, pila_piedras: { piedra: 22 }, lenera: { lena: 14, rama: 6 },
  soporte_varas: { vara: 9 }, almiar: { paja: 14, junco: 4 }, hoyo_barro: { barro: 9 }, cesto: { fibra: 10, silex: 4, cordel: 2 },
  colgadero_mochilas: { lenero: 1, cesta_recoleccion: 1, porta_piedras: 1 }, colgadero_herramientas: { hacha_piedra: 1, palo_cavador: 1, azada: 1, pala_madera: 1, hoz_silex: 1 } };
const conLleno = (t, o) => { if (LLENOS[t]) o.add(modeloDeposito(t, LLENOS[t], 'icono_' + t)); return o; };
for (const [t, hacer] of Object.entries(MODELO_ESTACION)) if (ESTACIONES[t]) fuentes['est_' + t] = { propio: true, hacer: () => conLleno(t, hacer('icono_' + t)), estacion: true };

window.__iconos = {
  lista: Object.entries(fuentes).map(([nombre, f]) => ({ nombre, propio: f.propio })),
  foto(nombre) {
    for (const c of [...escena.children]) if (c.userData.icono) escena.remove(c);
    const f = fuentes[nombre], o = f.hacer();
    o.userData.icono = true; escena.add(o); o.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(o), c = caja.getCenter(new THREE.Vector3()), s = caja.getSize(new THREE.Vector3());
    if (o.userData.larga) { const k = HACHAS.includes(nombre) ? [0.24, 0.5] : [0.17, 0.68]; c.x += s.x * k[0]; c.y += s.y * k[0]; s.multiplyScalar(k[1]); } // las hachas, más por la cabeza // la cabeza de la herramienta
    const plano = o.userData.plano, arriba = o.userData.arriba;
    const radio = plano ? Math.max(s.x, s.y) / 2 * 1.05 : arriba ? Math.max(s.x, s.z) / 2 * 1.02 : s.length() / 2;
    const d = radio / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * (plano || arriba ? 1 : 0.9);
    const dir = plano ? new THREE.Vector3(0.12, 0.25, 1) : arriba ? new THREE.Vector3(0.05, 1, 0.45) : f.estacion ? new THREE.Vector3(0.75, 0.62, 1) : new THREE.Vector3(0.55, 0.75, 1);
    camara.position.copy(c).addScaledVector(dir.normalize(), d); camara.lookAt(c); camara.updateProjectionMatrix();
    renderer.render(escena, camara);
    return renderer.domElement.toDataURL('image/png');
  },
};
