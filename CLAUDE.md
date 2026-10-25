# Kinhold — reglas de trabajo

Kinhold es el juego de Pedro: supervivencia medieval "tipo MMO" en el navegador, jugable solo o en pareja, en PC, móvil y tablet. Low-poly 3D generado por código (three.js), cámara en tercera persona semiisométrica con giro libre, de la Alta a la Baja Edad Media, sin fantasía. Combate de habilidad inspirado en la esgrima real, sin barras de vida.

**Todo en español**: código, comentarios, textos del juego, commits, diario y mensajes a Pedro.

**Y también en inglés lo que se publica** (más adelante, ruso): cada texto nuevo o cambiado del roadmap, el diario, las decisiones y las notas de versión se añade en `proyecto/idiomas/en.json` (clave: el texto exacto en español; valor: la traducción). `construir_web.mjs` falla si falta alguna, y lista cuáles. Si se cambia un texto en español, hay que volver a traducirlo. Los textos fijos de la web están en el diccionario `UI` de `herramientas/plantilla_web.html`.

## Dónde está cada cosa

- `diseno/gdd.html` — GDD (fuente de verdad del diseño). `diseno/sistemas.html` — recursos, recetas, piezas, valores. `diseno/analisis.html` — análisis y propuestas (lo marcado PROPUESTA no está decidido).
- `diseno/en/` — los mismos documentos en inglés. Cada uno lleva `<meta name="kinhold-origen">` con la huella (sha1) del original; si el español cambia, `construir_web.mjs` falla hasta que se retraduce y se pone la huella nueva.
- `proyecto/roadmap.json` — hitos y tareas con su estado. **Es lo que decide qué se hace.**
- `proyecto/diario.json` — una entrada por sesión de trabajo, con hora de inicio y fin reales.
- `REVISION.md` — donde Pedro deja revisiones y respuestas. Se lee al empezar cada sesión.
- `src/` — código. `src/logica/` y `src/combate/logica.js` son lógica pura (sin three.js) para que el servidor la pueda ejecutar luego sin rehacerla. Mantenerlo así.
- `pruebas/` — pruebas de lógica (node) y de navegador (Python Playwright con Chromium sin pantalla).
- `docs/` — la web pública (GitHub Pages, rama main, carpeta /docs). Se genera con `node herramientas/construir_web.mjs`. Las versiones jugables están en `docs/jugar/<prototipo>/<vN>.html` y **nunca se borran ni se sobrescriben**.
- Web: https://valravnxx.github.io/Kinhold/ (con K mayúscula: el repositorio se llama Kinhold y la dirección distingue mayúsculas)

## Una sesión de trabajo (tarea programada cada hora)

1. `git pull`. Instalar dependencias si faltan (`npm install`). Apuntar la hora de inicio (`date -Iseconds`).
   - **Una sola sesión automática a la vez.** Mirar `proyecto/sesion.json`. Si dice que hay otra sesión automática trabajando y empezó hace menos de 70 minutos, **terminar sin hacer nada**. Si no, escribir en él `{"inicio": "<hora>", "tarea": "<nombre>", "rama": "trabajo/<AAAAMMDD-HHMM>"}`, commit y push enseguida. Al terminar la sesión (bien o mal), dejarlo en `{}` en el último commit.
   - **Las sesiones de chat con Pedro trabajan en paralelo** (lo pidió Pedro el 25 oct): no escriben en `sesion.json`; en su lugar marcan su tarea `en_curso` en el roadmap (commit y push enseguida) y trabajan en su rama `trabajo/…`. Las demás sesiones no cogen tareas `en_curso` y evitan tocar los mismos archivos que esa rama (mirar `git ls-remote origin 'trabajo/*'` y sus cambios). Al fusionar en main, unir con cuidado `diario.json` y `en.json` (se añaden entradas, no se pisan).
   - **No perder trabajo a medias:** mientras se trabaja, subir el avance cada 15 minutos más o menos a la rama `trabajo/<AAAAMMDD-HHMM>` (commit "Avance: …"). Al acabar, fusionar en main. Si la sesión se corta, lo hecho queda en esa rama y la siguiente sesión lo retoma desde ahí en vez de empezar de cero (mirar `git ls-remote origin 'trabajo/*'`).
   - Si Pedro habla contigo dentro de la sesión, lo que pida va a `REVISION.md` y se sube enseguida, para que no dependa de esta conversación.
