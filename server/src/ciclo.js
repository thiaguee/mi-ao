'use strict';
// Día y noche + clima. Un día del juego dura config.ciclo.minutosPorDia minutos reales (60 por defecto).
// De noche los bichos pegan más fuerte y dan más experiencia y oro. Llueve de vez en cuando.
const Z = {};
const FASES = [ // [desde la hora, nombre, mensaje]
  [5, 'amanecer', '🌅 Amanece en las tierras de Norway.'],
  [7, 'dia', '☀️ Ya es de día.'],
  [18.5, 'atardecer', '🌇 Atardece...'],
  [20.5, 'noche', '🌙 Cae la noche: los bichos son más fuertes, pero dan más experiencia y oro.'],
];

Z.cfgCiclo = function () { return Object.assign({ minutosPorDia: 60, danioNoche: 1.25, premioNoche: 1.5, lluviaCadaMin: 40 }, this.config.ciclo || {}); };

// hora del juego (0 a 24)
Z.horaJuego = function (t = Date.now()) {
  const mpd = this.cfgCiclo().minutosPorDia;
  const min = t / 60000 + (this.corrimientoHora || 0);
  return (((min % mpd) + mpd) % mpd) / mpd * 24;
};

// /HORA n (GM): pone el reloj del juego en esa hora
Z.ponerHora = function (p, h) {
  h = +h;
  if (!(h >= 0 && h < 24)) return this.msg(p, `Son las ${this.horaJuego().toFixed(1)} hs del juego. Uso: /HORA 0 a 23 (ej. /HORA 22 para ver la noche).`, 'gm');
  const mpd = this.cfgCiclo().minutosPorDia;
  this.corrimientoHora = (this.corrimientoHora || 0) + (h - this.horaJuego()) / 24 * mpd;
  this.enviarHora();
  this.msg(p, `Ahora son las ${h} hs del juego.`, 'gm');
};
Z.faseDe = function (h) {
  let f = FASES[FASES.length - 1];
  for (const x of FASES) if (h >= x[0]) f = x;
  return f;
};
Z.esDeNoche = function () { return this.faseDe(this.horaJuego())[1] === 'noche'; };

Z.enviarHora = function (p) {
  const msg = { t: 'hora', h: this.horaJuego(), mpd: this.cfgCiclo().minutosPorDia };
  if (p) this.send(p, msg); else this.toAll(msg);
};

Z.iniciarCiclo = function () {
  this.faseActual = this.faseDe(this.horaJuego())[1];
  this.finLluvia = 0;
  setInterval(() => {
    const f = this.faseDe(this.horaJuego());
    if (f[1] !== this.faseActual) {
      this.faseActual = f[1];
      this.toAll({ t: 'msg', text: f[2], color: 'server' });
      this.enviarHora();
    }
    // clima: lluvia de vez en cuando (unos minutos)
    const c = this.cfgCiclo(), now = Date.now();
    if (this.raining && this.finLluvia && now > this.finLluvia) { this.raining = false; this.finLluvia = 0; this.toAll({ t: 'rain', on: 0 }); }
    else if (!this.raining && c.lluviaCadaMin > 0 && Math.random() < 10 / (c.lluviaCadaMin * 60)) {
      this.raining = true; this.finLluvia = now + (4 + Math.random() * 5) * 60000; this.toAll({ t: 'rain', on: 1 });
    }
  }, 10000);
  setInterval(() => this.enviarHora(), 60000);
  console.log(`Día y noche: un día dura ${this.cfgCiclo().minutosPorDia} min (ahora son las ${this.horaJuego().toFixed(1)} hs del juego, ${this.faseActual})`);
};

module.exports = Z;
