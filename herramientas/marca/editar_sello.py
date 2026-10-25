# Edición del sello de Kinhold: quita el «KINHOLD» repetido de abajo y pone adornos como los de los lados
from PIL import Image, ImageFilter
import numpy as np, math, sys
a=np.array(Image.open(sys.argv[1] if len(sys.argv) > 1 else 'herramientas/marca/sello_original_gpt.png').convert('RGB')).astype(float)
cx,cy=622.5,614.0; R0,R1=337,466
h,w=a.shape[:2]; Y,X=np.mgrid[0:h,0:w]
r=np.hypot(X-cx,Y-cy); ang=np.degrees(np.arctan2(Y-cy,X-cx))
banda=(r>R0)&(r<R1)
negro=banda&(a.max(-1)<70)
borrar=banda&(ang>22)&(ang<158)
rng=np.random.default_rng(1)
muestras=a[negro]
relleno=muestras[rng.integers(0,len(muestras),(h,w))]
relleno=np.array(Image.fromarray(relleno.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(float)
b=a.copy(); b[borrar]=relleno[borrar]
def pegar(ox,oy,angulo_dest,n,rot):
    rc=np.hypot(ox-cx,oy-cy)
    tx=cx+rc*math.cos(math.radians(angulo_dest)); ty=cy+rc*math.sin(math.radians(angulo_dest))
    p=np.array(Image.fromarray(a[int(oy)-n:int(oy)+n+1, int(ox)-n:int(ox)+n+1].astype(np.uint8)).rotate(rot, resample=Image.BICUBIC)).astype(float)
    m=((p[...,0]>120)&(p[...,1]>95)).astype(float)
    m=np.array(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float)/255
    yy,xx=int(round(ty))-n,int(round(tx))-n
    sub=b[yy:yy+2*n+1, xx:xx+2*n+1]; sub[:]=sub*(1-m[...,None])+p*m[...,None]
CRUZ=(1017.5,612.6); PUNTO=(1013,738)
angp=math.degrees(math.atan2(PUNTO[1]-cy,PUNTO[0]-cx))
pegar(*CRUZ,90,46,-90)
extra=[]
for d in [angp]+extra:
    pegar(*PUNTO,90+d,16,0); pegar(*PUNTO,90-d,16,0)
Image.fromarray(b.clip(0,255).astype(np.uint8)).save('sello_kinhold.png')
Image.fromarray(b.clip(0,255).astype(np.uint8)).resize((627,627), Image.LANCZOS).save('paso2_peq.png')
print('punto a', angp)
