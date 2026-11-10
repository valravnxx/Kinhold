// Herramientas y armas que se gastan (documento de sistemas, apartado 10, «Durabilidad»). Lógica pura (sin three.js ni
// navegador): la usa el servidor, que es quien cuenta cada uso, y el navegador, para enseñarlo en la ficha del equipo.
//
// Lo que dice el documento:
//   Hacha (árboles adultos talados) — piedra / madera ~3, hierro ~30, acero ~60
//   Arma (golpes recibidos o dados) — piedra / madera ~50, hierro ~400, acero ~800
//
// Cada cosa que se gasta lleva en el inventario cuántos usos lleva («usado»; src/logica/inventario.js lo copia con la
// cosa, también al soltarla al suelo y al cogerla). Al llegar a su vida, se rompe: desaparece de donde estaba.
//
// Decisiones provisionales (el documento no las fija; en el registro de decisiones y en el diario, 10 nov):
//  - El hacha se cuenta por golpes al talar (uno por golpe, que es lo que hace el servidor): su vida son los golpes de
//    los árboles adultos que dice el documento con esa hacha (src/logica/tala.js, GOLPES: 56 el adulto con piedra y 14
//    con hierro). Hacha de piedra, 3 × 56 = 168 golpes; de hierro (y el hacha de mano), 30 × 14 = 420. Un árbol joven
//    gasta lo que sus golpes (8 con piedra: unos 21 jóvenes). Tronzar y partir leña no la gastan (el documento cuenta
//    árboles talados).
//  - Un arma se gasta con cada golpe que da y alcanza (herida, golpe maestro o parada) y con cada golpe que para con
//    ella (parada o parada perfecta). Lo que va al aire, no. La lanza lanzada se gasta cuando da a una presa.
//  - Si el hacha se usa de arma, gasta igual: un golpe, un uso.
//  - Armas de madera o piedra (~50): la lanza endurecida, el palo cavador y el mazo de piedra. De hierro (~400): la
//    espada y el cuchillo. La lasca de sílex, la vara, la rama y la piedra no se gastan así (la lasca es un recurso que
//    se apila; la piedra lanzada queda en el suelo).
export const VIDA = {
  hacha_piedra: 168, hacha_hierro: 420, hacha_mano: 420,
  lanza_endurecida: 50, palo_cavador: 50, mazo_piedra: 50,
  espada: 400, cuchillo: 400,
};
export const seGasta = tipo => Object.hasOwn(VIDA, tipo);

// Cómo está una cosa: { usado, vida, queda, fraccion } (fraccion: lo que le queda, de 1 a 0) o null si no se gasta.
export function desgasteDe(c) {
  if (!c || !seGasta(c.tipo)) return null;
  const vida = VIDA[c.tipo], usado = Math.min(vida, Number.isInteger(c.usado) && c.usado > 0 ? c.usado : 0);
  return { usado, vida, queda: vida - usado, fraccion: (vida - usado) / vida };
}

// Suma n usos a la cosa c (un objeto suelto, como la lanza que vuela). Devuelve { usado, vida, roto } o null.
export function gastarCosa(c, n = 1) {
  if (!c || !seGasta(c.tipo)) return null;
  c.usado = (Number.isInteger(c.usado) && c.usado > 0 ? c.usado : 0) + n;
  return { usado: c.usado, vida: VIDA[c.tipo], roto: c.usado >= VIDA[c.tipo] };
}

// Gasta n usos de lo que hay en la ruta del inventario inv (una mano, casi siempre). Si se acaba, se rompe: sale del
// inventario. Devuelve { tipo, usado, vida, roto } o null si ahí no hay nada que se gaste.
export function gastar(inv, ruta, n = 1) {
  const b = inv.buscar(ruta);
  if (b.motivo || !b.cosa) return null;
  const g = gastarCosa(b.cosa, n);
  if (!g) return null;
  if (g.roto) inv.poner(b, null);
  return { tipo: b.cosa.tipo, ...g };
}

// Los resultados de un golpe que gastan el arma de quien lo da, y los que gastan la de quien lo para.
export const GASTA_AL_DAR = new Set(['herida', 'golpe maestro', 'parada', 'parada perfecta']);
export const GASTA_AL_PARAR = new Set(['parada', 'parada perfecta']);

// Reparar en su puesto con su material (documento de sistemas, apartado 10: «se repara en su estación con su material»).
// Se repara lo que se lleva en la mano, junto a un puesto de su uso, con lo DEPOSITADO en él (como las recetas de
// estación: «lo que se deposite en mesa», valravnx, 6 nov). Se hace en el acto y le quita usos (recupera), sin pasar
// de nuevo. Decisiones provisionales (el documento no fija cuánto material ni cuánto recupera; registro y diario, 10 nov):
//  - Lo de piedra, en la piedra de tallar: se le saca filo a la piedra y se vuelve a atar con un cordel. El hacha de
//    piedra recupera la mitad de su vida (84 golpes: un adulto y medio); el mazo de piedra, 25 golpes.
//  - Lo de madera, en el banco de tronco: la lanza endurecida se le saca punta con la lasca de sílex (hay que llevarla;
//    no se gasta) y se le ata la empuñadura con fibra; recupera 25 golpes. El palo cavador no se repara: se hace otro
//    con una rama en 10 s.
//  - Lo de hierro (la espada, el cuchillo, el hacha de hierro y la de mano), en la fragua, cuando la haya. La ropa y la
//    armadura aún no se gastan: su reparación llega con su desgaste.
export const REPARAR = {
  hacha_piedra:     { uso: 'tallar', gasta: { cordel: 1 }, recupera: 84 },
  mazo_piedra:      { uso: 'tallar', gasta: { cordel: 1 }, recupera: 25 },
  lanza_endurecida: { uso: 'banco', gasta: { fibra: 1 }, recupera: 25, requiere: ['lasca_silex'] },
};
export const seRepara = tipo => Object.hasOwn(REPARAR, tipo);

// Le quita a c los usos que recupera su reparación (sin bajar de 0). Devuelve { usado, vida, recuperado } o null.
export function repararCosa(c) {
  if (!c || !seRepara(c.tipo)) return null;
  const antes = Number.isInteger(c.usado) && c.usado > 0 ? c.usado : 0, usado = Math.max(0, antes - REPARAR[c.tipo].recupera);
  if (usado > 0) c.usado = usado; else delete c.usado;
  return { usado, vida: VIDA[c.tipo], recuperado: antes - usado };
}
