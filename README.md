# Which Key (negentropic fork)

A personal fork of [huacnlee/omarchy-which-key](https://github.com/huacnlee/omarchy-which-key)
(MIT, see `LICENSE`). Hold **Super** to see a guide of the live Hyprland
keybindings for the held modifier combination; add Shift, Ctrl, or Alt to
narrow it. Release Super to close it.

## Changes from upstream

- Shows every shortcut for a combination, laid out in columns of up to 16
  rows (upstream caps the guide at 20 rows in a single column).
- Also prompts for shortcuts without Super: hold Alt, Shift+Alt, Ctrl+Alt or
  Shift+Ctrl+Alt (Shift, Ctrl and Shift+Ctrl alone can be switched on in the
  widget settings). These open after at least 500 ms so quick shortcuts like
  Ctrl+C never flash the guide.
- Readable key labels (`/`, `,`, `` ` ``, `Print`, `Scroll ↓`, `Vol +`,
  `Left Mouse`), long descriptions wrapped instead of cut off, and several
  actions on one key merged into one row.
- Rows sorted into headed sections (Apps, Windows, Workspaces, Displays,
  Media & devices, Capture, Notifications, Clipboard, System) by the words in
  their descriptions; anything unmatched counts as an app launcher. Headers
  may stretch a column a little past 16 lines rather than add a column.
- Compact rows: keys that differ only by a number, direction or opposite word
  share one row (`1–0  Switch to workspace`, `← → ↑ ↓  Focus window`,
  `- =  Expand/shrink window left`, `Vol ±  Volume up/down`). Turn off
  **Compact rows** in the widget settings to list every key.

## Enable

Lives at `~/.config/omarchy/plugins/negentropic.which-key`. Enable it with
`omarchy plugin enable negentropic.which-key`, then turn on **Enabled** in the
Which Key bar widget settings (or run `scripts/enable-integration`), which adds
a marked block to `~/.config/hypr/bindings.lua` and links
`~/.local/bin/which-key-trigger`. `scripts/disable-integration` removes both.

Bindings without a Hyprland description are omitted.

## Tests

`make test`
