# Prueba en navegador del terreno por trozos hecho en un hilo aparte (dist/kinhold_trozos.html, el banco de trozos):
# en PC (1280×800) y en móvil (390×844), con el hilo aparte y, para comparar, todo en el hilo de dibujo:
#   - el hilo aparte arranca (Web Worker) y carga todos los trozos alrededor del jugador, sin errores
#   - andando en línea recta se cruzan varios bordes de trozo; al acabar, todo trozo tiene su malla con el detalle que
#     toca (ningún agujero) y la altura que se ve bajo el jugador es la del paisaje
#   - con el hilo aparte, el trabajo de los trozos en el hilo de dibujo no pasa de unos pocos ms en ningún fotograma
#     (montar las mallas que llegan hechas); sin hilo, ese trabajo es el de calcular el suelo, mucho mayor
#   - mide el fotograma más largo al cruzar los bordes, con y sin hilo (aquí se dibuja sin tarjeta gráfica: el tiempo de
#     dibujo es el del procesador; lo que cuenta es la diferencia entre los dos)
# Capturas: <carpeta>/<pc|movil>_1_salida.png y _2_andado.png (con el hilo).
# MUTAR=1: las comprobaciones «con el hilo» se hacen sobre la página sin hilo: tiene que fallar. SOLO=pc o SOLO=movil.
# Uso: python3 pruebas/prueba_trozos_navegador.py <html> <carpeta_capturas>
import sys, os, json, subprocess, time, socket
from playwright.sync_api import sync_playwright
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_trozos.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_trozos'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '')
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''), flush=True)
    if not c: fallos.append(n)
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
_s = socket.socket(); _s.bind(('', 0)); PUERTO = _s.getsockname()[1]; _s.close()
SERVIDOR = subprocess.Popen([sys.executable, '-m', 'http.server', str(PUERTO)], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
URL = f'http://localhost:{PUERTO}/' + os.path.relpath(RUTA, RAIZ).replace(os.sep, '/')
# andar: 1,6 m por fotograma (más deprisa que corriendo, para cruzar bordes a menudo) durante 160 fotogramas: 256 m, al
# menos tres bordes de trozo de 64 m
PASO, FOTOGRAMAS = 1.6, 160
MEDIDAS = {}
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-precise-memory-info"])
        APARATOS = [('pc', dict(viewport={'width': 1280, 'height': 800})), ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]
        for nombre, opc in [a for a in APARATOS if not os.environ.get('SOLO') or a[0] == os.environ['SOLO']]:
            for hilo in ('1', '0'):
                ctx = nav.new_context(locale='es-ES', **opc); pg = ctx.new_page(); err = []
                pg.on('pageerror', lambda e: err.append(str(e))); pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
                pagina = '0' if (MUTAR and hilo == '1') else hilo
                pg.goto(URL + f'?hilo={pagina}')
                pg.wait_for_function('window.__banco && (window.__banco.listo || window.__banco.error)', timeout=600000)
                comprobar(f'{nombre}, hilo={hilo}: sin errores al cargar', not pg.evaluate('window.__banco.error') and not err, str(pg.evaluate('window.__banco.error') or err)[:300])
                m0 = pg.evaluate('window.__banco.medidas()')
                if hilo == '1':
                    comprobar(f'{nombre}: los trozos se hacen en un hilo aparte (Web Worker)', m0['conHilo'] and m0['hilos'] >= 1, f"{m0['hilos']} hilo(s)")
                    pg.screenshot(path=f'{SALIDA}/{nombre}_1_salida.png')
                comprobar(f'{nombre}, hilo={hilo}: carga todos los trozos alrededor del jugador', m0['faltan'] == 0 and m0['sinMalla'] == 0 and m0['trozos'] > 100,
                          f"{m0['trozos']} trozos en {m0['msCarga']} ms · {m0['triangulos']} triángulos · {m0['llamadas']} llamadas de dibujo")
                # andar(...) devuelve una promesa: evaluate espera a que acabe
                pg.evaluate(f'window.__banco.andar({PASO}, {FOTOGRAMAS})')
                cruzados = pg.evaluate('window.__banco.cruces()')
                m1 = pg.evaluate('window.__banco.medidas()')
                # dejar que acabe lo que estaba en vuelo
                pg.wait_for_function('window.__banco.medidas().faltan === 0', timeout=120000)
                m2 = pg.evaluate('window.__banco.medidas()')
                MEDIDAS[f'{nombre}_hilo{hilo}'] = m1
                comprobar(f'{nombre}, hilo={hilo}: al andar se cruzan bordes de trozo', m1['fotogramaCruce']['n'] > 0, f"{m1['fotogramaCruce']['n']} fotogramas junto a un borde")
                comprobar(f'{nombre}, hilo={hilo}: al acabar, ningún trozo sin malla ni con el detalle viejo', m2['faltan'] == 0 and m2['sinMalla'] == 0 and not m2['errores'], f"{m2['trozos']} trozos · {m2['tirados']} llegados de más y tirados")
                a = m2['altura']
                comprobar(f'{nombre}, hilo={hilo}: la altura que se ve bajo el jugador es la del paisaje', a['malla'] is not None and abs(a['malla'] - a['paisaje']) < 0.6, f"{a['malla']} y {a['paisaje']} m")
                comprobar(f'{nombre}, hilo={hilo}: sin errores al andar', not err and not pg.evaluate('window.__banco.error'), str(err)[:300])
                print(f"     {nombre}, hilo={hilo}: fotograma más largo {m1['fotograma']['max']} ms (al cruzar un borde {m1['fotogramaCruce']['max']} ms, media {m1['fotograma']['media']} ms); "
                      f"trabajo de los trozos en el hilo de dibujo: máx. {m1['trabajo']['max']} ms, media {m1['trabajo']['media']} ms; un trozo tarda hasta {m1['msTrozoMax']} ms (media {m1['msTrozoMedia']}); memoria {m1['memoriaMB']} MB", flush=True)
                if hilo == '1':
                    comprobar(f'{nombre}: con el hilo, el trabajo de los trozos en el hilo de dibujo no pasa de 8 ms en ningún fotograma', m1['trabajo']['max'] < 8, f"{m1['trabajo']['max']} ms")
                    pg.screenshot(path=f'{SALIDA}/{nombre}_2_andado.png')
                else:
                    con = MEDIDAS[f'{nombre}_hilo1']
                    comprobar(f'{nombre}: sin el hilo, el trabajo en el hilo de dibujo es mucho mayor (el hilo aparte sirve)', m1['trabajo']['max'] > 2 * con['trabajo']['max'], f"{m1['trabajo']['max']} ms sin hilo, {con['trabajo']['max']} ms con él")
                ctx.close()
        nav.close()
finally:
    SERVIDOR.terminate()
with open(os.path.join(SALIDA, 'medidas.json'), 'w') as f: json.dump(MEDIDAS, f, indent=1, ensure_ascii=False)
print(f"\n{'FALLAN ' + str(len(fallos)) if fallos else 'TODO CORRECTO'} · medidas en {SALIDA}/medidas.json")
sys.exit(1 if fallos else 0)
