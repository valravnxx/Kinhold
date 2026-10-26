# Prueba en navegador del juego en inglés y en ruso (construcción, combate, prueba de estilo y visor de personaje), en PC y móvil.
# Uso: python3 pruebas/prueba_idioma_navegador.py <html_construccion> <html_combate> <html_estilo> <html_personaje> <carpeta_capturas>
# Todo se sirve por HTTP desde un mismo sitio con los recursos (docs/recursos/personajes/), como en la web.
# Comprueba: que no queda ningún texto sin traducir (window.__idioma.faltan), que no quedan palabras
# en español a la vista, que el botón ES/EN cambia el idioma, lo recuerda y no borra la partida.
# En ruso: todas las vistas con ?lang=ru, sin textos sin traducir, sin español ni inglés a la vista, con cirílico y botón RU.
# MUTAR=1 → mete a propósito un texto en español en la página: la prueba tiene que fallar.
import sys, os, re, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CONSTR = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
COMB = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else 'dist/kinhold_combate.html')
ESTILO = os.path.abspath(sys.argv[3] if len(sys.argv) > 3 else 'dist/kinhold_estilo.html')
PERSONAJE = os.path.abspath(sys.argv[4] if len(sys.argv) > 4 else 'dist/kinhold_personaje.html')
SALIDA = sys.argv[5] if len(sys.argv) > 5 else 'capturas/idioma'

# el visor de personaje y la construcción (su jugador es el personaje del taller) cargan sus modelos de
# ../../recursos/personajes/: se sirven como en la web
sitio = tempfile.mkdtemp()
# (los cuatro desde el mismo sitio: el idioma elegido se guarda en el navegador y tiene que valer en todos)
for carpeta, html in (('personaje', PERSONAJE), ('construccion', CONSTR), ('combate', COMB), ('estilo', ESTILO)):
    os.makedirs(f'{sitio}/jugar/{carpeta}'); shutil.copy(html, f'{sitio}/jugar/{carpeta}/prueba.html')
os.makedirs(f'{sitio}/recursos/personajes')
for c in ('v1', 'taller-v6'):
    shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes', c), f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL_PERSONAJE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/personaje/prueba.html'
URL_CONSTR = f'http://127.0.0.1:{srv.server_address[1]}/jugar/construccion/prueba.html'
URL_COMB = f'http://127.0.0.1:{srv.server_address[1]}/jugar/combate/prueba.html'
URL_ESTILO = f'http://127.0.0.1:{srv.server_address[1]}/jugar/estilo/prueba.html'
os.makedirs(SALIDA, exist_ok=True)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = bool(os.environ.get('MUTAR'))

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

# palabras que solo salen en español (si alguna se ve con el juego en inglés, algo se ha quedado sin traducir)
ESPANOL = re.compile(r'\b(Construir|Desmontar|Ayuda|Decisiones|Reiniciar|Opciones|Parar|Planta|Muro|Tejado|Suelo|Cimiento|'
                     r'piedra|tronco|vara|barro|paja|cuerda|tabla|clavo|hierro|Espada|Lino|Duelo|Dificultad|Sonido|rival|'
                     r'golpe|herida|pulsa|toca|mantén|cansancio|que|del|los|las|para|con|una|'
                     r'Mañana|Tarde|Desenfoque|Cabaña|Lado|Cara|Notas|Quieto|Andando|Personalizar|Perfil|Espalda|Cuerpo|'
                     r'Hombre|Mujer|Túnica|Vestido|Pelo|Piel|Barba|Calidad|Sombras|Animación|midiendo|resolución|triángulos|dibujados)\b')

def elegir_idioma(pg, l):
    # en PC hay un botón por idioma; en el móvil, un desplegable
    b = pg.locator(f'button.idioma[data-idioma="{l}"]')
    if b.is_visible(): b.click()
    else: pg.select_option('select.idioma', l)

def texto_visible(pg):
    return pg.evaluate("""() => { const t = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode, e = n.parentElement; if (!e || e.closest('script,style')) continue;
        if (e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) t.push(n.nodeValue.trim()); }
      return t.filter(Boolean).join(' | '); }""")

