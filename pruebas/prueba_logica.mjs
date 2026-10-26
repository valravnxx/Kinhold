// Pruebas de la lógica de construcción de Kinhold. Ejecutar: node pruebas/prueba_logica.mjs
// Con MUTAR=1 se altera una capacidad a propósito: las pruebas deben FALLAR.
import { Mundo, clave, localAMundo, mundoALocal, geometriaTejados, aristasDeCasilla, casillasDeArista, escaleraAndando, progresoEscalera, salidaEscalera } from '../src/logica/construccion.js';
import { PIEZAS } from '../src/logica/piezas.js';
import { ejecutar, RegistroAcciones, seAbre } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') {
  PIEZAS.muro_zarzo.cap = 1000;   // un muro de zarzo que aguanta cualquier cosa
  PIEZAS.viga.cap = 5000;         // una viga que nunca se sobrecarga
  PIEZAS.cim_tronco.cap = 5000;   // un cimiento de troncos que aguanta tres plantas
}

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}

// Coloca en coordenadas de rejilla de una construcción ya existente (o la crea en el origen)
function enRejilla(m, c, tipo, i, j, k, d = 0, dir = 0) {
  const def = PIEZAS[tipo];
  const p = { tipo, hueco: def.hueco, i, j, k, dir, abierta: false };
  if (['e', 'b', 'g', 'p'].includes(def.hueco)) p.d = d;
  return { construccion: c, nueva: false, pieza: p };
}
function nuevaConstruccion(m) {
  const c = { id: m.siguienteId++, ox: 0, oz: 0, rot: 0, piezas: new Map() };
  m.construcciones.push(c);
  return c;
}

console.log('1. Coordenadas');
{
  const c = { ox: 5, oz: -3, rot: 0.7 };
  const w = localAMundo(c, 3.2, 1.1);
  const l = mundoALocal(c, w.x, w.z);
  comprobar('ida y vuelta local↔mundo', Math.abs(l.lx - 3.2) < 1e-9 && Math.abs(l.lz - 1.1) < 1e-9, `(${l.lx.toFixed(3)}, ${l.lz.toFixed(3)})`);
}

console.log('2. Mojón y tierra');
{
  const m = new Mundo();
  const cand = m.candidata('cim_piedra', 0, 0, 0, 0);
  comprobar('sin mojón no se construye', m.validar(cand).motivo === 'Primero coloca tu mojón.');
  m.colocarMojon(0, 0);
  comprobar('mojón cuesta 3 piedras', m.materiales.piedra === 117, `piedra=${m.materiales.piedra}`);
  comprobar('segundo mojón rechazado', !m.colocarMojon(5, 5).ok);
  const lejos = m.candidata('cim_piedra', 30, 0, 0, 0);
  comprobar('fuera de tierra rechazado', m.validar(lejos).motivo === 'Fuera de tu tierra.');
}

console.log('3. Primera pieza fija la rejilla; las siguientes encajan');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const r1 = m.colocar(m.candidata('cim_piedra', 3, 4, 0, 0.5));
  comprobar('primera pieza crea construcción', r1.ok && m.construcciones.length === 1);
  const c = m.construcciones[0];
  const p = [...c.piezas.values()][0];
  const centro = localAMundo(c, (p.i + 0.5) * 2, (p.j + 0.5) * 2);
  comprobar('la primera pieza queda donde apuntaste', Math.hypot(centro.x - 3, centro.z - 4) < 1e-9, `(${centro.x.toFixed(2)}, ${centro.z.toFixed(2)})`);
  // un punto a 1,9 m en la dirección local x debe ir a la casilla vecina de la MISMA construcción
  const vec = localAMundo(c, 3.0, 1.0);
  const r2 = m.colocar(m.candidata('cim_piedra', vec.x, vec.z, 0, 0));
  comprobar('segunda pieza en la misma rejilla', r2.ok && m.construcciones.length === 1 && c.piezas.has(clave('f', 1, 0, 0)));
  const r3 = m.colocar(m.candidata('cim_piedra', -12, -12, 0, 1.2));
  comprobar('pieza lejana crea otra construcción con su propio giro', r3.ok && m.construcciones.length === 2 && m.construcciones[1].rot === 1.2);
}

