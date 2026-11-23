# Norway AO — Guía para el dueño del servidor

Esta guía explica, sin tecnicismos, cómo poner tu servidor en internet para que
cualquiera pueda jugar, y cómo usar tus poderes de GM.

---

## 1. Qué hay en este proyecto

| Carpeta | Qué es |
|---|---|
| `server/` | El **servidor**: el programa que queda prendido en internet y maneja el mundo. |
| `client/` | El **juego** que ven los jugadores (gráficos, mapas, música, sonidos). |
| `launcher/` | Lo que arma el **instalador para Windows** (`NorwayAO-Instalador.exe`). |
| `instalar-servidor.sh` | Un script que instala todo en el servidor alquilado con un solo comando. |

Las reglas del juego (clases que evolucionan, fórmulas de vida, golpe y maná,
experiencia, etc.) están tomadas del código liberado de **Norway AO**. El mundo,
los gráficos, los mapas y la música son los de **Argentum Online Libre**.
Ambos tienen licencia libre (GPL/AGPL), así que podés usarlos.

---

## 2. Poner el servidor en internet (una sola vez)

### Paso 1: alquilar un servidor (VPS)

Cualquiera de estas empresas sirve: **Hetzner**, **Contabo**, **DigitalOcean**,
**Vultr**. Elegí:

- Sistema operativo: **Ubuntu 24.04**
- Memoria: **2 GB** o más
- Lugar: el más cercano a tus jugadores (por ejemplo, São Paulo o Estados Unidos)

Cuesta unos 5 dólares por mes. Cuando lo creás te van a dar una **IP**
(cuatro números, como `123.45.67.89`) y una **contraseña de root**.

### Paso 2: conectarte al servidor

En tu PC con Windows, abrí **PowerShell** (buscalo en el menú Inicio) y escribí
(cambiando la IP por la tuya):

```
ssh root@123.45.67.89
```

Te va a pedir la contraseña. Al escribirla no se ve nada en pantalla, es normal.

### Paso 3: instalar el juego

Copiá y pegá estos comandos, uno por uno (cambiando la dirección por la de tu repositorio):

```
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO norwayao
```

```
cd norwayao
```

```
bash instalar-servidor.sh
```

Tarda unos 10 minutos. Al terminar te muestra dos links:

- `http://TU_IP:7666/descargar` → el **instalador para Windows**, que es lo que les pasás a los jugadores.
- `http://TU_IP:7666` → para **jugar desde el navegador**, sin instalar nada.

### Paso 4: crear los personajes administradores

> **Mientras estemos probando:** con `adminsDePrueba: true` en `server/config.json` (viene así),
> el servidor crea solo **tsk**, **heaveN** y **peladoh** con la contraseña **123**.
> **Antes de abrir el servidor al público** hay que ponerlo en `false` y cambiar las tres
> contraseñas con el comando de abajo.

Los nombres **tsk**, **heaveN** y **peladoh** están **reservados** para los dueños y son
**ADMINISTRADORES**. Nadie puede crearlos desde el juego hasta que cada uno les ponga
contraseña en el servidor. Cada dueño, conectado al servidor como en el paso 2, escribe
(con su nombre):

```
cd norwayao
```

```
node tools/clave-admin.js heaveN
```

Te pide la contraseña dos veces (no se ve al escribirla). Usá una contraseña nueva, de
8 caracteres o más, que no sea tu DNI ni tu fecha de nacimiento. Después entrás al juego,
creás el personaje con ese nombre y esa contraseña, y listo.

El mismo comando sirve para **cambiar la contraseña** si alguien la olvida o se la roban.
Las contraseñas nunca se suben a GitHub: quedan cifradas solo en el servidor.

En la aplicación de Windows (jugando solo en tu PC) estos nombres se crean directo, sin este paso.

Para sumar o sacar administradores después, usá `/DARGM nombre nivel` adentro del juego,
o editá la lista `gms` en `server/config.json`.

---

## 3. Tus poderes de GM

**Clic derecho en el mapa = te teletransportás ahí.**

