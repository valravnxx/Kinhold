# Prueba en navegador real (Chromium sin pantalla) del panel de inventario (hito 2) en la construcción.
# El inventario es el equipo (valravnx, 29 oct): tu personaje de verdad en el centro y los cuadros del equipo a los
# lados, sin manos ni hombro; lo de las manos y el hombro se coge del arcón (que hace de mundo), se ve abajo con
# «Soltar» y el personaje lleva puesto lo que dice el inventario. En PC se arrastra; en el móvil se toca y el panel va
# a pantalla completa. Comprueba lo que queda en la lógica (inventario con autor) y saca capturas.
# Uso: python3 pruebas/prueba_inventario_navegador.py dist/kinhold_hito1.html <carpeta>
# MUTAR=1 quita a propósito los huecos del cinturón en la página: tiene que fallar. MUTAR_RETRATO=1 impide dibujar el
# retrato (tiene que fallar la del retrato).
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/construccion'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/construccion/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v11'), f'{sitio}/recursos/personajes/taller-v11')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/construccion/prueba.html'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

def abrir_pagina(nav, **ctx):
    c = nav.new_context(locale='es-ES', **ctx)
    pg = c.new_page()
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function('window.__kinhold !== undefined', timeout=60000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()')
    if os.environ.get('MUTAR'): pg.evaluate(f'{K}.inventario.huecosCintura = () => []')
    if os.environ.get('MUTAR_RETRATO'): pg.evaluate(f'{K}.renderer.getPixelRatio = () => 100')
    pg.wait_for_timeout(500)
    return pg, errores

def lugar(pg, ruta):
    return pg.evaluate(f"(() => {{ const c = {K}.inventario.buscar('{ruta}').cosa; return c ? c.tipo + ':' + c.n : null; }})()")

R = lambda ruta: f'#panelInventario [data-ruta="{ruta}"]'
O = lambda tipo: f'#panelInventario .inv-objeto[data-tipo="{tipo}"]'

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)

    # ---------- PC: se arrastra ----------
    print('PC: arrastrar del arcón a la silueta y a los huecos')
    pg, errores = abrir_pagina(nav, viewport={'width': 1280, 'height': 800})
    pg.wait_for_function(f'{K}.jugador.mh', timeout=120000)
    pg.click('#btnInventario')
    comprobar('el botón abre el panel', pg.is_visible('#panelInventario'))
    n = pg.locator('#panelInventario .inv-sitio').count()
    comprobar('10 cuadros de equipo (espalda, cintura y 8 capas de ropa)', n == 10, str(n))
    comprobar('ni manos ni hombro en el panel (se cogen del mundo y se ven en el personaje)', pg.locator(R('mano:der')).count() + pg.locator(R('mano:izq')).count() + pg.locator(R('hombro')).count() == 0)
    pg.wait_for_timeout(1500)
    pix = pg.evaluate('''(() => { const c = document.querySelector('#panelInventario .inv-retrato'); if (!c.width) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++; return n / (c.width * c.height); })()''')
    comprobar('el retrato es tu personaje dibujado (un 10–60 % del cuadro)', 0.1 < pix < 0.6, f'{pix:.2f}')
    comprobar('empieza con camisa y pantalón de lino', lugar(pg, 'ropa:interior') == 'camisa_lino:1' and lugar(pg, 'ropa:piernas') == 'pantalon_lino:1')
    comprobar('sin cinturón no hay cuadros de cintura', pg.locator('#panelInventario .inv-cinto [data-ruta]').count() == 0)
    pg.screenshot(path=f'{SALIDA}/01_pc_inventario_inicial.png')

    pg.drag_and_drop(O('cinto_cuero'), R('cintura'))
    comprobar('arrastrar el cinto de cuero a la cintura se lo pone', lugar(pg, 'cintura') == 'cinto_cuero:1', str(lugar(pg, 'cintura')))
    nc = pg.locator('#panelInventario .inv-cinto [data-ruta]').count()
    comprobar('con el cinto, 3 cuadros de cintura bajo la silueta', nc == 3, str(nc))
    pg.drag_and_drop(O('cuchillo'), R('cintura/1'))
    comprobar('el cuchillo, arrastrado a un hueco pequeño del cinto', lugar(pg, 'cintura/1') == 'cuchillo:1', str(lugar(pg, 'cintura/1')))
    pg.drag_and_drop(O('hacha_mano'), R('cintura/2'))
    aviso = pg.inner_text('#panelInventario .inv-aviso')
    comprobar('el hacha (mediana) no entra en un hueco pequeño, y se dice por qué', lugar(pg, 'cintura/2') is None and 'No cabe' in aviso, aviso)
    pg.drag_and_drop(O('lenero'), R('espalda'))
    pg.click(R('espalda'))
    comprobar('tocar el leñero abre sus 6 huecos', pg.locator('#panelInventario .inv-huecos [data-ruta]').count() == 6, f"{lugar(pg, 'espalda')} · {pg.inner_text('#panelInventario .inv-aviso')} · {pg.evaluate(K + '.panelInventario.vista')}")
    pg.click(R('espalda'))  # deja de elegirlo
    pg.drag_and_drop(O('lena'), R('espalda/2'))
    comprobar('la leña entra en el leñero, una pila entera', lugar(pg, 'espalda/2') == 'lena:3', str(lugar(pg, 'espalda/2')))
    pg.drag_and_drop(O('piedra'), R('espalda/3'))
    comprobar('la piedra no entra en el leñero', lugar(pg, 'espalda/3') is None)
    pg.drag_and_drop(O('tunica_lana'), R('ropa:abrigo'))
    capas = pg.evaluate(f'{K}.jugador.mh.capas')
    comprobar('el personaje se pone la túnica que dice el inventario', 'tunica' in (capas or []), str(capas))
    pg.click(O('hacha_mano')); pg.click('#panelInventario .inv-manos')
    pg.click(O('saco')); pg.click('#panelInventario .inv-ponerse')
    comprobar('del arcón: el hacha con las manos y el saco al hombro', lugar(pg, 'mano:der') == 'hacha_mano:1' and lugar(pg, 'hombro') == 'saco:1', f"{lugar(pg, 'mano:der')} · {lugar(pg, 'hombro')}")
    comprobar('el hacha se ve en la mano del personaje', pg.evaluate(f'!!({K}.jugador.hacha && {K}.jugador.hachaEnMano)'))
    llevas = pg.inner_text('#llevas')
    comprobar('abajo se ve lo que llevas en la mano y al hombro', pg.is_visible('#llevas') and 'Hacha de mano' in llevas and 'Saco' in llevas, llevas)
    pg.drag_and_drop(R('cintura/1'), '#panelInventario .inv-arcon h3')
    comprobar('arrastrar el cuchillo del cinto al arcón lo deja', lugar(pg, 'cintura/1') is None)
    carga = pg.inner_text('#panelInventario .inv-carga')
    comprobar('se ve la carga y la velocidad', 'Carga:' in carga and 'velocidad' in carga, carga)
    reg = pg.evaluate(f"{K}.registroAcciones.entradas.filter(e => ['coger','mover','soltar','ponerse'].includes(e.tipo)).length")
    comprobar('cada cambio queda en el registro de acciones con autor', reg >= 8, str(reg))
    pg.click(R('espalda'))
    pg.screenshot(path=f'{SALIDA}/02_pc_inventario_lleno.png')
    pg.click('#panelInventario .inv-dejar')
    pg.keyboard.press('i')
    pg.click('#llevas [data-soltar="mano:der"]')
    comprobar('«Soltar» deja lo de la mano (y el hacha ya no se ve)', lugar(pg, 'mano:der') is None and not pg.evaluate(f'{K}.jugador.hachaEnMano'))
    pg.click('#llevas [data-soltar="hombro"]')
    comprobar('y lo del hombro; sin nada, la línea se esconde', lugar(pg, 'hombro') is None and not pg.is_visible('#llevas'))
    # se guarda: al recargar sigue lo mismo
    pg.reload(); pg.wait_for_function('window.__kinhold !== undefined', timeout=60000)
    comprobar('lo que llevas se guarda al recargar', lugar(pg, 'cintura') == 'cinto_cuero:1' and lugar(pg, 'espalda/2') == 'lena:3')
    pg.keyboard.press('i')
    comprobar('la tecla I abre el panel', pg.is_visible('#panelInventario'))
    pg.wait_for_function(f'{K}.jugador.mh', timeout=120000)   # el personaje se carga después de la página
    capas = pg.evaluate(f'{K}.jugador.mh && {K}.jugador.mh.capas')
    comprobar('al recargar, el personaje lleva otra vez la túnica', 'tunica' in (capas or []), str(capas))
    pg.keyboard.press('i')
    comprobar('y lo cierra', not pg.is_visible('#panelInventario'))
    pg.screenshot(path=f'{SALIDA}/03_pc_juego_con_boton.png')
    comprobar('sin errores en la página (PC)', not errores, '; '.join(errores[:3]))

    # ---------- Móvil: se toca, a pantalla completa ----------
    print('Móvil: tocar y pantalla completa')
    mv, errores = abrir_pagina(nav, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    mv.tap('#btnInventario')
    caja = mv.locator('#panelInventario').bounding_box()
    comprobar('en el móvil el panel ocupa la pantalla', caja and caja['width'] >= 389 and caja['height'] >= 843, str(caja))
    mv.tap(O('cuerda_trenzada')); mv.tap(R('cintura'))
    comprobar('tocar la cuerda y luego la cintura se la pone', lugar(mv, 'cintura') == 'cuerda_trenzada:1')
    nc = mv.locator('#panelInventario .inv-cinto [data-ruta]').count()
    comprobar('la cuerda trenzada da 2 cuadros de cintura', nc == 2, str(nc))
    mv.tap(O('bayas')); mv.tap(R('cintura/0'))
    comprobar('bayas en el primer hueco de la cuerda (pila de 10)', lugar(mv, 'cintura/0') == 'bayas:10', str(lugar(mv, 'cintura/0')))
    mv.tap(O('tronco_corto')); mv.locator('#panelInventario .inv-manos').scroll_into_view_if_needed(); mv.tap('#panelInventario .inv-manos')
    comprobar('el tronco corto (grande) se coge con las dos manos', lugar(mv, 'mano:der') == 'tronco_corto:1' and mv.evaluate(f"{K}.inventario.manoBloqueada('mano:izq')"))
    mv.tap(O('zurron')); mv.locator('#panelInventario .inv-ponerse').scroll_into_view_if_needed(); mv.tap('#panelInventario .inv-ponerse')
    comprobar('«Ponérselo» pone el zurrón a la espalda', lugar(mv, 'espalda') == 'zurron:1')
    mv.evaluate("document.querySelector('#panelInventario').scrollTop = 0")
    mv.tap(R('espalda'))
    mv.wait_for_timeout(200)
    mv.screenshot(path=f'{SALIDA}/04_movil_inventario.png')
    mv.evaluate("document.querySelector('#panelInventario').scrollTop = 1e5")
    mv.wait_for_timeout(200)
    mv.screenshot(path=f'{SALIDA}/05_movil_arcon.png')
    mv.tap('#panelInventario .inv-dejar') if mv.locator('#panelInventario .inv-dejar').count() else None
    mv.evaluate("document.querySelector('#panelInventario').scrollTop = 0")
    mv.tap('#panelInventario .inv-cerrar')
    comprobar('el ✕ cierra el panel', not mv.is_visible('#panelInventario'))
    caja = mv.locator('#llevas').bounding_box()
    comprobar('en el móvil, lo que llevas se ve abajo sin salirse de la pantalla', caja and caja['x'] >= 0 and caja['x'] + caja['width'] <= 390 and 'Tronco corto' in mv.inner_text('#llevas'), str(caja))
    mv.screenshot(path=f'{SALIDA}/06_movil_juego_llevas.png')
    comprobar('sin errores en la página (móvil)', not errores, '; '.join(errores[:3]))
    nav.close()

srv.shutdown()
print()
print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
