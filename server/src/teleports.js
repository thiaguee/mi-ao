'use strict';
// Teleports (portales): los fijos están en data/teleports.json y los que crean los GMs con
// /CREARTP se guardan en teleports-gm.json (en la carpeta de datos del servidor).
const fs = require('fs');
const path = require('path');
const { idx } = require('./gamedata');

const T = {};
const OBJ_PORTAL = 378; // objeto "Teleport" (sólo se usa su dibujo)
const FIJOS = path.join(__dirname, '..', 'data', 'teleports.json');

T.cargarTeleports = function () {
  this.tpGmPath = path.join(this.dataDir, 'teleports-gm.json');
  const leer = (p) => { try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).teleports || [] : []; } catch (e) { console.error('Error leyendo', p, e.message); return []; } };
  this.tpGm = leer(this.tpGmPath);
  let n = 0;
  for (const t of [...leer(FIJOS), ...this.tpGm]) if (this.ponerTeleport(t, false)) n++;
  console.log(`Teleports: ${n}`);
};

T.ponerTeleport = function (t, avisar) {
  const mp = this.maps[t.mapa];
  const [dm, dx, dy] = t.destino || [];
  if (!mp || !this.maps[dm] || !this.inMap(t.x, t.y)) return false;
  const k = idx(t.x, t.y);
  mp.d.exits.set(k, { map: dm, x: dx, y: dy });
  mp.objs.set(k, { id: OBJ_PORTAL, amount: 1 }); // sin "t": la limpieza de objetos no lo borra
  if (avisar) this.toMap(t.mapa, { t: 'obj', x: t.x, y: t.y, g: this.data.objs[OBJ_PORTAL].grh });
  return true;
};

T.guardarTeleportsGm = function () {
  fs.writeFileSync(this.tpGmPath, JSON.stringify({ teleports: this.tpGm }, null, 2));
};

// /CREARTP mapa x y  -> crea un portal donde estás parado que lleva a ese lugar
T.crearTeleport = function (p, m, x, y) {
  if (!this.maps[m] || !this.inMap(x, y)) return this.msg(p, 'Destino inválido. Uso: /CREARTP mapa x y', 'warn');
  const t = { mapa: p.map, x: p.x, y: p.y, destino: [m, x, y], creadoPor: p.name, nombre: this.maps[m].d.name };
  this.tpGm = this.tpGm.filter((o) => !(o.mapa === t.mapa && o.x === t.x && o.y === t.y));
  this.tpGm.push(t);
  this.guardarTeleportsGm();
  this.ponerTeleport(t, true);
  this.msg(p, `Teleport creado en (${t.mapa}, ${t.x}, ${t.y}) hacia ${this.maps[m].d.name} (${m}, ${x}, ${y}). Movete y volvé a pisarlo para usarlo.`, 'gm');
};

// /BORRARTP -> borra el portal que creaste donde estás parado
T.borrarTeleport = function (p) {
  const antes = this.tpGm.length;
  this.tpGm = this.tpGm.filter((o) => !(o.mapa === p.map && o.x === p.x && o.y === p.y));
  if (this.tpGm.length === antes) return this.msg(p, 'No hay un teleport creado con /CREARTP donde estás parado.', 'warn');
  this.guardarTeleportsGm();
  const mp = this.maps[p.map];
  const k = idx(p.x, p.y);
  mp.d.exits.delete(k);
  mp.objs.delete(k);
  this.toMap(p.map, { t: 'obj', x: p.x, y: p.y, g: 0 });
  this.msg(p, 'Teleport borrado.', 'gm');
};

T.listarTeleports = function (p) {
  if (!this.tpGm.length) return this.msg(p, 'No hay teleports creados por GMs.', 'gm');
  for (const t of this.tpGm) this.msg(p, `(${t.mapa}, ${t.x}, ${t.y}) -> (${t.destino.join(', ')}) ${t.nombre || ''} — creado por ${t.creadoPor || '?'}`, 'gm');
};

module.exports = T;
