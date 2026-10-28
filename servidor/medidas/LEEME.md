# Medición del servidor con jugadores simulados (hito 1f)

Medido el 28 oct 2026 con `node servidor/medir.mjs <bots> <segundos> <salida.json>` (los JSON de esta carpeta tienen
todas las muestras, una por segundo). Los bots (`servidor/bots.mjs`) andan, construyen y pelean a la vez alrededor
del mismo mojón: todos se ven a todos, que es el caso más cargado. Los primeros 10 s no cuentan.

Máquina de la medición: Intel Xeon a 2,30 GHz, 2 núcleos, 7,8 GB, Node v22. El servidor iba en su propio proceso;
los bots, en otro de la misma máquina (comparten los 2 núcleos). **No se ha medido en un servidor de alquiler.**

| Bots | Tiempo medido | CPU del servidor (% de un núcleo: media / p95 / máx.) | Memoria (RSS máx.) | Retraso del bucle (p99 medio / máx.) | Sale del servidor | Sale por jugador | Entra por jugador | Disco | Bienvenida al final | Acción (p50 / p95) |
|---|---|---|---|---|---|---|---|---|---|---|
| 25 | 80 s | 2,6 / 3,6 / 6,0 | 80 MB | 5,7 / 10,7 ms | 1,2 MB/s (9,9 Mbit/s) | 48,5 KB/s | 1,0 KB/s | 8 MB/h | 0,2 MB | 0,5 / 1,5 ms |
| 50 | 79 s | 5,4 / 7,5 / 9,4 | 90 MB | 6,3 / 12,1 ms | 4,8 MB/s (40 Mbit/s) | 97,5 KB/s | 1,0 KB/s | 16 MB/h | 0,4 MB | 1,2 / 4,3 ms |
| 100 | 169 s | 14,7 / 19,2 / 25,3 | 113 MB | 10,3 / 47,3 ms | 18,3 MB/s (154 Mbit/s) | 187,4 KB/s | 1,0 KB/s | 31 MB/h | 1,5 MB | 3,8 / 13 ms |

Con 100: 100 conectados todo el rato, 11 066 acciones bien y 6 mal (hueco ocupado o faltan materiales, normales),
255 obras terminadas, 1053 golpes, 0 errores.

## Qué dice

- **CPU y memoria sobran**: con 100 a la vez, el servidor usa un 15 % de un núcleo y 113 MB. Los tics (100 ms de
  presencia, 50 ms de combate) no se retrasan de forma apreciable (p99 del bucle, 10 ms).
- **Lo que manda es la red.** Cada jugador recibe lo de todos los demás (unos 1,9 KB/s por cada otro jugador), así
  que lo que sale por jugador crece con el número de jugadores y el total con su cuadrado. Repartido (50 bots,
  30 s): `luchadores` 51 %, `estados` 44 %, acciones de obra 5 %, golpes 1 %. Lo que entra es poco: 1 KB/s por
  jugador.
- **La bienvenida crece sin fin**: lleva todas las acciones desde el principio (1,5 MB tras 3 minutos con 100
  construyendo). Para un mundo que dure meses habrá que mandar el estado del mundo en vez del historial.
- **El disco crece** con las acciones y los golpes guardados: 31 MB por hora con 100 construyendo y peleando sin
  parar.

## Qué servidor hace falta y cuánto cuesta (precios comprobados el 28 oct 2026)

Fuente de precios: cloudtally.eu (dice que los comprobó el 24 oct 2026); no se ha podido abrir la página de Hetzner
desde aquí. Hetzner Cloud, Alemania o Finlandia, sin IVA: **CX23** (2 vCPU compartidas, 4 GB) 5,49 €/mes con
20 TB de salida incluidos; cada TB más, 1 €.

- **Prueba online de valravnx (2 jugadores):** sobra el plan más pequeño. Con 6 bots salieron 5,8 KB/s por
  jugador; el tráfico no llega ni de lejos a los 20 TB. Unos **5,49 €/mes** sin IVA.
- **100 jugadores a la vez, 24 h al día (el peor caso, todos juntos):** por CPU y memoria, el mismo CX23 (no
  medido en él). Por red: 18,3 MB/s son unos 50 TB al mes → 20 incluidos + unos 30 TB a 1 € → unos **35 €/mes**
  sin IVA. Cada hora de un jugador con 100 conectados son unos 660 MB de salida: los 20 TB incluidos dan para
  unas 29 000 horas-jugador así.
- Si los jugadores están repartidos por el mundo (no todos junto al mismo mojón), el tráfico baja mucho, pero solo
  si el servidor deja de mandar a cada uno lo de todos (mandar solo lo que está cerca). Hoy lo manda todo.

No comprobado: el rendimiento en una CPU de alquiler compartida, el tráfico real de TCP/IP (se midió lo que pasa
por los sockets, con las tramas de WebSocket pero sin las cabeceras de TCP/IP) y la conexión de muchos jugadores
lejanos con lag de verdad.
