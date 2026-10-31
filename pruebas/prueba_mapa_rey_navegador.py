# Prueba en navegador del mapa del rey (valravnx, 31 oct): Whitholm, la isla del rey, cartografiada (src/juego/mapa_rey.js).
# Uso: python3 pruebas/prueba_mapa_rey_navegador.py <html de la demo> <carpeta_capturas>
# Comprueba, en PC y móvil: que el mapa se prepara solo en cuanto el mundo está listo (sin abrirlo y sin tirones: ningún
# paso de más de 80 ms), que se abre con M (PC) o con el botón «Mapa» (móvil) y se cierra con M, Esc o ✕; que tiene las 8
# comarcas con su nombre, los ríos, montes, árboles y la ciudad del rey; que tu marca está donde estás (y se mueve si
# andas) y que «Dónde estoy» la pone en el centro; y que en inglés no falta ningún texto.
# MUTAR=1: la marca del jugador, 3 km al este de donde está: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_mapa_rey'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in os.listdir(os.path.join(RAIZ, 'docs/recursos/personajes')):
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = os.environ.get('MUTAR', '')
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=40'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# dónde debería estar la marca: la posición del jugador en el mundo, pasada a la pantalla del mapa
DONDE = f"""() => {{ const k = {K}, m = k.mapaRey, p = [k.pj.x + k.mundoJ.salida.x, k.pj.z + k.mundoJ.salida.z];
  const e = m.kmAPant(p[0] / 1000, p[1] / 1000); return {{ esperada: e, marca: m.marca }}; }}"""

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil, lang in [('pc', {'width': 1280, 'height': 800}, False, 'es'), ('movil', {'width': 390, 'height': 844}, True, 'es'), ('pc_en', {'width': 1280, 'height': 800}, False, 'en')]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        if MUTAR == '1': ctx.add_init_script('window.__mutarMapaRey = true')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.goto(BASE + ('&lang=en' if lang == 'en' else ''))
        pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
        comprobar('la demo arranca sin error', not pg.evaluate('window.__demo.error'), str(pg.evaluate('window.__demo.error')))
        pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
        comprobar('hay mapa del rey en el mundo de verdad', pg.evaluate(f'!!{K}.mapaRey'))
        # se prepara solo, sin abrirlo, a pasos cortos
        try:
            pg.wait_for_function(f'{K}.mapaRey.listo', timeout=300000); listo = True
        except Exception: listo = False
        med = pg.evaluate(f'{K}.mapaRey.medida')
        comprobar('el mapa se prepara solo en cuanto el mundo está listo (sin abrirlo)', listo and not pg.evaluate(f'{K}.mapaRey.abierto'), str(med))
        comprobar('sin tirones al prepararlo (ningún paso de más de 80 ms)', med['msMaxPaso'] <= 80, f"{med['msMaxPaso']} ms el paso más largo, {med['msPintar']} ms en total")
        if not listo:   # que siga la prueba: al abrirlo se termina de golpe
            pg.evaluate(f'{K}.mapaRey.abrir()'); pg.wait_for_function(f'{K}.mapaRey.listo', timeout=120000); pg.evaluate(f'{K}.mapaRey.cerrar()')
        d = pg.evaluate(f'(() => {{ const d = {K}.mapaRey.datos; return {{ etiquetas: d.etiquetas.length, rios: d.rios.length, montes: d.montes.length, arboles: d.arboles.length }}; }})()')
        comprobar('las 8 comarcas con su nombre, ríos, montes y árboles', d['etiquetas'] == 8 and d['rios'] >= 10 and d['montes'] >= 20 and d['arboles'] >= 200, str(d))
        # el botón «Mapa», a la vista y dentro de la pantalla
        caja = pg.evaluate("(() => { const b = document.getElementById('btnMapa'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
        comprobar('el botón «Mapa» se ve y cabe en la pantalla', caja is not None and caja[0] >= 0 and caja[2] <= vista['width'] and caja[1] >= 0, str(caja))
        # abrir: con M en el PC, con el botón en el móvil
        if movil: pg.tap('#btnMapa')
        else: pg.keyboard.press('m')
        pg.wait_for_timeout(600)
        comprobar('se abre (' + ('botón' if movil else 'M') + ')', pg.evaluate(f'{K}.mapaRey.abierto'))
        # el papel pintado (no en blanco) y la marca donde estás
        px = pg.evaluate("""(() => { const c = document.querySelector('#mapaRey canvas'), g = c.getContext('2d');
          const d = g.getImageData(c.width / 2 - 40, c.height / 2 - 40, 80, 80).data; let n = 0, s = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { n++; s += d[i] + d[i + 1] + d[i + 2]; } return { opacos: n, media: n ? s / n / 3 : 0 }; })()""")
        comprobar('el mapa está pintado (papel, no en blanco)', px['opacos'] > 6000 and 60 < px['media'] < 245, str(px))
        r = pg.evaluate(DONDE)
        ok = r['marca'] and abs(r['marca']['x'] - r['esperada'][0]) < 2 and abs(r['marca']['y'] - r['esperada'][1]) < 2
        comprobar('tu marca está donde estás', bool(ok), str(r))
        pg.screenshot(path=f'{SALIDA}/{nombre}_mapa.png')
        # andar con el mapa abierto: la marca te sigue
        pg.evaluate(f'{K}.pj.x += 800; {K}.pj.z -= 500')
        pg.wait_for_timeout(700)
        r = pg.evaluate(DONDE)
        ok = r['marca'] and abs(r['marca']['x'] - r['esperada'][0]) < 2 and abs(r['marca']['y'] - r['esperada'][1]) < 2
        comprobar('la marca te sigue si andas con el mapa abierto', bool(ok), str(r))
        pg.evaluate(f'{K}.pj.x -= 800; {K}.pj.z += 500')
        # «Dónde estoy»: de cerca y con la marca en el centro
        if movil: pg.tap('#mapaRey .mr-yo')
        else: pg.click('#mapaRey .mr-yo')
        pg.wait_for_timeout(700)
        r = pg.evaluate(DONDE); v = pg.evaluate(f'{K}.mapaRey.vista')
        ok = r['marca'] and abs(r['marca']['x'] - vista['width'] / 2) < 40 and abs(r['marca']['y'] - vista['height'] / 2) < 40 and v['s'] > v['base'] * 2.5
        comprobar('«Dónde estoy» acerca el mapa y te pone en el centro', bool(ok), f"marca {r['marca']}, zoom {v['s'] / v['base']:.1f}")
        pg.screenshot(path=f'{SALIDA}/{nombre}_mapa_cerca.png')
        # la ciudad del rey, de cerca
        pg.evaluate(f"""(() => {{ const m = {K}.mapaRey; m.zoom(1, 0, 0); const v = m.vista, c = m.kmAPant(217.558, 52.73);
          m.zoom(1, 0, 0); }})()""")
        pg.evaluate(f"""(() => {{ const m = {K}.mapaRey, c = m.kmAPant(217.558, 52.73); m.zoom(1.6, c[0], c[1]); }})()""")
        pg.screenshot(path=f'{SALIDA}/{nombre}_mapa_ciudad.png')
        # cerrar: M o Esc en el PC, ✕ en el móvil
        if movil: pg.tap('#mapaRey .mr-cerrar')
        else: pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
        comprobar('se cierra (' + ('✕' if movil else 'Esc') + ')', not pg.evaluate(f'{K}.mapaRey.abierto'))
        if not movil:
            pg.keyboard.press('m'); pg.wait_for_timeout(300); a = pg.evaluate(f'{K}.mapaRey.abierto')
            pg.keyboard.press('m'); pg.wait_for_timeout(300); b = pg.evaluate(f'{K}.mapaRey.abierto')
            comprobar('M lo abre y lo vuelve a cerrar', a and not b)
        if lang == 'en':
            falta = pg.evaluate('[...window.__idioma.faltan]')
            comprobar('en inglés no falta ningún texto', not falta, str(falta[:6]))
        comprobar('sin errores en la página', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
