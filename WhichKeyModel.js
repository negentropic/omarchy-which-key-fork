.pragma library

var MODIFIERS = [
  { bit: 64, label: "SUPER" },
  { bit: 1, label: "SHIFT" },
  { bit: 4, label: "CTRL" },
  { bit: 8, label: "ALT" }
]

var KEY_LABELS = {
  RETURN: "Enter",
  ENTER: "Enter",
  ESCAPE: "Esc",
  SPACE: "Space",
  TAB: "Tab",
  BACKSPACE: "Backspace",
  DELETE: "Delete",
  LEFT: "←",
  RIGHT: "→",
  UP: "↑",
  DOWN: "↓",
  HOME: "Home",
  END: "End",
  PAGEUP: "Page Up",
  PAGEDOWN: "Page Down",
  INSERT: "Insert",
  PRINT: "Print",
  SLASH: "/",
  BACKSLASH: "\\",
  COMMA: ",",
  PERIOD: ".",
  GRAVE: "`",
  MINUS: "-",
  EQUAL: "=",
  SEMICOLON: ";",
  APOSTROPHE: "'",
  BRACKETLEFT: "[",
  BRACKETRIGHT: "]",
  MOUSE_UP: "Scroll ↑",
  MOUSE_DOWN: "Scroll ↓",
  MOUSE_LEFT: "Scroll ←",
  MOUSE_RIGHT: "Scroll →",
  ALT_L: "Left Alt",
  ALT_R: "Right Alt",
  CONTROL_L: "Left Ctrl",
  CONTROL_R: "Right Ctrl",
  SHIFT_L: "Left Shift",
  SHIFT_R: "Right Shift",
  SUPER_L: "Left Super",
  SUPER_R: "Right Super",
  XF86AUDIORAISEVOLUME: "Vol +",
  XF86AUDIOLOWERVOLUME: "Vol −",
  XF86AUDIOMUTE: "Mute",
  XF86AUDIOMICMUTE: "Mic Mute",
  XF86AUDIOPLAY: "Play",
  XF86AUDIOPAUSE: "Pause",
  XF86AUDIONEXT: "Next",
  XF86AUDIOPREV: "Prev",
  XF86MONBRIGHTNESSUP: "Bright +",
  XF86MONBRIGHTNESSDOWN: "Bright −",
  XF86KBDBRIGHTNESSUP: "Kbd Light +",
  XF86KBDBRIGHTNESSDOWN: "Kbd Light −",
  XF86KBDLIGHTONOFF: "Kbd Light",
  XF86POWEROFF: "Power",
  XF86EJECT: "Eject",
  XF86CALCULATOR: "Calculator",
  XF86TOUCHPADTOGGLE: "Touchpad",
  XF86TOUCHPADON: "Touchpad On",
  XF86TOUCHPADOFF: "Touchpad Off"
}

var MOUSE_LABELS = { 272: "Left Mouse", 273: "Right Mouse", 274: "Middle Mouse" }

// Hyprland exposes physical-code bindings as XKB keycodes (evdev code + 8).
// Convert the standard keyboard range so the guide never leaks `code:NN`.
var XKB_KEY_LABELS = {
  9: "Esc", 20: "-", 21: "=", 22: "Backspace", 23: "Tab",
  34: "[", 35: "]", 36: "Enter", 37: "Ctrl", 47: ";", 48: "'",
  49: "`", 50: "Shift", 51: "\\", 59: ",", 60: ".", 61: "/",
  62: "Shift", 63: "Num *", 64: "Alt", 65: "Space", 66: "Caps Lock",
  77: "Num Lock", 78: "Scroll Lock", 79: "Num 7", 80: "Num 8",
  81: "Num 9", 82: "Num -", 83: "Num 4", 84: "Num 5", 85: "Num 6",
  86: "Num +", 87: "Num 1", 88: "Num 2", 89: "Num 3", 90: "Num 0",
  91: "Num .", 104: "Num Enter", 105: "Ctrl", 106: "Num /",
  107: "Print Screen", 108: "Alt", 110: "Home", 111: "↑",
  112: "Page Up", 113: "←", 114: "→", 115: "End", 116: "↓",
  117: "Page Down", 118: "Insert", 119: "Delete", 127: "Pause",
  133: "Super", 134: "Super", 135: "Menu"
}

