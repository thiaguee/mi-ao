'use strict';
// Clanes: fundar (15.000.000 de oro), solicitudes de ingreso, integrantes (máx. 16), capa
// personalizada por el líder, aura del líder y chat de clan (/CL mensaje).
const fs = require('fs');
const path = require('path');
const accounts = require('./accounts');

const K = {};
const COSTO_FUNDAR = 15000000;
const MAX_MIEMBROS = 16;
const EMBLEMAS = ['estrella', 'espadas', 'escudo', 'calavera', 'corona', 'luna', 'sol', 'rayo', 'cruz', 'dragon', 'llama', 'ojo'];
const COLOR = /^#[0-9a-fA-F]{6}$/;

K.cargarClanes = function () {
  this.clanesPath = path.join(this.dataDir, 'clanes.json');
  try {
    this.clanes = fs.existsSync(this.clanesPath) ? JSON.parse(fs.readFileSync(this.clanesPath, 'utf8')) : {};
  } catch (e) {
    console.error('Error leyendo clanes.json:', e.message);
    this.clanes = {};
  }
  console.log(`Clanes: ${Object.keys(this.clanes).length}`);
};

K.guardarClanes = function () {
  const tmp = this.clanesPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(this.clanes, null, 2));
  fs.renameSync(tmp, this.clanesPath);
};

const clave = (n) => String(n || '').toLowerCase();
K.clanDe = function (p) { return p.guild ? this.clanes[clave(p.guild)] : null; };
K.esLider = (clan, p) => clan && clave(clan.lider) === clave(p.name);

K.capaValida = function (c) {
  c = c || {};
  return {
    color: COLOR.test(c.color) ? c.color : '#7a1010',
    borde: COLOR.test(c.borde) ? c.borde : '#e0b45a',
    emblema: EMBLEMAS.includes(c.emblema) ? c.emblema : 'estrella',
    colorEmblema: COLOR.test(c.colorEmblema) ? c.colorEmblema : '#ffd84a',
  };
};

// Datos del clan que se mandan junto con cada personaje (para dibujar la capa)
// Capa de GM: todos los GMs llevan la misma (negra, borde naranja, corona y aura)
const CAPA_GM = { c: '#141414', b: '#ff8c1a', e: 'corona', ce: '#ff8c1a', ld: 1 };
K.capaInfo = function (p) {
  if (p.capaOculta) return null; // el jugador se sacó la capa
  if (p.gm > 0 && !p.hideGm) return CAPA_GM;
  const clan = this.clanDe(p);
  if (!clan) return null;
  const c = clan.capa;
  return { c: c.color, b: c.borde, e: c.emblema, ce: c.colorEmblema, ld: this.esLider(clan, p) ? 1 : 0 };
};

// Al entrar: confirmar que sigue siendo del clan (pudo haber sido expulsado estando offline)
K.revisarClanAlEntrar = function (p) {
  const clan = this.clanDe(p);
  if (p.guild && (!clan || !clan.miembros.some((m) => clave(m) === clave(p.name)))) {
    this.msg(p, `Ya no formás parte del clan ${p.guild}.`, 'warn');
    p.guild = '';
    return;
  }
  if (clan) {
    p.guild = clan.nombre;
    this.avisarClan(clan, `${p.name} se conectó.`, p.name);
  }
};

K.avisarClan = function (clan, texto, excepto) {
  for (const m of clan.miembros) {
    if (excepto && clave(m) === clave(excepto)) continue;
    const o = this.findPlayer(m);
    if (o) this.msg(o, `[${clan.nombre}] ${texto}`, 'guild');
  }
};

K.refrescarMiembro = function (o) {
  this.sendCharToMap(o);
};

// Cambia el clan de un personaje, esté conectado o no
K.ponerClan = function (nombre, clanNombre) {
  const o = this.findPlayer(nombre);
  if (o) { o.guild = clanNombre; this.refrescarMiembro(o); return; }
  const rec = accounts.load(nombre);
  if (rec) { rec.guild = clanNombre; accounts.save(rec); }
};

