// Kinhold — el chat de texto en el navegador (valravnx, 6 nov: «vamos a poner chat de texto ya, debe verse sobre el
// jugador, y desaparecer al rato»). Lo que se dice va al servidor (src/juego/en_linea.js → { tipo: 'decir' }), que lo
// comprueba y lo reparte a los de cerca (src/logica/charla.js); aquí solo se escribe y se dibuja:
//   - el cuadro para escribir: Intro en el PC (o el botón «Hablar», el de los móviles); Intro lo dice, Esc lo deja.
//     Mientras se escribe, las teclas no mueven al personaje. Encima del cuadro, las ocho frases rápidas (FRASES): un
//     toque y se dice; por la red va su número y a cada uno le sale en su lengua. En el móvil el cuadro se abre sin
//     teclado (para que se vean las frases): se toca el campo para escribir.
//   - el bocadillo sobre la cabeza del que habla (también el tuyo, cuando el servidor lo devuelve: lo que ves es lo que
//     ha aceptado), que sigue a su personaje y se va al rato (duracionBocadillo), apagándose en el último segundo. Uno
//     por persona: lo nuevo sustituye a lo anterior. Más lejos de lo que se oye, no se ve.
import * as THREE from 'three';
import { LARGO_MAX, ALCANCE, FRASES, duracionBocadillo, validarDicho } from '../logica/charla.js';
import { tr } from '../idioma.js';

const ALTO_CABEZA = 1.92;   // m sobre los pies: el bocadillo, justo encima de la cabeza (más alto parecía del de detrás)
const APAGAR = 900;         // ms del final en que se va apagando

