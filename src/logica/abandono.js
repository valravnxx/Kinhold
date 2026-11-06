// La tierra vuelve al rey si no se usa (valravnx, 4 nov; GDD, «Tu tierra»). Lógica pura (sin websocket ni archivos):
// la usan el servidor (servidor/servidor.mjs) y las pruebas.
//
// - Si pasan DIAS días sin que entre en el juego el dueño ni ninguno de sus invitados, su tierra queda libre: el mojón
//   se va y los invitados dejan de serlo (Mundo.tierraAlRey, src/logica/construccion.js). Si en su tierra no hay
//   ninguna obra terminada (ni una pieza acabada), basta con DIAS_SIN_OBRA.
// - Lo construido se queda donde está, como ruina en tierra de nadie: cualquiera puede desmontarlo (puedeTocar).
// - Aviso por correo DIAS_AVISO días antes y el último día (cuando queda un día o menos): uno de cada, y vuelven a
//   valer si entra alguien (el plazo empieza otra vez).
// - «Entrar» es estar en el mundo (decisión provisional, 6 nov): el servidor lo apunta al conectar y en cada latido
//   mientras sigue conectado, solo si su cuenta puede entrar en el mundo (con el correo confirmado).
// - Los dueños de antes de esto (sin nada apuntado) empiezan a contar desde la primera revisión.
export const DIA = 24 * 60 * 60 * 1000;
export const DIAS = 30;
export const DIAS_SIN_OBRA = 15;
export const DIAS_AVISO = 7;
// quien hace la acción de devolver la tierra: el servidor, nunca un jugador (sus autores son «jugador:…»)
export const AUTOR_REY = 'rey';

// ¿hay en la tierra de este dueño alguna pieza terminada?
export function tieneObraTerminada(mundo, dueno) {
  for (const c of mundo.construcciones) {
    if (mundo.tierraDe(c.ox, c.oz) !== dueno) continue;
    for (const p of c.piezas.values()) if (!p.obra) return true;
  }
  return false;
}

export class Abandono {
  // datos: lo guardado (exportar) o nada
  constructor(datos = null) {
    this.vistos = {};   // autor → última vez en el mundo (ms)
    this.avisos = {};   // dueño → { desde, semana, ultimo }: los avisos mandados para el plazo que empezó en «desde»
    this.idiomas = {};  // autor → el idioma de su último mensaje de cuenta (para el correo)
    if (datos && typeof datos === 'object') {
      for (const k of ['vistos', 'avisos', 'idiomas']) if (datos[k] && typeof datos[k] === 'object' && !Array.isArray(datos[k])) this[k] = { ...datos[k] };
    }
  }
  exportar() { return { vistos: { ...this.vistos }, avisos: { ...this.avisos }, idiomas: { ...this.idiomas } }; }
  visto(autor, t) { if (!(this.vistos[autor] >= t)) this.vistos[autor] = t; }
  // la última vez que entró el dueño o alguno de sus invitados (undefined si nadie)
  ultima(mundo, dueno) {
    let u;
    for (const a of [dueno, ...(mundo.invitadosDe(dueno) || [])]) if (Number.isFinite(this.vistos[a]) && !(u >= this.vistos[a])) u = this.vistos[a];
    return u;
  }
  // Cómo está la tierra de un dueño: { desde, dias, hasta, quedan (ms) }
  plazo(mundo, dueno, ahora) {
    let desde = this.ultima(mundo, dueno);
    if (desde === undefined) { desde = ahora; this.vistos[dueno] = ahora; }
    const dias = tieneObraTerminada(mundo, dueno) ? DIAS : DIAS_SIN_OBRA, hasta = desde + dias * DIA;
    return { desde, dias, hasta, quedan: hasta - ahora };
  }
  // Repasa todas las tierras: { liberar: [{ dueno, desde, dias }], avisar: [{ dueno, que: 'semana' | 'ultimo', quedan, dias }] }.
  // Apunta los avisos como mandados (quien llama los manda); lo de liberar lo hace quien llama (con la acción del rey).
  revisar(mundo, ahora) {
    const liberar = [], avisar = [];
    for (const dueno of Object.keys(mundo.mojones)) {
      const p = this.plazo(mundo, dueno, ahora);
      if (p.quedan <= 0) { liberar.push({ dueno, desde: p.desde, dias: p.dias }); delete this.avisos[dueno]; continue; }
      let a = this.avisos[dueno];
      if (!a || a.desde !== p.desde) a = this.avisos[dueno] = { desde: p.desde, semana: false, ultimo: false };
      if (p.quedan <= DIA) {
        if (!a.ultimo) { a.ultimo = a.semana = true; avisar.push({ dueno, que: 'ultimo', quedan: p.quedan, dias: p.dias }); }
      } else if (p.quedan <= DIAS_AVISO * DIA && !a.semana) { a.semana = true; avisar.push({ dueno, que: 'semana', quedan: p.quedan, dias: p.dias }); }
    }
    // lo de quien ya no tiene mojón no hace falta
    for (const d of Object.keys(this.avisos)) if (!mundo.mojones[d]) delete this.avisos[d];
    return { liberar, avisar };
  }
}
