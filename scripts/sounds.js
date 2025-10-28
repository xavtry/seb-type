// scripts/sounds.js
// SebType Sound Manager
// Exposes global `Sounds` with methods:
// - Sounds.init({ files: { key, correct, error, finish }, enabled: true, volume: 0.5 })
// - Sounds.playKey(), Sounds.playCorrect(), Sounds.playError(), Sounds.playFinish()
// - Sounds.setEnabled(flag), Sounds.setVolume(0-1), Sounds.mute(), Sounds.unmute()
// This manager is defensive: if files are missing it falls back to no-op and does not throw.
// It uses WebAudio API if available for small synthesized beeps when no files are provided.
// It also respects user preference saved in localStorage ('sebtype:sound:enabled').

(function (global) {
  const STORAGE_KEY = 'sebtype:sound:enabled'
  const DEFAULTS = {
    enabled: (localStorage.getItem(STORAGE_KEY) === 'true') || false,
    volume: 0.45
  }

  // internal state
  let enabled = DEFAULTS.enabled
  let volume = DEFAULTS.volume
  let audioCtx = null
  let bufferCache = {} // name -> AudioBuffer or HTMLAudioElement

  // Utility: safe create audio context
  function _ensureAudioContext() {
    if (audioCtx) return audioCtx
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
      return audioCtx
    } catch (e) {
      return null
    }
  }

  // load an audio URL into memory (returns a promise)
  function _loadBuffer(name, url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null)
      // If WebAudio available, use fetch + decode
      const ctx = _ensureAudioContext()
      if (ctx) {
        fetch(url).then(r => r.arrayBuffer()).then(ab => ctx.decodeAudioData(ab)).then(decoded => {
          bufferCache[name] = decoded
          resolve(decoded)
        }).catch(() => {
          // fallback to HTMLAudio element
          const a = new Audio(url)
          a.volume = volume
          bufferCache[name] = a
          resolve(a)
        })
      } else {
        // fallback: HTMLAudio
        const a = new Audio(url)
        a.volume = volume
        bufferCache[name] = a
        resolve(a)
      }
    })
  }

  // play a buffer (AudioBuffer or HTMLAudioElement)
  function _playBuffer(buf) {
    if (!buf) return
    if (!enabled) return
    const ctx = _ensureAudioContext()
    if (buf instanceof AudioBuffer && ctx) {
      const node = ctx.createBufferSource()
      node.buffer = buf
      const gain = ctx.createGain()
      gain.gain.value = volume
      node.connect(gain).connect(ctx.destination)
      try { node.start(0) } catch (e) {}
    } else if (buf instanceof HTMLAudioElement) {
      try {
        buf.volume = volume
        // clone to allow overlapping plays
        const clone = buf.cloneNode(true)
        clone.volume = volume
        clone.play().catch(()=>{})
      } catch (e) {}
    }
  }

  // If no files are provided or loading fails, generate short beeps via WebAudio
  function _synthBeep(freq = 440, duration = 0.05, type = 'sine') {
    if (!enabled) return
    const ctx = _ensureAudioContext()
    if (!ctx) return
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = freq
      g.gain.value = volume
      o.connect(g).connect(ctx.destination)
      o.start()
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      setTimeout(() => {
        try { o.stop() } catch (e) {}
      }, duration * 1000 + 20)
    } catch (e) {
      // swallow
    }
  }

  // Predefined sound names we may use
  const SOUND_NAMES = ['key', 'correct', 'error', 'finish']

  // Public API object
  const Sounds = {
    config: { files: {}, enabled: enabled, volume: volume },

    async init(opts = {}) {
      this.config.files = opts.files || {}
      if (typeof opts.enabled === 'boolean') enabled = opts.enabled
      if (typeof opts.volume === 'number') volume = Math.max(0, Math.min(1, opts.volume))
      this.config.enabled = enabled
      this.config.volume = volume

      // attempt to preload provided files
      const loadPromises = []
      for (const name of SOUND_NAMES) {
        const url = this.config.files[name]
        if (url) loadPromises.push(_loadBuffer(name, url))
      }
      try {
        await Promise.all(loadPromises)
      } catch (e) {
        // ignore load errors - fallback synth will be used
      }
      console.log('%c[Sounds] Ready', 'color:#37e67d', 'enabled=', enabled, 'volume=', volume)
      return true
    },

    // play functions (safe no-op if disabled)
    playKey() {
      if (!enabled) return
      const buf = bufferCache['key']
      if (buf) return _playBuffer(buf)
      // fallback synth short click
      _synthBeep(1400, 0.02, 'square')
    },

    playCorrect() {
      if (!enabled) return
      const buf = bufferCache['correct']
      if (buf) return _playBuffer(buf)
      _synthBeep(900, 0.07, 'sine')
    },

    playError() {
      if (!enabled) return
      const buf = bufferCache['error']
      if (buf) return _playBuffer(buf)
      _synthBeep(240, 0.12, 'sawtooth')
    },

    playFinish() {
      if (!enabled) return
      const buf = bufferCache['finish']
      if (buf) return _playBuffer(buf)
      // small triad
      _synthBeep(660, 0.06, 'sine')
      setTimeout(() => _synthBeep(880, 0.06, 'sine'), 80)
      setTimeout(() => _synthBeep(990, 0.08, 'sine'), 180)
    },

    // toggles & volume
    setEnabled(flag) {
      enabled = !!flag
      this.config.enabled = enabled
      localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
    },

    toggleEnabled() {
      this.setEnabled(!enabled)
      return enabled
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0))
      this.config.volume = volume
    },

    mute() { this.setEnabled(false) },
    unmute() { this.setEnabled(true) },

    // load files at runtime (e.g., user uploaded)
    async loadFiles(files = {}) {
      this.config.files = Object.assign({}, this.config.files, files)
      const promises = []
      for (const k of Object.keys(files)) {
        if (SOUND_NAMES.includes(k)) promises.push(_loadBuffer(k, files[k]))
      }
      try {
        await Promise.all(promises)
        return true
      } catch (e) {
        return false
      }
    }
  }

  // auto-init with defaults
  Sounds.init({ files: {}, enabled: enabled, volume: volume }).catch(()=>{})

  // expose
  global.Sounds = Sounds
})(window)