2. Leer `REVISION.md`. Si Pedro ha escrito algo nuevo debajo de la línea, **eso va primero**:
   - Aprobación de un hito en revisión → marcarlo `hecho`.
   - Cambios pedidos → crear tareas en ese hito (estado `pendiente`) y dejarlo `en_curso`.
   - Respuesta a una decisión pendiente → quitarla de `decisiones_pendientes`, pasar sus tareas de `espera_decision` a `pendiente` y anotar la decisión en el diario.
   - Después mover lo procesado a la sección "Procesado" de `REVISION.md` con la fecha.
3. Elegir la tarea:
   - **Si hay un hito en `revision` (terminado, esperando a Pedro), no se empieza ningún hito nuevo.** Solo se pueden hacer tareas `pendiente` de hitos ya `en_curso`. Si no hay ninguna, la sesión termina sin cambios (no hace falta entrada en el diario ni commit).
   - Si no: la primera tarea `pendiente` del primer hito `en_curso`; si no hay, el siguiente hito `pendiente` en el orden del roadmap (pasa a `en_curso`).
   - Las tareas en `espera_decision` no se tocan.
   - **Un hito con `"bloquea": true` que tenga tareas en `espera_decision` tampoco deja empezar hitos nuevos** (ej.: la dirección de arte; no se construye nada encima de un estilo sin elegir).
   - Si una tarea termina con algo que Pedro tiene que elegir (pruebas de estilo, propuestas), al acabarla se añade la pregunta a `decisiones_pendientes`.
4. Si la tarea es "Planificar el hito": leer las partes del GDD y de sistemas que tocan, y desglosar el hito en tareas de **una sesión cada una** (algo que se pueda hacer, probar y publicar en menos de una hora). La última tarea de cada hito es siempre "Revisión completa y publicación".
5. Hacer la tarea **una sola por sesión**, entera: código, pruebas, capturas, publicación.
6. Pruebas (todas, siempre, no solo las de lo tocado — a Pedro le molesta que al arreglar algo se rompa otra cosa):
   - `node pruebas/prueba_logica.mjs`, `node pruebas/prueba_modelos.mjs`, `node pruebas/prueba_combate.mjs`
   - `python3 pruebas/prueba_navegador.py`, `python3 pruebas/prueba_combate_navegador.py <html> <carpeta>`, `python3 pruebas/prueba_web.py <carpeta>`
   - Cada prueba nueva se rompe a propósito una vez para comprobar que falla (como `MUTAR=1` en la de combate).
   - Mirar las capturas de verdad (con la herramienta de leer imágenes), en PC (1280×800) y móvil (390×844), de **todas las vistas** del prototipo tocado.
7. Si todo pasa: publicar una versión nueva solo cuando el cambio sea jugable (`node herramientas/publicar_version.mjs <prototipo> <vN> <html> "<notas>" capturas/<prototipo>-<vN>`), copiar capturas con `python3 herramientas/capturas.py <carpeta> <prototipo>-<vN>` (las convierte a JPG), marcar la tarea `hecho` con `inicio` y `fin`, escribir la entrada del diario, `node herramientas/construir_web.mjs`, commit y push.
8. **Si algo falla y no se arregla en la sesión: no publicar.** Entrada en el diario con `estado: "fallo"` y qué falla; la tarea sigue `en_curso`. Commit solo del diario y del roadmap.
9. Si con esta tarea se termina el hito: el hito pasa a `revision` y se para (ver paso 3).

## Entrada del diario

