# Revisión de Pedro

Escribe aquí debajo lo que quieras: aprobar un hito ("apruebo el 1b"), pedir cambios, o responder a lo que te espera en la web. Basta con texto normal. El trabajo automático lo lee al empezar cada hora y lo mueve a "Procesado".

---

## Procesado

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
   Anotar en `registro.js` que es provisional y que Pedro lo revisará.

(Idea descartada por Pedro, no hacer: elegir el golpe por la dirección en que mueves el ratón; ya se probó en la v1 y era caótico.)
