# Prueba en navegador de los niveles de detalle del personaje del taller (src/personajes/detalle.js).
# 1) En el visor del personaje, el mismo personaje de cerca con cada nivel: cuántos triángulos y llamadas de dibujo
#    lleva, que se sigue viendo con la misma silueta y capturas para compararlos lado a lado (PC y móvil).
# 2) En la demo («Construir»), con la cámara baja y 20 personajes de prueba en pantalla, de 3 a 65 m: triángulos y llamadas de dibujo
#    con los niveles y sin ellos (todos enteros). Deja las medidas en detalle.json (los fps de este navegador, que
#    dibuja sin tarjeta gráfica, no valen: se apuntan pero no se comparan).
# Uso: python3 pruebas/prueba_detalle_navegador.py <html personaje> <html demo> <carpeta_capturas>
# MUTAR=1 hace que ponerNivel no haga nada: la prueba tiene que fallar.
import sys, os, io, json, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PERSONAJE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_personaje.html'))
DEMO = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[3] if len(sys.argv) > 3 else 'capturas_detalle'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/personaje'); os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(PERSONAJE, f'{sitio}/jugar/personaje/prueba.html')
shutil.copy(DEMO, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v12', 'taller-v13', 'taller-v14', 'taller-v15', 'taller-v16', 'taller-v21', 'taller-anim-v1', 'taller-carga-v1']:
    shutil.copytree(os.path.join(RAIZ, f'docs/recursos/personajes/{c}'), f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar'
MUTAR = bool(os.environ.get('MUTAR'))
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
E = 'window.__personaje'
fallos = []; MEDIDAS = {}
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def img(png): return Image.open(io.BytesIO(png)).convert('RGB')
def silueta(pg):
    """máscara del personaje: lo que cambia la imagen al esconderlo"""
    con = img(pg.screenshot())
    pg.evaluate(f'{E}.diag().pj.raiz.visible = false'); pg.evaluate(f'{E}.dibujar()')
    sin = img(pg.screenshot())
    pg.evaluate(f'{E}.diag().pj.raiz.visible = true'); pg.evaluate(f'{E}.dibujar()')
    d = ImageChops.difference(con, sin).convert('L').resize((200, 125)).point(lambda v: 255 if v > 18 else 0)
    return d

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        pg = ctx.new_page(); err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        # 1. el visor del personaje, de cerca, con cada nivel
        pg.goto(f'{BASE}/personaje/prueba.html'); pg.wait_for_function(f'{E} && {E}.listo()', timeout=180000)
        pg.evaluate(f"{E}.cambiar({{base: 'makehuman', sexo: 'hombre', capas: {{hombre: ['gambeson', 'cota', 'sobreveste', 'zapatos']}}}})")
        pg.wait_for_function(f'{E}.listo()', timeout=180000)
        if MUTAR: pg.evaluate(f'{E}.diag().pj.ponerNivel = () => Promise.resolve()')
        pg.evaluate(f'{E}.pausar(true)'); pg.evaluate(f"{E}.ponerModo('quieto')"); pg.evaluate(f"{E}.ponerVista('cuerpo')"); pg.evaluate(f'{E}.instante(1.0)')
        res, sil = [], []
        for n in [0, 1, 2]:
            r = pg.evaluate(f'{E}.nivel({n})'); pg.evaluate(f'{E}.instante(1.0)')
            m = pg.evaluate(f'{E}.medida()')
            r['dibujados'] = m['dibujados']; res.append(r)
            pg.screenshot(path=f'{SALIDA}/{nombre}_nivel{n}.png')
            sil.append(silueta(pg))
            print(f'    nivel {n}: {r}')
        MEDIDAS[f'{nombre}_visor'] = res
        t0, t1, t2 = [r['triangulos'] or 0 for r in res]
        comprobar('nivel medio: como mucho el 55 % de los triángulos', t0 > 5000 and t1 <= t0 * 0.55, f'{t0} → {t1}')
        comprobar('nivel lejos: como mucho el 25 %', t2 <= t0 * 0.25 and t2 > 300, f'{t0} → {t2}')
        comprobar('nivel lejos: una sola pieza (texturas juntas)', res[2]['piezas'] <= 2 and res[0]['piezas'] >= 6, f"{res[0]['piezas']} → {res[2]['piezas']}")
        comprobar('nivel lejos: menos llamadas de dibujo', res[2]['dibujados'] < res[0]['dibujados'] - 4, f"{res[0]['dibujados']} → {res[2]['dibujados']}")
        for n in [1, 2]:
            a, b = sil[0], sil[n]
            inter = ImageStat.Stat(ImageChops.multiply(a, b)).sum[0] / 255; union = ImageStat.Stat(ImageChops.lighter(a, b)).sum[0] / 255
            comprobar(f'nivel {n}: la misma silueta que de cerca', union > 200 and inter / union > 0.85, f'{inter / max(union, 1):.2f} de {union:.0f} px')
        # el color se parece (no sale blanco, negro ni con las texturas cambiadas): media dentro de la silueta
        def media(n):
            im = img(open(f'{SALIDA}/{nombre}_nivel{n}.png', 'rb').read()).resize((200, 125))
            return ImageStat.Stat(im, sil[0]).mean
        c0, c2 = media(0), media(2)
        dif = sum(abs(c0[i] - c2[i]) for i in range(3)) / 3
        comprobar('nivel lejos: el mismo color de media que de cerca', dif < 18, f'{[round(x) for x in c0]} → {[round(x) for x in c2]}')
        r = pg.evaluate(f'{E}.nivel(3)')
        comprobar('más lejos: no se dibuja', pg.evaluate(f'{E}.diag().pj.raiz.visible') is False, str(r))
        r = pg.evaluate(f'{E}.nivel(0)')
        comprobar('de vuelta a cerca: entero otra vez', r['triangulos'] == t0 and pg.evaluate(f'{E}.diag().pj.raiz.visible'), f'{r}')
        # cambiar de capas estando lejos: la malla de lejos se rehace con las capas nuevas
        pg.evaluate(f'{E}.nivel(2)')
        pg.evaluate(f"{E}.diag().pj.ponerCapas(['tunica'])"); pg.wait_for_timeout(300)
        r2 = pg.evaluate(f'{E}.nivel(2)')
        comprobar('lejos: al cambiar de ropa se rehace la malla', r2['triangulos'] != t2 and r2['piezas'] <= 2, f'{t2} → {r2}')
        pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_nivel2_tunica.png')
        comprobar('visor: sin errores en la consola', not err, '; '.join(err[:3]))
        # 2. la demo, «Construir», con 20 personajes de prueba
        err.clear()
        pg.goto(f'{BASE}/demo/prueba.html?sinservidor=1'); pg.wait_for_function('window.__demo && window.__demo.listo')
        pg.click('[data-ir=construir]'); pg.wait_for_load_state('load'); pg.wait_for_function('window.__demo && window.__demo.listo', timeout=60000)
        pg.wait_for_function('window.__rendimiento.medida() && window.__rendimiento.medida().personajes >= 1', timeout=180000)
        # la cámara, lo más baja que deja el juego (mirando hacia el horizonte), para tener a los 20 en pantalla
        pg.evaluate('window.__kinhold.cam.pitch = 0.45')
        pg.evaluate('window.__rendimiento.gente(20)')
        pg.wait_for_function('window.__rendimiento.medida().personajes >= 21', timeout=240000)
        def medir(si):
            pg.evaluate(f'window.__rendimiento.detalle({str(si).lower()})')
            # sin tarjeta gráfica va a 1 fps: se espera a que la medida (de cada segundo) se renueve dos veces
            for _ in range(2):
                t = pg.evaluate('window.__rendimiento.medida().ms + "/" + window.__rendimiento.medida().peor + "/" + window.__rendimiento.medida().triangulos')
                try: pg.wait_for_function(f'(m => m.ms + "/" + m.peor + "/" + m.triangulos)(window.__rendimiento.medida()) !== "{t}"', timeout=30000)
                except Exception: pass
            pg.wait_for_timeout(1500)
            return pg.evaluate('({...window.__rendimiento.medida(), niveles: window.__rendimiento.niveles()})')
        sin = medir(False); con = medir(True)
        pg.screenshot(path=f'{SALIDA}/{nombre}_demo_20.png')
        pg.click('#btnDemoFps'); pg.wait_for_timeout(1300); pg.screenshot(path=f'{SALIDA}/{nombre}_demo_20_panel.png')
        txt = pg.inner_text('#demoRend')
        comprobar('demo: el panel dice cuántos hay en cada nivel', 'Niveles de detalle' in txt and 'lejos' in txt, txt[-160:])
        MEDIDAS[f'{nombre}_demo_20'] = {'sin_niveles': sin, 'con_niveles': con}
        print(f"    sin niveles: {sin['triangulos']} triángulos, {sin['dibujados']} dibujos, {sin['fps']} fps; con: {con['triangulos']}, {con['dibujados']}, {con['fps']} fps; niveles {con['niveles']}")
        comprobar('demo: sin niveles, todos enteros', sin['niveles'] and sin['niveles'][0] == 21, str(sin['niveles']))
        comprobar('demo: con niveles hay gente en medio y lejos', con['niveles'] and con['niveles'][1] + con['niveles'][2] >= 6, str(con['niveles']))
        comprobar('demo: con niveles, menos triángulos (≤ 70 %)', con['triangulos'] <= sin['triangulos'] * 0.7, f"{sin['triangulos']} → {con['triangulos']}")
        comprobar('demo: con niveles, menos llamadas de dibujo', con['dibujados'] < sin['dibujados'], f"{sin['dibujados']} → {con['dibujados']}")
        comprobar('demo: sin errores en la consola', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
json.dump(MEDIDAS, open(f'{SALIDA}/detalle.json', 'w'), indent=1, ensure_ascii=False)
print('FALLOS:' if fallos else 'Todo bien', ', '.join(fallos))
sys.exit(1 if fallos else 0)
