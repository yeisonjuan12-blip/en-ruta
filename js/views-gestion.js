/* ============================================================
   EN RUTA — Notas, Calendario, Reportes, Papelera y Ajustes
   ============================================================ */
(function () {
  'use strict';
  const ER = window.ER;
  if (!ER) return;

  /* ============================================================
     LOGO
     ============================================================ */
  ER.applyLogo = function () {
    const src = ER.S.config.logo || 'logo.svg';
    ['brand-logo', 'brand-logo-mobile'].forEach((id) => {
      const img = document.getElementById(id);
      if (img) img.src = src;
    });
  };

  /* ============================================================
     NOTAS Y RECLAMOS
     ============================================================ */
  ER.notasTodas = function () {
    const manuales = ER.S.notas.map((n) => ({
      key: 'n:' + n.id, origen: 'manual', id: n.id, motorizadoId: n.motorizadoId,
      fecha: n.fecha, tipo: n.tipo || 'nota', titulo: n.titulo || '', texto: n.texto || '',
      estado: n.estado || 'pendiente', createdAt: n.createdAt
    }));
    const deRutas = ER.S.rutas.filter((r) => r.nota && String(r.nota).trim()).map((r) => ({
      key: 'r:' + r.id, origen: 'ruta', id: r.id, motorizadoId: r.motorizadoId,
      fecha: r.fecha, tipo: 'pedido', titulo: 'Nota de pedido',
      texto: r.nota, estado: r.notaEstado || 'pendiente', createdAt: r.createdAt, ruta: r
    }));
    return manuales.concat(deRutas).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  };

  ER.openNotaForm = function (mid, id) {
    const n = id ? ER.S.notas.find((x) => x.id === id) : null;
    const opcionesM = ER.ordenarMotorizados(ER.S.motorizados).map((m) => `<option value="${m.id}" ${((n && n.motorizadoId === m.id) || (!n && mid === m.id)) ? 'selected' : ''}>${ER.esc(m.nombre)}</option>`).join('');
    ER.modal({
      title: n ? 'Editar nota' : 'Nueva nota o reclamo',
      subtitle: n ? ER.esc(n.titulo || '') : 'Sirve para la reunión semanal o el cierre de mes.',
      size: 'sm',
      body: `<div class="form-grid" style="grid-template-columns:1fr">
        <div class="field"><label>Fecha</label><input class="input" type="date" id="nt-fecha" value="${n ? n.fecha : ER.today()}"></div>
        <div class="field"><label>Motorizado</label><select class="select" id="nt-mid"><option value="">General (sin motorizado)</option>${opcionesM}</select></div>
        <div class="field"><label>Tipo</label><select class="select" id="nt-tipo">
          <option value="nota" ${!n || n.tipo === 'nota' ? 'selected' : ''}>Nota</option>
          <option value="reclamo" ${n && n.tipo === 'reclamo' ? 'selected' : ''}>Reclamo</option>
        </select></div>
        <div class="field"><label>Título</label><input class="input" id="nt-titulo" value="${n ? ER.esc(n.titulo || '') : ''}" placeholder="Ej. Pedido cobrado de más"></div>
        <div class="field"><label>Detalle</label><textarea class="textarea" id="nt-texto" rows="4" placeholder="¿Qué pasó? ¿Qué se revisó?">${n ? ER.esc(n.texto || '') : ''}</textarea></div>
        <div class="field"><label>Estado</label><select class="select" id="nt-estado">
          <option value="pendiente" ${!n || n.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="tratado" ${n && n.estado === 'tratado' ? 'selected' : ''}>Tratado</option>
        </select></div>
      </div>`,
      footer: `${n ? `<button class="btn danger sm left" data-del type="button">${ER.icon('trash')} Eliminar</button>` : ''}
        <button class="btn" data-close type="button">Cancelar</button>
        <button class="btn primary" data-ok type="button">${ER.icon('check')} Guardar</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const fecha = el.querySelector('#nt-fecha').value || ER.today();
          const texto = el.querySelector('#nt-texto').value.trim();
          const titulo = el.querySelector('#nt-titulo').value.trim();
          if (!texto) { ER.toast('Escribe el detalle de la nota', 'err'); return; }
          const obj = {
            motorizadoId: el.querySelector('#nt-mid').value || null,
            fecha, tipo: el.querySelector('#nt-tipo').value, titulo: titulo || (el.querySelector('#nt-tipo').value === 'reclamo' ? 'Reclamo' : 'Nota'),
            texto, estado: el.querySelector('#nt-estado').value
          };
          if (n) Object.assign(n, obj);
          else ER.S.notas.push({ id: ER.uid(), ...obj, createdAt: new Date().toISOString() });
          ER.log(n ? 'Nota editada' : 'Nota creada', `${obj.titulo}${obj.motorizadoId ? ' · ' + ER.nombreMotorizado(obj.motorizadoId) : ''}`);
          ER.save(); close(); ER.render(); ER.toast('Nota guardada', 'ok');
        });
        const del = el.querySelector('[data-del]');
        if (del) del.addEventListener('click', async () => {
          if (!await ER.confirm('¿Eliminar esta nota? Se enviará a la papelera.', { title: 'Eliminar nota', danger: true, ok: 'Eliminar' })) return;
          ER.aPapelera('nota', JSON.parse(JSON.stringify(n)), n.titulo || 'Nota');
          ER.S.notas = ER.S.notas.filter((x) => x.id !== n.id);
          ER.save(); close(); ER.render(); ER.toast('Nota eliminada', 'ok');
        });
      }
    });
  };

  ER.views.notas = {
    render() {
      const ui = ER.ui.notas;
      let notas = ER.notasTodas();
      if (ui.q) {
        const q = ui.q.toLowerCase();
        notas = notas.filter((n) => (n.titulo + ' ' + n.texto + ' ' + ER.nombreMotorizado(n.motorizadoId, '')).toLowerCase().includes(q));
      }
      if (ui.motorizado) notas = notas.filter((n) => n.motorizadoId === ui.motorizado);
      if (ui.tipo) notas = notas.filter((n) => n.tipo === ui.tipo);
      if (ui.estado) notas = notas.filter((n) => n.estado === ui.estado);
      if (ui.from) notas = notas.filter((n) => n.fecha >= ui.from);
      if (ui.to) notas = notas.filter((n) => n.fecha <= ui.to);

      const pendientes = notas.filter((n) => n.estado === 'pendiente').length;
      const opcionesM = ER.ordenarMotorizados(ER.S.motorizados).map((m) => `<option value="${m.id}" ${ui.motorizado === m.id ? 'selected' : ''}>${ER.esc(m.nombre)}</option>`).join('');

      const cards = notas.map((n) => `<div class="card note-card ${n.estado}" style="box-shadow:none;margin-bottom:9px">
        <div class="card-b" style="padding:13px 14px">
          <div class="between wrap gap-6">
            <div class="row wrap gap-4">
              <span class="badge ${n.tipo === 'reclamo' ? 'red' : n.tipo === 'pedido' ? 'yellow' : 'blue'}">${n.tipo === 'reclamo' ? 'Reclamo' : n.tipo === 'pedido' ? 'Pedido' : 'Nota'}</span>
              <span class="badge ${n.estado === 'tratado' ? 'green' : 'warn'}">${n.estado === 'tratado' ? 'Tratado' : 'Pendiente'}</span>
              <span class="xs muted">${ER.fmtDate(n.fecha)}</span>
              <span class="xs muted">·</span>
              <span class="xs bold">${ER.esc(ER.nombreMotorizado(n.motorizadoId, 'General'))}</span>
            </div>
            <button class="btn sm ghost" data-action="nota-estado" data-key="${n.key}" data-origen="${n.origen}" data-id="${n.id}" title="Cambiar estado">${ER.icon(n.estado === 'tratado' ? 'refresh' : 'check')} ${n.estado === 'tratado' ? 'Reabrir' : 'Tratar'}</button>
          </div>
          ${n.titulo ? `<div class="bold mt-8" style="font-size:13px">${ER.esc(n.titulo)}</div>` : ''}
          <div class="small muted mt-4" style="line-height:1.5">${ER.esc(n.texto)}</div>
          <div class="row gap-4 mt-8 wrap">
            ${n.origen === 'manual' ? `<button class="btn sm" data-action="nota-editar" data-id="${n.id}">${ER.icon('edit')} Editar</button>` : `<button class="btn sm" data-action="nota-ver-ruta" data-id="${n.id}">${ER.icon('map')} Ver ruta</button>`}
            ${n.origen === 'manual' ? `<button class="btn sm ghost" data-action="nota-eliminar" data-id="${n.id}" style="color:var(--danger)">${ER.icon('trash')}</button>` : ''}
            ${n.origen === 'pedido' ? `<span class="xs muted">${ER.esc(n.ruta ? n.ruta.pedidos : '')}</span>` : ''}
          </div>
        </div>
      </div>`).join('');

      return `
      <div class="between wrap mb-16" style="gap:10px">
        <div class="row gap-8 wrap">
          <span class="badge ${pendientes ? 'warn' : 'green'}">${pendientes} ${ER.plural(pendientes, 'pendiente', 'pendientes')}</span>
          <span class="badge outline">${notas.length} en total</span>
        </div>
        <button class="btn primary" data-action="nota-nueva">${ER.icon('plus')} Nueva nota</button>
      </div>

      <div class="card mb-16">
        <div class="card-b" style="padding:13px">
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px">
            <div class="field"><label>Buscar</label><div class="search-box"><svg class="icon"><use href="#i-search"/></svg><input class="input" id="notas-q" value="${ER.esc(ui.q)}" placeholder="Texto, motorizado…"></div></div>
            <div class="field"><label>Motorizado</label><select class="select" id="notas-mid"><option value="">Todos</option>${opcionesM}</select></div>
            <div class="field"><label>Tipo</label><select class="select" id="notas-tipo"><option value="">Todos</option><option value="nota" ${ui.tipo === 'nota' ? 'selected' : ''}>Notas</option><option value="reclamo" ${ui.tipo === 'reclamo' ? 'selected' : ''}>Reclamos</option><option value="pedido" ${ui.tipo === 'pedido' ? 'selected' : ''}>Notas de pedido</option></select></div>
            <div class="field"><label>Estado</label><select class="select" id="notas-estado"><option value="">Todos</option><option value="pendiente" ${ui.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="tratado" ${ui.estado === 'tratado' ? 'selected' : ''}>Tratado</option></select></div>
            <div class="field"><label>Desde</label><input class="input" type="date" id="notas-from" value="${ui.from || ''}"></div>
            <div class="field"><label>Hasta</label><input class="input" type="date" id="notas-to" value="${ui.to || ''}"></div>
          </div>
        </div>
      </div>

      ${notas.length ? cards : `<div class="card"><div class="empty">
        <div class="empty-icon">${ER.icon('message')}</div>
        <h3>No hay notas ni reclamos</h3>
        <p>Aquí se juntan las notas de las rutas y las que crees desde la ficha del motorizado.</p>
        <button class="btn primary" data-action="nota-nueva">${ER.icon('plus')} Crear nota</button>
      </div></div>`}`;
    },
    mount(root) {
      const q = root.querySelector('#notas-q');
      if (q) q.addEventListener('input', ER.debounce(() => {
        ER.ui.notas.q = q.value; ER.render();
        const el = document.getElementById('notas-q');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 280));
      const bind = (sel, key) => {
        const el = root.querySelector(sel);
        if (el) el.addEventListener('change', () => { ER.ui.notas[key] = el.value; ER.render(); });
      };
      bind('#notas-mid', 'motorizado');
      bind('#notas-tipo', 'tipo');
      bind('#notas-estado', 'estado');
      bind('#notas-from', 'from');
      bind('#notas-to', 'to');
    }
  };

  /* ============================================================
     CALENDARIO DE DEMANDA
     ============================================================ */
  ER.views.calendario = {
    render() {
      const ui = ER.ui.calendario || (ER.ui.calendario = {});
      const mes = ui.mes || ER.startOfMonth(ER.today());
      const first = mes;
      const start = ER.startOfWeek(first);
      const cells = Array.from({ length: 42 }, (_, i) => ER.addDays(start, i));
      const mesKey = mes.slice(0, 7);
      const upcoming = ER.upcomingDemand(60);
      const cfg = ER.S.config;

      const dow = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const grid = cells.map((d) => {
        const out = d.slice(0, 7) !== mesKey;
        const evs = ER.demandDates(Number(d.slice(0, 4))).filter((x) => x.fecha === d);
        return `<button class="cal-cell ${out ? 'out' : ''} ${d === ER.today() ? 'today' : ''}" data-action="calendario-dia" data-fecha="${d}" type="button">
          <span class="dnum">${Number(d.slice(8, 10))}</span>
          ${evs.slice(0, 2).map((e) => `<span class="cal-ev ${e.custom ? 'custom' : e.tipo === 'nacional' ? 'holiday' : ''}" title="${ER.esc(e.nombre)}">${ER.esc(e.nombre)}</span>`).join('')}
          ${evs.length > 2 ? `<span class="xs muted">+${evs.length - 2}</span>` : ''}
        </button>`;
      }).join('');

      const upcomingHtml = upcoming.length ? upcoming.map((d) => {
        const dias = ER.daysBetween(ER.today(), d.fecha);
        return `<div class="list-row">
          <div class="avatar sm" style="background:${d.custom ? 'var(--info-bg)' : 'var(--yellow-100)'};color:${d.custom ? 'var(--info)' : '#7A5C00'};font-size:10px">${Number(d.fecha.slice(8, 10))}</div>
          <div class="grow" style="min-width:0">
            <div class="between wrap" style="gap:4px"><span class="bold small">${ER.esc(d.nombre)}</span><span class="badge ${dias <= 7 ? 'warn' : 'outline'}">${dias === 0 ? 'Hoy' : 'Faltan ' + dias + ' días'}</span></div>
            <div class="xs muted">${ER.fmtDate(d.fecha, 'weekdayLong')} · ${d.tipo === 'propia' ? 'Fecha propia' : d.tipo === 'comercial' ? 'Comercial' : 'Nacional'}${d.nota ? ' · ' + ER.esc(d.nota) : ''}</div>
          </div>
          ${d.custom ? `<button class="icon-btn" data-action="demanda-editar" data-id="${d.id}" title="Editar">${ER.icon('edit', 'sm')}</button>` : ''}
        </div>`;
      }).join('') : '<div class="empty" style="padding:20px"><p>No hay fechas en los próximos 60 días.</p></div>';

      return `
      <div class="alert blue mb-16">
        <div class="a-icon">${ER.icon('star')}</div>
        <div class="grow"><div class="a-title">Aviso con ${cfg.diasAvisoDemanda} días de anticipación</div>
        <div class="a-text">Las fechas nacionales y comerciales del Perú se calculan solas (incluido el Día del Pollo a la Brasa, el tercer domingo de julio). Agrega tus propias fechas para avisar al grupo de marketing.</div></div>
        <button class="btn sm primary" data-action="demanda-add">${ER.icon('plus')} Agregar fecha</button>
      </div>

      <div class="grid split-2-1">
        <div class="card cal-card">
          <div class="card-h" style="flex-wrap:wrap;gap:8px">
            <div class="row gap-6">
              <button class="btn sm" data-action="calendario-prev">${ER.icon('chevron-left')}</button>
              <h3 style="min-width:130px;text-align:center">${ER.fmtDate(mes, 'month')}</h3>
              <button class="btn sm" data-action="calendario-next">${ER.icon('chevron-right')}</button>
            </div>
            <div class="row gap-6">
              <button class="btn sm" data-action="calendario-hoy">Hoy</button>
              <span class="badge yellow">${ER.icon('star', 'sm')} Demanda</span>
            </div>
          </div>
          <div class="card-b" style="padding:12px">
            <div class="cal-grid" style="margin-bottom:5px">${dow.map((d) => `<div class="cal-dow">${d}</div>`).join('')}</div>
            <div class="cal-grid">${grid}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-h"><div><h3>Próximas fechas</h3><div class="sub">Siguientes 60 días</div></div></div>
          <div class="card-b" style="padding:6px 16px;max-height:520px;overflow-y:auto">${upcomingHtml}</div>
        </div>
      </div>`;
    },
    mount() {}
  };

  ER.openDemandaForm = function (id, fecha) {
    const c = id ? ER.S.config.demandaCustom.find((x) => x.id === id) : null;
    ER.modal({
      title: c ? 'Editar fecha de demanda' : 'Agregar fecha de demanda',
      subtitle: 'Se avisará en el inicio y en el calendario.',
      size: 'sm',
      body: `<div class="grid" style="grid-template-columns:1fr;gap:12px">
        <div class="field"><label>Fecha <span class="req">*</span></label><input class="input" type="date" id="dm-fecha" value="${c ? c.fecha : (fecha || ER.today())}"></div>
        <div class="field"><label>Nombre <span class="req">*</span></label><input class="input" id="dm-nombre" value="${c ? ER.esc(c.nombre) : ''}" placeholder="Ej. Aniversario de la base"></div>
        <div class="field"><label>Nota para marketing</label><textarea class="textarea" id="dm-nota" rows="3" placeholder="Ej. Preparar video y promoción con anticipación.">${c ? ER.esc(c.nota || '') : ''}</textarea></div>
      </div>`,
      footer: `${c ? `<button class="btn danger sm left" data-del type="button">Eliminar</button>` : ''}<button class="btn" data-close type="button">Cancelar</button><button class="btn primary" data-ok type="button">Guardar</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const fechaV = el.querySelector('#dm-fecha').value;
          const nombre = el.querySelector('#dm-nombre').value.trim();
          const nota = el.querySelector('#dm-nota').value.trim();
          if (!fechaV || !nombre) { ER.toast('Completa la fecha y el nombre', 'err'); return; }
          if (c) Object.assign(c, { fecha: fechaV, nombre, nota });
          else ER.S.config.demandaCustom.push({ id: ER.uid(), fecha: fechaV, nombre, nota });
          ER.log(c ? 'Fecha de demanda editada' : 'Fecha de demanda agregada', `${nombre} · ${ER.fmtDate(fechaV)}`);
          ER.save(); close(); ER.render(); ER.toast('Fecha guardada', 'ok');
        });
        const del = el.querySelector('[data-del]');
        if (del) del.addEventListener('click', async () => {
          if (!await ER.confirm('¿Eliminar esta fecha propia?', { title: 'Eliminar fecha', danger: true, ok: 'Eliminar' })) return;
          ER.S.config.demandaCustom = ER.S.config.demandaCustom.filter((x) => x.id !== c.id);
          ER.save(); close(); ER.render(); ER.toast('Fecha eliminada', 'ok');
        });
      }
    });
  };

  ER.actions['calendario-prev'] = () => { ER.ui.calendario.mes = ER.addMonths(ER.ui.calendario.mes || ER.startOfMonth(ER.today()), -1); ER.render(); };
  ER.actions['calendario-next'] = () => { ER.ui.calendario.mes = ER.addMonths(ER.ui.calendario.mes || ER.startOfMonth(ER.today()), 1); ER.render(); };
  ER.actions['calendario-hoy'] = () => { ER.ui.calendario.mes = ER.startOfMonth(ER.today()); ER.render(); };
  ER.actions['demanda-add'] = () => ER.openDemandaForm();
  ER.actions['demanda-editar'] = (el) => ER.openDemandaForm(el.dataset.id);
  ER.actions['calendario-dia'] = (el) => {
    const fecha = el.dataset.fecha;
    const evs = ER.demandDates(Number(fecha.slice(0, 4))).filter((x) => x.fecha === fecha);
    ER.modal({
      title: ER.fmtDate(fecha, 'weekdayLong'),
      subtitle: 'Fechas de demanda de este día',
      size: 'sm',
      body: evs.length ? `<div class="list-plain">${evs.map((e) => `<div class="list-row">
        <div class="avatar sm" style="background:var(--yellow-100);color:#7A5C00">${ER.icon('star', 'sm')}</div>
        <div class="grow"><div class="bold small">${ER.esc(e.nombre)}</div><div class="xs muted">${e.tipo === 'propia' ? 'Fecha propia' : e.tipo === 'comercial' ? 'Comercial' : 'Nacional'}${e.nota ? ' · ' + ER.esc(e.nota) : ''}</div></div>
        ${e.custom ? `<button class="icon-btn" data-action="demanda-editar" data-id="${e.id}">${ER.icon('edit', 'sm')}</button>` : ''}
      </div>`).join('')}</div>` : '<div class="empty" style="padding:20px"><p>Sin fechas de demanda para este día.</p></div>',
      footer: `<button class="btn" data-close type="button">Cerrar</button><button class="btn primary" data-add-fecha tipo="button">${ER.icon('plus')} Agregar fecha</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-add-fecha]').addEventListener('click', () => { close(); ER.openDemandaForm(null, fecha); });
      }
    });
  };

  /* ============================================================
     REPORTES
     ============================================================ */
  ER.views.reportes = {
    render() {
      const ui = ER.ui.reportes || (ER.ui.reportes = { preset: 'mes' });
      const range = ER.rangeOf(ui.preset, ui.from, ui.to);
      const st = ER.statsRange(range.from, range.to);
      const top = ER.topMotorizados(range.from, range.to, 10);
      const zonas = ER.resumenZonas(range.from, range.to);
      const serie = ER.seriesRango(range.from, range.to);
      const comp = ER.comparativo();
      const asist = ER.resumenAsistenciaTodos(range.from, range.to);
      const maxTop = Math.max(1, ...top.map((t) => t.total));
      const texto = ER.msgReporte(ER.periodLabel(ui.preset), range.from, range.to);

      const rangoInputs = ui.preset === 'rango' ? `<div class="row gap-6 wrap mt-8">
        <input class="input" type="date" id="rep-from" value="${range.from}" style="width:auto;min-height:38px;padding:7px 9px">
        <span class="muted small">al</span>
        <input class="input" type="date" id="rep-to" value="${range.to}" style="width:auto;min-height:38px;padding:7px 9px">
        <button class="btn primary sm" data-action="reportes-rango">Aplicar</button>
      </div>` : '';

      return `
      <div class="between wrap mb-16" style="gap:10px">
        <div>
          <div class="chips">
            ${[['semana', 'Semana'], ['semana_pasada', 'Semana pasada'], ['mes', 'Mes'], ['mes_pasado', 'Mes pasado'], ['año', 'Año'], ['rango', 'Rango']].map(([id, lb]) =>
              `<button class="chip ${ui.preset === id ? 'active' : ''}" data-action="reportes-preset" data-preset="${id}">${lb}</button>`).join('')}
          </div>
          ${rangoInputs}
        </div>
        <div class="row gap-6 wrap">
          <button class="btn sm" data-action="reporte-copiar">${ER.icon('copy')} Copiar reporte</button>
          <button class="btn sm wa" data-action="reporte-wa">${ER.icon('wa')} Compartir</button>
          <button class="btn sm" data-action="reporte-imprimir">${ER.icon('download')} Imprimir / PDF</button>
        </div>
      </div>

      <div class="card stat dark mb-16">
        <div class="label">Reporte · ${ER.esc(range.label)}</div>
        <div class="value">${ER.money(st.comision)}</div>
        <div class="meta">Mi comisión · ${ER.money(st.total)} generado · ${st.count} rutas · ${st.unicos} motorizados</div>
      </div>

      <div class="grid kpi mb-16">
        <div class="card stat"><span class="accent"></span><div class="label">Total generado</div><div class="value sm">${ER.money(st.total)}</div><div class="meta">Promedio ${ER.money(st.promedio)} por ruta</div></div>
        <div class="card stat"><span class="accent" style="background:#10B981"></span><div class="label">Mi comisión</div><div class="value sm">${ER.money(st.comision)}</div><div class="meta">Ticket medio ${ER.money(st.ticket)}</div></div>
        <div class="card stat"><span class="accent" style="background:#3B82F6"></span><div class="label">Rutas</div><div class="value sm">${st.count}</div><div class="meta">${st.unicos} motorizados participaron</div></div>
        <div class="card stat"><span class="accent" style="background:#F59E0B"></span><div class="label">Semana vs. anterior</div><div class="value sm">${comp.semana.pct > 0 ? '+' : ''}${comp.semana.pct}%</div><div class="meta">${ER.money(comp.semana.actual)} vs. ${ER.money(comp.semana.anterior)}</div></div>
      </div>

      <div class="card mb-16">
        <div class="card-h"><div><h3>Evolución del periodo</h3><div class="sub">Mi comisión por ${serie.tipo}</div></div><span class="badge outline">${ER.esc(range.label)}</span></div>
        <div class="card-b" style="padding:12px 10px 4px">${ER.chartSVG(serie.puntos, { field: 'comision', labels: 12 })}</div>
      </div>

      <div class="grid cols-2 mb-16">
        <div class="card">
          <div class="card-h"><div><h3>Top motorizados</h3><div class="sub">Por total generado</div></div></div>
          <div class="card-b" style="padding:10px 16px">
            ${top.length ? top.map((t, i) => `<div class="rank-row">
              <span class="rank-num">${i + 1}</span>${ER.avatar(t.nombre, 'sm')}
              <div class="grow" style="min-width:0">
                <div class="between" style="gap:6px"><span class="bold truncate" style="font-size:12.5px">${ER.esc(t.nombre)}</span><span class="mono bold" style="font-size:12.5px">${ER.money(t.total)}</span></div>
                <div class="row gap-6 mt-4"><div class="grow" style="height:5px;background:var(--surface-3);border-radius:99px;overflow:hidden"><div style="height:100%;width:${Math.max(3, (t.total / maxTop) * 100)}%;background:var(--yellow)"></div></div><span class="xs muted">${ER.money(t.comision)}</span></div>
              </div>
            </div>`).join('') : '<div class="empty" style="padding:20px"><p>Sin datos.</p></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-h"><div><h3>Resumen por zona</h3><div class="sub">${ER.esc(range.label)}</div></div></div>
          <div class="card-b" style="padding:10px 16px">
            ${zonas.length ? zonas.map((z) => `<div class="list-row">
              <div class="grow"><div class="between"><span class="small">${ER.icon('pin', 'sm')} ${ER.esc(z.zona)}</span><span class="mono small">${ER.money(z.total)}</span></div>
              <div class="progress thin mt-4"><span style="width:${Math.round((z.total / Math.max(1, zonas[0].total)) * 100)}%"></span></div></div>
            </div>`).join('') : '<div class="empty" style="padding:20px"><p>Sin zonas en el periodo.</p></div>'}
          </div>
        </div>
      </div>

      <div class="card mb-16">
        <div class="card-h"><div><h3>Puntualidad del periodo</h3><div class="sub">Para compartir con el equipo</div></div></div>
        <div class="table-wrap">
          <table class="table compact">
            <thead><tr><th>Motorizado</th><th>Programados</th><th>A tiempo</th><th>Tardanzas</th><th>Faltas</th><th>Puntualidad</th></tr></thead>
            <tbody>${asist.filter((x) => x.programados).map((x) => `<tr>
              <td>${ER.esc(x.motorizado.nombre)}</td><td>${x.programados}</td>
              <td>${x.asistio}</td><td>${x.tarde}</td><td>${x.falta}</td>
              <td><div class="progress-row"><div class="progress thin"><span style="width:${x.pctPuntual}%"></span></div><span class="pct">${x.pctPuntual}%</span></div></td>
            </tr>`).join('') || '<tr><td colspan="6" class="muted center" style="padding:18px">Sin datos de asistencia.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div><h3>Mensaje para compartir</h3><div class="sub">Listo para copiar y reenviar por WhatsApp</div></div>
          <div class="row gap-6"><button class="btn sm" data-action="reporte-copiar">${ER.icon('copy')} Copiar</button><button class="btn sm wa" data-action="reporte-wa">${ER.icon('wa')} WhatsApp</button></div>
        </div>
        <div class="card-b"><textarea class="textarea" id="reporte-texto" rows="9" style="font-size:12px;font-family:ui-monospace,Consolas,monospace" readonly>${ER.esc(texto)}</textarea></div>
      </div>`;
    },
    mount() {
      const f = document.getElementById('rep-from');
      const t = document.getElementById('rep-to');
      if (f && t) {
        [f, t].forEach((x) => x.addEventListener('change', () => {
          ER.ui.reportes.from = f.value;
          ER.ui.reportes.to = t.value;
          ER.ui.reportes.preset = 'rango';
          ER.render();
        }));
      }
    }
  };

  ER.actions['reportes-preset'] = (el) => {
    ER.ui.reportes.preset = el.dataset.preset;
    if (el.dataset.preset === 'rango' && !ER.ui.reportes.from) {
      ER.ui.reportes.from = ER.startOfWeek(ER.today());
      ER.ui.reportes.to = ER.today();
    }
    ER.render();
  };
  ER.actions['reportes-rango'] = () => {
    const f = document.getElementById('rep-from');
    const t = document.getElementById('rep-to');
    if (!f || !t || !f.value || !t.value) { ER.toast('Elige las dos fechas', 'err'); return; }
    ER.ui.reportes.from = f.value; ER.ui.reportes.to = t.value; ER.ui.reportes.preset = 'rango'; ER.render();
  };
  ER.actions['reporte-copiar'] = () => {
    const ta = document.getElementById('reporte-texto');
    if (ta) ER.copy(ta.value);
  };
  ER.actions['reporte-wa'] = () => {
    const ta = document.getElementById('reporte-texto');
    if (ta) ER.openWA('', ta.value);
  };
  ER.actions['reporte-imprimir'] = () => window.print();

  /* ============================================================
     PAPELERA / HISTORIAL / RESPALDOS
     ============================================================ */
  ER.views.papelera = {
    render() {
      const ui = ER.ui.papelera || (ER.ui.papelera = { tab: 'papelera' });
      const tab = ui.tab || 'papelera';
      const backups = ER.listBackups();

      const tabs = `<div class="chips mb-16">
        <button class="chip ${tab === 'papelera' ? 'active' : ''}" data-action="papelera-tab" data-tab="papelera">Papelera (${ER.S.papelera.length})</button>
        <button class="chip ${tab === 'historial' ? 'active' : ''}" data-action="papelera-tab" data-tab="historial">Historial de cambios</button>
        <button class="chip ${tab === 'respaldos' ? 'active' : ''}" data-action="papelera-tab" data-tab="respaldos">Respaldos (${backups.length})</button>
      </div>`;

      if (tab === 'historial') {
        const log = ER.S.log.slice(0, 200);
        return tabs + `<div class="card">
          <div class="card-h"><div><h3>Registro de cambios</h3><div class="sub">Qué se editó y cuándo</div></div><button class="btn sm" data-action="log-limpiar">${ER.icon('trash')} Limpiar historial</button></div>
          <div class="table-wrap">
            <table class="table compact">
              <thead><tr><th>Fecha y hora</th><th>Acción</th><th>Detalle</th></tr></thead>
              <tbody>${log.map((l) => `<tr><td class="nowrap small">${ER.fmtDateTime(l.fecha)}</td><td><span class="badge">${ER.esc(l.accion)}</span></td><td class="small muted">${ER.esc(l.detalle)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted center" style="padding:20px">Sin cambios registrados.</td></tr>'}</tbody>
            </table>
          </div>
        </div>`;
      }

      if (tab === 'respaldos') {
        return tabs + `<div class="alert blue mb-16"><div class="a-icon">${ER.icon('download')}</div>
          <div class="grow"><div class="a-title">Tus datos viven solo en este dispositivo</div>
          <div class="a-text">Descarga un respaldo de vez en cuando. También se guarda uno automático por día (se conservan los últimos 7).</div></div>
          <button class="btn primary sm" data-action="backup-crear">Descargar ahora</button>
        </div>
        <div class="card">
          <div class="card-h"><div><h3>Copias automáticas</h3><div class="sub">Guardadas en este navegador</div></div>
            <div class="row gap-6"><button class="btn sm" data-action="backup-importar">${ER.icon('upload')} Importar archivo</button><button class="btn sm primary" data-action="backup-crear">${ER.icon('download')} Descargar respaldo</button></div></div>
          <div class="table-wrap">
            <table class="table compact">
              <thead><tr><th>Fecha</th><th>Tamaño</th><th>Acciones</th></tr></thead>
              <tbody>${backups.map((b) => `<tr>
                <td>${ER.fmtDate(b.fecha, 'weekdayLong')}</td>
                <td>${(b.bytes / 1024).toFixed(1)} KB</td>
                <td class="actions">
                  <button class="btn sm" data-action="backup-restaurar" data-key="${b.key}">${ER.icon('history')} Restaurar</button>
                  <button class="btn sm ghost" data-action="backup-descargar" data-key="${b.key}">${ER.icon('download')}</button>
                </td>
              </tr>`).join('') || '<tr><td colspan="3" class="muted center" style="padding:20px">Todavía no hay copias automáticas.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="card mt-16">
          <div class="card-h"><div><h3>Importar respaldo</h3><div class="sub">Desde un archivo .json exportado por En Ruta</div></div></div>
          <div class="card-b"><button class="btn" data-action="backup-importar">${ER.icon('upload')} Elegir archivo…</button>
            <div class="xs muted mt-8">Esto reemplaza todos los datos actuales. Hazlo solo si estás seguro.</div></div>
        </div>`;
      }

      const items = ER.S.papelera.map((p) => `<div class="list-row">
        <div class="avatar sm" style="background:var(--surface-3);color:var(--muted)">${ER.icon(p.tipo === 'ruta' ? 'map' : p.tipo === 'motorizado' ? 'users' : p.tipo === 'nota' ? 'message' : 'cash', 'sm')}</div>
        <div class="grow" style="min-width:0">
          <div class="bold small">${ER.esc(p.descripcion)}</div>
          <div class="xs muted">${ER.fmtDateTime(p.fecha)} · ${p.tipo}</div>
        </div>
        <button class="btn sm" data-action="papelera-restaurar" data-id="${p.id}">${ER.icon('refresh')} Recuperar</button>
        <button class="btn sm ghost" data-action="papelera-eliminar" data-id="${p.id}" title="Eliminar definitivamente" style="color:var(--danger)">${ER.icon('trash')}</button>
      </div>`).join('');

      return tabs + `<div class="card">
        <div class="card-h"><div><h3>Papelera</h3><div class="sub">Lo eliminado se puede recuperar</div></div><button class="btn sm danger" data-action="papelera-vaciar" ${ER.S.papelera.length ? '' : 'disabled'}>Vaciar papelera</button></div>
        <div class="card-b" style="padding:6px 16px">${items || '<div class="empty" style="padding:34px"><div class="empty-icon">' + ER.icon('trash') + '</div><h3>La papelera está vacía</h3><p>Cuando elimines una ruta o un motorizado aparecerá aquí.</p></div>'}</div>
      </div>
      <div class="card mt-16">
        <div class="card-h"><div><h3>Historial de versiones</h3><div class="sub">Cada ruta guarda sus versiones anteriores</div></div><button class="btn sm" data-action="papelera-tab" data-tab="historial">Ver cambios</button></div>
        <div class="card-b"><div class="small muted">Si editas una ruta, en su botón de historial (${ER.icon('history', 'sm')}) puedes ver lo que decía antes y restaurar esa versión.</div></div>
      </div>`;
    },
    mount() {}
  };

  ER.actions['papelera-tab'] = (el) => { ER.ui.papelera.tab = el.dataset.tab; ER.render(); };
  ER.actions['papelera-restaurar'] = (el) => {
    const p = ER.S.papelera.find((x) => x.id === el.dataset.id);
    if (!p) return;
    if (p.tipo === 'ruta') {
      if (ER.S.rutas.some((r) => r.id === p.data.id)) { ER.toast('Esa ruta ya existe', 'err'); return; }
      ER.S.rutas.push(p.data);
    } else if (p.tipo === 'motorizado') {
      if (ER.getMotorizado(p.data.id)) { ER.toast('Ese motorizado ya existe', 'err'); return; }
      ER.S.motorizados.push(p.data);
    } else if (p.tipo === 'nota') {
      if (ER.S.notas.some((n) => n.id === p.data.id)) { ER.toast('Esa nota ya existe', 'err'); return; }
      ER.S.notas.push(p.data);
    }
    ER.S.papelera = ER.S.papelera.filter((x) => x.id !== p.id);
    ER.log('Recuperado de papelera', p.descripcion);
    ER.save(); ER.render(); ER.toast('Recuperado', 'ok');
  };
  ER.actions['papelera-eliminar'] = async (el) => {
    const p = ER.S.papelera.find((x) => x.id === el.dataset.id);
    if (!p) return;
    if (!await ER.confirm('¿Eliminar definitivamente? Esta acción no se puede deshacer.', { title: 'Eliminar definitivamente', danger: true, ok: 'Eliminar' })) return;
    ER.S.papelera = ER.S.papelera.filter((x) => x.id !== p.id);
    ER.save(); ER.render(); ER.toast('Eliminado definitivamente', 'ok');
  };
  ER.actions['papelera-vaciar'] = async () => {
    if (!ER.S.papelera.length) return;
    if (!await ER.confirm('¿Vaciar toda la papelera? No se podrá recuperar nada.', { title: 'Vaciar papelera', danger: true, ok: 'Vaciar' })) return;
    ER.S.papelera = [];
    ER.save(); ER.render(); ER.toast('Papelera vaciada', 'ok');
  };
  ER.actions['log-limpiar'] = async () => {
    if (!await ER.confirm('¿Limpiar el historial de cambios?', { title: 'Limpiar historial', danger: true, ok: 'Limpiar' })) return;
    ER.S.log = [];
    ER.save(); ER.render(); ER.toast('Historial limpiado', 'ok');
  };
  ER.actions['backup-crear'] = () => ER.exportarRespaldo();
  ER.actions['backup-descargar'] = (el) => {
    const raw = localStorage.getItem(el.dataset.key);
    if (!raw) { ER.toast('No se encontró la copia', 'err'); return; }
    const fecha = el.dataset.key.replace(ER.BACKUP_PREFIX, '');
    ER.download('en-ruta-respaldo-' + fecha + '.json', raw, 'application/json');
  };
  ER.actions['backup-restaurar'] = async (el) => {
    const raw = localStorage.getItem(el.dataset.key);
    if (!raw) { ER.toast('No se encontró la copia', 'err'); return; }
    if (!await ER.confirm('¿Restaurar esta copia? Se reemplazarán todos los datos actuales.', { title: 'Restaurar respaldo', danger: true, ok: 'Restaurar' })) return;
    try {
      const data = JSON.parse(raw);
      ER.S = data;
      ER.save(); ER.applyLogo(); ER.closeModals(); ER.render();
      ER.toast('Respaldo restaurado', 'ok');
    } catch (e) { ER.toast('La copia está dañada', 'err'); }
  };
  ER.actions['backup-importar'] = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      try {
        const data = await ER.importarRespaldo(file);
        if (!await ER.confirm(`¿Importar el respaldo <b>${ER.esc(file.name)}</b>? Se reemplazarán todos los datos actuales.`, { title: 'Importar respaldo', danger: true, ok: 'Importar' })) return;
        ER.S = data;
        ER.S.ui = ER.S.ui || { lastAutoBackup: null };
        ER.save(); ER.applyLogo(); ER.closeModals(); ER.render();
        ER.toast('Respaldo importado', 'ok');
      } catch (e) {
        ER.toast(e.message || 'Archivo inválido', 'err', 4000);
      }
    });
    inp.click();
  };

  /* ============================================================
     AJUSTES
     ============================================================ */
  ER.views.ajustes = {
    render() {
      const c = ER.S.config;
      const t = c.plantillas;
      const plin = ER.S.config.plin;
      const logo = c.logo || 'logo.svg';
      const pwaInstalada = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

      return `
      <div class="grid split-2-1">
        <div>
          <div class="card mb-16">
            <div class="card-h"><div><h3>Datos del negocio</h3><div class="sub">Aparecen en los mensajes y en el encabezado</div></div></div>
            <div class="card-b">
              <div class="form-grid">
                <div class="field"><label>Nombre del negocio</label><input class="input" id="aj-negocio" value="${ER.esc(c.negocio)}"></div>
                <div class="field"><label>Ciudad</label><input class="input" id="aj-ciudad" value="${ER.esc(c.ciudad)}"></div>
                <div class="field"><label>Número PLIN</label><input class="input" id="aj-plin" value="${ER.esc(c.plin)}" inputmode="tel"><div class="hint">Se usa en los mensajes de cobro.</div></div>
                <div class="field"><label>Teléfono de contacto</label><input class="input" id="aj-telefono" value="${ER.esc(c.telefono || '')}" inputmode="tel"></div>
              </div>
              <div class="divider"></div>
              <div class="row gap-12 wrap">
                <div style="width:58px;height:58px;border-radius:14px;overflow:hidden;background:var(--yellow);border:1px solid var(--border)"><img src="${logo}" alt="Logo" style="width:100%;height:100%;object-fit:contain"></div>
                <div class="grow">
                  <div class="bold small">Logo del encabezado</div>
                  <div class="xs muted">Sube tu logo (PNG, JPG o SVG). Se guarda solo en este dispositivo.</div>
                </div>
                <button class="btn sm" data-action="logo-elegir">${ER.icon('upload')} Cambiar</button>
                ${c.logo ? `<button class="btn sm ghost" data-action="logo-quitar">Quitar</button>` : ''}
              </div>
            </div>
          </div>

          <div class="card mb-16">
            <div class="card-h"><div><h3>Comisiones y avisos</h3><div class="sub">Valores predeterminados</div></div></div>
            <div class="card-b">
              <div class="form-grid">
                <div class="field"><label>% de comisión predeterminado</label><input class="input" type="number" id="aj-com" min="0" max="100" step="0.1" value="${c.comisionDefault}"><div class="hint">Cada motorizado puede tener su propio %.</div></div>
                <div class="field"><label>Días sin rutas para alertar</label><input class="input" type="number" id="aj-dias" min="2" max="30" value="${c.diasSinRuta}"><div class="hint">Si un activo no registra rutas en estos días, avisa.</div></div>
                <div class="field"><label>Días de anticipación de demanda</label><input class="input" type="number" id="aj-aviso" min="1" max="90" value="${c.diasAvisoDemanda}"></div>
                <div class="field"><label>Tolerancia de tardanza (min)</label><input class="input" type="number" id="aj-tol" min="0" max="60" value="${c.toleranciaMin}"><div class="hint">0 = cualquier minuto cuenta como tardanza.</div></div>
                <div class="field"><label>Meta semanal por defecto (S/)</label><input class="input" type="number" id="aj-meta" min="0" step="10" value="${c.metaSemanalDefault || 0}"></div>
                <div class="field"><label>Premio por defecto</label><input class="input" id="aj-premio" value="${ER.esc(c.premioDefault || '')}" placeholder="Ej. Bono S/ 30"></div>
              </div>
            </div>
          </div>

          <div class="card mb-16">
            <div class="card-h"><div><h3>Horarios</h3><div class="sub">Turnos y jornada</div></div></div>
            <div class="card-b">
              <div class="form-grid">
                <div class="field"><label>Inicio de jornada</label><input class="input" type="time" id="aj-jini" value="${c.jornadaInicio}"></div>
                <div class="field"><label>Hora de cambio de turno</label><input class="input" type="time" id="aj-cambio" value="${c.horaCambioTurno}"><div class="hint">Separa turno día y turno noche.</div></div>
                <div class="field"><label>Fin de jornada</label><input class="input" type="time" id="aj-jfin" value="${ER.toTimeInput(c.jornadaFin)}"><div class="hint">23:59 equivale a 24:00 (medianoche).</div></div>
              </div>
            </div>
          </div>

          <div class="card mb-16">
            <div class="card-h"><div><h3>Zonas de Nuevo Chimbote</h3><div class="sub">Lista editable para las rutas</div></div></div>
            <div class="card-b">
              <div class="chips" id="zonas-list">
                ${c.zonas.map((z) => `<span class="chip" style="cursor:default">${ER.esc(z)} <button class="icon-btn" style="width:17px;height:17px;margin-left:2px" data-action="zona-del" data-zona="${ER.esc(z)}" title="Quitar">${ER.icon('x', 'sm')}</button></span>`).join('')}
              </div>
              <div class="row gap-6 mt-12">
                <input class="input" id="zona-nueva" placeholder="Nueva zona o sector…" style="max-width:300px">
                <button class="btn" data-action="zona-add">${ER.icon('plus')} Agregar zona</button>
              </div>
            </div>
          </div>

          <div class="card mb-16">
            <div class="card-h"><div><h3>Plantillas de mensajes</h3><div class="sub">Edita el texto de WhatsApp</div></div><button class="btn sm" data-action="plantillas-reset">Restablecer</button></div>
            <div class="card-b">
              <div class="field mb-12"><label>Mensaje de cobro</label><textarea class="textarea" id="aj-tpl-cobro" rows="4">${ER.esc(t.cobro)}</textarea>
                <div class="hint">Variables: {nombre} {fecha} {total} {pct} {comision} {plin} {detalle}</div></div>
              <div class="field mb-12"><label>Cierre diario</label><textarea class="textarea" id="aj-tpl-cierre" rows="4">${ER.esc(t.cierre)}</textarea>
                <div class="hint">Variables: {fecha} {detalle} {total} {comision} {cantidad} {rutas} {plin}</div></div>
              <div class="field mb-12"><label>Estado de cuenta</label><textarea class="textarea" id="aj-tpl-cuenta" rows="4">${ER.esc(t.cuenta)}</textarea>
                <div class="hint">Variables: {nombre} {fecha} {detalle} {total} {abonado} {saldo} {plin}</div></div>
              <div class="field"><label>Reporte para compartir</label><textarea class="textarea" id="aj-tpl-reporte" rows="4">${ER.esc(t.reporte)}</textarea>
                <div class="hint">Variables: {periodo} {detalle} {total} {comision} {rutas}</div></div>
            </div>
          </div>
        </div>

        <div>
          <div class="card mb-16">
            <div class="card-h"><div><h3>Apariencia y app</h3><div class="sub">Modo claro / oscuro</div></div></div>
            <div class="card-b">
              <label class="switch" style="width:100%;justify-content:space-between">
                <span>Modo oscuro</span>
                <input type="checkbox" id="aj-tema" ${ER.ui.theme === 'dark' ? 'checked' : ''}>
                <span class="track"></span>
              </label>
              <div class="divider"></div>
              <div class="row gap-8 mb-8">${ER.icon('download')}<div class="grow"><div class="bold small">Instalar como app</div><div class="xs muted">${pwaInstalada ? 'Ya está instalada en este dispositivo.' : 'Agrega En Ruta a tu pantalla de inicio y úsala sin internet.'}</div></div></div>
              <button class="btn primary block" data-action="instalar-app" ${pwaInstalada ? 'disabled' : ''}>${ER.icon('download')} ${pwaInstalada ? 'App instalada' : 'Instalar En Ruta'}</button>
              <div class="xs muted mt-8">En iPhone: Compartir → “Agregar a pantalla de inicio”.</div>
            </div>
          </div>

          <div class="card mb-16">
            <div class="card-h"><div><h3>Datos y respaldos</h3><div class="sub">Todo se guarda en este dispositivo</div></div></div>
            <div class="card-b">
              <div class="row gap-8 mb-12">${ER.icon('lock')}<div class="grow"><div class="bold small">Privado y sin login</div><div class="xs muted">No se envía nada a ningún servidor. Si borras los datos del navegador, se pierden: descarga respaldos.</div></div></div>
              <label class="switch" style="width:100%;justify-content:space-between">
                <span>Respaldo automático diario</span>
                <input type="checkbox" id="aj-backup" ${c.autoBackup ? 'checked' : ''}>
                <span class="track"></span>
              </label>
              <div class="divider"></div>
              <button class="btn block mb-8" data-action="backup-crear">${ER.icon('download')} Descargar respaldo</button>
              <button class="btn block mb-8" data-action="backup-importar">${ER.icon('upload')} Importar respaldo</button>
              <a class="btn block mb-8" href="#/papelera" data-action="papelera-tab" data-tab="respaldos">${ER.icon('history')} Ver copias automáticas</a>
              <div class="divider"></div>
              <button class="btn block mb-8" data-action="datos-demo">${ER.icon('star')} Cargar datos de ejemplo</button>
              <button class="btn danger block" data-action="datos-borrar">${ER.icon('trash')} Borrar todos los datos</button>
            </div>
          </div>

          <div class="card">
            <div class="card-h"><div><h3>Acerca de</h3><div class="sub">En Ruta · Nuevo Chimbote</div></div></div>
            <div class="card-b">
              <div class="small muted">Versión ${ER.VERSION} · PWA offline</div>
              <div class="xs muted mt-4">Sistema privado de administración de delivery. Sin login, sin PIN, sin servidores. Los datos quedan en tu navegador y puedes respaldarlos cuando quieras.</div>
              <div class="divider"></div>
              <button class="btn primary block" data-action="ajustes-guardar">${ER.icon('check')} Guardar ajustes</button>
            </div>
          </div>
        </div>
      </div>

      <div style="height:10px"></div>
      <div class="row wrap gap-8" style="justify-content:flex-end">
        <button class="btn primary lg" data-action="ajustes-guardar">${ER.icon('check')} Guardar todos los ajustes</button>
      </div>`;
    },
    mount(root) {
      const tema = root.querySelector('#aj-tema');
      if (tema) tema.addEventListener('change', () => {
        ER.setTheme(tema.checked ? 'dark' : 'light');
        ER.save();
      });
      const backup = root.querySelector('#aj-backup');
      if (backup) backup.addEventListener('change', () => {
        ER.S.config.autoBackup = backup.checked;
        ER.save();
        ER.toast(backup.checked ? 'Respaldo automático activado' : 'Respaldo automático desactivado', 'ok');
      });
    }
  };

  ER.actions['ajustes-guardar'] = () => {
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const c = ER.S.config;
    const num = (id, def, min, max) => {
      const v = Number(g(id));
      if (!isFinite(v)) return def;
      return Math.max(min, Math.min(max, v));
    };
    c.negocio = g('aj-negocio').trim() || 'En Ruta';
    c.ciudad = g('aj-ciudad').trim() || 'Nuevo Chimbote';
    c.plin = g('aj-plin').trim();
    c.telefono = g('aj-telefono').trim();
    c.comisionDefault = num('aj-com', 8, 0, 100);
    c.diasSinRuta = num('aj-dias', 4, 2, 30);
    c.diasAvisoDemanda = num('aj-aviso', 20, 1, 90);
    c.toleranciaMin = num('aj-tol', 0, 0, 60);
    c.metaSemanalDefault = num('aj-meta', 0, 0, 100000);
    c.premioDefault = g('aj-premio').trim();
    c.jornadaInicio = g('aj-jini') || '09:00';
    c.horaCambioTurno = g('aj-cambio') || '19:00';
    c.jornadaFin = ER.fromTimeInput(g('aj-jfin')) || '24:00';
    c.plantillas = {
      cobro: g('aj-tpl-cobro') || c.plantillas.cobro,
      cierre: g('aj-tpl-cierre') || c.plantillas.cierre,
      cuenta: g('aj-tpl-cuenta') || c.plantillas.cuenta,
      reporte: g('aj-tpl-reporte') || c.plantillas.reporte
    };
    ER.log('Ajustes actualizados', 'Configuración general');
    ER.save();
    ER.toast('Ajustes guardados', 'ok');
    ER.applyLogo();
  };

  ER.actions['logo-elegir'] = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
    inp.addEventListener('change', () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) { ER.toast('El logo debe pesar menos de 500 KB', 'err'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        ER.S.config.logo = reader.result;
        ER.save(); ER.applyLogo(); ER.render();
        ER.toast('Logo actualizado', 'ok');
      };
      reader.readAsDataURL(file);
    });
    inp.click();
  };
  ER.actions['logo-quitar'] = () => {
    ER.S.config.logo = null;
    ER.save(); ER.applyLogo(); ER.render(); ER.toast('Logo restablecido', 'ok');
  };
  ER.actions['zona-add'] = () => {
    const inp = document.getElementById('zona-nueva');
    if (!inp) return;
    const z = inp.value.trim();
    if (!z) { ER.toast('Escribe el nombre de la zona', 'err'); return; }
    if (ER.S.config.zonas.includes(z)) { ER.toast('Esa zona ya existe', 'err'); return; }
    ER.S.config.zonas.push(z);
    ER.S.config.zonas.sort((a, b) => a.localeCompare(b, 'es'));
    ER.save();
    inp.value = '';
    const list = document.getElementById('zonas-list');
    if (list) {
      list.innerHTML = ER.S.config.zonas.map((x) => `<span class="chip" style="cursor:default">${ER.esc(x)} <button class="icon-btn" style="width:17px;height:17px;margin-left:2px" data-action="zona-del" data-zona="${ER.esc(x)}" title="Quitar">${ER.icon('x', 'sm')}</button></span>`).join('');
    }
    ER.toast('Zona agregada', 'ok');
  };
  ER.actions['zona-del'] = (el) => {
    ER.S.config.zonas = ER.S.config.zonas.filter((z) => z !== el.dataset.zona);
    ER.save();
    const list = document.getElementById('zonas-list');
    if (list) list.innerHTML = ER.S.config.zonas.map((x) => `<span class="chip" style="cursor:default">${ER.esc(x)} <button class="icon-btn" style="width:17px;height:17px;margin-left:2px" data-action="zona-del" data-zona="${ER.esc(x)}" title="Quitar">${ER.icon('x', 'sm')}</button></span>`).join('');
    ER.toast('Zona quitada', 'ok');
  };
  ER.actions['plantillas-reset'] = () => {
    const d = {
      cobro: 'Buenos días, *{nombre}*\n{fecha}\nTotal {total} x {pct}% = *{comision}*\nAbonar al PLIN: {plin}',
      cierre: '*CIERRE DEL DÍA* — {fecha}\n\n{detalle}\n\nTotal generado: {total}\nMi comisión: {comision}\n\nPLIN: {plin}',
      cuenta: '*ESTADO DE CUENTA*\n*{nombre}*\nAl {fecha}\n\n{detalle}\n\nTotal: {total}\nAbonado: {abonado}\n*Saldo: {saldo}*\n\nPLIN: {plin}',
      reporte: '*REPORTE {periodo}*\n{detalle}\n\nTotal generado: {total}\nMi comisión: {comision}\nRutas: {rutas}\n\nEn Ruta · Nuevo Chimbote'
    };
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('aj-tpl-cobro', d.cobro); set('aj-tpl-cierre', d.cierre); set('aj-tpl-cuenta', d.cuenta); set('aj-tpl-reporte', d.reporte);
    ER.toast('Plantillas restablecidas. Pulsa Guardar ajustes.', 'ok');
  };
  ER.actions['datos-demo'] = async () => {
    if (!await ER.confirm('Se reemplazarán todos los datos actuales por un conjunto de ejemplo. ¿Continuar?', { title: 'Cargar datos de ejemplo', danger: true, ok: 'Cargar ejemplo' })) return;
    ER.cargarDemo();
  };
  ER.actions['datos-borrar'] = async () => {
    if (!await ER.confirm('Se borrarán <b>todos</b> los motorizados, rutas, cobros, notas y ajustes de este dispositivo. Descarga un respaldo antes si lo necesitas.<br><br>¿Seguro?', { title: 'Borrar todos los datos', danger: true, ok: 'Sí, borrar todo' })) return;
    if (!await ER.confirm('Última confirmación: esta acción no se puede deshacer.', { title: 'Confirmar borrado', danger: true, ok: 'Borrar definitivamente' })) return;
    ER.resetState();
    ER.applyLogo();
    ER.closeModals();
    ER.go('inicio');
    ER.render();
    ER.toast('Datos borrados', 'ok');
  };
  ER.actions['instalar-app'] = async () => {
    if (ER.installPrompt) {
      ER.installPrompt.prompt();
      const res = await ER.installPrompt.userChoice;
      if (res.outcome === 'accepted') ER.toast('Instalando En Ruta…', 'ok');
      ER.installPrompt = null;
    } else {
      ER.modal({
        title: 'Instalar En Ruta',
        size: 'sm',
        body: `<div class="small" style="line-height:1.7">
          <p><b>Android / Chrome:</b> menú ⋮ → “Instalar aplicación” o “Agregar a pantalla de inicio”.</p>
          <p class="mt-8"><b>iPhone / Safari:</b> botón Compartir → “Agregar a pantalla de inicio”.</p>
          <p class="mt-8"><b>Computadora:</b> icono de instalar en la barra de direcciones de Chrome o Edge.</p>
          <p class="mt-8 muted">Si no aparece, asegúrate de abrir la app desde https:// (o localhost).</p>
        </div>`,
        footer: `<button class="btn primary" data-close type="button">Entendido</button>`
      });
    }
  };

  /* Acciones de notas */
  ER.actions['nota-nueva'] = () => ER.openNotaForm();
  ER.actions['nota-editar'] = (el) => ER.openNotaForm(null, el.dataset.id);
  ER.actions['nota-eliminar'] = async (el) => {
    const n = ER.S.notas.find((x) => x.id === el.dataset.id);
    if (!n) return;
    if (!await ER.confirm('¿Eliminar esta nota? Irá a la papelera.', { title: 'Eliminar nota', danger: true, ok: 'Eliminar' })) return;
    ER.aPapelera('nota', JSON.parse(JSON.stringify(n)), n.titulo || 'Nota');
    ER.S.notas = ER.S.notas.filter((x) => x.id !== n.id);
    ER.save(); ER.render(); ER.toast('Nota enviada a la papelera', 'ok');
  };
  ER.actions['nota-estado'] = (el) => {
    const origen = el.dataset.origen;
    if (origen === 'ruta') {
      const r = ER.S.rutas.find((x) => x.id === el.dataset.id);
      if (!r) return;
      r.notaEstado = (r.notaEstado || 'pendiente') === 'pendiente' ? 'tratado' : 'pendiente';
      ER.log('Estado de nota de pedido', `${ER.routeName(r)} · ${r.notaEstado}`);
    } else {
      const n = ER.S.notas.find((x) => x.id === el.dataset.id);
      if (!n) return;
      n.estado = (n.estado || 'pendiente') === 'pendiente' ? 'tratado' : 'pendiente';
      ER.log('Estado de nota', `${n.titulo || 'Nota'} · ${n.estado}`);
    }
    ER.save(); ER.render(); ER.toast('Estado actualizado', 'ok');
  };
  ER.actions['nota-ver-ruta'] = (el) => {
    ER.openRutaForm({ id: el.dataset.id });
  };

})();
