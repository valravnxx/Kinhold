# Prueba en navegador de los colgaderos de mochilas y de herramientas (valravnx, 8 nov: «dos nuevos para interior:
# acopio de mochilas colgable a pared y el de herramientas… así lo dejamos todo bien ordenadito en la base»).
# Uso: python3 pruebas/prueba_colgaderos_navegador.py <html de la demo> <carpeta_capturas>
# Sin servidor (?sinservidor=1&llano=1, como las otras de construir): una casa de 3×3 con sus muros de troncos (uno con
# puerta) y su tejado. En PC (1280×800): el colgadero de herramientas, apuntado cerca de un muro por dentro, se pega a
# su cara y mira a la habitación; en medio del cuarto, fuera de la casa o en el muro de la puerta, no se puede poner.
# El de mochilas, en el muro de al lado (girado hacia dentro). Levantados y llenos, se miran de cerca. Con Usar, el
# panel del de mochilas deja colgar el leñero vacío que llevas a la espalda, y al sacarlo vuelve a la espalda. En el
# móvil (390×844), lo mismo de cerca y su panel, sin salirse de lado.
# La lógica y el servidor (lo que guarda cada uno, el muro, en línea), en pruebas/prueba_fabricacion.mjs.
# MUTAR=1: el colgadero no se pega al muro (como si no hubiera muro cerca): la prueba tiene que fallar.
import sys, os, json, math, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_colgaderos'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
os.symlink(os.path.join(RAIZ, 'docs/recursos'), f'{sitio}/recursos')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
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

