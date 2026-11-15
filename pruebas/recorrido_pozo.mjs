// Recorrido de jugador del pozo (P11b, «El pozo (3), sacar agua»): el paso 23 de pruebas/prueba_recorrido.mjs, el mismo
// jugador, sin arcón y con lo que recoge. Busca en su tierra, lejos de cualquier río, el sitio donde el agua está menos
// honda (como lo ve el aviso de construir: la hondura del terreno del servidor), se hace en su banco una pala de madera
// y un cubo con troncos cortos (los que le sobran de tronzar o, si no, de tronzar otro árbol adulto), marca el pozo,
// cava cada tramo a golpes de pala y lo reviste con piedras que recoge, hasta el agua; levanta el brocal con más
// piedras y pone el travesaño con 3 varas de un árbol joven y una cuerda que trenza; saca agua con el cubo y bebe del
// pozo. Así, lejos del río, tiene agua dulce.
// Cadena: pala y cubo ← tronco corto ← tronzar un tronco largo ← árbol adulto; piedras ← piedra suelta; varas ← árbol
// joven; cuerda ← 3 cordeles ← fibra.
// Para trabajar en esta parte sin repetir lo de antes: KINHOLD_RECORRIDO_GUARDAR=<carpeta> node pruebas/prueba_recorrido.mjs
// guarda el mundo antes de la granja; KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_pozo.mjs sigue desde ahí
// con el pozo (sin la granja).
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { vegetacionEn } from '../src/logica/vegetacion.js';
import { idArbol } from '../src/logica/tala.js';
import { hayAguaCerca } from '../src/logica/necesidades.js';
import { honduraEn, tramosDe, rematado, GOLPES_TRAMO, PIEDRAS_TRAMO, PIEDRAS_BROCAL, ENTRE_POZOS } from '../src/logica/pozo.js';
import { campoEn } from '../src/logica/campos.js';

const MANOS = ['mano:der', 'mano:izq'];

