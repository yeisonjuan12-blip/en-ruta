/* ============================================================
   EN RUTA — Lógica de negocio
   ============================================================ */
(function () {
  'use strict';
  const ER = window.ER;
  if (!ER) return;

  /* ------------------------------ Motorizados ------------------------------ */
  ER.getMotorizado = function (id) {
    return ER.S.motorizados.find((m) => m.id === id) || null;
  };
  ER.nombreMotorizado = function (id, fallback) {
    const m = ER.getMotorizado(id);
    return m ? m.nombre : (fallback || 'Motorizado eliminado');
  };
  ER.motorizadosActivos = function () {
    return ER.S.motorizados.filter((m) => m.activo !== false);
  };
  ER.ordenarMotorizados = function (list) {
    return list.slice().sort((a, b) => {
      if ((a.activo !== false) !== (b.activo !== false)) return a.activo === false ? 1 : -1;
      const ta = a.turno === 'noche' ? 1 : 0, tb = b.turno === 'noche' ? 1 : 0;
      if (ta !== tb) return ta - tb;
      return String(a.nombre).localeCompare(String(b.nombre), 'es');
    });
  };
  ER.fechaIngresoDe = (m) => m.fechaIngreso || '2000-01-01';

  /* ------------------------------ Pedidos y comisión ------------------------------ */
  ER.parsePedidos = function (text) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return { ok: false, empty: true, tokens: [], total: 0, bad: '' };
    const parts = raw.split(/[+;,]+|\n/).map((s) => s.trim()).filter((s) => s !== '');
    const tokens = [];
    let total = 0;
    for (const p of parts) {
      const n = Number(String(p).replace(',', '.'));
      if (!isFinite(n) || n < 0) return { ok: false, tokens: [], total: 0, bad: p };
      tokens.push(n);
      total += n;
    }
    return { ok: tokens.length > 0, tokens, total: ER.round2(total), bad: '' };
  };

  ER.comisionDe = function (total, pct) {
    return ER.round2((Number(total) || 0) * (Number(pct) || 0) / 100);
  };

  ER.calcularRuta = function (pedidos, pct) {
    const p = ER.parsePedidos(pedidos);
    return {
      ok: p.ok,
      total: p.total,
      comision: p.ok ? ER.comisionDe(p.total, pct) : 0,
      tokens: p.tokens,
      bad: p.bad,
      empty: p.empty
    };
  };

  /* ------------------------------ Horarios ------------------------------ */
  ER.worksOn = function (m, iso) {
    if (!m || m.activo === false) return false;
    if (!iso) return false;
    if (iso < ER.fechaIngresoDe(m)) return false;
    const wd = ER.weekday(iso);
    if (Number(m.diaLibre) === wd) return false;
    const dias = Array.isArray(m.dias) ? m.dias.map(Number) : [];
    return dias.includes(wd);
  };

  ER.baseEnd = function (m) {
    const cfg = ER.S.config;
    const start = m.horaEntrada || (m.turno === 'noche' ? cfg.horaCambioTurno : cfg.jornadaInicio || '09:00');
    let end = m.turno === 'noche' ? (cfg.jornadaFin || '24:00') : (cfg.horaCambioTurno || '19:00');
    if (ER.timeToMin(end) <= ER.timeToMin(start)) end = cfg.jornadaFin || '24:00';
    return end;
  };

  ER.getOverride = function (mid, iso) {
    return ER.S.horarios.find((h) => h.motorizadoId === mid && h.fecha === iso) || null;
  };

  ER.scheduleOf = function (m, iso) {
    if (!m) return null;
    const ov = ER.getOverride(m.id, iso);
    if (ov && ov.libre === true) return null;
    if (ov) return { inicio: ov.inicio, fin: ov.fin, override: true, nota: ov.nota || '' };
    if (!ER.worksOn(m, iso)) return null;
    return {
      inicio: m.horaEntrada || (m.turno === 'noche' ? ER.S.config.horaCambioTurno : ER.S.config.jornadaInicio) || '09:00',
      fin: ER.baseEnd(m),
      override: false,
      nota: ''
    };
  };

  ER.scheduleText = function (m, iso) {
    const s = ER.scheduleOf(m, iso);
    if (!s) return '';
    return `${ER.timeLabel(s.inicio)} – ${ER.timeLabel(s.fin)}`;
  };

  ER.weekDates = function (startISO) {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(ER.addDays(startISO, i));
    return out;
  };

  ER.expectedOn = function (iso) {
    return ER.ordenarMotorizados(ER.motorizadosActivos().filter((m) => !!ER.scheduleOf(m, iso)));
  };

  /* ------------------------------ Rutas ------------------------------ */
  ER.rutasEntre = function (from, to, mid) {
    return ER.S.rutas.filter((r) => {
      if (mid && r.motorizadoId !== mid) return false;
      return (!from || r.fecha >= from) && (!to || r.fecha <= to);
    });
  };
  ER.rutasDe = function (mid, from, to) { return ER.rutasEntre(from, to, mid); };
  ER.rutaEn = function (mid, fecha) {
    return ER.S.rutas.find((r) => r.motorizadoId === mid && r.fecha === fecha) || null;
  };
  ER.sinPedidosEn = function (mid, fecha) {
    return ER.S.noPedidos.some((n) => n.motorizadoId === mid && n.fecha === fecha);
  };
  ER.registroEn = function (mid, fecha) {
    return ER.rutaEn(mid, fecha) || ER.sinPedidosEn(mid, fecha);
  };
  ER.ultimaRuta = function (mid) {
    const rs = ER.S.rutas.filter((r) => r.motorizadoId === mid);
    if (!rs.length) return null;
    return rs.reduce((a, r) => (r.fecha > a ? r.fecha : a), rs[0].fecha);
  };
  ER.routeName = function (r) {
    return r.motorizadoNombre || ER.nombreMotorizado(r.motorizadoId);
  };

  ER.balanceRuta = function (r) {
    if (!r) return 0;
    if (r.pagado) return 0;
    return Math.max(0, ER.round2((Number(r.comision) || 0) - (Number(r.abono) || 0)));
  };
  ER.abonadoRuta = function (r) {
    return Math.min(Number(r.comision) || 0, Number(r.abono) || 0);
  };
  ER.totalRuta = function (r) { return Number(r.total) || 0; };
  ER.comisionRuta = function (r) { return Number(r.comision) || 0; };

  /* ------------------------------ Pendientes ------------------------------ */
  ER.pendingDaily = function () {
    const fecha = ER.addDays(ER.today(), -1);
    return ER.ordenarMotorizados(ER.motorizadosActivos().filter((m) => (
      m.tipo === 'ruta' && ER.worksOn(m, fecha) && !ER.registroEn(m.id, fecha)
    ))).map((m) => ({ motorizado: m, fecha }));
  };

  ER.pendingOlder = function () {
    const hoy = ER.today();
    const out = [];
    for (let i = 2; i <= 7; i++) {
      const fecha = ER.addDays(hoy, -i);
      ER.motorizadosActivos().forEach((m) => {
        if (m.tipo === 'ruta' && ER.worksOn(m, fecha) && !ER.registroEn(m.id, fecha)) {
          out.push({ motorizado: m, fecha });
        }
      });
    }
    return out;
  };

  ER.pendingWeekly = function () {
    const hoy = ER.today();
    const inicio = ER.startOfWeek(hoy);
    const fin = ER.endOfWeek(hoy);
    return ER.ordenarMotorizados(ER.motorizadosActivos().filter((m) => {
      if (m.tipo !== 'parcial') return false;
      let programado = false;
      for (let d = inicio; d <= fin; d = ER.addDays(d, 1)) {
        if (d > hoy) break;
        if (ER.worksOn(m, d)) { programado = true; break; }
      }
      if (!programado) return false;
      const tieneRuta = ER.S.rutas.some((r) => r.motorizadoId === m.id && r.fecha >= inicio && r.fecha <= fin);
      const tieneSin = ER.S.noPedidos.some((n) => n.motorizadoId === m.id && n.fecha >= inicio && n.fecha <= fin);
      return !tieneRuta && !tieneSin;
    })).map((m) => ({ motorizado: m, from: inicio, to: fin }));
  };

  ER.totalPendientes = function () {
    return ER.pendingDaily().length + ER.pendingWeekly().length;
  };

  /* ------------------------------ Deudas ------------------------------ */
  ER.deudaDe = function (mid) {
    const rutas = ER.S.rutas.filter((r) => r.motorizadoId === mid && ER.balanceRuta(r) > 0.009);
    const saldo = ER.round2(rutas.reduce((a, r) => a + ER.balanceRuta(r), 0));
    let dias = 0;
    if (rutas.length) {
      const masVieja = rutas.reduce((a, r) => (r.fecha < a ? r.fecha : a), rutas[0].fecha);
      dias = Math.max(0, ER.daysBetween(masVieja, ER.today()));
    }
    return { saldo, rutas, dias, cantidad: rutas.length };
  };

  ER.deudas = function () {
    return ER.S.motorizados.map((m) => ({ motorizado: m, ...ER.deudaDe(m.id) }))
      .filter((d) => d.saldo > 0.009)
      .sort((a, b) => b.dias - a.dias || b.saldo - a.saldo);
  };

  ER.totalDeuda = function () {
    return ER.round2(ER.deudas().reduce((a, d) => a + d.saldo, 0));
  };

  ER.abonadoDe = function (mid) {
    return ER.round2(ER.S.pagos.filter((p) => p.motorizadoId === mid).reduce((a, p) => a + (Number(p.monto) || 0), 0));
  };

  ER.inactivos = function () {
    const cfg = ER.S.config;
    const limite = Math.max(2, Number(cfg.diasSinRuta) || 4);
    const desde = ER.addDays(ER.today(), -limite);
    const out = [];
    ER.motorizadosActivos().forEach((m) => {
      let programados = 0;
      for (let d = desde; d <= ER.today(); d = ER.addDays(d, 1)) {
        if (ER.worksOn(m, d)) programados++;
      }
      if (!programados) return;
      const ultima = ER.ultimaRuta(m.id) || ER.fechaIngresoDe(m);
      if (ultima < desde) out.push({ motorizado: m, ultima, dias: ER.daysBetween(ultima, ER.today()), programados });
    });
    return out.sort((a, b) => b.dias - a.dias);
  };

  /* ------------------------------ Asistencia ------------------------------ */
  ER.asistenciaEn = function (mid, fecha) {
    return ER.S.asistencias.find((a) => a.motorizadoId === mid && a.fecha === fecha) || null;
  };

  ER.estadoAsistencia = function (m, fecha, reg) {
    if (reg) return reg.estado;
    if (!ER.scheduleOf(m, fecha)) return 'libre';
    if (fecha < ER.today()) return 'falta';
    if (fecha > ER.today()) return 'programado';
    return 'pendiente';
  };

  ER.calcularEstadoAsistencia = function (programada, llegada) {
    if (!llegada) return 'falta';
    const tol = Number(ER.S.config.toleranciaMin) || 0;
    const diff = ER.timeToMin(llegada) - ER.timeToMin(programada);
    return diff > tol ? 'tarde' : 'asistio';
  };

  ER.minutosTarde = function (programada, llegada) {
    return Math.max(0, ER.timeToMin(llegada) - ER.timeToMin(programada));
  };

  // Hora oficial de ingreso de un motorizado para una fecha.
  // Usa el horario del día (incluye cambios puntuales) o, si no tiene
  // horario, la hora de entrada de su ficha.
  ER.horaProgramadaDe = function (m, fecha) {
    if (!m) return ER.S.config.jornadaInicio || '09:00';
    const sch = ER.scheduleOf(m, fecha);
    if (sch) return sch.inicio;
    return m.horaEntrada || (m.turno === 'noche'
      ? (ER.S.config.horaCambioTurno || '19:00')
      : (ER.S.config.jornadaInicio || '09:00'));
  };

  // Puntualidad de una ruta según su hora de llegada.
  // Devuelve 'asistio', 'tarde' o null si la ruta no tiene hora.
  ER.estadoPuntualidadRuta = function (r) {
    if (!r || !r.horaLlegada) return null;
    const m = ER.getMotorizado(r.motorizadoId);
    if (!m) return null;
    return ER.calcularEstadoAsistencia(ER.horaProgramadaDe(m, r.fecha), r.horaLlegada);
  };

  ER.minutosTardeRuta = function (r) {
    if (!r || !r.horaLlegada) return 0;
    const m = ER.getMotorizado(r.motorizadoId);
    if (!m) return 0;
    return ER.minutosTarde(ER.horaProgramadaDe(m, r.fecha), r.horaLlegada);
  };

  ER.actualizarAsistenciaDesdeRuta = function (mid, fecha, hora) {
    const m = ER.getMotorizado(mid);
    if (!m || !fecha) return null;
    // Sin hora de llegada no se toca la asistencia: puede haber sido
    // registrada manualmente desde el módulo de Asistencia.
    if (!hora) return null;

    const programada = ER.horaProgramadaDe(m, fecha);
    const estado = ER.calcularEstadoAsistencia(programada, hora);

    let reg = ER.S.asistencias.find((a) => a.motorizadoId === mid && a.fecha === fecha);
    if (reg) {
      reg.horaProgramada = programada;
      reg.horaLlegada = hora;
      reg.estado = estado;
    } else {
      reg = {
        id: ER.uid(),
        motorizadoId: mid,
        fecha: fecha,
        horaProgramada: programada,
        horaLlegada: hora,
        estado: estado,
        nota: '',
        createdAt: new Date().toISOString()
      };
      ER.S.asistencias.push(reg);
    }
    return reg;
  };

  ER.resumenAsistencia = function (m, from, to) {
    const out = { programados: 0, asistio: 0, tarde: 0, falta: 0, pendiente: 0, minutosTarde: 0, detalle: [] };
    const hoy = ER.today();
    const fin = to > hoy ? hoy : to;
    for (let d = from; d <= fin; d = ER.addDays(d, 1)) {
      const sch = ER.scheduleOf(m, d);
      if (!sch) continue;
      const reg = ER.asistenciaEn(m.id, d);
      if (!reg && d === hoy) continue; // el día de hoy aún no se evalúa
      out.programados++;
      const est = ER.estadoAsistencia(m, d, reg);
      if (est === 'asistio') out.asistio++;
      else if (est === 'tarde') {
        out.tarde++;
        if (reg && reg.horaLlegada) out.minutosTarde += ER.minutosTarde(sch.inicio, reg.horaLlegada);
      } else if (est === 'falta') out.falta++;
      else if (est === 'pendiente') out.pendiente++;
      out.detalle.push({ fecha: d, estado: est, reg, schedule: sch });
    }
    const base = out.programados || 1;
    out.pctAsistencia = Math.round(((out.asistio + out.tarde) / base) * 100);
    out.pctPuntual = Math.round((out.asistio / base) * 100);
    out.pctTarde = Math.round((out.tarde / base) * 100);
    out.pctFalta = Math.round((out.falta / base) * 100);
    return out;
  };

  ER.resumenAsistenciaTodos = function (from, to) {
    return ER.ordenarMotorizados(ER.S.motorizados).map((m) => ({
      motorizado: m, ...ER.resumenAsistencia(m, from, to)
    }));
  };

  ER.quienTrabajaHoy = function (fecha) {
    const f = fecha || ER.today();
    return ER.expectedOn(f).map((m) => {
      const sch = ER.scheduleOf(m, f);
      const reg = ER.asistenciaEn(m.id, f);
      return { motorizado: m, schedule: sch, registro: reg, estado: ER.estadoAsistencia(m, f, reg) };
    });
  };

  /* ------------------------------ Fechas de demanda ------------------------------ */
  ER.easter = function (year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  function nthSunday(year, month, n) {
    const d = new Date(year, month - 1, 1);
    const first = d.getDay();
    const day = 1 + ((7 - first) % 7) + (n - 1) * 7;
    return new Date(year, month - 1, day);
  }

  ER.demandDates = function (year) {
    const list = [];
    const push = (date, nombre, tipo, nota) => {
      const iso = typeof date === 'string' ? date : ER.iso(date);
      list.push({ id: 'base-' + iso + '-' + nombre.replace(/\s+/g, '-'), fecha: iso, nombre, tipo: tipo || 'nacional', nota: nota || '', custom: false });
    };
    push(`${year}-01-01`, 'Año Nuevo', 'nacional', 'Inicio del año.');
    push(`${year}-02-14`, 'San Valentín', 'comercial', 'Alta demanda de cenas y regalos.');
    push(`${year}-03-08`, 'Día de la Mujer', 'comercial', 'Promociones y pedidos por delivery.');
    const easter = ER.easter(year);
    const jueves = new Date(easter); jueves.setDate(easter.getDate() - 3);
    const viernes = new Date(easter); viernes.setDate(easter.getDate() - 2);
    push(jueves, 'Jueves Santo', 'nacional', 'Semana Santa: consumo de pescado y mariscos.');
    push(viernes, 'Viernes Santo', 'nacional', 'Semana Santa: día de alta demanda.');
    push(easter, 'Domingo de Resurrección', 'nacional', 'Cierre de Semana Santa.');
    push(`${year}-05-01`, 'Día del Trabajo', 'nacional', 'Feriado nacional.');
    push(nthSunday(year, 5, 2), 'Día de la Madre', 'comercial', 'Uno de los días de mayor demanda del año.');
    push(nthSunday(year, 6, 3), 'Día del Padre', 'comercial', 'Alta demanda de almuerzos y cenas.');
    push(nthSunday(year, 7, 3), 'Día del Pollo a la Brasa', 'comercial', 'Se pide muchísimo pollo en la zona. Avisar a marketing.');
    push(`${year}-07-28`, 'Fiestas Patrias', 'nacional', 'Feriado nacional.');
    push(`${year}-07-29`, 'Fiestas Patrias', 'nacional', 'Feriado nacional.');
    push(`${year}-08-30`, 'Santa Rosa de Lima', 'nacional', 'Feriado nacional.');
    push(`${year}-10-31`, 'Día de la Canción Criolla', 'comercial', 'Reuniones y pedidos por delivery.');
    push(`${year}-10-31`, 'Halloween', 'comercial', 'Alta demanda nocturna.');
    push(`${year}-12-25`, 'Navidad', 'nacional', 'Cena navideña y pedidos anticipados.');
    ER.S.config.demandaCustom.filter((c) => String(c.fecha).slice(0, 4) === String(year)).forEach((c) => {
      list.push({ id: c.id, fecha: c.fecha, nombre: c.nombre, tipo: 'propia', nota: c.nota || '', custom: true });
    });
    return list.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre));
  };

  ER.demandOn = function (iso) {
    return ER.demandDates(Number(String(iso).slice(0, 4))).filter((d) => d.fecha === iso);
  };

  ER.upcomingDemand = function (days) {
    const cfg = ER.S.config;
    const n = days == null ? (Number(cfg.diasAvisoDemanda) || 20) : days;
    const hoy = ER.today();
    const fin = ER.addDays(hoy, n);
    const y = Number(hoy.slice(0, 4));
    const all = [...ER.demandDates(y), ...ER.demandDates(y + 1)];
    return all.filter((d) => d.fecha >= hoy && d.fecha <= fin)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  };

  ER.nextDemand = function () {
    return ER.upcomingDemand(ER.S.config.diasAvisoDemanda || 20)[0] || null;
  };

  /* ------------------------------ Estadísticas ------------------------------ */
  ER.statsRange = function (from, to, mid) {
    const rutas = ER.rutasEntre(from, to, mid);
    const total = ER.round2(rutas.reduce((a, r) => a + ER.totalRuta(r), 0));
    const comision = ER.round2(rutas.reduce((a, r) => a + ER.comisionRuta(r), 0));
    const unicos = new Set(rutas.map((r) => r.motorizadoId)).size;
    return {
      rutas, count: rutas.length, total, comision, unicos,
      promedio: rutas.length ? ER.round2(total / rutas.length) : 0,
      ticket: rutas.length ? ER.round2(comision / rutas.length) : 0
    };
  };

  ER.seriesRango = function (from, to) {
    const dias = ER.daysBetween(from, to) + 1;
    if (dias <= 62) {
      const out = [];
      for (let d = from; d <= to; d = ER.addDays(d, 1)) {
        const st = ER.statsRange(d, d);
        out.push({ key: d, label: ER.fmtDate(d, 'short'), full: d, total: st.total, comision: st.comision, count: st.count });
      }
      return { puntos: out, tipo: 'dia' };
    }
    const out = [];
    let cur = ER.startOfMonth(from);
    const last = ER.endOfMonth(to);
    while (cur <= last) {
      const f = cur < from ? from : cur;
      const t = ER.endOfMonth(cur) > to ? to : ER.endOfMonth(cur);
      const st = ER.statsRange(f, t);
      out.push({ key: cur.slice(0, 7), label: ER.fmtDate(cur, 'month'), full: cur, total: st.total, comision: st.comision, count: st.count });
      cur = ER.addMonths(cur, 1);
    }
    return { puntos: out, tipo: 'mes' };
  };

  ER.topMotorizados = function (from, to, limit) {
    const map = new Map();
    ER.rutasEntre(from, to).forEach((r) => {
      const k = r.motorizadoId;
      const cur = map.get(k) || { id: k, nombre: r.motorizadoNombre || ER.nombreMotorizado(k), total: 0, comision: 0, rutas: 0 };
      cur.total = ER.round2(cur.total + ER.totalRuta(r));
      cur.comision = ER.round2(cur.comision + ER.comisionRuta(r));
      cur.rutas++;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, limit || 5);
  };

  ER.resumenZonas = function (from, to) {
    const map = new Map();
    ER.rutasEntre(from, to).forEach((r) => {
      const z = r.zona || 'Sin zona';
      const cur = map.get(z) || { zona: z, total: 0, comision: 0, rutas: 0 };
      cur.total = ER.round2(cur.total + ER.totalRuta(r));
      cur.comision = ER.round2(cur.comision + ER.comisionRuta(r));
      cur.rutas++;
      map.set(z, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  };

  ER.comparativo = function () {
    const hoy = ER.today();
    const wStart = ER.startOfWeek(hoy), wPrevStart = ER.addDays(wStart, -7);
    const wPrevEnd = ER.addDays(wStart, -1);
    const mStart = ER.startOfMonth(hoy), mPrevStart = ER.addMonths(mStart, -1);
    const mPrevEnd = ER.addDays(mStart, -1);
    const wCur = ER.statsRange(wStart, ER.endOfWeek(hoy));
    const wPrev = ER.statsRange(wPrevStart, wPrevEnd);
    // Compara contra el mismo tramo del periodo anterior para ser justo
    const diaSemana = ER.daysBetween(wStart, hoy) + 1;
    const mCur = ER.statsRange(mStart, hoy);
    const mPrevParcial = ER.statsRange(mPrevStart, ER.addDays(mPrevStart, ER.daysBetween(mStart, hoy)));
    const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : (a > 0 ? 100 : 0));
    return {
      semana: { actual: wCur.comision, anterior: wPrev.comision, pct: pct(wCur.comision, wPrev.comision) },
      mes: { actual: mCur.comision, anterior: mPrevParcial.comision, pct: pct(mCur.comision, mPrevParcial.comision) },
      diaSemana
    };
  };

  ER.proyeccionMes = function () {
    const hoy = ER.today();
    const ini = ER.startOfMonth(hoy);
    const fin = ER.endOfMonth(hoy);
    const st = ER.statsRange(ini, hoy);
    const dia = Number(hoy.slice(8, 10));
    const totalDias = ER.daysInMonth(hoy);
    const promedio = dia > 0 ? st.comision / dia : 0;
    return {
      comision: st.comision,
      total: st.total,
      dia, totalDias,
      proyectado: ER.round2(promedio * totalDias),
      faltan: ER.round2(Math.max(0, promedio * totalDias - st.comision))
    };
  };

  ER.metasSemana = function () {
    const ini = ER.startOfWeek(ER.today());
    const fin = ER.endOfWeek(ER.today());
    return ER.ordenarMotorizados(ER.motorizadosActivos()).map((m) => {
      const st = ER.statsRange(ini, fin, m.id);
      const meta = Number(m.metaSemanal) || 0;
      return {
        motorizado: m,
        meta,
        avance: st.comision,
        totalGenerado: st.total,
        rutas: st.count,
        pct: meta > 0 ? Math.min(100, Math.round((st.comision / meta) * 100)) : 0,
        premio: m.premio || ER.S.config.premioDefault || ''
      };
    }).filter((x) => x.meta > 0 || x.avance > 0);
  };

  /* ------------------------------ Mensajes ------------------------------ */
  ER.fmtDateSmart = function (iso) {
    const y = ER.today().slice(0, 4);
    return String(iso).slice(0, 4) === y ? ER.fmtDate(iso) : ER.fmtDate(iso);
  };

  ER.rangoTexto = function (from, to) {
    if (!to || from === to) return ER.fmtDateSmart(from);
    const txt = ER.fmtRange(from, to);
    return 'Del ' + txt.replace(/^del\s+/i, '');
  };

  ER.detalleLineas = function (rutas) {
    return rutas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => {
      const pedidos = r.pedidos ? ` · ${r.pedidos}` : '';
      return `• ${ER.fmtDate(r.fecha, 'medium')} · ${ER.money(r.total)} · comisión ${ER.money(r.comision)}${pedidos}`;
    }).join('\n');
  };

  ER.msgCobro = function (m, rutas, opts) {
    opts = opts || {};
    const cfg = ER.S.config;
    const total = ER.round2(rutas.reduce((a, r) => a + ER.totalRuta(r), 0));
    const comision = ER.round2(rutas.reduce((a, r) => a + ER.comisionRuta(r), 0));
    let pct = opts.pct;
    if (pct == null) {
      const pcts = Array.from(new Set(rutas.map((r) => Number(r.pct))));
      pct = pcts.length === 1 ? pcts[0] : (m && m.comision) || cfg.comisionDefault;
    }
    const from = rutas.reduce((a, r) => (!a || r.fecha < a ? r.fecha : a), '');
    const to = rutas.reduce((a, r) => (!a || r.fecha > a ? r.fecha : a), '');
    const tpl = (opts.plantilla || cfg.plantillas.cobro || '');
    return ER.renderTemplate(tpl, {
      nombre: m ? m.nombre : (rutas[0] && ER.routeName(rutas[0])) || '',
      fecha: ER.rangoTexto(from, to),
      rango: ER.rangoTexto(from, to),
      total: ER.money(total),
      pct: Number(pct) % 1 === 0 ? String(Number(pct)) : String(pct),
      comision: ER.money(comision),
      plin: cfg.plin,
      negocio: cfg.negocio,
      detalle: ER.detalleLineas(rutas)
    });
  };

  ER.msgCuenta = function (m) {
    const cfg = ER.S.config;
    const deuda = ER.deudaDe(m.id);
    const rutas = deuda.rutas;
    const total = ER.round2(rutas.reduce((a, r) => a + ER.comisionRuta(r), 0));
    const abonado = ER.round2(rutas.reduce((a, r) => a + ER.abonadoRuta(r), 0));
    const lineas = rutas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => {
      const ab = ER.abonadoRuta(r) > 0 ? ` · abonado ${ER.money(ER.abonadoRuta(r))}` : '';
      return `• ${ER.fmtDate(r.fecha, 'medium')} · ${ER.money(r.comision)}${ab}`;
    }).join('\n');
    return ER.renderTemplate(cfg.plantillas.cuenta, {
      nombre: m.nombre,
      fecha: ER.fmtDate(ER.today()),
      detalle: lineas || 'Sin saldos pendientes.',
      total: ER.money(total),
      abonado: ER.money(abonado),
      saldo: ER.money(deuda.saldo),
      plin: cfg.plin,
      negocio: cfg.negocio,
      dias: deuda.dias
    });
  };

  ER.msgCierre = function (fecha) {
    const cfg = ER.S.config;
    const rutas = ER.rutasEntre(fecha, fecha);
    const porM = new Map();
    rutas.forEach((r) => {
      const k = r.motorizadoId;
      const cur = porM.get(k) || { nombre: ER.routeName(r), total: 0, comision: 0 };
      cur.total = ER.round2(cur.total + ER.totalRuta(r));
      cur.comision = ER.round2(cur.comision + ER.comisionRuta(r));
      porM.set(k, cur);
    });
    const detalle = Array.from(porM.values())
      .sort((a, b) => b.total - a.total)
      .map((x) => `*${x.nombre}*: ${ER.money(x.total)} → ${ER.money(x.comision)}`)
      .join('\n');
    const total = ER.round2(rutas.reduce((a, r) => a + ER.totalRuta(r), 0));
    const comision = ER.round2(rutas.reduce((a, r) => a + ER.comisionRuta(r), 0));
    return {
      texto: ER.renderTemplate(cfg.plantillas.cierre, {
        fecha: ER.fmtDate(fecha, 'weekdayLong'),
        detalle: detalle || 'Sin rutas registradas.',
        total: ER.money(total),
        comision: ER.money(comision),
        cantidad: String(porM.size),
        rutas: String(rutas.length),
        plin: cfg.plin,
        negocio: cfg.negocio
      }),
      total, comision, cantidad: porM.size, rutas: rutas.length
    };
  };

  ER.msgReporte = function (periodo, from, to) {
    const cfg = ER.S.config;
    const st = ER.statsRange(from, to);
    const top = ER.topMotorizados(from, to, 5);
    const detalle = [
      `Periodo: ${ER.fmtRange(from, to)}`,
      `Rutas: ${st.count}`,
      `Motorizados: ${st.unicos}`,
      '',
      '*Top motorizados*',
      ...top.map((t, i) => `${i + 1}. ${t.nombre}: ${ER.money(t.total)} (${ER.money(t.comision)})`)
    ].join('\n');
    return ER.renderTemplate(cfg.plantillas.reporte, {
      periodo: periodo || ER.fmtRange(from, to),
      detalle,
      total: ER.money(st.total),
      comision: ER.money(st.comision),
      rutas: String(st.count),
      plin: cfg.plin,
      negocio: cfg.negocio
    });
  };

  /* ------------------------------ Exportaciones ------------------------------ */
  ER.csvEscape = function (v) {
    const s = String(v == null ? '' : v);
    if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  ER.csvLine = function (arr) { return arr.map(ER.csvEscape).join(';'); };

  ER.csvRutas = function (rutas) {
    const head = ['Fecha', 'Motorizado', 'Turno', 'Zona', 'Pedidos', 'Total', 'Comisión', 'Pagado', 'Abonado', 'Saldo', 'Nota'];
    const lines = [ER.csvLine(head)];
    rutas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((r) => {
      lines.push(ER.csvLine([
        r.fecha, ER.routeName(r), r.turno || '', r.zona || '', r.pedidos || '',
        ER.totalRuta(r).toFixed(2), ER.comisionRuta(r).toFixed(2),
        r.pagado ? 'Sí' : 'No', ER.abonadoRuta(r).toFixed(2), ER.balanceRuta(r).toFixed(2), r.nota || ''
      ]));
    });
    return '\uFEFF' + lines.join('\r\n');
  };

  ER.exportarRutasCSV = function (rutas, nombre) {
    if (!rutas.length) { ER.toast('No hay rutas para exportar', 'err'); return; }
    ER.download(nombre || ('en-ruta-rutas-' + ER.today() + '.csv'), ER.csvRutas(rutas), 'text/csv;charset=utf-8');
    ER.toast('CSV exportado', 'ok');
  };

  ER.exportarRespaldo = function () {
    const data = JSON.stringify(ER.S, null, 2);
    ER.download('en-ruta-respaldo-' + ER.today() + '.json', data, 'application/json');
    ER.toast('Respaldo descargado', 'ok');
  };

  ER.exportarRespaldoTexto = function () {
    return JSON.stringify(ER.S, null, 2);
  };

  ER.importarRespaldo = function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !data.config || !Array.isArray(data.motorizados) || !Array.isArray(data.rutas)) {
            throw new Error('El archivo no parece un respaldo de En Ruta.');
          }
          resolve(data);
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsText(file);
    });
  };

  /* ------------------------------ Datos de ejemplo ------------------------------ */
  ER.cargarDemo = function () {
    const hoy = ER.today();
    const estado = {
      version: 2,
      config: JSON.parse(JSON.stringify(ER.S.config)),
      motorizados: [],
      rutas: [],
      noPedidos: [],
      horarios: [],
      asistencias: [],
      pagos: [],
      notas: [],
      papelera: [],
      log: [],
      ui: { lastAutoBackup: null }
    };
    estado.config.zonas = ER.ZONAS_BASE.slice();
    const personas = [
      { nombre: 'Pepito Quispe', whatsapp: '922504223', tipo: 'ruta', comision: 8, turno: 'noche', horaEntrada: '19:00', dias: [1, 2, 3, 4, 5, 6], diaLibre: 0, metaSemanal: 350, premio: 'Un día sin comisión' },
      { nombre: 'Juan Carlos Díaz', whatsapp: '987654321', tipo: 'ruta', comision: 8, turno: 'noche', horaEntrada: '19:00', dias: [1, 2, 3, 4, 5], diaLibre: 6, metaSemanal: 300, premio: 'Bono S/ 30' },
      { nombre: 'Luis Fernando Ruiz', whatsapp: '912345678', tipo: 'ruta', comision: 10, turno: 'noche', horaEntrada: '18:30', dias: [2, 3, 4, 5, 6, 0], diaLibre: 1, metaSemanal: 400, premio: 'Prioridad para elegir día libre' },
      { nombre: 'Marco Antonio Flores', whatsapp: '934567890', tipo: 'ruta', comision: 8, turno: 'dia', horaEntrada: '10:00', dias: [1, 2, 3, 4, 5, 6], diaLibre: 0, metaSemanal: 250, premio: 'Bono S/ 20' },
      { nombre: 'Kevin Sánchez', whatsapp: '945678901', tipo: 'ruta', comision: 8, turno: 'dia', horaEntrada: '11:00', dias: [1, 2, 3, 4, 5], diaLibre: 6, metaSemanal: 200, premio: '' },
      { nombre: 'Carlos Mendoza', whatsapp: '956789012', tipo: 'parcial', comision: 8, turno: 'noche', horaEntrada: '20:00', dias: [1, 3, 5], diaLibre: 2, metaSemanal: 120, premio: 'Bono S/ 15' },
      { nombre: 'Andrés Paredes', whatsapp: '967890123', tipo: 'parcial', comision: 8, turno: 'noche', horaEntrada: '19:30', dias: [2, 4, 6], diaLibre: 1, metaSemanal: 100, premio: '' },
      { nombre: 'Diego Ramírez', whatsapp: '978901234', tipo: 'ruta', comision: 8, turno: 'noche', horaEntrada: '19:00', dias: [0, 1, 2, 3, 4, 5, 6], diaLibre: 3, metaSemanal: 300, premio: 'Bono S/ 25' }
    ];
    const zonas = estado.config.zonas;
    personas.forEach((p, i) => {
      estado.motorizados.push({
        id: 'demo-m' + i,
        nombre: p.nombre,
        whatsapp: p.whatsapp,
        tipo: p.tipo,
        comision: p.comision,
        turno: p.turno,
        horaEntrada: p.horaEntrada,
        dias: p.dias,
        diaLibre: p.diaLibre,
        fechaIngreso: ER.addDays(hoy, -90 - i * 20),
        activo: i !== 7,
        metaSemanal: p.metaSemanal,
        premio: p.premio,
        notas: ''
      });
    });

    const pedidosPool = ['5+5+6', '6+7+8', '5+5+5+5', '8+8+7+6', '10+12', '5+6+7+8+5', '7+7+8', '6+6+6+6', '9+8+7', '5+5+5+5+6+6'];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    for (let d = 21; d >= 0; d--) {
      const fecha = ER.addDays(hoy, -d);
      estado.motorizados.forEach((m, idx) => {
        if (m.activo === false) return;
        if (!ER.worksOn(m, fecha)) return;
        // Deja pendientes los últimos días de algunos motorizados
        if (d <= 2 && [0, 2, 4].includes(idx)) return;
        if (d > 0 && rnd() < 0.12) return;
        const pedidos = pedidosPool[Math.floor(rnd() * pedidosPool.length)];
        const calc = ER.calcularRuta(pedidos, m.comision);
        const ruta = {
          id: 'demo-r-' + idx + '-' + fecha,
          motorizadoId: m.id,
          motorizadoNombre: m.nombre,
          fecha,
          turno: m.turno,
          zona: zonas[Math.floor(rnd() * Math.min(zonas.length, 10))],
          pedidos,
          total: calc.total,
          comision: calc.comision,
          pct: m.comision,
          nota: (rnd() < 0.12) ? 'La base avisó que un pedido llegó incompleto.' : '',
          pagado: d > 8,
          abono: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          historial: []
        };
        estado.rutas.push(ruta);
      });
    }

    // Asistencias de los últimos 12 días
    for (let d = 12; d >= 1; d--) {
      const fecha = ER.addDays(hoy, -d);
      estado.motorizados.forEach((m) => {
        if (!ER.worksOn(m, fecha)) return;
        const sch = ER.scheduleOf(m, fecha);
        if (!sch) return;
        const r = rnd();
        if (r < 0.08) {
          estado.asistencias.push({ id: 'demo-a-' + m.id + '-' + fecha, motorizadoId: m.id, fecha, horaProgramada: sch.inicio, horaLlegada: '', estado: 'falta', nota: '' });
        } else {
          const minute = r < 0.35 ? Math.floor(rnd() * 22) : -Math.floor(rnd() * 8);
          const llegada = ER.minToTime(ER.timeToMin(sch.inicio) + minute);
          estado.asistencias.push({ id: 'demo-a-' + m.id + '-' + fecha, motorizadoId: m.id, fecha, horaProgramada: sch.inicio, horaLlegada: llegada, estado: ER.calcularEstadoAsistencia(sch.inicio, llegada), nota: '' });
        }
      });
    }

    // Notas
    const m0 = estado.motorizados[0];
    estado.notas.push(
      { id: 'demo-n1', motorizadoId: m0.id, fecha: ER.addDays(hoy, -2), tipo: 'reclamo', titulo: 'Pedido observado', texto: 'El cliente indicó que se cobró de más en un pedido. Revisar con la base.', estado: 'pendiente', createdAt: new Date().toISOString() },
      { id: 'demo-n2', motorizadoId: estado.motorizados[3].id, fecha: ER.addDays(hoy, -5), tipo: 'nota', titulo: 'Buena atención', texto: 'Recibí un comentario positivo del cliente por la entrega rápida.', estado: 'tratado', createdAt: new Date().toISOString() }
    );

    // Un abono de ejemplo
    const rutaAbono = estado.rutas.find((r) => r.pagado === false && r.motorizadoId === m0.id);
    if (rutaAbono) {
      rutaAbono.abono = ER.round2(rutaAbono.comision / 2);
      estado.pagos.push({ id: 'demo-p1', motorizadoId: m0.id, fecha: ER.addDays(hoy, -1), monto: rutaAbono.abono, nota: 'Abono parcial de ejemplo', createdAt: new Date().toISOString() });
    }

    estado.log.push({ id: ER.uid(), fecha: new Date().toISOString(), accion: 'Datos de ejemplo', detalle: 'Se cargó el conjunto de demostración.' });

    ER.S = estado;
    ER.save();
    ER.toast('Datos de ejemplo cargados', 'ok');
    ER.go('inicio');
    ER.render();
  };

})();
