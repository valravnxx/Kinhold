// Kinhold — el ciclo de día y noche en el navegador (valravnx, 7 nov). La lógica (la hora, el sol, la luna, las
// estrellas y los colores de cada momento) está en src/logica/cielo.js; aquí se lleva a la escena:
//   - la luz del sol (o de la luna, de noche) con sus sombras, su color y su dirección, y la luz del cielo;
//   - el cielo que pinta la niebla del posprocesado (src/posprocesado/niebla.js): degradado, halo y disco del sol,
//     la luna con su fase y las estrellas (todo en el mismo sombreador, sin mallas: solo cuesta en los píxeles de cielo);
//   - el color de la niebla y lo que refleja el agua.
// La hora es la del servidor (todos ven el mismo cielo). Para las pruebas y las capturas: ?hora=H (hora del mundo,
// 0–24) y ?luna=F (fase, 0 nueva, 0,5 llena) la dejan quieta; las pruebas automáticas (navigator.webdriver) sin ?hora
// ven la luz «mañana» del estilo v5, quieta, y el cielo de antes (así ninguna otra prueba depende de la hora a la que se
// pase ni del cielo nuevo, que tiene su prueba).
import * as THREE from 'three';
import { cieloDe, msDeHora, horaTexto } from '../logica/cielo.js';
import { LUCES } from './estilos.js';
import { cieloAgua } from '../mapa/agua.js';

// el estado que lee el sombreador del cielo (lo copia NieblaEffect.update en cada fotograma)
function estadoVacio() {
  return {
    activo: true, sol: new THREE.Vector3(0, 1, 0), luna: new THREE.Vector3(0, -1, 0), colorSol: new THREE.Color(1, 1, 1),
    arriba: new THREE.Color(), horizonte: new THREE.Color(), estrellas: 0, giro: new THREE.Matrix3(), tiempo: 0,
  };
}

// el cielo de la prueba de estilo v5 (la luz «mañana»), quieto
function cieloV5() {
  const L = LUCES.manana, d = new THREE.Vector3(...L.sol[2]).normalize();
  return {
    hora: 10, dias: 0, sol: d.toArray(), luna: [0, -1, 0], altoSol: Math.asin(d.y) * 180 / Math.PI, altoLuna: -90, fase: 0, luzLuna: 0, giro: 0, estrellas: 0,
    arriba: L.fondo[1], horizonte: L.fondo[0], colorSol: L.sol[0],
    luz: { direccion: d.toArray(), color: L.sol[0], intensidad: L.sol[1], deLuna: false },
    hemi: { arriba: L.hemi[0], suelo: L.hemi[1], intensidad: L.hemi[2] }, v5: true,
  };
}

// ambiente: el de src/mundo/ambiente.js; reloj(): la hora real del servidor (ms)
export function crearCielo({ ambiente, reloj = () => Date.now() }) {
  const q = new URLSearchParams(location.search);
  let fijo = null;
  if (q.has('hora')) fijo = { hora: Number(q.get('hora')) || 0, dias: 0, ...(q.has('luna') ? { fase: Number(q.get('luna')) } : {}) };
  else if (navigator.webdriver) fijo = 'v5';
  const estado = estadoVacio();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();
  const col = new THREE.Color();
  let actual = null;

  function aplicar(c) {
    actual = c;
    ambiente.ponerDia(c);   // las luces, la niebla y los colores del cielo de la escena
    estado.sol.fromArray(c.sol); estado.luna.fromArray(c.luna);
    // los colores, tal como se ven (sRGB), que es como los mezcla la niebla (setHex los pasa a luz lineal: se deshace)
    estado.colorSol.setHex(c.colorSol).convertLinearToSRGB();
    estado.arriba.setHex(c.arriba).convertLinearToSRGB(); estado.horizonte.setHex(c.horizonte).convertLinearToSRGB();
    estado.estrellas = c.estrellas;
    // las estrellas: su sitio en el cielo que gira (filas: el punto del ecuador a la hora del sol, el de 90° más allá y el polo)
    const h = c.giro, lat = 42 * Math.PI / 180;
    A.set(-Math.sin(h), Math.cos(lat) * Math.cos(h), Math.sin(lat) * Math.cos(h));
    P.set(0, Math.sin(lat), -Math.cos(lat));
    B.crossVectors(P, A);
    estado.giro.set(A.x, A.y, A.z, B.x, B.y, B.z, P.x, P.y, P.z);
    // el agua refleja lo de arriba y lo del horizonte (en luz lineal)
    col.setHex(c.arriba); cieloAgua.value.setHex(c.horizonte).lerp(col, 0.5);
  }

  function paso() {
    estado.tiempo = performance.now() / 1000;
    // (las pruebas: la luz «mañana» quieta y el cielo de antes, el degradado de la página: así dibujan igual que antes)
    if (fijo === 'v5') { if (!actual) { aplicar(cieloV5()); estado.activo = false; } return actual; }
    estado.activo = true;
    aplicar(cieloDe(reloj(), fijo));
    return actual;
  }

  return {
    estado, paso,
    get actual() { return actual; },
    get hora() { return actual ? horaTexto(actual.hora) : ''; },
    // para las pruebas y el admin: una hora del mundo quieta ({ hora, fase }), 'v5', o null (la del servidor)
    poner(f) { fijo = f && f !== 'v5' ? { dias: 0, ...f } : f; actual = null; return paso(); },
    get fijo() { return fijo; },
    // para las pruebas: lo claro que es lo que refleja el agua (luz lineal, 0–1)
    get agua() { const c = cieloAgua.value; return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; },
    // cuándo (hora real) es la próxima vez que el mundo tiene esa hora
    cuando: (hora) => msDeHora(hora, reloj()),
  };
}
