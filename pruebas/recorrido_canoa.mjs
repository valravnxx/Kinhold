// Recorrido de jugador de la canoa (P11d, «Recorrido de jugador de la canoa, sin arcón»): el paso 26 de
// pruebas/prueba_recorrido.mjs, el mismo jugador, sin arcón y con lo que recoge. Trenza una cuerda en su banco de tronco
// (3 cordeles de 3 de fibra), va a su hoguera de la orilla del río (la del paso 11) con el hacha y la cuerda, tala un
// árbol adulto, ata el tronco largo con la cuerda y lo arrastra junto a la hoguera; con el hacha lo desbasta y, con las
// brasas de la hoguera (que vuelve a encender si se ha apagado), lo vacía en tres vueltas de brasas y raspado; ata la
// canoa y la arrastra hasta el agua. Vuelve al banco, se hace el remo de un tronco corto (de un tronco largo que tronza)
// y, con el remo en la mano, echa la canoa al agua, sube, rema río arriba y río abajo (más deprisa que corriendo: el
// servidor se lo deja), la deja ir a la deriva con la corriente y la vara en la orilla, donde se queda.
// Cadena: canoa ← tronco largo ← árbol adulto (hacha de piedra ← la piedra de tallar); brasas ← la hoguera (yesca y
// taladro de fuego, ramas); cuerda ← 3 cordeles ← 9 de fibra; remo ← tronco corto ← tronzar el tronco largo; banco.
// Para trabajar en esta parte sin repetir lo de antes: KINHOLD_RECORRIDO_GUARDAR=<carpeta> node pruebas/prueba_recorrido.mjs
// guarda el mundo antes del pozo; KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_canoa.mjs sigue desde ahí con la
// canoa (sin el pozo, la granja ni la casa más fuerte). Con MUTAR=1 además, remar no va más deprisa que correr (el
// servidor no se lo deja): debe FALLAR.
// Decisiones provisionales (anotadas en el diario):
//  - La canoa se vacía junto a la hoguera de la orilla del paso 11 (las brasas, de un fuego a 6 m como mucho): el
//    tronco largo se arrastra hasta ella. Las brasas arden sus 10 minutos de reloj: la prueba adelanta la hora a la que
//    se consumen las que echó este jugador (como lo que se fabrica), en vez de esperarla. No le da nada.
//  - Rema como el navegador (src/juego/main.js, pasoCanoa): cada 100 ms, con velocidadCanoa, por donde flota; río
//    arriba y río abajo, siguiendo el cauce (el agua más honda hacia donde va).
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { vegetacionEn } from '../src/logica/vegetacion.js';
import { idArbol } from '../src/logica/tala.js';
import { hayAguaCerca } from '../src/logica/necesidades.js';
import { campoEn } from '../src/logica/campos.js';
import { VIDA as VIDA_DESGASTE } from '../src/logica/desgaste.js';
import { DETRAS_TRONCO } from '../src/logica/rastra.js';
import { vivo } from '../src/logica/fuego.js';
import { velocidadCanoa, remoEnMano, HONDO_FLOTA, HONDO_BAJAR, ALCANCE_FUEGO, VEL_REMAR } from '../src/logica/canoa.js';
import { VEL_MAX } from '../src/logica/presencia.js';

const MANOS = ['mano:der', 'mano:izq'];
// Con MUTAR=1 (solo al seguir desde lo guardado) el servidor no deja ir en canoa más deprisa que andando: debe FALLAR.
const MUTAR = process.env.MUTAR === '1' && !!process.env.KINHOLD_RECORRIDO_DESDE;

