// Recorrido de jugador del hierro (P10, «Recorrido de jugador del hierro, sin arcón»): el paso 28 de
// pruebas/prueba_recorrido.mjs, el mismo jugador, sin arcón y con lo que recoge, detrás de los oficios. Con la pala de
// madera y una criba (2 mimbres de la ribera y una vara, en el banco) criba hierro de pantano en las manchas de agua
// rojiza de la vega; hace carbón en carboneras; levanta el horno de reducción y saca lupias; hace el fuelle (2 cueros), la
// fragua y barras de hierro; en ella, el hacha, el pico, la sierra y los clavos; sierra tablas, rompe una roca grande con
// el pico, cava arcilla, levanta el horno cerámico, cuece tejas y pone un suelo de tablas y un tejado de teja.
// Cadena: mineral de hierro ← mancha de la vega (pala de madera ← tronco corto; criba ← 2 mimbres y una vara); carbón ←
// carbonera (10 leñas ← 2 troncos cortos); lupia ← horno de reducción (20 barros, 10 piedras, 4 carbones) con 3 minerales
// y 4 carbones; fuelle ← 2 cueros (cubas) y 2 varas; fragua ← 12 piedras, 4 barros y el fuelle; barra ← lupia y carbón
// (mazo de piedra); hacha, pico ← barra y mango (vara); sierra ← 2 barras y 2 mangos; clavos ← barra; tablas ← tronco
// corto (sierra); arcilla ← banco de la ribera (pala); tejas ← 2 arcillas en el horno cerámico (6 arcillas, 10 piedras).
// Para trabajar en esta parte sin repetir lo de antes: KINHOLD_RECORRIDO_GUARDAR_HIERRO=<carpeta> node
// pruebas/prueba_recorrido.mjs guarda el mundo después de los oficios; KINHOLD_RECORRIDO_DESDE=<carpeta> node
// pruebas/recorrido_hierro.mjs sigue desde ahí. Con MUTAR=1 además, las manchas no dan nada: debe FALLAR.
// Decisiones provisionales (anotadas en el diario):
//  - Lo que tarda horas de verdad (la carbonera, el horno de reducción, la hornada de tejas) se adelanta como en los
//    oficios: la prueba pone en ya pasada la hora a la que termina lo que encargó este jugador. No le da nada.
//  - Los puestos (horno de reducción, fragua, horno cerámico), junto a su banco de tronco, en su tierra.
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { vegetacionEn } from '../src/logica/vegetacion.js';
import { idArbol } from '../src/logica/tala.js';
import { idRoca, rompible, deCantera, medidaRoca, golpesRoca, bloquesRoca } from '../src/logica/recoleccion.js';
import { hayAguaCerca } from '../src/logica/necesidades.js';
import { campoEn } from '../src/logica/campos.js';
import { VIDA as VIDA_DESGASTE } from '../src/logica/desgaste.js';
import { ESTACIONES } from '../src/logica/fabricacion.js';
import { centroMundo, clave as claveDe } from '../src/logica/construccion.js';
import { PIEZAS, ALTURA } from '../src/logica/piezas.js';

const MANOS = ['mano:der', 'mano:izq'];
// Con MUTAR=1 (solo al seguir desde lo guardado) las manchas de la vega no dan mineral: debe FALLAR.
const MUTAR = process.env.MUTAR === '1' && !!process.env.KINHOLD_RECORRIDO_DESDE;

