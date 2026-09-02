[← Documentation home](index.md)

# Changelog

## v5.2.0 - 2026-09-02

### Added
- **Follow the monitor path** is now offered as a Global OSC Volume target, and as the *Monitor* choice of the Balance target; both follow the slot the *Monitor path: step through slots* Trigger key last selected.
- *Defaults for new buttons* (host and ports) on the FX & Dynamics property inspector, as on the other Global OSC actions.
- A **REQ lamp** on output fader strips, lit while that output's Room EQ is on. Not a lamp TotalMix draws: the section's state is otherwise only visible inside the settings panel.
- **Next channel** and **Previous channel** as a key press mode and as dial press or touch gestures, on Global OSC Volume and FX & Dynamics, stepping a channel list built with a picker under *Advanced: channel cycling*. Naming a group there shares the position, so a row of dials moves as one channel strip; without one the channel is written to the button's own settings and survives a restart.
- **Clip latch** and **Signal watch**, two Global OSC Display modes over the level stream. Clip latches at a set dBFS and holds until pressed, showing the highest peak since the last clear; Signal watch raises once a channel has stayed below a floor for a set time, for a mic that has come unplugged mid-take, and clears itself when signal returns. Both need "Send Level Messages", and can blink rather than hold their face lit. A channel that goes silent stops reporting, so the silence timer runs on the clock rather than on arrivals.
- **Fade over** beside *Set a value* on both Volume actions: the level ramps to its target over a set time instead of jumping. The ramp interpolates on the fader position, so the move is even across the throw, and a second press retargets rather than running two ramps. A bar across the top of the readout shows how far it has left to run. Also available as a dial press or touch gesture, *Set the value below*.
- **Confirm with a second press** on both Toggle actions. The first press arms the key and captions it, the second within a couple of seconds writes; an armed key that is never confirmed writes nothing. Phantom power is the reason it exists.
- **Talkback + dim** as a Global OSC Toggle parameter: writes talkback and dim together on each edge, so with *Hold* it is press-to-talk with the monitors ducking.
- **Cue: step through outputs** as a Global OSC Trigger mode. The list is built from a picker rather than typed, and stores channel numbers the way every other picker in the plugin does. Cue is one exclusive assignment, so advancing releases the previous output and cueing the last one again clears it.
- **Monitor path: step through slots** as a Global OSC Trigger mode, the key captioned with the slot it last selected, with a matching **Follow the monitor path** target on Global OSC Volume. The slot is shared by every button through Stream Deck's global settings, so one key steps Main Out, Speaker B and the Phones slots while the level buttons follow it.
- **Lit colour** on both Toggle actions: the face lights in TotalMix's own colour for the parameter, or red, green, amber or blue. Per button and in *Defaults for new buttons*.
- A *Set a value* key marks its value on the artwork beside the current one: a line across the fader track, a tick outside the knob ring, a ring around the entry's dot. Global OSC list keys carry dots; the classic protocol does not number list entries, so those keys show the marker only on faders and knobs.
- **Set a value** as a third key-press mode on Volume, FX & Dynamics and the classic Levels & Parameters, beside Nudge up and Nudge down. The key writes a fixed value on every press, entered in the parameter's own unit: dB for levels and gain, Hz for frequencies, −1 to 1 for pan, a list position or a track number where those apply.
- **Dim**, **Recall volume** and **External input gain** as Global OSC FX & Dynamics parameters
- **Reverb type** and **Echo type** as classic Levels & Parameters targets 
- **Input gain, right side of a stereo pair** and **DURec playback track** as classic Levels & Parameters targets.
- **Hold (momentary)** on both Toggle actions. With it ticked the key switches the parameter on while held and off on release, for push-to-talk and for auditioning a Cue. Over Global OSC each edge writes the value directly; over classic OSC only the on/off parameters do, and the toggle-scale ones send a flip solely when the mixer's state differs from the state wanted.
- **DURec track** as a Global OSC FX & Dynamics parameter, the playback track a channel takes from the recording. Position 0 reads "Off"; the count comes from the recording, so the list is open-ended rather than clamped.
- **Cue**, **Talkback source** and **External input source** as Global OSC Toggle parameters.
- **FX lamps** on Global OSC Volume fader strips: TotalMix's own indicators beside the fader — the settings gear, EQ and dynamics — lit whenever the mixer lights them. EQ covers the EQ section and the low cut, dynamics covers the compressor/expander and Auto Level, and the gear covers MS processing and phase on inputs and playbacks, and crossfeed, phase, Room EQ and loopback on outputs. Playback channels carry the gear alone, as in the mixer. Each lamp is a small face carrying its mark: a column right of the fader on a key, and on a Stream Deck+ touch strip a column at the right edge opposite M and S, for which the fader's travel is shortened. On by default; a checkbox per key.
- **Mute / Solo** checkbox on Global OSC Volume strips, and adaptive strip geometry. The artwork is drawn per change, so a column that is switched off gives its room back: without the M and S pills the key's fader starts under the header instead of below them, and on a Stream Deck+ display the travel begins at the left edge; without the FX lamps the display's travel runs to the right edge. On a key the lamps sit in margin that was already free, so switching them off leaves the fader as it was. Both checkboxes are on by default; a strip without the pills shows no mute or solo state.
- The same **FX lamps** and **Mute / Solo** checkboxes on the Display action's level view, for the channel it meters. On a key the pills pair up on one row to share the right-hand column with the lamps, and with both switched off the meter itself widens; on a Stream Deck+ display the meter takes back whichever column is off.
- An **EQ curve** mode on the Display action: the summed magnitude response of the three bands and the low cut over 20 Hz to 20 kHz, coloured per band.
- **Gain reduction bar** on Global OSC Volume strips and the Display action's level view: TotalMix's blue bar beside the meter, growing down from the 0 dB mark by the compressor's computed reduction, continued in green by the expander's attenuation, over a dimmed track while the section is on. Off by default; a checkbox per key.
- The Display action's level view takes the channel colour like the other channel-scoped views.
- The expander's attenuation is computed forward from the level, which TotalMix meters before the expander.
- The compressor estimator caps the input recovered from a steady reading at the highest recent meter peak, so gated material with a fast attack may invert into reductions far past what the DSP does.
- The compressor reduction is estimated from measured meter behaviour: onset peaks are read as input rather than inverted, the peaks a slow attack lets through are removed before inverting, and any sustained meter fall releases the estimate at the section's release time towards the reading-as-input floor, following TotalMix's bouncing bar instead of pinning the peak value. The expander evaluates its curve at a level projected one meter-hold ahead of a falling meter, closing the displayed gate nearer to when TotalMix's does, and the dynamics-curve dot subtracts the attack leak.
- Property inspector lists that depend on another setting (channel on bus, list entries on parameter, sources on source bus) are pushed by the plugin when that setting changes, in every action. The inspector's own refresh could race the settings write and show the previous bus's list until the next change.
- The Display action's level view shows the channel's mute and PFL state as M and S pills, and meters both sides of a stereo pair.
- **Dynamics gain reduction** mode on the Display action: a VU-style needle of the compressor's gain reduction (0 to 20 dB, logarithmic scale) with the value beneath and an EXP lamp for the expander, on keys and touch strips. Global OSC carries no gain-reduction value and the channel meter reads the section's output, so the input is recovered through the inverse of the static curve; needle and lamp follow with a 60 ms time constant; the gain-reduction bars are unsmoothed.
- Two dynamics modes on the Display action: **Transfer curve** draws a channel's dynamics section as its static response across the whole face, and **Values** lists the numbers.
- **Follow the active speaker** option on the Global OSC Volume Main Out target. With it set, the dial hands over to Main Out B while Speaker B is switched on; without it, it stays on Main Out.
- **Speaker B (Control Room)** target for Global OSC Volume, addressing the output assigned as Main Out B whether or not Speaker B is switched on. The strip renders inactive while it is off.
- **Phones (Control Room)** target for Global OSC Volume, slots 1–4 the way Main Out follows its assignment. It resolves to an ordinary output channel, so it uses that channel's real mute and the channel gesture defaults rather than the Main Out ones.
- **Mute Main Out** gesture and Global OSC Toggle parameter. The control room has no mute of its own, so this writes the real output mute of every assigned monitor output. Dim and Recall move the fader, which the existing fader-to-−∞ mute has to share.
- **Balance (Control Room)** target for Global OSC Volume: the balance of the output assigned to Main Out, Speaker B or a Phones slot, following the assignment like the level targets.
- **Talkback destination** as a Global OSC Toggle channel parameter, output bus only.
- TotalMix channel colours on every channel-scoped Global OSC key and dial — fader strips, knobs, toggle faces, list boxes and the EQ and dynamics panels. Tints the strip body, header, readout band and fader track, and paints the header rule in the channel's name-field colour. A mix node takes its source channel's colour.

