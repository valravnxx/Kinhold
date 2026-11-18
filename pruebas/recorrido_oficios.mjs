// Recorrido de jugador de los oficios (P9, «Recorrido de jugador de los oficios, sin arcón»): el paso 27 de
// pruebas/prueba_recorrido.mjs, el mismo jugador, sin arcón y con lo que recoge. Con su lanza caza más liebres y las
// despieza con la lasca (carne y piel); en su tierra levanta un secadero (4 troncos delgados de árboles jóvenes, al
// hombro, y 2 cuerdas) y cuelga en él una carne, que al cabo de las horas (el reloj adelantado) es carne seca; levanta un
// raspador de pieles (4 varas y una cuerda) y, con la lasca, deja limpias las pieles; con dos se hace en el banco el
// zurrón. Llena el cubo en el río, descorteza robles en pie (corteza de roble), cava las cubas de curtido (2 de barro y
// 2 troncos cortos, con el palo cavador), vacía en ellas el cubo y pone a curtir 3 pieles limpias, que al cabo de los
// días (adelantados) son 3 cueros. Se hace el huso (una vara y una piedra) e hila 2 de fibra; en el banco cose los
// zapatos de cuero (1 cuero y el hilo) y hace el cinto de cuero (2 cueros y una rama). Y parte 2 troncos cortos con el
// hacha (10 leñas), levanta con ellas la carbonera, la enciende con su yesca y su taladro de fuego y, pasadas las
// horas (adelantadas), saca los 4 carbones, y la carbonera se deshace.
// Cadena: piel y carne ← liebre (lanza endurecida, lasca de sílex); tronco delgado y vara ← árbol joven (hacha de
// piedra); cuerda ← 3 cordeles ← 9 de fibra; corteza de roble ← roble en pie (lasca); agua ← el río (cubo ← tronco
// corto, en el banco); barro ← la ribera (palo cavador ← rama); tronco corto ← tronzar un tronco largo (árbol adulto);
// huso ← vara y piedra; hilo ← 2 de fibra (huso); leña ← partir un tronco corto (hacha); yesca y taladro de fuego.
// Para trabajar en esta parte sin repetir lo de antes: KINHOLD_RECORRIDO_GUARDAR_OFICIOS=<carpeta> node
// pruebas/prueba_recorrido.mjs guarda el mundo después de la canoa; KINHOLD_RECORRIDO_DESDE=<carpeta> node
// pruebas/recorrido_oficios.mjs sigue desde ahí con los oficios. Con MUTAR=1 además, el cuero se pide antes de tiempo
// (sin adelantar los días de las cubas): debe FALLAR.
// Decisiones provisionales (anotadas en el diario):
//  - Lo que tarda horas o días de verdad (secar la carne 6 h, curtir 2 días, la carbonera 4 h) se adelanta como lo que
//    se fabrica: la prueba pone en ya pasada la hora a la que termina lo que encargó este jugador. No le da nada.
//  - Los puestos (secadero, raspador, cubas, carbonera), junto a su banco de tronco, en su tierra.
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { vegetacionEn } from '../src/logica/vegetacion.js';
import { idArbol } from '../src/logica/tala.js';
import { hayAguaCerca } from '../src/logica/necesidades.js';
import { campoEn } from '../src/logica/campos.js';
import { VIDA as VIDA_DESGASTE } from '../src/logica/desgaste.js';

const MANOS = ['mano:der', 'mano:izq'];
// Con MUTAR=1 (solo al seguir desde lo guardado) no se adelantan los días de las cubas: el cuero no sale y debe FALLAR.
const MUTAR = process.env.MUTAR === '1' && !!process.env.KINHOLD_RECORRIDO_DESDE;

