[← Documentation home](../index.md)

# Toggle (TotalMix 2.1+)

On/off switches over Global OSC. Key only. The key's state is the mixer's: a press flips whatever TotalMix currently shows, and a change made in TotalMix (or anywhere else) updates the key.

![Toggle keys](../images/v5_toggle_keys.png)

## Parameters

| Group | Parameters | Settings |
|---|---|---|
| Control Room | Dim, Mono, Talkback, External input, Speaker B, Mute Main Out, Mute FX return, Link Main/Speaker B | none |
| Global | Mute enable, Solo enable | none |
| Channel | Mute, Solo (inputs, playbacks; Submix), PFL, Phase (L/R separate), Phantom power (48V), Instrument, Pad, AutoSet, M/S processing, Loopback, Stereo link, Record enable, Talkback destination | Bus, Channel |
| Control room assignment | Cue, Talkback source, External input source | Channel |
| Channel processing | Low cut, EQ, Dynamics, AutoLevel, Room EQ | Bus, Channel |
| Effects | Reverb, Echo | none |
| Groups | Mute group, Solo group, Fader group | Group number 1 to 4 |

TotalMix has no control-room mute of its own, so Mute Main Out is built from what exists: the key reads the real output mute of whatever channel is assigned as Main Out, and a press writes the inverse to every assigned monitor output: Main Out always, Main Out B as well when one is assigned. Unlike parking the fader at −∞ this survives Dim and Recall, which both work by moving the Main Out fader.

Talkback destination is the per-channel switch marking an output as a talkback destination. Outputs only.

Solo and PFL are different buttons. Solo is the mixer's Solo, which Global OSC carries on the channel's mix node rather than on the channel, so it belongs to one submix: pick which under *Submix*, or leave it on Main Out. Outputs have no solo, they have Cue. PFL is the separate PFL button, which only does something while TotalMix is in PFL mode.

The three assignment parameters are not per-channel switches. TotalMix keeps one channel number for each: the output being cued, the input the talkback mic sits on, and the input feeding the external-input path. A key lights when the assignment points at its channel; a press writes its channel, and a press on a lit key clears the assignment. Because there is one assignment per kind, a second Cue key takes cue away from the first without needing to be told. Cue picks from the outputs, the two sources from the inputs, so the bus picker is hidden.

Phantom power, Instrument, Pad and AutoSet exist on inputs only, Room EQ and Cue on outputs only. The bus picker is hidden for those and the right bus is written regardless of what an older key had stored.

Phase is separate per side on stereo pairs, so the channel list offers "(R)" entries for the right side.

TotalMix never reports group state, so a group key tracks its own presses and cannot see changes made in the window. Show / hide the TotalMix window is the same: `/showwindow` is receive only, so the plugin assumes the window starts shown and alternates from there. Every window key shares that assumption, so they stay in step with each other, but a window closed by other means leaves the next press out of phase.

*Lit colour* changes the colour the face lights in: TotalMix's own for that parameter, or red, green, amber or blue. Set per button, or for new buttons under *Defaults for new buttons*.

## Hold (momentary)

With **Hold** ticked, the key switches the parameter on while it is held and off when released, instead of flipping it. It works for any parameter, e.g. talkback, or cue to audition an output while the key is down.

If a hold key is released while the connection is down nothing is written, so the parameter stays on. The key shows the mixer's state either way.

## Appearance

The [TotalMix look](../appearance.md) draws a TotalMix-style button lit in the parameter's colour with the channel name underneath. "Icon" uses the classic on/off icon pair.
