// Pruebas de la tala (src/logica/tala.js). Ejecutar: node pruebas/prueba_tala.mjs
// Con MUTAR=1 el adulto cae con piedra tan rápido como con hierro y el tocón vuelve al momento: las pruebas deben FALLAR.
import { Tala, GOLPES, DA, HACHAS, SEMANA, ENTRE_GOLPES, ALCANCE_TALA, edadDeEscala, idArbol, ramasDe, hachaEnMano,
  PARTE_BOCA, COHERENCIA_BOCA, PENDIENTE_CAIDA, inclinacionDe, bocaDe, caidaDe, ejecutarTala, guardarTala, cargarTala, migrarTala, VERSION_TALA } from '../src/logica/tala.js';
import { Inventarios, CATALOGO } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') { GOLPES.adulto.piedra = GOLPES.adulto.hierro; DA.adulto.vuelve = 0; }
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const T0 = Date.UTC(2026, 9, 30, 8);
const arboles = [
  { id: idArbol(0, 0), x: 0, z: 0, edad: edadDeEscala(0.9) },
  { id: idArbol(10, 0), x: 10, z: 0, edad: edadDeEscala(1.3) },
];
const [JOVEN, ADULTO] = arboles.map(a => a.id);
const nuevo = () => ({ tala: new Tala(arboles), invs: new Inventarios(), suelo: new Suelo(), reg: new RegistroAcciones() });
const conHacha = (invs, autor, tipo, mano = 'mano:der') => invs.de(autor).coger(tipo, 1, mano);
// golpea hasta que cae (o hasta «max» golpes); devuelve [golpes dados, último resultado, hora]
function talarHasta(m, autor, arbol, x, z, t, max = 200) {
  let r, n = 0;
  for (; n < max; n++) {
    r = ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor, tipo: 'talar', arbol, x, z }, t);
    t += ENTRE_GOLPES;
    if (!r.ok || r.cae) { n++; break; }
  }
  return [n, r, t];
}

console.log('Lo que dice el documento de sistemas (apartado 3, «De los árboles»)');
{
  comprobar('joven o adulto sale del tamaño del árbol', edadDeEscala(0.9) === 'joven' && edadDeEscala(1.3) === 'adulto');
  comprobar('el joven se tala con piedra o con hierro', GOLPES.joven.piedra > 0 && GOLPES.joven.hierro > 0 && GOLPES.joven.hierro <= GOLPES.joven.piedra);
  comprobar('el adulto con hierro; con piedra tarda mucho (cuatro veces más o más)', GOLPES.adulto.piedra >= 4 * GOLPES.adulto.hierro, `${GOLPES.adulto.piedra} y ${GOLPES.adulto.hierro}`);
  comprobar('el joven da un tronco delgado (grande) y el adulto uno largo (enorme)', DA.joven.tronco === 'tronco_delgado' && CATALOGO.tronco_delgado.tam === 'G' && DA.adulto.tronco === 'tronco_largo' && CATALOGO.tronco_largo.tam === 'E');
  comprobar('el adulto da muchas más ramas que varas el joven', DA.adulto.ramas[0] > DA.joven.ramas[1]);
  comprobar('el joven da varas y el adulto ramas (revisión del 1 nov: «tronco delgado y varas»)', DA.joven.menudo === 'vara' && DA.adulto.menudo === 'rama' && !!CATALOGO.vara);
  comprobar('vuelven a crecer en semanas reales', DA.joven.vuelve >= SEMANA && DA.adulto.vuelve >= DA.joven.vuelve, `${DA.joven.vuelve / SEMANA} y ${DA.adulto.vuelve / SEMANA} semanas`);
  comprobar('las hachas: de piedra, de hierro y la de mano (cabeza de hierro), en el catálogo', HACHAS.hacha_piedra === 'piedra' && HACHAS.hacha_hierro === 'hierro' && ['hacha_piedra', 'hacha_hierro', 'hacha_mano'].every(k => CATALOGO[k] && CATALOGO[k].herramienta));
}

