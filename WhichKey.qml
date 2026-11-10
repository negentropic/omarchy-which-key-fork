import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import Quickshell.Hyprland
import qs.Commons
import qs.Ui
import "components"
import "WhichKeyModel.js" as Model
import "WhichKeySettings.js" as Settings

Item {
  id: root

  property var shell: null
  property var manifest: null

  property bool opened: false
  property int generation: 0
  property int modifierMask: 0
  property var bindings: []
  property var viewModel: ({ title: "NONE", rows: [], columns: [] })
  property bool held: false
  property bool bindingsReady: false
  property bool loadStarted: false
  property bool revealDue: false
  property bool nonSuperDue: false
  property int pendingLoadGeneration: 0
  property int lastEventSequence: 0

  // Any of Super, Shift, Ctrl or Alt starts a chord the guide can describe.
  readonly property int modifierBits: 64 | 1 | 4 | 8

  WhichKeyConfig { id: config; sourceDir: root.sourceDir }
  Connections {
    target: config
    function onEnabledMasksChanged() { root.maybeReveal() }
    function onCompactChanged() { root.rebuildModel(); root.maybeReveal() }
  }

  // Resolve this component's own directory rather than reading
  // manifest.__sourceDir: Omarchy redacts internal manifest fields for
  // third-party plugins (shell.qml: publicPluginManifest drops __sourceDir,
  // __isFirstParty, __hostCapabilities) before handing the manifest to plugin
  // QML, so that field is always absent here and the bindings load below would
  // never start. widget.qml resolves its directory the same way.
  readonly property string sourceDir: localPath(Qt.resolvedUrl("."))

  function localPath(url) {
    var value = String(url || "")
    if (value.indexOf("file://") === 0) value = value.substring(7)
    try { return decodeURIComponent(value) } catch (error) { return value }
  }
  readonly property string focusedScreenName: Hyprland.focusedMonitor
    ? String(Hyprland.focusedMonitor.name) : ""

  function close() {
    opened = false
  }

  function beginChord() {
    held = true
    generation += 1
    opened = false
    bindingsReady = false
    loadStarted = false
    revealDue = false
    nonSuperDue = false
    bindings = []
    rebuildModel()
    revealTimer.restart()
    nonSuperTimer.restart()
  }

  function endChord() {
    held = false
    generation += 1
    revealTimer.stop()
    nonSuperTimer.stop()
    revealDue = false
    nonSuperDue = false
    bindingsReady = false
    loadStarted = false
    pendingLoadGeneration = 0
    if (bindingProcess.running) bindingProcess.running = false
    close()
  }

  // Loading spawns helper processes, so a chord without Super waits until it
  // has been held long enough to show anything: a quick Ctrl+C costs nothing.
  function ensureLoading() {
    if (!held || loadStarted) return
    if ((modifierMask & 64) === 0 && !nonSuperDue) return
    loadStarted = true
    // The bar widget owns a separate config instance and the file is no longer
    // watched, so the guide re-reads its settings as each chord starts.
    config.reload()
    requestBindings(generation)
  }

  function setModifiers(mask) {
    var numericMask = Number(mask)
    if (!isFinite(numericMask) || numericMask < 0) return
    modifierMask = Math.floor(numericMask)
    ensureLoading()
    rebuildModel()
    maybeReveal()
  }

  function acceptState(sequence, mask) {
    var nextSequence = Number(sequence)
    var nextMask = Number(mask)
    if (!isFinite(nextSequence) || !isFinite(nextMask)
        || nextSequence <= lastEventSequence) return
    lastEventSequence = nextSequence

    var shouldHold = (Math.floor(nextMask) & modifierBits) !== 0
    if (shouldHold && !held) {
      modifierMask = Math.floor(nextMask)
      beginChord()
    } else if (!shouldHold && held) {
      endChord()
    }
    setModifiers(nextMask)
  }

  function rebuildModel() {
    viewModel = Model.buildRows(bindings, modifierMask,
      { maxRowsPerColumn: 16, compact: config.compact })
  }

  function maybeReveal() {
    var withSuper = (modifierMask & 64) !== 0
    opened = held && revealDue && (withSuper || nonSuperDue)
      && config.maskEnabled(modifierMask) && bindingsReady
      && viewModel && ((viewModel.rows && viewModel.rows.length > 0)
        || (viewModel.branches && viewModel.branches.length > 0))
  }

  function requestBindings(requestGeneration) {
    if (!sourceDir) {
      console.warn("negentropic.which-key: plugin source directory is unavailable")
      return
    }

    if (bindingProcess.running) {
      pendingLoadGeneration = requestGeneration
      bindingProcess.running = false
      return
    }
    startBindingLoad(requestGeneration)
  }

  function startBindingLoad(requestGeneration) {
    bindingProcess.loadGeneration = requestGeneration
    bindingProcess.command = [sourceDir + "/scripts/which-key-bindings"]
    bindingProcess.running = true
  }

  function acceptBindingOutput(requestGeneration, output) {
    if (!Model.isCurrentGeneration(generation, requestGeneration) || !held)
      return

    var payload = String(output || "")
    if (Model.isPayloadTooLarge(payload)) {
      console.warn("negentropic.which-key: binding data is too large; ignoring it")
      return
    }

    var parsed
    try {
      parsed = JSON.parse(payload)
    } catch (error) {
      console.warn("negentropic.which-key: invalid binding data:", error)
      return
    }
    if (!Array.isArray(parsed)) return

    bindings = Model.limitBindings(parsed)
    bindingsReady = true
    rebuildModel()
    maybeReveal()
  }

  Timer {
    id: revealTimer
    interval: config.delayMs
    repeat: false
    onTriggered: {
      root.revealDue = true
      root.maybeReveal()
    }
  }

  // Chords without Super reveal (and load) only after a longer hold.
  Timer {
    id: nonSuperTimer
    interval: Math.max(config.delayMs, Settings.NON_SUPER_MIN_DELAY_MS)
    repeat: false
    onTriggered: {
      root.nonSuperDue = true
      root.ensureLoading()
      root.maybeReveal()
    }
  }

  Process {
    id: bindingProcess
    property int loadGeneration: 0
    command: []
    running: false
    stdout: StdioCollector { id: bindingStdout; waitForEnd: true }
    stderr: StdioCollector { id: bindingStderr; waitForEnd: true }

    onExited: function(exitCode, exitStatus) {
      var completedGeneration = loadGeneration
      var nextGeneration = root.pendingLoadGeneration
      root.pendingLoadGeneration = 0

      if (exitCode === 0)
        root.acceptBindingOutput(completedGeneration, bindingStdout.text)
      else if (Model.isCurrentGeneration(root.generation, completedGeneration)
          && root.held && nextGeneration === 0)
        console.warn("negentropic.which-key: binding load failed:",
          Model.clampMessage(bindingStderr.text))

      if (nextGeneration !== 0)
        Qt.callLater(function() { root.startBindingLoad(nextGeneration) })
    }
  }

  IpcHandler {
    target: "negentropic.which-key"

    // Only modifier changes arrive here. Running a shortcut leaves the guide
    // up so a held Super can drive several shortcuts before it closes.
    function state(sequence: int, mask: int): void {
      root.acceptState(sequence, mask)
    }
  }

  Variants {
    model: Quickshell.screens

    PanelWindow {
      id: overlay
      required property var modelData
      readonly property string screenName: modelData ? String(modelData.name) : ""

      screen: modelData
      visible: root.opened && screenName === root.focusedScreenName
      anchors { top: true; right: true; bottom: true; left: true }
      color: "transparent"
      exclusionMode: ExclusionMode.Ignore
      WlrLayershell.namespace: "negentropic-which-key"
      WlrLayershell.layer: WlrLayer.Overlay
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

      // The guide is visual only. An empty input region guarantees that the
      // held modifier and the next shortcut continue to reach the active app.
      mask: Region {}

      // Dims the rest of the display behind the guide in the theme's scrim
      // colour, at the strength chosen in settings. The empty input mask
      // above keeps it click-through.
      Rectangle {
        anchors.fill: parent
        color: Qt.rgba(Color.menu.scrim.r, Color.menu.scrim.g, Color.menu.scrim.b,
                       config.dimPercent / 100)
      }

      WhichKeyCard {
        anchors.centerIn: parent
        viewModel: root.viewModel
        availableWidth: overlay.width - Style.gapsOut * 2
      }
    }
  }
}
