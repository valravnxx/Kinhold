# Revisión de valravnx

Escribe aquí debajo lo que quieras: aprobar un hito ("apruebo el 1b"), pedir cambios, o responder a lo que te espera en la web. Basta con texto normal. El trabajo automático lo lee al empezar cada hora y lo mueve a "Procesado".

---

## Procesado

### 27 oct 2026 (06:39) — por el chat: manos y animaciones, para más adelante

«Para un momento más futuro, quiero que hagamos una faena de nivelar las manos de los personajes con las herramientas que estén tomando para que las agarren bien… y que las animaciones no clipen con los mismos personajes. Más adelante: ahora lo importante es la funcionalidad, pero tiene que estar en el roadmap segurísimo.» → Hito nuevo 10b «Pulido de manos y animaciones», después del Mundo (pendiente, no se empieza antes), y su fila en el GDD.

### 26 oct 2026 (15:59) — por el chat: cómo será el premium

valravnx: el premium desbloqueará recetas para fabricar versiones más bonitas de las cosas, «pero ya se hará» → GDD (apartados 2 y 20, en los tres idiomas): el premium son recetas que se desbloquean, se fabrican en el juego con sus materiales y solo cambian el aspecto. Se concreta más adelante.

### 26 oct 2026 (15:35) — por el chat: análisis de lo que falta para un juego acabado

valravnx pidió analizar todos los sistemas y lo que faltaría (ropa tejida cosmética en vez de calidades, hogar, objetos, peces, una carreta de inicio, barcos por los que se pueda andar y comarcas con nombre que se dominan). Sus respuestas al análisis: el mapa del mundo lo revisará mucho a mano, así que los nombres se irán poniendo y ajustando; las ciudades NPC le parecen bien aunque la gente se arremoline cerca («un mal necesario»: crea rutas entre reinos, sitios de paso, y lejos queda sitio para bandidos y solitarios); la carretilla te la dan los NPCs además de enseñarte a hacerla; nada de calidades de objetos; el resto, como se propuso. → GDD v0.9, apartado 20 «Ampliación para un juego acabado» (también en inglés y ruso), con el hito donde se planifica cada cosa; documento de sistemas v1.2 (rastra en N0, carretilla de rueda maciza en N1); tarea de la ropa crafteable del hito 1b sin calidades.

### 26 oct 2026 (15:20) — por el chat: estados de simulación más variados

valravnx propone estados más variados de simulación; acepta los cinco que encajan, «pero para más adelante» → GDD (sección 6, también en inglés y ruso): mojado, herida infectada, comida en mal estado, dolor y borracho, como ampliación posterior a la primera versión del hito de supervivencia. Aburrimiento, tristeza y pánico quedan fuera.

### 26 oct 2026 (15:15) — por el chat: prueba online pronto

valravnx está de acuerdo en que lo multijugador es el mayor riesgo y le preocupa el coste del servidor para unas 100 personas → Hito nuevo 1f, «Prueba online mínima», en curso justo después del 1e (estilo v5): dos jugadores en el mismo mundo desde dos dispositivos, y una medición con 100 jugadores simulados para saber qué servidor hace falta y cuánto cuesta al mes.

### 26 oct 2026 (15:10) — por el chat: el estilo v5 solo está en los muros

«Revisa que la mejora gráfica de la construcción se aplique bien, he visto que has mejorado las paredes de troncos pero nada más… quiero que sea visualmente como aprobé en la prueba que hicimos, y eso aplica a todo» → Comprobado en las capturas de construcción v13 y demo v8: solo los muros de troncos tienen el estilo; tejados, cimientos, suelos, puertas, empalizada, muebles y el suelo de la escena siguen con el aspecto inicial. Hito nuevo 1e, «El estilo de la prueba v5 en todo», en curso y por delante del resto: reúne las cuatro tareas de estilo del 1c y añade la escena común (hierba, flores, matorrales, piedras, árboles de la v5), todo lo demás que se ve, y una revisión final comparando cada vista con la v5. Regla nueva en CLAUDE.md: la v5 vale para todo y nada se publica con el aspecto inicial.

