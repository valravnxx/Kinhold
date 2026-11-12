// Kinhold — la hierba densa (valravnx, 12 nov, hito «El aspecto»: «el mundo sigue viéndose como un prado verde con
// puntitos de hierbas»). Una alfombra de matas de hojas alrededor del jugador, como se hace en los mundos abiertos de
// navegador: instancias (una llamada de dibujo por celda), cada mata teñida con el color del suelo que tiene debajo
// (así se lee como una alfombra y no como puntitos), más clara en la punta, movida por el viento en el sombreador y
// que encoge hasta desaparecer al llegar al borde de su radio (sin transparencias).
//
//  - El mundo se parte en celdas de 8 m; se hacen las de alrededor del jugador (pocas por fotograma) y se sueltan las
//    que quedan lejos. Las matas de una celda salen de un azar fijo por celda: siempre las mismas en el mismo sitio.
//  - La altura y el color salen del trozo de terreno que se ve (su malla): donde el suelo no es hierba (tierra, roca,
//    arena, nieve, el lecho de un río) el color no es verde y no se pone mata; tampoco donde se ha construido.
//  - Cuánta y hasta dónde, según el perfil gráfico (src/posprocesado/perfiles.js, «hierba»): el móvil básico no la lleva.
//  - No hace sombra (la recibe) y no choca: es solo lo que se ve.
import * as THREE from 'three';
import { claveTrozo, trozoDe } from '../logica/trozos.js';

export const CELDA = 8;   // m
const POR_FOTOGRAMA = 2;  // celdas nuevas, como mucho, en cada fotograma

