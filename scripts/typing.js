// scripts/typing.js
// Typing engine for SebType
// Exports: TypingEngine class
//
// Responsibilities:
// - Word generation for multiple modes (english/numbers/quotes) via a provided dictionary
// - Tracks typed input, per-character correctness, word completion
// - Maintains stats: raw chars, correct chars, WPM estimation, accuracy, consistency
// - Emits events via simple callback registration (onStart, onTick, onFinish, onUpdateWordState)
// - Persists best results to localStorage
//
// Usage:
// import { TypingEngine } from './typing.js'
// const engine = new TypingEngine({ words: ['...'], timeLimit: 60 })
// engine.onStart = () => {}
// engine.onTick = ({ timeLeft, elapsed }) => {}
// engine.processKeystroke('a') or engine.processInput(value)
// engine.tick() is used by timer if desired
//
// Notes: built to be robust and standalone for integration with UI.

const DEFAULT_WORDS = [
  "the","and","to","of","a","in","that","it","is","was","i","for","on","you","he","be","with",
  "as","by","at","have","are","this","not","but","had","his","they","from","she","which","or",
  "we","an","there","their","one","all","would","when","who","what","so","up","out","if","about",
  "get","can","like","me","just","him","know","take","into","your","good","some","could","them",
  "see","other","than","then","now","look","only","come","its","over","think","also","back","after",
  "use","two","how","our","work","first","well","way","even","new","want","because","any","these",
  "give","day","most","us"
]

