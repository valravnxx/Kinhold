# Taller de personajes: cómo montarlo desde cero

El taller hace los personajes del juego sin pantalla: Blender (instalado como paquete de Python, `bpy`) con la extensión
MPFB2 de MakeHuman crea el cuerpo, y `vestir_mpfb.py` le pone por código la piel, el pelo y la ropa por capas. Luego
`pasar_animaciones.mjs` le pasa las animaciones y `preparar_mh.mjs` lo comprime para la web.

Las versiones de todo están fijadas en **`versiones.json`**. `vestir_mpfb.py` y `mpfb_prueba.py` las comprueban al
empezar y paran si algo no coincide (lo encontrado se guarda en `taller_versiones.json`, junto a los personajes que salen).

## Lo que hace falta

- Linux x86_64 con Python de la versión fijada (`python` en `versiones.json`: el paquete `bpy` solo existe para esa).
- git, node de la versión mayor fijada y npm.
- Sitio en disco: el paquete `bpy` ocupa unos 880 MB y el repositorio de MPFB2 unos 180 MB (medido el 25 oct 2026).
- No hacen falta los paquetes de recursos de MakeHuman (pieles, ojos, pelo): la piel y la ropa se pintan por código.

## Montarlo (automático)

```
bash herramientas/taller/montar_taller.sh            # clona MPFB2 en ~/mpfb2
bash herramientas/taller/montar_taller.sh /otra/ruta  # o donde se diga
```

Instala `bpy`, `numpy` y `pillow` en sus versiones, clona MPFB2 y lo deja en su commit, lo enlaza como extensión de
Blender y hace `npm ci`. Al final pasa la comprobación. En este servidor tardó unos 2 minutos solo en bajar `bpy`.

## Montarlo a mano (lo mismo, paso a paso)

1. `python3 -m pip install bpy==<versión> numpy==<versión> pillow==<versión> --break-system-packages`
   (sin `--break-system-packages` si se usa un entorno virtual).
2. `git clone https://github.com/makehumancommunity/mpfb2.git ~/mpfb2 && git -C ~/mpfb2 checkout <commit>`
3. Enlazar la extensión donde la busca Blender, con la versión mayor.menor de `bpy` (para 5.2.3, `5.2`):
   `mkdir -p ~/.config/blender/5.2/extensions/user_default && ln -sfn ~/mpfb2/src/mpfb ~/.config/blender/5.2/extensions/user_default/mpfb`
4. `npm ci` en la raíz del proyecto (las versiones de node salen de `package-lock.json`).
5. `python3 herramientas/taller/comprobar_taller.py` → tiene que terminar en «Todo coincide con versiones.json.»

## Comprobar que sale lo mismo

```
FOTOS=pocas python3 herramientas/taller/vestir_mpfb.py /tmp/vestir
```

Hace los dos personajes (`hombre.glb`, `mujer.glb`), sus texturas y unas fotos de prueba (Cycles en CPU). En este servidor
(2 núcleos) tardó unos 7 minutos. El 25 oct 2026 se comprobó así, montado desde cero con estas versiones: las
47 mallas (24 del hombre y 23 de la mujer) salen con el mismo número de vértices y la misma caja que en los recursos
publicados `taller-v4`. No comprobado: que las texturas salgan idénticas píxel a píxel.

## Cambiar una versión

1. Cambiarla en `versiones.json` (versiones exactas; el commit de MPFB2, con el hash entero).
2. `bash herramientas/taller/montar_taller.sh` y volver a generar los personajes.
3. Mirar las fotos y comparar con los recursos publicados antes de hacer una versión nueva de recursos
   (`docs/recursos/personajes/taller-vN/` no se tocan nunca; lo nuevo va en otra carpeta).

Para probar algo con otras versiones sin cambiar las fijadas: `TALLER_SIN_COMPROBAR=1` (avisa, pero no para).
Nunca se publica nada hecho así.

## Prueba

