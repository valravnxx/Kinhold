// Comprueba desde fuera, contra el servidor de verdad, que los límites de intentos de las cuentas cuentan por la
// dirección del jugador y no por la del proxy (Caddy) ni por lo que el cliente escriba en X-Forwarded-For
// (tarea del hito Cuentas, auditoría del 4 nov). Sin entrar en la máquina: se mira lo que contesta el servidor.
//
// Usa «recuperar la contraseña» con un usuario que no existe (no manda ningún correo ni toca ninguna cuenta), que
// tiene un límite por dirección de RECUPERAR_ORIGEN peticiones por hora (src/logica/correo.js).
//
//   node herramientas/comprobar_origen.mjs agotar   desde una máquina: gasta el límite repartiendo las peticiones entre
//                                                   conexiones que dicen direcciones falsas en X-Forwarded-For; si el
//                                                   servidor se creyera esa cabecera, ninguna llegaría al límite.
//                                                   Sale bien si el límite salta.
//   node herramientas/comprobar_origen.mjs otra     después, desde OTRA máquina (otra dirección, p. ej. GitHub Actions,
//                                                   .github/workflows/origen.yml): una petición. Si el servidor viera la
//                                                   dirección del proxy, todos compartirían el límite y saldría
//                                                   «Demasiados intentos». Sale bien si no sale.
//
// Las dos, en dos máquinas de GitHub: .github/workflows/origen.yml (subir una rama origen-pedido/<algo>). Desde las
// sesiones no se llega al servidor del juego (el proxy de salida lo rechaza, 4 nov).
//
// Ojo: si el servidor contara por el proxy, «agotar» deja la recuperación de contraseña cerrada para todos una hora.
// KINHOLD_SERVIDOR cambia la dirección (por defecto, la de src/mundo/direccion_servidor.js). Detrás de un proxy de
// salida (HTTPS_PROXY), usa https-proxy-agent si está instalado.
import { WebSocket } from 'ws';
import { randomBytes } from 'crypto';
import { SERVIDOR } from '../src/mundo/direccion_servidor.js';
import { RECUPERAR_ORIGEN } from '../src/logica/correo.js';

const modo = process.argv[2];
if (!['agotar', 'otra'].includes(modo)) { console.error('Uso: node herramientas/comprobar_origen.mjs agotar|otra'); process.exit(2); }
const URL_SERVIDOR = process.env.KINHOLD_SERVIDOR || SERVIDOR;
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

let agente;
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  try { const { HttpsProxyAgent } = await import('https-proxy-agent'); agente = new HttpsProxyAgent(proxy); }
  catch (e) { console.log('Aviso: hay HTTPS_PROXY pero no https-proxy-agent; se conecta directo.'); }
}

function conectar(cabeceras = {}) {
  return new Promise((listo, fallo) => {
    const ws = new WebSocket(URL_SERVIDOR, { headers: cabeceras, ...(agente ? { agent: agente } : {}) });
    const c = { ws, cuenta: [] };
    let id = 0;
    c.pedir = async (m) => {
      const n = ++id; ws.send(JSON.stringify({ tipo: 'cuenta', id: n, ...m }));
      for (let k = 0; k < 500; k++) { const r = c.cuenta.find(a => a.id === n); if (r) return r; await pausa(20); }
      return null;
    };
    const t = setTimeout(() => fallo(new Error('sin bienvenida en 20 s')), 20000);
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { clearTimeout(t); listo(c); } if (m.tipo === 'cuenta') c.cuenta.push(m); });
    ws.on('error', (e) => { clearTimeout(t); fallo(e); });
  });
}
const limitado = (r) => !!(r && r.ok === false && /^Demasiados intentos/.test(r.motivo || ''));
const quien = 'nadie-origen-' + randomBytes(5).toString('hex');   // no existe: no se manda ningún correo

console.log(`${new Date().toISOString()} · ${URL_SERVIDOR} · modo ${modo} · límite ${RECUPERAR_ORIGEN}/hora por dirección`);
let bien;
if (modo === 'agotar') {
  // tres conexiones: dos con direcciones falsas distintas en X-Forwarded-For y una sin cabecera
  const tandas = [
    { cab: { 'x-forwarded-for': '203.0.113.7' }, n: 4 },
    { cab: { 'x-forwarded-for': '198.51.100.23' }, n: 4 },
    { cab: {}, n: RECUPERAR_ORIGEN + 1 - 8 },
  ];
  let total = 0, salto = null;
  for (const { cab, n } of tandas) {
    const c = await conectar(cab);
    for (let i = 0; i < n && !salto; i++) {
      const r = await c.pedir({ que: 'recuperar', quien });
      total++;
      const dice = cab['x-forwarded-for'] || '(sin cabecera)';
      console.log(`  petición ${total} · X-Forwarded-For ${dice} → ${r ? (r.ok ? 'aceptada' : r.motivo) : 'sin respuesta'}`);
      if (!r) { console.log('FALLO: el servidor no contesta'); process.exit(1); }
      if (limitado(r)) salto = { total, dice };
    }
    c.ws.close();
    if (salto) break;
  }
  bien = !!salto;
  console.log(bien
    ? `BIEN: el límite salta en la petición ${salto.total} aunque cada conexión dijera otra dirección: X-Forwarded-For del cliente no reparte el límite.`
    : `FALLO: ${total} peticiones sin que salte el límite de ${RECUPERAR_ORIGEN}: el servidor se cree la dirección que escribe el cliente.`);
} else {
  const c = await conectar();
  const r = await c.pedir({ que: 'recuperar', quien });
  c.ws.close();
  console.log(`  una petición → ${r ? (r.ok ? 'aceptada' : r.motivo) : 'sin respuesta'}`);
  bien = !!r && !limitado(r);
  console.log(bien
    ? 'BIEN: desde otra máquina no hay límite: cada dirección cuenta aparte (no se comparte la del proxy).'
    : (r ? 'FALLO: desde otra máquina también sale el límite: el servidor cuenta por la dirección del proxy, la misma para todos.' : 'FALLO: el servidor no contesta'));
}
await pausa(200);
process.exit(bien ? 0 : 1);