export async function hierro({ J, s, T, O, comprobar, pausa, cerca, RELOJ = 8, guardar = null, tallerGuardado = null, desde = null }) {
  const yo = J.bienvenida.autor;
  const r2 = v => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const enMano = () => MANOS.map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
  const enLaMano = (tipo) => MANOS.find(l => J.inv.lugares[l]?.tipo === tipo);
  const soltar = (l) => J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
  const soltarManos = async (salvo = []) => { for (const l of MANOS) if (J.inv.lugares[l] && !salvo.includes(J.inv.lugares[l].tipo)) await soltar(l); };
  // una mano libre: si las lleva llenas, deja la de lo que no es herramienta (la lasca, el cubo, el huso… se quedan)
  const HERRAMIENTAS = ['lasca_silex', 'cubo', 'cubo_agua', 'huso', 'taladro_fuego', 'palo_cavador', 'hacha_piedra', 'lanza_endurecida', 'pala_madera', 'criba', 'mazo_piedra', 'hacha_hierro', 'pico', 'sierra'];
  const manoLibre = async () => {
    const libre = MANOS.find(l => !J.inv.lugares[l]);
    if (libre) return libre;
    const l = MANOS.find(x => !HERRAMIENTAS.includes(J.inv.lugares[x].tipo)) || 'mano:izq';
    await soltar(l);
    return l;
  };
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
  // (de cada sitio donde lo lleva, lo que haya en él, hasta cantidad)
  const depositar = async (est, tipo, cantidad = 1) => {
    let q = { ok: false, motivo: `no lleva ${tipo}` }, puestos = 0;
    for (const l of J.inv.rutasCon(tipo)) {
      if (puestos >= cantidad) break;
      const n = Math.min(cantidad - puestos, (J.inv.buscar(l).cosa || { n: 0 }).n || 0);
      if (n < 1) continue;
      q = await J.objeto({ tipo: 'depositar_estacion', estacion: est.id, de: l, cantidad: n, x: J.pos.x, z: J.pos.z });
      if (!q.ok) return q;
      puestos += n;
    }
    return q.ok ? { ...q, datos: { ...(q.datos || {}), dejado: { [tipo]: puestos } } } : q;
  };
  // lo del suelo de al lado de la estación, a ella (de una mano en una mano, hasta n)
  const aEstacion = async (est, tipo, n, de = est, d = 4) => {
    let puestos = 0;
    for (let k = 0; k < 12 && puestos < n; k++) {
      // (lo que no se apila en una mano, como los mangos, va de uno en uno: con uno cogido, a la estación)
      if (!J.cuantos(tipo)) { const l = await manoLibre(); if (!(await cogerSuelo(tipo, de, d, Math.min(3, n - puestos), l)) && !J.cuantos(tipo)) break; }
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
  // lo de su coste que esté por el suelo de alrededor (hasta 10 m), junto a donde se pone (entregar coge lo que hay a 2 m)
  const juntar = async (pide, p) => {
    for (const [t, n] of Object.entries(pide)) for (let v = 0; v < 12 && nEnSuelo(t, p, 1.2) + J.cuantos(t) < n; v++) {
      const o = cerca(visibles().filter(x => x.cosa.tipo === t && !x.arrastra && dist(x, p) > 1.2 && dist(x, p) < 10), p)[0];
      if (!o) break;
      const l = MANOS.find(m => !J.inv.lugares[m]) || (await manoLibre());
      await J.andar(o.x + 0.3, o.z);
      const q = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(o.cosa.n, 3, n - nEnSuelo(t, p, 1.2) - J.cuantos(t)), a: l, x: J.pos.x, z: J.pos.z });
      if (!q.ok) { console.log(`     (no coge ${t} para juntarlo: ${q.motivo})`); break; }
      await J.andar(p.x, p.z); await soltar(l);
    }
  };
  const levantar = async (estacion, x, z) => {
    if (ESTACIONES[estacion]) await juntar(Object.fromEntries(Object.entries(ESTACIONES[estacion].coste).filter(([t]) => t !== 'fuelle')), { x: r2(x + 1), z });
    await J.andar(x + 1, z);
    const rc = await J.objeto({ tipo: 'colocar_estacion', estacion, x, z });
    if (!rc.ok) return rc;
    const id = rc.datos.estacion || rc.datos.id;
    let re = await J.objeto({ tipo: 'entregar_estacion', estacion: id, x: J.pos.x, z: J.pos.z });
    // (lo que se le quedó algo lejos en el suelo: a las manos, de lo que le falta, y otra vez)
    for (let v = 0; v < 8 && !re.ok && s.objetos.fab.estaciones[id]?.obra; v++) {
      const e = s.objetos.fab.estaciones[id], falta = Object.entries(ESTACIONES[e.tipo].coste).filter(([t, n]) => n > (e.obra.entregado[t] || 0) && !J.cuantos(t));
      if (!falta.length) break;
      await soltarManos(['pala_madera', 'palo_cavador', 'fuelle']);
      for (const [t, n] of falta) if (MANOS.some(l => !J.inv.lugares[l])) await cogerSuelo(t, { x, z }, 8, n - (e.obra.entregado[t] || 0));
      if (!falta.some(([t]) => J.cuantos(t))) break;
      await J.andar(x + 1, z);
      re = await J.objeto({ tipo: 'entregar_estacion', estacion: id, x: J.pos.x, z: J.pos.z });
    }
    if (!re.ok && s.objetos.fab.estaciones[id]?.obra && Object.entries(ESTACIONES[s.objetos.fab.estaciones[id].tipo].coste).some(([t, n]) => n > (s.objetos.fab.estaciones[id].obra.entregado[t] || 0))) return { ...re, id };
    let rt = { ok: true, datos: {} };
    for (let i = 0; i < 20 && rt.ok && !rt.datos.terminada; i++) rt = await J.objeto({ tipo: 'trabajar_estacion', estacion: id, segundos: 5, x: J.pos.x, z: J.pos.z });
    return { ...rt, id };
  };

  const M = s.mundo.mojonDe(yo);
  const banco = M && cerca(suyas('banco_tronco'), M)[0];
  const tallar = M && cerca(suyas('piedra_tallar'), M)[0];
  console.log('28. El hierro (P10): la criba y el hierro de pantano; el carbón; el horno de reducción y las lupias; el fuelle, la fragua y las barras; el hacha, el pico, la sierra y los clavos; las tablas; la roca grande; la arcilla, el horno cerámico y las tejas; el suelo de tablas y el tejado de teja');
  comprobar('28. tiene su tierra, su banco de tronco y su piedra de tallar', !!M && !!banco && !!tallar, JSON.stringify({ yo, M, banco: banco && [banco.x, banco.z] }));
  if (!M || !banco || !tallar) return;
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
    // (con las manos llenas, deja aquí lo de una mano mientras va a por bayas, y luego vuelve a cogerlo)
    let dejada = null;
    if (nec().hambre > 60) {
      if (MANOS.every(l => J.inv.lugares[l])) {
        const l = MANOS.find(x => !HERRAMIENTAS.includes(J.inv.lugares[x].tipo)) || 'mano:izq', tipo = J.inv.lugares[l].tipo;
        const q = await soltar(l);
        if (q.ok) dejada = { id: q.datos.objeto, a: l, x: J.pos.x, z: J.pos.z, tipo };
      }
      for (const m of cerca(alrededor(J.pos, 200).filter(p => (p.tipo === 'bayas' || p.tipo === 'setas') && !probados.has(p.id)), J.pos).slice(0, 16)) {
        if (nec().hambre <= 40) break;
        if (MANOS.every(l => J.inv.lugares[l])) await manoLibre();
        const rb = await recoger(m);
        if (rb.ok) { const tipo = m.tipo === 'bayas' ? 'bayas' : 'setas'; for (let i = 0; i < 6 && J.cuantos(tipo) && nec().hambre > 20; i++) await J.objeto({ tipo: 'comer', objeto: tipo }); }
      }
    }
    if (dist(J.pos, desde) > 1) await J.andar(desde.x, desde.z);
    if (dejada) {
      if (J.inv.lugares[dejada.a]) await soltar(dejada.a);
      await J.andar(dejada.x, dejada.z);
      await J.objeto({ tipo: 'coger_suelo', objeto: dejada.id, a: dejada.a, x: J.pos.x, z: J.pos.z });
    }
  };
  // (si se muere por el camino, que se diga: le despojan de lo que lleva en las manos)
  const muertes = [];
  J.ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'muerte') { muertes.push(m.motivo); console.log(`     (se muere: ${m.motivo} · ${JSON.stringify(nec())})`); } });
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

  await cuidarse();
  const taller = tallerGuardado || libreEn(banco, 40) || { x: r2(banco.x - 2), z: r2(banco.z + 2) };
  // (para trabajar en un paso sin repetir los de antes: KINHOLD_HIERRO_GUARDAR=<paso>:<carpeta>, solo al seguir desde lo guardado)
  const punto = async (paso) => { if (guardar) await guardar(paso, { taller }); };
  // (al seguir desde lo guardado antes de un paso, lo de los pasos de antes ya está hecho: no se repite)
  const ya = (paso) => !!desde && paso <= desde;
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
  // (si la perdió, por ejemplo junto al río, fuera de su tierra, donde lo soltado desaparece a la hora, se hace otra en
  // su piedra de tallar: una piedra, una rama y 2 cordeles)
  let hachasNuevas = 0;
  const hacerHacha = async () => {
    const sitio = { x: r2(tallar.x + 1), z: tallar.z };
    await J.andar(sitio.x, sitio.z); await soltarManos();
    await acopiar(['piedra'], 'piedra', 1, sitio); await acopiar(['ramas'], 'rama', 1, sitio);
    for (const t of ['piedra', 'rama']) { await cogerSuelo(t, sitio, 3, 1); await J.andar(sitio.x, sitio.z); const d = await depositar(tallar, t); if (!d.ok) return false; }
    for (let k = 0; k < 2; k++) { const c = await cordel(); await J.andar(sitio.x, sitio.z); if (!c.ok || !(await depositar(tallar, 'cordel')).ok) return false; }
    const h = await enEstacion(tallar, 'hacha_piedra');
    if (h.ok) hachasNuevas++;
    console.log(`     (no encuentra su hacha: se hace otra en su piedra de tallar${h.ok ? '' : ' · ' + h.motivo})`);
    return h.ok;
  };
  const hachaALaMano = async () => {
    if (await aLaMano('hacha_piedra')) return true;
    if (!(await buscar('hacha_piedra'))) await hacerHacha();
    return aLaMano('hacha_piedra');
  };
  // talar el árbol joven más cercano a p que nadie ha tocado (fuera de los campos y lejos de las obras) y limpiarlo
  const talarJoven = async (p, edad = 'joven') => {
    await soltarManos(['hacha_piedra']);
    if (!(await hachaALaMano())) return { ok: false, motivo: `no encuentra su hacha (en las manos ${enMano()})` };
    await repararHacha(edad === 'adulto' ? 80 : 14);
    const arboles = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - 150, z0: O.z + p.z - 150, x1: O.x + p.x + 150, z1: O.z + p.z + 150 }).arboles
      .map(a => ({ x: a.x - O.x, z: a.z - O.z, edad: a.edad })).map(a => ({ ...a, id: idArbol(a.x, a.z) }))
      .filter(a => a.edad === edad && !s.objetos.tala.estado[a.id] && !campoEn(s.mundo, a.x, a.z) && secoHasta(J.pos, a) && !s.mundo.construcciones.some(c => [...c.piezas.values()].length && dist({ x: c.ox, z: c.oz }, a) < 12));
    const a = cerca(arboles, p)[0];
    if (!a) return { ok: false, motivo: `no hay árboles (${edad}) cerca` };
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
  const LUPIAS = 5;   // una barra para el hacha, otra para el pico, dos para la sierra y una para los clavos
  // el río más cercano a su taller (la ribera: mimbre, barro, arcilla)
  let rio = null;
  for (let rr = 0; rr < 3000 && !rio; rr += 25) for (let k = 0; k < 96; k++) {
    const x = taller.x + Math.cos(k / 96 * 2 * Math.PI) * rr, z = taller.z + Math.sin(k / 96 * 2 * Math.PI) * rr, X = x + O.x, Z = z + O.z;
    const { dm, ancho } = T.paisaje.rioCerca(X, Z, T.paisaje.riosEn(X - 20, Z - 20, X + 20, Z + 20));
    if (dm - ancho / 2 < 4 && T.alt(X, Z) > 0.5 && !T.aguaEn(x, z)) { rio = { x: r2(x), z: r2(z) }; break; }
  }
  comprobar('hay un río cerca de su tierra', !!rio, rio ? `a ${Math.round(dist(rio, taller))} m de su taller` : '');
  if (!rio) return;

  // troncos cortos: los del suelo de su tierra o, si no hay, tala un árbol adulto y tronza el tronco largo
  const cortosEnTierra = () => visibles().filter(x => x.cosa.tipo === 'tronco_corto' && !x.arrastra && s.mundo.dentroDeTierra(x.x, x.z, yo));
  let motivoCortos = '';
  const masCortos = async () => {
    await cuidarse();
    const t = await talarJoven(taller, 'adulto');
    if (!t.ok) { motivoCortos = t.motivo; return false; }
    const largo = enSuelo('tronco_largo', t.a, 15)[0];
    if (!largo) { motivoCortos = 'el adulto no ha dejado tronco largo'; return false; }
    await repararHacha(60);
    await J.andar(largo.x + 0.6, largo.z);
    let tz, golpes = 0;
    do { tz = await J.objeto({ tipo: 'trocear', objeto: largo.id, x: J.pos.x, z: J.pos.z }); golpes++; await pausa(850); } while (tz.ok && enSuelo('tronco_corto', largo, 5).length === 0 && golpes < 90);
    if (!tz.ok) { motivoCortos = `no lo tronza: ${tz.motivo}`; return false; }
    return true;
  };
  // un tronco corto al hombro hasta el banco y, en él, la receta
  const hacerDeTronco = async (receta) => {
    let o = cerca(cortosEnTierra(), banco)[0];
    if (!o && (await masCortos())) o = cerca(cortosEnTierra(), banco)[0];
    if (!o) return { ok: false, motivo: `sin troncos cortos: ${motivoCortos}` };
    await soltarManos(); await J.andar(o.x + 0.5, o.z);
    const c = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    if (!c.ok) return c;
    await J.andar(banco.x + 1, banco.z);
    const d = await J.objeto({ tipo: 'depositar_estacion', estacion: banco.id, de: 'hombro', cantidad: 1, x: J.pos.x, z: J.pos.z });
    return d.ok ? enEstacion(banco, receta) : d;
  };

  // ── 28a. La pala de madera y la criba ──
  console.log('28a. Coge su pala de madera y se hace una criba en el banco: 2 mimbres de la ribera (con la lasca) y una vara');
  let q = { ok: true };
  if (!(await buscar('pala_madera'))) q = await hacerDeTronco('pala_madera');
  comprobar('tiene su pala de madera (la del pozo o, si no la encuentra, otra de un tronco corto en el banco)', J.cuantos('pala_madera') >= 1, q.motivo || enMano());
  await J.andar(taller.x, taller.z); await soltarManos();
  if (!(await buscar('criba'))) {
    // la vara: de su taller o de un árbol joven
    if (!(await buscar('vara'))) { const t = await talarJoven(taller); if (t.ok) { await soltarManos(); await cogerSuelo('vara', t.a, 6, 1); } }
    await J.andar(taller.x, taller.z); await soltarManos();
    // los mimbres: en la ribera, cortados con la lasca
    await buscar('lasca_silex'); await aLaMano('lasca_silex'); await J.andar(rio.x, rio.z);
    const mimbreras = cerca(alrededor(rio, 400).filter(p => p.tipo === 'mimbre'), rio);
    let motivoMimbre = mimbreras.length ? '' : 'no hay mimbreras cerca del río';
    for (const p of mimbreras) {
      if (J.cuantos('mimbre') >= 2) break;
      const rm = await recoger(p);
      if (!rm.ok) motivoMimbre = rm.motivo;
    }
    comprobar('corta 2 mimbres en la ribera con la lasca', J.cuantos('mimbre') >= 2, `${J.cuantos('mimbre')}${motivoMimbre ? ' · ' + motivoMimbre : ''}`);
    await J.andar(taller.x, taller.z); await soltarManos(['mimbre']);
    await aLaMano('vara', taller);
    await J.andar(banco.x + 1, banco.z);
    const d1 = await depositar(banco, 'mimbre', 2), d2 = d1.ok ? await depositar(banco, 'vara', 1) : d1;
    q = d2.ok ? await enEstacion(banco, 'criba') : d2;
    comprobar('hace la criba en el banco: 2 mimbres y una vara', q.ok && J.cuantos('criba') === 1, q.motivo || enMano());
  } else comprobar('ya tiene una criba', true);

  // ── 28b. El hierro de pantano ──
  console.log(`28b. Con la pala y la criba criba las manchas de agua rojiza de la vega hasta juntar ${3 * LUPIAS} de mineral de hierro en su taller`);
  const mineral = () => nEnSuelo('mineral_hierro', taller, 5) + J.cuantos('mineral_hierro');
  // (las manchas, en la vega del río: se buscan alrededor de la ribera, cada vez más lejos, hasta tener unas cuantas)
  let manchas = [];
  for (const radio of [200, 400]) { manchas = cerca(alrededor(rio, radio).filter(p => p.tipo === 'hierro_pantano'), taller); if (manchas.length >= 8) break; }
  comprobar('hay manchas de hierro de pantano en la vega', manchas.length > 0, manchas.length ? `${manchas.length}; la más cercana a ${Math.round(dist(manchas[0], taller))} m` : '');
  // (primero criba unas cuantas manchas seguidas, que están juntas en la vega, y el mineral queda al pie de cada una; luego
  // lo lleva a su taller, de 3 en 3 en cada mano, y al final vuelve a por la pala y la criba)
  let pasadas = 0, motivoCriba = '';
  const cribado = () => manchas.reduce((t, m) => t + nEnSuelo('mineral_hierro', m, 4), 0);
  await soltarManos();
  for (const t of ['pala_madera', 'criba']) if (!(await aLaMano(t, J.pos, 6))) await aLaMano(t, taller, 6);
  if (!enLaMano('pala_madera') || !enLaMano('criba')) motivoCriba = `sin la pala o la criba en las manos (${enMano()})`;
  for (const m of manchas.slice(0, ya('28c') ? 0 : 12)) {
    if (motivoCriba || mineral() + cribado() >= 3 * LUPIAS) break;
    await cuidarse();
    let rc;
    do { rc = MUTAR ? { ok: false, motivo: 'MUTAR' } : await recoger(m); if (rc.ok) pasadas++; } while (rc.ok);
    if (!/agot|recogido|vuelve/i.test(rc.motivo || '')) console.log(`     (la mancha no da más: ${rc.motivo})`);
    if (!enLaMano('pala_madera') || !enLaMano('criba')) { const aqui = { ...J.pos }; for (const t of ['pala_madera', 'criba']) await aLaMano(t, aqui, 6); }
  }
  // las herramientas, aquí en el suelo mientras acarrea
  const herramientasEn = { ...J.pos };
  await soltarManos();
  for (let v = 0; v < (ya('28c') ? 0 : 12) && cribado() > 0; v++) {
    for (const l of MANOS) {
      const m = manchas.find(x => nEnSuelo('mineral_hierro', x, 4) > 0);
      if (!m) break;
      const o = enSuelo('mineral_hierro', m, 4)[0];
      await J.andar(o.x + 0.3, o.z);
      await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(3, o.cosa.n), a: l, x: J.pos.x, z: J.pos.z });
    }
    await cuidarse();
    await J.andar(taller.x, taller.z); await soltarManos();
  }
  await J.andar(herramientasEn.x, herramientasEn.z);
  for (const t of ['pala_madera', 'criba']) await aLaMano(t, herramientasEn, 6);
  await J.andar(taller.x, taller.z); await soltarManos();
  comprobar(`criba con la pala y la criba: ${3 * LUPIAS} de mineral de hierro en su taller`, ya('28c') || mineral() >= 3 * LUPIAS, `${pasadas} pasadas, ${mineral()} de mineral${motivoCriba ? ' · ' + motivoCriba : ''}`);
  if (!ya('28c') && mineral() < 3 * LUPIAS) return;

  await punto('28c');
  // ── 28c. El carbón ──
  // (lo que hace falta: 4 para el horno de reducción y 4 en cada carga; 1 en cada barra; y alguno para el fuego de la
  // fragua)
  const CARBON = 4 + 4 * LUPIAS + LUPIAS + 2;
  console.log(`28c. Hace carbón en carboneras (2 troncos cortos partidos con el hacha, 10 leñas, cubiertas de tierra con la pala, encendidas con su yesca) hasta tener ${CARBON} en su taller`);
  const carbon = () => nEnSuelo('carbon', taller, 5) + J.cuantos('carbon');
  // una carbonera: 2 troncos cortos partidos en 10 leñas, cubiertas, encendidas y, pasadas las horas, 4 carbones
  let motivoCarbon = '', carboneras = 0;
  const unaCarbonera = async () => {
    await cuidarse();
    await J.andar(taller.x, taller.z); await soltarManos();
    const sitio = libreEn(taller, 40, 2) || { x: taller.x - 4, z: taller.z - 4 };
    const lena = () => nEnSuelo('lena', sitio, 4);
    for (let k = 0; k < 4 && lena() < 10; k++) {
      let tr = cerca(cortosEnTierra().filter(x => dist(x, sitio) > 3), sitio)[0];
      if (!tr && (await masCortos())) tr = cerca(cortosEnTierra().filter(x => dist(x, sitio) > 3), sitio)[0];
      if (!tr) { motivoCarbon = `sin troncos cortos: ${motivoCortos}`; return false; }
      await soltarManos(); await J.andar(tr.x + 0.5, tr.z);
      const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
      if (!c.ok) { motivoCarbon = `no se echa el tronco al hombro: ${c.motivo}`; return false; }
      await J.andar(sitio.x + 2, sitio.z); const sq = await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z });
      await hachaALaMano();
      const id = sq.ok ? sq.datos.objeto : null, o = id && visibles().find(x => x.id === id);
      if (!o) { motivoCarbon = 'no suelta el tronco'; return false; }
      await J.andar(o.x + 0.6, o.z);
      let tz, golpes = 0;
      do { tz = await J.objeto({ tipo: 'trocear', objeto: o.id, x: J.pos.x, z: J.pos.z }); golpes++; await pausa(850); } while (tz.ok && visibles().some(x => x.id === o.id) && golpes < 30);
      if (!tz.ok) { motivoCarbon = `no lo parte: ${tz.motivo}`; return false; }
      await soltarManos();
      for (let v = 0; v < 4 && nEnSuelo('lena', o, 4) && dist(o, sitio) > 2.5; v++) { await cogerSuelo('lena', o, 4, 3); await J.andar(sitio.x + 1, sitio.z); await soltarManos(); }
    }
    if (lena() < 10) { motivoCarbon = `solo ${lena()} leñas`; return false; }
    await J.andar(sitio.x + 1, sitio.z); await soltarManos();
    await aLaMano('pala_madera', taller, 6); await J.andar(sitio.x + 1, sitio.z);
    const car = await levantar('carbonera', sitio.x, sitio.z);
    const est = car.ok && s.objetos.fab.estaciones[car.id];
    if (!est || est.obra) { motivoCarbon = `no levanta la carbonera: ${car.motivo} (leña a 2/4/8 m: ${nEnSuelo('lena', sitio, 2)}/${lena()}/${nEnSuelo('lena', sitio, 8)}; lleva ${J.cuantos('lena')}; ${enMano()})`; return false; }
    await soltarManos(); await J.andar(sitio.x + 1, sitio.z);
    if (!(await taladroYYesca(1))) { motivoCarbon = `sin taladro o sin yesca (${enMano()})`; return false; }
    await J.andar(est.x + 1, est.z);
    const dy = await depositar(est, 'yesca');
    await aLaMano('taladro_fuego');
    const en = dy.ok ? await J.objeto({ tipo: 'fabricar', receta: 'carbonear', estacion: est.id, x: J.pos.x, z: J.pos.z }) : dy;
    if (!en.ok) { motivoCarbon = `no la enciende: ${en.motivo}`; return false; }
    adelantar('carbonear');
    await soltarManos();
    const g = await J.objeto({ tipo: 'recoger_fabricado', estacion: est.id, x: J.pos.x, z: J.pos.z });
    if (!g.ok) { motivoCarbon = `no saca el carbón: ${g.motivo}`; return false; }
    // los carbones, a su taller (de 10 en 10 en una mano)
    for (let v = 0; v < 3 && nEnSuelo('carbon', est, 4); v++) { await cogerSuelo('carbon', est, 4, 10); await J.andar(taller.x, taller.z); await soltarManos(); await J.andar(est.x + 1, est.z); }
    await J.andar(taller.x, taller.z); await soltarManos();
    carboneras++;
    return true;
  };
  // (el de los oficios, que quedó junto a su carbonera: a su taller)
  for (const o of cerca(visibles().filter(x => x.cosa.tipo === 'carbon' && s.mundo.dentroDeTierra(x.x, x.z, yo) && dist(x, taller) > 5), taller).slice(0, ya('28d') ? 0 : 3)) {
    await soltarManos(); await J.andar(o.x + 0.3, o.z); await J.objeto({ tipo: 'coger_suelo', objeto: o.id, x: J.pos.x, z: J.pos.z }); await J.andar(taller.x, taller.z); await soltarManos();
  }
  const carbonAntes = carbon();
  for (let k = 0; k < (ya('28d') ? 0 : 12) && carbon() < CARBON; k++) if (!(await unaCarbonera())) break;
  comprobar(`hace carbón en carboneras: ${CARBON} en su taller`, ya('28d') || carbon() >= CARBON, `${carbonAntes} de los oficios, ${carboneras} carboneras, ${carbon()} en total${motivoCarbon ? ' · ' + motivoCarbon : ''}`);
  if (!ya('28d') && carbon() < CARBON) return;

  await punto('28d');
  // ── 28d. El horno de reducción y las lupias ──
  console.log(`28d. Levanta el horno de reducción en su tierra (20 de barro de la ribera, 10 piedras y 4 carbones) y lo carga ${LUPIAS} veces (3 de mineral, 4 carbones y la yesca, encendido con el taladro): ${LUPIAS} lupias`);
  // traer n de lo que da la ribera (barro con la pala) hasta sitio, de 3 en 3 en la mano libre
  // traer n de lo que da la ribera (barro o arcilla, con la pala) hasta sitio: cava lo que falta y lo deja en un monton en
  // la orilla, deja allí la pala y lo acarrea con las dos manos, de 3 en 3 en cada una; al final vuelve a por la pala
  const deLaRibera = async (clase, da, n, sitio, herr) => {
    const total = () => nEnSuelo(da, sitio, 4) + J.cuantos(da);
    const p = cerca(alrededor(rio, 300).filter(q => q.tipo === clase), rio)[0];
    if (!p) return `no hay ${clase} en la ribera`;
    let motivo = '';
    await cuidarse();
    await soltarManos([herr]);
    if (!(await aLaMano(herr, J.pos, 6)) && !(await aLaMano(herr, taller, 6))) return `sin ${herr} (${enMano()})`;
    const orilla = { x: r2(p.x + 0.4), z: p.z };
    const monton = () => nEnSuelo(da, orilla, 3);
    const falta = n - total();
    for (let k = 0; k < falta + 3 && monton() + J.cuantos(da) < falta; k++) {
      const q = await recoger(p);
      if (!q.ok) { motivo = q.motivo; break; }
      const l = enLaMano(da); if (l && J.inv.lugares[l].n >= 3) await soltar(l);
    }
    { const l = enLaMano(da); if (l) await soltar(l); }
    await soltarManos();   // (la pala, aquí, en la orilla)
    for (let v = 0; v < 12 && monton() > 0 && total() < n; v++) {
      for (const l of MANOS) { const o = enSuelo(da, orilla, 3)[0]; if (!o) break; await J.andar(o.x + 0.3, o.z); await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(3, o.cosa.n), a: l, x: J.pos.x, z: J.pos.z }); }
      await J.andar(sitio.x, sitio.z); await soltarManos(); await cuidarse();
      if (monton() > 0 && total() < n) await J.andar(orilla.x, orilla.z);
    }
    await J.andar(orilla.x, orilla.z); await aLaMano(herr, orilla, 4); await J.andar(sitio.x, sitio.z);
    return total() >= n ? '' : `${total()} de ${n} ${da}${motivo ? ': ' + motivo : ''}`;
  };
  const sitioHorno = libreEn(taller, 40) || { x: taller.x + 5, z: taller.z };
  await J.andar(sitioHorno.x, sitioHorno.z); await soltarManos();
  let motivoHorno = ya('28e') ? '' : await deLaRibera('barro', 'barro', 20, sitioHorno, 'pala_madera');
  comprobar('cava 20 de barro en la ribera con la pala y lo lleva al sitio del horno', !motivoHorno, motivoHorno);
  const aPiedras = ya('28e') || await acopiar(['piedra'], 'piedra', 10, sitioHorno);
  comprobar('junta 10 piedras en el sitio del horno', aPiedras, `${nEnSuelo('piedra', sitioHorno, 3)}`);
  // 4 carbones de su taller
  if (!ya('28e')) { await J.andar(taller.x, taller.z); await soltarManos(); await cogerSuelo('carbon', taller, 5, 4); await J.andar(sitioHorno.x, sitioHorno.z); }
  const hr = ya('28e') ? { ok: true, datos: { terminada: true } } : await levantar('horno_reduccion', sitioHorno.x, sitioHorno.z);
  comprobar('levanta el horno de reducción: 20 de barro, 10 piedras y 4 carbones', hr.ok && hr.datos && hr.datos.terminada, hr.motivo || '');
  const horno = hr.ok && s.objetos.fab.estaciones[hr.id];
  if (!ya('28e') && (!horno || horno.obra)) return;
  const lupias = () => nEnSuelo('lupia', taller, 5) + J.cuantos('lupia');
  let motivoLupia = '';
  for (let k = 0; k < (ya('28e') ? 0 : LUPIAS + 2) && lupias() < LUPIAS; k++) {
    await cuidarse();
    await J.andar(taller.x, taller.z); await soltarManos();
    if (!(await taladroYYesca(1))) { motivoLupia = `sin taladro o sin yesca (${enMano()})`; break; }
    await J.andar(horno.x + 1, horno.z);
    let d = await depositar(horno, 'yesca');
    await soltarManos(['taladro_fuego']);
    if (d.ok) d = await aEstacion(horno, 'mineral_hierro', 3, taller, 5);
    if (d.ok) d = await aEstacion(horno, 'carbon', 4, taller, 5);
    if (!d.ok) { motivoLupia = `no carga el horno: ${d.motivo}`; break; }
    await J.andar(horno.x + 1, horno.z); await aLaMano('taladro_fuego');
    const en = await J.objeto({ tipo: 'fabricar', receta: 'reducir', estacion: horno.id, x: J.pos.x, z: J.pos.z });
    if (!en.ok) { motivoLupia = `no lo enciende: ${en.motivo}`; break; }
    const g0 = await J.objeto({ tipo: 'recoger_fabricado', estacion: horno.id, x: J.pos.x, z: J.pos.z });
    if (g0.ok) { motivoLupia = 'da la lupia antes de tiempo'; break; }
    adelantar('reducir');
    await soltarManos();
    const g = await J.objeto({ tipo: 'recoger_fabricado', estacion: horno.id, x: J.pos.x, z: J.pos.z });
    if (!g.ok) { motivoLupia = `no saca la lupia: ${g.motivo}`; break; }
    await J.andar(taller.x, taller.z); await soltarManos();
  }
  comprobar(`carga el horno ${LUPIAS} veces, lo enciende con el taladro y, pasado el rato, saca ${LUPIAS} lupias`, ya('28e') || lupias() >= LUPIAS, `${lupias()}${motivoLupia ? ' · ' + motivoLupia : ''}`);
  if (!ya('28e') && lupias() < LUPIAS) return;

  // traer a su taller lo suyo de ese tipo que esté en el suelo de su tierra (lo que dejó en los oficios)
  const alTaller = async (tipo, n) => {
    for (let k = 0; k < 6 && nEnSuelo(tipo, taller, 5) + J.cuantos(tipo) < n; k++) {
      const o = cerca(visibles().filter(x => x.cosa.tipo === tipo && !x.arrastra && s.mundo.dentroDeTierra(x.x, x.z, yo) && dist(x, taller) > 5), taller)[0];
      if (!o) break;
      await soltarManos(); await J.andar(o.x + 0.3, o.z);
      await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(o.cosa.n, n), a: 'mano:der', x: J.pos.x, z: J.pos.z });
      await J.andar(taller.x, taller.z); await soltarManos();
    }
    return nEnSuelo(tipo, taller, 5) + J.cuantos(tipo) >= n;
  };

  await punto('28e');
  // ── 28e. El cuero del fuelle y el fuelle ──
  console.log('28e. Curte en sus cubas las 2 pieles limpias que guardó (corteza de roble y agua del río con el cubo): 2 cueros; con 2 varas, en el banco, el fuelle');
  if (!ya('28f')) {
    await cuidarse();
    const cueros = () => nEnSuelo('cuero', taller, 5) + J.cuantos('cuero');
    const cubas = cerca(suyas('cubas_curtido'), taller)[0];
    comprobar('tiene sus cubas de curtido (de los oficios) y las 2 pieles limpias que guardó', !!cubas && (await alTaller('piel_limpia', 2)), `${nEnSuelo('piel_limpia', taller, 5)} pieles limpias`);
    if (!cubas) return;
    // la corteza: 2 por piel, de robles en pie que nadie ha descortezado
    await J.andar(taller.x, taller.z); await soltarManos(); await buscar('lasca_silex');
    const corteza = () => nEnSuelo('corteza_roble', taller, 5) + J.cuantos('corteza_roble');
    let robles = 0, motivoCorteza = '';
    for (const radio of [150, 400, 900]) {
      if (corteza() >= 4) break;
      const v = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + taller.x - radio, z0: O.z + taller.z - radio, x1: O.x + taller.x + radio, z1: O.z + taller.z + radio });
      const lista = v.arboles.map(e => ({ x: r2(e.x - O.x), z: r2(e.z - O.z), edad: e.edad, especie: e.especie })).filter(e => e.especie === 'roble').map(e => ({ ...e, id: idArbol(e.x, e.z) }))
        .filter(e => !s.objetos.tala.estado[e.id] && secoHasta(taller, e));
      for (const a of cerca(lista, taller).slice(0, 16)) {
        if (corteza() >= 4) break;
        if (MANOS.every(l => J.inv.lugares[l])) { await J.andar(taller.x, taller.z); await soltarManos(['lasca_silex']); }
        await J.andar(a.x + 1, a.z);
        const r = await J.objeto({ tipo: 'descortezar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad, especie: a.especie });
        if (r.ok) robles++; else motivoCorteza = r.motivo;
      }
    }
    await J.andar(taller.x, taller.z); await soltarManos(['lasca_silex']);
    comprobar('descorteza robles en pie con la lasca: 4 de corteza de roble', corteza() >= 4, `${robles} robles${motivoCorteza ? ' · ' + motivoCorteza : ''}`);
    let curtiendo = 0;
    for (let k = 0; k < 2; k++) {
      if (!(await aLaMano(J.cuantos('cubo_agua') ? 'cubo_agua' : 'cubo', J.pos, 5))) { await buscar('cubo', [[rio, 30], [cubas, 10]]); await aLaMano('cubo'); }
      await soltarManos(['cubo', 'cubo_agua']);
      await cuidarse();
      if (enLaMano('cubo')) {
        await J.andar(rio.x, rio.z);
        for (let i = 0; i < 12 && nec().sed > 10; i++) { await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z }); await pausa(1600); }
        let ll = await J.objeto({ tipo: 'llenar_cubo' });
        if (!ll.ok) { await pausa(500); await aLaMano('cubo', J.pos, 5); ll = await J.objeto({ tipo: 'llenar_cubo' }); }
        if (!ll.ok) { console.log(`     (no llena el cubo: ${ll.motivo})`); break; }
      }
      await J.andar(cubas.x + 1, cubas.z);
      const lv = await J.objeto({ tipo: 'llenar_estacion', estacion: cubas.id, x: J.pos.x, z: J.pos.z });
      if (!lv.ok) { console.log(`     (no vacía el cubo en las cubas: ${lv.motivo} · ${enMano()})`); break; }
      await soltarManos();
      const p1 = await aEstacion(cubas, 'piel_limpia', 1, taller, 5);
      const p2 = p1.ok ? await aEstacion(cubas, 'corteza_roble', 2, taller, 5) : p1;
      await J.andar(cubas.x + 1, cubas.z);
      const f = p2.ok ? await J.objeto({ tipo: 'fabricar', receta: 'curtir', estacion: cubas.id, x: J.pos.x, z: J.pos.z }) : p2;
      if (!f.ok) { console.log(`     (no la pone a curtir: ${f.motivo})`); break; }
      curtiendo++;
    }
    await J.andar(cubas.x + 1, cubas.z); await soltarManos();
    adelantar('curtir');
    for (let k = 0; k < 2; k++) await J.objeto({ tipo: 'recoger_fabricado', estacion: cubas.id, x: J.pos.x, z: J.pos.z });
    await J.andar(taller.x, taller.z); await soltarManos();
    if (nEnSuelo('cuero', cubas, 3)) { await cogerSuelo('cuero', cubas, 3); await J.andar(taller.x, taller.z); await soltarManos(); }
    comprobar('pone a curtir las 2 pieles con su corteza y su agua y, pasados los días, saca 2 cueros', curtiendo === 2 && cueros() >= 2, `${curtiendo} a curtir, ${cueros()} cueros`);
    // 2 varas: de su taller o de un árbol joven
    if (nEnSuelo('vara', taller, 5) < 2) { const t = await talarJoven(taller); if (t.ok) { await soltarManos(); await cogerSuelo('vara', t.a, 6, 2); await J.andar(taller.x, taller.z); await soltarManos(); } }
    let fu = await aEstacion(banco, 'cuero', 2, taller, 5);
    if (fu.ok) fu = await aEstacion(banco, 'vara', 2, taller, 5);
    await J.andar(banco.x + 1, banco.z);
    if (fu.ok) fu = await enEstacion(banco, 'fuelle');
    comprobar('en el banco, con 2 cueros y 2 varas, el fuelle', fu.ok && J.cuantos('fuelle') === 1, fu.motivo || enMano());
    if (!fu.ok) return;
  }

  await punto('28f');
  // ── 28f. La fragua y las barras ──
  console.log(`28f. Levanta la fragua en su tierra (12 piedras, 4 de barro y el fuelle), la enciende con carbón, su yesca y su taladro y, con el mazo de piedra, bate ${LUPIAS} barras de hierro (una lupia y un carbón cada una)`);
  // (al seguir desde más adelante, la fragua ya está: la suya, la más cercana a su taller)
  const fraguaYa = ya('28g') && cerca(suyas('fragua'), taller)[0];
  const sitioFragua = fraguaYa || libreEn(taller, 40) || { x: taller.x, z: taller.z + 5 };
  await J.andar(sitioFragua.x, sitioFragua.z); await soltarManos(['fuelle']);
  motivoHorno = fraguaYa ? '' : await deLaRibera('barro', 'barro', 4, sitioFragua, 'pala_madera');
  const pf = !!fraguaYa || await acopiar(['piedra'], 'piedra', 12, sitioFragua);
  comprobar('lleva al sitio de la fragua 4 de barro de la ribera y 12 piedras', !motivoHorno && pf, `${motivoHorno} · ${nEnSuelo('piedra', sitioFragua, 3)} piedras`);
  if (!fraguaYa) { await aLaMano('fuelle', taller, 6); await J.andar(sitioFragua.x, sitioFragua.z); }
  const fr = fraguaYa ? { ok: true, id: fraguaYa.id, datos: { terminada: true } } : await levantar('fragua', sitioFragua.x, sitioFragua.z);
  comprobar('levanta la fragua: 12 piedras, 4 de barro y el fuelle', fr.ok && fr.datos && fr.datos.terminada, fr.motivo || '');
  const fragua = fr.ok && s.objetos.fab.estaciones[fr.id];
  if (!fragua || fragua.obra) return;
  const F = () => s.objetos.fab.estaciones[fragua.id];
  // el mazo de piedra: el suyo o uno nuevo con las manos (1 piedra, 1 rama y 2 cordeles)
  await J.andar(taller.x, taller.z); await soltarManos();
  if (!(await buscar('mazo_piedra'))) {
    await acopiar(['piedra'], 'piedra', 1, taller); await acopiar(['ramas'], 'rama', 1, taller);
    for (let k = 0; k < 2; k++) { const c = await cordel(); await J.andar(taller.x, taller.z); const lc = enLaMano('cordel'); if (lc) await soltar(lc); }
    await deMano('mazo_piedra');
  }
  comprobar('tiene su mazo de piedra (el suyo o uno nuevo)', J.cuantos('mazo_piedra') >= 1, enMano());
  // encenderla: carbón al fuego, la yesca y el taladro
  const encenderFragua = async () => {
    if (F().fuego && F().fuego.hasta > Date.now()) return { ok: true };
    // (primero el carbón, con las manos libres; luego el taladro y la yesca)
    await J.andar(taller.x, taller.z); await soltarManos(); await cogerSuelo('carbon', taller, 5, 2);
    await J.andar(fragua.x + 1, fragua.z);
    for (let i = 0; i < 2; i++) { const e = await J.objeto({ tipo: 'echar_fuego', estacion: fragua.id, objeto: 'carbon', x: J.pos.x, z: J.pos.z }); if (!e.ok) return { ok: false, motivo: `${e.motivo} (${enMano()})` }; }
    await J.andar(taller.x, taller.z); await soltarManos();
    if (!(await taladroYYesca(1))) return { ok: false, motivo: `sin taladro o sin yesca (${enMano()})` };
    await J.andar(fragua.x + 1, fragua.z); await aLaMano('taladro_fuego');
    return J.objeto({ tipo: 'encender_fuego', estacion: fragua.id, x: J.pos.x, z: J.pos.z });
  };
  let en = ya('28g') ? { ok: true } : await encenderFragua();
  comprobar('echa carbón a la fragua y la enciende con su yesca y su taladro', en.ok, en.motivo || '');
  const barras = () => nEnSuelo('barra_hierro', taller, 5) + J.cuantos('barra_hierro');
  // batir en la fragua: lo que pide, del suelo de su taller, y el mazo en la mano
  const forjar = async (receta, gasta) => {
    const e = await encenderFragua(); if (!e.ok) return e;
    await J.andar(taller.x, taller.z); await soltarManos(['mazo_piedra']);
    for (const [t, n] of Object.entries(gasta)) { const d = await aEstacion(fragua, t, n, taller, 5); if (!d.ok) return d; }
    await J.andar(fragua.x + 1, fragua.z); await soltarManos(['mazo_piedra']); await aLaMano('mazo_piedra', taller, 6);
    await J.andar(fragua.x + 1, fragua.z);
    const q = await enEstacion(fragua, receta);
    if (q.ok) { await J.andar(taller.x, taller.z); await soltarManos(['mazo_piedra']); }
    return q;
  };
  let motivoBarra = '';
  for (let k = 0; k < (ya('28g') ? 0 : LUPIAS + 2) && barras() < LUPIAS; k++) { await cuidarse(); const q = await forjar('barra_hierro', { lupia: 1, carbon: 1 }); if (!q.ok) { motivoBarra = q.motivo; break; } }
  comprobar(`con el fuego encendido y el mazo de piedra, bate ${LUPIAS} barras de hierro (una lupia y un carbón cada una)`, ya('28g') || barras() >= LUPIAS, `${barras()}${motivoBarra ? ' · ' + motivoBarra : ''}`);
  if (!ya('28g') && barras() < LUPIAS) return;

  await punto('28g');
  // ── 28g. Los mangos, el hacha de hierro, el pico, la sierra y los clavos ──
  console.log('28g. En el banco, 4 mangos de 4 varas; en la fragua, el hacha de hierro, el pico, la sierra de tronzar y 10 clavos');
  for (let v = 0; v < (ya('28h') ? 0 : 2) && nEnSuelo('vara', taller, 5) < 4; v++) { const t = await talarJoven(taller); if (t.ok) { await soltarManos(); await cogerSuelo('vara', t.a, 6, 3); await J.andar(taller.x, taller.z); await soltarManos(); } }
  let mangos = ya('28h') ? 4 : 0;
  for (let k = mangos; k < 4; k++) {
    let d = await aEstacion(banco, 'vara', 1, taller, 5);
    await J.andar(banco.x + 1, banco.z);
    if (d.ok) d = await enEstacion(banco, 'mango');
    if (!d.ok) { console.log(`     (no hace el mango: ${d.motivo})`); break; }
    mangos++; await J.andar(taller.x, taller.z); await soltarManos();
  }
  comprobar('en el banco, de 4 varas, 4 mangos', mangos === 4, `${mangos}`);
  for (const [receta, gasta, da, n] of [['hacha_hierro', { barra_hierro: 1, mango: 1 }, 'hacha_hierro', 1], ['pico', { barra_hierro: 1, mango: 1 }, 'pico', 1], ['sierra', { barra_hierro: 2, mango: 2 }, 'sierra', 1], ['clavos', { barra_hierro: 1 }, 'clavo', 10]]) {
    await cuidarse();
    const q = ya('28h') ? { ok: true } : await forjar(receta, gasta);
    const tiene = J.cuantos(da) + nEnSuelo(da, taller, 5);
    comprobar(`en la fragua, con el mazo: ${receta === 'clavos' ? '10 clavos' : receta === 'sierra' ? 'la sierra de tronzar' : receta === 'pico' ? 'el pico' : 'el hacha de hierro'} (${Object.entries(gasta).map(([t, m]) => `${m} ${t}`).join(', ')})`, q.ok && (ya('28h') || tiene >= n), q.motivo || `${tiene}`);
  }

  await punto('28h');
  // ── 28h. Talar con el hacha de hierro, tronzar con la sierra y serrar las tablas ──
  console.log('28h. Con el hacha de hierro tala un árbol adulto; con la sierra tronza el tronco largo y, en el banco, sierra un tronco corto: 4 tablas');
  if (!ya('28i')) {
    await cuidarse();
    await J.andar(taller.x, taller.z); await soltarManos();
    let ta = { ok: false, motivo: 'sin el hacha de hierro' };
    if (await aLaMano('hacha_hierro', taller, 6)) {
      const arboles = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + taller.x - 150, z0: O.z + taller.z - 150, x1: O.x + taller.x + 150, z1: O.z + taller.z + 150 }).arboles
        .map(a => ({ x: a.x - O.x, z: a.z - O.z, edad: a.edad })).map(a => ({ ...a, id: idArbol(a.x, a.z) }))
        .filter(a => a.edad === 'adulto' && !s.objetos.tala.estado[a.id] && !campoEn(s.mundo, a.x, a.z) && secoHasta(J.pos, a) && !s.mundo.construcciones.some(c => [...c.piezas.values()].length && dist({ x: c.ox, z: c.oz }, a) < 12));
      const a = cerca(arboles, taller)[0];
      if (a) {
        await J.andar(a.x + 1, a.z);
        let t, g = 0;
        do { t = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); g++; if (t.ok && t.datos.boca !== undefined) { await J.andar(a.x, a.z + 1); await J.andar(a.x - 1, a.z); } if (t.ok && !t.datos.cae) await pausa(550); } while (t.ok && !t.datos.cae && g < 90);
        let l = t, gl = 0;
        if (t.ok && t.datos.cae) { await pausa(550); do { l = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); gl++; if (l.ok && !l.datos.limpio) await pausa(550); } while (l.ok && !l.datos.limpio && gl < 60); }
        ta = l.ok && l.datos.limpio ? { ok: true, a, g } : { ok: false, motivo: `no lo tala: ${l.motivo || t.motivo || g + ' golpes'}` };
      } else ta.motivo = 'no hay adultos cerca';
    }
    comprobar('con el hacha de hierro tala un árbol adulto y lo limpia', ta.ok, ta.ok ? `${ta.g} golpes` : ta.motivo);
    const largo = ta.ok && enSuelo('tronco_largo', ta.a, 15)[0];
    let tz = { ok: false, motivo: 'sin tronco largo' }, golpesSierra = 0;
    if (largo) {
      await soltarManos(); await aLaMano('sierra', taller, 6) || (await J.andar(taller.x, taller.z), await aLaMano('sierra', taller, 6));
      await J.andar(largo.x + 0.6, largo.z);
      do { tz = await J.objeto({ tipo: 'trocear', objeto: largo.id, x: J.pos.x, z: J.pos.z }); golpesSierra++; await pausa(850); } while (tz.ok && enSuelo('tronco_corto', largo, 5).length === 0 && golpesSierra < 90);
    }
    const cortosSierra = largo ? enSuelo('tronco_corto', largo, 6) : [];
    comprobar('con la sierra en la mano tronza el tronco largo en troncos cortos', cortosSierra.length > 0, `${golpesSierra} golpes${tz.ok ? '' : ' · ' + tz.motivo}`);
    // un tronco corto al hombro (las manos, vacías) hasta el banco, y la sierra a la mano para serrarlo
    let tb = { ok: false, motivo: 'sin tronco corto' };
    if (cortosSierra.length) {
      const sierraEn = { ...J.pos };
      await soltarManos(); const o = cortosSierra[0]; await J.andar(o.x + 0.5, o.z);
      tb = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
      if (tb.ok) { await J.andar(banco.x + 1, banco.z); tb = await J.objeto({ tipo: 'depositar_estacion', estacion: banco.id, de: 'hombro', cantidad: 1, x: J.pos.x, z: J.pos.z }); }
      if (tb.ok) { await aLaMano('sierra', sierraEn, 4); await J.andar(banco.x + 1, banco.z); tb = await enEstacion(banco, 'tablas'); }
    }
    const tablas = () => nEnSuelo('tabla', taller, 5) + nEnSuelo('tabla', banco, 4) + J.cuantos('tabla');
    comprobar('lleva un tronco corto al hombro al banco y, con la sierra, lo sierra en 4 tablas', tb.ok && tablas() >= 4, tb.motivo || `${tablas()}`);
    await J.andar(taller.x, taller.z); await soltarManos();
  }

  await punto('28i');
  // ── 28i. La roca grande, con el pico ──
  console.log('28i. Con el pico rompe una roca grande, de las que el mazo no puede: deja sus bloques de piedra en bruto y sus piedras');
  if (!ya('28j')) {
    await cuidarse();
    await aLaMano('pico', taller, 6);
    let grande = null;
    for (let R = 150; !grande && R <= 1500; R += 150) {
      const v = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + taller.x - R, z0: O.z + taller.z - R, x1: O.x + taller.x + R, z1: O.z + taller.z + R });
      grande = cerca(v.piedras.filter(e => !e.canto && !rompible(e.tam) && deCantera(e.tam)).map(e => ({ x: r2(e.x - O.x), z: r2(e.z - O.z), tam: e.tam })).filter(e => secoHasta(taller, e)), taller)[0] || null;
    }
    let rr = { ok: false, motivo: 'no hay rocas grandes cerca' }, gR = 0;
    if (grande && enLaMano('pico')) {
      const id = idRoca(grande.x, grande.z);
      await J.andar(r2(grande.x + medidaRoca(grande.tam) / 2 + 0.6), grande.z);
      do { rr = await J.objeto({ tipo: 'romper', punto: id, x: J.pos.x, z: J.pos.z, px: grande.x, pz: grande.z, clase: 'roca', tam: grande.tam }); gR++; if (rr.ok && !rr.datos?.rota) await pausa(650); } while (rr.ok && !rr.datos?.rota && gR < 200);
    }
    const bloques = grande ? nEnSuelo('bloque_piedra', grande, 6) : 0;
    comprobar('rompe una roca grande con el pico, golpe a golpe por el servidor, y deja sus bloques de piedra en bruto', rr.ok && rr.datos?.rota && gR === golpesRoca(grande.tam) && bloques === bloquesRoca(grande.tam), `${grande ? medidaRoca(grande.tam) + ' m, ' : ''}${gR} golpes, ${bloques} bloques${rr.ok ? '' : ' · ' + rr.motivo}`);
    await J.andar(taller.x, taller.z); await soltarManos();
  }

  await punto('28j');
  // ── 28j. La arcilla, el horno cerámico y las tejas ──
  console.log('28j. Con la pala cava 8 cestas de arcilla en la ribera; levanta el horno cerámico (6 de arcilla y 10 piedras), lo enciende con leña y cuece 2 de arcilla: 10 tejas');
  // (al seguir desde más adelante, el horno ya está: el suyo, el más cercano a su taller)
  let hornoC = ya('28k') ? cerca(suyas('horno_ceramico'), taller)[0] : null;
  if (!ya('28k')) {
    const sitioCer = libreEn(taller, 40) || { x: taller.x - 5, z: taller.z };
    let mc = await deLaRibera('arcilla', 'arcilla', 8, sitioCer, 'pala_madera');
    comprobar('cava 8 cestas de arcilla en la ribera con la pala de madera y las lleva al sitio del horno', !mc, mc);
    const pc = await acopiar(['piedra'], 'piedra', 10, sitioCer);
    // (6 de arcilla al horno; las otras 2 se quedan aparte, para las tejas)
    await J.andar(sitioCer.x, sitioCer.z); await soltarManos(); await cogerSuelo('arcilla', sitioCer, 3, 2, 'mano:der');
    await J.andar(taller.x, taller.z); await soltarManos();
    await J.andar(sitioCer.x, sitioCer.z);
    const hc = pc ? await levantar('horno_ceramico', sitioCer.x, sitioCer.z) : { ok: false, motivo: 'sin las 10 piedras' };
    comprobar('levanta el horno cerámico: 6 de arcilla y 10 piedras', hc.ok && hc.datos && hc.datos.terminada, hc.motivo || '');
    hornoC = hc.ok && s.objetos.fab.estaciones[hc.id];
    if (!hornoC || hornoC.obra) return;
    // leña: parte un tronco corto con el hacha
    await J.andar(taller.x, taller.z); await soltarManos();
    if (nEnSuelo('lena', taller, 5) < 2) {
      let tr = cerca(cortosEnTierra(), taller)[0];
      if (!tr && (await masCortos())) tr = cerca(cortosEnTierra(), taller)[0];
      if (tr) {
        await soltarManos(); await J.andar(tr.x + 0.5, tr.z);
        const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
        if (c.ok) {
          await J.andar(taller.x + 2, taller.z); const sq = await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z });
          await hachaALaMano();
          const o = sq.ok && visibles().find(x => x.id === sq.datos.objeto);
          if (o) { await J.andar(o.x + 0.6, o.z); let t2, g = 0; do { t2 = await J.objeto({ tipo: 'trocear', objeto: o.id, x: J.pos.x, z: J.pos.z }); g++; await pausa(850); } while (t2.ok && visibles().some(x => x.id === o.id) && g < 30); }
          await soltarManos(); if (o) { await cogerSuelo('lena', o, 4, 3); await J.andar(taller.x, taller.z); await soltarManos(); }
        }
      }
    }
    // (como en la fragua: primero la leña, con las manos libres; luego el taladro y la yesca)
    await J.andar(taller.x, taller.z); await soltarManos(); await cogerSuelo('lena', taller, 5, 2);
    await J.andar(hornoC.x + 1, hornoC.z);
    let ec = { ok: true };
    for (let i = 0; i < 2 && ec.ok; i++) { ec = await J.objeto({ tipo: 'echar_fuego', estacion: hornoC.id, objeto: 'lena', x: J.pos.x, z: J.pos.z }); if (!ec.ok) ec = { ok: false, motivo: `${ec.motivo} (${enMano()})` }; }
    if (ec.ok) { await J.andar(taller.x, taller.z); await soltarManos(); if (!(await taladroYYesca(1))) ec = { ok: false, motivo: `sin taladro o sin yesca (${enMano()})` }; }
    if (ec.ok) { await J.andar(hornoC.x + 1, hornoC.z); await aLaMano('taladro_fuego'); ec = await J.objeto({ tipo: 'encender_fuego', estacion: hornoC.id, x: J.pos.x, z: J.pos.z }); }
    comprobar('parte un tronco corto en leña, la echa al horno cerámico y lo enciende con su yesca y su taladro', ec.ok, ec.motivo || '');
    await soltarManos();
    let te = await aEstacion(hornoC, 'arcilla', 2, taller, 5);
    await J.andar(hornoC.x + 1, hornoC.z);
    if (te.ok) {
      const f = await J.objeto({ tipo: 'fabricar', receta: 'tejas', estacion: hornoC.id, x: J.pos.x, z: J.pos.z });
      const g0 = f.ok ? await J.objeto({ tipo: 'recoger_fabricado', estacion: hornoC.id, x: J.pos.x, z: J.pos.z }) : f;
      adelantar('tejas');
      te = !f.ok ? f : g0.ok ? { ok: false, motivo: 'da las tejas antes de tiempo' } : await J.objeto({ tipo: 'recoger_fabricado', estacion: hornoC.id, x: J.pos.x, z: J.pos.z });
    }
    const tejas = () => nEnSuelo('teja', hornoC, 4) + nEnSuelo('teja', taller, 5) + J.cuantos('teja');
    comprobar('cuece 2 cestas de arcilla en el horno encendido y, pasado el rato, saca 10 tejas', te.ok && tejas() >= 10, te.motivo || `${tejas()}`);
  }

  await punto('28k');
  // ── 28k. El suelo de tablas y el tejado de teja, en su casa ──
  console.log('28k. En su casa: un suelo de tablas en lo alto (4 tablas y 4 clavos) y un tejado de teja (10 tejas y un tronco delgado), con su marco, lo que piden y el trabajo');
  const C = { x: r2(M.x + 10), z: r2(M.z - 10) };   // (el sitio de su casa humilde, el paso 16)
  const casa = s.mundo.construccionCercana(C.x, C.z);
  comprobar('tiene su casa', !!casa);
  if (!casa) return;
  // los huecos de su casa donde cabe la pieza (en la planta k, sobre las casillas que tienen cimiento), según el servidor
  const huecos = (tipo, k) => {
    const vistos = new Set(), r = [];
    for (const p of casa.piezas.values()) {
      if (p.hueco !== 'f' || p.k !== 0 || vistos.has(`${p.i},${p.j}`)) continue;
      vistos.add(`${p.i},${p.j}`);
      const pz = { tipo, hueco: PIEZAS[tipo].hueco, i: p.i, j: p.j, k, dir: 0, abierta: false };
      const v = s.mundo.validar({ construccion: casa, pieza: pz, nueva: false }, true, yo);
      if (v.ok) { const m = centroMundo(casa, pz); r.push({ ...pz, x: r2(m.x), z: r2(m.z), clave: v.clave }); }
    }
    return r;
  };
  const obra = pz => casa.piezas.get(pz.clave)?.obra;
  const terminada = pz => !!casa.piezas.get(pz.clave) && !obra(pz);
  const falta = (pz, m) => (PIEZAS[pz.tipo].coste[m] || 0) - ((obra(pz)?.entregado?.[m]) || 0);
  const alLado = async (pz) => { await J.andar(r2(pz.x + 0.8), pz.z); };
  const entregar = async (pz, m, n, desde) => { if (desde === undefined) await alLado(pz); return J.accion({ tipo: 'entregar', construccion: casa.id, clave: pz.clave, material: m, cantidad: n, ...(desde !== undefined ? { desde } : {}) }); };
  const trabajar = async (pz, quieto = false) => {
    if (!quieto) await alLado(pz);
    let t = { ok: true }, n = 0;
    for (; n < 400 && t.ok && obra(pz); n++) t = await J.accion({ tipo: 'trabajar', construccion: casa.id, clave: pz.clave, segundos: 5 });
    return { ok: terminada(pz), motivo: t.motivo, n };
  };
  const marco = async (pz) => { await alLado(pz); return J.accion({ tipo: 'colocar', pieza: pz.tipo, x: pz.x, z: pz.z, k: pz.k, rot: 0, dir: 0, y: T.suelo(pz.x, pz.z) }); };
  // el andamio, junto a su casa (8 varas y 2 cuerdas), como para el tejado de juncos (el paso 16): lo de la planta de
  // arriba se sube a mano por él (lo ligero: las tablas, los clavos, las tejas) y desde arriba se trabaja
  const cuerda = async () => {
    await J.andar(banco.x + 1, banco.z); await soltarManos();
    for (let v = 0; v < 3; v++) {
      const q = await cordel();
      if (!q.ok) return q;
      await J.andar(banco.x + 1, banco.z);
      const d = await depositar(banco, 'cordel');
      if (!d.ok) return d;
    }
    return enEstacion(banco, 'cuerda');
  };
  let andamio = null, qa = { ok: false, motivo: 'no cabe junto a su casa' };
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [4, 0], [-4, 0]]) {
    const pa = { tipo: 'andamio', x: r2(C.x + dx), z: r2(C.z + dz), k: 0 };
    await J.andar(r2(pa.x + 0.8), pa.z);
    qa = await J.accion({ tipo: 'colocar', pieza: 'andamio', x: pa.x, z: pa.z, k: 0, rot: 0, dir: 0, y: T.suelo(pa.x, pa.z) });
    if (!qa.ok) continue;
    const cand = s.mundo.candidata('andamio', pa.x, pa.z, 0, 0, 0, T.suelo(pa.x, pa.z)).pieza;
    pa.clave = claveDe(cand.hueco, cand.i, cand.j, cand.k, cand.d);
    andamio = pa; break;
  }
  comprobar('pone el marco de un andamio junto a su casa', !!andamio && !!obra(andamio), qa.motivo || '');
  if (!andamio) return;
  await cuidarse();
  for (let i = 0; i < 2 && falta(andamio, 'cuerda') > 0; i++) {
    const c = await cuerda();
    if (!c.ok) { qa = c; break; }
    qa = await entregar(andamio, 'cuerda', 1);
  }
  // las varas: de los árboles jóvenes que tala, de 6 en 6 en la mano
  for (let v = 0; v < 8 && falta(andamio, 'vara') > 0; v++) {
    await cuidarse();
    const t = await talarJoven(C);
    if (!t.ok) { qa = t; break; }
    await soltarManos(); await cogerSuelo('vara', t.a, 6, Math.min(6, falta(andamio, 'vara')), 'mano:der');
    if (J.cuantos('vara')) qa = await entregar(andamio, 'vara', Math.min(J.cuantos('vara'), falta(andamio, 'vara')));
    await J.andar(t.a.x + 1, t.a.z); await hachaALaMano(); await soltarManos();
  }
  const ta0 = falta(andamio, 'vara') <= 0 && falta(andamio, 'cuerda') <= 0 ? await trabajar(andamio) : { ok: false, motivo: qa.motivo || `faltan ${falta(andamio, 'vara')} varas y ${falta(andamio, 'cuerda')} cuerdas` };
  comprobar('le lleva 2 cuerdas que trenza en el banco y 8 varas de árboles jóvenes, y lo levanta', ta0.ok, ta0.motivo || '');
  if (!ta0.ok) return;
  // subir y bajar por el andamio: de pie en lo alto, en la planta 1 de su casa
  const arriba = (casa.oy || 0) + ALTURA + 0.05;
  const porElAndamio = async (sube) => {
    await J.andar(andamio.x, andamio.z);
    const y0 = T.suelo(andamio.x, andamio.z);
    for (let h = 0; h <= 10; h++) { const f = sube ? h / 10 : 1 - h / 10; J.ws.send(JSON.stringify({ tipo: 'estado', x: andamio.x, y: y0 + (arriba - y0) * f, z: andamio.z, giro: 0, anim: 'andar' })); await pausa(120); }
    if (!sube) J.estar(andamio.x, andamio.z);
    await pausa(300);
  };
  // el zurrón a la espalda (el de los oficios, en vez del fardo): con sus huecos, lleva más de una vez que en las manos
  const ponerZurron = async () => {
    if (J.inv.lugares.espalda?.tipo === 'zurron') return true;
    await J.andar(taller.x, taller.z); await soltarManos();
    if (J.inv.lugares.espalda) await J.objeto({ tipo: 'soltar_suelo', de: 'espalda', x: J.pos.x, z: J.pos.z });
    if (!(await buscar('zurron'))) return false;
    const lz = enLaMano('zurron');
    if (lz) await J.objeto({ tipo: 'mover', de: lz, a: 'espalda' });
    await J.andar(taller.x, taller.z);
    return J.inv.lugares.espalda?.tipo === 'zurron';
  };
  // lo de una mano, a un hueco libre del zurrón
  const alZurron = async (l) => {
    for (let i = 0; i < 4 && J.inv.lugares[l]; i++) if (J.inv.lugares.espalda?.tipo === 'zurron' && !J.inv.lugares.espalda.dentro?.[i]) await J.objeto({ tipo: 'mover', de: l, a: `espalda/${i}` });
    return !J.inv.lugares[l];
  };
  // coger n de tipo del suelo de donde: en las manos y, llenas, pasando lo de una mano al zurrón
  const cargar = async (tipo, n, donde) => {
    for (let k = 0; k < 10 && J.cuantos(tipo) < n; k++) {
      const o = enSuelo(tipo, donde, 5)[0];
      if (!o) break;
      let l = MANOS.find(x => !J.inv.lugares[x]);
      if (!l) { l = enLaMano(tipo) || 'mano:der'; if (!(await alZurron(l))) break; }
      await J.andar(o.x + 0.3, o.z);
      await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(n - J.cuantos(tipo), o.cosa.n), a: l, x: J.pos.x, z: J.pos.z });
    }
    return J.cuantos(tipo) >= n;
  };
  // lo ligero, en las manos y el zurrón, hasta lo alto: se lo da a la obra desde arriba (en los viajes que hagan falta)
  const subirleLo = async (pz, tipos) => {
    let q = { ok: true }, viajes = 0;
    for (; viajes < 4 && q.ok && tipos.some(t => falta(pz, t) > 0); viajes++) {
      await ponerZurron();
      await J.andar(taller.x, taller.z); await soltarManos();
      for (const t of tipos) if (falta(pz, t) > 0) await cargar(t, falta(pz, t), taller);
      if (!tipos.some(t => J.cuantos(t) > 0)) return { ok: false, motivo: `no encuentra ${tipos.join(' ni ')} en su taller (${enMano()})` };
      if (!viajes) { const abajo = await entregar(pz, tipos.find(t => J.cuantos(t)), 1); if (abajo.ok || !/andamio/.test(abajo.motivo || '')) return { ok: false, motivo: `desde el suelo: ${abajo.motivo || 'se lo da'}` }; }
      await porElAndamio(true);
      for (const t of tipos) if (q.ok && J.cuantos(t) && falta(pz, t) > 0) q = await entregar(pz, t, Math.min(J.cuantos(t), falta(pz, t)), 1);
      await porElAndamio(false);
    }
    return q.ok && tipos.every(t => falta(pz, t) <= 0) ? { ok: true, viajes } : { ok: false, motivo: q.motivo || `faltan ${tipos.map(t => falta(pz, t) + ' ' + t).join(', ')}` };
  };

  // el suelo de tablas: arriba, sobre los muros de su casa
  await cuidarse();
  await J.andar(taller.x, taller.z); await soltarManos();
  if (nEnSuelo('tabla', banco, 4)) { await cogerSuelo('tabla', banco, 4, 4); await J.andar(taller.x, taller.z); await soltarManos(); }
  const hs = huecos('suelo_tabla', 1);
  comprobar('en su casa cabe un suelo de tablas en lo alto (sobre sus muros)', hs.length > 0, hs.length ? `casilla ${hs[0].i},${hs[0].j}` : '');
  if (hs.length) {
    const st = hs[0];
    let q = await marco(st);
    if (q.ok) q = await subirleLo(st, ['tabla', 'clavo']);
    if (q.ok) { await porElAndamio(true); q = await trabajar(st, true); await porElAndamio(false); }   // (desde lo alto del andamio)
    comprobar('pone el suelo de tablas: el marco y, subido al andamio, 4 tablas y 4 clavos y el trabajo', q.ok && terminada(st), q.motivo || '');
  }
  // el tejado de teja: donde quepa en lo alto de su casa; si no cabe, en el sitio del de juncos, que desmonta
  await J.andar(taller.x, taller.z); await soltarManos();
  if (nEnSuelo('teja', hornoC, 4)) for (let v = 0; v < 3 && nEnSuelo('teja', hornoC, 4); v++) { await cogerSuelo('teja', hornoC, 4, 10, 'mano:der'); await J.andar(taller.x, taller.z); await soltarManos(); }
  let ht = huecos('tejado_teja', 1);
  let cambiado = false;
  if (!ht.length) {
    const juncos = [...casa.piezas.entries()].find(([, p]) => p.tipo === 'tejado_juncos' && !p.obra);
    if (juncos) { const d = await (async () => { const pz = juncos[1], m = centroMundo(casa, pz); await J.andar(r2(m.x + 0.8), m.z); return J.accion({ tipo: 'desmontar', construccion: casa.id, clave: juncos[0] }); })(); cambiado = d.ok; }
    ht = huecos('tejado_teja', 1);
    await J.andar(taller.x, taller.z); await soltarManos();
  }
  comprobar(`en su casa cabe un tejado de teja${cambiado ? ' (en el sitio del de juncos, que desmonta)' : ''}`, ht.length > 0, ht.length ? `casilla ${ht[0].i},${ht[0].j}` : '');
  if (ht.length) {
    const tt = ht[0];
    let q = await marco(tt);
    // las tejas, de pocas en pocas a mano, subidas por el andamio
    if (q.ok) q = await subirleLo(tt, ['teja']);
    // el tronco delgado, pesado: no se sube a mano; solo, se rueda por dos varas con una cuerda (que no se gastan)
    let rodado = 0;
    if (q.ok && falta(tt, 'tronco') > 0) {
      const t = await talarJoven(C);
      const tr = t.ok && enSuelo('tronco_delgado', t.a, 5)[0];
      if (!tr) q = { ok: false, motivo: t.motivo || 'el joven no ha dejado tronco' };
      else {
        // (las varas y la cuerda, en el zurrón: al hombro, las manos no llevan nada)
        await ponerZurron(); await soltarManos();
        await J.andar(t.a.x + 1, t.a.z); await cogerSuelo('vara', t.a, 6, 2, 'mano:der');
        if (J.cuantos('vara') < 2) { await J.andar(taller.x, taller.z); await cogerSuelo('vara', taller, 5, 2, 'mano:der'); }
        const lv = enLaMano('vara'); if (lv) await alZurron(lv);
        const c = await cuerda(); if (!c.ok) q = c;
        const lc = enLaMano('cuerda'); if (lc) await alZurron(lc);
        await soltarManos();
        if (q.ok && (J.cuantos('vara') < 2 || !J.cuantos('cuerda'))) q = { ok: false, motivo: `sin 2 varas y una cuerda en el zurrón (${J.cuantos('vara')} varas, ${J.cuantos('cuerda')} cuerdas)` };
        if (q.ok) {
          await J.andar(tr.x + 0.6, tr.z);
          q = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
          if (q.ok) { const a = await entregar(tt, 'tronco', 1); if (a.ok || !/rodándolo/.test(a.motivo || '')) q = { ok: false, motivo: `a mano: ${a.motivo || 'se lo da'}` }; }   // (a mano, no: lo pesado se rueda)
          await alLado(tt);
          for (let n = 0; n < 200 && q.ok && falta(tt, 'tronco') > 0; n++) { q = await J.accion({ tipo: 'subir', construccion: casa.id, clave: tt.clave, material: 'tronco', segundos: 5, metodo: 'varas' }); rodado++; }
        }
      }
    }
    comprobar('rueda el tronco delgado hasta lo alto por dos varas con una cuerda, solo', q.ok && falta(tt, 'tronco') <= 0, q.motivo || `${rodado} ratos`);
    if (q.ok) { await porElAndamio(true); q = await trabajar(tt, true); await porElAndamio(false); }
    comprobar('pone el tejado de teja: el marco, 10 tejas subidas al andamio, el tronco rodado y el trabajo desde arriba', q.ok && terminada(tt), q.motivo || '');
  }

  await soltarManos();
  comprobar('en todo el hierro no se ha muerto (bebe y come cuando lo necesita)', muertes.length === 0, muertes.join('; '));
}

