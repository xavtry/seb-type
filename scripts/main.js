// scripts/main.js
// Main UI glue for SebType website
// - Imports TypingEngine from typing.js
// - Wires DOM elements: controls, word display, input capture, stats panels, result overlay
// - Starts/Stops Timer and drives engine.tick() every second
// - Renders the per-character highlighting and a simple SVG WPM graph
//
// Requirements: include this as a module in index.html:
// <script type="module" src="scripts/main.js"></script>

import { TypingEngine } from './typing.js'

// convenience for query selector
const $ = (sel, parent = document) => parent.querySelector(sel)
const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel))

// default config
const DEFAULT_TIME = 60
const DEFAULT_MODE = 'english'

/**
 * UI Elements expected in index.html:
 * - #word-stream  (container for words)
 * - #hidden-input (real input element - can be invisible but focused)
 * - #wpm-value, #accuracy-value, #raw-value, #time-value
 * - #btn-restart, #select-time, #select-mode
 * - #results-overlay, #results-wpm, #results-accuracy, #results-graph
 */

function createBasicUIIfMissing() {
  // If user hasn't made the HTML yet, create minimal DOM scaffolding so scripts work.
  if (!document.body) return
  if (!$('#sebtype-root')) {
    const root = document.createElement('div')
    root.id = 'sebtype-root'
    root.innerHTML = `
      <style>
        /* Basic inline fallback styles so UI isn't broken if style.css is missing */
        :root {
          --bg: #061f12; --panel: #0b3d23; --accent: #37e67d; --muted: #8de1b0; --error: #e15858;
        }
        body { background: var(--bg); color: #eafaf0; font-family: 'Roboto Mono', monospace; margin:0; }
        .container { max-width:1100px; margin:32px auto; padding:20px; }
        .panel { background: var(--panel); padding:20px; border-radius:12px; }
        .controls { display:flex; gap:8px; margin-bottom:12px; align-items:center; }
        .word-stream { padding:18px; background:#042414; border-radius:10px; min-height:88px; }
        input[type=text] { background:transparent; border:1px solid #073a2a; color:inherit; padding:10px; border-radius:6px; }
      </style>
      <div class="container">
        <div class="panel" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="width:40px;height:40px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#042414;font-weight:700">S</div>
            <div style="font-size:18px;font-weight:700">SebType</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <select id="select-mode">
              <option value="english">English</option>
              <option value="numbers">Numbers</option>
              <option value="quotes">Quotes</option>
            </select>
            <select id="select-time">
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="120">120s</option>
            </select>
            <button id="btn-restart">New</button>
          </div>
        </div>

        <div class="panel" style="margin-top:16px;">
          <div id="word-stream" class="word-stream"></div>
          <div style="margin-top:12px; display:flex; gap:10px; align-items:center;">
            <input id="hidden-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            <div style="margin-left:auto; display:flex; gap:8px;">
              <div style="text-align:center;"><div id="wpm-value" style="font-size:20px">0</div><div style="font-size:11px">WPM</div></div>
              <div style="text-align:center;"><div id="accuracy-value" style="font-size:20px">100%</div><div style="font-size:11px">Accuracy</div></div>
              <div style="text-align:center;"><div id="raw-value" style="font-size:20px">0</div><div style="font-size:11px">Raw</div></div>
              <div style="text-align:center;"><div id="time-value" style="font-size:20px">60s</div><div style="font-size:11px">Time</div></div>
            </div>
          </div>
        </div>

        <div id="results-overlay" class="panel" style="margin-top:16px; display:none;">
          <div style="font-weight:700; font-size:20px">Results</div>
          <div style="display:flex; gap:12px; margin-top:8px;">
            <div><div id="results-wpm" style="font-size:24px">0</div><div style="font-size:12px">WPM</div></div>
            <div><div id="results-accuracy" style="font-size:24px">100%</div><div style="font-size:12px">Accuracy</div></div>
            <div style="flex:1;"><svg id="results-graph" width="100%" height="64"></svg></div>
          </div>
        </div>

      </div>
    `
    document.body.prepend(root)
  }
}

createBasicUIIfMissing()

