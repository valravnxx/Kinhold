// Pruebas de la lógica de combate de Kinhold. Con MUTAR=1 se rompen reglas a propósito: deben fallar.
import * as tactil from '../src/combate/tactil.js';
import * as direccion from '../src/combate/direccion.js';
import { Luchador, resolverGolpe, crearProyectil, moverProyectil, elevacionPara, IA, azar, T, GUARDIAS, LINEAS, ARMADURAS, ARMAS, TRATAMIENTOS, SANAR } from '../src/combate/logica.js';
import { RegistroAcciones, ejecutarCombate } from '../src/logica/acciones.js';

if (process.env.MUTAR === '1') {
  T.ventanaPerfecta = 99; T.ventanaMaestro = 0; ARMADURAS.malla.corte = 1.0;
  T.tensionMinima = 0; ARMAS.arco.recarga = 0.1; Luchador.prototype.cancelarTensado = function () {}; // arco roto como antes
  Object.defineProperty(Luchador.prototype, 'corriendo', { get() { return false; }, set() {} });
  Luchador.prototype.paraConEscudo = function () { return false; }; T.factorEscudo = 1; // escudo que no sirve
  TRATAMIENTOS.vendar.duracion = 0.1; Luchador.prototype.cortarCura = function () {}; // curar al instante y sin riesgo
  globalThis.__mutarTactil = true;
  // modo direccional roto: no se puede cambiar de lado sin soltar, cargar no da más fuerza y cualquier lado para
  Luchador.prototype.cambiarLinea = function () { return false; }; T.fuerzaMinima = 1;
  direccion.LectorDireccion.prototype.cambio = function () { return null; };   // el ratón no cambia de lado sin soltar
  const cubre = Luchador.prototype.cubre;
  Luchador.prototype.cubre = function (l) { return this.modo === 'direccional' ? this.bloqueando && this.accion === 'libre' : cubre.call(this, l); }; // la cámara táctil se trata como antes: cualquier temblor gira y el arco no la mueve
}

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const r2 = (x) => Math.round(x * 100) / 100;
// dos luchadores frente a frente a una distancia
function pareja(dist = 1.5, opA = {}, opB = {}) {
  const a = new Luchador({ nombre: 'A', x: 0, z: 0, rot: 0, ...opA });
  const b = new Luchador({ nombre: 'B', x: 0, z: dist, rot: Math.PI, ...opB });
  return [a, b];
}
// avanza a hasta su impacto y lo resuelve contra b
function golpeCompleto(a, b, linea, r, antesDelImpacto = null) {
  a.atacar(linea);
  let res = null, t = 0;
  while (!res && t < 3) {
    const ev = a.actualizar(0.01); b.actualizar(0.01); t += 0.01;
    if (antesDelImpacto && a.accion === 'preparando' && a.duracion - a.tAccion <= antesDelImpacto.margen && !antesDelImpacto.hecho) { antesDelImpacto.fn(); antesDelImpacto.hecho = true; }
    for (const e of ev) if (e.tipo === 'impacto') res = resolverGolpe(a, b, e.linea, r);
  }
  return res;
}

console.log('1. Alcance y orientación');
{
  const r = azar(1);
  let [a, b] = pareja(1.5);
  comprobar('a 1,5 m la espada larga alcanza', golpeCompleto(a, b, 'alto', r).resultado === 'herida');
  [a, b] = pareja(2.5);
  comprobar('a 2,5 m no alcanza', golpeCompleto(a, b, 'alto', r).resultado === 'fallo');
  [a, b] = pareja(1.5); a.rot = Math.PI;
  comprobar('de espaldas no alcanza', golpeCompleto(a, b, 'alto', r).resultado === 'fallo');
  [a, b] = pareja(2.05);
  comprobar('la estocada llega más lejos que el tajo', golpeCompleto(a, b, 'estocada', r).resultado === 'herida');
}