// StdioCollector buffers the helper's whole response before the overlay sees
// it, so an implausibly large payload is treated as a fault instead of being
// parsed and retained by the long-lived shell process.
var MAX_PAYLOAD_CHARS = 4194304
var MAX_BINDINGS = 2000

var LETTER_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
var LETTER_STARTS = [24, 38, 52]
for (var letterRow = 0; letterRow < LETTER_ROWS.length; letterRow++)
  for (var letterIndex = 0; letterIndex < LETTER_ROWS[letterRow].length; letterIndex++)
    XKB_KEY_LABELS[LETTER_STARTS[letterRow] + letterIndex] = LETTER_ROWS[letterRow][letterIndex]
for (var numberCode = 10; numberCode <= 19; numberCode++)
  XKB_KEY_LABELS[numberCode] = numberCode === 19 ? "0" : String(numberCode - 9)
for (var functionCode = 67; functionCode <= 76; functionCode++)
  XKB_KEY_LABELS[functionCode] = "F" + String(functionCode - 66)
for (var highFunctionCode = 191; highFunctionCode <= 202; highFunctionCode++)
  XKB_KEY_LABELS[highFunctionCode] = "F" + String(highFunctionCode - 178)
XKB_KEY_LABELS[95] = "F11"
XKB_KEY_LABELS[96] = "F12"

function isPayloadTooLarge(text) {
  return String(text || "").length > MAX_PAYLOAD_CHARS
}

// Diagnostics are external text too: a helper's stderr carries whatever the
// compositor or a failing command printed, so it is clipped before the shell
// logs or displays it.
var MAX_MESSAGE_CHARS = 2000

function clampMessage(text) {
  var value = String(text || "").trim()
  return value.length > MAX_MESSAGE_CHARS ? value.substring(0, MAX_MESSAGE_CHARS) : value
}

