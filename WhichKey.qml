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
  property int modifierMask: 0
  property var viewModel: ({ title: "NONE", rows: [], columns: [] })
  property bool held: false
  property bool chordPrepared: false
  property bool revealDue: false
  property bool nonSuperDue: false

  // The bindings are cached across chords: a quick Super+1 should not spawn
  // `hyprctl binds`. The cache is refreshed when Hyprland reloads its config,
  // and in the background on a chord once it is older than a minute, which
  // covers bindings changed at runtime without a reload.
  property var bindings: []
  property bool bindingsLoaded: false
  property bool bindingsStale: true
  property real bindingsLoadedAt: 0
  property bool reloadPending: false
  readonly property int bindingsMaxAgeMs: 60000

  // The active submap, from Hyprland's `submap` event; "" is the global map.
  property string currentSubmap: ""
  // Event time in ms times 1000 plus a per-event count (see install-bindings).
  // It passes 2^31 within an hour of boot, so it is a double, exact to 2^53.
  property real lastEventSequence: 0

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
    opened = false
    chordPrepared = false
    revealDue = false
    nonSuperDue = false
    rebuildModel()
    revealTimer.restart()
    nonSuperTimer.restart()
  }

  function endChord() {
    held = false
    revealTimer.stop()
    nonSuperTimer.stop()
    revealDue = false
    nonSuperDue = false
    chordPrepared = false
    close()
  }

  // Preparing spawns helper processes, so a chord without Super waits until it
  // has been held long enough to show anything: a quick Ctrl+C costs nothing.
  function ensureLoading() {
    if (!held || chordPrepared) return
    if ((modifierMask & 64) === 0 && !nonSuperDue) return
    chordPrepared = true
    // The bar widget owns a separate config instance and the file is no longer
    // watched, so the guide re-reads its settings as each chord starts.
    config.reload()
    if (!bindingsLoaded || bindingsStale
        || Date.now() - bindingsLoadedAt > bindingsMaxAgeMs)
      requestBindings()
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
        || Math.floor(nextSequence) !== nextSequence
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
      { maxRowsPerColumn: 16, compact: config.compact, submap: currentSubmap })
  }

  function maybeReveal() {
    var withSuper = (modifierMask & 64) !== 0
    opened = held && revealDue && (withSuper || nonSuperDue)
      && config.maskEnabled(modifierMask) && bindingsLoaded
      && viewModel && ((viewModel.rows && viewModel.rows.length > 0)
        || (viewModel.branches && viewModel.branches.length > 0))
  }

  // A request during a load is queued, not lost: the load in flight may
  // predate the config reload that asked for the new one.
  function requestBindings() {
    if (!sourceDir) {
      console.warn("negentropic.which-key: plugin source directory is unavailable")
      return
    }
    if (bindingProcess.running) {
      reloadPending = true
      return
    }
    startBindingLoad()
  }

  function startBindingLoad() {
    bindingsStale = false
    bindingProcess.command = [sourceDir + "/scripts/which-key-bindings"]
    bindingProcess.running = true
  }

  // A failed load keeps whatever was cached and marks it stale, so the next
  // chord tries again.
  function acceptBindingOutput(output) {
    var payload = String(output || "")
    if (Model.isPayloadTooLarge(payload)) {
      console.warn("negentropic.which-key: binding data is too large; ignoring it")
      bindingsStale = true
      return
    }

    var parsed
    try {
      parsed = JSON.parse(payload)
    } catch (error) {
      console.warn("negentropic.which-key: invalid binding data:", error)
      bindingsStale = true
      return
    }
    if (!Array.isArray(parsed)) {
      bindingsStale = true
      return
    }

    bindings = Model.limitBindings(parsed)
    bindingsLoaded = true
    bindingsLoadedAt = Date.now()
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
    command: []
    running: false
    stdout: StdioCollector { id: bindingStdout; waitForEnd: true }
    stderr: StdioCollector { id: bindingStderr; waitForEnd: true }

    onExited: function(exitCode, exitStatus) {
      if (exitCode === 0) {
        root.acceptBindingOutput(bindingStdout.text)
      } else {
        root.bindingsStale = true
        console.warn("negentropic.which-key: binding load failed:",
          Model.clampMessage(bindingStderr.text))
      }
      if (root.reloadPending) {
        root.reloadPending = false
        Qt.callLater(function() { root.startBindingLoad() })
      }
    }
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (event.name === "configreloaded") {
        root.bindingsStale = true
        root.requestBindings()
      } else if (event.name === "submap") {
        root.currentSubmap = String(event.data || "")
        root.rebuildModel()
        root.maybeReveal()
      }
    }
  }

  // Load ahead of the first chord, so even the first Super shows at once.
  Component.onCompleted: requestBindings()

  IpcHandler {
    target: "negentropic.which-key"

    // Only modifier changes arrive here. Running a shortcut leaves the guide
    // up so a held Super can drive several shortcuts before it closes. The
    // sequence is a string because it outgrows an IPC int (2^31).
    function state(sequence: string, mask: int): void {
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

      // Dims the rest of the display behind the guide with plain black (the
      // theme scrim is tinted, e.g. navy), at the strength chosen in
      // settings. The empty input mask above keeps it click-through.
      Rectangle {
        anchors.fill: parent
        color: Qt.rgba(0, 0, 0, config.dimPercent / 100)
      }

      // The card keeps its natural layout and is scaled down as a whole when
      // it would not fit the screen (a large layer, a small monitor or a big
      // font), so no column or row is ever cut off.
      WhichKeyCard {
        id: card
        anchors.centerIn: parent
        viewModel: root.viewModel
        scale: card.width > 0 && card.height > 0
          ? Math.min(1, (overlay.width - Style.gapsOut * 2) / card.width,
                        (overlay.height - Style.gapsOut * 2) / card.height)
          : 1
      }
    }
  }
}
