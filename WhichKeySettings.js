.pragma library

// Every modifier layer the guide can show, in settings order: the Super layers
// first, then layers without Super (Alt+Tab, Ctrl+Alt+Delete, ...).
var KNOWN_MASKS = [64, 65, 68, 72, 69, 73, 76, 77, 8, 9, 12, 13, 1, 4, 5]

// Layers on by default. Shift, Ctrl and Shift+Ctrl alone stay off: they are
// held while typing and selecting, and their only bindings are media variants.
var DEFAULT_MASKS = [64, 65, 68, 72, 69, 73, 76, 77, 8, 9, 12, 13]

// Layers added in settings version 2. A version 1 file predates them, so they
// are switched on for it once instead of reading as deliberately disabled.
var SETTINGS_VERSION = 2
var VERSION_2_MASKS = [8, 9, 12, 13]

// Layers without Super open only after a longer hold, whatever the configured
// delay, so a quick Ctrl+C or Alt+Tab never flashes the guide.
var NON_SUPER_MIN_DELAY_MS = 500

// How strongly the display behind the guide is dimmed, in percent.
var DEFAULT_DIM_PERCENT = 70

function isSuperMask(mask) {
  return (Number(mask) & 64) !== 0
}

function migrate(value) {
  var source = value && typeof value === "object" ? value : {}
  if (Number(source.version) >= SETTINGS_VERSION || !Array.isArray(source.enabledMasks))
    return source
  var migrated = {}
  for (var key in source) migrated[key] = source[key]
  migrated.enabledMasks = source.enabledMasks.concat(VERSION_2_MASKS)
  migrated.version = SETTINGS_VERSION
  return migrated
}

// The helper already refuses anything past its byte ceiling, so this is the
// second half of the same contract: whatever reaches the shell is checked again
// before it is parsed or kept, however it arrived.
var MAX_SETTINGS_CHARS = 65536

function isOversized(raw) {
  return String(raw || "").length > MAX_SETTINGS_CHARS
}

function normalize(value) {
  var source = value && typeof value === "object" ? value : {}
  var delay = Number(source.delayMs)
  if (!isFinite(delay)) delay = 200
  delay = Math.max(0, Math.min(1000, Math.round(delay / 50) * 50))

  var requested = Array.isArray(source.enabledMasks) ? source.enabledMasks : DEFAULT_MASKS
  var enabled = []
  for (var index = 0; index < KNOWN_MASKS.length; index++) {
    var mask = KNOWN_MASKS[index]
    if (requested.indexOf(mask) !== -1) enabled.push(mask)
  }
  // Compact rows (1–0, ← → ↑ ↓, pairs) are on unless explicitly turned off.
  var compact = source.compact !== false

  var dim = Number(source.dimPercent)
  if (!isFinite(dim)) dim = DEFAULT_DIM_PERCENT
  dim = Math.max(0, Math.min(90, Math.round(dim / 5) * 5))

  return { delayMs: delay, enabledMasks: enabled, compact: compact, dimPercent: dim }
}

function toggleMask(masks, mask, enabled) {
  var current = normalize({ enabledMasks: masks }).enabledMasks
  var next = []
  for (var index = 0; index < KNOWN_MASKS.length; index++) {
    var candidate = KNOWN_MASKS[index]
    if (candidate === Number(mask) ? enabled : current.indexOf(candidate) !== -1)
      next.push(candidate)
  }
  return next
}

function maskEnabled(masks, mask) {
  return normalize({ enabledMasks: masks }).enabledMasks.indexOf(Number(mask)) !== -1
}
