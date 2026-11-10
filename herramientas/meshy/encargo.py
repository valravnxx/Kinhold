# Kinhold — los encargos a Meshy, en GitHub Actions (.github/workflows/meshy.yml). La clave llega en MESHY_API_KEY (secreto
# del repositorio) y nunca se escribe en ningún archivo. Lee herramientas/meshy/pedido.json:
#   {"accion": "saldo"}    cuántos créditos quedan
#   {"accion": "listar"}   los modelos ya hechos (en la web o por la API): sus datos, la imagen y el .glb, a salida/
#   {"accion": "biblioteca"} la biblioteca de animaciones de Meshy (gratis), a salida/biblioteca.json
#   {"accion": "animar", "tope": 400, "personajes": [{"nombre": "hombre", "glb": "herramientas/meshy/entrada/hombre.glb",
#     "alto": 1.75}], "acciones": [{"id": 0, "nombre": "Idle"}, …]}
#   {"accion": "modelos", "tope": 300, "cosas": [{"nombre": "roca_mediana", "cosa": "…", "alto": 1.0, "tri": 800}]}
#     cada cosa: una imagen con el prompt de estilo entero (herramientas/meshy/estilo.md) + la cosa, sin fondo; de ella el
#     modelo 3D con el remallado de Meshy (tri: el tope de triángulos) y la textura guiada por la versión corta del estilo;
#     a salida/ van la imagen, el .glb y sus cuatro vistas; no empieza si pasaría del tope de créditos (unos 40 por cosa);
#     una cosa con «id» (un image-to-3d ya hecho) no se vuelve a pagar: se baja y se aligera con su «tri» de ahora
#     cada personaje se riggea por la API (5 créditos; la animación solo admite un rig hecho por la API) y se le ponen las
#     animaciones de la biblioteca de 10 en 10 (3 créditos cada una); no empieza si pasaría del tope de créditos
#   {"accion": "movimientos", "tope": 250, "rigs": {"hombre": "<rig_task_id>", "mujer": "…"}, "movimientos": [{"nombre": "hombro_andar",
#     "prompt": "…", "duracion": 4, "modo": "prime"}]}
#     cada movimiento: Text to Motion (prime 10 créditos, swift 3; de 2 a 10 s) y, con su motion_task_id, la Animation API
#     lo pasa al esqueleto de cada personaje (el rig hecho por la API); a salida/ van <personaje>_<nombre>.glb
# Lo que sale va a salida/ y vuelve por la rama meshy/<ejecución>.
import subprocess, base64, json, os, sys, time, urllib.request

CLAVE = os.environ.get('MESHY_API_KEY', '')
API = 'https://api.meshy.ai/openapi'
SAL = 'salida'
os.makedirs(SAL, exist_ok=True)

def pide(ruta):
    r = urllib.request.Request(API + ruta, headers={'Authorization': 'Bearer ' + CLAVE})
    with urllib.request.urlopen(r, timeout=60) as f:
        return json.load(f)

