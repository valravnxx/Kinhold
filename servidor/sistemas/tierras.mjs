// La tierra que no se usa vuelve al rey, en el servidor (partido de servidor/servidor.mjs, 12 nov). Todo lo comparte
// por S, el estado del servidor (servidor/servidor.mjs, crearServidor).
import { appendFileSync } from 'fs';
import { ejecutar } from '../../src/logica/acciones.js';
import { comunDe } from '../../src/logica/obras_red.js';
import { AUTOR_REY } from '../../src/logica/abandono.js';
import { enmascarar } from '../../src/logica/correo.js';

// La tierra que no se usa vuelve al rey (src/logica/abandono.js): cada revisarCada ms (y cuando lo pide una prueba, con
// su hora) se repasan las tierras. Los avisos van al correo confirmado de la cuenta del dueño (sin cuenta o sin correo,
// solo se apuntan); la tierra se devuelve con la acción del rey (autor AUTOR_REY), que va al mundo y a todos, como el
// mojón. Todo, en tierras.jsonl.
export function instalarTierras(S) {
  const { clientes, apuntarVisto, abandono, mundo, cuentas, anotarTierra, usuarioDe, cartero, registrar, registro, archivo, enviar, guardarAbandono } = S;
  const revisarTierras = (ahora = Date.now()) => {
    for (const a of clientes.values()) apuntarVisto(a, ahora);
    const r = abandono.revisar(mundo, ahora);
    for (const v of r.avisar) {
      const c = cuentas.correoDe(v.dueno), quedan = Math.max(1, Math.ceil(v.quedan / 86400000));
      const conCorreo = !!(c && c.verificado && typeof c.correo === 'string');
      anotarTierra({ que: 'aviso', aviso: v.que, dueno: v.dueno, cuenta: usuarioDe(v.dueno), dias: v.dias, quedan, correo: conCorreo ? enmascarar(c.correo) : null });
      if (conCorreo) cartero.enviar({ para: c.correo, usuario: c.usuario, tipo: v.que === 'ultimo' ? 'tierra_ultimo' : 'tierra_semana', idioma: abandono.idiomas[v.dueno] || 'es', dias: quedan })
        .then((x) => { if (!x.ok) registrar(`no ha salido el aviso de la tierra a «${c.usuario}»`); }).catch(() => registrar(`no ha salido el aviso de la tierra a «${c.usuario}»`));
    }
    for (const l of r.liberar) {
      const antes = comunDe(mundo);
      const x = ejecutar(mundo, registro, { autor: AUTOR_REY, tipo: 'tierra_al_rey', dueno: l.dueno });
      const entrada = registro.entradas[registro.entradas.length - 1];
      registro.entradas.length = 0;
      appendFileSync(archivo, JSON.stringify(entrada) + '\n');
      anotarTierra({ que: 'al_rey', dueno: l.dueno, cuenta: usuarioDe(l.dueno), desde: new Date(l.desde).toISOString(), dias: l.dias, ok: !!x.ok, ...(x.ok ? { ruinas: x.ruinas } : { motivo: x.motivo }) });
      registrar(`la tierra de ${l.dueno} vuelve al rey (${l.dias} días sin entrar nadie)`);
      if (x.ok) for (const ws of clientes.keys()) enviar(ws, { tipo: 'accion', entrada, antes });
    }
    if (r.avisar.length || r.liberar.length || Object.keys(mundo.mojones).length) S.abandonoCambiado = true;
    try { guardarAbandono(); } catch (e) { registrar(`no se pudo guardar abandono.json: ${e && e.message}`); }
    return r;
  };
  S.revisarTierras = revisarTierras;
}

// su tic (cada revisarCada ms; 0, ninguno)
export function arrancarTierras(S) {
  const { revisarCada, revisarTierras, registrar } = S;
  return revisarCada > 0 ? setInterval(() => { try { revisarTierras(); } catch (e) { registrar(`error al repasar las tierras: ${e && e.message}`); } }, revisarCada) : null;
}
