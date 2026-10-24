// Pruebas de la lógica de construcción de Kinhold. Ejecutar: node pruebas/prueba_logica.mjs
// Con MUTAR=1 se altera una capacidad a propósito: las pruebas deben FALLAR.
import { Mundo, clave, localAMundo, mundoALocal, geometriaTejados } from '../src/logica/construccion.js';
import { PIEZAS } from '../src/logica/piezas.js';

if (process.env.MUTAR === '1') {
  PIEZAS.muro_zarzo.cap = 1000;   // un muro de zarzo que aguanta cualquier cosa
  PIEZAS.viga.cap = 5000;         // una viga que nunca se sobrecarga
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
  comprobar('plantas 0, 1 y 2 admitidas', res[0].ok && res[1].ok && res[2].ok, `carga muro bajo=${cs.get(clave('e', 0, 0, 0, 0))}`);
  comprobar('cuarta planta rechazada por carga', !res[3].ok && res[3].motivo === 'La estructura no soporta ese peso.', `carga=${res[3].carga} cap=${res[3].cap}`);
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
  const mu = m.colocar(enRejilla(m, c, 'muro_tronco', 0, 0, 1, 1));
  const cs = m.cargas(c);
  comprobar('suelo sobre dos vigas y muro encima', s.ok && mu.ok, `carga por viga=${cs.get(clave('b', 0, 0, 0, 0))}`);
  const pre = m.previsualizarDesmontaje(c, clave('b', 0, 0, 0, 0));
  comprobar('quitar una viga queda bloqueado (la otra cargaría 420 > 400)', !pre.ok && pre.debil === clave('b', 0, 1, 0, 0));
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

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
