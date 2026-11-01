// Sonda de un solo uso (no se une a main): mira desde GitHub el servidor de verdad por sus dos direcciones.
// t de la bienvenida = ms desde que arrancó el proceso del servidor → cuándo se reinició por última vez.
import { WebSocket } from 'ws';
const sonda = (url) => new Promise((bien) => {
  const ws = new WebSocket(url);
  const t = setTimeout(() => { console.log(url, 'sin respuesta en 20 s'); try { ws.terminate(); } catch (e) {} bien(); }, 20000);
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.tipo !== 'bienvenida') return;
    const arranque = new Date(Date.now() - m.t);
    console.log(url, '· protocolo', m.protocolo, '·', 'cuenta' in m ? 'con cuentas' : 'SIN cuentas', '· arrancó hace', Math.round(m.t / 60000), 'min, a las', arranque.toISOString());
    clearTimeout(t); ws.close(); bien();
  });
  ws.on('error', (e) => { console.log(url, 'error:', e.message); clearTimeout(t); bien(); });
});
console.log('ahora', new Date().toISOString());
await sonda('wss://juego.playkinhold.com');
await sonda('wss://2-31-141-224.sslip.io');
for (const u of ['https://juego.playkinhold.com/', 'https://2-31-141-224.sslip.io/']) {
  try { const r = await fetch(u, { redirect: 'manual' }); console.log(u, r.status, r.headers.get('location')); } catch (e) { console.log(u, 'error', e.message); }
}
