// Kinhold — ambiente común (estilo v5): cielo con degradado, sol con sombras blandas, luz del cielo,
// niebla del color del horizonte y gradación de color (ACES). Lo usan todos los prototipos.
import * as THREE from 'three';
import { LUCES } from './estilos.js';
import { tr } from '../idioma.js';

// Ajustes del dibujo que dan el aspecto del estilo: color sRGB, ACES y sombras blandas
export function prepararRenderer(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  vigilarContexto(renderer);
}

// Si el navegador pierde el dibujo 3D (en el móvil pasa cuando se queda sin memoria gráfica, con muchas pestañas o
// al volver de otra aplicación), la pantalla se queda en blanco aunque los botones sigan funcionando (lo vio valravnx).
// three.js no recupera bien las texturas y las mallas al volver el contexto, así que se recarga la página: lo
// construido y las opciones están guardados en el navegador. Si vuelve a pasar enseguida, no se recarga en bucle:
// se ofrece un botón.
function vigilarContexto(renderer) {
  const lienzo = renderer.domElement;
  if (lienzo.__vigilado) return; lienzo.__vigilado = true;
  lienzo.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    let n = 0; try { n = Number(sessionStorage.getItem('kinhold_contexto') || 0); } catch (er) { /* sin almacenamiento */ }
    const ahora = Date.now();
    const reciente = ahora - n < 20000;
    const aviso = document.createElement('div');
    aviso.id = 'avisoContexto';
    aviso.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(40,34,28,.92);color:#f1e7d6;font:16px system-ui,sans-serif;z-index:9999;text-align:center;padding:24px';
    aviso.innerHTML = `<div>${tr('Se ha perdido el dibujo 3D (el aparato se quedó sin memoria gráfica).')}</div><div>${reciente ? tr('Ha vuelto a pasar: cierra otras pestañas o aplicaciones y recarga.') : tr('Recargando… Lo construido está guardado.')}</div>`;
    if (reciente) {
      const b = document.createElement('button'); b.textContent = tr('Recargar');
      b.style.cssText = 'font:inherit;padding:10px 22px;border-radius:10px;border:0;background:#d8a84a;color:#2b241c';
      b.onclick = () => location.reload(); aviso.appendChild(b);
    }
    document.body.appendChild(aviso);
    window.__contextoPerdido = (window.__contextoPerdido || 0) + 1;
    try { sessionStorage.setItem('kinhold_contexto', String(ahora)); } catch (er) { /* sin almacenamiento */ }
    if (!reciente && !window.__sinRecargar) setTimeout(() => location.reload(), 1200);
  });
}

// cielo: degradado vertical pintado en un lienzo pequeño (lo mismo que el fondo de la prueba de estilo)
function texturaCielo(arriba, abajo) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, arriba); gr.addColorStop(0.6, abajo); gr.addColorStop(1, abajo);
  g.fillStyle = gr; g.fillRect(0, 0, 2, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// crearAmbiente(escena, opc) — opc:
//   luz: 'manana' | 'tarde'; alcance: medio lado de la zona con sombra (m); mapa: resolución de la sombra;
//   niebla: [cerca, lejos]; fondoPagina: true si el cielo lo pinta la página (lienzo transparente).
// Devuelve { sol, hemi, ponerLuz(id), seguir(x, z) } — seguir() mueve la sombra con el jugador.
export function crearAmbiente(escena, { luz = 'manana', alcance = 12.5, mapa = 1024, niebla = [45, 130], fondoPagina = false, normalBias = 0.04 } = {}) {
  const hemi = new THREE.HemisphereLight(), sol = new THREE.DirectionalLight();
  sol.castShadow = true; sol.shadow.mapSize.set(mapa, mapa); sol.shadow.radius = 4;
  Object.assign(sol.shadow.camera, { left: -alcance, right: alcance, top: alcance, bottom: -alcance, near: 1, far: Math.max(60, alcance * 4) });
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = normalBias;
  escena.add(hemi, sol, sol.target);
  const centro = new THREE.Vector3(), dir = new THREE.Vector3();
  let distancia = 1.6;
  const amb = { sol, hemi, luz };
  amb.seguir = (x, z) => {
    centro.set(x, 0, z);
    sol.target.position.copy(centro);
    sol.position.copy(dir).multiplyScalar(distancia).add(centro);
  };
  amb.ponerLuz = (id) => {
    if (!LUCES[id]) id = 'manana';
    amb.luz = id; const L = LUCES[id];
    sol.color.set(L.sol[0]); sol.intensity = L.sol[1];
    dir.set(...L.sol[2]); distancia = dir.length() * 1.6 * Math.max(1, alcance / 12.5); dir.normalize();
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    const [a, b] = L.fondo.map(c => '#' + new THREE.Color(c).getHexString());
    if (fondoPagina) document.body.style.background = `linear-gradient(${b} 0%, ${a} 60%, ${a} 100%)`;
    else { if (escena.background?.isTexture) escena.background.dispose(); escena.background = texturaCielo(b, a); }
    escena.fog = new THREE.Fog(L.fondo[0], niebla[0], niebla[1]);
    amb.seguir(centro.x, centro.z);
    return id;
  };
  amb.ponerLuz(luz);
  return amb;
}