console.log('2. Defensa por capas');
{
  const r = azar(2);
  // 1. parada normal: cualquier línea, cansa
  for (const linea of ['alto', 'bajo', 'izquierda']) {
    const [a, b] = pareja(1.5);
    b.bloquear(true); b.tBloqueo = 1;
    const c0 = b.cansancio;
    const res = golpeCompleto(a, b, linea, r);
    comprobar(`parar sin elegir línea detiene un golpe ${linea}`, res.resultado === 'parada' && b.cansancio > c0, `cansancio +${r2(b.cansancio - c0)}`);
  }
  // 2. parada perfecta
  {
    const [a, b] = pareja(1.5);
    const res = golpeCompleto(a, b, 'derecha', r, { margen: 0.15, fn: () => b.bloquear(true) });
    comprobar('parar justo antes del impacto es parada perfecta', res.resultado === 'parada perfecta' && a.accion === 'aturdido', res.resultado);
    comprobar('y abre un contraataque', b.puedeContraatacar());
    const prepContra = b.duracionPreparacion('alto'), prepNormal = new Luchador().duracionPreparacion('alto');
    comprobar('el contraataque se prepara más rápido', prepContra < prepNormal * 0.7, `${r2(prepContra)} s frente a ${r2(prepNormal)} s`);
    b.bloquear(false); b.atacar('alto');
    comprobar('y es imparable', b.imparable);
    a.accion = 'libre'; a.bloquear(true); a.tBloqueo = 1;
    let res2 = null, t = 0;
    while (!res2 && t < 2) { for (const e of b.actualizar(0.01)) if (e.tipo === 'impacto') res2 = resolverGolpe(b, a, e.linea, r); a.actualizar(0.01); t += 0.01; }
    comprobar('una parada normal no detiene el contraataque', res2.resultado === 'herida' && res2.nota === 'imparable', JSON.stringify({ r: res2.resultado, nota: res2.nota }));
  }
  {
    const [a, b] = pareja(1.5);
    const res = golpeCompleto(a, b, 'derecha', r, { margen: 0.4, fn: () => b.bloquear(true) });
    comprobar('parar con mucha antelación es parada normal', res.resultado === 'parada', res.resultado);
  }
  // 3. golpe maestro
  const maestro = (lineaA, lineaB, fraccion) => {
    const [a, b] = pareja(1.5);
    a.atacar(lineaA);
    let res = null, resB = null, t = 0, lanzado = false;
    while (t < 3 && !(res && resB)) {
      if (!lanzado && a.accion === 'preparando' && a.progreso() >= fraccion) { b.atacar(lineaB); lanzado = true; }
      for (const e of a.actualizar(0.01)) if (e.tipo === 'impacto') res = resolverGolpe(a, b, e.linea, azar(5));
      for (const e of b.actualizar(0.01)) if (e.tipo === 'impacto') resB = resolverGolpe(b, a, e.linea, azar(6));
      t += 0.01;
    }
    return { res, resB, a, b };
  };
  {
    const { res, resB } = maestro('izquierda', 'derecha', 0.2);
    comprobar('atacar por el mismo lado al principio es golpe maestro', res && res.resultado === 'golpe maestro', res && res.resultado);
    comprobar('y el golpe maestro entra', resB && resB.resultado === 'herida', resB && resB.resultado);
  }
  {
    const { res } = maestro('izquierda', 'izquierda', 0.2);
    comprobar('por el lado contrario no es golpe maestro', res && res.resultado !== 'golpe maestro', res && res.resultado);
  }
  {
    const { res } = maestro('alto', 'alto', 0.7);
    comprobar('demasiado tarde no es golpe maestro', res && res.resultado !== 'golpe maestro', res && res.resultado);
  }
  // finta
  {
    const a = new Luchador(); a.atacar('alto');
    for (let k = 0; k < 10; k++) a.actualizar(0.01);
    const c0 = a.cansancio;
    comprobar('cambiar de línea al principio es una finta', a.atacar('bajo') && a.linea === 'bajo' && a.cansancio > c0, `cansancio +${r2(a.cansancio - c0)}`);
    for (let k = 0; k < 30; k++) a.actualizar(0.01);
    comprobar('pasado el 60% ya no se puede fintar', !a.atacar('alto') && a.linea === 'bajo');
  }
  // guardia rota, fallos y parada mantenida
  {
    const [a, b] = pareja(1.5);
    b.bloquear(true); b.tBloqueo = 1; b.cansancio = 97;
    const res = golpeCompleto(a, b, 'alto', r);
    comprobar('agotado, la parada cede', res.resultado === 'herida' && res.nota === 'guardia rota', JSON.stringify({ r: res.resultado, nota: res.nota }));
  }
  {
    const [a, b] = pareja(3);
    const c0 = a.cansancio; golpeCompleto(a, b, 'alto', r);
    comprobar('un golpe al aire cansa más', a.cansancio - c0 > a.def.cansancio, `+${r2(a.cansancio - c0)}`);
    const L = new Luchador(); L.bloquear(true);
    for (let k = 0; k < 500; k++) L.actualizar(0.01);
    comprobar('mantener la parada 5 s cansa', L.cansancio >= 9, `${r2(L.cansancio)}%`);
  }
}

console.log('3. Guardias y tiempo');
{
  const r = azar(3);
  let [a, b] = pareja(1.5, { modo: 'guardias' }, { modo: 'guardias' });
  b.guardia = 'pflug';
  comprobar('el arado cubre la estocada', golpeCompleto(a, b, 'estocada', r).resultado === 'parada');
  comprobar('y abre una ventana de contraataque', b.reloj <= b.contraHasta);
  const prepNormal = (() => { const x = new Luchador({ modo: 'guardias' }); x.guardia = 'pflug'; return x.duracionPreparacion('estocada'); })();
  comprobar('el contraataque se prepara en la mitad de tiempo', Math.abs(b.duracionPreparacion('estocada') - prepNormal * T.factorGuardia) < 1e-9, `${r2(b.duracionPreparacion('estocada'))} s frente a ${r2(prepNormal)} s`);
  [a, b] = pareja(1.5, { modo: 'guardias' }, { modo: 'guardias' });
  b.guardia = 'pflug';
  comprobar('el arado deja abierto el alto', golpeCompleto(a, b, 'alto', r).resultado === 'herida');
  [a, b] = pareja(1.5, { modo: 'guardias' }, { modo: 'guardias' });
  b.guardia = 'vom_tag'; b.cambiarGuardia('pflug');
  comprobar('mientras cambia de guardia no cubre nada', !b.cubre('estocada') && !b.cubre('bajo'));
  const x = new Luchador({ modo: 'guardias' }); x.guardia = 'ochs';
  comprobar('desde el buey la estocada es rápida y el bajo lento', x.duracionPreparacion('estocada') < x.duracionPreparacion('bajo'),
    `${r2(x.duracionPreparacion('estocada'))} s / ${r2(x.duracionPreparacion('bajo'))} s`);
  const todas = new Set(Object.values(GUARDIAS).flatMap(g => g.cubre));
  comprobar('entre las cuatro guardias se cubren las cinco líneas', LINEAS.every(l => todas.has(l)));
}

console.log('4. Armaduras');
{
  const media = (armadura, linea) => {
    let s = 0;
    for (let n = 0; n < 400; n++) { const [a, b] = pareja(1.5, {}, { armadura }); s += golpeCompleto(a, b, linea, azar(100 + n)).sev; }
    return s / 400;
  };
  const lino = media('lino', 'derecha'), gamb = media('gambeson', 'derecha'), malla = media('malla', 'derecha');
  comprobar('contra el tajo: malla < gambesón < lino', malla < gamb && gamb < lino, `lino ${r2(lino)} · gambesón ${r2(gamb)} · malla ${r2(malla)}`);
  const mallaEst = media('malla', 'estocada');
  comprobar('la malla para peor la estocada que el tajo', mallaEst > malla, `estocada ${r2(mallaEst)} vs tajo ${r2(malla)}`);
}

