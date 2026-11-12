# Prueba en navegador del hogar (P3, «De nada a una casa»; revisión del 1 nov: «hogar dentro de la casa, fijo, más
# duradero»; 8 nov).
# Uso: python3 pruebas/prueba_hogar_navegador.py <html de la demo> <carpeta_capturas>
# Sin servidor (?sinservidor=1&llano=1, como la de los colgaderos): una casa de 3×3 con sus muros y su tejado. En PC
# (1280×800) y en el móvil (390×844): el hogar no se pone fuera de la casa y sí dentro; levantado, se dibuja con su
# lecho de barro, sus losas y su bordillo; encendido, arde (llamas, luz y calor) y Usar ofrece dejarlo en brasas; en
# brasas, sin llamas ni humo, con las brasas que asoman, poca luz y menos calor, y Usar ofrece avivarlo; su panel lo
# dice con el botón de avivar. Capturas de cerca dentro de la casa, de día y de noche.
# La lógica (más duradero, brasas, avivar sin yesca) y el servidor, en pruebas/prueba_fuego.mjs; el recorrido de
# jugador lo levanta sin arcón (pruebas/prueba_recorrido.mjs).
# MUTAR=1: el fuego en brasas se manda sin decir que está en brasas (como si no llegara): la prueba tiene que fallar.
import sys, os, json, math, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_hogar'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
OX, OZ = 4, -3   # la esquina de la casa
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

CASA = f"""(() => {{
  const K = {K}, m = K.mundo;
  const c = {{ id: m.siguienteId++, ox: {OX}, oz: {OZ}, rot: 0, piezas: new Map() }}; m.construcciones.push(c);
  const H = {{ cim_tronco: 'f', muro_tronco: 'e', muro_tronco_puerta: 'e', tejado_paja: 'r' }}, fallos = [];
  const pon = (tipo, i, j, k, d = 0, dir = 0) => {{ const p = {{ tipo, hueco: H[tipo], i, j, k, dir, abierta: false }}; if (H[tipo] === 'e') p.d = d;
    const r = m.colocar({{ construccion: c, nueva: false, pieza: p }}); if (!r.ok) fallos.push(`${{tipo}} ${{i}},${{j}},${{k}}: ${{r.motivo}}`); }};
  for (const k in m.materiales) m.materiales[k] += 500;
  const N = 3, celdas = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) celdas.push([i, j]);
  for (const [i, j] of celdas) pon('cim_tronco', i, j, 0);
  for (let i = 0; i < N; i++) {{ pon(i === 1 ? 'muro_tronco_puerta' : 'muro_tronco', i, 0, 0, 0); pon('muro_tronco', i, N, 0, 0); }}
  for (let j = 0; j < N; j++) {{ pon('muro_tronco', 0, j, 0, 1); pon('muro_tronco', N, j, 0, 1); }}
  for (const [i, j] of celdas) pon('tejado_paja', i, j, 1, 0, j < 1 ? 0 : j > 1 ? 2 : 0);
  for (const c2 of m.construcciones) for (const p of c2.piezas.values()) delete p.obra;
  K.reconstruir();
  return {{ fallos, n: c.piezas.size }};
}})()"""

