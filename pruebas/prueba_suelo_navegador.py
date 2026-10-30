# Prueba en navegador (Chromium sin pantalla): objetos en el suelo en la construcción (hito 2).
# Suelta lo que llevas en las manos con «Soltar», comprueba que cae a tus pies y se ve, que con Usar se coge, que las
# piedras hacen pila y no desaparecen, que lo demás desaparece pasada la hora (adelantando la hora guardada), que en
# tus tierras no desaparece y que se guarda al recargar. Capturas de cerca en PC (1280×800) y móvil (390×844).
# Uso: python3 pruebas/prueba_suelo_navegador.py dist/kinhold_hito1.html <carpeta>
# MUTAR=1: «Soltar» tira lo soltado en vez de dejarlo en el suelo: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, re
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/construccion'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/construccion/prueba.html')
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes', TALLER), f'{sitio}/recursos/personajes/{TALLER}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/construccion/prueba.html'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

K = 'window.__kinhold'
HORA = 3600 * 1000

def abrir(nav, w, h, movil=False):
    pg = nav.new_page(viewport={'width': w, 'height': h}, locale='es-ES', is_mobile=movil, has_touch=movil, device_scale_factor=2 if movil else 1)
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_function('window.__kinhold !== undefined', timeout=30000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()')
    pg.wait_for_timeout(800)
    return pg, errores

# el jugador en (x, z) mirando hacia +z, con la cámara cerca y de lado
def ir(pg, x, z, dist=2.6, pitch=0.5, yaw=3.54):
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.x = {x}; k.pj.z = {z}; k.pj.k = 0; k.pj.rot = 0.8; k.cam.dist = {dist}; k.cam.pitch = {pitch}; k.cam.yaw = {yaw}; }})()")

def en_mano(pg, tipo, n, lugar='mano:der'):
    return pg.evaluate(f"(() => {{ const r = {K}.accionInventario({{ tipo: 'coger', objeto: '{tipo}', cantidad: {n}, a: '{lugar}' }}); {K}.pintarLlevas(); return r.ok; }})()")

def soltar_boton(pg, lugar, movil=False):
    if MUTAR: pg.evaluate(f"{K}.sueloObjetos.soltar = (invs, reg, autor, de) => {K}.accionInventario({{ tipo: 'soltar', de }})")
    b = pg.locator(f'#llevas [data-soltar="{lugar}"]')
    (b.tap() if movil else b.click())
    pg.wait_for_timeout(250)