console.log('Talar un árbol joven con hacha de piedra');
{
  const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_piedra');
  const [n, r, t] = talarHasta(m, 'ana', JOVEN, 0, -1, T0);
  comprobar('cae al dar los golpes que pide', r.ok && r.cae && n === GOLPES.joven.piedra, `${n} golpes`);
  comprobar('cae hacia la boca: el lado desde el que la ha cortado (GDD; revisión del 1 nov)', Math.abs(Math.abs(r.dir) - Math.PI) < 0.01 && r.por === 'boca' && r.deja.every(o => o.z < 0), `dir ${r.dir}, por ${r.por}`);
  const tronco = m.suelo.objetos.find(o => o.cosa.tipo === 'tronco_delgado'), varas = m.suelo.objetos.find(o => o.cosa.tipo === 'vara');
  comprobar('deja en el suelo un tronco delgado y de 2 a 4 varas, a nombre del que tala', tronco && tronco.cosa.n === 1 && varas && varas.cosa.n >= DA.joven.ramas[0] && varas.cosa.n <= DA.joven.ramas[1] && tronco.autor === 'ana' && varas.autor === 'ana', varas && String(varas.cosa.n));
  comprobar('y ninguna rama (eso, el adulto)', !m.suelo.objetos.some(o => o.cosa.tipo === 'rama'));
  comprobar('las varas, tumbadas a lo largo de donde cayó, como el tronco', varas && Math.abs(varas.giro - tronco.giro) < 1e-9, varas && `${varas.giro} y ${tronco.giro}`);
  comprobar('el tronco se queda (no desaparece)', tronco && tronco.desaparece === null);
  comprobar('queda el tocón: ya no está en pie', !m.tala.enPie(JOVEN, t) && m.tala.tocones(t).length === 1);
  const otro = ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 0, z: -1 }, t + 5000);
  comprobar('el tocón no se vuelve a talar', !otro.ok && /tocón/.test(otro.motivo), otro.motivo);
  comprobar('a las tres semanas sigue el tocón', !m.tala.enPie(JOVEN, t + DA.joven.vuelve - 60000));
  comprobar('pasado su tiempo vuelve a crecer (por tiempo transcurrido)', m.tala.enPie(JOVEN, T0 + DA.joven.vuelve + 60000) && m.tala.tocones(T0 + DA.joven.vuelve + 60000).length === 0);
  const [n2, r2] = talarHasta(m, 'ana', JOVEN, 0, -1, T0 + DA.joven.vuelve + 60000);
  comprobar('y se puede talar otra vez', r2.ok && r2.cae && n2 === GOLPES.joven.piedra);
  comprobar('el registro lleva cada golpe con su autor', m.reg.entradas.filter(e => e.autor === 'ana' && e.tipo === 'talar').length >= n + n2 + 1);
}

console.log('Talar un árbol adulto: con hierro, y con piedra muy lento');
{
  const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_hierro', 'mano:izq');
  const [n, r] = talarHasta(m, 'ana', ADULTO, 11, 0, T0);
  comprobar('con hacha de hierro (en la mano izquierda) cae en sus golpes', r.cae && n === GOLPES.adulto.hierro, `${n}`);
  const tronco = m.suelo.objetos.find(o => o.cosa.tipo === 'tronco_largo'), ramas = m.suelo.objetos.find(o => o.cosa.tipo === 'rama');
  comprobar('deja un tronco largo y muchas ramas', tronco && ramas && ramas.cosa.n >= DA.adulto.ramas[0], ramas && String(ramas.cosa.n));
  comprobar('cae hacia el este, hacia la boca (el que tala está al este)', Math.abs(r.dir - Math.PI / 2) < 0.01 && tronco.x > 10, `dir ${r.dir}`);
  const p = nuevo(); conHacha(p.invs, 'bea', 'hacha_piedra');
  const [n2, r2] = talarHasta(p, 'bea', ADULTO, 9, 0, T0);
  comprobar('con hacha de piedra también cae, pero con muchos más golpes', r2.cae && n2 === GOLPES.adulto.piedra && n2 >= 4 * n, `${n2} golpes`);
  const q = nuevo(); conHacha(q.invs, 'eva', 'hacha_mano');
  const [n3] = talarHasta(q, 'eva', ADULTO, 9, 0, T0);
  comprobar('el hacha de mano tala como la de hierro', n3 === GOLPES.adulto.hierro);
}

