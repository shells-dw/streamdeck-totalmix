[← Documentation home](index.md)

# Changelog

## [5.5.1] - 2026-10-15

### Fixed
- Input and playback faders without a reported level wrote to the channel instead of the submix node.
- PFL no longer offered on outputs.
- Peak-hold line stayed at the bottom of the meter after the signal stopped.

### Changed
- PFL mode named as in TotalMix: *Live Mode, PFL replaces Solo*.

## [5.5.0] - 2026-10-02

### Added
- **Dim** on Global OSC Volume: lowers a fader by a set amount (*Dim by (dB)*, default 20) and restores it on the next press. Key press mode, dial press or touch, or hold. Works on channel faders, submix sends, Main Out, Speaker B and Phones, independent of TotalMix's control-room Dim.
- *Dim amount* can follow the reduction of TotalMix's control-room Dim instead of an own value.
- **Second press** for *Set a value* on Global OSC Volume: *Nothing*, *Back to the previous value* or *Switch to another value*, as on FX & Dynamics.
- *Fade over* applies to Dim, and to the second press of *Set a value*.
- *Key face* for keys with Dim or *Set a value* on press or hold: a DIM or SET button, lit while engaged; with the icon appearance, DIM and SET icons in on and off states.

### Fixed
- The *Value* field did not show when *Hold the key* was set to *Set the value below*.
- A *Set a value* press without a fade did not stop a fade still running on the same key.

## [5.4.0] - 2026-09-21

