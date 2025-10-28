// settings.js
// Manages user preferences and persistence for SebType
// Exposes global `Settings` with methods:
// - Settings.init()
// - Settings.get(key, fallback)
// - Settings.set(key, value)
// - Settings.toggle(key)
// - Settings.applyAll()
// Persists to localStorage under 'sebtype:settings'
// Also provides UI-binding helpers to wire toggles, selects, and saves automatically.

(function (global) {
  const STORAGE_KEY = 'sebtype:settings:v1'

  // default preferences
  const DEFAULTS = {
    theme: 'dark',            // dark | light
    sound: false,             // keypress sound
    showWPMGraph: true,
    animation: true,
    difficulty: 'normal',     // normal | hard (affects word choices later)
    wordsCount: 250,
    autosave: true
  }

  // in-memory prefs
  let prefs = {}

  // load from localStorage or use defaults
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        prefs = Object.assign({}, DEFAULTS)
        return prefs
      }
      const parsed = JSON.parse(raw)
      prefs = Object.assign({}, DEFAULTS, parsed)
      // validate some keys
      prefs.wordsCount = Math.max(20, Math.min(5000, Number(prefs.wordsCount) || DEFAULTS.wordsCount))
      return prefs
    } catch (e) {
      console.warn('[Settings] failed to load, using defaults', e)
      prefs = Object.assign({}, DEFAULTS)
      return prefs
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      if (global.UI && typeof global.UI.showSavedToast === 'function') {
        try { global.UI.showSavedToast() } catch (e) {}
      }
    } catch (e) {
      console.warn('[Settings] failed to save', e)
    }
  }

  // public API
  const Settings = {
    init() {
      load()
      this.applyAll()
      this.wireUI()
      console.log('%c[Settings] ready', 'color:#37e67d')
      return prefs
    },

    get(key, fallback) {
      if (prefs.hasOwnProperty(key)) return prefs[key]
      return typeof fallback !== 'undefined' ? fallback : DEFAULTS[key]
    },

    set(key, value, { autosave = true } = {}) {
      prefs[key] = value
      // side-effects for specific keys
      if (key === 'theme') {
        applyTheme(value)
      }
      if (key === 'wordsCount') {
        Modes.setSeedSize(Number(value) || DEFAULTS.wordsCount)
      }
      if (autosave && prefs.autosave) save()
    },

    toggle(key) {
      const cur = !!this.get(key)
      this.set(key, !cur)
      return !cur
    },

    applyAll() {
      // apply theme
      applyTheme(prefs.theme)
      // apply other visual preferences (animation)
      document.documentElement.classList.toggle('no-animations', !prefs.animation)
      // wire modes to seed size
      Modes.setSeedSize(Number(prefs.wordsCount) || DEFAULTS.wordsCount)
      // optionally hide graph
      if (!prefs.showWPMGraph && window.Graph) {
        try { Graph.clear(); document.querySelectorAll('.graph').forEach(n => n.classList.add('hidden')) } catch (e) {}
      }
    },

    // attach UI elements that have data-pref attributes for automatic binding
    wireUI() {
      // toggles (data-pref="sound", etc.)
      const toggles = document.querySelectorAll('[data-pref-toggle]')
      toggles.forEach(el => {
        const key = el.dataset.prefToggle
        // initialize state
        if (el.type === 'checkbox') {
          el.checked = !!Settings.get(key)
          el.addEventListener('change', () => {
            Settings.set(key, el.checked)
          })
        } else {
          el.addEventListener('click', () => {
            const newVal = Settings.toggle(key)
            // support updating UI visible state
            if (el.dataset.prefActiveClass) {
              el.classList.toggle(el.dataset.prefActiveClass, !!newVal)
            }
          })
        }
      })

      // selects (data-pref-select="theme")
      const selects = document.querySelectorAll('[data-pref-select]')
      selects.forEach(s => {
        const key = s.dataset.prefSelect
        s.value = Settings.get(key)
        s.addEventListener('change', () => {
          Settings.set(key, s.value)
        })
      })

      // inputs (range/number) data-pref-input
      const inputs = document.querySelectorAll('[data-pref-input]')
      inputs.forEach(i => {
        const key = i.dataset.prefInput
        i.value = Settings.get(key)
        i.addEventListener('input', () => {
          // live update but don't spam save until change end (debounce)
          Settings.set(key, i.value, { autosave: false })
        })
        i.addEventListener('change', () => {
          Settings.set(key, i.value, { autosave: true })
        })
      })

      // reset-to-default button
      const resetBtn = document.querySelector('[data-pref-reset]')
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          prefs = Object.assign({}, DEFAULTS)
          save()
          this.applyAll()
          // reflect in UI
          document.querySelectorAll('[data-pref-toggle]').forEach(el => {
            const key = el.dataset.prefToggle
            if (el.type === 'checkbox') el.checked = !!Settings.get(key)
          })
          document.querySelectorAll('[data-pref-input]').forEach(el => {
            const key = el.dataset.prefInput
            el.value = Settings.get(key)
          })
          document.querySelectorAll('[data-pref-select]').forEach(el => {
            const key = el.dataset.prefSelect
            el.value = Settings.get(key)
          })
          if (global.UI && typeof global.UI.showSavedToast === 'function') {
            global.UI.showSavedToast('Preferences reset')
          }
        })
      }
    },

    // export/import preferences (for allowing copy/paste or sharing)
    export() {
      try {
        return JSON.stringify(prefs)
      } catch (e) {
        return '{}'
      }
    },

    import(jsonString) {
      try {
        const obj = JSON.parse(jsonString)
        prefs = Object.assign({}, DEFAULTS, obj)
        save()
        this.applyAll()
        return true
      } catch (e) {
        console.warn('[Settings] invalid import string', e)
        return false
      }
    },

    // debug helper
    debug() {
      console.table(prefs)
    }
  }

  // apply theme helper
  function applyTheme(name) {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    if (name === 'light') {
      root.classList.add('theme-light')
    } else {
      root.classList.add('theme-dark')
    }
  }

  // initialize immediately
  Settings.init()

  // expose global
  global.Settings = Settings
})(window)