`python3 herramientas/taller/comprobar_taller.py --prueba` (va en `herramientas/probar_todo.sh`, no necesita Blender):
comprueba el formato de `versiones.json`, que una versión distinta se detecta y que el montaje lee las versiones de
`versiones.json` en vez de copiarlas. Con `MUTAR=1` se rompe a propósito y falla.

## Personalización (desde taller-v9)

`vestir_mpfb.py` deja en cada personaje lo que el juego necesita para cambiar el aspecto sin rehacer nada
(la lógica, los valores y las paletas están en `src/logica/aspecto.js`; el cargador, en `src/personajes/makehuman.js`):

- **Formas del modelo** (morph targets) `peso`, `musculo`, `cara`, `nariz`, `nariz_larga` y `menton`, cada una con su
  `_mas` y su `_menos`. Se calculan creando el mismo humano de MakeHuman con ese ajuste (o ese objetivo) puesto del todo
  y restando la base; cada vértice de cada pieza se mueve lo mismo que el punto del cuerpo del que sale (`MAPA`, que se
  guarda también después de diezmar). Una pieza solo lleva las formas que la mueven más de medio milímetro.
  El juego no las deja en la GPU: al cambiar el aspecto las suma en las posiciones de la malla (`ponerFormas` en
  `src/personajes/makehuman.js`), así no cuestan nada en cada fotograma.
- **Colores aparte:** la piel y el pelo se pintan en un gris de referencia (`REF_PIEL`, `REF_PELO`) y su color va en el
  material (`baseColorFactor`, con un nodo «Mezclar» en multiplicar). Cada pieza que cambia de color lleva en sus extras
  `tinte` (piel, pelo u ojos) y `ref`; el juego pone color lineal / ref. El iris va en su propia pieza.
- **Calcos de pelo** (`_vello`: cejas y pelo pintado; `_barba_corta`, `_barba_bigote`): la malla de la piel donde pintan,
  despegada 1 mm, con transparencia; el juego los dibuja con mezcla y `polygonOffset`. La cara de la piel no se diezma
  para que no los atraviese.

Prueba: `node pruebas/prueba_aspecto_modelos.mjs` (con `MUTAR=1` mira la taller-v8, que no los tiene, y falla).

## Pies descalzos (desde taller-v12)

La piel del cuerpo solo tiene cabeza, cuello y manos; lo demás lo tapa la ropa. Para ir descalzo (el GDD empieza así)
está la pieza `<sexo>_pies`: la piel de los pies hasta un poco por encima del tobillo (en la mujer, hasta donde las botas
bajas), con su tinte de piel, uñas y la planta algo más oscura. El juego la enseña con la capa `descalzo` (sin zapatos;
con botas se ven las botas): `TALLER.descalzo` en `src/logica/prendas.js` y `ponerCapas` en `src/personajes/makehuman.js`.
Lo puesto sin calzado se dibuja descalzo (`capasDibujo`). El bajo de las calzas se deja recto (`bajo_recto`), porque
descalzo se ve. Fotos de cerca: `FOTOS=pies python3 herramientas/taller/vestir_mpfb.py <carpeta>`.
Prueba: `node pruebas/prueba_pies.mjs` (con `MUTAR=1` mira la taller-v11, que no tiene pies, y falla).

## Peinados y barbas (desde taller-v10)

- **Pelo corto** (`_pelo`, cáscara sobre el cráneo): lo llevan los dos cuerpos; es la base de los peinados largos.
- **Melena, coleta y trenzas** (`_pelo_melena`, `_pelo_coleta`, `_pelo_trenzas`; `pelo_largo()` en `vestir_mpfb.py`):
  mallas propias, no trozos de la piel. La melena es una cortina que cae del cráneo (radio medido con rayos desde fuera
  contra la piel, que nunca se mete hacia dentro al bajar) y se apoya en el cuello y los hombros; la coleta y las trenzas
  son tubos que bajan por la espalda a unos centímetros de la piel. Su mapa UV va a lo largo y la textura (mechones,
  puntas desiguales en la transparencia) se pinta directamente en él. Pesos: `head` arriba, `neck_01` en medio y
  `spine_03` abajo.