// small helper: shuffle an array shallow copy
function shuffleArray(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// clamp value
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// smoothing helper for consistency
function stddev(values) {
  if (!values.length) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export class TypingEngine {
  constructor(opts = {}) {
    // config
    this.timeLimit = opts.timeLimit || 60 // seconds
    this.mode = opts.mode || 'english' // english | numbers | quotes
    this.wordsPool = opts.words || DEFAULT_WORDS
    this.seedSize = opts.seedSize || 200 // how many words to generate for a test
    this.spaceCountsAsChar = true

    // state
    this.words = []             // array of words for this test
    this.currentWordIndex = 0   // index into words array
    this.currentInput = ''      // current content of the input field (for current word)
    this.startedAt = null       // timestamp in ms
    this.endedAt = null         // timestamp in ms
    this.started = false
    this.finished = false
    this.timeLeft = this.timeLimit

    // stats
    this.typedChars = 0         // every char typed (including spaces)
    this.correctChars = 0       // correctly typed chars (including spaces for completed words)
    this.wordHistory = []       // per-word results: { typed, correct, word, timeTaken }
    this.wpmHistory = []        // last N wpm snapshots (for graph)
    this.tickIntervalMs = 1000  // how frequently to sample wpm history
    this.lastTickAt = null

    // event callbacks (can be overridden)
    this.onStart = null
    this.onTick = null
    this.onFinish = null
    this.onUpdateWordState = null // called whenever current word correctness changes

    // hooks for persisting best scores
    this.localStorageKey = opts.localStorageKey || 'sebtype:best'
    this.best = this._loadBest() || { wpm: 0, accuracy: 0, raw: 0 }

    // initialize words immediately
    this.resetTest()
  }

  _loadBest() {
    try {
      const raw = localStorage.getItem(this.localStorageKey)
      if (!raw) return null
      return JSON.parse(raw)
    } catch (e) {
      console.warn('sebtype: failed to load best', e)
      return null
    }
  }

  _saveBest() {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.best))
    } catch (e) {
      // ignore
    }
  }

  // generate a words array according to mode + pool
  generateWords(count = this.seedSize) {
    if (this.mode === 'numbers') {
      // produce numeric tokens including combos
      const out = []
      for (let i = 0; i < count; i++) {
        // mix digits and small numbers
        const r = Math.random()
        if (r > 0.8) out.push(String(Math.floor(Math.random() * 9000) + 100)) // 100-9999
        else if (r > 0.5) out.push(String(Math.floor(Math.random() * 100))) // 0-99
        else out.push(String(Math.floor(Math.random() * 10))) // 0-9
      }
      return out
    }
    if (this.mode === 'quotes') {
      // sample fragments from longer sentences
      const sampleQuotes = [
        "To be or not to be",
        "I think therefore I am",
        "There is no substitute for hard work",
        "All that glitters is not gold",
        "The only limit to our realization of tomorrow is our doubts of today",
        "Life is what happens when you're busy making other plans",
        "Get busy living or get busy dying"
      ]
      const out = []
      while (out.length < count) {
        const q = sampleQuotes[Math.floor(Math.random() * sampleQuotes.length)]
        const parts = q.split(' ')
        // take slices from the quote
        for (let i = 0; i < parts.length && out.length < count; i++) {
          out.push(parts[i])
        }
      }
      return out
    }

    // default english mode
    // shuffle and repeat to reach count
    const pool = shuffleArray(this.wordsPool)
    const result = []
    while (result.length < count) {
      result.push(...pool)
    }
    return result.slice(0, count)
  }

  // reset state and generate fresh words
  resetTest() {
    clearInterval(this._historyInterval)
    this.words = this.generateWords(this.seedSize)
    this.currentWordIndex = 0
    this.currentInput = ''
    this.startedAt = null
    this.endedAt = null
    this.started = false
    this.finished = false
    this.timeLeft = this.timeLimit
    this.typedChars = 0
    this.correctChars = 0
    this.wordHistory = []
    this.wpmHistory = []
    this.lastTickAt = Date.now()
    // warm initial history
    for (let i = 0; i < 5; i++) this.wpmHistory.push(0)
    // notify UI
    if (typeof this.onUpdateWordState === 'function') {
      this.onUpdateWordState(this.getCurrentWordState())
    }
  }

  // start the timer/engine
  start() {
    if (this.started) return
    this.started = true
    this.startedAt = Date.now()
    this.endedAt = null
    this._startHistoryInterval()
    if (typeof this.onStart === 'function') this.onStart()
  }

  // internal tick to be called by UI timer or via setInterval in engine
  // delta is seconds elapsed (default 1)
  tick(delta = 1) {
    if (!this.started || this.finished) return
    const now = Date.now()
    const elapsedSinceLast = (now - this.lastTickAt) / 1000
    this.lastTickAt = now
    this.timeLeft = Math.max(0, this.timeLimit - Math.floor((now - this.startedAt) / 1000))
    if (typeof this.onTick === 'function') {
      const payload = {
        timeLeft: this.timeLeft,
        elapsed: Math.floor((now - this.startedAt) / 1000),
        wpm: this.getWPM()
      }
      this.onTick(payload)
    }
    // add snapshot to history
    this._addHistoryPoint(this.getWPM())
    if (this.timeLeft <= 0) this.finish()
  }

  // finish test
  finish() {
    if (this.finished) return
    this.finished = true
    this.endedAt = Date.now()
    this.started = false
    clearInterval(this._historyInterval)
    // finalize current word (if partially typed, still count typed chars)
    if (this.currentInput.length > 0) {
      // we don't award correct chars unless the word is completed with a space
      this.wordHistory.push({
        word: this.words[this.currentWordIndex],
        typed: this.currentInput,
        correct: 0,
        timeTaken: 0
      })
      // typed chars counted already
    }

    // compute final derived metrics
    const stats = {
      wpm: this.getWPM(),
      accuracy: this.getAccuracy(),
      raw: this.getRawSpeed()
    }

    // if best, persist
    if (stats.wpm > this.best.wpm) {
      this.best.wpm = stats.wpm
      this.best.accuracy = stats.accuracy
      this.best.raw = stats.raw
      this._saveBest()
    }

    if (typeof this.onFinish === 'function') this.onFinish(stats)
  }

  // add a history datapoint (capped)
  _addHistoryPoint(wpm) {
    this.wpmHistory.push(Math.round(wpm))
    if (this.wpmHistory.length > 120) this.wpmHistory.shift()
  }

  _startHistoryInterval() {
    if (this._historyInterval) clearInterval(this._historyInterval)
    this._historyInterval = setInterval(() => {
      this._addHistoryPoint(this.getWPM())
    }, this.tickIntervalMs)
  }

  // public: returns the current target word
  getCurrentWord() {
    return this.words[this.currentWordIndex] || ''
  }

  // create rich state for current word to help UI highlight chars
  getCurrentWordState() {
    const target = this.getCurrentWord()
    const typed = this.currentInput
    const chars = []
    let correctCount = 0
    for (let i = 0; i < Math.max(target.length, typed.length); i++) {
      const t = target[i] || ''
      const u = typed[i] || ''
      const ok = u && u === t
      if (ok) correctCount++
      chars.push({ target: t, typed: u, correct: ok })
    }
    return {
      word: target,
      typed,
      chars,
      isComplete: typed === target,
      correctCount
    }
  }

  // process an entire input value (useful for input change events)
  processInput(value) {
    if (this.finished) return
    // start on first user input
    if (!this.started) this.start()
    // if the user typed a space at the end, finalize the word
    if (value.endsWith(' ')) {
      const typed = value.trim()
      const target = this.getCurrentWord()
      // count typed chars, include the space as a char if configured
      const typedIncrement = typed.length + (this.spaceCountsAsChar ? 1 : 0)
      this.typedChars += typedIncrement
      // check correctness
      if (typed === target) {
        this.correctChars += target.length + (this.spaceCountsAsChar ? 1 : 0)
        // store perfect word
        this.wordHistory.push({ word: target, typed, correct: target.length, perfect: true, timeTaken: 0 })
      } else {
        // partial correctness per char
        let correct = 0
        for (let i = 0; i < Math.min(typed.length, target.length); i++) {
          if (typed[i] === target[i]) correct++
        }
        this.correctChars += correct
        this.wordHistory.push({ word: target, typed, correct, perfect: false, timeTaken: 0 })
      }
      // move to next word
      this.currentWordIndex++
      this.currentInput = ''
      // update UI
      if (typeof this.onUpdateWordState === 'function') this.onUpdateWordState(this.getCurrentWordState())
      return
    }

    // otherwise update currentInput and typedChars but do not finalize
    // For an input change, we don't want to double-count backspaces; so we track typedChars as 'keystroke approximate'
    // For simplicity, we set typedChars as previous count + delta typed since last input
    // A more advanced approach would count physical keystrokes; this is sufficient for standard use.
    const delta = value.length - this.currentInput.length
    if (delta > 0) this.typedChars += delta
    // handle removal (backspace) - don't decrement typedChars (common approach)
    this.currentInput = value
    if (typeof this.onUpdateWordState === 'function') this.onUpdateWordState(this.getCurrentWordState())
  }

  // helper: process a single keystroke character (useful if you capture raw key events)
  processKeystroke(ch) {
    if (this.finished) return
    if (!this.started) this.start()
    if (ch === 'Backspace') {
      this.currentInput = this.currentInput.slice(0, -1)
      if (typeof this.onUpdateWordState === 'function') this.onUpdateWordState(this.getCurrentWordState())
      return
    }
    // add char
    this.currentInput += ch
    this.typedChars++
    // if space, treat as word completion
    if (ch === ' ') {
      this.processInput(this.currentInput) // this will trim and finalize
    } else {
      if (typeof this.onUpdateWordState === 'function') this.onUpdateWordState(this.getCurrentWordState())
    }
  }

  // derived metrics
  getElapsedSeconds() {
    if (!this.startedAt) return 0
    if (this.endedAt) return Math.floor((this.endedAt - this.startedAt) / 1000)
    return Math.floor((Date.now() - this.startedAt) / 1000)
  }

  getWPM() {
    const elapsed = this.getElapsedSeconds()
    if (elapsed <= 0) return 0
    // standard: WPM = (correct_chars / 5) / (elapsed_minutes)
    const minutes = elapsed / 60
    return Math.round((this.correctChars / 5) / minutes) || 0
  }

  getRawSpeed() {
    const elapsed = this.getElapsedSeconds()
    if (elapsed <= 0) return 0
    const minutes = elapsed / 60
    return Math.round((this.typedChars / 5) / minutes) || 0
  }

  getAccuracy() {
    if (this.typedChars === 0) return 100
    return Math.round((this.correctChars / this.typedChars) * 100) || 0
  }

  // consistency: measure variance of per-second WPM in history
  getConsistency() {
    if (!this.wpmHistory.length) return 0
    return Math.round(stddev(this.wpmHistory))
  }

  // allow dynamic mode change (regenerates words)
  setMode(mode) {
    this.mode = mode
    this.resetTest()
  }

  setTimeLimit(sec) {
    this.timeLimit = sec
    this.timeLeft = sec
    this.resetTest()
  }

  // expose a compact export of current stats for UI
  getStatsSnapshot() {
    return {
      wpm: this.getWPM(),
      raw: this.getRawSpeed(),
      accuracy: this.getAccuracy(),
      consistency: this.getConsistency(),
      typedChars: this.typedChars,
      correctChars: this.correctChars,
      timeLeft: this.timeLeft,
      elapsed: this.getElapsedSeconds(),
      best: this.best
    }
  }
}

