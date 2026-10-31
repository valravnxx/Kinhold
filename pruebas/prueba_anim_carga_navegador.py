# Prueba en navegador de las animaciones para cargar (recursos/personajes/taller-anim-v2/) en el visor de personaje,
# con el taller propio, hombre y mujer, en PC y móvil: se cargan las 41 extra, salen los botones Empujar y Coger de una
# mesa, cada una mueve el cuerpo sin desarmarlo y, al empujar, las manos van por delante del pecho. Y las de cargar hechas
# en el taller (taller-carga-v1): al hombro (la mano derecha arriba) y arrastrar (las manos junto a la cadera). Capturas.
# Uso: python3 pruebas/prueba_anim_carga_navegador.py <html del personaje> <carpeta_capturas>
# MUTAR=1 carga las animaciones de la v1 (sin las nuevas): la prueba tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_personaje.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_anim_carga'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/personaje'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/personaje/prueba.html')
for c in ['v1', 'taller-v20', 'taller-anim-v1', 'taller-anim-v2', 'taller-carga-v1']:
    shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes', c), f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
ANIM = 'taller-anim-v1' if os.environ.get('MUTAR') else 'taller-anim-v2'
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/personaje/prueba.html?animMH=../../recursos/personajes/{ANIM}/'

ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
E = 'window.__personaje'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def listo(pg): pg.wait_for_function(f'{E} && {E}.listo()', timeout=180000)
HUESOS = ['pelvis', 'head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'spine_03']

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.goto(URL); listo(pg)
        comprobar(f'{nombre}: sale el taller propio', pg.evaluate(f'{E}.estado().base') == 'makehuman')
        for sexo in ['hombre', 'mujer']:
            if pg.evaluate(f'{E}.estado().sexo') != sexo:
                pg.evaluate(f"{E}.cambiar({{sexo: '{sexo}'}})"); listo(pg)
            pg.evaluate(f'{E}.pausar(true)')
            n = pg.evaluate(f'{E}.diag().pj.clips.length')
            comprobar(f'{nombre} {sexo}: se cargan las 9 básicas, las 41 extra y las 3 de cargar del taller', n == 9 + 41 + 3, f'{n} clips')
            if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
            botones = pg.evaluate("[...document.querySelectorAll('#anims-extra [data-modo]')].map(b => b.dataset.modo)")
            comprobar(f'{nombre} {sexo}: botones Empujar, Coger de una mesa, Al hombro y Arrastrar', all(k in botones for k in ['empujar', 'cogerDeMesa', 'hombro', 'hombroQuieto', 'arrastrar']), f'{len(botones)} botones')
            pose = lambda: pg.evaluate(f"{HUESOS}.map(n => {E}.hueso(n))")
            pg.evaluate(f"{E}.ponerModo('quieto')"); pg.evaluate(f'{E}.instante(0.5)'); quieto = pose()
            for k, t in [('empujar', 0.6), ('cogerDeMesa', 0.5), ('hombro', 0.25), ('arrastrar', 0.25)]:
                if k not in botones: comprobar(f'{nombre} {sexo}: {k}', False, 'no está'); continue
                if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
                pg.click(f'#anims-extra [data-modo="{k}"]'); pg.wait_for_timeout(100)
                if movil: pg.click('#btnOpciones')
                comprobar(f'{nombre} {sexo}: el botón pone «{k}»', pg.evaluate(f'{E}.estado().modo') == k)
                dur = pg.evaluate(f"{E}.diag().pj.acciones['{k}'].getClip().duration")
                pg.evaluate(f'{E}.instante({dur * t})'); a = pose()
                cambio = max(max(abs(x[i] - y[i]) for i in range(3)) for x, y in zip(a, quieto))
                comprobar(f'{nombre} {sexo}: «{k}» se aparta de estar quieto (más de 10 cm)', cambio > 0.10, f'{cambio * 100:.0f} cm')
                d = [sum((a[j][i] - a[0][i]) ** 2 for i in range(3)) ** 0.5 for j in range(1, 6)]
                comprobar(f'{nombre} {sexo}: con «{k}» el cuerpo no se desarma', d[0] < 0.8 and max(d[1:]) < 1.1, f'{max(d):.2f} m')
                if k == 'empujar':
                    # manos por delante del pecho, hacia donde mira (la distancia en horizontal de pecho a mano es mayor que en quieto)
                    h = lambda p_, j: ((p_[j][0] - p_[6][0]) ** 2 + (p_[j][2] - p_[6][2]) ** 2) ** 0.5
                    alcance, alcance0 = (h(a, 2) + h(a, 3)) / 2, (h(quieto, 2) + h(quieto, 3)) / 2
                    comprobar(f'{nombre} {sexo}: al empujar, las manos van por delante del pecho', alcance > alcance0 + 0.15 and alcance > 0.3,
                              f'{alcance * 100:.0f} cm (quieto {alcance0 * 100:.0f} cm)')
                if k == 'hombro':
                    # la mano derecha arriba, sobre el hombro (encima del pecho y por encima del cuello, menos 5 cm)
                    comprobar(f'{nombre} {sexo}: al hombro, la mano derecha arriba', a[3][1] > a[6][1] + 0.15, f'mano {a[3][1]:.2f} m · pecho {a[6][1]:.2f} m')
                if k == 'arrastrar':
                    # las dos manos abajo, a la altura de la cadera y por detrás del pecho (mirando a donde mira)
                    comprobar(f'{nombre} {sexo}: al arrastrar, las manos abajo, junto a la cadera', all(abs(a[j][1] - a[0][1]) < 0.25 for j in (2, 3)), f'manos {a[2][1]:.2f}/{a[3][1]:.2f} m · cadera {a[0][1]:.2f} m')
                # de frente y de lado (el cuerpo girado un cuarto de vuelta, con la cámara de cuerpo entero)
                if pg.is_visible('[data-vista="cuerpo"]'): pg.click('[data-vista="cuerpo"]')
                giro0 = pg.evaluate(f'{E}.diag().pj.raiz.rotation.y')
                for v, giro in [('frente', giro0), ('lado', giro0 + 1.5708)]:
                    pg.evaluate(f'{E}.diag().pj.raiz.rotation.y = {giro}')
                    pg.evaluate(f'{E}.instante({dur * t})'); pg.evaluate(f'{E}.dibujar()')
                    pg.screenshot(path=f'{SALIDA}/{nombre}_{sexo}_{k}_{v}.png')
                pg.evaluate(f'{E}.diag().pj.raiz.rotation.y = {giro0}')
            pg.evaluate(f"{E}.ponerModo('quieto')")
        comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
print(f'{len(fallos)} fallos' if fallos else 'Todo correcto')
sys.exit(1 if fallos else 0)