export async function canoa({ J, s, T, O, comprobar, pausa, cerca }) {
  const yo = J.bienvenida.autor;
  const inicio = { ...J.pos };
  const r2 = v => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const enMano = () => MANOS.map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
  const enLaMano = (tipo) => MANOS.find(l => J.inv.lugares[l]?.tipo === tipo);
  const soltar = (l) => J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
  const soltarManos = async (salvo = []) => { for (const l of MANOS) if (J.inv.lugares[l] && !salvo.includes(J.inv.lugares[l].tipo)) await soltar(l); };
  const adelantar = () => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola || [])]) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1); };
  const visibles = () => s.objetos.sueloVisible(Date.now());
  const enSuelo = (tipo, p, d = 3) => cerca(visibles().filter(o => o.cosa.tipo === tipo && !o.arrastra && dist(o, p) < d), p);
  const nEnSuelo = (tipo, p, d = 3) => enSuelo(tipo, p, d).reduce((t, o) => t + o.cosa.n, 0);
  const porId = (id) => visibles().find(o => o.id === id);
  const probados = new Set();
  const alrededor = (p, d) => recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - d, z0: O.z + p.z - d, x1: O.x + p.x + d, z1: O.z + p.z + d })
    .map(q => ({ id: q.id, tipo: q.tipo, x: r2(q.x - O.x), z: r2(q.z - O.z) }));
  const recoger = async (p) => { await J.andar(p.x + 0.4, p.z); return J.objeto({ tipo: 'recoger', punto: p.id, x: J.pos.x, z: J.pos.z, px: p.x, pz: p.z, clase: p.tipo }); };
  const recogerCerca = async (tipos, n, cuenta, radios = [150, 400, 900]) => {
    const aqui = { ...J.pos };
    for (const radio of radios) {
      if (J.cuantos(cuenta) >= n) break;
      const lista = alrededor(aqui, radio).filter(q => tipos.includes(q.tipo));
      for (let k = 0; k < 40 && J.cuantos(cuenta) < n; k++) { const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0]; if (!p) break; probados.add(p.id); await recoger(p); }
    }
    await J.andar(aqui.x, aqui.z);
    return J.cuantos(cuenta) >= n;
  };
  const cogerSuelo = async (tipo, p, d = 3, cantidad, a) => {
    for (const o of enSuelo(tipo, p, d)) {
      const libre = a || MANOS.find(l => !J.inv.lugares[l]) || MANOS.find(l => J.inv.lugares[l]?.tipo === tipo);
      if (!libre) return false;
      await J.andar(o.x + 0.3, o.z);
      const q = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, ...(cantidad ? { cantidad: Math.min(cantidad - J.cuantos(tipo), o.cosa.n) } : {}), a: libre, x: J.pos.x, z: J.pos.z });
      if (q.ok && (!cantidad || J.cuantos(tipo) >= cantidad)) return true;
    }
    return cantidad ? J.cuantos(tipo) >= cantidad : J.cuantos(tipo) > 0;
  };
  const aLaMano = async (tipo, donde, d = 3) => {
    if (enLaMano(tipo)) return true;
    if (!J.cuantos(tipo) && donde) { await cogerSuelo(tipo, donde, d); if (enLaMano(tipo)) return true; }
    const ruta = J.inv.rutasCon(tipo)[0];
    if (!ruta) return false;
    let libre = MANOS.find(l => !J.inv.lugares[l]);
    if (!libre) { await soltar('mano:izq'); libre = 'mano:izq'; }
    const q = await J.objeto({ tipo: 'mover', de: ruta, a: libre });
    return q.ok && !!enLaMano(tipo);
  };
  const deMano = async (receta) => {
    const f = await J.objeto({ tipo: 'fabricar', receta, x: J.pos.x, z: J.pos.z });
    adelantar();
    const g = f.ok ? await J.objeto({ tipo: 'recoger_fabricado', x: J.pos.x, z: J.pos.z }) : f;
    return { ok: f.ok && g.ok, motivo: f.motivo || g.motivo, datos: g.datos };
  };
  const depositar = async (est, tipo, cantidad = 1) => {
    const l = J.inv.rutasCon(tipo)[0];
    return l ? J.objeto({ tipo: 'depositar_estacion', estacion: est.id, de: l, cantidad, x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: `no lleva ${tipo}` };
  };
  const enEstacion = async (est, receta) => {
    const f = await J.objeto({ tipo: 'fabricar', receta, estacion: est.id, x: J.pos.x, z: J.pos.z });
    adelantar();
    const g = f.ok ? await J.objeto({ tipo: 'recoger_fabricado', estacion: est.id, x: J.pos.x, z: J.pos.z }) : f;
    return { ok: f.ok && g.ok, motivo: f.motivo || g.motivo, datos: g.datos };
  };
  const suyas = (tipo) => Object.values(s.objetos.fab.estaciones).filter(e => e.autor === yo && e.tipo === tipo && !e.obra);
  const M = s.mundo.mojonDe(yo);
  const banco = M && cerca(suyas('banco_tronco'), M)[0];
  // su hoguera de la orilla (la del paso 11): la suya más cerca del agua
  const aguaA = (p) => { for (let d = 1; d <= 12; d += 1) for (let k = 0; k < 16; k++) if (T.aguaEn(p.x + Math.cos(k / 16 * 6.283) * d, p.z + Math.sin(k / 16 * 6.283) * d) >= 0.3) return d; return Infinity; };
  const hog = suyas('hoguera').map(e => ({ e, d: aguaA(e) })).sort((a, b) => a.d - b.d)[0]?.e;
  console.log('26. La canoa (P11d): una cuerda, tala un adulto junto a su hoguera de la orilla, vacía el tronco con el hacha y las brasas, se hace el remo, y rema río arriba y río abajo, a la deriva y la vara en la orilla');
  comprobar('26. tiene su tierra, su banco de tronco y su hoguera de la orilla', !!M && !!banco && !!hog, JSON.stringify({ M, banco: banco && [banco.x, banco.z], hoguera: hog && [hog.x, hog.z, aguaA(hog)] }));
  if (!M || !banco || !hog) return;

  // (con sed, a beber al agua más cercana, y vuelta; con hambre, bayas o setas de por aquí)
  const nec = () => s.necesidades.get(yo) || { sed: 0, hambre: 0 };
  const cuidarse = async () => {
    const desde = { ...J.pos };
    if (nec().sed > 45) {
      let agua = null;
      for (let d = 5; d <= 1500 && !agua; d += 5) for (let k = 0; k < 48 && !agua; k++) {
        const x = desde.x + Math.cos(k / 48 * 2 * Math.PI) * d, z = desde.z + Math.sin(k / 48 * 2 * Math.PI) * d;
        if (!T.aguaEn(x, z) && hayAguaCerca(T.aguaEn, x, z) && !T.marEn(x + 1, z) && !T.marEn(x - 1, z) && !T.marEn(x, z + 1) && !T.marEn(x, z - 1)) agua = { x: r2(x), z: r2(z) };
      }
      if (agua) { await J.andar(agua.x, agua.z); for (let i = 0; i < 10 && nec().sed > 10; i++) { await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z }); await pausa(1600); } }
    }
    if (nec().hambre > 60) {
      for (const m of cerca(alrededor(J.pos, 200).filter(p => (p.tipo === 'bayas' || p.tipo === 'setas') && !probados.has(p.id)), J.pos).slice(0, 16)) {
        if (nec().hambre <= 40) break;
        if (MANOS.every(l => J.inv.lugares[l])) await soltarManos();
        probados.add(m.id);
        const rb = await recoger(m);
        if (rb.ok) { const tipo = m.tipo === 'bayas' ? 'bayas' : 'setas'; for (let i = 0; i < 6 && J.cuantos(tipo) && nec().hambre > 20; i++) await J.objeto({ tipo: 'comer', objeto: tipo }); }
      }
    }
    if (dist(J.pos, desde) > 1) await J.andar(desde.x, desde.z);
  };
  const secoHasta = (p, q) => { const n = Math.ceil(dist(p, q)); for (let i = 0; i <= n; i++) if (T.aguaEn(p.x + (q.x - p.x) * i / n, p.z + (q.z - p.z) * i / n)) return false; return true; };
  // el hacha: a la mano (de lo que lleva o del suelo), y reparada en su piedra de tallar si no le quedan golpes
  const resto = () => { const l = MANOS.find(x => s.objetos.invs.de(yo).lugares[x]?.tipo === 'hacha_piedra'); return l ? VIDA_DESGASTE.hacha_piedra - (s.objetos.invs.de(yo).lugares[l].usado || 0) : 0; };
  const hachaALaMano = async () => {
    await pausa(800);
    if (await aLaMano('hacha_piedra')) return true;
    if (!(await cogerSuelo('hacha_piedra', J.pos, 15)) && !(await cogerSuelo('hacha_piedra', banco, 40))) await cogerSuelo('hacha_piedra', M, 400);
    await pausa(800);
    return aLaMano('hacha_piedra');
  };
  const repararHacha = async (necesita) => {
    const tallar = cerca(suyas('piedra_tallar'), banco)[0];
    for (let k = 0; k < 3 && enLaMano('hacha_piedra') && tallar && resto() < necesita; k++) {
      const lh = enLaMano('hacha_piedra'), otra = MANOS.find(x => x !== lh);
      if (J.inv.lugares[otra]) await soltar(otra);
      const volver = { ...J.pos };
      await recogerCerca(['ortiga', 'hierba_larga'], 3, 'fibra', [250, 500, 900]);
      const lf = enLaMano('fibra'); if (lf) await soltar(lf);
      const c = await deMano('cordel');
      await J.andar(tallar.x + 1, tallar.z);
      const d = c.ok ? await depositar(tallar, 'cordel') : c;
      const antes = resto();
      const rp = d.ok ? await J.objeto({ tipo: 'reparar', estacion: tallar.id, de: enLaMano('hacha_piedra'), x: J.pos.x, z: J.pos.z }) : d;
      console.log(`     (repara el hacha en su piedra de tallar: le quedaban ${antes} golpes, ahora ${resto()}${rp.ok ? '' : ' · ' + rp.motivo})`);
      await J.andar(volver.x, volver.z);
      if (!rp.ok) break;
    }
  };
  const talarAdulto = async (p) => {
    await soltarManos(['hacha_piedra']);
    if (!(await hachaALaMano())) return { ok: false, motivo: `no encuentra su hacha (en las manos ${enMano()})` };
    await repararHacha(80);
    const arboles = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - 200, z0: O.z + p.z - 200, x1: O.x + p.x + 200, z1: O.z + p.z + 200 }).arboles
      .map(a => ({ x: a.x - O.x, z: a.z - O.z, edad: a.edad })).map(a => ({ ...a, id: idArbol(a.x, a.z) }))
      .filter(a => a.edad === 'adulto' && !s.objetos.tala.estado[a.id] && !campoEn(s.mundo, a.x, a.z) && aguaA(a) > 3 && secoHasta(p, a) && !s.mundo.construcciones.some(c => [...c.piezas.values()].length && dist({ x: c.ox, z: c.oz }, a) < 12));
    const a = cerca(arboles, p)[0];
    if (!a) return { ok: false, motivo: 'no hay árboles adultos cerca' };
    await J.andar(a.x + 1, a.z);
    let t, g = 0;
    do { t = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); g++; if (t.ok && t.datos.boca !== undefined) { await J.andar(a.x, a.z + 1); await J.andar(a.x - 1, a.z); } if (t.ok && !t.datos.cae) await pausa(550); } while (t.ok && !t.datos.cae && g < 200);
    if (!t.ok || !t.datos.cae) return { ok: false, motivo: `no lo tala: ${t.motivo || g + ' golpes'} (en las manos ${enMano()})` };
    await pausa(550);
    let l, gl = 0;
    do { l = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); gl++; if (l.ok && !l.datos.limpio) await pausa(550); } while (l.ok && !l.datos.limpio && gl < 60);
    if (!l.ok || !l.datos.limpio) return { ok: false, motivo: `no lo limpia: ${l.motivo || gl + ' golpes'}` };
    const largo = enSuelo('tronco_largo', a, 8)[0];
    return largo ? { ok: true, a, largo, golpes: g + gl } : { ok: false, motivo: 'no ha dejado tronco largo' };
  };
  // tirar de lo atado con la cuerda hasta (x, z) y soltarlo detrás
  const arrastrar = async (id, x, z) => {
    const p0 = { ...J.pos }, d = Math.max(0.01, Math.hypot(x - p0.x, z - p0.z));
    await J.andar(x, z);
    return J.objeto({ tipo: 'soltar_tronco', x: J.pos.x, z: J.pos.z, rx: r2(J.pos.x - (x - p0.x) / d * DETRAS_TRONCO), rz: r2(J.pos.z - (z - p0.z) / d * DETRAS_TRONCO) });
  };

  let taller = null;
  for (let d = 2; d <= 8 && !taller; d += 1) for (let k = 0; k < 12 && !taller; k++) {
    const x = r2(banco.x + Math.cos(k / 12 * 6.283) * d), z = r2(banco.z + Math.sin(k / 12 * 6.283) * d);
    if (!visibles().some(o => dist(o, { x, z }) < 3.5) && s.mundo.dentroDeTierra(x, z, yo)) taller = { x, z };
  }
  taller = taller || { x: r2(banco.x - 1.5), z: r2(banco.z + 1.5) };

  console.log('26a. Trenza una cuerda en su banco (3 cordeles de 3 de fibra)');
  await cuidarse();
  // (el hacha, a sus pies junto al banco mientras trenza)
  await J.andar(taller.x, taller.z); await soltarManos();
  const motivos = [];
  let ok = true;
  for (let k = 0; ok && k < 3; k++) {
    for (const l of MANOS) if (J.inv.lugares[l] && J.inv.lugares[l].tipo !== 'fibra') await soltar(l);
    const f = await recogerCerca(['ortiga', 'hierba_larga'], 3, 'fibra', [300, 600, 900]);
    const c = f ? await deMano('cordel') : { ok: false, motivo: `no junta 3 de fibra (lleva ${J.cuantos('fibra')})` };
    await J.andar(banco.x + 1, banco.z);
    const d = c.ok ? await depositar(banco, 'cordel') : c;
    ok = c.ok && d.ok; if (!ok) motivos.push(c.motivo || d.motivo);
    await J.andar(taller.x, taller.z);
  }
  await J.andar(banco.x + 1, banco.z);
  let q = ok ? await enEstacion(banco, 'cuerda') : { ok: false, motivo: motivos.join(' | ') };
  comprobar('hace 3 cordeles y trenza en el banco una cuerda', q.ok && J.cuantos('cuerda') >= 1, `${q.motivo || ''} · ${enMano()}`);
  if (!J.cuantos('cuerda')) return;

  console.log('26b. Con el hacha y la cuerda, a su hoguera de la orilla: tala un adulto y arrastra el tronco largo junto a ella');
  await J.andar(taller.x, taller.z);
  const lc = enLaMano('cuerda'); if (lc) await soltar(lc);
  await hachaALaMano();
  // (el sitio de vaciarla: junto a la hoguera, a 4 m, en seco y hacia el agua)
  const haciaAgua = (() => { for (let d = 1; d <= 12; d += 1) for (let k = 0; k < 16; k++) { const x = hog.x + Math.cos(k / 16 * 6.283) * d, z = hog.z + Math.sin(k / 16 * 6.283) * d; if (T.aguaEn(x, z) >= 0.3) return { x: (x - hog.x) / d, z: (z - hog.z) / d }; } return { x: 1, z: 0 }; })();
  let sitio = null;
  for (let d = 3.5; d <= ALCANCE_FUEGO - 1.5 && !sitio; d += 0.5) for (const giro of [Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75, Math.PI]) {
    const x = r2(hog.x + (haciaAgua.x * Math.cos(giro) - haciaAgua.z * Math.sin(giro)) * d), z = r2(hog.z + (haciaAgua.x * Math.sin(giro) + haciaAgua.z * Math.cos(giro)) * d);
    if (!T.aguaEn(x, z) && !T.aguaEn(x + 2, z) && !T.aguaEn(x - 2, z) && !T.aguaEn(x, z + 2) && !T.aguaEn(x, z - 2) && !visibles().some(o => dist(o, { x, z }) < 2.5)) { sitio = { x, z }; break; }
  }
  sitio = sitio || { x: r2(hog.x - haciaAgua.x * 4), z: r2(hog.z - haciaAgua.z * 4) };
  await J.andar(hog.x - haciaAgua.x * 2, hog.z - haciaAgua.z * 2);
  await cuidarse();
  const ad = await talarAdulto(sitio);
  let largo = ad.ok ? ad.largo : null;
  comprobar('tala con su hacha de piedra un árbol adulto cerca de su hoguera de la orilla: le deja un tronco largo', !!largo, `${ad.motivo || ''} ${ad.golpes || ''} golpes${largo ? ` · a ${Math.round(dist(largo, hog))} m de la hoguera` : ''}`);
  if (!largo) return;
  const hachaTala = { ...J.pos };
  const lh = enLaMano('hacha_piedra'); if (lh) await soltar(lh);
  await J.andar(taller.x, taller.z);
  await aLaMano('cuerda', taller);
  await J.andar(largo.x + 1, largo.z);
  q = await J.objeto({ tipo: 'atar_tronco', objeto: largo.id, x: J.pos.x, z: J.pos.z });
  const atado = q.ok && porId(largo.id)?.arrastra === yo;
  // (pasa por el sitio y sigue 2 m: el tronco queda detrás, en el sitio)
  const dS = Math.max(0.1, dist(largo, sitio)), pasada = { x: r2(sitio.x + (sitio.x - largo.x) / dS * DETRAS_TRONCO), z: r2(sitio.z + (sitio.z - largo.z) / dS * DETRAS_TRONCO) };
  let q3 = atado ? await arrastrar(largo.id, pasada.x, pasada.z) : q;
  largo = porId(largo.id);
  comprobar('vuelve al banco a por la cuerda, ata el tronco largo y lo arrastra junto a la hoguera', atado && q3.ok && !!largo && !largo.arrastra && dist(largo, hog) <= ALCANCE_FUEGO + 2, `${q.motivo || ''} ${q3.motivo || ''} el tronco, a ${largo && Math.round(dist(largo, hog) * 10) / 10} m de la hoguera`);
  if (!largo) return;
  const cuerdaAqui = { ...J.pos };
  await soltarManos();

  console.log('26c. Lo vacía: lo desbasta con el hacha, y tres vueltas de brasas de la hoguera y raspar lo quemado');
  const H = () => s.objetos.fab.estaciones[hog.id];
  // la hoguera, ardiendo: le echa ramas y, si se ha apagado, la enciende con su yesca y su taladro de fuego
  const avivar = async () => {
    const volver = { ...J.pos };
    await soltarManos();
    if (J.cuantos('rama') < 2) await recogerCerca(['ramas'], 2, 'rama', [100, 300, 700]);
    await J.andar(hog.x + 1, hog.z);
    let r = { ok: true };
    for (let k = 0; k < 3 && J.cuantos('rama'); k++) r = await J.objeto({ tipo: 'echar_fuego', estacion: hog.id, objeto: 'rama', x: J.pos.x, z: J.pos.z });
    if (!vivo(H().fuego, Date.now())) {
      await soltarManos();
      for (const t of ['taladro_fuego', 'yesca']) if (!J.cuantos(t)) { await cogerSuelo(t, hog, 30) || await cogerSuelo(t, M, 400); await J.andar(hog.x + 1, hog.z); }
      if (!J.cuantos('yesca')) { await soltarManos(['taladro_fuego']); if (!(await recogerCerca(['yesquero'], 1, 'yesca', [200, 500]))) { await recogerCerca(['ortiga', 'hierba_larga'], 2, 'fibra'); await deMano('yesca'); } }
      if (!J.cuantos('taladro_fuego')) {
        await soltarManos(['yesca']);
        const lyes = enLaMano('yesca'); const yesAqui = { ...J.pos }; if (lyes) await soltar(lyes);
        await recogerCerca(['ortiga', 'hierba_larga'], 3, 'fibra'); await deMano('cordel');
        const lcor = enLaMano('cordel'); if (lcor) await soltar(lcor);
        await recogerCerca(['ramas'], 2, 'rama');
        await cogerSuelo('cordel', J.pos, 3);
        await deMano('taladro_fuego');
        await cogerSuelo('yesca', yesAqui, 3);
      }
      await J.andar(hog.x + 1, hog.z);
      r = await J.objeto({ tipo: 'encender_fuego', estacion: hog.id, x: J.pos.x, z: J.pos.z });
      console.log(`     (la hoguera se había apagado: la vuelve a encender con su yesca y su taladro${r.ok ? '' : ' · ' + r.motivo})`);
    }
    await J.andar(volver.x, volver.z);
    return { ok: vivo(H().fuego, Date.now()), motivo: r.motivo };
  };
  const junto = { x: r2(largo.x + (hog.x - largo.x) / Math.max(0.1, dist(largo, hog)) * 1.2), z: r2(largo.z + (hog.z - largo.z) / Math.max(0.1, dist(largo, hog)) * 1.2) };
  let rf = await avivar();
  comprobar('su hoguera de la orilla arde (le echa ramas y, si se ha apagado, la enciende)', rf.ok, rf.motivo);
  await J.andar(hachaTala.x, hachaTala.z); await hachaALaMano();
  await repararHacha(100);
  await J.andar(junto.x, junto.z);
  let id = largo.id, golpes = 0, brasas = 0, v = { ok: true }, fases = [];
  for (let n = 0; n < 400 && v.ok && !v.canoa; n++) {
    v = await J.objeto({ tipo: 'vaciar', objeto: id, x: J.pos.x, z: J.pos.z });
    if (!v.ok && /hoguera/.test(v.motivo || '')) { await avivar(); v = await J.objeto({ tipo: 'vaciar', objeto: id, x: J.pos.x, z: J.pos.z }); }
    if (!v.ok && /hacha/.test(v.motivo || '')) { await hachaALaMano(); v = await J.objeto({ tipo: 'vaciar', objeto: id, x: J.pos.x, z: J.pos.z }); }
    if (!v.ok) break;
    if (v.datos?.objeto) id = v.datos.objeto;
    const paso = v.datos?.paso;
    if (fases[fases.length - 1] !== paso) fases.push(paso);
    if (paso === 'brasas') {
      brasas++;
      const espera = porId(id)?.cosa.vaciado?.hasta - Date.now();
      const r1 = await J.objeto({ tipo: 'vaciar', objeto: id, x: J.pos.x, z: J.pos.z });
      comprobar(`echa las brasas de la hoguera en el hueco (vuelta ${brasas}): arden ${Math.round(espera / 60000)} min, y mientras no se raspa`, !r1.ok && /brasas/.test(r1.motivo || '') && espera > 5 * 60000, r1.motivo);
      const o = porId(id); if (o?.cosa.vaciado?.fase === 'quemando') o.cosa.vaciado.hasta = Math.min(o.cosa.vaciado.hasta, Date.now() - 1);   // (sus 10 min, ya pasados)
    } else { golpes++; await pausa(850); }
    if (golpes % 25 === 0 && resto() < 25) await repararHacha(60);
  }
  let laCanoa = porId(id);
  comprobar('a golpes de hacha y con tres vueltas de brasas, el tronco largo queda hecho una canoa', !!v.ok && !!v.datos?.canoa && laCanoa?.cosa.tipo === 'canoa', `${golpes} golpes · ${brasas} vueltas de brasas · ${fases.join(' → ')} · ${v.motivo || ''}`);
  if (laCanoa?.cosa.tipo !== 'canoa') return;

  console.log('26d. Ata la canoa y la arrastra hasta el agua');
  const hachaVaciar = { ...J.pos };
  await soltarManos();
  await aLaMano('cuerda', cuerdaAqui, 6);
  // la orilla: lo seco más cerca del agua honda, hacia el agua desde la canoa
  let orilla = null, agua = null;
  for (let d = 1; d <= 20 && !orilla; d += 0.5) for (let k = 0; k < 32; k++) {
    const a = k / 32 * 6.283, x = laCanoa.x + Math.cos(a) * d, z = laCanoa.z + Math.sin(a) * d;
    if (T.aguaEn(x, z)) continue;
    const ax = x + Math.cos(a) * 2.5, az = z + Math.sin(a) * 2.5;
    if (T.aguaEn(ax, az) >= HONDO_FLOTA + 0.2) { orilla = { x: r2(x), z: r2(z), a }; agua = { x: r2(ax), z: r2(az) }; break; }
  }
  await J.andar(laCanoa.x + 1, laCanoa.z);
  q = orilla ? await J.objeto({ tipo: 'atar_tronco', objeto: laCanoa.id, x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: 'no hay agua honda cerca' };
  // (pasa a lo largo de la orilla, de modo que la canoa quede en lo seco, junto al agua)
  const lado = orilla && { x: r2(orilla.x - Math.sin(orilla.a) * DETRAS_TRONCO), z: r2(orilla.z + Math.cos(orilla.a) * DETRAS_TRONCO) };
  if (q.ok && lado) { await J.andar(orilla.x - Math.cos(orilla.a) * 1, orilla.z - Math.sin(orilla.a) * 1); q3 = await arrastrar(laCanoa.id, lado.x, lado.z); } else q3 = q;
  laCanoa = porId(laCanoa.id);
  comprobar('con la cuerda en la mano ata la canoa y la arrastra hasta la orilla', q.ok && q3.ok && !!laCanoa && !laCanoa.arrastra && !!agua && dist(laCanoa, agua) < 4.4, `${q.motivo || ''} ${q3.motivo || ''} · la canoa a ${laCanoa && agua && Math.round(dist(laCanoa, agua) * 10) / 10} m del agua honda`);
  if (!laCanoa) return;
  await soltarManos();

  console.log('26e. Vuelve al banco y se hace el remo de un tronco corto (tronza un tronco largo)');
  await J.andar(hachaVaciar.x, hachaVaciar.z); await hachaALaMano();
  await J.andar(banco.x + 1, banco.z);
  let corto = enSuelo('tronco_corto', banco, 40)[0];
  let tronza = '';
  if (!corto) {   // (los cortos que sobraron de la rodaja de la carretilla ya no están: tala otro adulto y lo tronza)
    const t2 = await talarAdulto(banco);
    if (t2.ok) {
      await J.andar(t2.largo.x + 0.5, t2.largo.z + 0.5);
      let g = 0, tz;
      do { tz = await J.objeto({ tipo: 'trocear', objeto: t2.largo.id, x: J.pos.x, z: J.pos.z }); g++; await pausa(850); } while (tz.ok && !enSuelo('tronco_corto', t2.largo, 5).length && g < 90);
      tronza = `tala un adulto y lo tronza en ${g} golpes`;
      corto = enSuelo('tronco_corto', t2.largo, 5)[0];
    } else tronza = t2.motivo;
  } else tronza = 'le sobraba uno de la rodaja';
  const hachaRemo = { ...J.pos };
  await soltarManos(['hacha_piedra']);
  const lhr = enLaMano('hacha_piedra'); if (lhr) await soltar(lhr);   // (el hacha, a sus pies: lleva el tronco al hombro)
  q = corto ? (await cogerSuelo('tronco_corto', corto, 3, 1, 'hombro')) : false;
  await J.andar(hachaRemo.x, hachaRemo.z); await hachaALaMano();
  await J.andar(banco.x + 1, banco.z);
  const dR = q ? await depositar(banco, 'tronco_corto') : { ok: false, motivo: `sin tronco corto (${tronza})` };
  q = dR.ok ? await enEstacion(banco, 'remo') : dR;
  comprobar('deja el tronco corto en el banco y, con el hacha, se hace el remo', q.ok && J.cuantos('remo') === 1, `${tronza} · ${q.motivo || ''} · ${enMano()}`);
  if (!J.cuantos('remo')) return;
  // a la mano el remo, y la otra libre (el hacha, en la cintura si cabe; si no, junto al banco)
  for (const l of MANOS) if (J.inv.lugares[l] && J.inv.lugares[l].tipo !== 'remo' && J.inv.lugares[l].tipo !== 'hacha_piedra') await soltar(l);
  await aLaMano('remo');
  const lhc = enLaMano('hacha_piedra');
  if (lhc && !(await J.objeto({ tipo: 'mover', de: lhc, a: 'cintura' })).ok) await soltar(lhc);

  console.log('26f. Con el remo en la mano, echa la canoa al agua, sube y rema río arriba y río abajo');
  await cuidarse();
  // el agua como la ve el navegador (src/mundo/mundo_juego.js, aguaEn): lo hondo y la corriente del río
  let rios = null;
  const aguaAqui = (x, z) => {
    const xm = x + O.x, zm = z + O.z;
    if (!rios || Math.hypot(xm - rios.x, zm - rios.z) > 300) rios = { x: xm, z: zm, tramos: T.paisaje.riosEn(xm - 900, zm - 900, xm + 900, zm + 900) };
    const suelo = T.alt(xm, zm), w = T.paisaje.agua(xm, zm, rios.tramos);
    if (w !== null && w > suelo) { const c = T.paisaje.corriente(xm, zm, rios.tramos); return { hondo: w - suelo, dx: c.dx * c.vel, dz: c.dy * c.vel, vel: c.vel }; }
    if (suelo < 0) return { hondo: -suelo, dx: 0, dz: 0, vel: 0, mar: true };
    return null;
  };
  const hondo = (x, z) => (aguaAqui(x, z)?.hondo || 0);
  const servidor = () => s.objetos.posicion(yo);
  const estar = (x, z) => { J.pos = { x, z }; J.ws.send(JSON.stringify({ tipo: 'estado', x, y: T.suelo(x, z), z, giro: 0, anim: 'sentado' })); };
  await J.andar(laCanoa.x + 1, laCanoa.z);
  // hasta dónde se empuja: lo más hondo (hasta 0,7 m) a 4,25 m como mucho, como el navegador
  let echarA = null, h0 = HONDO_FLOTA + 0.1;
  for (let d = 1.5; d <= 4.25; d += 0.5) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, x = laCanoa.x + Math.sin(a) * d, z = laCanoa.z + Math.cos(a) * d, h = Math.min(0.7, hondo(x, z)); if (h >= h0 + 0.01) { echarA = { x: r2(x), z: r2(z) }; h0 = h; } }
  q = echarA ? await J.objeto({ tipo: 'echar_canoa', objeto: laCanoa.id, x: J.pos.x, z: J.pos.z, rx: echarA.x, rz: echarA.z }) : { ok: false, motivo: 'no hay agua donde empujarla' };
  laCanoa = porId(laCanoa.id);
  comprobar('con el remo en una mano, empuja la canoa al agua: flota', q.ok && laCanoa?.agua === true, q.motivo);
  if (!q.ok) return;
  // sube desde la orilla (o lo poco hondo), a su lado
  let desde = null;
  for (let d = 0.5; d <= 2.8 && !desde; d += 0.25) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, x = laCanoa.x + Math.sin(a) * d, z = laCanoa.z + Math.cos(a) * d; if (hondo(x, z) < 0.8) { desde = { x: r2(x), z: r2(z) }; break; } }
  if (desde) await J.andar(desde.x, desde.z);
  q = await J.objeto({ tipo: 'subir_canoa', objeto: laCanoa.id, x: J.pos.x, z: J.pos.z });
  comprobar('sube a la canoa desde la orilla: rema él', q.ok && porId(laCanoa.id)?.rema === yo && q.datos?.rema !== false, q.motivo);
  if (!q.ok) return;
  estar(laCanoa.x, laCanoa.z); await pausa(300);
  if (MUTAR) s.objetos.canoas.deAutor = () => null;   // (roto a propósito: el servidor no ve que va en canoa)
  // remar (o no) n pasos de 100 ms hacia donde va el río (sentido 1: río abajo; -1: río arriba), siguiendo el cauce
  const remar = async (sentido, pasos, conRemo = true) => {
    const p0 = { ...J.pos }, s0 = { ...(servidor() || J.pos) };
    let recorrido = 0, n = 0, encalla = 0, aFavor = 0;
    for (; n < pasos; n++) {
      const ag = aguaAqui(J.pos.x, J.pos.z);
      if (!ag) break;
      const c = Math.hypot(ag.dx, ag.dz) || 1, base = Math.atan2(sentido * ag.dx / c, sentido * ag.dz / c);
      // la dirección, la de más agua de las de alrededor de hacia donde va el río (como gobierna el que rema)
      let mejor = null;
      for (const g of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8]) {
        const dir = { x: Math.sin(base + g), z: Math.cos(base + g) };
        const h = hondo(J.pos.x + dir.x * 3, J.pos.z + dir.z * 3) - Math.abs(g) * 0.3;
        if (!mejor || h > mejor.h) mejor = { dir, h };
      }
      const remando = conRemo && remoEnMano(J.inv);
      const vel = velocidadCanoa({ dir: mejor.dir, remando, corriente: { dx: ag.dx, dz: ag.dz }, mar: !!ag.mar });
      const nx = J.pos.x + vel.vx * 0.1, nz = J.pos.z + vel.vz * 0.1;
      if (hondo(nx, nz) < HONDO_FLOTA * 0.8) { encalla++; if (encalla > 5) break; continue; }
      recorrido += Math.hypot(nx - J.pos.x, nz - J.pos.z);
      aFavor += ((nx - J.pos.x) * ag.dx + (nz - J.pos.z) * ag.dz) / c;
      estar(nx, nz); await pausa(100);
    }
    await pausa(300);
    const s1 = servidor() || J.pos, seg = n * 0.1;
    return { seg, recorrido, v: recorrido / Math.max(0.1, seg), aFavor, servidor: dist(s0, s1), desfase: dist(s1, J.pos), p0, p1: { ...J.pos } };
  };
  const ag0 = aguaAqui(J.pos.x, J.pos.z);
  const arriba = await remar(-1, 60);
  comprobar('rema río arriba, contra la corriente, y avanza', arriba.seg >= 3 && arriba.aFavor < -10, `${r2(arriba.seg)} s · ${r2(-arriba.aFavor)} m río arriba · ${r2(arriba.v)} m/s (corriente ${r2(ag0?.vel || 0)} m/s)`);
  const abajo = await remar(1, 60);
  comprobar('rema río abajo, a favor: bastante más deprisa que corriendo', abajo.seg >= 3 && abajo.aFavor > 10 && abajo.v > VEL_MAX * 1.2, `${r2(abajo.seg)} s · ${r2(abajo.aFavor)} m río abajo · ${r2(abajo.v)} m/s (corriendo, ${VEL_MAX}; remando, ${VEL_REMAR} más la corriente)`);
  comprobar('el servidor le deja ir así de deprisa: le tiene donde rema (sin recortarle)', arriba.desfase < 1.5 && abajo.desfase < 1.5 && abajo.servidor > abajo.aFavor * 0.8, `desfase ${r2(arriba.desfase)} y ${r2(abajo.desfase)} m · el servidor le ha visto ir ${r2(abajo.servidor)} m`);

  console.log('26g. Deja de remar: la canoa va a la deriva con la corriente; y la vara en la orilla');
  const deriva = await remar(1, 80, false);
  const agD = aguaAqui(J.pos.x, J.pos.z);
  comprobar('sin remar, la lleva la corriente río abajo, despacio', deriva.seg >= 4 && deriva.aFavor > 0.5 && deriva.v < VEL_MAX && deriva.desfase < 1.5, `${r2(deriva.seg)} s · ${r2(deriva.aFavor)} m río abajo · ${r2(deriva.v)} m/s (corriente ${r2(agD?.vel || 0)} m/s)`);
  // a la orilla: rema hasta tener a 2,5 m un sitio con poca agua donde pisar
  const pisar = () => { for (let d = 1.5; d <= 2.8; d += 0.25) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, x = J.pos.x + Math.sin(a) * d, z = J.pos.z + Math.cos(a) * d; if (hondo(x, z) < HONDO_BAJAR - 0.1 && T.enIsla(x, z)) return { x: r2(x), z: r2(z) }; } return null; };
  let b = pisar();
  for (let n = 0; n < 200 && !b; n++) {
    // hacia la orilla más cercana
    let o = null;
    for (let d = 2; d <= 30 && !o; d += 1) for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283, x = J.pos.x + Math.sin(a) * d, z = J.pos.z + Math.cos(a) * d; if (hondo(x, z) < HONDO_BAJAR - 0.1) { o = { x: Math.sin(a), z: Math.cos(a) }; break; } }
    if (!o) break;
    const ag = aguaAqui(J.pos.x, J.pos.z) || { dx: 0, dz: 0 };
    const vel = velocidadCanoa({ dir: o, remando: remoEnMano(J.inv), corriente: { dx: ag.dx, dz: ag.dz }, mar: !!ag.mar });
    const nx = J.pos.x + vel.vx * 0.1, nz = J.pos.z + vel.vz * 0.1;
    if (hondo(nx, nz) < HONDO_FLOTA * 0.8) { b = pisar(); break; }
    estar(nx, nz); await pausa(100);
    b = pisar();
  }
  await pausa(300);
  q = b ? await J.objeto({ tipo: 'bajar_canoa', x: J.pos.x, z: J.pos.z, bx: b.x, bz: b.z }) : { ok: false, motivo: 'no llega a la orilla' };
  if (b) { J.pos = { ...b }; J.estar(b.x, b.z); }
  laCanoa = porId(laCanoa.id);
  const suya = s.mundo.dentroDeTierra(laCanoa?.x ?? 0, laCanoa?.z ?? 0, yo);
  comprobar('rema hasta la orilla y se baja: la canoa se queda a flote, varada junto a la orilla, y no desaparece', q.ok && !!laCanoa && laCanoa.agua === true && !laCanoa.rema && laCanoa.desaparece == null && hondo(laCanoa.x, laCanoa.z) >= HONDO_FLOTA * 0.8, `${q.motivo || ''} · ${laCanoa ? `a ${r2(dist(laCanoa, J.pos))} m de donde pisa` : 'no está'}`);
  comprobar(suya ? 'en su tierra, queda a su guarda' : 'fuera de su tierra, sin guarda (cualquiera se la lleva)', !!laCanoa && (suya ? laCanoa.guarda === yo : !laCanoa.guarda), JSON.stringify({ guarda: laCanoa?.guarda || null }));
  const idC = laCanoa?.id;
  await pausa(3000);
  comprobar('pasado un rato, la canoa sigue donde la dejó', !!idC && !!porId(idC) && dist(porId(idC), laCanoa) < 0.01);
  // (de vuelta: el remo y el hacha, con él; a casa)
  await J.andar(inicio.x, inicio.z);
}

