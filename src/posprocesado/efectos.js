// Kinhold — el posprocesado de un perfil gráfico (three.js + postprocessing + n8ao).
// Monta la cadena de pasadas según el perfil y los efectos que estén puestos:
//   1. el dibujo de la escena (con el suavizado MSAA del perfil, si lo lleva)
//   2. la oclusión ambiental (n8ao), si la lleva
//   3. el desenfoque puntual, solo si se pide (va aparte: no se puede juntar con otros efectos de su clase)
//   4. en UNA sola pasada: el brillo de las luces, los haces de luz, el mapeo tonal y la gradación de color
//   5. el desenfoque de maqueta (src/posprocesado/maqueta.js), si está puesto
//   6. el suavizado SMAA, si es el del perfil (también va aparte por lo mismo)
// La niebla va en esa misma pasada (src/posprocesado/niebla.js: la de three.js se vería más espesa con posprocesado). Sin nada puesto (el modo «v5»), se dibuja directo como la prueba de
// estilo v5, con el mapeo tonal del propio three.js.
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, LUT3DEffect, LookupTexture,
  GodRaysEffect, DepthOfFieldEffect, SMAAEffect, SMAAPreset } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { rellenarTabla, HORIZONTE } from './perfiles.js';
import { NieblaEffect } from './niebla.js';
import { MaquetaEffect, MaquetaFuerteEffect } from './maqueta.js';

const SMAA = { 'smaa-bajo': SMAAPreset.LOW, 'smaa-medio': SMAAPreset.MEDIUM, 'smaa-alto': SMAAPreset.HIGH };