export async function pozo({ J, s, T, O, comprobar, pausa, cerca }) {
  const yo = J.bienvenida.autor;
  const r2 = v => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const enMano = () => MANOS.map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
  const enLaMano = (tipo) => MANOS.find(l => J.inv.lugares[l]?.tipo === tipo);
  const soltar = (l) => J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z });
  const soltarManos = async (salvo = []) => { for (const l of MANOS) if (J.inv.lugares[l] && !salvo.includes(J.inv.lugares[l].tipo)) await soltar(l); };
  const adelantar = () => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola || [])]) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1); };
  const enSuelo = (tipo, p, d = 3) => cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === tipo && !o.arrastra && dist(o, p) < d), p);
  const probados = new Set();
  const alrededor = (p, d) => recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - d, z0: O.z + p.z - d, x1: O.x + p.x + d, z1: O.z + p.z + d })
    .map(q => ({ id: q.id, tipo: q.tipo, x: r2(q.x - O.x), z: r2(q.z - O.z) }));
  const recoger = async (p) => { probados.add(p.id); await J.andar(p.x + 0.4, p.z); return J.objeto({ tipo: 'recoger', punto: p.id, x: J.pos.x, z: J.pos.z, px: p.x, pz: p.z, clase: p.tipo }); };
  const juntar = async (tipos, da, n, radio = 300) => {
    const lista = alrededor(J.pos, radio).filter(q => tipos.includes(q.tipo));
    for (let k = 0; k < 40 && J.cuantos(da) < n; k++) {
      const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0];
      if (!p) break;
      await recoger(p);
    }
    return J.cuantos(da) >= n;
  };
  const cogerSuelo = async (tipo, p, d = 3, cantidad) => {
    for (const o of enSuelo(tipo, p, d)) {
      const libre = MANOS.find(l => !J.inv.lugares[l]) || MANOS.find(l => J.inv.lugares[l]?.tipo === tipo);
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
    return { ok: f.ok && g.ok, motivo: f.motivo || g.motivo };
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
  comprobar('23. tiene su tierra y su banco de tronco en ella', !!M && !!banco, JSON.stringify({ M, banco: banco && [banco.x, banco.z] }));
  if (!M || !banco) return;
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
        const rb = await recoger(m);
        if (rb.ok) { const tipo = m.tipo === 'bayas' ? 'bayas' : 'setas'; for (let i = 0; i < 6 && J.cuantos(tipo) && nec().hambre > 20; i++) await J.objeto({ tipo: 'comer', objeto: tipo }); }
      }
    }
    if (dist(J.pos, desde) > 1) await J.andar(desde.x, desde.z);
  };

  // talar el árbol de edad más cercano a p que nadie ha tocado (con su hacha de piedra) y limpiarlo; lo que deja, al suelo
  const talar = async (edad, p) => {
    await soltarManos();
    const hacha = J.cuantos('hacha_piedra') || (await cogerSuelo('hacha_piedra', banco, 30)) || (await cogerSuelo('hacha_piedra', M, 300));
    if (!hacha) return { ok: false, motivo: 'no encuentra su hacha' };
    const arboles = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - 150, z0: O.z + p.z - 150, x1: O.x + p.x + 150, z1: O.z + p.z + 150 }).arboles
      .map(a => ({ x: a.x - O.x, z: a.z - O.z, edad: a.edad })).map(a => ({ ...a, id: idArbol(a.x, a.z) })).filter(a => a.edad === edad && !s.objetos.tala.estado[a.id] && !campoEn(s.mundo, a.x, a.z));
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
    return { ok: true, a, golpes: g + gl };
  };

  // 23a. El sitio: en su tierra, en seco y lejos de cualquier río (a más de 60 m del agua), donde el agua bajo tierra
  // esté menos honda; libre (sin campo ni puesto ni obra a 4 m) y a no más de 150 m del banco
  console.log('23. El pozo (P11b): lo marca en su tierra lejos del río, lo cava y lo reviste hasta el agua, le pone el brocal y el travesaño, saca agua con el cubo y bebe');
  const libre = (x, z) => !campoEn(s.mundo, x, z) && !(s.mundo.pozos || []).some(p => Math.hypot(p.x - x, p.z - z) < ENTRE_POZOS)
    && !Object.values(s.objetos.fab.estaciones).some(e => Math.hypot(e.x - x, e.z - z) < 4) && !s.mundo.construcciones.some(c => Math.hypot(c.ox - x, c.oz - z) < 6);
  const lejosDelRio = (x, z) => { for (let d = 0; d <= 60; d += 10) for (let k = 0; k < 12; k++) if (T.aguaEn(x + Math.cos(k / 12 * 6.283) * d, z + Math.sin(k / 12 * 6.283) * d)) return false; return true; };
  let sitio = null;
  for (let d = 6; d <= 150; d += 6) for (let k = 0; k < 24; k++) {
    const x = r2(banco.x + Math.cos(k / 24 * 6.283) * d), z = r2(banco.z + Math.sin(k / 24 * 6.283) * d);
    if (!s.mundo.dentroDeTierra(x, z, yo) || !libre(x, z) || !lejosDelRio(x, z)) continue;
    const h = honduraEn(T, x, z);
    if (h !== null && (!sitio || h < sitio.h - 0.3)) sitio = { x, z, h };
  }
  comprobar('busca en su tierra, lejos de cualquier río, el sitio de agua menos honda', !!sitio, sitio ? `a ${sitio.h} m (${tramosDe({ hondura: sitio.h })} tramos), a ${Math.round(dist(sitio, banco))} m del banco` : 'ninguno');
  if (!sitio) return;
  const TR = tramosDe({ hondura: sitio.h });

  // 23b. La pala de madera y el cubo: un tronco corto cada uno, en el banco
  console.log('23b. Se hace en su banco una pala de madera y un cubo (un tronco corto cada uno)');
  const cortos = () => enSuelo('tronco_corto', banco, 40);
  const nCortos = () => cortos().reduce((t, o) => t + o.cosa.n, 0);
  console.log(`     (le quedan ${nCortos()} troncos cortos junto al banco)`);
  if (nCortos() < 2) {
    // tala un árbol adulto, lo limpia y lo tronza a hachazos: 3 o 4 troncos cortos más
    const ad = await talar('adulto', banco);
    const largo = ad.ok && enSuelo('tronco_largo', ad.a, 8)[0];
    let golpes = 0, tz = { ok: false, motivo: ad.motivo || 'no hay tronco largo' };
    if (largo) {
      await J.andar(largo.x + 0.5, largo.z + 0.5);
      do { tz = await J.objeto({ tipo: 'trocear', objeto: largo.id, x: J.pos.x, z: J.pos.z }); golpes++; await pausa(850); } while (tz.ok && enSuelo('tronco_corto', largo, 4).length === 0 && golpes < 80);
    }
    const nuevos = largo ? enSuelo('tronco_corto', largo, 4) : [];
    comprobar('no le quedan dos troncos cortos: tala un árbol adulto y lo tronza (3 o 4 más)', nuevos.reduce((t, o) => t + o.cosa.n, 0) >= 3, `${ad.motivo || ''} ${golpes} golpes · ${tz.motivo || ''}`);
    await soltarManos();
    // se los lleva al banco de uno en uno, al hombro (dos: la pala y el cubo)
    for (let k = 0; k < 2 && nCortos() < 2; k++) {
      const o = enSuelo('tronco_corto', largo, 4)[0];
      if (!o) break;
      await J.andar(o.x + 0.3, o.z);
      const c = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
      if (!c.ok) break;
      await J.andar(banco.x + 1.5, banco.z + 1.5);
      await J.objeto({ tipo: 'soltar_suelo', de: 'hombro', x: J.pos.x, z: J.pos.z });
    }
  }
  const hacerDeTronco = async (receta) => {
    await soltarManos();
    const o = cortos()[0];
    if (!o) return { ok: false, motivo: 'no le quedan troncos cortos' };
    await J.andar(o.x + 0.3, o.z);
    const c = await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: 1, a: 'hombro', x: J.pos.x, z: J.pos.z });
    if (!c.ok) return c;
    await J.andar(banco.x + 1, banco.z);
    const d = await depositar(banco, 'tronco_corto');
    if (!d.ok) return d;
    return enEstacion(banco, receta);
  };
  let q = await hacerDeTronco('pala_madera');
  comprobar('lleva un tronco corto al hombro hasta el banco y se hace la pala de madera', q.ok && J.cuantos('pala_madera') === 1, `${q.motivo || ''} · ${enMano()}`);
  if (enLaMano('pala_madera')) await soltar(enLaMano('pala_madera'));
  q = J.cuantos('pala_madera') || enSuelo('pala_madera', J.pos, 3).length ? await hacerDeTronco('cubo') : q;
  comprobar('y con otro, el cubo', q.ok && J.cuantos('cubo') === 1, `${q.motivo || ''} · ${enMano()}`);
  if (!J.cuantos('cubo')) return;
  // (la pala, la recoge del suelo: la dejó junto al banco)
  await soltarManos();
  const dejado = { x: J.pos.x, z: J.pos.z };

  // 23c. Marcar el pozo (en construir, con el aviso de la hondura): donde está
  await aLaMano('pala_madera', dejado);
  await J.andar(sitio.x, sitio.z);
  let r = await J.accion({ tipo: 'pozo', x: sitio.x, z: sitio.z, hondura: 99 });
  const P = () => (s.mundo.pozos || []).find(p => p.autor === yo && Math.hypot(p.x - sitio.x, p.z - sitio.z) < 0.1);
  comprobar('marca el pozo allí: el servidor pone la hondura del terreno (no la que dice el navegador)', r.ok && P() && P().hondura === sitio.h, `${r.motivo || ''} ${P() ? P().hondura : ''}`);
  if (!P()) return;
  const id = P().id;
  const junto = { x: r2(sitio.x - 1.3), z: sitio.z };

  // 23d. Cavar y revestir, tramo a tramo, hasta el agua: las piedras, recogidas por aquí (3 en cada mano)
  const piedrasA = async (n) => {
    await soltarManos(['pala_madera']);
    if (enLaMano('pala_madera')) { const p = enLaMano('pala_madera'); await soltar(p); }
    const ok = await juntar(['piedra'], 'piedra', Math.min(n, 6), 400);
    await J.andar(junto.x, junto.z);
    return ok || J.cuantos('piedra') > 0;
  };
  let golpes = 0, piedras = 0, viajes = 0;
  for (let t = 0; t < TR && P().revestidos < TR; t++) {
    await cuidarse();
    if (!enLaMano('pala_madera')) { await J.andar(junto.x, junto.z); await aLaMano('pala_madera', junto); }
    if (!enLaMano('pala_madera')) await aLaMano('pala_madera', dejado);
    await J.andar(junto.x, junto.z);
    for (let g = 0; g < GOLPES_TRAMO + 2 && P().cavados <= t; g++) { r = await J.accion({ tipo: 'cavar_pozo', pozo: id }); if (r.ok) golpes++; else break; await pausa(2000); }
    if (P().cavados <= t) { comprobar(`cava el tramo ${t + 1}`, false, r.motivo); return; }
    for (let v = 0; v < 6 && P().revestidos <= t; v++) {
      if (!(await piedrasA(PIEDRAS_TRAMO - (P().piedras || 0)))) break;
      viajes++;
      const antes = J.cuantos('piedra');
      r = await J.accion({ tipo: 'revestir_pozo', pozo: id });
      if (r.ok) piedras += antes - J.cuantos('piedra');
    }
    if (P().revestidos <= t) { comprobar(`reviste el tramo ${t + 1}`, false, r.motivo); return; }
  }
  comprobar(`cava y reviste los ${TR} tramos hasta el agua (${GOLPES_TRAMO} golpes de pala y ${PIEDRAS_TRAMO} piedras por tramo)`, P().cavados === TR && P().revestidos === TR && golpes === GOLPES_TRAMO * TR && piedras === PIEDRAS_TRAMO * TR, `${golpes} golpes, ${piedras} piedras en ${viajes} viajes`);
  await soltarManos(); await J.andar(dejado.x, dejado.z); await aLaMano('cubo', dejado); await J.andar(junto.x, junto.z);
  q = enLaMano('cubo') ? await J.objeto({ tipo: 'llenar_cubo' }) : { ok: false, motivo: 'no lleva el cubo' };
  comprobar('con agua pero sin brocal ni travesaño, el cubo aún no se llena (y no hay río cerca)', !q.ok && q.motivo === 'Aquí no hay agua: busca un río.', q.motivo);
  const sitioCubo = { ...J.pos };   // (el cubo, a sus pies junto al pozo)
  await soltarManos();

  // 23e. El brocal: 12 piedras más
  let puestas = 0;
  for (let v = 0; v < 8 && (P().brocal || 0) < PIEDRAS_BROCAL; v++) {
    if (!(await piedrasA(PIEDRAS_BROCAL - (P().brocal || 0)))) break;
    const antes = J.cuantos('piedra');
    r = await J.accion({ tipo: 'rematar_pozo', pozo: id });
    if (r.ok) puestas += antes - J.cuantos('piedra');
  }
  comprobar(`levanta el brocal con ${PIEDRAS_BROCAL} piedras más`, P().brocal === PIEDRAS_BROCAL && puestas === PIEDRAS_BROCAL, `${P().brocal} · ${r.motivo || ''}`);
  await soltarManos();

  // 23f. El travesaño: 3 varas (de un árbol joven: las que dejó por el suelo, o de talar otro) y una cuerda que trenza
  console.log('23f. El travesaño: 3 varas y una cuerda trenzada en el banco');
  const varas = () => enSuelo('vara', M, 200).filter(o => !o.arrastra);
  for (let k = 0; k < 6 && J.cuantos('vara') < 3; k++) { const o = cerca(varas(), J.pos)[0]; if (!o) break; await J.andar(o.x + 0.3, o.z); await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(3 - J.cuantos('vara'), o.cosa.n), a: 'mano:der', x: J.pos.x, z: J.pos.z }); }
  if (J.cuantos('vara') < 3) {
    // (no le quedan: tala un árbol joven con su hacha de piedra; deja varas y un tronco delgado)
    const lv0 = enLaMano('vara'), guardadas = { ...J.pos };
    if (lv0) await soltar(lv0);
    const tj = await talar('joven', J.pos);
    await soltarManos();
    if (lv0) await cogerSuelo('vara', guardadas, 3);
    if (tj.ok) for (let k = 0; k < 6 && J.cuantos('vara') < 3; k++) { const o = cerca(enSuelo('vara', tj.a, 8), J.pos)[0]; if (!o) break; await J.andar(o.x + 0.3, o.z); await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(3 - J.cuantos('vara'), o.cosa.n), a: enLaMano('vara') || 'mano:der', x: J.pos.x, z: J.pos.z }); }
    else console.log(`     (no tala el joven: ${tj.motivo})`);
  }
  comprobar('junta 3 varas', J.cuantos('vara') >= 3, enMano());
  // la cuerda: 9 de fibra, 3 cordeles con las manos que deja en el banco, y la trenza
  const lv = enLaMano('vara');
  await J.andar(banco.x + 1, banco.z);
  if (lv) await soltar(lv);
  const conVaras = { ...J.pos };
  await soltarManos();
  let ok = await juntar(['ortiga', 'hierba_larga'], 'fibra', 9, 250);
  await J.andar(banco.x + 1, banco.z); await soltarManos();
  for (let v = 0; ok && v < 3; v++) { const c = await deMano('cordel'); const d = c.ok ? await depositar(banco, 'cordel') : c; ok = c.ok && d.ok; }
  q = ok ? await enEstacion(banco, 'cuerda') : { ok: false, motivo: 'sin cordeles' };
  comprobar('trenza una cuerda en el banco (9 de fibra, 3 cordeles)', q.ok && J.cuantos('cuerda') >= 1, `${q.motivo || ''} · ${enMano()}`);
  await soltarManos(['cuerda']);
  await cogerSuelo('vara', conVaras, 3, 3);
  await J.andar(junto.x, junto.z);
  r = await J.accion({ tipo: 'rematar_pozo', pozo: id });
  comprobar('pone el travesaño con las 3 varas y la cuerda: el pozo, rematado', r.ok && rematado(P()), `${r.motivo || ''} · ${enMano()}`);
  await soltarManos();

  // 23g. Sacar agua y beber, lejos del río
  await J.andar(sitioCubo.x, sitioCubo.z); await aLaMano('cubo', sitioCubo);
  await J.andar(junto.x, junto.z);
  q = await J.objeto({ tipo: 'llenar_cubo' });
  comprobar('con el cubo vacío a su lado, saca del pozo un cubo de agua dulce (sin río a menos de 60 m)', q.ok && !!enLaMano('cubo_agua') && !hayAguaCerca(T.aguaEn, J.pos.x, J.pos.z), `${q.motivo || ''} · ${enMano()}`);
  const sed0 = nec().sed;
  q = await J.objeto({ tipo: 'beber', x: J.pos.x, z: J.pos.z });
  comprobar('y bebe del pozo', q.ok && (sed0 === 0 || nec().sed < sed0), `${q.motivo || ''} sed ${Math.round(sed0)} → ${Math.round(nec().sed)}`);
}