Escribís los comandos en el chat del juego (Enter, el comando y Enter otra vez).
Con `/GMAYUDA` ves la lista completa adentro del juego.

### Moverte y vigilar
| Comando | Qué hace |
|---|---|
| `/IR nombre` | Te lleva al lado de un jugador. |
| `/SUM nombre` | Trae a un jugador al lado tuyo. |
| `/TELEP YO mapa x y` | Te teletransporta (por ejemplo `/TELEP YO 1 58 45` va a Ullathorpe). |
| `/TELEP nombre mapa x y` | Teletransporta a otro jugador. |
| `/TELEPLOC` | Te lleva al último lugar donde hiciste clic. |
| `/INVISIBLE` | Nadie te ve. |
| `/CAMINAR` | Atravesás paredes. |
| `/DONDE nombre` · `/INFO nombre` | Dónde está un jugador y sus datos. |
| `/ONLINE` · `/ONLINEGM` | Quién está conectado. |
| `/SOS` | Ver los pedidos de ayuda (los jugadores te escriben con `/GM mensaje`). |

### Castigar
| Comando | Qué hace |
|---|---|
| `/CARCEL nombre minutos` | Lo manda a la cárcel. |
| `/SILENCIAR nombre minutos` | No puede hablar (con `0` le sacás el castigo). |
| `/ECHAR nombre` | Lo desconecta. |
| `/BAN nombre` · `/UNBAN nombre` | Banear y desbanear. |

### Crear y regalar
| Comando | Qué hace |
|---|---|
| `/CI numero cantidad` | Crea un objeto (por ejemplo, `/CI 38 100` crea 100 pociones rojas). |
| `/BUSCAROBJ texto` | Busca el número de un objeto (por ejemplo, `/BUSCAROBJ espada`). |
| `/ACC numero` | Crea un NPC o monstruo al lado tuyo. |
| `/BUSCARNPC texto` | Busca el número de un NPC (por ejemplo, `/BUSCARNPC dragon`). |
| `/ORO nombre cantidad` | Da oro. |
| `/NIVEL nombre nivel` · `/EXP nombre cantidad` | Sube de nivel o da experiencia. |
| `/SKILLS nombre valor` | Pone todos los skills en ese valor. |
| `/HECHIZO nombre numero` | Le enseña un hechizo. |
| `/CLASE nombre numero` | Le cambia la clase. |
| `/MOD nombre HP 500` | Cambia vida, maná, energía, atributos, oro o golpe (HP, MAN, STA, ATRIB, ORO, BANCO, GOLPE). |
| `/REVIVIR nombre` · `/CURARU nombre` | Revive o cura completo. |

### Otros
| Comando | Qué hace |
|---|---|
| `/GOD` | Sos invulnerable y matás de un golpe. |
| `/MATAR` · `/RMATA` | Mata el NPC que señalaste, o todos los monstruos alrededor. |
| `/LIMPIAR` | Borra los objetos tirados en el mapa. |
| `/LLUVIA` | Activa o desactiva la lluvia. |
| `/RMSG texto` | Mensaje para todo el servidor en el chat. |
| `/ANUNCIO texto` | Cartel grande en la pantalla de todos. |
| `/MOTD texto` | Cambia el mensaje de bienvenida. |
| `/DARGM nombre nivel` | Nombra GMs: 1 Consejero, 2 Semidiós, 3 Dios, 4 Admin, 0 le saca el cargo. |
| `/GRABAR` | Guarda todos los personajes ya. (Igual se guardan solos cada 5 minutos.) |
| `/APAGAR` | Apaga el servidor (se vuelve a prender solo a los pocos segundos). |

---

## 4. Configuración (`server/config.json`)

En el servidor podés editar este archivo con `nano server/config.json`
(se guarda con Ctrl+O y Enter, y se sale con Ctrl+X). Después reiniciá con
`systemctl restart norwayao`.

