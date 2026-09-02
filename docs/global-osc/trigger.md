[← Documentation home](../index.md)

# Trigger (TotalMix 2.1+)

One-shot commands over Global OSC. Key only.

![Trigger keys](../images/v5_trigger_keys.png)

| Group | Actions | Settings |
|---|---|---|
| Snapshots and layouts | Load snapshot 1 to 8, Load layout preset | Snapshot / Layout number |
| Cue and monitoring | Cue: step through outputs, Monitor path: step through slots | Output list / Slot list |
| Presets | Load EQ preset (channel), Load dynamics preset (channel), Load Room EQ preset (output), Load reverb preset, Load echo preset | Preset number; Bus and Channel for the per-channel ones |
| Mixer | Undo, Redo, Recall volume | none |
| DURec | Play, Pause, Stop, Record, Next, Previous | none |
| Window | Show TotalMix window, Hide TotalMix window | none |

## State

Snapshots light while loaded, including loads made in the mixer window, which the classic actions cannot see. A snapshot you have changed since loading still counts as the loaded one.

DURec keys light from the transport state: record red while recording, play green while playing, pause and stop accordingly.

Everything else is stateless and stays unlit.

## Notes

- DURec Stop during a recording needs two presses (TotalMix behaviour; the plugin sends 1.0, not the value above 10 that bypasses it).
- Saving a snapshot is not offered: TotalMix does not support it over OSC.

## Appearance

Snapshots and layouts show their number on the face; presets show their section; DURec, undo/redo and show/hide use symbols. "Icon" restores the classic artwork.

The output and slot lists are built with *Add*, *Remove last* and *Clear* beside a picker. The two cycle keys always draw the TotalMix-style face.

*Cue: step through outputs* advances the cue along the outputs listed, and clears it after the last one. Cue is a single control-room assignment, so advancing releases the previous output on its own.

The monitor key shows the slot it last selected on its face. *Monitor path: step through slots* steps a slot shared by every button: Main Out, Speaker B and the four Phones outputs, or the subset listed. Volume buttons set to *Follow the monitor path* control whichever slot is current, so one key and one fader cover the whole control room. The slot is stored globally, so it survives a restart and is the same on every Stream Deck.

