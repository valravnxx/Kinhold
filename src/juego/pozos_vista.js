// Kinhold — cómo se ven los pozos (P11b, «El pozo (2), en el juego»; la lógica, en src/logica/pozo.js).
// El terreno es una malla de alturas y no se puede agujerear, así que la boca del pozo es un disco pegado al suelo con
// lo de dentro pintado en un lienzo, mirado desde arriba como lo ve la cámara: cada tramo de 1 m cavado es un anillo
// de pared, más estrecho y más oscuro cuanto más hondo (la luz no llega abajo); los tramos revestidos, de piedra seca a
// hiladas, y el que aún no, de tierra parda; al fondo, tierra húmeda o, cuando llega al agua, el agua oscura con su
// brillo. Encima:
// - recién marcado (sin cavar): un círculo raspado en el suelo y una estaca clavada al lado (el sitio, con su hondura
//   en el aviso al marcarlo);
// - la boca: un reborde de tierra pisada y, desde que está revestido el primer tramo, un anillo de piedras a ras de
//   suelo (la hilada de arriba);
// - la tierra sacada: un montón al lado, del volumen que sale de lo cavado (lógica: tierraSacada, algo esponjada);
// - las piedras ya puestas en el tramo que se está revistiendo, un montoncito junto a la boca;
// - rematado (P11b, «El pozo (3)»): el brocal, un murete de piedra seca a hiladas alrededor de la boca (crece con las
//   piedras puestas), y el travesaño: dos varas de pies hincadas a los lados, una atravesada encima y la cuerda que
//   baja al agua desde el medio.
// Todo se rehace cuando cambia el mundo de construcción (main.js, reconstruir); lo ven todos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Lote, materialTex } from '../mundo/estilos.js';
import { estacaEn } from './modelos_objetos.js';
import { RADIO_POZO, tramosDe, tierraSacada, conAgua, PIEDRAS_BROCAL } from '../logica/pozo.js';