| Opción | Para qué sirve |
|---|---|
| `nombreServidor` | El nombre que aparece en el juego. |
| `multiplicadorExp` | Cuánto rinde la experiencia. Viene en `50` (50 veces más que el original). |
| `multiplicadorOro` | Lo mismo para el oro que tiran los monstruos. Viene en `50`. |
| `oroInicial` | Oro con el que arranca cada personaje nuevo (viene en `1000`). |
| `respawnSegundos` | Cuánto tardan en reaparecer los monstruos. |
| `chatGlobal` | `true` o `false` para permitir el comando `/GLOBAL`. |
| `gms` | Lista de GMs por rango (también se maneja con `/DARGM`). |
| `motd` | Mensajes de bienvenida. |

Los personajes se guardan en `server/cuentas/` (un archivo por personaje) y los
registros (chat, comandos de GM, conexiones) en `server/logs/`.

---

## 5. Cómo se juega

Hay dos modos de teclas. Se cambia con el botón **⌨** del panel derecho y viene en **Moderno**.

| Acción | Moderno | Clásico |
|---|---|---|
| Caminar | WASD o flechas | Flechas |
| Tomar pociones (potear) | Seleccioná la poción y apretá **Espacio** | Seleccioná la poción y apretá U |
| Atacar | Ctrl | Ctrl |
| Agarrar del piso | Q | A |
| Meditar | F | M |
| Lanzar hechizo | Pestaña Hechizos → Lanzar → clic en el objetivo | Igual |
| Equipar · Tirar | E · T | E · T |
| Macro de hechizos | **F7** (elegí el hechizo, F7 lo tira solo a los bichos y se potea) | F7 |
| Mapa del mundo | M | Botón MAPA |
| Hablar | Enter | Enter |
| Mirar · Interactuar | Clic · Doble clic | Clic · Doble clic |

Con doble clic comerciás con los vendedores, usás el banco, te revive el sacerdote y abrís puertas.
Con arco: equipá el arco y las flechas, apretá Ctrl y hacé clic en el objetivo.

### Clases (como en Fénix)

Todos empiezan como **Ciudadano**:

- Nivel 3: Trabajador o Luchador.
- Nivel 6:
  - El Trabajador elige entre Experto en minerales, Experto en madera, Pescador, Sastre o Alquimista.
  - El Luchador elige entre Con uso de maná o Sin uso de maná.
- Nivel 9:
  - Con maná: Hechicero, Orden sagrada, Naturalista o Sigiloso.
  - Sin maná: Caballero o Bandido.
- Nivel 12:
  - Hechicero: Mago o Nigromante.
  - Orden sagrada: Paladín o Clérigo.
  - Naturalista: Bardo o Druida.
  - Sigiloso: Asesino o Cazador.
  - Caballero: Arquero o Guerrero.
  - Bandido: Pirata o Ladrón.

---

## 6. Jugar en tu PC (sin alquilar nada)

1. Entrá a la página de descargas: **https://github.com/thiaguee/mi-ao/releases/latest**
2. Abajo, en **Assets**, descargá **`NorwayAO-Instalador.exe`**.
3. Ejecutalo e instalá. Si Windows avisa "Windows protegió su PC": **Más información** → **Ejecutar de todas formas**.
4. Se crea el ícono **Norway AO** en el escritorio. Abrilo y jugá.

La aplicación trae el servidor adentro: no hace falta instalar nada más ni abrir el navegador.
Así juega solamente tu PC. Para que entren otros jugadores hace falta el servidor alquilado (punto 2).

Cada vez que se suben cambios al proyecto, GitHub arma solo un instalador nuevo y lo publica en esa misma página.

---

## 7. Misiones

- Se piden en el **Maestro de Misiones** (tiene un **!** amarillo arriba), cerca del centro de
  **Ullathorpe, Nix, Banderbill, Arghal y Lindos**. Doble clic sobre él.
- Todas son de **matar bichos** y se cumplen solas al llegar al número: dan **oro, experiencia
  y puntos de misión**.