export async function oficios({ J, s, T, O, comprobar, pausa, cerca, RELOJ = 8, sitioCaza = null, guardarTrasCaza = null }) {
  const yo = J.bienvenida.autor;
  const r2 = v => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const enMano = () => MANOS.map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
  const enLaMano = (tipo) => MANOS.find(l => J.inv.lugares[l]?.tipo === tipo);
  const soltar = (l) => J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
  const soltarManos = async (salvo = []) => { for (const l of MANOS) if (J.inv.lugares[l] && !salvo.includes(J.inv.lugares[l].tipo)) await soltar(l); };
  // lo encargado por este jugador (en sus manos y en los puestos), ya terminado: no le da nada, solo ahorra la espera
  const adelantar = (receta = null) => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola || [])]) if (c.autor === yo && (!receta || c.receta === receta)) c.fin = Math.min(c.fin, Date.now() - 1); };
  const visibles = () => s.objetos.sueloVisible(Date.now());
  const enSuelo = (tipo, p, d = 3) => cerca(visibles().filter(o => o.cosa.tipo === tipo && !o.arrastra && dist(o, p) < d), p);
  const nEnSuelo = (tipo, p, d = 3) => enSuelo(tipo, p, d).reduce((t, o) => t + o.cosa.n, 0);
  const probados = new Set();
  const alrededor = (p, d) => recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - d, z0: O.z + p.z - d, x1: O.x + p.x + d, z1: O.z + p.z + d })
    .map(q => ({ id: q.id, tipo: q.tipo, x: r2(q.x - O.x), z: r2(q.z - O.z) }));
  const recoger = async (p) => { probados.add(p.id); await J.andar(p.x + 0.4, p.z); return J.objeto({ tipo: 'recoger', punto: p.id, x: J.pos.x, z: J.pos.z, px: p.x, pz: p.z, clase: p.tipo }); };
  // juntar n de «da» a los pies, en el sitio: recoge de lo de alrededor y, con las manos llenas, vuelve a dejarlo allí
  const acopiar = async (tipos, da, n, sitio, radios = [250, 500, 900]) => {
    const total = () => nEnSuelo(da, sitio, 3) + J.cuantos(da);
    for (const radio of radios) {
      if (total() >= n) break;
      const lista = alrededor(sitio, radio).filter(q => tipos.includes(q.tipo));
      for (let k = 0; k < 80 && total() < n; k++) {
        const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0];
        if (!p) break;
        const q = await recoger(p);
        if (!q.ok && MANOS.every(l => J.inv.lugares[l])) { probados.delete(p.id); await J.andar(sitio.x, sitio.z); await soltarManos(); }   // (llenas: a dejarlo, y vuelve)
      }
    }
    await J.andar(sitio.x, sitio.z); await soltarManos();
    return nEnSuelo(da, sitio, 3) >= n;
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
  // tener algo en una mano: de lo que lleva, del suelo de al lado de donde o, si no, de lo suyo de más lejos
  const aLaMano = async (tipo, donde, d = 3) => {
    if (enLaMano(tipo)) return true;
    if (!J.cuantos(tipo) && donde) { if (MANOS.every(l => J.inv.lugares[l])) await soltar('mano:izq'); await cogerSuelo(tipo, donde, d); if (enLaMano(tipo)) return true; }
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
    return l ? J.objeto({ tipo: 'depositar_estacion', estacion: est.id, de: l, cantidad: Math.min(cantidad, J.inv.cuantos(tipo)), x: J.pos.x, z: J.pos.z }) : { ok: false, motivo: `no lleva ${tipo}` };
  };
  // lo del suelo de al lado de la estación, a ella (de una mano en una mano, hasta n)
  const aEstacion = async (est, tipo, n, de = est, d = 4) => {
    let puestos = 0;
    for (let k = 0; k < 12 && puestos < n; k++) {
      if (!J.cuantos(tipo)) { if (MANOS.every(l => J.inv.lugares[l])) await soltarManos(); if (!(await cogerSuelo(tipo, de, d, Math.min(3, n - puestos)))) break; }
      await J.andar(est.x + 1, est.z);
      const q = await depositar(est, tipo, n - puestos);
      if (!q.ok) return q;
      puestos += q.datos && q.datos.dejado ? Object.values(q.datos.dejado).reduce((t, v) => t + v, 0) : 1;
    }
    return puestos >= n ? { ok: true } : { ok: false, motivo: `solo ${puestos} de ${n} ${tipo}` };
  };
  const enEstacion = async (est, receta, adelanto = true) => {
    const f = await J.objeto({ tipo: 'fabricar', receta, estacion: est.id, x: J.pos.x, z: J.pos.z });
    if (adelanto) adelantar(receta);
    const g = f.ok ? await J.objeto({ tipo: 'recoger_fabricado', estacion: est.id, x: J.pos.x, z: J.pos.z }) : f;
    return { ok: f.ok && g.ok, motivo: f.motivo || g.motivo, datos: g.datos };
  };
  const suyas = (tipo) => Object.values(s.objetos.fab.estaciones).filter(e => e.autor === yo && e.tipo === tipo && !e.obra);
  // levantar un puesto: el marco, lo que pide (lo lleva o está a sus pies) y el trabajo
  const levantar = async (estacion, x, z) => {
    await J.andar(x + 1, z);
    const rc = await J.objeto({ tipo: 'colocar_estacion', estacion, x, z });
    if (!rc.ok) return rc;
    const id = rc.datos.estacion || rc.datos.id;
    const re = await J.objeto({ tipo: 'entregar_estacion', estacion: id, x: J.pos.x, z: J.pos.z });
    if (!re.ok) return { ...re, id };
    let rt = { ok: true, datos: {} };
    for (let i = 0; i < 20 && rt.ok && !rt.datos.terminada; i++) rt = await J.objeto({ tipo: 'trabajar_estacion', estacion: id, segundos: 5, x: J.pos.x, z: J.pos.z });
    return { ...rt, id };
  };

  const M = s.mundo.mojonDe(yo);
  const banco = M && cerca(suyas('banco_tronco'), M)[0];
  const tallar = M && cerca(suyas('piedra_tallar'), M)[0];
  console.log('27. Los oficios (P9): caza más liebres; el secadero y la carne seca; el raspador, la piel limpia y el zurrón; el cubo lleno, la corteza de roble, las cubas y el cuero; el huso y el hilo; los zapatos y el cinto de cuero; y la carbonera y el carbón');
  comprobar('27. tiene su tierra, su banco de tronco y su piedra de tallar', !!M && !!banco && !!tallar, JSON.stringify({ M, banco: banco && [banco.x, banco.z] }));
  if (!M || !banco || !tallar) return;

  // (con sed, a beber al agua más cercana, y vuelta; con hambre, bayas o setas de por aquí)
  const nec = () => s.necesidades.get(yo) || { sed: 0, hambre: 0 };
  const aguaCerca = (desde) => {
    for (let d = 5; d <= 1500; d += 5) for (let k = 0; k < 48; k++) {
      const x = desde.x + Math.cos(k / 48 * 2 * Math.PI) * d, z = desde.z + Math.sin(k / 48 * 2 * Math.PI) * d;
      if (!T.aguaEn(x, z) && hayAguaCerca(T.aguaEn, x, z)) return { x: r2(x), z: r2(z) };
    }
    return null;
  };
  const cuidarse = async () => {
    const desde = { ...J.pos };
    if (nec().sed > 45) {
      const agua = aguaCerca(desde);
      if (agua) { await J.andar(agua.x, agua.z); for (let i = 0; i < 10 && nec().sed > 10; i++) { await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z }); await pausa(1600); } }
    }
    if (nec().hambre > 60) {
      for (const m of cerca(alrededor(J.pos, 200).filter(p => (p.tipo === 'bayas' || p.tipo === 'setas') && !probados.has(p.id)), J.pos).slice(0, 16)) {
        if (nec().hambre <= 40) break;
        if (MANOS.every(l => J.inv.lugares[l])) await soltarManos();
        const rb = await recoger(m);
        if (rb.ok) { const tipo = m.tipo === 'bayas' ? 'bayas' : 'setas'; for (let i = 0; i < 6 && J.cuantos(tipo) && nec().hambre > 20; i++) await J.objeto({ tipo: 'comer', objeto: tipo }); }
      }
    }
    if (dist(J.pos, desde) > 1) await J.andar(desde.x, desde.z);
  };
  const secoHasta = (p, q) => { const n = Math.ceil(dist(p, q)); for (let i = 0; i <= n; i++) if (T.aguaEn(p.x + (q.x - p.x) * i / n, p.z + (q.z - p.z) * i / n)) return false; return true; };

  // su sitio de trabajo, junto al banco, en su tierra y donde no haya nada en el suelo
  const libreEn = (c, radio, lejos = 3.5) => {
    for (let d = 3; d <= radio; d += 1) for (let k = 0; k < 16; k++) {
      const x = r2(c.x + Math.cos(k / 16 * 6.283) * d), z = r2(c.z + Math.sin(k / 16 * 6.283) * d);
      if (T.aguaEn(x, z) || !s.mundo.dentroDeTierra(x, z, yo)) continue;
      if (visibles().some(o => dist(o, { x, z }) < lejos) || Object.values(s.objetos.fab.estaciones).some(e => dist(e, { x, z }) < 4)) continue;
      if (s.mundo.construcciones.some(c2 => [...c2.piezas.values()].length && dist({ x: c2.ox, z: c2.oz }, { x, z }) < 9)) continue;
      return { x, z };
    }
    return null;
  };
  const taller = libreEn(banco, 30) || { x: r2(banco.x - 2), z: r2(banco.z + 2) };
  await J.andar(taller.x, taller.z); await soltarManos();

  // ── herramientas: el hacha, la lasca, el palo cavador ──
  const buscar = async (tipo, extra = []) => {
    if (J.cuantos(tipo)) return true;
    for (const [p, d] of [[J.pos, 15], [taller, 10], [banco, 40], ...extra, [M, 400]]) if (p && enSuelo(tipo, p, d).length) {
      // (con las dos manos llenas, deja una: la que no lleva lo que le hace falta seguir llevando)
      if (MANOS.every(l => J.inv.lugares[l])) await soltar(MANOS.find(l => !['lanza_endurecida', 'lasca_silex', 'hacha_piedra'].includes(J.inv.lugares[l].tipo)) || 'mano:izq');
      if (await cogerSuelo(tipo, p, d, 1)) return true;
    }
    return false;
  };
  const resto = () => { const l = MANOS.find(x => s.objetos.invs.de(yo).lugares[x]?.tipo === 'hacha_piedra'); return l ? VIDA_DESGASTE.hacha_piedra - (s.objetos.invs.de(yo).lugares[l].usado || 0) : 0; };
  // un cordel con las manos, aquí: 3 de fibra de por aquí
  const cordel = async () => {
    const aqui = { ...J.pos };
    await soltarManos(['hacha_piedra', 'lasca_silex']);
    for (const radio of [250, 500, 900]) {
      if (J.cuantos('fibra') >= 3) break;
      const lista = alrededor(aqui, radio).filter(q => ['ortiga', 'hierba_larga'].includes(q.tipo));
      for (let n = 0; n < 40 && J.cuantos('fibra') < 3; n++) { const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0]; if (!p) break; await recoger(p); }
    }
    await J.andar(aqui.x, aqui.z);
    const lf = enLaMano('fibra'); if (lf) await soltar(lf);
    return deMano('cordel');
  };
  const repararHacha = async (necesita) => {
    for (let k = 0; k < 3 && enLaMano('hacha_piedra') && resto() < necesita; k++) {
      const c = await cordel();
      await J.andar(tallar.x + 1, tallar.z);
      const d = c.ok ? await depositar(tallar, 'cordel') : c;
      const rp = d.ok ? await J.objeto({ tipo: 'reparar', estacion: tallar.id, de: enLaMano('hacha_piedra'), x: J.pos.x, z: J.pos.z }) : d;
      if (!rp.ok) break;
    }
  };
  const hachaALaMano = async () => {
    if (await aLaMano('hacha_piedra')) return true;
    await buscar('hacha_piedra');
    return aLaMano('hacha_piedra');
  };
  // talar el árbol joven más cercano a p que nadie ha tocado (fuera de los campos y lejos de las obras) y limpiarlo
  const talarJoven = async (p) => {
    await soltarManos(['hacha_piedra']);
    if (!(await hachaALaMano())) return { ok: false, motivo: `no encuentra su hacha (en las manos ${enMano()})` };
    await repararHacha(14);
    const arboles = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - 150, z0: O.z + p.z - 150, x1: O.x + p.x + 150, z1: O.z + p.z + 150 }).arboles
      .map(a => ({ x: a.x - O.x, z: a.z - O.z, edad: a.edad })).map(a => ({ ...a, id: idArbol(a.x, a.z) }))
      .filter(a => a.edad === 'joven' && !s.objetos.tala.estado[a.id] && !campoEn(s.mundo, a.x, a.z) && secoHasta(J.pos, a) && !s.mundo.construcciones.some(c => [...c.piezas.values()].length && dist({ x: c.ox, z: c.oz }, a) < 12));
    const a = cerca(arboles, p)[0];
    if (!a) return { ok: false, motivo: 'no hay árboles jóvenes cerca' };
    await J.andar(a.x + 1, a.z);
    let t, g = 0;
    do { t = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); g++; if (t.ok && t.datos.boca !== undefined) { await J.andar(a.x, a.z + 1); await J.andar(a.x - 1, a.z); } if (t.ok && !t.datos.cae) await pausa(550); } while (t.ok && !t.datos.cae && g < 90);
    if (!t.ok || !t.datos.cae) return { ok: false, motivo: `no lo tala: ${t.motivo || g + ' golpes'}` };
    await pausa(550);
    let l, gl = 0;
    do { l = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); gl++; if (l.ok && !l.datos.limpio) await pausa(550); } while (l.ok && !l.datos.limpio && gl < 60);
    if (!l.ok || !l.datos.limpio) return { ok: false, motivo: `no lo limpia: ${l.motivo || gl + ' golpes'}` };
    return { ok: true, a };
  };

  // ── el fuego: el taladro de fuego (2 ramas y un cordel) y la yesca (de un hongo yesquero o de 2 de fibra) ──
  const fibraAqui = async (n) => {
    const aqui = { ...J.pos };
    for (const radio of [250, 500, 900]) {
      if (J.cuantos('fibra') >= n) break;
      const lista = alrededor(aqui, radio).filter(q => ['ortiga', 'hierba_larga'].includes(q.tipo));
      for (let k = 0; k < 40 && J.cuantos('fibra') < n; k++) { const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0]; if (!p) break; if (MANOS.every(l => J.inv.lugares[l]) && !enLaMano('fibra')) await soltarManos(['lasca_silex']); await recoger(p); }
    }
    await J.andar(aqui.x, aqui.z);
    return J.cuantos('fibra') >= n;
  };
  const taladroYYesca = async (nYesca) => {
    const aqui = { ...J.pos };
    if (!(await buscar('taladro_fuego'))) {
      await soltarManos();
      await acopiar(['ramas'], 'rama', 2, aqui);
      const c = await cordel();
      await J.andar(aqui.x, aqui.z); await soltarManos();
      if (c.ok) await deMano('taladro_fuego');
    }
    for (let k = 0; k < 4 && J.cuantos('yesca') < nYesca; k++) {
      const hongo = cerca(alrededor(aqui, 300).filter(q => q.tipo === 'yesquero' && !probados.has(q.id)), J.pos)[0];
      if (MANOS.every(l => J.inv.lugares[l]) && !enLaMano('yesca')) await soltarManos(['taladro_fuego']);
      if (hongo && (await recoger(hongo)).ok) continue;
      await soltarManos(['taladro_fuego', 'yesca']);
      if (await fibraAqui(2)) { const lf = enLaMano('fibra'); if (lf) await soltar(lf); await deMano('yesca'); }
    }
    await J.andar(aqui.x, aqui.z);
    return J.cuantos('taladro_fuego') >= 1 && J.cuantos('yesca') >= nYesca;
  };
  // una lanza endurecida al fuego del hogar de su casa (una rama), encendiéndolo si está apagado
  const lanzaNueva = async () => {
    const hogar = cerca(suyas('hogar'), M)[0];
    if (!hogar) return { ok: false, motivo: 'no tiene hogar' };
    const H = () => s.objetos.fab.estaciones[hogar.id];
    await J.andar(hogar.x + 1, hogar.z); await soltarManos(['lasca_silex']);
    await acopiar(['ramas'], 'rama', 4, { ...J.pos });   // (2 para el taladro, si lo hace; una al fuego y otra para la lanza)
    if (!(H().fuego && H().fuego.hasta > Date.now())) {
      if (!(await taladroYYesca(1))) return { ok: false, motivo: `sin taladro o sin yesca (${enMano()})` };
      await J.andar(hogar.x + 1, hogar.z);
      if (!(H().fuego && H().fuego.combustible > 0)) {
        // (el taladro y la yesca, a sus pies un momento: una rama al hogar, y vuelve a cogerlos)
        await soltarManos(); await cogerSuelo('rama', J.pos, 4, 1); await J.andar(hogar.x + 1, hogar.z);
        const e = await J.objeto({ tipo: 'echar_fuego', estacion: hogar.id, objeto: 'rama', x: J.pos.x, z: J.pos.z });
        if (!e.ok) return { ok: false, motivo: `no echa la rama al hogar: ${e.motivo}` };
        await soltarManos(); await cogerSuelo('taladro_fuego', J.pos, 4, 1); await cogerSuelo('yesca', J.pos, 4, 1); await J.andar(hogar.x + 1, hogar.z);
      }
      const en = await J.objeto({ tipo: 'encender_fuego', estacion: hogar.id, x: J.pos.x, z: J.pos.z });
      if (!en.ok) return { ok: false, motivo: `no enciende el hogar: ${en.motivo}` };
      await soltarManos();
    }
    await cogerSuelo('rama', J.pos, 4, 1);
    await J.andar(hogar.x + 1, hogar.z);
    const d = await depositar(hogar, 'rama');
    if (!d.ok) return d;
    return enEstacion(hogar, 'lanza_endurecida');
  };

  // ── la caza (27c): hasta tener 5 pieles (2 para el zurrón y 3 para el cuero) y una carne para el secadero ──
  const pieles = () => J.cuantos('piel') + nEnSuelo('piel', taller, 6);
  const combate = (m) => J.ws.send(JSON.stringify({ tipo: 'combate', ...m }));
  const LJ = () => s.combate.luchadores[yo];
  const seco = (p, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); for (let k = 0; k <= d; k++) if (T.aguaEn(p.x + (q.x - p.x) * k / d, p.z + (q.z - p.z) * k / d)) return false; return true; };
  const despejado = (p, q) => { const h0 = T.suelo(p.x, p.z) + 1.45, h1 = T.suelo(q.x, q.z) + 0.2; for (let k = 1; k < 20; k++) { const u = k / 20; if (T.suelo(p.x + (q.x - p.x) * u, p.z + (q.z - p.z) * u) > h0 + (h1 - h0) * u - 0.15) return false; } return true; };
  const sitioPara = (q) => {
    let mejor = null;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, p = { x: q.x + Math.sin(a) * 10, z: q.z + Math.cos(a) * 10 };
      if (T.aguaEn(p.x, p.z) || !seco(p, q) || !despejado(p, q)) continue;
      if (!mejor || dist(p, J.pos) < dist(mejor, J.pos)) mejor = p;
    }
    return mejor;
  };
  const acercarse = async (id) => {
    const q0 = s.fauna.de(id); if (!q0) return null;
    const sitio = sitioPara(q0); if (!sitio) return null;
    for (let k = 0; k < 2000; k++) {
      const q = s.fauna.de(id); if (!q) return null;
      const d = dist(sitio, J.pos);
      if (d <= 0.25) return q;
      const paso = Math.min(d, dist(q, J.pos) > 24 ? 0.6 : 0.2);
      J.estar(J.pos.x + (sitio.x - J.pos.x) / d * paso, J.pos.z + (sitio.z - J.pos.z) / d * paso); await pausa(100 * RELOJ);
    }
    return null;
  };
  const lanzaEnMano = () => enLaMano('lanza_endurecida');
  // una liebre: se acerca a la más cercana que tenga a tiro, se la lanza y, si falla, recoge la lanza y prueba otra vez
  const cazarUna = async () => {
    const aTiro = () => cerca([...J.liebres.values()], J.pos).filter(l => seco(J.pos, l) && s.fauna.de(l.id) && dist(l, J.pos) < 120);
    const fallos = [];
    for (let k = 0; k < 12 && lanzaEnMano(); k++) {
      const l = aTiro().find(x => sitioPara(x)); if (!l) return { muerta: null, motivo: `ninguna a tiro (${J.liebres.size} a la vista${fallos.length ? '; ' + fallos.join(', ') : ''})` };
      const q = await acercarse(l.id); if (!q) { fallos.push('huye'); continue; }
      await pausa(800 * RELOJ);
      const v = s.fauna.de(l.id) || q;
      combate({ que: 'tensar' }); await pausa(1400);
      combate({ que: 'soltar', x: v.x, y: T.suelo(v.x, v.z) - T.suelo(J.pos.x, J.pos.z), z: v.z });
      await pausa(2000 * RELOJ);
      const muerta = !s.fauna.de(l.id) ? s.objetos.suelo.objetos.find(o => o.cosa.tipo === 'liebre' && Math.hypot(o.x - v.x, o.z - v.z) < 2) : null;
      const lz = cerca(s.objetos.suelo.objetos.filter(o => o.cosa.tipo === 'lanza_endurecida'), muerta || J.pos)[0];
      if (!lz) return { muerta: null, motivo: 'pierde la lanza' };
      await J.andar(lz.x, lz.z);
      await J.objeto({ tipo: 'coger_suelo', objeto: lz.id, x: J.pos.x, z: J.pos.z, a: 'mano:der' });
      if (muerta) return { muerta, tiros: k + 1 };
      fallos.push('falla');
      await pausa(1500 * RELOJ);
    }
    return { muerta: null, motivo: `no le da (${fallos.join(', ') || (lanzaEnMano() ? '' : 'sin la lanza en la mano: ' + enMano())})` };
  };

  // ── 27a. Dos cuerdas para el secadero (y una para el raspador, si no tiene): 9 de fibra y 3 cordeles cada una, en el banco ──
  console.log('27a. Trenza cuerdas en su banco (3 cordeles de 9 de fibra cada una) y tala árboles jóvenes: 4 troncos delgados y varas');
  const cuerda = async () => {
    await J.andar(banco.x + 1, banco.z); await soltarManos(['lasca_silex']);
    for (let v = 0; v < 3; v++) {
      const q = await cordel();
      if (!q.ok) return q;
      await J.andar(banco.x + 1, banco.z);
      const d = await depositar(banco, 'cordel');
      if (!d.ok) return d;
    }
    return enEstacion(banco, 'cuerda');
  };
  // (2 para el secadero, y otra para el raspador si aún no tiene uno)
  const nCuerdas = suyas('raspador').length ? 2 : 3;
  let rq = { ok: true };
  for (let i = 0; i < nCuerdas && rq.ok; i++) {
    await cuidarse();
    rq = await cuerda();
    if (rq.ok) { await J.andar(taller.x, taller.z); const lc = enLaMano('cuerda'); if (lc) await soltar(lc); }
  }
  comprobar(`trenza ${nCuerdas} cuerdas en su banco`, rq.ok && nEnSuelo('cuerda', taller, 4) + J.cuantos('cuerda') >= nCuerdas, rq.motivo || `${nEnSuelo('cuerda', taller, 4)}`);
  // los troncos delgados, de árboles jóvenes, cada uno al hombro hasta el taller; las varas, de dos en dos a la mano
  let jovenes = 0, rt = { ok: true };
  while (rt.ok && (nEnSuelo('tronco_delgado', taller, 4) < 4 || nEnSuelo('vara', taller, 4) < 5) && jovenes < 10) {
    await cuidarse();
    rt = await talarJoven(taller);
    if (!rt.ok) break;
    jovenes++;
    const hachaEn = { ...J.pos };
    await soltarManos();
    const tr = enSuelo('tronco_delgado', rt.a, 6)[0];
    if (tr && nEnSuelo('tronco_delgado', taller, 4) < 4) {
      await J.andar(tr.x + 0.6, tr.z);
      const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
      if (c.ok) { await J.andar(taller.x, taller.z); await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z }); }
    }
    for (let v = 0; v < 2 && nEnSuelo('vara', taller, 4) < 5; v++) {
      if (!(await cogerSuelo('vara', rt.a, 6, 3))) break;
      await J.andar(taller.x, taller.z); await soltarManos();
    }
    await J.andar(hachaEn.x, hachaEn.z); await hachaALaMano();
  }
  await J.andar(taller.x, taller.z); await soltarManos();
  comprobar('tala árboles jóvenes: 4 troncos delgados, uno a uno al hombro, y 5 varas, en su taller', nEnSuelo('tronco_delgado', taller, 4) >= 4 && nEnSuelo('vara', taller, 4) >= 5, `${jovenes} jóvenes; ${nEnSuelo('tronco_delgado', taller, 4)} troncos, ${nEnSuelo('vara', taller, 4)} varas${rt.ok ? '' : ' · ' + rt.motivo}`);

  // ── 27b. El secadero ──
  console.log('27b. Levanta el secadero en su tierra: 4 troncos delgados y 2 cuerdas');
  const sitioSec = libreEn(taller, 25, 2) || { x: taller.x + 4, z: taller.z };
  // lo que pide, a sus pies junto al sitio: los 4 troncos (uno a uno al hombro) y 2 cuerdas
  for (let k = 0; k < 4; k++) {
    const tr = enSuelo('tronco_delgado', taller, 4)[0]; if (!tr) break;
    await soltarManos(); await J.andar(tr.x + 0.5, tr.z);
    const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    if (!c.ok) break;
    await J.andar(sitioSec.x + 1, sitioSec.z); await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z });
  }
  await cogerSuelo('cuerda', taller, 4, 2); await J.andar(sitioSec.x + 1, sitioSec.z); await soltarManos();
  let sec = await levantar('secadero', sitioSec.x, sitioSec.z);
  comprobar('levanta el secadero en su tierra: 4 troncos delgados y 2 cuerdas', sec.ok && sec.datos && sec.datos.terminada, sec.motivo || '');
  const secadero = sec.ok && s.objetos.fab.estaciones[sec.id];

  // ── 27c. Con el secadero ya en pie, a cazar: la carne se cuelga en cuanto llega (cruda se estropea en horas) ──
  console.log('27c. Con su lanza caza liebres hasta tener 5 pieles, las despieza con la lasca y cuelga una carne en el secadero: al cabo de las horas, carne seca');
  // la lanza y la lasca: lo que lleva o del suelo (junto a la hoguera de la orilla, donde cazó)
  const fogon = sitioCaza && sitioCaza.fogon;
  await soltarManos();
  await buscar('lanza_endurecida', fogon ? [[fogon, 20]] : []);
  // (la que dejó junto a la hoguera de la orilla, fuera de su tierra, ya no está: lo soltado fuera se pierde a la hora)
  if (!J.cuantos('lanza_endurecida')) {
    const r = await lanzaNueva();
    comprobar('su lanza se perdió junto a la hoguera de la orilla (fuera de su tierra): endurece otra al fuego de su hogar, de una rama', r.ok && J.cuantos('lanza_endurecida') >= 1, r.motivo || enMano());
  }
  await buscar('lasca_silex', fogon ? [[fogon, 20]] : []);
  comprobar('tiene su lanza y su lasca de sílex', J.cuantos('lanza_endurecida') >= 1 && J.cuantos('lasca_silex') >= 1, enMano());
  // las manos: la lanza en la derecha; la lasca, en la izquierda
  if (!enLaMano('lanza_endurecida')) await aLaMano('lanza_endurecida');
  if (enLaMano('lanza_endurecida') !== 'mano:der') { await soltarManos(['lanza_endurecida']); }
  await pausa(300);
  // la lasca, a sus pies en el taller (para despiezar al volver); a cazar, con la lanza y una mano libre
  await J.andar(taller.x, taller.z); await soltarManos(['lanza_endurecida']);
  const conCarne = () => J.cuantos('carne_cruda') + nEnSuelo('carne_cruda', taller, 6);
  let cazadas = 0, intentos = 0, porque = '';
  // por los prados de alrededor de su taller (a 150 m como mucho, por donde vuelve enseguida): en cada salida, a otro
  // (las cazadas tardan en volver a salir: en cada vuelta, más lejos, por otros trozos del mundo)
  const sitiosCaza = [taller, ...[120, 260, 400].flatMap(rr => Array.from({ length: 8 }, (_, k) => ({ x: r2(taller.x + Math.cos(k * Math.PI / 4 + rr) * rr), z: r2(taller.z + Math.sin(k * Math.PI / 4 + rr) * rr) })))].filter(p => !T.aguaEn(p.x, p.z));
  const salidas = [];
  while ((pieles() < 5 || conCarne() < 1) && intentos < 40) {
    intentos++;
    const donde = sitiosCaza[(intentos - 1) % sitiosCaza.length];
    await J.andar(donde.x, donde.z); await pausa(1000 * RELOJ);
    combate({ que: 'arma', sacada: true });
    const r = await cazarUna();
    combate({ que: 'arma', sacada: false });
    if (!r.muerta) { porque = r.motivo; salidas.push(r.motivo); continue; }
    cazadas++;
    console.log(`     (una liebre, en la salida ${intentos}, a ${Math.round(dist(r.muerta, taller))} m del taller, en ${r.tiros} tiros)`);
    // la coge con la mano libre, la lleva a su taller y la despieza allí con la lasca (que dejó allí): carne y piel
    await J.andar(r.muerta.x, r.muerta.z);
    const libre = MANOS.find(l => !J.inv.lugares[l]) || 'mano:izq';
    let cl = await J.objeto({ tipo: 'coger_suelo', objeto: r.muerta.id, x: J.pos.x, z: J.pos.z, a: libre });
    if (!cl.ok) {   // (otra vez, junto a ella: donde la ve ahora)
      const o = enSuelo('liebre', r.muerta, 6)[0];
      if (o) { await J.andar(o.x + 0.3, o.z); await pausa(500); cl = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, x: J.pos.x, z: J.pos.z, a: libre }); }
    }
    if (!cl.ok) { porque = `no coge la liebre: ${cl.motivo} (a ${r2(dist(J.pos, r.muerta))} m de ella)`; continue; }
    await J.andar(taller.x, taller.z);
    await soltar(libre);
    const cg = await cogerSuelo('lasca_silex', taller, 4, 1, libre);
    const dl = cg ? await deMano('despiezar_liebre') : { ok: false, motivo: 'sin la lasca' };
    if (!dl.ok) { porque = `no la despieza: ${dl.motivo}`; break; }
    // lo que no le cabe en las manos cae a sus pies: deja también lo demás (salvo la lanza)
    await soltarManos(['lanza_endurecida']);
  }
  comprobar(`caza con la lanza y despieza con la lasca: 5 pieles (y su carne) a sus pies, en su taller`, pieles() >= 5 && conCarne() >= 1, `${cazadas} liebres en ${intentos} salidas; ${pieles()} pieles, ${conCarne()} carnes${porque ? ' · ' + porque : ''}${salidas.length ? ' · las que no: ' + salidas.join('; ') : ''}`);
  if (pieles() < 5 || conCarne() < 1) return;
  if (guardarTrasCaza) { await J.andar(taller.x, taller.z); await soltarManos(); await guardarTrasCaza(); }
  // la lanza, a sus pies (luego no la necesita)
  await J.andar(taller.x, taller.z); await soltarManos(['lasca_silex']);
  if (secadero && !secadero.obra) {
    const pc = await aEstacion(secadero, 'carne_cruda', 1, taller, 6);
    const f = pc.ok ? await J.objeto({ tipo: 'fabricar', receta: 'secar_carne', estacion: secadero.id, x: J.pos.x, z: J.pos.z }) : pc;
    const ver = s.objetos.fab.estaciones[secadero.id];
    comprobar('cuelga la carne cruda en el secadero, y se seca (horas)', f.ok && (ver.cola || []).some(c => c.receta === 'secar_carne'), f.motivo || '');
    const g0 = await J.objeto({ tipo: 'recoger_fabricado', estacion: secadero.id, x: J.pos.x, z: J.pos.z });
    adelantar('secar_carne');
    await soltarManos(['lasca_silex']);
    const g = await J.objeto({ tipo: 'recoger_fabricado', estacion: secadero.id, x: J.pos.x, z: J.pos.z });
    comprobar('recién colgada aún no está; pasadas las horas, recoge la carne seca', !g0.ok && g.ok && J.cuantos('carne_seca') === 1, `${g0.motivo || 'la da antes'} · ${g.motivo || ''}`);
    const ls = enLaMano('carne_seca'); if (ls) { await J.andar(taller.x, taller.z); await soltar(ls); }
  }

  // ── 27d. El raspador, las pieles limpias y el zurrón ──
  console.log('27d. Levanta el raspador de pieles (4 varas y una cuerda) y deja limpias las 5 pieles con la lasca; con dos, el zurrón en el banco');
  // (el de la granja, si ya tiene uno en su tierra, le vale; si no, lo levanta)
  let raspador = cerca(suyas('raspador'), taller)[0];
  if (raspador) comprobar('ya tiene un raspador de pieles (el de la criba de la granja): raspa en él', true);
  else {
    const sitioRas = libreEn(taller, 25, 2) || { x: taller.x - 4, z: taller.z };
    await cogerSuelo('vara', taller, 4, 3); await J.andar(sitioRas.x + 1, sitioRas.z); await soltarManos(['lasca_silex']);
    await J.andar(taller.x, taller.z); await soltarManos(['lasca_silex']); await cogerSuelo('vara', taller, 4, 1); await cogerSuelo('cuerda', taller, 4, 1);
    await J.andar(sitioRas.x + 1, sitioRas.z); await soltarManos(['lasca_silex']);
    const ras = await levantar('raspador', sitioRas.x, sitioRas.z);
    comprobar('levanta el raspador de pieles: 4 varas y una cuerda', ras.ok && ras.datos && ras.datos.terminada, ras.motivo || '');
    raspador = ras.ok && s.objetos.fab.estaciones[ras.id];
  }
  let limpias = 0;
  if (raspador && !raspador.obra) {
    if (!J.cuantos('lasca_silex')) await buscar('lasca_silex');
    for (let k = 0; k < 5; k++) {
      const pd = await aEstacion(raspador, 'piel', 1, taller, 6);
      if (!pd.ok) break;
      await J.andar(raspador.x + 1, raspador.z);
      const q = await enEstacion(raspador, 'raspar_piel');
      if (!q.ok) { console.log(`     (no raspa: ${q.motivo})`); break; }
      limpias++;
      const lp = enLaMano('piel_limpia'); await J.andar(taller.x, taller.z); if (lp) await soltar(lp);
      for (const l of MANOS) if (J.inv.lugares[l] && J.inv.lugares[l].tipo === 'piel_limpia') await soltar(l);
    }
  }
  comprobar('con la lasca, en el raspador, deja limpias las 5 pieles', limpias === 5 && nEnSuelo('piel_limpia', taller, 4) + J.cuantos('piel_limpia') >= 5, `${limpias} · en el suelo ${nEnSuelo('piel_limpia', taller, 4)}`);
  // el zurrón: 2 pieles limpias y un cordel, en el banco
  {
    await J.andar(banco.x + 1, banco.z); await soltarManos(['lasca_silex']);
    const c = await cordel();
    await J.andar(banco.x + 1, banco.z);
    const d1 = c.ok ? await depositar(banco, 'cordel') : c;
    const d2 = d1.ok ? await aEstacion(banco, 'piel_limpia', 2, taller, 4) : d1;
    await J.andar(banco.x + 1, banco.z);
    const z = d2.ok ? await enEstacion(banco, 'zurron') : d2;
    comprobar('en el banco, con 2 pieles limpias y un cordel, se hace el zurrón', z.ok && J.cuantos('zurron') === 1, z.motivo || enMano());
    // se lo pone a la espalda si la tiene libre
    if (z.ok && !J.inv.lugares.espalda) { const lz = enLaMano('zurron'); const p = lz ? await J.objeto({ tipo: 'mover', de: lz, a: 'espalda' }) : { ok: false }; comprobar('se lo echa a la espalda', p.ok && J.inv.lugares.espalda?.tipo === 'zurron', p.motivo || ''); }
    else if (z.ok) { const lz = enLaMano('zurron'); if (lz) { await J.andar(taller.x, taller.z); await soltar(lz); } }
  }

  // ── 27e. El cubo lleno, la corteza de roble, las cubas y el cuero ──
  console.log('27e. Descorteza robles (6 de corteza), cava las cubas de curtido (2 de barro y 2 troncos cortos), las llena con el cubo y curte 3 pieles limpias: 3 cueros');
  // la corteza de roble: de robles en pie de por aquí, uno a uno (cada uno, una vez)
  await J.andar(taller.x, taller.z); await soltarManos(['lasca_silex']);
  const corteza = () => nEnSuelo('corteza_roble', taller, 4) + J.cuantos('corteza_roble');
  let robles = 0;
  for (const radio of [150, 400, 900]) {
    if (corteza() >= 6) break;
    const v = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + taller.x - radio, z0: O.z + taller.z - radio, x1: O.x + taller.x + radio, z1: O.z + taller.z + radio });
    const lista = v.arboles.map(e => ({ x: r2(e.x - O.x), z: r2(e.z - O.z), edad: e.edad, especie: e.especie })).filter(e => e.especie === 'roble').map(e => ({ ...e, id: idArbol(e.x, e.z) }))
      .filter(e => !s.objetos.tala.estado[e.id] && secoHasta(taller, e));
    for (const a of cerca(lista, taller).slice(0, 12)) {
      if (corteza() >= 6) break;
      if (MANOS.every(l => J.inv.lugares[l])) { await J.andar(taller.x, taller.z); await soltarManos(['lasca_silex']); }
      await J.andar(a.x + 1, a.z);
      const r = await J.objeto({ tipo: 'descortezar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad, especie: a.especie });
      if (r.ok) robles++;
    }
  }
  await J.andar(taller.x, taller.z); await soltarManos(['lasca_silex']);
  comprobar('descorteza robles en pie con la lasca: 6 de corteza de roble', corteza() >= 6, `${robles} robles, ${corteza()} de corteza`);
  // 2 troncos cortos: los del suelo de su tierra o, si no, tronza uno largo de un árbol adulto (como en la canoa)
  const cortos = () => nEnSuelo('tronco_corto', taller, 4);
  for (let k = 0; k < 3 && cortos() < 4; k++) {
    const o = cerca(visibles().filter(x => x.cosa.tipo === 'tronco_corto' && !x.arrastra && s.mundo.dentroDeTierra(x.x, x.z, yo) && dist(x, taller) > 4), taller)[0];
    if (!o) break;
    await soltarManos(['lasca_silex']); await J.andar(o.x + 0.5, o.z);
    const c = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    if (!c.ok) break;
    await J.andar(taller.x, taller.z); await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z });
  }
  comprobar('tiene troncos cortos en su taller (de los que tronzó)', cortos() >= 2, `${cortos()}`);
  // el palo cavador (de una rama) y 2 de barro de la ribera
  if (!(await buscar('palo_cavador'))) { await soltarManos(['lasca_silex']); await acopiar(['ramas'], 'rama', 1, taller); await deMano('palo_cavador'); }
  comprobar('lleva su palo cavador', J.cuantos('palo_cavador') >= 1, enMano());
  let rio = null;
  for (let rr = 0; rr < 3000 && !rio; rr += 25) for (let k = 0; k < 96; k++) {
    const x = taller.x + Math.cos(k / 96 * 2 * Math.PI) * rr, z = taller.z + Math.sin(k / 96 * 2 * Math.PI) * rr, X = x + O.x, Z = z + O.z;
    const { dm, ancho } = T.paisaje.rioCerca(X, Z, T.paisaje.riosEn(X - 20, Z - 20, X + 20, Z + 20));
    if (dm - ancho / 2 < 4 && T.alt(X, Z) > 0.5 && !T.aguaEn(x, z)) { rio = { x: r2(x), z: r2(z) }; break; }
  }
  comprobar('hay un río cerca de su tierra', !!rio);
  if (!rio) return;
  const barroAntes = nEnSuelo('barro', taller, 4);
  for (let v = 0; v < 2 && nEnSuelo('barro', taller, 4) < 2; v++) {
    await aLaMano('palo_cavador');
    const lo = MANOS.find(l => J.inv.lugares[l] && J.inv.lugares[l].tipo !== 'palo_cavador'); if (lo) await soltar(lo);
    const lista = alrededor(rio, 200).filter(q => q.tipo === 'barro' && !probados.has(q.id));
    let ok = false;
    for (const p of cerca(lista, J.pos).slice(0, 6)) { const q = await recoger(p); if (q.ok) { ok = true; break; } }
    if (!ok) break;
    await J.andar(taller.x, taller.z); await soltarManos(['palo_cavador', 'lasca_silex']);
  }
  comprobar('cava 2 de barro en la ribera con el palo cavador y lo trae', nEnSuelo('barro', taller, 4) >= 2, `${barroAntes} → ${nEnSuelo('barro', taller, 4)}`);
  // las cubas: el barro y 2 troncos cortos, junto a ellas, y el palo cavador en la mano
  const sitioCub = libreEn(taller, 25, 2) || { x: taller.x, z: taller.z + 4 };
  for (let k = 0; k < 2; k++) {
    const tr = enSuelo('tronco_corto', taller, 4)[0]; if (!tr) break;
    await soltarManos(['palo_cavador', 'lasca_silex']); await J.andar(tr.x + 0.5, tr.z);
    const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    if (!c.ok) break;
    await J.andar(sitioCub.x + 1, sitioCub.z); await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z });
  }
  await J.andar(taller.x, taller.z); await soltarManos(['palo_cavador']);
  await cogerSuelo('barro', taller, 4, 2); await J.andar(sitioCub.x + 1, sitioCub.z); await soltarManos(['palo_cavador']);
  await aLaMano('palo_cavador');
  const cub = await levantar('cubas_curtido', sitioCub.x, sitioCub.z);
  comprobar('cava las cubas de curtido en su tierra: 2 de barro y 2 troncos cortos, con el palo cavador', cub.ok && cub.datos && cub.datos.terminada, cub.motivo || '');
  const cubas = cub.ok && s.objetos.fab.estaciones[cub.id];
  // el cubo: el suyo (del pozo) o uno nuevo en el banco con un tronco corto
  if (!(await buscar('cubo', [[rio, 30]])) && !(await buscar('cubo_agua'))) {
    await J.andar(banco.x + 1, banco.z); await soltarManos();
    const tc = cortos() ? await aEstacion(banco, 'tronco_corto', 1, taller) : { ok: false, motivo: 'sin tronco corto' };
    if (tc.ok) await enEstacion(banco, 'cubo');
  }
  comprobar('tiene su cubo de madera', J.cuantos('cubo') + J.cuantos('cubo_agua') >= 1, enMano());
  let cueros = 0;
  if (cubas && !cubas.obra) {
    for (let k = 0; k < 3; k++) {
      // lleno en el río y vaciado en las cubas
      await aLaMano(J.cuantos('cubo_agua') ? 'cubo_agua' : 'cubo');
      await soltarManos(['cubo', 'cubo_agua']);
      if (enLaMano('cubo')) { await J.andar(rio.x, rio.z); const ll = await J.objeto({ tipo: 'llenar_cubo' }); if (!ll.ok) { console.log(`     (no llena el cubo: ${ll.motivo})`); break; } }
      await J.andar(cubas.x + 1, cubas.z);
      const lv = await J.objeto({ tipo: 'llenar_estacion', estacion: cubas.id, x: J.pos.x, z: J.pos.z });
      if (k === 0) comprobar('llena el cubo en el río y lo vacía en las cubas', lv.ok && (s.objetos.fab.estaciones[cubas.id].deposito.agua || 0) >= 1, lv.motivo || '');
      if (!lv.ok) break;
      await soltarManos();
      const p1 = await aEstacion(cubas, 'piel_limpia', 1, taller, 4);
      const p2 = p1.ok ? await aEstacion(cubas, 'corteza_roble', 2, taller, 4) : p1;
      await J.andar(cubas.x + 1, cubas.z);
      const f = p2.ok ? await J.objeto({ tipo: 'fabricar', receta: 'curtir', estacion: cubas.id, x: J.pos.x, z: J.pos.z }) : p2;
      if (!f.ok) { console.log(`     (no la pone a curtir: ${f.motivo})`); break; }
      cueros++;
    }
    comprobar('pone a curtir 3 pieles limpias, con su corteza y su agua', cueros === 3, `${cueros}`);
    await soltarManos();
    const g0 = await J.objeto({ tipo: 'recoger_fabricado', estacion: cubas.id, x: J.pos.x, z: J.pos.z });
    if (!MUTAR) adelantar('curtir');
    let g = { ok: true };
    for (let k = 0; k < 3 && g.ok; k++) {
      if (MANOS.every(l => J.inv.lugares[l]) && J.cuantos('cuero') % 3 === 0) { await J.andar(taller.x, taller.z); await soltarManos(); await J.andar(cubas.x + 1, cubas.z); }
      g = await J.objeto({ tipo: 'recoger_fabricado', estacion: cubas.id, x: J.pos.x, z: J.pos.z });
    }
    const nCuero = J.cuantos('cuero') + nEnSuelo('cuero', taller, 4) + nEnSuelo('cuero', cubas, 3);
    comprobar('en remojo aún no; pasados los días, saca 3 cueros de las cubas', !g0.ok && nCuero >= 3, `${g0.motivo || 'lo da antes'} · ${nCuero} cueros · ${g.motivo || ''}`);
    await J.andar(taller.x, taller.z); await soltarManos();
    if (nEnSuelo('cuero', cubas, 3)) { await cogerSuelo('cuero', cubas, 3); await J.andar(taller.x, taller.z); await soltarManos(); }
  }

  // ── 27f. El huso y el hilo ──
  console.log('27f. Se hace el huso (una vara y una piedra) e hila 2 de fibra: un ovillo de hilo');
  await J.andar(taller.x, taller.z); await soltarManos();
  if (!nEnSuelo('vara', taller, 4)) { const t = await talarJoven(taller); if (t.ok) { await soltarManos(); await cogerSuelo('vara', t.a, 6, 1); await J.andar(taller.x, taller.z); await soltarManos(); } }
  if (!nEnSuelo('piedra', taller, 4)) await acopiar(['piedra'], 'piedra', 1, taller);
  const hu = await deMano('huso');
  comprobar('con las manos, de una vara y una piedra, el huso', hu.ok && J.cuantos('huso') === 1, hu.motivo || '');
  if (hu.ok) {
    const aqui = { ...J.pos };
    for (const radio of [250, 500, 900]) {
      if (J.cuantos('fibra') >= 2) break;
      const lista = alrededor(aqui, radio).filter(q => ['ortiga', 'hierba_larga'].includes(q.tipo));
      for (let n = 0; n < 30 && J.cuantos('fibra') < 2; n++) { const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0]; if (!p) break; if (MANOS.every(l => J.inv.lugares[l])) await soltarManos(['huso']); await recoger(p); }
    }
    await J.andar(taller.x, taller.z);
    const hi = await deMano('hilar');
    comprobar('llevando el huso, hila 2 de fibra: un ovillo de hilo (el huso no se gasta)', hi.ok && J.cuantos('hilo') === 1 && J.cuantos('huso') === 1, hi.motivo || '');
  }

  // ── 27g. Los zapatos y el cinto de cuero, en el banco ──
  console.log('27g. En el banco, los zapatos de cuero (1 cuero y el hilo) y el cinto de cuero (2 cueros y una rama)');
  {
    await J.andar(banco.x + 1, banco.z);
    const d1 = await depositar(banco, 'hilo');
    await soltarManos();
    const d2 = d1.ok ? await aEstacion(banco, 'cuero', 1, taller, 4) : d1;
    await J.andar(banco.x + 1, banco.z);
    const z = d2.ok ? await enEstacion(banco, 'zapatos_cuero') : d2;
    comprobar('cose los zapatos de cuero en el banco', z.ok && J.cuantos('zapatos_cuero') === 1, z.motivo || '');
    if (z.ok) { const lz = enLaMano('zapatos_cuero'); await J.andar(taller.x, taller.z); if (lz) await soltar(lz); }
    if (!nEnSuelo('rama', taller, 4)) await acopiar(['ramas'], 'rama', 1, taller);
    const d3 = await aEstacion(banco, 'cuero', 2, taller, 4);
    const d4 = d3.ok ? await aEstacion(banco, 'rama', 1, taller, 4) : d3;
    await J.andar(banco.x + 1, banco.z);
    const c = d4.ok ? await enEstacion(banco, 'cinto_cuero') : d4;
    comprobar('hace el cinto de cuero en el banco (con la hebilla tallada de la rama)', c.ok && J.cuantos('cinto_cuero') === 1, c.motivo || '');
  }

  // ── 27h. La carbonera y el carbón ──
  console.log('27h. Parte 2 troncos cortos con el hacha (10 leñas), levanta la carbonera, la enciende y, pasadas las horas, saca 4 carbones');
  await J.andar(taller.x, taller.z); await soltarManos();
  const sitioCarb = libreEn(taller, 30, 2) || { x: taller.x - 4, z: taller.z - 4 };
  const lena = () => nEnSuelo('lena', sitioCarb, 4);
  for (let k = 0; k < 3 && lena() < 10; k++) {
    // un tronco corto (del taller, o de los de su tierra), al sitio de la carbonera
    let tr = enSuelo('tronco_corto', taller, 4)[0] || cerca(visibles().filter(x => x.cosa.tipo === 'tronco_corto' && !x.arrastra && s.mundo.dentroDeTierra(x.x, x.z, yo) && dist(x, sitioCarb) > 3), sitioCarb)[0];
    if (!tr) break;
    await soltarManos(); await J.andar(tr.x + 0.5, tr.z);
    const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    if (!c.ok) break;
    await J.andar(sitioCarb.x + 2, sitioCarb.z); const sq = await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z });
    await hachaALaMano();
    const id = sq.ok ? sq.datos.objeto : null, o = id && visibles().find(x => x.id === id);
    if (!o) break;
    await J.andar(o.x + 0.6, o.z);
    let tz, golpes = 0;
    do { tz = await J.objeto({ tipo: 'trocear', objeto: o.id, x: J.pos.x, z: J.pos.z }); golpes++; await pausa(850); } while (tz.ok && visibles().some(x => x.id === o.id) && golpes < 30);
    if (!tz.ok) { console.log(`     (no lo parte: ${tz.motivo})`); break; }
    // la leña que cae, junto al sitio de la carbonera
    await soltarManos();
    for (let v = 0; v < 4 && nEnSuelo('lena', o, 4) && dist(o, sitioCarb) > 2.5; v++) { await cogerSuelo('lena', o, 4, 3); await J.andar(sitioCarb.x + 1, sitioCarb.z); await soltarManos(); }
  }
  comprobar('parte troncos cortos con el hacha: 10 leñas junto al sitio de la carbonera', lena() >= 10, `${lena()}`);
  await J.andar(sitioCarb.x + 1, sitioCarb.z); await soltarManos();
  await buscar('palo_cavador'); await J.andar(sitioCarb.x + 1, sitioCarb.z);
  const car = await levantar('carbonera', sitioCarb.x, sitioCarb.z);
  comprobar('levanta la carbonera: 10 leñas cubiertas de tierra, cavando con el palo cavador', car.ok && car.datos && car.datos.terminada, car.motivo || '');
  const carbonera = car.ok && s.objetos.fab.estaciones[car.id];
  if (carbonera && !carbonera.obra) {
    // la yesca (de un hongo yesquero o de fibra) dejada en ella, y el taladro de fuego en la mano
    await soltarManos(['palo_cavador']);
    if (!(await buscar('yesca', fogon ? [[fogon, 20]] : []))) { let n = 0; while (J.cuantos('fibra') < 2 && n++ < 8) { const p = cerca(alrededor(J.pos, 300).filter(q => ['ortiga', 'hierba_larga'].includes(q.tipo) && !probados.has(q.id)), J.pos)[0]; if (!p) break; await recoger(p); } await J.andar(sitioCarb.x + 1, sitioCarb.z); await deMano('yesca'); }
    if (!(await buscar('taladro_fuego', fogon ? [[fogon, 20]] : []))) {
      await soltarManos(); await acopiar(['ramas'], 'rama', 2, sitioCarb); const c = await cordel(); await J.andar(sitioCarb.x + 1, sitioCarb.z); await soltarManos(); if (c.ok) await deMano('taladro_fuego');
    }
    await J.andar(carbonera.x + 1, carbonera.z);
    const dy = await depositar(carbonera, 'yesca');
    await aLaMano('taladro_fuego');
    const en = dy.ok ? await J.objeto({ tipo: 'fabricar', receta: 'carbonear', estacion: carbonera.id, x: J.pos.x, z: J.pos.z }) : dy;
    comprobar('deja la yesca en la carbonera y la enciende con el taladro de fuego', en.ok, en.motivo || '');
    const g0 = await J.objeto({ tipo: 'recoger_fabricado', estacion: carbonera.id, x: J.pos.x, z: J.pos.z });
    adelantar('carbonear');
    await soltarManos();
    const g = await J.objeto({ tipo: 'recoger_fabricado', estacion: carbonera.id, x: J.pos.x, z: J.pos.z });
    const carbon = J.cuantos('carbon') + nEnSuelo('carbon', carbonera, 3);
    comprobar('arde horas; pasadas, saca los 4 carbones y la carbonera se deshace', !g0.ok && g.ok && carbon >= 4 && !s.objetos.fab.estaciones[carbonera.id], `${g0.motivo || 'los da antes'} · ${carbon} carbones · ${g.motivo || ''}`);
  }
  await soltarManos();
}

