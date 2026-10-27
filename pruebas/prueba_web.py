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
        # la alpha (la demo única, versión unificada) va arriba y sola; las pruebas sueltas, plegadas debajo
        import json as _json
        _rm = _json.load(open(os.path.join(RAIZ, '..', 'proyecto', 'roadmap.json'), encoding='utf-8'))
        _demo = next(p for p in _rm['prototipos'] if p['id'] == 'demo')
        _ult = _demo['versiones'][-1]['archivo']
        comprobar('la alpha va arriba y abre la última versión de la demo única',
                  pg.locator('#listaJuegos > .alpha').count() == 1 and pg.get_attribute('#listaJuegos .alpha [data-juego]', 'href') == _ult
                  and pg.is_visible('#listaJuegos .alpha [data-juego]'), _ult)
        comprobar('las pruebas sueltas están en un desplegable cerrado, con todas las demás',
                  pg.locator('#listaJuegos details.otras:not([open])').count() == 1 and pg.locator('details.otras .tarjeta').count() == len(_rm['prototipos']) - 1
                  and not pg.is_visible('details.otras .tarjeta [data-juego]'))
        pg.click('details.otras > summary'); pg.wait_for_timeout(200)
        comprobar('al abrir el desplegable se ven las pruebas sueltas', pg.is_visible('details.otras .tarjeta [data-juego]'))
        pg.click('details.otras > summary'); pg.wait_for_timeout(200)
        pg.evaluate('document.fonts.ready')
        _cargadas = pg.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/\"/g, ''))")
        comprobar('feria: guirnalda de banderines, cartel de madera y cada pestaña en un pergamino con dos rodillos',
                  pg.locator('#guirnalda .banderin').count() >= 8 and pg.locator('.cabecera .tabla h1').count() == 1
                  and pg.evaluate("[...document.querySelectorAll('section')].every(s => s.querySelector('.pergamino') && s.querySelectorAll('.pergamino > .rollo').length === 2)"))
        comprobar('las fuentes medievales se cargan', all(any(n in f for f in _cargadas) for n in ['EB Garamond', 'Alegreya SC', 'Cinzel Decorative']), ', '.join(sorted(set(_cargadas))))
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'{SALIDA}/{nombre}_1_jugar.png', full_page=True)
        for i, s in enumerate(['roadmap', 'diario', 'tiempos', 'decisiones', 'documentos'], 2):
            pg.click(f'nav button[data-s={s}]')
            pg.wait_for_timeout(250)
            comprobar(f'pestaña {s} visible y con contenido', pg.is_visible(f'#{s}') and len(pg.inner_text(f'#{s}').strip()) > 20)
            if s == 'diario':
                _n = len(_json.load(open(os.path.join(RAIZ, '..', 'proyecto', 'diario.json'), encoding='utf-8')))
                comprobar('diario: las 12 últimas a la vista y las demás en un desplegable',
                          pg.locator('#listaDiario > .entrada').count() == min(12, _n) and pg.locator('details.anteriores .entrada').count() == max(0, _n - 12))
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
        # ruso: botón RU, textos del roadmap y del diario en cirílico, documentos de diseño en ruso
        pg.click('#idiomas button[data-l=ru]'); pg.wait_for_timeout(200)
        comprobar('botón RU: la web en ruso', pg.inner_text('nav button[data-s=jugar]') == 'Играть' and pg.evaluate('document.documentElement.lang') == 'ru')
        pg.click('nav button[data-s=roadmap]'); pg.wait_for_timeout(200)
        txt = pg.inner_text('#roadmap')
        comprobar('en ruso, el roadmap está en cirílico', len(re.findall('[А-Яа-яЁё]', txt)) > 500 and not any(w in txt for w in [' de la ', ' para ', 'Pendiente', 'Hecho']), txt[:120])
        pg.screenshot(path=f'{SALIDA}/{nombre}_12_roadmap_ru.png', full_page=True)
        pg.click('nav button[data-s=diario]'); pg.wait_for_timeout(200)
        txt = pg.inner_text('#diario')
        comprobar('en ruso, el diario está en cirílico', len(re.findall('[А-Яа-яЁё]', txt)) > 2000 and ' de la ' not in txt, txt[:120])
        pg.screenshot(path=f'{SALIDA}/{nombre}_13_diario_ru.png')
        pg.click('nav button[data-s=jugar]'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/{nombre}_14_jugar_ru.png')
        docs_ru = pg.evaluate("[...document.querySelectorAll('a[data-doc]')].map(a => a.getAttribute('href'))")
        comprobar('en ruso, los documentos de diseño enlazan a la versión rusa', len(docs_ru) == 3 and all(h.startswith('diseno/ru/') for h in docs_ru), ', '.join(docs_ru))
        comprobar('en ruso, las tarjetas de documentos ya no dicen «пока на английском»', 'на английском' not in pg.inner_text('body'))
        # documentos de diseño en ruso: selector ES · EN · RU, misma estructura, texto en cirílico sin restos del español
        for d in ['gdd', 'sistemas', 'analisis']:
            pg.goto(URL + f'diseno/{d}.html'); pg.wait_for_timeout(150)
            n_es = pg.evaluate("[...document.querySelectorAll('section[id],h2,h3,li,tr,td,p')].length")
            with pg.expect_navigation():
                pg.click('#kh-idioma a[data-l=ru]')
            ru_txt = pg.inner_text('body')
            comprobar(f'{d}: el selector RU abre la traducción rusa', pg.url.endswith(f'diseno/ru/{d}.html') and pg.evaluate('document.documentElement.lang') == 'ru')
            comprobar(f'{d}: en ruso hay texto en cirílico, sin restos típicos del español', len(re.findall('[А-Яа-яЁё]', ru_txt)) > 3000 and not any(w in ru_txt for w in [' de la ', ' que ', ' para ', 'ción ']))
            comprobar(f'{d}: mismas secciones en español y en ruso', n_es == pg.evaluate("[...document.querySelectorAll('section[id],h2,h3,li,tr,td,p')].length"))
            ancho = pg.evaluate('document.documentElement.scrollWidth')
            comprobar(f'{d} (ruso): sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
            pg.screenshot(path=f'{SALIDA}/{nombre}_15_doc_{d}_ru.png')
            with pg.expect_navigation():
                pg.click('#kh-idioma a[data-l=en]')
            comprobar(f'{d}: desde el ruso, EN abre el inglés', pg.url.endswith(f'diseno/en/{d}.html'))
            with pg.expect_navigation():
                pg.click('#kh-idioma a[data-l=ru]')
            with pg.expect_navigation():
                pg.click('#kh-idioma a[data-l=es]')
            comprobar(f'{d}: desde el ruso, ES vuelve al español', pg.url.endswith(f'diseno/{d}.html') and pg.evaluate('document.documentElement.lang') == 'es')
        pg.goto(URL + '?lang=ru'); pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
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
            # la primera tarjeta es la demo única, que abre su menú (sin lienzo hasta elegir una parte)
            comprobar('el botón Jugar abre el juego', 'jugar/' in pg.url and (pg.locator('canvas').count() >= 1 or pg.locator('#demoMenu a.parte').count() == 3), pg.url)
            pg.screenshot(path=f'{SALIDA}/{nombre}_7_juego_abierto.png')
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
srv.shutdown()
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