- Podés tener **3 misiones activas**. Al terminar una se libera el lugar.
- **Diarias**: 3 por día según tu nivel, no ocupan lugar.
- **De clan**: semanales, suman las muertes de todos los integrantes y premian a todos.
- **Élite**: al llegar al **nivel 50** se desbloquean 10 niveles más (hasta el 60) y misiones de élite.
- **Puntos de misión**: no se pierden al morir. Más adelante se van a poder canjear por objetos.
- Las misiones están en `server/data/misiones.json` (se regenera con `python3 tools/misiones.py`).

---

## 8. Guerra y ranking

- **Cada hora en punto** empieza una **guerra de 15 minutos** entre Ciudadanos y Criminales
  (2 minutos antes se avisa a todos). Se entra con **/GUERRA** y se sale con **/SALIRGUERRA**.
- Se pelea en la Arena (mapa 273). Al morir no se cae nada y reaparecés en tu base.
- Se entra desde **nivel 25**.
- Cada muerte del otro bando (en la guerra o afuera) suma para los **premios de facción**.

### Premios de facción
Se reclaman con doble clic en el **Comandante**: el de la Armada en **Banderbill** (ciudadanos) y el del Caos
en **Arghal** (criminales). Cada premio se da una sola vez, **no se cae al morir** y sólo lo puede usar su bando.

**Magos** (Mago, Nigromante, Hechicero):

| Kills | Ciudadanos (criminales matados) | Criminales (ciudadanos matados) |
|---|---|---|
| 10 | Túnica Conspicua de Mago Imperial | Túnica de Maga Oscura (sólo mujeres) |
| 25 | Túnica de Mago del Imperio | Túnica Conspicua de Mago Imperial |
| 50 | Túnica Egregia de Mago Oscuro | Túnica Egregia de Mago Oscuro |
| 100 | Túnica de Archimago Imperial | Túnica de Líder del Caos |
| 500 | Alas de ángel | Alas de demonio |

**Las demás clases** reciben las armaduras de facción originales del AO para su clase:

| Kills | Clérigo / Bardo / Druida (ciuda · crimi) | Guerrero / Paladín / Asesino / resto (ciuda · crimi) |
|---|---|---|
| 10 | Vestimenta Imperial · Vestimenta Legionaria | Vestimenta Imperial · Vestimenta Legionaria |
| 25 | Manto de Sacerdote del Imperio · Manto de Sacerdote Demoníaco | Armadura Real · Armadura Legionaria |
| 50 | Armadura de Gran Sacerdote Imperial · ... Demoníaco | Armadura Nobilísima · Armadura Lóbrega |
| 500 | Alas de ángel · Alas de demonio | Alas de ángel · Alas de demonio |

Los enanos y gnomos reciben la versión (E/G) de cada una.

Los premios se cambian en `server/data/recompensas-faccion.json`.

### Otros
- La **barca** se usa desde **nivel 20**.
- Salir de la Dungeon Newbie por la salida te deja en **Ullathorpe**.
- **Apocalipsis, Paralizar, Inmovilizar y Devolver Movilidad** (saca la parálisis) los venden los magos de todas las ciudades.
- Al que **más mata** en la guerra se le dan **5 puntos de torneo** (no se pierden).
- **/PREMIOS**: muestra tus premios por kills, cuántas kills llevás y cuáles ya podés reclamar.
- **Ranking de kills** (/RANKING): los 3 que más mataron llevan una estrella de **oro, plata y bronce** al lado del nombre.
- GMs: **/GUERRA INICIAR** y **/GUERRA TERMINAR**. Horarios y duración: sección `guerra` de `server/config.json`
  (cadaMinutos, duracionMinutos, avisoMinutos, puntosTorneoGanador).

---

## Nobleza

