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

This is a private project, I am not affiliated with RME or Elgato.


# Changelog
## [5.0.0] - 2026-08-29
### Added
- I couldn't be bothered to maintain a private dev repo and the v4 repo, so I finally combined both for the release version.
- TotalMix-ish look for every action, Global OSC and classic. Keys and Stream Deck+ displays are drawn live similar to the mixer's own colours: fader strips with the RME scale, meter and M/S state, knobs with section-coloured arcs, dropdown boxes for list parameters, and TotalMix-style buttons for switches and triggers. Each action has an **Appearance** setting; "Icon" restores the previous artwork.
- Peak meters on fader strips (Global OSC) — the meter well fills from `/level` when "Send Level Messages" is enabled on the Global OSC controller; clipping turns it red.
- Direct entry selection on keys. For list parameters (EQ and Room EQ band type, low cut slope, crossfeed, reference level, reverb and echo type) a key can write a chosen entry instead of stepping: **On press → Select an entry**, then pick the **Entry** and what a **Second press** does while the key is lit (nothing, back to the previous entry, or switch to another entry). Keys light while their entry is active.
- Named lists for low cut slope, crossfeed, reverb type and echo type, so dials stop at the end of the list and show the entry name instead of a number. Reference levels come from a per-device table keyed on the interface TotalMix reports, separately for inputs and outputs.
- Peak-hold line on the fader-strip meters and the Display meter: held for 1.5 s, then falling at 12 dB/s.
- Display panels: meter with peak hold, device name, connection state, DSP gauge, DURec clock and transport symbol.
- Trigger keys for DURec transport, undo/redo and show/hide use drawn symbols; snapshots and layouts show their number.
- The classic actions (Levels & Parameters, Toggle, Select) share the TotalMix look: fader strips (no meter — the classic protocol only reports the visible bank), knobs and dropdown boxes for effect parameters using TotalMix's own readout strings, and TotalMix-style buttons. Each has an Appearance setting.

### Changed
- Renamed to **TotalMix FX Control** (plugin name and action-list category; the plugin UUID is unchanged, so existing buttons stay).
- Version 5: the Global OSC actions are the primary feature set; the classic actions remain included and unchanged.
- Channel lists reload on their own when the bus, target, parameter or mode they depend on changes; the entry lists of a select key follow the bus too.
- Crossfeed is a list parameter (Off, 1–5). Crossfeed and delay are output-only, width input/playback-only, reference level input/output-only; the bus picker only offers what applies.
- A device name with a unit index ("Fireface UCX II (1)") is recognised.

### Known limits
- Reference level lists are sourced from RME's manuals for the UCX II, UFX III, UC and UFX; the other entries follow their generation's naming and list order and haven't been checked against a unit. Channels with a shorter list than their bus (UFX III's TRS outputs lack the XLR-only +24 dBu) are clamped by TotalMix, not the plugin. An interface not in the table shows plain numbers.
- Knob arcs use display ranges for parameters whose span RME's table does not publish. A wrong span only affects how far the arc fills, never the value written.

## [4.5.0] - 2026-08-28
### Fixed
- A TotalMix restart is detected on any packet after a silence, not only when the first packet is a bare heartbeat, and the classic connection now clears its cached views so buttons re-read their state instead of showing pre-restart values.
- The classic connection's background rotation over pinned channels could queue the same channel visit repeatedly; visits are now queued once.
- Level meter addresses on page 1 are cached per bus and bank like the other strip parameters.
- Generally the whole FX controls since I now got my hands on an interface that actually supports these (yay!).
- SO MUCH MORE.

### Changed
- The classic volume action appears as "Levels & Parameters" in the action list. Same UUID, existing buttons unaffected.
- Global OSC inbound changes and dial writes are logged at debug level; a full /sendall on a large interface produced thousands of info lines per refresh.

