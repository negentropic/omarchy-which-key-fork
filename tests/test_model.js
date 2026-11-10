const assert = require("assert")
const { load } = require("./load")

const Model = load("WhichKeyModel.js")

const bindings = [
  { modmask: 65, key: "TAB", keycode: 0, description: "Previous workspace" },
  { modmask: 65, key: "B", keycode: 0, description: "Private browser" },
  { modmask: 65, key: "1", keycode: 0, description: "Move to workspace 1" },
  { modmask: 64, key: "W", keycode: 0, description: "Close window" },
  { modmask: 64, key: "B", keycode: 0, description: "Browser" },
  { modmask: 64, key: "B", keycode: 0, description: "Second browser", submap: "apps" },
  { modmask: 64, key: "Q", keycode: 0, description: "   " },
  { modmask: 68, key: "E", keycode: 0, description: "Emoji" },
  { modmask: 72, key: "mouse:272", keycode: 272, description: "Move window" },
  { modmask: 65, key: "code:20", keycode: 20, description: "Resize left" },
  { modmask: 64, key: "SUPER + code:10", keycode: 0, description: "Workspace 1" },
  null,
  "bad row"
]

// Key-kind ordering is what remains with categories off.
const shifted = Model.buildRows(bindings, 65, { categorize: false })
// Sorted by kind of key: letters, numbers, then other named keys.
assert.deepStrictEqual(Array.from(shifted.rows, row => row.key), ["B", "1", "code:20", "TAB"])
assert.strictEqual(shifted.title, "SUPER + SHIFT")
assert.strictEqual(shifted.rows[3].label, "Tab")
assert.strictEqual(shifted.rows[2].label, "-")
assert.strictEqual(shifted.rows[2].special, true)
assert.deepStrictEqual(Array.from(shifted.rows, row => row.groupStart), [false, true, true, false])

const superOnly = Model.buildRows(bindings, 64, { categorize: false })
assert.deepStrictEqual(Array.from(superOnly.rows, row => row.key), ["B", "B", "W", "code:10"])
// Same key in different submaps stays separate.
assert.deepStrictEqual(Array.from(superOnly.rows, row => row.submap), ["", "apps", "", ""])
assert.strictEqual(superOnly.rows[0].duplicate, false)
assert.strictEqual(superOnly.rows[3].label, "1")
assert.strictEqual(superOnly.rows[3].key.includes("SUPER"), false)
assert.strictEqual(superOnly.rows.some(row => row.key === "Q"), false)

const ctrl = Model.buildRows(bindings, 68)
assert.deepStrictEqual(Array.from(ctrl.rows, row => row.description), ["Emoji"])
assert.strictEqual(ctrl.title, "SUPER + CTRL")

const alt = Model.buildRows(bindings, 72)
assert.strictEqual(alt.rows[0].label, "Left Mouse")
assert.strictEqual(alt.title, "SUPER + ALT")

const columns = Model.buildRows(bindings, 65, { maxRowsPerColumn: 2, categorize: false }).columns
assert.strictEqual(columns.length, 2)
assert.deepStrictEqual(Array.from(columns[0], row => row.key), ["B", "1"])
assert.deepStrictEqual(Array.from(columns[1], row => row.key), ["code:20", "TAB"])

// Columns are balanced rather than leaving a short leftover column.
const many = []
for (const letter of "ABCDEFGHIJKLMNOPQ") many.push({ modmask: 64, key: letter, description: letter })
assert.deepStrictEqual(
  Array.from(Model.buildRows(many, 64, { maxRowsPerColumn: 16, categorize: false }).columns, column => column.length),
  [9, 8])

// Chained actions on one key merge; a press/release pair worded as one reads
// as one ("Start/stop"), and any other release half is dropped.
const merged = Model.buildRows([
  { modmask: 8, key: "TAB", description: "Focus on next window" },
  { modmask: 8, key: "TAB", description: "Reveal active window on top" },
  { modmask: 8, key: "F9", description: "Start dictation" },
  { modmask: 8, key: "F9", description: "Stop dictation", release: true },
  { modmask: 8, key: "grave", description: "Quake" },
  { modmask: 8, key: "GRAVE", description: "Stage" }
], 8)
assert.deepStrictEqual(Array.from(merged.rows, row => [row.label, row.description, row.duplicate]), [
  ["`", "Quake · Stage", true],
  ["Tab", "Focus on next window · Reveal active window on top", true],
  ["F9", "Start/stop dictation", false]
])
assert.deepStrictEqual(Array.from(Model.buildRows([
  { modmask: 8, key: "F10", description: "Record" },
  { modmask: 8, key: "F10", description: "Save recording", release: true }
], 8).rows, row => [row.description, row.duplicate]), [["Record", false]])

