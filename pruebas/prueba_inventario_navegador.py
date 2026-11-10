# Prueba en navegador real (Chromium sin pantalla) del panel de equipo (antes «inventario») en la construcción.
# El inventario es el equipo (valravnx, 29 oct; desde el 7 nov se llama «Equipo», con las imágenes y el estilo del
# panel de fabricar): tu personaje de verdad en el centro, los cuadros del equipo a los lados y, debajo, las manos y el
# hombro; lo que llevas puesto se puede quitar a las manos o dejar en el suelo desde su ficha. Lo de las manos y el
# hombro se ve también abajo con «Soltar» y el personaje lleva puesto lo que dice el inventario. En PC se arrastra; en
# el móvil se toca y el panel va a pantalla completa. Comprueba lo que queda en la lógica (inventario con autor) y saca
# capturas.
# Uso: python3 pruebas/prueba_inventario_navegador.py dist/kinhold_demo.html <carpeta>
# MUTAR_BARRA=1 deja la barra de abajo sin imágenes (tiene que fallar la de la barra). MUTAR=1 quita a propósito los huecos del cinturón en la página: tiene que fallar. MUTAR_RETRATO=1 impide dibujar el
# retrato (tiene que fallar la del retrato). MUTAR_QUITAR=1 hace que la lógica no deje quitarse nada (tienen que fallar
# las de quitarse a las manos).
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v24'), f'{sitio}/recursos/personajes/taller-v24')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-carga-v3'), f'{sitio}/recursos/personajes/taller-carga-v3')  # las de cargar del taller
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-dormir-v1'), f'{sitio}/recursos/personajes/taller-dormir-v1')  # tumbarse y levantarse
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-sentarse-v1'), f'{sitio}/recursos/personajes/taller-sentarse-v1')  # sentarse en el suelo
import re as _re
_ICONOS = _re.search(r"CARPETA_ICONOS = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()).group(1)
shutil.copytree(os.path.join(RAIZ, 'docs', _ICONOS), f'{sitio}/{_ICONOS}')  # las imágenes de cada cosa
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
    if os.environ.get('MUTAR_BARRA'): pg.evaluate('window.__sinImagenes = true')
    pg.wait_for_timeout(500)
    return pg, errores

def lugar(pg, ruta):
    return pg.evaluate(f"(() => {{ const c = {K}.inventario.buscar('{ruta}').cosa; return c ? c.tipo + ':' + c.n : null; }})()")

R = lambda ruta: f'#panelInventario [data-ruta="{ruta}"]'
O = lambda tipo: f'#panelInventario .inv-objeto[data-tipo="{tipo}"]:not([data-muestra])'
M = lambda i: f'#panelInventario .inv-objeto[data-muestra="{i}"]'   # ropa cosida de muestra (con hechura y tinte)

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
    comprobar('el panel se llama «Equipo» (el botón y el título)', pg.inner_text('#btnInventario').strip() == 'Equipo' and pg.inner_text('#panelInventario h2').strip() == 'Equipo')
    comprobar('las manos y el hombro, en el panel', pg.locator(R('mano:der')).count() == 1 and pg.locator(R('mano:izq')).count() == 1 and pg.locator(R('hombro')).count() == 1)
    pg.locator(O('hacha_mano')).scroll_into_view_if_needed()
    pg.wait_for_function("[...document.querySelectorAll('#panelInventario .inv-objeto img')].filter(i => i.complete && i.naturalWidth > 0).length > 5", timeout=20000)
    comprobar('lo del arcón, con la imagen de su modelo', pg.evaluate(f"(() => {{ const i = document.querySelector('{O('hacha_mano')} img'); return !!i && i.complete && i.naturalWidth > 0; }})()"))
    comprobar('lo de la camisa puesta se ve con su imagen (la prenda dibujada)', pg.locator(R('ropa:interior') + ' svg.ic-prenda').count() == 1)
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
    aviso = pg.inner_text('#panelInventario .inv-aviso')
    comprobar('con el hacha en la mano, el saco no se sube al hombro (valravnx, 1 nov)', lugar(pg, 'hombro') is None and 'manos' in aviso, aviso)
    pg.click(O('odre')); pg.click('#panelInventario .inv-ponerse')
    comprobar('del arcón: el hacha con las manos y el odre colgado al hombro', lugar(pg, 'mano:der') == 'hacha_mano:1' and lugar(pg, 'hombro') == 'odre:1', f"{lugar(pg, 'mano:der')} · {lugar(pg, 'hombro')}")
    comprobar('el hacha se ve en la mano del personaje', pg.evaluate(f'!!({K}.jugador.hacha && {K}.jugador.hachaEnMano)'))
    llevas = pg.inner_text('#llevas')
    comprobar('abajo se ve lo que llevas en la mano y al hombro', pg.is_visible('#llevas') and 'Hacha de mano' in llevas and 'Odre' in llevas, llevas)
    # la barra de abajo (estudio de la interfaz, 7 nov): cada cosa con su imagen en su hueco, las manos y el hombro, y
    # cada una con su botón de soltar; el hueco con el kit renderizado (se ha cargado de verdad)
    barra = pg.evaluate('''(() => { const l = document.getElementById('llevas');
      const imgs = [...l.querySelectorAll('.hu > img')].filter(i => i.complete && i.naturalWidth > 0).length;
      const fondo = getComputedStyle(l.querySelector('.hu')).backgroundImage;
      return { huecos: l.querySelectorAll('.hu').length, imgs, soltar: l.querySelectorAll('[data-soltar]').length, hombro: !!l.querySelector('.hu.hombro'), fondo }; })()''')
    comprobar('la barra de abajo: las dos manos, el hombro y el cinto, cada cosa con su imagen y su botón de soltar', barra['huecos'] >= 4 and barra['imgs'] >= 3 and barra['soltar'] == 2 and barra['hombro'] and 'interfaz-v1/hueco.webp' in barra['fondo'], str(barra))
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
    comprobar('y lo del hombro; sin nada, abajo quedan las dos manos vacías (sin nada que soltar)', lugar(pg, 'hombro') is None and pg.is_visible('#llevas') and pg.locator('#llevas [data-soltar]').count() == 0 and pg.locator('#llevas .hu').count() >= 2)
    # se guarda: al recargar sigue lo mismo
    pg.reload(); pg.wait_for_function('window.__kinhold !== undefined', timeout=60000)
    comprobar('lo que llevas se guarda al recargar', lugar(pg, 'cintura') == 'cinto_cuero:1' and lugar(pg, 'espalda/2') == 'lena:3')
    # herramientas que se gastan (10 nov; src/logica/desgaste.js): la ficha dice lo que le queda (un hacha de piedra
    # muy gastada: 150 golpes de 168; en el juego los cuenta el servidor)
    pg.evaluate(f"{K}.inventario.lugares['mano:der'] = {{ tipo: 'hacha_piedra', n: 1, usado: 150 }}")
    pg.keyboard.press('i')
    comprobar('la tecla I abre el panel', pg.is_visible('#panelInventario'))
    pg.click(R('mano:der'))
    gasto = pg.inner_text('#panelInventario .eq-desgaste') if pg.locator('#panelInventario .eq-desgaste').count() else ''
    comprobar('la ficha del hacha dice cuánto le queda (18 usos de 168), con su barra en rojo', '18' in gasto and '168' in gasto and pg.locator('#panelInventario .eq-desgaste .eq-poco').count() == 1, gasto)
    # y dónde se repara (10 nov): en la piedra de tallar, con un cordel dejado en ella
    nota = pg.inner_text('#panelInventario .eq-sel') if pg.locator('#panelInventario .eq-sel').count() else pg.inner_text('#panelInventario')
    comprobar('la ficha del hacha dice dónde y con qué se repara (la piedra de tallar, un cordel)', 'piedra de tallar' in nota and 'cordel' in nota.lower(), nota[:300])
    pg.screenshot(path=f'{SALIDA}/08_pc_ficha_desgaste.png')
    pg.click('#panelInventario .inv-dejar')
    pg.evaluate(f"{K}.inventario.lugares['mano:der'] = null; {K}.panelInventario.pintar()")   # (lo que sigue, con la mano libre)
    pg.wait_for_function(f'{K}.jugador.mh', timeout=120000)   # el personaje se carga después de la página
    capas = pg.evaluate(f'{K}.jugador.mh && {K}.jugador.mh.capas')
    comprobar('al recargar, el personaje lleva otra vez la túnica', 'tunica' in (capas or []), str(capas))
    # ropa cosida: cada prenda con su hechura y su tinte, en el inventario y puesta
    pg.drag_and_drop(R('ropa:abrigo'), '#panelInventario .inv-arcon h3')
    pg.drag_and_drop(M(0), R('ropa:abrigo'))
    pg.drag_and_drop(M(4), R('ropa:exterior'))
    c = pg.evaluate(f"{K}.inventario.lugares['ropa:abrigo']")
    comprobar('la túnica cosida entra con su hechura y su tinte', bool(c) and c.get('tinte') == 'glasto' and (c.get('hechura') or {}).get('corte') == 'corto', str(c))
    txt = pg.inner_text(R('ropa:abrigo'))
    comprobar('su cuadro dice la hechura y el tinte', 'Sarga' in txt and 'glasto' in txt, txt)
    if os.environ.get('MUTAR_COSIDA'): pg.evaluate(f"{K}.jugador.mh.ponerTintes({{}}); {K}.jugador.mh.ponerHechuras({{}})")
    puesto = pg.evaluate(f"""(() => {{ const m = {K}.jugador.mh; let cota = -100; m.modelo.traverse(n => {{ if (n.isMesh && /_capa_cota_falda$/.test(n.name)) cota = m.corteDe(n); }});
      return {{ tinte: m.tintes.prendas.tunica, corte: m.hechuras.tunica.corte, tejido: m.hechuras.tunica.tejido, cota: m.hechuras.cota.corte, alturaCota: cota, capas: m.capas }}; }})()""")
    comprobar('puesta: la túnica corta, de sarga y azul, y la cota corta', puesto['tinte'] == 'glasto' and puesto['corte'] == 'corto' and puesto['tejido'] == 'sarga' and puesto['cota'] == 'corto' and puesto['alturaCota'] > -50 and 'cota' in puesto['capas'], str(puesto))
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/04_pc_ropa_cosida.png')
    pg.keyboard.press('i')
    pg.evaluate(f"Object.assign({K}.cam, {{ dist: 2.8, pitch: 0.3 }})")   # de cerca, para ver la ropa
    pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{SALIDA}/05_pc_ropa_cosida_juego.png')
    pg.evaluate(f"Object.assign({K}.cam, {{ dist: 16, pitch: 0.9 }})")
    pg.keyboard.press('i')
    pg.drag_and_drop(R('ropa:abrigo'), M(1))   # la devuelve al arcón: suelta sobre el arcón
    pg.drag_and_drop(M(1), R('ropa:abrigo'))
    c2 = pg.evaluate(f"{K}.inventario.lugares['ropa:abrigo']")
    comprobar('otra túnica cosida, con lo suyo (cuadros y verde)', bool(c2) and c2.get('tinte') == 'verde' and (c2.get('hechura') or {}).get('tejido') == 'cuadros' and pg.evaluate(f"{K}.jugador.mh.tintes.prendas.tunica") == 'verde', str(c2))
    # lo que llevas puesto se quita: a las manos o al suelo (valravnx, 7 nov)
    if os.environ.get('MUTAR_QUITAR'): pg.evaluate(f"{K}.inventario.quitarse = () => ({{ ok: false, motivo: 'No.' }})")
    pg.click(R('ropa:abrigo'))
    ficha = pg.inner_text('#panelInventario .inv-sel')
    comprobar('la ficha de lo puesto dice qué es, dónde lo llevas y qué se puede hacer', 'Túnica' in ficha and 'Lo llevas puesto' in ficha and 'Quitártelo a las manos' in ficha and 'Dejarlo en el suelo' in ficha, ficha.replace('\n', ' · '))
    comprobar('la ficha enseña su imagen grande', pg.locator('#panelInventario .inv-sel .eq-grande svg').count() == 1)
    pg.screenshot(path=f'{SALIDA}/06_pc_ficha_puesto.png')
    pg.click('#panelInventario .inv-manos')
    capas = pg.evaluate(f'{K}.jugador.mh.capas')
    comprobar('«Quitártelo a las manos»: la túnica pasa a la mano y deja de verse puesta', lugar(pg, 'mano:der') == 'tunica_lana:1' and lugar(pg, 'ropa:abrigo') is None and 'tunica' not in (capas or []), f"{lugar(pg, 'mano:der')} · {capas} · {pg.inner_text('#panelInventario .inv-aviso')}")
    comprobar('y sale en su cuadro de la mano', pg.locator(R('mano:der') + '.lleno svg.ic-prenda').count() == 1)
    pg.click(R('mano:der')); pg.click('#panelInventario .inv-ponerse')
    comprobar('de la mano, «Ponértelo» la vuelve a poner', lugar(pg, 'ropa:abrigo') == 'tunica_lana:1' and lugar(pg, 'mano:der') is None)
    antes = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'cinto_cuero').length")
    pg.click(R('cintura')); pg.click('#panelInventario .inv-suelo')
    despues = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'cinto_cuero').length")
    comprobar('«Dejarlo en el suelo»: el cinturón puesto queda a tus pies', lugar(pg, 'cintura') is None and despues == antes + 1, f"{lugar(pg, 'cintura')} · {antes}→{despues}")
    comprobar('sin cinturón, ya no salen sus huecos', pg.locator('#panelInventario .inv-cinto [data-ruta]').count() == 0)
    reg = pg.evaluate(f"{K}.registroAcciones.entradas.filter(e => e.tipo === 'quitarse').length")
    comprobar('quitarse queda en el registro de acciones con autor', reg >= 1, str(reg))
    pg.click(R('espalda'))
    pg.screenshot(path=f'{SALIDA}/07_pc_equipo_quitado.png')
    pg.click('#panelInventario .inv-dejar')
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
    mv.evaluate("document.querySelector('#panelInventario .eq-centro').scrollTop = 0")
    mv.tap(R('espalda'))
    mv.wait_for_timeout(200)
    mv.screenshot(path=f'{SALIDA}/04_movil_inventario.png')
    ficha = mv.locator('#panelInventario .inv-sel').bounding_box()
    comprobar('móvil: la ficha sale abajo y deja ver el equipo', ficha and ficha['y'] > 844 * 0.45 and ficha['y'] + ficha['height'] <= 845, str(ficha))
    comprobar('móvil: la ficha de la espalda deja dejarlo en el suelo', mv.locator('#panelInventario .inv-suelo').is_visible())
    mv.evaluate("document.querySelector('#panelInventario .eq-centro').scrollTop = 1e5")
    mv.wait_for_timeout(200)
    mv.screenshot(path=f'{SALIDA}/05_movil_arcon.png')
    mv.tap('#panelInventario .inv-dejar') if mv.locator('#panelInventario .inv-dejar').count() else None
    mv.evaluate("document.querySelector('#panelInventario .eq-centro').scrollTop = 0")
    mv.evaluate(f"{K}.inventario.poner({K}.inventario.buscar('cintura/1'), {{ tipo: 'cuchillo', n: 1, usado: 100 }}); {K}.panelInventario.pintar && {K}.panelInventario.pintar()")
    mv.tap(R('cintura/1')); mv.wait_for_timeout(200)
    gasto = mv.inner_text('#panelInventario .eq-desgaste') if mv.locator('#panelInventario .eq-desgaste').count() else ''
    comprobar('móvil: la ficha del cuchillo dice cuánto le queda (300 usos de 400)', '300' in gasto and '400' in gasto, gasto)
    mv.screenshot(path=f'{SALIDA}/07_movil_ficha_desgaste.png')
    comprobar('móvil: el cuchillo (de hierro) no dice que se repare aún', 'Se repara' not in mv.inner_text('#panelInventario'))
    mv.tap('#panelInventario .inv-dejar') if mv.locator('#panelInventario .inv-dejar').count() else None
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
