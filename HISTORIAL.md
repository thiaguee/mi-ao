# Norway AO: todo lo que hicimos (del 20 al 23 de noviembre)

Ordenado por tema y con cómo quedó al final: si algo se cambió después, figura la versión final. Última versión: **v1.63.0**.

---

## 1. La base del juego (día 1)
- Fénix AO reescrito: **servidor** en Node.js y **cliente web** (se juega en el navegador o en la app).
- Nombre **Norway AO**. Experiencia y oro multiplicados (x100).
- **App de Windows** con el servidor incluido. Se instala, se actualiza sola y los personajes se guardan fuera de la instalación.
- **GitHub**: cada cambio genera solo el instalador nuevo (las "releases").
- Archivo **JUGAR-EN-MI-PC.bat** que no pide instalar Node.js.
- **Jugar con amigos** por Radmin: la pantalla de ingreso muestra tu número y tiene un botón para unirse al mundo de un amigo.
- **Guía** (GUIA.md), que incluye cómo poner el servidor en internet (VPS).

## 2. Controles, pantalla y fluidez
- **Teclas modernas**:
  - WASD para caminar.
  - Espacio o U para consumir (pociones, comida, pergaminos) y E para equipar. El doble clic hace lo que corresponda.
  - Q agarra, F medita y Ctrl ataca.
  - Hechizos con las teclas 1 a 9.
  - **F7**: macro de un bicho con autopoteo.
- **Caminata fluida** sin frenos, a 60 cuadros en PCs lentas, con precarga de la zona y modo liviano. **F3** muestra el diagnóstico.
- **Resolución fija 800x600** que se agranda entera a cualquier ventana, sin líneas negras entre baldosas.
- **Interfaz**:
  - Panel con nivel y experiencia.
  - Inventario y hechizos (LANZAR / INFO).
  - Barras de salud, energía, maná, hambre y sed.
  - Botón Consumir.
- **Minimapa** y **mapa del mundo** (tecla M), que marca las dungeons.
- Los hechizos llegan a todo lo que ves en pantalla y no tienen el recuadro amarillo al apuntar.
- Ventanitas propias del juego en vez de las de Windows, para que no se trabe el teclado.
- Los cambios de gráficos se ven al entrar, sin borrar la caché.

## 3. Chat y textos
- **Chat clásico**: solo las letras arriba de la cabeza, a una altura media.
- Letra **MS Sans Serif** pixelada (la de Visual Basic 6), en negrita y con sombra.
- **Colores**:
  - Jugadores en blanco.
  - **GMs en naranja**.
  - Líderes de facción en rojo, celeste o gris.
  - Muertos en celeste. Solo los escuchan otros muertos y los GMs.
- **Cartelear**: Enter, Espacio, Enter borra lo que dijiste.
- **Daño como el AO original**: solo en la consola ("¡Le has pegado a X por N!").
- **Emotes**: /SALUDAR /BAILAR /SENTARSE (en un banco te sentás) /REIR /APLAUDIR /LLORAR /ENOJAR /AMOR /PENSAR. /EMOTES los lista.
- **Clic en un personaje**: muestra nombre, clan, si es GM, ciudadano o criminal, NOBLE, LÍDER y su descripción (/desc).

## 4. Administración y GMs
- **Admins**: Thiago y Lautaro, y las cuentas reservadas tsk, heaveN y peladoh, que en modo prueba se crean solas con contraseña 123.
- **Moverse**:
  - Clic derecho para teletransportarte.
  - /MAPAGM, /TELEP, /IR, /DONDE.
  - **/ULLA** te lleva a 1,55,49.
- **/INVISIBLE** o **/INVI**: los usuarios no te ven.
- **Portales**: /CREARTP, /BORRARTP, /TPS.
- **Objetos y NPCs**:
  - /CI número cantidad para crear objetos.
  - Panel **/OBJETOS**.
  - Panel **/TESTEO**.
  - /NIVEL con stats máximos.
- **Tiendas**: **/TIENDAS** elige qué vende cada comerciante. **/PONERNPC**, **/SACARNPC** y **/NPCSPUESTOS** dejan NPCs fijos.
- **Bichos**: /ACC invoca uno que no reaparece y /RACC uno que sí. Los bichos del mapa reaparecen cerca de donde nacieron.
- Los GMs ven el **número de cualquier NPC** al hacerle clic.
- **Estructuras fijas** en el mapa.

## 5. Clanes
- **/FUNDARCLAN** (15.000.000 de oro), con un máximo de 16 integrantes.
- Pestaña CLANES con solicitudes y chat **/CL**.
- **Capa del clan**: editor con emblema, la usan todos los integrantes, el líder tiene aura y los GMs tienen una capa única.

## 6. Facciones, guerra y nobleza
- **Guerra automática** Ciudadanos contra Criminales cada hora (/GUERRA). Dura 15 minutos y se entra desde el nivel 25.
- Las kills de guerra se canjean y el que más mata gana puntos de torneo.
- **Ranking de kills** con estrellas de oro, plata y bronce.
- **Premios de facción** con los Comandantes:
  - Los magos tienen su propia lista y las demás clases las armaduras de facción.
  - Las **alas** son para todos a las 500 kills.
  - **/PREMIOS** muestra los premios desde cualquier lugar.
- **Nobleza**:
  - /NOBLEZA con las gemas Roja, Verde y Violeta.
  - Nombre en amarillo dorado y etiqueta NOBLE.
  - Túnica de noble para cualquier clase.
