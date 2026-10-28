// Pruebas de la lógica de construcción de Kinhold. Ejecutar: node pruebas/prueba_logica.mjs
// Con MUTAR=1 se altera una capacidad a propósito: las pruebas deben FALLAR.
import { Mundo, SUBIR_PLANTA, clave, andamioEn, poleaPara, polipastoPara, localAMundo, mundoALocal, geometriaTejados, aristasDeCasilla, casillasDeArista, escaleraAndando, trampillaCerrada, progresoEscalera, salidaEscalera } from '../src/logica/construccion.js';
import { PIEZAS, CLASE_PESO, MATERIALES } from '../src/logica/piezas.js';
import { ejecutar, RegistroAcciones, seAbre, acabarObra } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') {
  PIEZAS.muro_zarzo.cap = 1000;   // un muro de zarzo que aguanta cualquier cosa
  PIEZAS.viga.cap = 5000;         // una viga que nunca se sobrecarga
  PIEZAS.cim_tronco.cap = 5000;   // un cimiento de troncos que aguanta tres plantas
  CLASE_PESO.tronco = 'ligero';   // troncos que se suben a mano por la escalera
  PIEZAS.andamio.cap = 0;         // un andamio que no aguanta el de encima
  PIEZAS.polea.hueco = 'b';       // una polea que no cuelga de su viga
  PIEZAS.polipasto.polipasto = false; // un polipasto que es una polea más
  PIEZAS.muro_tabla_ventana.conVentana = false; // un muro de tablas con ventana sin hueco para la contraventana
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
  if (['e', 'b', 'g', 'p', 'q', 'w'].includes(def.hueco)) p.d = d;
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
    comprobar('dos aguas: la cumbrera la remata uno solo de los dos tramos', [r0, r1].filter(x => x.cumbrera).length === 1, JSON.stringify([r0.cumbrera, r1.cumbrera]));
    comprobar('dos aguas: cada tramo suelto vuela por sus dos lados', r0.extremos.length === 2 && r1.extremos.length === 2, JSON.stringify([r0.extremos, r1.extremos]));
  }
  // tres tramos de lado en la misma caída: el del medio no vuela por ningún lado y los de los bordes por uno
  {
    const { m, c } = casa(3, 1);
    for (let i = 0; i < 3; i++) m.colocar(enRejilla(m, c, 'tejado_tablilla', i, 0, 1, 0, 0));
    const g = geometriaTejados(c), ext = [0, 1, 2].map(i => g.get(clave('r', i, 0, 1)).extremos.length);
    const par = [0, 1, 2].map(i => g.get(clave('r', i, 0, 1)).par);
    comprobar('tramos de lado: solo vuelan los bordes (1, 0, 1 lados)', ext.join() === '1,0,1', `extremos=${ext.join()}`);
    comprobar('tramos de lado: paridad alterna (no se montan a la misma altura)', par[0] !== par[1] && par[1] !== par[2], `par=${par.join()}`);
    comprobar('una caída sin tramo enfrente: sin cumbrera', [0, 1, 2].every(i => !g.get(clave('r', i, 0, 1)).cumbrera));
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
  acabarObra(m, R, 'jugador:prueba', p1.construccion.id, p1.clave);
  comprobar('cuesta 4 varas y 1 cuerda', antes.vara - m.materiales.vara === 4 && antes.cuerda - m.materiales.cuerda === 1);
  const p2 = A({ tipo: 'colocar', pieza: 'cerca', x: 11, z: 9, k: 0, rot: 0, dir: 0 });
  acabarObra(m, R, 'jugador:prueba', p2.construccion.id, p2.clave);
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

console.log('15. Obras en alto: clase de peso y subir el material');
{
  comprobar('cada material tiene clase de peso', Object.keys(MATERIALES).every(x => ['ligero', 'pesado', 'muy_pesado'].includes(CLASE_PESO[x])));
  comprobar('tablas, varas, paja y clavos son ligeros; troncos, pesados (GDD)', ['tabla', 'vara', 'paja', 'clavo'].every(x => CLASE_PESO[x] === 'ligero') && CLASE_PESO.tronco === 'pesado');
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  const R = new RegistroAcciones();
  const yo = 'jugador:uno', otro = 'jugador:dos';
  const A = (autor, a) => ejecutar(m, R, { autor, construccion: c.id, ...a });
  // casilla de 1×1 con cimiento, cuatro muros y suelo de troncos en la planta 1
  m.colocar(enRejilla(m, c, 'cim_tronco', 0, 0, 0));
  for (const [i, j, d] of [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1]]) m.colocar(enRejilla(m, c, 'muro_tronco', i, j, 0, d));
  m.colocar(enRejilla(m, c, 'suelo_tronco', 0, 0, 1));
  // abajo, como siempre: los troncos se entregan desde el suelo
  const ab = m.colocar(enRejilla(m, c, 'poste', 3, 3, 0), true);
  comprobar('a ras de suelo, lo pesado se entrega sin subirlo', A(yo, { tipo: 'entregar', clave: ab.clave, material: 'tronco', cantidad: 1 }).ok);
  // arriba: un muro de troncos (pesado) y un tejado de paja (ligero) en la planta 1
  const mu = m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 1, 0), true);
  const kmu = mu.clave, pmu = c.piezas.get(kmu);
  const t0 = m.materiales.tronco;
  const e1 = A(yo, { tipo: 'entregar', clave: kmu, material: 'tronco', cantidad: 4, desde: 1 });
  comprobar('en la planta 1, los troncos no se entregan a mano (ni estando arriba)', !e1.ok && pmu.obra.entregado.tronco === undefined && m.materiales.tronco === t0, e1.motivo || '');
  // una persona sola, sin varas: coge de un lado y espera ayuda
  const s1 = A(yo, { tipo: 'subir', clave: kmu, material: 'tronco', segundos: 5, metodo: 'entre_dos' });
  comprobar('sola y sin varas, la subida no avanza de la mitad: espera ayuda', s1.ok && !s1.subido && s1.esperaAyuda && s1.progreso <= 0.5, JSON.stringify(s1));
  comprobar('el tronco sale de la reserva al empezar a subirlo', m.materiales.tronco === t0 - 1);
  // llega otra persona: entre dos sube (2 × 2,5 s por planta de trabajo sumado)
  const s2 = A(otro, { tipo: 'subir', clave: kmu, material: 'tronco', segundos: 1, metodo: 'entre_dos' });
  comprobar('entre dos, el tronco llega arriba', s2.ok && s2.subido && pmu.obra.entregado.tronco === 1, JSON.stringify(s2));
  const ap = pmu.obra.aportes.find(x => x.sube);
  comprobar('la subida queda anotada con los dos autores y sus segundos', ap && ap.metodo === 'entre_dos' && ap.autores[yo] === 5 && ap.autores[otro] === 1);
  // una persona sola con dos varas y una cuerda: puede, más despacio (el doble de trabajo que entre dos)
  let n = 0, r;
  do { r = A(yo, { tipo: 'subir', clave: kmu, material: 'tronco', segundos: 1, metodo: 'varas' }); n++; } while (r.ok && !r.subido && n < 100);
  comprobar('sola, rodándolo por dos varas con una cuerda, también lo sube', r.ok && r.subido && pmu.obra.entregado.tronco === 2);
  comprobar('pero tarda el doble de trabajo que entre dos', n === 4 * SUBIR_PLANTA && 2 * 2 * SUBIR_PLANTA === 10, `${n} s sola`);
  comprobar('las varas y la cuerda no se gastan', m.materiales.vara === 120 && m.materiales.cuerda === 40);
  const sin = new Mundo(); Object.assign(sin, { materiales: { ...m.materiales, vara: 1 } }); sin.construcciones = m.construcciones;
  comprobar('sin dos varas no se puede rodar', !sin.subir(c, kmu, 'tronco', 1, yo, 'varas').ok);
  comprobar('lo ligero no se sube con varas', !A(yo, { tipo: 'subir', clave: kmu, material: 'paja', segundos: 1, metodo: 'varas' }).ok);
  comprobar('a ras de suelo no hace falta subir', !A(yo, { tipo: 'subir', clave: ab.clave, material: 'tronco', segundos: 1, metodo: 'varas' }).ok);
  // desmontar una obra con un tronco a medio subir lo devuelve también
  A(yo, { tipo: 'subir', clave: kmu, material: 'tronco', segundos: 1, metodo: 'varas' });
  const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
  comprobar('la subida a medias se guarda y se carga', m2.construcciones[0].piezas.get(kmu).obra.subida?.seg[yo] === 1);
  const tr1 = m.materiales.tronco;
  const d = A(yo, { tipo: 'desmontar', clave: kmu });
  comprobar('desmontar la obra devuelve lo subido y el tronco que iba subiendo', d.ok && m.materiales.tronco === tr1 + 3, `${tr1} → ${m.materiales.tronco}`);
  // lo ligero: a mano por la escalera, hay que estar en la planta de la obra
  const te = m.colocar(enRejilla(m, c, 'tejado_paja', 0, 0, 1), true);
  const kte = te.clave;
  const l1 = A(yo, { tipo: 'entregar', clave: kte, material: 'paja', cantidad: 4, desde: 0 });
  comprobar('lo ligero no llega a la planta 1 desde abajo', te.ok && !l1.ok && l1.escalera, l1.motivo || te.motivo || '');
  comprobar('sin decir desde dónde, cuenta como desde el suelo', !A(yo, { tipo: 'entregar', clave: kte, material: 'paja', cantidad: 4 }).ok);
  const l2 = A(yo, { tipo: 'entregar', clave: kte, material: 'paja', cantidad: 4, desde: 1 });
  comprobar('subido a mano por la escalera, sí se entrega', l2.ok && c.piezas.get(kte).obra.entregado.paja === 4);
  comprobar('acabarObra termina una obra en alto con todo por acciones', acabarObra(m, R, yo, c.id, kte).terminada && !c.piezas.get(kte).obra);
}

