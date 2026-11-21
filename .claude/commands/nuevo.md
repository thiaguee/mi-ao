Agregar contenido propio: $ARGUMENTS

1. Usá el número libre más bajo desde 2000 (buscalo con Grep en el .dat que corresponda, no leas el archivo entero).
2. Objeto → `server/data/dat/obj.dat`. NPC → `server/data/npcs-extra.json` o `npcs.dat`. Hechizo → `hechizos.dat` + `server/data/hechizos-clases.json`.
3. Si necesita lógica nueva, tocá solo el módulo del sistema (ver tabla en CLAUDE.md).
4. Sumalo al panel `/TESTEO` si corresponde (`server/src/testeo.js`).
5. Corré `node tools/bot-test.js` para verificar que el servidor arranca y responde.
6. Respondé solo con: qué número usaste, qué archivos tocaste y cómo probarlo en el juego.