- **Líderes faccionarios**:
  - /LIDER nombre CRIMINAL, CIUDADANO o NEUTRAL; también /QUITARLIDER y /LIDERES.
  - Reciben su chupín (2043, 2045 o 2047).
  - Nombre bordó, celeste o gris oscuro, con el título abajo.
- **Zonas de pelea** dentro de la ciudad, donde atacar no te vuelve criminal.

## 7. Misiones
- **Maestros de Misiones** en 5 ciudades.
- Ventana con 3 pestañas:
  - **Individuales**: normales y de élite, con un máximo de 3 activas. Las de élite se desbloquean al llegar al nivel 50 y suben hasta el 60.
  - **Clan**: semanales y suman todos los integrantes.
  - **Facción**: escalones de matar 10, 20, 50, 100, 250, 500 y 1000 del otro bando.
- Dan **puntos de misión**, que no se pierden al morir.
- Las diarias se sacaron, porque ahora están los retos del Pase.

## 8. Ullathorpe nueva
- **Edificios**:
  - Casa larga con los **vendedores por clase** (mago, paladín, clérigo, asesino y bardo).
  - Capilla, banco y casa de pociones.
  - **Casa de Hechizos** (Maestro de Hechizos 1035, con solapas por clase).
- **Plaza** con árbol, jardín y fuente.
- **Carteles y lugares**: rincón y cartel de QUEST en 64,55, cartel del Foro y plantes.
- **Mercader del Pueblo** arriba del banco.
- Portal a la Dungeon Newbie. Al salir de la Newbie volvés a Ullathorpe.

## 9. Sistemas nuevos
- **Día y noche**:
  - El día dura 3 horas y la noche 30 minutos.
  - De noche oscurece, se prenden faroles, antorchas y fogatas, y los bichos pegan más pero dan más.
  - Hay lluvia y nieve.
  - /HORA para GMs.
- **Mercado entre jugadores**: publicás, te compran aunque no estés conectado y no hay comisión.
- **Coliseo** (mapa 318, 6 arenas):
  - /DUELO y /DUELO2 con pozo de oro, /ACEPTO, /RECHAZO, /RENDIRSE y /COLISEO.
  - Apuestas de los espectadores.
  - Ranking mensual con Campeón del Coliseo.
- **5 dungeons de 3 pisos**: Templo Hundido, Abismo de Fuego, Cripta de los Olvidados, Caverna Helada y Fortaleza del Vacío.
  - Se entra caminando por una cueva con cartel y los pisos se unen con escaleras.
  - La lava y el agua no se caminan.
- **Pase de Temporada (1 a 100)**:
  - Ganás experiencia de pase jugando y hay retos del mes.
  - Premios estéticos: títulos, auras, capas y montura.
  - /PASEXP para Admins.
- **Agentes de Viajes** en las 8 ciudades: venden pasajes a 10.000 de oro, que se usan al lado de cualquier Agente.
- **Barca**: la vende el Marinero a 150.000 y se usa desde el nivel 20.
- **Oro seguro**: con 40.000 o más no se te cae al morir.
- **Monturas** y **tienda de puntos de torneo**.
- **Set post-newbie** por clase, que no se cae hasta el nivel 30.

## 10. Hechizos
- **Castigo** (51): daño sagrado solo a criaturas, con golpe crítico y divino.
- **Teleport a Ullathorpe** (52, pergamino 2064):
  - Lo usan las clases mágicas.
  - A los 3 segundos aparece un portal, dura 10 segundos y lleva a 1,58,44.
- **Apocalipsis** y los hechizos de **parálisis** para todos los magos.
- La parálisis de los bichos dura 7 minutos.
- Dardo Mágico arreglado.

## 11. Objetos y gráficos nuevos (todos del número 2000 en adelante)
- **Armas**:
  - Daga Sangrienta (2012), que hace sangrar.
  - Daga Celestial (2013).
  - Espada de Cristal (2018) y Espada Argentum +1.
  - Báculo del Archimago (2056).
  - 7 armas del Mega Pack (2057-2063).
- **Escudos y cascos**:
  - Escudos de Roble, del Alba y Carmesí (2014-2016).
  - Casco Calavera y Yelmo de Ciervo.
  - Corona de Rey.
- **Armaduras**:
  - Armadura del Guardián Dorado (2017).
  - Corazas del Mal y Divina.
  - Piezas rústicas.
- **Túnicas**:
  - Santa, Divina, Austera, Manto de Noble y Noble II.
  - Pretorianas Negra, Dorada y Blanca (2021-2023).
  - Angelical, Sombría (2024), Sacerdote y Hechicero Real.
  - Más de 20 del Mega Pack (2025-2055).
  - Ropa solo para GMs.
- **Chupines** 2043-2050.
- **Corcel Alazán** (montura 1248), con sus arreos.
- **Black Lady**.
- Se arreglaron cascos, coronas y escudos invisibles, y se recuperaron 78 gráficos dañados.

## 12. Planillas Excel y archivos de ayuda
- Objetos con imagen y número.
- Comandos por rango.
- NPCs y bichos.
- Mapas.
- Oro por bicho.
- Túnicas (con PNG para modificarlas).
- Varas y báculos.
- Comandos nuevos.
- **PARA-TESTEAR.md**: lista para probar lo último.

## Pendiente
- Bichos y jefes para cada piso de las dungeons.
- Ajustar los premios del pase.
- Decidir si los nombres usan la letra pixelada.
- Decidir si los neutrales tienen misiones de facción.
