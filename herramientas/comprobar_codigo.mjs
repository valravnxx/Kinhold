#!/usr/bin/env node
// Kinhold — el comprobador de código: en segundos y aquí, sin la nube ni el navegador.
//   node herramientas/comprobar_codigo.mjs            → el analizador (eslint.config.mjs) y la comprobación de tipos (jsconfig.json)
//   node herramientas/comprobar_codigo.mjs --avisos   → además, la lista de avisos (variables sin usar, tipos dudosos)
// Falla (sale con 1) solo con lo que es un fallo de verdad:
//   - un error del analizador: un nombre sin definir, una clave repetida, código que no se alcanza, una comparación imposible…
//   - un error grave de tipos: un nombre o una exportación que no existe, un módulo que no está, algo usado antes de declararlo.
// Lo demás de los tipos (propiedades que TypeScript no sabe deducir de un código sin anotar) sale como avisos contados:
// en un código sin tipos escritos casi siempre es ruido, y no para nada.
// pruebas_nube.mjs lo pasa antes de subir nada: lo que se ve aquí en segundos no gasta una tanda en la nube.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AVISOS = process.argv.includes('--avisos');

// Los códigos de TypeScript que son fallos de verdad aunque el código no lleve tipos escritos.
export const GRAVES = new Map([
  ['TS2304', 'nombre sin definir'],
  ['TS2552', 'nombre sin definir (¿errata?)'],
  ['TS2305', 'el módulo no exporta eso'],
  ['TS2614', 'el módulo no exporta eso'],
  ['TS2724', 'el módulo no exporta eso (¿errata?)'],
  ['TS2307', 'no encuentra el módulo'],
  ['TS2448', 'usado antes de declararlo'],
  ['TS2449', 'clase usada antes de declararla'],
  ['TS2588', 'se cambia una constante'],
  ['TS2451', 'declarado dos veces'],
  ['TS2300', 'nombre repetido'],
  ['TS2393', 'función repetida'],
]);
const esGrave = (cod) => GRAVES.has(cod) || /^TS1\d{3}$/.test(cod);   // TS1xxx: sintaxis

function correr(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', (codigo) => resolve({ codigo, out, err }));
    p.on('error', (e) => resolve({ codigo: -1, out: '', err: String(e) }));
  });
}
const bin = (n) => path.join(RAIZ, 'node_modules', '.bin', n);

const t0 = Date.now();
const [lint, tipos] = await Promise.all([
  correr(bin('eslint'), ['.', '-f', 'json']),
  correr(bin('tsc'), ['-p', 'jsconfig.json', '--pretty', 'false']),
]);
let mal = 0;

// El analizador
let informe;
try { informe = JSON.parse(lint.out); }
catch { console.log('✗ El analizador no ha podido pasar (¿falta npm install?):\n' + (lint.err || lint.out).slice(0, 2000)); process.exit(1); }
const errL = [], avL = [];
for (const f of informe) for (const m of f.messages) {
  const linea = `  ${path.relative(RAIZ, f.filePath)}:${m.line}:${m.column}  ${m.message}${m.ruleId ? ` (${m.ruleId})` : ''}`;
  (m.severity === 2 ? errL : avL).push(linea);
}
if (errL.length) { mal += errL.length; console.log(`✗ Analizador: ${errL.length} error(es)`); errL.forEach(l => console.log(l)); }
else console.log(`✓ Analizador: sin errores (${avL.length} avisos)`);
if (AVISOS && avL.length) { console.log('  Avisos del analizador:'); avL.forEach(l => console.log(l)); }

// Los tipos
if (tipos.codigo === -1 || (tipos.codigo !== 0 && !/error TS/.test(tipos.out))) {
  console.log('✗ La comprobación de tipos no ha podido pasar (¿falta npm install?):\n' + (tipos.err || tipos.out).slice(0, 2000)); process.exit(1);
}
const errT = [], avT = new Map();
for (const l of tipos.out.split('\n')) {
  const m = l.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
  if (!m) continue;
  const [, archivo, fila, col, cod, txt] = m;
  if (esGrave(cod)) errT.push(`  ${archivo}:${fila}:${col}  ${GRAVES.get(cod) || 'sintaxis'}: ${txt} (${cod})`);
  else { if (!avT.has(cod)) avT.set(cod, []); avT.get(cod).push(`  ${archivo}:${fila}:${col}  ${txt} (${cod})`); }
}
const nAvT = [...avT.values()].reduce((s, v) => s + v.length, 0);
if (errT.length) { mal += errT.length; console.log(`✗ Tipos: ${errT.length} error(es) grave(s)`); errT.forEach(l => console.log(l)); }
else console.log(`✓ Tipos: sin errores graves (${nAvT} avisos de tipos sin escribir)`);
if (AVISOS) for (const [, ls] of avT) ls.forEach(l => console.log(l));

console.log(`${mal ? '✗' : '✓'} Comprobador de código en ${((Date.now() - t0) / 1000).toFixed(1)} s${mal ? `: ${mal} fallo(s)` : ''}`);
process.exit(mal ? 1 : 0);
