// Kinhold — la herramienta del admin: velocidad y cámara libre (partido de src/juego/main.js, 12 nov, sin cambiar nada
// de lo que hace).
import { tr } from '../idioma.js';

// camLibre: el estado de la cámara libre ({ activa, x, y, z, sube }); camara: la de three.js; cam: el giro de la cámara
// ({ yaw, pitch }); pj: el personaje; teclas: las pulsadas; enLinea y panelAdmin: () => los de ahora (o null);
// sueloEn(x, z): la altura del terreno; avisar(texto): el aviso de abajo.
export function crearCamaraLibre({ camLibre, camara, cam, pj, teclas, enLinea, panelAdmin, sueloEn, avisar }) {
  // (valravnx, 6 nov: «poder multiplicar la velocidad de carrera y poder ir a freecam volando en 3 dimensiones»; el panel
  // está en src/juego/panel_admin.js). La velocidad la confirma el servidor (y solo a la cuenta de admin le deja moverse
  // tanto); la cámara libre es solo de este navegador: el personaje se queda donde estaba y no cambia nada del mundo.
  // Decisiones provisionales (anotadas en el diario): vuela a 12 m/s, con Mayúsculas a 48; no atraviesa el suelo (queda
  // al menos a 0,5 m por encima) y no se aleja más de 3 km del personaje (lo de alrededor llega por el personaje).
  const VUELO = 12, VUELO_RAPIDO = 48, VUELO_LEJOS = 3000;
  // con el autoconstruir del admin, el mojón y los muebles no piden llevar sus materiales (el servidor no los cobra)
  function autoconstruirAdmin() { return !!(enLinea() && enLinea().admin && enLinea().red && enLinea().red.modosAdmin && enLinea().red.modosAdmin.autoconstruir); }
  const velocidadAdmin = () => (enLinea() && enLinea().admin && enLinea().red && enLinea().red.modosAdmin && enLinea().red.modosAdmin.velocidad > 1 ? enLinea().red.modosAdmin.velocidad : 1);
  const barraVuelo = document.createElement('div');
  barraVuelo.id = 'barraVuelo'; barraVuelo.hidden = true;
  // a la izquierda, a media altura: a la derecha están los botones de modo y Usar, y abajo a la izquierda el joystick
  barraVuelo.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left,0px));top:50%;transform:translateY(-50%);z-index:30;display:flex;flex-direction:column;gap:8px';
  for (const [idb, texto, sube] of [['vueloSubir', '▲', 1], ['vueloBajar', '▼', -1], ['vueloIrAqui', tr('Ir aquí'), 0], ['vueloSalir', tr('Cámara'), 0]]) {
    const b = document.createElement('button'); b.id = idb; b.textContent = texto;
    b.style.cssText = 'min-width:52px;min-height:44px;font:600 14px system-ui,sans-serif;color:#f1e8d8;background:rgba(36,30,24,.85);border:1px solid rgba(241,232,216,.3);border-radius:10px;touch-action:none';
    if (sube) {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); camLibre.sube = sube; });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (camLibre.sube === sube) camLibre.sube = 0; });
    }
    else b.onclick = () => (idb === 'vueloSalir' ? alternarCamaraLibre(false) : panelAdmin() && panelAdmin().irAqui());
    barraVuelo.appendChild(b);
  }
  document.body.appendChild(barraVuelo);
  function alternarCamaraLibre(si = !camLibre.activa) {
    if (si === camLibre.activa) return;
    if (si && !(panelAdmin() && panelAdmin().admin)) return;
    camLibre.activa = si; camLibre.sube = 0;
    barraVuelo.hidden = !si;
    if (si) {
      // empieza donde estaba la cámara, mirando hacia donde miraba (de cara al personaje)
      camLibre.x = camara.position.x; camLibre.y = camara.position.y; camLibre.z = camara.position.z;
      avisar(tr('Cámara libre: el personaje se queda aquí.'));
    } else avisar(tr('Vuelves a tu personaje.'));
  }
  function moverCamaraLibre(ax, az, dt) {
    const v = (teclas.has('shift') ? VUELO_RAPIDO : VUELO) * dt;
    const cp = Math.cos(cam.pitch), s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    // adelante: hacia donde mira (también hacia arriba o abajo); los lados, en horizontal
    const fx = -s * cp, fy = -Math.sin(cam.pitch), fz = -c * cp;
    const avance = -az, lado = ax;
    camLibre.x += (fx * avance + c * lado) * v;
    camLibre.z += (fz * avance - s * lado) * v;
    camLibre.y += fy * avance * v;
    const sube = (teclas.has(' ') ? 1 : 0) - (teclas.has('c') ? 1 : 0) + camLibre.sube;
    camLibre.y += sube * v;
    // ni bajo el suelo ni demasiado lejos del personaje
    const dx = camLibre.x - pj.x, dz = camLibre.z - pj.z, d = Math.hypot(dx, dz);
    if (d > VUELO_LEJOS) { camLibre.x = pj.x + dx / d * VUELO_LEJOS; camLibre.z = pj.z + dz / d * VUELO_LEJOS; }
    const suelo = sueloEn(camLibre.x, camLibre.z);
    if (camLibre.y < suelo + 0.5) camLibre.y = suelo + 0.5;
  }

  return { alternarCamaraLibre, moverCamaraLibre, autoconstruirAdmin, velocidadAdmin };
}
