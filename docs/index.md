# TotalMix FX Control — documentation

A Stream Deck plugin that puts TotalMix FX on keys and Stream Deck+ dials: faders, mute and solo, phantom power, snapshots, DURec, effects, dynamics and Room EQ, with everything drawn live from the mixer. Windows and macOS, one installer.

There are two families of actions. Pick the one that matches your TotalMix version — or set both up, they run side by side on separate Remote Controllers.

| | Global OSC actions "(TotalMix 2.1+)" | Classic actions |
|---|---|---|
| TotalMix FX | 2.1 and newer (beta at the time of writing) | 1.96 – 2.0 (also works on 2.1) |
| Channel addressing | Absolute — "input 3" is always input 3 | By position in the visible bank; can be pinned |
| Artwork | TotalMix look: fader strips, meters, knobs, buttons | The same TotalMix look, without meters |
| Snapshot state, DURec state | Yes | No — those keys light from their own presses |
| Where new features land | Here | Maintained, not extended |

## Contents

**Getting started**
- [Setup](setup.md) — TotalMix OSC settings for both protocols, ports, remote hosts, firewalls, defaults for new buttons
- [Dials and gestures](dials-and-gestures.md) — dB stepping, press and touch, nudge keys
- [Appearance](appearance.md) — the TotalMix look, the icon look, custom images

**Global OSC actions (TotalMix FX 2.1+)**
- [Volume](global-osc/volume.md) — faders, submix sends, pan, preamp gain
- [Toggle](global-osc/toggle.md) — on/off switches with state from the mixer
- [Trigger](global-osc/trigger.md) — snapshots, layouts, presets, undo/redo, DURec transport, window
- [Display](global-osc/display.md) — meters, device status, DSP load, DURec time
- [Effects & Dynamics](global-osc/effects.md) — EQ, low cut, dynamics, Auto Level, Room EQ, reverb, echo, list parameters and select keys

**Classic actions (TotalMix FX 1.96 – 2.0)**
- [Levels & Parameters](classic/levels.md)
- [Toggle](classic/toggle.md)
- [Select](classic/select.md)

**Reference**
- [Devices](devices.md) — gain ranges and reference-level lists per interface
- [Troubleshooting](troubleshooting.md) — logs, ports, empty lists, common questions
- [Changelog](changelog.md)

## Requirements

- An RME interface running TotalMix FX 1.96 or newer. The Global OSC actions need TotalMix FX 2.1.
- Stream Deck 6.9 or newer on Windows 10+ or macOS 13+.
- OSC enabled in TotalMix (see [Setup](setup.md)). No other software.

This is a private project, not affiliated with RME or Elgato. Issues and requests: [GitHub issues](https://github.com/shells-dw/streamdeck-totalmix/issues).