### 26 oct 2026 (12:06) — por el chat: mundo a escala real, nado y obras con materiales (en conversación)

valravnx quiere: mundo a escala real en todo (planicies, pero también valles, pasos y montañas tipo Pirineos, bosques frondosos, ríos de varios gruesos; un mundo aún inexplorado que no se sienta un llano gigante y que favorezca establecerse en sitios concretos, como junto a los ríos); saber si el nado está en el GDD (no lo está); y que construir sea poner el marco de la obra, llevarle los materiales y construir con un tiempo según la pieza, con andamios, poleas y poleas mayores para subir materiales y piedras a lo alto (complicado pero posible en grupo, y no demasiado para una casita de madera solo o en pareja). → Propuesta enviada en el chat. valravnx (12:11): «sí, todo» → GDD v0.8 (mundo a escala real, agua y nado, obras), tareas nuevas en el hito 1c y el hito 10 puesto al día.

### 26 oct 2026 (09:28–10:14) — por el chat: pantalla en blanco en el móvil

«Sufro crasheos aleatorios donde se queda el juego así» (pantalla en blanco con los botones vivos), «jugando seguido y se queda así aunque reinicie», «no iba lagueado ni por debajo de 80 fps» → Fuga de memoria gráfica al rehacer las piezas, arreglada (construcción v12, combate v9, demo v7), con aviso y recarga si se pierde el dibujo 3D. Para recuperar el navegador: cerrar Chrome del todo y volver a abrir.

### 26 oct 2026 (07:51) — por el chat: brazos de la carrera

«La versión de carrera nueva tiene que mejorar en posición de brazos, están torcidos adelante en pose nada natural, arréglalo y aprobamos de una, y prueba el otro pendiente» → Brazos arreglados (personaje v13, demo v5) y carrera aprobada: se cierra la pregunta de la carrera. «El otro pendiente»: se empieza a pasar la construcción al estilo elegido (muros primero).

### 26 oct 2026 (07:43) — por el chat: la construcción sigue con el aspecto inicial

«Los muebles y construcción son los low-poly iniciales, no lo de la prueba visual, tienes pendiente cambiar antes de añadir más, ¿no?» → Cierto: la escena (cielo, luz, suelo, decorado) ya tiene el estilo v5, pero las piezas y los muebles no. Cinco tareas nuevas en el hito 1c, justo después de las barandillas (que estaba a medias) y antes de cualquier pieza nueva: muros, cimientos y suelos, tejados, puertas y cercas, y muebles con el estilo de la prueba. Sustituyen a la tarea de arte «Piezas de construcción con más detalle».

### 26 oct 2026 (07:36) — por el chat: hito 1d (Una sola demo)

«1d aprobado, sigue» → Hito 1d aprobado y marcado como hecho. Ya no hay ningún hito en revisión: se pueden empezar hitos nuevos.

### 26 oct 2026 (06:49) — por el chat: la carrera nueva en la demo única

«Ahora integra ese correr y todo en la única» → Demo única v4: el personaje del taller-v5 (carrera suavizada y a su velocidad) en construir, duelo y personaje, con lo último de cada prototipo.

### 26 oct 2026 (05:04) — por el chat: revisión de la demo

«Va muy bien de fps, pero la animación de correr me parece fea y exagerada, ¿podemos buscar otras?» → Se cierra la pregunta de los fps en el móvil (van bien). Tarea nueva en arte: correr más natural.

### 25 oct 2026 (17:51) — por el chat: no se pueden quitar muebles en PC

«Al quitar un mueble en PC, pide clicarlo y confirmar, pero al mover el ratón para confirmar se desclica, haciendo imposible borrar muebles» → Tarea nueva en el hito 1c (en curso, la hace esta sesión de chat): en Desmontar, lo elegido con clic se queda fijo hasta confirmar o cancelar; pasar el ratón ya no lo cambia.

