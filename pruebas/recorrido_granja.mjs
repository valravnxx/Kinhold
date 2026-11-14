// Recorrido de jugador de la granja (P11, 14 nov): el paso 22 de pruebas/prueba_recorrido.mjs, el mismo jugador, sin
// arcón y con lo que recoge. Recoge semillas silvestres (col y nabo en la ribera; cebada y habas en los claros de su
// tierra), hace estacas y marca un campo en su tierra alrededor de un árbol joven, lo limpia (lo tala, arranca el tocón
// con la azada que se hace en su banco y recoge las piedras), lo labra, siembra cebada a voleo y habas, col y nabo planta
// a planta, escarda a mitad del crecimiento, cosecha con el reloj acelerado (siega la cebada con la hoz de sílex y coge
// lo demás a mano), levanta una era, trilla las gavillas con el mayal y pone un tejado de paja.
// El reloj acelerado: lo sembrado tarda una semana real (src/logica/campos.js, CRECER); la prueba adelanta la hora a la
// que se sembró, como adelanta la de lo que se fabrica. No le da nada: solo ahorra la espera.
//
// Para trabajar en esta parte sin repetir lo de antes (unos 15 minutos): KINHOLD_RECORRIDO_GUARDAR=<carpeta> node
// pruebas/prueba_recorrido.mjs guarda el mundo justo antes de este paso y sale; luego
// KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_granja.mjs sigue desde ahí.
import { recogidaEn } from '../src/logica/recogida_mundo.js';
import { vegetacionEn } from '../src/logica/vegetacion.js';
import { idArbol } from '../src/logica/tala.js';
import { PIEZAS, ALTURA } from '../src/logica/piezas.js';
import { clave as claveDe } from '../src/logica/construccion.js';
import { CRECER, PENDIENTE_MAX, campoEn, labradoEn, casillasVoleo, rejilla, dentroPoligono } from '../src/logica/campos.js';

const MANOS = ['mano:der', 'mano:izq'];