// Compact rows: numbers, arrows and opposite pairs collapse; the rest is untouched.
const compactSource = []
for (let n = 1; n <= 10; n++)
  compactSource.push({ modmask: 64, key: "code:" + (9 + n), description: "Switch to workspace " + n })
compactSource.push(
  { modmask: 64, key: "LEFT", description: "Focus on left window" },
  { modmask: 64, key: "RIGHT", description: "Focus on right window" },
  { modmask: 64, key: "UP", description: "Focus on above window" },
  { modmask: 64, key: "DOWN", description: "Focus on below window" },
  { modmask: 64, key: "code:20", description: "Expand window left" },
  { modmask: 64, key: "code:21", description: "Shrink window left" },
  { modmask: 64, key: "mouse_up", description: "Previous window in group" },
  { modmask: 64, key: "mouse_down", description: "Next window in group" },
  { modmask: 64, key: "TAB", description: "Next window in group" },
  { modmask: 64, key: "XF86AudioRaiseVolume", description: "Volume up" },
  { modmask: 64, key: "XF86AudioLowerVolume", description: "Volume down" },
  { modmask: 64, key: "Q", description: "Close window" })
const compact = Model.buildRows(compactSource, 64, { categorize: false })
assert.deepStrictEqual(Array.from(compact.rows, row => row.label + " | " + row.description), [
  "Q | Close window",
  "1–0 | Switch to workspace",
  "← → ↑ ↓ | Focus window",
  "- = | Expand/shrink window left",
  "Tab | Next window in group",
  "Scroll ↑↓ | Previous/next window in group",
  "Vol ± | Volume up/down"
])
assert.strictEqual(Model.buildRows(compactSource, 64, { compact: false }).rows.length, 22)

// A partial number run keeps an honest range; a set with gaps stays as rows.
assert.strictEqual(Model.buildRows([1, 2, 3, 4, 5].map(n =>
  ({ modmask: 72, key: String(n), description: "Switch to group window " + n })), 72).rows[0].label, "1–5")
assert.strictEqual(Model.buildRows([1, 3].map(n =>
  ({ modmask: 72, key: String(n), description: "Bar panel " + n })), 72).rows.length, 2)
// A number that does not match its key is not part of a range.
assert.strictEqual(Model.buildRows([
  { modmask: 64, key: "1", description: "Workspace 5" },
  { modmask: 64, key: "2", description: "Workspace 2" }], 64).rows.length, 2)

// Direction wording.
assert.strictEqual(Model.stripDirection("Swap window to the left"), "Swap window")
assert.strictEqual(Model.stripDirection("Move window to left monitor"), "Move window to monitor")
assert.strictEqual(Model.stripDirection("Move window to group on top"), "Move window to group")
assert.strictEqual(Model.stripDirection("Close window"), null)

// Lua press/release pairs arrive without a release flag; their wording pairs them.
const pushToTalk = Model.buildRows([
  { modmask: 8, key: "Alt_R", description: "Start dictation (push-to-talk)" },
  { modmask: 8, key: "Alt_R", description: "Stop dictation (push-to-talk)" }
], 8)
assert.strictEqual(pushToTalk.rows[0].description, "Start/stop dictation (push-to-talk)")
assert.strictEqual(pushToTalk.rows[0].label, "Right Alt")

// Ordering within groups: number row 1..9 then 0, arrows left/right/up/down.
const ordered = Model.buildRows([
  { modmask: 64, key: "code:19", description: "ws 10" },
  { modmask: 64, key: "code:10", description: "ws 1" },
  { modmask: 64, key: "DOWN", description: "down" },
  { modmask: 64, key: "LEFT", description: "left" },
  { modmask: 64, key: "mouse_down", description: "scroll" },
  { modmask: 64, key: "Z", description: "z" }
], 64, { categorize: false })
assert.deepStrictEqual(Array.from(ordered.rows, row => row.label), ["Z", "1", "0", "←", "↓", "Scroll ↓"])
assert.strictEqual(ordered.widestLabel, "Scroll ↓")

// Keys bound to the same action share a row; other submaps and the
// non-compact view keep them apart.
const aliasSource = [
  { modmask: 64, key: "W", description: "Close window" },
  { modmask: 64, key: "Q", description: "Close window" },
  { modmask: 64, key: "RETURN", description: "Browser" },
  { modmask: 64, key: "B", description: "Browser" },
  { modmask: 64, key: "E", description: "Browser", submap: "apps" },
  { modmask: 64, key: "T", description: "Terminal" }
]
assert.deepStrictEqual(Array.from(Model.buildRows(aliasSource, 64, { categorize: false }).rows, row => row.label + " | " + row.description), [
  "B or Enter | Browser",
  "E | Browser",
  "Q or W | Close window",
  "T | Terminal"
])
assert.strictEqual(Model.buildRows(aliasSource, 64, { compact: false }).rows.length, 6)