console.log('5. Heridas y sus efectos');
{
  const a = new Luchador();
  const v0 = a.velocidad();
  a.recibirHerida('piernaD', 0.6, 'corte');
  comprobar('una pierna herida grave te frena', a.velocidad() < v0 * 0.7, `${r2(v0)} → ${r2(a.velocidad())} m/s`);
  const b = new Luchador();
  const p0 = b.duracionPreparacion('alto');
  b.recibirHerida('brazoD', 0.6, 'corte');
  comprobar('un brazo de la espada herido hace los golpes más lentos', b.duracionPreparacion('alto') > p0 * 1.3, `${r2(p0)} → ${r2(b.duracionPreparacion('alto'))} s`);
  const c = new Luchador();
  c.recibirHerida('cabeza', 0.9, 'corte');
  comprobar('herida muy grave en la cabeza: fuera de combate', c.fuera);
  const d = new Luchador();
  d.recibirHerida('torso', 0.9, 'corte');
  let t = 0; while (!d.fuera && t < 120) { d.actualizar(0.1); t += 0.1; }
  comprobar('una herida muy grave en el torso desangra en segundos', d.fuera && t < 25, `cae a los ${r2(t)} s`);
  const e = new Luchador();
  e.recibirHerida('brazoI', 0.2, 'corte');
  t = 0; while (t < 120) { e.actualizar(0.1); t += 0.1; }
  comprobar('un corte leve deja de sangrar y no te mata', !e.fuera && e.sangre > 60, `sangre ${r2(e.sangre)} tras 2 min`);
  const f = new Luchador();
  f.recibirHerida('torso', 0.5, 'contundente');
  comprobar('un golpe contundente fuerte aturde', f.accion === 'aturdido');
  const g = new Luchador(); g.atacar('alto'); g.recibirHerida('brazoI', 0.5, 'corte');
  comprobar('una herida grave interrumpe el golpe que preparabas', g.accion === 'aturdido');
}

console.log('6. Balística');
{
  const tirador = (d) => { const L = new Luchador({ arma: 'arco', x: 0, z: 0 }); return L; };
  for (const d of [10, 20, 35, 50]) {
    let suma = 0, n = 0;
    for (let s = 0; s < 40; s++) {
      const L = tirador(); const p = crearProyectil(L, { x: 0, z: d }, { tension: 1, tTenso: 0.5 }, azar(s + 1));
      let res = null; while (!res) res = moverProyectil(p, 0.01, []);
      suma += Math.hypot(p.x, p.z - d); n++;
    }
    comprobar(`a plena tensión cae cerca del punto a ${d} m`, suma / n < Math.max(0.6, d * 0.03), `error medio ${r2(suma / n)} m`);
  }
  {
    const L = tirador(); const p = crearProyectil(L, { x: 0, z: 30 }, { tension: 0.5, tTenso: 0 }, azar(3));
    let res = null; while (!res) res = moverProyectil(p, 0.01, []);
    comprobar('a media tensión se queda corta', p.z < 20, `cae a ${r2(p.z)} m de 30`);
  }
  const dispersion = (tTenso) => {
    let s = 0;
    for (let k = 0; k < 60; k++) { const L = tirador(); const p = crearProyectil(L, { x: 0, z: 30 }, { tension: 1, tTenso }, azar(k + 50)); let res = null; while (!res) res = moverProyectil(p, 0.01, []); s += Math.hypot(p.x, p.z - 30); }
    return s / 60;
  };
  const d1 = dispersion(0.5), d2 = dispersion(5);
  comprobar('aguantar tenso 5 s hace temblar el pulso', d2 > d1 * 2, `${r2(d1)} m → ${r2(d2)} m`);
  comprobar('el arco no llega a 400 m (máximo realista unos 300 m)', elevacionPara(400, 55) === null && elevacionPara(250, 55) !== null);
}

console.log('6b. Arco: tensión mínima, correr y recarga');
{
  const tensar = (L, s, corriendo = false) => { for (let t = 0; t < s - 1e-9; t += 0.01) L.actualizar(0.01, corriendo); };
  let A = new Luchador({ arma: 'arco' });
  A.empezarTensar(); tensar(A, 0.3);
  const flojo = A.soltar();
  comprobar('soltar antes del 50% de tensión no dispara y cancela', flojo === null && A.accion === 'libre' && A.cancelado === 'flojo', `tensión ${r2(A.tension)}, acción ${A.accion}`);
  A = new Luchador({ arma: 'arco' });
  A.empezarTensar(); tensar(A, 0.6);
  comprobar('soltar a partir del 50% sí dispara', A.soltar() !== null);
  A = new Luchador({ arma: 'arco' });
  A.empezarTensar(); tensar(A, 0.5); tensar(A, 0.05, true);
  comprobar('correr cancela el tensado', A.accion !== 'tensando' && A.cancelado === 'correr', A.accion);
  A = new Luchador({ arma: 'arco' });
  A.actualizar(0.01, true);
  comprobar('no se puede empezar a tensar corriendo', A.empezarTensar() === false && A.accion !== 'tensando');
  // cadencia: disparando todo lo rápido que se deja durante 10 s
  const cadencia = (arma) => {
    const L = new Luchador({ arma }); let n = 0;
    for (let t = 0; t < 10; t += 0.01) {
      if (L.accion === 'libre') L.empezarTensar();
      if (L.accion === 'tensando' && L.tension >= T.tensionMinima && L.soltar()) n++;
      L.actualizar(0.01); L.cansancio = 0;
    }
    return n;
  };
  const nA = cadencia('arco'), nP = cadencia('piedras');
  // arco: 0,5 s de tensado mínimo + 0,8 s de recarga ≈ 1,3 s por flecha → 7 u 8 en 10 s
  comprobar('el arco no dispara más de una flecha cada 1,3 s', nA <= 8, `${nA} flechas en 10 s`);
  comprobar('las piedras: una cada 0,75 s como mucho', nP <= 14, `${nP} piedras en 10 s`);
  A = new Luchador({ arma: 'arco' }); A.empezarTensar(); tensar(A, 1); A.soltar();
  tensar(A, 0.7); const aun = A.empezarTensar();
  tensar(A, 0.15); const ya = A.empezarTensar();
  comprobar('tras disparar, 0,8 s para encajar la siguiente flecha', !aun && ya, `a 0,7 s: ${aun}, a 0,85 s: ${ya}`);
}