- **Barba larga** (`_barba_larga`, rehecha en taller-v14): malla propia con volumen, como la melena. Columnas de patilla
  a patilla; cada una baja a 2-12 mm de la piel (medida con rayos desde fuera), bajo el mentón cae recta (sin ir hacia
  delante ni meterse hacia el cuello; a los lados sigue la mandíbula) y vuelve por detrás en línea recta hasta la
  garganta: de perfil, una cuña maciza. Punta y bordes desiguales en la transparencia; el juego la recorta (alphaTest),
  no es un calco. Va con la corta pintada debajo. Antes (hasta taller-v13) era la piel estirada: una lámina hueca.
- **Desde taller-v17:** la larga tiene ondas distintas en cada mechón (antes una sola onda para toda la barba, en fila)
  y por los lados nace también detrás de la patilla, en el lado del cuello, y baja unos 4 cm bajo el mentón (de frente
  ya no asoma el cuello a los lados de la barbilla). **Bigote con volumen** (`_barba_mostacho`): malla propia de comisura
  a comisura; nace en la piel bajo la nariz, se abomba unos 5 mm sobre el labio de arriba (nunca más fuera que el labio
  más 3 mm, para que el rayo no dé en la nariz) y cae hacia fuera y abajo por las comisuras; punta desigual pelo a pelo.
  Va encima del bigote pintado con la corta, la larga, el bigote y la perilla (`piezasCabeza`).
- **Corta, bigote y perilla** (calcos): tupidos por dentro con grano de pelo a lo largo de la caída (`pelos_barba`), y
  en el borde el grano fino deshace la línea en pelos sueltos. Fuera de la zona de la barba no pintan nada.
- Fotos muy de cerca de cada barba (frente, tres cuartos y perfil): `SOLO=hombre FOTOS=barbas BARBAS=larga,corta
  python3 herramientas/taller/vestir_mpfb.py <carpeta>` (`SOLO=hombre` solo sirve para probar: nunca se publica así).
  Para mirar la forma de la larga sin fotos: `VOLCAR_BARBA=<archivo.npy> SOLO_VOLCAR=1` (guarda los puntos y para).
- Prueba: `node pruebas/prueba_barbas.mjs` (con `MUTAR=1` mira la taller-v13, con la lámina, y falla).
- La mujer lleva también orejas aparte y pelo corto para cuando no lleva la cofia.
- Qué se ve con cada peinado, barba y tocado: `piezasCabeza()` en `src/logica/aspecto.js` (el juego y las fotos del
  taller hacen lo mismo). Fotos de cerca de cada uno: `FOTOS=peinados python3 herramientas/taller/vestir_mpfb.py <carpeta>`.

## Ropa teñible y blasón (desde taller-v13)

La tela y el cuero de las prendas (camisa, calzas, túnica o vestido, gambesón, sobreveste, manto, capucha, toca, zapatos
y botas) se pintan en el gris `REF_ROPA` y su color va en el material, como la piel y el pelo. Cada pieza lleva en sus
extras `tinte: "ropa"`, `ref` y `prenda` (qué prenda es). El juego le pone el color del tinte elegido (paletas, colores
sin teñir y tintes por defecto en `src/logica/tintes.js`; `ponerTintes` en `src/personajes/makehuman.js`). Con los
tintes por defecto el color es el mismo que llevaba pintado antes. La cota de malla, el sombrero y los cinturones no se
tiñen. El blasón de la sobreveste no va en la textura: lo dibuja un sombreado por la posición de cada punto en reposo.
Prueba: `node pruebas/prueba_tintes.mjs` (con `MUTAR=1` mira la taller-v12, sin tintes, y falla).
- **Capa** (`_capa_manto` y `_capa_manto_broche`, rehecha en taller-v15): malla propia, no el cuerpo empujado. Para cada
  dirección alrededor del cuerpo se mide el perfil del tronco y las piernas (sin los brazos, salvo lo alto del hombro)
  dilatado con la holgura; de arriba abajo la tela no vuelve hacia dentro y se abre un poco al bajar. Cada columna recorre
  ese perfil por su largo; pliegues que crecen hacia el bajo; bajo y bordes de delante doblados hacia dentro. Pesos:
  clavículas y espalda arriba, columna y pelvis abajo. Fotos de cerca con los brazos en reposo y bajados:
  `FOTOS=manto BRAZOS=0,0,-38 python3 herramientas/taller/vestir_mpfb.py /tmp/vestir`.
  Desde taller-v16, en el perfil se cuentan también los brazos girados hacia abajo (la capa cae por encima de ellos a los
  costados) y los pliegues son más hondos por detrás. Que se mueva al andar no va en el modelo: lo hace el juego
  (`VUELO_GLSL` en `src/personajes/makehuman.js`). Prueba: `node pruebas/prueba_manto.mjs` (con `MUTAR=1` mira la v15).

