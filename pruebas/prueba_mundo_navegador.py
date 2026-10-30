# Prueba en navegador de la demo en el mundo de verdad (construir en Whitholm, la isla de los playtests).
# Uso: python3 pruebas/prueba_mundo_navegador.py <html de la demo> <carpeta_capturas>
# Sirve el html en jugar/demo/ y los recursos de personaje en recursos/personajes/ (como la web).
# Comprueba, en PC y móvil: que se genera el mundo y aparece el terreno por trozos (sin el llano), que se sale en el sitio
# de salida (en la isla, en tierra y no en un pico; el mismo para todos), que el personaje pisa el suelo, que andando
# 200 m el terreno llega a tiempo (el trabajo del terreno en cada fotograma, medido) y el personaje sigue el suelo, y
# que no se puede entrar en el mar ni salir de la isla.
# MUTAR=1 abre la demo con ?llano=1 (el llano de antes): la prueba tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_mundo'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v12', 'taller-v13', 'taller-v14', 'taller-v15', 'taller-v16', 'taller-anim-v1']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = bool(os.environ.get('MUTAR'))
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir' + ('&llano=1' if MUTAR else '')
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# andar en línea recta `metros` a 1 m por fotograma (como en la prueba del mapa), dejando que el juego mueva la altura
ANDAR = """([metros, rumbo]) => new Promise(bien => {
  const k = window.__kinhold; let n = 0; const dif = []; k.msMundo.max = 0;
  const f = () => {
    if (n++ >= metros) { bien({ dif: Math.max(...dif), msMax: k.msMundo.max, x: k.pj.x, z: k.pj.z }); return; }
    k.pj.x += Math.cos(rumbo); k.pj.z += Math.sin(rumbo);
    if (n > 5) dif.push(Math.abs(k.pj.y - k.alturaSuelo(k.pj.x, k.pj.z)));
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
})"""

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    salidas = []
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL)
        try:
            pg.wait_for_function('document.querySelector("#demoGenerando")', timeout=20000)
            pg.screenshot(path=f'{SALIDA}/{nombre}_generando.png')
        except Exception: pass
        pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=240000)
        comprobar('la demo arranca sin error', not pg.evaluate('window.__demo.error'), str(pg.evaluate('window.__demo.error')))
        hay = pg.evaluate(f'!!({K}.mundoJ)')
        comprobar('construir va en el mundo de verdad (no en el llano)', hay)
        if not hay:
            ctx.close(); continue
        print('  generar el mapa:', pg.evaluate('window.__mundoDemo.msGenerar'), 'ms')
        try: pg.wait_for_function(f'{K}.mundoListo', timeout=240000)
        except Exception: pass
        comprobar('los trozos de alrededor llegan', pg.evaluate(f'{K}.mundoListo'))
        pg.wait_for_timeout(1500)
        d = pg.evaluate(f"""(() => {{ const k = {K}, m = k.mundoJ;
          let lo = Infinity, hi = -Infinity;
          for (let a = 0; a < 16; a++) for (const r of [50, 100, 200, 300]) {{ const y = m.sobreMar(Math.cos(a / 16 * 6.283) * r, Math.sin(a / 16 * 6.283) * r); lo = Math.min(lo, y); hi = Math.max(hi, y); }}
          let llano = false; k.escena.traverse(o => {{ if (o.name === 'suelo') llano = true; }});
          return {{ pj: [k.pj.x, k.pj.y, k.pj.z], suelo: k.alturaSuelo(k.pj.x, k.pj.z), sobreMar: m.sobreMar(k.pj.x, k.pj.z), salida: m.salida, isla: m.isla,
            trozos: [...m.terreno.vivos.values()].filter(v => v.malla).length, tri: m.terreno.triangulos(), lo, hi, llano, hilos: m.terreno.hilos }}; }})()""")
        print('  ', json.dumps(d))
        salidas.append((d['salida'], d['pj'][0], d['pj'][2]))
        s, isla = d['salida'], d['isla']
        comprobar('la salida está en la isla', isla['x0'] < s['x'] < isla['x1'] and isla['z0'] < s['z'] < isla['z1'], json.dumps(s))
        comprobar('la salida está en tierra, ni en el mar ni en un pico (entre 6 y 220 m)', 6 <= d['sobreMar'] <= 220, f"{d['sobreMar']:.1f} m")
        comprobar('el personaje pisa el suelo', abs(d['pj'][1] - d['suelo']) < 0.05, f"{d['pj'][1]:.3f} / {d['suelo']:.3f}")
        comprobar('sin el llano de antes, con el terreno por trozos (en un hilo aparte)', not d['llano'] and d['trozos'] >= 9 and d['hilos'] >= 1, f"{d['trozos']} trozos, {d['tri']} triángulos")
        comprobar('el terreno tiene relieve (más de 5 m de desnivel en 300 m)', d['hi'] - d['lo'] > 5, f"{d['lo']:.1f}–{d['hi']:.1f} m")
        pg.screenshot(path=f'{SALIDA}/{nombre}_salida.png')
        pg.evaluate(f'(() => {{ const k = {K}; k.cam.pitch = 0.32; k.cam.dist = 24; }})()'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_paisaje.png')
        # andar 200 m: el terreno llega a tiempo y el personaje sigue el suelo
        r = pg.evaluate(ANDAR, [200, 0.6])
        print('  andar 200 m:', json.dumps(r))
        comprobar('andando 200 m, el terreno trabaja poco en cada fotograma (menos de 60 ms)', r['msMax'] < 60, f"{r['msMax']:.1f} ms")
        comprobar('andando, el personaje sigue el suelo (a menos de 0,6 m)', r['dif'] < 0.6, f"{r['dif']:.2f} m")
        try: pg.wait_for_function(f'{K}.mundoListo', timeout=120000)
        except Exception: pass
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_andando.png')
        # el mar y el borde de la isla: buscar la costa en línea recta desde la salida y querer entrar en el agua
        c = pg.evaluate(f"""(() => {{ const m = {K}.mundoJ; let antes = null;
          for (const rumbo of [0, 1.57, 3.14, 4.71, 0.78, 2.36, 3.93, 5.5]) {{
            for (let r = 0; r < 40000; r += 2) {{ const x = Math.cos(rumbo) * r, z = Math.sin(rumbo) * r;
              if (m.sobreMar(x, z) < 0) {{ if (antes) return {{ tierra: antes, mar: [x, z], entra: m.andable(antes[0], antes[1], x, z), fuera: m.andable(0, 4, -40000, 4) }}; break; }}
              antes = [x, z]; }}
            antes = null; }}
          return null; }})()""")
        print('  costa:', json.dumps(c))
        comprobar('no se puede entrar en el mar', c is not None and c['entra'] is False, json.dumps(c))
        comprobar('no se puede salir de la isla', c is not None and c['fuera'] is False)
        if c:
            # llevar al personaje a la orilla y andar hacia el mar con la tecla: se queda en tierra
            # tierra adentro, donde el suelo ya está a 1 m sobre el mar
            pg.evaluate(f"""([tx, tz, mx, mz]) => {{ const k = {K}, l = Math.hypot(mx - tx, mz - tz) || 1; let d = 2;
              while (d < 400 && k.mundoJ.sobreMar(tx - (mx - tx) / l * d, tz - (mz - tz) / l * d) < 1) d += 2;
              k.pj.x = tx - (mx - tx) / l * d; k.pj.z = tz - (mz - tz) / l * d; }}""", c['tierra'] + c['mar'])
            try: pg.wait_for_function(f'{K}.mundoListo', timeout=120000)
            except Exception: pass
            pg.evaluate(f"""([tx, tz, mx, mz]) => {{ const k = {K}; k.cam.yaw = Math.atan2(-(mx - tx), -(mz - tz)); }}""", c['tierra'] + c['mar'])
            a0 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            # andar hacia el mar (más de lo que hace falta para llegar al agua)
            for _ in range(6):
                pg.keyboard.down('w'); pg.wait_for_timeout(2500); pg.keyboard.up('w')
            pg.wait_for_timeout(300)
            e = pg.evaluate(f"(() => {{ const k = {K}; return {{ sobreMar: k.mundoJ.sobreMar(k.pj.x, k.pj.z), x: k.pj.x, z: k.pj.z }}; }})()")
            e['andado'] = ((e['x'] - a0[0]) ** 2 + (e['z'] - a0[1]) ** 2) ** 0.5
            comprobar('andando hacia el mar, llega a la orilla y se queda en tierra', e['andado'] > 0.5 and e['sobreMar'] >= 0.1, json.dumps(e))
            pg.evaluate(f'(() => {{ const k = {K}; k.cam.pitch = 0.45; k.cam.dist = 20; }})()'); pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_costa.png')
        malos = [x for x in err if 'favicon' not in x]
        comprobar('sin errores en la página', not malos, '; '.join(malos[:3]))
        ctx.close()
    if len(salidas) == 2:
        comprobar('todos salen en el mismo sitio (en PC y en móvil, la misma salida y la misma posición)', salidas[0] == salidas[1], str(salidas))
    nav.close()

print(f'\n{len(fallos)} fallos' if fallos else '\nTodo bien')
sys.exit(1 if fallos else 0)