console.log('6c. Escudo (provisional)');
{
  // tira 40 flechas (o piedras) a 15 m contra B y cuenta qué pasa
  const tiros = (arma, prepararB) => {
    const cuenta = { escudo: 0, blanco: 0, otro: 0 };
    for (let s = 0; s < 40; s++) {
      const A = new Luchador({ arma, x: 0, z: 0 });
      const B = new Luchador({ arma: 'espada_escudo', x: 0, z: arma === 'piedras' ? 10 : 15, rot: Math.PI });
      prepararB(B);
      const p = crearProyectil(A, { x: 0, y: 1.3, z: B.z }, { tension: 1, tTenso: 0.3 }, azar(s + 31));
      let res = null; while (!res) res = moverProyectil(p, 0.01, [A, B], azar(s));
      cuenta[res.tipo in cuenta ? res.tipo : 'otro']++;
    }
    return cuenta;
  };
  let c = tiros('arco', B => B.bloquear(true));
  comprobar('con el escudo levantado, las flechas de frente se paran', c.escudo >= 30 && c.blanco === 0, JSON.stringify(c));
  c = tiros('piedras', B => B.bloquear(true));
  comprobar('y las piedras también', c.escudo >= 30 && c.blanco === 0, JSON.stringify(c));
  c = tiros('arco', () => {});
  comprobar('con el escudo bajado, las flechas hieren', c.escudo === 0 && c.blanco >= 30, JSON.stringify(c));
  c = tiros('arco', B => { B.rot = 0; B.bloquear(true); });
  comprobar('por la espalda el escudo no para', c.escudo === 0 && c.blanco >= 30, JSON.stringify(c));
  c = tiros('arco', B => { B.arma = 'espada_larga'; B.bloquear(true); });
  comprobar('con la espada larga no se paran flechas', c.escudo === 0 && c.blanco >= 30, JSON.stringify(c));
  // aliento de una parada normal con espada larga y con escudo
  const costeParada = (arma) => {
    const [a, b] = pareja(1.5, {}, { arma });
    b.bloquear(true); b.tBloqueo = 1;
    const c0 = b.cansancio;
    const res = golpeCompleto(a, b, 'alto', azar(3));
    return { res: res.resultado, coste: b.cansancio - c0 };
  };
  const larga = costeParada('espada_larga'), escudo = costeParada('espada_escudo');
  comprobar('parar con escudo cuesta menos aliento', escudo.res === 'parada' && larga.res === 'parada' && escudo.coste < larga.coste * 0.75, `escudo +${r2(escudo.coste)}, espada larga +${r2(larga.coste)}`);
  {
    const [a, b] = pareja(1.5, {}, { arma: 'espada_escudo' });
    const res = golpeCompleto(a, b, 'bajo', azar(4), { margen: 0.15, fn: () => b.bloquear(true) });
    comprobar('con escudo la parada perfecta funciona igual', res.resultado === 'parada perfecta' && b.puedeContraatacar(), res.resultado);
  }
  {
    const [a, b] = pareja(1.5, {}, { arma: 'espada_escudo' });
    a.atacar('izquierda');
    let res = null, t = 0, lanzado = false;
    while (t < 2 && !res) {
      if (!lanzado && a.progreso() >= 0.2) { b.atacar('derecha'); lanzado = true; }
      for (const e of a.actualizar(0.01)) if (e.tipo === 'impacto') res = resolverGolpe(a, b, e.linea, azar(5));
      b.actualizar(0.01); t += 0.01;
    }
    comprobar('con escudo el golpe maestro funciona igual', res && res.resultado === 'golpe maestro', res && res.resultado);
  }
  {
    const [a] = pareja(1.5, {}, {}); const e = new Luchador({ arma: 'espada_escudo' });
    comprobar('la espada de una mano es algo más corta que la larga', e.def.alcance < a.def.alcance && e.def.alcance >= 1.5, `${e.def.alcance} m frente a ${a.def.alcance} m`);
  }
  // el rival de la máquina con escudo lo levanta cuando le apuntan y para la flecha
  {
    let parados = 0;
    for (let s = 0; s < 10; s++) {
      const A = new Luchador({ arma: 'arco', x: 0, z: 0 });
      const B = new Luchador({ arma: 'espada_escudo', x: 0, z: 15, rot: Math.PI });
      const ia = new IA(B, 'aprendiz', azar(s + 3));
      A.empezarTensar();
      for (let t = 0; t < 1.2; t += 0.02) { A.actualizar(0.02); ia.pensar(0.02, A); B.actualizar(0.02); }
      const tiro = A.soltar();
      const p = crearProyectil(A, { x: B.x, y: 1.3, z: B.z }, tiro, azar(s + 70));
      let res = null;
      while (!res) { res = moverProyectil(p, 0.01, [A, B], azar(s)); A.actualizar(0.01); ia.pensar(0.01, A); B.actualizar(0.01); }
      if (res.tipo === 'escudo') parados++;
    }
    comprobar('el rival con escudo lo levanta al verte tensar y para la flecha', parados >= 9, `${parados}/10`);
  }
}

