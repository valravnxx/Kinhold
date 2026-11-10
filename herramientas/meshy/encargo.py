# Kinhold — los encargos a Meshy, en GitHub Actions (.github/workflows/meshy.yml). La clave llega en MESHY_API_KEY (secreto
# del repositorio) y nunca se escribe en ningún archivo. Lee herramientas/meshy/pedido.json:
#   {"accion": "saldo"}    cuántos créditos quedan
#   {"accion": "listar"}   los modelos ya hechos (en la web o por la API): sus datos, la imagen y el .glb, a salida/
#   {"accion": "biblioteca"} la biblioteca de animaciones de Meshy (gratis), a salida/biblioteca.json
# Lo que sale va a salida/ y vuelve por la rama meshy/<ejecución>.
import json, os, sys, urllib.request

CLAVE = os.environ.get('MESHY_API_KEY', '')
API = 'https://api.meshy.ai/openapi'
SAL = 'salida'
os.makedirs(SAL, exist_ok=True)

def pide(ruta):
    r = urllib.request.Request(API + ruta, headers={'Authorization': 'Bearer ' + CLAVE})
    with urllib.request.urlopen(r, timeout=60) as f:
        return json.load(f)

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

pedido = json.load(open('herramientas/meshy/pedido.json'))
if not CLAVE:
    print('FALTA la clave: no hay secreto MESHY_API_KEY'); open(f'{SAL}/saldo.txt', 'w').write('sin clave'); sys.exit(1)
saldo = pide('/v1/balance'); open(f'{SAL}/saldo.txt', 'w').write(json.dumps(saldo)); print('saldo', saldo)
if pedido.get('accion') == 'listar': listar()
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
