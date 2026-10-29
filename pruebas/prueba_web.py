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

# Quién trabaja en qué: la página mira proyecto/sesion.json y el último commit de cada rama en GitHub. En la prueba se
# le sirve un estado fijo: el agente A empezó hace 10 min, el chat empezó hace 3 h pero subió un avance hace 5 min
# (vivo por su latido) y el agente B empezó hace 3 h y no ha subido nada (cortado). Las tareas que llevan A y el chat
# salen «en proceso»; las demás en_curso, también la de B, «a medias».
import json as _json, datetime as _dt
_rm0 = _json.load(open(os.path.join(RAIZ, '..', 'proyecto', 'roadmap.json'), encoding='utf-8'))
_ec = [(h, t) for h in _rm0['hitos'] for t in h['tareas'] if t['estado'] == 'en_curso']
_hace = lambda m: (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(minutes=m)).isoformat()
_roles = [('A', 10, None), ('chat:trabajo/prueba-chat', 180, 5), ('B', 180, 200)]
SESION = {'A': None, 'B': None}
RAMAS = {}
for (h, t), (clave, empezo, avance) in zip(_ec, _roles):
    rama = 'trabajo/prueba-' + clave.replace(':', '-').replace('/', '-')
    SESION[clave] = {'inicio': _hace(empezo), 'tarea': t['nombre'], 'hito': h['id'], 'rama': rama}
    if avance: RAMAS[rama] = _hace(avance)