console.log('Hacia dónde cae: la boca, la cuesta o su inclinación (GDD; revisión del 1 nov)');
{
  const L = Math.PI, cerca = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.02;
  const caer = (m, golpes, t = T0) => { let r; for (const [autor, x, z] of golpes) { r = ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor, tipo: 'talar', arbol: JOVEN, x, z }, t); t += ENTRE_GOLPES; if (!r.ok || r.cae) break; } return r; };
  const N = GOLPES.joven.piedra, nBoca = Math.ceil(N * PARTE_BOCA - 1e-9);
  // ana abre la boca al este (x = 1) y luego corta por detrás, desde el oeste
  {
    const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_piedra');
    const golpes = Array.from({ length: N }, (_, i) => i < nBoca ? ['ana', 1, 0] : ['ana', -1, 0]);
    let aviso = null, t = T0;
    for (let i = 0; i < nBoca; i++, t += ENTRE_GOLPES) aviso = ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 1, z: 0 }, t);
    comprobar(`la boca se abre con los golpes del primer tercio (${nBoca} de ${N}) y el último de ellos dice hacia dónde caerá`, aviso.ok && !aviso.cae && cerca(aviso.boca, L / 2), `boca ${aviso.boca}`);
    const r = caer(m, golpes.slice(nBoca), t);
    comprobar('cortada la boca al este y por detrás desde el oeste, cae al este (hacia la boca, no hacia el que da el último golpe)', r.cae && r.por === 'boca' && cerca(r.dir, L / 2) && r.deja.every(o => o.x > 0), `dir ${r.dir}, por ${r.por}`);
  }
  // la boca la abre bea al norte y el resto lo corta ana desde el sur: cae al norte, hacia la boca
  {
    const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_piedra'); conHacha(m.invs, 'bea', 'hacha_piedra');
    const r = caer(m, Array.from({ length: N }, (_, i) => i < nBoca ? ['bea', 0, -1.2] : ['ana', 0, 1.2]));
    comprobar('la boca la abre quien sea: la de bea al norte (z < 0), aunque el resto lo corte ana desde el sur', r.cae && r.por === 'boca' && cerca(r.dir, L), `dir ${r.dir}`);
  }
  // unos golpes un poco desviados (dentro de unos 40°) siguen haciendo boca
  {
    const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_piedra');
    const ang = [0.6, -0.6, 0.3], g = Array.from({ length: N }, (_, i) => { const a = i < nBoca ? ang[i % 3] : L; return ['ana', Math.sin(a), Math.cos(a)]; });
    const r = caer(m, g);
    comprobar('golpes de la boca algo desviados (hasta 35°) siguen haciendo boca, hacia su media', r.cae && r.por === 'boca' && Math.abs(r.dir) < 0.4, `dir ${r.dir}`);
  }
  // sin boca: dos que talan enfrentados desde el principio
  const enfrentados = () => Array.from({ length: N }, (_, i) => i % 2 ? ['ana', 1, 0] : ['bea', -1, 0]);
  {
    const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_piedra'); conHacha(m.invs, 'bea', 'hacha_piedra');
    let t = T0, aviso;
    for (let i = 0; i < nBoca; i++, t += ENTRE_GOLPES) aviso = ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor: i % 2 ? 'ana' : 'bea', tipo: 'talar', arbol: JOVEN, x: i % 2 ? 1 : -1, z: 0 }, t);
    comprobar('golpes de lados opuestos no hacen boca, y el aviso lo dice', aviso.ok && aviso.boca === null && bocaDe(m.tala.estado[JOVEN]) === null, `boca ${aviso.boca}`);
    const m2 = nuevo(); conHacha(m2.invs, 'ana', 'hacha_piedra'); conHacha(m2.invs, 'bea', 'hacha_piedra');
    const r = caer(m2, enfrentados());
    comprobar('sin boca y en llano, cae hacia donde se inclina el árbol', r.cae && r.por === 'inclinacion' && cerca(r.dir, inclinacionDe({ id: JOVEN })), `dir ${r.dir}, inclinación ${inclinacionDe({ id: JOVEN })}`);
  }
  // sin boca y en cuesta: el suelo baja hacia el sur (z +)
  {
    const m = nuevo(); m.tala.alturaEn = (x, z) => -0.3 * z; conHacha(m.invs, 'ana', 'hacha_piedra'); conHacha(m.invs, 'bea', 'hacha_piedra');
    const r = caer(m, enfrentados());
    comprobar('sin boca y en cuesta (30 %), cae cuesta abajo', r.cae && r.por === 'cuesta' && cerca(r.dir, 0) && r.deja.every(o => o.z > 0), `dir ${r.dir}, por ${r.por}`);
    const m2 = nuevo(); m2.tala.alturaEn = (x, z) => -0.5 * x; conHacha(m2.invs, 'ana', 'hacha_piedra');
    const r2 = caer(m2, Array.from({ length: N }, () => ['ana', -1, 0]));
    comprobar('con boca, la boca manda sobre la cuesta (boca al oeste, cuesta abajo al este)', r2.cae && r2.por === 'boca' && cerca(r2.dir, -L / 2), `dir ${r2.dir}`);
    const m3 = nuevo(); m3.tala.alturaEn = (x, z) => -0.05 * z; conHacha(m3.invs, 'ana', 'hacha_piedra'); conHacha(m3.invs, 'bea', 'hacha_piedra');
    const r3 = caer(m3, enfrentados());
    comprobar(`una cuesta suave (5 %, menos del ${PENDIENTE_CAIDA * 100} %) no manda: cae por su inclinación`, r3.cae && r3.por === 'inclinacion', `por ${r3.por}`);
  }
  comprobar('la inclinación es fija por árbol y no la misma para todos', inclinacionDe({ id: JOVEN }) === inclinacionDe({ id: JOVEN }) && new Set(Array.from({ length: 20 }, (_, i) => inclinacionDe({ id: idArbol(i * 3, 7) }))).size > 10);
  comprobar('caidaDe sin terreno ni boca: por su inclinación', caidaDe(arboles[0], {}, null).por === 'inclinacion');
  // la boca a medias se guarda: se va, vuelve y la termina
  {
    const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_piedra');
    ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 0, z: 1 }, T0);
    const t2 = new Tala(arboles).importar(JSON.parse(JSON.stringify(m.tala.exportar())));
    const e = t2.estado[JOVEN];
    comprobar('lo que lleva abierto de la boca se guarda y se lee', e && e.bp > 0 && Math.abs(e.bz - e.bp) < 1e-9, JSON.stringify(e));
    const t3 = new Tala(arboles).importar({ version: 1, estado: { [JOVEN]: { golpes: 2, parte: 0.25, bp: 'x', bx: 1, bz: 0 } } });
    comprobar('una boca guardada rota se descarta (el árbol sigue con sus golpes)', t3.estado[JOVEN].parte === 0.25 && t3.estado[JOVEN].bp === undefined);
  }
  comprobar('los números: la boca, un tercio; de un lado, 0,7 o más; la cuesta que manda, 12 %', PARTE_BOCA === 1 / 3 && COHERENCIA_BOCA === 0.7 && PENDIENTE_CAIDA === 0.12);
}

