 ![GitHub](https://img.shields.io/github/license/shells-dw/streamdeck-totalmix)     ![GitHub last commit](https://img.shields.io/github/last-commit/shells-dw/streamdeck-totalmix)/ [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/dwshells) [!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/dwshells)


# Unofficial StreamDeck TotalMix FX Plugin

## New in v4

- **Runs on macOS** — one installer for Windows and Mac
- **Stream Deck+ dials** — turn to set levels, with channel name, live readout and position bar on the display
- **Volume buttons for decks without dials** — each press nudges up or down by a set amount; place a `+` and `−` pair for a volume rocker
- **dB-accurate stepping** — follows RME's fader curve, so every step moves the same amount anywhere on the throw
- **Live two-way feedback** — change something in TotalMix and your buttons update instantly
- **Near-zero CPU** — one persistent connection, no polling
- **Pick channels by name** — "1 · Mic 1", read live from your interface
- **Input gain on a dial** — per channel, stereo pairs linked
- **Effects control** — reverb, echo and low cut on dials; press to bypass
- **Jump straight to submixes, snapshots, buses and Quick Workspaces**
- **Room EQ** toggle per output channel
- **TotalMix FX 2.0 compatible** (and 1.96+)
- **Simpler setup** — one OSC controller, no config file

## New in v4.2 — TotalMix FX 2.1 "Global OSC" support

Four additional actions built on RME's new Global OSC protocol (TotalMix FX 2.1+),
running side by side with the classic actions:

- **Absolute channel addressing** — a button means "input 3", not "the third
  fader of whatever bank is shown". No bus/bank pinning, no drifting buttons.
- **Volume (TotalMix 2.1+)** — channel faders, submix sends (any mix-matrix
  node) and preamp gain, on dials and keys.
- **Toggle (TotalMix 2.1+)** — channel, control-room, global, FX and group
  on/offs, all with device-driven state lights.
- **Trigger (TotalMix 2.1+)** — snapshots with a real active-state light (green
  when loaded), layouts, undo/redo, DURec transport, show/hide window.
- **Display (TotalMix 2.1+)** — read-only device status, DSP load and DURec
  time/state on a key or dial. (Peak level meters are wired up too, but the
  2.1 beta does not transmit level data yet.)

The classic actions keep working unchanged — both protocols run in parallel on
separate TotalMix Remote Controllers.
> [!NOTE]  
> Global OSC is still beta and may change with any new release. You will need TotalMix 2.1x, which is currently in beta, for this feature.

![Overview](/docs/images/GH_SocPic.png)

## What Is This (and what does it do?)

It's a plugin for the [Elgato Stream Deck][Stream Deck] that triggers global actions as well as individual channel actions on the [RME TotalMix FX][] application. Note: a RME audio interface/card is needed for TotalMix FX to work.

## Release / Installation

Inside the Gitub Release you can find the precompiled plugin. Download and open it, your computer should already recognize this as a StreamDeck file and offer to open it with StreamDeck - which will have the plugin available in the list then.

## Coming from v3

**Your existing buttons will not carry over.** v4 consolidates what used to be many separate actions into three, plus four more for TotalMix FX 2.1's Global OSC, so buttons must be re-added. Your settings, ports and icons are otherwise familiar.

It's a different plugin with different UUID so it **will** run alongside your existing plugin, **however** they can't both point to the same OSC controllers. v3 uses Remote Controllers 1 and 2, and so does v4, so the two collide completely. If you want both active at the same time, you must move one of them to a formerly unused OSC controller (TotalMix has four; 3 and 4 are the usual spares). Otherwise uninstall the old plugin!

MIDI support has been removed. OSC does everything the MIDI actions did and reports state back, which MIDI cannot. If you depend on MIDI, stay on v3.3.5.

The de.shells.totalmix.exe.config file is gone. Connection settings now live under Connection in each button's settings.

## Setup for OSC

The classic actions use Remote Controller 1. The "(TotalMix 2.1+)" actions use Remote Controller 2 in Global OSC mode. Set up whichever matches the actions you intend to use — both only if you want both.

Open Options → Settings… → OSC in TotalMix.

![Setup TotalMix OSC](/docs/images/OSC_setup1.png)

Tick "In Use" on Remote Controller 1. Defaults are port incoming 7001, port outgoing 9001 — the plugin expects these.  
Set Number of faders per bank to match your interface's channel count. The plugin can read only as many channels as this is set to.  
Don't tick Send Level Messages — the plugin doesn't use meters, and it saves needless traffic.

### v4.2 Global OSC
Tick "In Use" on Remote Controller 2. Defaults are port incoming 7002, port outgoing 9002 — the plugin expects these.
Set its *Compatibility (Mode)* to **Global OSC**. The plugin's defaults match controller 2's ports (incoming 7002, outgoing 9002). Then click *Details* and enable at least *Send changes* and *Send status*, recommended is also "Send faders in linear scale" and "Send all data on start (enable)".

![Enable OSC](/docs/images/OSC_setup2.png)

### If your ports or host are different

If TotalMix runs on another machine, or you use Remote Controller slots other than 1 and 2, open any action's property inspector and expand **Defaults for new buttons**. What you set there is copied into every button you add from then on, so you type it once instead of on all thirty buttons.

These live in Stream Deck's own storage, not in a file inside the plugin folder — so unlike v3's `de.shells.totalmix.exe.config`, they survive plugin updates.

Two things worth knowing:

- Changing a default does not move buttons already on your Stream Deck. They keep the connection they were created with, changed under **Connection** in their own property inspector. This is deliberate: it's what lets one dial sit on Remote Controller 1 watching playback while another sits on a different slot watching inputs.
- The classic actions and the "(TotalMix 2.1+)" Global OSC actions keep separate defaults, because they address separate controller slots.

Then tick Enable OSC Control in the Options menu and make sure the Submix linked to OSC Controller are ticked for all In Use OSC Controllers.

> [!NOTE]  
> If you change the ports, set them to match under Connection in any button's settings.  
> TotalMix can also run on a different computer — set the address accordingly, and allow UDP through any firewall in between.

No additional software is needed.

Note: if you're using a (software) firewall on your PC and/or any firewall between the StreamDeck and the target PC - make sure to allow the plugin to communicate with the TotalMix port as well as allow TotalMix to listen to it. You'll be prompted with Firewall messages when first enabling OSC in TotalMix and when the plugin first loads in StreamDeck, **make sure it's allowed to communicate or it will not work.**


## Usage
### Actions
 
| Action | Where | What it does |
|---|---|---|
| **Volume** | Key or dial | Main out, a channel, the selected channel, input preamp gain, or an FX parameter. Rotate to adjust, press to mute/dim/bypass. |
| **Toggle** | Key | Dim, mono, talkback, speaker B, mute, solo, phantom, cue, EQ, low cut, compressor, mute/solo/fader groups, snapshots, reverb, echo, Room EQ. |
| **Select** | Key | Jump to a submix, channel, bus, snapshot, or Quick Workspace. |
| **Volume (TotalMix 2.1+)** | Key or dial | Global OSC: channel fader, submix send or preamp gain, addressed by absolute channel number. Rotate to adjust, press to mute/dim/solo. |
| **Toggle (TotalMix 2.1+)** | Key | Global OSC: mute, PFL, phase, 48V, pad, instrument, M/S, loopback, stereo link, record, low cut, EQ, dynamics, AutoLevel, Room EQ, control room switches, global mute/solo, reverb, echo, mute/solo/fader groups. |
| **Trigger (TotalMix 2.1+)** | Key | Global OSC: load snapshots (key lights while active) and layout presets, undo/redo, recall, DURec transport, show/hide the TotalMix window. |
| **Display (TotalMix 2.1+)** | Key or dial | Global OSC, read-only: device name, connection, DSP load, DURec time and state. Press to refresh. |
 
### Volume and dials
 
Dials step in decibels along RME's own fader curve, so a detent moves the same amount whether you're at −40 dB or unity. The display shows TotalMix's own level readout and a position bar. Set how much each detent moves with dB per step.

> [!NOTE]  
> On buttons instead of SD+ dials this will allow nudging up or down with a button press.

![Vol_Btn](/docs/images/SD_vol_btn.png) ![Vol_Dial](/docs/images/SD_vol_dial.png)
 
### Picking a channel
 
Choose channels by name — the dropdown lists what TotalMix calls them ("1 · Mic 1"), read live from your interface.
 
TotalMix addresses channels by their position in the currently visible bank, not by a fixed number, so a button can drift if you move around the mixer. To pin a button to one channel permanently, set **Bus** and **Pin bank start** (usually 0) in its settings. Stereo pairs count as one channel. This is still not perfect, as channels up on the mix shift their ID, for example, when a channel is stereo, it's 1, the next channel is 2, but if the channel 1 is set to mono, another channel is added to the mixer, making this channel 2 and the former channel 2 becomes channel 3. Until RME releases their new OSC implementation, which is currently in Alpha and supposed to fix that, there is nothing my plugin can do about that. To work around that, set your channels as you need them before assigning StreamDeck functions to them.
 
### Input gain
 
Preamp gain on a dial, locked to input channels. On linked stereo inputs, both sides move together. Channels without a preamp will show 0 and ignore the dial.

> [!NOTE]
> On buttons instead of SD+ dials this will allow nudging up or down with a button press.

### Effects
 
Reverb send, return, volume, time, pre-delay and width; echo volume, delay and feedback; low cut frequency. Rotate to adjust, press to toggle the effect on or off. Values display in TotalMix's own units.

> [!NOTE]
> On buttons instead of SD+ dials curve functions will allow nudging up or down with a button press.

### TotalMix FX 2.1 — the Global OSC actions

TotalMix FX 2.1 introduces a second, completely different OSC dialect ("Global OSC") with absolute channel addressing. The four "(TotalMix 2.1+)" actions use it while the classic actions keep using the classic protocol. Both run at the same time on separate Remote Controllers.

**Channel numbers are absolute** — no bank pinning, no drifting. Stereo pairs are addressed by their left channel; for the per-side parameters (phase, gain) the dropdown offers separate "(R)" entries.

**Input/playback faders are per-submix.** In TotalMix, an input strip's fader is its send into the submix currently selected in the window — so over Global OSC these levels live on the mix matrix, one per output. The fader dial for an input/playback channel therefore has a *Submix* picker: "Main Out (auto)" follows the control room's Main Out assignment, or pin any output's submix. The on-screen fader only visibly follows while that submix is selected in the TotalMix window; the audio changes either way. Output channels have one real fader and need no picker.


**Snapshots** light up while active — TotalMix reports load state over Global OSC (including loads made in the mixer window), which the classic protocol cannot do.  
**DURec stop** during recording needs two presses; that's TotalMix's own safety against killing a take, and the plugin deliberately does not bypass it.  
**Groups** (mute/solo/fader) are receive-only in this protocol: TotalMix never reports their state, so those buttons track their own presses.

**Not yet in the 2.1 beta:** peak level meters (`/level/…`) are documented but not transmitted, and input/playback channel faders only exist as mix-matrix nodes. The Display action's level mode should start working once it's implemented.


# I have an issue or miss a feature?

You can submit an issue or request a feature with [GitHub issues]. Please describe as good as possible what went wrong and also include any log files as they are incredibly helpful for me to figure out what went wrong. Logs can be found in `%APPDATA%\Elgato\StreamDeck\Plugins\de.shellsdw.totalmix2.sdPlugin\logs`.
As described above I developed this with a Fireface UC which is the only device I have at home and with that constant access to so debugging/developing for any other RME device might not be the the easiest task, but I'll see what I can do.

# Contribute

If you're interested in using this plugin but something you really need is missing, let me know. I naturally don't have access to all RME devices, so I can't really try things on the boxes themselves, but eventually we might find a way to work something out.

# Support

If you'd like to drop me a coffee for the hours I've spent on this: [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/dwshells) [!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/dwshells)



# Changelog
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
- Room EQ toggle per output channel (TotalMix FX 1.96+).
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