console.log('4. Apoyos');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  const sinApoyo = m.validar(enRejilla(m, c, 'muro_tronco', 0, 0, 0, 0));
  comprobar('muro sin cimiento rechazado', !sinApoyo.ok && sinApoyo.motivo.startsWith('El muro necesita'));
  comprobar('empalizada directa al suelo', m.colocar(enRejilla(m, c, 'empalizada', 5, 5, 0, 0)).ok);
  comprobar('empalizada en planta 1 rechazada', !m.validar(enRejilla(m, c, 'empalizada', 5, 5, 1, 0)).ok);
  comprobar('cimiento en planta 1 rechazado', !m.validar(enRejilla(m, c, 'cim_piedra', 0, 0, 1)).ok);
  comprobar('suelo en planta 0 rechazado', !m.validar(enRejilla(m, c, 'suelo_tronco', 0, 0, 0)).ok);
  m.colocar(enRejilla(m, c, 'cim_piedra', 0, 0, 0));
  comprobar('muro junto a cimiento', m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 0, 0)).ok);
  comprobar('puerta sin hueco rechazada', !m.validar(enRejilla(m, c, 'puerta_varas', 0, 0, 0, 0)).ok);
  m.colocar(enRejilla(m, c, 'muro_tronco_puerta', 0, 0, 0, 1));
  comprobar('puerta en muro con hueco', m.colocar(enRejilla(m, c, 'puerta_varas', 0, 0, 0, 1)).ok);
  comprobar('hueco ocupado rechazado', m.validar(enRejilla(m, c, 'muro_tronco', 0, 0, 0, 0)).motivo === 'Ese hueco ya está ocupado.');
}

console.log('5. Carga: zarzo no sostiene troncos');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  m.colocar(enRejilla(m, c, 'cim_piedra', 0, 0, 0));
  m.colocar(enRejilla(m, c, 'muro_zarzo', 0, 0, 0, 0));
  const v = m.validar(enRejilla(m, c, 'muro_tronco', 0, 0, 1, 0));
  comprobar('muro de troncos sobre zarzo rechazado', !v.ok && v.debil === clave('e', 0, 0, 0, 0), `carga=${v.carga} cap=${v.cap}`);
  const v2 = m.validar(enRejilla(m, c, 'tejado_paja', 0, 0, 1));
  comprobar('tejado de paja sobre zarzo admitido', v2.ok);
}

console.log('6. Carga: torre de muros de troncos');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  m.colocar(enRejilla(m, c, 'cim_piedra', 0, 0, 0));
  const res = [];
  for (let k = 0; k <= 3; k++) res.push(m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, k, 0)));
  const cs = m.cargas(c);
  comprobar('cuatro plantas de muro admitidas (el máximo de plantas)', res.every(r => r.ok), `carga muro bajo=${cs.get(clave('e', 0, 0, 0, 0))}`);
  const r5 = m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 4, 0));
  comprobar('quinta planta rechazada', !r5.ok && r5.motivo === 'Planta no permitida.', r5.motivo);
}

console.log('7. Desmontar: cascada y recuperación del 75%');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  m.colocar(enRejilla(m, c, 'cim_piedra', 0, 0, 0));
  m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 0, 0));
  m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 1, 0));
  m.colocar(enRejilla(m, c, 'hastial', 0, 0, 2, 0));
  const antes = m.materiales.tronco;
  const pre = m.previsualizarDesmontaje(c, clave('e', 0, 0, 0, 0));
  comprobar('previsualización: caen muro de arriba y hastial', pre.ok && pre.caen.length === 2, `caen=${pre.caen.join(' ')}`);
  const r = m.desmontar(c, clave('e', 0, 0, 0, 0));
  comprobar('recupera 3 de 4 troncos (75%)', r.ok && m.materiales.tronco - antes === 3, `+${m.materiales.tronco - antes}`);
  comprobar('solo queda el cimiento', c.piezas.size === 1);
}

