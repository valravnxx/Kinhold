# Kinhold — en el PC de valravnx, antes de las pruebas: prueba varias maneras de abrir el navegador hasta que WebGL
# dibuja con la tarjeta gráfica de verdad (no con SwiftShader, el dibujo sin tarjeta de la nube) y deja la elegida en
# el entorno del trabajo de GitHub (KINHOLD_GPU_ARGS, KINHOLD_GPU_CANAL, KINHOLD_GPU_HEADLESS y PYTHONPATH con esta
# carpeta, para que sitecustomize.py la use en todas las pruebas). Sale con error si ninguna llega a la tarjeta: así
# esos grupos se repiten en la nube en vez de ir igual de lentos aquí.
# Uso: python herramientas/pc_grafica/elegir_gpu.py            (en local, solo dice lo que encuentra)
import os, sys, json
from playwright.sync_api import sync_playwright

# de la más corriente en Windows a la de último recurso (con ventana, fuera de la pantalla)
MANERAS = [
    ('chromium', True, ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl']),
    ('chromium', True, ['--use-angle=d3d11on12', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl']),
    ('chromium', True, ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl']),
    ('chromium', True, ['--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl']),
    (None, False, ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl', '--window-position=-32000,-32000']),
]
SIN_TARJETA = ('swiftshader', 'llvmpipe', 'basic render', 'software')

def tarjeta(p, canal, oculto, args):
    nav = p.chromium.launch(channel=canal, headless=oculto, args=args) if canal else p.chromium.launch(headless=oculto, args=args)
    try:
        pg = nav.new_page()
        pg.set_content('<canvas id=c></canvas>')
        return pg.evaluate("""() => { const gl = document.getElementById('c').getContext('webgl2') || document.getElementById('c').getContext('webgl');
          if (!gl) return null; const e = gl.getExtension('WEBGL_debug_renderer_info');
          return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }""")
    finally:
        nav.close()

elegida = None
with sync_playwright() as p:
    for canal, oculto, args in MANERAS:
        try:
            r = tarjeta(p, canal, oculto, args)
        except Exception as e:
            print(f'  no abre ({canal or "por defecto"}, {"oculto" if oculto else "con ventana"}, {" ".join(args)}): {str(e).splitlines()[0][:160]}')
            continue
        bien = bool(r) and not any(s in r.lower() for s in SIN_TARJETA)
        print(f'  {"TARJETA" if bien else "sin tarjeta"}: {r} ({canal or "por defecto"}, {"oculto" if oculto else "con ventana"}, {" ".join(args)})')
        if bien:
            elegida = (canal, oculto, args, r)
            break

if not elegida:
    print('Ninguna manera llega a la tarjeta gráfica: estos grupos se harán en la nube.')
    sys.exit(3)
canal, oculto, args, r = elegida
print(f'Elegida: {r}')
env = os.environ.get('GITHUB_ENV')
if env:
    with open(env, 'a', encoding='utf8') as f:
        f.write(f'KINHOLD_GPU_ARGS={json.dumps(args)}\n')
        f.write(f'KINHOLD_GPU_CANAL={canal or ""}\n')
        f.write(f'KINHOLD_GPU_HEADLESS={"1" if oculto else "0"}\n')
        f.write(f'KINHOLD_GPU_TARJETA={r}\n')
        f.write(f'PYTHONPATH={os.path.dirname(os.path.abspath(__file__))}\n')