HERR = {'hacha_piedra': 1, 'hacha_mano': 1, 'palo_cavador': 1, 'cuchillo': 1, 'azada': 1, 'hoz_silex': 1, 'pala_madera': 1, 'lasca_silex': 1}
MOCH = {'lenero': 1, 'porta_piedras': 1, 'cesta_recoleccion': 1}

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('PC', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print(f'{nombre}: la casa y los colgaderos')
        pg, err = entrar(nav, vista, movil)
        ev = pg.evaluate
        if MUTAR: ev(f"{K}.mundo.muroCercano = () => null")
        ev(f"{K}.llevarPara('mojon', 'mojon'); {K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon'); {K}.apuntar({OX - 3}, {OZ - 3}); {K}.colocar()")
        comprobar(f'{nombre}: su mojón (la tierra para los almacenajes)', ev(f'!!{K}.miMojon'))
        r = ev(CASA)
        comprobar(f'{nombre}: la casa de 3×3 con muros y tejado', not r['fallos'], json.dumps(r, ensure_ascii=False)[:200])
        comprobar(f'{nombre}: dentro, bajo techo', ev(f"{K}.mundo.bajoTecho({OX} + 3, {OZ} + 3)"))
        c = poner(pg, 'colgadero_herramientas', OX + 0.4, OZ + 3.0)   # cerca del muro de x = OX, por dentro
        comprobar(f'{nombre}: el de herramientas, cerca del muro, se pega a su cara mirando a la habitación', c and c['ok'] and abs(c['x'] - (OX + 0.17)) < 1e-3 and abs(c['z'] - (OZ + 3)) < 1e-3 and abs(c['giro'] - math.pi / 2) < 1e-2, json.dumps(c))
        en_medio = poner(pg, 'colgadero_herramientas', OX + 3.0, OZ + 3.0)
        comprobar(f'{nombre}: en medio del cuarto, no (y dice por qué)', en_medio and not en_medio['ok'] and 'muro' in en_medio['motivo'], json.dumps(en_medio, ensure_ascii=False))
        fuera = poner(pg, 'colgadero_herramientas', OX - 0.4, OZ + 3.0)
        comprobar(f'{nombre}: por fuera del muro, no (solo dentro)', fuera and not fuera['ok'], json.dumps(fuera, ensure_ascii=False))
        puerta = poner(pg, 'colgadero_mochilas', OX + 3.0, OZ + 0.3)
        comprobar(f'{nombre}: en el muro de la puerta, no', puerta and not puerta['ok'], json.dumps(puerta, ensure_ascii=False))
        c = poner(pg, 'colgadero_herramientas', OX + 0.4, OZ + 3.0); ev(f"{K}.colocar()")
        m = poner(pg, 'colgadero_mochilas', OX + 3.0, OZ + 5.6); ev(f"{K}.colocar()")   # el muro del fondo (z = OZ + 6)
        comprobar(f'{nombre}: el de mochilas, en el muro del fondo, girado hacia dentro', m and m['ok'] and abs(m['z'] - (OZ + 6 - 0.17)) < 1e-3 and abs(abs(m['giro']) - math.pi) < 1e-2, json.dumps(m))
        h = levantar_y_llenar(pg, 'colgadero_herramientas', HERR)
        b = levantar_y_llenar(pg, 'colgadero_mochilas', MOCH)
        comprobar(f'{nombre}: los dos puestos, guardados pegados al muro', h and b and abs(h['x'] - (OX + 0.17)) < 1e-3 and abs(b['z'] - (OZ + 6 - 0.17)) < 1e-3, json.dumps([h, b]))
        pg.wait_for_timeout(800)
        comprobar(f'{nombre}: se dibuja lo colgado', deposito_dibujado(pg, 'colgadero_herramientas') >= 8 and deposito_dibujado(pg, 'colgadero_mochilas') >= 3,
                  f"{deposito_dibujado(pg, 'colgadero_herramientas')} {deposito_dibujado(pg, 'colgadero_mochilas')}")
        # de cerca: de pie delante de cada uno, mirándolo (en el móvil, un poco más lejos: la pantalla es estrecha)
        a = 0.5 if movil else 0
        mirar(pg, OX + 1.9 + a * 3.2, 1.45, OZ + 3.0, math.pi / 2, 0.08)
        pg.screenshot(path=f'{SALIDA}/{nombre}_colgadero_herramientas.png')
        mirar(pg, OX + 3.0, 1.4, OZ + 4.1 - a * 3.2, math.pi, 0.06)
        pg.screenshot(path=f'{SALIDA}/{nombre}_colgadero_mochilas.png')
        mirar(pg, OX + 5.5, 2.2, OZ + 0.9, math.atan2(0.75, -0.66), 0.25)
        pg.screenshot(path=f'{SALIDA}/{nombre}_casa_colgaderos.png')
        pg.evaluate(f"{K}.camLibre.activa = false")
        # el panel: colgar el leñero vacío que llevas a la espalda, y descolgarlo
        ev(f"{K}.inventario.lugares.espalda = null; {K}.accionInventario({{ tipo: 'coger', objeto: 'lenero', cantidad: 1, a: 'espalda' }})")
        comprobar(f'{nombre}: llevas el leñero vacío a la espalda', ev(f"({K}.inventario.lugares.espalda || {{}}).tipo") == 'lenero')
        ev(f"""(() => {{ const K = {K}, e = Object.values(K.fabCliente.estaciones).find(x => x.tipo === 'colgadero_mochilas'); e.deposito = {{ porta_piedras: 1 }}; K.estacionesV.poner(Object.values(K.fabCliente.estaciones));
          Object.assign(K.pj, {{ x: e.x, z: e.z - 0.8 }}); K.panelFabricar.abrirEstacion(e.id); }})()""")
        pg.wait_for_timeout(700)
        hay = ev("!!document.querySelector('#panelFabricar .fab-dejar[data-de=\"espalda\"]')")
        comprobar(f'{nombre}: en el panel, lo que llevas a la espalda (vacío) se puede colgar', hay)
        comprobar(f'{nombre}: el panel no se sale de lado', ev("document.documentElement.scrollWidth <= innerWidth + 1"))
        pg.screenshot(path=f'{SALIDA}/{nombre}_panel_colgadero_mochilas.png')
        if hay:
            pg.click('#panelFabricar .fab-dejar[data-de="espalda"]'); pg.wait_for_timeout(600)
            dep = ev(f"Object.values({K}.fabCliente.estaciones).find(x => x.tipo === 'colgadero_mochilas').deposito")
            comprobar(f'{nombre}: colgado (y ya no lo llevas)', dep.get('lenero') == 1 and not ev(f"!!{K}.inventario.lugares.espalda"), json.dumps(dep))
            pg.click('#panelFabricar .fab-coger[data-objeto="lenero"]'); pg.wait_for_timeout(600)
            comprobar(f'{nombre}: al sacarlo, vuelve a la espalda', ev(f"({K}.inventario.lugares.espalda || {{}}).tipo") == 'lenero', pg.inner_text('#panelFabricar .fab-aviso'))
        ev(f"{K}.panelFabricar.cerrar()")
        malos = [e for e in err if 'WebSocket' not in e]
        comprobar(f'{nombre}: sin errores en la consola', not malos, str(malos[:3]))
        pg.close()
    nav.close()
srv.shutdown(); shutil.rmtree(sitio, ignore_errors=True)
print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