// Seguir desde lo guardado (ver arriba): KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_pozo.mjs
if (process.argv[1] && process.argv[1].endsWith('recorrido_pozo.mjs') && process.env.KINHOLD_RECORRIDO_DESDE) {
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
  const T = terrenoWhitholm(), O = T.origen;
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-pozo-')); cpSync(desde, dir, { recursive: true });
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
    c.accion = async (accion) => { const { USAN_INVENTARIO } = await import('../src/logica/acciones.js'); const id = ++c.id + 100000; const p = c.esperar(m => m.tipo === 'resultado' && m.id === id); const q = USAN_INVENTARIO.has(accion.tipo) ? c.esperar(m => m.tipo === 'inventario') : null; ws.send(JSON.stringify({ tipo: 'accion', id, accion })); return q ? Promise.all([p, q]).then(([r]) => r) : p; };
    c.estar = (x, z) => { c.pos = { x, z }; ws.send(JSON.stringify({ tipo: 'estado', x, y: T.suelo(x, z), z, giro: 0, anim: 'andar' })); };
    c.andar = async (x, z) => { for (let i = 0; i < 100000; i++) { const paso = c.nec && c.nec.cansancio >= 90 ? 0.36 : 0.6; const { x: x0, z: z0 } = c.pos, d = Math.hypot(x - x0, z - z0); if (d <= paso) { c.estar(x, z); await pausa(100); break; } c.estar(x0 + (x - x0) * paso / d, z0 + (z - z0) * paso / d); await pausa(100); } await pausa(150); };
    c.cuantos = (tipo) => (c.inv ? c.inv.cuantos(tipo) : 0);
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if ((m.tipo === 'bienvenida' || m.tipo === 'inventario' || m.tipo === 'resultado_objeto') && m.inventario) c.inv = Inventario.importarJugador(m.inventario); if (m.necesidades && (m.tipo === 'bienvenida' || m.tipo === 'necesidades')) c.nec = m.necesidades; c.esperas = c.esperas.filter(e => { if (e.cond(m)) { e.r(m); return false; } return true; }); });
    const b = c.esperar(m => m.tipo === 'bienvenida', 20000);
    ws.on('open', async () => { c.bienvenida = await b; c.pos = c.bienvenida.posicion ? { x: c.bienvenida.posicion.x, z: c.bienvenida.posicion.z } : meta.pos; listo(c); });
    ws.on('error', fallo);
  });
  try { await pozo({ J, s, T, O, comprobar, pausa, cerca }); }
  catch (e) { comprobar('el pozo llega al final', false, e && e.stack); }
  J.ws.close(); await s.cerrar();
  console.log(`\n${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
}