function limitBindings(bindings) {
  var source = Array.isArray(bindings) ? bindings : []
  return source.length > MAX_BINDINGS ? source.slice(0, MAX_BINDINGS) : source
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function modifierTitle(mask) {
  var numericMask = Number(mask)
  if (!isFinite(numericMask) || numericMask < 0) numericMask = 0
  numericMask = Math.floor(numericMask)

  var labels = []
  var knownMask = 0
  for (var index = 0; index < MODIFIERS.length; index++) {
    var modifier = MODIFIERS[index]
    knownMask |= modifier.bit
    if ((numericMask & modifier.bit) !== 0) labels.push(modifier.label)
  }

  var unknown = numericMask & ~knownMask
  var bit = 1
  while (unknown > 0 && bit <= 1073741824) {
    if ((unknown & bit) !== 0) {
      labels.push("MOD" + bit)
      unknown &= ~bit
    }
    bit *= 2
  }

  return labels.length > 0 ? labels.join(" + ") : "NONE"
}

function keyLabel(key, keycode) {
  var raw = String(key || "").trim()
  if (!raw && Number(keycode) > 0) raw = "code:" + Number(keycode)
  if (!raw) return ""

  var upper = raw.toUpperCase()
  if (KEY_LABELS[upper]) return KEY_LABELS[upper]

  var codeMatch = /^code:(\d+)$/i.exec(raw)
  if (codeMatch) {
    var code = Number(codeMatch[1])
    return XKB_KEY_LABELS[code] || "Key " + code
  }

  var mouseMatch = /^mouse:(\d+)$/i.exec(raw)
  if (mouseMatch) {
    var button = Number(mouseMatch[1])
    if (MOUSE_LABELS[button]) return MOUSE_LABELS[button]
    if (button >= 272 && button <= 279) return "Mouse " + (button - 271)
  }

  // Remaining XF86 media keys read as words: XF86AudioStop -> "Audio Stop".
  var mediaMatch = /^XF86(.+)$/i.exec(raw)
  if (mediaMatch)
    return mediaMatch[1].replace(/([a-z])([A-Z0-9])/g, "$1 $2")

  return raw
}

function triggerKey(key) {
  var value = String(key || "").trim()
  var previous
  do {
    previous = value
    value = value.replace(/^(SUPER|SHIFT|CTRL|CONTROL|ALT)\s*\+\s*/i, "")
  } while (value !== previous)
  return value.trim()
}

function isSpecialKey(key) {
  return !/^[A-Za-z0-9]$/.test(String(key || ""))
}

// Rows are grouped by the kind of key so the grid reads in a predictable
// order: letters, the number row, arrows, other named keys, function keys,
// mouse, then media keys.
var GROUP_LETTERS = 0
var GROUP_NUMBERS = 1
var GROUP_ARROWS = 2
var GROUP_OTHER = 3
var GROUP_FUNCTION = 4
var GROUP_MOUSE = 5
var GROUP_MEDIA = 6
var ARROW_ORDER = ["←", "→", "↑", "↓"]

function keyGroup(key, label) {
  var rawKey = String(key || "")
  var text = String(label || "")
  if (/^(mouse:|mouse_)/i.test(rawKey)) return GROUP_MOUSE
  if (/^XF86/i.test(rawKey)) return GROUP_MEDIA
  if (/^[A-Za-z]$/.test(text)) return GROUP_LETTERS
  if (/^[0-9]$/.test(text)) return GROUP_NUMBERS
  if (ARROW_ORDER.indexOf(text) !== -1) return GROUP_ARROWS
  if (/^F[0-9]+$/.test(text)) return GROUP_FUNCTION
  return GROUP_OTHER
}

function groupPosition(row) {
  // A collapsed row sorts where its first key would.
  var label = row.sortKey || row.label
  if (row.group === GROUP_NUMBERS) return label === "0" ? 10 : Number(label)
  if (row.group === GROUP_ARROWS) return ARROW_ORDER.indexOf(label)
  if (row.group === GROUP_FUNCTION) return Number(label.substring(1))
  return 0
}

function compareRows(left, right) {
  if (left.group !== right.group) return left.group - right.group

  var positionDifference = groupPosition(left) - groupPosition(right)
  if (positionDifference !== 0) return positionDifference

  var byLabel = String(left.sortKey || left.label).localeCompare(String(right.sortKey || right.label), undefined, {
    numeric: true,
    sensitivity: "base"
  })
  if (byLabel !== 0) return byLabel
  return String(left.description).localeCompare(String(right.description))
}

// ---------------------------------------------------------------------------
// Categories: Hyprland bindings carry no category, only a description, so
// rows are sorted into sections by the words they use. Rules are tried in
// order and the first match wins; anything unmatched is an app launcher,
// which is what the long tail of letter bindings is.

var CATEGORY_ORDER = ["Apps", "Windows", "Workspaces", "Displays", "Media & devices",
  "Capture", "Notifications", "Clipboard", "System"]

var CATEGORY_RULES = [
  // Settings panels named by a single word ("Audio", "Display") are system
  // menus, not the media or monitor actions their words would suggest.
  { category: "System", pattern: /^(audio|bluetooth|display|network|power|wi-?fi)( settings)?$/i },
  { category: "Notifications", pattern: /notification/i },
  { category: "Workspaces", pattern: /workspace/i },
  { category: "Displays", pattern: /monitor|laptop display|display mirroring|\bzoom\b/i },
  { category: "Capture", pattern: /screenshot|screen ?record|colou?r picker|\bocr\b|capture|webcam|transcode|^share$/i },
  { category: "Windows", pattern: /\bwindow\b|\ball windows\b|full ?screen|full width|scratchpad|float|pseudo|gaps|transparency|\bsplit\b|group|quake|aspect|minimi[sz]e|^stage$/i },
  { category: "Media & devices", pattern: /volume|\bmute\b|\btracks?\b|^play$|^pause$|brightness|backlight|touchpad|eject|audio|microphone|dictation|\bmedia (source|player|output)\b/i },
  { category: "Clipboard", pattern: /\b(copy|paste|cut|select all)\b|clipboard/i },
  { category: "System", pattern: /menu|\block|\bpower\b|idle|battery|\btime\b|clock|weather|reminder|theme|background|\bbar\b|keybindings|input language|emoji|hardware|system/i }
]

function rowCategory(row) {
  var description = String(row.description || "")
  for (var index = 0; index < CATEGORY_RULES.length; index++)
    if (CATEGORY_RULES[index].pattern.test(description)) return CATEGORY_RULES[index].category
  return "Apps"
}

function compareCategorized(left, right) {
  var byCategory = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category)
  return byCategory !== 0 ? byCategory : compareRows(left, right)
}