console.log('Lo que no se puede');
{
  const m = nuevo();
  const g = (a, t = T0) => ejecutarTala(m.tala, m.invs, m.suelo, m.reg, a, t);
  comprobar('sin hacha en la mano, no se tala', !g({ autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 0, z: -1 }).ok);
  m.invs.de('ana').coger('hacha_piedra', 1, 'mano:der');
  comprobar('lejos del árbol, no', !g({ autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 0, z: -(ALCANCE_TALA + 0.2) }).ok);
  comprobar('un árbol que no existe, no', !g({ autor: 'ana', tipo: 'talar', arbol: 'arbol:9,9', x: 0, z: -1 }).ok);
  comprobar('sin autor, no', !g({ tipo: 'talar', arbol: JOVEN, x: 0, z: -1 }).ok);
  comprobar('datos raros, no', !g({ autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 'a', z: -1 }).ok && !g({ autor: 'ana', tipo: 'otra', arbol: JOVEN, x: 0, z: -1 }).ok);
  comprobar('sin hora, no', !g({ autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 0, z: -1 }, NaN).ok);
  comprobar('un golpe sí', g({ autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 0, z: -1 }, T0 + 10).ok);
  comprobar('dos golpes demasiado seguidos, no', !g({ autor: 'ana', tipo: 'talar', arbol: JOVEN, x: 0, z: -1 }, T0 + 10 + ENTRE_GOLPES / 2).ok);
  comprobar('el hacha de otro no te sirve', !g({ autor: 'bea', tipo: 'talar', arbol: JOVEN, x: 0, z: -1 }, T0 + 5000).ok);
  comprobar('lo fallido también queda en el registro', m.reg.entradas.some(e => !e.ok && e.autor === 'bea' && e.motivo));
}