// ---------- mensajes del cliente ----------
K.accionClan = function (p, m) {
  const a = m.a;
  if (a === 'lista') return this.enviarClanes(p);
  if (a === 'abrirFundar') return this.abrirFundar(p);
  if (a === 'crear') return this.fundarClan(p, m.nombre, m.capa);
  if (a === 'solicitar') return this.solicitarIngreso(p, m.clan);
  if (a === 'cancelarSolicitud') return this.cancelarSolicitud(p, m.clan);
  if (a === 'salir') return this.salirClan(p);
  const clan = this.clanDe(p);
  if (!clan) return;
  if (!this.esLider(clan, p)) return this.msg(p, 'Sólo el líder del clan puede hacer eso.', 'warn');
  if (a === 'aceptar') return this.aceptarSolicitud(p, clan, m.nombre);
  if (a === 'rechazar') return this.rechazarSolicitud(p, clan, m.nombre);
  if (a === 'expulsar') return this.expulsar(p, clan, m.nombre);
  if (a === 'capa') return this.cambiarCapa(p, clan, m.capa);
  if (a === 'lider') return this.pasarLiderazgo(p, clan, m.nombre);
  if (a === 'disolver') return this.disolverClan(p, clan);
  if (a === 'desc') { clan.desc = String(m.desc || '').slice(0, 120); this.guardarClanes(); return this.enviarClanes(p); }
};

K.enviarClanes = function (p) {
  const lista = Object.values(this.clanes).map((c) => ({
    n: c.nombre, lider: c.lider, cant: c.miembros.length, max: MAX_MIEMBROS, capa: c.capa, desc: c.desc || '',
    online: c.miembros.filter((m) => this.findPlayer(m)).length,
    pedido: c.solicitudes.some((s) => clave(s) === clave(p.name)),
  })).sort((a, b) => b.cant - a.cant || a.n.localeCompare(b.n));
  const clan = this.clanDe(p);
  let mio = null;
  if (clan) {
    mio = {
      n: clan.nombre, lider: clan.lider, capa: clan.capa, desc: clan.desc || '', fundado: clan.fundado, max: MAX_MIEMBROS,
      soyLider: this.esLider(clan, p),
      miembros: clan.miembros.map((m) => {
        const o = this.findPlayer(m);
        const rec = o || accounts.load(m);
        return { n: rec ? rec.name : m, online: !!o, lvl: rec ? rec.stats.lvl : 0, clase: rec ? require('./gamedata').CLASES[rec.clase] : '' };
      }),
      solicitudes: this.esLider(clan, p) ? clan.solicitudes.map((s) => {
        const o = this.findPlayer(s); const rec = o || accounts.load(s);
        return { n: rec ? rec.name : s, online: !!o, lvl: rec ? rec.stats.lvl : 0, clase: rec ? require('./gamedata').CLASES[rec.clase] : '' };
      }) : [],
    };
  }
  this.send(p, { t: 'clanes', lista, mio, costo: COSTO_FUNDAR, emblemas: EMBLEMAS });
};

K.abrirFundar = function (p) {
  if (this.clanDe(p)) return this.msg(p, 'Ya pertenecés a un clan. Para fundar otro, primero tenés que salir.', 'warn');
  if (p.stats.gld < COSTO_FUNDAR && p.gm < 3) {
    return this.msg(p, `Para fundar un clan necesitás ${COSTO_FUNDAR.toLocaleString('es-AR')} monedas de oro encima. Tenés ${p.stats.gld.toLocaleString('es-AR')}.`, 'warn');
  }
  this.send(p, { t: 'clanFundar', costo: COSTO_FUNDAR, emblemas: EMBLEMAS });
};

