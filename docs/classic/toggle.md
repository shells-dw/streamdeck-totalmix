[← Documentation home](../index.md)

# Toggle (classic)

On/off switches over the classic OSC protocol. Key only. State is mirrored from TotalMix where the protocol reports it. Drawn as TotalMix-style buttons (blue, orange, red, or orange text for the effect sections) with the strip or channel name underneath; "Icon" in Appearance restores the classic icon pair.

| Group | Parameters | Settings |
|---|---|---|
| **Main / Control Room** | Dim, Mono, Mute FX return, Speaker B, Talkback, External input, Recall volume | — |
| **Global** | Mute enable, Solo enable, Trim mode | — |
| **Strip in current bank** | Mute, Solo / PFL, Phantom power, Cue | Channel, Bus, Pin bank start |
| **Channel** (the selected channel) | Mute, Solo / PFL, Phantom power, EQ enable, Low cut, Dynamics, Auto Level, Stereo / mono, Phase invert (left / mono), Phase invert (right), Instrument, Pad, M/S processing, AutoSet gain, Loopback, Include in talkback, Exclude from trim, Record enable (DURec) | — |
| **DURec transport** | Record, Play / pause, Stop | — |
| **Groups and snapshots** | Mute group, Solo group, Fader group, Snapshot | Number 1–8 |
| **Effects** | Reverb, Echo, Room EQ (outputs) | Channel for Room EQ |

Notes:

- Per-strip Solo/PFL applies to inputs and playbacks only, per RME's table; since 1.96 TotalMix re-sends 0 for parameters that don't apply to the current bus.
- Snapshot and group keys have no state on the classic protocol (TotalMix does not report it there), so they light from their own presses; the Global OSC [Trigger](../global-osc/trigger.md) action lights snapshots from the mixer.
- Bus and bank pinning work as described for [Levels & Parameters](levels.md).