## [4.4.0] - 2026-08-27
### Added
- Assignable dial gestures. A Stream Deck+ dial's press and its touch-strip tap can each be bound independently, under **On press** and **On touch**.
- Mute and solo state on the dial display. A muted channel's background turns blue, a soloed one orange. A fader parked at −∞ counts as muted.
- Pan on a dial, as two new targets: **Pan (channel)** and **Pan (strip in current bank)**. Steps 1% of the throw per detent — two of TotalMix's units — snapped to the grid so turning back from either side lands exactly on centre. Displays TotalMix's own `L50 / C / R50` notation.
- A mute for the main out. The press drops the fader to −∞ and remembers the level, restoring it on the next press. The restore point is refreshed from every level TotalMix reports, not only from the gesture, so a fader already down when the plugin starts still has somewhere to come back to. Dim moves to the touch tap.
- Assignable gestures on the Global OSC volume dial too, with its own vocabulary: no cue, since the protocol's channel section carries none, and a mix node defaults its press to solo because a send has no mute of its own. Balance is available as its own targets (channel and submix send) with a tap to centre.
- The background color applies to **Volume (TotalMix 2.1+)** dials too.

### Changed
- The Volume action is now **Volume & Pan**, reflecting that it already covered preamp gain and ten FX parameters as well as faders.

### Known limits
- Per-strip Solo/PFL is inputs and playbacks only, per RME's OSC table, and since 1.96 TotalMix re-sends 0 for parameters that don't apply to the current bus.

## [4.3.5] - 2026-08-27
### Changed
- Plugin UUID changed again, sorry for that.

## [4.3.4] - 2026-08-27
### Added
- Device selection for the classic input gain dial. dB stepping needs the preamp's gain range, which the classic OSC protocol doesn't transmit, so the button settings now offer a list of RME interfaces with their gain spans. Unset or unrecognized devices fall back to the usual 65 dB span. The displayed value is always TotalMix's own readout, so it stays correct regardless of the setting.
- The Global OSC connection reads the device name from the interface and uses it to scale the gain dial's position bar.
- Gain readouts now carry their unit ("60 dB" instead of "60"), passing through whatever unit TotalMix reports.
### Fixed
- Global OSC status data (device name, connection state, DSP load, DURec time and state) now arrives on its own. The refresh cycle only ever requested the mix and channel parameters, which don't include the status block, so a Display key stayed blank until pressed once; the status request is now part of every refresh.
- A failed port bind (port already taken) left the connection setup unfinished. Bind failures are now handled and logged, with a dedicated "port already in use" message naming the affected port.
- Two connections could silently bind the same receive port. Port collisions now fail with a log message saying which port to change. If you see a new "port in use" error after updating, your classic and Global OSC slots probably share a receive port.
- Level meter and DSP load updates no longer flood the log file. They are still received and displayed as before, just not logged on every change.
### Changed
- Documentation pass: comments rewritten for accuracy and several doc blocks reattached to the declarations they actually describe. No functional changes.

## [4.3.1] - 2026-08-26
### Changed
- Naming/Branding; remove "RME" for compliance.

## [4.3.0] - 2026-08-24
### Added
- Defaults for new buttons. Host, ports and dB-per-step can be set once and are copied into each button as it is added, instead of being retyped per button. Stored in Stream Deck's global settings, so they survive plugin updates.

