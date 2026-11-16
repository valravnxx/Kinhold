// Recorrido de jugador de la casa más fuerte (P11c, «Recorrido de jugador de la casa más fuerte, sin arcón»): el paso 25
// de pruebas/prueba_recorrido.mjs, el mismo jugador, sin arcón y con lo que recoge. Junto a su banco de tronco se hace
// una rastra con las manos (5 ramas y 2 cordeles) y trenza dos cuerdas (9 de fibra y 3 cordeles cada una); tala un
// árbol adulto con su hacha de piedra, ata el tronco largo con una cuerda y lo arrastra hasta la rastra, lo sube a ella
// a pulso, se la lleva al banco y lo descarga; con el hacha le saca la rodaja por el pie (y 2 o 3 troncos cortos) y se
// hace en el banco la carretilla de rueda maciza (la rodaja, 2 varas y un tronco corto). Y en su casa, con troncos
// delgados de árboles jóvenes que tala y se echa al hombro, levanta un tramo de empalizada y, a su lado, el portón (con
// las dos cuerdas), que abre y cierra; y, en una casilla nueva junto a la casa (un cimiento de troncos), un muro de
// entramado con el barro que cava en la ribera.
// Cadena: tronco largo ← árbol adulto; cuerda ← 3 cordeles ← 9 de fibra; rastra ← 5 ramas y 2 cordeles; rodaja y
// tronco corto ← el tronco largo; vara y tronco delgado ← árbol joven; barro ← la ribera (palo cavador ← 1 rama).
// Para trabajar en esta parte sin repetir lo de antes: KINHOLD_RECORRIDO_GUARDAR=<carpeta> node pruebas/prueba_recorrido.mjs
// guarda el mundo antes del pozo; KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_casa_fuerte.mjs sigue desde
// ahí con la casa más fuerte (sin el pozo ni la granja). Con MUTAR=1 además, en la rastra no cabe el tronco largo: debe FALLAR.
// Decisiones provisionales (anotadas en el diario): la empalizada y el portón, delante de la casa (o a un lado, donde
// quepan); el entramado, en una casilla nueva pegada a la casa, sobre un cimiento de troncos (el muro pide cimiento).
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { vegetacionEn } from '../src/logica/vegetacion.js';
import { idArbol } from '../src/logica/tala.js';
import { hayAguaCerca } from '../src/logica/necesidades.js';
import { campoEn } from '../src/logica/campos.js';
import { VIDA as VIDA_DESGASTE } from '../src/logica/desgaste.js';
import { PIEZAS } from '../src/logica/piezas.js';
import { clave as claveDe } from '../src/logica/construccion.js';
import { DETRAS, DETRAS_TRONCO, CABE_RASTRA } from '../src/logica/rastra.js';

const MANOS = ['mano:der', 'mano:izq'];
// Con MUTAR=1 (solo al seguir desde lo guardado) en la rastra no cabe el tronco largo: debe FALLAR.
if (process.env.MUTAR === '1' && process.env.KINHOLD_RECORRIDO_DESDE) CABE_RASTRA.tronco_largo = 0;

