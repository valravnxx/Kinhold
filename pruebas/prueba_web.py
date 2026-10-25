# Prueba de la web de progreso (docs/) servida por HTTP como en GitHub Pages.
# Uso: python3 pruebas/prueba_web.py [carpeta_capturas]
import sys, os, re, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs')
SALIDA = sys.argv[1] if len(sys.argv) > 1 else 'capturas_web'
os.makedirs(SALIDA, exist_ok=True)
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Manejador = functools.partial(Silencioso, directory=RAIZ)
srv = socketserver.TCPServer(('127.0.0.1', 0), Manejador)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/'

with sync_playwright() as p:
    nav = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 860}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil)
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        malos = []
        pg.on('response', lambda r: malos.append(r.url) if r.status >= 400 else None)
        pg.goto(URL)
        pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
        comprobar('se ven los prototipos jugables', pg.locator('#listaJuegos .tarjeta').count() >= 2)
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'{SALIDA}/{nombre}_1_jugar.png', full_page=True)
        for i, s in enumerate(['roadmap', 'diario', 'tiempos', 'decisiones', 'documentos'], 2):
            pg.click(f'nav button[data-s={s}]')
            pg.wait_for_timeout(250)
            comprobar(f'pestaña {s} visible y con contenido', pg.is_visible(f'#{s}') and len(pg.inner_text(f'#{s}').strip()) > 20)
            pg.screenshot(path=f'{SALIDA}/{nombre}_{i}_{s}.png', full_page=True)
        # idiomas: botón EN y ?lang=en
        pg.click('nav button[data-s=roadmap]')
        pg.click('#idiomas button[data-l=en]')
        pg.wait_for_timeout(250)
        comprobar('el botón EN pasa la web a inglés', pg.inner_text('nav button[data-s=jugar]') == 'Play' and 'Building' in pg.inner_text('#roadmap') and 'Construcción' not in pg.inner_text('#roadmap'))
        pg.screenshot(path=f'{SALIDA}/{nombre}_8_roadmap_en.png', full_page=True)
        pg.click('nav button[data-s=diario]'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/{nombre}_9_diario_en.png')
        pg.reload(); pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
        comprobar('el idioma elegido se recuerda al recargar', pg.inner_text('nav button[data-s=jugar]') == 'Play')
        pg.click('#idiomas button[data-l=es]'); pg.wait_for_timeout(200)
        comprobar('y ES la devuelve al español', pg.inner_text('nav button[data-s=jugar]') == 'Jugar')
        pg.goto(URL + '?lang=en'); pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
        comprobar('?lang=en abre la web en inglés', pg.inner_text('nav button[data-s=jugar]') == 'Play')
        # documentos de diseño en inglés: la web en inglés enlaza a diseno/en/ y cada documento tiene selector ES · EN
        docs_en = pg.evaluate("[...document.querySelectorAll('a[data-doc]')].map(a => a.getAttribute('href'))")
        comprobar('en inglés, los documentos de diseño enlazan a la versión inglesa', len(docs_en) == 3 and all(h.startswith('diseno/en/') for h in docs_en), ', '.join(docs_en))
        for d in ['gdd', 'sistemas', 'analisis']:
            pg.goto(URL + f'diseno/{d}.html'); pg.wait_for_timeout(150)
            es_txt = pg.inner_text('body')
            if d == 'gdd': pg.screenshot(path=f'{SALIDA}/{nombre}_10_doc_{d}_es.png')
            with pg.expect_navigation():
                pg.click('#kh-idioma a[data-l=en]')
            en_txt = pg.inner_text('body')
            comprobar(f'{d}: el selector EN abre la traducción', pg.url.endswith(f'diseno/en/{d}.html') and pg.evaluate('document.documentElement.lang') == 'en')
            # misma estructura (mismas secciones) y texto distinto: no es una copia sin traducir
            mismo = pg.evaluate("[...document.querySelectorAll('section[id],h2,h3,li,tr')].length")
            comprobar(f'{d}: en inglés hay texto propio, sin restos típicos del español', es_txt != en_txt and not any(w in en_txt for w in [' de la ', ' que ', ' para ', 'ción ']))
            ancho = pg.evaluate('document.documentElement.scrollWidth')
            comprobar(f'{d} (inglés): sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
            pg.screenshot(path=f'{SALIDA}/{nombre}_11_doc_{d}_en.png')
            with pg.expect_navigation():
                pg.click('#kh-idioma a[data-l=es]')
            comprobar(f'{d}: el selector ES vuelve al español', pg.url.endswith(f'diseno/{d}.html') and '/en/' not in pg.url and pg.evaluate('document.documentElement.lang') == 'es')
            comprobar(f'{d}: mismas secciones en los dos idiomas', mismo == pg.evaluate("[...document.querySelectorAll('section[id],h2,h3,li,tr')].length"))
        pg.goto(URL); pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
        pg.click('#idiomas button[data-l=es]'); pg.wait_for_timeout(200)
        docs_es = pg.evaluate("[...document.querySelectorAll('a[data-doc]')].map(a => a.getAttribute('href'))")
        comprobar('en español, los documentos enlazan al original', all(not h.startswith('diseno/en/') for h in docs_es) and len(docs_es) == 3)
        # ruso: botón RU, textos del roadmap y del diario en cirílico, documentos de diseño al inglés (aún no hay ruso)
        pg.click('#idiomas button[data-l=ru]'); pg.wait_for_timeout(200)
        comprobar('botón RU: la web en ruso', pg.inner_text('nav button[data-s=jugar]') == 'Играть' and pg.evaluate('document.documentElement.lang') == 'ru')
        pg.click('nav button[data-s=roadmap]'); pg.wait_for_timeout(200)
        txt = pg.inner_text('#roadmap')
        comprobar('en ruso, el roadmap está en cirílico', len(re.findall('[А-Яа-яЁё]', txt)) > 2000 and not any(w in txt for w in [' de la ', ' para ', 'Pendiente', 'Hecho']), txt[:120])
        pg.screenshot(path=f'{SALIDA}/{nombre}_12_roadmap_ru.png', full_page=True)
        pg.click('nav button[data-s=diario]'); pg.wait_for_timeout(200)
        txt = pg.inner_text('#diario')
        comprobar('en ruso, el diario está en cirílico', len(re.findall('[А-Яа-яЁё]', txt)) > 2000 and ' de la ' not in txt, txt[:120])
        pg.screenshot(path=f'{SALIDA}/{nombre}_13_diario_ru.png')
        pg.click('nav button[data-s=jugar]'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/{nombre}_14_jugar_ru.png')
        docs_ru = pg.evaluate("[...document.querySelectorAll('a[data-doc]')].map(a => a.getAttribute('href'))")
        comprobar('en ruso, los documentos de diseño enlazan al inglés', len(docs_ru) == 3 and all(h.startswith('diseno/en/') for h in docs_ru), ', '.join(docs_ru))
        comprobar('en ruso, nada se sale por los lados', pg.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)
        pg.click('#idiomas button[data-l=es]'); pg.wait_for_timeout(200)
        # los enlaces internos existen
        enlaces = pg.evaluate("[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => !h.startsWith('http'))")
        for h in set(enlaces):
            r = pg.request.get(URL + h)
            if r.status >= 400: malos.append(h)
        comprobar('todos los enlaces internos responden', not malos, ', '.join(malos[:5]))
        # abrir un juego desde la tarjeta
        if not movil:
            pg.click('nav button[data-s=jugar]')
            with pg.expect_navigation():
                pg.locator('#listaJuegos [data-juego]').first.click()
            pg.wait_for_timeout(2500)
            comprobar('el botón Jugar abre el juego', 'jugar/' in pg.url and pg.locator('canvas').count() >= 1, pg.url)
            pg.screenshot(path=f'{SALIDA}/{nombre}_7_juego_abierto.png')
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
srv.shutdown()
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