console.log('16. Obras: andamio pegado al muro y polea en una viga');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const c = nuevaConstruccion(m);
  const R = new RegistroAcciones();
  const yo = 'jugador:uno';
  const A = (a) => ejecutar(m, R, { autor: yo, construccion: c.id, ...a });
  const pon = (tipo, i, j, k, d = 0) => m.colocar(enRejilla(m, c, tipo, i, j, k, d));
  // casa de 2×1: cimientos de piedra, muros en la planta baja y la 1, y suelo de la planta 1
  for (const i of [0, 1]) pon('cim_piedra', i, 0, 0);
  for (const k of [0, 1]) {
    for (const i of [0, 1]) { pon('muro_tronco', i, 0, k, 0); pon('muro_tronco', i, 1, k, 0); }
    pon('muro_tronco', 0, 0, k, 1); pon('muro_tronco', 2, 0, k, 1);
  }
  for (const i of [0, 1]) pon('suelo_tronco', i, 0, 1);
  // andamio
  comprobar('el andamio cuesta varas y cuerda y va en la categoría de acceso', PIEZAS.andamio.coste.vara > 0 && PIEZAS.andamio.coste.cuerda > 0 && PIEZAS.andamio.cat === 'acceso');
  const lejos = m.validar(enRejilla(m, c, 'andamio', 4, 4, 0));
  comprobar('lejos de un muro no se pone', !lejos.ok && /muro/.test(lejos.motivo), lejos.motivo);
  const a0 = pon('andamio', 0, -1, 0);
  comprobar('pegado al muro, a ras de suelo, se pone', a0.ok, a0.motivo || '');
  comprobar('un andamio terminado cuenta como andamio', !!andamioEn(c, 0, -1, 0));
  const lado = pon('andamio', 2, 0, 0);
  comprobar('mira solo hacia su muro (la barandilla y la escalerilla quedan por fuera)', c.piezas.get(a0.clave).dir === 0 && lado.ok && c.piezas.get(lado.clave).dir === 1, `${c.piezas.get(a0.clave).dir} y ${lado.ok && c.piezas.get(lado.clave).dir}`);
  const dentro = m.validar(enRejilla(m, c, 'andamio', 0, 0, 0));
  comprobar('donde arriba hay suelo no cabe su plataforma', !dentro.ok, dentro.motivo);
  const flota = m.validar(enRejilla(m, c, 'andamio', 1, -1, 1));
  comprobar('en alto, sin andamio debajo, no se sostiene', !flota.ok, flota.motivo);
  const a1 = pon('andamio', 0, -1, 1);
  comprobar('encima de otro andamio, sí', a1.ok, a1.motivo || '');
  comprobar('en la última planta no cabe (su plataforma iría por encima)', !m.validar(enRejilla(m, c, 'andamio', 0, -1, 3)).ok);
  const sobre = m.validar(enRejilla(m, c, 'suelo_tablas' in PIEZAS ? 'suelo_tablas' : 'suelo_tabla', 0, -1, 1));
  comprobar('no se pone un suelo donde está la plataforma del andamio', !sobre.ok);
  comprobar('aguanta otro andamio encima (sin sobrecarga)', !m.sobrecarga(c));
  // el marco de un muro de la planta 2, y el tercer andamio pegado a él
  const mz = m.colocar(enRejilla(m, c, 'muro_zarzo', 0, 0, 2, 0), true);
  const a2 = pon('andamio', 0, -1, 2);
  comprobar('se apilan tres andamios hasta la planta 3, pegados a la obra de arriba', a2.ok, a2.motivo || '');
  const e1 = A({ tipo: 'entregar', clave: mz.clave, material: 'vara', cantidad: 4, desde: 1 });
  comprobar('lo ligero no llega a la planta 2 desde la 1', mz.ok && !e1.ok && e1.escalera, e1.motivo || mz.motivo);
  const e2 = A({ tipo: 'entregar', clave: mz.clave, material: 'vara', cantidad: 4, desde: 2 });
  comprobar('subido al andamio (en la planta 2), se entrega y se trabaja', e2.ok && acabarObra(m, R, yo, c.id, mz.clave).terminada);
  const pre = m.previsualizarDesmontaje(c, clave('l', 0, -1, 0));
  comprobar('al quitar el andamio de abajo caen los de encima', pre.ok && pre.caen.length === 2, JSON.stringify(pre.caen));
  // polea
  comprobar('la polea va en la categoría de acceso y cuelga de una viga', PIEZAS.polea.cat === 'acceso' && PIEZAS.polea.hueco === 'q');
  const sinViga = m.validar(enRejilla(m, c, 'polea', 0, 1, 1, 0));
  comprobar('sin viga no se cuelga', !sinViga.ok, sinViga.motivo);
  const vigaObra = m.colocar(enRejilla(m, c, 'viga', 0, 1, 1, 0), true);
  comprobar('de una viga en obras tampoco', !m.validar(enRejilla(m, c, 'polea', 0, 1, 1, 0)).ok);
  acabarObra(m, R, yo, c.id, vigaObra.clave);
  const po = pon('polea', 0, 1, 1, 0);
  comprobar('de una viga terminada, sí', po.ok, po.motivo || '');
  // una obra pesada en la planta 2 (muro de troncos sobre el de la planta 1)
  const mt = m.colocar(enRejilla(m, c, 'muro_tronco', 1, 1, 2, 0), true);
  const pmt = c.piezas.get(mt.clave);
  comprobar('la polea de lo alto de la planta 1 sirve para la planta 2', poleaPara(c, pmt) === c.piezas.get(po.clave));
  let n = 0, r;
  do { r = A({ tipo: 'subir', clave: mt.clave, material: 'tronco', segundos: 1, metodo: 'polea' }); n++; } while (r.ok && !r.subido && n < 100);
  comprobar('una persona sola sube un tronco con la polea', r.ok && r.subido && pmt.obra.entregado.tronco === 1, r.motivo || '');
  comprobar('con polea, una sola hace lo de dos a pulso: la mitad que con varas', n === 2 * 2 * SUBIR_PLANTA, `${n} s a la planta 2 (con varas, ${4 * 2 * SUBIR_PLANTA} s)`);
  const ap = pmt.obra.aportes.at(-1);
  comprobar('queda anotado que se subió con polea y quién', ap?.metodo === 'polea' && ap.autores[yo] === n);
  // una polea más baja no sirve para más arriba; sin polea, el método «polea» no vale
  const c2 = nuevaConstruccion(m);
  const pon2 = (tipo, i, j, k, d = 0, marco = false) => m.colocar(enRejilla(m, c2, tipo, i, j, k, d), marco);
  pon2('cim_piedra', 5, 3, 0); pon2('muro_tronco', 5, 3, 0, 0); pon2('muro_tronco', 5, 3, 1, 0);
  const sola = pon2('muro_tronco', 5, 3, 2, 0, true);
  const sinPolea = ejecutar(m, R, { autor: yo, tipo: 'subir', construccion: c2.id, clave: sola.clave, material: 'tronco', segundos: 1, metodo: 'polea' });
  comprobar('sin polea en la construcción, no se sube con polea', !sinPolea.ok, sinPolea.motivo);
  pon2('viga', 5, 3, 0, 0); const po2 = pon2('polea', 5, 3, 0, 0);
  comprobar('una polea en lo alto de la planta baja no llega a la planta 2', sola.ok && po2.ok && !poleaPara(c2, c2.piezas.get(sola.clave)), sola.motivo || po2.motivo || '');
  comprobar('pero sí a la planta 1', !!poleaPara(c2, { k: 1, hueco: 'e', i: 5, j: 3, d: 0 }));
  // guardar y cargar
  const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
  const c3 = m2.construcciones.find(x => x.id === c.id);
  comprobar('el andamio y la polea se guardan y se cargan', !!andamioEn(c3, 0, -1, 2) && c3.piezas.has(clave('q', 0, 1, 1, 0)));
  // al quitar la viga, la polea cae
  const pv = m.previsualizarDesmontaje(c, vigaObra.clave);
  comprobar('al quitar la viga, cae la polea', pv.ok && pv.caen.includes(po.clave), JSON.stringify(pv));
}