- Juntando **las gemas de nobleza** en el inventario (**Gema Roja**, que suelta Smaug en el mapa 309; **Gema Verde**, Ryu en el mapa 315; y **Gema Violeta**, Hydra en el mapa 303) y escribiendo **/NOBLEZA**, el personaje se vuelve **Noble** (las gemas se gastan).
- El noble sigue siendo ciudadano o criminal, pero su **nombre se ve amarillo** y al hacerle clic aparece la etiqueta **NOBLE**.
- Beneficio: elige **una** de las 3 túnicas de noble (Túnica de Noble, Túnica de Noble 2 y Túnica de Noble 3). La puede usar **cualquier noble, sea la clase que sea**; nadie más. No se cae al morir. /NOBLEZA vuelve a abrir la ventana.
- GMs (Dios o más): **/NOBLE nombre** da o saca la nobleza.
- Las gemas y las túnicas se configuran en `server/data/nobleza.json` (la Túnica de Noble 3 está en 0 hasta que se suba).

---

## Tiendas (/TIENDAS)

- Comando de GM (Dios o Admin). Abre un panel con **todos los NPCs que venden cosas** (77 tipos), con su número y en qué ciudades están.
- Elegís un vendedor y ves lo que vende, con su precio. Con **✕** lo sacás, con **▲ ▼** cambiás el orden.
- A la derecha está **la lista de todos los objetos del juego** (buscador por nombre o número y filtro por tipo). Con **+** (o doble clic) se agrega a la tienda.
- El cambio es inmediato, vale para ese NPC en todas las ciudades donde aparece y queda guardado en `tiendas.json` (carpeta de datos del servidor), así que sigue después de reiniciar.
- El precio de compra es el valor del objeto (con descuento por skill de Comercio).

---

## NPCs fijos puestos por GMs

- **/PONERNPC número** (Dios o Admin): pone un NPC en la última baldosa donde hiciste clic (o adelante tuyo si no clickeaste). Queda ahí aunque se reinicie el servidor.
- **/SACARNPC**: clic en un NPC y /SACARNPC lo saca para siempre (sirve también para los que venían en el mapa).
- **/NPCSPUESTOS**: lista de los NPCs puestos.
- Vendedores por clase listos para poner: **1030** Magos · **1031** Paladines · **1032** Clérigos · **1033** Asesinos · **1034** Bardos (lo que venden se cambia con /TIENDAS).

---

## Ullathorpe nueva

- **Arriba**: casa larga con los 5 vendedores por clase (Bardo, Clérigo, Mago, Asesino, Paladín) y la **capilla** con el sacerdote.
- **Plaza** donde aparecen los personajes (58, 45) con faroles, banco y flores; **jardín con la fuente** a la derecha.
- **Banco**: banquero con mesa y cartel al lado del árbol grande. **Pociones**: casa de Lilith abajo de la fuente.
- **Casa de Hechizos** (abajo de "Anuncio a forasteros"): el Maestro de Hechizos vende todos los hechizos, con una solapa por clase; cada uno sólo compra los de su clase (se cambia en `server/data/hechizos-clases.json`).
- **Quest**: el Maestro de Misiones está en el rincón con arco de flores y cartel QUEST.
- **Plantes**: debajo de Quest hay 2 lugares (piedra, 2 cuadrados con sangre, piedra). Adentro de los cuadrados se pueden pegar sin volverse criminal y sin perder nada; afuera es zona segura.
- **Portal a la Dungeon Newbie**: en el pasto a la derecha de la plaza (67, 48).

---

## Novedades: emotes, día y noche, mercado

- **Emotes**: /SALUDAR /BAILAR /SENTARSE (al lado de un banco te sentás en el banco) /REIR /APLAUDIR /LLORAR /ENOJAR /AMOR /PENSAR. /EMOTES los lista.
- **Día y noche**: el día dura 3 horas y la noche 30 minutos (se cambia en `config.json` → `ciclo`: minutosDia, minutosNoche). De noche oscurece, se prenden faroles, antorchas y fogatas, y los bichos pegan 25% más pero dan 50% más experiencia y oro. Llueve de vez en cuando, nieva en los mapas nevados y hay niebla al amanecer. GMs: **/HORA n** cambia la hora (se configura en `config.json` → `ciclo`).
- **Mercado entre jugadores**: el **Mercader del Pueblo** está en la plaza de Ullathorpe (puesto con cartel MERCADO). Publicás un objeto con su precio, queda a la venta aunque te desconectes y cobrás solo (el mercado se queda con 5%). Hasta 10 publicaciones por personaje; los objetos newbie y los premios no se venden.

