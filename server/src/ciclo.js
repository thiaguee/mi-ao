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

// El día dura minutosDia (de 5 a 20.5 hs del juego) y la noche minutosNoche (de 20.5 a 5 hs)
Z.cfgCiclo = function () {
  const c = Object.assign({ minutosDia: 180, minutosNoche: 30, danioNoche: 1.25, premioNoche: 1.5, lluviaCadaMin: 40 }, this.config.ciclo || {});
  delete c.minutosPorDia;
  return c;
};
// minuto dentro del ciclo (0..total) <-> hora del juego (0..24)
const horaDeMinuto = (m, c) => (m < c.minutosDia ? 5 + m / c.minutosDia * 15.5 : 20.5 + (m - c.minutosDia) / c.minutosNoche * 8.5) % 24;
const minutoDeHora = (h, c) => { const d = ((h - 5) % 24 + 24) % 24; return d < 15.5 ? d / 15.5 * c.minutosDia : c.minutosDia + (d - 15.5) / 8.5 * c.minutosNoche; };

// hora del juego (0 a 24)
Z.horaJuego = function (t = Date.now()) {
  const c = this.cfgCiclo(), total = c.minutosDia + c.minutosNoche;
  const min = t / 60000 + (this.corrimientoHora || 0);
  return horaDeMinuto(((min % total) + total) % total, c);
};

// /HORA n (GM): pone el reloj del juego en esa hora
Z.ponerHora = function (p, h) {
  h = +h;
  if (!(h >= 0 && h < 24)) return this.msg(p, `Son las ${this.horaJuego().toFixed(1)} hs del juego. Uso: /HORA 0 a 23 (ej. /HORA 22 para ver la noche).`, 'gm');
  const c = this.cfgCiclo();
  this.corrimientoHora = (this.corrimientoHora || 0) + minutoDeHora(h, c) - minutoDeHora(this.horaJuego(), c);
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
  const c = this.cfgCiclo();
  const msg = { t: 'hora', h: this.horaJuego(), dia: c.minutosDia, noche: c.minutosNoche };
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
  console.log(`Día y noche: día ${this.cfgCiclo().minutosDia} min, noche ${this.cfgCiclo().minutosNoche} min (ahora son las ${this.horaJuego().toFixed(1)} hs del juego, ${this.faseActual})`);
};

module.exports = Z;
