// scripts/main.js
// Main wiring for SebType website — robust and defensive.
// Reconnects UI -> Typing/Timer/Graph/Modes/Settings/Data/Sounds
// Ensures nav buttons (Modes, Stats, Settings) work, restart behaves, focus input,
// and final result handling records runs and shows the graph.
//
// This file is defensive: it checks for existence of each module and provides
// fallbacks so UI buttons won't fail if a module is missing.

(function () {
  'use strict';

  // helper selectors
  const $ = (sel, parent = document) => parent.querySelector(sel);
  const $$ = (sel, parent = document) => Array.from((parent || document).querySelectorAll(sel));

  // DOM elements expected (fallbacks will be created if missing)
  const el = {
    btnModes: $('#btn-modes'),
    btnStats: $('#btn-stats'),
    btnSettings: $('#btn-settings'),
    navControls: $('#nav-controls'),
    wordStream: $('#word-stream') || $('#word-area'),
    hiddenInput: $('#hidden-input') || $('#input-box'),
    timerDisplay: $('#timer-display'),
    modeDisplay: $('#mode-display'),
    accuracyDisplay: $('#accuracy-display'),
    resultsSection: $('#results'),
    resultsWpm: $('#stat-wpm'),
    resultsRaw: $('#stat-raw'),
    resultsAcc: $('#stat-acc'),
    resultsTime: $('#stat-time'),
    graphCanvas: $('#graph'),
    restartBtn: $('#restart-btn') || $('#restart-btn'),
    footer: document.querySelector('footer')
  }

  // Defensive existence checks for external modules
  const has = {
    Modes: typeof window.Modes !== 'undefined',
    Settings: typeof window.Settings !== 'undefined',
    Timer: typeof window.Timer !== 'undefined',
    Typing: typeof window.Typing !== 'undefined',
    Graph: typeof window.Graph !== 'undefined',
    Data: typeof window.Data !== 'undefined',
    Sounds: typeof window.Sounds !== 'undefined',
    UI: typeof window.UI !== 'undefined'
  }

  // Ensure minimal UI exists so we can attach listeners
  function ensureBaseUI() {
    // If word stream or input missing create them inside #app if present
    const app = $('#app') || document.body;
    if (!el.wordStream) {
      const wb = document.createElement('div');
      wb.id = 'word-stream';
      wb.style.minHeight = '88px';
      wb.style.padding = '12px';
      app.querySelector('#main')?.prepend(wb);
      el.wordStream = wb;
    }
    if (!el.hiddenInput) {
      const inp = document.createElement('input');
      inp.id = 'hidden-input';
      inp.setAttribute('autocomplete', 'off');
      inp.setAttribute('spellcheck', 'false');
      inp.style.opacity = '0';
      inp.style.position = 'absolute';
      inp.style.left = '-9999px';
      app.appendChild(inp);
      el.hiddenInput = inp;
    }
    if (!el.timerDisplay) {
      const t = document.createElement('div');
      t.id = 'timer-display';
      t.textContent = '60s';
      app.querySelector('#main')?.appendChild(t);
      el.timerDisplay = t;
    }
    if (!el.modeDisplay) {
      const m = document.createElement('div');
      m.id = 'mode-display';
      m.textContent = has.Modes ? Modes.getMode() : 'english';
      app.querySelector('#main')?.appendChild(m);
      el.modeDisplay = m;
    }
    if (!el.accuracyDisplay) {
      const a = document.createElement('div');
      a.id = 'accuracy-display';
      a.textContent = 'Acc: --%';
      app.querySelector('#main')?.appendChild(a);
      el.accuracyDisplay = a;
    }
    if (!el.resultsSection) {
      // create a simple results panel
      const sec = document.createElement('section');
      sec.id = 'results';
      sec.className = 'hidden';
      sec.innerHTML = `
        <div class="result-box">
          <h2>Results</h2>
          <div class="stats">
            <div><strong>WPM:</strong> <span id="stat-wpm">0</span></div>
            <div><strong>Raw:</strong> <span id="stat-raw">0</span></div>
            <div><strong>Accuracy:</strong> <span id="stat-acc">0%</span></div>
            <div><strong>Time:</strong> <span id="stat-time">--</span></div>
          </div>
          <canvas id="graph"></canvas>
          <button id="restart-btn">Restart</button>
        </div>`;
      document.body.appendChild(sec);
      el.resultsSection = sec;
      el.resultsWpm = $('#stat-wpm');
      el.resultsRaw = $('#stat-raw');
      el.resultsAcc = $('#stat-acc');
      el.resultsTime = $('#stat-time');
      el.graphCanvas = $('#graph');
      el.restartBtn = $('#restart-btn');
    }
  }

  // safe calls to external modules with logging
  function safeCall(modName, fnName, ...args) {
    if (has[modName] && window[modName] && typeof window[modName][fnName] === 'function') {
      try {
        return window[modName][fnName](...args);
      } catch (e) {
        console.warn(`[main] ${modName}.${fnName} threw`, e);
      }
    }
    return undefined;
  }

  // show/hide helpers
  function showResultsPanel() {
    if (!el.resultsSection) return;
    el.resultsSection.classList.remove('hidden');
  }
  function hideResultsPanel() {
    if (!el.resultsSection) return;
    el.resultsSection.classList.add('hidden');
  }

  // Render helpers
  function updateHud(stats = {}) {
    if (el.timerDisplay) {
      const t = stats.timeLeft != null ? `${stats.timeLeft}s` : (has.Timer ? `${Timer.getProgress ? Math.round(Timer.getProgress()*100) : ''}` : '60s');
      el.timerDisplay.textContent = t;
    }
    if (el.modeDisplay) {
      el.modeDisplay.textContent = (has.Modes ? Modes.getMode() : 'english');
    }
    if (el.accuracyDisplay) {
      el.accuracyDisplay.textContent = stats.accuracy != null ? `Acc: ${stats.accuracy}%` : 'Acc: --%';
    }
  }

  function renderResults(stats = {}) {
    if (el.resultsWpm) el.resultsWpm.textContent = stats.wpm != null ? stats.wpm : '0';
    if (el.resultsRaw) el.resultsRaw.textContent = stats.raw != null ? stats.raw : '0';
    if (el.resultsAcc) el.resultsAcc.textContent = stats.accuracy != null ? `${stats.accuracy}%` : '0%';
    if (el.resultsTime) el.resultsTime.textContent = stats.elapsed != null ? `${stats.elapsed}s` : '--';
    // draw graph if Graph available
    if (has.Graph && window.Graph && Array.isArray(stats.history)) {
      try {
        Graph.render(stats.history);
      } catch (e) {
        console.warn('[main] Graph.render failed', e);
      }
    } else if (el.graphCanvas) {
      // fallback: draw simple bar-ish visualization on canvas
      try {
        const c = el.graphCanvas;
        const ctx = c.getContext && c.getContext('2d');
        if (ctx) {
          const w = c.width = c.clientWidth || 400;
          const h = c.height = c.clientHeight || 120;
          ctx.clearRect(0,0,w,h);
          const arr = stats.history || [];
          const max = Math.max(10, ...(arr.length ? arr : [10]));
          const step = Math.max(1, Math.floor(w / Math.max(1, arr.length)));
          ctx.fillStyle = '#37e67d33';
          for (let i=0;i<arr.length;i++){
            const val = arr[i];
            const barH = Math.round((val / max) * h);
            ctx.fillRect(i*step, h-barH, Math.max(1, step-1), barH);
          }
        }
      } catch (e) { /* ignore */ }
    }
  }

  // Focus helper that avoids scrolling
  function focusInputSilently() {
    try {
      const input = el.hiddenInput;
      if (!input) return;
      const x = window.scrollX || 0;
      const y = window.scrollY || 0;
      input.focus({ preventScroll: true });
      window.scrollTo(x, y);
    } catch (e) {
      try { el.hiddenInput.focus(); } catch (_) {}
    }
  }

  // Wire mode panel: show small popup to pick Modes.availableModes()
  function openModesPanel() {
    // create overlay if not exists
    let pnl = $('#modes-panel');
    if (!pnl) {
      pnl = document.createElement('div');
      pnl.id = 'modes-panel';
      pnl.className = 'modal-panel';
      pnl.style.position = 'fixed';
      pnl.style.right = '20px';
      pnl.style.top = '72px';
      pnl.style.background = 'rgba(11,38,24,0.98)';
      pnl.style.border = '1px solid rgba(55, 230, 125, 0.12)';
      pnl.style.padding = '12px';
      pnl.style.borderRadius = '10px';
      pnl.style.zIndex = 120;
      document.body.appendChild(pnl);
    }
    pnl.innerHTML = '<div style="font-weight:700;margin-bottom:8px;color:var(--accent)">Modes</div>';
    const modes = has.Modes ? Modes.availableModes() : [{ id:'english', name:'English', desc:'Default' }];
    modes.forEach(m => {
      const b = document.createElement('button');
      b.textContent = m.name;
      b.style.display = 'block';
      b.style.width = '100%';
      b.style.margin = '6px 0';
      b.style.padding = '8px';
      b.style.borderRadius = '6px';
      b.style.background = 'transparent';
      b.style.color = 'var(--text)';
      b.onclick = () => {
        if (has.Modes) {
          try { Modes.setMode(m.id); } catch (e) {}
        }
        if (el.modeDisplay) el.modeDisplay.textContent = m.id;
        focusInputSilently();
        // close panel
        pnl.remove();
      };
      pnl.appendChild(b);
    });
  }

  // Wire settings panel (if Settings exists, use it; otherwise show fallback)
  function openSettingsPanel() {
    let pnl = $('#settings-panel');
    if (!pnl) {
      pnl = document.createElement('div');
      pnl.id = 'settings-panel';
      pnl.className = 'modal-panel';
      pnl.style.position = 'fixed';
      pnl.style.left = '50%';
      pnl.style.top = '12%';
      pnl.style.transform = 'translateX(-50%)';
      pnl.style.background = 'var(--panel-bg)';
      pnl.style.border = '1px solid var(--border)';
      pnl.style.padding = '16px';
      pnl.style.borderRadius = '12px';
      pnl.style.zIndex = 120;
      pnl.style.minWidth = '320px';
      document.body.appendChild(pnl);
    }
    // populate content
    pnl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:700;color:var(--accent)">Settings</div>
        <button id="close-settings" style="background:transparent;border:none;color:var(--text)">✕</button>
      </div>
      <div style="margin-top:10px;">
        <label style="display:block;margin-bottom:8px">Theme:
          <select id="settings-theme" style="margin-left:10px">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label style="display:block;margin-bottom:8px">Sound:
          <input id="settings-sound" type="checkbox" style="margin-left:10px" />
        </label>
        <label style="display:block;margin-bottom:8px">Show WPM Graph:
          <input id="settings-graph" type="checkbox" style="margin-left:10px" checked />
        </label>
        <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">
          <button id="save-settings" style="background:var(--accent);border-radius:8px;padding:6px 10px;border:none">Save</button>
          <button id="cancel-settings" style="background:transparent;border:1px solid var(--border);border-radius:8px;padding:6px 10px">Cancel</button>
        </div>
      </div>
    `;

    // wire buttons
    $('#close-settings').addEventListener('click', () => pnl.remove());
    $('#cancel-settings').addEventListener('click', () => pnl.remove());
    // populate initial values from Settings if available
    if (has.Settings) {
      try {
        const theme = Settings.get('theme', 'dark');
        const sound = Settings.get('sound', false);
        const graph = Settings.get('showWPMGraph', true);
        $('#settings-theme').value = theme;
        $('#settings-sound').checked = !!sound;
        $('#settings-graph').checked = !!graph;
      } catch (e) {}
    }
    // Save
    $('#save-settings').addEventListener('click', () => {
      const theme = $('#settings-theme').value;
      const sound = $('#settings-sound').checked;
      const graph = $('#settings-graph').checked;
      if (has.Settings) {
        try {
          Settings.set('theme', theme);
          Settings.set('sound', sound);
          Settings.set('showWPMGraph', graph);
        } catch (e) {}
      } else {
        // minimal application: toggle document theme class
        document.documentElement.classList.toggle('theme-light', theme === 'light');
        document.documentElement.classList.toggle('theme-dark', theme !== 'light');
        // persist
        try { localStorage.setItem('sebtype:settings:v1', JSON.stringify({ theme, sound, showWPMGraph: graph })) } catch (e) {}
      }
      // configure Sounds if present
      if (has.Sounds) {
        try { Sounds.setEnabled(!!sound); } catch (e) {}
      }
      pnl.remove();
    });
  }

  // Stats panel (shows Data.getRecent)
  function openStatsPanel() {
    const pnlId = 'stats-panel';
    let pnl = document.getElementById(pnlId);
    if (!pnl) {
      pnl = document.createElement('div');
      pnl.id = pnlId;
      pnl.style.position = 'fixed';
      pnl.style.left = '50%';
      pnl.style.top = '10%';
      pnl.style.transform = 'translateX(-50%)';
      pnl.style.background = 'var(--panel-bg)';
      pnl.style.padding = '12px';
      pnl.style.border = '1px solid var(--border)';
      pnl.style.borderRadius = '10px';
      pnl.style.zIndex = 120;
      pnl.style.maxHeight = '70vh';
      pnl.style.overflow = 'auto';
      document.body.appendChild(pnl);
    }
    pnl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:700;color:var(--accent)">Recent Runs</div>
      <button id="close-stats" style="background:transparent;border:none;color:var(--text)">✕</button>
    </div>`;
    $('#close-stats').addEventListener('click', () => pnl.remove());

    // If Data exists show recent runs; otherwise show a help message
    if (has.Data) {
      const recent = Data.getRecent(50);
      if (recent.length === 0) {
        pnl.innerHTML += '<div style="margin-top:10px;color:var(--sub)">No runs recorded yet — do a test first.</div>';
      } else {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.marginTop = '8px';
        table.innerHTML = `
          <thead style="text-align:left;color:var(--sub)"><tr><th>WPM</th><th>Acc</th><th>Raw</th><th>Mode</th><th>Date</th></tr></thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        recent.forEach(r => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td style="padding:6px">${r.wpm}</td><td>${r.accuracy}%</td><td>${r.raw}</td><td>${r.mode}</td><td>${new Date(r.date).toLocaleString()}</td>`;
          tbody.appendChild(tr);
        });
        pnl.appendChild(table);
      }
    } else {
      pnl.innerHTML += '<div style="margin-top:10px;color:var(--sub)">No data module loaded. Runs are not being saved.</div>';
    }
  }

  // Handle result from Typing finish (safe hooking)
  function onTestFinish(stats) {
    // stats expected to contain: wpm, accuracy, raw, elapsed, history (optional)
    // render results and show overlay
    renderResults(stats || {});
    showResultsPanel();

    // record via Data if present
    if (has.Data) {
      try {
        const rec = {
          wpm: stats.wpm || 0,
          accuracy: stats.accuracy || 0,
          raw: stats.raw || 0,
          elapsed: stats.elapsed || (stats.timeLeft ? ( (has.Timer && Timer.getProgress) ? Math.round(Timer.getProgress()* (Timer.getProgress && Timer.getProgress()) ) : 0 : 0),
          mode: has.Modes ? Modes.getMode() : 'english',
          timeLimit: stats.timeLimit || (has.Timer && Timer.setDuration ? undefined : undefined),
          history: stats.history || []
        };
        Data.recordRun && Data.recordRun(rec);
      } catch (e) {
        console.warn('[main] failed to record run', e);
      }
    }
    // play finish sound
    if (has.Sounds) {
      try { Sounds.playFinish(); } catch (e) {}
    }
  }

  // Hook Typing events if Typing has callbacks or event hooks
  function wireTypingEvents() {
    if (!has.Typing) return;
    try {
      // two styles of Typing implementations exist in this project:
      // 1) Typing exposes start/reset and its own input listener (IIFE)
      // 2) TypingEngine module exposes onStart/onTick/onUpdateWordState/onFinish
      // We'll support both styles.

      // if engine-style with hooks:
      if (typeof Typing.onFinish === 'function' || typeof Typing.onFinish === 'undefined') {
        // safe set if available
        try { Typing.onFinish = (stats) => onTestFinish(stats); } catch (e) {}
        try { Typing.onTick = (payload) => updateHud(payload); } catch (e) {}
        try { Typing.onUpdateWordState = (state) => {
          // if the Typing module already renders the word area we don't need to re-render.
          // But in case it doesn't, we'll render simple inline fallback:
          if (el.wordStream && state && typeof state.word === 'string') {
            // minimal rendering: show few words around
            if (!state._renderedByTyping) {
              el.wordStream.innerHTML = '';
              const start = Math.max(0, (Typing.words ? Typing.currentWordIndex : 0) - 3);
              const list = Typing.words || Modes.generate ? (Typing.words || (has.Modes ? Modes.generate(120) : [])) : [];
              const win = list.slice(0, 40);
              win.forEach((w,i)=>{
                const span = document.createElement('span');
                span.className = 'word';
                span.textContent = w + ' ';
                el.wordStream.appendChild(span);
              });
            }
          }
        }} catch (e) {}
      }

      // If Typing exposes events differently (e.g., returns custom event registration), try common function names:
      if (typeof Typing.addEventListener === 'function') {
        try {
          Typing.addEventListener('finish', onTestFinish);
          Typing.addEventListener('tick', (payload) => updateHud(payload));
        } catch (e) {}
      }

      // If Typing expects raw input forwarded, bind our hidden input to Typing.processInput or Typing.handleInput
      if (el.hiddenInput) {
        el.hiddenInput.addEventListener('input', (ev) => {
          const v = ev.target.value;
          // call Typing.processInput if available
          if (typeof Typing.processInput === 'function') {
            try { Typing.processInput(v); } catch (e) {}
          } else if (typeof Typing.handleInput === 'function') {
            try { Typing.handleInput({ target: { value: v } }); } catch (e) {}
          } else {
            // fallback: if Typing.start exists but no process method, just rely on typing's own input handler
          }
          // if engine consumed a space, clear input to keep typing flow
          if (v.endsWith(' ')) {
            setTimeout(() => { el.hiddenInput.value = ''; }, 0);
          }
          // play key sound on input
          if (has.Sounds) {
            try { Sounds.playKey(); } catch (e) {}
          }
        });

        // also forward keydown for Backspace / Escape handling
        el.hiddenInput.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape') {
            // stop or reset
            if (typeof Typing.reset === 'function') Typing.reset();
            if (typeof Timer.stop === 'function') Timer.stop();
            hideResultsPanel();
          }
          if (ev.key === 'Backspace') {
            if (typeof Typing.processKeystroke === 'function') {
              try { Typing.processKeystroke('Backspace'); } catch (e) {}
            }
          }
        });
      }
    } catch (e) {
      console.warn('[main] wireTypingEvents failed', e);
    }
  }

  // Restart/Reset handler
  function wireRestart() {
    if (!el.restartBtn) return;
    el.restartBtn.addEventListener('click', () => {
      // hide results and reset modules
      hideResultsPanel();
      if (has.Typing && typeof Typing.reset === 'function') Typing.reset();
      if (has.Graph && typeof Graph.clear === 'function') Graph.clear();
      if (has.Timer && typeof Timer.stop === 'function') Timer.stop();
      // clear input and focus
      if (el.hiddenInput) el.hiddenInput.value = '';
      focusInputSilently();
      // play a small click
      if (has.Sounds) try { Sounds.playKey(); } catch (e) {}
    });
  }

  // Hook up Nav buttons
  function wireNavButtons() {
    if (el.btnModes) {
      el.btnModes.addEventListener('click', (e) => {
        openModesPanel();
      });
    }
    if (el.btnSettings) {
      el.btnSettings.addEventListener('click', (e) => {
        openSettingsPanel();
      });
    }
    if (el.btnStats) {
      el.btnStats.addEventListener('click', (e) => {
        openStatsPanel();
      });
    }
  }

  // If Typing provides an onFinish callback field (object-style engine), set it to our handler.
  function attachFinishHookIfPossible() {
    if (!has.Typing) return;
    try {
      if (typeof Typing.onFinish === 'undefined') {
        Typing.onFinish = (stats) => onTestFinish(stats);
      } else if (typeof Typing.onFinish === 'function') {
        // override but call previous if present
        const prev = Typing.onFinish;
        Typing.onFinish = function (stats) {
          try { prev(stats); } catch (e) {}
          onTestFinish(stats);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Initialize everything
  function init() {
    ensureBaseUI();
    wireNavButtons();
    wireTypingEvents();
    wireRestart();
    attachFinishHookIfPossible();

    // Graph init if available
    if (has.Graph && typeof Graph.init === 'function') {
      try { Graph.init(); } catch (e) { console.warn('[main] Graph.init failed', e); }
    }

    // Timer init update display
    if (has.Timer && typeof Timer.init === 'function') {
      try { Timer.init(); } catch (e) { /* ignore */ }
    }

    // Settings init
    if (has.Settings && typeof Settings.init === 'function') {
      try { Settings.init(); } catch (e) {}
    }

    // Modes init
    if (has.Modes && typeof Modes.init === 'function') {
      try { Modes.init(); } catch (e) {}
    }

    // Focus input when user hits any typing key (quickstart)
    document.addEventListener('keydown', (ev) => {
      // ignore modifier-only keys
      if (['Shift','Control','Alt','Meta'].includes(ev.key)) return;
      // if user isn't already typing into input, focus it
      if (document.activeElement !== el.hiddenInput) {
        focusInputSilently();
      }
    });

    // Click word area focuses input
    if (el.wordStream) {
      el.wordStream.addEventListener('click', focusInputSilently);
    }

    // initial HUD update
    updateHud({ timeLeft: (has.Timer && Timer.getProgress) ? Math.round((1 - Timer.getProgress())* (Timer.getProgress && Timer.getProgress())) : null, accuracy: null });
    console.log('%c[main] SebType main.js initialized', 'color:#37e67d');
  }

  // run init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  // expose for debug
  window.SebMain = {
    init,
    openModesPanel,
    openSettingsPanel,
    openStatsPanel,
    focusInputSilently
  };

})();