### Changed
- Connecting also sends `/sendsettings`, since control-room and FX settings are not transmitted by `/sendall`.
- Channel pickers skip channels TotalMix reports as hidden in the channel layout (`color` 0).

### Fixed
- The Balance target's *Follow the monitor path* choice did nothing; the plugin did not resolve it.
- A button following the monitor path came up on Main Out after every plugin start until the path was next changed; the stored slot was read too late. It is now read before the button binds.
- Classic *Hold* parameter (Talkback, Dim, page-2 switches) left the parameter on when the key was released within 400 ms of the press: the release compared against a cache that had not been updated by the flip. The flip now caches the resulting state, and the release flips back only what the press flipped.
- Classic preamp gain stepped 1.5 dB per detent on a dial and the button's *dB per step* on a key; both now step 1 dB, as documented and as Global OSC does.
- The classic *Input gain (right side)* target hid the *Device* setting it uses for its gain span.
- A Global OSC FX & Dynamics dial on a parameter TotalMix had not reported stepped from 0 and wrote that; the move is now ignored and the channel re-requested, as on the level actions.
- Show/hide window keys on the Global OSC Trigger action did not update the shared window state the Toggle action's *Show / hide window* key tracks.
- *Mute look* was offered on gain, pan and effect targets, which draw knobs and ignore it; the row now shows for fader targets only.
- The FX & Dynamics make-up gain arc used a display range separate from the write range; both now use the measured −30…+30 dB.


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