// seguir desde lo guardado: KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_oficios.mjs
if (process.argv[1] && process.argv[1].endsWith('recorrido_oficios.mjs') && process.env.KINHOLD_RECORRIDO_DESDE) {
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
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-oficios-')); cpSync(desde, dir, { recursive: true });
  let ok = 0, mal = 0;
  const comprobar = (n, c, d = '') => { if (c) ok++; else mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
  const pausa = (ms) => new Promise(r => setTimeout(r, ms / RELOJ));
  const cerca = (l, p) => l.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const s = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), terreno: T, ticoNecesidades: 1000 / RELOJ, usoRopa: 120000, horaMundo: () => msDeHora(12) });
  const puerto = await s.listo;
  const J = await new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}/?ficha=${meta.ficha}`);
    const c = { ws, esperas: [], id: 0, inv: null, pos: null, liebres: new Map() };
    c.esperar = (cond, ms = 5000) => new Promise((r, f) => { const t = setTimeout(() => f(new Error('tiempo agotado')), ms); c.esperas.push({ cond, r: (m) => { clearTimeout(t); r(m); } }); });
    c.objeto = (accion) => { const id = ++c.id; const p = c.esperar(m => m.tipo === 'resultado_objeto' && m.id === id); ws.send(JSON.stringify({ tipo: 'objeto', id, accion })); return p; };
    c.accion = async (accion) => { const id = ++c.id + 100000; const p = c.esperar(m => m.tipo === 'resultado' && m.id === id); const q = USAN_INVENTARIO.has(accion.tipo) ? c.esperar(m => m.tipo === 'inventario') : null; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return q ? Promise.all([p, q]).then(([r]) => r) : p; };
    c.estar = (x, z) => { c.pos = { x, z }; ws.send(JSON.stringify({ tipo: 'estado', x, y: T.suelo(x, z), z, giro: 0, anim: 'andar' })); };
    c.andar = async (x, z) => { for (let i = 0; i < 100000; i++) { const paso = c.nec && c.nec.cansancio >= 90 ? 0.36 : 0.6; const { x: x0, z: z0 } = c.pos, d = Math.hypot(x - x0, z - z0); if (d <= paso) { c.estar(x, z); await pausa(100); break; } c.estar(x0 + (x - x0) * paso / d, z0 + (z - z0) * paso / d); await pausa(100); } await pausa(150); };
    c.cuantos = (tipo) => (c.inv ? c.inv.cuantos(tipo) : 0);
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if ((m.tipo === 'bienvenida' || m.tipo === 'inventario' || m.tipo === 'resultado_objeto') && m.inventario) c.inv = Inventario.importarJugador(m.inventario); if (m.necesidades && (m.tipo === 'bienvenida' || m.tipo === 'necesidades')) c.nec = m.necesidades; if (m.tipo === 'fauna') { for (const f of m.liebres) c.liebres.set(f.id, f); for (const id of m.fuera) c.liebres.delete(id); } c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    const b = c.esperar(m => m.tipo === 'bienvenida', 20000);
    ws.on('open', async () => { c.bienvenida = await b; c.pos = c.bienvenida.posicion ? { x: c.bienvenida.posicion.x, z: c.bienvenida.posicion.z } : meta.pos; listo(c); });
    ws.on('error', fallo);
  });
  // (KINHOLD_OFICIOS_GUARDAR_CAZA=<carpeta>: guarda el mundo después de cazar y sale; con KINHOLD_RECORRIDO_DESDE=<carpeta>
  // se sigue desde ahí, sin volver a cazar: ya tiene las pieles)
  const guardarTrasCaza = process.env.KINHOLD_OFICIOS_GUARDAR_CAZA ? async () => {
    const destino = process.env.KINHOLD_OFICIOS_GUARDAR_CAZA, ahora = Date.now();
    J.ws.close(); await pausa(300); await s.cerrar();
    cpSync(dir, destino, { recursive: true });
    const { writeFileSync } = await import('fs');
    writeFileSync(join(destino, 'jugador.json'), JSON.stringify({ ...meta, ahora, pos: J.pos }));
    console.log(`(guardado en ${destino}: después de cazar)`);
    process.exit(0);
  } : null;
  try { await oficios({ J, s, T, O, comprobar, pausa, cerca, RELOJ, sitioCaza: meta.sitioCaza, guardarTrasCaza }); }
  catch (e) { comprobar('los oficios llegan al final', false, e && e.stack); }
  J.ws.close(); await s.cerrar();
  console.log(`\n${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
}