### Added
- 48V and INST pills on Global OSC Volume strips and knobs ([#72](https://github.com/shells-dw/streamdeck-totalmix/issues/72)), switchable via *48V / Inst*.
- 48V and INST pills on the Display level view.
- *Show the submix (3 s)* gesture on Global OSC Volume.
- *Submix label* on Global OSC Volume dials, below or beside the name.

### Changed
- dB readouts: `+` and `-` from ±0.1 dB, `0.0 dB` without a sign.
- Stream Deck+ fader strip redesign: smaller fader cap, taller meter.
- REQ moved from the FX lamp column into the header, shown only while Room EQ is on to make it more obvious.
- Documentation images redrawn to reflect the visual changes.

### Fixed
- Dial settings panel reset the mute look *Red cast and cross* to *Red badge and cast*.
- *Set value* for input gain ignored the detected interface's gain ceiling.

## [5.3.2] - 2026-09-18

### Changed
- Setup and Volume docs: *Submix linked to OSC Controller* applies to the classic controller only.. TotalMix FX 2.1 beta 6 ignores it for Global OSC.

### Fixed
- TotalMix FX 2.1 beta 6 compatibility: prevent sending of data to hidden input/playback channels. A channel TotalMix does not report at all was listed as a bare number. Until beta 5 it was sent with color=0 and my detection relied on it.
- Settings panel lists that depend on another setting offered every entry regardless: dial gestures, *Hold the key*, *Alt function*, the bus lists and the mute style. Picking an entry the target cannot perform (for example *Mute* on a submix send) silently ran the default, and the dial kept showing it. The lists now follow the target, and a stored entry that no longer applies is set back to the default ([#71](https://github.com/shells-dw/streamdeck-totalmix/issues/71)).

## [5.3.1] - 2026-09-09

### Added
- **Save snapshot**, with an optional guard: lit while there is something to save, second press to confirm.
- **Load guard** on snapshot keys: a mark and a second press while the loaded snapshot has unsaved changes.
- **Clear all solos**, **Clear all mutes** — lit while anything is set.
- **Pan followers** — channels whose pans follow a pan dial, mirrored or linked.
- **Clip counter** on the clip latch: `CLIP ×3`.
- **Peak hold** time as a setting on Volume strips and the level view, default TotalMix's 2 s.
- Dim and Recall keys show their amount.

### Changed
- Various button redesigns.
- Various config optimizations in settings panel.

### Fixed
- Switching *Send faders in linear scale* while the plugin runs froze fader keys on stale values.
- A TotalMix restart, or a settings change that reopens its socket, is now detected and the cache rebuilt.
- A connection nobody uses any more (removed keys, changed ports) is closed instead of staying open.
- A fade still running when its key was removed kept writing to TotalMix.
- The second half of a linked split fader could keep the old channel until the next edit.
- A key with an unknown stored parameter could stop rendering.
- *Neutral* on the expander threshold and Auto Level headroom wrote 0 dB, outside their range.
- Holding a key set to *Mute* did nothing on some targets the list offered it for.

## [5.3.0] - unreleased, included in [5.3.1]

### Added

**Presses and gestures**
- **Hold the key** — a long press runs a second action of its own, including ramping up or down for as long as you hold.
- **Alt function** — a dial press swaps to a second target on the same channel and back.
- **Link the halves** of a split fader, so setting one sets the other.

**Fader strips**
- **Record enable** as a red frame.

**Control room**
- **Control room monitor (auto)** on the submix picker, following the Speaker B switch.

**Elsewhere**
- A title typed into Stream Deck's own field now replaces the key's caption instead of printing over it. Until TotalMix sends Snapshot names this works as workaround.

### Changed
- Bus pickers only offer buses a parameter actually has.
- A disconnected Display key now says so on red rather than going blank.

### Fixed
- Input and playback faders could show no level after start until audio arrived.
- Channel colours only appeared if another key happened to have loaded that channel first.
- A dial could stop updating, or flip between the old and new target, after its target was changed.
- The halves of a split fader could disagree, or write to each other in a loop.
- Control-room keys could land on negative numbers when a slot was unassigned.
- Balance dials could sit on "—" indefinitely.
- *Set to −∞* on an input gain key came back at the wrong level, and its value field offered the wrong range for the interface.
- The expander threshold, attack and release used wrong limits.
- The EQ curve coloured its bands differently from TotalMix.
- *Spread across several keys* did nothing on the dynamics modes.
- Unassigned Phones and Speaker B slots now say so instead of showing a working channel.
- Channel lists now refresh properly after a rename.
- Two checkboxes came up ticked when they should have been clear.
- The dynamics displays repainted far more often than needed.

### Security
- OSC is accepted only from the host you configured. Anything else is ignored, and the sender is logged.
- Ports typed into the inspector are checked before use, and the caches are capped so a misbehaving sender can't grow them without limit.

## [5.2.0] - 2026-09-02

### Added

**Presses and gestures**
- **Set a value** — a key writes a fixed value, in the parameter's own unit. On Volume, FX & Dynamics and classic Levels & Parameters. The value is marked on the artwork beside the current one.
- **Fade over** — the level ramps to its target over a set time instead of jumping.
- **Confirm with a second press** — the first press arms the key, the second writes. For phantom power and anything else you don't want to hit by accident.
- **Hold (momentary)** — the parameter is on only while the key is held. Push-to-talk.
- **Next / previous channel** — step a row of keys or dials through a channel list you build. Name a group and they move together.

**Display**
- **Clip latch** — lights at a set dBFS and stays lit until you press it.
- **Signal watch** — lights when a channel has been silent too long. For a mic that came unplugged mid-take.
- **Gain reduction** — a VU-style needle over 0–20 dB, with a lamp for the expander.
- **Transfer curve**, **Values** and **EQ curve** modes.
- The level view meters both sides of a stereo pair, shows mute and PFL pills, FX lamps and the channel colour.

**Fader strips**
- **FX lamps** beside the fader: settings, EQ and dynamics, lit as TotalMix lights them. A **REQ lamp** on outputs.
- **Gain reduction bar** beside the meter.
- **Mute / solo** pills, which can be switched off to give the fader and meter more room.
- Channel colours from TotalMix tint the strip, header and fader track.

**Control room**
- **Speaker B**, **Phones** 1–4 and **Balance** as volume targets, plus **Follow the monitor path** and **Follow the active speaker** on Main Out.
- **Monitor path** — step through monitor slots from a key, with volume buttons that follow the current slot.
- **Mute Main Out**, muting every assigned monitor output.
- **Cue**, **talkback source**, **talkback destination**, **talkback + dim** and **external input source** as toggles; **cue: step through outputs** as a trigger.

**New parameters**
- **Dim**, **recall volume**, **external input gain** and **DURec track** on FX & Dynamics.
- **Reverb type**, **echo type**, **input gain (right side)** and **DURec playback track** on classic Levels & Parameters.

**Elsewhere**
- **Lit colour** on both Toggle actions — TotalMix's own colour for the parameter, or red, green, amber or blue.
- *Defaults for new buttons* on the FX & Dynamics inspector, as on the other Global OSC actions.
- Inspector lists that depend on another setting are pushed by the plugin when that setting changes.

### Changed
- Gain reduction is estimated against measured meter behaviour on a UCX II. TotalMix sends no gain-reduction value, so this stays an estimate.
- Connecting also sends `/sendsettings`.
- Channel pickers skip channels hidden in TotalMix's channel layout.

### Fixed
- *Follow the monitor path* on the Balance target did nothing, and a key following the path came up on Main Out after every restart.
- Classic *Hold* could leave a parameter on after release, and classic preamp gain stepped 1.5 dB instead of 1 dB.
- The classic *Input gain (right side)* target hid its Device setting.
- An FX & Dynamics dial on a parameter TotalMix had not reported wrote 0; the move is now ignored and the channel re-requested.
- Show/hide window keys on the Trigger action didn't update the state the Toggle action shows.
- Mute look was offered on knob targets that ignore it.
- The make-up gain arc used a display range separate from the write range; both now use −30…+30 dB.

## [5.0.0] - 2026-08-29
### Added
- The private development repository and the v4 repository are merged into one for the release.
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
- A full refresh no longer sends `/sendmix`. The watchdog repeats the refresh, and re-sending the whole mix matrix each time floods the plugin with renders.
- A TotalMix restart is detected on any packet after a silence, not only when the first packet is a bare heartbeat, and the classic connection now clears its cached views so buttons re-read their state instead of showing pre-restart values.
- The classic connection's background rotation over pinned channels could queue the same channel visit repeatedly; visits are now queued once.
- Level meter addresses on page 1 are cached per bus and bank like the other strip parameters.
- FX, EQ, dynamics and Room EQ controls verified against an interface that provides them.

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
- Fader scales match TotalMix: ticks at +3, 0, -3, -6, -10, -20, -40 and -60 dB, the +3 tick red and the -3 tick green, and every labelled value numbered on both the key and touch strips.
- The touch strip stacks M over S in a left-hand column, and the meter now spans the fader's own range on the same dB mapping, so a level reads directly against the fader scale.
- Strip meters are TotalMix's green rather than the previous cyan, taller on both the key and touch strips, and split into two bars for a stereo pair, each side metered from its own `/level` channel.
- New plugin UUID — this now installs and runs alongside the v3 plugin instead of replacing it. Buttons from the old plugin do not carry over. **NOTE:** both plugins cannot use the same OSC controllers — see [Coming from v3](setup.md#using-both-plugins-coming-from-v3).
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
- A second press on a key with the make-up gain following put the parameter back but left the gain wherever the rule and the trim put it: it recomputed from the restored setting instead of undoing its own write. Both now go back together.
- A *Set a value* key with a computed value never went back on its second press. It compared the parameter against the value it would write *now*, and a computed figure moves with the compressor and the meter, so the comparison missed, the key wrote again and overwrote the value it was meant to restore. It now recognises what it last wrote.
- A dial press did nothing on a parameter with no section of its own, Crossfeed and DURec track among them: the press writes the section's enable, and those have none. The press now parks the parameter at its off position and a second press restores. Parameters with no published default, Width and Delay, still have nothing to park at and their press stays idle.
- The block origin for a spread panel counts from 1, so the top-left key of the device is column 1, row 1. It counted from 0 before, which put a block entered as 1, 1 one key down and to the right of where it looked.
- The channel and cue lists are written as the channel numbers on the mixer rather than 0-based wire values, so adding channel 17 puts 17 in the list. Lists saved before this shift by one and want re-adding.
- The list editors could not add the entry the picker was already showing. An `sdpi-select` that has not been changed reports an empty value while displaying its first entry, and the helper took that literally instead of reading the element under it.
- Channel stepping moved the setting but not the button. `setSettings` raises `didReceiveSettings` for the property inspector only, not for the plugin, so nothing rebound and the button kept its old channel; only the grouped path worked, because that rebinds through its own listeners. The write is now followed by an explicit rebind.
- Every classic write that is read back now caches what it sent, not only the nudge and the on/off keys: the dial and touch gestures for mute, solo, cue and phantom, set to unity, centre, to neutral and back, and to −∞ and back. Each of those decides what to write from the cached value, so without it the second gesture repeated the first. kOSCScaleToggle parameters still go through the flip path, where 1.0 is a command rather than a state.
- A classic nudge or set key moved the value once and then did nothing. Same cause as the on/off keys below: the write was not cached, so every further press read the pre-press value and sent the same thing again. Both now write through the caching path.
- Classic Mute, Solo, Phantom and Cue keys switched on but never off, and never lit. Those parameters carry their value, so a press sends the inverse of the cached state, but the write did not cache it: TotalMix's echo arrives inside the settle window and is dropped as the plugin's own, and page 1 is not re-dumped while it is the resident page, so the cache stayed at nought and every press sent 1 again. The write now caches what it sent, as the Global OSC side already did.
- Solo over Global OSC wrote and read the channel's `pfl`, which is the PFL button and does nothing outside TotalMix's PFL mode. The table carries solo on the mix node, so the S pill on a fader strip, the Solo dial gesture and the new Toggle parameter all address `/mix/{in|pb}/{channel}/{output}/solo`. Solo therefore belongs to one submix, as in the mixer; outputs have no solo and keep Cue. The Toggle's PFL parameter no longer draws itself as an S in the solo colour.
- A classic selection key showed "33 %" or "67 %" instead of the entry. The wire value is a fraction of the list, and the readout fell through to a percentage whenever TotalMix had not reported a name for the current value, which is the case right after a press. It now names the position from the plugin's own list, and classic list keys draw position dots for the same reason.
- The FX & Dynamics *Positions per step* slider did nothing. List parameters have always moved one entry per detent, ignoring it. Removed.
- The classic *Positions* slider is gone. It asked for the length of a list the plugin now knows, and read as a step size besides. The count comes from the entry names, which is also what the wire position is scaled over.
- A classic *Set a value* key on an EQ band type or the low cut slope now picks the entry by name rather than asking for its number. Over Global OSC that is what *Select an entry* already does, so *Set a value* is offered there only for the DURec track, whose entries are numbers.
- Two buttons on the same parameter did not follow each other. A dial move or a nudge press writes through the coalesced path, which cached the new value without waking the address's other subscribers; the echo is then suppressed as the plugin's own write, so a second key or dial on that parameter never learned of it. Coalesced writes now notify like the discrete ones. Both protocols.
- Per-strip mute, solo, phantom and cue could only ever switch on, never off. These are on/off parameters in RME's spec, not toggles, and were being sent as toggles.
- Main volume did not work at all — the address used did not exist.
- Changing a button's function in the property inspector did not take effect until the button reappeared; it kept acting on the previously selected parameter.
### Removed
- **MIDI actions.** OSC covers everything they did and reports state back, which MIDI cannot. Stay on 3.3.5 if you need MIDI.
- **`de.shells.totalmix.exe.config`.** Connection settings are per button, under "Connection".
Existing buttons will not carry over and need to be re-added, as the actions have been consolidated. Ports and icons are unchanged.

