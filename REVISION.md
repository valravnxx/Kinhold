# Revisión de Pedro

Escribe aquí debajo lo que quieras: aprobar un hito ("apruebo el 1b"), pedir cambios, o responder a lo que te espera en la web. Basta con texto normal. El trabajo automático lo lee al empezar cada hora y lo mueve a "Procesado".

---

**24 oct, 23:05 — Pedro, por el chat principal (lo está haciendo esa sesión, NO las automáticas):**
El personaje esculpido por código (Personaje v1) es «horripilante, de película de terror». **Se abandona hacer los personajes a mano por código.** Decisión: los personajes salen de bases ya hechas con licencia libre (CC0): Quaternius Universal Base Characters + Modular Character Outfits + Universal Animation Library. La sesión del chat principal monta el personaje v2 con eso. Ninguna otra sesión toca `src/personaje/` ni `src/estilo/personaje.js` hasta que Pedro lo revise.

---

## Procesado

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