// seguir desde lo guardado: KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_hierro.mjs
if (process.argv[1] && process.argv[1].endsWith('recorrido_hierro.mjs') && process.env.KINHOLD_RECORRIDO_DESDE) {
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
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-hierro-')); cpSync(desde, dir, { recursive: true });
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
  const [pasoGuardar, destino] = (process.env.KINHOLD_HIERRO_GUARDAR || '').split(':');
  const guardar = async (paso, extra) => {
    if (paso !== pasoGuardar) return;
    const ahora = Date.now(), pos = J.pos, ficha = J.bienvenida.ficha || meta.ficha;
    J.ws.close(); await pausa(300); await s.cerrar();
    cpSync(dir, destino, { recursive: true });
    const { writeFileSync } = await import('fs');
    writeFileSync(join(destino, 'jugador.json'), JSON.stringify({ ...meta, ficha, ahora, pos, paso, ...extra }));
    console.log(`(guardado en ${destino}: antes del paso ${paso})`);
    process.exit(0);
  };
  try { await hierro({ J, s, T, O, comprobar, pausa, cerca, RELOJ, guardar, tallerGuardado: meta.taller || null, desde: meta.paso || null }); }
  catch (e) { comprobar('el hierro llega al final', false, e && e.stack); }
  J.ws.close(); await s.cerrar();
  console.log(`\n${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
}
