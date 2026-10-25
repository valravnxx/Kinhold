# Prueba en navegador de la prueba de estilo v9 (hito 1b): las dos luces, las tres vistas de la escena, PC y móvil.
# Desde la v9 no hay muñeco por código: se comprueba que no queda ni rastro y que un guardado de la v6-v8 se adapta.
# Uso: python3 pruebas/prueba_estilo_navegador.py <html> <carpeta_capturas>
# Comprueba que cada combinación se dibuja (la franja central de la imagen tiene contenido),
# que se cumple el presupuesto (triángulos y dibujados), que las luces se distinguen,
# que la interfaz cabe, que no hay errores y que luz y vista se recuerdan al recargar.
# MUTAR=1 oculta el dibujo y pone un presupuesto imposible para comprobar que la prueba falla cuando debe.
import sys, os, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_estilo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_estilo'
os.makedirs(SALIDA, exist_ok=True)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
E = 'window.__estilo'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def analizar(png):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((160, 100))
    # el contenido se mide en la franja central, donde no hay botones ni paneles
    return im, sum(ImageStat.Stat(im.crop((24, 25, 136, 65))).stddev) / 3

def diferencia(a, b):
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')  # en español, como Pedro (el inglés lo prueba prueba_idioma_navegador.py)
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto('file://' + RUTA)
        pg.wait_for_function(f'{E} !== undefined', timeout=30000)
        if os.environ.get('MUTAR'):
            pg.add_style_tag(content='canvas{visibility:hidden}')
        pg.evaluate(f'{E}.pausar(true)')  # sin tarjeta gráfica cada fotograma tarda segundos: se dibuja a mano
        presu = pg.evaluate(f'{E}.PRESUPUESTO')
        if os.environ.get('MUTAR'): presu = {'triangulos': 5000, 'dibujados': 5}  # y un presupuesto imposible
        imagenes = {}
        for luz in ['manana', 'tarde']:
            pg.click(f'[data-luz="{luz}"]')
            comprobar(f'luz {luz} puesta y marcada', pg.evaluate(f'{E}.estado().luz') == luz and 'sel' in (pg.get_attribute(f'[data-luz="{luz}"]', 'class') or ''))
            for v in ['maqueta', 'cabana', 'lado']:
                pg.click(f'[data-vista="{v}"]')
                pg.evaluate(f'{E}.dibujar()')
                png = pg.screenshot(path=f'{SALIDA}/{nombre}_{luz}_{v}.png')
                im, desv = analizar(png)
                imagenes[(luz, v)] = im
                comprobar(f'{luz}/{v}: la imagen tiene contenido', desv > 18, f'desviación {desv:.0f}')
                m = pg.evaluate(f'{E}.medida()')
                comprobar(f'{luz}/{v}: dentro del presupuesto', 1000 < m['triangulos'] <= presu['triangulos'] and 0 < m['dibujados'] <= presu['dibujados'],
                          f"{m['triangulos']} triángulos (máx. {presu['triangulos']}), {m['dibujados']} dibujados (máx. {presu['dibujados']})")
        comprobar('mañana y tarde se distinguen', diferencia(imagenes[('manana', 'maqueta')], imagenes[('tarde', 'maqueta')]) > 4)
        # sin muñeco por código: ni botón de andar, ni vistas de personaje, ni función para leerlo
        quedan = pg.evaluate(f'''[!!document.getElementById('btnAndar'), document.querySelectorAll('[data-vista="personaje"],[data-vista="cara"]').length, typeof {E}.personaje, typeof {E}.ponerAndar]''')
        if os.environ.get('MUTAR'): quedan[0] = True
        comprobar('no queda nada del muñeco por código', quedan == [False, 0, 'undefined', 'undefined'], str(quedan))
        comprobar('las vistas son distintas', diferencia(imagenes[('manana', 'maqueta')], imagenes[('manana', 'cabana')]) > 8)
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        for sel in ['#estilos', '#inferior', '#medida']:
            caja = pg.locator(sel).bounding_box()
            comprobar(f'{sel} dentro de la pantalla', caja and caja['x'] >= 0 and caja['x'] + caja['width'] <= vista['width'] + 1 and caja['y'] + caja['height'] <= vista['height'] + 1)
        pg.click('#btnNotas'); pg.wait_for_timeout(200); pg.evaluate(f'{E}.dibujar()')
        comprobar('las notas se abren', pg.is_visible('#notas') and len(pg.inner_text('#notas')) > 200)
        pg.screenshot(path=f'{SALIDA}/{nombre}_notas.png')
        pg.click('#btnNotas')
        pg.click('[data-vista="maqueta"]'); pg.evaluate(f'{E}.dibujar()')
        if not movil:
            p0 = analizar(pg.screenshot())[0]
            pg.mouse.move(640, 450); pg.mouse.down(); pg.mouse.move(760, 430, steps=8); pg.mouse.up()
            pg.wait_for_timeout(300)
            d = diferencia(p0, analizar(pg.screenshot())[0])
            comprobar('arrastrar gira la cámara', d > 3, f'diferencia {d:.1f}')
        # el desenfoque se quita y se pone
        pg.click('#btnDesenfoque')
        comprobar('el botón quita el desenfoque', not pg.evaluate('document.body.classList.contains("desenfoque")') and not pg.is_visible('.foco.arriba'))
        pg.click('#btnDesenfoque')
        comprobar('y lo vuelve a poner', pg.is_visible('.foco.arriba'))
        pg.click('[data-luz="tarde"]'); pg.click('[data-vista="cabana"]')
        pg.reload(); pg.wait_for_function(f'{E} !== undefined', timeout=30000)
        st = pg.evaluate(f'{E}.estado()')
        comprobar('recuerda luz y vista al recargar', st['luz'] == 'tarde' and st['vista'] == 'cabana', str(st))
        # guardado de la v6-v8 (con el muñeco): la vista de personaje vuelve a la general y «andar» se olvida
        pg.evaluate('''localStorage.setItem('kinhold_estilo_v4', JSON.stringify({luz: 'tarde', vista: 'cara', desenfoque: false, andar: true}))''')
        pg.reload(); pg.wait_for_function(f'{E} !== undefined', timeout=30000)
        st = pg.evaluate(f'{E}.estado()')
        comprobar('un guardado de la v8 se adapta', st == {'luz': 'tarde', 'vista': 'maqueta', 'desenfoque': False}, str(st))
        pg.evaluate(f'{E}.ponerDesenfoque(true)')
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