VIVAS = [SESION[c]['tarea'] for c, _, _ in _roles[:2] if SESION.get(c)]
def servir_github(ctx, sesion):
    ctx.route('https://raw.githubusercontent.com/**', lambda r: r.fulfill(status=200, content_type='application/json', body=_json.dumps(sesion)))
    def rama(r):
        nombre = r.request.url.split('/branches/', 1)[1]
        # una rama sin avances: su último commit es de antes de empezar
        r.fulfill(status=200, content_type='application/json', body=_json.dumps({'commit': {'commit': {'committer': {'date': RAMAS.get(nombre, _hace(400))}}}}))
    ctx.route('https://api.github.com/**', rama)

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
        servir_github(ctx, SESION)
        pg.goto(URL)
        pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
        # quién trabaja en qué: «ahora mismo» y el roadmap con lo que llevan los agentes vivos (y nada más)
        pg.click('#idiomas button[data-l=es]')
        pg.wait_for_selector('html[data-agentes=mirados]', state='attached', timeout=15000)
        _ahora = pg.evaluate("[...document.querySelectorAll('#ahora li')].map(li => li.dataset.quien + '|' + li.querySelector('.que').firstChild.textContent)")
        comprobar('«ahora mismo» lista solo los agentes vivos, cada uno con su tarea (el chat, vivo por su último avance)',
                  sorted(x.split('|', 1)[1] for x in _ahora) == sorted(VIVAS) and all(x.split('|')[0] in ('A', 'chat') for x in _ahora), '; '.join(x[:50] for x in _ahora))
        _li = pg.evaluate("[...document.querySelectorAll('#listaHitos li')].map(li => [li.className, li.querySelector('span').textContent, li.querySelector('em').textContent])")
        _proceso = [x for x in _li if x[0] == 'en_curso']
        comprobar('roadmap: «en proceso» solo las tareas que lleva un agente vivo, con quién la lleva',
                  sorted(x[1] for x in _proceso) == sorted(VIVAS) and all('En proceso' in x[2] and ('Agente A' in x[2] or 'Chat' in x[2]) for x in _proceso), str([x[1][:40] + ' · ' + x[2] for x in _proceso]))
        _medias = [x[1] for x in _li if x[0] == 'a_medias']
        comprobar('roadmap: las empezadas que no lleva nadie (también la del agente cortado) salen «a medias»',
                  sorted(_medias) == sorted(t['nombre'] for _, t in _ec if t['nombre'] not in VIVAS) and all(x[2] == 'A medias' for x in _li if x[0] == 'a_medias'), str([m[:40] for m in _medias]))
        # el cartel va solo en la pestaña Roadmap, debajo de las pestañas y encima de la lista de hitos (valravnx, 28 oct)
        comprobar('«ahora mismo» no sale arriba ni en Jugar', not pg.is_visible('#ahora'))
        pg.click('nav button[data-s=roadmap]'); pg.wait_for_timeout(250)
        _pos = pg.evaluate("[document.querySelector('nav').getBoundingClientRect().bottom, document.querySelector('#ahora').getBoundingClientRect().top, document.querySelector('#ahora').getBoundingClientRect().bottom, document.querySelector('#listaHitos').getBoundingClientRect().top]")
        comprobar('«ahora mismo» sale en Roadmap, debajo de las pestañas y encima de los hitos', pg.is_visible('#ahora') and _pos[0] <= _pos[1] + 1 and _pos[2] < _pos[3], str(_pos))
        _y0 = pg.evaluate("document.querySelector('nav').getBoundingClientRect().top + scrollY")
        pg.screenshot(path=f'{SALIDA}/{nombre}_0_ahora_mismo.png', clip={'x': 0, 'y': _y0, 'width': vista['width'], 'height': min(900, pg.evaluate("document.querySelector('#listaHitos').getBoundingClientRect().top + scrollY") + 160 - _y0)}, full_page=True)
        pg.click('nav button[data-s=jugar]'); pg.wait_for_timeout(200)
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
                  pg.locator('#guirnalda .banderin:visible').count() >= 5 and pg.locator('.cabecera .tabla h1').count() == 1
                  and pg.evaluate("[...document.querySelectorAll('section')].every(s => s.querySelector('.pergamino') && s.querySelectorAll('.pergamino > .rollo').length === 2)"))
        _bord = pg.evaluate("(() => { const b = [...document.querySelectorAll('#guirnalda .banderin')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()); const g = document.querySelector('#guirnalda').getBoundingClientRect(); return [b[0].left + b[0].width / 2 - g.left, g.right - (b.at(-1).left + b.at(-1).width / 2)]; })()")
        comprobar('banderines repartidos por igual (tanto sitio a cada lado)', abs(_bord[0] - _bord[1]) < 12, f'{_bord[0]:.0f}px / {_bord[1]:.0f}px')
        _cuerdas = pg.evaluate("(() => { const t = document.querySelector('.cartel').getBoundingClientRect().top + scrollY; const c = getComputedStyle(document.querySelector('.cartel'), '::before'); return t + parseFloat(c.top); })()")
        comprobar('las cuerdas del cartel cuelgan de arriba del todo (no empiezan en el aire)', _cuerdas <= 2, f'empiezan a {_cuerdas:.0f}px')
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
        comprobar('en inglés, los documentos de diseño enlazan a la versión inglesa', len(docs_en) == 4 and all(h.startswith('diseno/en/') for h in docs_en), ', '.join(docs_en))
        for d in ['gdd', 'sistemas', 'analisis', 'revision']:
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
        comprobar('en español, los documentos enlazan al original', all(not h.startswith('diseno/en/') for h in docs_es) and len(docs_es) == 4)
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
        comprobar('en ruso, los documentos de diseño enlazan a la versión rusa', len(docs_ru) == 4 and all(h.startswith('diseno/ru/') for h in docs_ru), ', '.join(docs_ru))
        comprobar('en ruso, las tarjetas de documentos ya no dicen «пока на английском»', 'на английском' not in pg.inner_text('body'))
        # documentos de diseño en ruso: selector ES · EN · RU, misma estructura, texto en cirílico sin restos del español
        for d in ['gdd', 'sistemas', 'analisis', 'revision']:
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
        # ninguna pestaña, en ningún idioma, ensancha la página (la tabla de tiempos en ruso lo hacía en el móvil)
        _anchas = []
        for _l in ['es', 'en', 'ru']:
            pg.goto(URL + '?lang=' + _l); pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
            for _s in ['jugar', 'roadmap', 'diario', 'tiempos', 'decisiones', 'documentos']:
                pg.click(f'nav button[data-s={_s}]'); pg.wait_for_timeout(80)
                _w = pg.evaluate('document.documentElement.scrollWidth')
                if _w > vista['width']: _anchas.append(f'{_l}/{_s} {_w}px')
        comprobar('ninguna pestaña se sale por los lados, en ningún idioma', not _anchas, ', '.join(_anchas))
        pg.goto(URL + '?lang=ru'); pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
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
            comprobar('el botón Jugar abre el juego', 'jugar/' in pg.url and (pg.locator('canvas').count() >= 1 or pg.locator('#demoMenu a.parte').count() >= 3), pg.url)
            pg.screenshot(path=f'{SALIDA}/{nombre}_7_juego_abierto.png')
        # sin nadie trabajando: «ahora mismo» lo dice, y ninguna tarea sale en proceso
        ctx.unroute('https://raw.githubusercontent.com/**')
        servir_github(ctx, {'A': None, 'B': None})
        pg.goto(URL + '?lang=es'); pg.wait_for_selector('#listaJuegos .tarjeta', state='attached')
        pg.wait_for_selector('html[data-agentes=mirados]', state='attached', timeout=15000)
        comprobar('sin agentes: «ahora mismo» dice que no trabaja nadie y nada sale en proceso',
                  pg.locator('#ahora li').count() == 0 and pg.locator('#listaHitos li.en_curso').count() == 0 and pg.locator('#listaHitos li.a_medias').count() == len(_ec))
        pg.click('#idiomas button[data-l=ru]'); pg.wait_for_timeout(150)
        comprobar('«ahora mismo» en ruso', pg.text_content('#ahora h2') == 'Прямо сейчас')
        pg.click('#idiomas button[data-l=es]'); pg.wait_for_timeout(150)
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
srv.shutdown()
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