K.fundarClan = function (p, nombre, capa) {
  nombre = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (this.clanDe(p)) return this.msg(p, 'Ya pertenecés a un clan.', 'warn');
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]{3,20}$/.test(nombre)) return this.send(p, { t: 'clanError', text: 'El nombre debe tener entre 3 y 20 letras o números.' });
  if (this.clanes[clave(nombre)]) return this.send(p, { t: 'clanError', text: 'Ya existe un clan con ese nombre.' });
  if (p.stats.gld < COSTO_FUNDAR && p.gm < 3) return this.send(p, { t: 'clanError', text: `Necesitás ${COSTO_FUNDAR.toLocaleString('es-AR')} monedas de oro.` });
  if (p.gm < 3) { p.stats.gld -= COSTO_FUNDAR; this.sendStat(p, ['gld']); }
  const clan = { nombre, lider: p.name, miembros: [p.name], solicitudes: [], capa: this.capaValida(capa), fundado: Date.now(), desc: '' };
  this.clanes[clave(nombre)] = clan;
  this.guardarClanes();
  p.guild = nombre;
  this.savePlayer(p);
  this.refrescarMiembro(p);
  this.send(p, { t: 'clanCreado' });
  this.toAll({ t: 'msg', text: `¡${p.name} fundó el clan ${nombre}!`, color: 'server' });
  this.log(`Clan fundado: ${nombre} por ${p.name}`);
  this.enviarClanes(p);
};

K.solicitarIngreso = function (p, nombreClan) {
  const clan = this.clanes[clave(nombreClan)];
  if (!clan) return;
  if (this.clanDe(p)) return this.msg(p, 'Ya pertenecés a un clan.', 'warn');
  if (clan.miembros.length >= MAX_MIEMBROS) return this.msg(p, `El clan ${clan.nombre} está completo (${MAX_MIEMBROS} integrantes).`, 'warn');
  if (clan.solicitudes.some((s) => clave(s) === clave(p.name))) return this.msg(p, 'Ya mandaste una solicitud a ese clan.', 'info');
  clan.solicitudes.push(p.name);
  this.guardarClanes();
  this.msg(p, `Mandaste una solicitud para entrar a ${clan.nombre}. El líder tiene que aceptarla.`, 'info');
  const lider = this.findPlayer(clan.lider);
  if (lider) this.msg(lider, `[${clan.nombre}] ${p.name} pidió entrar al clan. Abrí CLANES para aceptarlo o rechazarlo.`, 'guild');
  this.enviarClanes(p);
};

K.cancelarSolicitud = function (p, nombreClan) {
  const clan = this.clanes[clave(nombreClan)];
  if (!clan) return;
  clan.solicitudes = clan.solicitudes.filter((s) => clave(s) !== clave(p.name));
  this.guardarClanes();
  this.enviarClanes(p);
};

K.aceptarSolicitud = function (p, clan, nombre) {
  if (!clan.solicitudes.some((s) => clave(s) === clave(nombre))) return;
  clan.solicitudes = clan.solicitudes.filter((s) => clave(s) !== clave(nombre));
  if (clan.miembros.length >= MAX_MIEMBROS) { this.guardarClanes(); return this.msg(p, `El clan ya tiene ${MAX_MIEMBROS} integrantes.`, 'warn'); }
  // si mientras tanto entró a otro clan, no se puede
  const o = this.findPlayer(nombre);
  const rec = o || accounts.load(nombre);
  if (!rec) { this.guardarClanes(); return this.enviarClanes(p); }
  if (rec.guild && this.clanes[clave(rec.guild)]) { this.guardarClanes(); this.msg(p, `${rec.name} ya está en otro clan.`, 'warn'); return this.enviarClanes(p); }
  // sacarlo de las solicitudes de otros clanes
  for (const c of Object.values(this.clanes)) c.solicitudes = c.solicitudes.filter((s) => clave(s) !== clave(nombre));
  clan.miembros.push(rec.name);
  this.guardarClanes();
  this.ponerClan(rec.name, clan.nombre);
  this.avisarClan(clan, `¡${rec.name} se unió al clan!`);
  this.enviarClanes(p);
};

