![GitHub](https://img.shields.io/github/license/shells-dw/streamdeck-totalmix)     ![GitHub last commit](https://img.shields.io/github/last-commit/shells-dw/streamdeck-totalmix)/ [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/dwshells) [!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/dwshells)


# TotalMix FX Control — Stream Deck plugin (unofficial)

## What Is This (and what does it do?)

It's a plugin for the [Elgato Stream Deck][Stream Deck] on Windows **and MacOS** that puts [RME TotalMix FX][] on your keys and dials: faders, mute, solo, phantom power, snapshots, DURec, effects, dynamics, Room EQ and more, with everything drawn live from the mixer so the deck always shows what TotalMix is doing. Note: an RME audio interface/card is needed for TotalMix FX to work.

![Stream Deck+ recording layout](/docs/images/v5_deck_plus.png)

## What's new since v3

This is the first release after v3.3.5 that most people will see, so a lot of featuers and functionality will be new to you. The v4 line (a full rewrite) was published in quick succession over the last days; v5 builds the TotalMix look on top of it and will be the release version. In short:

### New in v5

- **Looks similar TotalMix.** Every key and Stream Deck+ display — Global OSC and classic alike — is drawn live in the familiar colours: fader strips with RME's scale and a peak meter, knobs with section-coloured arcs, dropdown boxes for lists, and the familiar blue M / orange S / red 48V buttons. Nothing to configure; an **Appearance** setting brings the plain icons from the previous versions back if you prefer them.
- **Global OSC first.** The five "(TotalMix 2.1+)" actions are where things (finally) shift to: absolute channel numbers, real state feedback, meters, snapshots that light while loaded. The classic actions for TotalMix FX 1.96–2.0 are still included and still work, but new features land on Global OSC. _(I'm frankly quite tired of dealing with the old context sensitive approach.)_
- **Select instead of step.** A key can write one specific entry of a list (reverb type, reference level, crossfeed, EQ band type, low cut slope, echo type) and light while that entry is active — with a second-press action of your choice, so one key can be a preset, a two-way toggle or an on/off switch.

### New since v3 (the v4 line)

- **Complete rewrite** — TypeScript on Elgato's Node SDK instead of C#/.NET; zero runtime dependencies beyond the Stream Deck SDK, one persistent OSC connection, no polling and near-zero CPU
- **Runs on macOS** — one installer for Windows and Mac
- **Stream Deck+ dials** — turn to set levels, with channel name, live readout and position on the display; **press and touch assignable** per dial (mute, solo, cue, phantom, dim, mono, talkback, speaker B, external input, mute FX return, recall, global mute/solo, set to −∞, set to 0 dB, centre the pan, bypass or reset an effect, or nothing)
- **Volume buttons for decks without dials** — each press nudges up or down by a set amount; place a `+` and `−` pair for a volume rocker
- **dB-accurate stepping** — follows RME's fader curve, so every step moves the same amount anywhere on the throw
- **Live two-way feedback** — change something in TotalMix and your buttons update instantly; mute and solo show on the dial display
- **Pick channels by name** — "1 · Mic 1", read live from your interface
- **Input gain on a dial** — per channel, stereo pairs linked, with per-device gain ranges
- **Pan on a dial** — with TotalMix's `L50 / C / R50` readout and a tap to centre
- **Effects control** — reverb, echo, low cut, EQ, dynamics and Auto Level parameters on dials; press to switch the section on or off
- **Room EQ** per output channel: enable toggle, plus volume correction, delay, and gain/frequency/Q of all 9 bands (filter type on bands 1, 8, 9)
- **Jump straight to submixes, snapshots, buses and Quick Workspaces**
- **TotalMix FX 2.0 compatible** (and 1.96+); **simpler setup** — one OSC controller, no config file
- **TotalMix FX 2.1 "Global OSC" support** — five additional actions (Volume, Toggle, Trigger, Display, Effects & Dynamics) with absolute channel addressing: a button means "input 3", not "the third fader of whatever bank is shown". Snapshots with a real active-state light, DURec transport, layouts, presets, undo/redo, device status and DSP load
- **Defaults for new buttons** — host, ports and dB-per-step set once, copied into every button you add; stored in Stream Deck, so they survive updates

> [!NOTE]
> Global OSC needs TotalMix FX 2.1, which is in beta at the time of writing. The protocol is marked beta by RME and may change with any release.

## Release / Installation

Inside the GitHub Release you can find the precompiled plugin. Download and open it, your computer should already recognize this as a StreamDeck file and offer to open it with StreamDeck - which will have the plugin available in the list then.

Requires Stream Deck 6.9 or newer on Windows 10+ or macOS 13+.

I highly encourage you to use TotalMix 2.1 with Global OSC even if it's in Beta still, as only this will give you the full new feature set: absolute channel numbers, snapshot and DURec state, and meters that always follow the channel. The classic actions get the same TotalMix look (without meters), but the classic protocol only reports what the mixer window currently shows.

## Coming from v3

**Your existing buttons will not carry over.** What used to be many separate actions is now three classic actions plus five for TotalMix FX 2.1's Global OSC, so buttons must be re-added. Your settings, ports and icons are otherwise familiar.

It's a different plugin with different UUID so it **will** run alongside your existing plugin, **however** they can't both point to the same OSC controllers. v3 uses Remote Controllers 1 and 2, and so does this one, so the two collide completely. If you want both active at the same time, you must move one of them to a formerly unused OSC controller (TotalMix has four; 3 and 4 are the usual spares). Otherwise uninstall the old plugin!

MIDI support has been removed. OSC does everything the MIDI actions did and reports state back, which MIDI cannot. If you depend on MIDI, stay on v3.3.5.

The de.shells.totalmix.exe.config file is gone. Connection settings now live under Connection in each button's settings.

## Coming from a v4 pre-release

If you picked up one of the v4 builds: buttons carry over. Keys and dials switch to the TotalMix look on their own; if you'd rather keep the old artwork on a button, set its **Appearance** to "Icon". If you want meters on the fader strips, enable "Send Level Messages" on the Global OSC controller (see below) without or without "Peak Hold", that depends on your preferences.

## Setup for OSC

Open **Options → Settings… → OSC** in TotalMix and set up the Remote Controller for the actions you use:

| | Remote Controller | Mode | Ports incoming / outgoing |
|---|---|---|---|
| "(TotalMix 2.1+)" actions — recommended | 2 | **Global OSC** | 7002 / 9002 |
| Classic actions | 1 | classic | 7001 / 9001 |

Tick *In Use*, enter `127.0.0.1` as the Remote Controller Address, and for Global OSC enable *Send changes* and *Send status* under *Details*. *Send Level Messages* is optional on the Global OSC controller: on, the fader strips get meters. Leave it off on controller 1; the classic actions don't use it. Then tick *Enable OSC Control* in the Options menu and allow the firewall prompts. Different ports, a remote host, or both plugins side by side: see the [setup guide](https://shells-dw.github.io/streamdeck-totalmix/setup.html).

**No additional software is needed.**

## Actions

| Action | Where | What it does |
|---|---|---|
| **Volume (TotalMix 2.1+)** | Key or dial | Global OSC: channel fader, submix send, channel or send pan, or preamp gain, addressed by absolute channel number. Rotate to adjust; press and touch are assignable. Keys nudge up or down per press. |
| **Toggle (TotalMix 2.1+)** | Key | Global OSC: mute, PFL, phase (L/R), 48V, pad, instrument, AutoSet, M/S, loopback, stereo link, record, low cut, EQ, dynamics, Auto Level, Room EQ; control room (dim, mono, talkback, external input, speaker B, mute FX return, link Main/Speaker B); global mute/solo enable; reverb, echo; mute/solo/fader groups. |
| **Trigger (TotalMix 2.1+)** | Key | Global OSC: load snapshots (key lights while active), layout presets, EQ/dynamics/Room EQ presets per channel and reverb/echo presets by number, undo/redo, recall, DURec transport, show/hide the TotalMix window. |
| **Display (TotalMix 2.1+)** | Key or dial | Global OSC, read-only: device name, connection, DSP load, DURec time and state, channel peak level. Updates on its own; press to force a refresh. |
| **Effects & Dynamics (TotalMix 2.1+)** | Key or dial | Global OSC: reverb, echo, EQ, low cut, dynamics, Auto Level, width, crossfeed, delay, reference level and Room EQ (volume correction, delay, all 9 bands), addressed by absolute channel number. Rotate to adjust; press and touch are assignable. Keys nudge, or select one entry of a list directly. |
| **Levels & Parameters** (classic) | Key or dial | Main / Control Room volume, a strip in the current bank, the selected channel, pan, input preamp gain, or an FX, EQ, dynamics, Auto Level or Room EQ parameter. |
| **Toggle** (classic) | Key | Control room, global mute/solo enable, trim mode; per strip in the current bank: mute, solo, phantom, cue; per channel: mute, solo, phantom, EQ, low cut, dynamics, Auto Level, stereo/mono, phase, instrument, pad, M/S, AutoSet, loopback, talkback include, trim exclude, record enable; DURec; groups, snapshots, reverb, echo, Room EQ. |
| **Select** (classic) | Key | Jump to a submix, bank start, channel offset, bus, snapshot or Quick Workspace, or step through tracks and banks. |

The classic actions keep working and share the TotalMix look; both protocols run in parallel on separate TotalMix Remote Controllers.

## Documentation

Everything else — every action's settings, dials and gestures, the TotalMix look, device tables and troubleshooting — lives in the **[documentation](https://shells-dw.github.io/streamdeck-totalmix/)**.

- [Setup](https://shells-dw.github.io/streamdeck-totalmix/setup.html) · [Dials and gestures](https://shells-dw.github.io/streamdeck-totalmix/dials-and-gestures.html) · [Appearance](https://shells-dw.github.io/streamdeck-totalmix/appearance.html)
- Global OSC: [Volume](https://shells-dw.github.io/streamdeck-totalmix/global-osc/volume.html) · [Toggle](https://shells-dw.github.io/streamdeck-totalmix/global-osc/toggle.html) · [Trigger](https://shells-dw.github.io/streamdeck-totalmix/global-osc/trigger.html) · [Display](https://shells-dw.github.io/streamdeck-totalmix/global-osc/display.html) · [Effects & Dynamics](https://shells-dw.github.io/streamdeck-totalmix/global-osc/effects.html)
- Classic: [Levels & Parameters](https://shells-dw.github.io/streamdeck-totalmix/classic/levels.html) · [Toggle](https://shells-dw.github.io/streamdeck-totalmix/classic/toggle.html) · [Select](https://shells-dw.github.io/streamdeck-totalmix/classic/select.html)
- [Devices](https://shells-dw.github.io/streamdeck-totalmix/devices.html) · [Troubleshooting](https://shells-dw.github.io/streamdeck-totalmix/troubleshooting.html) · [Changelog](https://shells-dw.github.io/streamdeck-totalmix/changelog.html)

## A recording layout example

The layout at the top of this page is a Stream Deck+ set up for a single-mic session: 48V and mute on the mic, two snapshots (say "Recording" and "Mixing"), DURec record and stop, talkback and dim; on the dials, mic gain, the mic's fader into Main, the phones level and the main out. On a Stream Deck+ XL there's room for the effect chain as well, with the six dials on levels and the DURec clock:

![Stream Deck XL layout](/docs/images/v5_deck_xl.png)

# I have an issue or miss a feature?

You can submit an issue or request a feature with [GitHub issues]. Please describe as good as possible what went wrong and also include any log files as they are incredibly helpful for me to figure out what went wrong. Logs can be found in `%APPDATA%\Elgato\StreamDeck\Plugins\de.shells.totalmixgen2.sdPlugin\logs` on Windows and `~/Library/Application Support/com.elgato.StreamDeck/Plugins/de.shells.totalmixgen2.sdPlugin/logs` on macOS.

# Contribute

If you're interested in using this plugin but something you really need is missing, let me know. I naturally don't have access to all RME devices, so I can't really try things on the boxes themselves, but eventually we might find a way to work something out.

# Support

If you'd like to drop me a coffee for the hours I've spent on this: [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/dwshells) [!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/dwshells)

# Disclaimer

This is a private project, I am not affiliated with RME or Elgato. I wrote this plugin out of personal interest.

<!-- Reference Links -->

[Stream Deck]: https://www.elgato.com/gaming/stream-deck/ "Elgato's Stream Deck product page"
[RME TotalMix FX]: https://www.rme-audio.de/totalmix-fx.html "RME's TotalmMix FX product page"
[RME ARC USB]: https://www.rme-audio.de/arc-usb.html "RME's ARC USB product page"
[virtualMidi]: https://www.tobias-erichsen.de/software/virtualmidi.html "virtualMIDI product page"
[loopBe]: https://www.nerds.de/en/loopbe1.html "loopBe product page"
[GitHub issues]: https://github.com/shells-dw/streamdeck-totalmix/issues "GitHub issues link"