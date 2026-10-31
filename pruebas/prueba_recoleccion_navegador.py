# Prueba en navegador (Chromium sin pantalla): recoger del suelo y de las plantas en la construcción (nivel N0).
# Va junto a cada tipo de punto (ramas, piedra, sílex, ortigas, hierba larga), pulsa Usar y comprueba que lo recogido
# va al inventario por huecos, que el punto desaparece y que vuelve a salir pasado su tiempo. Capturas de cerca en PC
# (1280×800) y móvil (390×844).
# Uso: python3 pruebas/prueba_recoleccion_navegador.py dist/kinhold_hito1.html <carpeta>
# MUTAR=1: Usar no recoge (se quita el punto antes): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/construccion'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/construccion/prueba.html')
# la carpeta del taller que carga el juego (la dice src/mundo/eleccion.js), para no quedarse atrás cuando cambia
import re
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes', TALLER), f'{sitio}/recursos/personajes/{TALLER}')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-carga-v1'), f'{sitio}/recursos/personajes/taller-carga-v1')  # las de cargar del taller
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
TIPOS = ['ramas', 'piedra', 'silex', 'ortiga', 'hierba_larga']
DA = {'ramas': 'rama', 'piedra': 'piedra', 'silex': 'silex', 'ortiga': 'fibra', 'hierba_larga': 'fibra'}

