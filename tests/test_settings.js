const assert = require("assert")
const { load } = require("./load")
const Settings = load("WhichKeySettings.js")

const defaults = Settings.normalize()
assert.strictEqual(defaults.delayMs, 200)
assert.strictEqual(defaults.compact, true)
assert.strictEqual(Settings.normalize({ compact: false }).compact, false)
assert.strictEqual(Settings.normalize({ compact: "no" }).compact, true)
assert.deepStrictEqual(Array.from(defaults.enabledMasks), [64, 65, 68, 72, 69, 73, 76, 77, 8, 9, 12, 13])
// Layers without Super are known; Shift/Ctrl alone are opt-in.
assert.deepStrictEqual(Array.from(Settings.normalize({ enabledMasks: [1, 8, 4] }).enabledMasks), [8, 1, 4])
assert.strictEqual(Settings.isSuperMask(72), true)
assert.strictEqual(Settings.isSuperMask(12), false)
assert.ok(Settings.NON_SUPER_MIN_DELAY_MS >= 500)

// A version 1 file predates the Alt layers, so they are switched on for it once.
const migrated = Settings.normalize(Settings.migrate({ version: 1, enabledMasks: [64, 72] })).enabledMasks
assert.deepStrictEqual(Array.from(migrated), [64, 72, 8, 9, 12, 13])
// A version 2 file is taken as written: Alt layers the user turned off stay off.
assert.deepStrictEqual(Array.from(Settings.normalize(Settings.migrate({ version: 2, enabledMasks: [64] })).enabledMasks), [64])
assert.deepStrictEqual(Array.from(Settings.normalize(Settings.migrate({})).enabledMasks), Array.from(defaults.enabledMasks))

assert.strictEqual(Settings.normalize({ delayMs: -4 }).delayMs, 0)
assert.strictEqual(Settings.normalize({ delayMs: 1201 }).delayMs, 1000)
assert.strictEqual(Settings.normalize({ delayMs: 226 }).delayMs, 250)
assert.deepStrictEqual(Array.from(Settings.normalize({ enabledMasks: [72, 64, 72, 999] }).enabledMasks), [64, 72])
assert.deepStrictEqual(Array.from(Settings.toggleMask(defaults.enabledMasks, 64, false)), [65, 68, 72, 69, 73, 76, 77, 8, 9, 12, 13])
assert.strictEqual(Settings.maskEnabled([65], 65), true)
assert.strictEqual(Settings.maskEnabled([65], 64), false)

assert.strictEqual(Settings.isOversized('{"delayMs":200}'), false)
assert.strictEqual(Settings.isOversized("x".repeat(Settings.MAX_SETTINGS_CHARS)), false)
assert.strictEqual(Settings.isOversized("x".repeat(Settings.MAX_SETTINGS_CHARS + 1)), true)

console.log("settings tests passed")
