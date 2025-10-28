
// scripts/data.js
// SebType Data manager (localStorage-backed)
// Exposes global `Data` with methods to record runs, manage a leaderboard/history,
// export/import JSON, compute aggregates, and prune old entries.
//
// Usage examples:
// Data.recordRun({ wpm: 120, accuracy: 98, raw: 130, elapsed: 60, mode:'english', date: Date.now() })
// Data.getTop({ limit: 10 })
// Data.getHistory({ page:1, pageSize:20 })
// Data.export() -> json string
// Data.import(jsonString)
// Data.clearHistory()

(function (global) {
  const STORAGE_KEY = 'sebtype:history:v1'
  const LEADERBOARD_KEY = 'sebtype:leaderboard:v1'
  const DEFAULT_MAX_HISTORY = 2000
  const DEFAULT_MAX_LEADERS = 200

  // In-memory caches
  let history = []
  let leaderboard = []

  // Load from localStorage (safe)
  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      history = raw ? JSON.parse(raw) : []
    } catch (e) {
      console.warn('[Data] failed to parse history', e)
      history = []
    }
    try {
      const raw2 = localStorage.getItem(LEADERBOARD_KEY)
      leaderboard = raw2 ? JSON.parse(raw2) : []
    } catch (e) {
      console.warn('[Data] failed to parse leaderboard', e)
      leaderboard = []
    }
  }

  // Save to localStorage (safe)
  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard))
    } catch (e) {
      console.warn('[Data] failed to save', e)
    }
  }

  // canonicalize a run record
  function _makeRecord(run) {
    // run expected fields: wpm, accuracy, raw, elapsed, mode, date
    const rec = {
      id: run.id || `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      date: run.date || Date.now(),
      mode: run.mode || 'english',
      timeLimit: run.timeLimit || (run.elapsed || 0),
      wpm: Number(run.wpm) || 0,
      raw: Number(run.raw) || 0,
      accuracy: Number(run.accuracy) || 0,
      elapsed: Number(run.elapsed) || 0,
      extras: run.extras || {} // any additional metadata
    }
    return rec
  }

  // maintain leaderboard (sorted by wpm desc, tie break by accuracy desc)
  function _insertLeaderboard(rec) {
    leaderboard.push({ id: rec.id, wpm: rec.wpm, accuracy: rec.accuracy, date: rec.date, mode: rec.mode })
    leaderboard.sort((a, b) => {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
      return a.date - b.date
    })
    // trim
    if (leaderboard.length > DEFAULT_MAX_LEADERS) leaderboard = leaderboard.slice(0, DEFAULT_MAX_LEADERS)
  }

  // prune history to keep localStorage small
  function _pruneHistory(maxItems = DEFAULT_MAX_HISTORY) {
    if (history.length > maxItems) {
      // keep the newest maxItems
      history = history.slice(Math.max(0, history.length - maxItems))
    }
  }

  // Public API
  const Data = {
    init() {
      _load()
      console.log('%c[Data] initialized. entries:', 'color:#37e67d', history.length, 'leaders:', leaderboard.length)
      return { historyLength: history.length, leaders: leaderboard.length }
    },

    // record a finished run
    recordRun(run) {
      try {
        const rec = _makeRecord(run)
        history.push(rec)
        _insertLeaderboard(rec)
        _pruneHistory()
        _save()
        // allow UI hooks
        if (global.UI && typeof global.UI.onNewRun === 'function') {
          try { global.UI.onNewRun(rec) } catch (e) {}
        }
        return rec
      } catch (e) {
        console.warn('[Data] failed to record run', e)
        return null
      }
    },

    // get latest N history entries
    getRecent(count = 50) {
      return history.slice(Math.max(0, history.length - count)).reverse()
    },

    // get paginated history
    getHistory({ page = 1, pageSize = 50 } = {}) {
      const total = history.length
      const pages = Math.max(1, Math.ceil(total / pageSize))
      const p = Math.max(1, Math.min(page, pages))
      const start = Math.max(0, total - p * pageSize)
      const end = Math.max(0, start + pageSize)
      const slice = history.slice(start, end).reverse()
      return { page: p, pages, pageSize, total, data: slice }
    },

    // get top leaders
    getTop({ limit = 10, mode = null } = {}) {
      let list = leaderboard.slice()
      if (mode) list = list.filter(l => l.mode === mode)
      return list.slice(0, limit)
    },

    // remove an entry by id (from history and leaderboard)
    removeById(id) {
      const beforeH = history.length
      history = history.filter(r => r.id !== id)
      leaderboard = leaderboard.filter(r => r.id !== id)
      _save()
      return { removed: beforeH - history.length }
    },

    // clear everything
    clearHistory() {
      history = []
      leaderboard = []
      _save()
    },

    // export JSON (string)
    export() {
      try {
        const payload = { history, leaderboard, exportedAt: Date.now() }
        return JSON.stringify(payload)
      } catch (e) {
        console.warn('[Data] export failed', e)
        return '{}'
      }
    },

    // import JSON (string). If merge === true, merges with existing, otherwise replaces.
    import(jsonString = '{}', { merge = false } = {}) {
      try {
        const parsed = JSON.parse(jsonString)
        const incomingHistory = Array.isArray(parsed.history) ? parsed.history : []
        const incomingLeaders = Array.isArray(parsed.leaderboard) ? parsed.leaderboard : []
        if (!merge) {
          history = incomingHistory.slice()
          leaderboard = incomingLeaders.slice()
        } else {
          // merge history while avoiding duplicates (by id)
          const existingIds = new Set(history.map(h => h.id))
          incomingHistory.forEach(h => { if (!existingIds.has(h.id)) history.push(h) })
          // merge leaderboard by id
          const leaderIds = new Set(leaderboard.map(l => l.id))
          incomingLeaders.forEach(l => { if (!leaderIds.has(l.id)) leaderboard.push(l) })
          // sort leaderboard again
          leaderboard.sort((a, b) => {
            if (b.wpm !== a.wpm) return b.wpm - a.wpm
            if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
            return a.date - b.date
          })
        }
        _pruneHistory()
        _save()
        return true
      } catch (e) {
        console.warn('[Data] import failed', e)
        return false
      }
    },

    // analytics helpers
    statsOverview() {
      const total = history.length
      if (total === 0) return { total: 0, avgWpm: 0, bestWpm: 0, avgAcc: 0 }
      let sumW = 0, sumA = 0, best = 0
      history.forEach(h => {
        sumW += (h.wpm || 0)
        sumA += (h.accuracy || 0)
        if ((h.wpm || 0) > best) best = h.wpm
      })
      return {
        total,
        avgWpm: Math.round(sumW / total),
        avgAcc: Math.round(sumA / total),
        bestWpm: best
      }
    },

    // query runs by filters: by date range, by mode, minWpm, minAccuracy
    query({ from = 0, to = Date.now(), mode = null, minWpm = 0, minAcc = 0 } = {}) {
      return history.filter(h => {
        if (h.date < from || h.date > to) return false
        if (mode && h.mode !== mode) return false
        if ((h.wpm || 0) < minWpm) return false
        if ((h.accuracy || 0) < minAcc) return false
        return true
      })
    },

    // debug: wipe storage (dangerous)
    _debugWipeAll() {
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(LEADERBOARD_KEY)
        history = []
        leaderboard = []
        console.warn('[Data] wiped local storage keys')
      } catch (e) { console.warn(e) }
    }
  }

  // initialize immediately
  _load()
  global.Data = Data
  // run init log
  Data.init()
})(window)
