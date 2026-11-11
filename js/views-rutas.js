/* ============================================================
   EN RUTA — Rutas, Carga rápida, Registro y Cobros
   ============================================================ */
(function () {
  'use strict';
  const ER = window.ER;
  if (!ER) return;

  /* ============================================================
     Utilidades comunes
     ============================================================ */
  ER.msgModal = function (title, text, phone, subtitle) {
    ER.modal({
      title,
      subtitle: subtitle || 'Revisa el mensaje antes de enviarlo. Nada se envía automáticamente.',
      size: 'lg',
      body: `<div class="field">
        <label>Mensaje para WhatsApp</label>
        <textarea class="textarea" id="msg-text" rows="10" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.55">${ER.esc(text)}</textarea>
        <div class="hint">Puedes editarlo antes de copiar o enviar. El mensaje usa el % de comisión guardado en cada ruta.</div>
      </div>`,
      footer: `<button class="btn" data-close type="button">Cerrar</button>
        <button class="btn" data-copy-msg type="button">${ER.icon('copy')} Copiar</button>
        <button class="btn wa" data-wa-msg type="button">${ER.icon('wa')} Abrir WhatsApp</button>`,
      onMount: (el, close) => {
        const ta = el.querySelector('#msg-text');
        el.querySelector('[data-copy-msg]').addEventListener('click', () => ER.copy(ta.value));
        el.querySelector('[data-wa-msg]').addEventListener('click', () => ER.openWA(phone, ta.value));
      }
    });
  };

  ER.snapshotRuta = function (r) {
    return {
      fecha: r.fecha, motorizadoId: r.motorizadoId, motorizadoNombre: r.motorizadoNombre,
      turno: r.turno, zona: r.zona, pedidos: r.pedidos, total: r.total,
      comision: r.comision, pct: r.pct, nota: r.nota, pagado: r.pagado, abono: r.abono
    };
  };

  ER.eliminarRuta = async function (id) {
    const r = ER.S.rutas.find((x) => x.id === id);
    if (!r) return;
    const ok = await ER.confirm(`¿Eliminar la ruta de <b>${ER.esc(ER.routeName(r))}</b> del ${ER.fmtDate(r.fecha)}?<br><br>Quedará en la Papelera y podrás recuperarla.`, {
      title: 'Eliminar ruta', danger: true, ok: 'Eliminar'
    });
    if (!ok) return;
    ER.aPapelera('ruta', JSON.parse(JSON.stringify(r)), `Ruta de ${ER.routeName(r)} · ${ER.fmtDate(r.fecha)} · ${ER.money(r.total)}`);
    ER.S.rutas = ER.S.rutas.filter((x) => x.id !== id);
    ER.log('Ruta eliminada', `${ER.routeName(r)} · ${ER.fmtDate(r.fecha)} · ${ER.money(r.total)}`);
    ER.save();
    ER.closeModals();
    ER.render();
    ER.toast('Ruta enviada a la papelera', 'ok');
  };

  ER.marcarSinPedidos = function (mid, fecha) {
    const m = ER.getMotorizado(mid);
    if (!m) return false;
    if (ER.registroEn(mid, fecha)) {
      ER.toast('Ya existe un registro para ese día', 'err');
      return false;
    }
    ER.S.noPedidos.push({
      id: ER.uid(), motorizadoId: mid, motorizadoNombre: m.nombre,
      fecha, createdAt: new Date().toISOString()
    });
    ER.log('Sin pedidos', `${m.nombre} · ${ER.fmtDate(fecha)}`);
    ER.save();
    return true;
  };

  ER.marcarSinPedidosSemana = function (mid) {
    const m = ER.getMotorizado(mid);
    if (!m) return false;
    const ini = ER.startOfWeek(ER.today());
    const fin = ER.addDays(ini, 6);
    let n = 0;
    for (let d = ini; d <= fin; d = ER.addDays(d, 1)) {
      if (d > ER.today()) break;
      if (ER.worksOn(m, d) && !ER.registroEn(mid, d)) {
        ER.S.noPedidos.push({ id: ER.uid(), motorizadoId: mid, motorizadoNombre: m.nombre, fecha: d, createdAt: new Date().toISOString() });
        n++;
      }
    }
    if (n) {
      ER.log('Sin pedidos (semana)', `${m.nombre} · ${n} días`);
      ER.save();
    }
    return n > 0;
  };

  /* ============================================================
     Formulario de ruta
     ============================================================ */
  ER.openRutaForm = function (opts) {
    opts = opts || {};
    const S = ER.S;
    if (!S.motorizados.length) {
      ER.modal({
        title: 'Nueva ruta',
        size: 'sm',
        body: `<div class="empty" style="padding:20px 6px">
          <div class="empty-icon">${ER.icon('users')}</div>
          <h3>Primero agrega a tus motorizados</h3>
          <p>Para registrar una ruta necesitas al menos una ficha de motorizado.</p>
          <a class="btn primary" href="#/motorizados" data-close>Agregar motorizado</a>
        </div>`
      });
      return;
    }

    const editando = opts.id ? S.rutas.find((r) => r.id === opts.id) : null;
    const activos = ER.ordenarMotorizados(S.motorizados);
    const midInicial = editando ? editando.motorizadoId : (opts.motorizadoId || (activos.find((m) => m.activo !== false) || activos[0]).id);
    const mInicial = ER.getMotorizado(midInicial) || activos[0];
    const fechaInicial = editando ? editando.fecha : (opts.fecha || ER.addDays(ER.today(), -1));
    const pctInicial = editando ? editando.pct : (mInicial.comision != null ? mInicial.comision : ER.S.config.comisionDefault);
    const turnoInicial = editando ? editando.turno : (mInicial.turno || 'noche');
    const zonaInicial = editando ? editando.zona : '';

    const opcionesM = activos.map((m) => `<option value="${m.id}" ${m.id === midInicial ? 'selected' : ''}>${ER.esc(m.nombre)} · ${m.tipo === 'parcial' ? 'Parcial' : 'En ruta'}${m.activo === false ? ' (inactivo)' : ''}</option>`).join('');
    const opcionesZ = ['<option value="">Sin zona</option>'].concat(
      ER.S.config.zonas.map((z) => `<option value="${ER.esc(z)}" ${z === zonaInicial ? 'selected' : ''}>${ER.esc(z)}</option>`)
    ).join('');

    const body = `
      <form id="ruta-form" autocomplete="off">
        <div class="form-grid">
          <div class="field">
            <label>Fecha <span class="req">*</span></label>
            <input class="input" type="date" id="rf-fecha" value="${fechaInicial}" required>
            <div class="hint">Viene el día anterior. Cámbiala si estás sacando un periodo atrasado.</div>
          </div>
          <div class="field">
            <label>Motorizado <span class="req">*</span></label>
            <select class="select" id="rf-mid">${opcionesM}</select>
          </div>
          <div class="field">
            <label>% de comisión</label>
            <input class="input" type="number" id="rf-pct" min="0" max="100" step="0.1" value="${pctInicial}">
            <div class="hint">Predeterminado ${ER.S.config.comisionDefault}%. Editable por motorizado.</div>
          </div>
          <div class="field">
            <label>Turno</label>
            <select class="select" id="rf-turno">
              <option value="dia" ${turnoInicial === 'dia' ? 'selected' : ''}>Día</option>
              <option value="noche" ${turnoInicial === 'noche' ? 'selected' : ''}>Noche</option>
            </select>
          </div>
          <div class="field span-2">
            <label>Zona (opcional)</label>
            <select class="select" id="rf-zona">${opcionesZ}</select>
          </div>
          <div class="field">
            <label>Hora de llegada</label>
            <input class="input" type="time" id="rf-llegada" value="${editando ? (editando.horaLlegada || '') : ''}">
            <div class="hint">Hora de ingreso a base o inicio de ruta.</div>
          </div>
          <div class="field span-2">
            <label>Pedidos <span class="req">*</span></label>
            <input class="input" type="text" id="rf-pedidos" inputmode="decimal" placeholder="5+5+5+5+6" value="${editando ? ER.esc(editando.pedidos) : ''}" autocomplete="off">
            <div class="hint">Escribe la suma tal como te la pasaron. Se guarda el texto original: “5 + 7 + 8”, no un monto único.</div>
          </div>
          <div class="span-2">
            <div class="row wrap gap-16" style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px 14px">
              <div><div class="xs muted">Total de pedidos</div><div class="bold mono" id="rf-total" style="font-size:17px">S/ 0.00</div></div>
              <div><div class="xs muted">Mi comisión</div><div class="bold mono" id="rf-com" style="font-size:17px;color:var(--ok)">S/ 0.00</div></div>
              <div class="grow"></div>
              <div id="rf-estado" class="badge">Escribe los pedidos</div>
            </div>
          </div>
          <div class="span-2 field">
            <label>Notas</label>
            <textarea class="textarea" id="rf-nota" rows="3" placeholder="Si hubo un problema con un pedido, la base te avisó o pasó algo, escríbelo aquí.">${editando ? ER.esc(editando.nota || '') : ''}</textarea>
            <div class="hint">Estas notas aparecen en Notas y reclamos para revisarlas en la reunión semanal.</div>
          </div>
          <div class="span-2" id="rf-aviso"></div>
        </div>
      </form>`;

    const footer = `
      ${editando ? `<button class="btn danger sm left" data-eliminar type="button">${ER.icon('trash')} Eliminar</button>` : ''}
      <button class="btn" data-close type="button">Cancelar</button>
      <button class="btn" data-save type="button">${ER.icon('check')} Guardar</button>
      <button class="btn wa" data-save-wa type="button">${ER.icon('wa')} Guardar y enviar</button>`;

    ER.modal({
      title: editando ? 'Editar ruta' : 'Nueva ruta',
      subtitle: editando ? `${ER.esc(ER.routeName(editando))} · ${ER.fmtDate(editando.fecha)}` : 'La comisión se calcula en vivo mientras escribes.',
      body, footer, size: 'lg',
      onMount: (el, close) => {
        const $ = (s) => el.querySelector(s);
        const fecha = $('#rf-fecha');
        const mid = $('#rf-mid');
        const pct = $('#rf-pct');
        const turno = $('#rf-turno');
        const zona = $('#rf-zona');
        const pedidos = $('#rf-pedidos');
        const nota = $('#rf-nota');
        const totalEl = $('#rf-total');
        const comEl = $('#rf-com');
        const estado = $('#rf-estado');
        const aviso = $('#rf-aviso');

        const llegada = $('#rf-llegada');
        
        function actualizar() {
          const calc = ER.calcularRuta(pedidos.value, Number(pct.value) || 0);
          const motorizado = ER.getMotorizado(mid.value);
          let tardanza = false;
          if (llegada.value && motorizado) {
            const programada = ER.horaProgramadaDe(motorizado, fecha.value);
            tardanza = ER.calcularEstadoAsistencia(programada, llegada.value) === 'tarde';
          }

          if (!pedidos.value.trim()) {
            totalEl.textContent = 'S/ 0.00';
            comEl.textContent = 'S/ 0.00';
            estado.className = 'badge';
            estado.textContent = 'Escribe los pedidos';
          } else if (!calc.ok) {
            totalEl.textContent = '—';
            comEl.textContent = '—';
            estado.className = 'badge red';
            estado.textContent = 'Revisa: ' + (calc.bad || 'formato inválido');
          } else {
            totalEl.textContent = ER.money(calc.total);
            comEl.textContent = ER.money(calc.comision);
            estado.className = 'badge ' + (tardanza ? 'danger' : 'green');
            estado.textContent = tardanza ? 'Llegó tarde' : (calc.tokens.length + ' pedidos');
          }
          const dup = ER.S.rutas.find((r) => r.motorizadoId === mid.value && r.fecha === fecha.value && (!editando || r.id !== editando.id));
          aviso.innerHTML = dup ? `<div class="alert yellow" style="padding:10px 12px">
            <div class="a-icon" style="width:28px;height:28px">${ER.icon('alert', 'sm')}</div>
            <div class="grow"><div class="a-title" style="font-size:12.5px">Ya existe una ruta de ${ER.esc(ER.routeName(dup))} ese día</div>
            <div class="a-text">Edita la ruta existente para no duplicar comisiones.</div></div>
            <button class="btn sm" data-editar-dup type="button">Editar</button>
          </div>` : '';
          const btn = aviso.querySelector('[data-editar-dup]');
          if (btn && dup) btn.addEventListener('click', () => { close(); ER.openRutaForm({ id: dup.id }); });
        }

        function actualizarMotorizado() {
          const m = ER.getMotorizado(mid.value);
          if (!m) return;
          pct.value = m.comision != null ? m.comision : ER.S.config.comisionDefault;
          turno.value = m.turno || 'noche';
          actualizar();
        }

        mid.addEventListener('change', actualizarMotorizado);
        [fecha, pct, pedidos, llegada].forEach((x) => x.addEventListener('input', actualizar));
        [fecha, llegada].forEach((x) => x.addEventListener('change', actualizar));
        actualizar();

        function guardar(enviar) {
          const fechaV = fecha.value;
          const midV = mid.value;
          const pctV = Number(pct.value);
          const pedidosV = pedidos.value.trim();
          if (!fechaV) { ER.toast('Elige la fecha', 'err'); fecha.focus(); return; }
          if (!midV) { ER.toast('Elige el motorizado', 'err'); return; }
          if (!pedidosV) { ER.toast('Escribe la suma de pedidos', 'err'); pedidos.focus(); return; }
          const calc = ER.calcularRuta(pedidosV, pctV);
          if (!calc.ok) { ER.toast('Revisa los pedidos: ' + (calc.bad || 'formato inválido'), 'err'); pedidos.focus(); return; }
          if (!(pctV >= 0 && pctV <= 100)) { ER.toast('El % debe estar entre 0 y 100', 'err'); pct.focus(); return; }
          const dup = ER.S.rutas.find((r) => r.motorizadoId === midV && r.fecha === fechaV && (!editando || r.id !== editando.id));
          if (dup) {
            ER.toast('Ya existe una ruta para ese motorizado y día. Edítala.', 'err', 4000);
            return;
          }
          const m = ER.getMotorizado(midV);
          const llegadaV = llegada.value;
          let ruta;
          if (editando) {
            ruta = editando;
            if (!Array.isArray(ruta.historial)) ruta.historial = [];
            ruta.historial.unshift({ fecha: new Date().toISOString(), datos: ER.snapshotRuta(ruta) });
            if (ruta.historial.length > 30) ruta.historial.length = 30;
            Object.assign(ruta, {
              fecha: fechaV, motorizadoId: midV, motorizadoNombre: m ? m.nombre : ruta.motorizadoNombre,
              turno: turno.value, zona: zona.value, pedidos: pedidosV, total: calc.total,
              comision: calc.comision, pct: pctV, nota: nota.value.trim(), horaLlegada: llegadaV,
              updatedAt: new Date().toISOString()
            });
            ER.log('Ruta editada', `${ER.routeName(ruta)} · ${ER.fmtDate(fechaV)} · ${ER.money(calc.total)}`);
          } else {
            ruta = {
              id: ER.uid(), motorizadoId: midV, motorizadoNombre: m ? m.nombre : '',
              fecha: fechaV, turno: turno.value, zona: zona.value, pedidos: pedidosV,
              total: calc.total, comision: calc.comision, pct: pctV, nota: nota.value.trim(),
              horaLlegada: llegadaV, pagado: false, abono: 0, historial: [],
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            };
            ER.S.rutas.push(ruta);
            ER.log('Ruta registrada', `${ER.routeName(ruta)} · ${ER.fmtDate(fechaV)} · ${ER.money(calc.total)}`);
          }
          ER.actualizarAsistenciaDesdeRuta(midV, fechaV, llegadaV);
          if (!ER.save()) return;
          close();
          ER.render();
          ER.toast(editando ? 'Ruta actualizada' : 'Ruta guardada', 'ok');
          if (enviar) {
            const txt = ER.msgCobro(m, [ruta], { pct: pctV });
            setTimeout(() => ER.openWA(m && m.whatsapp, txt), 150);
          }
        }

        el.querySelector('[data-save]').addEventListener('click', () => guardar(false));
        el.querySelector('[data-save-wa]').addEventListener('click', () => guardar(true));
        const del = el.querySelector('[data-eliminar]');
        if (del) del.addEventListener('click', () => ER.eliminarRuta(editando.id));
        const form = el.querySelector('#ruta-form');
        form.addEventListener('submit', (e) => { e.preventDefault(); guardar(false); });
      }
    });
  };

  /* ============================================================
     Historial de versiones
     ============================================================ */
  ER.openHistorial = function (id) {
    const r = ER.S.rutas.find((x) => x.id === id);
    if (!r) return;
    const hist = Array.isArray(r.historial) ? r.historial : [];
    const fila = (titulo, fecha, d, idx, actual) => `
      <div class="card" style="box-shadow:none;margin-bottom:9px">
        <div class="card-b" style="padding:11px 13px">
          <div class="between wrap gap-6">
            <div class="row gap-6"><span class="badge ${actual ? 'green' : ''}">${actual ? 'Versión actual' : 'Versión anterior'}</span><span class="xs muted">${ER.fmtDateTime(fecha)}</span></div>
            ${!actual ? `<button class="btn sm" data-restaurar="${idx}">${ER.icon('history')} Restaurar</button>` : ''}
          </div>
          <div class="grid cols-3 mt-8" style="gap:6px;font-size:11.5px">
            <div><span class="muted">Fecha:</span> <b>${ER.fmtDate(d.fecha)}</b></div>
            <div><span class="muted">Pedidos:</span> <b>${ER.esc(d.pedidos || '—')}</b></div>
            <div><span class="muted">Total:</span> <b>${ER.money(d.total)}</b></div>
            <div><span class="muted">Comisión:</span> <b>${ER.money(d.comision)} (${d.pct}%)</b></div>
            <div><span class="muted">Zona:</span> <b>${ER.esc(d.zona || '—')}</b></div>
            <div><span class="muted">Turno:</span> <b>${d.turno === 'dia' ? 'Día' : 'Noche'}</b></div>
          </div>
          ${d.nota ? `<div class="xs muted mt-4">Nota: ${ER.esc(d.nota)}</div>` : ''}
        </div>
      </div>`;

    ER.modal({
      title: 'Historial de versiones',
      subtitle: `${ER.esc(ER.routeName(r))} · ${ER.fmtDate(r.fecha)} · ${ER.money(r.total)}`,
      size: 'lg',
      body: `<div class="alert blue" style="margin-bottom:12px"><div class="a-icon">${ER.icon('history')}</div>
        <div class="grow"><div class="a-title">Cada edición guarda la versión anterior</div>
        <div class="a-text">Si hubo un error de tipeo, puedes volver a la versión que quieras. También queda registrado en el historial de cambios.</div></div></div>
        ${fila('actual', r.updatedAt || r.createdAt, r, 0, true)}
        ${hist.length ? hist.map((h, i) => fila('anterior', h.fecha, h.datos, i, false)).join('') : '<div class="empty" style="padding:22px"><p>Esta ruta todavía no tiene versiones anteriores.</p></div>'}`,
      footer: `<button class="btn" data-close type="button">Cerrar</button>`,
      onMount: (el, close) => {
        el.querySelectorAll('[data-restaurar]').forEach((b) => {
          b.addEventListener('click', async () => {
            const idx = Number(b.getAttribute('data-restaurar'));
            const h = hist[idx];
            if (!h) return;
            const ok = await ER.confirm('¿Restaurar esta versión? La versión actual se guardará en el historial.', { title: 'Restaurar versión', ok: 'Restaurar' });
            if (!ok) return;
            // Guarda la actual
            if (!Array.isArray(r.historial)) r.historial = [];
            r.historial.unshift({ fecha: new Date().toISOString(), datos: ER.snapshotRuta(r) });
            Object.assign(r, h.datos, { updatedAt: new Date().toISOString() });
            ER.log('Ruta restaurada', `${ER.routeName(r)} · ${ER.fmtDate(r.fecha)} · ${ER.money(r.total)}`);
            ER.save();
            close();
            ER.openHistorial(id);
            ER.render();
            ER.toast('Versión restaurada', 'ok');
          });
        });
      }
    });
  };

  /* ============================================================
     Vista RUTAS
     ============================================================ */
  ER.views.rutas = {
    render() {
      const ui = ER.ui.rutas || (ER.ui.rutas = { preset: 'semana', q: '' });
      const rango = ER.rangeOf(ui.preset);
      const q = String(ui.q || '').toLowerCase().trim();
      let rutas = ER.rutasEntre(rango.from, rango.to).slice();
      if (q) {
        rutas = rutas.filter((r) => (
          ER.routeName(r).toLowerCase().includes(q) ||
          String(r.pedidos || '').toLowerCase().includes(q) ||
          String(r.zona || '').toLowerCase().includes(q) ||
          String(r.nota || '').toLowerCase().includes(q)
        ));
      }
      rutas.sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.createdAt).localeCompare(String(a.createdAt)));
      const st = {
        total: ER.round2(rutas.reduce((a, r) => a + ER.totalRuta(r), 0)),
        comision: ER.round2(rutas.reduce((a, r) => a + ER.comisionRuta(r), 0)),
        count: rutas.length
      };
      const grupos = new Map();
      rutas.forEach((r) => {
        if (!grupos.has(r.fecha)) grupos.set(r.fecha, []);
        grupos.get(r.fecha).push(r);
      });

      const gruposHtml = Array.from(grupos.entries()).map(([fecha, lista]) => {
        const dt = ER.round2(lista.reduce((a, r) => a + ER.totalRuta(r), 0));
        const dc = ER.round2(lista.reduce((a, r) => a + ER.comisionRuta(r), 0));
        return `<div class="mb-16">
          <div class="between wrap mb-8" style="gap:6px">
            <div class="row gap-8">
              <span class="bold">${ER.fmtDate(fecha, 'weekdayLong')}</span>
              ${fecha === ER.today() ? '<span class="badge yellow">Hoy</span>' : ''}
              ${ER.demandOn(fecha).length ? `<span class="badge blue">${ER.icon('star', 'sm')} ${ER.esc(ER.demandOn(fecha)[0].nombre)}</span>` : ''}
            </div>
            <div class="xs muted">${lista.length} rutas · ${ER.money(dt)} generado · ${ER.money(dc)} comisión</div>
          </div>
          <div class="grid auto-320" style="gap:9px">
            ${lista.map((r) => ER.rutaCard(r)).join('')}
          </div>
        </div>`;
      }).join('');

      return `
      <div class="between wrap mb-16" style="gap:10px">
        <div class="chips">
          ${[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Semana'], ['mes', 'Mes'], ['todo', 'Todo']].map(([id, lb]) =>
            `<button class="chip ${ui.preset === id ? 'active' : ''}" data-action="rutas-filtro" data-preset="${id}">${lb}</button>`).join('')}
        </div>
        <div class="row gap-6 wrap">
          <div class="search-box"><svg class="icon"><use href="#i-search"/></svg><input class="input" id="rutas-q" placeholder="Buscar motorizado, pedido, nota…" value="${ER.esc(ui.q)}" style="min-width:220px"></div>
          <button class="btn primary" data-action="nueva-ruta">${ER.icon('plus')} Nueva ruta</button>
        </div>
      </div>

      <div class="grid kpi mb-16">
        <div class="card stat"><span class="accent"></span><div class="label">Rutas del periodo</div><div class="value sm">${st.count}</div><div class="meta">${ER.esc(rango.label)}</div></div>
        <div class="card stat"><span class="accent"></span><div class="label">Total generado</div><div class="value sm">${ER.money(st.total)}</div><div class="meta">Suma de pedidos</div></div>
        <div class="card stat"><span class="accent" style="background:#10B981"></span><div class="label">Mi comisión</div><div class="value sm">${ER.money(st.comision)}</div><div class="meta">Según el % de cada motorizado</div></div>
      </div>

      ${rutas.length ? gruposHtml : `<div class="card"><div class="empty">
        <div class="empty-icon">${ER.icon('map')}</div>
        <h3>No hay rutas en este periodo</h3>
        <p>Registra la primera ruta: la fecha viene con el día anterior y la comisión se calcula sola.</p>
        <button class="btn primary" data-action="nueva-ruta">${ER.icon('plus')} Nueva ruta</button>
      </div></div>`}`;
    },
    mount(root) {
      const q = root.querySelector('#rutas-q');
      if (q) {
        const handler = ER.debounce(() => {
          ER.ui.rutas.q = q.value;
          ER.render();
          const el = document.getElementById('rutas-q');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 300);
        q.addEventListener('input', handler);
      }
    }
  };

  ER.rutaCard = function (r) {
    const m = ER.getMotorizado(r.motorizadoId);
    return `<div class="card" style="box-shadow:none">
      <div class="card-b" style="padding:13px 14px">
        <div class="row top gap-8">
          ${ER.avatar(ER.routeName(r), 'sm')}
          <div class="grow" style="min-width:0">
            <div class="row wrap gap-4">
              <span class="bold truncate" style="font-size:13px">${ER.esc(ER.routeName(r))}</span>
              ${m ? ER.badgeTipo(m.tipo) : '<span class="badge">Eliminado</span>'}
              ${ER.badgePago(r)}
            </div>
            <div class="xs muted">${r.turno === 'dia' ? 'Día' : 'Noche'}${r.zona ? ' · ' + ER.esc(r.zona) : ''} · ${r.pct}%</div>
          </div>
          <div class="right" style="flex:none">
            <div class="bold mono" style="font-size:14px">${ER.money(r.total)}</div>
            <div class="xs" style="color:var(--ok)">${ER.money(r.comision)} com.</div>
          </div>
        </div>
        <div class="mt-8" style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-family:ui-monospace,Consolas,monospace;font-size:12px;overflow-x:auto;white-space:nowrap">
          ${ER.esc(r.pedidos)}
        </div>
        ${r.nota ? `<div class="xs muted mt-8" style="line-height:1.4">${ER.icon('message', 'sm')} ${ER.esc(r.nota)}</div>` : ''}
        ${(r.abono || 0) > 0 && !r.pagado ? `<div class="xs mt-4" style="color:var(--warn)">Abonado ${ER.money(r.abono)} · saldo ${ER.money(ER.balanceRuta(r))}</div>` : ''}
        <div class="row gap-4 mt-8 wrap">
          <button class="btn sm" data-action="ruta-editar" data-id="${r.id}">${ER.icon('edit')} Editar</button>
          <button class="btn sm wa" data-action="ruta-wa" data-id="${r.id}">${ER.icon('wa')} WhatsApp</button>
          <button class="btn sm ghost" data-action="ruta-copiar" data-id="${r.id}" title="Copiar mensaje de cobro">${ER.icon('copy')}</button>
          <button class="btn sm ghost" data-action="ruta-historial" data-id="${r.id}" title="Historial de versiones">${ER.icon('history')}</button>
          <button class="btn sm ghost" data-action="ruta-eliminar" data-id="${r.id}" title="Eliminar" style="margin-left:auto;color:var(--danger)">${ER.icon('trash')}</button>
        </div>
      </div>
    </div>`;
  };

  /* ============================================================
     Vista CARGA RÁPIDA
     ============================================================ */
  ER.views.carga = {
    render() {
      if (!ER.ui.cargaFecha) ER.ui.cargaFecha = ER.addDays(ER.today(), -1);
      const fecha = ER.ui.cargaFecha;
      const todos = !!ER.ui.cargaTodos;
      const activos = ER.ordenarMotorizados(ER.S.motorizados.filter((m) => m.activo !== false));
      let lista = todos ? activos : activos.filter((m) => ER.worksOn(m, fecha));
      // Incluye a quienes ya tienen ruta ese día, aunque no estén programados
      activos.forEach((m) => {
        if (!lista.includes(m) && ER.registroEn(m.id, fecha)) lista.push(m);
      });
      lista = ER.ordenarMotorizados(lista);

      const filas = lista.map((m) => {
        const existente = ER.rutaEn(m.id, fecha);
        const sin = ER.sinPedidosEn(m.id, fecha);
        const sched = ER.scheduleOf(m, fecha);
        return `<div class="carga-row" data-carga-row data-mid="${m.id}" style="${existente || sin ? 'opacity:.72' : ''}">
          <div class="row gap-8" style="min-width:0">
            ${ER.avatar(m.nombre, 'sm')}
            <div class="grow" style="min-width:0">
              <div class="bold truncate" style="font-size:13px">${ER.esc(m.nombre)}</div>
              <div class="xs muted truncate">${m.tipo === 'parcial' ? 'Parcial' : 'En ruta'} · ${m.turno === 'dia' ? 'Día' : 'Noche'}${sched ? ' · ' + ER.timeLabel(sched.inicio) : ''}${m.activo === false ? ' · Inactivo' : ''}</div>
            </div>
          </div>
          <div>
            ${existente ? `<span class="badge green">${ER.icon('check', 'sm')} ${ER.money(existente.total)}</span>` :
              sin ? '<span class="badge">Sin pedidos</span>' :
              `<input class="input js-carga-pedidos" type="text" inputmode="decimal" placeholder="5+5+5+5+6" autocomplete="off" ${existente ? 'disabled' : ''}>`}
          </div>
          <div class="js-carga-preview xs muted mono" style="min-width:88px">${existente ? ER.money(existente.comision) + ' com.' : sin ? '—' : 'S/ 0.00'}</div>
          <div>
            ${existente || sin ? '' : `<button class="btn sm ghost js-carga-sin" type="button" data-mid="${m.id}" title="Trabajó pero no tuvo pedidos">Sin pedidos</button>`}
          </div>
        </div>`;
      }).join('');

      const conRuta = lista.filter((m) => ER.rutaEn(m.id, fecha)).length;

      return `
      <div class="alert blue mb-16">
        <div class="a-icon">${ER.icon('zap')}</div>
        <div class="grow"><div class="a-title">Llena a todos de una vez</div>
        <div class="a-text">Escribe la suma de pedidos de cada motorizado (5+5+6). Al guardar se crean todas las rutas y los mensajes de cobro quedan listos para reenviar.</div></div>
      </div>

      <div class="card mb-16">
        <div class="card-b">
          <div class="between wrap gap-12">
            <div class="row gap-10 wrap">
              <div class="field" style="min-width:170px">
                <label>Fecha de las rutas</label>
                <input class="input" type="date" id="carga-fecha" value="${fecha}">
              </div>
              <div class="field" style="min-width:170px">
                <label>Motorizados</label>
                <label class="switch" style="height:42px"><input type="checkbox" id="carga-todos" ${todos ? 'checked' : ''}><span class="track"></span><span>Ver todos los activos</span></label>
              </div>
              <div class="xs muted" style="max-width:260px">${conRuta} de ${lista.length} ya tienen registro para este día.</div>
            </div>
            <div class="right">
              <div class="xs muted">Total del día</div>
              <div class="bold mono" id="carga-total" style="font-size:22px">S/ 0.00</div>
              <div class="xs muted">Comisión: <span id="carga-com" class="bold">S/ 0.00</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div><h3>Motorizados del ${ER.fmtDate(fecha, 'weekdayLong')}</h3><div class="sub">Una fila por motorizado</div></div>
          <div class="xs muted">${lista.length} en lista</div>
        </div>
        <div class="card-b" style="padding:10px 14px">
          ${lista.length ? `<div class="carga-list">${filas}</div>` : `<div class="empty" style="padding:30px 10px">
            <div class="empty-icon">${ER.icon('users')}</div>
            <h3>No hay motorizados programados para ese día</h3>
            <p>Activa “Ver todos los activos” para cargar a cualquiera, o revisa el horario.</p>
            <a class="btn sm" href="#/horario">Revisar horario</a>
          </div>`}
        </div>
        <div class="card-b" style="border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface-2);border-radius:0 0 var(--radius) var(--radius)">
          <div class="small"><span class="muted">Se guardarán</span> <b id="carga-count">0</b> <span class="muted">rutas</span></div>
          <button class="btn primary lg" data-action="carga-guardar">${ER.icon('check')} Guardar todo</button>
        </div>
      </div>`;
    },
    mount(root) {
      const fecha = root.querySelector('#carga-fecha');
      const todos = root.querySelector('#carga-todos');
      if (fecha) fecha.addEventListener('change', () => { ER.ui.cargaFecha = fecha.value; ER.render(); });
      if (todos) todos.addEventListener('change', () => { ER.ui.cargaTodos = todos.checked; ER.render(); });

      function recalc() {
        let total = 0, com = 0, count = 0;
        root.querySelectorAll('[data-carga-row]').forEach((row) => {
          const m = ER.getMotorizado(row.dataset.mid);
          const inp = row.querySelector('.js-carga-pedidos');
          const prev = row.querySelector('.js-carga-preview');
          if (!inp || !m) return;
          const calc = ER.calcularRuta(inp.value, m.comision);
          if (!inp.value.trim()) { if (prev) prev.textContent = 'S/ 0.00'; return; }
          if (!calc.ok) { if (prev) prev.textContent = 'Revisar'; return; }
          total += calc.total; com += calc.comision; count++;
          if (prev) prev.textContent = ER.money(calc.total) + ' · ' + ER.money(calc.comision);
        });
        const t = document.getElementById('carga-total');
        const c = document.getElementById('carga-com');
        const n = document.getElementById('carga-count');
        if (t) t.textContent = ER.money(total);
        if (c) c.textContent = ER.money(com);
        if (n) n.textContent = count;
      }

      root.querySelectorAll('.js-carga-pedidos').forEach((inp) => inp.addEventListener('input', recalc));
      root.querySelectorAll('.js-carga-sin').forEach((btn) => btn.addEventListener('click', () => {
        const mid = btn.dataset.mid;
        const row = btn.closest('[data-carga-row]');
        const inp = row.querySelector('.js-carga-pedidos');
        if (inp) inp.value = '';
        const m = ER.getMotorizado(mid);
        if (!m) return;
        // Solo marca visualmente; se guarda junto con el resto
        row.dataset.sin = '1';
        const prev = row.querySelector('.js-carga-preview');
        if (prev) prev.textContent = 'Sin pedidos';
        btn.remove();
        if (inp) inp.disabled = true;
        recalc();
      }));
      recalc();
    }
  };

  /* ============================================================
     Vista REGISTRO
     ============================================================ */
  ER.views.registro = {
    render() {
      const ui = ER.ui.registro;
      const S = ER.S;
      let rutas = ER.rutasEntre(ui.from || null, ui.to || null);
      if (ui.q) {
        const q = ui.q.toLowerCase();
        rutas = rutas.filter((r) => (
          ER.routeName(r).toLowerCase().includes(q) ||
          String(r.pedidos || '').toLowerCase().includes(q) ||
          String(r.zona || '').toLowerCase().includes(q) ||
          String(r.nota || '').toLowerCase().includes(q)
        ));
      }
      if (ui.motorizado) rutas = rutas.filter((r) => r.motorizadoId === ui.motorizado);
      if (ui.zona) rutas = rutas.filter((r) => (r.zona || '') === ui.zona);
      if (ui.turno) rutas = rutas.filter((r) => r.turno === ui.turno);
      if (ui.estado === 'pagado') rutas = rutas.filter((r) => r.pagado);
      if (ui.estado === 'pendiente') rutas = rutas.filter((r) => !r.pagado);

      const dir = ui.dir === 'asc' ? 1 : -1;
      const campo = ui.sort || 'fecha';
      rutas.sort((a, b) => {
        let va, vb;
        if (campo === 'motorizado') { va = ER.routeName(a); vb = ER.routeName(b); }
        else if (campo === 'pagado') { va = a.pagado ? 1 : 0; vb = b.pagado ? 1 : 0; }
        else if (campo === 'total') { va = ER.totalRuta(a); vb = ER.totalRuta(b); }
        else if (campo === 'comision') { va = ER.comisionRuta(a); vb = ER.comisionRuta(b); }
        else { va = a[campo] || ''; vb = b[campo] || ''; }
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });

      const total = ER.round2(rutas.reduce((a, r) => a + ER.totalRuta(r), 0));
      const comision = ER.round2(rutas.reduce((a, r) => a + ER.comisionRuta(r), 0));
      const pageSize = 40;
      const totalPages = Math.max(1, Math.ceil(rutas.length / pageSize));
      const page = Math.min(ui.page || 1, totalPages);
      const pageRows = rutas.slice((page - 1) * pageSize, page * pageSize);

      const th = (key, label) => `<th class="sortable ${campo === key ? 'sorted' : ''}" data-action="registro-orden" data-sort="${key}">${label}<span class="sort-ind">${campo === key ? (dir === 1 ? '▲' : '▼') : '↕'}</span></th>`;

      const opcionesM = ER.ordenarMotorizados(S.motorizados).map((m) => `<option value="${m.id}" ${ui.motorizado === m.id ? 'selected' : ''}>${ER.esc(m.nombre)}</option>`).join('');
      const opcionesZ = S.config.zonas.map((z) => `<option value="${ER.esc(z)}" ${ui.zona === z ? 'selected' : ''}>${ER.esc(z)}</option>`).join('');

      const filas = pageRows.map((r) => `<tr>
        <td><div class="cell-main">${ER.fmtDate(r.fecha, 'short')}</div><div class="cell-sub">${ER.DIAS_CORTOS[ER.weekday(r.fecha)]} ${r.fecha.slice(0, 4)}</div></td>
        <td class="sticky-col"><div class="row gap-6">${ER.avatar(ER.routeName(r), 'sm')}<div><div class="cell-main">${ER.esc(ER.routeName(r))} ${ER.estadoPuntualidadRuta(r) === 'tarde' ? '<span class="badge danger" style="padding:1px 4px;font-size:9px">Tarde</span>' : ''}</div><div class="cell-sub">${ER.getMotorizado(r.motorizadoId) ? (ER.getMotorizado(r.motorizadoId).tipo === 'parcial' ? 'Parcial' : 'En ruta') : 'Eliminado'}</div></div></div></td>
        <td><span class="badge ${r.turno === 'noche' ? 'dark' : 'yellow'}">${r.turno === 'noche' ? 'Noche' : 'Día'}</span></td>
        <td class="small">${ER.esc(r.zona || '—')}</td>
        <td><span class="mono" style="font-size:12px">${ER.esc(r.pedidos)}</span>${r.nota ? `<div class="cell-sub" title="${ER.esc(r.nota)}">${ER.icon('message', 'sm')} ${ER.esc(r.nota.length > 26 ? r.nota.slice(0, 26) + '…' : r.nota)}</div>` : ''}</td>
        <td class="right mono">${ER.money(r.total)}</td>
        <td class="right mono bold">${ER.money(r.comision)}<div class="cell-sub">${r.pct}%</div></td>
        <td>${ER.badgePago(r)}</td>
        <td class="actions">
          <button class="icon-btn" data-action="ruta-editar" data-id="${r.id}" title="Editar">${ER.icon('edit', 'sm')}</button>
          <button class="icon-btn" data-action="ruta-wa" data-id="${r.id}" title="WhatsApp">${ER.icon('wa', 'sm')}</button>
          <button class="icon-btn" data-action="ruta-historial" data-id="${r.id}" title="Historial">${ER.icon('history', 'sm')}</button>
          <button class="icon-btn danger" data-action="ruta-eliminar" data-id="${r.id}" title="Eliminar">${ER.icon('trash', 'sm')}</button>
        </td>
      </tr>`).join('');

      return `
      <div class="card mb-16">
        <div class="card-b" style="padding:14px">
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
            <div class="field"><label>Buscar</label><div class="search-box"><svg class="icon"><use href="#i-search"/></svg><input class="input" id="reg-q" placeholder="Nombre, pedido, nota…" value="${ER.esc(ui.q)}"></div></div>
            <div class="field"><label>Motorizado</label><select class="select" id="reg-mid"><option value="">Todos</option>${opcionesM}</select></div>
            <div class="field"><label>Zona</label><select class="select" id="reg-zona"><option value="">Todas</option>${opcionesZ}</select></div>
            <div class="field"><label>Turno</label><select class="select" id="reg-turno"><option value="">Todos</option><option value="dia" ${ui.turno === 'dia' ? 'selected' : ''}>Día</option><option value="noche" ${ui.turno === 'noche' ? 'selected' : ''}>Noche</option></select></div>
            <div class="field"><label>Pago</label><select class="select" id="reg-estado"><option value="">Todos</option><option value="pagado" ${ui.estado === 'pagado' ? 'selected' : ''}>Pagado</option><option value="pendiente" ${ui.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option></select></div>
            <div class="field"><label>Desde</label><input class="input" type="date" id="reg-from" value="${ui.from || ''}"></div>
            <div class="field"><label>Hasta</label><input class="input" type="date" id="reg-to" value="${ui.to || ''}"></div>
            <div class="field"><label>&nbsp;</label><button class="btn" data-action="registro-limpiar">${ER.icon('refresh')} Limpiar</button></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h">
          <div><h3>Registro de pedidos</h3><div class="sub">${rutas.length} rutas · ${ER.money(total)} generado · ${ER.money(comision)} comisión</div></div>
          <div class="row gap-6 wrap">
            <button class="btn sm" data-action="registro-copiar">${ER.icon('copy')} Copiar lo que veo</button>
            <button class="btn sm" data-action="registro-exportar">${ER.icon('download')} Exportar CSV</button>
            <button class="btn sm primary" data-action="nueva-ruta">${ER.icon('plus')} Nueva</button>
          </div>
        </div>
        <div class="table-wrap reg-table">
          <table class="table">
            <thead><tr>
              ${th('fecha', 'Fecha')}${th('motorizado', 'Motorizado')}${th('turno', 'Turno')}${th('zona', 'Zona')}${th('pedidos', 'Pedidos')}${th('total', 'Total')}${th('comision', 'Comisión')}${th('pagado', 'Pago')}<th class="right">Acciones</th>
            </tr></thead>
            <tbody>${filas || `<tr><td colspan="9"><div class="empty" style="padding:34px"><h3>Sin resultados</h3><p>Prueba con otros filtros o registra una nueva ruta.</p></div></td></tr>`}</tbody>
            <tfoot><tr>
              <td colspan="5">Totales filtrados</td>
              <td class="right mono">${ER.money(total)}</td>
              <td class="right mono">${ER.money(comision)}</td>
              <td colspan="2"></td>
            </tr></tfoot>
          </table>
        </div>
        <div class="reg-cards">
          ${pageRows.map((r) => `<div class="reg-card">
            <div class="between gap-10" style="align-items:flex-start">
              <div class="row gap-8" style="min-width:0">
                ${ER.avatar(ER.routeName(r), 'sm')}
                <div style="min-width:0">
                  <div class="bold truncate" style="font-size:13px">${ER.esc(ER.routeName(r))} ${ER.estadoPuntualidadRuta(r) === 'tarde' ? '<span class="badge danger" style="padding:1px 4px;font-size:9px">Tarde</span>' : ''}</div>
                  <div class="xs muted">${ER.fmtDate(r.fecha, 'short')} · ${r.turno === 'noche' ? 'Noche' : 'Día'} · ${ER.esc(r.zona || 'Sin zona')}</div>
                </div>
              </div>
              ${ER.badgePago(r)}
            </div>
            <div class="reg-metrics">
              <div><div class="lbl">Pedidos</div><div class="mono" style="font-size:12px">${ER.esc(r.pedidos)}</div></div>
              <div class="right"><div class="lbl">Total</div><div class="mono bold">${ER.money(r.total)}</div></div>
              <div class="right"><div class="lbl">Comisión</div><div class="mono bold">${ER.money(r.comision)}</div><div class="xs muted">${r.pct}%</div></div>
            </div>
            ${r.nota ? `<div class="xs muted mt-8">${ER.icon('message', 'sm')} ${ER.esc(r.nota)}</div>` : ''}
            <div class="row gap-4 mt-8 wrap">
              <button class="btn sm" data-action="ruta-editar" data-id="${r.id}">${ER.icon('edit', 'sm')} Editar</button>
              <button class="btn sm" data-action="ruta-wa" data-id="${r.id}">${ER.icon('wa', 'sm')} WhatsApp</button>
              <button class="btn sm" data-action="ruta-historial" data-id="${r.id}">${ER.icon('history', 'sm')} Historial</button>
              <button class="btn sm danger" data-action="ruta-eliminar" data-id="${r.id}" title="Eliminar" style="margin-left:auto">${ER.icon('trash', 'sm')}</button>
            </div>
          </div>`).join('') || `<div class="empty" style="padding:30px"><h3>Sin resultados</h3><p>Prueba con otros filtros o registra una nueva ruta.</p></div>`}
        </div>
        <div class="pagination">
          <span>Página ${page} de ${totalPages} · ${rutas.length} registros</span>
          <div class="row gap-4">
            <button class="btn sm" data-action="registro-pagina" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${ER.icon('chevron-left')} Anterior</button>
            <button class="btn sm" data-action="registro-pagina" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente ${ER.icon('chevron-right')}</button>
          </div>
        </div>
      </div>`;
    },
    mount(root) {
      const q = root.querySelector('#reg-q');
      if (q) {
        q.addEventListener('input', ER.debounce(() => {
          ER.ui.registro.q = q.value;
          ER.ui.registro.page = 1;
          ER.render();
          const el = document.getElementById('reg-q');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 280));
      }
      const bind = (id, key) => {
        const el = root.querySelector(id);
        if (!el) return;
        el.addEventListener('change', () => {
          ER.ui.registro[key] = el.value;
          ER.ui.registro.page = 1;
          ER.render();
        });
      };
      bind('#reg-mid', 'motorizado');
      bind('#reg-zona', 'zona');
      bind('#reg-turno', 'turno');
      bind('#reg-estado', 'estado');
      bind('#reg-from', 'from');
      bind('#reg-to', 'to');
    }
  };

  /* ============================================================
     Vista COBROS
     ============================================================ */
  ER.views.cobros = {
    render() {
      const ui = ER.ui.cobros;
      const S = ER.S;
      const deudas = ER.deudas();
      const totalDeuda = ER.totalDeuda();
      const hoy = ER.today();
      const mesIni = ER.startOfMonth(hoy), mesFin = ER.endOfMonth(hoy);
      const pagosMes = S.pagos.filter((p) => p.fecha >= mesIni && p.fecha <= mesFin);
      const cobradoMes = ER.round2(pagosMes.reduce((a, p) => a + (Number(p.monto) || 0), 0));
      const abiertos = ER.ui.cobrosAbierto || (ER.ui.cobrosAbierto = []);

      let lista = S.motorizados.filter((m) => {
        const d = ER.deudaDe(m.id);
        if (ui.soloDeuda && d.saldo <= 0.009) return false;
        if (ui.q && !m.nombre.toLowerCase().includes(ui.q.toLowerCase())) return false;
        return true;
      });
      lista = lista.sort((a, b) => {
        const da = ER.deudaDe(a.id), db = ER.deudaDe(b.id);
        return db.dias - da.dias || db.saldo - da.saldo;
      });

      const cards = lista.map((m) => {
        const d = ER.deudaDe(m.id);
        const abierto = abiertos.includes(m.id);
        const pagadoTotal = ER.abonadoDe(m.id);
        const rutasHtml = d.rutas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => `
          <div class="list-row" style="align-items:flex-start;padding:8px 0">
            <input type="checkbox" class="js-ruta-pagada" data-id="${r.id}" ${r.pagado ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--yellow);margin-top:2px" title="Marcar como pagado">
            <div class="grow" style="min-width:0">
              <div class="between wrap" style="gap:4px">
                <span class="small bold">${ER.fmtDate(r.fecha, 'medium')} <span class="xs muted">${ER.esc(r.pedidos)}</span></span>
                <span class="mono small">${ER.money(r.comision)}</span>
              </div>
              <div class="xs muted">Total ${ER.money(r.total)} · ${r.pct}%${r.abono > 0 ? ' · abonado ' + ER.money(r.abono) : ''}${r.pagado ? ' · pagado' : ''}</div>
            </div>
            ${!r.pagado ? `<button class="btn sm" data-action="cobro-abonar-ruta" data-id="${r.id}">Abonar</button>` : ''}
          </div>`).join('');

        return `<div class="card mb-12">
          <div class="card-b" style="padding:14px 15px">
            <div class="row top gap-10" style="align-items:flex-start">
              ${ER.avatar(m.nombre)}
              <div class="grow" style="min-width:0">
                <div class="row wrap gap-6"><span class="bold" style="font-size:14.5px">${ER.esc(m.nombre)}</span>${ER.badgeTipo(m.tipo)}${m.activo === false ? '<span class="badge">Inactivo</span>' : ''}</div>
                <div class="xs muted">${ER.icon('phone', 'sm')} ${ER.phoneDisplay(m.whatsapp)} · ${d.cantidad} ${ER.plural(d.cantidad, 'ruta pendiente', 'rutas pendientes')}${d.dias > 0 ? ' · ' + d.dias + ' ' + ER.plural(d.dias, 'día', 'días') + ' de atraso' : ''}</div>
              </div>
              <div class="right" style="flex:none">
                <div class="xs muted">Saldo</div>
                <div class="bold mono" style="font-size:19px;color:${d.saldo > 0 ? 'var(--danger)' : 'var(--ok)'}">${ER.money(d.saldo)}</div>
              </div>
            </div>

            <div class="row gap-6 wrap mt-12">
              <button class="btn sm primary" data-action="cobro-abonar" data-id="${m.id}" ${d.saldo <= 0 ? 'disabled' : ''}>${ER.icon('cash')} Abonar</button>
              <button class="btn sm" data-action="cobro-todo-pagado" data-id="${m.id}" ${d.saldo <= 0 ? 'disabled' : ''}>${ER.icon('check')} Marcar todo pagado</button>
              <button class="btn sm" data-action="cobro-cuenta" data-id="${m.id}">${ER.icon('wa')} Estado de cuenta</button>
              <button class="btn sm ghost" data-action="cobro-historial" data-id="${m.id}">${ER.icon('history')} Historial</button>
              <button class="btn sm ghost" data-action="cobro-toggle" data-id="${m.id}" style="margin-left:auto">${abierto ? 'Ocultar rutas' : 'Ver rutas'} ${ER.icon(abierto ? 'chevron-down' : 'chevron-right', 'sm')}</button>
            </div>

            ${abierto ? `<div class="mt-12" style="border-top:1px solid var(--border);padding-top:6px">${rutasHtml || '<div class="xs muted" style="padding:10px 0">Sin rutas pendientes.</div>'}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      return `
      <div class="between wrap mb-16" style="gap:10px">
        <div class="chips">
          <button class="chip ${ui.soloDeuda ? 'active' : ''}" data-action="cobros-solo-deuda" data-val="1">Solo con deuda</button>
          <button class="chip ${!ui.soloDeuda ? 'active' : ''}" data-action="cobros-solo-deuda" data-val="0">Todos</button>
        </div>
        <div class="row gap-6 wrap">
          <div class="search-box"><svg class="icon"><use href="#i-search"/></svg><input class="input" id="cobros-q" placeholder="Buscar motorizado…" value="${ER.esc(ui.q)}" style="min-width:200px"></div>
          <button class="btn primary" data-action="cobros-cierre">${ER.icon('message')} Cierre diario</button>
        </div>
      </div>

      <div class="grid kpi mb-16">
        <div class="card stat"><span class="accent" style="background:#EF4444"></span><div class="label">Total por cobrar</div><div class="value">${ER.money(totalDeuda)}</div><div class="meta">${deudas.length} ${ER.plural(deudas.length, 'motorizado con saldo', 'motorizados con saldo')}</div></div>
        <div class="card stat"><span class="accent" style="background:#10B981"></span><div class="label">Cobrado este mes</div><div class="value">${ER.money(cobradoMes)}</div><div class="meta">${pagosMes.length} ${ER.plural(pagosMes.length, 'pago registrado', 'pagos registrados')}</div></div>
        <div class="card stat"><span class="accent"></span><div class="label">Deuda más antigua</div><div class="value sm">${deudas.length ? deudas[0].dias + ' ' + ER.plural(deudas[0].dias, 'día', 'días') : '0 días'}</div><div class="meta">${deudas.length ? ER.esc(deudas[0].motorizado.nombre) : 'Sin atrasos'}</div></div>
      </div>

      ${lista.length ? cards : `<div class="card"><div class="empty">
        <div class="empty-icon">${ER.icon('cash')}</div>
        <h3>${ui.soloDeuda ? 'Nadie te debe en este momento' : 'No hay motorizados registrados'}</h3>
        <p>${ui.soloDeuda ? 'Los cobros pendientes aparecerán aquí automáticamente.' : 'Agrega motorizados para empezar a cobrar comisiones.'}</p>
        <a class="btn primary" href="#/motorizados">Ir a motorizados</a>
      </div></div>`}

      <div class="card mt-16">
        <div class="card-h"><div><h3>Últimos pagos registrados</h3><div class="sub">Historial general</div></div><a class="btn ghost sm" href="#/papelera">Ver historial de cambios</a></div>
        <div class="table-wrap">
          <table class="table compact">
            <thead><tr><th>Fecha</th><th>Motorizado</th><th>Monto</th><th>Nota</th></tr></thead>
            <tbody>${S.pagos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8).map((p) => `<tr>
              <td>${ER.fmtDate(p.fecha, 'medium')}</td>
              <td>${ER.esc(ER.nombreMotorizado(p.motorizadoId, 'Eliminado'))}</td>
              <td class="mono bold">${ER.money(p.monto)}</td>
              <td class="small muted">${ER.esc(p.nota || '—')}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">Todavía no hay pagos registrados.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    },
    mount(root) {
      const q = root.querySelector('#cobros-q');
      if (q) {
        q.addEventListener('input', ER.debounce(() => {
          ER.ui.cobros.q = q.value;
          ER.render();
          const el = document.getElementById('cobros-q');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 280));
      }
      root.querySelectorAll('.js-ruta-pagada').forEach((chk) => {
        chk.addEventListener('change', () => {
          const r = ER.S.rutas.find((x) => x.id === chk.dataset.id);
          if (!r) return;
          if (chk.checked) {
            ER.marcarRutaPagada(r.id);
          } else {
            r.pagado = false;
            r.abono = 0;
            ER.log('Pago desmarcado', `${ER.routeName(r)} · ${ER.fmtDate(r.fecha)}`);
            ER.save();
            ER.render();
            ER.toast('Ruta marcada como pendiente', 'ok');
          }
        });
      });
    }
  };

  /* ============================================================
     Acciones globales
     ============================================================ */
  ER.actions['nueva-ruta'] = () => ER.openRutaForm({});
  ER.actions['ruta-editar'] = (el) => ER.openRutaForm({ id: el.dataset.id });
  ER.actions['ruta-eliminar'] = (el) => ER.eliminarRuta(el.dataset.id);
  ER.actions['ruta-historial'] = (el) => ER.openHistorial(el.dataset.id);
  ER.actions['ruta-wa'] = (el) => {
    const r = ER.S.rutas.find((x) => x.id === el.dataset.id);
    if (!r) return;
    const m = ER.getMotorizado(r.motorizadoId);
    ER.openWA(m && m.whatsapp, ER.msgCobro(m, [r], { pct: r.pct }));
  };
  ER.actions['ruta-copiar'] = (el) => {
    const r = ER.S.rutas.find((x) => x.id === el.dataset.id);
    if (!r) return;
    const m = ER.getMotorizado(r.motorizadoId);
    ER.copy(ER.msgCobro(m, [r], { pct: r.pct }));
  };
  ER.actions['rutas-filtro'] = (el) => {
    ER.ui.rutas.preset = el.dataset.preset;
    ER.render();
  };
  ER.actions['aplicar-rango'] = () => {
    const f = document.getElementById('dash-from');
    const t = document.getElementById('dash-to');
    ER.ui.filter.from = f ? f.value : null;
    ER.ui.filter.to = t ? t.value : null;
    if (!ER.ui.filter.from || !ER.ui.filter.to) { ER.toast('Elige las dos fechas', 'err'); return; }
    ER.render();
  };
  ER.actions['dash-filtro'] = (el) => {
    ER.ui.filter.preset = el.dataset.preset;
    if (el.dataset.preset === 'rango' && !ER.ui.filter.from) {
      ER.ui.filter.from = ER.startOfWeek(ER.today());
      ER.ui.filter.to = ER.today();
    }
    ER.render();
  };
  ER.actions['chart-mode'] = (el) => {
    ER.ui.chartMode = el.dataset.mode;
    ER.render();
  };
  ER.actions['ir-cobros'] = () => ER.go('cobros');
  ER.actions['ir-calendario'] = () => ER.go('calendario');
  ER.actions['ir-inactivo'] = (el) => ER.go('motorizado', [el.dataset.id]);

  ER.actions['ver-pendientes'] = () => ER.openPendientes();
  ER.actions['pend-registrar'] = (el) => {
    ER.closeModals();
    ER.openRutaForm({ motorizadoId: el.dataset.mid, fecha: el.dataset.fecha });
  };
  ER.actions['pend-sin'] = (el) => {
    const ok = ER.marcarSinPedidos(el.dataset.mid, el.dataset.fecha);
    if (!ok) return;
    ER.closeModals();
    ER.render();
    ER.toast('Marcado como “sin pedidos”', 'ok');
    setTimeout(() => ER.openPendientes(), 90);
  };
  ER.actions['pend-sin-semana'] = (el) => {
    const n = ER.marcarSinPedidosSemana(el.dataset.mid);
    if (!n) { ER.toast('No había días pendientes esta semana', 'err'); return; }
    ER.closeModals();
    ER.render();
    ER.toast('Semana marcada sin pedidos', 'ok');
    setTimeout(() => ER.openPendientes(), 90);
  };

  ER.actions['registro-orden'] = (el) => {
    const key = el.dataset.sort;
    if (ER.ui.registro.sort === key) ER.ui.registro.dir = ER.ui.registro.dir === 'asc' ? 'desc' : 'asc';
    else { ER.ui.registro.sort = key; ER.ui.registro.dir = key === 'fecha' ? 'desc' : 'asc'; }
    ER.render();
  };
  ER.actions['registro-pagina'] = (el) => {
    const p = Number(el.dataset.page);
    if (p > 0) { ER.ui.registro.page = p; ER.render(); }
  };
  ER.actions['registro-limpiar'] = () => {
    ER.ui.registro = { q: '', motorizado: '', zona: '', turno: '', estado: '', from: '', to: '', sort: 'fecha', dir: 'desc', page: 1 };
    ER.render();
  };
  ER.actions['registro-exportar'] = () => {
    const ui = ER.ui.registro;
    let rutas = ER.rutasEntre(ui.from || null, ui.to || null);
    if (ui.motorizado) rutas = rutas.filter((r) => r.motorizadoId === ui.motorizado);
    if (ui.zona) rutas = rutas.filter((r) => (r.zona || '') === ui.zona);
    if (ui.turno) rutas = rutas.filter((r) => r.turno === ui.turno);
    if (ui.estado === 'pagado') rutas = rutas.filter((r) => r.pagado);
    if (ui.estado === 'pendiente') rutas = rutas.filter((r) => !r.pagado);
    ER.exportarRutasCSV(rutas, 'en-ruta-registro-' + ER.today() + '.csv');
  };
  ER.actions['registro-copiar'] = () => {
    const ui = ER.ui.registro;
    let rutas = ER.rutasEntre(ui.from || null, ui.to || null);
    if (ui.motorizado) rutas = rutas.filter((r) => r.motorizadoId === ui.motorizado);
    if (ui.zona) rutas = rutas.filter((r) => (r.zona || '') === ui.zona);
    if (ui.turno) rutas = rutas.filter((r) => r.turno === ui.turno);
    if (ui.estado === 'pagado') rutas = rutas.filter((r) => r.pagado);
    if (ui.estado === 'pendiente') rutas = rutas.filter((r) => !r.pagado);
    const lines = ['Fecha\tMotorizado\tTurno\tZona\tPedidos\tTotal\tComisión\tPagado'];
    rutas.sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((r) => {
      lines.push([r.fecha, ER.routeName(r), r.turno === 'dia' ? 'Día' : 'Noche', r.zona || '', r.pedidos, ER.money(r.total), ER.money(r.comision), r.pagado ? 'Sí' : 'No'].join('\t'));
    });
    ER.copy(lines.join('\n'));
  };

  ER.actions['carga-guardar'] = () => {
    const root = document.getElementById('view');
    const fecha = ER.ui.cargaFecha;
    const rows = Array.from(root.querySelectorAll('[data-carga-row]'));
    if (!rows.length) { ER.toast('No hay motorizados en la lista', 'err'); return; }
    let creadas = 0, sin = 0, errores = [];
    const mensajes = [];
    rows.forEach((row) => {
      const mid = row.dataset.mid;
      const m = ER.getMotorizado(mid);
      if (!m) return;
      if (ER.rutaEn(mid, fecha) || ER.sinPedidosEn(mid, fecha)) return;
      const inp = row.querySelector('.js-carga-pedidos');
      const esSin = row.dataset.sin === '1';
      if (esSin) {
        if (ER.marcarSinPedidos(mid, fecha)) sin++;
        return;
      }
      const txt = inp ? inp.value.trim() : '';
      if (!txt) return;
      const calc = ER.calcularRuta(txt, m.comision);
      if (!calc.ok) { errores.push(m.nombre + ': “' + txt + '”'); return; }
      const r = {
        id: ER.uid(), motorizadoId: mid, motorizadoNombre: m.nombre, fecha,
        turno: m.turno || 'noche', zona: '', pedidos: txt, total: calc.total,
        comision: calc.comision, pct: Number(m.comision) || ER.S.config.comisionDefault,
        nota: '', pagado: false, abono: 0, historial: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      ER.S.rutas.push(r);
      ER.log('Ruta registrada (carga rápida)', `${m.nombre} · ${ER.fmtDate(fecha)} · ${ER.money(calc.total)}`);
      mensajes.push({ m, ruta: r });
      creadas++;
    });
    if (!creadas && !sin && !errores.length) { ER.toast('No escribiste pedidos ni marcaste “sin pedidos”', 'err'); return; }
    ER.save();
    ER.render();
    if (errores.length) ER.toast('Revisa: ' + errores.slice(0, 2).join(' · '), 'err', 5000);
    if (creadas || sin) ER.toast(`${creadas} rutas guardadas${sin ? ' · ' + sin + ' sin pedidos' : ''}`, 'ok');

    if (mensajes.length) {
      const cards = mensajes.map(({ m, ruta }) => {
        const txt = ER.msgCobro(m, [ruta], { pct: ruta.pct });
        return `<div class="card" data-msg-card style="box-shadow:none;margin-bottom:10px">
          <div class="card-b" style="padding:12px 13px">
            <div class="between wrap gap-6 mb-8"><div class="row gap-6">${ER.avatar(m.nombre, 'sm')}<b style="font-size:13px">${ER.esc(m.nombre)}</b><span class="badge yellow">${ER.money(ruta.comision)}</span></div>
              <div class="row gap-4">
                <button class="btn sm" data-action="carga-msg-copiar" type="button">${ER.icon('copy')} Copiar</button>
                <button class="btn sm wa" data-action="carga-msg-wa" data-phone="${ER.esc(m.whatsapp)}" type="button">${ER.icon('wa')} WhatsApp</button>
              </div>
            </div>
            <textarea class="textarea js-msg-text" rows="4" style="font-size:12px;font-family:ui-monospace,Consolas,monospace">${ER.esc(txt)}</textarea>
          </div>
        </div>`;
      }).join('');
      ER.modal({
        title: 'Mensajes de cobro listos',
        subtitle: 'Se guardaron las rutas. Copia o abre WhatsApp de cada motorizado. Nada se envía automáticamente.',
        size: 'lg',
        body: `<div class="alert green mb-12"><div class="a-icon">${ER.icon('check')}</div><div class="grow"><div class="a-title">${creadas} ${ER.plural(creadas, 'ruta guardada', 'rutas guardadas')}${sin ? ' · ' + sin + ' sin pedidos' : ''}</div><div class="a-text">Revisa cada mensaje y reenvíalo por WhatsApp.</div></div></div>${cards}`,
        footer: `<button class="btn" data-close type="button">Cerrar</button><a class="btn dark" href="#/cobros" data-close>Ir a cobros</a>`
      });
    }
  };

  ER.actions['carga-msg-copiar'] = (el) => {
    const ta = el.closest('[data-msg-card]').querySelector('.js-msg-text');
    ER.copy(ta.value);
  };
  ER.actions['carga-msg-wa'] = (el) => {
    const ta = el.closest('[data-msg-card]').querySelector('.js-msg-text');
    ER.openWA(el.dataset.phone, ta.value);
  };

  /* ============================================================
     Cobros: pagos
     ============================================================ */
  ER.registrarPago = function (mid, monto, fecha, nota) {
    const m = ER.getMotorizado(mid);
    if (!m) return 0;
    const d = ER.deudaDe(mid);
    let restante = Math.min(ER.round2(monto), d.saldo);
    if (restante <= 0) return 0;
    const aplicado = restante;
    const rutas = d.rutas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    rutas.forEach((r) => {
      if (restante <= 0) return;
      const falta = ER.round2((Number(r.comision) || 0) - (Number(r.abono) || 0));
      if (falta <= 0) { r.pagado = true; return; }
      const aplicar = Math.min(falta, restante);
      r.abono = ER.round2((Number(r.abono) || 0) + aplicar);
      if (r.abono >= ER.round2(Number(r.comision) || 0) - 0.005) {
        r.pagado = true;
        r.abono = ER.round2(Number(r.comision) || 0);
      }
      restante = ER.round2(restante - aplicar);
    });
    ER.S.pagos.push({
      id: ER.uid(), motorizadoId: mid, fecha: fecha || ER.today(),
      monto: aplicado, nota: nota || '', createdAt: new Date().toISOString()
    });
    ER.log('Pago registrado', `${m.nombre} · ${ER.money(aplicado)} · ${ER.fmtDate(fecha || ER.today())}`);
    ER.save();
    return aplicado;
  };

  ER.marcarRutaPagada = function (id) {
    const r = ER.S.rutas.find((x) => x.id === id);
    if (!r || r.pagado) return;
    const falta = ER.balanceRuta(r);
    ER.registrarPago(r.motorizadoId, falta, ER.today(), 'Pago de ruta ' + ER.fmtDate(r.fecha, 'medium'));
    ER.render();
    ER.toast('Ruta marcada como pagada', 'ok');
  };

  ER.actions['cobro-abonar'] = (el) => {
    const m = ER.getMotorizado(el.dataset.id);
    if (!m) return;
    const d = ER.deudaDe(m.id);
    ER.modal({
      title: 'Registrar abono',
      subtitle: `${ER.esc(m.nombre)} · saldo ${ER.money(d.saldo)}`,
      size: 'sm',
      body: `<div class="form-grid" style="grid-template-columns:1fr">
        <div class="field"><label>Monto del abono <span class="req">*</span></label><input class="input" type="number" id="ab-monto" min="0.01" max="${d.saldo}" step="0.5" value="${d.saldo}" inputmode="decimal"><div class="hint">Se aplica primero a las rutas más antiguas. Saldo: ${ER.money(d.saldo)}.</div></div>
        <div class="field"><label>Fecha</label><input class="input" type="date" id="ab-fecha" value="${ER.today()}"></div>
        <div class="field"><label>Nota</label><input class="input" type="text" id="ab-nota" placeholder="Ej. efectivo, PLIN, adelanto…"></div>
      </div>`,
      footer: `<button class="btn" data-close type="button">Cancelar</button><button class="btn primary" data-ok type="button">${ER.icon('check')} Registrar abono</button>`,
      onMount: (el2, close) => {
        el2.querySelector('[data-ok]').addEventListener('click', () => {
          const monto = Number(el2.querySelector('#ab-monto').value);
          const fecha = el2.querySelector('#ab-fecha').value || ER.today();
          const nota = el2.querySelector('#ab-nota').value.trim();
          if (!(monto > 0)) { ER.toast('Escribe un monto válido', 'err'); return; }
          if (monto > d.saldo + 0.01) { ER.toast('El abono supera el saldo', 'err'); return; }
          const aplicado = ER.registrarPago(m.id, monto, fecha, nota);
          close();
          ER.render();
          ER.toast('Abono de ' + ER.money(aplicado) + ' registrado', 'ok');
        });
      }
    });
  };

  ER.actions['cobro-abonar-ruta'] = (el) => {
    const r = ER.S.rutas.find((x) => x.id === el.dataset.id);
    if (!r) return;
    const saldo = ER.balanceRuta(r);
    ER.modal({
      title: 'Abonar a esta ruta',
      subtitle: `${ER.esc(ER.routeName(r))} · ${ER.fmtDate(r.fecha)} · saldo ${ER.money(saldo)}`,
      size: 'sm',
      body: `<div class="field"><label>Monto</label><input class="input" type="number" id="abr-monto" min="0.01" max="${saldo}" step="0.5" value="${saldo}" inputmode="decimal"><div class="hint">Comisión ${ER.money(r.comision)} · ya abonado ${ER.money(r.abono || 0)}.</div></div>`,
      footer: `<button class="btn" data-close type="button">Cancelar</button><button class="btn primary" data-ok type="button">Registrar</button>`,
      onMount: (el2, close) => {
        el2.querySelector('[data-ok]').addEventListener('click', () => {
          const monto = Number(el2.querySelector('#abr-monto').value);
          if (!(monto > 0)) { ER.toast('Monto inválido', 'err'); return; }
          ER.registrarPago(r.motorizadoId, Math.min(monto, saldo), ER.today(), 'Abono de ruta ' + ER.fmtDate(r.fecha, 'medium'));
          close(); ER.render(); ER.toast('Abono registrado', 'ok');
        });
      }
    });
  };

  ER.actions['cobro-todo-pagado'] = async (el) => {
    const m = ER.getMotorizado(el.dataset.id);
    if (!m) return;
    const d = ER.deudaDe(m.id);
    if (d.saldo <= 0) return;
    const ok = await ER.confirm(`¿Marcar todo como pagado para <b>${ER.esc(m.nombre)}</b>?<br><br>Se registrará un pago de <b>${ER.money(d.saldo)}</b> y quedarán ${d.cantidad} rutas pagadas.`, { title: 'Marcar todo pagado', ok: 'Sí, registrar pago' });
    if (!ok) return;
    ER.registrarPago(m.id, d.saldo, ER.today(), 'Pago total');
    ER.render();
    ER.toast('Pago total registrado', 'ok');
  };

  ER.actions['cobro-cuenta'] = (el) => {
    const m = ER.getMotorizado(el.dataset.id);
    if (!m) return;
    ER.msgModal('Estado de cuenta', ER.msgCuenta(m), m.whatsapp, `${ER.esc(m.nombre)} · ${ER.money(ER.deudaDe(m.id).saldo)} de saldo`);
  };

  ER.actions['cobro-historial'] = (el) => {
    const m = ER.getMotorizado(el.dataset.id);
    if (!m) return;
    const pagos = ER.S.pagos.filter((p) => p.motorizadoId === m.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    ER.modal({
      title: 'Historial de pagos',
      subtitle: `${ER.esc(m.nombre)} · total abonado ${ER.money(ER.abonadoDe(m.id))}`,
      body: pagos.length ? `<div class="list-plain">${pagos.map((p) => `<div class="list-row">
        <div class="grow"><div class="bold small">${ER.fmtDate(p.fecha, 'medium')}</div><div class="xs muted">${ER.esc(p.nota || 'Sin nota')}</div></div>
        <div class="mono bold">${ER.money(p.monto)}</div>
      </div>`).join('')}</div>` : '<div class="empty" style="padding:24px"><p>Todavía no hay pagos registrados.</p></div>',
      footer: `<button class="btn" data-close type="button">Cerrar</button>`
    });
  };

  ER.actions['cobro-toggle'] = (el) => {
    const id = el.dataset.id;
    const arr = ER.ui.cobrosAbierto || (ER.ui.cobrosAbierto = []);
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    ER.render();
  };
  ER.actions['cobros-solo-deuda'] = (el) => {
    ER.ui.cobros.soloDeuda = el.dataset.val === '1';
    ER.render();
  };
  ER.actions['cobros-cierre'] = () => {
    const fecha = ER.addDays(ER.today(), -1);
    ER.modal({
      title: 'Cierre diario',
      subtitle: 'Un solo mensaje con todos los motorizados del día',
      size: 'sm',
      body: `<div class="field"><label>Fecha</label><input class="input" type="date" id="cierre-fecha" value="${fecha}"></div><div id="cierre-resumen" class="mt-12"></div>`,
      footer: `<button class="btn" data-close type="button">Cancelar</button><button class="btn primary" data-ok type="button">Generar mensaje</button>`,
      onMount: (el, close) => {
        const inp = el.querySelector('#cierre-fecha');
        const resumen = el.querySelector('#cierre-resumen');
        function upd() {
          const c = ER.msgCierre(inp.value || fecha);
          resumen.innerHTML = `<div class="alert ${c.rutas ? 'blue' : 'yellow'}" style="padding:10px 12px"><div class="a-icon" style="width:28px;height:28px">${ER.icon('cash', 'sm')}</div><div class="grow"><div class="a-title" style="font-size:12.5px">${c.rutas} rutas · ${c.cantidad} motorizados</div><div class="a-text">Total ${ER.money(c.total)} · comisión ${ER.money(c.comision)}</div></div></div>`;
        }
        inp.addEventListener('change', upd); upd();
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const c = ER.msgCierre(inp.value || fecha);
          close();
          ER.msgModal('Cierre diario', c.texto, '', ER.fmtDate(inp.value || fecha, 'weekdayLong'));
        });
      }
    });
  };

})();
