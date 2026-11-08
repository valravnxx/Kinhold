# Prueba en navegador (Chromium sin pantalla) de quitar el mojón desde el juego (valravnx, 4 nov: destruir el mojón y
# con ello dejar tu tierra, con aviso de que se pierde lo construido, para poder reposicionar).
# En Desmontar, al apuntar a tu mojón se resalta en rojo lo que se perdería y el aviso lo dice; al confirmar, el mojón y
# lo construido desaparecen y se puede poner el mojón en otro sitio. En PC (1280×800) y en móvil (390×844), con capturas.
# Uso: python3 pruebas/prueba_quitar_mojon_navegador.py <html> <carpeta_capturas>
# MUTAR=1: el juego no sabe lo que se perdería (el aviso no sale): la prueba tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['taller-v24', 'taller-carga-v3', 'taller-dormir-v1', 'taller-sentarse-v1']:
    shutil.copytree(os.path.join(RAIZ, f'docs/recursos/personajes/{c}'), f'{sitio}/recursos/personajes/{c}')
# las imágenes de lo que llevas (la barra de abajo) y el kit de la interfaz, como en la web
import re as _rk
for _c in _rk.findall(r"CARPETA_(?:ICONOS|INTERFAZ) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{_c}'): shutil.copytree(os.path.join(RAIZ, 'docs', _c), f'{sitio}/{_c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = bool(os.environ.get('MUTAR'))
K = 'window.__kinhold'
fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

def recorrido(pg, nombre, movil):
    ev = pg.evaluate
    pg.goto(URL); pg.wait_for_function(f'{K} !== undefined', timeout=20000)
    ev(f'localStorage.clear(); {K}.reiniciar()'); pg.wait_for_timeout(800)
    def poner(clase, tipo, x, z):
        if clase in ('mojon', 'deco'): ev(f"{K}.llevarPara('{clase}','{tipo}')")  # se pagan de lo que llevas: del arcón de pruebas
        ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=0; {K}.seleccionar('{clase}','{tipo}'); {K}.apuntar({x},{z}); {K}.colocar(); {K}.terminarObras()")
    poner('mojon', 'mojon', -3, -6)
    comprobar(f'{nombre}: mojón colocado', ev(f'!!{K}.miMojon'))
    poner('pieza', 'cim_piedra', 1, 1); poner('pieza', 'cim_piedra', 3, 1); poner('pieza', 'muro_tronco', 1, 0)
    poner('deco', 'mesa', 2, 1.5)
    n = ev(f'{K}.mundo.construcciones.reduce((n, c) => n + c.piezas.size, 0) + {K}.mundo.decoracion.length')
    comprobar(f'{nombre}: 3 piezas y 1 mueble construidos', n == 4, f'{n}')
    if MUTAR: ev(f'{K}.mundo.perderiaSinMojon = () => null')
    # Desmontar y apuntar al mojón (su sitio en pantalla sale de proyectar su posición)
    ev(f"{K}.cambiarModo('desmontar')"); pg.wait_for_timeout(300)
    m = ev(f'{K}.miMojon'); y = ev(f'{K}.alturaSuelo ? {K}.alturaSuelo({m["x"]}, {m["z"]}) : 0') or 0
    p = ev(f'{K}.proyectar({m["x"]}, {y} + 0.5, {m["z"]})')
    ev(f'{K}.elegirPieza({p["x"]}, {p["y"]})'); pg.wait_for_timeout(200)
    aviso = pg.inner_text('#aviso')
    comprobar(f'{nombre}: al apuntar al mojón avisa de que se pierde lo construido, con la cuenta', 'PIERDES' in aviso and '4 piezas' in aviso, aviso)
    comprobar(f'{nombre}: el aviso es de los rojos (error)', ev("document.getElementById('aviso').className") == 'error')
    comprobar(f'{nombre}: sale el botón de confirmar', ev("!document.getElementById('confirmar').hidden"))
    rojos = ev("(() => { let n = 0; window.__kinhold.escena.traverse(o => { if (o.isMesh && o.userData.matOriginal) n++; }); return n; })()")
    comprobar(f'{nombre}: lo que se perdería queda resaltado (y el mojón)', rojos >= 4, f'{rojos} mallas')
    pg.screenshot(path=f'{SALIDA}/{"02_movil" if movil else "01_pc"}_aviso_quitar_mojon.png')
    ev(f'{K}.confirmarDesmontaje()'); pg.wait_for_timeout(400)
    aviso = pg.inner_text('#aviso')
    comprobar(f'{nombre}: al confirmar, el mojón desaparece y la tierra queda libre', not ev(f'{K}.miMojon') and ev(f'{K}.mundo.mojones') == {}, aviso)
    n = ev(f'{K}.mundo.construcciones.length + {K}.mundo.decoracion.length')
    comprobar(f'{nombre}: y lo construido se ha perdido', n == 0, f'{n}')
    comprobar(f'{nombre}: el aviso dice lo perdido y que se puede volver a poner', 'perdido' in aviso and 'Pon el mojón' in aviso, aviso)
    comprobar(f'{nombre}: vuelve al modo mover', ev(f'{K}.estado.modo') == 'mover')
    poner('mojon', 'mojon', 8, 8)
    mj = ev(f'{K}.miMojon')
    comprobar(f'{nombre}: se vuelve a poner el mojón en otro sitio', bool(mj) and mj['x'] == 8, str(mj))
    poner('pieza', 'cim_piedra', 11, 11)
    comprobar(f'{nombre}: y se construye en la tierra nueva', ev(f'{K}.mundo.construcciones.length') == 1)
    pg.screenshot(path=f'{SALIDA}/{"04_movil" if movil else "03_pc"}_mojon_repuesto.png')
    # lo guardado sobrevive a recargar: sin el mojón viejo ni lo perdido
    pg.reload(); pg.wait_for_function(f'{K} !== undefined', timeout=20000); pg.wait_for_timeout(800)
    mj = ev(f'{K}.miMojon')
    comprobar(f'{nombre}: al recargar sigue el mojón nuevo y solo lo nuevo', bool(mj) and mj['x'] == 8 and ev(f'{K}.mundo.construcciones.length') == 1, str(mj))

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    errores = []
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    pg.on('pageerror', lambda e: errores.append(str(e)))
    print('PC'); recorrido(pg, 'PC', False)
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
    mv = ctx.new_page(); mv.on('pageerror', lambda e: errores.append(str(e)))
    print('Móvil'); recorrido(mv, 'móvil', True)
    comprobar('sin errores de página', not errores, '; '.join(errores)[:300])
    nav.close()
print(f'\n{"HAY FALLOS: " + ", ".join(fallos) if fallos else "TODO CORRECTO"} · capturas en {SALIDA}')
sys.exit(1 if fallos else 0)
