/**
 * NavigationHUD.js
 *
 * Extends the existing DroneHUD with GRU/ESKF/Route telemetry panels.
 * Does NOT replace the existing HUD — it appends additional panels to body.
 *
 * Displays:
 *  - MODE: ROUTE / RUNNING / IDLE
 *  - GRU: READY / WAITING / UPDATE
 *  - Last correction dvx, dvy, dvz m/s
 *  - Next GRU update: X.X s
 *  - Distance from planned route: X m
 *  - NIS: X.XX
 *  - Gate: APPLIED / REJECTED
 *  - Completion: XX%
 */
export class NavigationHUD {
  constructor(onRouteClick) {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '60px',
      right: '20px',
      background: 'rgba(8, 12, 20, 0.85)',
      border: '1px solid rgba(0, 229, 255, 0.4)',
      borderRadius: '6px',
      padding: '10px 14px',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      color: '#00e5ff',
      lineHeight: '1.6',
      zIndex: '9998',
      minWidth: '220px',
      textShadow: '0 0 5px rgba(0, 229, 255, 0.5)',
      boxShadow: '0 0 15px rgba(0, 229, 255, 0.15)',
    });

    this.container.innerHTML = `
      <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:#ffea00;letter-spacing:2px;">
        ▶ NAV / GRU PANEL
      </div>
      <div>MODE: <span id="nav-mode" style="color:#00e676;">IDLE</span></div>
      <div>GRU: <span id="nav-gru-status" style="color:#90a4ae;">OFFLINE</span></div>
      <div style="height:1px;background:rgba(0,229,255,0.2);margin:4px 0;"></div>
      <div>Last δv: <span id="nav-dv" style="color:#ff9100;">—</span></div>
      <div>Next update: <span id="nav-next" style="color:#b0bec5;">—</span></div>
      <div>NIS: <span id="nav-nis" style="color:#b0bec5;">—</span></div>
      <div>Gate: <span id="nav-gate" style="color:#b0bec5;">—</span></div>
      <div style="height:1px;background:rgba(0,229,255,0.2);margin:4px 0;"></div>
      <div>Route dist: <span id="nav-dist" style="color:#b0bec5;">—</span></div>
      <div>Progress: <span id="nav-prog" style="color:#b0bec5;">—</span></div>
      <div style="height:1px;background:rgba(0,229,255,0.2);margin:6px 0;"></div>
      <button id="nav-btn-route" style="background:rgba(0,229,255,0.18);border:1px solid #00e5ff;color:#00e5ff;border-radius:4px;padding:5px 8px;font-family:'Courier New',monospace;font-size:11px;cursor:pointer;font-weight:bold;width:100%;letter-spacing:1px;transition:all 0.2s;">
        ✏ DRAW ROUTE (M)
      </button>
      <div style="color:#90a4ae;font-size:10px;margin-top:6px;text-align:center;">
        [M] Toggle Map &nbsp;|&nbsp; [S] Start Autonomous
      </div>
      <div id="nav-no-route" style="display:none;color:#f44336;font-size:11px;margin-top:6px;font-weight:bold;text-align:center;">
        ⚠ No route drawn. Press M first.
      </div>
    `;

    document.body.appendChild(this.container);

    const btn = document.getElementById('nav-btn-route');
    if (btn && onRouteClick) {
      btn.addEventListener('click', onRouteClick);
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(0,229,255,0.35)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(0,229,255,0.18)'; });
    }
  }

  update(navState) {
    // navState: { mode, gruStatus, lastDeltaV, nextUpdateIn, nis, gate, routeDist, progress, noRoute }
    const el = id => document.getElementById(id);

    // Mode
    const modeEl = el('nav-mode');
    if (modeEl) {
      modeEl.textContent = navState.mode || 'IDLE';
      modeEl.style.color = navState.mode === 'RUNNING' ? '#00e676' : navState.mode === 'ROUTE' ? '#ffea00' : '#90a4ae';
    }

    // GRU status
    const gruEl = el('nav-gru-status');
    if (gruEl) {
      const s = navState.gruStatus || 'OFFLINE';
      gruEl.textContent = s;
      gruEl.style.color = s === 'UPDATE' ? '#ff9100' : s === 'READY' ? '#00e676' : '#90a4ae';
    }

    // Delta-v correction
    const dvEl = el('nav-dv');
    if (dvEl && navState.lastDeltaV) {
      const [dvx, dvy, dvz] = navState.lastDeltaV;
      dvEl.textContent = `${dvx >= 0 ? '+' : ''}${dvx.toFixed(3)}, ${dvy >= 0 ? '+' : ''}${dvy.toFixed(3)}, ${dvz >= 0 ? '+' : ''}${dvz.toFixed(3)} m/s`;
    } else if (dvEl) {
      dvEl.textContent = '—';
    }

    // Next update countdown
    const nextEl = el('nav-next');
    if (nextEl) {
      nextEl.textContent = navState.nextUpdateIn != null
        ? `${navState.nextUpdateIn.toFixed(1)} s`
        : '—';
    }

    // NIS
    const nisEl = el('nav-nis');
    if (nisEl) {
      nisEl.textContent = navState.nis != null ? navState.nis.toFixed(3) : '—';
    }

    // Gate
    const gateEl = el('nav-gate');
    if (gateEl) {
      const g = navState.gate || '—';
      gateEl.textContent = g;
      gateEl.style.color = g.startsWith('APPLIED') ? '#00e676' : g.startsWith('REJECTED') ? '#f44336' : '#b0bec5';
    }

    // Route distance
    const distEl = el('nav-dist');
    if (distEl) {
      distEl.textContent = navState.routeDist != null ? `${navState.routeDist.toFixed(1)} m` : '—';
    }

    // Completion %
    const progEl = el('nav-prog');
    if (progEl) {
      progEl.textContent = navState.progress != null ? `${navState.progress}%` : '—';
    }

    // No route warning
    const noRouteEl = el('nav-no-route');
    if (noRouteEl) {
      noRouteEl.style.display = navState.noRoute ? 'block' : 'none';
    }
  }
}
