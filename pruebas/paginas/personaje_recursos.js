// Página de prueba (no se publica): carga el personaje con los recursos v1 o v2 y las animaciones extra,
// con la misma luz y cabaña que el prototipo del personaje, para comparar y hacer capturas repetibles.
import * as THREE from 'three';
import { LUCES } from '../../src/estilo/estilos.js';
import { crearEscena } from '../../src/estilo/escena.js';
import { crearPersonaje } from '../../src/personajes/cargar.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
const L = LUCES.manana, escena = new THREE.Scene();
escena.background = new THREE.Color(L.fondo[1]);
escena.add(crearEscena());
const hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]), sol = new THREE.DirectionalLight(L.sol[0], L.sol[1]);
sol.position.set(...L.sol[2]).multiplyScalar(1.6); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.radius = 4;
Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 }); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.03;
escena.add(hemi, sol, sol.target);
const camara = new THREE.PerspectiveCamera(innerWidth < innerHeight ? 40 : 30, innerWidth / innerHeight, 0.05, 200);
const POS = new THREE.Vector3(1.6, 0, 4.8), GIRO = 0.45;
const rel = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), GIRO).add(POS);
let pj = null;
const vista = (v) => {
  const [pos, mira] = v === 'cara' ? (() => { const p = new THREE.Vector3(); pj.hueso.Head.getWorldPosition(p); const y = p.y + 0.08; return [rel(0.22, y + 0.03, 0.78), rel(0, y - 0.02, 0)]; })()
    : v === 'cerca' ? [rel(0.7, 1.25, 2.2), rel(0, 0.95, 0)] : [rel(0.9, 1.35, 3.1), rel(0, 0.9, 0)];
  if (camara.aspect < 1) pos.sub(mira).multiplyScalar(1.45).add(mira);
  camara.position.copy(pos); camara.lookAt(mira); renderer.render(escena, camara);
};
window.__recursos = {
  crear: async (op, base) => {
    const nuevo = await crearPersonaje(op, base);
    if (pj) escena.remove(pj.raiz);
    pj = nuevo; pj.raiz.position.copy(POS); pj.raiz.rotation.y = GIRO; escena.add(pj.raiz);
    const esq = new Set(); pj.modelo.traverse(o => { if (o.isSkinnedMesh) esq.add(o.skeleton); });
    return { triangulos: pj.triangulos, clips: pj.clips, esqueletos: esq.size };
  },
  // solo esa animación, en el instante t (fracción de su duración si fraccion = true)
  pose: (nombre, t, fraccion = false) => {
    pj.mezclador.stopAllAction();
    const a = pj.acciones[nombre]; a.reset().setEffectiveWeight(1).play();
    a.time = fraccion ? t * a.getClip().duration : t; pj.mezclador.update(0); pj.raiz.updateMatrixWorld(true);
  },
  vista,
  diag: () => ({ acciones: pj.acciones }),
  huesos: () => Object.values(pj.hueso).map(b => { const v = new THREE.Vector3(); b.getWorldPosition(v); return [v.x, v.y, v.z]; }),
};