console.log('Entre dos: los golpes de los dos cuentan en el mismo árbol');
{
  const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_hierro'); conHacha(m.invs, 'bea', 'hacha_hierro');
  let t = T0, r;
  for (let i = 0; i < GOLPES.adulto.hierro; i++) {
    r = ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor: i % 2 ? 'bea' : 'ana', tipo: 'talar', arbol: ADULTO, x: 11, z: 0 }, t);
    t += ENTRE_GOLPES / 2 + 1; // cada uno a su ritmo: juntos, el doble de golpes por segundo
  }
  comprobar('cae con los golpes de los dos, en la mitad de tiempo', r.ok && r.cae, `${(t - T0) / 1000} s`);
  comprobar('lo que deja va a nombre del que da el último golpe', m.suelo.objetos.every(o => o.autor === 'bea'));
}

console.log('Ramas: un azar fijo por árbol y por vez');
{
  const a = arboles[1];
  comprobar('siempre lo mismo', ramasDe(a, 0) === ramasDe(a, 0) && ramasDe(a, 3) === ramasDe(a, 3));
  const vistos = new Set(Array.from({ length: 30 }, (_, v) => ramasDe(a, v)));
  comprobar('dentro de lo que dice, y no siempre igual', [...vistos].every(n => n >= DA.adulto.ramas[0] && n <= DA.adulto.ramas[1]) && vistos.size > 1, [...vistos].join(','));
  const inv = new Inventarios().de('x');
  comprobar('el hacha en la mano se encuentra', !hachaEnMano(inv) && inv.coger('hacha_piedra', 1, 'mano:izq').ok && hachaEnMano(inv).clase === 'piedra');
}

console.log('Guardar y cargar (los navegadores y el servidor: por tiempo transcurrido)');
{
  const m = nuevo(); conHacha(m.invs, 'ana', 'hacha_hierro');
  talarHasta(m, 'ana', JOVEN, 0, -1, T0);
  ejecutarTala(m.tala, m.invs, m.suelo, m.reg, { autor: 'ana', tipo: 'talar', arbol: ADULTO, x: 11, z: 0 }, T0 + 60000);
  const almacen = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  comprobar('se guarda', guardarTala(almacen, m.tala));
  const t2 = cargarTala(almacen, new Tala(arboles));
  comprobar('el tocón sigue al cargar, con su hora de volver', !t2.enPie(JOVEN, T0 + 1000) && t2.enPie(JOVEN, T0 + DA.joven.vuelve + 60000));
  comprobar('y la muesca del adulto también', t2.progreso(ADULTO) > 0 && Math.abs(t2.progreso(ADULTO) - 1 / GOLPES.adulto.hierro) < 1e-9);
  // los árboles llegan al acercarse (src/mundo/vegetacion_mundo.js): lo de uno que aún no está se queda y vale al llegar
  const t3 = cargarTala(almacen, new Tala([arboles[1]]));
  comprobar('lo de un árbol aún sin cargar no cuenta (no hay tocón ni árbol)', !t3.enPie(JOVEN, T0 + 1000) && t3.tocones(T0 + 1000).length === 0);
  t3.anadir([arboles[0]]);
  comprobar('y en cuanto llega, sigue talado', !t3.enPie(JOVEN, T0 + 1000) && t3.tocones(T0 + 1000).length === 1);
  t3.quitar([JOVEN]);
  comprobar('si se va y vuelve, también; y se vuelve a guardar', (t3.anadir([arboles[0]]), !t3.enPie(JOVEN, T0 + 1000)) && JSON.stringify(t3.exportar()).includes(JOVEN));
  const raroId = cargarTala({ getItem: () => JSON.stringify({ version: VERSION_TALA, estado: { 'dragon': { vuelve: T0 } } }) }, new Tala(arboles));
  comprobar('lo que no es un árbol se descarta', Object.keys(raroId.estado).length === 0);
  comprobar('un guardado roto o sin versión se descarta', !migrarTala({ estado: {} }) && !migrarTala(null) && !migrarTala({ version: VERSION_TALA + 1, estado: {} }));
  const roto = { d: { 'kinhold.tala': '{no' }, getItem(k) { return this.d[k]; } };
  comprobar('un guardado ilegible no rompe nada', Object.keys(cargarTala(roto, new Tala(arboles)).estado).length === 0);
}

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