MUTAR_SOLAPE = bool(os.environ.get('MUTAR_SOLAPE'))  # pone el aviso a una altura fija, como antes: la prueba tiene que fallar
def aviso_libre(pg, donde):
    """el aviso no tapa ningún botón visible del menú de arriba ni de los modos"""
    if MUTAR_SOLAPE: pg.evaluate("(() => { const a = document.getElementById('aviso'); a.style.top = '64px'; a.style.left = '50%'; a.style.transform = 'translateX(-50%)'; a.style.maxWidth = '92vw'; })()")
    t = pg.evaluate("""() => { const a = document.getElementById('aviso'); if (a.hidden) return 'sin aviso'; const r = a.getBoundingClientRect();
      return [...document.querySelectorAll('#superior button, #superior select, #modos button')].filter(b => b.offsetParent).filter(b => { const q = b.getBoundingClientRect();
        return r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; }).map(b => b.textContent.trim() || b.tagName).join(', '); }""")
    comprobar(f'{donde}: el aviso no tapa ningún botón', t == '', t)

def revisar(pg, donde):
    if MUTAR: pg.evaluate("(document.getElementById('menu') || document.getElementById('superior')).insertAdjacentHTML('beforeend', '<button>Pulsa para construir</button>')")
    falt = pg.evaluate('[...window.__idioma.faltan]')
    comprobar(f'{donde}: ningún texto sin traducir', len(falt) == 0, '; '.join(falt[:4]))
    vis = texto_visible(pg)
    m = sorted(set(ESPANOL.findall(vis)))
    comprobar(f'{donde}: no se ve español', not m, ', '.join(m[:8]) + ' … ' + vis[:200])

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for movil in (False, True):
        etiqueta = 'móvil' if movil else 'PC'
        print(etiqueta)
        if movil:
            ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
        else:
            ctx = nav.new_context(viewport={'width': 1280, 'height': 800}, locale='es-ES')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        sufijo = 'movil' if movil else 'pc'

        # ---------- construcción ----------
        pg.goto(URL_CONSTR + '?lang=en')
        pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
        pg.evaluate('localStorage.clear(); window.__kinhold.reiniciar()')
        pg.wait_for_timeout(500)
        K = 'window.__kinhold'
        comprobar('construcción: idioma inglés con ?lang=en', pg.evaluate('document.documentElement.lang') == 'en')
        comprobar('construcción: botón Build', 'Build' in pg.inner_text('#modos'))
        pg.screenshot(path=f'{SALIDA}/construccion_{sufijo}_01_inicio.png')
        pg.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('mojon','mojon'); {K}.apuntar(-3,-6); {K}.colocar()")
        pg.evaluate(f"{K}.seleccionar('pieza','muro_tronco'); {K}.apuntar(10,10)")  # fuera de la tierra: aviso
        pg.wait_for_timeout(300)
        av = pg.inner_text('#aviso').strip()
        comprobar('construcción: aviso en inglés', av and not ESPANOL.search(av), av)
        aviso_libre(pg, f'construcción {etiqueta} (inglés)')
        pg.screenshot(path=f'{SALIDA}/construccion_{sufijo}_02_construir.png')
        revisar(pg, f'construcción {etiqueta}, construyendo')
        pg.evaluate(f"{K}.cambiarModo('mover')")
        pg.click('#btnAyuda'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/construccion_{sufijo}_03_ayuda.png')
        revisar(pg, f'construcción {etiqueta}, ayuda')
        pg.click('#panelAyuda .cerrar'); pg.click('#btnRegistro'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/construccion_{sufijo}_04_decisiones.png')
        revisar(pg, f'construcción {etiqueta}, decisiones')
        pg.click('#panelRegistro .cerrar')
        # cambiar a español con el botón: recarga, recuerda el idioma y la partida sigue
        # sin ?lang ni nada guardado manda el idioma del navegador (aquí, español)
        pg.goto(URL_CONSTR)
        pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
        comprobar('construcción: navegador en español → juego en español', pg.evaluate('document.documentElement.lang') == 'es' and 'Construir' in pg.inner_text('#modos'))
        comprobar('construcción: la partida sigue al cambiar de idioma', pg.evaluate(f"!!{K}.mundo.mojon"))
        elegir_idioma(pg, 'en')
        pg.wait_for_function('window.__kinhold !== undefined && document.documentElement.lang === "en"', timeout=20000)
        pg.wait_for_timeout(300)
        comprobar('construcción: el botón EN cambia a inglés', 'Build' in pg.inner_text('#modos'))
        comprobar('construcción: la partida sigue tras el botón', pg.evaluate(f"!!{K}.mundo.mojon"))
        pg.reload(); pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
        comprobar('construcción: recuerda el inglés al volver', pg.evaluate('document.documentElement.lang') == 'en')
        elegir_idioma(pg, 'es')
        pg.wait_for_function('window.__kinhold !== undefined && document.documentElement.lang === "es"', timeout=20000)
        comprobar('construcción: el botón ES vuelve al español', 'Construir' in pg.inner_text('#modos'))
        elegir_idioma(pg, 'en')
        pg.wait_for_function('window.__kinhold !== undefined && document.documentElement.lang === "en"', timeout=20000)

        # ---------- combate ---------- (el inglés ya está guardado por el botón: vale para los dos)
        pg.goto(URL_COMB)
        pg.wait_for_function('window.__duelo !== undefined', timeout=20000)
        D = 'window.__duelo'
        comprobar('combate: recuerda el inglés elegido en la construcción', pg.evaluate('document.documentElement.lang') == 'en')
        pg.evaluate(f"{D}.configurar({{modo:'duelo', arma:'espada_larga', dificultad:'aprendiz'}}); {D}.ia.pensar = () => ({{mx:0,mz:0,correr:false}}); {D}.jugador.z={D}.rival.z-1.7")
        pg.wait_for_timeout(600)
        pg.evaluate(f"{D}.atacar('bajo')")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/combate_{sufijo}_01_duelo.png')
        revisar(pg, f'combate {etiqueta}, duelo')
        pg.click('#btnOpciones'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/combate_{sufijo}_02_opciones.png')
        revisar(pg, f'combate {etiqueta}, opciones')
        comprobar('combate: armas en inglés en el menú', 'Longsword' in pg.inner_text('#selArma'))
        pg.click('#btnOpciones'); pg.click('#btnAyuda'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/combate_{sufijo}_03_ayuda.png')
        revisar(pg, f'combate {etiqueta}, ayuda')
        pg.click('#panelAyuda .cerrar'); pg.click('#btnDecisiones'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/combate_{sufijo}_04_decisiones.png')
        revisar(pg, f'combate {etiqueta}, decisiones')
        pg.click('#panelRegistro .cerrar')
        # que el rival caiga: pantalla final en inglés
        pg.evaluate(f"{D}.rival.caer('Desangrado')")
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{SALIDA}/combate_{sufijo}_05_final.png')
        comprobar('combate: pantalla final en inglés', 'won' in pg.inner_text('#tituloFinal') and 'bled out' in pg.inner_text('#motivoFinal').lower(), pg.inner_text('#final'))
        revisar(pg, f'combate {etiqueta}, final')

        # ---------- prueba de estilo ---------- (el inglés sigue guardado)
        pg.goto(URL_ESTILO)
        pg.wait_for_function('window.__estilo !== undefined', timeout=90000)
        S = 'window.__estilo'
        comprobar('estilo: recuerda el inglés elegido', pg.evaluate('document.documentElement.lang') == 'en')
        pg.evaluate(f"{S}.pausar(true)")
        comprobar('estilo: botones en inglés', all(x in pg.inner_text('#superior') for x in ('Morning', 'Afternoon', 'Blur')), pg.inner_text('#superior'))
        for i, v in enumerate(['maqueta', 'cabana', 'lado']):
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f"{S}.dibujar()")
            pg.screenshot(path=f'{SALIDA}/estilo_{sufijo}_0{i + 1}_{v}.png')
        pg.evaluate("document.getElementById('medida').textContent = ''")
        pg.evaluate(f"{S}.pausar(false)"); pg.wait_for_timeout(2600); pg.evaluate(f"{S}.pausar(true)")
        comprobar('estilo: medida en inglés', 'resolution' in pg.inner_text('#medida'), pg.inner_text('#medida'))
        revisar(pg, f'estilo {etiqueta}')
        pg.click('#btnNotas'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/estilo_{sufijo}_06_notas.png')
        comprobar('estilo: notas en inglés', 'Style test' in pg.inner_text('#notas'), pg.inner_text('#notas')[:80])
        revisar(pg, f'estilo {etiqueta}, notas')
        elegir_idioma(pg, 'es')
        pg.wait_for_function('window.__estilo !== undefined && document.documentElement.lang === "es"', timeout=90000)
        comprobar('estilo: el botón ES vuelve al español', 'Mañana' in pg.inner_text('#superior'))
        elegir_idioma(pg, 'en')
        pg.wait_for_function('window.__estilo !== undefined && document.documentElement.lang === "en"', timeout=90000)

        # ---------- visor de personaje ----------
        pg.goto(URL_PERSONAJE + '?lang=en')
        P = 'window.__personaje'
        pg.wait_for_function(f'{P} && {P}.listo()', timeout=180000)
        comprobar('personaje: inglés con ?lang=en', pg.evaluate('document.documentElement.lang') == 'en')
        pg.evaluate(f"{P}.pausar(true)")
        if pg.is_hidden('#opciones'): pg.click('#btnOpciones')
        for base in ('makehuman', 'quaternius'):
            pg.evaluate(f"{P}.cambiar({{base: '{base}', sexo: 'hombre'}})")
            pg.wait_for_function(f'{P}.listo()', timeout=180000)
            pg.click('[data-vista="cuerpo"]'); pg.evaluate(f"{P}.instante(1.0)")
            pg.screenshot(path=f'{SALIDA}/personaje_{sufijo}_{base}.png')
            op = pg.inner_text('#opciones')
            comprobar(f'personaje ({base}): opciones en inglés', all(x in op for x in ('CHARACTER BASE', 'Man', 'Idle', 'High')) or all(x in op for x in ('Character base', 'Man', 'Idle', 'High')), op[:120])
            revisar(pg, f'personaje {etiqueta}, {base}')
        pg.evaluate(f"{P}.cambiar({{base: 'makehuman'}})"); pg.wait_for_function(f'{P}.listo()', timeout=180000)
        comprobar('personaje: capas en inglés', 'Tunic' in pg.inner_text('#opciones'), pg.inner_text('#opciones')[:200])
        pg.click('#btnOpciones')
        for v in ('cara', 'perfil', 'espalda'):
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f"{P}.instante(1.0)")
            pg.screenshot(path=f'{SALIDA}/personaje_{sufijo}_{v}.png')
        pg.click('#btnNotas'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/personaje_{sufijo}_notas.png')
        comprobar('personaje: notas en inglés', 'Character' in pg.inner_text('#notas'), pg.inner_text('#notas')[:80])
        revisar(pg, f'personaje {etiqueta}, notas')
        elegir_idioma(pg, 'es')
        pg.wait_for_function(f'document.documentElement.lang === "es" && {P} && {P}.listo()', timeout=180000)
        comprobar('personaje: el botón ES vuelve al español', 'Cuerpo' in pg.inner_text('#inferior'))
        elegir_idioma(pg, 'en')
        pg.wait_for_function(f'document.documentElement.lang === "en" && {P} && {P}.listo()', timeout=180000)
        comprobar('personaje: el botón EN cambia a inglés', 'Body' in pg.inner_text('#inferior'))
        comprobar(f'sin errores ({etiqueta})', not err, '; '.join(err[:3]))
        ctx.close()

    # ---------- ruso: todas las vistas de los cuatro prototipos ----------
    INGLES = re.compile(r'\b(Build|Dismantle|Help|Decisions|Reset|Options|Stop|Floor|Wall|Roof|Foundation|Longsword|Duel|Difficulty|'
                        r'Sound|Morning|Afternoon|Blur|Idle|Walking|Body|Face|Notes|Man|Woman|Tunic|Hair|Skin|Beard|Quality|the|and|with|press)\b')
    def revisar_ru(pg, donde):
        if MUTAR: pg.evaluate("(document.getElementById('menu') || document.getElementById('superior')).insertAdjacentHTML('beforeend', '<button>Pulsa para construir</button>')")
        falt = pg.evaluate('[...window.__idioma.faltan]')
        comprobar(f'{donde}: ningún texto sin traducir', len(falt) == 0, '; '.join(falt[:4]))
        vis = texto_visible(pg)
        m = sorted(set(ESPANOL.findall(vis)) | set(INGLES.findall(vis)))
        comprobar(f'{donde}: no se ve español ni inglés', not m, ', '.join(m[:8]) + ' … ' + vis[:200])
        comprobar(f'{donde}: se ve cirílico', len(re.findall('[А-Яа-яЁё]', vis)) > 20, vis[:120])
        # que ningún texto ruso (más largo) se salga de la pantalla por los lados
        ancho = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        comprobar(f'{donde}: nada se sale por los lados', ancho <= 1, f'{ancho}px de más')
    for movil in (False, True):
        etiqueta = 'móvil' if movil else 'PC'; sufijo = 'movil' if movil else 'pc'
        print(etiqueta, '(ruso)')
        if movil: ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
        else: ctx = nav.new_context(viewport={'width': 1280, 'height': 800}, locale='es-ES')
        pg = ctx.new_page(); err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        K, D, S, P = 'window.__kinhold', 'window.__duelo', 'window.__estilo', 'window.__personaje'
        pg.goto(URL_CONSTR + '?lang=ru')
        pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
        pg.evaluate('localStorage.clear(); window.__kinhold.reiniciar()'); pg.wait_for_timeout(400)
        comprobar('ruso: construcción con ?lang=ru', pg.evaluate('document.documentElement.lang') == 'ru')
        comprobar('ruso: se ve el selector de idioma', pg.locator('button.idioma[data-idioma="ru"]').is_visible() or pg.locator('select.idioma').is_visible())
        solape = pg.evaluate("document.getElementById('menu').getBoundingClientRect().bottom - document.getElementById('modos').getBoundingClientRect().top")
        comprobar('ruso: el menú de arriba no tapa los botones de modo', solape <= 0, f'{solape:.0f}px')
        pg.screenshot(path=f'{SALIDA}/ru_construccion_{sufijo}_01_inicio.png'); revisar_ru(pg, f'ru construcción {etiqueta}')
        pg.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('mojon','mojon'); {K}.apuntar(-3,-6); {K}.colocar()")
        pg.evaluate(f"{K}.seleccionar('pieza','muro_tronco'); {K}.apuntar(10,10)"); pg.wait_for_timeout(300)
        av = pg.inner_text('#aviso').strip()
        comprobar('ruso: aviso de construcción en ruso', bool(re.search('[А-Яа-я]', av)), av)
        aviso_libre(pg, f'ru construcción {etiqueta}')
        pg.screenshot(path=f'{SALIDA}/ru_construccion_{sufijo}_02_construir.png'); revisar_ru(pg, f'ru construcción {etiqueta}, construyendo')
        pg.evaluate(f"{K}.cambiarModo('mover')"); pg.click('#btnAyuda'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/ru_construccion_{sufijo}_03_ayuda.png'); revisar_ru(pg, f'ru construcción {etiqueta}, ayuda')
        pg.click('#panelAyuda .cerrar'); pg.click('#btnRegistro'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/ru_construccion_{sufijo}_04_decisiones.png'); revisar_ru(pg, f'ru construcción {etiqueta}, decisiones')
        pg.click('#panelRegistro .cerrar')
        # el botón RU guarda el ruso para todos los prototipos y no borra la partida
        pg.goto(URL_CONSTR); pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
        elegir_idioma(pg, 'ru')
        pg.wait_for_function('window.__kinhold !== undefined && document.documentElement.lang === "ru"', timeout=20000)
        comprobar('ruso: el botón RU cambia a ruso y la partida sigue', pg.evaluate(f"!!{K}.mundo.mojon"))
        pg.goto(URL_COMB); pg.wait_for_function('window.__duelo !== undefined', timeout=20000)
        comprobar('ruso: el combate recuerda el ruso', pg.evaluate('document.documentElement.lang') == 'ru')
        pg.evaluate(f"{D}.configurar({{modo:'duelo', arma:'espada_larga', dificultad:'aprendiz'}}); {D}.ia.pensar = () => ({{mx:0,mz:0,correr:false}}); {D}.jugador.z={D}.rival.z-1.7")
        pg.wait_for_timeout(600); pg.evaluate(f"{D}.atacar('bajo')"); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/ru_combate_{sufijo}_01_duelo.png'); revisar_ru(pg, f'ru combate {etiqueta}, duelo')
        pg.click('#btnOpciones'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/ru_combate_{sufijo}_02_opciones.png'); revisar_ru(pg, f'ru combate {etiqueta}, opciones')
        pg.click('#btnOpciones'); pg.click('#btnAyuda'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/ru_combate_{sufijo}_03_ayuda.png'); revisar_ru(pg, f'ru combate {etiqueta}, ayuda')
        pg.click('#panelAyuda .cerrar'); pg.click('#btnDecisiones'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/ru_combate_{sufijo}_04_decisiones.png'); revisar_ru(pg, f'ru combate {etiqueta}, decisiones')
        pg.click('#panelRegistro .cerrar'); pg.evaluate(f"{D}.rival.caer('Desangrado')"); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{SALIDA}/ru_combate_{sufijo}_05_final.png'); revisar_ru(pg, f'ru combate {etiqueta}, final')
        pg.goto(URL_ESTILO); pg.wait_for_function('window.__estilo !== undefined', timeout=90000)
        pg.evaluate(f"{S}.pausar(true)")
        for i, v in enumerate(['maqueta', 'cabana', 'lado']):
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f"{S}.dibujar()")
            pg.screenshot(path=f'{SALIDA}/ru_estilo_{sufijo}_0{i + 1}_{v}.png')
        pg.evaluate("document.getElementById('medida').textContent = ''")
        pg.evaluate(f"{S}.pausar(false)"); pg.wait_for_timeout(2600); pg.evaluate(f"{S}.pausar(true)")
        revisar_ru(pg, f'ru estilo {etiqueta}')
        pg.click('#btnNotas'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/ru_estilo_{sufijo}_06_notas.png'); revisar_ru(pg, f'ru estilo {etiqueta}, notas')
        pg.goto(URL_PERSONAJE + '?lang=ru'); pg.wait_for_function(f'{P} && {P}.listo()', timeout=180000)
        pg.evaluate(f"{P}.pausar(true)")
        if pg.is_hidden('#opciones'): pg.click('#btnOpciones')
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f"{P}.instante(1.0)")
        pg.screenshot(path=f'{SALIDA}/ru_personaje_{sufijo}_opciones.png'); revisar_ru(pg, f'ru personaje {etiqueta}, opciones')
        pg.click('#btnOpciones')
        for v in ('cara', 'perfil', 'espalda'):
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f"{P}.instante(1.0)")
            pg.screenshot(path=f'{SALIDA}/ru_personaje_{sufijo}_{v}.png')
        revisar_ru(pg, f'ru personaje {etiqueta}')
        pg.click('#btnNotas'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SALIDA}/ru_personaje_{sufijo}_notas.png'); revisar_ru(pg, f'ru personaje {etiqueta}, notas')
        comprobar(f'ruso: sin errores ({etiqueta})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()

print()
print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