K.rechazarSolicitud = function (p, clan, nombre) {
  clan.solicitudes = clan.solicitudes.filter((s) => clave(s) !== clave(nombre));
  this.guardarClanes();
  const o = this.findPlayer(nombre);
  if (o) this.msg(o, `Tu solicitud para entrar a ${clan.nombre} fue rechazada.`, 'warn');
  this.enviarClanes(p);
};

K.expulsar = function (p, clan, nombre) {
  if (clave(nombre) === clave(clan.lider)) return;
  if (!clan.miembros.some((m) => clave(m) === clave(nombre))) return;
  clan.miembros = clan.miembros.filter((m) => clave(m) !== clave(nombre));
  this.guardarClanes();
  this.ponerClan(nombre, '');
  const o = this.findPlayer(nombre);
  if (o) this.msg(o, `Fuiste expulsado del clan ${clan.nombre}.`, 'warn');
  this.avisarClan(clan, `${nombre} fue expulsado del clan.`);
  this.enviarClanes(p);
};

K.salirClan = function (p) {
  const clan = this.clanDe(p);
  if (!clan) return;
  if (this.esLider(clan, p) && clan.miembros.length > 1) {
    return this.msg(p, 'Sos el líder: antes de salir pasale el liderazgo a otro integrante, o disolvé el clan.', 'warn');
  }
  if (this.esLider(clan, p)) return this.disolverClan(p, clan);
  clan.miembros = clan.miembros.filter((m) => clave(m) !== clave(p.name));
  this.guardarClanes();
  p.guild = '';
  this.refrescarMiembro(p);
  this.msg(p, `Saliste del clan ${clan.nombre}.`, 'info');
  this.avisarClan(clan, `${p.name} salió del clan.`);
  this.enviarClanes(p);
};

K.cambiarCapa = function (p, clan, capa) {
  clan.capa = this.capaValida(capa);
  this.guardarClanes();
  for (const m of clan.miembros) { const o = this.findPlayer(m); if (o) this.refrescarMiembro(o); }
  this.avisarClan(clan, `${p.name} cambió el diseño de la capa del clan.`);
  this.enviarClanes(p);
};

K.pasarLiderazgo = function (p, clan, nombre) {
  const nuevo = clan.miembros.find((m) => clave(m) === clave(nombre));
  if (!nuevo || clave(nuevo) === clave(p.name)) return;
  clan.lider = nuevo;
  this.guardarClanes();
  this.refrescarMiembro(p);
  const o = this.findPlayer(nuevo);
  if (o) this.refrescarMiembro(o);
  this.avisarClan(clan, `${nuevo} es el nuevo líder del clan.`);
  this.enviarClanes(p);
};

K.disolverClan = function (p, clan) {
  for (const m of clan.miembros) this.ponerClan(m, '');
  delete this.clanes[clave(clan.nombre)];
  this.guardarClanes();
  this.toAll({ t: 'msg', text: `El clan ${clan.nombre} fue disuelto.`, color: 'server' });
  this.enviarClanes(p);
};

// Ponerse o sacarse la capa (queda guardado en el personaje)
K.alternarCapa = function (p) {
  if (!this.clanDe(p) && !(p.gm > 0)) return this.msg(p, 'No tenés capa: se consigue al entrar a un clan.', 'warn');
  p.capaOculta = !p.capaOculta;
  this.refrescarMiembro(p);
  this.send(p, { t: 'capaEstado', on: p.capaOculta ? 0 : 1 });
  this.msg(p, p.capaOculta ? 'Te sacaste la capa. Para volver a ponértela: OPCIONES → Capa, o /CAPA.' : 'Te pusiste la capa.', 'info');
};

// /CL mensaje
K.chatClan = function (p, texto) {
  const clan = this.clanDe(p);
  if (!clan) return this.msg(p, 'No pertenecés a ningún clan.', 'warn');
  if (!texto) return;
  this.avisarClan(clan, `${p.name}: ${texto}`);
  this.chatLog(`[clan ${clan.nombre}] ${p.name}: ${texto}`);
};

module.exports = Object.assign(K, { COSTO_FUNDAR, MAX_MIEMBROS, EMBLEMAS });