console.log('8. Desmontar bloqueado por sobrecarga');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m.colocar(enRejilla(m, c, 'poste', i, j, 0));
  m.colocar(enRejilla(m, c, 'viga', 0, 0, 0, 0));
  m.colocar(enRejilla(m, c, 'viga', 0, 1, 0, 0));
  const s = m.colocar(enRejilla(m, c, 'suelo_tronco', 0, 0, 1));
  // cuatro muros encima: dos sobre las vigas y dos que descansan en el suelo
  const mus = [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1]].map(([i, j, d]) => m.colocar(enRejilla(m, c, 'muro_tronco', i, j, 1, d)));
  const cs = m.cargas(c);
  comprobar('suelo sobre dos vigas y cuatro muros encima', s.ok && mus.every(r => r.ok), `carga por viga=${cs.get(clave('b', 0, 0, 0, 0))}`);
  const pre = m.previsualizarDesmontaje(c, clave('b', 0, 0, 0, 0));
  comprobar('quitar una viga queda bloqueado (la otra cargaría 1020 > 1000)', !pre.ok && pre.debil === clave('b', 0, 1, 0, 0), JSON.stringify(pre));
}

console.log('9. Materiales');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  m.materiales.piedra = 2;
  const v = m.validar(m.candidata('cim_piedra', 1, 1, 0, 0));
  comprobar('sin piedra suficiente rechazado', !v.ok && v.motivo === 'Faltan materiales.', JSON.stringify(v.faltan));
}

console.log('10. Guardar y cargar');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  m.colocar(m.candidata('cim_piedra', 1, 1, 0, 0.3));
  m.colocarDecoracion('mesa', 2, 0, 2, 1.0);
  const txt = JSON.stringify(m.exportar());
  const m2 = Mundo.importar(JSON.parse(txt));
  comprobar('mismo contenido tras guardar', JSON.stringify(m2.exportar()) === txt, `${txt.length} bytes`);
}

console.log('11. Tejados: los muros cierran hasta el tejado');
{
  const casa = (anchoI, anchoJ) => {
    const m = new Mundo(); m.colocarMojon(0, 0);
    const c = nuevaConstruccion(m);
    for (let i = 0; i < anchoI; i++) for (let j = 0; j < anchoJ; j++) m.colocar(enRejilla(m, c, 'cim_piedra', i, j, 0));
    for (let i = 0; i < anchoI; i++) { m.colocar(enRejilla(m, c, 'muro_tronco', i, 0, 0, 0)); m.colocar(enRejilla(m, c, 'muro_tronco', i, anchoJ, 0, 0)); }
    for (let j = 0; j < anchoJ; j++) { m.colocar(enRejilla(m, c, 'muro_tronco', 0, j, 0, 1)); m.colocar(enRejilla(m, c, 'muro_tronco', anchoI, j, 0, 1)); }
    return { m, c };
  };
  // a dos aguas: 2 casillas en x, cumbrera en medio
  {
    const { m, c } = casa(2, 1);
    m.colocar(enRejilla(m, c, 'tejado_paja', 0, 0, 1, 0, 3));
    m.colocar(enRejilla(m, c, 'tejado_paja', 1, 0, 1, 0, 1));
    const g = geometriaTejados(c);
    const r0 = g.get(clave('r', 0, 0, 1)), r1 = g.get(clave('r', 1, 0, 1));
    comprobar('dos aguas: cada tramo cierra sus dos extremos y nada en la cumbrera',
      r0.rellenos.length === 2 && r0.rellenos.every(x => x.tipo === 'lado') && r1.rellenos.length === 2 && r1.rellenos.every(x => x.tipo === 'lado'),
      JSON.stringify(r0.rellenos.map(x => x.tipo)));
  }
  // una sola caída: hay que cerrar el muro alto
  {
    const { m, c } = casa(1, 1);
    m.colocar(enRejilla(m, c, 'tejado_paja', 0, 0, 1, 0, 0));
    const r = geometriaTejados(c).get(clave('r', 0, 0, 1));
    comprobar('una caída: dos lados y el muro alto', r.rellenos.length === 3 && r.rellenos.some(x => x.tipo === 'alto' && x.h === 1));
  }
  // pendiente continua de 3 casillas: arranques 0, 1, 2
  {
    const { m, c } = casa(1, 3);
    m.colocar(enRejilla(m, c, 'muro_tronco', 0, 1, 0, 0)); // tabique bajo la unión de dos tramos
    for (let j = 0; j < 3; j++) m.colocar(enRejilla(m, c, 'tejado_paja', 0, j, 1, 0, 0));
    const g = geometriaTejados(c);
    const arr = [0, 1, 2].map(j => g.get(clave('r', 0, j, 1)).arranque);
    const alto = g.get(clave('r', 0, 2, 1)).rellenos.find(x => x.tipo === 'alto');
    comprobar('pendiente continua: arranques 0,1,2 y muro alto de 3 tramos', arr.join() === '0,1,2' && alto && alto.h === 3, `arranques=${arr.join()}`);
    const altos = [0, 1, 2].map(j => g.get(clave('r', 0, j, 1)).rellenos.filter(x => x.tipo === 'alto').length);
    comprobar('sin muro alto entre tramos seguidos (aunque haya tabique debajo)', altos.join() === '0,0,1', `altos=${altos.join()}`);
  }
}

