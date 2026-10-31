# Servidor de prueba de Kinhold en internet (hito 1f)

Para jugar en línea desde dos aparatos sin tener un ordenador encendido en casa. Decidido por valravnx el 27 oct:
un alojamiento en la nube con una cuenta suya. Aquí está todo preparado; solo hace falta crear la cuenta y la
máquina, y pegar un texto.

**Dónde:** Hetzner Cloud (es lo que salió de la medición, `servidor/medidas/LEEME.md`): el plan más pequeño,
**CX23** (2 vCPU, 4 GB), sobra para la prueba. Precio comprobado el 28 oct 2026 (en cloudtally.eu, no en la
página de Hetzner): 5,49 €/mes sin IVA, con 20 TB de tráfico incluidos. Hetzner cobra aparte la IPv4 pública:
mira el precio en la misma pantalla al crear la máquina. Se paga por horas: si borras la máquina, deja de
cobrarse.

## Pasos (unos 10 minutos)

1. Crea la cuenta en **hetzner.com** → *Cloud* (piden datos de pago y a veces una verificación).
2. En la consola de Hetzner Cloud: **nuevo proyecto** (por ejemplo «Kinhold») y dentro **añadir servidor**:
   - **Ubicación:** la que quieras de Europa (Alemania o Finlandia).
   - **Imagen:** **Ubuntu 24.04**.
   - **Tipo:** vCPU compartida, x86, **CX23**.
   - **Red:** con **IPv4 pública** marcada (hace falta: la dirección del juego sale de ella).
   - **Claves SSH:** si no tienes ninguna, sáltalo (Hetzner te manda la contraseña de root por correo).
   - **Cloud config:** pega **entero** el contenido de [`cloud-config.yaml`](cloud-config.yaml) (empieza por
     `#cloud-config`).
   - **Nombre:** por ejemplo `kinhold`. Pulsa **crear y comprar**.
   Los nombres de los botones pueden cambiar un poco; lo importante es Ubuntu 24.04, CX23, IPv4 y el cloud config.
3. Apunta la **IP** que sale (por ejemplo `65.21.10.20`). Espera **5 minutos** (la máquina instala Node.js, Caddy
   y el juego ella sola).
4. Abre en el navegador **`https://65-21-10-20.sslip.io`** (tu IP con guiones en vez de puntos). Te lleva a la demo
   con el servidor ya puesto. Haz lo mismo en el otro aparato (o mándale ese enlace a la otra persona) y entrad
   en **Jugar en línea** o **Duelo en línea**.

El mundo se guarda en la máquina (`/var/lib/kinhold/`): sigue ahí aunque se reinicie o se actualice.

**En marcha desde el 30 oct** (lo creó valravnx): CX23 en Falkenstein, Ubuntu 24.04, https://2-31-141-224.sslip.io.
El juego es siempre en línea (valravnx, 30 oct): la demo de la web de GitHub entra también a este servidor (la
dirección está en `src/mundo/direccion_servidor.js`; si cambia la IP, se cambia ahí).

**Ojo:** el servidor aún no tiene cuentas ni contraseñas (llegan en el hito 11). Como la web es pública, cualquiera
que abra la demo entra en este mundo y puede construir.

## Si algo no va

- **El enlace da error de certificado o no carga:** espera unos minutos más (el certificado HTTPS lo pide Caddy
  solo, a Let's Encrypt y, si este falla, a ZeroSSL; sslip.io es compartido por mucha gente y a veces Let's
  Encrypt lo limita). Si tras 15 minutos sigue igual, entra en la máquina (abajo) y mira
  `journalctl -u caddy -n 50`.
- **Entrar en la máquina:** en la consola de Hetzner, el botón de consola del servidor (se abre en el navegador),
  o desde un ordenador `ssh root@65.21.10.20`. Lo que hizo la instalación está en `/var/log/kinhold-instalar.log`.
- **Ver el servidor del juego:** `systemctl status kinhold` y `journalctl -u kinhold -f` (quién entra y sale).
- **Al día solo** (desde el 31 oct, lo pidió valravnx): cada 5 minutos el servidor mira si en main hay una versión
  nueva de la demo y, si la hay, se pone al día él solo (`auto_actualizar.sh`, que lanza `actualizar.sh`). Con lo
  demás que se sube (el diario, la web) no hace nada, para no reiniciarse sin necesidad. Al ponerse al día, los que
  estén jugando se desconectan unos segundos y el juego vuelve a conectar solo. Lo que ha hecho:
  `journalctl -u kinhold-actualizar`. Para pararlo: `systemctl disable --now kinhold-actualizar.timer`.
  **Para encenderlo en el servidor que ya está en marcha (una vez):** en la consola de Hetzner, como root,
  `bash /opt/kinhold/servidor/nube/actualizar.sh`; esa actualización deja puesto el temporizador. Las máquinas nuevas
  lo traen de serie.
- **Poner la última versión del juego a mano** (ya no hace falta, pero vale): `bash /opt/kinhold/servidor/nube/actualizar.sh`.
  No borra el mundo.
- **Con un dominio propio** (si algún día compras uno): apúntalo a la IP y lanza
  `KINHOLD_DOMINIO=juego.tudominio.com bash /opt/kinhold/servidor/nube/instalar.sh`.
- **Empezar el mundo de cero (wipe):** `systemctl stop kinhold && rm -f /var/lib/kinhold/*.json /var/lib/kinhold/*.jsonl && systemctl start kinhold`.
  Borra lo construido, lo que lleva cada uno y lo del suelo, quién es quién (fichas) y dónde estaba cada uno: todos
  vuelven a empezar como nuevos, en la salida.

## Qué hay en esta carpeta

- `cloud-config.yaml` — lo que se pega al crear la máquina: clona el juego y lanza `instalar.sh`.
- `instalar.sh` — instala Node.js 22, Caddy, el juego en `/opt/kinhold`, el servicio `kinhold` (arranca solo y
  vuelve a arrancar si se cae) y el cortafuegos (solo SSH, HTTP y HTTPS; el puerto del juego no se ve desde fuera).
  Repetirlo no hace daño.
- `actualizar.sh` — trae lo último de main y reinicia el servidor (y deja puesto el temporizador de abajo).
- `auto_actualizar.sh`, `kinhold-actualizar.service.plantilla` y `kinhold-actualizar.timer` — el servidor al día solo
  con cada versión nueva de la demo. Su prueba: `node pruebas/prueba_auto_actualizar.mjs` (un repositorio de mentira
  y una copia corta como la del servidor).
- `Caddyfile.plantilla` y `kinhold.service.plantilla` — lo que rellena `instalar.sh`. Caddy pone el HTTPS (la web
  pública va por HTTPS y solo puede conectar con `wss://`), pasa el WebSocket al juego y manda a quien abre la
  dirección a la demo con `?servidor=wss://…`.
- La prueba: `node pruebas/prueba_nube.mjs` (Caddy de verdad delante del servidor del juego, con HTTPS local, y
  dos clientes que se ven a través de él).

No comprobado: la instalación entera en una máquina de Hetzner de verdad (aquí no hay una), las descargas de
NodeSource y del repositorio de Caddy (desde aquí no se pueden abrir) y el certificado real con sslip.io.
