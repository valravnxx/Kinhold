// Kinhold — el horizonte en el juego (three.js): la malla basta de toda la isla detrás del terreno de cerca, para los
// perfiles gráficos altos (src/posprocesado/perfiles.js, «horizonte»). La lógica (las muestras, la malla y la
// compresión de la distancia) está en src/logica/horizonte.js.
//   - Se calcula poco a poco en cada fotograma (con un tope de milisegundos) y la malla se rehace al llegar a cada nivel.
//   - Lo que está más allá de r0 se acerca a la cámara por la misma línea de mirada (en el sombreador de vértices):
//     se ve igual y cabe dentro del alcance de la cámara del juego.
//   - Cerca del jugador hay un hueco (donde ya está el terreno de verdad), y la malla va unos metros por debajo, para
//     que lo basto nunca asome por encima de lo fino.
import * as THREE from 'three';
import { crearMuestras, mallaDe, mallaMar, mallaDosel, crearDoselCerca, compresion, NIVELES, PASO_DOSEL_CERCA } from '../logica/horizonte.js';
import { TAMANO_ESPECIE } from './especies.js';
import { PALETA } from './estilos.js';

// el dosel de cada especie: lo alto del árbol (escala 1) y el color de sus copas (la media de sus dos verdes, algo más
// oscura: dentro de una masa de copas hay mucha sombra)
const VERDES = { abeto: ['abeto', 'abetoOsc'], pino: ['pino', 'pinoOsc'], abedul: ['hojaClara', 'hoja'], roble: ['hoja', 'hojaOsc'],
  haya: ['haya', 'hayaOsc'], fresno: ['fresno', 'hoja'], encina: ['encina', 'encinaOsc'] };
export const ESPECIES_DOSEL = Object.fromEntries(Object.entries(VERDES).map(([e, [a, b]]) => {
  const x = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255].map(v => v / 255);
  const A = x(PALETA[a]), B = x(PALETA[b]);
  return [e, { alto: TAMANO_ESPECIE[e][1], color: A.map((v, i) => (v + B[i]) / 2 * 0.85) }];
}));

// El material de lo lejano: colores por vértice, sin niebla de la escena (la pone el posprocesado) y con la compresión de
// la distancia (más allá de r0, más cerca por la misma línea de mirada). u: los uniformes de esta malla: uR0, uS, uJug,
// y lo que se tira: uHueco (m alrededor del jugador), uHasta (m: más allá, nada; 0 = sin límite) y uCuadro (el cuadro de
// los árboles de verdad: xy su centro, z su medio lado; z = 0, sin cuadro). copas: true, las manchas de las copas.
function materialLejano(u, copas = false) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform float uR0;\nuniform float uS;\nuniform vec2 uJug;\nvarying vec3 vHzMundo;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 hzMundo = modelMatrix * vec4( transformed, 1.0 );
      vHzMundo = hzMundo.xyz;
      vec3 hzV = hzMundo.xyz - cameraPosition; float hzD = length( hzV );
      if ( hzD > uR0 ) hzMundo.xyz = cameraPosition + hzV * ( ( uR0 + ( hzD - uR0 ) * uS ) / hzD );
      vec4 mvPosition = viewMatrix * hzMundo;
      gl_Position = projectionMatrix * mvPosition;`);
    let f = 'uniform float uHueco;\nuniform float uHasta;\nuniform vec3 uCuadro;\nuniform vec2 uJug;\nvarying vec3 vHzMundo;\n';
    if (copas) f += `float hzAzar(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float hzRuido(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hzAzar(i),hzAzar(i+vec2(1,0)),f.x),mix(hzAzar(i+vec2(0,1)),hzAzar(i+vec2(1,1)),f.x),f.y);}
`;
    sh.fragmentShader = f + sh.fragmentShader.replace('void main() {', `void main() {
  float hzDist = length( vHzMundo.xz - uJug );
  if ( hzDist < uHueco || ( uHasta > 0.0 && hzDist > uHasta ) ) discard;
  if ( uCuadro.z > 0.0 && max( abs( vHzMundo.x - uCuadro.x ), abs( vHzMundo.z - uCuadro.y ) ) < uCuadro.z ) discard;`);
    // las copas: manchas de unos 6 m (copas sueltas) y de unos 20 m (grupos), con huecos oscuros entre ellas; se
    // apagan con la distancia (de lejos ya no se distinguen y harían centelleo)
    if (copas) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec2 hzP = vHzMundo.xz;
    float hzC = hzRuido( hzP / 5.5 ) * 0.6 + hzRuido( hzP / 19.0 + 3.7 ) * 0.4;
    float hzK = mix( 0.5, 1.22, smoothstep( 0.25, 0.75, hzC ) );
    // más lejos, manchas de grupos (unos 60 m) y luego la masa, algo más oscura (la sombra de dentro del bosque)
    float hzG = mix( 0.6, 1.12, smoothstep( 0.2, 0.8, hzRuido( hzP / 60.0 + 9.1 ) * 0.7 + hzRuido( hzP / 170.0 - 4.3 ) * 0.3 ) );
    float hzD = length( vHzMundo - cameraPosition );
    diffuseColor.rgb *= mix( mix( hzK, hzG, smoothstep( 700.0, 2500.0, hzD ) ), 0.85, smoothstep( 6000.0, 14000.0, hzD ) );
    // de cerca, del color de los árboles de verdad (que siguen justo delante); de lejos, más oscuro: la sombra de dentro
    // de la masa del bosque, que es lo que hace que de lejos se distinga de la pradera
    diffuseColor.rgb *= mix( 1.0, 0.62, smoothstep( 800.0, 3500.0, hzD ) );
  }`);
  };
  return material;
}


