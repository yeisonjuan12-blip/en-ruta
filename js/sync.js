/* ============================================================
   EN RUTA — Sincronización opcional entre dispositivos
   Guarda una copia privada del estado en un Gist de GitHub.
   Es opcional: la app sigue funcionando 100% offline sin esto.
   ============================================================ */
(function () {
  'use strict';
  const ER = window.ER;
  if (!ER) return;

  const API = 'https://api.github.com';
  const DESC = 'enruta-sync-v1';
  const FILE = 'enruta-data.json';
  const LS = {
    token: 'enruta:sync:token',
    gist: 'enruta:sync:gist',
    auto: 'enruta:sync:auto',
    stamp: 'enruta:sync:stamp',
    last: 'enruta:sync:last',
    device: 'enruta:sync:device'
  };

  const sync = ER.sync = {
    suspend: false,
    busy: false,
    timer: null
  };

  function lsGet(k) {
    try { return localStorage.getItem(k) || ''; } catch (e) { return ''; }
  }
  function lsSet(k, v) {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch (e) { /* sin espacio */ }
  }
  function nowISO() { return new Date().toISOString(); }
  function deviceId() {
    let d = lsGet(LS.device);
    if (!d) { d = ER.uid(); lsSet(LS.device, d); }
    return d;
  }

  sync.token = () => lsGet(LS.token);
  sync.gistId = () => lsGet(LS.gist);
  sync.auto = () => lsGet(LS.auto) !== '0';
  sync.connected = () => !!(sync.token() && sync.gistId());
  sync.last = () => lsGet(LS.last);
  sync.stamp = () => lsGet(LS.stamp);

  sync.setAuto = function (on) {
    lsSet(LS.auto, on ? '1' : '0');
    if (on) sync.syncNow(true);
  };

  sync.disconnect = function () {
    lsSet(LS.token, '');
    lsSet(LS.gist, '');
    lsSet(LS.auto, '');
    if (sync.timer) { clearTimeout(sync.timer); sync.timer = null; }
    ER.toast('Sincronización desactivada en este dispositivo', 'ok');
    ER.render();
  };

  function contentScore(state) {
    if (!state) return 0;
    return ['motorizados', 'rutas', 'asistencias', 'pagos', 'notas', 'noPedidos', 'horarios']
      .reduce((n, k) => n + (Array.isArray(state[k]) ? state[k].length : 0), 0);
  }

  function payload() {
    return {
      app: 'En Ruta',
      schema: 2,
      device: deviceId(),
      savedAt: nowISO(),
      state: ER.S
    };
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, opts.headers || {});
    const token = sync.token();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body) headers['Content-Type'] = 'application/json';

    const res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      keepalive: !!opts.keepalive
    });

    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try {
        const j = await res.json();
        if (j && j.message) msg = j.message;
      } catch (e) { /* sin cuerpo */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function friendlyError(err) {
    if (!err) return 'Error desconocido';
    if (err.status === 401) return 'El token no es válido o venció.';
    if (err.status === 403 || err.status === 404) {
      return 'El token no tiene permiso para Gists. Crea uno con el permiso "gist".';
    }
    if (err.status === 422) return 'GitHub rechazó la copia (puede ser demasiado grande).';
    if (!navigator.onLine) return 'Sin internet. Se sincronizará cuando vuelvas a conectarte.';
    return err.message || 'No se pudo sincronizar.';
  }

  async function findGist() {
    for (let page = 1; page <= 3; page++) {
      const list = await api('/gists?per_page=100&page=' + page);
      if (!Array.isArray(list) || !list.length) return null;
      const found = list.find((g) => g.description === DESC);
      if (found) return found;
      if (list.length < 100) return null;
    }
    return null;
  }

  async function createGist() {
    return api('/gists', {
      method: 'POST',
      body: {
        description: DESC,
        public: false,
        files: { [FILE]: { content: JSON.stringify(payload()) } }
      }
    });
  }

  async function updateGist() {
    const id = sync.gistId();
    if (!id) throw new Error('No hay copia configurada');
    return api('/gists/' + id, {
      method: 'PATCH',
      body: {
        description: DESC,
        files: { [FILE]: { content: JSON.stringify(payload()) } }
      }
    });
  }

  async function readGist() {
    const id = sync.gistId();
    if (!id) return null;
    const g = await api('/gists/' + id);
    const f = g && g.files && g.files[FILE];
    if (!f) return null;
    let content = f.content;
    if (f.truncated && f.raw_url) {
      const raw = await fetch(f.raw_url);
      content = await raw.text();
    }
    try { return JSON.parse(content); } catch (e) { return null; }
  }

  function applyRemote(remote, silent) {
    if (!remote || !remote.state) return false;
    sync.suspend = true;
    ER.closeModals();
    ER.S = remote.state;
    ER.S.ui = ER.S.ui || { lastAutoBackup: null };
    ER.save();
    lsSet(LS.stamp, remote.savedAt || nowISO());
    lsSet(LS.last, nowISO());
    sync.suspend = false;
    ER.render();
    if (!silent) ER.toast('Datos actualizados desde la nube', 'ok');
    return true;
  }

  async function uploadNow(manual) {
    if (!sync.connected()) {
      if (manual) ER.toast('Primero conecta la sincronización', 'err');
      return false;
    }
    if (!navigator.onLine) {
      if (manual) ER.toast('Sin internet. Intenta cuando vuelvas a conectarte.', 'err');
      return false;
    }
    sync.busy = true;
    try {
      await updateGist();
      const t = nowISO();
      lsSet(LS.stamp, t);
      lsSet(LS.last, t);
      if (manual) ER.toast('Datos subidos a la nube', 'ok');
      return true;
    } catch (err) {
      if (err.status === 404) {
        // La copia ya no existe: se crea otra.
        try {
          const g = await createGist();
          lsSet(LS.gist, g.id);
          const t = nowISO();
          lsSet(LS.stamp, t);
          lsSet(LS.last, t);
          if (manual) ER.toast('Copia creada en la nube', 'ok');
          return true;
        } catch (e2) {
          if (manual) ER.toast(friendlyError(e2), 'err', 6000);
          return false;
        }
      }
      if (manual) ER.toast(friendlyError(err), 'err', 6000);
      return false;
    } finally {
      sync.busy = false;
    }
  }

  sync.push = async function (manual) {
    if (sync.busy) return false;
    return uploadNow(manual);
  };

  async function pullNow(manual) {
    if (!sync.connected()) {
      if (manual) ER.toast('Primero conecta la sincronización', 'err');
      return false;
    }
    if (sync.busy) return false;
    if (!navigator.onLine) {
      if (manual) ER.toast('Sin internet. Intenta cuando vuelvas a conectarte.', 'err');
      return false;
    }
    sync.busy = true;
    try {
      const remote = await readGist();
      if (!remote || !remote.state) {
        if (manual) ER.toast('Todavía no hay datos en la nube', 'err');
        return false;
      }
      if (manual && contentScore(ER.S) > 0) {
        const ok = await ER.confirm(
          'Se reemplazarán los datos de este dispositivo por los de la nube. ¿Continuar?',
          { title: 'Bajar datos', ok: 'Reemplazar' }
        );
        if (!ok) return false;
      }
      return applyRemote(remote, !manual);
    } catch (err) {
      if (manual) ER.toast(friendlyError(err), 'err', 6000);
      return false;
    } finally {
      sync.busy = false;
    }
  }
  sync.pull = () => pullNow(true);

  sync.syncNow = async function (silent) {
    if (sync.suspend || sync.busy || !sync.connected() || !navigator.onLine) return false;
    sync.busy = true;
    try {
      const remote = await readGist();
      if (!remote || !remote.state) {
        sync.busy = false;
        return await sync.push(true);
      }
      const localScore = contentScore(ER.S);
      const remoteScore = contentScore(remote.state);
      const localStamp = sync.stamp();
      const remoteStamp = remote.savedAt || '';

      if (localScore === 0 && remoteScore > 0) {
        return applyRemote(remote, true);
      }
      if (remoteStamp && (!localStamp || remoteStamp > localStamp)) {
        return applyRemote(remote, true);
      }
      if (localStamp && localStamp > remoteStamp) {
        sync.busy = false;
        return await sync.push(true);
      }
      return false;
    } catch (err) {
      if (!silent) ER.toast(friendlyError(err), 'err', 6000);
      return false;
    } finally {
      sync.busy = false;
    }
  };

  sync.connect = async function (token) {
    token = String(token || '').trim();
    if (!/^(ghp_|github_pat_)/.test(token)) {
      ER.toast('Pega un token válido de GitHub', 'err');
      return false;
    }
    sync.busy = true;
    lsSet(LS.token, token);
    lsSet(LS.gist, '');
    try {
      await api('/user');
      let gist = await findGist();
      let remote = null;

      if (gist) {
        lsSet(LS.gist, gist.id);
        remote = await readGist();
      }

      const localScore = contentScore(ER.S);
      const remoteScore = remote && remote.state ? contentScore(remote.state) : 0;

      if (gist && remoteScore > 0 && localScore === 0) {
        // Dispositivo nuevo: baja automáticamente lo que ya existe.
        lsSet(LS.auto, '1');
        applyRemote(remote, false);
        ER.toast('Conectado. Datos descargados de la nube', 'ok', 5000);
      } else if (gist && remoteScore > 0 && localScore > 0) {
        const remoteStamp = remote.savedAt || '';
        const localStamp = sync.stamp() || '';
        const remoteIsNewer = remoteStamp && (!localStamp || remoteStamp > localStamp);
        const ok = await ER.confirm(
          'Ya hay una copia en la nube con ' + remoteScore + ' registros. ' +
          (remoteIsNewer
            ? 'Es más reciente que la de este dispositivo. ¿Quieres descargarla y reemplazar lo local?'
            : '¿Quieres reemplazar la copia de la nube con los datos de este dispositivo?'),
          {
            title: 'Conectar sincronización',
            ok: remoteIsNewer ? 'Descargar la nube' : 'Subir mis datos'
          }
        );
        if (!ok) {
          lsSet(LS.token, '');
          lsSet(LS.gist, '');
          lsSet(LS.auto, '');
          ER.toast('No se cambió nada. Puedes volver a conectar cuando quieras.', 'ok', 5000);
          return false;
        }
        lsSet(LS.auto, '1');
        if (remoteIsNewer) {
          applyRemote(remote, false);
          ER.toast('Conectado. Datos descargados de la nube', 'ok', 5000);
        } else {
          const subido = await uploadNow(false);
          ER.toast(subido ? 'Conectado. Datos subidos a la nube' : 'Conectado, pero no se pudo subir todavía', subido ? 'ok' : 'err', 5000);
        }
      } else if (gist) {
        // La copia existe pero está vacía: sube lo local.
        lsSet(LS.auto, '1');
        await uploadNow(false);
        ER.toast('Conectado. Datos subidos a la nube', 'ok', 5000);
      } else {
        // No existe copia: se crea con los datos actuales.
        gist = await createGist();
        lsSet(LS.gist, gist.id);
        lsSet(LS.auto, '1');
        const t = nowISO();
        lsSet(LS.stamp, t);
        lsSet(LS.last, t);
        ER.toast('Conectado. Copia privada creada en GitHub', 'ok', 5000);
      }
      return true;
    } catch (err) {
      lsSet(LS.token, '');
      lsSet(LS.gist, '');
      lsSet(LS.auto, '');
      ER.toast(friendlyError(err), 'err', 7000);
      return false;
    } finally {
      sync.busy = false;
    }
  };

  /* Se llama después de cada guardado local. */
  sync.onSave = function () {
    if (sync.suspend) return;
    const t = nowISO();
    lsSet(LS.stamp, t);
    if (!sync.connected() || !sync.auto()) return;
    if (sync.timer) clearTimeout(sync.timer);
    sync.timer = setTimeout(() => {
      sync.timer = null;
      sync.syncNow(true);
    }, 1800);
  };

  /* Se llama al arrancar la app. */
  sync.onBoot = function () {
    if (!sync.connected() || !sync.auto()) return;
    setTimeout(() => sync.syncNow(true), 900);
  };

  window.addEventListener('online', () => {
    if (sync.connected() && sync.auto()) sync.syncNow(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && sync.connected() && sync.auto() && sync.timer) {
      clearTimeout(sync.timer);
      sync.timer = null;
      sync.push(false);
    }
  });

})();
