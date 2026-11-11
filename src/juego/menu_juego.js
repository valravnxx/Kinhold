// Kinhold — el menú con pestañas (estudio de la interfaz del 7 nov, aprobado por valravnx: «un solo menú con pestañas»).
// Arriba, en el juego, solo quedan Menú y Hablar (y en PC, en tu tierra, el mojón). El menú es un tablero de roble encima
// del mundo desenfocado, con las pestañas Equipo, Fabricar, Construir, Mapa y Tu tierra en una correa de cuero y, al pie,
// Ajustes, Ayuda, Decisiones, el idioma y Salir (y lo de pruebas, «+ Materiales» y «Reiniciar», solo con el arcón de
// pruebas; Admin, solo con la cuenta de admin).
//
// Cada pestaña sigue siendo su panel de siempre (src/juego/panel_inventario.js, panel_fabricar.js, mapa_rey.js…), que se
// abre y se cierra como antes, también con sus teclas (I, H, M). Este módulo no los sustituye: mira cuál está abierto y
// pone el menú alrededor (sincronizar, en cada fotograma); si se abre otro, cierra el de antes, para que haya uno solo.
// Construir no es un panel: la pestaña cierra el menú y entra en el modo construir (su barra va abajo, en el mundo).
//
// pestanas: { equipo, fabricar, mapa, tierra: { abrir, cerrar, abierto } , construir: { ir } }
// pie: { ajustes, ayuda, registro: { boton, panel } }: los paneles del pie, que se abren dentro del menú igual
// tactil: en el móvil (las pestañas son botones redondos)
export function montarMenuJuego({ hub, pestanas, pie = {}, boton = null, cerrarBoton = null }) {
  let actual = null;          // lo que está abierto: el nombre de una pestaña o de un panel del pie
  let ultima = 'equipo';      // la pestaña con la que se abre «Menú»
  const botones = new Map([...hub.querySelectorAll('[data-pest]')].map(b => [b.dataset.pest, b]));
  // (abierto: una función o, en los paneles de equipo y fabricar, una propiedad)
  const estaAbierto = (o) => (typeof o.abierto === 'function' ? o.abierto() : !!o.abierto);
  const abiertoDe = (n) => (pestanas[n] ? estaAbierto(pestanas[n]) : pie[n] ? !pie[n].panel.hidden : false);
  const nombres = () => [...Object.keys(pestanas).filter(n => pestanas[n].abrir), ...Object.keys(pie)];
  function cerrarUno(n) {
    if (pestanas[n] && pestanas[n].cerrar) pestanas[n].cerrar();
    else if (pie[n]) pie[n].panel.hidden = true;
  }
  function cerrarTodo(salvo = null) { for (const n of nombres()) if (n !== salvo && abiertoDe(n)) cerrarUno(n); }
  function abrir(n = ultima) {
    if (n === 'construir') { cerrarTodo(); sincronizar(); pestanas.construir.ir(); return; }
    cerrarTodo(n);
    if (pestanas[n]) { if (!abiertoDe(n)) pestanas[n].abrir(); ultima = n; }
    else if (pie[n]) pie[n].panel.hidden = false;
    sincronizar();
  }
  function cerrar() { cerrarTodo(); sincronizar(); }
  const alternar = () => (actual ? cerrar() : abrir());
  // lo que está abierto de verdad; si hay dos (se abrió otro con su tecla), se queda el nuevo
  function sincronizar() {
    let abiertos = nombres().filter(abiertoDe);
    if (abiertos.length > 1) {
      const queda = abiertos.filter(n => n !== actual).pop();
      for (const n of abiertos) if (n !== queda) cerrarUno(n);
      abiertos = [queda];
    }
    const ahora = abiertos[0] || null;
    if (ahora === actual && hub.hidden === !ahora) return;
    actual = ahora;
    if (actual && pestanas[actual]) ultima = actual;
    hub.hidden = !actual;
    document.body.classList.toggle('hub-abierto', !!actual);
    document.body.classList.toggle('hub-mapa', actual === 'mapa');
    for (const [n, b] of botones) b.classList.toggle('sel', n === actual);
    for (const [n, p] of Object.entries(pie)) p.boton.classList.toggle('sel', n === actual);
    if (boton) boton.classList.toggle('sel', !!actual);
  }
  for (const [n, b] of botones) b.onclick = (e) => { e.stopPropagation(); if (n === actual && n !== 'construir') return; abrir(n); };
  for (const [n, p] of Object.entries(pie)) p.boton.onclick = (e) => { e.stopPropagation(); if (n === actual) abrir(ultima); else abrir(n); };
  if (boton) boton.onclick = (e) => { e.stopPropagation(); alternar(); };
  if (cerrarBoton) cerrarBoton.onclick = (e) => { e.stopPropagation(); cerrar(); };
  // tocar el fondo desenfocado (fuera del tablero) cierra, como en los juegos
  // Admin y Salir, al pie: el menú se cierra antes (Admin abre su propio panel, a veces con el mapa)
  const menu = hub.querySelector('#menu');
  if (menu) menu.addEventListener('click', (e) => { if (e.target.closest('#btnAdmin')) cerrar(); }, { capture: true });
  const fondo = hub.querySelector('.hub-fondo');
  if (fondo) fondo.onclick = cerrar;
  sincronizar();
  return { abrir, cerrar, alternar, sincronizar, get abierto() { return !!actual; }, get pestana() { return actual; } };
}
