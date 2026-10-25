# Prueba en navegador de los recursos de personaje v2 (comprimidos con meshopt y WebP) y de las 39 animaciones extra.
# Uso: python3 pruebas/prueba_recursos_personaje.py <carpeta_capturas>
# Compara la v2 con la v1 (mismos triángulos, mismo esqueleto compartido, la misma imagen), mide lo que baja
# un personaje y comprueba que cada animación extra mueve el cuerpo. Deja una hoja con todas las poses.
# MUTAR=1 sirve en la v2 la ropa de mujer en lugar de la de hombre: la prueba tiene que fallar.
import sys, os, io, json, shutil, tempfile, threading, subprocess, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops, ImageDraw

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SALIDA = sys.argv[1] if len(sys.argv) > 1 else 'capturas_recursos'
os.makedirs(SALIDA, exist_ok=True)
REC = os.path.join(RAIZ, 'docs/recursos/personajes')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/recursos/personajes')
for v in ['v1', 'v2']: shutil.copytree(f'{REC}/{v}', f'{sitio}/recursos/personajes/{v}')
if os.environ.get('MUTAR'):
    shutil.copy(f'{REC}/v2/ropa_campesino_mujer.glb', f'{sitio}/recursos/personajes/v2/ropa_campesino_hombre.glb')
subprocess.run(['node', '-e', "require('esbuild').build({entryPoints:['pruebas/paginas/personaje_recursos.js'],bundle:true,format:'iife',"
                f"outfile:{json.dumps(sitio + '/prueba.js')},logLevel:'error'}}).catch(()=>process.exit(1))"], cwd=RAIZ, check=True)
open(f'{sitio}/prueba.html', 'w').write('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}</style><body><script src="prueba.js"></script>')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/prueba.html'

fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def imagen(png): return Image.open(io.BytesIO(png)).convert('RGB')
def diferencia(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3

# lo que baja un personaje (hombre campesino con pelo y barba, más las animaciones)
PIEZAS = ['ropa_campesino_hombre', 'base_hombre', 'pelo_raya', 'barba', 'animaciones']
kb = {v: sum(os.path.getsize(f'{REC}/{v}/{p}.glb') for p in PIEZAS) / 1024 for v in ['v1', 'v2']}
comprobar('un personaje baja menos de un tercio que en la v1', kb['v2'] < kb['v1'] / 3, f"{kb['v1']:.0f} KB → {kb['v2']:.0f} KB")
anim = {v: os.path.getsize(f'{REC}/{v}/animaciones.glb') / 1024 for v in ['v1', 'v2']}
comprobar('las animaciones bajan de 4,4 MB a menos de 1 MB', anim['v2'] < 1024, f"{anim['v1']:.0f} KB → {anim['v2']:.0f} KB")
man = json.load(open(f'{REC}/v2/manifiesto.json'))
comprobar('el manifiesto de la v2 tiene la huella de cada archivo', all(os.path.exists(f'{REC}/v2/{n}.glb') for n in man['huellas']) and len(man['huellas']) == len([f for f in os.listdir(f'{REC}/v2') if f.endswith('.glb')]))
comprobar('licencias junto a los modelos', all(os.path.exists(f'{REC}/v2/{f}') for f in ['base-license.txt', 'outfits-license.txt', 'animations-license.txt', 'PROCEDENCIA.md']))

VARIANTES = [{'sexo': 'hombre', 'pelo': 'raya', 'barba': 'si', 'piel': 'clara', 'colorPelo': 'castano'},
             {'sexo': 'mujer', 'pelo': 'mono', 'colorPelo': 'negro', 'piel': 'media'},
             {'sexo': 'hombre', 'pelo': 'rapado', 'colorPelo': 'pelirrojo', 'piel': 'morena', 'barba': 'si', 'calidad': 'ligera'},
             {'sexo': 'mujer', 'pelo': 'largo', 'colorPelo': 'rubio', 'piel': 'oscura'}]
with sync_playwright() as p:
    nav = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    for nombre, tam in [('pc', {'width': 1280, 'height': 800}), ('movil', {'width': 390, 'height': 844})]:
        print('Vista', nombre)
        pg = nav.new_page(viewport=tam)
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); pg.wait_for_function('window.__recursos', timeout=60000)
        for i, op in enumerate(VARIANTES if nombre == 'pc' else VARIANTES[:2]):
            r, im = {}, {}
            for v in ['v1', 'v2']:
                r[v] = pg.evaluate(f"__recursos.crear({json.dumps(op)}, '/recursos/personajes/{v}/')")
                for vis in ['cuerpo', 'cara']:
                    pg.evaluate("__recursos.pose('quieto', 1.0)"); pg.evaluate(f"__recursos.vista('{vis}')")
                    im[v, vis] = imagen(pg.screenshot(path=f'{SALIDA}/{nombre}_variante{i + 1}_{vis}_{v}.png'))
            comprobar(f'variante {i + 1}: mismos triángulos en v1 y v2', r['v1']['triangulos'] == r['v2']['triangulos'], f"{r['v1']['triangulos']} / {r['v2']['triangulos']}")
            comprobar(f'variante {i + 1}: tantos esqueletos como en la v1 (comprimir no rompe el esqueleto compartido)', r['v2']['esqueletos'] == r['v1']['esqueletos'], f"{r['v1']['esqueletos']} / {r['v2']['esqueletos']}")
            for vis in ['cuerpo', 'cara']:
                d = diferencia(im['v1', vis], im['v2', vis])
                comprobar(f'variante {i + 1} ({vis}): la v2 se ve igual que la v1', d < 1.0, f'diferencia media {d:.2f} de 255')
        # animaciones extra
        r = pg.evaluate("__recursos.crear({sexo: 'hombre', pelo: 'raya', barba: 'si', extra: true}, '/recursos/personajes/v2/')")
        extra = [c for c in r['clips'] if c not in man['clips']]
        comprobar('las 39 animaciones extra se cargan (las que se llaman igual que una básica, como «nombre_2»)', len(extra) == 39 and len(r['clips']) == len(man['clips']) + 39, f"{len(r['clips'])} clips en total, {len(extra)} extra")
        mismo = pg.evaluate("(() => { const d = __recursos.diag(); return [d.acciones.parar.getClip() === d.acciones.Sword_Block.getClip(), d.acciones.Sword_Block.getClip() !== d.acciones.Sword_Block_2.getClip(), d.acciones.vendarse.getClip().name, d.acciones.guardiaEscudo === d.acciones.Idle_Shield_Loop_2]; })()")
        comprobar('las básicas no cambian al cargar las extra; las extra tienen su nombre en español', mismo == [True, True, 'Bandage_Loop', True], str(mismo))
        if nombre == 'pc':
            pg.evaluate("__recursos.pose('quieto', 1.0)"); quieto = pg.evaluate('__recursos.huesos()')
            fotos, quietas = [], []
            for c in extra:
                pg.evaluate(f"__recursos.pose('{c}', 0.2, true)"); a = pg.evaluate('__recursos.huesos()')
                pg.evaluate(f"__recursos.pose('{c}', 0.55, true)"); b = pg.evaluate('__recursos.huesos()')
                pg.evaluate("__recursos.vista('cerca')")
                fotos.append((c, imagen(pg.screenshot())))
                cambio = max(max(abs(x[k] - y[k]) for k in range(3)) for x, y in zip(quieto + a, b + b))
                if cambio < 0.03: quietas.append(f'{c} {cambio:.3f}')
            comprobar('cada animación extra mueve el cuerpo (más de 3 cm respecto a estar quieto o entre dos instantes)', not quietas, ', '.join(quietas))
            # hoja con todas las poses (a mitad de cada animación), para Pedro
            col, w, h = 8, 320, 200
            hoja = Image.new('RGB', (col * w, -(-len(fotos) // col) * h), (40, 40, 40))
            for k, (c, f) in enumerate(fotos):
                x, y = (k % col) * w, (k // col) * h
                hoja.paste(f.resize((w, h)), (x, y)); ImageDraw.Draw(hoja).text((x + 6, y + 4), c, fill=(255, 255, 255))
            hoja.save(f'{SALIDA}/animaciones_extra.png')
        else:
            pg.evaluate("__recursos.pose('Bow_Aim_Neutral', 0.5, true)"); pg.evaluate("__recursos.vista('cerca')")
            pg.screenshot(path=f'{SALIDA}/movil_arco.png')
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        pg.close()
    nav.close()
srv.shutdown(); shutil.rmtree(sitio, ignore_errors=True)
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