// Categories: rows are sectioned by what their description says they do.
assert.strictEqual(Model.rowCategory({ description: "Terminal" }), "Apps")
assert.strictEqual(Model.rowCategory({ description: "Close window" }), "Windows")
assert.strictEqual(Model.rowCategory({ description: "Switch to workspace" }), "Workspaces")
assert.strictEqual(Model.rowCategory({ description: "Move window to monitor" }), "Displays")
assert.strictEqual(Model.rowCategory({ description: "Volume up/down" }), "Media & devices")
assert.strictEqual(Model.rowCategory({ description: "Audio" }), "System")
assert.strictEqual(Model.rowCategory({ description: "Extract text (OCR) from screenshot" }), "Capture")
assert.strictEqual(Model.rowCategory({ description: "Dismiss all notifications" }), "Notifications")
assert.strictEqual(Model.rowCategory({ description: "Universal copy" }), "Clipboard")
assert.strictEqual(Model.rowCategory({ description: "Lock system" }), "System")

const categorized = Model.buildRows(compactSource, 64)
assert.deepStrictEqual(Array.from(categorized.rows, row => row.category + " | " + row.label), [
  "Windows | Q",
  "Windows | ← → ↑ ↓",
  "Windows | - =",
  "Windows | Tab",
  "Windows | Scroll ↑↓",
  "Workspaces | 1–0",
  "Media & devices | Vol ±"
])
// Each column names the section it starts with, and a section that continues
// into the next column is named again there.
const sectioned = Model.buildRows(compactSource, 64, { maxRowsPerColumn: 3 }).columns
assert.deepStrictEqual(Array.from(sectioned, column => Array.from(column, row => row.header || "·").join(" ")), [
  "Windows · ·",
  "Windows ·",
  "Workspaces Media & devices"
])
// Each header may stretch a column one line past the maximum (3 + 3 sections).
assert.ok(Array.from(sectioned).every(column => column.length + column.filter(row => row.header).length <= 6))

// Rows that fit one column without headers stay in one column with them.
const oneColumn = []
for (const letter of "ABCDEFGHIJ") oneColumn.push({ modmask: 64, key: letter, description: "App " + letter })
oneColumn.push(
  { modmask: 64, key: "1", description: "Close window" },
  { modmask: 64, key: "2", description: "Next workspace" },
  { modmask: 64, key: "3", description: "Zoom in" },
  { modmask: 64, key: "4", description: "Screenshot" },
  { modmask: 64, key: "5", description: "Clipboard manager" },
  { modmask: 64, key: "6", description: "Lock system" })
assert.strictEqual(Model.buildRows(oneColumn, 64, { maxRowsPerColumn: 16, compact: false }).columns.length, 1)

// Word boundaries keep app names out of the action categories.
for (const name of ["PowerPoint", "Social media", "Spotify", "Windows VM"])
  assert.strictEqual(Model.rowCategory({ description: name }), "Apps", name)
assert.strictEqual(Model.rowCategory({ description: "Display settings" }), "System")
assert.strictEqual(Model.rowCategory({ description: "Close all windows" }), "Windows")
assert.strictEqual(Model.rowCategory({ description: "Switch media source" }), "Media & devices")
assert.strictEqual(Model.rowCategory({ description: "Next/previous track" }), "Media & devices")
assert.strictEqual(Model.rowCategory({ description: "Toggle single-window square aspect" }), "Windows")

// Headers do not cost an extra column when stretched columns can hold them,
// and the columns come out even rather than full ones plus a short leftover.
const sectionedSource = []
for (const letter of "ABCDEFGHIJKLMNOPQRS") sectionedSource.push({ modmask: 64, key: letter, description: "App " + letter })
sectionedSource.push(
  { modmask: 64, key: "1", description: "Close window" },
  { modmask: 64, key: "2", description: "Float window" },
  { modmask: 64, key: "3", description: "Next workspace" },
  { modmask: 64, key: "4", description: "Lock system" },
  { modmask: 64, key: "5", description: "Theme menu" })
