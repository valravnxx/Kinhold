// Pruebas de las acciones con autor (src/logica/acciones.js). Ejecutar: node pruebas/prueba_acciones.mjs
// Comprueba que toda acción que cambia el mundo pasa por la lógica pura con un autor, se valida y queda
// en el registro, y que con el registro se rehace el mismo mundo. Si algo cambia el mundo sin pasar
// por aquí (en la lógica o en el código del juego), estas pruebas fallan.
// Con MUTAR=1 se abre una puerta y se desmonta una pieza saltándose el registro: las pruebas deben FALLAR.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Mundo } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, ejecutarCombate, avanzarProyectil, AUTOR_LOCAL } from '../src/logica/acciones.js';
import { Luchador, azar } from '../src/combate/logica.js';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const foto = (m) => JSON.stringify(m.exportar());

console.log('Construcción: cada acción con autor, validada y anotada');
{
  const m = new Mundo(), reg = new RegistroAcciones();
  const A = (a) => ejecutar(m, reg, { autor: AUTOR_LOCAL, ...a });
  // rechazadas: no cambian nada, pero quedan anotadas
  const antes = foto(m);
  const r1 = ejecutar(m, reg, { tipo: 'mojon', x: 0, z: 0 });
  const r2 = A({ tipo: 'volar', x: 0 });
  const r3 = A({ tipo: 'mojon', x: 'cero', z: 0 });
  const r4 = A({ tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 }); // sin mojón
  comprobar('una acción sin autor se rechaza', !r1.ok && r1.motivo === 'Acción sin autor.');
  comprobar('una acción desconocida se rechaza', !r2.ok && r2.motivo === 'Acción desconocida.');
  comprobar('una acción con datos raros se rechaza', !r3.ok && r3.motivo === 'Datos no válidos.');
  comprobar('las reglas del mundo se siguen aplicando (sin mojón no se construye)', !r4.ok && r4.motivo === 'Primero coloca tu mojón.');
  comprobar('lo rechazado no cambia el mundo', foto(m) === antes);
  comprobar('lo rechazado queda anotado con su motivo', reg.entradas.length === 4 && reg.entradas.every(e => !e.ok && e.motivo));

  // una partida corta: mojón, cimientos, muro con puerta, puerta, abrir, mueble, quitar, desmontar, rellenar
  const pasos = [
    { tipo: 'mojon', x: 0, z: 0 },
    { tipo: 'colocar', pieza: 'cim_piedra', x: 0, z: 0, k: 0, rot: 0, dir: 0 },
    { tipo: 'colocar', pieza: 'cim_piedra', x: 2, z: 0, k: 0, rot: 0, dir: 0 },
    { tipo: 'colocar', pieza: 'muro_tronco_puerta', x: 0, z: -0.95, k: 0, rot: 0, dir: 0 },
    { tipo: 'colocar', pieza: 'puerta_varas', x: 0, z: -0.95, k: 0, rot: 0, dir: 0 },
    { tipo: 'decorar', pieza: 'mesa', x: 0.3, y: 0.2, z: 0.3, rot: 0.5 },
    { tipo: 'decorar', pieza: 'cama_paja', x: -0.4, y: 0.2, z: 0.2, rot: 0 },
    { tipo: 'rellenar', cantidad: 50 },
  ];
  const rs = pasos.map(A);
  comprobar('la partida corta sale bien paso a paso', rs.every(r => r.ok), rs.map(r => r.ok ? 'ok' : r.motivo).join(', '));
  const c = m.construcciones[0];
  const puerta = [...c.piezas.entries()].find(([, p]) => p.tipo === 'puerta_varas');
  const cama = m.decoracion.find(d => d.tipo === 'cama_paja');
  const cim2 = [...c.piezas.entries()].find(([, p]) => p.tipo === 'cim_piedra' && p.i === 1);
  if (MUTAR) puerta[1].abierta = true;  // a propósito: abrir la puerta sin pasar por la acción
  else comprobar('abrir la puerta con Usar', A({ tipo: 'usar', construccion: c.id, clave: puerta[0] }).ok && puerta[1].abierta);
  comprobar('un muro no se abre', !A({ tipo: 'usar', construccion: c.id, clave: 'e:0,0,0,0' }).ok);
  comprobar('quitar un mueble', A({ tipo: 'quitar', id: cama.id }).ok);
  if (MUTAR) m.desmontar(c, cim2[0]);   // a propósito: desmontar sin pasar por la acción
  else comprobar('desmontar un cimiento', A({ tipo: 'desmontar', construccion: c.id, clave: cim2[0] }).ok);
  comprobar('desmontar algo que no existe se rechaza', !A({ tipo: 'desmontar', construccion: 999, clave: 'f:0,0,0' }).ok);
  comprobar('el botón de rellenar no admite cantidades absurdas', !A({ tipo: 'rellenar', cantidad: 1e9 }).ok);

  comprobar('cada acción queda anotada una vez, numerada y con su autor',
    reg.entradas.every((e, i) => e.n === i + 1) && reg.entradas[0].autor === undefined && reg.entradas.slice(1).every(e => e.autor === AUTOR_LOCAL),
    `${reg.entradas.length} entradas`);
  comprobar('el registro guarda datos sencillos (se puede enviar a un servidor)', (() => {
    try { const j = JSON.parse(JSON.stringify(reg.exportar())); return j.length === reg.entradas.length && j.every(e => e.tipo && e.datos); } catch (e) { return false; }
  })());
  // con el registro se rehace el mismo mundo: nada lo ha cambiado por otro camino
  const rehecho = reproducir(reg.exportar());
  comprobar('rehacer el mundo con el registro da el mismo mundo', foto(rehecho) === foto(m),
    foto(rehecho) === foto(m) ? `${m.construcciones[0].piezas.size} piezas, ${m.decoracion.length} mueble` : 'algo cambió el mundo sin pasar por el registro');
  // y el mundo rehecho se guarda y se carga igual (el guardado no cambia de formato)
  comprobar('el guardado sigue siendo el de antes (versión 1)', JSON.parse(foto(m)).version === 1);
}