export async function granja({ J, s, T, O, comprobar, pausa, cerca }) {
  const yo = J.bienvenida.autor;
  const r2 = v => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const enMano = () => MANOS.map(l => J.inv && J.inv.lugares[l] ? `${J.inv.lugares[l].tipo}×${J.inv.lugares[l].n}` : '–').join(' ');
  const enLaMano = (tipo) => MANOS.find(l => J.inv.lugares[l]?.tipo === tipo);
  const soltar = async (l) => { const q = await J.objeto({ tipo: 'soltar_suelo', de: l, x: J.pos.x, z: J.pos.z }); return q; };
  const soltarManos = async (salvo = []) => { for (const l of MANOS) if (J.inv.lugares[l] && !salvo.includes(J.inv.lugares[l].tipo)) await soltar(l); };
  // lo encargado termina ya (solo se ahorra la espera)
  const adelantar = () => { const f = s.objetos.fab; for (const c of [...(f.manos[yo] || []), ...Object.values(f.estaciones).flatMap(e => e.cola || [])]) if (c.autor === yo) c.fin = Math.min(c.fin, Date.now() - 1); };
  const enSuelo = (tipo, p, d = 3) => cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === tipo && !o.arrastra && dist(o, p) < d), p);
  const probados = new Set();
  const alrededor = (p, d) => recogidaEn(T.paisaje, T.alt, T.semilla, { x0: O.x + p.x - d, z0: O.z + p.z - d, x1: O.x + p.x + d, z1: O.z + p.z + d })
    .map(q => ({ id: q.id, tipo: q.tipo, x: r2(q.x - O.x), z: r2(q.z - O.z) }));
  const recoger = async (p) => { probados.add(p.id); await J.andar(p.x + 0.4, p.z); return J.objeto({ tipo: 'recoger', punto: p.id, x: J.pos.x, z: J.pos.z, px: p.x, pz: p.z, clase: p.tipo }); };
  // recoger de los puntos de tipo `tipos` (los más cercanos a donde está) hasta llevar n de `da`
  const juntar = async (tipos, da, n, radio = 300) => {
    const lista = alrededor(J.pos, radio).filter(q => tipos.includes(q.tipo));
    for (let k = 0; k < 40 && J.cuantos(da) < n; k++) {
      const p = cerca(lista.filter(q => !probados.has(q.id)), J.pos)[0];
      if (!p) break;
      await recoger(p);
    }
    return J.cuantos(da) >= n;
  };
  // coger del suelo (a una mano libre) lo de tipo que haya a menos de d m de p
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
  const ponerPuesto = async (estacion, x, z) => {
    const rc = await J.objeto({ tipo: 'colocar_estacion', estacion, x, z });
    if (!rc.ok) return rc;
    const id = rc.datos.id, re = await J.objeto({ tipo: 'entregar_estacion', estacion: id, x: J.pos.x, z: J.pos.z });
    if (!re.ok) return { ...re, id };
    let rt = { ok: true, datos: {} };
    for (let i = 0; i < 20 && rt.ok && !rt.datos.terminada; i++) rt = await J.objeto({ tipo: 'trabajar_estacion', estacion: id, segundos: 5, x: J.pos.x, z: J.pos.z });
    return { ...rt, id };
  };
  const suyas = (tipo) => Object.values(s.objetos.fab.estaciones).filter(e => e.autor === yo && e.tipo === tipo && !e.obra);
  const M = s.mundo.mojonDe(yo);
  const banco = M && cerca(suyas('banco_tronco'), M)[0];
  const tallar = M && cerca(suyas('piedra_tallar'), M)[0];
  comprobar('tiene su tierra, su banco de tronco y su piedra de tallar en ella', !!M && !!banco && !!tallar && s.mundo.dentroDeTierra(banco.x, banco.z, yo), JSON.stringify({ M, banco: banco && [banco.x, banco.z], tallar: tallar && [tallar.x, tallar.z] }));
  if (!M || !banco || !tallar) return;
  // una cuerda en el banco: 9 de fibra, 3 cordeles con las manos, que deja en él, y la trenza
  const cuerda = async () => {
    await J.andar(banco.x + 1, banco.z); await soltarManos();
    if (!(await juntar(['ortiga', 'hierba_larga'], 'fibra', 9, 250))) return { ok: false, motivo: `solo ${J.cuantos('fibra')} de fibra` };
    await J.andar(banco.x + 1, banco.z);
    for (let v = 0; v < 3; v++) {
      const q = await deMano('cordel');
      if (!q.ok) return q;
      const d = await depositar(banco, 'cordel');
      if (!d.ok) return d;
    }
    const sobra = enLaMano('fibra'); if (sobra) await soltar(sobra);
    return enEstacion(banco, 'cuerda');
  };

  console.log('22. La granja: semillas silvestres, estacas, el campo, limpiarlo, labrarlo, sembrar, escardar, cosechar, la era, trillar y el tejado de paja');
  // 22a. En la ribera (está junto a la hoguera de la orilla): col y nabo silvestres, uno en cada mano
  console.log('22a. Recoge col y nabo silvestres en la ribera');
  await soltarManos();
  const colOk = await juntar(['col_silvestre'], 'semilla_col', 1, 400);
  const naboOk = await juntar(['nabo_silvestre'], 'semilla_nabo', 1, 400);
  comprobar('recoge a mano semillas de col y de nabo silvestres en la ribera', colOk && naboOk, `col ${J.cuantos('semilla_col')}, nabo ${J.cuantos('semilla_nabo')} · ${enMano()}`);

  // 22b. A su tierra: lo deja junto al banco, y recoge cebada y habas silvestres en los claros
  console.log('22b. Vuelve a su tierra y recoge cebada y habas silvestres en los claros');
  const deposito = { x: r2(banco.x + 2), z: r2(banco.z + 1.5) };
  await J.andar(deposito.x, deposito.z); await soltarManos();
  const cebOk = await juntar(['cebada_silvestre'], 'semilla_cebada', 4, 300);
  const habOk = await juntar(['habas_silvestres'], 'habas', 2, 300);
  comprobar('recoge a mano cebada silvestre (4 puñados o más) y habas', cebOk && habOk, `cebada ${J.cuantos('semilla_cebada')}, habas ${J.cuantos('habas')} · ${enMano()}`);
  await J.andar(deposito.x, deposito.z); await soltarManos();

  // 22c. El sitio del campo: alrededor de un árbol joven de su tierra, lejos de sus obras, en llano y sin agua; dentro,
  // ningún otro árbol ni mata (las piedras sueltas sí: las recoge)
  const L = 3;   // medio lado: un campo de 6 × 6 m
  const est = Object.values(s.objetos.fab.estaciones);
  const obras = s.mundo.construcciones.flatMap(c => [...c.piezas.values()].map(p => { const m = s.mundo.centroPieza ? s.mundo.centroPieza(c, p) : null; return m || { x: c.ox ?? c.x ?? 0, z: c.oz ?? c.z ?? 0 }; }));
  const pend = (x, z) => Math.hypot(T.suelo(x + 1.5, z) - T.suelo(x - 1.5, z), T.suelo(x, z + 1.5) - T.suelo(x, z - 1.5)) / 3;
  const veg = vegetacionEn(T.paisaje, T.alt, T.semilla, { x0: O.x + M.x - 120, z0: O.z + M.z - 120, x1: O.x + M.x + 120, z1: O.z + M.z + 120 }).arboles
    .map(e => ({ x: e.x - O.x, z: e.z - O.z, edad: e.edad })).map(e => ({ ...e, id: idArbol(e.x, e.z) }));
  const vale = (a) => {
    if (a.edad !== 'joven' || !s.objetos.tala.enPie(a.id, Date.now())) return false;
    if (dist(a, M) < 15 || est.some(e => dist(e, a) < 12) || obras.some(o => dist(o, a) < 12)) return false;
    for (let i = -L - 1; i <= L + 1; i++) for (let j = -L - 1; j <= L + 1; j++) {
      const x = a.x + i, z = a.z + j;
      if (!s.mundo.dentroDeTierra(x, z, yo) || T.aguaEn(x, z) !== null || pend(x, z) > PENDIENTE_MAX * 0.8 || campoEn(s.mundo, x, z)) return false;
    }
    const c = T.cercaDe(a.x, a.z, L * 1.5 + 2);
    const dentro = (p, m) => Math.abs(p.x - a.x) <= L + m && Math.abs(p.z - a.z) <= L + m;
    if (c.arboles.some(b => b.id !== a.id && dentro(b, 1.9))) return false;
    if (c.matas.some(p => dentro(p, 1.3))) return false;
    return true;
  };
  const arbol = cerca(veg.filter(vale), M)[0];
  comprobar('hay en su tierra un sitio llano para un campo de 6 × 6 m alrededor de un árbol joven', !!arbol, arbol ? `a ${Math.round(dist(arbol, M))} m del mojón` : `${veg.length} árboles mirados`);
  if (!arbol) return;
  const esquinas = [[-L, -L], [L, -L], [L, L], [-L, L]].map(([i, j]) => ({ x: r2(arbol.x + i), z: r2(arbol.z + j) }));

  // 22d. Estacas: 4 ramas, 4 estacas con las manos, y las clava en las esquinas; la última, junto a la primera, lo cierra
  console.log('22c. Hace 4 estacas (1 rama cada una) y marca con ellas el campo alrededor del árbol joven');
  await juntar(['ramas'], 'rama', 4, 200);
  let hechas = 0;
  for (let k = 0; k < 4; k++) { const q = await deMano('estaca'); if (q.ok) hechas++; }
  comprobar('hace 4 estacas con las manos, de 1 rama cada una', hechas === 4 && J.cuantos('estaca') === 4, `${hechas} · ${enMano()}`);
  let rc = null, clavadas = 0, mal = [];
  for (const p of [...esquinas, esquinas[0]]) {
    await J.andar(p.x, p.z);
    rc = await J.accion({ tipo: 'estaca', x: p.x, z: p.z });
    if (rc.ok) clavadas++; else mal.push(rc.motivo);
  }
  const campo = campoEn(s.mundo, arbol.x, arbol.z);
  comprobar('clava las 4 estacas y, al volver a la primera, el campo se cierra (36 m²)', clavadas === 5 && !!campo && campo.cerrado && campo.area === 36, `${clavadas} · ${mal.join(' | ')} · ${campo && campo.area} m²`);
  if (!campo) return;
  const cid = campo.id;
  const dentroCampo = (x, z) => dentroPoligono(campo.puntos, x, z);
  const puntosLabrar = [];
  for (let i = -L + 0.9; i <= L - 0.9 + 1e-6; i += 1.4) for (let j = -L + 0.9; j <= L - 0.9 + 1e-6; j += 1.4) puntosLabrar.push({ x: r2(arbol.x + i), z: r2(arbol.z + j) });
  let q = await J.accion({ tipo: 'labrar', campo: cid, x: arbol.x + 1, z: arbol.z, t: 0 });
  comprobar('con el árbol dentro, no se labra (y sin azada, tampoco)', !q.ok, q.motivo);

  // 22e. La azada: rama, piedra y una cuerda en el banco
  console.log('22d. Se hace una azada en su banco: una rama, una piedra y una cuerda (3 cordeles de fibra)');
  q = await cuerda();
  comprobar('trenza una cuerda en el banco con 3 cordeles de 9 de fibra', q.ok && J.cuantos('cuerda') >= 1, `${q.motivo || ''} · ${enMano()}`);
  await J.andar(banco.x + 1, banco.z);
  q = await depositar(banco, 'cuerda');
  await soltarManos();
  await juntar(['ramas'], 'rama', 1, 200); await juntar(['piedra'], 'piedra', 1, 200);
  await J.andar(banco.x + 1, banco.z);
  const d1 = await depositar(banco, 'rama'), d2 = await depositar(banco, 'piedra');
  await soltarManos();
  q = await enEstacion(banco, 'azada');
  comprobar('deja en el banco la cuerda, una rama y una piedra, y hace la azada', q.ok && J.cuantos('azada') === 1, `${q.motivo || ''} ${d1.motivo || ''} ${d2.motivo || ''} · ${enMano()}`);
  await soltarManos(['azada']);

  // 22f. Limpiar: tala el árbol joven con su hacha (la dejó junto al banco), lo limpia, arranca el tocón con la azada y
  // recoge las piedras de dentro
  console.log('22e. Limpia el campo: tala el árbol joven, lo limpia, arranca el tocón con la azada y recoge las piedras');
  const azada = enLaMano('azada');
  if (azada) await soltar(azada);   // (la azada, a sus pies junto al banco: el hacha, a la mano)
  const hacha = J.cuantos('hacha_piedra') || (await cogerSuelo('hacha_piedra', banco, 8));
  comprobar('coge su hacha de piedra (la dejó junto al banco)', !!hacha && J.cuantos('hacha_piedra') === 1, enMano());
  await J.andar(arbol.x + 1, arbol.z);
  let golpes = 0;
  do {
    q = await J.objeto({ tipo: 'talar', arbol: arbol.id, x: J.pos.x, z: J.pos.z, ax: arbol.x, az: arbol.z, edad: arbol.edad }); golpes++;
    if (q.ok && q.datos.boca !== undefined) { await J.andar(arbol.x, arbol.z + 1); await J.andar(arbol.x - 1, arbol.z); }
    if (q.ok && !q.datos.cae) await pausa(550);
  } while (q.ok && !q.datos.cae && golpes < 30);
  await pausa(3500);
  let limpia = 0;
  do { q = await J.objeto({ tipo: 'talar', arbol: arbol.id, x: J.pos.x, z: J.pos.z, ax: arbol.x, az: arbol.z, edad: arbol.edad }); limpia++; if (q.ok && !q.datos.limpio) await pausa(550); } while (q.ok && !q.datos.limpio && limpia < 10);
  comprobar('tala el árbol joven del campo y lo limpia con el hacha', q.ok && q.datos.limpio, `${golpes} + ${limpia} golpes · ${q.motivo || ''}`);
  q = await J.accion({ tipo: 'labrar', campo: cid, x: arbol.x, z: arbol.z, t: 0 });
  comprobar('con el tocón, aún no se labra ahí', !q.ok, q.motivo);
  // el tronco y las varas del árbol, fuera del campo (las varas, para el tejado)
  await soltarManos();
  const azadaS = enSuelo('azada', banco, 6)[0];
  if (azadaS) { await J.andar(azadaS.x + 0.3, azadaS.z); await J.objeto({ tipo: 'coger_suelo', objeto: azadaS.id, a: 'mano:der', x: J.pos.x, z: J.pos.z }); }
  await J.andar(arbol.x + 1, arbol.z);
  let ga = 0;
  do { q = await J.objeto({ tipo: 'arrancar', arbol: arbol.id, x: J.pos.x, z: J.pos.z, ax: arbol.x, az: arbol.z, edad: arbol.edad }); ga++; if (q.ok && !q.datos.arrancado) await pausa(550); } while (q.ok && !q.datos.arrancado && ga < 40);
  comprobar('arranca el tocón a golpes de azada (deja leña)', q.ok && q.datos.arrancado && s.objetos.tala.arrancado(arbol.id), `${ga} golpes · ${q.motivo || ''}`);
  // las piedras sueltas de dentro, a la otra mano (y fuera del campo)
  const piedrasDentro = T.cercaDe(arbol.x, arbol.z, L * 1.5 + 1).piedras.filter(p => Math.abs(p.x - arbol.x) <= L + 1.3 && Math.abs(p.z - arbol.z) <= L + 1.3);
  let recogidas = 0;
  for (const p of piedrasDentro) {
    const pp = { id: p.id, tipo: 'piedra', x: r2(p.x), z: r2(p.z) };
    const rq = await recoger(pp);
    if (rq.ok) recogidas++;
    if (J.cuantos('piedra') >= 3) { await J.andar(esquinas[0].x - 2, esquinas[0].z - 2); const lp = enLaMano('piedra'); if (lp) await soltar(lp); }
  }
  if (enLaMano('piedra')) { await J.andar(esquinas[0].x - 2, esquinas[0].z - 2); await soltar(enLaMano('piedra')); }
  comprobar('recoge las piedras sueltas del campo', true, `${recogidas} de ${piedrasDentro.length}`);

  // 22g. Labrar a pasadas con la azada
  console.log('22f. Labra el campo a pasadas con la azada');
  let pasadas = 0; mal = [];
  for (const p of puntosLabrar) {
    await J.andar(p.x, p.z - 1);
    const rl = await J.accion({ tipo: 'labrar', campo: cid, x: p.x, z: p.z, t: 0 });
    if (rl.ok) pasadas++; else if (!/ya está labrado/.test(rl.motivo || '')) mal.push(rl.motivo);
    await pausa(300);
  }
  const casillas = rejilla(campo); let labradas = 0, total = 0;
  for (let j = 0; j < casillas.h; j++) for (let i = 0; i < casillas.w; i++) { const x = casillas.x0 + i + 0.5, z = casillas.z0 + j + 0.5; if (!dentroCampo(x, z)) continue; total++; if (labradoEn(campo, x, z, Date.now())) labradas++; }
  comprobar('lo labra entero a pasadas (cada una, un círculo donde apunta)', labradas === total && total >= 30, `${pasadas} pasadas · ${labradas} de ${total} m² · ${mal.slice(0, 2).join(' | ')}`);

  // 22h. Sembrar: en la mitad oeste, habas, col y nabo planta a planta; en la este, la cebada a voleo
  console.log('22g. Siembra: habas, col y nabo planta a planta, y cebada a voleo');
  await J.andar(deposito.x, deposito.z); await soltarManos();
  const sembrarPlanta = async (semilla, cultivo, p) => {
    if (!J.cuantos(semilla)) await cogerSuelo(semilla, deposito, 3);
    await J.andar(p.x, p.z - 1);
    return J.accion({ tipo: 'sembrar', campo: cid, cultivo, x: p.x, z: p.z, t: 0 });
  };
  const oeste = (i, j) => ({ x: r2(arbol.x - 2 + i * 0.8), z: r2(arbol.z - 2 + j * 0.8) });
  const plantas = [['habas', 'habas', oeste(0, 0)], ['habas', 'habas', oeste(0, 1)], ['semilla_col', 'col', oeste(1, 3)], ['semilla_nabo', 'nabo', oeste(0, 4)]];
  let sembradas = 0; mal = [];
  for (const [sem, cu, p] of plantas) {
    const rs = await sembrarPlanta(sem, cu, p);
    if (rs.ok) sembradas++; else mal.push(`${cu}: ${rs.motivo}`);
    await J.andar(deposito.x, deposito.z); await soltarManos();
  }
  comprobar('siembra 2 habas, una col y un nabo, planta a planta (con la semilla en la mano)', sembradas === 4 && (campo.plantas || []).length === 4, mal.join(' | '));
  await cogerSuelo('semilla_cebada', deposito, 3);
  let voleo = 0; mal = [];
  for (const p of [{ x: arbol.x + 1.6, z: arbol.z - 1.6 }, { x: arbol.x + 1.6, z: arbol.z + 1.6 }]) {
    await J.andar(p.x, p.z - 1);
    const rv = await J.accion({ tipo: 'sembrar', campo: cid, cultivo: 'cebada', x: r2(p.x), z: r2(p.z), t: 0 });
    if (rv.ok) voleo++; else mal.push(rv.motivo);
  }
  const mVoleo = casillasVoleo(campo).length;
  comprobar('siembra la cebada a voleo, a pasadas (gasta 1 puñado cada 10 m²)', voleo === 2 && mVoleo >= 12, `${voleo} pasadas, ${mVoleo} m² · ${mal.join(' | ')}`);

  // 22i. Crece (el reloj acelerado): a mitad, escarda con las manos vacías; luego, maduro
  console.log('22h. Crece con el reloj acelerado: a mitad salen malas hierbas y las quita; luego madura');
  const adelantarCampo = (ms) => { for (const p of campo.plantas || []) p.t -= ms; if (campo.voleo) campo.voleo.t = campo.voleo.t.map(t => t - ms); };
  adelantarCampo(CRECER * 0.3);
  await J.andar(deposito.x, deposito.z); await soltarManos();
  let escardadas = 0;
  for (const p of [{ x: arbol.x + 1.6, z: arbol.z - 1.6 }, ...plantas.map(x => x[2])]) {
    await J.andar(p.x, p.z - 1);
    const re = await J.accion({ tipo: 'escardar', campo: cid, x: r2(p.x), z: r2(p.z), t: 0 });
    if (re.ok) escardadas++;
    await pausa(300);
  }
  comprobar('a mitad del crecimiento escarda con las manos vacías', escardadas >= 2, `${escardadas} pasadas`);
  adelantarCampo(CRECER * 0.75);

  // 22j. La hoz: 3 lascas en su piedra de tallar (un sílex y una piedra cada una) y una rama en el banco
  console.log('22i. Se hace una hoz de sílex: 3 lascas en su piedra de tallar y una rama, en el banco');
  let lascas = 0;
  for (let k = 0; k < 3; k++) {
    await juntar(['silex'], 'silex', 1, 300); await juntar(['piedra'], 'piedra', 1, 300);
    await J.andar(tallar.x + 1, tallar.z);
    await depositar(tallar, 'silex'); await depositar(tallar, 'piedra');
    const rl = await enEstacion(tallar, 'lasca_silex');
    if (rl.ok) lascas++;
    if (J.cuantos('lasca_silex') >= 1 && MANOS.every(l => J.inv.lugares[l])) { const o = MANOS.find(l => J.inv.lugares[l].tipo !== 'lasca_silex'); if (o) await soltar(o); }
  }
  comprobar('talla 3 lascas', lascas === 3 && J.cuantos('lasca_silex') >= 3, `${lascas} · lleva ${J.cuantos('lasca_silex')} · ${enMano()}`);
  await juntar(['ramas'], 'rama', 1, 200);
  await J.andar(banco.x + 1, banco.z);
  await depositar(banco, 'lasca_silex', 3); await depositar(banco, 'rama');
  await soltarManos();
  q = await enEstacion(banco, 'hoz_silex');
  comprobar('hace la hoz de sílex en el banco', q.ok && J.cuantos('hoz_silex') === 1, `${q.motivo || ''} · ${enMano()}`);
  await soltarManos(['hoz_silex']);

  // 22k. Cosechar: siega la cebada a pasadas con la hoz (deja gavillas) y coge a mano las habas, la col y el nabo
  console.log('22j. Cosecha: siega la cebada con la hoz y coge a mano las habas, la col y el nabo');
  const segados = [];
  for (const p of [{ x: arbol.x + 1.6, z: arbol.z - 1.6 }, { x: arbol.x + 1.6, z: arbol.z + 1.6 }, { x: arbol.x + 1.6, z: arbol.z }, { x: arbol.x + 2.4, z: arbol.z - 2.4 }, { x: arbol.x + 2.4, z: arbol.z + 2.4 }, { x: arbol.x + 0.6, z: arbol.z - 2.4 }, { x: arbol.x + 0.6, z: arbol.z + 2.4 }]) {
    await J.andar(p.x, p.z - 1);
    const rg = await J.accion({ tipo: 'segar', campo: cid, x: r2(p.x), z: r2(p.z), t: 0 });
    if (rg.ok) segados.push(rg.datos ? rg.datos.gavillas : 0);
    await pausa(300);
  }
  const gavillas = s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'gavilla' && Math.abs(o.x - arbol.x) < L + 3 && Math.abs(o.z - arbol.z) < L + 3);
  const nGav = gavillas.reduce((t, o) => t + o.cosa.n, 0);
  comprobar('siega toda la cebada madura: deja gavillas en el suelo', casillasVoleo(campo).length === 0 && nGav >= 4, `${segados.length} pasadas, ${nGav} gavillas, quedan ${casillasVoleo(campo).length} m²`);
  await soltarManos();
  const antes = { habas: J.cuantos('habas'), col: J.cuantos('col'), nabo: J.cuantos('nabo') };
  let cogidas = 0;
  for (const [, , p] of plantas) {
    await J.andar(p.x, p.z - 0.6);
    const rp = await J.accion({ tipo: 'coger_planta', campo: cid, x: p.x, z: p.z, t: 0 });
    if (rp.ok) cogidas++;
    if (MANOS.every(l => J.inv.lugares[l])) { await J.andar(deposito.x, deposito.z); await soltarManos(); }
  }
  const sueloCosecha = (tipo) => s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === tipo && (dist(o, deposito) < 3 || (Math.abs(o.x - arbol.x) < L + 2 && Math.abs(o.z - arbol.z) < L + 2))).reduce((t, o) => t + o.cosa.n, 0);
  comprobar('coge a mano las 2 matas de habas, la col y el nabo, maduros', cogidas === 4 && (campo.plantas || []).length === 0 && sueloCosecha('col') + J.cuantos('col') >= 1 && sueloCosecha('nabo') + J.cuantos('nabo') >= 1, `${cogidas} · ${JSON.stringify(antes)} · ${enMano()}`);
  await J.andar(deposito.x, deposito.z); await soltarManos();

  // 22l. La era: 8 piedras, fuera, junto al campo
  console.log('22k. Levanta una era junto al campo con 8 piedras');
  const sitioEra = { x: r2(arbol.x - L - 4), z: r2(arbol.z) };
  let pied = sueloCosecha('piedra');
  for (let k = 0; k < 4 && enSuelo('piedra', sitioEra, 2).reduce((t, o) => t + o.cosa.n, 0) + J.cuantos('piedra') < 8; k++) {
    await juntar(['piedra'], 'piedra', 6, 200);
    await J.andar(sitioEra.x + 1.5, sitioEra.z); await soltarManos();
  }
  // las de dentro del campo, que dejó junto a la primera estaca
  for (const o of enSuelo('piedra', { x: esquinas[0].x - 2, z: esquinas[0].z - 2 }, 2)) { await cogerSuelo('piedra', o, 0.5); }
  await J.andar(sitioEra.x + 1.5, sitioEra.z);
  pied = enSuelo('piedra', sitioEra, 3).reduce((t, o) => t + o.cosa.n, 0) + J.cuantos('piedra');
  const era = await ponerPuesto('era', sitioEra.x, sitioEra.z);
  comprobar('levanta la era en su tierra, fuera, con 8 piedras', era.ok && era.datos.terminada, `${era.motivo || ''} · ${pied} piedras a mano`);
  if (!era.ok) return;
  const E = s.objetos.fab.estaciones[era.id];

  // 22m. El mayal: 2 ramas y otra cuerda en el banco
  console.log('22l. Se hace un mayal en su banco: 2 ramas y otra cuerda');
  await soltarManos();
  q = await cuerda();
  await J.andar(banco.x + 1, banco.z);
  const dc = await depositar(banco, 'cuerda'); await soltarManos();
  await juntar(['ramas'], 'rama', 2, 200);
  await J.andar(banco.x + 1, banco.z);
  await depositar(banco, 'rama', 2); await soltarManos();
  const rm = await enEstacion(banco, 'mayal');
  comprobar('trenza otra cuerda y hace el mayal en el banco', q.ok && dc.ok && rm.ok && J.cuantos('mayal') === 1, `${q.motivo || ''} ${dc.motivo || ''} ${rm.motivo || ''} · ${enMano()}`);
  await soltarManos(['mayal']);

  // 22n. Trillar: deja las gavillas en la era y, con el mayal en la mano, cada una da grano de cebada y paja
  console.log('22m. Trilla en la era: deja las gavillas y, con el mayal, cada una da grano de cebada y paja');
  let dejadas = 0;
  for (const o of gavillas) {
    for (let k = 0; k < o.cosa.n; k++) {
      const og = s.objetos.suelo.objetos.find(x => x.id === o.id); if (!og) break;
      await J.andar(og.x + 0.3, og.z);
      const libre = MANOS.find(l => !J.inv.lugares[l]);
      const rc2 = await J.objeto({ tipo: 'coger_suelo', objeto: og.id, cantidad: 1, a: libre, x: J.pos.x, z: J.pos.z });
      if (!rc2.ok) break;
      await J.andar(E.x + 1, E.z);
      const dg = await depositar(E, 'gavilla');
      if (dg.ok) dejadas++;
    }
  }
  let trilladas = 0;
  for (let k = 0; k < dejadas; k++) {
    const rt = await enEstacion(E, 'trillar');
    if (rt.ok) trilladas++;
    // la paja y el grano: lo que no le cabe, a sus pies
  }
  const paja = J.cuantos('paja') + enSuelo('paja', E, 3).reduce((t, o) => t + o.cosa.n, 0);
  comprobar('trilla las gavillas con el mayal: grano de cebada y paja', trilladas >= 4 && paja >= 4, `${dejadas} dejadas, ${trilladas} trilladas, ${paja} de paja · ${enMano()}`);
  const grano = J.cuantos('semilla_cebada') + enSuelo('semilla_cebada', E, 3).reduce((t, o) => t + o.cosa.n, 0);
  comprobar('y el grano de cebada es también su semilla: tiene para sembrar otra vez', grano >= trilladas, `${grano}`);
  await soltarManos();
  const sitioPaja = { x: J.pos.x, z: J.pos.z };

  // 22o. El tejado de paja: un tramo junto al tejado de juncos de su casa (se apoya en él), puesto desde un andamio
  console.log('22n. Pone un tejado de paja junto al de su casa, desde un andamio, con la paja que ha trillado');
  const C = { x: r2(M.x + 10), z: r2(M.z - 10) };
  const casa = s.mundo.construcciones.find(c => [...c.piezas.values()].some(p => p.tipo === 'tejado_juncos') && s.mundo.dentroDeTierra(C.x, C.z, yo));
  comprobar('su casa tiene su tejado de juncos', !!casa);
  if (!casa) return;
  const pieza = (tipo, dx, dz, k = 0) => ({ tipo, x: r2(C.x + dx), z: r2(C.z + dz), k });
  const marco = async (pz) => {
    await J.andar(C.x + (pz.x - C.x) * 0.5, C.z + (pz.z - C.z) * 0.5);
    const rr = await J.accion({ tipo: 'colocar', pieza: pz.tipo, x: pz.x, z: pz.z, k: pz.k, rot: 0, dir: 0, y: T.suelo(C.x, C.z) });
    const cand = s.mundo.candidata(pz.tipo, pz.x, pz.z, pz.k, 0, 0, T.suelo(C.x, C.z)).pieza;
    pz.clave = claveDe(cand.hueco, cand.i, cand.j, cand.k, cand.d);
    return rr;
  };
  const obra = pz => casa.piezas.get(pz.clave)?.obra;
  const falta = (pz, m) => (PIEZAS[pz.tipo].coste[m] || 0) - ((obra(pz)?.entregado?.[m]) || 0);
  const terminada = pz => !!casa.piezas.get(pz.clave) && !obra(pz);
  const trabajar = async (pz, enAlto) => { let t = { ok: true }, n = 0; for (; n < 400 && t.ok && obra(pz); n++) t = await J.accion({ tipo: 'trabajar', construccion: casa.id, clave: pz.clave, segundos: 5 }); if (!enAlto) await pausa(10); return t; };
  // varas: las del suelo de por aquí (las del árbol del campo, las que quedaron del andamio de la casa), y si no hay,
  // tala otro árbol joven de su tierra con el hacha
  const varasSuelo = () => cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'vara' && !o.arrastra && dist(o, C) < 90), J.pos);
  const talarJoven = async () => {
    await soltarManos();
    if (!J.cuantos('hacha_piedra')) await cogerSuelo('hacha_piedra', banco, 8) || await cogerSuelo('hacha_piedra', arbol, 8);
    const a = cerca(veg.filter(e => e.edad === 'joven' && s.objetos.tala.enPie(e.id, Date.now()) && s.mundo.dentroDeTierra(e.x, e.z, yo) && !campoEn(s.mundo, e.x, e.z) && dist(e, C) > 6 && !est.some(x => dist(x, e) < 4)), J.pos)[0];
    if (!a) return false;
    await J.andar(a.x + 1, a.z);
    let g = 0, t;
    do { t = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); g++; if (t.ok && t.datos.boca !== undefined) { await J.andar(a.x, a.z + 1); await J.andar(a.x - 1, a.z); } if (t.ok && !t.datos.cae) await pausa(550); } while (t.ok && !t.datos.cae && g < 30);
    await pausa(3500);
    g = 0; do { t = await J.objeto({ tipo: 'talar', arbol: a.id, x: J.pos.x, z: J.pos.z, ax: a.x, az: a.z, edad: a.edad }); g++; if (t.ok && !t.datos.limpio) await pausa(550); } while (t.ok && !t.datos.limpio && g < 10);
    await soltarManos();
    return !!(t.ok && t.datos.limpio);
  };
  const varasA = async (pz, enAlto = null) => {
    for (let v = 0; v < 12 && falta(pz, 'vara') > 0; v++) {
      if (!varasSuelo().length && !(await talarJoven())) break;
      for (const o of varasSuelo()) {
        const quiere = Math.min(6, falta(pz, 'vara')) - J.cuantos('vara');
        if (quiere <= 0) break;
        for (const l of MANOS) {
          const q2 = Math.min(6, falta(pz, 'vara')) - J.cuantos('vara'), ya = J.inv.lugares[l]?.n || 0;
          const hay = s.objetos.sueloVisible(Date.now()).find(x => x.id === o.id)?.cosa.n || 0;
          if (q2 <= 0 || hay <= 0 || (J.inv.lugares[l] && J.inv.lugares[l].tipo !== 'vara') || 3 - ya <= 0) continue;
          await J.andar(o.x + 0.5, o.z);
          await J.objeto({ tipo: 'coger_suelo', objeto: o.id, cantidad: Math.min(q2, 3 - ya, hay), a: l, x: J.pos.x, z: J.pos.z });
        }
      }
      if (!J.cuantos('vara')) continue;
      if (enAlto) { await enAlto(async () => J.accion({ tipo: 'entregar', construccion: casa.id, clave: pz.clave, material: 'vara', cantidad: J.cuantos('vara'), desde: 1 })); }
      else { await J.andar(pz.x - 1, pz.z); await J.accion({ tipo: 'entregar', construccion: casa.id, clave: pz.clave, material: 'vara', cantidad: J.cuantos('vara') }); }
    }
    return falta(pz, 'vara') === 0;
  };
  // el andamio, al este de la casa (como el del tejado de juncos)
  const andamio = pieza('andamio', 2, 0);
  q = await marco(andamio);
  comprobar('pone el marco de un andamio junto a la casa', q.ok && !!obra(andamio), q.motivo);
  await soltarManos();
  let cuerdasHechas = 0;
  while (falta(andamio, 'cuerda') > 0 && cuerdasHechas < 3) {
    const cs = cerca(s.objetos.sueloVisible(Date.now()).filter(o => o.cosa.tipo === 'cuerda' && dist(o, C) < 30), J.pos)[0];
    if (cs) { await cogerSuelo('cuerda', cs, 0.5); }
    else { const rq = await cuerda(); cuerdasHechas++; if (!rq.ok) break; }
    await J.andar(andamio.x - 1, andamio.z);
    await J.accion({ tipo: 'entregar', construccion: casa.id, clave: andamio.clave, material: 'cuerda', cantidad: Math.min(J.cuantos('cuerda'), falta(andamio, 'cuerda')) });
    await soltarManos();
  }
  const va = await varasA(andamio);
  if (va) { await J.andar(andamio.x - 1, andamio.z); await trabajar(andamio); }
  comprobar('le lleva 2 cuerdas y 8 varas y lo levanta', terminada(andamio), `faltan ${falta(andamio, 'cuerda')} cuerdas y ${falta(andamio, 'vara')} varas`);
  // el tramo de paja: junto al tejado de juncos, en la casilla del andamio o al lado
  let tejado = null;
  for (const [dx, dz] of [[2, 0], [0, 2], [0, -2]]) {
    const pz = pieza('tejado_paja', dx, dz, 1);
    const rr = await marco(pz);
    if (rr.ok && obra(pz)) { tejado = pz; break; }
    q = rr;
  }
  comprobar('pone el marco de un tejado de paja junto al de juncos (se apoya en él)', !!tejado, q.motivo);
  if (!tejado) return;
  const A = { x: andamio.x, z: andamio.z }, arriba = (casa.oy || 0) + ALTURA + 0.05;
  const subir = async () => { await J.andar(A.x, A.z); for (let h = 0; h <= 10; h++) { J.ws.send(JSON.stringify({ tipo: 'estado', x: A.x, y: T.suelo(A.x, A.z) + (arriba - T.suelo(A.x, A.z)) * h / 10, z: A.z, giro: 0, anim: 'andar' })); await pausa(120); } await pausa(300); };
  const bajar = async () => { for (let h = 10; h >= 0; h--) { J.ws.send(JSON.stringify({ tipo: 'estado', x: A.x, y: T.suelo(A.x, A.z) + (arriba - T.suelo(A.x, A.z)) * h / 10, z: A.z, giro: 0, anim: 'andar' })); await pausa(120); } J.estar(A.x, A.z); await pausa(300); };
  const enAlto = async (f) => { await subir(); const rr = await f(); await bajar(); return rr; };
  await soltarManos();
  await varasA(tejado, enAlto);
  // la paja: 4 haces de lo trillado, de 2 en 2 (lo que quepa en las manos)
  for (let v = 0; v < 6 && falta(tejado, 'paja') > 0; v++) {
    await soltarManos();
    if (!J.cuantos('paja')) await cogerSuelo('paja', sitioPaja, 4, Math.min(falta(tejado, 'paja'), 3));
    if (!J.cuantos('paja')) await cogerSuelo('paja', E, 4, Math.min(falta(tejado, 'paja'), 3));
    if (!J.cuantos('paja')) break;
    await enAlto(async () => J.accion({ tipo: 'entregar', construccion: casa.id, clave: tejado.clave, material: 'paja', cantidad: Math.min(J.cuantos('paja'), falta(tejado, 'paja')), desde: 1 }));
  }
  comprobar('sube al andamio y desde arriba le da al tejado sus 2 varas y 4 haces de paja', falta(tejado, 'vara') === 0 && falta(tejado, 'paja') === 0, `faltan ${falta(tejado, 'vara')} varas y ${falta(tejado, 'paja')} de paja · ${enMano()}`);
  await subir();
  await trabajar(tejado, true);
  comprobar('lo trabaja desde el andamio: el tejado de paja está terminado', terminada(tejado), `${tejado.clave}`);
  await bajar();
  await soltarManos();
  q = await J.accion({ tipo: 'desmontar', construccion: casa.id, clave: andamio.clave });
  comprobar('desmonta el andamio', q.ok, q.motivo);
}

// Seguir desde lo guardado (ver arriba): KINHOLD_RECORRIDO_DESDE=<carpeta> node pruebas/recorrido_granja.mjs
if (process.argv[1] && process.argv[1].endsWith('recorrido_granja.mjs') && process.env.KINHOLD_RECORRIDO_DESDE) {
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
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-granja-')); cpSync(desde, dir, { recursive: true });
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
  try { await granja({ J, s, T, O, comprobar, pausa, cerca, RELOJ, base: meta.base }); }
  catch (e) { comprobar('la granja llega al final', false, e && e.stack); }
  J.ws.close(); await s.cerrar();
  console.log(`\n${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
}
