/* ============================================================
   EN RUTA — Arranque, rutas y eventos globales
   ============================================================ */
(function () {
  'use strict';
  const ER = window.ER;
  if (!ER) return;

  /* ============================================================
     Acciones globales
     ============================================================ */
  ER.actions['toggle-theme'] = () => {
    ER.toggleTheme();
  };

  ER.actions['reload'] = () => {
    ER.closeModals();
    ER.render();
  };

  ER.actions['open-more'] = () => {
    const actual = ER.parseHash().view;
    const grupos = ER.MENU.map((g) => `
      <div class="form-section">${ER.esc(g.group)}</div>
      <div class="sheet-grid">
        ${g.items.map((it) => `
          <a class="sheet-item" href="#/${it.id}" data-close>
            ${ER.icon(it.icon)}
            <span>${ER.esc(it.label)}</span>
          </a>`).join('')}
      </div>`).join('');

    ER.modal({
      title: 'Más opciones',
      subtitle: actual ? 'Todas las secciones de En Ruta' : 'Elige una sección',
      size: 'sm',
      body: grupos,
      footer: `<button class="btn" data-close type="button">Cerrar</button>`
    });
  };

  /* ============================================================
     Delegación de clics [data-action]
     ============================================================ */
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const name = el.getAttribute('data-action');
    const fn = ER.actions[name];
    if (typeof fn !== 'function') {
      console.warn('Acción no encontrada:', name);
      return;
    }

    const esEnlace = el.tagName === 'A' && el.getAttribute('href');
    if (!esEnlace) event.preventDefault();

    try {
      const result = fn(el, event);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          console.error('Error en la acción ' + name, err);
          ER.toast('Ocurrió un error. Intenta otra vez.', 'err');
        });
      }
    } catch (err) {
      console.error('Error en la acción ' + name, err);
      ER.toast('Ocurrió un error. Intenta otra vez.', 'err');
    }
  });

  /* Atajo: Escape cierra el modal superior */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const root = document.getElementById('modal-root');
    if (!root || !root.lastElementChild) return;
    const close = root.lastElementChild.querySelector('[data-close]');
    if (close) close.click();
  });

  /* ============================================================
     Navegación por hash
     ============================================================ */
  function onRouteChange() {
    ER.render();
    /* Refuerza el estado activo cuando se entra directo por enlace */
    const { view } = ER.parseHash();
    ER.$$('.nav-item, .bn-item').forEach((el) => {
      const id = el.getAttribute('data-view');
      el.classList.toggle('active', id === view || (view === 'motorizado' && id === 'motorizados'));
    });
  }

  window.addEventListener('hashchange', onRouteChange);

  /* ============================================================
     Estado de conexión e instalación
     ============================================================ */
  function actualizarConexion() {
    const pill = document.getElementById('offline-pill');
    if (pill) pill.hidden = navigator.onLine !== false;
  }

  window.addEventListener('online', () => {
    actualizarConexion();
    ER.toast('Conexión restablecida', 'ok');
  });
  window.addEventListener('offline', () => {
    actualizarConexion();
    ER.toast('Sin internet. La app sigue funcionando.', 'err', 4000);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    ER.installPrompt = event;
  });

  window.addEventListener('appinstalled', () => {
    ER.installPrompt = null;
    ER.toast('En Ruta instalada en este dispositivo', 'ok');
  });

  /* ============================================================
     Service worker
     ============================================================ */
  function registrarSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        /* Avisa cuando hay una versión nueva esperando para activarse. */
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          if (!nuevo) return;
          nuevo.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              ER.toast('Hay una actualización disponible. Cierra y abre la app.', 'ok', 6000);
            }
          });
        });
      }).catch((err) => {
        console.warn('No se pudo registrar el service worker', err);
      });
    });
  }

  /* ============================================================
     Arranque
     ============================================================ */
  function boot() {
    ER.buildSidebar();
    ER.buildBottomNav();
    ER.applyLogo();
    ER.setTheme(ER.ui.theme === 'dark' ? 'dark' : 'light');

    const version = document.getElementById('app-version');
    if (version) version.textContent = 'Versión ' + ER.VERSION;

    actualizarConexion();

    /* Si no hay hash, abre el inicio sin ensuciar el historial. */
    if (!location.hash) {
      try {
        history.replaceState(null, '', '#/inicio');
      } catch (e) {
        location.hash = '#/inicio';
      }
    }

    ER.render();
    registrarSW();

    /* Ayuda al primer uso */
    if (!ER.S.motorizados.length) {
      setTimeout(() => {
        if (ER.parseHash().view === 'inicio' && !ER.S.motorizados.length) {
          ER.toast('Entra a Motorizados para agregar a tu equipo, o carga datos de ejemplo en Ajustes.', 'ok', 6000);
        }
      }, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