// Lays categorized rows into columns, where a section header counts as a
// line. Each header may stretch a column one line past `maximum`, so that
// sectioning never needs more columns than the same rows would without
// headers when that is possible. Sections stay whole when they fit in a
// fresh column; a longer one continues into the next column under a repeated
// header. Each column's first row of a section carries `header`.
function chunkCategorized(rows, maximum) {
  if (rows.length === 0) return []

  var sections = []
  for (var index = 0; index < rows.length; index++) {
    var row = rows[index]
    if (sections.length === 0 || sections[sections.length - 1].name !== row.category)
      sections.push({ name: row.category, rows: [] })
    sections[sections.length - 1].rows.push(row)
  }

  // Settle the column count first: what the rows alone would take, unless
  // even the stretched height cannot fit them in that many. Then use the
  // shortest columns that still fit in that count, so they come out even
  // rather than full ones followed by a short leftover.
  var lines = rows.length + sections.length
  var cap = maximum + sections.length
  var target = Math.max(Math.ceil(rows.length / maximum), packSections(sections, cap).length)
  var limit = Math.min(cap, Math.max(Math.min(maximum, 4), Math.ceil(lines / target)))
  var packed = packSections(sections, limit)
  while (packed.length > target && limit < cap) packed = packSections(sections, ++limit)
  return packed
}

function packSections(sections, limit) {
  var columns = []
  var column = []
  var used = 0
  function flush() {
    if (column.length > 0) columns.push(column)
    column = []
    used = 0
  }

  for (var sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    var section = sections[sectionIndex]
    var needed = section.rows.length + 1
    // Start a fresh column when the section would fit there but not here, or
    // when only a header and a lone row would be left at the bottom.
    if (used > 0 && used + needed > limit && (needed <= limit || limit - used < 3)) flush()

    var start = 0
    while (start < section.rows.length) {
      if (used + 2 > limit && used > 0) flush()
      var take = Math.max(1, Math.min(section.rows.length - start, limit - used - 1))
      for (var offset = 0; offset < take; offset++) {
        var placed = copyRow(section.rows[start + offset])
        placed.header = offset === 0 ? section.name : ""
        placed.groupStart = false
        column.push(placed)
      }
      used += take + 1
      start += take
    }
  }
  flush()
  return columns
}

// Spread rows evenly across the fewest columns that respect the maximum, so
// the last column is never a short leftover.
function chunkRows(rows, maximum) {
  var columns = []
  if (rows.length === 0) return columns
  var count = Math.ceil(rows.length / maximum)
  var perColumn = Math.ceil(rows.length / count)
  for (var index = 0; index < rows.length; index += perColumn)
    columns.push(rows.slice(index, index + perColumn))
  return columns
}

// One key can carry several bindings: a press/release pair (push-to-talk), or
// two actions chained on the same chord (focus, then raise). Each key is shown
// once. A press/release pair worded as one ("Start dictation" / "Stop
// dictation") reads as "Start/stop dictation"; any other release half is
// dropped when a press exists, and the remaining descriptions are joined.
// `duplicate` marks a key with several press actions and `actions` counts
// them: Hyprland runs every one, so the guide flags them.
function mergeRows(rows) {
  var merged = []
  var byIdentity = {}
  for (var index = 0; index < rows.length; index++) {
    var row = rows[index]
    var identity = row.label + "\u001f" + row.submap
    var entry = byIdentity[identity]
    if (!entry) {
      entry = { row: row, presses: [], releases: [] }
      byIdentity[identity] = entry
      merged.push(entry)
    }
    var list = row.release ? entry.releases : entry.presses
    if (list.indexOf(row.description) === -1) list.push(row.description)
  }

  var result = []
  for (var mergedIndex = 0; mergedIndex < merged.length; mergedIndex++) {
    var current = merged[mergedIndex]
    var descriptions = current.presses.length > 0 ? current.presses : current.releases
    var held = current.presses.length === 1 && current.releases.length === 1
      ? pairedWording(current.presses[0], current.releases[0]) : null
    var output = {}
    for (var field in current.row) output[field] = current.row[field]
    output.description = held || joinDescriptions(descriptions)
    output.duplicate = !held && descriptions.length > 1
    output.actions = held ? 1 : descriptions.length
    output.release = current.presses.length === 0
    result.push(output)
  }
  return result
}

// ---------------------------------------------------------------------------
// Compact rows: keys that do the same thing and differ only by a number, a
// direction or an opposite word are shown as one row. Each rule is generic
// and conservative; a row that fits no pattern is left exactly as it was.

function copyRow(row) {
  var copy = {}
  for (var field in row) copy[field] = row[field]
  return copy
}

