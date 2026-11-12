// Prueba de la medida de rendimiento de cada aparato, al servidor con un botón (hito «Orden», 12 nov;
// src/logica/rendimiento.js y servidor/sistemas/rendimiento.mjs).
// Ejecutar: node pruebas/prueba_rendimiento_servidor.mjs
// Comprueba:
//   - la toma de fotogramas da la media, el peor fotograma, los triángulos y las llamadas de dibujo;
//   - una medida rara (sin aparato, números fuera de sitio, textos largos o con lo que no toca) no vale o sale limpia;
//   - con clientes de verdad: cualquiera manda su medida y queda en rendimiento.jsonl con su cuenta; otra enseguida, no;
//     una que no vale, no; solo la cuenta de admin ve las últimas; y al volver a arrancar el servidor, siguen ahí.
// Con MUTAR=1 se prueba un servidor que deja ver las medidas a cualquiera: debe FALLAR.
import { WebSocket } from 'ws';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { TomaRendimiento, validarMedida, puedeMandar, ENVIAR_CADA_MS, resumenMedida, DEMASIADO_PRONTO } from '../src/logica/rendimiento.js';

const MUTAR = process.env.MUTAR === '1';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

// con MUTAR, el sistema del servidor sin la comprobación de admin (copiado junto al de verdad, para que sus import valgan)
let rutaSistema = null;
if (MUTAR) {
  const orig = join(raiz, 'servidor/sistemas/rendimiento.mjs'), f = readFileSync(orig, 'utf8');
  const m = f.replace('if (!esAdmin(autor)) return responder', 'if (false) return responder');
  if (m === f) { console.log('No se pudo mutar el servidor'); process.exit(1); }
  rutaSistema = orig;
  writeFileSync(orig + '.orig', f); writeFileSync(orig, m);
}
const restaurar = () => { if (rutaSistema) { writeFileSync(rutaSistema, readFileSync(rutaSistema + '.orig', 'utf8')); rmSync(rutaSistema + '.orig'); rutaSistema = null; } };
process.on('exit', restaurar);
const { crearServidor } = await import(pathToFileURL(join(raiz, 'servidor/servidor.mjs')).href);