console.log('7. Flechas contra personas y dianas');
{
  let blancos = 0, zonas = {};
  for (let s = 0; s < 40; s++) {
    const A = new Luchador({ arma: 'arco', x: 0, z: 0 });
    const B = new Luchador({ x: 0, z: 15, rot: Math.PI });
    const p = crearProyectil(A, { x: 0, y: 1.3, z: 15 }, { tension: 1, tTenso: 0.3 }, azar(s + 9)); // apuntando al pecho
    let res = null; while (!res) res = moverProyectil(p, 0.01, [A, B], azar(s));
    if (res.tipo === 'blanco') { blancos++; zonas[res.zona] = (zonas[res.zona] || 0) + 1; }
  }
  comprobar('a 15 m, apuntando al pecho, casi todas aciertan', blancos >= 30, `${blancos}/40 ${JSON.stringify(zonas)}`);
  comprobar('y la mayoría da en torso o brazos', ((zonas.torso || 0) + (zonas.brazoI || 0) + (zonas.brazoD || 0)) >= blancos * 0.6);
  const D = { x: 0, y: 1.3, z: 20, nx: 0, nz: -1, radio: 0.6 };
  const A = new Luchador({ arma: 'arco', x: 0, z: 0 });
  const p = crearProyectil(A, { x: 0, y: 1.3, z: 20 }, { tension: 1, tTenso: 0.3 }, azar(4));
  let res = null; while (!res) res = moverProyectil(p, 0.01, [], azar(1), [D]);
  comprobar('la diana puntúa', res.tipo === 'diana' && res.puntos >= 2, JSON.stringify({ tipo: res.tipo, puntos: res.puntos }));
}

console.log('8. El rival lee los ataques según la dificultad');
{
  const lee = (dif) => {
    let paradas = 0;
    for (let s = 0; s < 300; s++) {
      const [a, b] = pareja(1.5);
      const ia = new IA(b, dif, azar(s + 1000));
      ia.esperaAtaque = 99;
      a.atacar(LINEAS[s % 5]);
      let res = null, t = 0;
      while (!res && t < 2) {
        ia.pensar(0.01, a);
        const ev = a.actualizar(0.01); b.actualizar(0.01); t += 0.01;
        for (const e of ev) if (e.tipo === 'impacto') res = resolverGolpe(a, b, e.linea, azar(s));
      }
      if (res.resultado.startsWith('parada') || res.resultado === 'golpe maestro') paradas++;
    }
    return paradas / 300;
  };
  const f = lee('aprendiz'), n = lee('normal'), d = lee('realista');
  comprobar('aprendiz detiene menos que normal y normal menos que realista', f < n && n < d, `aprendiz ${Math.round(f * 100)}% · normal ${Math.round(n * 100)}% · realista ${Math.round(d * 100)}%`);
}

console.log('8b. El rival no se aleja durante su propio golpe');
{
  let fallos = 0, golpes = 0;
  for (let s = 0; s < 60; s++) {
    const [a, b] = pareja(1.6);
    const ia = new IA(b, 'normal', azar(s + 3000));
    ia.esperaAtaque = 0;
    let t = 0;
    while (t < 4) {
      const m = ia.pensar(0.02, a);
      const v = b.velocidad();
      b.x += m.mx * v * 0.02; b.z += m.mz * v * 0.02;
      for (const e of b.actualizar(0.02)) if (e.tipo === 'impacto') { golpes++; if (resolverGolpe(b, a, e.linea, azar(s)).resultado === 'fallo') fallos++; }
      a.actualizar(0.02); a.heridas = []; a.sangre = 100; a.fuera = false; a.accion = 'libre';
      t += 0.02;
    }
  }
  comprobar('contra alguien quieto a su alcance, ningún golpe al aire', golpes > 60 && fallos === 0, `${golpes} golpes, ${fallos} al aire`);
}

console.log('9. Combates completos simulados (máquina contra máquina)');
for (const modo of ['capas', 'guardias']) {
  let fin = 0, tiempos = [];
  for (let s = 0; s < 20; s++) {
    const [a, b] = pareja(3, { modo }, { modo, arma: modo === 'capas' && s % 2 ? 'espada_escudo' : 'espada_larga' });
    const ia1 = new IA(a, 'normal', azar(s + 1)), ia2 = new IA(b, 'normal', azar(s + 500));
    const r = azar(s + 77);
    let t = 0;
    while (!a.fuera && !b.fuera && t < 300) {
      for (const [L, ia, rv] of [[a, ia1, b], [b, ia2, a]]) {
        const m = ia.pensar(0.02, rv);
        const v = L.velocidad();
        L.x += m.mx * v * 0.02; L.z += m.mz * v * 0.02;
        for (const e of L.actualizar(0.02)) if (e.tipo === 'impacto') resolverGolpe(L, rv, e.linea, r);
      }
      t += 0.02;
    }
    if (a.fuera || b.fuera) { fin++; tiempos.push(t); }
  }
  tiempos.sort((x, y) => x - y);
  comprobar(`modo ${modo}: los combates terminan`, fin >= 18, `${fin}/20 · mediana ${r2(tiempos[Math.floor(tiempos.length / 2)])} s · rango ${r2(tiempos[0])}–${r2(tiempos[tiempos.length - 1])} s`);
}