if (process.argv[1] && process.argv[1].endsWith('recorrido_canoa.mjs') && process.env.KINHOLD_RECORRIDO_DESDE) {
  const { readFileSync, cpSync, mkdtempSync } = await import('fs');
  const { join } = await import('path');
  const { tmpdir } = await import('os');
  const desde = process.env.KINHOLD_RECORRIDO_DESDE, meta = JSON.parse(readFileSync(join(desde, 'jugador.json'), 'utf8'));
  const RELOJ = Math.max(1, Number(process.env.RELOJ) || 8);
  const d0 = Date.now(), dReal = Date.now.bind(Date), p0 = performance.now(), pReal = performance.now.bind(performance);
  const salto = Math.max(0, meta.ahora - d0) + 1000;
  Date.now = () => d0 + salto + Math.round((dReal() - d0) * RELOJ);
  performance.now = () => p0 + (pReal() - p0) * RELOJ;
  const { terrenoWhitholm } = await import('../src/logica/terreno_servidor.js');
  const { crearServidor } = await import('../servidor/servidor.mjs');
  const { Inventario } = await import('../src/logica/inventario.js');
  const { WebSocket } = await import('ws');
  const { msDeHora } = await import('../src/logica/cielo.js');
  const { USAN_INVENTARIO } = await import('../src/logica/acciones.js');
  const T = terrenoWhitholm(), O = T.origen;
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-canoa-')); cpSync(desde, dir, { recursive: true });
  let ok = 0, mal = 0;
  const comprobar = (n, c, d = '') => { if (c) ok++; else mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
  const pausa = (ms) => new Promise(r => setTimeout(r, ms / RELOJ));
  const cerca = (l, p) => l.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno: T, ticoNecesidades: 1000 / RELOJ, usoRopa: 120000, horaMundo: () => msDeHora(12) });
  const puerto = await s.listo;
  const J = await new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}/?ficha=${meta.ficha}`);
    const c = { ws, esperas: [], id: 0, inv: null, pos: null };
    c.esperar = (cond, ms = 5000) => new Promise((r, f) => { const t = setTimeout(() => f(new Error('tiempo agotado')), ms); c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } }); });
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    c.accion = async (accion) => { const id = ++c.id + 100000; const p = c.esperar(m => m.tipo === 'resultado' && m.id === id); const q = USAN_INVENTARIO.has(accion.tipo) ? c.esperar(m => m.tipo === 'inventario') : null; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return q ? Promise.all([p, q]).then(([r]) => r) : p; };
    c.estar = (x, z) => { c.pos = { x, z }; ws.send(JSON.stringify({ tipo: 'estado', x, y: T.suelo(x, z), z, giro: 0, anim: 'andar' })); };
    c.andar = async (x, z) => { for (let i = 0; i < 100000; i++) { const paso = c.nec && c.nec.cansancio >= 90 ? 0.36 : 0.6; const { x: x0, z: z0 } = c.pos, d = Math.hypot(x - x0, z - z0); if (d <= paso) { c.estar(x, z); await pausa(100); break; } c.estar(x0 + (x - x0) * paso / d, z0 + (z - z0) * paso / d); await pausa(100); } await pausa(150); };
    c.cuantos = (tipo) => (c.inv ? c.inv.cuantos(tipo) : 0);
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if ((m.tipo === 'bienvenida' || m.tipo === 'inventario' || m.tipo === 'resultado_objeto') && m.inventario) c.inv = Inventario.importarJugador(m.inventario); if (m.necesidades && (m.tipo === 'bienvenida' || m.tipo === 'necesidades')) c.nec = m.necesidades; c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    const b = c.esperar(m => m.tipo === 'bienvenida', 20000);
    ws.on('open', async () => { c.bienvenida = await b; c.pos = c.bienvenida.posicion ? { x: c.bienvenida.posicion.x, z: c.bienvenida.posicion.z } : meta.pos; listo(c); });
    ws.on('error', fallo);
  });
  try { await canoa({ J, s, T, O, comprobar, pausa, cerca }); }
  catch (e) { comprobar('la canoa llega al final', false, e && e.stack); }
  J.ws.close(); await s.cerrar();
  console.log(`\n${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
}