## Coliseo de Norway (duelos)

- Mapa nuevo **318** con **6 arenas**. Afuera es zona segura para mirar; adentro se pelea (sin perder nada al morir).
- **/DUELO nombre [oro]**: reta a alguien 1 contra 1 (el oro lo pone cada uno y el ganador se lleva todo). **/DUELO2 compañero rival1 rival2 [oro]**: 2 contra 2. Se responde con **/ACEPTO nombre** o **/RECHAZO nombre**.
- Antes de pelear hay **30 segundos para apostar**: **/APOSTAR nombre oro** (mínimo 100). Los que aciertan se reparten todo lo apostado (el Coliseo se queda con 5%).
- **/COLISEO**: ir a mirar los duelos (desde una ciudad) y volver. **/RENDIRSE** abandona. Si en 5 minutos no hay ganador es empate.
- **/RANKINGDUELOS**: ranking de la temporada (un mes, puntos tipo ELO desde 1000). El **#1 del mes es Campeón del Coliseo** y gana 20 puntos de torneo y 1.000.000 de oro.

## Dungeons nuevas (3 pisos cada una)

Se entra **caminando** por una boca de cueva con su cartel (se ven en el mapa del mundo, tecla M, con una calavera). Cada dungeon tiene 3 pisos unidos por escaleras: en el 1 van los bichos más fáciles, en el 2 más difíciles y en el 3 el jefe. Por ahora están **vacías**: los bichos se eligen después.

| Dificultad | Dungeon | Entrada (mapa) | Pisos |
|---|---|---|---|
| ☠ | Templo Hundido | Pantano (190) | 319 · 320 · 321 |
| ☠☠ | Abismo de Fuego | Gran Isla del Oro, sur de Nix (213) | 322 · 323 · 324 |
| ☠☠☠ | Cripta de los Olvidados | Cementerio de Viejas Glorias (159) | 325 · 326 · 327 |
| ☠☠☠☠ | Caverna Helada | Bosque al este de Banderbill (161) | 328 · 329 · 330 |
| ☠☠☠☠☠ | Fortaleza del Vacío | Bosque sur, Cárcel de Banderbill (65) | 331 · 332 · 333 |

## Pase de Temporada (1 a 100)

- Botón **PASE** (o /PASE). Cada mes arranca una temporada nueva y los niveles vuelven a 0; **los cosméticos ganados quedan para siempre**.
- Se gana experiencia de pase matando bichos (más los grandes), con misiones (150, diarias 100), duelos (80 ganado / 25 jugado), guerras (120 + 10 por kill) y ventas en el Mercado (30). Además hay **retos del mes** que dan mucha experiencia de una (matar 500 bichos, 100 de noche, 15 misiones, ganar 5 duelos, 3 guerras, visitar las 5 dungeons nuevas, etc.).
- Premios **sólo estéticos** cada 5 niveles: títulos (se ven debajo del nombre), auras de colores, capas y, en el nivel 100, la Montura de Corcel Alazán + Aura Arcoíris + título "Leyenda de la Temporada". Se equipan en la pestaña **Mis cosméticos**.
- Todo (experiencia por nivel, cuánto da cada cosa, retos y premios) se cambia en `server/data/pase.json`. Admins: **/PASEXP nombre cantidad**.

## Pasajes de viaje

- En cada ciudad (Ullathorpe, Nix, Banderbill, Lindos, Arghal, Nemahuak, Arkhein y Gotland) hay un **Agente de Viajes** que vende pasajes a las otras ciudades a **10.000 de oro**.
- El pasaje queda en el inventario: **parado al lado de cualquier Agente**, doble clic en el pasaje y viajás (se gasta). Precio y destinos en `server/data/pasajes.json`.