// una mata: tres hojas finas que se abren hacia fuera, cada una una tira que se estrecha (5 puntos, 3 triángulos). Mide 1 de
// alto (la instancia le da su tamaño); «alto» (0 en el pie, 1 en la punta) es lo que mueve el viento y aclara el color
function geometriaMata() {
  const pos = [], alto = [], idx = [], nor = [];
  const HOJAS = 3;
  for (let h = 0; h < HOJAS; h++) {
    const a = h * 6.283 / HOJAS + 0.4 + (h % 2) * 0.5, ca = Math.cos(a), sa = Math.sin(a);   // hacia dónde se abre
    const px = -sa, pz = ca;                                          // a lo ancho de la hoja
    const cx = ca * 0.12, cz = sa * 0.12;                             // el pie, algo separado del centro
    const w = 0.062, cae = 0.3 + 0.18 * (h % 2), largo = 1 - 0.22 * (h % 2);
    const pt = (lado, y, anch, fuera) => { pos.push(cx + ca * fuera + px * lado * anch, y * largo, cz + sa * fuera + pz * lado * anch); alto.push(y); nor.push(0, 1, 0); };
    const b = pos.length / 3;
    pt(-1, 0, w, 0); pt(1, 0, w, 0); pt(-1, 0.55, w * 0.7, cae * 0.3); pt(1, 0.55, w * 0.7, cae * 0.3); pt(0, 1, 0, cae);
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2, b + 2, b + 3, b + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('alto', new THREE.Float32BufferAttribute(alto, 1));
  g.setIndex(idx);
  return g;
}
export const TRIANGULOS_MATA = 9;

// el azar fijo de una celda (enteros → 0–1, una secuencia)
function azarCelda(i, j) {
  let h = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ 0x9e3779b9) >>> 0;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

// ¿es hierba el suelo de ese color (lineal)? Verde claro: más verde que rojo y que azul. Devuelve cuánto (0–1)
export function cuantaHierba(r, g, b) {
  const v = Math.min((g - r) / (g + 1e-6), (g - b) / (g + 1e-6) * 0.6);
  return Math.max(0, Math.min(1, (v - 0.05) / 0.12));
}

// mundoJ: el mundo (src/mundo/mundo_juego.js: terreno, salida, y0); raiz: dónde se cuelga (la escena)
export function crearHierbaDensa({ mundoJ, raiz }) {
  const terreno = mundoJ.terreno, O = mundoJ.salida, y0 = mundoJ.y0;
  const geo = geometriaMata();
  const U = { uTiempo: { value: 0 }, uCentro: { value: new THREE.Vector2() }, uRadio: { value: 20 } };
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = 'attribute float alto;\nvarying float vAlto;\nvarying float vLejos;\nuniform float uTiempo;uniform vec2 uCentro;uniform float uRadio;\n' + s.vertexShader.replace('#include <project_vertex>', `
      vAlto = alto;
      vec4 pie = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec4 enMundo = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      // al llegar al borde de su radio, la mata encoge hasta el suelo; y cuanto más lejos, más ancha (a lo lejos hay las
      // mismas matas por metro y se ven más pequeñas: así siguen tapando el suelo)
      float lejos = distance(pie.xz, uCentro) / uRadio;
      // (se van por partes: cada mata tiene su azar, y a más distancia quedan menos, y más bajas; no hay un corte)
      float azar = fract(sin(dot(pie.xz, vec2(12.9898, 78.233))) * 43758.5453);
      float cerca = step(azar, 1.0 - smoothstep(0.4, 1.0, lejos)) * (1.0 - 0.45 * smoothstep(0.5, 1.0, lejos));
      vLejos = lejos;
      enMundo.xz = pie.xz + (enMundo.xz - pie.xz) * (1.0 + 0.8 * lejos) * mix(0.4, 1.0, cerca);   // (y al irse, también se estrecha: no queda una hoja tumbada)
      enMundo.y = pie.y + (enMundo.y - pie.y) * cerca;
      // el viento: dos ondas que cruzan el prado; mueve la punta y nada el pie
      float w = sin(uTiempo * 1.3 + pie.x * 0.31 + pie.z * 0.23) * 0.07 + sin(uTiempo * 2.9 + pie.x * 1.1 - pie.z * 0.7) * 0.025;
      enMundo.xz += vec2(0.8, 0.6) * w * alto * alto * cerca;
      vec4 mvPosition = viewMatrix * enMundo;
      gl_Position = projectionMatrix * mvPosition;`);
    s.fragmentShader = 'varying float vAlto;\nvarying float vLejos;\n' + s.fragmentShader
      // la luz, la del suelo (la normal hacia arriba por las dos caras): así casa con él
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );')
      // más oscura en el pie (la sombra de la propia mata) y más clara y algo más amarilla en la punta; a lo lejos, del
      // color del suelo sin más, para que el borde de la hierba no se note contra el suelo de más allá
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(mix(vec3(0.72, 0.75, 0.72), vec3(1.03, 1.03, 0.96), vAlto), vec3(0.93), smoothstep(0.25, 0.9, vLejos));');
  };
  const grupo = new THREE.Group(); grupo.name = 'hierbaDensa'; raiz.add(grupo);
  const celdas = new Map();   // «i,j» → { im (o null si no hay ninguna mata), malla (la del terreno con la que se hizo), n }
  let conf = null, ocupado = null, sucio = 0, estorbos = null;
  const o = new THREE.Object3D(), col = new THREE.Color();

  // el trozo de terreno de un punto del mundo, si está con su malla
  function trozoEn(xm, zm) {
    const { i, j } = trozoDe(xm, zm, terreno.lado), v = terreno.vivos.get(claveTrozo(i, j));
    return v && v.malla && v.suelo ? v : null;
  }
  // el color del suelo (lineal) en un punto del mundo: el de la malla, entre sus cuatro puntos de rejilla
  const _c = [0, 0, 0];
  function colorEn(v, xm, zm) {
    const s = v.suelo, C = v.malla.geometry.attributes.color.array, n = s.n;
    const ga = Math.min(n - 1.001, Math.max(0, (xm - s.x0) / s.paso)), gb = Math.min(n - 1.001, Math.max(0, (zm - s.z0) / s.paso));
    const a = Math.floor(ga), b = Math.floor(gb), fa = ga - a, fb = gb - b;
    for (let k = 0; k < 3; k++) {
      const p = C[(b * n + a) * 3 + k], q = C[(b * n + a + 1) * 3 + k], r = C[((b + 1) * n + a) * 3 + k], t = C[((b + 1) * n + a + 1) * 3 + k];
      _c[k] = (p + (q - p) * fa) * (1 - fb) + (r + (t - r) * fa) * fb;
    }
    return _c;
  }

  // el peso de la hierba del suelo en un punto (0–1), entre los cuatro puntos de su rejilla; null si el trozo no lo trae
  function pesoHierbaEn(v, xm, zm) {
    const at = v.malla.geometry.attributes.mezcla; if (!at) return null;
    const s = v.suelo, P = at.array, n = s.n;
    const ga = Math.min(n - 1.001, Math.max(0, (xm - s.x0) / s.paso)), gb = Math.min(n - 1.001, Math.max(0, (zm - s.z0) / s.paso));
    const a = Math.floor(ga), b = Math.floor(gb), fa = ga - a, fb = gb - b;
    const p = P[(b * n + a) * 4], q = P[(b * n + a + 1) * 4], r = P[((b + 1) * n + a) * 4], u = P[((b + 1) * n + a + 1) * 4];
    return (p + (q - p) * fa) * (1 - fb) + (r + (u - r) * fa) * fb;
  }
  // hace la celda (ci, cj); false si su terreno aún no está (se vuelve a intentar)
  // banda: 0, cerca del jugador (más matas, más pequeñas); 1, más allá (menos matas y más anchas: tapan lo mismo)
  function hacer(ci, cj, banda = 0) {
    const xm0 = ci * CELDA, zm0 = cj * CELDA;
    const v0 = trozoEn(xm0 + CELDA / 2, zm0 + CELDA / 2);
    if (!v0) return false;
    const N = Math.round(conf.densidad * (banda ? 0.45 : 1.6) * CELDA * CELDA), r = azarCelda(ci, cj);
    // lo que hay en el suelo para recoger (ramas, piedras…): a su lado no se pone hierba, que lo taparía
    const est = estorbos ? estorbos().filter(e => e.x + O.x > xm0 - 1 && e.x + O.x < xm0 + CELDA + 1 && e.z + O.z > zm0 - 1 && e.z + O.z < zm0 + CELDA + 1) : [];
    const M = new Float32Array(N * 16), K = new Float32Array(N * 3);
    let n = 0;
    for (let k = 0; k < N; k++) {
      const xm = xm0 + r() * CELDA, zm = zm0 + r() * CELDA, giro = r() * 6.283, tam = (0.15 + r() * r() * 0.22) * (banda ? 1.2 : 1), tono = 0.9 + r() * 0.2, corte = r();
      const v = trozoEn(xm, zm) || v0;
      const y = terreno.alturaEn(xm, zm);
      if (y === null || y < 0.6) continue;                       // (ni en el agua ni en la orilla)
      // cuánta hierba hay ahí: por el color (verde: hierba) y, si el trozo lo trae, también por el peso de la hierba
      // del suelo (src/mundo/color_suelo.js, pesos): sobre la tierra, la roca o la hojarasca no se pone (se teñía de
      // pardo y parecía un campo arado)
      const c = colorEn(v, xm, zm), w = pesoHierbaEn(v, xm, zm), hc = cuantaHierba(c[0], c[1], c[2]);
      const h = w === null ? hc : Math.min(hc, Math.max(0, (w - 0.3) / 0.45));
      if (h <= corte) continue;                                  // (donde el suelo deja de ser hierba, cada vez menos matas)
      const x = xm - O.x, z = zm - O.z;
      if (ocupado && ocupado(x, z)) continue;
      if (est.length && est.some(e => (e.x - x) ** 2 + (e.z - z) ** 2 < 0.2)) continue;
      o.position.set(x, y - y0 - 0.02, z); o.rotation.set(0, giro, 0); const an = (0.8 + 0.5 * h) * (banda ? 1.4 : 1); o.scale.set(tam * an, tam * (0.6 + 0.4 * h), tam * an); o.updateMatrix();
      o.matrix.toArray(M, n * 16);
      K[n * 3] = c[0] * tono * 0.74; K[n * 3 + 1] = c[1] * tono * 0.8; K[n * 3 + 2] = c[2] * tono * 0.68; n++;   // (0,9: la textura del suelo lo oscurece otro tanto)
    }
    let im = null;
    if (n) {
      im = new THREE.InstancedMesh(geo, mat, n);
      im.instanceMatrix.array.set(M.subarray(0, n * 16));
      im.instanceColor = new THREE.InstancedBufferAttribute(K.slice(0, n * 3), 3);
      im.receiveShadow = true; im.castShadow = false; im.name = 'hierbaDensa ' + ci + ',' + cj;
      im.matrixAutoUpdate = false;
      // (la esfera que la envuelve, sin recorrer las matas: la celda y un margen)
      im.boundingSphere = new THREE.Sphere(new THREE.Vector3(xm0 + CELDA / 2 - O.x, (terreno.alturaEn(xm0 + CELDA / 2, zm0 + CELDA / 2) ?? 0) - y0, zm0 + CELDA / 2 - O.z), CELDA * 1.6);
      grupo.add(im);
    }
    celdas.set(ci + ',' + cj, { im, malla: v0.malla, n, ci, cj, banda });
    return true;
  }
  function soltar(k) {
    const c = celdas.get(k); if (!c) return;
    if (c.im) { grupo.remove(c.im); c.im.dispose(); }
    celdas.delete(k);
  }
  function soltarTodo() { for (const k of [...celdas.keys()]) soltar(k); }

  // perfil: { radio (m), densidad (matas por m²) } o null (sin hierba densa)
  function poner(perfil) {
    const nueva = perfil && perfil.radio > 0 && perfil.densidad > 0 ? { radio: perfil.radio, densidad: perfil.densidad } : null;
    if (JSON.stringify(nueva) === JSON.stringify(conf)) return;
    soltarTodo(); conf = nueva;
    if (conf) U.uRadio.value = conf.radio;
  }

  const CORTE = 0.45, bandaDe = (d) => (d < conf.radio * CORTE ? 0 : 1);
  // en cada fotograma: P, dónde está el jugador (escena); t, el tiempo (s). Devuelve los ms que ha tardado
  let repaso = 0;
  function paso(P, t) {
    if (!conf) return 0;
    const t0 = performance.now();
    U.uTiempo.value = t; U.uCentro.value.set(P.x, P.z);
    const xm = P.x + O.x, zm = P.z + O.z, R = conf.radio, c0 = Math.floor((xm - R) / CELDA), c1 = Math.floor((xm + R) / CELDA), d0 = Math.floor((zm - R) / CELDA), d1 = Math.floor((zm + R) / CELDA);
    // las que faltan, de cerca a lejos
    const faltan = [];
    for (let ci = c0; ci <= c1; ci++) for (let cj = d0; cj <= d1; cj++) {
      const d = Math.hypot((ci + 0.5) * CELDA - xm, (cj + 0.5) * CELDA - zm);
      if (d > R + CELDA * 0.71) continue;
      if (!celdas.has(ci + ',' + cj)) faltan.push([d, ci, cj]);
    }
    faltan.sort((a, b) => a[0] - b[0]);
    let hechas = 0;
    for (const [d, ci, cj] of faltan) { if (hechas >= POR_FOTOGRAMA) break; if (hacer(ci, cj, bandaDe(d))) hechas++; }
    // de vez en cuando: fuera las lejanas, y otra vez las que tienen el suelo cambiado (otro detalle, suelo nivelado) o
    // algo construido encima
    if (++repaso % 10 === 0 || sucio) {
      let rehechas = 0;
      // (de cerca a lejos: después de construir, lo primero que se rehace es lo que tiene el jugador a los pies)
      const orden = [...celdas].map(([k, c]) => [k, c, Math.hypot((c.ci + 0.5) * CELDA - xm, (c.cj + 0.5) * CELDA - zm)]).sort((a, b) => a[2] - b[2]);
      for (const [k, c, d] of orden) {
        if (d > R + CELDA * 2) { soltar(k); continue; }
        if (rehechas >= POR_FOTOGRAMA) continue;
        const v = trozoEn((c.ci + 0.5) * CELDA, (c.cj + 0.5) * CELDA);
        // (la banda cambia con holgura, para que una celda en la raya no se rehaga a cada paso)
        const b = c.banda ? (d < R * CORTE - CELDA * 0.5 ? 0 : 1) : (d > R * CORTE + CELDA * 0.5 ? 1 : 0);
        if (c.vieja || b !== c.banda || (v && v.malla !== c.malla)) { soltar(k); if (hacer(c.ci, c.cj, b)) rehechas++; }
      }
      sucio = [...celdas.values()].some(c => c.vieja) ? 1 : 0;
    }
    return performance.now() - t0;
  }

  return {
    poner, paso, grupo, soltarTodo,
    get activa() { return !!conf; },
    // estorbos: () => [{ x, z }] (escena), lo que hay para recoger en el suelo
    set estorbos(f) { estorbos = f; },
    // donde se ha construido no hay hierba: las celdas se rehacen poco a poco con lo ocupado de ahora
    despejar(f) { ocupado = f; for (const c of celdas.values()) c.vieja = true; sucio = 1; },
    // cuántas celdas quedan por rehacer después de despejar
    get porRehacer() { let n = 0; for (const c of celdas.values()) if (c.vieja) n++; return n; },
    get cuenta() { let n = 0; for (const c of celdas.values()) n += c.n; return { celdas: celdas.size, matas: n, triangulos: n * TRIANGULOS_MATA }; },
  };
}