def entrar(nav, vista, movil):
    pg = nav.new_page(viewport=vista, locale='es-ES', **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if movil else {}))
    err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.goto(URL); pg.wait_for_function(f'{K} !== undefined', timeout=30000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()'); pg.wait_for_timeout(800)
    return pg, err

def poner(pg, tipo, x, z):
    ev = pg.evaluate
    ev(f"{K}.cambiarModo('construir'); Object.assign({K}.pj, {{ x: {x}, z: {z} }}); {K}.estado.planta = 0; {K}.seleccionar('puesto', '{tipo}'); {K}.apuntar({x}, {z})")
    return ev(f"(() => {{ const c = {K}.estado.candidato; return c ? {{ ok: c.v.ok, motivo: c.v.motivo || '', x: c.x, z: c.z, giro: c.giro }} : null; }})()")

def levantar_y_llenar(pg, tipo, deposito):
    return pg.evaluate(f"""(() => {{ const K = {K}, e = Object.values(K.fabCliente.estaciones).find(x => x.tipo === '{tipo}');
      if (!e) return null; delete e.obra; e.deposito = {json.dumps(deposito)}; K.estacionesV.poner(Object.values(K.fabCliente.estaciones));
      return {{ id: e.id, x: e.x, z: e.z, giro: e.giro }}; }})()""")

def mirar(pg, x, y, z, yaw, pitch):
    # con la cámara libre (la del admin): de pie en la habitación, sin que el personaje tape (se queda fuera de la casa)
    pg.evaluate(f"(() => {{ const K = {K}; K.cambiarModo('mover'); Object.assign(K.pj, {{ x: {OX - 5}, z: {OZ - 5} }}); Object.assign(K.camLibre, {{ activa: true, x: {x}, y: {y}, z: {z} }}); K.cam.yaw = {yaw}; K.cam.pitch = {pitch}; }})()")
    pg.wait_for_timeout(2500)

def deposito_dibujado(pg, tipo):
    return pg.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('estacion_{tipo}'); const d = o && o.getObjectByName('deposito'); let n = 0; if (d) d.traverse(m => {{ if (m.isMesh) n++; }}); return n; }})()")


def fuego(pg, f):   # f: como lo manda el servidor (encendida, brasas, queda en s, combustible)
    pg.evaluate(f"""(() => {{ const K = {K}, e = Object.values(K.fabCliente.estaciones).find(x => x.tipo === 'hogar');
      delete e.obra; e.fuego = Object.assign({{ encendida: false, queda: 0, combustible: 0, cenizas: false }}, {f}); K.estacionesV.poner(Object.values(K.fabCliente.estaciones)); }})()""")
    pg.wait_for_timeout(1500)
