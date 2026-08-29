[← Documentation home](index.md)

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