const SOBRE = 0.025;         // m sobre el suelo (para que no parpadee con él)
const R_BOCA = RADIO_POZO;   // m: la boca
const R_DISCO = RADIO_POZO + 0.22;   // m: el disco pintado (la boca y el reborde de tierra pisada)
const ESPONJA = 1.25;        // la tierra sacada abulta más que en su sitio
const MAX_TIERRA = 1.1;      // m³: lo más que se ve amontonado al lado
const HILADAS_BROCAL = 3;    // el brocal: tres hiladas de piedra seca (unos 55 cm)
const POR_HILADA = 13;       // piedras que se ven en cada hilada
const ALTO_HILADA = 0.18;    // m
const ALTO_TRAVESANO = 1.55; // m: la vara atravesada, sobre el suelo
const cil = (r0, r1, h, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n);
const az = (s, k) => { const v = Math.sin(s * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------- La boca pintada ----------
// El radio en el lienzo (0..1 de la boca) al que se ve la hondura d (m): las paredes se van cerrando hacia el centro
// como en una vista desde arriba de un hoyo estrecho.
const radioA = (d) => 1 - 0.66 * (1 - Math.exp(-d / 2.4));
const luzA = (d) => 0.18 + 0.82 * Math.exp(-d / 1.6);
const texturas = new Map();
function texturaBoca(p) {
  const T = tramosDe(p), cav = p.cavados + (p.golpes || 0) / 10, rev = p.revestidos, agua = conAgua(p);
  const k = [T, p.cavados, p.golpes || 0, rev, agua ? 1 : 0].join(':');
  if (texturas.has(k)) return texturas.get(k);
  if (typeof document === 'undefined') return null;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), c = N / 2, Rb = (R_BOCA / R_DISCO) * c;
  let s = 11 + p.id * 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const col = (r, gg, b, l, a = 1) => `rgba(${Math.round(r * l)},${Math.round(gg * l)},${Math.round(b * l)},${a})`;
  g.clearRect(0, 0, N, N);
  // el reborde de tierra pisada alrededor de la boca, que se pierde en la hierba
  const rg = g.createRadialGradient(c, c, Rb * 0.9, c, c, c);
  rg.addColorStop(0, col(132, 112, 86, 1, 0.95)); rg.addColorStop(0.55, col(140, 120, 92, 1, 0.75)); rg.addColorStop(1, col(140, 120, 92, 1, 0));
  g.fillStyle = rg; g.beginPath(); g.arc(c, c, c, 0, 6.2832); g.fill();
  for (let i = 0; i < 260; i++) {   // terrones y grano
    const a = rnd() * 6.2832, r = Rb + rnd() * (c - Rb) * 0.8, l = 0.7 + rnd() * 0.5;
    g.fillStyle = col(150, 128, 100, l, 0.5); g.beginPath(); g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 1 + rnd() * 2.5, 1 + rnd() * 1.6, a, 0, 6.2832); g.fill();
  }
  if (cav <= 0) {
    // solo marcado: un círculo raspado en la tierra
    g.strokeStyle = col(92, 74, 54, 1, 0.9); g.lineWidth = 5;
    g.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * 6.2832, r = Rb * (0.97 + 0.04 * Math.sin(i * 1.7)); g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); } g.stroke();
  } else {
    // las paredes, de arriba abajo: cada tramo, su anillo
    const capa = (d0, d1, piedra) => {
      const r0 = radioA(d0) * Rb, r1 = radioA(d1) * Rb, n = Math.max(1, Math.round((r0 - r1) / 3));
      for (let j = 0; j < n; j++) {
        const ra = r0 - (r0 - r1) * j / n, d = d0 + (d1 - d0) * (j + 0.5) / n, l = luzA(d);
        g.fillStyle = piedra ? col(150, 146, 136, l) : col(124, 98, 70, l);
        g.beginPath(); g.arc(c, c, ra, 0, 6.2832); g.fill();
      }
      if (piedra) {
        // las piedras a hiladas: dos o tres por tramo, de lajas desiguales con su junta oscura
        const hil = d0 < 3 ? 3 : 2;
        for (let h = 0; h < hil; h++) {
          const da = d0 + (d1 - d0) * h / hil, db = d0 + (d1 - d0) * (h + 1) / hil, ra = radioA(da) * Rb, rb = radioA(db) * Rb, l = luzA((da + db) / 2);
          let a = rnd() * 0.5;
          while (a < 6.2832) {
            const w = (0.32 + rnd() * 0.3) * (Rb / Math.max(ra, 1)) * 0.9, b = Math.min(a + w, 6.2832 + 0.01);
            const t = 0.68 + rnd() * 0.5;
            g.fillStyle = col(150 * t, 140 * t, 124 * t, l);
            g.beginPath(); g.arc(c, c, ra - 0.6, a + 0.03, b - 0.03); g.arc(c, c, rb + 0.6, b - 0.03, a + 0.03, true); g.closePath(); g.fill();
            // la junta entre piedra y piedra, oscura, y la cara de arriba de la laja, algo más clara
            g.strokeStyle = col(30, 26, 22, 1, 0.7 * l + 0.2); g.lineWidth = 1.4; g.beginPath(); g.moveTo(c + Math.cos(b) * rb, c + Math.sin(b) * rb); g.lineTo(c + Math.cos(b) * ra, c + Math.sin(b) * ra); g.stroke();
            g.strokeStyle = col(200 * t, 192 * t, 176 * t, l, 0.5); g.lineWidth = 1; g.beginPath(); g.arc(c, c, ra - 1, a + 0.05, b - 0.05); g.stroke();
            a = b;
          }
          g.strokeStyle = col(30, 26, 22, 1, 0.6 * l + 0.15); g.lineWidth = 1.2; g.beginPath(); g.arc(c, c, rb, 0, 6.2832); g.stroke();
        }
      } else {
        for (let i = 0; i < 70; i++) {   // la tierra de la pared, con sus vetas
          const d = d0 + rnd() * (d1 - d0), r = radioA(d) * Rb, a = rnd() * 6.2832;
          g.fillStyle = col(150, 120, 88, luzA(d) * (0.8 + rnd() * 0.4), 0.6); g.beginPath(); g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.5 + rnd() * 2, 0.8, a + 1.57, 0, 6.2832); g.fill();
        }
      }
    };
    for (let i = 0; i < Math.ceil(cav); i++) capa(i, Math.min(cav, i + 1), i < rev);
    // el fondo: tierra húmeda o, con agua, el agua oscura con su brillo
    const rf = radioA(cav) * Rb, l = luzA(cav);
    g.fillStyle = agua ? col(40, 52, 56, 1) : col(84, 66, 48, l); g.beginPath(); g.arc(c, c, rf, 0, 6.2832); g.fill();
    if (agua) {   // el agua: oscura, con el cielo reflejado suave hacia un lado (sin brillo de dibujo)
      const ag = g.createRadialGradient(c - rf * 0.3, c - rf * 0.35, 0, c, c, rf);
      ag.addColorStop(0, 'rgba(120,140,148,0.45)'); ag.addColorStop(0.6, 'rgba(60,76,82,0.2)'); ag.addColorStop(1, 'rgba(20,26,28,0)');
      g.fillStyle = ag; g.beginPath(); g.arc(c, c, rf, 0, 6.2832); g.fill();
    }
    // la sombra de la boca sobre la pared de abajo (el sol, de arriba y de lado)
    const sg = g.createRadialGradient(c - Rb * 0.25, c - Rb * 0.25, Rb * 0.2, c, c, Rb);
    sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = sg; g.beginPath(); g.arc(c, c, Rb, 0, 6.2832); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texturas.set(k, t);
  if (texturas.size > 64) { const [k0, t0] = texturas.entries().next().value; t0.dispose(); texturas.delete(k0); }
  return t;
}
const matsBoca = new Map();
function matBoca(tex) {
  if (!matsBoca.has(tex)) matsBoca.set(tex, new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  return matsBoca.get(tex);
}

// El disco de la boca, pegado al suelo (anillos de vértices a la altura de cada punto)
function discoBoca(x, z, sueloEn) {
  const nr = 6, na = 32, pos = [], uv = [], idx = [];
  pos.push(x, sueloEn(x, z) + SOBRE, z); uv.push(0.5, 0.5);
  for (let i = 1; i <= nr; i++) for (let j = 0; j < na; j++) {
    const r = R_DISCO * i / nr, a = j / na * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    pos.push(px, sueloEn(px, pz) + SOBRE, pz); uv.push(0.5 + Math.cos(a) * 0.5 * i / nr, 0.5 - Math.sin(a) * 0.5 * i / nr);
  }
  for (let j = 0; j < na; j++) idx.push(0, 1 + (j + 1) % na, 1 + j);
  for (let i = 1; i < nr; i++) for (let j = 0; j < na; j++) {
    const a = 1 + (i - 1) * na + j, b = 1 + (i - 1) * na + (j + 1) % na, c = a + na, d = b + na;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Una piedra de laja, baja y desigual (un icosaedro aplastado y deformado según su semilla)
function piedra(sd, ancho, alto) {
  const g = new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed(), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.8 + 0.4 * az(sd + p.getX(i) * 3 + p.getZ(i) * 5, i % 3);
    p.setXYZ(i, p.getX(i) * ancho * k, p.getY(i) * alto * k, p.getZ(i) * ancho * (0.7 + 0.3 * k));
  }
  g.computeVertexNormals();
  return g;
}

// Un montón de tierra suelta, del volumen v (m³), a la altura del suelo: perfil de tierra echada a paladas (alto en
// medio y bajando suave hasta el pie, que se pierde en la hierba), el borde desigual y lomos y terrones encima.
// Con alto h = 0,5·a y el perfil (1 − s²)², el volumen es π·a²·h/3.
function monton(v, sd) {
  const a = Math.cbrt(v / (Math.PI * 0.5 / 3)), h = 0.5 * a;
  const g = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), an = Math.atan2(z, x);
    const s = Math.acos(Math.min(1, Math.max(-1, y))) / (Math.PI / 2);   // 0 arriba, 1 al pie
    const borde = 1 + 0.12 * Math.sin(an * 3 + sd) + 0.06 * Math.sin(an * 5 + sd * 3);
    const lomos = 1 + 0.12 * Math.sin(x * 4.1 + sd) * Math.cos(z * 3.7 + sd * 2) + 0.06 * Math.sin(x * 9.3 + z * 7.1 + sd);
    const r = s * a * borde, alto = h * Math.pow(1 - s * s, 2) * lomos;
    p.setXYZ(i, Math.cos(an) * r, alto - 0.03, Math.sin(an) * r * 0.85);
  }
  g.computeVertexNormals();
  return { geo: g, a };
}

