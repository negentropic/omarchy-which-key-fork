import QtQuick
import Quickshell
import Quickshell.Io
import "WhichKeyModel.js" as Model
import "WhichKeySettings.js" as Settings

QtObject {
  id: root

  property string sourceDir: ""
  property int delayMs: 200
  property var enabledMasks: Settings.DEFAULT_MASKS.slice()
  property bool compact: true
  property int dimPercent: Settings.DEFAULT_DIM_PERCENT
  property bool loaded: false
  property string error: ""

  // A write always describes state the shell already holds, so a read that
  // started before it must not be allowed to restore the previous document.
  property int writeSerial: 0
  property bool writePending: false

  readonly property string configHome: {
    var configured = Quickshell.env("XDG_CONFIG_HOME")
    return configured ? String(configured) : Quickshell.env("HOME") + "/.config"
  }
  readonly property string path: configHome + "/omarchy/which-key.json"

  // The settings file is user writable, so it is never opened from this
  // long-lived process. The helper reads it through a no-follow, nonblocking
  // descriptor and stops at a byte ceiling, so what arrives here is bounded.
  readonly property string helper: sourceDir
    ? sourceDir + "/scripts/which-key-settings" : ""

  readonly property var combinations: [
    { mask: 64, label: "SUPER" },
    { mask: 65, label: "SUPER + SHIFT" },
    { mask: 68, label: "SUPER + CTRL" },
    { mask: 72, label: "SUPER + ALT" },
    { mask: 69, label: "SUPER + SHIFT + CTRL" },
    { mask: 73, label: "SUPER + SHIFT + ALT" },
    { mask: 76, label: "SUPER + CTRL + ALT" },
    { mask: 77, label: "SUPER + SHIFT + CTRL + ALT" },
    { mask: 8, label: "ALT" },
    { mask: 9, label: "SHIFT + ALT" },
    { mask: 12, label: "CTRL + ALT" },
    { mask: 13, label: "SHIFT + CTRL + ALT" },
    { mask: 1, label: "SHIFT" },
    { mask: 4, label: "CTRL" },
    { mask: 5, label: "SHIFT + CTRL" }
  ]

  function reload() {
    if (!helper || readProcess.running || writeProcess.running || writePending)
      return
    readProcess.startSerial = writeSerial
    readProcess.command = [helper, "read"]
    readProcess.running = true
  }

  function apply(raw) {
    var value = {}
    var text = String(raw || "")
    error = ""
    if (Settings.isOversized(text)) {
      error = "Settings file is too large; defaults are active."
    } else if (text.trim()) {
      try { value = JSON.parse(text) }
      catch (exception) { error = "Settings file is invalid; defaults are active." }
    }
    var normalized = Settings.normalize(Settings.migrate(value))
    delayMs = normalized.delayMs
    enabledMasks = normalized.enabledMasks
    compact = normalized.compact
    dimPercent = normalized.dimPercent
    loaded = true
  }

  function save() {
    if (!helper) {
      error = "Settings cannot be saved; the plugin directory is unavailable."
      return
    }
    writeSerial += 1
    if (writeProcess.running) {
      writePending = true
      return
    }
    startWrite()
  }

  function startWrite() {
    writeProcess.command = [helper, "write", String(delayMs), enabledMasks.join(","),
      compact ? "true" : "false", String(dimPercent)]
    writeProcess.running = true
  }

  function setDelay(value) {
    delayMs = Settings.normalize({ delayMs: value, enabledMasks: enabledMasks }).delayMs
    save()
  }

  function setDim(value) {
    dimPercent = Settings.normalize({ dimPercent: value }).dimPercent
    save()
  }

  function setCompact(value) {
    compact = value === true
    save()
  }

  function setMask(mask, enabled) {
    enabledMasks = Settings.toggleMask(enabledMasks, mask, enabled)
    save()
  }

  function selectAll() { enabledMasks = Settings.KNOWN_MASKS.slice(); save() }
  function clearAll() { enabledMasks = []; save() }
  function maskEnabled(mask) { return Settings.maskEnabled(enabledMasks, mask) }

  property Process readProcess: Process {
    property int startSerial: 0
    command: []
    running: false
    stdout: StdioCollector { id: readStdout; waitForEnd: true }
    stderr: StdioCollector { id: readStderr; waitForEnd: true }

    onExited: function(exitCode) {
      if (startSerial !== root.writeSerial) return
      if (exitCode !== 0) {
        console.warn("negentropic.which-key: settings could not be read:",
          Model.clampMessage(readStderr.text))
        root.apply("")
        root.error = "Settings file could not be read; defaults are active."
        return
      }
      root.apply(readStdout.text)
    }
  }

  property Process writeProcess: Process {
    command: []
    running: false
    stderr: StdioCollector { id: writeStderr; waitForEnd: true }

    onExited: function(exitCode) {
      if (exitCode !== 0) {
        console.warn("negentropic.which-key: settings could not be saved:",
          Model.clampMessage(writeStderr.text))
        root.error = "Settings could not be saved."
      }
      if (root.writePending) {
        root.writePending = false
        Qt.callLater(function() { root.startWrite() })
      }
    }
  }

  onSourceDirChanged: reload()
  Component.onCompleted: reload()
}