def abrir(nav, w, h, movil=False):
    pg = nav.new_page(viewport={'width': w, 'height': h}, locale='es-ES', is_mobile=movil, has_touch=movil, device_scale_factor=2 if movil else 1)
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_function('window.__kinhold !== undefined', timeout=30000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar(); {K}.recoleccion.rec.estado = {{}}; {K}.recoleccion.refrescar()')
    pg.wait_for_timeout(800)
    return pg, errores

# pone al jugador a 0,9 m de un punto de ese tipo (n: el n-ésimo con más sitio alrededor, lejos de los árboles), mirándolo,
# con la cámara de lado para que se vean los dos
def ir(pg, tipo, dist_cam=3.2, n=0):
    return pg.evaluate(f"""(() => {{
      const k = {K}, sitio = q => Math.min(...k.obstaculos.filter(o => o.arbol).map(o => Math.hypot(o.x - q.x, o.z - q.z)));
      const p = k.recoleccion.puntos.filter(q => q.tipo === '{tipo}').sort((a, b) => sitio(b) - sitio(a))[{n}];
      k.pj.x = p.x + 0.2; k.pj.z = p.z + 0.9; k.pj.k = 0; k.pj.rot = Math.PI;
      k.cam.dist = {dist_cam}; k.cam.pitch = 0.42; k.cam.yaw = -Math.PI / 2 + 0.3;
      return p;
    }})()""")

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    print('PC: recoger cada cosa')
    pg, errores = abrir(nav, 1280, 800)
    n = pg.evaluate(f"(() => {{ const c = {{}}; for (const q of {K}.recoleccion.puntos) c[q.tipo] = (c[q.tipo] || 0) + 1; return c; }})()")
    comprobar('en la demo hay ramas, piedra, sílex, ortigas y hierba larga', all(n.get(t, 0) > 0 for t in TIPOS), str(n))
    zonas = pg.evaluate(f"""(() => {{ const k = {K}; const d = q => Math.hypot(q.x, q.z);
      const ps = k.recoleccion.puntos; return {{
        ramas: ps.filter(q => q.tipo === 'ramas').every(q => d(q) > 30),
        fibra: ps.filter(q => q.tipo === 'ortiga' || q.tipo === 'hierba_larga').every(q => d(q) < 25),
        piedra: ps.filter(q => q.tipo === 'piedra').every(q => d(q) > 62),
        silex: ps.filter(q => q.tipo === 'silex').every(q => Math.hypot(q.x - 50, q.z + 46) < 8) }}; }})()""")
    comprobar('cada cosa en su zona: ramas en el bosque, fibra en el claro, piedra en la ladera, sílex en la caliza', all(zonas.values()), str(zonas))
    cogidos = {}
    for tipo in TIPOS:
        pt = ir(pg, tipo); cogidos[tipo] = pt['id']
        pg.wait_for_timeout(500)
        pg.evaluate(f"{K}.render()")
        pg.screenshot(path=f'{SALIDA}/pc_{tipo}_antes.png')
        antes = pg.evaluate(f"{K}.inventario.cuantos('{DA[tipo]}')")
        activo = pg.evaluate("document.getElementById('btnUsar').classList.contains('activo')")
        comprobar(f'{tipo}: junto al punto, Usar se enciende', activo)
        if MUTAR: pg.evaluate(f"{K}.recoleccion.rec.estado['{pt['id']}'] = {{ vuelve: Date.now() + 1e9, veces: 1 }}")
        pg.evaluate(f"{K}.usar()")
        pg.wait_for_timeout(300)
        despues = pg.evaluate(f"{K}.inventario.cuantos('{DA[tipo]}')")
        aviso = pg.evaluate("document.getElementById('aviso').textContent")
        comprobar(f'{tipo}: Usar lo recoge y va al inventario', despues > antes, f'{antes} → {despues} · «{aviso}»')
        disp = pg.evaluate(f"{K}.recoleccion.rec.disponible('{pt['id']}', Date.now())")
        comprobar(f'{tipo}: el punto ya no está', not disp)
        pg.evaluate(f"{K}.render()")
        pg.screenshot(path=f'{SALIDA}/pc_{tipo}_despues.png')
        ent = pg.evaluate(f"{K}.registroAcciones.entradas.at(-1)")
        comprobar(f'{tipo}: queda en el registro con autor', ent and ent['tipo'] == 'recoger' and ent['autor'] == 'jugador:local' and ent['ok'])
        # vaciar las manos para la siguiente
        pg.evaluate(f"(() => {{ const i = {K}.inventario; i.lugares['mano:der'] = null; i.lugares['mano:izq'] = null; }})()")
    # vuelve a salir: se adelanta la hora de vuelta y se refresca
    pt = {'id': cogidos['ramas']}
    pg.evaluate(f"{K}.recoleccion.rec.estado['{pt['id']}'].vuelve = Date.now() - 1; {K}.recoleccion.refrescar()")
    comprobar('pasado su tiempo, el punto vuelve a salir', pg.evaluate(f"{K}.recoleccion.rec.disponible('{pt['id']}', Date.now())"))
    ir(pg, 'ramas'); r = pg.evaluate(f"({K}.usar(), document.getElementById('aviso').textContent)"); print('    ', r)  # vuelta a recoger las ramas que han vuelto: quedan en la mano
    # se guarda en el navegador: al recargar sigue agotado lo recogido
    pg.reload(); pg.wait_for_function('window.__kinhold !== undefined', timeout=30000); pg.wait_for_timeout(500)
    pid = cogidos['silex']
    comprobar('al recargar la página, lo recogido sigue sin salir (guardado)', not pg.evaluate(f"{K}.recoleccion.rec.disponible('{pid}', Date.now())"))
    comprobar('al recargar, lo recogido sigue en el inventario', pg.evaluate(f"{K}.inventario.cuantos('rama')") >= 1)
    # vista de las cinco cosas juntas, para valravnx: un poco más lejos
    for tipo in TIPOS:
        ir(pg, tipo, dist_cam=2.2, n=1); pg.wait_for_timeout(300); pg.evaluate(f"{K}.render()")
        pg.screenshot(path=f'{SALIDA}/pc_{tipo}_cerca.png')
    ir(pg, 'silex', dist_cam=7, n=2); pg.wait_for_timeout(300); pg.evaluate(f"{K}.render()")
    pg.screenshot(path=f'{SALIDA}/pc_afloramiento_caliza.png')
    comprobar('sin errores en la página (PC)', not errores, '; '.join(errores[:3]))
    pg.close()

    print('Móvil: recoger con el botón Usar')
    pg, errores = abrir(nav, 390, 844, movil=True)
    for tipo in ['ortiga', 'ramas']:
        ir(pg, tipo, dist_cam=5, n=2)
        pg.wait_for_timeout(400)
        antes = pg.evaluate(f"{K}.inventario.cuantos('{DA[tipo]}')")
        pg.evaluate(f"{K}.render()")
        pg.screenshot(path=f'{SALIDA}/movil_{tipo}_antes.png')
        if MUTAR: pg.evaluate(f"{K}.recoleccion.rec.estado = Object.fromEntries({K}.recoleccion.puntos.map(q => [q.id, {{ vuelve: Date.now() + 1e9, veces: 1 }}]))")
        pg.locator('#btnUsar').tap()
        pg.wait_for_timeout(300)
        despues = pg.evaluate(f"{K}.inventario.cuantos('{DA[tipo]}')")
        comprobar(f'móvil, {tipo}: el botón Usar lo recoge', despues > antes, f'{antes} → {despues}')
        pg.evaluate(f"{K}.render()")
        pg.screenshot(path=f'{SALIDA}/movil_{tipo}_despues.png')
        pg.evaluate(f"(() => {{ const i = {K}.inventario; i.lugares['mano:der'] = null; i.lugares['mano:izq'] = null; }})()")
    comprobar('sin errores en la página (móvil)', not errores, '; '.join(errores[:3]))
    nav.close()

srv.shutdown()
print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