export async function casaFuerte({ J, s, T, O, comprobar, pausa, cerca }) {
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
  // juntar n de «da» a los pies, en el sitio: recoge de lo de alrededor y, con las manos llenas, vuelve a dejarlo allí
  const acopiar = async (tipos, da, n, sitio, radio = 300) => {
    const lista = alrededor(sitio, radio).filter(q => tipos.includes(q.tipo));
    const total = () => nEnSuelo(da, sitio, 3) + J.cuantos(da);
    for (let k = 0; k < 80 && total() < n; k++) {
      const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0];
      if (!p) break;
      const q = await recoger(p);
      if (q.ok) { probados.add(p.id); continue; }
      if (MANOS.every(l => J.inv.lugares[l])) { await J.andar(sitio.x, sitio.z); await soltarManos(); }   // (llenas: a dejarlo, y vuelve al mismo)
      else probados.add(p.id);
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
  const aLaMano = async (tipo, donde) => {
    if (enLaMano(tipo)) return true;
    if (!J.cuantos(tipo) && donde) { await cogerSuelo(tipo, donde, 3); if (enLaMano(tipo)) return true; }
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
  const C = M && { x: r2(M.x + 10), z: r2(M.z - 10) };   // (el sitio de su casa humilde, el paso 16)
  const casa = C && s.mundo.construccionCercana(C.x, C.z);
  console.log('25. La casa más fuerte (P11c): rastra y cuerdas, tala un adulto, arrastra el tronco largo con cuerda hasta la rastra y lo lleva en ella, saca la rodaja y hace la carretilla, y levanta la empalizada con su portón y un muro de entramado');
  comprobar('25. tiene su tierra, su banco de tronco y su casa humilde', !!M && !!banco && !!casa, JSON.stringify({ M, banco: banco && [banco.x, banco.z], casa: casa && casa.id }));
  if (!M || !banco || !casa) return;

  // (con sed, a beber al agua más cercana, y vuelta; con hambre, bayas o setas de por aquí)
  const nec = () => s.necesidades.get(yo) || { sed: 0, hambre: 0 };
  const cuidarse = async () => {
    const desde = { ...J.pos };
    if (nec().sed > 45) {
      let agua = null;
      for (let d = 5; d <= 1500 && !agua; d += 5) for (let k = 0; k < 48 && !agua; k++) {
        const x = desde.x + Math.cos(k / 48 * 2 * Math.PI) * d, z = desde.z + Math.sin(k / 48 * 2 * Math.PI) * d;
        if (!T.aguaEn(x, z) && hayAguaCerca(T.aguaEn, x, z)) agua = { x: r2(x), z: r2(z) };
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
  // (si al hacha no le quedan los golpes que necesita, la repara en su piedra de tallar con un cordel: recupera la mitad)
  const resto = () => { const l = MANOS.find(x => s.objetos.invs.de(yo).lugares[x]?.tipo === 'hacha_piedra'); return l ? VIDA_DESGASTE.hacha_piedra - (s.objetos.invs.de(yo).lugares[l].usado || 0) : 0; };
  const repararHacha = async (necesita) => {
    const tallar = cerca(suyas('piedra_tallar'), banco)[0];
    for (let k = 0; k < 3 && enLaMano('hacha_piedra') && tallar && resto() < necesita; k++) {
      const lh = enLaMano('hacha_piedra'), otra = MANOS.find(x => x !== lh);
      if (J.inv.lugares[otra]) await soltar(otra);
      const aqui = { ...J.pos };
      // 3 de fibra, a sus pies, y el cordel con las manos (con el hacha en una)
      const lista = alrededor(aqui, 250).filter(q => ['ortiga', 'hierba_larga'].includes(q.tipo));
      for (let n = 0; n < 20 && J.cuantos('fibra') < 3; n++) { const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0]; if (!p) break; probados.add(p.id); await recoger(p); }
      const lf = enLaMano('fibra'); if (lf) await soltar(lf);
      const c = await deMano('cordel');
      await J.andar(tallar.x + 1, tallar.z);
      const d = c.ok ? await depositar(tallar, 'cordel') : c;
      const antes = resto();
      const rp = d.ok ? await J.objeto({ tipo: 'reparar', estacion: tallar.id, de: enLaMano('hacha_piedra'), x: J.pos.x, z: J.pos.z }) : d;
      console.log(`     (repara el hacha en su piedra de tallar: le quedaban ${antes} golpes, ahora ${resto()}${rp.ok ? '' : ' · ' + rp.motivo})`);
      if (!rp.ok) break;
    }
  };
  // el hacha a la mano: de lo que lleva o del suelo, donde la dejó
  const hachaALaMano = async () => {
    await pausa(800);
    if (await aLaMano('hacha_piedra')) return true;
    if (!(await cogerSuelo('hacha_piedra', J.pos, 15)) && !(await cogerSuelo('hacha_piedra', banco, 40))) await cogerSuelo('hacha_piedra', M, 400);
    await pausa(800);
    return aLaMano('hacha_piedra');
  };
  // talar el árbol de esa edad más cercano a p que nadie ha tocado y limpiarlo; lo que deja, al suelo
  const talar = async (edad, p) => {
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
    if (!t.ok || !t.datos.cae) return { ok: false, motivo: `no lo tala: ${t.motivo || g + ' golpes'} (en las manos ${enMano()})` };
    await pausa(550);
    let l, gl = 0;
    do { l = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); gl++; if (l.ok && !l.datos.limpio) await pausa(550); } while (l.ok && !l.datos.limpio && gl < 60);
    if (!l.ok || !l.datos.limpio) return { ok: false, motivo: `no lo limpia: ${l.motivo || gl + ' golpes'}` };
    return { ok: true, a, golpes: g + gl };
  };
  // andar en línea recta arrastrando algo: al soltarlo, dónde lo ve detrás de él (a «atras» metros)
  const andarTirando = async (x, z, atras) => {
    const p0 = { ...J.pos }, d = Math.max(0.01, Math.hypot(x - p0.x, z - p0.z));
    await J.andar(x, z);
    return { rx: r2(J.pos.x - (x - p0.x) / d * atras), rz: r2(J.pos.z - (z - p0.z) / d * atras) };
  };

  // su sitio de trabajo, junto al banco y donde no haya nada en el suelo (lo que dejó la granja, a otro lado)
  let taller = null;
  for (let d = 2; d <= 8 && !taller; d += 1) for (let k = 0; k < 12 && !taller; k++) {
    const x = r2(banco.x + Math.cos(k / 12 * 6.283) * d), z = r2(banco.z + Math.sin(k / 12 * 6.283) * d);
    if (!visibles().some(o => dist(o, { x, z }) < 3.5) && s.mundo.dentroDeTierra(x, z, yo)) taller = { x, z };
  }
  taller = taller || { x: r2(banco.x - 1.5), z: r2(banco.z + 1.5) };
  await J.andar(taller.x, taller.z); await soltarManos();
  // n de fibra en una mano (le caben 10): la de sus pies o la que recoge
  const fibraEnMano = async (n) => {
    if (J.cuantos('fibra') < n) await cogerSuelo('fibra', taller, 3, n);
    const lista = alrededor(taller, 300).filter(q => ['ortiga', 'hierba_larga'].includes(q.tipo));
    for (let k = 0; k < 30 && J.cuantos('fibra') < n; k++) { const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0]; if (!p) break; probados.add(p.id); await recoger(p); }
    await J.andar(taller.x, taller.z);
    return J.cuantos('fibra') >= n;
  };
  // un cordel con las manos, con 3 de fibra en la mano
  const cordel = async () => {
    for (const l of MANOS) if (J.inv.lugares[l] && J.inv.lugares[l].tipo !== 'fibra') await soltar(l);
    if (!(await fibraEnMano(3))) return { ok: false, motivo: `no junta 3 de fibra (lleva ${J.cuantos('fibra')})` };
    return deMano('cordel');
  };

  // 25a. La rastra, con las manos: 5 ramas en las manos y 2 cordeles a sus pies, junto al banco
  console.log('25a. Se hace una rastra con las manos (5 ramas y 2 cordeles) junto a su banco');
  await cuidarse();
  const motivos = [];
  let hechos = 0;
  for (let v = 0; v < 4 && hechos < 2; v++) { const c = await cordel(); if (c.ok) { hechos++; const lc = enLaMano('cordel'); if (lc) await soltar(lc); } else motivos.push(c.motivo); }
  const fibraSobra = enLaMano('fibra'); if (fibraSobra) await soltar(fibraSobra);
  // las ramas, en las manos (3 y 2): las de sus pies o las que recoge
  const ramas = alrededor(taller, 300).filter(q => q.tipo === 'ramas');
  for (let k = 0; k < 30 && J.cuantos('rama') < 5; k++) { const p = cerca(ramas.filter(q => !probados.has(q.id)), J.pos)[0]; if (!p) break; probados.add(p.id); await recoger(p); }
  await J.andar(taller.x, taller.z);
  let rr = hechos === 2 && J.cuantos('rama') >= 5 ? await deMano('rastra') : { ok: false, motivo: `ramas ${J.cuantos('rama')} · cordeles ${hechos} (${motivos.join(' | ')})` };
  let rastra = enSuelo('rastra', taller, 4)[0];
  comprobar('hace 2 cordeles de fibra, que deja a sus pies, junta 5 ramas en las manos y hace la rastra (enorme: se queda en el suelo)', rr.ok && !!rastra, `${rr.motivo || ''} · ${enMano()}`);
  if (!rastra) return;
  await soltarManos();

  // 25b. Dos cuerdas en el banco: una para tirar del tronco largo, y las dos para el portón
  console.log('25b. Trenza dos cuerdas en el banco (3 cordeles de 3 de fibra cada una)');
  let cuerdas = 0;
  const cuerdasAqui = () => J.cuantos('cuerda') + nEnSuelo('cuerda', taller);
  const antesCuerdas = cuerdasAqui();
  for (let v = 0; v < 2; v++) {
    await cuidarse();
    let ok = true;
    for (let k = 0; ok && k < 3; k++) { const c = await cordel(); if (!c.ok) motivos.push(c.motivo); await J.andar(banco.x + 1, banco.z); const d = c.ok ? await depositar(banco, 'cordel') : c; ok = c.ok && d.ok; await J.andar(taller.x, taller.z); }
    await J.andar(banco.x + 1, banco.z);
    const c = ok ? await enEstacion(banco, 'cuerda') : { ok: false };
    if (c.ok) cuerdas++; else motivos.push(c.motivo);
    await J.andar(taller.x, taller.z); await soltarManos();
  }
  comprobar('trenza 2 cuerdas en el banco', cuerdas === 2 && cuerdasAqui() - antesCuerdas === 2, `${cuerdas} · ${motivos.join(' | ')}`);

  // 25c. Tala un árbol adulto con su hacha de piedra
  console.log('25c. Tala un árbol adulto, ata el tronco largo con una cuerda y lo arrastra hasta la rastra');
  await cuidarse();
  const ad = await talar('adulto', banco);
  let largo = ad.ok && enSuelo('tronco_largo', ad.a, 8)[0];
  comprobar('tala un árbol adulto con su hacha de piedra: le deja un tronco largo', !!largo, `${ad.motivo || ''} ${ad.golpes || ''} golpes`);
  if (!largo) return;
  // el hacha, al cinturón no: a sus pies junto al tronco (luego saca la rodaja con ella)
  await repararHacha(60);
  await soltarManos();
  const hachaAqui = { ...J.pos };
  // lleva la rastra hasta cerca del tronco (vacía, despacio) y la suelta a unos 7 m de él
  await J.andar(rastra.x + 1.2, rastra.z);
  q = await J.objeto({ tipo: 'enganchar_rastra', objeto: rastra.id, x: J.pos.x, z: J.pos.z });
  const haciaLargo = { x: largo.x - J.pos.x, z: largo.z - J.pos.z }, dl = Math.hypot(haciaLargo.x, haciaLargo.z);
  const sitioRastra = { x: r2(largo.x - haciaLargo.x / dl * 7), z: r2(largo.z - haciaLargo.z / dl * 7) };
  let detras = q.ok ? await andarTirando(sitioRastra.x, sitioRastra.z, DETRAS) : null;
  let q3 = detras ? await J.objeto({ tipo: 'soltar_rastra', x: J.pos.x, z: J.pos.z, ...detras }) : q;
  rastra = porId(rastra.id);
  comprobar('engancha la rastra vacía y la deja a unos pasos del tronco', q.ok && q3.ok && !rastra.arrastra && dist(rastra, largo) < 9, `${q.motivo || ''} ${q3.motivo || ''} a ${Math.round(dist(rastra, largo))} m`);
  // la cuerda a la mano, ata el tronco y tira de él hasta la rastra (muy despacio: el servidor no mira la velocidad)
  await cogerSuelo('cuerda', taller, 3, 1);
  await J.andar(largo.x + 1, largo.z);
  q = await J.objeto({ tipo: 'atar_tronco', objeto: largo.id, x: J.pos.x, z: J.pos.z });
  const atado = q.ok && porId(largo.id)?.arrastra === yo;
  const pasada = { x: r2(rastra.x + (rastra.x - largo.x) / Math.max(0.1, dist(rastra, largo)) * 2), z: r2(rastra.z + (rastra.z - largo.z) / Math.max(0.1, dist(rastra, largo)) * 2) };
  detras = atado ? await andarTirando(pasada.x, pasada.z, DETRAS_TRONCO) : null;
  q3 = detras ? await J.objeto({ tipo: 'soltar_tronco', x: J.pos.x, z: J.pos.z, ...detras }) : q;
  largo = porId(largo.id);
  comprobar('con una cuerda en la mano ata el tronco largo y lo arrastra hasta la rastra', atado && q3.ok && !largo.arrastra && dist(largo, rastra) < 3, `${q.motivo || ''} ${q3.motivo || ''} el tronco, a ${largo && Math.round(dist(largo, rastra) * 10) / 10} m de la rastra`);
  // lo sube a pulso a la rastra, con la cuerda
  await J.andar(rastra.x + 0.8, rastra.z);
  q = await J.objeto({ tipo: 'cargar_rastra', objeto: rastra.id, suelo: largo.id, x: J.pos.x, z: J.pos.z });
  comprobar('lo sube a la rastra a pulso con la cuerda', q.ok && porId(rastra.id)?.cosa.carga?.tipo === 'tronco_largo' && !porId(largo.id), q.motivo);
  // con las manos libres (la cuerda, a la mano otra vez luego), se lleva la rastra con el tronco al banco
  await soltarManos(); const cuerdaAqui = { ...J.pos };
  q = await J.objeto({ tipo: 'enganchar_rastra', objeto: rastra.id, x: J.pos.x, z: J.pos.z });
  const destino = { x: r2(banco.x + 4), z: r2(banco.z + 2) };
  detras = q.ok ? await andarTirando(destino.x, destino.z, DETRAS) : null;
  q3 = detras ? await J.objeto({ tipo: 'soltar_rastra', x: J.pos.x, z: J.pos.z, ...detras }) : q;
  rastra = porId(rastra.id);
  q = await J.objeto({ tipo: 'descargar_rastra', objeto: rastra.id, x: J.pos.x, z: J.pos.z });
  largo = enSuelo('tronco_largo', rastra, 3)[0];
  comprobar('se lleva la rastra con el tronco largo hasta su banco y lo descarga allí', q3.ok && q.ok && !!largo && dist(rastra, banco) < 8, `${q3.motivo || ''} ${q.motivo || ''} a ${Math.round(dist(rastra, banco))} m del banco`);
  if (!largo) return;
  // (la cuerda y el hacha, de vuelta)
  await cogerSuelo('cuerda', cuerdaAqui, 3, 1); await J.andar(taller.x, taller.z); await soltarManos();

  // 25d. La rodaja: con el hacha, por el pie del tronco largo (y 2 o 3 troncos cortos)
  console.log('25d. Saca la rodaja del tronco largo con el hacha, y hace la carretilla en el banco');
  await J.andar(hachaAqui.x, hachaAqui.z);
  await hachaALaMano();
  await repararHacha(60);
  await J.andar(largo.x + 0.5, largo.z + 0.5);
  let golpes = 0, tz;
  do { tz = await J.objeto({ tipo: 'trocear', objeto: largo.id, modo: 'rodaja', x: J.pos.x, z: J.pos.z }); golpes++; await pausa(850); } while (tz.ok && !enSuelo('rodaja', largo, 5).length && golpes < 90);
  const rodaja = enSuelo('rodaja', largo, 5)[0];
  const cortosR = enSuelo('tronco_corto', largo, 5);
  comprobar('le saca la rodaja con el hacha de piedra: la rodaja y 2 o 3 troncos cortos', !!rodaja && cortosR.reduce((t, o) => t + o.cosa.n, 0) >= 2, `${golpes} golpes · ${tz.motivo || ''}`);
  if (!rodaja) return;
  // la carretilla: la rodaja (en las dos manos), 2 varas y un tronco corto (al hombro), en el banco
  const hachaJunto = { ...J.pos };
  await soltarManos();
  const lleva = async (tipo, p, a) => { const ok = await cogerSuelo(tipo, p, 5, 1, a); if (!ok) return { ok: false, motivo: `no coge ${tipo}` }; await J.andar(banco.x + 1, banco.z); return depositar(banco, tipo); };
  let d1 = await lleva('rodaja', rodaja, 'mano:der');
  let d2 = await lleva('tronco_corto', cortosR[0], 'hombro');
  // 2 varas: las del suelo de su tierra o, si no, las de un árbol joven que tala
  if (enSuelo('vara', M, 250).length === 0) { await J.andar(hachaJunto.x, hachaJunto.z); await hachaALaMano(); await talar('joven', banco); await soltarManos(); }
  await cogerSuelo('vara', cerca(enSuelo('vara', M, 250), J.pos)[0] || J.pos, 3, 2);
  if (J.cuantos('vara') < 2) await cogerSuelo('vara', cerca(enSuelo('vara', M, 250), J.pos)[0] || J.pos, 3, 2);
  await J.andar(banco.x + 1, banco.z);
  const d3 = await depositar(banco, 'vara', 2);
  q = d1.ok && d2.ok && d3.ok ? await enEstacion(banco, 'carretilla') : { ok: false, motivo: `${d1.motivo || ''} ${d2.motivo || ''} ${d3.motivo || ''}` };
  const carretilla = enSuelo('carretilla', banco, 4)[0];
  comprobar('lleva al banco la rodaja, un tronco corto y 2 varas, y se hace la carretilla de rueda maciza (a su guarda, en su tierra)', q.ok && !!carretilla && carretilla.guarda === yo, `${q.motivo || ''} · ${enMano()}`);
  await soltarManos();
  // el hacha, otra vez a la mano: ahora, los árboles jóvenes
  await J.andar(hachaJunto.x, hachaJunto.z); await hachaALaMano();

  // 25e. En su casa: el portón y la empalizada, delante; el entramado, en una casilla nueva a un lado (con su cimiento)
  console.log('25e. En su casa, con troncos delgados de árboles jóvenes al hombro: la empalizada con su portón, y un cimiento de troncos y un muro de entramado');
  const pieza = (tipo, dx, dz, k = 0) => ({ tipo, x: r2(C.x + dx), z: r2(C.z + dz), k });
  const obra = pz => casa.piezas.get(pz.clave)?.obra;
  const falta = (pz, m) => (PIEZAS[pz.tipo].coste[m] || 0) - ((obra(pz)?.entregado?.[m]) || 0);
  const terminada = pz => !!casa.piezas.get(pz.clave) && !obra(pz);
  const cerca2 = (pz) => ({ x: pz.x + (pz.x > C.x + 0.5 ? 0.6 : pz.x < C.x - 0.5 ? -0.6 : 0), z: pz.z + (pz.z > C.z + 0.5 ? 0.6 : pz.z < C.z - 0.5 ? -0.6 : 0) });
  const marco = async (pz) => {
    const p = cerca2(pz); await J.andar(p.x, p.z);
    const cand = s.mundo.candidata(pz.tipo, pz.x, pz.z, pz.k, 0, 0, T.suelo(C.x, C.z)).pieza;
    pz.clave = claveDe(cand.hueco, cand.i, cand.j, cand.k, cand.d);
    return J.accion({ tipo: 'colocar', pieza: pz.tipo, x: pz.x, z: pz.z, k: pz.k, rot: 0, dir: 0, y: T.suelo(C.x, C.z) });
  };
  const entregar = async (pz, m, n) => { const p = cerca2(pz); await J.andar(p.x, p.z); return J.accion({ tipo: 'entregar', construccion: casa.id, clave: pz.clave, material: m, cantidad: n }); };
  const trabajar = async (pz) => {
    const p = cerca2(pz); await J.andar(p.x, p.z);
    let t = { ok: true }, n = 0;
    for (; n < 400 && t.ok && obra(pz); n++) t = await J.accion({ tipo: 'trabajar', construccion: casa.id, clave: pz.clave, segundos: 5 });
    return { ok: terminada(pz), motivo: t.motivo, n };
  };
  // el primer sitio de la lista donde quepan las piezas (lo dice el servidor al poner el marco)
  const ponerEn = async (opciones) => {
    let motivo = '';
    for (const piezas of opciones) {
      const puestas = [];
      for (const pz of piezas) { const r = await marco(pz); if (!r.ok) { motivo = `${pz.tipo}: ${r.motivo}`; break; } puestas.push(pz); }
      if (puestas.length === piezas.length) return { ok: true, piezas };
      for (const pz of puestas) await J.accion({ tipo: 'desmontar', construccion: casa.id, clave: pz.clave });
    }
    return { ok: false, motivo };
  };
  // un tronco delgado: tala un árbol joven, deja el hacha, se echa el tronco al hombro y se lo lleva a la pieza
  let jovenes = 0;
  const troncoA = async (pz) => {
    await cuidarse();
    const t = await talar('joven', C);
    if (!t.ok) return t;
    jovenes++;
    const tr = enSuelo('tronco_delgado', t.a, 5)[0];
    if (!tr) return { ok: false, motivo: 'no ha dejado tronco' };
    await soltarManos();
    await J.andar(tr.x + 0.6, tr.z);
    const c = await J.objeto({ tipo: 'coger_suelo', objeto: tr.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    if (!c.ok) return c;
    const e = await entregar(pz, 'tronco', 1);
    await J.andar(t.a.x + 1, t.a.z); await hachaALaMano();   // (vuelve a por el hacha)
    return e;
  };
  const conTroncos = async (pz) => { let r = { ok: true }; for (let v = 0; r.ok && v < 8 && falta(pz, 'tronco') > 0; v++) r = await troncoA(pz); return r.ok && falta(pz, 'tronco') <= 0 ? { ok: true } : r; };

  // la empalizada y el portón: delante de la casa, o detrás, o a un lado
  const valla = await ponerEn([
    [pieza('empalizada_puerta', 0, -2.95), pieza('empalizada', 2, -2.95)],
    [pieza('empalizada_puerta', 0, 2.95), pieza('empalizada', 2, 2.95)],
    [pieza('empalizada_puerta', 2.95, 0), pieza('empalizada', 2.95, 2)],
    [pieza('empalizada_puerta', -2.95, 0), pieza('empalizada', -2.95, 2)],
  ]);
  comprobar('pone los marcos del portón y de un tramo de empalizada junto a su casa', valla.ok, valla.motivo);
  if (!valla.ok) return;
  const [porton, empal] = valla.piezas;
  let r = await conTroncos(empal);
  if (r.ok) r = await trabajar(empal);
  comprobar('levanta el tramo de empalizada: 6 troncos delgados, de 6 árboles jóvenes, uno a uno al hombro', r.ok && terminada(empal), terminada(empal) ? '' : `${r.motivo || ''} faltan ${falta(empal, 'tronco')} troncos`);
  r = await conTroncos(porton);
  await soltarManos(['hacha_piedra']);
  const lh = enLaMano('hacha_piedra'); const hachaPorton = { ...J.pos }; if (lh) await soltar(lh);
  if (r.ok) { await cogerSuelo('cuerda', taller, 3, 2); r = await entregar(porton, 'cuerda', J.cuantos('cuerda')); }
  if (r.ok) r = await trabajar(porton);
  comprobar('y el portón: 4 troncos delgados más y sus 2 cuerdas, a su lado', r.ok && terminada(porton), terminada(porton) ? '' : `${r.motivo || ''} faltan ${falta(porton, 'tronco')} troncos y ${falta(porton, 'cuerda')} cuerdas`);
  const abierto = () => casa.piezas.get(porton.clave)?.abierta === true;
  const u1 = await J.accion({ tipo: 'usar', construccion: casa.id, clave: porton.clave }); const a1 = abierto();
  const u2 = await J.accion({ tipo: 'usar', construccion: casa.id, clave: porton.clave }); const a2 = abierto();
  comprobar('abre el portón y lo vuelve a cerrar (es su tierra)', u1.ok && a1 && u2.ok && !a2, `${u1.motivo || ''} ${u2.motivo || ''}`);

  // el entramado: una casilla nueva pegada a la casa, con su cimiento de troncos (2), y en su lado de fuera el muro
  await J.andar(hachaPorton.x, hachaPorton.z); await hachaALaMano();
  // (el muro pide el cimiento terminado: primero el cimiento, en la primera casilla libre al lado de la casa)
  const lado = await ponerEn([[pieza('cim_tronco', -2, 0)], [pieza('cim_tronco', 2, 0)], [pieza('cim_tronco', 0, 2)]]);
  comprobar('pone el marco de un cimiento de troncos en una casilla nueva, pegada a su casa', lado.ok, lado.motivo);
  if (!lado.ok) return;
  const [cim] = lado.piezas;
  r = await conTroncos(cim);
  if (r.ok) r = await trabajar(cim);
  comprobar('lo levanta con 2 troncos delgados más', r.ok && terminada(cim), terminada(cim) ? '' : `${r.motivo || ''} faltan ${falta(cim, 'tronco')} troncos`);
  const dx = cim.x - C.x, dz = cim.z - C.z;
  const muro = pieza('muro_entramado', r2(dx * 1.475), r2(dz * 1.475));
  r = await marco(muro);
  comprobar('pone en su lado de fuera el marco del muro de entramado', r.ok && !!obra(muro), r.motivo);
  if (!r.ok) return;
  r = await conTroncos(muro);
  comprobar('le lleva sus 2 troncos delgados', r.ok, r.motivo);
  // las 2 varas, de los árboles que ha talado
  await soltarManos(['hacha_piedra']);
  const lh2 = enLaMano('hacha_piedra'); const hachaMuro = { ...J.pos }; if (lh2) await soltar(lh2);
  for (let v = 0; v < 4 && falta(muro, 'vara') > 0; v++) { await cogerSuelo('vara', cerca(enSuelo('vara', C, 250), J.pos)[0] || J.pos, 3, falta(muro, 'vara')); if (J.cuantos('vara')) await entregar(muro, 'vara', Math.min(J.cuantos('vara'), falta(muro, 'vara'))); else break; }
  comprobar('y 2 varas de los árboles que taló', falta(muro, 'vara') === 0, `faltan ${falta(muro, 'vara')}`);
  await soltarManos();
  // el barro: 3 cestas de la ribera más cercana, con un palo cavador que se hace con una rama
  await cuidarse();
  // (el río más cercano a su casa, en anillos de 25 m, como al principio del recorrido, y el barro de su orilla)
  let rio = null;
  for (let rr = 0; rr < 3000 && !rio; rr += 25) for (let k = 0; k < 96; k++) {
    const x = C.x + Math.cos(k / 96 * 2 * Math.PI) * rr, z = C.z + Math.sin(k / 96 * 2 * Math.PI) * rr, X = x + O.x, Z = z + O.z;
    const { dm, ancho } = T.paisaje.rioCerca(X, Z, T.paisaje.riosEn(X - 20, Z - 20, X + 20, Z + 20));
    if (dm - ancho / 2 < 4 && T.alt(X, Z) > 0.5) { rio = { x: r2(x), z: r2(z) }; break; }
  }
  const barro = rio && cerca(alrededor(rio, 100).filter(p => p.tipo === 'barro'), rio)[0];
  let cavadas = 0, motivoBarro = barro ? '' : 'no hay ribera con barro cerca';
  if (barro) {
    if (!J.cuantos('palo_cavador') && !J.cuantos('pala_madera')) {
      const ramas = cerca(alrededor(J.pos, 200).filter(p => p.tipo === 'ramas' && !probados.has(p.id)), J.pos);
      for (const p of ramas) { if (J.cuantos('rama')) break; probados.add(p.id); await recoger(p); }
      const pc = await deMano('palo_cavador'); if (!pc.ok) motivoBarro = pc.motivo;
      const sobra = enLaMano('rama'); if (sobra) await soltar(sobra);
    }
    await aLaMano(J.cuantos('palo_cavador') ? 'palo_cavador' : 'pala_madera');
    for (let v = 0; v < 6 && J.cuantos('barro') < 3; v++) { const c = await recoger(barro); if (c.ok) cavadas++; else { motivoBarro = c.motivo; break; } }
    const herr = enLaMano('palo_cavador') || enLaMano('pala_madera'); if (herr) await soltar(herr);
  }
  comprobar('va a la ribera con un palo cavador y cava 3 cestas de barro', J.cuantos('barro') >= 3, `${cavadas} · ${motivoBarro} · ${enMano()}${barro ? ` · a ${Math.round(dist(barro, C))} m de su casa` : ''}`);
  r = J.cuantos('barro') ? await entregar(muro, 'barro', 3) : { ok: false };
  if (r.ok && falta(muro, 'tronco') <= 0 && falta(muro, 'vara') <= 0) r = await trabajar(muro);
  comprobar('lleva el barro al muro de entramado y lo levanta: la casa más fuerte, con su empalizada, su portón y su muro de entramado', r.ok && terminada(muro) && terminada(empal) && terminada(porton), terminada(muro) ? '' : `${r.motivo || ''} faltan ${falta(muro, 'barro')} de barro`);
  console.log(`     (${jovenes} árboles jóvenes talados para la empalizada, el portón, el cimiento y el entramado)`);
  await J.andar(hachaMuro.x, hachaMuro.z); await hachaALaMano(); await soltarManos();
  await J.andar(inicio.x, inicio.z);
}

// Seguir desde lo guardado (ver arriba): KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_casa_fuerte.mjs
if (process.argv[1] && process.argv[1].endsWith('recorrido_casa_fuerte.mjs') && process.env.KINHOLD_RECORRIDO_DESDE) {
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
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-casa-fuerte-')); cpSync(desde, dir, { recursive: true });
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
  try { await casaFuerte({ J, s, T, O, comprobar, pausa, cerca }); }
  catch (e) { comprobar('la casa más fuerte llega al final', false, e && e.stack); }
  J.ws.close(); await s.cerrar();
  console.log(`\n${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
}