## Cuello de la ropa y toca (desde taller-v18)

- **La piel bajo el escote:** por delante la piel sigue hasta unos 11 cm por debajo del cuello (7 cm por detrás), dentro
  de los hombros, para que su borde quede siempre tapado por la ropa. Antes acababa justo en el escote y su borde, a
  trozos por el diezmado, se veía como una mancha de piel rota con huecos negros a los lados del cuello.
- **Bajo la toca no va la cofia** (`piezasCabeza` en `src/logica/aspecto.js`; las fotos del taller hacen lo mismo).
- La toca lleva `colgar`, pero en el centro de la garganta lo más saliente es el pecho y apenas cambia: bajo la barbilla
  aún se mete hacia el cuello (aún mal).
- Para probar más deprisa: `SOLO=mujer PRENDAS=toca FOTOS=prendas python3 herramientas/taller/vestir_mpfb.py <carpeta>`
  (solo la mujer y solo esas prendas; nunca se publica así).
- Prueba: `node pruebas/prueba_toca.mjs` (con `MUTAR=1` mira la taller-v17 y falla).

## Nacimiento del pelo y cejas (desde taller-v19)

- **Nacimiento del pelo:** `alto_pelo(P)` dice cuánto está un punto por encima de la línea del pelo (en la frente, un poco
  más alta en las entradas). El pelo pintado (`zona_pelo`, en el calco `_vello`) nace en algo más de 1 cm: primero
  pelos sueltos (grano fino hacia atrás) que se van juntando. La cáscara del pelo corto (`zona_casco`) empieza 9 mm más
  adentro, con el borde a mechones (el juego la recorta con alphaTest), y su bulto crece desde el borde: 1,2 mm sobre la
  piel en el borde y todo su grosor a unos 2,5 cm hacia dentro. Antes (hasta taller-v18) cortaba en seco en 6 mm y la
  cáscara salía ya despegada 5-6 mm justo en el borde: parecía un casquete.
- **Cejas** (`zona_cejas`, en su propio calco `_cejas` de 512 px: en el del pelo les tocaban 3-4 píxeles de alto y salían a
  trozos; el juego lo trata como los demás calcos): asientan en el arco, justo encima del párpado (antes, una raya fina y alta que flotaba). La
  cabeza, junto a la nariz, más ancha y redondeada, con los pelos hacia arriba; el cuerpo sube un poco hasta el arco y la
  cola baja y se afila con los pelos hacia fuera. Más pobladas abajo que arriba; el borde, en pelos sueltos.
- Fotos de cerca de la frente (frente, tres cuartos y perfil): `FOTOS=nacimiento python3 herramientas/taller/vestir_mpfb.py
  <carpeta>` (con `SOLO=hombre PEINADOS=corto` para probar más deprisa; nunca se publica así).
- Prueba: `node pruebas/prueba_nacimiento_pelo.mjs` (con `MUTAR=1` mira la taller-v18 y falla).
- Aún mal: detrás de la oreja se ve una línea negra fina entre la oreja y la cabeza.
