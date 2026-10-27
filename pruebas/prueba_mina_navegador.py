# Prueba en navegador de la prueba de cavar (hito 1g): carga, cava un túnel, mide lo que tarda la malla por golpe,
# cava tocando la pantalla en el móvil y saca capturas de cerca. MUTAR=1 rompe el cálculo de la malla: tiene que fallar.
# Uso: python3 pruebas/prueba_mina_navegador.py <html> <carpeta_capturas>
import sys, os, json
from playwright.sync_api import sync_playwright
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_mina.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_mina'
os.makedirs(SALIDA, exist_ok=True)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
MEDIDAS = {}
with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, opc in [('pc', dict(viewport={'width': 1280, 'height': 800})), ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        ctx = nav.new_context(locale='es-ES', **opc); pg = ctx.new_page(); err = []
        pg.on('pageerror', lambda e: err.append(str(e))); pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto('file://' + RUTA)
        pg.wait_for_function('window.__mina', timeout=60000)
        if os.environ.get('MUTAR'): pg.evaluate("window.__mina.medidas.triangulos = 0; window.__mina.golpe = () => ({ ok: false })")
        pg.wait_for_timeout(1200)
        tri0 = pg.evaluate('window.__mina.medidas.triangulos')
        comprobar(f'{nombre}: se dibuja la loma de roca', tri0 > 1000, f'{tri0} triángulos, {pg.evaluate("window.__mina.msInicial"):.0f} ms toda la roca al empezar')
        pg.screenshot(path=f'{SALIDA}/{nombre}_1_loma.png')
        if nombre == 'pc':
            golpes = pg.evaluate('window.__mina.cavarTunel(16).map(x => x.ok ? +x.ms.toFixed(1) : null)')
            ms = [g for g in golpes if g is not None]
            comprobar('pc: el túnel de prueba se cava', len(ms) >= 8, f'{len(ms)} golpes con roca')
            if ms:
                MEDIDAS['pc'] = {'golpes': len(ms), 'media_ms': round(sum(ms) / len(ms), 1), 'peor_ms': max(ms), 'triangulos': pg.evaluate('window.__mina.medidas.triangulos')}
                comprobar('pc: rehacer la malla por golpe tarda poco (navegador sin tarjeta gráfica)', MEDIDAS['pc']['media_ms'] < 60, json.dumps(MEDIDAS['pc']))
            pg.wait_for_timeout(800); pg.screenshot(path=f'{SALIDA}/pc_2_tunel.png')
            pg.evaluate('window.__mina.mirar(5.5,2.2,12.6, 9,1.7,12)'); pg.wait_for_timeout(700); pg.screenshot(path=f'{SALIDA}/pc_3_boca.png')
            pg.evaluate('window.__mina.mirar(8.2,1.8,12.0, 12,1.6,12)'); pg.wait_for_timeout(700); pg.screenshot(path=f'{SALIDA}/pc_4_dentro.png')
            guardado = pg.evaluate('JSON.stringify(window.__mina.serializar()).length')
            comprobar('pc: lo guardado es pequeño (solo los trozos tocados)', 0 < guardado < 6000, f'{guardado} bytes')
        else:
            # cavar tocando la roca en el centro de la pantalla
            antes = pg.evaluate('window.__mina.medidas.ms.length')
            pg.touchscreen.tap(195, 470); pg.wait_for_timeout(600); pg.touchscreen.tap(195, 470); pg.wait_for_timeout(800)
            despues = pg.evaluate('window.__mina.medidas.ms.length')
            comprobar('móvil: tocar la roca cava', despues > antes, f'{despues - antes} golpes')
            pg.screenshot(path=f'{SALIDA}/movil_2_tocado.png')
            pg.evaluate('window.__mina.cavarTunel(16)'); pg.evaluate('window.__mina.mirar(5.5,2.2,12.6, 9,1.7,12)'); pg.wait_for_timeout(700)
            pg.screenshot(path=f'{SALIDA}/movil_3_boca.png')
            pg.click('#btnNotas'); pg.wait_for_timeout(300); pg.screenshot(path=f'{SALIDA}/movil_4_notas.png')
            comprobar('móvil: las notas se abren', pg.is_visible('#notas'))
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar(f'{nombre}: nada se sale de la pantalla', ancho <= opc['viewport']['width'], f'{ancho}px')
        comprobar(f'{nombre}: sin errores en consola', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
json.dump(MEDIDAS, open(f'{SALIDA}/medidas.json', 'w'), indent=1)
print('\nResultado:', 'TODO CORRECTO' if not fallos else f'{len(fallos)} fallos: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