def foto(pg, nombre):
    pg.wait_for_timeout(300); pg.evaluate(f"{K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}.png')

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    print('PC: soltar y coger del suelo')
    pg, errores = abrir(nav, 1280, 800)
    ir(pg, 0, 8)
    comprobar('empieza sin nada en el suelo', pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.length") == 0)
    en_mano(pg, 'hacha_mano', 1)
    soltar_boton(pg, 'mano:der')
    o = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos[0] || null")
    comprobar('«Soltar» deja el hacha en el suelo, a tus pies', o is not None and o['cosa']['tipo'] == 'hacha_mano' and abs(o['x']) < 0.01 and abs(o['z'] - 8) < 0.01, str(o and (o['x'], o['z'])))
    comprobar('y ya no la llevas en la mano', pg.evaluate(f"!{K}.inventario.lugares['mano:der']"))
    ahora = pg.evaluate('Date.now()')
    comprobar('fuera de tus tierras desaparece en 1 hora', o is not None and o['desaparece'] is not None and abs(o['desaparece'] - ahora - HORA) < 60000)
    comprobar('se ve en el suelo', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_hacha_mano')"))
    aviso = pg.evaluate("document.getElementById('aviso').textContent")
    comprobar('el aviso dice que desaparece en una hora', 'una hora' in aviso, aviso)
    foto(pg, 'pc_hacha_en_el_suelo')
    ent = pg.evaluate(f"{K}.registroAcciones.entradas.at(-1)")
    comprobar('queda en el registro con su autor', ent and ent['tipo'] == 'soltar_suelo' and ent['autor'] == 'jugador:local' and ent['ok'])
    # cogerla con Usar, desde un paso al lado
    ir(pg, 0.6, 7.5)
    pg.wait_for_timeout(1200)
    comprobar('junto a ella, Usar se enciende', pg.evaluate("document.getElementById('btnUsar').classList.contains('activo')"))
    pg.evaluate(f"{K}.usar()"); pg.wait_for_timeout(250)
    comprobar('Usar la coge: vuelve a la mano y deja el suelo', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'hacha_mano' and pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.length") == 0)
    comprobar('y ya no se ve', not pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_hacha_mano')"))
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    # piedras: dos veces 3 en el mismo sitio hacen una pila de 6 que no desaparece
    ir(pg, -1.2, 10)
    for _ in range(2):
        en_mano(pg, 'piedra', 3); soltar_boton(pg, 'mano:der')
    pilas = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'piedra')")
    comprobar('las piedras soltadas en el mismo sitio hacen una pila', len(pilas) == 1 and pilas[0]['cosa']['n'] == 6, str([q['cosa']['n'] for q in pilas]))
    comprobar('la pila de piedras no desaparece', len(pilas) == 1 and pilas[0]['desaparece'] is None)
    # sílex: desaparece pasada la hora (se adelanta la hora guardada)
    ir(pg, 5, 8)
    en_mano(pg, 'silex', 4); soltar_boton(pg, 'mano:der')
    pg.evaluate(f"(() => {{ const k = {K}; const o = k.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'silex'); o.desaparece = Date.now() - 1; k.sueloObjetos.refrescar(); }})()")
    comprobar('pasada la hora, el sílex ya no está ni se ve', not pg.evaluate(f"{K}.sueloObjetos.suelo.visibles(Date.now()).some(o => o.cosa.tipo === 'silex')") and not pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_silex')"))
    # en tus tierras no desaparece
    pg.evaluate(f"{K}.mundo.mojon = {{ x: -6, z: 8 }}")
    ir(pg, -6, 9)
    en_mano(pg, 'rama', 2); soltar_boton(pg, 'mano:der')
    r = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'rama')")
    comprobar('en tus tierras (junto a tu mojón) no desaparece', r is not None and r['desaparece'] is None)
    pg.evaluate(f"{K}.mundo.mojon = null")
    # más cosas para verlas juntas: troncos, leña, un hatillo de fibra y una cesta
    pg.evaluate(f"""(() => {{ const s = {K}.sueloObjetos, t = Date.now();
      s.suelo.dejar({{ tipo: 'tronco_corto', n: 3 }}, 0.8, 11, t, 'jugador:local', false);
      s.suelo.dejar({{ tipo: 'lena', n: 8 }}, 2.4, 10.2, t, 'jugador:local', false);
      s.suelo.dejar({{ tipo: 'fibra', n: 6 }}, 1.6, 9.2, t, 'jugador:local', false);
      s.suelo.dejar({{ tipo: 'hacha_mano', n: 1 }}, 0.2, 9.3, t, 'jugador:local', false);
      s.suelo.dejar({{ tipo: 'cesta_recoleccion', n: 1, dentro: [{{ tipo: 'bayas', n: 5 }}, null, null, null, null, null] }}, -0.4, 11.3, t, 'jugador:local', false);
      s.refrescar(); s.guardar(); }})()""")
    ir(pg, -2.6, 8.6, dist=4.5, pitch=0.55, yaw=3.54)
    foto(pg, 'pc_cosas_en_el_suelo')
    ir(pg, -2.2, 9.0, dist=1.9, pitch=0.6, yaw=3.54)
    foto(pg, 'pc_pila_de_piedras_cerca')
    ir(pg, -0.6, 9.4, dist=2.0, pitch=0.6, yaw=3.54)
    foto(pg, 'pc_troncos_y_hatillos_cerca')
    # guardado: al recargar sigue ahí
    n_antes = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.length")
    pg.reload(); pg.wait_for_function('window.__kinhold !== undefined', timeout=30000); pg.wait_for_timeout(500)
    n_desp = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.length")
    comprobar('al recargar la página, lo del suelo sigue ahí (guardado)', n_antes > 0 and n_desp == n_antes, f'{n_antes} → {n_desp}')
    # coger de la pila: con una mano ocupada por el cuchillo, solo caben 3 en la otra; las otras 3 se quedan
    en_mano(pg, 'cuchillo', 1, 'mano:izq')
    ir(pg, -1.0, 9.6)
    pg.evaluate(f"{K}.usar()"); pg.wait_for_timeout(250)
    cog = pg.evaluate(f"{K}.inventario.cuantos('piedra')"); queda = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'piedra').map(o => o.cosa.n)")
    comprobar('de la pila de 6 se coge lo que cabe (3) y el resto se queda en el suelo', cog == 3 and queda == [3], f'{cog} cogidas, quedan {queda}')
    comprobar('sin errores en la página (PC)', not errores, '; '.join(errores[:3]))
    pg.close()

    print('Móvil: soltar y coger con los botones')
    pg, errores = abrir(nav, 390, 844, movil=True)
    ir(pg, 0, 8, dist=3.2)
    en_mano(pg, 'hacha_mano', 1)
    soltar_boton(pg, 'mano:der', movil=True)
    comprobar('móvil: «Soltar» deja el hacha en el suelo', pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.length") == 1)
    pg.evaluate(f"(() => {{ const s = {K}.sueloObjetos, t = Date.now(); s.suelo.dejar({{ tipo: 'piedra', n: 9 }}, -1.2, 9.8, t, 'jugador:local', false); s.suelo.dejar({{ tipo: 'tronco_corto', n: 2 }}, 1.2, 10.4, t, 'jugador:local', false); s.refrescar(); }})()")
    foto(pg, 'movil_cosas_en_el_suelo')
    pg.locator('#btnUsar').tap(); pg.wait_for_timeout(250)
    comprobar('móvil: el botón Usar la coge', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'hacha_mano')
    foto(pg, 'movil_cogida')
    comprobar('sin errores en la página (móvil)', not errores, '; '.join(errores[:3]))
    nav.close()

srv.shutdown()
print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