// opciones: { sol: la malla del disco del sol (para los haces), foco: Vector3 al que mira el desenfoque, niebla: la de la escena }
// compresion (opcional): () => { r0, s } del horizonte del mundo (src/mundo/horizonte.js), o null si no hay;
// cielo (opcional): () => [arriba, horizonte] (hex sRGB), el degradado del cielo, para que lo lejano se funda con él
// cieloVivo (opcional): el estado del ciclo de día y noche (src/mundo/cielo.js): el cielo lo pinta la niebla, con su sol,
// su luna y sus estrellas
export function crearPosprocesado(renderer, escena, camara, { sol = null, foco = new THREE.Vector3(), niebla = null, luzSol = null, compresion = null, cielo = null, cieloVivo = null } = {}) {
  const tabla = LookupTexture.createNeutral(32);
  rellenarTabla(tabla.image.data, 32);
  tabla.needsUpdate = true;
  let composer = null, montado = null, directo = true;
  const ancho = () => renderer.domElement.width, alto = () => renderer.domElement.height;

  function soltar() { if (composer) { composer.dispose(); composer = null; } }

  // perfil: el de perfiles.js; on: { ao, tono, color, brillo, niebla, desenfoque, rayos }; v5: dibujar como la v5
  function montar(perfil, on, v5 = false) {
    soltar();
    montado = { perfil, on: { ...on }, v5 };
    // lo que no es pasada: resolución, sombras y niebla
    const dpr = Math.min(window.devicePixelRatio || 1, perfil.res);
    renderer.setPixelRatio(v5 ? Math.min(window.devicePixelRatio || 1, 1.5) : dpr);
    if (luzSol) {
      const lado = v5 ? 1024 : perfil.sombras;
      if (luzSol.shadow.mapSize.x !== lado) { luzSol.shadow.mapSize.set(lado, lado); if (luzSol.shadow.map) { luzSol.shadow.map.dispose(); luzSol.shadow.map = null; } }
    }
    // three.js 0.186 ya no tiene sombras PCFSoft (avisa y usa PCF): lo blando es el radio del filtro (la v5 usa 4)
    if (luzSol) luzSol.shadow.radius = v5 ? 4 : perfil.blandas ? 2.5 : 1.5;   // (12 nov: con 4, el borde salía punteado)
    if (renderer.shadowMap.type !== THREE.PCFShadowMap) renderer.shadowMap.type = THREE.PCFShadowMap;
    const n = typeof niebla === 'function' ? niebla() : niebla;   // la de la luz de ahora (cada luz trae la suya)
    // directo, la niebla de la escena; con posprocesado, la del efecto (detrás del mapeo tonal, como la de three.js)
    escena.fog = v5 ? n : null;
    if (sol) sol.visible = !v5 && !!on.rayos;
    directo = v5;
    if (v5) { renderer.toneMapping = THREE.ACESFilmicToneMapping; return; }
    // con el posprocesado, el mapeo tonal lo hace la última pasada (si no, se haría dos veces)
    renderer.toneMapping = THREE.NoToneMapping;
    const msaa = perfil.suavizado.startsWith('msaa') ? Math.min(Number(perfil.suavizado.slice(5)), renderer.capabilities.maxSamples || 0) : 0;
    composer = new EffectComposer(renderer, { multisampling: msaa, frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(escena, camara));
    if (on.ao && perfil.ao) {
      const ao = new N8AOPostPass(escena, camara, ancho(), alto());
      ao.setQualityMode(perfil.ao);
      Object.assign(ao.configuration, { halfRes: perfil.aoMedia, aoRadius: 1.1, distanceFalloff: 0.6, intensity: 2.2, color: new THREE.Color(0x1c1610) });
      composer.addPass(ao);
    }
    if (on.desenfoque && perfil.desenfoque) {
      const dof = new DepthOfFieldEffect(camara, { worldFocusDistance: 8, worldFocusRange: 5, bokehScale: 2.5, resolutionScale: 0.5 });
      dof.target = foco;
      composer.addPass(new EffectPass(camara, dof));
    }
    const lista = [];
    if (on.brillo && perfil.brillo) lista.push(new BloomEffect({ luminanceThreshold: 0.95, luminanceSmoothing: 0.25, intensity: 0.75, radius: 0.7, mipmapBlur: true, levels: perfil.brillo }));
    if (on.rayos && perfil.rayos && sol) lista.push(new GodRaysEffect(camara, sol, { samples: perfil.rayos, density: 0.96, decay: 0.94, weight: 0.5, exposure: 0.7, clampMax: 1, blur: true }));
    lista.push(new ToneMappingEffect({ mode: on.tono ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.LINEAR }));
    // con horizonte (los perfiles altos, si el mundo lo tiene), la niebla deja ver lo lejano con su bruma
    const comp = perfil.horizonte && compresion ? compresion() : null;
    if (on.niebla && n) lista.push(new NieblaEffect(n, camara, comp ? { ...HORIZONTE, ...comp, cielo: cielo ? cielo() : null } : null, cieloVivo));
    if (on.color) lista.push(new LUT3DEffect(tabla));
    composer.addPass(new EffectPass(camara, ...lista));
    // el desenfoque de maqueta (arriba y abajo de la pantalla), en los perfiles que pueden con una pasada más
    // (on.maqueta === 2: el modo maqueta al 100 %, con la distancia y el color de juguete)
    if (on.maqueta && perfil.desenfoque) composer.addPass(new EffectPass(camara, on.maqueta === 2 ? new MaquetaFuerteEffect({ vivo: cieloVivo }) : new MaquetaEffect({ vivo: cieloVivo })));
    if (SMAA[perfil.suavizado] !== undefined) composer.addPass(new EffectPass(camara, new SMAAEffect({ preset: SMAA[perfil.suavizado] })));
    composer.setSize(renderer.domElement.clientWidth || innerWidth, renderer.domElement.clientHeight || innerHeight, false);
  }

  return {
    montar,
    get montado() { return montado; },
    // cuántas pasadas de pantalla completa lleva (lo que más cuesta en el móvil)
    get pasadas() { return composer ? composer.passes.length : 1; },
    setSize(w, h) { renderer.setSize(w, h, false); if (composer) composer.setSize(w, h, false); },
    dibujar(dt = 1 / 60) { if (directo || !composer) renderer.render(escena, camara); else composer.render(dt); },
    // ms por fotograma de verdad, sin el tope de la pantalla: dibuja n veces esperando a que la tarjeta acabe cada una
    // (leer un píxel obliga a terminar el dibujo)
    medir(n = 20) {
      const gl = renderer.getContext(), px = new Uint8Array(4);
      this.dibujar(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // la primera compila los sombreadores
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { this.dibujar(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      return (performance.now() - t0) / n;
    },
    soltar,
  };
}