// find DOM elements (either user provided or created above)
const el = {
  wordStream: $('#word-stream'),
  hiddenInput: $('#hidden-input'),
  wpmValue: $('#wpm-value'),
  accuracyValue: $('#accuracy-value'),
  rawValue: $('#raw-value'),
  timeValue: $('#time-value'),
  btnRestart: $('#btn-restart'),
  selectTime: $('#select-time'),
  selectMode: $('#select-mode'),
  resultsOverlay: $('#results-overlay'),
  resultsWpm: $('#results-wpm'),
  resultsAccuracy: $('#results-accuracy'),
  resultsGraph: $('#results-graph')
}

// initialize engine
const engine = new TypingEngine({
  timeLimit: DEFAULT_TIME,
  mode: DEFAULT_MODE,
  seedSize: 300
})

// wire engine events
engine.onStart = () => {
  // start UI timer loop
  startUITimer()
}
engine.onTick = ({ timeLeft, elapsed, wpm }) => {
  renderStats()
  el.timeValue.textContent = `${timeLeft}s`
}
engine.onUpdateWordState = (wordState) => {
  renderWordStream(wordState)
}
engine.onFinish = (stats) => {
  renderStats()
  showResults(stats)
  stopUITimer()
}

// UI timer that drives engine.tick() every second
let uiTimer = null
function startUITimer() {
  if (uiTimer) return
  uiTimer = setInterval(() => {
    engine.tick(1)
  }, 1000)
}
function stopUITimer() {
  if (!uiTimer) return
  clearInterval(uiTimer)
  uiTimer = null
}

// constructs DOM for the immediate visible words and highlights the current word characters
function renderWordStream(currentState) {
  // We'll display a window of words around the current index
  const windowSize = 40
  const start = Math.max(0, engine.currentWordIndex - 5)
  const end = Math.min(engine.words.length, start + windowSize)
  // build fragment
  el.wordStream.innerHTML = ''
  for (let i = start; i < end; i++) {
    const word = engine.words[i]
    const span = document.createElement('span')
    span.className = 'word-token'
    span.style.display = 'inline-block'
    span.style.marginRight = '12px'
    // highlight current word with per-character spans
    if (i === engine.currentWordIndex) {
      const chars = []
      const typed = currentState ? currentState.typed : ''
      for (let c = 0; c < Math.max(word.length, typed.length); c++) {
        const ch = document.createElement('span')
        ch.textContent = word[c] || ''
        ch.style.padding = '0 1px'
        ch.style.borderRadius = '2px'
        // determine typed char and correctness
        const typedChar = typed[c] || ''
        if (typedChar === '') {
          ch.style.opacity = 0.7
        } else if (typedChar === (word[c] || '')) {
          ch.style.color = '#042414'
          ch.style.background = '#37e67d'
        } else {
          ch.style.color = '#fff'
          ch.style.background = '#7a1b1b'
        }
        chars.push(ch)
      }
      // append char spans
      for (const c of chars) span.appendChild(c)
      // if the current typed input is longer than the target, show extra red text
      if (currentState && currentState.typed.length > word.length) {
        const overflow = document.createElement('span')
        overflow.textContent = currentState.typed.slice(word.length)
        overflow.style.color = '#fff'
        overflow.style.background = '#7a1b1b'
        overflow.style.marginLeft = '6px'
        span.appendChild(overflow)
      }
    } else {
      // non-current words are displayed normally
      span.textContent = word
      span.style.opacity = i < engine.currentWordIndex ? 0.5 : 0.9
    }
    el.wordStream.appendChild(span)
  }
  // ensure the input is always focused
  focusInputSilently()
}

// render stats numbers
function renderStats() {
  const s = engine.getStatsSnapshot()
  el.wpmValue.textContent = s.wpm
  el.accuracyValue.textContent = `${s.accuracy}%`
  el.rawValue.textContent = s.raw
}

// show results overlay and draw a small graph from engine.wpmHistory
function showResults(stats) {
  // show overlay stats
  if (el.resultsWpm) el.resultsWpm.textContent = stats.wpm
  if (el.resultsAccuracy) el.resultsAccuracy.textContent = `${stats.accuracy}%`
  if (el.resultsGraph) {
    drawSmallGraph(el.resultsGraph, engine.wpmHistory)
  }
  if (el.resultsOverlay) el.resultsOverlay.style.display = 'block'
}