function cliente(puerto, ficha = null) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}${ficha ? '/?ficha=' + encodeURIComponent(ficha) : ''}`);
    const c = { ws, rend: [], cuentas: [] };
    c.mandar = (m) => ws.send(JSON.stringify(m));
    let id = 0;
    const esperar = async (lista, n, ms = 3000) => { for (let k = 0; k < ms / 20; k++) { const r = lista.find(a => a.id === n); if (r) return r; await pausa(20); } return null; };
    c.rend1 = (m) => { const n = ++id; c.mandar({ tipo: 'rendimiento', id: n, ...m }); return esperar(c.rend, n); };
    c.cuenta1 = async (usuario) => {
      const n = ++id; c.mandar({ tipo: 'cuenta', id: n, que: 'crear', usuario, clave: 'una-contraseña-larga', correo: usuario.toLowerCase() + '@ejemplo.com' });
      const r = await esperar(c.cuentas, n, 5000);
      if (r && r.ok) { const carta = cartas.filter(x => x.usuario === r.usuario).at(-1); const m = ++id; c.mandar({ tipo: 'cuenta', id: m, que: 'verificar', codigo: carta && carta.codigo }); await esperar(c.cuentas, m, 5000); }
      return r;
    };
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.tipo === 'bienvenida') { c.yo = m.autor; listo(c); }
      if (m.tipo === 'rendimiento') c.rend.push(m);
      if (m.tipo === 'cuenta') c.cuentas.push(m);
    });
    ws.on('error', fallo);
  });
}

const medidaBuena = (fps = 58) => ({
  resultado: { segundos: 10, fotogramas: fps * 10, fps, ms: +(1000 / fps).toFixed(1), peor: 41, lentos: 0, triangulos: 120000, triangulosMax: 150000, llamadas: 85, llamadasMax: 110 },
  aparato: { navegador: 'Mozilla/5.0 (prueba)', grafica: 'Tarjeta de prueba', ancho: 1920, alto: 1080, resolucion: 1, nucleos: 8, memoria: 8, tactil: false },
  perfil: 'alta',
});

const cartas = [];
const cartero = { conClave: true, enviar: async (x) => { cartas.push(x); return { ok: true }; } };
const dir = mkdtempSync(join(tmpdir(), 'kinhold-rendimiento-'));
const archivo = join(dir, 'mundo.jsonl');
const opciones = { puerto: 0, archivo, adminCorreo: 'valravnx@ejemplo.com', parametrosClave: { N: 1 << 10, r: 8, p: 1 }, cartero, altas: { origen: 1e6, total: 1e6, espera: 0 } };
try {
  console.log('Lógica pura');
  {
    const t = new TomaRendimiento();
    comprobar('sin fotogramas, no hay resultado', t.resultado() === null);
    for (const [ms, tri, ll] of [[16, 1000, 10], [16, 3000, 30], [68, 2000, 20], [0, 9e9, 9e9], [NaN, 1, 1]]) t.fotograma(ms, tri, ll);
    const r = t.resultado();
    comprobar('la toma: media, peor, lentos, triángulos y llamadas (y descarta tiempos imposibles)', r.fotogramas === 3 && r.ms === 33.3 && r.peor === 68 && r.lentos === 1 && r.triangulos === 2000 && r.triangulosMax === 3000 && r.llamadas === 20 && r.llamadasMax === 30 && r.fps === 30, JSON.stringify(r));
  }
  {
    const v = validarMedida({ ...medidaBuena(), raro: 1, nota: 'x'.repeat(500), aparato: { ...medidaBuena().aparato, navegador: 'a\u0000b'.repeat(300), memoria: 'mucha', otra: 2 } });
    comprobar('una medida buena sale limpia (textos cortos, sin lo que no toca, lo que no es número, fuera)', !!v && !('raro' in v) && v.nota.length === 80 && v.aparato.navegador.length === 200 && !v.aparato.navegador.includes('\u0000') && v.aparato.memoria === null && !('otra' in v.aparato), JSON.stringify(v && v.aparato));
    const malas = [null, [], {}, { resultado: medidaBuena().resultado }, { ...medidaBuena(), resultado: { ...medidaBuena().resultado, fps: -1 } },
      { ...medidaBuena(), resultado: { ...medidaBuena().resultado, peor: '41' } }, { ...medidaBuena(), aparato: { ...medidaBuena().aparato, ancho: 0 } }];
    comprobar('las medidas raras no valen', malas.every(m => validarMedida(m) === null));
    comprobar('una cada tanto: la primera sí; enseguida, no; pasado el rato, sí', puedeMandar(null, 5) && !puedeMandar(1000, 1000 + ENVIAR_CADA_MS - 1) && puedeMandar(1000, 1000 + ENVIAR_CADA_MS));
    comprobar('el resumen se lee de un vistazo', resumenMedida(validarMedida(medidaBuena())) === '58 fps · peor 41 ms · 120 mil tri · 85 llamadas · 1920×1080 ×1 · alta', resumenMedida(validarMedida(medidaBuena())));
  }

  console.log('Servidor');
  let s = crearServidor(opciones);
  let puerto = await s.listo;
  let admin = await cliente(puerto), otro = await cliente(puerto);
  await admin.cuenta1('Valravnx'); await otro.cuenta1('Otro');
  // la cuenta de admin necesita el correo de admin
  {
    const r = await otro.rend1({ que: 'enviar', medida: medidaBuena(31) });
    comprobar('un jugador manda su medida', r && r.ok, JSON.stringify(r));
    const r2 = await otro.rend1({ que: 'enviar', medida: medidaBuena(32) });
    comprobar('otra enseguida, no', r2 && !r2.ok && r2.motivo === DEMASIADO_PRONTO, JSON.stringify(r2));
    const r3 = await admin.rend1({ que: 'enviar', medida: { ...medidaBuena(), aparato: null } });
    comprobar('una que no vale, no (y no cuenta para la espera)', r3 && !r3.ok);
    const r4 = await admin.rend1({ que: 'enviar', medida: medidaBuena(60) });
    comprobar('el admin manda la suya', r4 && r4.ok, JSON.stringify(r4));
    const lineas = existsSync(s.archivoRendimiento) ? readFileSync(s.archivoRendimiento, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
    comprobar('quedan en rendimiento.jsonl con la hora y la cuenta', lineas.length === 2 && lineas[0].cuenta === 'Otro' && lineas[0].resultado.fps === 31 && lineas[1].cuenta === 'Valravnx' && !!lineas[0].t && lineas[0].aparato.grafica === 'Tarjeta de prueba', JSON.stringify(lineas.map(l => [l.cuenta, l.resultado.fps])));
    const v = await otro.rend1({ que: 'ver' });
    comprobar('otra cuenta no las ve', v && !v.ok && !v.medidas, JSON.stringify(v && { ok: v.ok, n: v.medidas && v.medidas.length }));
    const va = await admin.rend1({ que: 'ver' });
    comprobar('el admin ve las últimas, la más nueva primero', va && va.ok && va.medidas.length === 2 && va.medidas[0].cuenta === 'Valravnx' && va.medidas[1].cuenta === 'Otro', JSON.stringify(va && va.medidas && va.medidas.map(m => m.cuenta)));
  }
  admin.ws.close(); otro.ws.close();
  await s.cerrar();
  // al volver a arrancar, siguen ahí
  s = crearServidor(opciones); puerto = await s.listo;
  admin = await cliente(puerto);
  {
    // entrar con la cuenta de admin (usuario y clave) y volver con la ficha que da
    const id = 99; admin.mandar({ tipo: 'cuenta', id, que: 'entrar', usuario: 'Valravnx', clave: 'una-contraseña-larga' });
    for (let k = 0; k < 150 && !admin.cuentas.find(a => a.id === id); k++) await pausa(20);
    const e = admin.cuentas.find(a => a.id === id);
    comprobar('(el admin vuelve a entrar con su cuenta)', e && e.ok, JSON.stringify(e && { ok: e.ok, motivo: e.motivo }));
    admin.ws.close(); admin = await cliente(puerto, e && e.ficha);
    const va = await admin.rend1({ que: 'ver' });
    comprobar('al volver a arrancar el servidor, el admin las sigue viendo', va && va.ok && va.medidas.length === 2, JSON.stringify(va && { ok: va.ok, n: va.medidas && va.medidas.length }));
  }
  admin.ws.close();
  await s.cerrar();
} finally {
  restaurar();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
