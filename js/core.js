/* ============================================================
   EN RUTA — Núcleo: estado, utilidades, navegación y UI base
   ============================================================ */
(function () {
  'use strict';

  const ER = window.ER = window.ER || {};
  ER.views = ER.views || {};
  ER.actions = ER.actions || {};

  /* ------------------------------ Constantes ------------------------------ */
  ER.VERSION = '1.0.5';
  ER.APP = 'En Ruta';
  ER.DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  ER.DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  ER.DIAS_MIN = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  ER.MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  ER.MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  ER.ZONAS_BASE = [
    'Nuevo Chimbote Centro', 'Buenos Aires', 'Villa María', 'Los Cedros', 'Los Álamos',
    'Santa Rosa', 'Bellamar', 'San Bartolo', 'Cáceres Aramayo', 'Tambo Real',
    'El Pacífico', 'Las Delicias', 'Miraflores', 'Urb. El Bosque', 'Otros'
  ];

  ER.MENU = [
    { group: 'Principal', items: [
      { id: 'inicio', label: 'Inicio', icon: 'home' }
    ]},
    { group: 'Operación', items: [
      { id: 'rutas', label: 'Rutas', icon: 'map' },
      { id: 'carga', label: 'Carga rápida', icon: 'zap' },
      { id: 'registro', label: 'Registro', icon: 'list' },
      { id: 'cobros', label: 'Cobros', icon: 'cash' }
    ]},
    { group: 'Equipo', items: [
      { id: 'motorizados', label: 'Motorizados', icon: 'users' },
      { id: 'horario', label: 'Horario general', icon: 'calendar' },
      { id: 'asistencia', label: 'Asistencia', icon: 'clock' }
    ]},
    { group: 'Gestión', items: [
      { id: 'notas', label: 'Notas y reclamos', icon: 'message' },
      { id: 'calendario', label: 'Calendario de demanda', icon: 'star' },
      { id: 'reportes', label: 'Reportes', icon: 'chart' }
    ]},
    { group: 'Sistema', items: [
      { id: 'papelera', label: 'Papelera', icon: 'trash' },
      { id: 'ajustes', label: 'Ajustes', icon: 'settings' }
    ]}
  ];

  ER.TITLES = {
    inicio: ['Inicio', 'Resumen general del negocio'],
    rutas: ['Rutas', 'Registra lo que generó cada motorizado'],
    carga: ['Carga rápida', 'Llena el día completo en una sola pantalla'],
    registro: ['Registro', 'Todos los pedidos, con su texto original'],
    cobros: ['Cobros', 'Pagos, abonos y estado de cuenta'],
    motorizados: ['Motorizados', 'Fichas, comisiones y equipo'],
    horario: ['Horario general', 'Turnos de toda la semana'],
    asistencia: ['Asistencia', 'Puntualidad, tardanzas y faltas'],
    notas: ['Notas y reclamos', 'Problemas y observaciones'],
    calendario: ['Calendario de demanda', 'Fechas fuertes del Perú'],
    reportes: ['Reportes', 'Semanales y mensuales'],
    papelera: ['Papelera', 'Recupera lo eliminado y revisa cambios'],
    ajustes: ['Ajustes', 'Configuración y respaldos'],
    motorizado: ['Ficha del motorizado', 'Historial y datos completos']
  };

  ER.BOTTOM = [
    { id: 'inicio', label: 'Inicio', icon: 'home' },
    { id: 'rutas', label: 'Rutas', icon: 'map' },
    { id: 'carga', label: 'Carga', icon: 'zap' },
    { id: 'cobros', label: 'Cobros', icon: 'cash' },
    { id: '__more', label: 'Más', icon: 'menu' }
  ];

  /* ------------------------------ Estado ------------------------------ */
  const KEY = 'enruta:state:v1';
  const BACKUP_PREFIX = 'enruta:auto:';

  ER.KEY = KEY;
  ER.BACKUP_PREFIX = BACKUP_PREFIX;

  const defaultConfig = () => ({
    negocio: 'En Ruta',
    ciudad: 'Nuevo Chimbote',
    plin: '922-504-223',
    telefono: '',
    comisionDefault: 8,
    horaCambioTurno: '19:00',
    jornadaInicio: '09:00',
    jornadaFin: '24:00',
    diasSinRuta: 4,
    diasAvisoDemanda: 20,
    toleranciaMin: 5,
    autoBackup: true,
    metaSemanalDefault: 300,
    premioDefault: '',
    zonas: ER.ZONAS_BASE.slice(),
    plantillas: {
      cobro: 'Buenos días, *{nombre}*\n{fecha}\nTotal {total} x {pct}% = *{comision}*\nAbonar al PLIN: {plin}',
      cierre: '*CIERRE DEL DÍA* — {fecha}\n\n{detalle}\n\nTotal generado: {total}\nMi comisión: {comision}\n\nPLIN: {plin}',
      cuenta: '*ESTADO DE CUENTA*\n*{nombre}*\nAl {fecha}\n\n{detalle}\n\nTotal: {total}\nAbonado: {abonado}\n*Saldo: {saldo}*\n\nPLIN: {plin}',
      reporte: '*REPORTE {periodo}*\n{detalle}\n\nTotal generado: {total}\nMi comisión: {comision}\nRutas: {rutas}\n\nEn Ruta · Nuevo Chimbote'
    },
    demandaCustom: [],
    logo: null
  });

  const defaultState = () => ({
    version: 2,
    config: defaultConfig(),
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
  });

  function deepMerge(base, extra) {
    if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
    if (base && typeof base === 'object') {
      const out = {};
      for (const k of Object.keys(base)) out[k] = deepMerge(base[k], extra ? extra[k] : undefined);
      if (extra && typeof extra === 'object') {
        for (const k of Object.keys(extra)) if (!(k in out)) out[k] = extra[k];
      }
      return out;
    }
    return extra === undefined || extra === null ? base : extra;
  }

  function loadState() {
    const fresh = defaultState();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw);
      const merged = deepMerge(fresh, parsed);
      // Normaliza colecciones
      for (const k of ['motorizados', 'rutas', 'noPedidos', 'horarios', 'asistencias', 'pagos', 'notas', 'papelera', 'log']) {
        if (!Array.isArray(merged[k])) merged[k] = [];
      }
      if (!Array.isArray(merged.config.zonas) || !merged.config.zonas.length) merged.config.zonas = ER.ZONAS_BASE.slice();
      if (!Array.isArray(merged.config.demandaCustom)) merged.config.demandaCustom = [];
      if (!merged.config.plantillas) merged.config.plantillas = defaultConfig().plantillas;
      // Migración v2: tolerancia oficial de 5 minutos (07:00 → 07:05 puntual).
      if ((Number(parsed.version) || 1) < 2) {
        if (Number(merged.config.toleranciaMin) === 0) merged.config.toleranciaMin = 5;
        merged.version = 2;
      }
      return merged;
    } catch (e) {
      console.error('No se pudo cargar el estado', e);
      return fresh;
    }
  }

  ER.S = loadState();
  ER.ui = {
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    filter: { preset: 'semana', from: null, to: null },
    registro: { q: '', motorizado: '', zona: '', turno: '', estado: '', from: '', to: '', sort: 'fecha', dir: 'desc', page: 1 },
    cobros: { q: '', soloDeuda: true },
    notas: { q: '', motorizado: '', tipo: '', estado: '', from: '', to: '' },
    asistencia: { fecha: null, mes: null },
    horario: { semana: null, fecha: null, vista: 'semana' },
    calendario: { mes: null },
    papelera: { tab: 'papelera' },
    reportes: { preset: 'mes', from: null, to: null },
    tr: { q: '', tipo: '', estado: '', page: 1 }
  };

  ER.save = function () {
    try {
      // Respaldo automático una vez al día
      if (ER.S.config.autoBackup) {
        const hoy = ER.today();
        if (ER.S.ui.lastAutoBackup !== hoy) {
          ER.S.ui.lastAutoBackup = hoy;
          try {
            localStorage.setItem(BACKUP_PREFIX + hoy, JSON.stringify(ER.S));
            ER.pruneBackups();
          } catch (e) { /* sin espacio: seguimos */ }
        }
      }
      localStorage.setItem(KEY, JSON.stringify(ER.S));
      ER.updateNavBadges();
      try { if (ER.sync && ER.sync.onSave) ER.sync.onSave(); } catch (e) { /* sync opcional */ }
      return true;
    } catch (e) {
      console.error(e);
      ER.toast('No se pudo guardar. Revisa el espacio del navegador.', 'err', 5000);
      return false;
    }
  };

  ER.resetState = function () {
    ER.S = defaultState();
    localStorage.removeItem(KEY);
    ER.save();
  };

  ER.pruneBackups = function (max = 7) {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(BACKUP_PREFIX)) keys.push(k);
      }
      keys.sort().reverse();
      keys.slice(max).forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  };

  ER.listBackups = function () {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(BACKUP_PREFIX)) {
          const raw = localStorage.getItem(k) || '';
          out.push({ key: k, fecha: k.slice(BACKUP_PREFIX.length), bytes: raw.length });
        }
      }
    } catch (e) {}
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
  };

  /* ------------------------------ Utilidades ------------------------------ */
  ER.$ = (sel, root) => (root || document).querySelector(sel);
  ER.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  ER.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  ER.round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  ER.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  };

  ER.icon = function (name, cls) {
    return `<svg class="icon ${cls || ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  };

  ER.pad = (n) => String(n).padStart(2, '0');
  ER.iso = function (d) { return `${d.getFullYear()}-${ER.pad(d.getMonth() + 1)}-${ER.pad(d.getDate())}`; };
  ER.parseISO = function (s) {
    if (!s) return new Date(NaN);
    const p = String(s).slice(0, 10).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  };
  ER.today = () => ER.iso(new Date());
  ER.nowTime = () => { const d = new Date(); return `${ER.pad(d.getHours())}:${ER.pad(d.getMinutes())}`; };
  ER.addDays = function (iso, n) {
    const d = ER.parseISO(iso); d.setDate(d.getDate() + n); return ER.iso(d);
  };
  ER.addMonths = function (iso, n) {
    const d = ER.parseISO(iso);
    const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return ER.iso(d);
  };
  ER.weekday = (iso) => ER.parseISO(iso).getDay();
  ER.startOfWeek = function (iso) {
    const d = ER.parseISO(iso);
    const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return ER.iso(d);
  };
  ER.endOfWeek = (iso) => ER.addDays(ER.startOfWeek(iso), 6);
  ER.startOfMonth = (iso) => String(iso).slice(0, 7) + '-01';
  ER.endOfMonth = function (iso) {
    const d = ER.parseISO(iso);
    return ER.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  };
  ER.daysBetween = function (a, b) {
    const ms = ER.parseISO(b).getTime() - ER.parseISO(a).getTime();
    return Math.round(ms / 86400000);
  };
  ER.daysInMonth = function (iso) {
    const d = ER.parseISO(iso);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  };
  ER.timeToMin = function (t) {
    if (!t) return 0;
    const p = String(t).split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  };
  ER.minToTime = function (m) {
    m = Math.max(0, Math.min(24 * 60, Math.round(m)));
    if (m === 24 * 60) return '24:00';
    return `${ER.pad(Math.floor(m / 60))}:${ER.pad(m % 60)}`;
  };
  ER.timeLabel = function (t) {
    if (!t) return '—';
    const parts = String(t).split(':').map(Number);
    let h = parts[0];
    const m = parts[1] || 0;
    const ampm = (h % 24) >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')}${ampm}`;
  };
  /* Los input[type=time] no aceptan 24:00; se muestra 23:59 y se guarda 24:00. */
  ER.toTimeInput = function (t) {
    if (!t) return '';
    if (t === '24:00') return '23:59';
    return String(t).slice(0, 5);
  };
  ER.fromTimeInput = function (t) {
    if (t === '23:59') return '24:00';
    return t;
  };

  ER.fmtDate = function (iso, style) {
    if (!iso) return '—';
    const d = ER.parseISO(iso);
    if (isNaN(d.getTime())) return '—';
    const dia = d.getDate();
    const mes = ER.MESES[d.getMonth()];
    const mesC = ER.MESES_CORTOS[d.getMonth()];
    const year = d.getFullYear();
    switch (style) {
      case 'short': return `${dia} ${mesC}`;
      case 'medium': return `${dia} ${mesC} ${year}`;
      case 'weekday': return `${ER.DIAS_CORTOS[d.getDay()]} ${dia} ${mesC}`;
      case 'weekdayLong': return `${ER.DIAS[d.getDay()]} ${dia} de ${mes} de ${year}`;
      case 'month': return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${year}`;
      default: return `${dia} de ${mes} de ${year}`;
    }
  };

  ER.fmtRange = function (from, to) {
    if (!from && !to) return 'Todo el periodo';
    if (!to || from === to) return ER.fmtDate(from);
    const a = ER.parseISO(from), b = ER.parseISO(to);
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return `del ${a.getDate()} al ${b.getDate()} de ${ER.MESES[a.getMonth()]} de ${a.getFullYear()}`;
    }
    if (a.getFullYear() === b.getFullYear()) {
      return `del ${a.getDate()} de ${ER.MESES[a.getMonth()]} al ${b.getDate()} de ${ER.MESES[b.getMonth()]} de ${a.getFullYear()}`;
    }
    return `del ${ER.fmtDate(from)} al ${ER.fmtDate(to)}`;
  };

  ER.fmtDateTime = function (isoDt) {
    if (!isoDt) return '—';
    const d = new Date(isoDt);
    if (isNaN(d.getTime())) return '—';
    return `${ER.fmtDate(ER.iso(d), 'medium')} · ${ER.pad(d.getHours())}:${ER.pad(d.getMinutes())}`;
  };

  ER.humanDate = function (iso) {
    const diff = ER.daysBetween(ER.today(), iso);
    if (diff === 0) return 'Hoy';
    if (diff === -1) return 'Ayer';
    if (diff === 1) return 'Mañana';
    if (diff < 0) return `Hace ${Math.abs(diff)} días`;
    return `En ${diff} días`;
  };

  ER.money = function (n) {
    const v = Number(n) || 0;
    return 'S/ ' + v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  ER.moneyShort = function (n) {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1000) return 'S/ ' + (v / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 }) + 'k';
    return 'S/ ' + v.toLocaleString('es-PE', { maximumFractionDigits: 0 });
  };
  ER.pct = function (n) { return (Math.round((Number(n) || 0) * 10) / 10) + '%'; };
  ER.num = function (n) { return (Number(n) || 0).toLocaleString('es-PE'); };
  ER.plural = function (n, one, many) { return n === 1 ? one : (many || one + 's'); };

  ER.initials = function (name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  };
  ER.colorClass = function (name) {
    let h = 0;
    for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) % 6;
    return 'c' + (h + 1);
  };
  ER.avatar = function (name, cls) {
    return `<span class="avatar ${ER.colorClass(name)} ${cls || ''}">${ER.esc(ER.initials(name))}</span>`;
  };

  ER.debounce = function (fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms || 250);
    };
  };

  /* ------------------------------ Fechas de periodo ------------------------------ */
  ER.rangeOf = function (preset, from, to) {
    const hoy = ER.today();
    if (preset === 'hoy') return { from: hoy, to: hoy, label: 'Hoy, ' + ER.fmtDate(hoy) };
    if (preset === 'ayer') { const a = ER.addDays(hoy, -1); return { from: a, to: a, label: 'Ayer, ' + ER.fmtDate(a) }; }
    if (preset === 'semana') { const f = ER.startOfWeek(hoy); return { from: f, to: ER.addDays(f, 6), label: 'Esta semana' }; }
    if (preset === 'semana_pasada') { const f = ER.addDays(ER.startOfWeek(hoy), -7); return { from: f, to: ER.addDays(f, 6), label: 'Semana pasada' }; }
    if (preset === 'mes') { return { from: ER.startOfMonth(hoy), to: ER.endOfMonth(hoy), label: 'Este mes' }; }
    if (preset === 'mes_pasado') { const m = ER.addMonths(hoy, -1); return { from: ER.startOfMonth(m), to: ER.endOfMonth(m), label: 'Mes pasado' }; }
    if (preset === 'año') { return { from: hoy.slice(0, 4) + '-01-01', to: hoy.slice(0, 4) + '-12-31', label: 'Este año' }; }
    if (preset === 'rango') {
      let f = from, t = to;
      if (!f && !t) { f = ER.startOfWeek(hoy); t = hoy; }
      if (f && !t) t = f;
      if (!f && t) f = t;
      if (f > t) { const x = f; f = t; t = x; }
      return { from: f, to: t, label: ER.fmtRange(f, t) };
    }
    // todo
    let min = hoy, max = hoy;
    if (ER.S.rutas.length) {
      min = ER.S.rutas.reduce((a, r) => (r.fecha < a ? r.fecha : a), ER.S.rutas[0].fecha);
      max = ER.S.rutas.reduce((a, r) => (r.fecha > a ? r.fecha : a), ER.S.rutas[0].fecha);
    }
    return { from: min, to: max > hoy ? max : hoy, label: 'Todo el historial' };
  };

  ER.periodLabel = function (preset) {
    return ({
      hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana', semana_pasada: 'Semana pasada',
      mes: 'Este mes', mes_pasado: 'Mes pasado', año: 'Este año', todo: 'Todo', rango: 'Rango personalizado'
    })[preset] || 'Periodo';
  };

  /* ------------------------------ Tema ------------------------------ */
  ER.setTheme = function (t) {
    ER.ui.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('enruta:theme', t); } catch (e) {}
    const icon = document.getElementById('theme-icon');
    if (icon) icon.querySelector('use').setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0B0B0B' : '#FFC400');
  };
  ER.toggleTheme = function () {
    ER.setTheme(ER.ui.theme === 'dark' ? 'light' : 'dark');
  };

  /* ------------------------------ Navegación ------------------------------ */
  ER.go = function (view, params) {
    const suffix = params ? '/' + [].concat(params).map(encodeURIComponent).join('/') : '';
    location.hash = '#/' + view + suffix;
  };
  ER.parseHash = function () {
    let h = location.hash.replace(/^#\/?/, '');
    if (!h) return { view: 'inicio', params: [] };
    const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
    return { view: parts[0] || 'inicio', params: parts.slice(1) };
  };

  ER.buildSidebar = function () {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    nav.innerHTML = ER.MENU.map((g) => `
      <div class="nav-group">
        <div class="nav-group-label">${ER.esc(g.group)}</div>
        ${g.items.map((it) => `
          <a class="nav-item" data-view="${it.id}" href="#/${it.id}">
            ${ER.icon(it.icon)}<span>${ER.esc(it.label)}</span>
            <span class="badge-dot" data-badge="${it.id}" hidden>0</span>
          </a>`).join('')}
      </div>`).join('');
  };

  ER.buildBottomNav = function () {
    const nav = document.getElementById('bottomnav');
    if (!nav) return;
    nav.innerHTML = ER.BOTTOM.map((it) => {
      if (it.id === '__more') {
        return `<button class="bn-item" data-action="open-more" type="button">
          <span class="icon-wrap">${ER.icon(it.icon)}</span><span>${it.label}</span>
        </button>`;
      }
      return `<a class="bn-item" data-view="${it.id}" href="#/${it.id}">
        <span class="icon-wrap">${ER.icon(it.icon)}</span><span>${it.label}</span>
        <span class="badge-dot" data-badge="${it.id}" hidden>0</span>
      </a>`;
    }).join('');
  };

  ER.updateNavBadges = function () {
    if (typeof ER.pendingDaily !== 'function') return;
    let n = 0;
    try { n = ER.pendingDaily().length; } catch (e) { n = 0; }
    ER.$$('[data-badge]').forEach((el) => {
      const id = el.getAttribute('data-badge');
      if (id === 'rutas') {
        el.hidden = n === 0;
        el.textContent = n > 99 ? '99+' : String(n);
      }
    });
  };

  ER.render = function () {
    const { view, params } = ER.parseHash();
    const id = ER.views[view] ? view : 'inicio';
    const def = ER.views[id];
    const viewEl = document.getElementById('view');
    if (!viewEl) return;

    const titleInfo = ER.TITLES[id] || [id, ''];
    document.getElementById('page-title').textContent = id === 'motorizado' && params[0]
      ? (ER.S.motorizados.find((m) => m.id === params[0]) || {}).nombre || titleInfo[0]
      : titleInfo[0];
    document.getElementById('page-subtitle').textContent = titleInfo[1] || '';
    document.title = 'En Ruta · ' + titleInfo[0];

    ER.$$('.nav-item, .bn-item').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-view') === id || (id === 'motorizado' && el.getAttribute('data-view') === 'motorizados'));
    });

    try {
      viewEl.innerHTML = def.render(params);
      viewEl.scrollTop = 0;
      window.scrollTo(0, 0);
      if (def.mount) def.mount(viewEl, params);
      ER.updateNavBadges();
    } catch (e) {
      console.error('Error al renderizar', e);
      viewEl.innerHTML = `<div class="card"><div class="empty">
        <div class="empty-icon">${ER.icon('alert')}</div>
        <h3>Ocurrió un error al mostrar esta sección</h3>
        <p>${ER.esc(e.message)}</p>
        <button class="btn primary" data-action="reload">Recargar</button>
      </div></div>`;
    }
  };

  /* ------------------------------ Iconos de estado ------------------------------ */
  ER.badgeTipo = function (tipo) {
    return tipo === 'parcial'
      ? '<span class="badge violet">Parcial</span>'
      : '<span class="badge yellow">En ruta</span>';
  };
  ER.badgePago = function (r) {
    if (r.pagado) return '<span class="badge green">Pagado</span>';
    if ((r.abono || 0) > 0) return '<span class="badge warn">Abonado</span>';
    return '<span class="badge red">Pendiente</span>';
  };

  /* ------------------------------ Toast ------------------------------ */
  ER.toast = function (msg, type, ms) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    const ic = type === 'err' ? 'alert' : (type === 'ok' ? 'check' : 'message');
    el.innerHTML = `${ER.icon(ic)}<span>${ER.esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, ms || 2800);
  };

  /* ------------------------------ Modal ------------------------------ */
  let modalCount = 0;
  ER.modal = function (opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    if (!root) return { close: function () {} };
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const size = opts.size ? ' ' + opts.size : '';
    overlay.innerHTML = `
      <div class="modal${size}" role="dialog" aria-modal="true" aria-label="${ER.esc(opts.title || '')}">
        <div class="modal-h">
          <div class="grow">
            <h2>${ER.esc(opts.title || '')}</h2>
            ${opts.subtitle ? `<p>${opts.subtitle}</p>` : ''}
          </div>
          ${opts.dismissible === false ? '' : `<button class="icon-btn" data-close type="button" aria-label="Cerrar">${ER.icon('x')}</button>`}
        </div>
        <div class="modal-b">${opts.body || ''}</div>
        ${opts.footer ? `<div class="modal-f">${opts.footer}</div>` : ''}
      </div>`;
    root.appendChild(overlay);
    modalCount++;
    document.body.style.overflow = 'hidden';

    function close() {
      if (!overlay.parentNode) return;
      overlay.remove();
      modalCount = Math.max(0, modalCount - 1);
      if (modalCount === 0) document.body.style.overflow = '';
      if (opts.onClose) opts.onClose();
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && opts.dismissible !== false) close();
      if (e.target.closest('[data-close]')) close();
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && opts.dismissible !== false) close();
    });
    if (opts.onMount) {
      try { opts.onMount(overlay, close); } catch (e) { console.error(e); }
    }
    setTimeout(() => {
      const f = overlay.querySelector('input:not([type=hidden]), select, textarea, button.btn.primary');
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    }, 60);
    return { close, el: overlay };
  };

  ER.closeModals = function () {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    modalCount = 0;
    document.body.style.overflow = '';
  };

  ER.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let done = false;
      const m = ER.modal({
        title: opts.title || 'Confirmar',
        size: 'sm',
        body: `<p class="small" style="line-height:1.55">${message}</p>`,
        footer: `<button class="btn" data-close type="button">Cancelar</button>
                 <button class="btn ${opts.danger ? 'danger' : 'primary'}" data-ok type="button">${ER.esc(opts.ok || 'Sí, continuar')}</button>`,
        onMount: (el, close) => {
          el.querySelector('[data-ok]').addEventListener('click', () => {
            done = true; close(); resolve(true);
          });
        },
        onClose: () => { if (!done) resolve(false); }
      });
      return m;
    });
  };

  ER.prompt = function (opts) {
    return new Promise((resolve) => {
      let done = false;
      ER.modal({
        title: opts.title || 'Escribir',
        size: 'sm',
        body: `<div class="field"><label>${ER.esc(opts.label || '')}</label>
          <textarea class="textarea" id="prompt-text" placeholder="${ER.esc(opts.placeholder || '')}">${ER.esc(opts.value || '')}</textarea></div>`,
        footer: `<button class="btn" data-close type="button">Cancelar</button>
                 <button class="btn primary" data-ok type="button">${ER.esc(opts.ok || 'Aceptar')}</button>`,
        onMount: (el, close) => {
          const ta = el.querySelector('#prompt-text');
          el.querySelector('[data-ok]').addEventListener('click', () => {
            done = true; const v = ta.value; close(); resolve(v);
          });
          ta.focus();
        },
        onClose: () => { if (!done) resolve(null); }
      });
    });
  };

  /* ------------------------------ Utilidades de archivos / WhatsApp ------------------------------ */
  ER.copy = async function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      ER.toast('Copiado al portapapeles', 'ok');
      return true;
    } catch (e) {
      ER.toast('No se pudo copiar. Selecciona el texto manualmente.', 'err');
      return false;
    }
  };

  ER.download = function (filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  ER.normalizePhone = function (raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 9) d = '51' + d;
    else if (d.length === 10 && d.startsWith('0')) d = '51' + d.slice(1);
    else if (d.length === 11 && d.startsWith('51')) { /* ok */ }
    else if (d.length > 11 && d.startsWith('51')) d = d.slice(0, 11);
    return d;
  };
  ER.phoneDisplay = function (raw) {
    const d = String(raw || '').replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('51')) {
      const n = d.slice(2);
      return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
    }
    if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    return raw || '—';
  };
  ER.waUrl = function (phone, text) {
    const p = phone ? ER.normalizePhone(phone) : '';
    return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text || '');
  };
  ER.openWA = function (phone, text) {
    const url = ER.waUrl(phone, text);
    window.open(url, '_blank', 'noopener');
  };

  ER.reload = function () { ER.render(); };

  /* ------------------------------ Plantillas ------------------------------ */
  ER.renderTemplate = function (tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m
    ));
  };

  /* ------------------------------ Log ------------------------------ */
  ER.log = function (accion, detalle) {
    ER.S.log.unshift({ id: ER.uid(), fecha: new Date().toISOString(), accion, detalle: detalle || '' });
    if (ER.S.log.length > 600) ER.S.log.length = 600;
  };

  /* ------------------------------ Papelera ------------------------------ */
  ER.aPapelera = function (tipo, data, descripcion) {
    ER.S.papelera.unshift({
      id: ER.uid(), tipo, descripcion: descripcion || tipo, fecha: new Date().toISOString(), data
    });
    if (ER.S.papelera.length > 400) ER.S.papelera.length = 400;
  };

})();