FUEGO = "(() => {{ const o = window.__kinhold.escena.getObjectByName('estacion_hogar'); const f = o && o.getObjectByName('fuego'); if (!f) return {{ llamas: -1, brasas: -1, humo: -1 }}; const n = k => f.children.filter(m => m.name === k).length; return {{ llamas: n('llama'), brasas: n('brasa'), humo: n('humo') }}; }})()".replace('{{', '{').replace('}}', '}')
def ops(pg, x, z):
    pg.evaluate(f"(() => {{ const K = {K}; K.camLibre.activa = false; K.cambiarModo('mover'); Object.assign(K.pj, {{ x: {x}, z: {z} }}); }})()")
    pg.wait_for_timeout(300)
    return pg.evaluate(f"{K}.opcionesUsar()")

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('PC', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print(f'{nombre}: la casa y su hogar')
        pg, err = entrar(nav, vista, movil)
        ev = pg.evaluate
        ev(f"{K}.llevarPara('mojon', 'mojon'); {K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon'); {K}.apuntar({OX - 3}, {OZ - 3}); {K}.colocar()")
        comprobar(f'{nombre}: su mojón (para construir la casa)', ev(f'!!{K}.miMojon'))
        r = ev(CASA)
        comprobar(f'{nombre}: la casa de 3×3 con muros y tejado', not r['fallos'], json.dumps(r, ensure_ascii=False)[:200])
        fuera = poner(pg, 'hogar', OX - 2.0, OZ + 3.0)
        comprobar(f'{nombre}: fuera de la casa, el hogar no se pone (y dice por qué)', fuera and not fuera['ok'] and 'dentro' in fuera['motivo'], json.dumps(fuera, ensure_ascii=False))
        dentro = poner(pg, 'hogar', OX + 3.0, OZ + 3.2)
        comprobar(f'{nombre}: dentro, en medio de la casa, sí', dentro and dentro['ok'], json.dumps(dentro, ensure_ascii=False))
        ev(f"{K}.colocar()")
        comprobar(f'{nombre}: queda su marco', ev(f"Object.values({K}.fabCliente.estaciones).some(e => e.tipo === 'hogar' && e.obra)"))
        fuego(pg, "{ combustible: 540 }")
        comprobar(f'{nombre}: levantado, se dibuja sin fuego y con lo puesto para arder', ev(f"(() => {{ const o = {K}.escena.getObjectByName('estacion_hogar'); return !!o && !o.getObjectByName('armazon') && o.getObjectByName('ramas').visible && !o.getObjectByName('fuego'); }})()"))
        mirar(pg, OX + 3.0, 1.9 if movil else 1.6, OZ + (5.6 if movil else 5.5), 0, 0.5)
        pg.screenshot(path=f'{SALIDA}/{nombre}_hogar_apagado.png')
        fuego(pg, "{ encendida: true, queda: 900 }")
        v = ev(FUEGO)
        comprobar(f'{nombre}: encendido, arde: llamas y humo', v['llamas'] >= 5 and v['humo'] > 0, json.dumps(v))
        comprobar(f'{nombre}: y alumbra', ev("window.__fuegos().hogueras >= 1"), str(ev("window.__fuegos()")))
        mirar(pg, OX + 3.0, 1.9 if movil else 1.6, OZ + (5.6 if movil else 5.5), 0, 0.5)
        pg.screenshot(path=f'{SALIDA}/{nombre}_hogar_ardiendo.png')
        ev(f"{K}.cielo.poner({{ hora: 22 }})"); pg.wait_for_timeout(2000)
        pg.screenshot(path=f'{SALIDA}/{nombre}_hogar_noche.png')
        ev(f"{K}.cielo.poner({{ hora: 11 }})")
        e = ev(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones).find(x => x.tipo === 'hogar'); return {{ x: e.x, z: e.z }}; }})()")
        o = ops(pg, e['x'] + 0.9, e['z'] + 0.3)
        comprobar(f'{nombre}: encendido, Usar ofrece dejarlo en brasas', 'Dejar en brasas: Hogar' in o and 'Encender: Hogar' not in o, str(o))
        calor_llama = ev(f"{K}.calor()")
        fuego(pg, "{ queda: 2400" + ("" if MUTAR else ", brasas: true") + " }")
        v = ev(FUEGO)
        comprobar(f'{nombre}: en brasas: sin llamas ni humo, con las brasas que asoman', v['llamas'] == 0 and v['humo'] == 0 and v['brasas'] >= 5, json.dumps(v))
        o = ops(pg, e['x'] + 0.9, e['z'] + 0.3)
        comprobar(f'{nombre}: en brasas, Usar ofrece avivarlo (no encenderlo)', 'Avivar: Hogar' in o and 'Encender: Hogar' not in o, str(o))
        calor_brasas = ev(f"{K}.calor()")
        comprobar(f'{nombre}: las brasas calientan, menos que la llama', 0 < calor_brasas < calor_llama, f'{calor_brasas} < {calor_llama}')
        mirar(pg, OX + 3.0, 1.9 if movil else 1.6, OZ + (5.6 if movil else 5.5), 0, 0.5)
        pg.screenshot(path=f'{SALIDA}/{nombre}_hogar_brasas.png')
        ev(f"{K}.cielo.poner({{ hora: 22 }})"); pg.wait_for_timeout(2000)
        pg.screenshot(path=f'{SALIDA}/{nombre}_hogar_brasas_noche.png')
        ev(f"{K}.cielo.poner({{ hora: 11 }})")
        ops(pg, e['x'] + 0.9, e['z'] + 0.3)
        ev(f"{K}.panelFabricar.abrirEstacion(Object.values({K}.fabCliente.estaciones).find(x => x.tipo === 'hogar').id)"); pg.wait_for_timeout(700)
        txt = ev("(document.querySelector('#panelFabricar .fab-fuego') || {}).innerText || ''")
        comprobar(f'{nombre}: el panel lo da en brasas, con el botón de avivar', 'En brasas' in txt and ev("!!document.querySelector('#panelFabricar .fab-encender') && /Avivar/.test(document.querySelector('#panelFabricar .fab-encender').innerText)"), txt[:160])
        comprobar(f'{nombre}: el panel no se sale de lado', ev("document.documentElement.scrollWidth <= innerWidth + 1"))
        pg.screenshot(path=f'{SALIDA}/{nombre}_panel_hogar_brasas.png')
        ev(f"{K}.panelFabricar.cerrar()")
        malos = [x for x in err if 'WebSocket' not in x]
        comprobar(f'{nombre}: sin errores en la consola', not malos, str(malos[:3]))
        pg.close()
    nav.close()
srv.shutdown(); shutil.rmtree(sitio, ignore_errors=True)
print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