const sectionedColumns = Model.buildRows(sectionedSource, 64, { maxRowsPerColumn: 16, compact: false }).columns
const lineCounts = Array.from(sectionedColumns, column => column.length + column.filter(row => row.header).length)
assert.strictEqual(sectionedColumns.length, Model.buildRows(sectionedSource, 64, { maxRowsPerColumn: 16, compact: false, categorize: false }).columns.length)
assert.ok(Math.max(...lineCounts) - Math.min(...lineCounts) <= 3, lineCounts.join("/"))

assert.strictEqual(Model.buildRows(undefined, 64).rows.length, 0)
assert.strictEqual(Model.buildRows({}, 64).rows.length, 0)
assert.strictEqual(Model.buildRows([{ modmask: 64, key: "", description: "Broken" }], 64).rows.length, 0)

assert.strictEqual(Model.modifierTitle(77), "SUPER + SHIFT + CTRL + ALT")
assert.strictEqual(Model.modifierTitle(66), "SUPER + MOD2")
assert.strictEqual(Model.keyLabel("RETURN", 0), "Enter")
assert.strictEqual(Model.keyLabel("LEFT", 0), "←")
assert.strictEqual(Model.keyLabel("code:19", 0), "0")
assert.strictEqual(Model.keyLabel("code:20", 0), "-")
assert.strictEqual(Model.keyLabel("code:21", 0), "=")
assert.strictEqual(Model.keyLabel("code:113", 0), "←")
assert.strictEqual(Model.keyLabel("code:999", 0), "Key 999")
assert.strictEqual(Model.keyLabel("mystery-key", 0), "mystery-key")
assert.strictEqual(Model.keyLabel("SLASH", 0), "/")
assert.strictEqual(Model.keyLabel("comma", 0), ",")
assert.strictEqual(Model.keyLabel("PRINT", 0), "Print")
assert.strictEqual(Model.keyLabel("mouse_up", 0), "Scroll ↑")
assert.strictEqual(Model.keyLabel("XF86AudioRaiseVolume", 0), "Vol +")
assert.strictEqual(Model.keyLabel("XF86AudioStop", 0), "Audio Stop")
assert.strictEqual(Model.keyLabel("code:201", 0), "F23")
assert.strictEqual(Model.keyLabel("mouse:273", 0), "Right Mouse")
assert.strictEqual(Model.keyLabel("mouse:275", 0), "Mouse 4")

assert.strictEqual(Model.isCurrentGeneration(3, 3), true)
assert.strictEqual(Model.isCurrentGeneration(3, 2), false)
assert.strictEqual(Model.isCurrentGeneration(3, "3"), false)

assert.strictEqual(Model.isPayloadTooLarge(""), false)
assert.strictEqual(Model.isPayloadTooLarge("x".repeat(Model.MAX_PAYLOAD_CHARS)), false)
assert.strictEqual(Model.isPayloadTooLarge("x".repeat(Model.MAX_PAYLOAD_CHARS + 1)), true)

const overflowing = []
for (let index = 0; index < Model.MAX_BINDINGS + 25; index++)
  overflowing.push({ modmask: 64, key: "A", description: "Bind " + index })
assert.strictEqual(Model.limitBindings(overflowing).length, Model.MAX_BINDINGS)
assert.strictEqual(Model.limitBindings([{ key: "A" }]).length, 1)
assert.strictEqual(Model.limitBindings("not an array").length, 0)

assert.strictEqual(Model.clampMessage("  boom  "), "boom")
assert.strictEqual(Model.clampMessage(null), "")
assert.strictEqual(Model.clampMessage("x".repeat(Model.MAX_MESSAGE_CHARS)).length, Model.MAX_MESSAGE_CHARS)
assert.strictEqual(Model.clampMessage("x".repeat(Model.MAX_MESSAGE_CHARS + 500)).length, Model.MAX_MESSAGE_CHARS)

console.log("model tests passed")

// Branch hints: modifiers that can still be added, with how many shortcuts lie beyond each.
const superBranches = Model.buildRows(bindings, 64).branches
assert.deepStrictEqual(Array.from(superBranches, b => b.label + ":" + b.count), ["Shift:4", "Ctrl:1", "Alt:1"])
const shiftBranches = Model.buildRows(bindings, 65).branches
assert.deepStrictEqual(Array.from(shiftBranches, b => b.label), [])
// From a layer without Super, adding Super is offered as a next step too.
const altBranches = Model.buildRows(bindings, 8).branches
assert.deepStrictEqual(Array.from(altBranches, b => b.label + ":" + b.count), ["Super:1"])
const altTab = Model.buildRows([{ modmask: 8, key: "TAB", description: "Next window" }], 8)
assert.deepStrictEqual(Array.from(altTab.rows, row => row.label), ["Tab"])
assert.strictEqual(altTab.title, "ALT")
console.log("branch hints ok")