console.log('17. Obras: polipasto con torno (lo muy pesado, entre dos)');
{
  // aún no hay sillares en el juego: un material «muy pesado» y un muro que lo pide, solo para esta prueba
  CLASE_PESO.sillar_prueba = 'muy_pesado';
  PIEZAS.muro_prueba_sillar = { nombre: 'Muro de prueba', hueco: 'e', nivel: 1, peso: 300, cap: 1200, coste: { sillar_prueba: 2 }, cat: 'oculto' };
  const m = new Mundo(); m.colocarMojon(0, 0); m.materiales.sillar_prueba = 10;
  const c = nuevaConstruccion(m);
  const R = new RegistroAcciones();
  const yo = 'jugador:uno', otro = 'jugador:dos';
  const A = (autor, a) => ejecutar(m, R, { autor, construccion: c.id, ...a });
  const pon = (tipo, i, j, k, d = 0, marco = false) => m.colocar(enRejilla(m, c, tipo, i, j, k, d), marco);
  pon('cim_piedra', 0, 0, 0); pon('muro_tronco', 0, 0, 0, 0); pon('muro_tronco', 0, 0, 1, 0);
  comprobar('el polipasto va en acceso, cuelga de una viga y lleva cuerda, hierro y madera', PIEZAS.polipasto.cat === 'acceso' && PIEZAS.polipasto.hueco === 'q' && PIEZAS.polipasto.coste.cuerda > 0 && PIEZAS.polipasto.coste.hierro > 0);
  const sinViga = m.validar(enRejilla(m, c, 'polipasto', 0, 0, 1, 0));
  comprobar('sin viga no se cuelga (y lo dice del polipasto)', !sinViga.ok && /polipasto/.test(sinViga.motivo), sinViga.motivo);
  pon('viga', 0, 0, 1, 0);
  const pp = pon('polipasto', 0, 0, 1, 0);
  comprobar('de una viga terminada, sí', pp.ok, pp.motivo || '');
  comprobar('en la misma viga no cabe además una polea', !m.validar(enRejilla(m, c, 'polea', 0, 0, 1, 0)).ok);
  const ms = pon('muro_prueba_sillar', 0, 0, 2, 0, true);
  const pms = c.piezas.get(ms.clave);
  comprobar('el polipasto de lo alto de la planta 1 sirve para la planta 2; no cuenta como polea', ms.ok && polipastoPara(c, pms) === c.piezas.get(pp.clave) && !poleaPara(c, pms));
  // lo muy pesado no se sube de otra forma
  const aMano = A(yo, { tipo: 'entregar', clave: ms.clave, material: 'sillar_prueba', cantidad: 2, desde: 2 });
  comprobar('lo muy pesado no se lleva a mano', !aMano.ok && aMano.subir, aMano.motivo);
  for (const metodo of ['varas', 'polea', 'entre_dos']) {
    const r = A(yo, { tipo: 'subir', clave: ms.clave, material: 'sillar_prueba', segundos: 1, metodo });
    comprobar(`lo muy pesado no se sube con «${metodo}»`, !r.ok, r.motivo);
  }
  // una persona sola en el torno: no pasa de la mitad, espera a quien guíe
  let r, n = 0;
  do { r = A(yo, { tipo: 'subir', clave: ms.clave, material: 'sillar_prueba', segundos: 1, metodo: 'polipasto' }); n++; } while (r.ok && !r.subido && n < 60);
  comprobar('una persona sola no sube un sillar con el polipasto: espera a otra que guíe', r.ok && !r.subido && r.esperaAyuda && r.progreso <= 0.5, `${r.motivo || ''} progreso ${r.progreso}`);
  const r2 = A(otro, { tipo: 'subir', clave: ms.clave, material: 'sillar_prueba', segundos: 1, metodo: 'polipasto' });
  comprobar('en cuanto otro ayuda (guía), el sillar llega arriba', r2.ok && r2.subido && pms.obra.entregado.sillar_prueba === 1, JSON.stringify(r2));
  const ap = pms.obra.aportes.at(-1);
  comprobar('queda anotado con polipasto y los dos autores', ap?.metodo === 'polipasto' && ap.autores[yo] > 0 && ap.autores[otro] === 1);
  // el segundo sillar, a medias los dos: 4 × SUBIR_PLANTA por planta entre los dos
  let s = 0;
  do { r = A(s % 2 ? otro : yo, { tipo: 'subir', clave: ms.clave, material: 'sillar_prueba', segundos: 1, metodo: 'polipasto' }); s++; } while (r.ok && !r.subido && s < 200);
  comprobar('entre dos, un sillar a la planta 2 cuesta 4 × SUBIR_PLANTA × 2 s de trabajo', r.subido && s === 4 * SUBIR_PLANTA * 2, `${s} s`);
  comprobar('con los sillares arriba, la obra se termina', acabarObra(m, R, yo, c.id, ms.clave).terminada);
  // lo pesado, una persona sola con el polipasto, como con polea
  pon('cim_piedra', 1, 0, 0); pon('muro_tronco', 1, 0, 0, 0); pon('muro_tronco', 1, 0, 1, 0);
  const mt = pon('muro_tronco', 1, 0, 2, 0, true);
  let t = 0;
  do { r = A(yo, { tipo: 'subir', clave: mt.clave, material: 'tronco', segundos: 1, metodo: 'polipasto' }); t++; } while (r.ok && !r.subido && t < 100);
  comprobar('un tronco lo sube una persona sola con el polipasto, como con polea', r.ok && r.subido && t === 2 * 2 * SUBIR_PLANTA, `${t} s ${r.motivo || ''}`);
  // sin polipasto, el método no vale
  const c2 = nuevaConstruccion(m);
  const pon2 = (tipo, i, j, k, d = 0, marco = false) => m.colocar(enRejilla(m, c2, tipo, i, j, k, d), marco);
  pon2('cim_piedra', 5, 3, 0); pon2('muro_tronco', 5, 3, 0, 0); pon2('viga', 5, 3, 0, 0); pon2('polea', 5, 3, 0, 0);
  const ob = pon2('muro_tronco', 5, 3, 1, 0, true);
  const sinP = ejecutar(m, R, { autor: yo, tipo: 'subir', construccion: c2.id, clave: ob.clave, material: 'tronco', segundos: 1, metodo: 'polipasto' });
  comprobar('con solo una polea no se sube «con polipasto»', !sinP.ok, sinP.motivo);
  // guardar y cargar
  const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
  const c3 = m2.construcciones.find(x => x.id === c.id);
  comprobar('el polipasto se guarda y se carga', c3.piezas.get(clave('q', 0, 0, 1, 0))?.tipo === 'polipasto');
  delete PIEZAS.muro_prueba_sillar; delete CLASE_PESO.sillar_prueba;
}