console.log('Combate: golpes y disparos con autor');
{
  const r = azar(7);
  const a = new Luchador({ nombre: 'A', x: 0, z: 0, rot: 0 });
  const b = new Luchador({ nombre: 'B', x: 0, z: 1.2, rot: Math.PI });
  const ctx = { luchadores: { a, b }, r };
  const reg = new RegistroAcciones(50);
  const g = ejecutarCombate(ctx, reg, { autor: 'a', tipo: 'golpe', objetivo: 'b', linea: 'alto' });
  comprobar('un golpe sin defensa hiere y queda anotado con autor, objetivo y herida',
    g.ok && g.resultado === 'herida' && b.heridas.length === 1 && reg.entradas[0].autor === 'a' && reg.entradas[0].datos.objetivo === 'b' && reg.entradas[0].zona === g.zona,
    `${g.resultado} en ${g.zona}`);
  const n = b.heridas.length;
  const x1 = ejecutarCombate(ctx, reg, { autor: 'c', tipo: 'golpe', objetivo: 'b', linea: 'alto' });
  const x2 = ejecutarCombate(ctx, reg, { tipo: 'golpe', objetivo: 'b', linea: 'alto' });
  const x3 = ejecutarCombate(ctx, reg, { autor: 'a', tipo: 'golpe', objetivo: 'nadie', linea: 'alto' });
  comprobar('quien no está en el combate, sin autor o contra nadie no hiere', !x1.ok && !x2.ok && !x3.ok && b.heridas.length === n);
  b.caer('prueba');
  comprobar('quien está fuera de combate no golpea', !ejecutarCombate(ctx, reg, { autor: 'b', tipo: 'golpe', objetivo: 'a', linea: 'alto' }).ok && a.heridas.length === 0);

  // disparo: arquero a 15 m contra un blanco quieto
  const arq = new Luchador({ nombre: 'Arq', arma: 'arco', x: 0, z: 0, rot: 0 });
  const bl = new Luchador({ nombre: 'Bl', x: 0, z: 15, rot: Math.PI });
  const ctx2 = { luchadores: { arq, bl }, r: azar(3) };
  const reg2 = new RegistroAcciones();
  const d = ejecutarCombate(ctx2, reg2, { autor: 'arq', tipo: 'disparo', x: 0, y: 1.3, z: 15, tension: 1, tTenso: 0 });
  let res = null;
  for (let i = 0; i < 300 && !res; i++) res = avanzarProyectil(ctx2, reg2, d.proyectil, 1 / 60);
  const imp = reg2.entradas.find(e => e.tipo === 'impacto');
  comprobar('el disparo queda anotado y lleva su autor', d.ok && reg2.entradas[0].tipo === 'disparo' && d.proyectil.autor === 'arq');
  comprobar('la herida de la flecha se anota como impacto del mismo autor',
    res && res.tipo === 'blanco' && imp && imp.autor === 'arq' && imp.datos.objetivo === 'bl' && imp.resultado === 'herida' && bl.heridas.length === 1,
    res ? `${res.tipo}${imp ? ' en ' + imp.zona : ''}` : 'no llegó');
  const lim = new RegistroAcciones(3);
  for (let i = 0; i < 5; i++) lim.anotar({ autor: 'a', tipo: 'golpe' }, { ok: true });
  comprobar('el registro del combate tiene tope y guarda las últimas', lim.entradas.length === 3 && lim.entradas[0].n === 3 && lim.total === 5);
}

