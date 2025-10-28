// scripts/ui.js
// SebType UI helper that manages DOM widgets, panels, simple animations, and ties to Typing & Timer
// Provides a defensive UI layer that main.js and other modules can rely on.
// Exposes global UI with some helper callbacks and small utilities:
// - UI.init(), UI.showSavedToast(msg), UI.onModeChange(mode), UI.onNewRun(rec)

(function (global) {
  const UI = {
    // DOM refs (filled in init)
    elements: {},
    // small toast timer
    _toastTimer: null,
    init() {
      this._queryElements()
      this._wireBasicControls()
      console.log('%c[UI] Initialized', 'color:#37e67d')
      return this
    },

    _queryElements() {
      const doc = document
      const el = this.elements
      el.app = doc.getElementById('app') || doc.body
      el.navbar = doc.getElementById('navbar')
      el.btnModes = doc.getElementById('btn-modes')
      el.btnStats = doc.getElementById('btn-stats')
      el.btnSettings = doc.getElementById('btn-settings')
      el.wordStream = doc.getElementById('word-stream') || doc.getElementById('word-area')
      el.hiddenInput = doc.getElementById('hidden-input') || doc.getElementById('input-box')
      el.timerDisplay = doc.getElementById('timer-display')
      el.modeDisplay = doc.getElementById('mode-display')
      el.accuracyDisplay = doc.getElementById('accuracy-display')
      el.results = doc.getElementById('results')
      el.resultsWpm = doc.getElementById('stat-wpm')
      el.resultsRaw = doc.getElementById('stat-raw')
      el.resultsAcc = doc.getElementById('stat-acc')
      el.resultsTime = doc.getElementById('stat-time')
      el.graph = doc.getElementById('graph')
      el.restartBtn = doc.getElementById('restart-btn') || doc.querySelector('#results button')
      el.footer = doc.querySelector('footer')
      el.errorBox = doc.getElementById('error-box') // optional
      // fallback creation if important elements missing will be handled by main.js ensureBaseUI
    },

    _wireBasicControls() {
      const el = this.elements
      // nav buttons are wired in main.js too but we set safe listeners here so UI behaves if main.js missing
      if (el.btnModes && !el.btnModes._wired) {
        el.btnModes.addEventListener('click', (e) => {
          if (typeof global.openModesPanel === 'function') return global.openModesPanel()
          // otherwise fallback to show a tiny notice
          this.showSavedToast('Modes panel (no main handler)')
        })
        el.btnModes._wired = true
      }
      if (el.btnSettings && !el.btnSettings._wired) {
        el.btnSettings.addEventListener('click', (e) => {
          if (typeof global.openSettingsPanel === 'function') return global.openSettingsPanel()
          this.showSavedToast('Settings (no main handler)')
        })
        el.btnSettings._wired = true
      }
      if (el.btnStats && !el.btnStats._wired) {
        el.btnStats.addEventListener('click', (e) => {
          if (typeof global.openStatsPanel === 'function') return global.openStatsPanel()
          this.showSavedToast('Stats (no main handler)')
        })
        el.btnStats._wired = true
      }

      // clicking the word stream focuses the hidden input for quick typing
      if (el.wordStream && !el.wordStream._wired) {
        el.wordStream.addEventListener('click', () => {
          try {
            if (el.hiddenInput) el.hiddenInput.focus()
          } catch (e) {}
        })
        el.wordStream._wired = true
      }

      // restart button
      if (el.restartBtn && !el.restartBtn._wired) {
        el.restartBtn.addEventListener('click', () => {
          // call Typing.reset if available, else reload
          if (typeof global.Typing !== 'undefined' && Typing && typeof Typing.reset === 'function') {
            Typing.reset()
          } else {
            // fallback: reload page only if nothing else
            // location.reload()
            this.showSavedToast('Reset! (typing module not present)')
          }
          // hide results
          if (el.results) el.results.classList.add('hidden')
          if (el.hiddenInput) {
            el.hiddenInput.value = ''
            try { el.hiddenInput.focus({ preventScroll: true }) } catch (e) { el.hiddenInput.focus() }
          }
        })
        el.restartBtn._wired = true
      }

      // hidden input safe wiring for quick local UI reaction (will forward to Typing via main.js normally)
      if (el.hiddenInput && !el.hiddenInput._wired) {
        el.hiddenInput.addEventListener('keydown', (ev) => {
          // prevent arrows from scrolling the page when focused invisibly
          if (['ArrowUp','ArrowDown','PageUp','PageDown'].includes(ev.key)) ev.preventDefault()
        })
        el.hiddenInput._wired = true
      }
    },

    renderWordStream(wordStateOrList) {
      // Accept either a typing-style currentWordState or a plain array of words.
      const elWS = this.elements.wordStream
      if (!elWS) return
      try {
        // If provided a state object with .word and .chars, render the visible window with highlighting
        if (wordStateOrList && Array.isArray(wordStateOrList.words)) {
          // full list (rare)
          const arr = wordStateOrList.words
          elWS.innerHTML = ''
          arr.slice(0, 60).forEach((w, i) => {
            const s = document.createElement('span')
            s.className = 'word'
            s.textContent = w + ' '
            elWS.appendChild(s)
          })
          return
        }

        if (wordStateOrList && typeof wordStateOrList.word === 'string' && Array.isArray(wordStateOrList.chars)) {
          // render a contextual window using global Typing.words if available for context
          const idx = wordStateOrList.index || 0
          const words = (window.Typing && Typing.words) ? Typing.words : [wordStateOrList.word]
          const start = Math.max(0, idx - 6)
          const end = Math.min(words.length, start + 40)
          elWS.innerHTML = ''
          for (let i = start; i < end; i++) {
            const token = words[i]
            const span = document.createElement('span')
            span.className = 'word'
            span.style.marginRight = '0.6rem'
            if (i === idx) {
              // highlight current word per-character
              const typed = (i === idx) ? wordStateOrList.typed : ''
              for (let c = 0; c < Math.max(token.length, typed.length); c++) {
                const chSpan = document.createElement('span')
                chSpan.textContent = token[c] || ''
                chSpan.style.padding = '0 1px'
                chSpan.style.borderRadius = '3px'
                if (!typed[c]) {
                  chSpan.style.opacity = 0.75
                } else if (typed[c] === token[c]) {
                  chSpan.style.background = '#37e67d'
                  chSpan.style.color = '#042414'
                } else {
                  chSpan.style.background = '#7a1b1b'
                  chSpan.style.color = '#fff'
                }
                span.appendChild(chSpan)
              }
              // overflow typed characters
              if (typed.length > token.length) {
                const over = document.createElement('span')
                over.textContent = typed.slice(token.length)
                over.style.background = '#7a1b1b'
                over.style.color = '#fff'
                over.style.marginLeft = '6px'
                span.appendChild(over)
              }
            } else {
              span.textContent = token
              span.style.opacity = i < idx ? 0.5 : 0.9
            }
            elWS.appendChild(span)
          }
          return
        }

        // otherwise if an array of words passed
        if (Array.isArray(wordStateOrList)) {
          elWS.innerHTML = ''
          wordStateOrList.slice(0, 60).forEach(w => {
            const s = document.createElement('span')
            s.className = 'word'
            s.style.marginRight = '0.6rem'
            s.textContent = w
            elWS.appendChild(s)
          })
          return
        }

        // fallback: try to render Typing.words
        if (window.Typing && Array.isArray(Typing.words)) {
          elWS.innerHTML = ''
          Typing.words.slice(Typing.currentWordIndex, Typing.currentWordIndex + 40).forEach(w => {
            const s = document.createElement('span')
            s.className = 'word'
            s.style.marginRight = '0.6rem'
            s.textContent = w
            elWS.appendChild(s)
          })
        }
      } catch (e) {
        console.warn('[UI] renderWordStream failed', e)
      }
    },

    // show a small toast at bottom-right
    showSavedToast(msg = 'Saved') {
      // create toast container if needed
      let t = document.getElementById('sebtype-toast')
      if (!t) {
        t = document.createElement('div')
        t.id = 'sebtype-toast'
        t.style.position = 'fixed'
        t.style.right = '20px'
        t.style.bottom = '20px'
        t.style.background = 'rgba(11,38,24,0.95)'
        t.style.color = 'var(--text)'
        t.style.padding = '8px 12px'
        t.style.borderRadius = '8px'
        t.style.border = '1px solid rgba(55,230,125,0.12)'
        t.style.zIndex = 9999
        document.body.appendChild(t)
      }
      t.textContent = msg
      t.style.opacity = '1'
      if (this._toastTimer) clearTimeout(this._toastTimer)
      this._toastTimer = setTimeout(() => { t.style.opacity = '0'; try{ t.remove() }catch(e){} }, 2500)
    },

    // called when new run recorded (Data.recordRun calls UI.onNewRun if present)
    onNewRun(rec) {
      // mild animation in footer
      try {
        if (this.elements.footer) {
          const old = this.elements.footer.style.transform
          this.elements.footer.style.transform = 'translateY(-4px)'
          setTimeout(()=>{ this.elements.footer.style.transform = old }, 200)
        }
      } catch (e) {}
    },

    // optional: called by Modes when mode changes
    onModeChange(mode) {
      if (this.elements.modeDisplay) this.elements.modeDisplay.textContent = mode
      this.showSavedToast(`Mode: ${mode}`)
    }
  }

  // expose globally
  global.UI = UI
  // auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UI.init())
  } else {
    setTimeout(()=>UI.init(), 0)
  }

})(window)
