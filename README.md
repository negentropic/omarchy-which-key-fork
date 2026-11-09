# Which Key (negentropic fork)

A personal fork of [huacnlee/omarchy-which-key](https://github.com/huacnlee/omarchy-which-key)
(MIT, see `LICENSE`). Hold **Super** to see a guide of the live Hyprland
keybindings for the held modifier combination; add Shift, Ctrl, or Alt to
narrow it. Release Super to close it.

## Changes from upstream

- Shows every shortcut for a combination, laid out in columns of up to 16
  rows (upstream caps the guide at 20 rows in a single column).

## Enable

Lives at `~/.config/omarchy/plugins/negentropic.which-key`. Enable it with
`omarchy plugin enable negentropic.which-key`, then turn on **Enabled** in the
Which Key bar widget settings (or run `scripts/enable-integration`), which adds
a marked block to `~/.config/hypr/bindings.lua` and links
`~/.local/bin/which-key-trigger`. `scripts/disable-integration` removes both.

Bindings without a Hyprland description are omitted.

## Tests

`make test`
