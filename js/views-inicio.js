/* ============================================================
   EN RUTA — Inicio (dashboard)
   ============================================================ */
(function () {
  'use strict';
  const ER = window.ER;
  if (!ER) return;

  /* ------------------------------ Gráfico SVG ------------------------------ */
  ER.chartSVG = function (puntos, opts) {
    opts = opts || {};
    const field = opts.field || 'comision';
    const W = 720, H = 220, pl = 54, pr = 12, pt = 20, pb = 30;
    const innerW = W - pl - pr, innerH = H - pt - pb;
    const n = Math.max(1, puntos.length);
    if (!puntos.length) return '<div class="empty" style="padding:30px 10px"><p>Sin datos en este periodo.</p></div>';

    const maxV = Math.max(1, ...puntos.map((p) => Number(p[field]) || 0));
    const exp = Math.pow(10, Math.floor(Math.log10(maxV)));
    const f = maxV / exp;
    const nice = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
    const y = (v) => pt + innerH - (v / nice) * innerH;
    const step = innerW / n;
    const bw = Math.max(2.5, Math.min(40, step * 0.62));
    const labelStep = Math.ceil(n / (opts.labels || 10));

    let grid = '', bars = '', labels = '';
    for (let i = 0; i <= 4; i++) {
      const v = (nice * i) / 4;
      grid += `<line class="grid-line" x1="${pl}" y1="${y(v)}" x2="${W - pr}" y2="${y(v)}"/>`;
      if (i > 0) grid += `<text class="axis-label" x="${pl - 7}" y="${y(v) + 3}" text-anchor="end">${ER.moneyShort(v)}</text>`;
    }
    puntos.forEach((p, i) => {
      const cx = pl + step * i + step / 2;
      const val = Number(p[field]) || 0;
      const h = val > 0 ? Math.max(2, (val / nice) * innerH) : 0;
      const label = `${p.label} · ${ER.money(val)} · ${p.count || 0} rutas`;
      bars += `<rect class="bar" x="${(cx - bw / 2).toFixed(1)}" y="${(pt + innerH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw / 2)}"><title>${ER.esc(label)}</title></rect>`;
      if (i % labelStep === 0 || i === n - 1) {
        labels += `<text class="axis-label" x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle">${ER.esc(p.label)}</text>`;
      }
    });
    const titulo = opts.title ? `<title>${ER.esc(opts.title)}</title>` : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">${titulo}${grid}${bars}${labels}</svg>`;
  };

  /* ------------------------------ Helpers ------------------------------ */
  function deltaBadge(pct, label) {
    const d = Number(pct) || 0;
    const cls = d > 0 ? 'green' : d < 0 ? 'red' : '';
    const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '•';
    return `<span class="badge ${cls}">${arrow} ${Math.abs(d)}% ${label || ''}</span>`;
  }
  function saludo() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
  }

  /* ------------------------------ Vista ------------------------------ */
  ER.views.inicio = {
    render() {
      const f = ER.ui.filter;
      const range = ER.rangeOf(f.preset, f.from, f.to);
      const st = ER.statsRange(range.from, range.to);
      const pend = ER.pendingDaily();
      const older = ER.pendingOlder();
      const pweek = ER.pendingWeekly();
      const deudas = ER.deudas();
      const inact = ER.inactivos();
      const demand = ER.upcomingDemand();
      const comp = ER.comparativo();
      const proj = ER.proyeccionMes();
      const metas = ER.metasSemana();
      const equipo = ER.quienTrabajaHoy();
      const zonas = ER.resumenZonas(range.from, range.to);
      const top = ER.topMotorizados(range.from, range.to, 5);
      const serie = ER.seriesRango(range.from, range.to);
      const chartMode = ER.ui.chartMode || 'comision';

      const cfg = ER.S.config;
      const vacio = ER.S.motorizados.length === 0;

      /* ---------- Avisos ---------- */
      let avisos = '';
      if (vacio) {
        avisos += `<div class="alert yellow">
          <div class="a-icon">${ER.icon('star')}</div>
          <div class="grow"><div class="a-title">Empieza por registrar a tu equipo</div>
          <div class="a-text">Agrega a tus motorizados para que el sistema calcule comisiones, horarios y avisos automáticamente.</div></div>
          <div class="row gap-6"><a class="btn primary sm" href="#/motorizados">Agregar motorizado</a></div>
        </div>`;
      }

      if (pend.length) {
        avisos += `<div class="alert yellow clickable" data-action="ver-pendientes" role="button" tabindex="0">
          <div class="a-icon">${ER.icon('alert')}</div>
          <div class="grow">
            <div class="a-title">Faltan ${pend.length} ${ER.plural(pend.length, 'motorizado', 'motorizados')} por sacar la comisión de ayer</div>
            <div class="a-text">Toca para ver la lista, registrar o marcar “sin pedidos ese día”.</div>
          </div>
          ${ER.icon('chevron-right', 'a-arrow')}
        </div>`;
      } else if (!vacio && ER.S.motorizados.some((m) => m.tipo === 'ruta' && m.activo !== false)) {
        avisos += `<div class="alert green">
          <div class="a-icon">${ER.icon('check')}</div>
          <div class="grow"><div class="a-title">Comisiones de ayer al día</div>
          <div class="a-text">No queda ningún motorizado “en ruta” pendiente de ayer.</div></div>
        </div>`;
      }

      if (pweek.length) {
        const nombres = pweek.map((p) => firstName(p.motorizado.nombre)).join(', ');
        avisos += `<div class="alert violet clickable" data-action="ver-pendientes" role="button" tabindex="0">
          <div class="a-icon">${ER.icon('message')}</div>
          <div class="grow">
            <div class="a-title">Comisión semanal pendiente: ${ER.esc(nombres)}</div>
            <div class="a-text">${pweek.length === 1 ? 'Falta sacar la comisión de la semana de este motorizado parcial.' : 'Faltan sacar las comisiones de la semana de estos motorizados parciales.'}</div>
          </div>
          ${ER.icon('chevron-right', 'a-arrow')}
        </div>`;
      }

      if (deudas.length) {
        const masVieja = deudas[0];
        avisos += `<div class="alert red clickable" data-action="ir-cobros" role="button" tabindex="0">
          <div class="a-icon">${ER.icon('cash')}</div>
          <div class="grow">
            <div class="a-title">${deudas.length} ${ER.plural(deudas.length, 'motorizado te debe', 'motorizados te deben')} ${ER.money(ER.totalDeuda())}</div>
            <div class="a-text">El más atrasado: ${ER.esc(masVieja.motorizado.nombre)} · ${masVieja.dias} ${ER.plural(masVieja.dias, 'día', 'días')} de atraso.</div>
          </div>
          ${ER.icon('chevron-right', 'a-arrow')}
        </div>`;
      }

      if (demand.length) {
        const d = demand[0];
        const dias = ER.daysBetween(ER.today(), d.fecha);
        avisos += `<div class="alert blue clickable" data-action="ir-calendario" role="button" tabindex="0">
          <div class="a-icon">${ER.icon('star')}</div>
          <div class="grow">
            <div class="a-title">${dias <= 0 ? '¡Hoy es' : 'Faltan ' + dias + ' días para'} ${ER.esc(d.nombre)}!</div>
            <div class="a-text">${ER.fmtDate(d.fecha, 'weekdayLong')}${d.nota ? ' · ' + ER.esc(d.nota) : ''}</div>
          </div>
          ${ER.icon('chevron-right', 'a-arrow')}
        </div>`;
      }

      if (inact.length) {
        const x = inact[0];
        avisos += `<div class="alert yellow clickable" data-action="ir-inactivo" data-id="${x.motorizado.id}" role="button" tabindex="0">
          <div class="a-icon">${ER.icon('clock')}</div>
          <div class="grow">
            <div class="a-title">${ER.esc(x.motorizado.nombre)} no registra rutas desde hace ${x.dias} días</div>
            <div class="a-text">Está activo y tenía ${x.programados} ${ER.plural(x.programados, 'día programado', 'días programados')} en ese periodo. Revisa si sigue trabajando.</div>
          </div>
          ${ER.icon('chevron-right', 'a-arrow')}
        </div>`;
      }

      /* ---------- KPIs ---------- */
      const ingresosDia = ER.statsRange(ER.today(), ER.today());

      /* ---------- Top ---------- */
      const maxTop = Math.max(1, ...top.map((t) => t.total));
      const topHtml = top.length ? top.map((t, i) => `
        <div class="rank-row">
          <span class="rank-num">${i + 1}</span>
          ${ER.avatar(t.nombre, 'sm')}
          <div class="grow" style="min-width:0">
            <div class="between" style="gap:6px">
              <span class="bold truncate" style="font-size:12.5px">${ER.esc(t.nombre)}</span>
              <span class="mono bold" style="font-size:12.5px">${ER.money(t.total)}</span>
            </div>
            <div class="row gap-6" style="margin-top:5px">
              <div class="grow" style="height:5px;background:var(--surface-3);border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${Math.max(3, (t.total / maxTop) * 100)}%;background:var(--yellow);border-radius:99px"></div>
              </div>
              <span class="xs muted nowrap">${t.rutas} rutas</span>
            </div>
          </div>
        </div>`).join('') : `<div class="empty" style="padding:26px 10px"><p>Sin rutas en este periodo.</p></div>`;

      /* ---------- Zonas ---------- */
      const maxZona = Math.max(1, ...zonas.map((z) => z.total));
      const zonasHtml = zonas.length ? zonas.slice(0, 7).map((z) => `
        <div class="rank-row" style="padding:7px 0">
          <div class="grow" style="min-width:0">
            <div class="between" style="gap:6px">
              <span class="truncate" style="font-size:12.5px">${ER.icon('pin', 'sm')} ${ER.esc(z.zona)}</span>
              <span class="mono" style="font-size:12px">${ER.money(z.total)}</span>
            </div>
            <div class="progress thin" style="margin-top:5px"><span style="width:${Math.max(3, (z.total / maxZona) * 100)}%"></span></div>
          </div>
        </div>`).join('') : `<div class="empty" style="padding:26px 10px"><p>Sin zonas registradas en el periodo.</p></div>`;

      /* ---------- Metas ---------- */
      const metasHtml = metas.length ? metas.map((x) => `
        <div class="card" style="box-shadow:none;border-color:var(--border);margin-bottom:10px">
          <div class="card-b" style="padding:12px 13px">
            <div class="row gap-8" style="align-items:flex-start">
              ${ER.avatar(x.motorizado.nombre, 'sm')}
              <div class="grow" style="min-width:0">
                <div class="between wrap" style="gap:4px">
                  <span class="bold" style="font-size:12.5px">${ER.esc(x.motorizado.nombre)}</span>
                  <span class="badge ${x.pct >= 100 ? 'green' : 'yellow'}">${x.pct}%</span>
                </div>
                <div class="progress-row" style="margin-top:6px">
                  <div class="progress"><span style="width:${x.pct}%"></span></div>
                </div>
                <div class="between xs muted" style="margin-top:4px;gap:6px">
                  <span>${ER.money(x.avance)} de ${ER.money(x.meta)}</span>
                  <span>${x.rutas} rutas</span>
                </div>
                <div class="row gap-6" style="margin-top:8px">
                  <input class="input js-meta" type="number" min="0" step="10" value="${x.meta}" data-id="${x.motorizado.id}" style="height:30px;min-height:30px;padding:4px 7px;font-size:12px;width:92px" title="Meta semanal en S/">
                  <input class="input js-premio" type="text" value="${ER.esc(x.premio)}" data-id="${x.motorizado.id}" placeholder="Premio de la meta" style="height:30px;min-height:30px;padding:4px 7px;font-size:12px" title="Premio editable">
                </div>
              </div>
            </div>
          </div>
        </div>`).join('') : `<div class="empty" style="padding:24px 10px">
          <p>Asigna una meta semanal a tus motorizados para ver su avance y su premio.</p>
          <a class="btn sm" href="#/motorizados">Configurar metas</a>
        </div>`;

      /* ---------- Equipo de hoy ---------- */
      const equipoHtml = equipo.length ? `<div class="grid auto-260" style="gap:9px">${equipo.map((x) => {
        let badge = '<span class="badge">Programado</span>';
        if (x.estado === 'asistio') badge = '<span class="badge green">Asistió</span>';
        if (x.estado === 'tarde') badge = '<span class="badge warn">Tardanza</span>';
        if (x.estado === 'falta') badge = '<span class="badge red">Falta</span>';
        if (x.estado === 'pendiente') badge = '<span class="badge">Por llegar</span>';
        return `<div class="row gap-8" style="padding:9px 10px;border:1px solid var(--border);border-radius:11px;background:var(--surface-2)">
          ${ER.avatar(x.motorizado.nombre, 'sm')}
          <div class="grow" style="min-width:0">
            <div class="truncate bold" style="font-size:12.5px">${ER.esc(x.motorizado.nombre)}</div>
            <div class="xs muted">${ER.timeLabel(x.schedule.inicio)} – ${ER.timeLabel(x.schedule.fin)} · ${x.motorizado.turno === 'noche' ? 'Noche' : 'Día'}</div>
          </div>
          ${badge}
        </div>`;
      }).join('')}</div>` : '<div class="empty" style="padding:24px 10px"><p>Hoy no hay motorizados programados.</p><a class="btn sm" href="#/horario">Revisar horario</a></div>';

      const rangoInputs = f.preset === 'rango' ? `
        <div class="row gap-6 wrap" style="margin-top:8px">
          <input class="input" type="date" id="dash-from" value="${range.from}" style="width:auto;min-height:38px;padding:7px 9px">
          <span class="muted small">al</span>
          <input class="input" type="date" id="dash-to" value="${range.to}" style="width:auto;min-height:38px;padding:7px 9px">
          <button class="btn primary sm" data-action="aplicar-rango">Aplicar</button>
        </div>` : '';

      return `
      <div class="between wrap mb-16" style="gap:10px">
        <div>
          <div class="chips">
            ${[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['año', 'Año'], ['todo', 'Todo'], ['rango', 'Rango']].map(([id, lb]) =>
              `<button class="chip ${f.preset === id ? 'active' : ''}" data-action="dash-filtro" data-preset="${id}">${lb}</button>`).join('')}
          </div>
          ${rangoInputs}
        </div>
        <div class="row gap-6 wrap">
          <span class="badge outline">${ER.esc(range.label)}</span>
          <a class="btn sm primary" href="#/carga">${ER.icon('zap')} Carga rápida</a>
        </div>
      </div>

      ${avisos ? `<div class="alerts mb-16">${avisos}</div>` : ''}

      <div class="grid kpi mb-16">
        <div class="card stat dark">
          <div class="label">Mi comisión · ${ER.esc(ER.periodLabel(f.preset))}</div>
          <div class="value">${ER.money(st.comision)}</div>
          <div class="meta">${st.count} ${ER.plural(st.count, 'ruta', 'rutas')} · ticket medio ${ER.money(st.ticket)}</div>
        </div>
        <div class="card stat"><span class="accent"></span>
          <div class="label">Total generado</div>
          <div class="value">${ER.money(st.total)}</div>
          <div class="meta">${st.unicos} motorizados activos en el periodo</div>
        </div>
        <div class="card stat"><span class="accent" style="background:#3B82F6"></span>
          <div class="label">Rutas registradas</div>
          <div class="value">${ER.num(st.count)}</div>
          <div class="meta">Promedio ${ER.money(st.promedio)} por ruta</div>
        </div>
        <div class="card stat"><span class="accent" style="background:#EF4444"></span>
          <div class="label">Por cobrar</div>
          <div class="value" style="color:${deudas.length ? 'var(--danger)' : 'inherit'}">${ER.money(ER.totalDeuda())}</div>
          <div class="meta">${deudas.length} ${ER.plural(deudas.length, 'motorizado con saldo', 'motorizados con saldo')}</div>
        </div>
      </div>

      <div class="grid cols-3 mb-16">
        <div class="card stat"><span class="accent"></span>
          <div class="label">Comisión de la semana</div>
          <div class="value sm">${ER.money(ER.statsRange(ER.startOfWeek(ER.today()), ER.endOfWeek(ER.today())).comision)}</div>
          <div class="meta">${deltaBadge(comp.semana.pct, 'vs. semana pasada')}</div>
        </div>
        <div class="card stat"><span class="accent"></span>
          <div class="label">Comisión del mes</div>
          <div class="value sm">${ER.money(ER.statsRange(ER.startOfMonth(ER.today()), ER.endOfMonth(ER.today())).comision)}</div>
          <div class="meta">${deltaBadge(comp.mes.pct, 'vs. mismo tramo del mes pasado')}</div>
        </div>
        <div class="card stat"><span class="accent"></span>
          <div class="label">Comisión del año</div>
          <div class="value sm">${ER.money(ER.statsRange(ER.today().slice(0, 4) + '-01-01', ER.today().slice(0, 4) + '-12-31').comision)}</div>
          <div class="meta">${ER.num(ER.statsRange(ER.today().slice(0, 4) + '-01-01', ER.today().slice(0, 4) + '-12-31').count)} rutas en ${ER.today().slice(0, 4)}</div>
        </div>
      </div>

      <div class="grid split-2-1 mb-16">
        <div class="card">
          <div class="card-h">
            <div><h3>Gráfico por ${serie.tipo === 'mes' ? 'mes' : 'día'}</h3><div class="sub">${ER.esc(range.label)}</div></div>
            <div class="chips">
              <button class="chip ${chartMode === 'comision' ? 'active' : ''}" data-action="chart-mode" data-mode="comision">Comisión</button>
              <button class="chip ${chartMode === 'total' ? 'active' : ''}" data-action="chart-mode" data-mode="total">Generado</button>
            </div>
          </div>
          <div class="card-b" style="padding:12px 10px 6px">
            ${ER.chartSVG(serie.puntos, { field: chartMode, title: 'Evolución del periodo' })}
          </div>
        </div>
        <div class="card">
          <div class="card-h"><div><h3>Top motorizados</h3><div class="sub">Por total generado</div></div><a class="btn ghost sm" href="#/reportes">Ver reporte</a></div>
          <div class="card-b" style="padding:10px 16px">${topHtml}</div>
        </div>
      </div>

      <div class="grid cols-2 mb-16">
        <div class="card">
          <div class="card-h"><div><h3>Comparativo</h3><div class="sub">Contra el periodo anterior equivalente</div></div></div>
          <div class="card-b">
            <div class="list-row">
              <div class="grow"><div class="bold small">Semana actual vs. anterior</div><div class="xs muted">${ER.money(comp.semana.actual)} vs. ${ER.money(comp.semana.anterior)}</div></div>
              ${deltaBadge(comp.semana.pct)}
            </div>
            <div class="list-row">
              <div class="grow"><div class="bold small">Mes actual vs. mismo tramo</div><div class="xs muted">${ER.money(comp.mes.actual)} vs. ${ER.money(comp.mes.anterior)}</div></div>
              ${deltaBadge(comp.mes.pct)}
            </div>
            <div class="list-row" style="border-bottom:none">
              <div class="grow"><div class="bold small">Proyección del mes</div><div class="xs muted">Al día ${proj.dia} de ${proj.totalDias}, según tu ritmo actual</div></div>
              <div class="right"><div class="bold mono">${ER.money(proj.proyectado)}</div><div class="xs muted">faltan ${ER.money(proj.faltan)}</div></div>
            </div>
            <div class="progress" style="margin-top:8px"><span style="width:${Math.min(100, Math.round((proj.dia / proj.totalDias) * 100))}%"></span></div>
            <div class="xs muted mt-4">Avance del mes: ${Math.round((proj.dia / proj.totalDias) * 100)}% de los días transcurridos.</div>
          </div>
        </div>

        <div class="card">
          <div class="card-h"><div><h3>Resumen por zona</h3><div class="sub">Nuevo Chimbote · ${ER.esc(range.label)}</div></div><a class="btn ghost sm" href="#/registro">Registro</a></div>
          <div class="card-b" style="padding:10px 16px">${zonasHtml}</div>
        </div>
      </div>

      <div class="grid split-2-1 mb-16">
        <div class="card">
          <div class="card-h"><div><h3>Metas semanales y premios</h3><div class="sub">Avance de la semana actual · premio editable</div></div><a class="btn ghost sm" href="#/motorizados">Editar fichas</a></div>
          <div class="card-b" style="padding:12px 14px">${metasHtml}</div>
        </div>
        <div class="card">
          <div class="card-h"><div><h3>Quién trabaja hoy</h3><div class="sub">${ER.fmtDate(ER.today(), 'weekdayLong')}</div></div><a class="btn ghost sm" href="#/asistencia">Asistencia</a></div>
          <div class="card-b" style="padding:12px 14px">${equipoHtml}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div><h3>Accesos rápidos</h3><div class="sub">Lo que más vas a usar</div></div></div>
        <div class="card-b">
          <div class="grid auto-260" style="gap:9px">
            <a class="btn" href="#/rutas">${ER.icon('plus')} Nueva ruta</a>
            <a class="btn" href="#/carga">${ER.icon('zap')} Carga rápida</a>
            <a class="btn" href="#/cobros">${ER.icon('cash')} Cobros y abonos</a>
            <a class="btn" href="#/asistencia">${ER.icon('clock')} Registrar asistencia</a>
            <a class="btn" href="#/reportes">${ER.icon('chart')} Reporte semanal</a>
            <a class="btn" href="#/calendario">${ER.icon('star')} Fechas de demanda</a>
          </div>
          <div class="divider"></div>
          <div class="row wrap gap-16">
            <div><div class="xs muted">Hoy</div><div class="bold">${ER.money(ingresosDia.comision)} <span class="xs muted">comisión</span></div></div>
            <div><div class="xs muted">Ayer</div><div class="bold">${ER.money(ER.statsRange(ER.addDays(ER.today(), -1), ER.addDays(ER.today(), -1)).comision)} <span class="xs muted">comisión</span></div></div>
            <div><div class="xs muted">Saludo</div><div class="bold">${saludo()}</div></div>
          </div>
        </div>
      </div>`;
    },

    mount(root) {
      root.querySelectorAll('.js-meta').forEach((inp) => {
        inp.addEventListener('change', () => {
          const m = ER.getMotorizado(inp.dataset.id);
          if (!m) return;
          m.metaSemanal = Math.max(0, Number(inp.value) || 0);
          ER.log('Meta actualizada', `${m.nombre}: ${ER.money(m.metaSemanal)}`);
          ER.save();
          ER.render();
        });
      });
      root.querySelectorAll('.js-premio').forEach((inp) => {
        inp.addEventListener('change', () => {
          const m = ER.getMotorizado(inp.dataset.id);
          if (!m) return;
          m.premio = inp.value.trim();
          ER.log('Premio actualizado', `${m.nombre}: ${m.premio}`);
          ER.save();
          ER.toast('Premio guardado', 'ok');
        });
      });
    }
  };

  /* ------------------------------ Modal de pendientes ------------------------------ */
  ER.openPendientes = function () {
    const diarias = ER.pendingDaily();
    const viejas = ER.pendingOlder();
    const semanales = ER.pendingWeekly();

    function filaDiaria(x) {
      const m = x.motorizado;
      return `<div class="list-row">
        ${ER.avatar(m.nombre, 'sm')}
        <div class="grow" style="min-width:0">
          <div class="bold truncate" style="font-size:13px">${ER.esc(m.nombre)}</div>
          <div class="xs muted">Ayer · ${ER.fmtDate(x.fecha, 'weekday')} · ${m.tipo === 'parcial' ? 'Parcial' : 'En ruta'}</div>
        </div>
        <div class="row gap-4">
          <button class="btn sm primary" data-action="pend-registrar" data-mid="${m.id}" data-fecha="${x.fecha}">Registrar</button>
          <button class="btn sm" data-action="pend-sin" data-mid="${m.id}" data-fecha="${x.fecha}" title="Sí trabajó, pero no tuvo pedidos">Sin pedidos</button>
        </div>
      </div>`;
    }

    const body = `
      <div class="alert yellow" style="margin-bottom:14px">
        <div class="a-icon">${ER.icon('alert')}</div>
        <div class="grow">
          <div class="a-title">Pendientes de comisión de ayer</div>
          <div class="a-text">Faltan ${diarias.length} ${ER.plural(diarias.length, 'motorizado', 'motorizados')}. Si trabajó pero no generó nada, usa “Sin pedidos”.</div>
        </div>
      </div>
      ${diarias.length ? `<div>${diarias.map(filaDiaria).join('')}</div>` : '<div class="empty" style="padding:18px"><h3>¡Todo al día!</h3><p>No hay comisiones de ayer pendientes.</p></div>'}

      ${viejas.length ? `<div class="form-section">Días anteriores sin registrar</div>
        <div class="small muted mb-8">Estos días también quedaron sin ruta. Puedes regularizarlos.</div>
        ${viejas.map((x) => `<div class="list-row">
          ${ER.avatar(x.motorizado.nombre, 'sm')}
          <div class="grow" style="min-width:0"><div class="bold truncate" style="font-size:12.5px">${ER.esc(x.motorizado.nombre)}</div><div class="xs muted">${ER.fmtDate(x.fecha, 'weekdayLong')}</div></div>
          <button class="btn sm" data-action="pend-registrar" data-mid="${x.motorizado.id}" data-fecha="${x.fecha}">Registrar</button>
          <button class="btn sm ghost" data-action="pend-sin" data-mid="${x.motorizado.id}" data-fecha="${x.fecha}">Sin pedidos</button>
        </div>`).join('')}` : ''}

      ${semanales.length ? `<div class="form-section">Comisiones semanales (parciales)</div>
        ${semanales.map((x) => `<div class="list-row">
          ${ER.avatar(x.motorizado.nombre, 'sm')}
          <div class="grow" style="min-width:0"><div class="bold truncate" style="font-size:12.5px">${ER.esc(x.motorizado.nombre)}</div><div class="xs muted">Semana ${ER.fmtRange(x.from, x.to)}</div></div>
          <button class="btn sm primary" data-action="pend-registrar" data-mid="${x.motorizado.id}">Registrar</button>
          <button class="btn sm" data-action="pend-sin-semana" data-mid="${x.motorizado.id}">Sin pedidos</button>
        </div>`).join('')}` : ''}

      <div class="form-section">Ya registrados hoy</div>
      <div class="xs muted">A medida que registres, el contador del inicio bajará automáticamente.</div>`;

    ER.modal({
      title: 'Comisiones pendientes',
      subtitle: `Actualizado ${ER.fmtDate(ER.today(), 'weekdayLong')}`,
      body,
      size: 'lg',
      footer: `<button class="btn" data-close type="button">Cerrar</button>
               <a class="btn primary" href="#/carga" data-close>${ER.icon('zap')} Ir a carga rápida</a>`
    });
  };

})();
