
// modes.js
// Provides different word/token generation modes for SebType
// Exposes global `Modes` with methods:
// - Modes.init(opts)
// - Modes.setMode(modeName)
// - Modes.getMode()
// - Modes.generate(count)
// - Modes.getCurrentDictionary()
// Includes dictionaries for english, numbers, and quotes and supports custom dictionaries.
// Contains helper utilities for shuffling, generating numeric tokens, and creating quote fragments.

(function (global) {
  const DEFAULT_ENGLISH = [
    "the","and","to","of","a","in","that","it","is","was","i","for","on","you","he","be","with",
    "as","by","at","have","are","this","not","but","had","his","they","from","she","which","or",
    "we","an","there","their","one","all","would","when","who","what","so","up","out","if","about",
    "get","can","like","me","just","him","know","take","into","your","good","some","could","them",
    "see","other","than","then","now","look","only","come","its","over","think","also","back","after",
    "use","two","how","our","work","first","well","way","even","new","want","because","any","these",
    "give","day","most","us", "speed", "focus", "keyboard", "practice", "result", "power", "reflex",
    "green", "sebtype", "typing", "flow", "challenge", "skill", "improve", "learn"
  ]

  const DEFAULT_QUOTES = [
    "To be or not to be, that is the question",
    "I think therefore I am",
    "All that glitters is not gold",
    "The only limit to our realization of tomorrow is our doubts of today",
    "Life is what happens when you're busy making other plans",
    "Get busy living or get busy dying",
    "Not everything that is faced can be changed, but nothing can be changed until it is faced"
  ]

  // Helpers
  function shuffle(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  function sample(arr, n) {
    if (!arr || !arr.length) return []
    const out = []
    while (out.length < n) {
      out.push(arr[Math.floor(Math.random() * arr.length)])
    }
    return out
  }

  // numeric token generator (mix of single digits, numbers, and small combos)
  function generateNumbers(count) {
    const out = []
    for (let i = 0; i < count; i++) {
      const r = Math.random()
      if (r < 0.5) out.push(String(Math.floor(Math.random() * 10))) // 0-9
      else if (r < 0.85) out.push(String(Math.floor(Math.random() * 100))) // 0-99
      else out.push(String(Math.floor(Math.random() * 10000))) // 0-9999
    }
    return out
  }

  function wordsFromQuotes(count) {
    // return word fragments sampled from quote corpus
    const words = []
    // split quotes and flatten
    const parts = DEFAULT_QUOTES.map(q => q.replace(/[^\w\s']/g, '').split(/\s+/)).flat()
    for (let i = 0; i < count; i++) {
      words.push(parts[Math.floor(Math.random() * parts.length)])
    }
    return words
  }

  // Mode definitions
  const MODES = {
    english: {
      id: 'english',
      name: 'English',
      description: 'Standard common-word typing test',
      generate: (count, opts = {}) => {
        // smarter english generation: ensure variety and reasonable punctuation occasionally
        const pool = DEFAULT_ENGLISH.slice()
        // produce a shuffled repeated array to reach count
        const out = []
        while (out.length < count) {
          out.push(...shuffle(pool))
        }
        // trim and occasionally insert short punctuation fragments
        const trimmed = out.slice(0, count).map((w, i) => {
          // occasionally add an apostrophe contraction or comma
          if (Math.random() < 0.03) {
            if (w.length > 2) return w + "'" + (Math.random() < 0.5 ? 's' : 't')
          }
          if (Math.random() < 0.02) return w + ','
          return w
        })
        return trimmed
      }
    },
    numbers: {
      id: 'numbers',
      name: 'Numbers',
      description: 'Numeric tokens: digits and numbers',
      generate: (count, opts = {}) => generateNumbers(count)
    },
    quotes: {
      id: 'quotes',
      name: 'Quotes',
      description: 'Fragments sampled from famous quotes',
      generate: (count, opts = {}) => wordsFromQuotes(count)
    }
  }

  // Public API object
  const Modes = {
    _current: 'english',
    _customDictionaries: {},
    _seedSize: 250,
    init(opts = {}) {
      this._seedSize = opts.seedSize || this._seedSize
      this._current = opts.mode || this._current
      console.log('%c[Modes] initialized', 'color:#37e67d')
    },

    getMode() { return this._current },

    // set mode and return generated preview
    setMode(mode) {
      if (!MODES[mode]) {
        console.warn('[Modes] unknown mode', mode)
        return
      }
      this._current = mode
      // notify UI modules if present
      if (global.UI && typeof global.UI.onModeChange === 'function') {
        try { global.UI.onModeChange(mode) } catch (e) {}
      }
      return this.generate(10) // nice preview
    },

    // allow adding custom dictionaries (e.g., user uploading a wordlist)
    addCustomDictionary(name, arr) {
      if (!Array.isArray(arr)) throw new Error('dictionary must be array')
      this._customDictionaries[name] = arr.slice()
    },

    // generate N tokens/words according to current mode
    generate(count = this._seedSize) {
      const mode = this._current
      if (this._customDictionaries[mode]) {
        // sample from custom dictionary
        return sample(this._customDictionaries[mode], count)
      }
      const def = MODES[mode]
      if (!def) return MODES['english'].generate(count)
      return def.generate(count)
    },

    // get dictionary (for UI preview)
    getCurrentDictionary() {
      const mode = this._current
      if (this._customDictionaries[mode]) return this._customDictionaries[mode]
      if (MODES[mode] && MODES[mode].generate) {
        // generate a small sample
        return MODES[mode].generate(100)
      }
      return DEFAULT_ENGLISH
    },

    availableModes() {
      return Object.keys(MODES).map(k => ({ id: k, name: MODES[k].name, desc: MODES[k].description }))
    },

    // utility to set seed size
    setSeedSize(n) {
      this._seedSize = clamp(Math.floor(n), 20, 5000)
    },

    // debug helper - prints some sample sets
    debugSample(count = 40) {
      console.group('%c[Modes] sample', 'color:#37e67d')
      console.log(this.generate(count))
      console.groupEnd()
    }
  }

  // expose globally
  global.Modes = Modes

  // auto-init
  Modes.init({})
})(window)

