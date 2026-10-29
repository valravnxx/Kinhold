// Kinhold — el retrato del personaje para el panel de inventario: tu personaje del taller de verdad, de frente y de
// cuerpo entero, quieto, con la luz del estilo v5 y el fondo transparente (valravnx, 29 oct: fuera el dibujo retorcido).
// Se dibuja con el mismo renderer del juego en una esquina del lienzo (así lleva su sRGB y su gradación de color) y se
// copia enseguida al lienzo del panel; el fotograma siguiente del juego lo tapa.
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LUCES } from '../mundo/estilos.js';

export function dibujarRetrato(renderer, mh, lienzo) {
  if (!mh || !lienzo) return false;
  const pr = renderer.getPixelRatio(), cw = Math.max(1, Math.round(lienzo.clientWidth)), ch = Math.max(1, Math.round(lienzo.clientHeight));
  const w = Math.round(cw * pr), h = Math.round(ch * pr);
  const fuente = renderer.domElement;
  if (w > fuente.width || h > fuente.height) return false;
  // la figura: una copia del personaje (comparte mallas y materiales; no se libera nada de ella), quieta
  const escena = new THREE.Scene(), figura = clone(mh.raiz);
  figura.position.set(0, 0, 0); figura.rotation.set(0, 0, 0);
  escena.add(figura);
  const clip = mh.acciones && (mh.acciones.quieto || Object.values(mh.acciones)[0])?.getClip();
  if (clip) { const m = new THREE.AnimationMixer(figura); m.clipAction(clip).play(); m.update(0.5); }
  figura.updateMatrixWorld(true);
  const L = LUCES.manana;
  escena.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
  const sol = new THREE.DirectionalLight(L.sol[0], L.sol[1]); sol.position.set(1.5, 3, 4); escena.add(sol);
  // encuadre: el cuerpo entero con un poco de aire, de frente y algo por encima de la cintura
  // (cabe entero también a lo ancho: con un hacha o una herramienta en la mano)
  const caja = new THREE.Box3().setFromObject(figura, true), alto = caja.max.y - caja.min.y || 1.8, centro = caja.getCenter(new THREE.Vector3());
  const ancho = Math.max(Math.abs(caja.max.x), Math.abs(caja.min.x)) * 2 || 0.8;
  const cam = new THREE.PerspectiveCamera(20, w / h, 0.1, 50), tg = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const dist = Math.max((alto * 1.1 / 2) / tg, (ancho * 1.1 / 2) / (tg * cam.aspect)) + Math.max(0, caja.max.z);
  cam.position.set(0, centro.y + alto * 0.03, dist); cam.lookAt(0, centro.y, 0);
  // dibujar en la esquina de abajo a la izquierda del lienzo del juego y copiarlo
  const vp = new THREE.Vector4(), sc = new THREE.Vector4(), color = new THREE.Color();
  renderer.getViewport(vp); renderer.getScissor(sc);
  const scTest = renderer.getScissorTest(), alfa = renderer.getClearAlpha(); renderer.getClearColor(color);
  renderer.setViewport(0, 0, cw, ch); renderer.setScissor(0, 0, cw, ch); renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(escena, cam);
  lienzo.width = w; lienzo.height = h;
  const g = lienzo.getContext('2d'); g.clearRect(0, 0, w, h);
  g.drawImage(fuente, 0, fuente.height - h, w, h, 0, 0, w, h);
  renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scTest); renderer.setClearColor(color, alfa);
  return true;
}