// small SVG line graph renderer
function drawSmallGraph(svgEl, points) {
  if (!svgEl) return
  const width = svgEl.clientWidth || 400
  const height = svgEl.clientHeight || 64
  // prepare points scaled
  const max = Math.max(10, ...points)
  const len = Math.max(1, points.length)
  const step = width / len
  // build polyline points
  const coords = points.map((p, i) => {
    const x = i * step
    const y = height - (p / max) * (height - 4)
    return `${x},${y}`
  }).join(' ')
  svgEl.innerHTML = ''
  const ns = 'http://www.w3.org/2000/svg'
  const poly = document.createElementNS(ns, 'polyline')
  poly.setAttribute('points', coords)
  poly.setAttribute('fill', 'none')
  poly.setAttribute('stroke', '#37e67d')
  poly.setAttribute('stroke-width', '2')
  svgEl.appendChild(poly)
}

// focus the hidden input without scrolling the page (useful for mobile)
function focusInputSilently() {
  try {
    const elInput = el.hiddenInput
    if (!elInput) return
    const prevScroll = { x: window.scrollX, y: window.scrollY }
    elInput.focus({ preventScroll: true })
    window.scrollTo(prevScroll.x, prevScroll.y)
  } catch (e) {
    // fallback
    try { el.hiddenInput.focus() } catch (_) {}
  }
}

// event wiring
function wireEvents() {
  // input element change
  if (el.hiddenInput) {
    el.hiddenInput.addEventListener('input', (ev) => {
      const v = ev.target.value
      // forward to engine
      engine.processInput(v)
      // clear input field if the engine consumed a space (so user continues typing)
      if (v.endsWith(' ')) {
        // small debounce to allow onUpdateWordState to render
        setTimeout(() => { el.hiddenInput.value = '' }, 0)
      }
    })

    // also capture keydown for raw keystroke handling (backspace etc.)
    el.hiddenInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        // abort test
        resetAndNewTest()
      }
      // we allow default handling for letters; but we still forward non-character keys
      if (ev.key === 'Backspace') {
        engine.processKeystroke('Backspace')
        // let the input element handle its own deletion as well
      }
    })
  }

  // restart/new test button
  if (el.btnRestart) {
    el.btnRestart.addEventListener('click', () => {
      resetAndNewTest()
      // re-focus input
      setTimeout(() => focusInputSilently(), 40)
    })
  }

  // time select
  if (el.selectTime) {
    el.selectTime.addEventListener('change', (ev) => {
      const sec = Number(ev.target.value)
      engine.setTimeLimit(sec)
      if (el.timeValue) el.timeValue.textContent = `${sec}s`
      resetAndNewTest()
    })
  }

  // mode select
  if (el.selectMode) {
    el.selectMode.addEventListener('change', (ev) => {
      const mode = ev.target.value
      engine.setMode(mode)
      resetAndNewTest()
    })
  }

  // capture clicks on the word stream to focus input
  if (el.wordStream) {
    el.wordStream.addEventListener('click', () => {
      focusInputSilently()
    })
  }

  // global keyboard shortcut to focus
  window.addEventListener('keydown', (ev) => {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return
    // if typing already, do nothing; otherwise focus hidden input when user starts typing
    if (document.activeElement !== el.hiddenInput) {
      focusInputSilently()
    }
  })
}

// reset engine and UI and hide results
function resetAndNewTest() {
  engine.resetTest()
  if (el.resultsOverlay) el.resultsOverlay.style.display = 'none'
  // render initial words and stats
  renderWordStream(engine.getCurrentWordState())
  renderStats()
  // clear input box
  if (el.hiddenInput) el.hiddenInput.value = ''
  // stop timer if active
  stopUITimer()
}

// initialize run
function init() {
  renderStats()
  renderWordStream(engine.getCurrentWordState())
  wireEvents()
  // set initial selects if present
  if (el.selectTime) el.selectTime.value = String(engine.timeLimit)
  if (el.selectMode) el.selectMode.value = engine.mode
  // focus input
  focusInputSilently()

  // precaution: if user clicks outside, keep input focused for quick typing
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#results-overlay')) {
      focusInputSilently()
    }
  })
}

// run init
init()

// expose for debugging on window
window._sebtype = { engine, renderStats, resetAndNewTest, focusInputSilently }