function combinedRow(members, label, description) {
  var row = copyRow(members[0])
  row.label = label
  row.description = description
  row.sortKey = members[0].label
  row.keys = members.map(function(member) { return member.key })
  row.duplicate = false
  row.actions = 1
  for (var index = 0; index < members.length; index++) {
    if (members[index].duplicate) row.duplicate = true
    row.actions = Math.max(row.actions, members[index].actions || 1)
  }
  return row
}

function numberPosition(label) {
  return label === "0" ? 10 : Number(label)
}

// "Switch to workspace 1" ... "Switch to workspace 10" on keys 1..0 become
// one "1–0  Switch to workspace" row. The trailing number must match the key.
function collapseNumbers(rows) {
  var buckets = {}
  var order = []
  var rest = []
  for (var index = 0; index < rows.length; index++) {
    var row = rows[index]
    var match = row.group === GROUP_NUMBERS ? /^(.*\S)\s+(\d+)$/.exec(row.description) : null
    if (!match || Number(match[2]) !== numberPosition(row.label)) {
      rest.push(row)
      continue
    }
    var identity = match[1] + "\u001f" + row.submap
    if (!buckets[identity]) {
      buckets[identity] = { prefix: match[1], members: [] }
      order.push(identity)
    }
    buckets[identity].members.push(row)
  }

  for (var orderIndex = 0; orderIndex < order.length; orderIndex++) {
    var bucket = buckets[order[orderIndex]]
    var members = bucket.members
    if (members.length < 2) {
      rest = rest.concat(members)
      continue
    }
    members.sort(function(left, right) {
      return numberPosition(left.label) - numberPosition(right.label)
    })
    var contiguous = true
    for (var memberIndex = 1; memberIndex < members.length; memberIndex++)
      if (numberPosition(members[memberIndex].label)
          !== numberPosition(members[memberIndex - 1].label) + 1) contiguous = false
    // Only an unbroken run reads well as a range; "1 3" is no clearer than
    // two rows, so a set with gaps is left as it was.
    if (!contiguous) {
      rest = rest.concat(members)
      continue
    }
    var label = members[0].label + "–" + members[members.length - 1].label
    rest.push(combinedRow(members, label, bucket.prefix))
  }
  return rest
}

var DIRECTION_WORDS = ["left", "right", "up", "down", "above", "below", "top", "bottom"]

// Removes the direction word from an arrow key's description, with the small
// words that only made sense next to it: "Focus on left window" -> "Focus
// window", "Swap window to the left" -> "Swap window", "Move window to group
// on top" -> "Move window to group". "to" survives mid-sentence, so "Move
// window to left monitor" -> "Move window to monitor".
function stripDirection(description) {
  var words = String(description).split(/\s+/)
  var found = -1
  for (var index = 0; index < words.length; index++) {
    if (DIRECTION_WORDS.indexOf(words[index].toLowerCase()) !== -1) {
      if (found !== -1) return null
      found = index
    }
  }
  if (found === -1) return null

  var last = found === words.length - 1
  var before = words.slice(0, found)
  var after = words.slice(found + 1)
  if (before.length > 0 && before[before.length - 1].toLowerCase() === "the") before.pop()
  if (before.length > 0 && before[before.length - 1].toLowerCase() === "on") before.pop()
  if (last && before.length > 0 && before[before.length - 1].toLowerCase() === "to") before.pop()
  var result = before.concat(after).join(" ").trim()
  return result || null
}

function collapseArrows(rows) {
  var buckets = {}
  var order = []
  var rest = []
  for (var index = 0; index < rows.length; index++) {
    var row = rows[index]
    var stripped = row.group === GROUP_ARROWS ? stripDirection(row.description) : null
    if (!stripped) {
      rest.push(row)
      continue
    }
    var identity = stripped + "\u001f" + row.submap
    if (!buckets[identity]) {
      buckets[identity] = { description: stripped, members: [] }
      order.push(identity)
    }
    buckets[identity].members.push(row)
  }

  for (var orderIndex = 0; orderIndex < order.length; orderIndex++) {
    var bucket = buckets[order[orderIndex]]
    var members = bucket.members
    if (members.length < 2) {
      rest = rest.concat(members)
      continue
    }
    members.sort(function(left, right) {
      return ARROW_ORDER.indexOf(left.label) - ARROW_ORDER.indexOf(right.label)
    })
    var label = members.map(function(member) { return member.label }).join(" ")
    rest.push(combinedRow(members, label, bucket.description))
  }
  return rest
}

