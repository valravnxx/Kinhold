# Baja texturas CC0 de ambientCG (se usa desde .github/workflows/texturas.yml). pedido.json:
#   {"buscar": {"hierba": "grass ground", ...}, "cuantas": 8}  → busca y deja la vista previa de las que salen (para elegir)
#   {"bajar": {"hierba": "Ground037", ...}}                     → baja esas en 1K (color, relieve y altura) a 512 px
# Todo va a salida/, con salida/lista.json (qué es cada una, con su nombre y su licencia).
import json, os, io, zipfile, urllib.request, urllib.parse
from PIL import Image
P = json.load(open('herramientas/texturas/pedido.json'))
os.makedirs('salida', exist_ok=True)
UA = {'User-Agent': 'kinhold-texturas/1.0 (GitHub Actions)'}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r: return r.read()
lista = {}
for que, q in (P.get('buscar') or {}).items():
    url = 'https://ambientcg.com/api/v2/full_json?' + urllib.parse.urlencode({'type': 'Material', 'q': q, 'limit': P.get('cuantas', 8), 'sort': 'Popular', 'include': 'previewData,tagData'})
    try: d = json.loads(get(url))
    except Exception as e: print('no se pudo buscar', que, e); continue
    lista[que] = []
    for a in d.get('foundAssets', []):
        i = a['assetId']; prev = (a.get('previewImage') or {})
        src = prev.get('512-JPG-FFFFFF') or prev.get('256-JPG-FFFFFF') or next(iter(prev.values()), None)
        lista[que].append({'id': i, 'nombre': a.get('displayName'), 'etiquetas': a.get('tags', [])[:8]})
        if src:
            try: Image.open(io.BytesIO(get(src))).convert('RGB').resize((256, 256)).save(f'salida/{que}__{i}.jpg', quality=85)
            except Exception as e: print('sin vista previa', i, e)
    print(que, [x['id'] for x in lista[que]])
for que, i in (P.get('bajar') or {}).items():
    try:
        z = zipfile.ZipFile(io.BytesIO(get(f'https://ambientcg.com/get?file={i}_1K-JPG.zip')))
    except Exception as e: print('no se pudo bajar', i, e); continue
    for n in z.namelist():
        for parte, sal in (('_Color', 'color'), ('_NormalGL', 'relieve'), ('_Displacement', 'altura'), ('_AmbientOcclusion', 'oclusion')):
            if parte in n and n.lower().endswith(('.jpg', '.png')):
                im = Image.open(io.BytesIO(z.read(n))); im = im.convert('L' if sal in ('altura', 'oclusion') else 'RGB').resize((512, 512), Image.LANCZOS)
                im.save(f'salida/{que}_{sal}.png')
    lista[que] = {'id': i, 'origen': f'https://ambientcg.com/a/{i}', 'licencia': 'CC0 1.0 (ambientCG)'}
    print('bajada', que, i)
json.dump(lista, open('salida/lista.json', 'w'), ensure_ascii=False, indent=1)