console.log('10. Cámara táctil (un dedo)');
{
  const mut = !!globalThis.__mutarTactil;
  const arrastrar = (q, x, y) => mut ? -(x - q.x) * tactil.GIRO_POR_PX + (q.x = x, q.y = y, 0) : tactil.arrastrarLibre(q, x, y);
  const seguir = (x, w, dt) => mut ? 0 : tactil.seguirApuntado(x, w, dt);
  const rosa = { x: 200, y: 300, r: 80 };
  comprobar('un dedo sobre la rosa golpea', tactil.tipoToque({ distancia: false, rosaVisible: true, x: 210, y: 290, rosa }) === 'rosa');
  comprobar('un dedo lejos de la rosa es zona libre', tactil.tipoToque({ distancia: false, rosaVisible: true, x: 200, y: 700, rosa }) === 'libre');
  comprobar('sin rosa, todo es zona libre', tactil.tipoToque({ distancia: false, rosaVisible: false, x: 210, y: 290, rosa }) === 'libre');
  comprobar('con arco, el dedo tensa y apunta', tactil.tipoToque({ distancia: true, rosaVisible: false, x: 10, y: 10, rosa }) === 'arco');
  const q = { x: 100, y: 500, x0: 100, y0: 500, arrastre: false };
  const g1 = arrastrar(q, 104, 503);
  comprobar('un toque con temblor (5 px) no gira la cámara', g1 === 0, `giro ${g1}`);
  const g2 = arrastrar(q, 160, 503);
  comprobar('arrastrar 60 px a la derecha gira lo arrastrado desde el inicio', Math.abs(g2 + 60 * tactil.GIRO_POR_PX) < 1e-9 && q.arrastre === true, `giro ${r2(g2)}`);
  const g3 = arrastrar(q, 140, 503);
  comprobar('volver 20 px a la izquierda gira al otro lado', Math.abs(g3 - 20 * tactil.GIRO_POR_PX) < 1e-9);
  comprobar('arco con el dedo en el centro: la cámara no se mueve', seguir(195, 390, 0.1) === 0);
  comprobar('arco con el dedo junto al borde derecho: gira a la derecha (yaw menor)', seguir(385, 390, 0.1) < 0);
  comprobar('arco con el dedo junto al borde izquierdo: gira a la izquierda', seguir(5, 390, 0.1) > 0);
  comprobar('arco: más cerca del borde gira más deprisa, con tope', seguir(390, 390, 1) <= -tactil.GIRO_ARCO_MAX + 1e-9 && Math.abs(seguir(330, 390, 1)) < Math.abs(seguir(380, 390, 1)));
}

console.log('11. Curación de heridas');
{
  const avanzar = (L, s, corre = false) => { const ev = []; for (let t = 0; t < s; t += 0.05) ev.push(...L.actualizar(0.05, corre)); return ev; };
  // vendar un corte grave: tarda, gasta una venda y baja el sangrado
  let L = new Luchador();
  L.recibirHerida('torso', 0.5, 'corte');
  const antes = L.heridas[0].sangrado, vendas = L.botiquin.vendas;
  comprobar('vendar empieza la cura', L.curar(0, 'vendar') && L.accion === 'curando');
  comprobar('mientras curas no atacas ni paras', !L.atacar('alto') && (L.bloquear(true), !L.bloqueando));
  comprobar('mientras curas apenas te mueves (vendido)', L.velocidad() < 1.2, `v=${r2(L.velocidad())}`);
  avanzar(L, 2);
  comprobar('vendar no es instantáneo (a los 2 s aún curando)', L.accion === 'curando' && L.heridas[0].sangrado === antes);
  const ev = avanzar(L, 2.5);
  comprobar('a los 4 s la herida está vendada y sangra menos', L.heridas[0].vendada && L.heridas[0].sangrado < antes * 0.5 && ev.some(e => e.tipo === 'curado' && e.metodo === 'vendar'), `${r2(antes)}→${r2(L.heridas[0].sangrado)}`);
  comprobar('gasta una venda', L.botiquin.vendas === vendas - 1);
  comprobar('no se venda dos veces', !L.curar(0, 'vendar'));
  // coser un corte profundo: deja de sangrar
  comprobar('coser un corte grave', L.curar(0, 'coser'));
  avanzar(L, 13);
  comprobar('cosida: ya no sangra', L.heridas[0].cosida && L.heridas[0].sangrado === 0);
  // te hieren mientras curas: la cura se pierde y no gasta
  L = new Luchador(); L.recibirHerida('brazoI', 0.5, 'corte');
  L.curar(0, 'vendar'); avanzar(L, 1); L.recibirHerida('piernaD', 0.2, 'corte');
  comprobar('si te hieren mientras curas, la cura se pierde sin gastar', L.accion !== 'curando' && !L.heridas[0].vendada && L.botiquin.vendas === 3 && L.cancelado === 'herido');
  L.cancelado = null; L.curar(0, 'vendar'); avanzar(L, 0.5, true);
  comprobar('echar a correr corta la cura', L.accion === 'libre' && L.cancelado === 'dejaCura');
  // cada herida con lo suyo
  L = new Luchador(); L.recibirHerida('piernaI', 0.6, 'contundente'); L.recibirHerida('cabeza', 0.2, 'corte');
  comprobar('no se cose un golpe contundente', !L.curar(0, 'coser') && L.motivoNoCurar(0, 'coser') === 'Solo para cortes profundos.');
  comprobar('no se entablilla un corte', !!L.motivoNoCurar(1, 'entablillar'));
  const lento = L.factorPiernas();
  avanzar(L, 1);   // el golpe contundente descoloca un momento
  comprobar('entablillar empieza', L.curar(0, 'entablillar')); avanzar(L, 8.5);
  comprobar('entablillar una pierna rota: te mueves mejor', L.heridas[0].entablillada && L.factorPiernas() > lento, `${lento}→${L.factorPiernas()}`);
  comprobar('cauterizar necesita un fuego cerca', !!L.motivoNoCurar(0, 'cauterizar') && (L.recibirHerida('torso', 0.9, 'corte'), L.motivoNoCurar(2, 'cauterizar') === 'Hace falta un fuego cerca para calentar el hierro.'));
  L.cercaFuego = true; L.curar(2, 'cauterizar'); avanzar(L, 3.5);
  comprobar('cauterizar para el sangrado y deja secuela', L.heridas[2].sangrado === 0 && L.heridas[2].secuela);
  // sin material no hay cura
  L = new Luchador(); L.recibirHerida('torso', 0.5, 'corte'); L.botiquin.vendas = 0;
  comprobar('sin vendas no se venda', L.motivoNoCurar(0, 'vendar') === 'No te quedan.');
  comprobar('método o herida que no existen: no', !L.curar(5, 'vendar') && !L.curar(0, 'constructor') && !L.curar('0', 'coser'));
  // con el brazo de la espada herido se cura más despacio
  const sano = new Luchador(), manco = new Luchador();
  sano.recibirHerida('torso', 0.5, 'corte'); manco.recibirHerida('torso', 0.5, 'corte'); manco.recibirHerida('brazoD', 0.8, 'contundente'); manco.accion = 'libre';
  sano.curar(0, 'vendar'); manco.curar(0, 'vendar');
  comprobar('con el brazo herido se tarda más', manco.duracion > sano.duracion * 1.5, `${r2(sano.duracion)} s y ${r2(manco.duracion)} s`);
  // descanso: una herida que no sangra baja de grado con el tiempo; con emplasto, antes
  const a = new Luchador(), b = new Luchador();
  for (const x of [a, b]) { x.recibirHerida('torso', 0.5, 'corte'); x.heridas[0].sangrado = 0; x.sangre = 80; }
  b.curar(0, 'hierbas'); avanzar(b, 5.5); avanzar(a, 5.5);
  avanzar(a, SANAR.grave * 0.7); avanzar(b, SANAR.grave * 0.7);
  comprobar('descansando, con emplasto la herida grave pasa antes a leve', a.heridas[0].gravedad === 'grave' && b.heridas[0].gravedad === 'leve');
  comprobar('si nada sangra, la sangre se recupera despacio', a.sangre > 80 && a.sangre <= 100, `${r2(a.sangre)}%`);
  avanzar(b, SANAR.leve / 1.5 + 2);
  comprobar('la herida leve acaba curándose del todo', b.heridas.length === 0);
  const c = new Luchador(); c.recibirHerida('torso', 0.8, 'corte'); const s0 = c.heridas[0].gravedad; avanzar(c, 60);
  comprobar('una herida que sangra no sana sola', c.heridas[0].gravedad === s0 && c.sangre < 100);
  // pasa por las acciones con autor y queda en el registro
  const reg = new RegistroAcciones(), ctx = { luchadores: { yo: new Luchador() }, r: azar(3) };
  ctx.luchadores.yo.recibirHerida('brazoI', 0.5, 'corte');
  const r1 = ejecutarCombate(ctx, reg, { autor: 'yo', tipo: 'curar', herida: 0, metodo: 'vendar' });
  const r3 = ejecutarCombate(ctx, reg, { autor: 'nadie', tipo: 'curar', herida: 0, metodo: 'vendar' });
  comprobar('curarse es una acción con autor y queda en el registro', r1.ok && !r3.ok && reg.entradas.some(e => e.tipo === 'curar' && e.autor === 'yo' && e.ok));
}