export function crearPozosVista({ escena, sueloEn }) {
  const raiz = new THREE.Group();
  raiz.name = 'pozos';
  escena.add(raiz);
  const vaciar = () => { for (const o of raiz.children) if (o.isMesh) o.geometry.dispose(); raiz.clear(); };

  function poner(pozos) {
    vaciar();
    if (!pozos || !pozos.length) return;
    const L = new Lote({ rangoSuelo: 0.25, variacion: 0.08 });
    for (const p of pozos) {
      const y = sueloEn(p.x, p.z), giro = (p.id * 2.399) % 6.2832;
      // la boca pintada
      const tex = texturaBoca(p);
      if (tex) { const m = new THREE.Mesh(discoBoca(p.x, p.z, sueloEn), matBoca(tex)); m.receiveShadow = true; m.renderOrder = 1; m.name = 'boca_pozo'; m.userData.pozo = p.id; raiz.add(m); }
      // la estaca del sitio, clavada al lado de la boca hasta que se empieza a cavar
      if (!p.cavados && !p.golpes) { const ex = p.x + Math.cos(giro) * (R_BOCA + 0.15), ez = p.z + Math.sin(giro) * (R_BOCA + 0.15); estacaEn(L, ex, sueloEn(ex, ez) - 0.25, ez, { y: giro, x: 0.06 }, 'pozo' + p.id, 1.7, 1.2, 1.4); }
      // la hilada de arriba: un anillo de piedras a ras de suelo en cuanto está revestido el primer tramo
      if (p.revestidos > 0) {
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + az(p.id, i) * 0.1, r = R_BOCA + 0.09, px = p.x + Math.cos(a) * r, pz = p.z + Math.sin(a) * r;
          L.add(piedra(p.id * 31 + i, 0.27, 0.13), az(p.id, i + 50) < 0.5 ? 'piedra' : 'piedraOsc', px, sueloEn(px, pz) + 0.02, pz, { y: -a + Math.PI / 2 }, { tex: 'piedra', plano: true, sinSuelo: true });
        }
      }
      // el brocal (P11b, El pozo (3)): las hiladas de piedra seca, la de abajo primero, en proporción a lo puesto
      const vistas = Math.round(Math.min(1, (p.brocal || 0) / PIEDRAS_BROCAL) * HILADAS_BROCAL * POR_HILADA);
      for (let i = 0; i < vistas; i++) {
        const h = Math.floor(i / POR_HILADA), j = i % POR_HILADA;
        const a = (j + (h % 2) * 0.5) / POR_HILADA * Math.PI * 2 + az(p.id, i + 90) * 0.12, r = R_BOCA + 0.1 - h * 0.012, px = p.x + Math.cos(a) * r, pz = p.z + Math.sin(a) * r;
        const lo = 0.29 + az(p.id, i + 120) * 0.06, al = ALTO_HILADA * (0.95 + az(p.id, i + 150) * 0.2);
        L.add(piedra(p.id * 41 + i, lo, al), az(p.id, i + 70) < 0.55 ? 'piedra' : 'piedraOsc', px, y + 0.03 + h * ALTO_HILADA + al * 0.45, pz, { y: -a + Math.PI / 2 }, { tex: 'piedra', plano: true, sinSuelo: true });
      }
      // el travesaño: dos varas de pies hincadas fuera del brocal, una atravesada encima y la cuerda al agua
      if (p.travesano) {
        const ap = giro + Math.PI / 2, rp = R_BOCA + 0.36, alto = ALTO_TRAVESANO;
        for (const sg of [-1, 1]) {
          const px = p.x + Math.cos(ap) * rp * sg, pz = p.z + Math.sin(ap) * rp * sg, yp = sueloEn(px, pz);
          L.add(cil(0.034, 0.04, alto + 0.25), 'corteza', px, yp - 0.25 + (alto + 0.25) / 2, pz, { z: sg * 0.03 }, { tex: 'corteza', sinSuelo: true });
          L.add(new THREE.CircleGeometry(0.034, 7).rotateX(-Math.PI / 2), 'corte', px, yp + alto + 0.001, pz, null, { sinSuelo: true });
        }
        // la atravesada, apoyada sobre las cabezas de los pies y atada con la cuerda
        const largo = rp * 2 + 0.3, yt = y + alto + 0.03;
        L.add(cil(0.03, 0.03, largo), 'corteza', p.x, yt, p.z, { z: Math.PI / 2, y: -ap }, { tex: 'corteza', sinSuelo: true });
        for (const sg of [-1, 1]) { const px = p.x + Math.cos(ap) * rp * sg, pz = p.z + Math.sin(ap) * rp * sg; L.add(new THREE.TorusGeometry(0.04, 0.009, 4, 10), 0x9b8460, px, yt - 0.02, pz, { y: -ap + Math.PI / 2 }, { tex: 'liso', sinSuelo: true }); }
        // la cuerda: dos vueltas al travesaño en el medio y baja recta al agua
        L.add(new THREE.TorusGeometry(0.036, 0.01, 4, 10), 0x9b8460, p.x, yt, p.z, { y: -ap + Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
        L.add(new THREE.TorusGeometry(0.036, 0.01, 4, 10), 0x9b8460, p.x + Math.cos(ap) * 0.03, yt, p.z + Math.sin(ap) * 0.03, { y: -ap + Math.PI / 2 }, { tex: 'liso', sinSuelo: true });
        const baja = alto + 0.2;
        L.add(cil(0.008, 0.008, baja, 5), 0x9b8460, p.x, yt - baja / 2, p.z, null, { tex: 'liso', sinSuelo: true });
      }
      // el montón de tierra sacada, al lado (del lado de la estaca)
      // (echada a paladas a un lado y, con lo hondo, repartida en dos o tres montones alrededor de ese lado)
      // (lo que pase de MAX_TIERRA se da por esparcido o llevado: un montón de 10 m³ taparía el pozo y medio prado)
      const v = Math.min(MAX_TIERRA, tierraSacada(p) * ESPONJA + (p.golpes || 0) / 10 * 0.11);
      if (v > 0.01) {
        const n = v < 0.9 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const vk = v * (k ? 0.35 : 1 - 0.35 * (n - 1)), ak = giro + (k === 0 ? 0 : 1.15);
          const { geo, a } = monton(vk, p.id * 3 + k), d = R_DISCO + 0.1 + a * 0.8, mx = p.x + Math.cos(ak) * d, mz = p.z + Math.sin(ak) * d;
          L.add(geo, 0x75644f, mx, Math.min(sueloEn(mx, mz), y), mz, { y: -ak }, { tex: 'piedra', sinSuelo: true, brillo: 0.95 });
          // terrones sueltos rodados al pie
          for (let t = 0; t < 6; t++) {
            const at = ak + (az(p.id * 7 + k, t) - 0.5) * 2.2, rt = d + a * (0.85 + az(p.id + k, t + 9) * 0.35), tx = p.x + Math.cos(at) * rt, tz = p.z + Math.sin(at) * rt;
            L.add(piedra(p.id * 53 + k * 7 + t, 0.07 + az(k, t) * 0.06, 0.05), 0x6e5c48, tx, sueloEn(tx, tz) + 0.01, tz, { y: t }, { tex: 'piedra', sinSuelo: true });
          }
        }
      }
      // las piedras ya puestas del tramo que se está revistiendo, en un montoncito junto a la boca
      for (let i = 0; i < (p.piedras || 0); i++) {
        const a = giro + Math.PI + 0.6 + (i % 4) * 0.22, r = R_DISCO + 0.15 + Math.floor(i / 4) * 0.2, px = p.x + Math.cos(a) * r, pz = p.z + Math.sin(a) * r;
        L.add(piedra(p.id * 17 + i, 0.24, 0.16), 'piedra', px, sueloEn(px, pz) + 0.05 + Math.floor(i / 4) * 0.06, pz, { y: i * 1.3 }, { tex: 'piedra', plano: true, sinSuelo: true });
      }
    }
    for (const [tex, geos] of Object.entries(L.cerrar(null, true))) {
      const m = new THREE.Mesh(mergeGeometries(geos), materialTex(tex)); m.castShadow = m.receiveShadow = true; raiz.add(m);
    }
  }
  return { poner, raiz };
}