console.log('12. Lo que no aguanta peso no cuenta como apoyo');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  m.colocar(enRejilla(m, c, 'cim_piedra', 0, 0, 0));
  m.colocar(enRejilla(m, c, 'cim_piedra', 0, 1, 0));
  m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 0, 0));
  m.colocar(enRejilla(m, c, 'tejado_paja', 0, 0, 1, 0, 0));
  const v = m.validar(enRejilla(m, c, 'cerca', 0, 1, 0, 0)); // cerca justo bajo el borde del tejado
  comprobar('una cerca bajo el borde de un tejado se puede poner', v.ok, JSON.stringify(v));
  comprobar('y el tejado no la usa de apoyo', m.soportes(c, c.piezas.get(clave('r', 0, 0, 1))).lista.length === 1);
}

console.log('13. Casas de varias plantas (valravnx: «la madera es demasiado débil»)');
{
  // casa de N×M casillas: cimientos, muros por fuera en cada planta, suelos en alto y tejado
  function casaPlantas(N, M, plantas, cim = 'cim_tronco', muro = 'muro_tronco') {
    const m = new Mundo(); m.colocarMojon(0, 0);
    for (const k in m.materiales) m.materiales[k] = 1e6;
    const c = nuevaConstruccion(m);
    const fallos = [];
    const pon = (q, tipo, i, j, k, d) => { const r = m.colocar(enRejilla(m, c, tipo, i, j, k, d)); if (!r.ok) fallos.push(`${q}: ${r.motivo}`); };
    const celdas = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) celdas.push([i, j]);
    const borde = ([i, j]) => Math.min(i, N - 1 - i, j, M - 1 - j);
    celdas.sort((a, b) => borde(a) - borde(b)); // de fuera hacia dentro, como se construye
    for (const [i, j] of celdas) pon(`cimiento ${i},${j}`, cim, i, j, 0);
    for (let k = 0; k < plantas; k++) {
      if (k > 0) for (const [i, j] of celdas) pon(`suelo k${k} ${i},${j}`, 'suelo_tronco', i, j, k);
      for (const [i, j] of celdas) for (const [ai, aj, , ad] of aristasDeCasilla(i, j, k)) {
        if (c.piezas.has(clave('e', ai, aj, k, ad))) continue;
        const dentro = casillasDeArista(ai, aj, ad).filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < M);
        if (dentro.length === 1) pon(`muro k${k} ${ai},${aj},${ad}`, muro, ai, aj, k, ad);
      }
    }
    for (const [i, j] of celdas) pon(`tejado ${i},${j}`, 'tejado_paja', i, j, plantas);
    return { m, c, fallos };
  }
  for (const [N, M] of [[3, 3], [4, 3], [4, 4]]) {
    const { fallos } = casaPlantas(N, M, 2);
    comprobar(`casa de ${N}×${M}, 2 plantas y tejado, toda de troncos: se puede hacer entera`, fallos.length === 0, fallos.slice(0, 2).join(' | '));
  }
  {
    const { m, c, fallos } = casaPlantas(4, 3, 2);
    let peor = 0; for (const [k, carga] of m.cargas(c)) { const cap = PIEZAS[c.piezas.get(k).tipo].cap; if (cap) peor = Math.max(peor, carga / cap); }
    comprobar('y con margen: ninguna pieza pasa del 75% de lo que aguanta', !fallos.length && peor <= 0.75, `peor ${Math.round(peor * 100)}%`);
  }
  {
    const { fallos } = casaPlantas(4, 3, 3);
    comprobar('3 plantas sobre cimiento de troncos: no aguanta (hace falta piedra)', fallos.some(f => f.includes('no soporta ese peso')), fallos.slice(0, 1).join(''));
    const p = casaPlantas(4, 3, 3, 'cim_piedra');
    comprobar('3 plantas sobre cimiento de piedra: se puede', p.fallos.length === 0, p.fallos.slice(0, 2).join(' | '));
  }
  {
    const { fallos } = casaPlantas(3, 3, 2, 'cim_tronco', 'muro_zarzo');
    comprobar('el zarzo no da para dos plantas', fallos.length > 0);
  }
  {
    const { fallos } = casaPlantas(5, 5, 2);
    comprobar('casa de 5×5: el centro no se sostiene sin vigas (vano de una casilla como mucho)', fallos.some(f => f.startsWith('suelo k1 2,2')) && fallos.some(f => f.startsWith('tejado 2,2')), fallos.join(' | '));
  }
  {
    // el tejado de una casilla sin muros debajo se apoya en el tramo de al lado; si se quita ese, cae
    const m = new Mundo(); m.colocarMojon(0, 0);
    const c = nuevaConstruccion(m);
    m.colocar(enRejilla(m, c, 'cim_tronco', 0, 0, 0));
    m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 0, 1));
    m.colocar(enRejilla(m, c, 'tejado_paja', 0, 0, 1));
    const r = m.colocar(enRejilla(m, c, 'tejado_paja', 1, 0, 1));
    comprobar('tejado apoyado en el tramo de al lado', r.ok, r.motivo || '');
    const pre = m.previsualizarDesmontaje(c, clave('r', 0, 0, 1));
    comprobar('y cae si se quita el tramo en el que se apoya', pre.ok && pre.caen.includes(clave('r', 1, 0, 1)), `caen=${(pre.caen || []).join(' ')}`);
    const r2 = m.validar(enRejilla(m, c, 'tejado_paja', 2, 0, 1));
    comprobar('pero no se encadena: dos casillas sin muro no se sostienen', !r2.ok, r2.motivo || '');
  }
}