```json
{"inicio": "2026-10-25T09:00:12+02:00", "fin": "2026-10-25T09:41:50+02:00", "titulo": "Hito 1b: escalera de un bloque",
 "hito": "construccion-mas", "hecho": ["…frases cortas y concretas…"], "pruebas": "Lógica 40/40, navegador PC y móvil correctos",
 "capturas": "capturas/construccion-v4", "estado": "ok"}
```
Las horas son reales (`date -Iseconds`), nunca estimadas. Las tareas guardan también `inicio` y `fin`.

## Alcance y listón visual (que quede claro siempre)

- Es un **juego online persistente tipo MMO**, aunque sea pequeño al principio: pensado para que algún día tenga muchos jugadores. Cuentas, administración, registros y seguridad son **prioridad alta**, no un añadido (hitos 11 y 11b).
- **Toda acción que cambia el mundo** (construir, desmontar, coger, soltar, comerciar, herir, matar) pasa por la lógica pura con un **autor** (quién la hace), aunque hoy sea un solo jugador. Así el servidor podrá validarla y registrarla sin rehacer nada.
- **Aspecto: sobrio y realista dentro del low-poly.** Nada de colores chillones ni muñecos de cubos de estética infantil. Proporciones humanas creíbles, materiales y paleta apagados y naturales, buena luz y sombras. Técnicas por código permitidas y deseables: geometría con más detalle donde se ve (cara, manos, bordes), variación de color por vértice, texturas generadas por código (canvas), sombreado plano o suave según la pieza, oclusión ambiental horneada en vértices, niebla, gradación de color y posproceso ligero.
- **Personajes: NUNCA esculpidos o inventados por código** (Pedro: «horripilantes»). Salen de bases libres ya hechas: los paquetes CC0 de Quaternius preparados en `docs/recursos/personajes/v1/` (cargador en `src/personajes/cargar.js`). Animaciones extra (39 clips de la UAL2 completa, CC0) en `animaciones_extra.glb`, comprimido con meshopt: hay que abrirlo con `GLTFLoader.setMeshoptDecoder` (three/examples/jsm/libs/meshopt_decoder.module.js). Los recursos publicados no se cambian: los nuevos van en `v2/`. Procedencia y licencias en `PROCEDENCIA.md`. Ropa y armaduras nuevas: buscar primero piezas CC0 compatibles con ese esqueleto de 65 huesos; si no las hay, preguntar a Pedro antes de hacerlas a mano.
- **Antes de construir algo difícil, investigar cómo lo resuelven otros** (guías, proyectos, paquetes libres) y usar el mejor método, en vez de probar a ciegas.
- **Personajes:** personalización (complexión, cara, pelo, barba, piel) y **la ropa y la armadura se ven puestas**, por capas. Es de lo más importante del juego: cada cambio sale en capturas de cerca para Pedro.
- **Tiene que aguantar en móvil.** Medir los fotogramas; si hace falta, niveles de detalle.

## Reglas de Pedro

- **Comprobar todo antes de afirmarlo.** Nada de memoria ni de suposiciones. Si algo no se ha podido comprobar, decirlo en el diario ("no comprobado: …").
- **No sobrecomplicar sus sistemas.** Implementar lo que dice el GDD a la escala que lo dice; nada de capas extra.
- Lo que el GDD no decide: tomar una decisión provisional sencilla, anotarla en el registro de decisiones del prototipo (`registro.js`) y en el diario. Si es importante o difícil de deshacer, no decidir: añadirla a `decisiones_pendientes` y pasar la tarea a `espera_decision`.
- **Nunca referencias a propiedad intelectual ajena** en el juego (nombres de otros juegos, marcas, personajes) ni en sus textos.
- No dar tiempos que no salgan de datos medidos.
- Los guardados del navegador no se pierden con una versión nueva: si cambia su formato, migrarlo.
- El arte es low-poly por código; cada pieza nueva sale en capturas de cerca para que Pedro la revise.
- Commits con mensajes en español que digan qué cambia. Al final de cada mensaje de commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