var OPPOSITE_PAIRS = [
  ["up", "down"], ["forward", "backward"], ["next", "previous"],
  ["expand", "shrink"], ["smaller", "larger"], ["in", "out"],
  ["increase", "decrease"], ["raise", "lower"], ["maximum", "minimum"],
  ["more", "less"], ["on", "off"], ["show", "hide"], ["prev", "next"],
  ["bigger", "smaller"], ["back", "forward"], ["start", "stop"]
]

function areOpposites(left, right) {
  var a = left.toLowerCase()
  var b = right.toLowerCase()
  for (var index = 0; index < OPPOSITE_PAIRS.length; index++) {
    var pair = OPPOSITE_PAIRS[index]
    if ((pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a)) return true
  }
  return false
}

// The index of the one word two descriptions disagree on, when that word is
// an opposite pair (up/down, expand/shrink, ...); -1 otherwise.
function oppositeWordIndex(left, right) {
  var a = String(left).split(/\s+/)
  var b = String(right).split(/\s+/)
  if (a.length !== b.length) return -1
  var found = -1
  for (var index = 0; index < a.length; index++) {
    if (a[index].toLowerCase() === b[index].toLowerCase()) continue
    if (found !== -1) return -1
    found = index
  }
  return found !== -1 && areOpposites(a[found], b[found]) ? found : -1
}

// "Vol +" and "Vol −" -> "Vol ±"; "Scroll ↑" and "Scroll ↓" -> "Scroll ↑↓";
// keys without a shared word are listed side by side: "- =".
function pairLabel(first, second) {
  var a = /^(.+)\s(\S+)$/.exec(first)
  var b = /^(.+)\s(\S+)$/.exec(second)
  if (a && b && a[1] === b[1]) {
    var signs = [a[2], b[2]].sort().join("")
    if (signs === "+−" || signs === "+-") return a[1] + " ±"
    return a[1] + " " + a[2] + b[2]
  }
  return first + " " + second
}

function collapsePairs(rows) {
  var sorted = rows.slice().sort(compareRows)
  var used = []
  var result = []
  for (var index = 0; index < sorted.length; index++) {
    if (used[index]) continue
    var row = sorted[index]
    var partner = -1
    var wordIndex = -1
    if (!row.keys) {
      for (var other = index + 1; other < sorted.length; other++) {
        // Only keys of the same kind pair up (- with =, Vol + with Vol −), so
        // an unrelated key never borrows a meaning: Tab is not half of a scroll.
        if (used[other] || sorted[other].keys || sorted[other].submap !== row.submap
            || sorted[other].group !== row.group) continue
        wordIndex = oppositeWordIndex(row.description, sorted[other].description)
        if (wordIndex !== -1) { partner = other; break }
      }
    }
    if (partner === -1) {
      result.push(row)
      continue
    }
    used[partner] = true
    var mate = sorted[partner]
    var words = row.description.split(/\s+/)
    var mateWord = mate.description.split(/\s+/)[wordIndex]
    words[wordIndex] = words[wordIndex] + "/" + mateWord.toLowerCase()
    result.push(combinedRow([row, mate], pairLabel(row.label, mate.label), words.join(" ")))
  }
  return result
}

// Different keys bound to the very same action, such as Omarchy's Super+Q
// and Super+W both closing the window, are one row whose label lists each
// key as an alternative ("Q or W"). Only rows no earlier rule combined take
// part, so a label never grows into a mix of sets and alternatives.
function collapseAliases(rows) {
  var sorted = rows.slice().sort(compareRows)
  var result = []
  var byIdentity = {}
  for (var index = 0; index < sorted.length; index++) {
    var row = sorted[index]
    if (row.keys) {
      result.push(row)
      continue
    }
    var identity = row.description + "\u001f" + row.submap
    var members = byIdentity[identity]
    if (!members) {
      members = [row]
      byIdentity[identity] = members
      result.push(members)
    } else {
      members.push(row)
    }
  }

  return result.map(function(entry) {
    if (!Array.isArray(entry)) return entry
    if (entry.length === 1) return entry[0]
    var labels = entry.map(function(member) { return member.label })
    return combinedRow(entry, labels.join(" or "), entry[0].description)
  })
}

function compactRows(rows) {
  return collapseAliases(collapsePairs(collapseArrows(collapseNumbers(rows))))
}

