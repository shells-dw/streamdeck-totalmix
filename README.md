# TotalMix FX Control (unofficial Stream Deck plugin)

Control [RME TotalMix FX][] from your [Elgato Stream Deck][Stream Deck] on Windows and macOS. Faders, mute, solo, 48V, snapshots, DURec, EQ, dynamics, reverb and Room EQ on keys and Stream Deck+ dials, drawn live in the TotalMix look so the deck always shows what the mixer is doing.

Requires an RME interface running TotalMix FX.

![Stream Deck+ recording layout](/docs/images/v5_deck_plus.png)

## Features

- **TotalMix look**: fader strips with meters, knobs and M/S/48V buttons in the mixer's colours
- **Live feedback**: change something in TotalMix and the deck follows
- **Stream Deck+ dials**: turn for levels, press and touch for mute, solo, dim and more
- **Volume keys** for decks without dials
- **Channels by name**, with TotalMix's channel colours
- **Snapshots, DURec, talkback, dim and the control room**
- **EQ, dynamics, reverb, echo and Room EQ**, including EQ and dynamics curves
- **Windows and macOS**, one installer

## Requirements

- Stream Deck 6.9 or newer, Windows 10+ or macOS 13+
- TotalMix FX 2.1 with Global OSC for the full feature set (recommended)
- TotalMix FX 1.96–2.0 works with the classic actions

## Installation

Install *TotalMix FX Control* from the Elgato Marketplace in the Stream Deck app, or download the plugin file from the [latest release](https://github.com/shells-dw/streamdeck-totalmix/releases/latest) and open it.

## Setup

In TotalMix, open *Options → Settings… → OSC*:

| Actions | Remote Controller | Mode | Ports in / out |
|---|---|---|---|
| "(TotalMix 2.1+)", recommended | 2 | Global OSC | 7002 / 9002 |
| Classic | 1 | classic | 7001 / 9001 |

Tick *In Use* and set the Remote Controller Address to `127.0.0.1`. For Global OSC, enable *Send changes* and *Send status* under *Details*, and *Send Level Messages* for meters. Then tick *Enable OSC Control* in the Options menu. Remote hosts and other ports: [setup guide](https://shells-dw.github.io/streamdeck-totalmix/setup.html).

## Actions

| Action | Where | What it does |
|---|---|---|
| Volume (TotalMix 2.1+) | Key or dial | Channel faders, submix sends, pan, preamp gain, Main Out, Speaker B, Phones |
| Toggle (TotalMix 2.1+) | Key | Mute, solo, 48V, phase, EQ, dynamics, control room, groups and more |
| Trigger (TotalMix 2.1+) | Key | Snapshots, presets, DURec, undo/redo, clear solos and mutes |
| Display (TotalMix 2.1+) | Key or dial | Meters, DURec time, DSP load, EQ and dynamics curves |
| FX & Dynamics (TotalMix 2.1+) | Key or dial | Reverb, echo, EQ, low cut, dynamics, Auto Level, Room EQ |
| Levels & Parameters (classic) | Key or dial | Levels, gain, pan and effect parameters |
| Toggle (classic) | Key | Mute, solo, phantom, control room and channel switches |
| Select (classic) | Key | Submixes, banks, snapshots, Quick Workspaces |

## Coming from v3

- Buttons don't carry over; add them again.
- v3 and v5 both use Remote Controllers 1 and 2. To run both, move one to controller 3 or 4, or uninstall v3.
- MIDI is gone. If you need it, stay on v3.3.5.

## Documentation

Everything else is in the [documentation](https://shells-dw.github.io/streamdeck-totalmix/): every action's settings, dials and gestures, devices, troubleshooting and the [changelog](https://shells-dw.github.io/streamdeck-totalmix/changelog.html).

![Stream Deck XL layout](/docs/images/v5_deck_xl.png)

## Issues and feature requests

Open a [GitHub issue][GitHub issues] and attach the plugin logs:

- Windows: `%APPDATA%\Elgato\StreamDeck\Plugins\de.shells.totalmixgen2.sdPlugin\logs`
- macOS: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/de.shells.totalmixgen2.sdPlugin/logs`

## Support

If you'd like to drop me a coffee for the hours I've spent on this: [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/dwshells) [!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/dwshells)

## Disclaimer

This is a private project, I am not affiliated with RME or Elgato.

<!-- Reference Links -->

[Stream Deck]: https://www.elgato.com/gaming/stream-deck/ "Elgato's Stream Deck product page"
[RME TotalMix FX]: https://www.rme-audio.de/totalmix-fx.html "RME's TotalMix FX product page"
[GitHub issues]: https://github.com/shells-dw/streamdeck-totalmix/issues "GitHub issues link"
