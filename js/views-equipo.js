/* ============================================================
   EN RUTA — Motorizados, Horario general y Asistencia
   ============================================================ */
(function () {
  'use strict';
  const ER = window.ER;
  if (!ER) return;

  /* ============================================================
     Utilidades de equipo
     ============================================================ */
  ER.diasTexto = function (m, corto) {
    const dias = Array.isArray(m.dias) ? m.dias.map(Number) : [];
    if (!dias.length) return 'Sin días asignados';
    return dias.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((d) => (corto ? ER.DIAS_CORTOS[d] : ER.DIAS[d])).join(', ');
  };
  ER.diaLibreTexto = function (m) {
    if (m.diaLibre == null || m.diaLibre === '') return 'Sin definir';
    return ER.DIAS[Number(m.diaLibre)] || 'Sin definir';
  };
  ER.finDeSemana = function (m) {
    return Number(m.diaLibre) === 0 || Number(m.diaLibre) === 6;
  };

  /* ============================================================
     Formulario de motorizado
     ============================================================ */
  ER.openMotorizadoForm = function (id) {
    const m = id ? ER.getMotorizado(id) : null;
    const cfg = ER.S.config;
    const esNuevo = !m;
    const dias = m ? (m.dias || []).map(Number) : [1, 2, 3, 4, 5, 6];
    const diaLibre = m ? Number(m.diaLibre) : 0;
    const opcionesDia = ['<option value="">Sin definir</option>'].concat(
      ER.DIAS.map((d, i) => `<option value="${i}" ${i === diaLibre ? 'selected' : ''}>${d}</option>`)
    ).join('');
    const checks = [1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="check-chip"><input type="checkbox" class="js-dia" value="${d}" ${dias.includes(d) ? 'checked' : ''}> ${ER.DIAS[d]}</label>`).join('');

    const body = `<form id="motorizado-form" autocomplete="off">
      <div class="form-grid">
        <div class="field span-2"><label>Nombre completo <span class="req">*</span></label><input class="input" id="mf-nombre" value="${m ? ER.esc(m.nombre) : ''}" placeholder="Ej. Pepito Quispe" required></div>
        <div class="field"><label>WhatsApp</label><input class="input" id="mf-wa" value="${m ? ER.esc(m.whatsapp || '') : ''}" placeholder="922 504 223" inputmode="tel"><div class="hint">Se usa para abrir los mensajes de cobro.</div></div>
        <div class="field"><label>Tipo de motorizado</label><select class="select" id="mf-tipo">
          <option value="ruta" ${m && m.tipo === 'ruta' ? 'selected' : ''}>En ruta (comisión diaria)</option>
          <option value="parcial" ${m && m.tipo === 'parcial' ? 'selected' : ''}>Parcial (comisión semanal)</option>
        </select><div class="hint">El tipo define los avisos de cobro.</div></div>
        <div class="field"><label>% de comisión</label><input class="input" type="number" id="mf-com" min="0" max="100" step="0.1" value="${m ? m.comision : cfg.comisionDefault}"><div class="hint">Predeterminado ${cfg.comisionDefault}%. Puedes subirlo a nuevos.</div></div>
        <div class="field"><label>Turno</label><select class="select" id="mf-turno">
          <option value="dia" ${m && m.turno === 'dia' ? 'selected' : ''}>Día</option>
          <option value="noche" ${!m || m.turno === 'noche' ? 'selected' : ''}>Noche</option>
        </select></div>
        <div class="field"><label>Hora de entrada</label><input class="input" type="time" id="mf-hora" value="${m ? ER.esc(m.horaEntrada || '19:00') : '19:00'}"></div>
        <div class="field"><label>Fecha de ingreso</label><input class="input" type="date" id="mf-ingreso" value="${m ? ER.esc(m.fechaIngreso || ER.today()) : ER.today()}"></div>
        <div class="field span-2"><label>Días que trabaja</label><div class="check-grid">${checks}</div><div class="hint">Con estos días y la hora de entrada se arma el horario automáticamente.</div></div>
        <div class="field"><label>Día libre</label><select class="select" id="mf-libre">${opcionesDia}</select><div class="hint">Sábado y domingo son los de más demanda: el sistema te avisará si pones uno.</div></div>
        <div class="field"><label>Estado</label><label class="switch" style="height:42px"><input type="checkbox" id="mf-activo" ${!m || m.activo !== false ? 'checked' : ''}><span class="track"></span><span>Activo</span></label></div>
        <div class="field"><label>Meta semanal (S/)</label><input class="input" type="number" id="mf-meta" min="0" step="10" value="${m ? (m.metaSemanal || 0) : (cfg.metaSemanalDefault || 0)}"><div class="hint">Se usa para la barra de progreso del inicio.</div></div>
        <div class="field"><label>Premio de la meta</label><input class="input" id="mf-premio" value="${m ? ER.esc(m.premio || '') : ''}" placeholder="Ej. Bono S/ 30, un día sin comisión…"></div>
        <div class="field span-2"><label>Notas internas</label><textarea class="textarea" id="mf-notas" rows="2" placeholder="Observaciones del motorizado">${m ? ER.esc(m.notas || '') : ''}</textarea></div>
      </div>
      <div id="mf-aviso" class="mt-12"></div>
    </form>`;

    ER.modal({
      title: esNuevo ? 'Nuevo motorizado' : 'Editar ficha',
      subtitle: esNuevo ? 'Completa la ficha para generar su horario y sus avisos.' : ER.esc(m.nombre),
      size: 'lg',
      body,
      footer: `${!esNuevo ? `<button class="btn danger sm left" data-eliminar type="button">${ER.icon('trash')} Eliminar</button>` : ''}
        <button class="btn" data-close type="button">Cancelar</button>
        <button class="btn primary" data-ok type="button">${ER.icon('check')} Guardar ficha</button>`,
      onMount: (el, close) => {
        const $ = (s) => el.querySelector(s);
        const nombre = $('#mf-nombre');
        const wa = $('#mf-wa');
        const tipo = $('#mf-tipo');
        const com = $('#mf-com');
        const turno = $('#mf-turno');
        const hora = $('#mf-hora');
        const ingreso = $('#mf-ingreso');
        const libre = $('#mf-libre');
        const activo = $('#mf-activo');
        const meta = $('#mf-meta');
        const premio = $('#mf-premio');
        const notas = $('#mf-notas');
        const aviso = $('#mf-aviso');

        function validar() {
          const lib = libre.value === '' ? null : Number(libre.value);
          aviso.innerHTML = (lib === 0 || lib === 6) ? `<div class="alert yellow" style="padding:9px 12px">
            <div class="a-icon" style="width:26px;height:26px">${ER.icon('alert', 'sm')}</div>
            <div class="a-text" style="margin:0">Ojo: ${ER.DIAS[lib]} es uno de los días de más demanda. Si puedes, dale libre otro día.</div>
          </div>` : '';
        }
        libre.addEventListener('change', () => {
          const lib = libre.value === '' ? null : Number(libre.value);
          if (lib !== null) {
            const chk = el.querySelector(`.js-dia[value="${lib}"]`);
            if (chk) chk.checked = false;
          }
          validar();
        });
        el.querySelectorAll('.js-dia').forEach((chk) => chk.addEventListener('change', () => {
          if (chk.checked && libre.value !== '' && Number(libre.value) === Number(chk.value)) {
            libre.value = '';
            ER.toast('Ese día estaba como libre; se quitó el día libre', 'ok');
          }
          validar();
        }));
        validar();

        el.querySelector('[data-ok]').addEventListener('click', () => {
          const nombreV = nombre.value.trim();
          if (!nombreV) { ER.toast('Escribe el nombre', 'err'); nombre.focus(); return; }
          const diasV = Array.from(el.querySelectorAll('.js-dia:checked')).map((c) => Number(c.value));
          if (!diasV.length) { ER.toast('Selecciona al menos un día de trabajo', 'err'); return; }
          const comV = Number(com.value);
          if (!(comV >= 0 && comV <= 100)) { ER.toast('El % debe estar entre 0 y 100', 'err'); return; }
          const obj = {
            nombre: nombreV,
            whatsapp: wa.value.replace(/\D/g, ''),
            tipo: tipo.value,
            comision: comV,
            turno: turno.value,
            horaEntrada: hora.value || '19:00',
            dias: diasV,
            diaLibre: libre.value === '' ? null : Number(libre.value),
            fechaIngreso: ingreso.value || ER.today(),
            activo: activo.checked,
            metaSemanal: Math.max(0, Number(meta.value) || 0),
            premio: premio.value.trim(),
            notas: notas.value.trim()
          };
          if (m) {
            Object.assign(m, obj);
            ER.log('Ficha actualizada', `${m.nombre} · ${m.tipo === 'parcial' ? 'Parcial' : 'En ruta'} · ${m.comision}%`);
          } else {
            ER.S.motorizados.push({ id: ER.uid(), ...obj });
            ER.log('Motorizado agregado', `${obj.nombre} · ${obj.tipo === 'parcial' ? 'Parcial' : 'En ruta'} · ${obj.comision}%`);
          }
          if (!ER.save()) return;
          close();
          ER.render();
          ER.toast(esNuevo ? 'Motorizado agregado' : 'Ficha guardada', 'ok');
        });

        const del = el.querySelector('[data-eliminar]');
        if (del) del.addEventListener('click', () => { close(); ER.eliminarMotorizado(id); });
      }
    });
  };

  ER.eliminarMotorizado = async function (id) {
    const m = ER.getMotorizado(id);
    if (!m) return;
    const rutas = ER.S.rutas.filter((r) => r.motorizadoId === id).length;
    const ok = await ER.confirm(`¿Eliminar a <b>${ER.esc(m.nombre)}</b>?<br><br>${rutas ? `Tiene <b>${rutas} rutas</b> registradas. Se conservarán en el registro y en la papelera podrás recuperar su ficha.` : 'Podrás recuperarlo desde la Papelera.'}`, {
      title: 'Eliminar motorizado', danger: true, ok: 'Eliminar'
    });
    if (!ok) return;
    ER.aPapelera('motorizado', JSON.parse(JSON.stringify(m)), `Motorizado ${m.nombre}`);
    ER.S.motorizados = ER.S.motorizados.filter((x) => x.id !== id);
    ER.log('Motorizado eliminado', m.nombre);
    ER.save();
    ER.closeModals();
    if (ER.parseHash().view === 'motorizado') ER.go('motorizados');
    ER.render();
    ER.toast('Motorizado enviado a la papelera', 'ok');
  };

  /* ============================================================
     Vista MOTORIZADOS
     ============================================================ */
  ER.views.motorizados = {
    render() {
      const ui = ER.ui.motorizados || (ER.ui.motorizados = { q: '', filtro: 'activos' });
      let lista = ER.S.motorizados.slice();
      if (ui.filtro === 'activos') lista = lista.filter((m) => m.activo !== false);
      if (ui.filtro === 'inactivos') lista = lista.filter((m) => m.activo === false);
      if (ui.filtro === 'ruta') lista = lista.filter((m) => m.tipo === 'ruta');
      if (ui.filtro === 'parcial') lista = lista.filter((m) => m.tipo === 'parcial');
      if (ui.q) {
        const q = ui.q.toLowerCase();
        lista = lista.filter((m) => m.nombre.toLowerCase().includes(q) || String(m.whatsapp || '').includes(q));
      }
      lista = ER.ordenarMotorizados(lista);

      const cards = lista.map((m) => {
        const d = ER.deudaDe(m.id);
        const mes = ER.statsRange(ER.startOfMonth(ER.today()), ER.endOfMonth(ER.today()), m.id);
        return `<div class="card">
          <div class="card-b" style="padding:15px">
            <div class="row top gap-10">
              ${ER.avatar(m.nombre, 'lg')}
              <div class="grow" style="min-width:0">
                <div class="row wrap gap-5"><span class="bold" style="font-size:15px">${ER.esc(m.nombre)}</span>${ER.badgeTipo(m.tipo)}${m.activo === false ? '<span class="badge">Inactivo</span>' : ''}</div>
                <div class="xs muted">${ER.icon('phone', 'sm')} ${ER.phoneDisplay(m.whatsapp)}</div>
                <div class="xs muted">${m.turno === 'dia' ? 'Día' : 'Noche'} · entra ${ER.timeLabel(m.horaEntrada)} · ${m.comision}%</div>
              </div>
            </div>
            <div class="mt-12" style="font-size:12px;color:var(--muted)">
              <div class="truncate">${ER.icon('calendar', 'sm')} ${ER.diasTexto(m, true)}</div>
              <div class="mt-4">${ER.icon('sun', 'sm')} Libre: ${ER.diaLibreTexto(m)} ${ER.finDeSemana(m) ? '<span class="badge warn">Fin de semana</span>' : ''}</div>
            </div>
            <div class="grid cols-2 mt-12" style="gap:6px">
              <div><div class="xs muted">Comisión del mes</div><div class="bold mono">${ER.money(mes.comision)}</div></div>
              <div><div class="xs muted">Saldo pendiente</div><div class="bold mono" style="color:${d.saldo > 0 ? 'var(--danger)' : 'var(--ok)'}">${ER.money(d.saldo)}</div></div>
            </div>
            ${m.metaSemanal ? `<div class="mt-8"><div class="between xs muted"><span>Meta semanal</span><span>${ER.money(m.metaSemanal)}</span></div><div class="progress thin mt-4"><span style="width:${Math.min(100, Math.round((ER.statsRange(ER.startOfWeek(ER.today()), ER.endOfWeek(ER.today()), m.id).comision / m.metaSemanal) * 100))}%"></span></div></div>` : ''}
            <div class="row gap-4 mt-12 wrap">
              <a class="btn sm" href="#/motorizado/${m.id}">${ER.icon('eye')} Ver ficha</a>
              <button class="btn sm" data-action="motorizado-editar" data-id="${m.id}">${ER.icon('edit')} Editar</button>
              <button class="btn sm ghost" data-action="motorizado-wa" data-id="${m.id}" title="Abrir WhatsApp">${ER.icon('wa')}</button>
              <a class="btn sm ghost" href="#/notas" data-action="motorizado-nota" data-id="${m.id}" title="Agregar nota">${ER.icon('message')}</a>
            </div>
          </div>
        </div>`;
      }).join('');

      return `
      <div class="between wrap mb-16" style="gap:10px">
        <div class="chips">
          ${[['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos'], ['ruta', 'En ruta'], ['parcial', 'Parciales']].map(([id, lb]) =>
            `<button class="chip ${ui.filtro === id ? 'active' : ''}" data-action="motorizados-filtro" data-filtro="${id}">${lb}</button>`).join('')}
        </div>
        <div class="row gap-6 wrap">
          <div class="search-box"><svg class="icon"><use href="#i-search"/></svg><input class="input" id="motorizados-q" placeholder="Buscar nombre o WhatsApp…" value="${ER.esc(ui.q)}" style="min-width:210px"></div>
          <button class="btn primary" data-action="motorizado-nuevo">${ER.icon('plus')} Nuevo motorizado</button>
        </div>
      </div>

      ${ER.S.motorizados.filter((m) => ER.finDeSemana(m) && m.activo !== false).length ? `<div class="alert yellow mb-16">
        <div class="a-icon">${ER.icon('alert')}</div>
        <div class="grow"><div class="a-title">Hay motorizados con día libre en fin de semana</div>
        <div class="a-text">Sábado y domingo son los días de más demanda. Revisa si puedes cambiarles el día libre.</div></div>
        <a class="btn sm" href="#/horario">Ver horario</a>
      </div>` : ''}

      ${lista.length ? `<div class="grid auto-320" style="gap:12px">${cards}</div>` : `<div class="card"><div class="empty">
        <div class="empty-icon">${ER.icon('users')}</div>
        <h3>No hay motorizados en esta lista</h3>
        <p>Agrega a tu equipo para controlar rutas, comisiones, horarios y asistencia.</p>
        <button class="btn primary" data-action="motorizado-nuevo">${ER.icon('plus')} Nuevo motorizado</button>
      </div></div>`}`;
    },
    mount(root) {
      const q = root.querySelector('#motorizados-q');
      if (q) {
        q.addEventListener('input', ER.debounce(() => {
          ER.ui.motorizados.q = q.value;
          ER.render();
          const el = document.getElementById('motorizados-q');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 280));
      }
    }
  };

  /* ============================================================
     Vista FICHA DEL MOTORIZADO
     ============================================================ */
  ER.views.motorizado = {
    render(params) {
      const m = ER.getMotorizado(params[0]);
      if (!m) {
        return `<div class="card"><div class="empty">
          <div class="empty-icon">${ER.icon('users')}</div><h3>Motorizado no encontrado</h3>
          <p>Puede que se haya eliminado. Revísalo en la Papelera.</p>
          <a class="btn primary" href="#/motorizados">Volver a motorizados</a>
        </div></div>`;
      }
      const hoy = ER.today();
      const mesIni = ER.startOfMonth(hoy), mesFin = ER.endOfMonth(hoy);
      const totalHist = ER.statsRange('2000-01-01', '2100-12-31', m.id);
      const mes = ER.statsRange(mesIni, mesFin, m.id);
      const deuda = ER.deudaDe(m.id);
      const asist = ER.resumenAsistencia(m, mesIni, hoy > mesFin ? mesFin : hoy);
      const rutas = ER.S.rutas.filter((r) => r.motorizadoId === m.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
      const notasPropias = ER.S.notas.filter((n) => n.motorizadoId === m.id);
      const notasRutas = ER.S.rutas.filter((r) => r.motorizadoId === m.id && r.nota).map((r) => ({ id: r.id, fecha: r.fecha, tipo: 'pedido', titulo: 'Nota de pedido', texto: r.nota, estado: 'pendiente', ruta: r }));
      const notas = notasPropias.concat(notasRutas).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 4);

      const diasHtml = [1, 2, 3, 4, 5, 6, 0].map((d) => {
        const trabaja = (m.dias || []).includes(d) && Number(m.diaLibre) !== d;
        return `<div style="text-align:center;padding:8px 4px;border-radius:9px;border:1px solid ${trabaja ? 'var(--yellow)' : 'var(--border)'};background:${trabaja ? 'var(--yellow-100)' : 'var(--surface-2)'}">
          <div class="xs bold" style="color:var(--muted);text-transform:uppercase">${ER.DIAS_CORTOS[d]}</div>
          <div class="xs bold mt-4" style="color:${trabaja ? 'inherit' : 'var(--muted-2)'}">${trabaja ? ER.timeLabel(m.horaEntrada) : Number(m.diaLibre) === d ? 'Libre' : '—'}</div>
        </div>`;
      }).join('');

      const rutasHtml = rutas.length ? rutas.map((r) => `<div class="list-row">
        <div class="grow" style="min-width:0">
          <div class="between wrap" style="gap:4px"><span class="bold small">${ER.fmtDate(r.fecha, 'medium')}</span><span class="mono small">${ER.money(r.total)}</span></div>
          <div class="xs muted truncate">${ER.esc(r.pedidos)} · comisión ${ER.money(r.comision)}${r.nota ? ' · ' + ER.esc(r.nota) : ''}</div>
        </div>
        ${ER.badgePago(r)}
        <button class="icon-btn" data-action="ruta-editar" data-id="${r.id}" title="Editar">${ER.icon('edit', 'sm')}</button>
      </div>`).join('') : '<div class="empty" style="padding:20px"><p>Sin rutas registradas.</p></div>';

      const notasHtml = notas.length ? notas.map((n) => `<div class="list-row" style="align-items:flex-start">
        <div class="grow"><div class="row wrap gap-4"><span class="badge ${n.tipo === 'reclamo' ? 'red' : n.tipo === 'pedido' ? 'yellow' : 'blue'}">${n.tipo === 'reclamo' ? 'Reclamo' : n.tipo === 'pedido' ? 'Pedido' : 'Nota'}</span><span class="xs muted">${ER.fmtDate(n.fecha)}</span></div>
        <div class="small mt-4">${ER.esc(n.texto)}</div></div>
      </div>`).join('') : '<div class="empty" style="padding:20px"><p>Sin notas ni reclamos.</p></div>';

      return `
      <div class="row gap-6 mb-12">
        <a class="btn sm ghost" href="#/motorizados">${ER.icon('chevron-left')} Motorizados</a>
      </div>

      <div class="card mb-16">
        <div class="card-b">
          <div class="detail-hero">
            ${ER.avatar(m.nombre, 'lg')}
            <div class="grow" style="min-width:0">
              <div class="row wrap gap-6"><h2>${ER.esc(m.nombre)}</h2>${ER.badgeTipo(m.tipo)}${m.activo === false ? '<span class="badge">Inactivo</span>' : '<span class="badge green">Activo</span>'}</div>
              <div class="small muted mt-4">${ER.icon('phone', 'sm')} ${ER.phoneDisplay(m.whatsapp)} · ${m.turno === 'dia' ? 'Turno día' : 'Turno noche'} · ingreso ${ER.fmtDate(m.fechaIngreso)}</div>
            </div>
            <div class="row gap-6 wrap">
              <button class="btn primary" data-action="motorizado-editar" data-id="${m.id}">${ER.icon('edit')} Editar ficha</button>
              <button class="btn wa" data-action="motorizado-wa" data-id="${m.id}">${ER.icon('wa')} WhatsApp</button>
              <button class="btn" data-action="motorizado-nota" data-id="${m.id}">${ER.icon('message')} Agregar nota</button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid kpi mb-16">
        <div class="card stat"><span class="accent"></span><div class="label">Comisión del mes</div><div class="value sm">${ER.money(mes.comision)}</div><div class="meta">${mes.count} rutas · ${ER.money(mes.total)} generado</div></div>
        <div class="card stat"><span class="accent" style="background:#3B82F6"></span><div class="label">Histórico</div><div class="value sm">${ER.money(totalHist.comision)}</div><div class="meta">${totalHist.count} rutas en total</div></div>
        <div class="card stat"><span class="accent" style="background:#EF4444"></span><div class="label">Saldo pendiente</div><div class="value sm" style="color:${deuda.saldo > 0 ? 'var(--danger)' : 'var(--ok)'}">${ER.money(deuda.saldo)}</div><div class="meta">${deuda.dias > 0 ? deuda.dias + ' días de atraso' : 'Sin atrasos'}</div></div>
        <div class="card stat"><span class="accent" style="background:#10B981"></span><div class="label">Asistencia del mes</div><div class="value sm">${asist.pctAsistencia}%</div><div class="meta">${asist.asistio} a tiempo · ${asist.tarde} tardanzas · ${asist.falta} faltas</div></div>
      </div>

      <div class="grid split-2-1 mb-16">
        <div class="card">
          <div class="card-h"><div><h3>Horario semanal</h3><div class="sub">Se arma solo con sus días y su hora de entrada</div></div><a class="btn ghost sm" href="#/horario">Horario general</a></div>
          <div class="card-b">
            <div class="grid" style="grid-template-columns:repeat(7,1fr);gap:5px">${diasHtml}</div>
            <div class="divider"></div>
            <dl class="kv">
              <dt>Tipo</dt><dd>${m.tipo === 'parcial' ? 'Parcial · cobro semanal' : 'En ruta · cobro diario'}</dd>
              <dt>Comisión</dt><dd>${m.comision}%</dd>
              <dt>Turno</dt><dd>${m.turno === 'dia' ? 'Día' : 'Noche'} · entra ${ER.timeLabel(m.horaEntrada)}</dd>
              <dt>Día libre</dt><dd>${ER.diaLibreTexto(m)} ${ER.finDeSemana(m) ? '<span class="badge warn">Fin de semana</span>' : ''}</dd>
              <dt>Días</dt><dd>${ER.diasTexto(m)}</dd>
              <dt>Meta semanal</dt><dd>${m.metaSemanal ? ER.money(m.metaSemanal) : 'Sin meta'}${m.premio ? ' · ' + ER.esc(m.premio) : ''}</dd>
            </dl>
            ${ER.finDeSemana(m) ? `<div class="alert yellow mt-12" style="padding:10px 12px"><div class="a-icon" style="width:26px;height:26px">${ER.icon('alert', 'sm')}</div><div class="a-text" style="margin:0">Su día libre cae en fin de semana, los días de más demanda.</div></div>` : ''}
            ${m.notas ? `<div class="alert blue mt-12" style="padding:10px 12px"><div class="a-icon" style="width:26px;height:26px">${ER.icon('message', 'sm')}</div><div class="a-text" style="margin:0">${ER.esc(m.notas)}</div></div>` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-h"><div><h3>Asistencia del mes</h3><div class="sub">${ER.fmtDate(mesIni, 'month')}</div></div><a class="btn ghost sm" href="#/asistencia">Detalle</a></div>
          <div class="card-b">
            <div class="between mb-8"><span class="small bold">Puntualidad</span><span class="badge ${asist.pctFalta > 20 ? 'red' : asist.pctPuntual >= 80 ? 'green' : 'yellow'}">${asist.pctPuntual}%</span></div>
            <div class="progress"><span style="width:${asist.pctPuntual}%"></span></div>
            <div class="grid cols-3 mt-12" style="gap:6px;text-align:center">
              <div><div class="bold" style="color:var(--ok)">${asist.asistio}</div><div class="xs muted">A tiempo</div></div>
              <div><div class="bold" style="color:var(--warn)">${asist.tarde}</div><div class="xs muted">Tardanzas</div></div>
              <div><div class="bold" style="color:var(--danger)">${asist.falta}</div><div class="xs muted">Faltas</div></div>
            </div>
            <div class="divider"></div>
            <div class="xs muted">Días programados: ${asist.programados} · minutos de tardanza: ${asist.minutosTarde}</div>
            <a class="btn sm block mt-12" href="#/asistencia">${ER.icon('clock')} Ver asistencia</a>
          </div>
        </div>
      </div>

      <div class="grid cols-2 mb-16">
        <div class="card">
          <div class="card-h"><div><h3>Últimas rutas</h3><div class="sub">Cada pedido conserva su texto original</div></div><a class="btn ghost sm" href="#/registro">Registro</a></div>
          <div class="card-b" style="padding:8px 16px">${rutasHtml}</div>
        </div>
        <div class="card">
          <div class="card-h"><div><h3>Notas y reclamos</h3><div class="sub">Últimas observaciones</div></div><button class="btn ghost sm" data-action="motorizado-nota" data-id="${m.id}">${ER.icon('plus')} Agregar</button></div>
          <div class="card-b" style="padding:8px 16px">${notasHtml}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div><h3>Estado de cuenta</h3><div class="sub">Cobros y movimientos</div></div>
          <div class="row gap-6"><button class="btn sm" data-action="cobro-cuenta" data-id="${m.id}">${ER.icon('wa')} Enviar estado</button><a class="btn sm" href="#/cobros">Cobros</a></div>
        </div>
        <div class="card-b">
          <div class="grid cols-3" style="gap:10px">
            <div><div class="xs muted">Rutas pendientes</div><div class="bold">${deuda.cantidad}</div></div>
            <div><div class="xs muted">Total abonado</div><div class="bold mono">${ER.money(ER.abonadoDe(m.id))}</div></div>
            <div><div class="xs muted">Saldo</div><div class="bold mono" style="color:${deuda.saldo > 0 ? 'var(--danger)' : 'var(--ok)'}">${ER.money(deuda.saldo)}</div></div>
          </div>
          <div class="divider"></div>
          <div class="xs muted">Historial de pagos</div>
          <div class="mt-8">${ER.S.pagos.filter((p) => p.motorizadoId === m.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 4).map((p) => `<div class="list-row" style="padding:6px 0"><div class="grow small">${ER.fmtDate(p.fecha, 'medium')} <span class="xs muted">${ER.esc(p.nota || '')}</span></div><b class="mono small">${ER.money(p.monto)}</b></div>`).join('') || '<div class="xs muted">Sin pagos registrados.</div>'}</div>
        </div>
      </div>`;
    }
  };

  /* ============================================================
     Vista HORARIO GENERAL
     ============================================================ */
  ER.views.horario = {
    render() {
      const ui = ER.ui.horario || (ER.ui.horario = {});
      const weekStart = ui.semana || ER.startOfWeek(ER.today());
      const weekEnd = ER.addDays(weekStart, 6);
      const days = ER.weekDates(weekStart);
      const fechaLinea = ui.fecha || ER.today();
      const vista = ui.vista || 'semana';
      const activos = ER.ordenarMotorizados(ER.S.motorizados.filter((m) => m.activo !== false));
      const cfg = ER.S.config;

      const advertencias = activos.filter((m) => ER.finDeSemana(m));

      function headerCells() {
        return days.map((d) => {
          const dow = ER.weekday(d);
          const ev = ER.demandOn(d);
          return `<div class="week-cell-h ${dow === 0 || dow === 6 ? 'weekend' : ''} ${d === ER.today() ? 'today' : ''}" title="${ev.length ? ER.esc(ev.map((x) => x.nombre).join(', ')) : ''}">
            <div class="dow">${ER.DIAS_CORTOS[dow]}</div>
            <div class="dnum">${Number(d.slice(8, 10))}</div>
            ${ev.length ? `<div class="xs" style="color:var(--info);margin-top:2px">${ER.icon('star', 'sm')}</div>` : ''}
          </div>`;
        }).join('');
      }

      function fila(m) {
        const stats = ER.resumenAsistencia(m, weekStart, weekEnd);
        return `<div class="week-name" title="${ER.esc(m.nombre)}">
          ${ER.avatar(m.nombre, 'sm')}
          <div style="min-width:0">
            <div class="truncate" style="font-size:12px">${ER.esc(m.nombre)}</div>
            <div class="xs muted" style="font-weight:500">${stats.asistio}✓ · ${stats.tarde}⏱ · ${stats.falta}✕</div>
          </div>
        </div>
        ${days.map((d) => {
          const sch = ER.scheduleOf(m, d);
          const ov = ER.getOverride(m.id, d);
          if (!sch) {
            return `<div class="week-cell free"><button class="shift-pill free" data-action="horario-celda" data-mid="${m.id}" data-fecha="${d}">Libre</button></div>`;
          }
          return `<div class="week-cell"><button class="shift-pill ${m.turno === 'noche' ? 'night' : 'day'} ${ov ? 'override' : ''}" data-action="horario-celda" data-mid="${m.id}" data-fecha="${d}" title="${ov ? 'Cambio manual' : 'Horario de la ficha'}">${ER.timeLabel(sch.inicio)}–${ER.timeLabel(sch.fin)}${ov ? ' *' : ''}</button></div>`;
        }).join('')}`;
      }

      function tablaTurno(turno) {
        const ms = activos.filter((m) => (m.turno || 'noche') === turno);
        return `<div class="card mb-16">
          <div class="card-h"><div><h3>Turno ${turno === 'dia' ? 'día' : 'noche'}</h3><div class="sub">${ms.length} ${ER.plural(ms.length, 'motorizado', 'motorizados')}</div></div>
            <span class="badge ${turno === 'noche' ? 'dark' : 'yellow'}">${turno === 'dia' ? 'Hasta ' + ER.timeLabel(cfg.horaCambioTurno) : 'Desde ' + ER.timeLabel(cfg.horaCambioTurno)}</span></div>
          <div class="xs muted mobile-only" style="padding:7px 14px 0">Desliza para ver todos los días →</div>
          <div class="table-wrap" style="border-radius:0 0 var(--radius) var(--radius)">
            <div class="week-grid">
              <div class="week-name" style="background:var(--surface-2);font-size:10px;text-transform:uppercase;color:var(--muted)">Motorizado</div>
              ${headerCells()}
              ${ms.length ? ms.map(fila).join('') : `<div style="grid-column:span 8" class="empty" style="padding:20px"><p>No hay motorizados en este turno.</p></div>`}
            </div>
          </div>
        </div>`;
      }

      /* Línea de tiempo */
      const ini = ER.timeToMin(cfg.jornadaInicio || '09:00');
      const fin = ER.timeToMin(cfg.jornadaFin || '24:00');
      const totalMin = Math.max(60, fin - ini);
      const expected = ER.expectedOn(fechaLinea).slice().sort((a, b) => {
        const sa = ER.scheduleOf(a, fechaLinea), sb = ER.scheduleOf(b, fechaLinea);
        return ER.timeToMin(sa.inicio) - ER.timeToMin(sb.inicio);
      });

      const horas = [];
      for (let h = Math.ceil(ini / 60); h <= Math.floor(fin / 60); h += 2) {
        horas.push(`<div class="gantt-hour" style="left:${((h * 60 - ini) / totalMin) * 100}%">${ER.pad(h)}:00</div>`);
      }
      const gridlines = [];
      for (let h = Math.ceil(ini / 60); h <= Math.floor(fin / 60); h++) {
        gridlines.push(`<div class="gantt-gridline" style="left:${((h * 60 - ini) / totalMin) * 100}%"></div>`);
      }
      const nowMin = ER.timeToMin(ER.nowTime());
      const nowLine = (fechaLinea === ER.today() && nowMin >= ini && nowMin <= fin)
        ? `<div class="gantt-now" style="left:${((nowMin - ini) / totalMin) * 100}%"></div>` : '';
      const shiftLine = (ER.timeToMin(cfg.horaCambioTurno) > ini && ER.timeToMin(cfg.horaCambioTurno) < fin)
        ? `<div class="gantt-shiftline" style="left:${((ER.timeToMin(cfg.horaCambioTurno) - ini) / totalMin) * 100}%"></div>` : '';

      const ganttRows = expected.map((m) => {
        const s = ER.scheduleOf(m, fechaLinea);
        const a = Math.max(ini, ER.timeToMin(s.inicio));
        const b = Math.min(fin, ER.timeToMin(s.fin));
        const left = ((a - ini) / totalMin) * 100;
        const width = Math.max(2, ((b - a) / totalMin) * 100);
        return `<div class="gantt-row">
          <div class="gantt-row-label">${ER.avatar(m.nombre, 'sm')}<span class="truncate">${ER.esc(m.nombre)}</span></div>
          <div class="gantt-track">
            ${gridlines.join('')}
            <button class="gantt-bar ${m.turno === 'noche' ? 'night' : ''} ${ER.getOverride(m.id, fechaLinea) ? 'override' : ''}" style="left:${left}%;width:${width}%" data-action="horario-celda" data-mid="${m.id}" data-fecha="${fechaLinea}" title="${ER.timeLabel(s.inicio)} a ${ER.timeLabel(s.fin)}">${ER.timeLabel(s.inicio)}–${ER.timeLabel(s.fin)}</button>
          </div>
        </div>`;
      }).join('');

      const timelineHtml = `<div class="card mb-16">
        <div class="card-h"><div><h3>Línea de tiempo · ${ER.fmtDate(fechaLinea, 'weekdayLong')}</h3><div class="sub">${expected.length} motorizados programados · de ${ER.timeLabel(cfg.jornadaInicio)} a ${ER.timeLabel(cfg.jornadaFin)}</div></div>
          <input class="input" type="date" id="horario-fecha" value="${fechaLinea}" style="width:auto;min-height:36px;padding:6px 9px"></div>
        <div class="card-b scroll-x" style="padding:10px 14px 18px">
          ${expected.length ? `<div class="gantt">
            <div class="gantt-head"><div></div><div class="gantt-hours">${horas.join('')}</div></div>
            <div style="position:relative">${shiftLine}${nowLine}</div>
            ${ganttRows}
          </div>` : '<div class="empty" style="padding:26px"><p>No hay motorizados programados ese día.</p></div>'}
        </div>
      </div>`;

      const weekHtml = `<div class="card mb-16">
        <div class="card-b" style="padding:12px 14px">
          <div class="between wrap gap-10 horario-head">
            <div class="row gap-6">
              <button class="btn sm" data-action="horario-prev">${ER.icon('chevron-left')}</button>
              <button class="btn sm" data-action="horario-hoy">Hoy</button>
              <button class="btn sm" data-action="horario-next">${ER.icon('chevron-right')}</button>
              <span class="bold" style="margin-left:6px">${ER.fmtRange(weekStart, weekEnd)}</span>
            </div>
            <div class="chips">
              <button class="chip ${vista === 'semana' ? 'active' : ''}" data-action="horario-vista" data-vista="semana">Semana</button>
              <button class="chip ${vista === 'linea' ? 'active' : ''}" data-action="horario-vista" data-vista="linea">Línea de tiempo</button>
            </div>
          </div>
        </div>
      </div>`;

      return `
      ${weekHtml}
      ${advertencias.length ? `<div class="alert yellow mb-16">
        <div class="a-icon">${ER.icon('alert')}</div>
        <div class="grow"><div class="a-title">Día libre en fin de semana</div>
        <div class="a-text">${advertencias.map((m) => ER.esc(m.nombre) + ' (' + ER.diaLibreTexto(m) + ')').join(' · ')}. Sábado y domingo son los días de más demanda.</div></div>
      </div>` : ''}
      <div class="alert blue mb-16">
        <div class="a-icon">${ER.icon('clock')}</div>
        <div class="grow"><div class="a-title">Cambio de turno: ${ER.timeLabel(cfg.horaCambioTurno)}</div>
        <div class="a-text">El horario se arma solo con los días y la hora de entrada de cada ficha. Haz clic en un día para asignar o cambiar el horario.</div></div>
        <a class="btn sm" href="#/ajustes">Cambiar hora</a>
      </div>
      ${vista === 'linea' ? timelineHtml : tablaTurno('dia') + tablaTurno('noche')}

      <div class="card">
        <div class="card-h"><div><h3>Resumen de la semana</h3><div class="sub">Asistencia y puntualidad por motorizado</div></div><a class="btn ghost sm" href="#/asistencia">Asistencia</a></div>
        <div class="table-wrap">
          <table class="table compact">
            <thead><tr><th>Motorizado</th><th>Programados</th><th>A tiempo</th><th>Tardanzas</th><th>Faltas</th><th>Puntualidad</th></tr></thead>
            <tbody>${activos.map((m) => {
              const s = ER.resumenAsistencia(m, weekStart, weekEnd);
              return `<tr>
                <td><div class="row gap-6">${ER.avatar(m.nombre, 'sm')}<span class="cell-main">${ER.esc(m.nombre)}</span></div></td>
                <td>${s.programados}</td><td class="bold" style="color:var(--ok)">${s.asistio}</td>
                <td style="color:var(--warn)">${s.tarde}</td><td style="color:var(--danger)">${s.falta}</td>
                <td style="min-width:120px"><div class="progress-row"><div class="progress thin"><span style="width:${s.pctPuntual}%"></span></div><span class="pct">${s.pctPuntual}%</span></div></td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="muted center" style="padding:20px">Sin motorizados activos.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    },
    mount(root) {
      const f = root.querySelector('#horario-fecha');
      if (f) f.addEventListener('change', () => { ER.ui.horario.fecha = f.value; ER.ui.horario.vista = 'linea'; ER.render(); });
    }
  };

  ER.openHorarioCelda = function (mid, fecha) {
    const m = ER.getMotorizado(mid);
    if (!m) return;
    const ov = ER.getOverride(mid, fecha);
    const sch = ER.scheduleOf(m, fecha);
    const base = ER.worksOn(m, fecha) ? { inicio: m.horaEntrada, fin: ER.baseEnd(m) } : null;
    const inicio = ov && !ov.libre ? ov.inicio : (base ? base.inicio : (m.turno === 'noche' ? ER.S.config.horaCambioTurno : ER.S.config.jornadaInicio));
    const finV = ov && !ov.libre ? ov.fin : (base ? base.fin : ER.S.config.jornadaFin);

    ER.modal({
      title: 'Cambiar horario del día',
      subtitle: `${ER.esc(m.nombre)} · ${ER.fmtDate(fecha, 'weekdayLong')}`,
      size: 'sm',
      body: `<div class="alert ${base ? 'blue' : 'yellow'}" style="margin-bottom:14px;padding:10px 12px">
        <div class="a-icon" style="width:28px;height:28px">${ER.icon('clock', 'sm')}</div>
        <div class="grow"><div class="a-title" style="font-size:12.5px">${base ? 'Horario base: ' + ER.timeLabel(base.inicio) + ' a ' + ER.timeLabel(base.fin) : 'Ese día no trabaja según su ficha'}</div>
        <div class="a-text">${ov ? 'Tiene un cambio manual para este día.' : 'Puedes asignarle un horario solo para esta fecha.'}</div></div>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        <div class="field"><label>Desde</label><input class="input" type="time" id="hc-inicio" value="${ER.toTimeInput(inicio)}"></div>
        <div class="field"><label>Hasta</label><input class="input" type="time" id="hc-fin" value="${ER.toTimeInput(finV)}"></div>
      </div>
      <div class="hint mt-8">Si el turno termina a medianoche, deja 23:59: se guarda como 24:00.</div>`,
      footer: `${ov ? `<button class="btn danger sm left" data-quitar type="button">Quitar cambio</button>` : ''}
        <button class="btn" data-libre type="button">Día libre</button>
        <button class="btn" data-close type="button">Cancelar</button>
        <button class="btn primary" data-ok type="button">Guardar</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const i = el.querySelector('#hc-inicio').value;
          const f = ER.fromTimeInput(el.querySelector('#hc-fin').value);
          if (!i || !f) { ER.toast('Completa las dos horas', 'err'); return; }
          if (ER.timeToMin(f) <= ER.timeToMin(i)) { ER.toast('La hora de salida debe ser mayor', 'err'); return; }
          if (ov) { ov.inicio = i; ov.fin = f; ov.libre = false; }
          else ER.S.horarios.push({ id: ER.uid(), motorizadoId: mid, fecha, inicio: i, fin: f, libre: false });
          ER.log('Horario modificado', `${m.nombre} · ${ER.fmtDate(fecha)} · ${i}–${f}`);
          ER.save(); close(); ER.render(); ER.toast('Horario actualizado', 'ok');
        });
        el.querySelector('[data-libre]').addEventListener('click', () => {
          if (ov) { ov.libre = true; ov.inicio = ''; ov.fin = ''; }
          else ER.S.horarios.push({ id: ER.uid(), motorizadoId: mid, fecha, inicio: '', fin: '', libre: true });
          ER.log('Día libre asignado', `${m.nombre} · ${ER.fmtDate(fecha)}`);
          ER.save(); close(); ER.render(); ER.toast('Día marcado como libre', 'ok');
        });
        const q = el.querySelector('[data-quitar]');
        if (q) q.addEventListener('click', () => {
          ER.S.horarios = ER.S.horarios.filter((h) => !(h.motorizadoId === mid && h.fecha === fecha));
          ER.log('Cambio de horario eliminado', `${m.nombre} · ${ER.fmtDate(fecha)}`);
          ER.save(); close(); ER.render(); ER.toast('Cambio eliminado', 'ok');
        });
      }
    });
  };

  /* ============================================================
     Vista ASISTENCIA
     ============================================================ */
  ER.views.asistencia = {
    render() {
      const ui = ER.ui.asistencia || (ER.ui.asistencia = {});
      const fecha = ui.fecha || ER.today();
      const mes = ui.mes || ER.startOfMonth(ER.today());
      ER.ui.asistencia.fecha = fecha;
      ER.ui.asistencia.mes = mes;
      const mesFin = ER.endOfMonth(mes);
      const esperados = ER.expectedOn(fecha);
      // Incluye también a quien tenga un registro ese día aunque no esté
      // programado (por ejemplo, una ruta guardada con hora de llegada).
      const idsEsperados = esperados.map((m) => m.id);
      const conRegistro = ER.S.asistencias
        .filter((a) => a.fecha === fecha && !idsEsperados.includes(a.motorizadoId))
        .map((a) => ER.getMotorizado(a.motorizadoId))
        .filter((m) => m && m.activo !== false);
      const lista = esperados.concat(conRegistro);
      const cfg = ER.S.config;
      const futuro = fecha > ER.today();

      const filas = lista.map((m) => {
        const sch = ER.scheduleOf(m, fecha);
        const reg = ER.asistenciaEn(m.id, fecha);
        let estado = ER.estadoAsistencia(m, fecha, reg);
        let badge = '<span class="badge">Pendiente</span>';
        let extra = '';
        if (estado === 'asistio') badge = '<span class="badge green">Asistió</span>';
        if (estado === 'tarde') {
          const min = reg && reg.horaLlegada ? ER.minutosTarde(sch.inicio, reg.horaLlegada) : 0;
          badge = `<span class="badge warn">Tardanza${min ? ' · ' + min + ' min' : ''}</span>`;
        }
        if (estado === 'falta') badge = '<span class="badge red">Falta</span>';
        if (reg && reg.horaLlegada && estado !== 'falta') extra = `<span class="xs muted">Entró ${ER.timeLabel(reg.horaLlegada)}</span>`;
        return `<div class="card" style="box-shadow:none;margin-bottom:7px">
          <div class="card-b" style="padding:11px 13px">
            <div class="row wrap gap-8">
              ${ER.avatar(m.nombre, 'sm')}
              <div class="grow" style="min-width:130px">
                <div class="bold" style="font-size:13px">${ER.esc(m.nombre)}</div>
                <div class="xs muted">Programado ${ER.timeLabel(sch.inicio)} – ${ER.timeLabel(sch.fin)} · ${extra || 'sin registro'}</div>
              </div>
              <div class="row gap-6">
                <input class="input js-asistencia-hora" type="time" data-mid="${m.id}" value="${reg && reg.horaLlegada ? reg.horaLlegada : ''}" style="width:112px;min-height:36px;padding:6px 8px" ${futuro ? 'disabled' : ''} title="Hora real de ingreso">
                ${badge}
                <button class="btn sm ghost" data-action="asistencia-falta" data-mid="${m.id}" data-fecha="${fecha}" title="Marcar falta" ${futuro ? 'disabled' : ''}>${ER.icon('x')}</button>
                ${reg ? `<button class="btn sm ghost" data-action="asistencia-limpiar" data-mid="${m.id}" data-fecha="${fecha}" title="Borrar registro">${ER.icon('trash')}</button>` : ''}
              </div>
            </div>
          </div>
        </div>`;
      }).join('');

      const resumen = ER.resumenAsistenciaTodos(mes, mesFin);
      const totales = resumen.reduce((a, x) => ({
        programados: a.programados + x.programados, asistio: a.asistio + x.asistio,
        tarde: a.tarde + x.tarde, falta: a.falta + x.falta, minutos: a.minutos + x.minutosTarde
      }), { programados: 0, asistio: 0, tarde: 0, falta: 0, minutos: 0 });

      const detalleReciente = ER.S.asistencias.filter((a) => a.estado === 'tarde' || a.estado === 'falta')
        .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);

      return `
      <div class="between wrap mb-16" style="gap:10px">
        <div class="row gap-8 wrap">
          <div class="field" style="min-width:170px"><label>Fecha de asistencia</label><input class="input" type="date" id="asistencia-fecha" value="${fecha}" max="${ER.today()}"></div>
          <button class="btn sm" data-action="asistencia-hoy" style="margin-top:18px">Hoy</button>
        </div>
        <div class="row gap-6" style="margin-top:18px">
          <span class="badge outline">${ER.esc(cfg.horaCambioTurno)} cambio de turno</span>
          <button class="btn sm" data-action="asistencia-todos" data-fecha="${fecha}" ${futuro || !lista.length ? 'disabled' : ''}>${ER.icon('check')} Todos a tiempo</button>
        </div>
      </div>

      ${futuro ? `<div class="alert yellow mb-16"><div class="a-icon">${ER.icon('clock')}</div><div class="grow"><div class="a-title">Estás viendo una fecha futura</div><div class="a-text">La asistencia se registra el mismo día o hacia atrás.</div></div></div>` : ''}

      <div class="grid kpi mb-16">
        <div class="card stat"><span class="accent"></span><div class="label">Programados hoy</div><div class="value sm">${lista.length}</div><div class="meta">${ER.fmtDate(fecha, 'weekdayLong')}</div></div>
        <div class="card stat"><span class="accent" style="background:#10B981"></span><div class="label">Mes · a tiempo</div><div class="value sm">${totales.asistio}</div><div class="meta">de ${totales.programados} días programados</div></div>
        <div class="card stat"><span class="accent" style="background:#F59E0B"></span><div class="label">Mes · tardanzas</div><div class="value sm">${totales.tarde}</div><div class="meta">${totales.minutos} minutos acumulados</div></div>
        <div class="card stat"><span class="accent" style="background:#EF4444"></span><div class="label">Mes · faltas</div><div class="value sm">${totales.falta}</div><div class="meta">${ER.fmtDate(mes, 'month')}</div></div>
      </div>

      <div class="card mb-16">
        <div class="card-h"><div><h3>Registro del día</h3><div class="sub">Según el horario, se marca tardanza si llega después de su hora</div></div><span class="badge ${futuro ? 'warn' : 'green'}">${futuro ? 'Fecha futura' : 'Editable'}</span></div>
        <div class="card-b" style="padding:12px 14px">
          ${filas || `<div class="empty" style="padding:26px"><div class="empty-icon">${ER.icon('clock')}</div><h3>No hay motorizados programados</h3><p>Revisa el horario general o cambia la fecha.</p><a class="btn sm" href="#/horario">Ver horario</a></div>`}
        </div>
        <div class="card-b" style="border-top:1px solid var(--border);padding:10px 14px;background:var(--surface-2);border-radius:0 0 var(--radius) var(--radius)">
          <div class="xs muted">La hora de entrada se guarda al cambiarla. Si no vino, usa la ✕ para marcar falta.</div>
        </div>
      </div>

      <div class="card mb-16">
        <div class="card-h"><div><h3>Resumen de puntualidad</h3><div class="sub">Asistencias, tardanzas y faltas del mes</div></div>
          <input class="input" type="month" id="asistencia-mes" value="${mes.slice(0, 7)}" style="width:auto;min-height:36px;padding:6px 9px"></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Motorizado</th><th>Programados</th><th>A tiempo</th><th>Tardanzas</th><th>Faltas</th><th>Puntualidad</th></tr></thead>
            <tbody>${resumen.map((x) => `<tr>
              <td><div class="row gap-6">${ER.avatar(x.motorizado.nombre, 'sm')}<div><div class="cell-main">${ER.esc(x.motorizado.nombre)}</div><div class="cell-sub">${x.motorizado.tipo === 'parcial' ? 'Parcial' : 'En ruta'}</div></div></div></td>
              <td>${x.programados}</td>
              <td class="bold" style="color:var(--ok)">${x.asistio}</td>
              <td style="color:var(--warn)">${x.tarde}</td>
              <td style="color:var(--danger)">${x.falta}</td>
              <td style="min-width:130px"><div class="progress-row"><div class="progress thin"><span style="width:${x.pctPuntual}%;background:${x.pctPuntual >= 80 ? 'var(--yellow)' : x.pctPuntual >= 50 ? '#F59E0B' : '#EF4444'}"></span></div><span class="pct">${x.pctPuntual}%</span></div></td>
            </tr>`).join('') || '<tr><td colspan="6" class="muted center" style="padding:20px">Sin datos.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div><h3>Últimas tardanzas y faltas</h3><div class="sub">Para revisar en la reunión semanal</div></div><a class="btn ghost sm" href="#/notas">Notas</a></div>
        <div class="table-wrap">
          <table class="table compact">
            <thead><tr><th>Fecha</th><th>Motorizado</th><th>Programado</th><th>Llegó</th><th>Estado</th></tr></thead>
            <tbody>${detalleReciente.map((a) => {
              const m = ER.getMotorizado(a.motorizadoId);
              return `<tr>
                <td>${ER.fmtDate(a.fecha, 'medium')}</td>
                <td>${ER.esc(m ? m.nombre : 'Eliminado')}</td>
                <td>${ER.timeLabel(a.horaProgramada)}</td>
                <td>${a.horaLlegada ? ER.timeLabel(a.horaLlegada) : '—'}</td>
                <td>${a.estado === 'tarde' ? '<span class="badge warn">Tardanza</span>' : '<span class="badge red">Falta</span>'}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="5" class="muted center" style="padding:20px">Sin tardanzas ni faltas registradas.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    },
    mount(root) {
      const f = root.querySelector('#asistencia-fecha');
      if (f) f.addEventListener('change', () => { ER.ui.asistencia.fecha = f.value; ER.render(); });
      const mes = root.querySelector('#asistencia-mes');
      if (mes) mes.addEventListener('change', () => { ER.ui.asistencia.mes = mes.value + '-01'; ER.render(); });
      root.querySelectorAll('.js-asistencia-hora').forEach((inp) => {
        inp.addEventListener('change', () => {
          ER.registrarAsistencia(inp.dataset.mid, f ? f.value : ER.ui.asistencia.fecha, inp.value);
        });
      });
    }
  };

  ER.registrarAsistencia = function (mid, fecha, hora) {
    const m = ER.getMotorizado(mid);
    if (!m) return;
    const sch = ER.scheduleOf(m, fecha);
    if (!sch) { ER.toast('Ese día no está programado', 'err'); return; }
    if (!hora) { ER.toast('Escribe la hora de ingreso', 'err'); return; }
    let reg = ER.asistenciaEn(mid, fecha);
    if (!reg) {
      reg = { id: ER.uid(), motorizadoId: mid, fecha, horaProgramada: sch.inicio, horaLlegada: hora, estado: '', nota: '', createdAt: new Date().toISOString() };
      ER.S.asistencias.push(reg);
    }
    reg.horaProgramada = sch.inicio;
    reg.horaLlegada = hora;
    reg.estado = ER.calcularEstadoAsistencia(sch.inicio, hora);
    reg.nota = reg.nota || '';
    ER.log('Asistencia registrada', `${m.nombre} · ${ER.fmtDate(fecha)} · ${hora} · ${reg.estado === 'tarde' ? 'tardanza' : 'a tiempo'}`);
    ER.save();
    ER.render();
    ER.toast(reg.estado === 'tarde' ? 'Tardanza registrada' : 'Asistencia registrada', reg.estado === 'tarde' ? 'err' : 'ok');
  };

  /* ============================================================
     Acciones
     ============================================================ */
  ER.actions['motorizado-nuevo'] = () => ER.openMotorizadoForm();
  ER.actions['motorizado-editar'] = (el) => ER.openMotorizadoForm(el.dataset.id);
  ER.actions['motorizado-eliminar'] = (el) => ER.eliminarMotorizado(el.dataset.id);
  ER.actions['motorizado-wa'] = (el) => {
    const m = ER.getMotorizado(el.dataset.id);
    if (!m) return;
    if (!m.whatsapp) { ER.toast('Este motorizado no tiene WhatsApp registrado', 'err'); return; }
    window.open('https://wa.me/' + ER.normalizePhone(m.whatsapp), '_blank', 'noopener');
  };
  ER.actions['motorizado-nota'] = (el) => {
    ER.openNotaForm(el.dataset.id);
  };
  ER.actions['motorizados-filtro'] = (el) => {
    ER.ui.motorizados.filtro = el.dataset.filtro;
    ER.render();
  };

  ER.actions['horario-prev'] = () => { ER.ui.horario.semana = ER.addDays(ER.ui.horario.semana || ER.startOfWeek(ER.today()), -7); ER.render(); };
  ER.actions['horario-next'] = () => { ER.ui.horario.semana = ER.addDays(ER.ui.horario.semana || ER.startOfWeek(ER.today()), 7); ER.render(); };
  ER.actions['horario-hoy'] = () => { ER.ui.horario.semana = ER.startOfWeek(ER.today()); ER.ui.horario.fecha = ER.today(); ER.render(); };
  ER.actions['horario-vista'] = (el) => { ER.ui.horario.vista = el.dataset.vista; ER.render(); };
  ER.actions['horario-celda'] = (el) => ER.openHorarioCelda(el.dataset.mid, el.dataset.fecha);

  ER.actions['asistencia-falta'] = (el) => {
    const mid = el.dataset.mid, fecha = el.dataset.fecha;
    const m = ER.getMotorizado(mid);
    const sch = ER.scheduleOf(m, fecha);
    if (!m || !sch) return;
    let reg = ER.asistenciaEn(mid, fecha);
    if (!reg) {
      reg = { id: ER.uid(), motorizadoId: mid, fecha, horaProgramada: sch.inicio, horaLlegada: '', estado: 'falta', nota: '', createdAt: new Date().toISOString() };
      ER.S.asistencias.push(reg);
    } else {
      reg.estado = 'falta'; reg.horaLlegada = '';
    }
    ER.log('Falta registrada', `${m.nombre} · ${ER.fmtDate(fecha)}`);
    ER.save(); ER.render(); ER.toast('Falta registrada', 'ok');
  };
  ER.actions['asistencia-limpiar'] = (el) => {
    ER.S.asistencias = ER.S.asistencias.filter((a) => !(a.motorizadoId === el.dataset.mid && a.fecha === el.dataset.fecha));
    ER.save(); ER.render(); ER.toast('Registro eliminado', 'ok');
  };
  ER.actions['asistencia-todos'] = (el) => {
    const fecha = el.dataset.fecha;
    const esperados = ER.expectedOn(fecha);
    let n = 0;
    esperados.forEach((m) => {
      if (ER.asistenciaEn(m.id, fecha)) return;
      const sch = ER.scheduleOf(m, fecha);
      if (!sch) return;
      ER.S.asistencias.push({ id: ER.uid(), motorizadoId: m.id, fecha, horaProgramada: sch.inicio, horaLlegada: sch.inicio, estado: 'asistio', nota: '', createdAt: new Date().toISOString() });
      n++;
    });
    if (!n) { ER.toast('Todos ya tenían registro', 'err'); return; }
    ER.log('Asistencia masiva', `${n} motorizados a tiempo · ${ER.fmtDate(fecha)}`);
    ER.save(); ER.render(); ER.toast(`${n} asistencias registradas`, 'ok');
  };
  ER.actions['asistencia-hoy'] = () => { ER.ui.asistencia.fecha = ER.today(); ER.render(); };

})();