console.log('14. Escalera de tablas');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  for (const k in m.materiales) m.materiales[k] += 500;
  const c = nuevaConstruccion(m);
  // dos casillas de cimiento con muros alrededor y suelo arriba solo en la casilla de salida (0,1)
  m.colocar(enRejilla(m, c, 'cim_tronco', 0, 0, 0));
  m.colocar(enRejilla(m, c, 'cim_tronco', 0, 1, 0));
  for (const [i, j, d] of [[0, 0, 0], [0, 2, 0], [0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 1]]) m.colocar(enRejilla(m, c, 'muro_tronco', i, j, 0, d));
  const t0 = m.materiales.tabla, c0 = m.materiales.clavo;
  const r = m.colocar(enRejilla(m, c, 'escalera_tabla', 0, 0, 0, 0, 0));
  comprobar('escalera de tablas sobre el cimiento', r.ok, r.motivo || '');
  comprobar('cuesta 6 tablas y 6 clavos', t0 - m.materiales.tabla === 6 && c0 - m.materiales.clavo === 6);
  const suelo = m.colocar(enRejilla(m, c, 'suelo_tronco', 0, 1, 1));
  comprobar('suelo de arriba en la casilla de salida', suelo.ok, suelo.motivo || '');
  const hueco = m.validar(enRejilla(m, c, 'suelo_tronco', 0, 0, 1));
  comprobar('encima de la escalera queda el hueco abierto: no deja poner suelo', !hueco.ok && hueco.motivo === 'Ahí está el hueco de una escalera.', hueco.motivo || '');
  comprobar('la escalera de mano no está en la misma casilla (una escalera por casilla)', !m.validar(enRejilla(m, c, 'escalera_mano', 0, 0, 0)).ok);
  // al revés: con el suelo ya puesto, la escalera no entra
  m.colocar(enRejilla(m, c, 'suelo_tronco', 0, 0, 1)); // rechazado, no hace nada
  const c2 = nuevaConstruccion(m);
  m.colocar(enRejilla(m, c2, 'cim_tronco', 0, 0, 0));
  for (const [i, j, d] of [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1]]) m.colocar(enRejilla(m, c2, 'muro_tronco', i, j, 0, d));
  m.colocar(enRejilla(m, c2, 'suelo_tronco', 0, 0, 1));
  const tapada = m.validar(enRejilla(m, c2, 'escalera_tabla', 0, 0, 0));
  comprobar('con suelo encima no se puede poner (no habría hueco)', !tapada.ok && tapada.motivo.startsWith('Encima de la escalera'), tapada.motivo || '');
  comprobar('en la última planta no cabe', !m.validar(enRejilla(m, c, 'escalera_tabla', 3, 3, 3)).ok);
  // apoyos y carga: descansa en el cimiento y suma sus 100 kg
  const sop = m.soportes(c, c.piezas.get(clave('l', 0, 0, 0)));
  comprobar('se apoya en el cimiento de su casilla', sop.lista.length === 1 && sop.lista[0] === clave('f', 0, 0, 0));
  const conEsc = m.cargas(c).get(clave('f', 0, 0, 0));
  const sinEsc = m.cargas({ ...c, piezas: new Map([...c.piezas].filter(([k]) => k !== clave('l', 0, 0, 0))) }).get(clave('f', 0, 0, 0));
  comprobar('el cimiento carga sus 100 kg de más', Math.abs(conEsc - sinEsc - 100) < 1e-6, `${sinEsc} → ${conEsc} kg`);
  // en la planta 1 necesita suelo; si se quita el suelo, cae
  const r1 = m.colocar(enRejilla(m, c, 'escalera_tabla', 0, 1, 1, 0, 2));
  comprobar('en la planta 1 se apoya en un suelo', r1.ok, r1.motivo || '');
  const pre = m.previsualizarDesmontaje(c, clave('f', 0, 1, 1));
  comprobar('y cae si se quita ese suelo', pre.ok && pre.caen.includes(clave('l', 0, 1, 1)), `caen=${(pre.caen || []).join(' ')}`);
  comprobar('sin suelo en alto no se pone', !m.validar(enRejilla(m, c, 'escalera_tabla', 5, 5, 1)).ok);
  // subida: abajo 0, arriba 1, en la dirección elegida
  const p = c.piezas.get(clave('l', 0, 0, 0));
  comprobar('se sube andando: abajo en el borde de entrada, arriba en el de salida', progresoEscalera(p, 1, 0) === 0 && progresoEscalera(p, 1, 2) === 1 && Math.abs(progresoEscalera(p, 1, 1) - 0.5) < 1e-9);
  const s = salidaEscalera(p);
  comprobar('sale por arriba al suelo de la casilla de al lado', s.i === 0 && s.j === 1 && s.k === 1 && c.piezas.has(clave('f', s.i, s.j, s.k)));
  const girada = { ...p, dir: 3 };
  comprobar('girada sube hacia +x', progresoEscalera(girada, 0, 1) === 0 && progresoEscalera(girada, 2, 1) === 1 && salidaEscalera(girada).i === 1);
  comprobar('la escalera de mano no se sube andando (va con Usar)', !escaleraAndando(c2, 0, 0, 0) && !PIEZAS.escalera_mano.andando);
  // guardado: la pieza nueva entra y sale igual
  const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
  comprobar('se guarda y se carga', !!escaleraAndando(m2.construcciones.find(x => x.id === c.id), 0, 0, 0));
}