console.log('12. Modo direccional: golpe cargado, cambio de lado sin soltar y paradas por lado');
{
  const D = { modo: 'direccional' };
  const prep = ARMAS.espada_larga.prep;
  // carga a mano: mantener el botón t segundos y soltar; devuelve [resultado, segundos desde que se empezó hasta el impacto]
  function cargarYSoltar(a, b, linea, mantener, r, alSoltar = null) {
    a.cargar(linea);
    let t = 0, res = null, soltado = false;
    while (!res && t < 5) {
      if (!soltado && t >= mantener) { a.descargar(); soltado = true; if (alSoltar) alSoltar(); }
      const ev = a.actualizar(0.005); b.actualizar(0.005); t += 0.005;
      for (const e of ev) if (e.tipo === 'impacto') res = resolverGolpe(a, b, e.linea, r);
    }
    return [res, t];
  }
  {
    const [a, b] = pareja(1.5, D, D);
    const [res, t] = cargarYSoltar(a, b, 'alto', 0.02, azar(3));
    comprobar('soltar enseguida: el golpe sale al llegar a la carga mínima, más rápido que cargado', Math.abs(t - (prep * T.cargaMinima + T.vuelo)) < 0.03 && res.resultado === 'herida', `${r2(t)} s`);
    comprobar('soltar enseguida: con la fuerza mínima', Math.abs(a.calidad - T.fuerzaMinima) < 0.01, `fuerza ${r2(a.calidad)}`);
  }
  {
    const [a, b] = pareja(1.5, D, D);
    const [res, t] = cargarYSoltar(a, b, 'alto', prep + 0.1, azar(3));
    comprobar('cargado del todo: el golpe sale al soltar, con toda la fuerza', Math.abs(t - (prep + 0.1 + T.vuelo)) < 0.03 && Math.abs(a.calidad - 1) < 0.01 && res.resultado === 'herida', `${r2(t)} s, fuerza ${r2(a.calidad)}`);
  }
  {
    const [a, b] = pareja(1.5, D, D);
    a.cargar('alto'); let impacto = false; const c0 = a.cansancio;
    for (let i = 0; i < 300; i++) for (const e of a.actualizar(0.01)) if (e.tipo === 'impacto') impacto = true;
    comprobar('mientras se mantiene el botón no sale el golpe, y mantenerlo cargado cansa', !impacto && a.accion === 'preparando' && a.cansancio > c0 + 5 && a.hastaImpacto() === Infinity, `cansancio ${r2(c0)} → ${r2(a.cansancio)}`);
  }
  {
    // varios golpes con la misma semilla: cargado hiere más que rápido
    let rapido = 0, cargado = 0;
    for (let s = 0; s < 40; s++) {
      let [a, b] = pareja(1.5, D, D); rapido += cargarYSoltar(a, b, 'estocada', 0, azar(100 + s))[0].sev || 0;
      [a, b] = pareja(1.5, D, D); cargado += cargarYSoltar(a, b, 'estocada', prep + 0.05, azar(100 + s))[0].sev || 0;
    }
    comprobar('un golpe cargado hiere más que uno soltado enseguida', cargado > rapido * 1.15, `${r2(cargado / 40)} contra ${r2(rapido / 40)}`);
  }
  {
    const [a, b] = pareja(1.5, D, D);
    a.cargar('alto'); for (let i = 0; i < 30; i++) a.actualizar(0.01);
    const c0 = a.cansancio, carga0 = a.carga();
    const cambia = a.cambiarLinea('izquierda');
    comprobar('a mitad de la carga se cambia de lado sin soltar (es una finta: cuesta aliento y la carga baja)', cambia && a.linea === 'izquierda' && a.finta && a.carga() <= 0.36 && a.cansancio > c0, `carga ${r2(carga0)} → ${r2(a.carga())}`);
    a.descargar(); let linea = null;
    for (let i = 0; i < 100 && !linea; i++) for (const e of a.actualizar(0.01)) if (e.tipo === 'impacto') linea = e.linea;
    comprobar('el golpe sale por el lado nuevo', linea === 'izquierda');
    const [c] = pareja(1.5, D, D); c.cargar('alto'); c.descargar(); for (let i = 0; i < 30; i++) c.actualizar(0.01);
    comprobar('ya soltado, no se cambia de lado', !c.cambiarLinea('bajo') && c.linea === 'alto');
  }
  {
    // paradas por lado: el lado por el que viene el golpe, visto por quien para (ESPEJO)
    let [a, b] = pareja(1.5, D, D);
    b.bloquear(true, 'derecha'); for (let i = 0; i < 60; i++) b.actualizar(0.01);   // lleva rato parando (no es perfecta)
    let [res] = cargarYSoltar(a, b, 'izquierda', 0, azar(4));
    comprobar('parar por el lado bueno detiene el golpe', res.resultado === 'parada', res.resultado);
    [a, b] = pareja(1.5, D, D);
    b.bloquear(true, 'alto'); for (let i = 0; i < 60; i++) b.actualizar(0.01);
    [res] = cargarYSoltar(a, b, 'izquierda', 0, azar(4));
    comprobar('parar por otro lado no sirve', res.resultado === 'herida', res.resultado);
    [a, b] = pareja(1.5, D, D);
    b.bloquear(true, 'estocada'); for (let i = 0; i < 60; i++) b.actualizar(0.01);
    [res] = cargarYSoltar(a, b, 'estocada', 0, azar(4));
    comprobar('la estocada se para sin lado (el centro)', res.resultado === 'parada', res.resultado);
    // cambiar al lado bueno justo antes del impacto, sin soltar la parada: parada perfecta
    [a, b] = pareja(1.5, D, D);
    b.bloquear(true, 'alto'); for (let i = 0; i < 60; i++) b.actualizar(0.01);
    [res] = cargarYSoltar(a, b, 'derecha', 0.3, azar(4), () => b.bloquear(true, 'izquierda'));
    comprobar('pasar al lado bueno sin soltar justo antes del golpe es parada perfecta', res.resultado === 'parada perfecta' && b.bloqueando, res.resultado);
  }
  {
    // la máquina en modo direccional para por el lado bueno según la dificultad, y hay combates que terminan
    const leer = (dif) => {
      let bien = 0;
      for (let s = 0; s < 60; s++) {
        const [a, b] = pareja(1.5, D, D); const ia = new IA(b, dif, azar(500 + s));
        a.cargar(LINEAS[s % 5]);
        for (let i = 0; i < 40; i++) { ia.pensar(0.01, a); b.actualizar(0.01); a.actualizar(0.01); }
        if (b.bloqueando && b.cubre(a.linea)) bien++;
      }
      return bien;
    };
    const ap = leer('aprendiz'), re = leer('realista');
    comprobar('la máquina para por el lado bueno más a menudo en realista que en aprendiz', re > ap + 8, `${re} contra ${ap} de 60`);
    let acaban = 0;
    for (let s = 0; s < 6; s++) {
      const [a, b] = pareja(3, D, D); const ia1 = new IA(a, 'normal', azar(700 + s)), ia2 = new IA(b, 'normal', azar(900 + s)); const r = azar(40 + s);
      for (let i = 0; i < 18000 && !a.fuera && !b.fuera; i++) {
        for (const [L, ia, otro] of [[a, ia1, b], [b, ia2, a]]) {
          const m = ia.pensar(0.01, otro); L.x += m.mx * L.velocidad() * 0.01; L.z += m.mz * L.velocidad() * 0.01;
          for (const e of L.actualizar(0.01)) if (e.tipo === 'impacto') resolverGolpe(L, otro, e.linea, r);
        }
      }
      if (a.fuera || b.fuera) acaban++;
    }
    comprobar('combates máquina contra máquina en modo direccional que terminan', acaban >= 5, `${acaban} de 6`);
  }
}