// Two descriptions that differ only in their first word, such as "Start
// dictation" and "Stop dictation", read as one: "Start/stop dictation".
// Returns null for any other pair.
function pairedWording(first, second) {
  var a = /^(\S+)\s+(.+)$/.exec(first)
  var b = /^(\S+)\s+(.+)$/.exec(second)
  return a && b && a[2] === b[2] ? a[1] + "/" + b[1].toLowerCase() + " " + a[2] : null
}

// Two press actions on one key worded as a pair (an older Hyprland that
// reported press/release halves without a release flag) are joined the same
// way. Anything else is listed in full.
function joinDescriptions(descriptions) {
  if (descriptions.length === 2) {
    var paired = pairedWording(descriptions[0], descriptions[1])
    if (paired) return paired
  }
  return descriptions.join(" · ")
}

// Bindings of the submap in `options.submap` ("" is the global map); when
// no submap is given, every submap is shown, each key kept apart per submap.
function inSubmap(binding, submap) {
  return submap === null || String(binding.submap || "") === submap
}

function buildRows(bindings, modifierMask, options) {
  var source = Array.isArray(bindings) ? bindings : []
  var numericMask = Number(modifierMask)
  var submap = options && typeof options.submap === "string" ? options.submap : null
  var rows = []

  for (var index = 0; index < source.length; index++) {
    var binding = source[index]
    if (!isRecord(binding) || Number(binding.modmask) !== numericMask
        || !inSubmap(binding, submap)) continue

    var description = String(binding.description || "").trim()
    var key = triggerKey(binding.key)
    var label = keyLabel(key, binding.keycode)
    if (!description || !key || !label) continue

    rows.push({
      key: key,
      label: label,
      description: description,
      duplicate: false,
      special: isSpecialKey(key),
      group: keyGroup(key, label),
      groupStart: false,
      keycode: Number(binding.keycode) || 0,
      submap: String(binding.submap || ""),
      release: binding.release === true,
      repeat: binding.repeat === true
    })
  }

  rows = mergeRows(rows)
  if (!options || options.compact !== false) rows = compactRows(rows)
  var categorize = !options || options.categorize !== false
  for (var categoryIndex = 0; categoryIndex < rows.length; categoryIndex++)
    rows[categoryIndex].category = categorize ? rowCategory(rows[categoryIndex]) : ""
  rows.sort(categorize ? compareCategorized : compareRows)

  var widestLabel = ""
  for (var markIndex = 0; markIndex < rows.length; markIndex++) {
    rows[markIndex].header = ""
    rows[markIndex].groupStart = markIndex > 0
      && (categorize
        ? rows[markIndex].category !== rows[markIndex - 1].category
        : rows[markIndex].group !== rows[markIndex - 1].group)
    if (rows[markIndex].label.length > widestLabel.length)
      widestLabel = rows[markIndex].label
  }

  var requestedMaximum = options && Number(options.maxRowsPerColumn)
  var maximum = isFinite(requestedMaximum) && requestedMaximum > 0
    ? Math.max(1, Math.floor(requestedMaximum))
    : 12

  return {
    title: modifierTitle(numericMask),
    rows: rows,
    columns: categorize ? chunkCategorized(rows, maximum) : chunkRows(rows, maximum),
    widestLabel: widestLabel,
    branches: buildBranches(source, numericMask, submap)
  }
}

var BRANCH_LABELS = { 1: "Shift", 4: "Ctrl", 8: "Alt", 64: "Super" }

// The modifiers that can still be added to the held chord, each with how many
// described shortcuts lie somewhere beyond it, so the guide can hint at the
// next step of a combo before it is pressed.
function buildBranches(source, mask, submap) {
  if (submap === undefined) submap = null
  var branches = []
  var order = [1, 4, 8, 64]
  for (var orderIndex = 0; orderIndex < order.length; orderIndex++) {
    var bit = order[orderIndex]
    if ((mask & bit) !== 0) continue

    var count = 0
    for (var index = 0; index < source.length; index++) {
      var binding = source[index]
      if (!isRecord(binding) || !inSubmap(binding, submap)) continue
      var modmask = Number(binding.modmask)
      if ((modmask & mask) !== mask || (modmask & bit) === 0) continue
      if (!String(binding.description || "").trim()) continue
      var key = triggerKey(binding.key)
      if (!key || !keyLabel(key, binding.keycode)) continue
      count++
    }
    if (count > 0) branches.push({ bit: bit, label: BRANCH_LABELS[bit], count: count })
  }
  return branches
}