### 25 oct 2026 (17:45) — por el chat: hito 0b (Bases técnicas)

«No tengo forma de revisar algo así, no sé de coding, haz un review rápido tú y apruébalo si lo ves bien» → Revisión del código hecha por Claude: las acciones con autor (`src/logica/acciones.js`) rechazan bien los mensajes mal formados, las piezas que no existen y los autores que no están en el combate; la unión del diario y las traducciones (`herramientas/unir_json.mjs`) solo se para ante un choque de verdad; todas las pruebas pasan. Detalles menores sin importancia (quitar un mueble que no existe no dice el motivo; el botón «rellenar» de materiales es solo del prototipo y el servidor tendrá que rechazarlo). Hito aprobado y marcado como hecho.

### 25 oct 2026 (14:28) — por el chat: hito 0 (Infraestructura)

«Perfecto, revisado» → Hito de infraestructura aprobado y marcado como hecho (documentos de diseño en ruso incluidos).

### 25 oct 2026 (11:13) — por el chat: análisis del proyecto

«Arregla en el proyecto añadiendo hitos donde toque de todos estos puntos, actualiza el GDD y planifica unificar demos.» → Hitos nuevos 0b (bases técnicas) y 1d (una sola demo), tareas nuevas en infraestructura, duelo, arte, equipo y servidor, y GDD v0.7 (también en inglés).

### 25 oct 2026 (10:59) — por el chat, sobre la ropa por capas

«Que se pueda customizar más adelante in-game todo eso.» → Tarea nueva en el hito de arte: personalización en el juego de la ropa y la armadura (tintes, blasón de la sobreveste, capas).

### 25 oct 2026 (09:53) — por el chat: decisiones pendientes

Estilo: el realismo en miniatura de la v5 es la base. Cámara táctil: como se propuso. Curación: la tabla del análisis; en combate se puede, lento y vendido. Fuego amigo: sigue al PvP (desactivado dentro de la familia: no hace nada; fuera, hiere). valravnx pide además que la sesión del chat pueda trabajar en paralelo a otras sesiones.

### 25 oct 2026 (09:39) — por el chat: algo no relacionado con la ropa

«Puedes hacer, están haciendo los modelados de ropa; haz algo no relacionado.» Elige planificar el hito de construcción (1c). Hecho: 9 tareas nuevas en el roadmap; los puentes se dejan para el hito Mundo.

### 25 oct 2026 (09:14) — por el chat: base de los personajes

«Lo veo bien, sigue» y elige el **taller propio** (MakeHuman con ropa por código) como base de los personajes. Se cierran las decisiones personaje-v2 y paquete-ropa; tareas del hito de arte rehechas para el taller. Ya no hace falta que solo la sesión del chat toque `src/personaje/`: las sesiones automáticas pueden seguir con las tareas del taller (que no toquen a la vez lo que esté haciendo la sesión del chat: mirar `proyecto/sesion.json`).

(Nota anterior, ya superada, del 24 oct 23:05: personajes con las bases de Quaternius y solo la sesión del chat toca el personaje.)

### 25 oct 2026 (08:21 y 08:35) — por el chat: pecho, postura y hombros del hombre

Arreglado en personaje v7: tronco enderezado, hombros en su sitio, brazos colgando rectos y túnica que cae desde el pecho. Prueba nueva de postura.

### 25 oct 2026 (07:35) — por el chat: ropa del taller «al revés»

Arreglado en personaje v6: la ropa, el pelo y la cofia no escribían profundidad en calidad alta y la piel se pintaba encima.

### 25 oct 2026 (06:38) — por el chat: «adelante»

Animaciones de Quaternius pasadas al esqueleto de MakeHuman; personaje v5 publicado con la opción «Base del personaje» para comparar.

### 25 oct 2026 (06:37) — por el chat, sobre el taller MakeHuman

