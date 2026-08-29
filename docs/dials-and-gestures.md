[← Documentation home](index.md)

# Dials and gestures

## Turning

Level controls step in decibels along RME's own fader curve, so a detent moves the same amount whether the fader sits at −40 dB or at unity. The step size is **dB per step** in the button's settings (default 1.5 dB; the default for new buttons can be changed under *Defaults for new buttons*). Preamp gain steps in whole dB. Pan steps 1 % of the throw (two of TotalMix's units), snapped so turning back lands exactly on centre. Effect parameters step in their own unit — see [Effects & Dynamics](global-osc/effects.md).

## Keys instead of dials

Every level or parameter action also works on a regular key. Under **Key press** (or **On press** for effects) choose *Nudge up* or *Nudge down*; each press moves by the same step a detent would. A `+` and a `−` key make a volume rocker. The key's header shows a chevron for the direction. List parameters can also *Select an entry* directly — see [select keys](global-osc/effects.md#select-keys).

## Press and touch

A Stream Deck+ dial has three inputs: turn it, press it, tap the touch strip above it. Turning always sets the value. Press and touch are assigned per button under **On press** and **On touch**, and default to what suits the target:

| Target | Press | Touch |
|---|---|---|
| Main / Control Room, Active Monitor | Mute (fader to −∞) | Dim |
| A channel, a strip, input gain | Mute | Fader to −∞ (gain to minimum) |
| A submix send (Global OSC) | Solo | Fader to −∞ |
| Pan | Mute (solo for a send's pan) | Centre |
| An effect parameter | Switch the section on/off | Parameter to neutral (0 dB, first list entry, or the middle of the range) |

Either can be reassigned. The menu is grouped by what the choice acts on and only offers what the target supports:

- **This dial** — mute, mute source channel (Global OSC submix sends), solo/PFL, cue (classic only), phantom power, set to −∞, set to 0 dB, centre the pan, bypass the effect, back to neutral, to neutral and back.
- **Control room** — dim, mono, talkback, speaker B, **Mute Main Out**, external input, mute FX return, recall main volume. These are global switches, so any dial can carry one. Mute Main Out mirrors the ARC USB operation: Main Out supplies the state, and both Main Out and Main Out B receive the new real output-mute value.
- **Global** — mute all, solo all.
- **Nothing**.

Setting a fader to −∞ remembers the level it was at, so the next press or tap restores it. It silences the channel without touching its mute, which also leaves any mute group the channel belongs to alone. A fader parked at −∞ shows as muted on the display.

On a Global OSC submix send, **Mute source channel** is different: it toggles the selected input or playback channel's real mute, so it affects that source in every submix. Its M display state follows that channel's mute changes from TotalMix or any other controller.

## What the display shows

With the [TotalMix look](appearance.md) a dial shows the channel name, the value, the fader position on the real scale, the meter (Global OSC, with level messages enabled) and lit M/S pills. With the icon look it shows name, value and a position bar, and the whole display washes blue for mute and orange for solo.

The ARC-style Main Out mute indicator has deliberately narrow semantics: it appears only on **Active Monitor** when press or touch is assigned to **Mute Main Out**. It lights the TotalMix look's blue M pill, or shows a small red M badge beside the value in the Icon look. It always follows the real mute of the output assigned to Main Out, never Speaker B, Main Out B's mute, the currently active monitor output or a fader parked at −∞.
