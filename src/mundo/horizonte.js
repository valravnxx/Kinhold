// Kinhold — el horizonte en el juego (three.js): la malla basta de toda la isla detrás del terreno de cerca, para los
// perfiles gráficos altos (src/posprocesado/perfiles.js, «horizonte»). La lógica (las muestras, la malla y la
// compresión de la distancia) está en src/logica/horizonte.js.
//   - Se calcula poco a poco en cada fotograma (con un tope de milisegundos) y la malla se rehace al llegar a cada nivel.
//   - Lo que está más allá de r0 se acerca a la cámara por la misma línea de mirada (en el sombreador de vértices):
//     se ve igual y cabe dentro del alcance de la cámara del juego.
//   - Cerca del jugador hay un hueco (donde ya está el terreno de verdad), y la malla va unos metros por debajo, para
//     que lo basto nunca asome por encima de lo fino.
import * as THREE from 'three';
import { crearMuestras, mallaDe, compresion, NIVELES } from '../logica/horizonte.js';

const FINO_A_BASTO = [...NIVELES].reverse();   // 1, 2, 4: el más fino que ya esté

// paisaje y rect: los del mundo; origen y y0: el 0 de la escena; hasta: dónde acaba el terreno de cerca (m);
// camara: la del juego (su alcance manda en la compresión)
export function crearHorizonte({ escena, paisaje, rect, origen, y0, hasta, camara }) {
  const muestras = crearMuestras(paisaje, rect);
  const diagonal = Math.hypot(rect.x1 - rect.x0, rect.z1 - rect.z0);
  const comp = compresion(hasta, camara.far, diagonal);
  const uniformes = { uR0: { value: comp.r0 }, uS: { value: comp.s }, uJug: { value: new THREE.Vector2() }, uHueco: { value: Math.max(0, hasta - 48) } };
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniformes);
    sh.vertexShader = 'uniform float uR0;\nuniform float uS;\nuniform vec2 uJug;\nvarying float vHzDist;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 hzMundo = modelMatrix * vec4( transformed, 1.0 );
      vHzDist = length( hzMundo.xz - uJug );
      vec3 hzV = hzMundo.xyz - cameraPosition; float hzD = length( hzV );
      if ( hzD > uR0 ) hzMundo.xyz = cameraPosition + hzV * ( ( uR0 + ( hzD - uR0 ) * uS ) / hzD );
      vec4 mvPosition = viewMatrix * hzMundo;
      gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = 'uniform float uHueco;\nvarying float vHzDist;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if ( vHzDist < uHueco ) discard;');
  };
  const malla = new THREE.Mesh(new THREE.BufferGeometry(), material);
  malla.name = 'horizonte'; malla.frustumCulled = false; malla.castShadow = false; malla.receiveShadow = false;
  malla.visible = false;
  malla.renderOrder = -2;   // antes que el mar (que va sin escribir la hondura) y que lo de cerca
  escena.add(malla);

  let quiere = null, hecho = null;   // el nivel que pide el perfil (4, 2 o 1; null: sin horizonte) y el de la malla
  function rehacer(k) {
    const m = mallaDe(muestras, k, { ox: origen.x, oz: origen.z, y0 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(m.col, 3));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    g.computeVertexNormals();
    malla.geometry.dispose(); malla.geometry = g;
    hecho = k; malla.visible = true;
  }
  return {
    malla, muestras, compresion: comp,
    // cfg: el «horizonte» del perfil ({ paso: 4 | 2 | 1, … }) o null
    poner(cfg) {
      quiere = cfg ? cfg.paso : null;
      if (!quiere) { malla.visible = false; return; }
      // el mejor nivel que ya esté calculado sin pasarse de lo que pide
      const k = FINO_A_BASTO.find(n => n >= quiere && muestras.tiene(n));
      if (k && k !== hecho) rehacer(k); else if (hecho && hecho >= quiere) malla.visible = true;
    },
    get activo() { return !!quiere && malla.visible; },
    // en cada fotograma: dónde está el jugador (m de la escena) y cuánto tiempo puede gastar en calcular
    paso(x, z, ms) {
      uniformes.uJug.value.set(x, z);
      // no calcula más fino de lo que pide el perfil (en el móvil basta cada 400 m)
      if (!quiere || muestras.tiene(quiere) || ms <= 0) return 0;
      const t0 = performance.now();
      muestras.avanzar(ms);
      // en cuanto hay un nivel mejor que el de la malla (sin pasarse del que pide el perfil), se rehace
      const k = FINO_A_BASTO.find(n => n >= quiere && muestras.tiene(n));
      if (k && k !== hecho) rehacer(k);
      return performance.now() - t0;
    },
  };
}