console.log('13. Dirección con el ratón');
{
  const { LectorDireccion } = direccion;
  const d = new LectorDireccion();
  const mover = (dx, dy, t0, n = 5) => { for (let i = 0; i < n; i++) d.mover(dx / n, dy / n, t0 + i * 0.01); };
  mover(-40, 3, 0); comprobar('ratón a la izquierda y clic: golpe por la izquierda', d.alPulsar(0.06) === 'izquierda');
  mover(2, -30, 1); comprobar('ratón hacia arriba y clic: golpe alto', d.alPulsar(1.06) === 'alto');
  mover(0, 25, 2); comprobar('ratón hacia abajo y clic: golpe bajo', d.alPulsar(2.06) === 'bajo');
  mover(35, 0, 3); comprobar('ratón a la derecha y clic: golpe por la derecha', d.alPulsar(3.06) === 'derecha');
  comprobar('sin mover el ratón: estocada', d.alPulsar(5) === 'estocada');
  mover(-40, 0, 6); comprobar('un movimiento de hace rato no cuenta: estocada', d.alPulsar(6.6) === 'estocada');
  mover(3, -2, 7); comprobar('un temblor tampoco cuenta: estocada', d.alPulsar(7.06) === 'estocada');
  d.alPulsar(8); mover(4, 3, 8.1, 3);
  comprobar('con el botón pulsado, un temblor no cambia de lado', d.cambio(8.13) === null);
  mover(0, -45, 8.2);
  comprobar('con el botón pulsado, un movimiento claro hacia arriba cambia a alto', d.cambio(8.25) === 'alto');
  mover(50, 0, 8.4);
  comprobar('y luego a la derecha, sin soltar', d.cambio(8.45) === 'derecha');
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