console.log('18. Contraventana, trampilla y muro de tablas con ventana');
{
  const m = new Mundo(); m.colocarMojon(0, 0);
  const R = new RegistroAcciones(), yo = 'jugador:prueba';
  const c = nuevaConstruccion(m);
  const pon = (tipo, i, j, k, d = 0, dir = 0) => m.colocar(enRejilla(m, c, tipo, i, j, k, d, dir));
  // casa de 2×1: cimientos, muros (uno de tablas con ventana y otro de troncos con ventana), suelo arriba y escalera
  for (const i of [0, 1]) pon('cim_tronco', i, 0, 0);
  const mv = pon('muro_tabla_ventana', 1, 0, 0, 0);
  comprobar('el muro de tablas con ventana se pone', mv.ok, mv.motivo || '');
  comprobar('cuesta menos que el muro de tablas entero', PIEZAS.muro_tabla_ventana.coste.tabla < PIEZAS.muro_tabla.coste.tabla && PIEZAS.muro_tabla_ventana.conVentana === true);
  for (const [i, j, d] of [[0, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [2, 0, 1]]) pon(i === 0 && j === 1 ? 'muro_tronco_ventana' : 'muro_tronco', i, j, 0, d);
  pon('escalera_tabla', 0, 0, 0, 0, 3); // sube hacia +x: sale a la casilla (1,0)
  pon('suelo_tronco', 1, 0, 1);
  // contraventana: solo en un muro con ventana, por acciones con autor, y se abre y se cierra con Usar
  const A = (a) => ejecutar(m, R, { autor: yo, ...a });
  const enMuro = m.validar(enRejilla(m, c, 'contraventana', 0, 0, 0, 0));
  comprobar('la contraventana no va en un muro sin ventana', !enMuro.ok && enMuro.motivo === 'La contraventana va en un muro con ventana.', enMuro.motivo || '');
  comprobar('ni en el aire', !m.validar(enRejilla(m, c, 'contraventana', 4, 4, 0, 0)).ok);
  const antes = { ...m.materiales };
  const cv = A({ tipo: 'colocar', pieza: 'contraventana', x: 3, z: 0, k: 0, rot: 0, dir: 0 }); // arista (1,0,d=0): centro en (3, 0)
  comprobar('la contraventana se pone en el muro de tablas con ventana', cv.ok && cv.clave === clave('w', 1, 0, 0, 0), `${cv.motivo || cv.clave}`);
  const fin = acabarObra(m, R, yo, c.id, cv.clave);
  comprobar('cuesta 2 tablas y 2 clavos', fin.ok && antes.tabla - m.materiales.tabla === 2 && antes.clavo - m.materiales.clavo === 2);
  const cv2 = A({ tipo: 'colocar', pieza: 'contraventana', x: 1, z: 2, k: 0, rot: 0, dir: 0 });
  comprobar('y en el de troncos con ventana', cv2.ok && cv2.clave === clave('w', 0, 1, 0, 0), cv2.motivo || cv2.clave);
  comprobar('en obras no se abre', !A({ tipo: 'usar', construccion: c.id, clave: cv2.clave }).ok);
  acabarObra(m, R, yo, c.id, cv2.clave);
  const u1 = A({ tipo: 'usar', construccion: c.id, clave: cv.clave });
  comprobar('se abre con Usar', u1.ok && c.piezas.get(cv.clave).abierta === true && seAbre(c.piezas.get(cv.clave)));
  comprobar('y se cierra', A({ tipo: 'usar', construccion: c.id, clave: cv.clave }).ok && c.piezas.get(cv.clave).abierta === false);
  comprobar('se apoya en su muro', !!c.piezas.get(cv.clave) && m.soportes(c, c.piezas.get(cv.clave)).lista[0] === clave('e', 1, 0, 0, 0));
  const pm = m.previsualizarDesmontaje(c, clave('e', 1, 0, 0, 0));
  comprobar('si se quita el muro, la contraventana cae con él', pm.ok && pm.caen.includes(cv.clave), (pm.caen || []).join(' ') + (pm.motivo || ''));
  // trampilla: en el hueco de arriba de la escalera de tablas
  const sinEsc = m.validar(enRejilla(m, c, 'trampilla', 1, 0, 1));
  comprobar('la trampilla no va donde no hay escalera', !sinEsc.ok, sinEsc.motivo || '');
  comprobar('ni en la planta de la escalera', !m.validar(enRejilla(m, c, 'trampilla', 0, 0, 0)).ok);
  const tr = A({ tipo: 'colocar', pieza: 'trampilla', x: 1, z: 1, k: 1, rot: 0, dir: 0 });
  comprobar('la trampilla se pone en el hueco de la escalera', tr.ok && tr.clave === clave('t', 0, 0, 1), tr.motivo || tr.clave);
  comprobar('mira como su escalera', c.piezas.get(tr.clave).dir === 3);
  comprobar('en obras no tapa el hueco', !trampillaCerrada(c, 0, 0, 0));
  acabarObra(m, R, yo, c.id, tr.clave);
  comprobar('terminada y cerrada tapa el hueco (se pisa y la escalera no sube)', trampillaCerrada(c, 0, 0, 0));
  comprobar('descansa en el suelo de al lado', m.soportes(c, c.piezas.get(tr.clave)).lista.includes(clave('f', 1, 0, 1)));
  const ut = A({ tipo: 'usar', construccion: c.id, clave: tr.clave });
  comprobar('se abre con Usar y deja el hueco libre', ut.ok && ut.abierta === true && !trampillaCerrada(c, 0, 0, 0));
  comprobar('el hueco sigue sin admitir un suelo', !m.validar(enRejilla(m, c, 'suelo_tronco', 0, 0, 1)).ok);
  const pe = m.previsualizarDesmontaje(c, clave('l', 0, 0, 0));
  comprobar('si se quita la escalera, la trampilla cae con ella', pe.ok && pe.caen.includes(tr.clave), (pe.caen || []).join(' '));
  comprobar('cada Usar y cada obra quedan anotados con su autor', R.entradas.filter(e => e.tipo === 'usar' && e.ok).length === 3 && R.entradas.every(e => e.autor === yo));
  // guardar y cargar, y rehacer desde el registro
  const m2 = Mundo.importar(JSON.parse(JSON.stringify(m.exportar())));
  const c2 = m2.construcciones.find(x => x.id === c.id);
  comprobar('se guardan y se cargan (abierta y cerrada)', c2.piezas.get(tr.clave)?.abierta === true && c2.piezas.get(cv.clave)?.abierta === false && c2.piezas.get(clave('e', 1, 0, 0, 0))?.tipo === 'muro_tabla_ventana');
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