«Sigue con una claridad en la barbilla, pero está decente para usar de placeholder por ahora.» → El personaje vestido de MakeHuman vale como provisional. Queda pendiente: oscurecer la barba bajo la barbilla (se aclara antes de tiempo hacia el cuello).

### 25 oct 2026 (05:41) — por el chat, sobre el taller MakeHuman

«La barba del hombre deja la barbilla mal, hazle solo un coloreado; sus labios son enormes.» → Barba pintada en la piel y labios más finos. Además se arregla el encuadre de las fotos, que cortaba la barbilla.

### 24 oct 2026 (20:53) — por el chat, sobre la prueba de estilo v4

"Los árboles fatal, la casa está bien; los árboles se ven como rayajos raros." → Prueba de estilo v5 con árboles rehechos.

### 24 oct 2026 (20:34) — por el chat, sobre la prueba de estilo v3

"Me gusta, aunque el mundo no estará recortado en la base; ¿podemos hacer una prueba texturizando un poco para probar ese rollo de realismo en miniatura?" → Prueba de estilo v4.

### 24 oct 2026 (20:21) — por el chat, sobre la prueba de estilo v2

"El estilo me recuerda a juegos gratuitos de motor genérico, y las rocas no cubren el fondo del edificio, se ven como piedras sueltas; no me acaba de convencer." Elegida la dirección «maqueta en miniatura» (formas limpias y redondeadas, luz suave, sombras de contacto, fondo desenfocado). → Tarea nueva en el hito 1b: prueba de estilo v3.

### 24 oct 2026 — por el chat, sobre los personajes

"Tienes que hacerlos por código pero respetando lo que te he dicho; sé que tienes métodos de hacerlos vistosos, hay que saber solo el cómo." → Decisión: personajes por código. Tarea del personaje a pendiente.

### 24 oct 2026 (19:24) — por el chat, sobre las pruebas de estilo v1

"Solo has hecho un modelado y metido 3 skins encima, la B y C van horribles en cualquier PC y móvil, y el modelado del personaje es una absoluta aberración; mira cómo hacerlos de manera más eficiente y bella aunque sea estilizando, busca guías, presets, ideas." → Tarea nueva en el hito 1b (rehacer las pruebas, ligeras y estilizadas) y decisión pendiente sobre el origen de los personajes.

### 24 oct 2026 (19:14) — dos tareas nuevas en el hito 5 (Duelo)

**24 oct, 19:00 — prueba del combate v2 con un amigo (pasado por el chat). Crear tareas en el hito 5 (Duelo), estado pendiente:**

1. **El arco está roto: se puede correr y disparar como una ametralladora.** Arreglo provisional:
   - no se puede soltar antes del 50% de tensión (si sueltas antes, se cancela sin disparar);
   - correr cancela el tensado y no se puede empezar a tensar corriendo;
   - después de cada disparo, 0,8 s para sacar y encajar la siguiente flecha (piedras: 0,5 s);
   - pruebas nuevas en `prueba_combate.mjs` para las tres cosas (y romperlas a propósito una vez).
2. **Hace falta escudo.** Está en sistemas: escudo redondo (tablas + cuero + umbo, carpintero). Versión provisional sencilla para el campo de pruebas:
   - nueva opción "Espada y escudo" (espada de una mano, algo más corta que la larga);
   - con escudo, Parar también detiene **flechas y piedras** que vengan de frente;
   - la parada con escudo cuesta menos aliento que con la espada; parada perfecta y golpe maestro funcionan igual;
   - el escudo se ve en el brazo izquierdo y se levanta al parar;
   - el rival de la máquina también puede llevarlo (opción "Ropa/arma del rival").
   Anotar en `registro.js` que es provisional y que valravnx lo revisará.

(Idea descartada por valravnx, no hacer: elegir el golpe por la dirección en que mueves el ratón; ya se probó en la v1 y era caótico.)
