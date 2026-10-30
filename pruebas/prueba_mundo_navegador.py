# Prueba en navegador de la demo en el mundo de verdad (construir en Whitholm, la isla de los playtests).
# Uso: python3 pruebas/prueba_mundo_navegador.py <html de la demo> <carpeta_capturas>
# Sirve el html en jugar/demo/ y los recursos de personaje en recursos/personajes/ (como la web).
# Comprueba, en PC y móvil: que se genera el mundo y aparece el terreno por trozos (sin el llano), que se sale en el sitio
# de salida (en la isla, en tierra y no en un pico), que el personaje pisa el suelo, que andando
# 200 m el terreno llega a tiempo (el trabajo del terreno en cada fotograma, medido) y el personaje sigue el suelo, y
# que no se puede salir de la isla. Y el agua y el nado (valravnx, 30 oct): al mar se entra y se nada (el agua se ve,
# con su lámina de cerca), con el anillo del aguante, y sin aguante te ahogas y vuelves a tu sitio de salida. Y la salida al azar (valravnx, 30 oct): un jugador nuevo sale en
# uno de los sitios de la lista (src/logica/whitholm.js), al recargar vuelve al mismo, y quien ya tenía algo guardado de
# antes sigue en el sitio común (donde está lo que construyó).
# Y lo que crece (src/mundo/vegetacion_mundo.js): árboles de las especies de su sitio, hierba, flores, matas y piedras,
# nada en el agua ni pegado a la salida, los árboles se pueden talar, los que tapan al personaje no se dibujan, y al
# recargar está todo en el mismo sitio.
# MUTAR=1 abre la demo con ?llano=1 (el llano de antes): la prueba tiene que fallar.
# MUTAR_NADO=1: no se le quita el aguante al nadar (no se ahoga): tiene que fallar.
# MUTAR=2: lo que crece, con otra semilla en cada carga: tiene que fallar (no sale en el mismo sitio al recargar).
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_mundo'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v12', 'taller-v13', 'taller-v14', 'taller-v15', 'taller-v16', 'taller-v17', 'taller-anim-v1']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = os.environ.get('MUTAR', '')
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir' + ('&llano=1' if MUTAR == '1' else '')
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
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        if MUTAR == '2': ctx.add_init_script('window.__mutarVegetacion = true')
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
          for (let a = 0; a < 16; a++) for (const r of [50, 100, 200, 300, 1000, 2000]) {{ const y = m.sobreMar(Math.cos(a / 16 * 6.283) * r, Math.sin(a / 16 * 6.283) * r); lo = Math.min(lo, y); hi = Math.max(hi, y); }}
          let llano = false; k.escena.traverse(o => {{ if (o.name === 'suelo') llano = true; }});
          return {{ pj: [k.pj.x, k.pj.y, k.pj.z], suelo: k.alturaSuelo(k.pj.x, k.pj.z), sobreMar: m.sobreMar(k.pj.x, k.pj.z), salida: m.salida, isla: m.isla,
            trozos: [...m.terreno.vivos.values()].filter(v => v.malla).length, tri: m.terreno.triangulos(), lo, hi, llano, hilos: m.terreno.hilos }}; }})()""")
        print('  ', json.dumps(d))
        s, isla = d['salida'], d['isla']
        comprobar('un jugador nuevo sale en uno de los sitios de la salida al azar', pg.evaluate(f"{K}.salidas.deLista({s['x']}, {s['z']})"), json.dumps(s))
        comprobar('la salida está en la isla', isla['x0'] < s['x'] < isla['x1'] and isla['z0'] < s['z'] < isla['z1'], json.dumps(s))
        comprobar('la salida está en tierra, ni en el mar ni en un pico (entre 6 y 220 m)', 6 <= d['sobreMar'] <= 220, f"{d['sobreMar']:.1f} m")
        comprobar('el personaje pisa el suelo', abs(d['pj'][1] - d['suelo']) < 0.05, f"{d['pj'][1]:.3f} / {d['suelo']:.3f}")
        comprobar('sin el llano de antes, con el terreno por trozos (en un hilo aparte)', not d['llano'] and d['trozos'] >= 9 and d['hilos'] >= 1, f"{d['trozos']} trozos, {d['tri']} triángulos")
        comprobar('el terreno tiene relieve (más de 5 m de desnivel en 2 km; la salida al azar puede caer en una vega muy llana)', d['hi'] - d['lo'] > 5, f"{d['lo']:.1f}–{d['hi']:.1f} m")
        # lo que crece
        v = pg.evaluate(f"""(() => {{ const k = {K}, m = k.mundoJ, c = k.decorado.cuenta, arb = k.obstaculos.filter(o => o.arbol);
          const ESP = ['abeto', 'pino', 'abedul', 'roble', 'haya', 'fresno', 'encina'];
          let agua = 0; for (const o of k.obstaculos) if (!m.seco(o.x, o.z)) agua++;
          const firma = arb.map(o => o.id + ':' + o.especie).sort().join('|');
          let h = 0; for (const ch of firma) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
          return {{ cuenta: c, arboles: arb.length, especies: [...new Set(arb.map(o => o.especie))], buenas: arb.every(o => ESP.includes(o.especie)),
            agua, cerca: Math.min(...arb.map(o => Math.hypot(o.x, o.z - 2))), talables: arb.filter(o => o.id && k.talaV.porId.has(o.id)).length, firma: h,
            mallas: ESP.filter(e => ['arboles_', 'arbolesMedios_', 'arbolesLejos_'].some(n => k.escena.getObjectByName(n + e))) }}; }})()""")
        print('  lo que crece:', json.dumps({x: v[x] for x in ['cuenta', 'especies', 'agua', 'cerca', 'talables', 'firma']}))
        c = v['cuenta']
        comprobar('hay árboles, de las especies del mundo, cada una con su malla', v['arboles'] > 20 and v['buenas'] and sorted(v['mallas']) == sorted(v['especies']), ', '.join(v['especies']))
        comprobar('hay hierba, matas y piedras', c['hierba'] > 300 and c['matas'] > 5 and c['piedras'] > 10, f"{c['hierba']} hierba, {c['flores']} flores, {c['matas']} matas, {c['piedras']} piedras")
        comprobar('nada en el agua', v['agua'] == 0, f"{v['agua']}")
        comprobar('ningún árbol pegado a la salida (a menos de 8 m)', v['cerca'] >= 8, f"{v['cerca']:.1f} m")
        comprobar('todos los árboles se pueden talar', v['talables'] == v['arboles'], f"{v['talables']} de {v['arboles']}")
        comprobar('hacer lo que crece tarda poco al cargar (menos de 3 s)', c['ms'] < 3000, f"{c['ms']} ms")
        # los árboles que tapan al personaje no se dibujan: poner uno detrás de él, entre la cámara y él
        t = pg.evaluate(f"""(() => {{ const k = {K}, o = k.obstaculos.filter(o => o.arbol).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0];
          k.pj.x = o.x + Math.sin(k.cam.yaw) * -5; k.pj.z = o.z + Math.cos(k.cam.yaw) * -5; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z);
          return new Promise(bien => setTimeout(() => {{ const m = new k.escena.matrixWorld.constructor(); o.malla.getMatrixAt(o.instancia, m);
            bien({{ tapan: k.decorado.tapan, escondido: Math.abs(m.determinant()) < 1e-9 }}); }}, 1500)); }})()""")
        comprobar('el árbol entre la cámara y el personaje no se dibuja', t['escondido'] and t['tapan'] >= 1, json.dumps(t))
        pg.screenshot(path=f'{SALIDA}/{nombre}_bosque.png')
        pg.evaluate(f'(() => {{ const k = {K}; k.pj.x = 0; k.pj.z = 4; k.pj.y = k.alturaSuelo(0, 4); }})()')
        pg.wait_for_timeout(800)
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
        # el mar y el borde de la isla: buscar la costa en línea recta desde la salida (en varios rumbos, hasta una que no
        # sea llana) y querer entrar en el agua
        c = pg.evaluate(f"""(() => {{ const m = {K}.mundoJ; let antes = null;
          for (const rumbo of [0, 1.57, 3.14, 4.71, 0.78, 2.36, 3.93, 5.5]) {{
            for (let r = 0; r < 40000; r += 2) {{ const x = Math.cos(rumbo) * r, z = Math.sin(rumbo) * r;
              if (m.sobreMar(x, z) < 0) {{
                // una costa donde la tierra sube a 1 m sobre el mar a menos de 400 m (no una marisma ni una ría llana):
                // ahí se pone luego al personaje para que ande hacia el mar
                let d = 2; while (d < 400 && m.sobreMar(x - Math.cos(rumbo) * d, z - Math.sin(rumbo) * d) < 1) d += 2;
                if (antes && d < 400) return {{ tierra: antes, mar: [x, z], entra: m.andable(antes[0], antes[1], x, z), fuera: m.andable(0, 4, -70000, 4) }};
                break; }}
              antes = [x, z]; }}
            antes = null; }}
          return null; }})()""")
        print('  costa:', json.dumps(c))
        comprobar('al mar se puede entrar (a nado)', c is not None and c['entra'] is True, json.dumps(c))
        comprobar('no se puede salir de la isla', c is not None and c['fuera'] is False)
        if c:
            # llevar al personaje a la orilla y andar hacia el mar con la tecla: entra en el agua y nada
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
            e = pg.evaluate(f"(() => {{ const k = {K}, a = k.mundoJ.aguaEn(k.pj.x, k.pj.z); return {{ sobreMar: k.mundoJ.sobreMar(k.pj.x, k.pj.z), x: k.pj.x, z: k.pj.z, y: k.pj.y, modo: k.nado.modo, superficie: a && a.superficie, aguante: k.nado.e.aguante, anillo: !document.getElementById('aguante')?.hidden, lamina: !!k.mundoJ.agua.malla }}; }})()")
            e['andado'] = ((e['x'] - a0[0]) ** 2 + (e['z'] - a0[1]) ** 2) ** 0.5
            comprobar('andando hacia el mar, avanza (ya no le para la orilla)', e['andado'] > 0.5, json.dumps(e))
            # mar adentro (donde cubre más de 4 m): nada con la cabeza fuera, el aguante baja y se ve su anillo
            # (en esta máquina sin tarjeta gráfica el juego va a pocos fotogramas: andando no se llega; se le lleva)
            pg.evaluate(f"""([tx, tz, mx, mz]) => {{ const k = {K}, l = Math.hypot(mx - tx, mz - tz) || 1; let d = 0;
              while (d < 4000 && !(k.mundoJ.sobreMar(mx + (mx - tx) / l * d, mz + (mz - tz) / l * d) < -4 && k.mundoJ.sobreMar(mx + (mx - tx) / l * (d + 30), mz + (mz - tz) / l * (d + 30)) < -4)) d += 4;
              d += 15; k.pj.x = mx + (mx - tx) / l * d; k.pj.z = mz + (mz - tz) / l * d; }}""", c['tierra'] + c['mar'])
            try: pg.wait_for_function(f'{K}.mundoListo && {K}.mundoJ.agua.cerca({K}.pj.x, {K}.pj.z)', timeout=300000)
            except Exception: pass
            pg.keyboard.down('w'); pg.wait_for_timeout(3000); pg.keyboard.up('w'); pg.wait_for_timeout(500)
            e = pg.evaluate(f"(() => {{ const k = {K}, a = k.mundoJ.aguaEn(k.pj.x, k.pj.z); return {{ sobreMar: k.mundoJ.sobreMar(k.pj.x, k.pj.z), x: k.pj.x, z: k.pj.z, y: k.pj.y, modo: k.nado.modo, superficie: a && a.superficie, aguante: k.nado.e.aguante, anillo: !document.getElementById('aguante')?.hidden, lamina: k.mundoJ.agua.cerca(k.pj.x, k.pj.z) }}; }})()")
            comprobar('mar adentro nada, con la cabeza fuera (el pecho a ras del agua, con las olas)', e['modo'] == 'nadar' and e['superficie'] is not None and abs(e['y'] - (e['superficie'] - 1.25)) < 0.65, json.dumps(e))
            comprobar('nadando, el aguante baja y se ve su anillo', e['aguante'] < 1 and e['anillo'], json.dumps(e))
            comprobar('el agua de cerca se dibuja (la lámina de ríos y mar)', e['lamina'])
            # la captura, con la cámara del lado del mar (por detrás, tierra adentro, la tapa la costa y se acerca mucho)
            pg.evaluate(f"""([tx, tz, mx, mz]) => {{ const k = {K}; k.cam.yaw = Math.atan2(mx - tx, mz - tz) + 0.5; k.cam.pitch = 0.4; k.cam.dist = 16; }}""", c['tierra'] + c['mar'])
            pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_costa.png')
            pg.evaluate(f"(() => {{ const k = {K}; k.cam.pitch = 0.18; k.cam.dist = 7; }})()"); pg.wait_for_timeout(1200)
            pg.screenshot(path=f'{SALIDA}/{nombre}_nadando.png')
            # sin aguante, nadando, te ahogas: a los pocos segundos vuelves a tu sitio de salida
            # (se le deja casi ahogado: lo que se tarda en ahogarse ya lo mide la prueba de lógica, y aquí, a menos de 1
            # fotograma por segundo, 8 s de juego son muchos minutos)
            if not os.environ.get('MUTAR_NADO'): pg.evaluate(f"Object.assign({K}.nado.e, {{ aguante: 0, ahogo: 0.9 }})")
            # (8 s de juego sin aguante; a los pocos fotogramas por segundo de esta máquina, bastante más de reloj)
            try: pg.wait_for_function(f'{K}.nado.muertes > 0', timeout=300000)
            except Exception: pass
            ah = pg.evaluate(f"(() => {{ const k = {K}; return {{ muertes: k.nado.muertes, x: k.pj.x, z: k.pj.z, aviso: document.getElementById('aviso').textContent }}; }})()")
            comprobar('sin aguante te ahogas y vuelves a tu sitio de salida', ah['muertes'] >= 1 and abs(ah['x']) < 5 and abs(ah['z'] - 4) < 5, json.dumps(ah))
        if not movil:
            # al recargar, el mismo sitio; con algo guardado de antes de la salida al azar, el sitio común
            def salida_tras_recargar():
                pg.reload()
                pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=240000)
                return pg.evaluate(f'{K}.mundoJ && {K}.mundoJ.salida')
            s2 = salida_tras_recargar()
            comprobar('al recargar, sale en el mismo sitio', s2 == s, f'{json.dumps(s)} → {json.dumps(s2)}')
            f2 = pg.evaluate(f"""(() => {{ const firma = {K}.obstaculos.filter(o => o.arbol).map(o => o.id + ':' + o.especie).sort().join('|');
              let h = 0; for (const ch of firma) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }})()""")
            comprobar('al recargar, cada árbol está en el mismo sitio y es de la misma especie', f2 == v['firma'], f"{v['firma']} → {f2}")
            pg.evaluate(f"(() => {{ localStorage.removeItem('kinhold_salida_v1'); localStorage.setItem('kinhold_h1_v1', JSON.stringify({K}.mundo.exportar())); }})()")
            s3 = salida_tras_recargar()
            comun = pg.evaluate(f'{K}.salidas.comun')
            comprobar('quien ya jugaba antes (con algo guardado) sigue en el sitio común', s3 and s3['x'] == comun['x'] and s3['z'] == comun['z'], json.dumps(s3))
        malos = [x for x in err if 'favicon' not in x]
        comprobar('sin errores en la página', not malos, '; '.join(malos[:3]))
        ctx.close()
    nav.close()

print(f'\n{len(fallos)} fallos' if fallos else '\nTodo bien')
sys.exit(1 if fallos else 0)