console.log('Barandillas y portillo');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  // casa de 2×1 con suelo en la planta 1 y una escalera de tablas en la casilla (0,0)
  for (const i of [0, 1]) m.colocar(enRejilla(m, c, 'cim_tronco', i, 0, 0));
  for (const [i, j, d] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [2, 0, 1]]) m.colocar(enRejilla(m, c, 'muro_tronco', i, j, 0, d));
  m.colocar(enRejilla(m, c, 'escalera_tabla', 0, 0, 0, 0, 3)); // sube hacia +x: sale a la casilla (1,0)
  const s1 = m.colocar(enRejilla(m, c, 'suelo_tronco', 1, 0, 1));
  comprobar('suelo de arriba junto al hueco de la escalera', s1.ok, s1.motivo || '');
  // barandilla en el borde exterior del suelo en alto (encima de un muro) y alrededor del hueco
  const b1 = m.colocar(enRejilla(m, c, 'medio_muro', 1, 0, 1, 0));
  comprobar('medio muro como barandilla en el borde de un suelo en alto', b1.ok, b1.motivo || '');
  const b2 = m.colocar(enRejilla(m, c, 'medio_muro', 1, 0, 1, 1));
  comprobar('y en el borde del hueco de la escalera', b2.ok, b2.motivo || '');
  const sop = m.soportes(c, c.piezas.get(clave('e', 1, 0, 1, 1)));
  comprobar('la del hueco se apoya en el suelo de al lado', sop.lista.includes(clave('f', 1, 0, 1)), sop.lista.join(' '));
  const sinSuelo = m.validar(enRejilla(m, c, 'medio_muro', 4, 4, 1, 0));
  comprobar('en el aire no se pone', !sinSuelo.ok);
  const pre = m.previsualizarDesmontaje(c, clave('f', 1, 0, 1));
  comprobar('si se quita el suelo, la barandilla del hueco cae con él', pre.ok && pre.caen.includes(clave('e', 1, 0, 1, 1)), (pre.caen || []).join(' '));
  comprobar('la barandilla no sostiene nada (capacidad 0)', PIEZAS.medio_muro.cap === 0);

  // portillo de la cerca: corral en la planta baja
  const R = new RegistroAcciones();
  const A = (a) => ejecutar(m, R, { autor: 'jugador:prueba', ...a });
  const antes = { ...m.materiales };
  const p1 = A({ tipo: 'colocar', pieza: 'cerca_portillo', x: 9, z: 9, k: 0, rot: 0, dir: 0 });
  comprobar('el portillo se pone en el suelo, como la cerca', p1.ok, p1.motivo || '');
  comprobar('cuesta 4 varas y 1 cuerda', antes.vara - m.materiales.vara === 4 && antes.cuerda - m.materiales.cuerda === 1);
  A({ tipo: 'colocar', pieza: 'cerca', x: 11, z: 9, k: 0, rot: 0, dir: 0 });
  const cc = p1.construccion;
  const kp = p1.clave, kc = [...cc.piezas.entries()].find(([, p]) => p.tipo === 'cerca')[0];
  comprobar('portillo y cerca en la misma rejilla', cc.piezas.size === 2);
  comprobar('solo en la planta baja', !m.validar(m.candidata('cerca_portillo', 9, 9, 1)).ok);
  const u1 = A({ tipo: 'usar', construccion: cc.id, clave: kp });
  comprobar('el portillo se abre con Usar', u1.ok && cc.piezas.get(kp).abierta === true);
  const u2 = A({ tipo: 'usar', construccion: cc.id, clave: kp });
  comprobar('y se vuelve a cerrar', u2.ok && cc.piezas.get(kp).abierta === false);
  comprobar('la cerca normal no se abre', !A({ tipo: 'usar', construccion: cc.id, clave: kc }).ok && !seAbre(cc.piezas.get(kc)));
  comprobar('el medio muro tampoco', !seAbre(c.piezas.get(clave('e', 1, 0, 1, 0))));
  comprobar('el portón de la empalizada sigue abriéndose', seAbre({ tipo: 'empalizada_puerta', hueco: 'e' }));
  comprobar('cada Usar queda anotado con su autor', R.entradas.filter(e => e.tipo === 'usar' && e.autor === 'jugador:prueba').length === 3);
  A({ tipo: 'usar', construccion: cc.id, clave: kp });
  const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
  comprobar('abierto se guarda y se carga abierto', m2.construcciones.find(x => x.id === cc.id).piezas.get(kp).abierta === true);
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