// enLinea: la conexión (decir, escucharDicho, yo); boton: el de «Hablar»; camara y lienzo: para poner los bocadillos;
// pies(autor): dónde está alguien (un Vector3 o { x, y, z }), o null si no se le ve; alAbrir(): al empezar a escribir
// (para soltar las teclas pulsadas); avisar(texto, error): un aviso (lo que el servidor no acepta).
export function montarCharla({ enLinea, boton, camara, lienzo, pies, alAbrir = () => {}, avisar = () => {} }) {
  const capa = document.createElement('div');
  capa.id = 'charlaBocadillos';
  capa.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:14;overflow:hidden';
  document.body.appendChild(capa);

  // (el aspecto, en src/plantilla.html: #charlaCaja, el tablero de roble como la barra de construir; las frases, de cuero)
  const caja = document.createElement('form');
  caja.id = 'charlaCaja'; caja.hidden = true;
  caja.innerHTML = '<div id="charlaFrases"></div><div class="fila">' +
    `<input id="charlaTexto" autocomplete="off" enterkeyhint="send" maxlength="${LARGO_MAX * 2}">` +
    '<button id="charlaDecir" type="submit"></button></div>';
  document.body.appendChild(caja);
  const texto = caja.querySelector('#charlaTexto'), decir = caja.querySelector('#charlaDecir'), frases = caja.querySelector('#charlaFrases');
  const botonesFrase = FRASES.map((f, n) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.frase = String(n);
    b.onclick = () => { if (enLinea && enLinea.decirFrase) enLinea.decirFrase(n); cerrar(); };
    frases.appendChild(b);
    return b;
  });
  const ponerTextos = () => {
    texto.placeholder = document.body.classList.contains('tactil-ui') ? tr('Di algo…') : tr('Di algo… (Intro para decirlo, Esc para dejarlo)'); decir.textContent = tr('Decir');
    botonesFrase.forEach((b, n) => { b.textContent = tr(FRASES[n]); });
    if (boton) { if (boton.querySelector('img')) { boton.title = tr('Hablar'); boton.setAttribute('aria-label', tr('Hablar')); } else boton.textContent = tr('Hablar'); }
  };
  ponerTextos();

  function abrir() {
    if (!enLinea || enLinea.estado !== 'conectado') { avisar(tr('Sin conexión con el servidor: no se puede hablar.'), true); return; }
    alAbrir();
    ponerTextos();   // (el aviso del campo, corto en el móvil: se mira al abrir)
    caja.hidden = false; texto.value = '';
    // (en el móvil, sin sacar el teclado: taparía las frases; se toca el campo para escribir)
    if (!document.body.classList.contains('tactil-ui')) texto.focus();
  }
  function cerrar() { caja.hidden = true; texto.blur(); }
  caja.onsubmit = (e) => {
    e.preventDefault();
    const t = texto.value.trim();
    if (t && enLinea) enLinea.decir(t);
    cerrar();
  };
  texto.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(); } e.stopPropagation(); });
  if (boton) boton.onclick = () => (caja.hidden ? abrir() : cerrar());

  // autor → { el, hasta, desde }
  const bocadillos = new Map();
  function poner(autor, dicho) {
    let b = bocadillos.get(autor);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'charlaBocadillo';
      el.style.cssText = 'position:absolute;left:0;top:0;max-width:220px;padding:6px 10px;border-radius:10px;font:14px/1.3 system-ui,sans-serif;' +
        'color:#f1e8d8;background:rgba(36,30,24,.88);border:1px solid rgba(241,232,216,.14);box-shadow:0 3px 12px #0004;' +
        'overflow-wrap:anywhere;text-align:center;will-change:transform,opacity';
      const cola = document.createElement('div');   // el piquito que apunta a la cabeza
      cola.style.cssText = 'position:absolute;left:50%;bottom:-6px;margin-left:-6px;width:0;height:0;border:6px solid transparent;border-bottom:0;border-top-color:rgba(36,30,24,.88)';
      const span = document.createElement('span');
      el.append(span, cola);
      el.dataset.autor = autor;
      capa.appendChild(el);
      b = { el, span };
      bocadillos.set(autor, b);
    }
    b.span.textContent = dicho;   // (como texto: nada de HTML de otro jugador)
    b.desde = performance.now(); b.hasta = b.desde + duracionBocadillo(dicho);
  }
  if (enLinea) enLinea.escucharDicho((m) => {
    if (m.tipo === 'dicho_error') { avisar(tr(m.motivo), true); return; }
    const d = validarDicho(m);
    // (una frase rápida llega por su número: aquí sale en tu lengua)
    if (d && !globalThis.__mutarCharla) poner(d.autor, d.frase !== undefined ? tr(FRASES[d.frase]) : d.texto);   // (la prueba lo rompe a propósito: sin bocadillos)
  });

  const v = new THREE.Vector3();
  // cada fotograma: cada bocadillo sobre su cabeza (o fuera si no se ve), y se van al acabar su tiempo. Si dos se pisan
  // (uno delante del otro, en la línea de la cámara), el del más cercano se queda sobre su cabeza y el otro sube
  function paso() {
    const ahora = performance.now(), W = lienzo.clientWidth || innerWidth, H = lienzo.clientHeight || innerHeight;
    const vistos = [];
    for (const [autor, b] of bocadillos) {
      if (ahora >= b.hasta) { b.el.remove(); bocadillos.delete(autor); continue; }
      const p = pies(autor);
      let ver = false;
      if (p) {
        v.set(p.x, p.y + ALTO_CABEZA, p.z);
        const lejos = v.distanceTo(camara.position);
        v.project(camara);
        ver = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 && lejos < ALCANCE + 30;
        if (ver) vistos.push({ b, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, lejos });
      }
      b.el.style.display = ver ? '' : 'none';
      b.el.style.opacity = String(Math.min(1, (b.hasta - ahora) / APAGAR));
    }
    vistos.sort((a, c) => a.lejos - c.lejos);
    const puestos = [];   // { x0, x1, y0, y1 } en pantalla
    for (const e of vistos) {
      const w = e.b.el.offsetWidth, h = e.b.el.offsetHeight + 8;
      let abajo = e.y;
      for (let n = 0; n < vistos.length; n++) {
        const pisa = puestos.find(r => e.x - w / 2 < r.x1 && e.x + w / 2 > r.x0 && abajo - h < r.y1 && abajo > r.y0);
        if (!pisa) break;
        abajo = pisa.y0 - 2;
      }
      puestos.push({ x0: e.x - w / 2, x1: e.x + w / 2, y0: abajo - h, y1: abajo });
      e.b.el.style.transform = `translate(${e.x.toFixed(1)}px, ${abajo.toFixed(1)}px) translate(-50%, calc(-100% - 8px))`;
    }
  }

  return {
    abrir, cerrar, paso, ponerTextos,
    get abierta() { return !caja.hidden; },
    // para las pruebas: lo que se ve ahora (autor → texto)
    get bocadillos() { return new Map([...bocadillos].map(([a, b]) => [a, b.span.textContent])); },
  };
}