console.log('Código del juego: nada cambia el mundo saltándose las acciones');
{
  // fuera de la lógica pura, nadie llama directamente a lo que cambia el mundo
  const PROHIBIDO = [
    [/\bmundo\.(colocar|colocarMojon|desmontar|colocarDecoracion|quitarDecoracion|pagar|devolver)\(/, 'cambia el mundo sin acción'],
    [/\.abierta\s*=[^=]/, 'abre o cierra una puerta sin acción'],
    [/\bmateriales\[[^\]]+\]\s*([+\-*]=|=[^=])/, 'cambia los materiales sin acción'],
    [/(^|[^.\w])(resolverGolpe|crearProyectil|moverProyectil)\(/, 'golpea o dispara sin acción'],
    [/\.recibirHerida\(/, 'hiere sin acción'],
  ];
  const archivos = [];
  const recorrer = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) recorrer(p); else if (p.endsWith('.js')) archivos.push(p); } };
  recorrer('src');
  const puros = new Set([join('src', 'combate', 'logica.js')]);
  const revisar = archivos.filter(f => !f.startsWith(join('src', 'logica')) && !puros.has(f));
  const fuentes = revisar.map(f => [f, readFileSync(f, 'utf8')]);
  if (MUTAR) fuentes.push(['(mutación)', 'function trampa() { mundo.desmontar(c, k); }']);
  const fallos = [];
  for (const [f, s] of fuentes) s.split('\n').forEach((l, i) => {
    if (/^\s*\/\//.test(l)) return;
    for (const [re, que] of PROHIBIDO) if (re.test(l)) fallos.push(`${f}:${i + 1} ${que}`);
  });
  comprobar(`ningún archivo fuera de la lógica pura cambia el mundo directamente (${revisar.length} revisados)`, fallos.length === 0, fallos.join(' · '));
  const main = readFileSync('src/juego/main.js', 'utf8'), duelo = readFileSync('src/combate/main.js', 'utf8');
  comprobar('la construcción y el combate usan las acciones', /ejecutar\(mundo, registroAcciones/.test(main) && /ejecutarCombate\(/.test(duelo) && /avanzarProyectil\(/.test(duelo));
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