def manda(ruta, cuerpo):
    r = urllib.request.Request(API + ruta, data=json.dumps(cuerpo).encode(), method='POST',
                               headers={'Authorization': 'Bearer ' + CLAVE, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=300) as f:
        return json.load(f)

def espera(ruta, maximo=1800):
    t0 = time.time()
    while True:
        t = pide(ruta)
        if t.get('status') in ('SUCCEEDED', 'FAILED', 'CANCELED') or time.time() - t0 > maximo: return t
        time.sleep(8)

def urls(o, camino=''):
    # todas las direcciones de archivos de un resultado, con su camino (para bajarlas con nombre)
    if isinstance(o, dict):
        for k, v in o.items(): yield from urls(v, f'{camino}.{k}' if camino else k)
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from urls(v, f'{camino}.{i}')
    elif isinstance(o, str) and o.startswith('http') and any(x in o.split('?')[0] for x in ('.glb', '.fbx')):
        yield camino, o

def baja(url, destino):
    try:
        with urllib.request.urlopen(url, timeout=120) as f, open(destino, 'wb') as d:
            d.write(f.read())
        return os.path.getsize(destino)
    except Exception as e:
        return f'error {e}'

def listar():
    todo = []
    for tipo in ['text-to-3d', 'image-to-3d', 'multi-image-to-3d', 'retexture', 'remesh', 'rigging', 'text-to-image', 'image-to-image']:
        ver = 'v2' if tipo == 'text-to-3d' else 'v1'
        for pag in range(1, 6):
            try:
                l = pide(f'/{ver}/{tipo}?page_size=50&page_num={pag}&sort_by=-created_at')
            except Exception as e:
                todo.append({'tipo': tipo, 'error': str(e)}); break
            if not l: break
            for t in l:
                t['_tipo'] = tipo
                todo.append(t)
            if len(l) < 50: break
    resumen = []
    for t in todo:
        if 'error' in t: resumen.append(t); continue
        i = t.get('id', '?')
        r = {'tipo': t['_tipo'], 'id': i, 'estado': t.get('status'), 'creado': t.get('created_at'), 'prompt': (t.get('prompt') or t.get('texture_prompt') or '')[:300],
             'modelo': t.get('ai_model'), 'creditos': t.get('consumed_credits')}
        urls = t.get('model_urls') or {}
        if t.get('status') == 'SUCCEEDED':
            if t.get('thumbnail_url'): r['imagen'] = baja(t['thumbnail_url'], f'{SAL}/{i}.png')
            glb = urls.get('glb') or t.get('rigged_character_glb_url') or (t.get('result') or {}).get('rigged_character_glb_url')
            if glb: r['glb'] = baja(glb, f'{SAL}/{i}.glb')
            if t.get('image_urls'):
                for n, u in enumerate(t['image_urls'][:4]): r[f'img{n}'] = baja(u, f'{SAL}/{i}_{n}.png')
        resumen.append(r)
    json.dump(resumen, open(f'{SAL}/lista.json', 'w'), ensure_ascii=False, indent=1)
    print(f'{len(resumen)} tareas')
    for r in resumen: print(json.dumps(r, ensure_ascii=False)[:300])

def aligera(n, c):
    # la malla entera sin remallar pesa decenas de MB y no cabe en el push de vuelta (naturaleza5, 10 nov: HTTP 408):
    # se aligera aquí (herramientas/meshy/aligerar.mjs) y la cruda no vuelve
    crudo = f'{SAL}/{n}_crudo.glb'
    print(n, 'crudo', os.path.getsize(crudo) if os.path.exists(crudo) else 'no está')
    r = subprocess.run(['node', 'herramientas/meshy/aligerar.mjs', crudo, f'{SAL}/{n}.glb', str(c.get('tri', 3000)), str(c.get('alto', 1))], capture_output=True, text=True)
    print(n, 'aligerado', r.stdout.strip()[-300:], r.stderr.strip()[-300:])
    if r.returncode == 0: os.remove(crudo)

def recuperar():
    # vuelve a bajar los modelos de un encargo ya hecho (los guarda Meshy unos días), sin gastar: los image-to-3d
    # creados desde «desde» (segundos), del más viejo al más nuevo, con los nombres de «cosas» en ese orden
    l = pide('/v1/image-to-3d?page_size=50&page_num=1&sort_by=-created_at')
    l = sorted([t for t in l if t.get('created_at', 0) >= pedido['desde'] * 1000 and t.get('status') == 'SUCCEEDED'], key=lambda t: t['created_at'])
    print(len(l), 'modelos desde', pedido['desde'])
    if len(l) != len(pedido['cosas']): print('NO: no son tantos como las cosas del pedido'); sys.exit(1)
    for c, m in zip(pedido['cosas'], l):
        n = c['nombre']
        json.dump({k: v for k, v in m.items() if k != 'model_urls'}, open(f'{SAL}/{n}_tarea.json', 'w'), ensure_ascii=False, indent=1)
        baja(m['model_urls']['glb'], f'{SAL}/{n}_crudo.glb'); aligera(n, c)
        for lado, u in (m.get('thumbnail_urls') or {}).items(): baja(u, f'{SAL}/{n}_vista_{lado}.png')

pedido = json.load(open('herramientas/meshy/pedido.json'))
if not CLAVE:
    print('FALTA la clave: no hay secreto MESHY_API_KEY'); open(f'{SAL}/saldo.txt', 'w').write('sin clave'); sys.exit(1)
saldo = pide('/v1/balance'); open(f'{SAL}/saldo.txt', 'w').write(json.dumps(saldo)); print('saldo', saldo)
if pedido.get('accion') == 'listar': listar()
if pedido.get('accion') == 'recuperar': recuperar()
if pedido.get('accion') == 'animar':
    acciones = pedido['acciones']; pers = pedido['personajes']
    coste = len(pers) * (5 + 3 * len(acciones))
    print(f'coste previsto: {coste} créditos (tope {pedido.get("tope")})')
    if coste > pedido.get('tope', 0) or coste > saldo.get('balance', 0): print('NO: pasa del tope o del saldo'); sys.exit(1)
    informe = []
    for p in pers:
        d = 'data:application/octet-stream;base64,' + base64.b64encode(open(p['glb'], 'rb').read()).decode()
        rid = manda('/v1/rigging', {'model_url': d, 'height_meters': p.get('alto', 1.7)})['result']
        rig = espera(f'/v1/rigging/{rid}')
        print(p['nombre'], 'rig', rig.get('status'), rig.get('task_error'), 'créditos', rig.get('consumed_credits'))
        json.dump(rig, open(f'{SAL}/{p["nombre"]}_rig.json', 'w'), ensure_ascii=False, indent=1)
        if rig.get('status') != 'SUCCEEDED': informe.append({'personaje': p['nombre'], 'rig': rig.get('status'), 'error': rig.get('task_error')}); continue
        for c, u in urls(rig.get('result') or {}): print(' ', c, baja(u, f'{SAL}/{p["nombre"]}_rig_{c.replace(".", "_")}.{u.split("?")[0].rsplit(".", 1)[1]}'))
        for n in range(0, len(acciones), 10):
            lote = acciones[n:n + 10]
            aid = manda('/v1/animations', {'rig_task_id': rid, 'action_ids': [a['id'] for a in lote]})['result']
            a = espera(f'/v1/animations/{aid}')
            print(p['nombre'], 'animaciones', n, a.get('status'), a.get('task_error'), 'créditos', a.get('consumed_credits'))
            json.dump(a, open(f'{SAL}/{p["nombre"]}_anim_{n:02d}.json', 'w'), ensure_ascii=False, indent=1)
            for c, u in urls(a.get('result') or {}):
                print(' ', c, baja(u, f'{SAL}/{p["nombre"]}_anim_{n:02d}_{c.replace(".", "_")}.{u.split("?")[0].rsplit(".", 1)[1]}'))
            informe.append({'personaje': p['nombre'], 'lote': [x['nombre'] for x in lote], 'estado': a.get('status'), 'error': a.get('task_error'), 'creditos': a.get('consumed_credits')})
    json.dump(informe, open(f'{SAL}/informe.json', 'w'), ensure_ascii=False, indent=1)
    print('saldo al acabar', pide('/v1/balance'))
if pedido.get('accion') == 'modelos':
    est = open('herramientas/meshy/estilo.md').read()
    largo = est.split('## El prompt entero')[1].split('\n', 1)[1].split('## La versión corta')[0].strip()
    corto = est.split('## La versión corta')[1].split('\n', 1)[1].strip()
    # una cosa con «id» ya está pagada: se vuelve a bajar ese modelo (lo guarda Meshy unos días) y se aligera con su
    # «tri» y su «alto» de ahora, sin gastar
    cosas = pedido['cosas']; coste = 40 * len([c for c in cosas if not c.get('id')])
    print(f'coste previsto: unos {coste} créditos (tope {pedido.get("tope")})')
    if coste > pedido.get('tope', 0) or coste > saldo.get('balance', 0): print('NO: pasa del tope o del saldo'); sys.exit(1)
    informe = []
    for c in cosas:
        n = c['nombre']
        if c.get('id'):
            m = pide('/v1/image-to-3d/' + c['id'])
            print(n, 'ya hecho', m.get('status'))
            json.dump({k: v for k, v in m.items() if k != 'model_urls'}, open(f'{SAL}/{n}_tarea.json', 'w'), ensure_ascii=False, indent=1)
            if m.get('status') == 'SUCCEEDED':
                baja(m['model_urls']['glb'], f'{SAL}/{n}_crudo.glb'); aligera(n, c)
                for lado, u in (m.get('thumbnail_urls') or {}).items(): baja(u, f'{SAL}/{n}_vista_{lado}.png')
            informe.append({'nombre': n, 'alto': c.get('alto'), 'modelo_id': c['id'], 'estado': m.get('status'), 'creditos': 0})
            continue
        prompt = f"{largo}\n\nSUBJECT: {c['cosa']}\nA single isolated object, the whole of it in view, three-quarter view from slightly above, centred, on a plain neutral background, no other objects, no base, no ground plane, no text."
        im = espera('/v1/text-to-image/' + manda('/v1/text-to-image', {'ai_model': pedido.get('modelo_imagen', 'gpt-image-2-5-flare'), 'prompt': prompt[:4000], 'aspect_ratio': '1:1', 'remove_background': True})['result'])
        print(n, 'imagen', im.get('status'), im.get('task_error'), 'créditos', im.get('consumed_credits'))
        if im.get('status') != 'SUCCEEDED': informe.append({'nombre': n, 'imagen': im.get('status'), 'error': im.get('task_error')}); continue
        baja(im['image_urls'][0], f'{SAL}/{n}_imagen.png')
        # sin «textura_prompt»: la textura sale de la imagen (con el prompt corto, el follaje salió pardo, 10 nov)
        cuerpo = {'input_task_id': im['id'], 'should_texture': True, 'should_remesh': True,
                  'target_polycount': c.get('tri', 3000), 'topology': 'triangle', 'target_formats': ['glb'], 'multi_view_thumbnails': True}
        # «remallado»: false = la malla tal cual sale (sin el remallado de Meshy, que a pocos triángulos deja el follaje en
        # esquirlas, naturaleza 1 a 4); se aligera luego aquí con herramientas/meshy/aligerar.mjs (simplificar y texturas de 1024)
        if not pedido.get('remallado', True):
            cuerpo['should_remesh'] = False; cuerpo.pop('target_polycount'); cuerpo.pop('topology')
        if pedido.get('modelo_3d'): cuerpo['ai_model'] = pedido['modelo_3d']
        if pedido.get('textura_prompt', True): cuerpo['texture_prompt'] = corto[:800]
        m = espera('/v1/image-to-3d/' + manda('/v1/image-to-3d', cuerpo)['result'])
        print(n, 'modelo', m.get('status'), m.get('task_error'), 'créditos', m.get('consumed_credits'))
        json.dump({k: v for k, v in m.items() if k != 'model_urls'}, open(f'{SAL}/{n}_tarea.json', 'w'), ensure_ascii=False, indent=1)
        if m.get('status') == 'SUCCEEDED':
            if pedido.get('remallado', True): baja(m['model_urls']['glb'], f'{SAL}/{n}.glb')
            else: baja(m['model_urls']['glb'], f'{SAL}/{n}_crudo.glb'); aligera(n, c)
            for lado, u in (m.get('thumbnail_urls') or {}).items(): baja(u, f'{SAL}/{n}_vista_{lado}.png')
        informe.append({'nombre': n, 'alto': c.get('alto'), 'imagen_id': im['id'], 'modelo_id': m.get('id'), 'estado': m.get('status'), 'error': m.get('task_error'),
                        'creditos': (im.get('consumed_credits') or 0) + (m.get('consumed_credits') or 0)})
    json.dump(informe, open(f'{SAL}/informe.json', 'w'), ensure_ascii=False, indent=1)
    print('saldo al acabar', pide('/v1/balance'))
if pedido.get('accion') == 'movimientos':
    movs = pedido['movimientos']; rigs = pedido['rigs']
    coste = sum((10 if m.get('modo', 'prime') == 'prime' else 3) + 3 * len(rigs) for m in movs)
    print(f'coste previsto: unos {coste} créditos (tope {pedido.get("tope")})')
    if coste > pedido.get('tope', 0) or coste > saldo.get('balance', 0): print('NO: pasa del tope o del saldo'); sys.exit(1)
    informe = []
    for m in movs:
        n = m['nombre']
        t = espera('/v1/text-to-motion/' + manda('/v1/text-to-motion', {'prompt': m['prompt'][:400], 'mode': m.get('modo', 'prime'), 'duration': m.get('duracion', 4)})['result'])
        print(n, 'movimiento', t.get('status'), t.get('task_error'), 'créditos', t.get('consumed_credits'))
        r = {'nombre': n, 'movimiento': t.get('status'), 'error': t.get('task_error'), 'creditos': t.get('consumed_credits') or 0}
        if t.get('status') == 'SUCCEEDED':
            for quien, rid in rigs.items():
                a = espera('/v1/animations/' + manda('/v1/animations', {'rig_task_id': rid, 'motion_task_id': t['id']})['result'])
                print(' ', quien, a.get('status'), a.get('task_error'), 'créditos', a.get('consumed_credits'))
                r[quien] = a.get('status'); r['creditos'] += a.get('consumed_credits') or 0
                glb = (a.get('result') or {}).get('animation_glb_url')
                if glb: r[quien + '_glb'] = baja(glb, f'{SAL}/{quien}_{n}.glb')
        informe.append(r)
    json.dump(informe, open(f'{SAL}/informe.json', 'w'), ensure_ascii=False, indent=1)
    print('saldo al acabar', pide('/v1/balance'))
if pedido.get('accion') == 'biblioteca':
    todo = []
    for pag in range(1, 40):
        try: l = pide(f'/v1/animations/library?page_size=100&page_num={pag}')
        except Exception as e: print('error', e); break
        items = l if isinstance(l, list) else (l.get('result') or l.get('items') or l.get('data') or [])
        if not items: break
        todo += items
        if len(items) < 100: break
    json.dump(todo, open(f'{SAL}/biblioteca.json', 'w'), ensure_ascii=False, indent=1)
    print(len(todo), 'animaciones')
