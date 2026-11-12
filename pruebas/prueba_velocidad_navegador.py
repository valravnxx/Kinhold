# Prueba en navegador (Chromium sin pantalla): con pocos fotogramas se anda a la velocidad de siempre (valravnx, 12 nov:
# con pocos fps su chica andaba «hiperlenta», porque cada fotograma contaba como mucho 0,05 s y por debajo de 20 fps el
# juego iba a cámara lenta). Se frena el juego a propósito (cada fotograma ocupa el navegador 150 ms más), se anda 3 s
# hacia delante en llano y lo recorrido, por el tiempo real, tiene que ser la velocidad de andar (3,6 m/s).
# Uso: python3 pruebas/prueba_velocidad_navegador.py dist/kinhold_demo.html <carpeta>
# MUTAR=1: vuelve el recorte de antes (window.__mutarVelocidad): tiene que fallar.
import sys, os
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'
K = 'window.__kinhold'
ANDAR = 3.6   # m/s, a pie sin correr ni carga (src/juego/main.js)

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function('window.__kinhold !== undefined', timeout=60000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()')
    if MUTAR: pg.evaluate('window.__mutarVelocidad = true')
    # un sitio sin nada en 20 m, la cámara mirando al norte y el personaje quieto, sin carga
    pg.evaluate(f"""(() => {{ const k = {K};
      let x = 0, z = 0;
      for (let r = 0; r < 400; r += 7) {{ const cx = r, cz = -r;
        if (!k.obstaculos.some(o => Math.hypot(o.x - cx, o.z - cz) < 22 + (o.r || 0))) {{ x = cx; z = cz; break; }} }}
      k.pj.k = 0; k.pj.x = x; k.pj.z = z; k.cam.yaw = 0; }})()""")
    pg.wait_for_timeout(500)
    # el juego frenado a propósito: cada fotograma, 150 ms de trabajo más
    pg.evaluate("(function f() { const t = performance.now(); while (performance.now() - t < 150); requestAnimationFrame(f); })()")
    pg.wait_for_timeout(1000)
    # el tiempo, de cuando se pulsa a cuando se suelta la tecla, en la página (las esperas de aquí van con retraso)
    pg.evaluate("addEventListener('keydown', e => { if (e.key === 'w' && !window.__tW) window.__tW = [performance.now(), 0]; }, true); addEventListener('keyup', e => { if (e.key === 'w') window.__tW[1] = performance.now(); }, true)")
    ini = pg.evaluate(f"({{ x: {K}.pj.x, z: {K}.pj.z, f: {K}.renderer ? {K}.renderer.info.render.frame : 0 }})")
    pg.keyboard.down('w')
    pg.wait_for_timeout(3000)
    pg.keyboard.up('w')
    pg.wait_for_timeout(1500)   # que acabe el último fotograma con la tecla
    fin = pg.evaluate(f"({{ x: {K}.pj.x, z: {K}.pj.z, f: {K}.renderer ? {K}.renderer.info.render.frame : 0, tw: window.__tW }})")
    pg.screenshot(path=f'{SALIDA}/velocidad_pocos_fps.png')
    seg = (fin['tw'][1] - fin['tw'][0]) / 1000
    d = ((fin['x'] - ini['x']) ** 2 + (fin['z'] - ini['z']) ** 2) ** 0.5
    fps = (fin['f'] - ini['f']) / (seg + 1.5) if fin['f'] else None
    v = d / seg
    print(f'  {d:.1f} m en {seg:.1f} s: {v:.2f} m/s' + (f', {fps:.1f} fps' if fps else ''))
    comprobar('el juego va de verdad a pocos fotogramas', fps is None or fps < 12, f'{fps:.1f} fps' if fps else 'sin contar')
    # la tecla se pulsa y se suelta entre fotogramas: hasta un fotograma de más o de menos en cada punta
    comprobar('se anda a la velocidad de siempre (3,6 m/s) con pocos fotogramas', 0.75 * ANDAR <= v <= 1.2 * ANDAR, f'{v:.2f} m/s')
    comprobar('sin errores en la página', not errores, '; '.join(errores[:3]))
    nav.close()
srv.shutdown()
print('TODO BIEN' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