## [4.2.1] - 2026-08-22
### Changed
- New plugin UUID — this now installs and runs alongside the v3 plugin instead of replacing it. Buttons from the old plugin do not carry over. **NOTE:** both plugins cannot use the same OSC controllers — see [Coming from v3](#coming-from-v3).
- Renamed to "TotalMix FX Gen2", in both the plugin name and the action-list category, to tell the two apart.
- Requires Stream Deck 6.9 or newer (was 6.6). Moved to SDK version 3 for DRM protection: file encryption and integrity checking.
- Author field now reads "shellsdw".
### Added
- Individual action-list icons for all seven actions, replacing the single shared icon. The four "(TotalMix 2.1+)" actions carry a marker dot so they read as variants of their classic counterparts.
### Fixed
- Plugin icon was 72×72 and is now supplied at the required 256×256 and 512×512.

## [4.2.0] - 2026-08-21
### Added
- Support for TotalMix FX 2.1's new "Global OSC" protocol, as four additional   actions running alongside the classic ones: Volume, Toggle, Trigger and Display "(TotalMix 2.1+)".
- Snapshot keys with a true active-state light (green while loaded), driven by TotalMix's snapshot state signalling.
- DURec transport with state-driven lights, layout presets, undo/redo, recall, show/hide window.
- Read-only Display action: device name, connection, DSP load, DURec time and state; peak level meters are implemented and waiting for the beta to start transmitting them.
- Input/playback fader dials with a per-submix picker ("Main Out (auto)" by default), matching how these levels actually exist on the mix matrix.

## [4.0.0] - 2026-08-20
Complete rewrite. TypeScript on Elgato's Node SDK, replacing the C#/.NET plugin.
 
### Added
- macOS support. One installer covers Windows 10+ and macOS 13+.
- Stream Deck+ dial support for volume, input gain and effects. Display shows channel name, TotalMix's own readout and a position bar.
- Volume nudge on regular keys — each press raises or lowers by a configurable step, so a `+`/`−` pair works as a volume rocker on decks without dials.
- Input gain (preamp) control per input channel, including linked stereo pairs.
- Effects control: reverb send, return, volume, time, pre-delay, width; echo volume, delay, feedback; low cut frequency. Press to bypass.
- Room EQ per output channel: enable toggle and all band parameters, volume correction and delay (TotalMix FX 1.96+; also via Global OSC on 2.1+).
- Direct selection of submixes, snapshots, buses, channels and Quick Workspaces (1–30) — no more stepping through banks.
- Channel picker now lists actual TotalMix channel names, read live from the interface.
- Bus and bank pinning, so a button keeps controlling the same channel regardless of where you navigate in the mixer.
- Every key press and connection event is logged, for easier issue reports.
### Improved/Changed
- Volume steps in dB along RME's published fader curve. Previously a step moved roughly 4× further in dB at the bottom of the throw than at the top.
- One persistent OSC connection replaces the per-query socket open/close cycle and the constant polling. No background CPU load when idle.
- Live state mirroring is now push-based, so buttons reflect TotalMix GUI changes immediately.
- Only one OSC Remote Controller is required now, not two. Controller 2 is free for other use.
- Actions consolidated: one Volume, one Toggle, one Select action replace the previous per-function actions.
- Compatible with TotalMix FX 2.0 as well as 1.96+, in either compatibility mode.
- Zero runtime dependencies beyond the Stream Deck SDK. OSC is handled by an in-house codec.
- Every OSC address the plugin can send is validated against RME's official OSC table in the test suite.
### Fixed
- Per-strip mute, solo, phantom and cue could only ever switch on, never off. These are on/off parameters in RME's spec, not toggles, and were being sent as toggles.
- Main volume did not work at all — the address used did not exist.
- Changing a button's function in the property inspector did not take effect until the button reappeared; it kept acting on the previously selected parameter.
### Removed
- **MIDI actions.** OSC covers everything they did and reports state back, which MIDI cannot. Stay on 3.3.5 if you need MIDI.
- **`de.shells.totalmix.exe.config`.** Connection settings are per button, under "Connection".
### Upgrading
Existing buttons will not carry over and need to be re-added, as the actions have been consolidated. Ports and icons are unchanged.


<details><summary>Change History</summary><p>

## [3.3.5] - 2023-03-28
### Fixed
- Remote OSC instances (on another host) are working now. Please refer to the corresponding documentation, thanks for @roguedarkjedi for pointing that out and making a PR (I did not merge in the end, sorry), I totally forgot about that.
### Improved/Changed
- Various minor changes I came across over time, all under the hood, nothing UI facing.
- Added documentation for remote host config.

## [3.3.4] - 2023-01-15
### Added
- Config flag "killAndRestartOnStuck" (default off) which does exactly that (or tries to at least) and should resolve the issue with TotalMix not responding to OSC requests after the PC went to sleep (which is not an issue of this plugin, but TotalMix) or for other reasons.
Note that there's a snag to it (as with everything concerning TotalMix :roll_eyes:) - TotalMix stores everything you set, do, toggle, or otherwise interact with the UI in a config file, however it does this only when it exits gracefully. When it's killed, nothing is saved. Brilliant, isn't it.
That means that if the plugin kills TotalMix and restarts it, to reenable the OSC servers, changes you made during the runtime of the TotalMix UI will not have been saved. Keep that in mind.

### Improved
- Readme now has a more detailed explanation about the config parameters hidden behind a dropdown in the respective section.
## [3.3.3] - 2023-01-14
### Added/Improved
- Added a check for the background mirroring task if the OSC listener is still active or not after the plugin has successfully started, preventing an infinite loop that would occur otherwise. Now, the mirroring task will stop until the background OSC listener is available again, then resume (and the icons will flash briefly to let the user know something's up).

## [3.3.2] - 2023-01-14
### Fixed
- Toggle Channel Function would display the wrong icon when mirroring is willingly disabled in the config
## [3.3.1] - 2023-01-12
### Fixed
- PI bug that could lead to channel selection reverting back to Input channel 1 without reflecting that on the UI if function was selected shortly after channel, hence rendering button functions ending up acting on the wrong channel
## [3.3.0] - 2023-01-11
### Added
- Control Channel now has the option to incrementally lower or raise volume levels (including the option to set a multiplier for the step size)
- Trigger Global Function now has the option to incrementally lower or raise Main volume levels
## [3.2.3] - 2022-12-30
### Fixed
- Some icons could flicker between normal and "no connection" icons when TotalMix was not available.
## [3.2.2] - 2022-12-29
### Added
- Added images for EQ, Comp, Autolevel instead of default mixer.
## [3.2.1] - 2022-12-27
### Changed
- Mirroring is globally on for the plugin by default now. Removed option to mirror single buttons from the UI to unclutter the menu. Instead there is now a [global setting](https://github.com/shells-dw/streamdeck-totalmix#deshellstotalmixexeconfig) to disable mirroring completely. Once mirroring is set up and working, there should not be a need to mirror or not mirror single buttons.
### Fixed
- Channel Toggle functions wouldn't work with mirroring disabled
- Channel selection list would be empty with mirroring disabled
- Updating from Marketplace version (or any other old version for that matter) would break existing buttons. While it is not impossible for existing buttons to break, this should be happening only occassionally, not for sure.
- Clarified in README.MD that updating requires to enable the second OSC endpoint.
### Added
- Global settings to disable mirroring and - if set - configure channel amount.
## [3.2.0] - 2022-12-21
### Fixed
- Channel names >9 are now displayed correctly
- Actions now update the current channel count automatically in the drop down list (before, the channel count was only checked when adding a button, then saved in the corresponding action settings and never reevaluated again)
### Fix attempt
- Crash caused by waiting for a callback on async reading a socket that was already disposed. I call it fix attempt as I did not yet find the reason why this happens in the first place, it has been a b[...] to track down as it could happen after several hours of plugin runtime on my machine, so for now the exception is caught and the plugin shouldn't crash from it anymore. Depending the actual root cause this may or may not lead to the mirroring getting stuck. Please report issues if it does. As said, I had a hard time to actually get that crash on my machine with my interface.
## [3.1.4] - 2022-12-12
### Added
- Snapshot names will be read from local TotalMix config file as they are not transmitted via OSC
## [3.1.3] - 2022-12-12
### Fixed
- Global Functions Display Channel Name checkbox was not functional
- Global Functions skipped over default "Global Mute" making it flicker the wrong icon/name
### Added
- a *load of try/catch logging on the receiving/sending parts
### Notes
- listener thread ocassionally throws an exception (safe handle closed in UDP receiver somewhere), investigating if that's caused by the lib or .NET. It's been an elusive one... StreamDeck detects the plugin going down and restarts it, so impact is... meh. It's not great, but for now it'll be that way.
## [3.1.2] - 2022-12-07
### Fixed
- Background task updating the device wasn't as sync as it should be
### Improved
- Added checks for TotalMix being unreachable or just having the command OSC listener running and act accrordingly
### Misc
- misc cleanup
## [3.1.1] - 2022-12-05
### Improved
- Made track/channel name display optional but default for all actions 
## [3.1.0] - 2022-12-05
### Improved
- Support for more/less than 16 channels!
    - During button load the plugin now tries to determine how many channels your interface offers (which is rather what the user set in "faders per bank" setting in TotalMix OSC setup) and offers these channels now in the plugin
    -> which allows interfaces with more (or less) channels to be fully supported as well now :)
## [3.0.0] - 2022-12-02
### General
- Partial rewrite of the plugin with lots of improvements, not necessarily every little change will be represented here
- This update might not be completely compatible with existing actions/buttons made with earlier versions. You might have to redo your buttons. It's annoying, I know, but I can't keep multiple code-bases to cover all eventualities active in the same plugin to keep full compatibility.
### Updated
- Mirror function reworked. Switched the library and how it's implemented to make it more robust, quicker, less ressource intensive and compatible with Windows 11
- added multiple additional icons to make actions more clear (less using default "Mixer"-style logo which made different actions look the same)
- Track names (channel names) as set in TotalMix are reflected on the StreamDeck to make it easier to distinguish buttons.
- Phantom Power is now able to be mirrored too and moved to Trigger Channel Functions
- overall more beautification ;)
### Fixed
- Windows 11 issues should be fixed now.
- Plugin (or at least mirroring) stopping working after it ran a while should be fixed now.
- Some less common actions have been sending a wrong value and never worked - fixed now.
## [2.2.1] - 2022-05-14
### Updated
- updated readme.md to reflect potential issues with Windows 11 and mirror channel
- moved files locally from a dying drive, git recognizes them all as modified now and I can't be bothered to mess with that, so I'm pushing it, but nothing should have changed except for a bit of debugging I added for testing this Windows 11 thing in osconoff.cs.
## [2.2.0] - 2022-04-29
### Improvement
- Updated default graphics
- Updated README.md to reflect graphics changes
## [2.1.0] - 2022-04-28
### Improvement
- Show/Hide UI should work now even when/after moving back to Stream Deck top level
### Various
- removed unused namespaces from all modules, cleaned up a bit, updated readme.md
## [2.0.0] - 2022-04-20
### Feature
- hold-mode (no latch mode) for OSC Global Functions
- enable toggle icons for all modules
### Fixed
- various minor fixes
## [1.2.1] - 2021-07-04
### Fixed
- calulations updated for 16 channels in OSC Channel handling
## [1.2.0] - 2021-07-04
### Fixed
- Mirrored buttons initilization delay

### Added
- Real time updates for channel mute/solo. StreamDeck should now (with a slight delay at times for technical reasons) update the button state if a channel is muted or solo-ed inside TotalMix or by other means (if you enable the mirror-checkbox on that button)
- Option to hide/restore the TotalMix window (using Windows techniques, haven't found out how RME does that with ARC, probably not exposed for third parties)
- Support for up to 48 channels (3x 16) _pending testing, I don't have access to a 16 channel RME interface myself at the moment_
- 
</p></details>


# Disclaimer
I'm in no way affiliated with RME or Elgato. I wrote this plugin out of personal interest.

<!-- Reference Links -->

[Stream Deck]: https://www.elgato.com/gaming/stream-deck/ "Elgato's Stream Deck product page"
[RME TotalMix FX]: https://www.rme-audio.de/totalmix-fx.html "RME's TotalmMix FX product page"
[RME ARC USB]: https://www.rme-audio.de/arc-usb.html "RME's ARC USB product page"
[virtualMidi]: https://www.tobias-erichsen.de/software/virtualmidi.html "virtualMIDI product page"
[loopBe]: https://www.nerds.de/en/loopbe1.html "loopBe product page"
[GitHub issues]: https://github.com/shells-dw/streamdeck-totalmix/issues "GitHub issues link"