const FINO_A_BASTO = [...NIVELES].reverse();   // 1, 2, 4: el más fino que ya esté

// paisaje y rect: los del mundo; origen y y0: el 0 de la escena; hasta: dónde acaba el terreno de cerca (m);
// camara: la del juego (su alcance manda en la compresión); colorMar: el de la lámina del mar; alt(x, z): la altura
// exacta del suelo (m del mundo), para el dosel de cerca (sin ella, no hay dosel de cerca); hay(x, z): ¿ha llegado ya
// el terreno de cerca a ese sitio? (si no, ahí no hay dosel de cerca, que flotaría)
export function crearHorizonte({ escena, paisaje, rect, origen, y0, hasta, camara, colorMar = 0x4a6470, alt = null, hay = null }) {
  const muestras = crearMuestras(paisaje, rect, undefined, ESPECIES_DOSEL);
  const diagonal = Math.hypot(rect.x1 - rect.x0, rect.z1 - rect.z0);
  const comp = compresion(hasta, camara.far, diagonal);
  const jug = new THREE.Vector2(), cuadroArb = new THREE.Vector3(0, 0, 1e6);   // (hasta que estén los árboles, nada de cerca)
  const comun = { uR0: { value: comp.r0 }, uS: { value: comp.s }, uJug: { value: jug } };
  // el hueco, casi hasta donde acaba el terreno de cerca (16 m de solape: ahí gana el de cerca, que va delante en la hondura)
  const uniformes = { ...comun, uHueco: { value: Math.max(0, hasta - 16) }, uHasta: { value: 0 }, uCuadro: { value: new THREE.Vector3() } };
  const material = materialLejano(uniformes);
  // lo lejano va comprimido (unos metros de verdad son centímetros de hondura): cada capa con su sitio en la hondura,
  // para que no se pisen: el suelo, un poco detrás (pierde con el terreno de cerca donde se solapan); el mar, más
  // detrás que el suelo (la costa no se pisa con él); el dosel, delante
  Object.assign(material, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 });
  const materialMar = materialLejano({ ...uniformes });
  Object.assign(materialMar, { polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 16 });
  // el dosel: de lejos, desde donde acaba el terreno de cerca (algo antes) hasta el borde; de cerca, desde los árboles de
  // verdad (su cuadro) hasta ahí. Las dos con el mismo corte (borde), para que no se pisen.
  const borde = Math.max(0, hasta - 28);
  const matDoselLejos = materialLejano({ ...comun, uHueco: { value: borde }, uHasta: { value: 0 }, uCuadro: { value: new THREE.Vector3() } }, true);
  // (el dosel no se adelanta en la hondura: ya va detrás el suelo; adelantado, asomaba por delante de las lomas)
  const matDoselCerca = materialLejano({ ...comun, uHueco: { value: 0 }, uHasta: { value: borde }, uCuadro: { value: cuadroArb } }, true);
  const malla = new THREE.Mesh(new THREE.BufferGeometry(), material);
  malla.name = 'horizonte'; malla.frustumCulled = false; malla.castShadow = false; malla.receiveShadow = false;
  malla.visible = false;
  malla.renderOrder = -2;   // antes que el mar (que va sin escribir la hondura) y que lo de cerca
  escena.add(malla);
  // el mar de lejos (el de cerca, src/mundo/mundo_juego.js, acaba con la cámara): liso, del color de la lámina del
  // mar, un poco por debajo de ella (de cerca, la lámina lo tapa; la costa la hace la malla, que baja mucho en el mar)
  const mm = mallaMar(rect, { ox: origen.x, oz: origen.z, y: -y0 - 1.5 });
  const gm = new THREE.BufferGeometry();
  gm.setAttribute('position', new THREE.BufferAttribute(mm.pos, 3));
  const cm = new THREE.Color(colorMar), cols = new Float32Array(mm.pos.length);
  for (let i = 0; i < cols.length; i += 3) { cols[i] = cm.r; cols[i + 1] = cm.g; cols[i + 2] = cm.b; }
  gm.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  gm.setIndex(new THREE.BufferAttribute(mm.idx, 1));
  gm.computeVertexNormals();
  const mar = new THREE.Mesh(gm, materialMar);
  mar.name = 'horizonte-mar'; mar.frustumCulled = false; mar.castShadow = false; mar.receiveShadow = false;
  mar.renderOrder = -2;
  malla.add(mar);   // se ve y se esconde con la malla
  const doselLejos = new THREE.Mesh(new THREE.BufferGeometry(), matDoselLejos);
  doselLejos.name = 'horizonte-dosel'; doselLejos.frustumCulled = false; doselLejos.renderOrder = -2;
  malla.add(doselLejos);
  const doselCerca = new THREE.Mesh(new THREE.BufferGeometry(), matDoselCerca);
  doselCerca.name = 'dosel-cerca'; doselCerca.frustumCulled = false;
  escena.add(doselCerca);
  const geo = (m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(m.col, 3));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    g.computeVertexNormals();
    return g;
  };
  // el de cerca: un cuadro alrededor del jugador, que se rehace (poco a poco) al alejarse de su centro
  const RADIO_CERCA = borde + 160, REHACER = 140;
  let cerca = null, calculando = null, hechoEn = 0;

  let quiere = null, hecho = null;   // el nivel que pide el perfil (4, 2 o 1; null: sin horizonte) y el de la malla
  function rehacer(k) {
    const m = mallaDe(muestras, k, { ox: origen.x, oz: origen.z, y0 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(m.col, 3));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    g.computeVertexNormals();
    malla.geometry.dispose(); malla.geometry = g;
    // el dosel de lejos, solo desde cada 200 m: cada 400 salían losas oscuras (el linde, de 400 m de rampa)
    doselLejos.geometry.dispose(); doselLejos.geometry = k <= 2 ? geo(mallaDosel(muestras, k, { ox: origen.x, oz: origen.z, y0 })) : new THREE.BufferGeometry();
    hecho = k; malla.visible = true;
  }
  // el dosel de cerca: si el jugador se ha alejado de su centro, se empieza otro (el de antes se queda hasta que esté)
  function pasoCerca(x, z, ms) {
    // (en el móvil, el terreno de cerca acaba a 288 m y los árboles de verdad llegan a 130: entre medias, el dosel se
    // veía de demasiado cerca, como lomas lisas; ahí se queda el suelo)
    if (!alt || ms <= 0 || hasta < 500) return 0;
    const t0 = performance.now();
    const xm = x + origen.x, zm = z + origen.z;
    // otro: al alejarse, o si al hacerlo faltaba terreno de cerca (cada 3 s, hasta que esté todo)
    const tarde = cerca && cerca.faltan > 0 && performance.now() - hechoEn > 3000;
    if (!calculando && (!cerca || tarde || Math.hypot(xm - cerca.cx, zm - cerca.cz) > REHACER)) {
      const px = Math.round(xm / PASO_DOSEL_CERCA) * PASO_DOSEL_CERCA, pz = Math.round(zm / PASO_DOSEL_CERCA) * PASO_DOSEL_CERCA;
      calculando = crearDoselCerca(paisaje, alt, ESPECIES_DOSEL, px, pz, RADIO_CERCA, undefined, hay);
    }
    if (calculando) {
      calculando.avanzar(ms);
      if (calculando.listo) {
        cerca = calculando; calculando = null; hechoEn = performance.now();
        doselCerca.geometry.dispose(); doselCerca.geometry = geo(cerca.malla({ ox: origen.x, oz: origen.z, y0 }));
      }
    }
    return performance.now() - t0;
  }
  return {
    malla, muestras, compresion: comp, doselLejos, doselCerca,
    get doselCercaListo() { return !!cerca; },
    // para las pruebas (sin tarjeta gráfica van a 1–3 fotogramas por segundo): el dosel de cerca, entero, ya
    completarDoselCerca(x, z) { pasoCerca(x, z, 1e-3); if (calculando) pasoCerca(x, z, 1e9); },
    // el cuadro de los árboles de verdad (m de la escena: su centro y su medio lado), donde no va el dosel de cerca
    cuadroArboles(x, z, medio) { cuadroArb.set(x, z, medio); },
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
      jug.set(x, z);
      const tc = pasoCerca(x, z, ms);
      // no calcula más fino de lo que pide el perfil (en el móvil basta cada 400 m)
      if (!quiere || muestras.tiene(quiere) || ms - tc <= 0) return tc;
      ms -= tc;
      const t0 = performance.now() - tc;
      muestras.avanzar(ms);
      // en cuanto hay un nivel mejor que el de la malla (sin pasarse del que pide el perfil), se rehace
      const k = FINO_A_BASTO.find(n => n >= quiere && muestras.tiene(n));
      if (k && k !== hecho) rehacer(k);
      return performance.now() - t0;
    },
  };
}
