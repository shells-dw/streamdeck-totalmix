[← Documentation home](../index.md)

# Levels & Parameters (classic)

Levels, pan, preamp gain and effect parameters over the classic OSC protocol (TotalMix FX 1.96 – 2.0; also works on 2.1 in classic mode). Key or Stream Deck+ dial. Drawn in the [TotalMix look](../appearance.md): fader strips, knobs and dropdown boxes, with TotalMix's own readout strings as the value.

## Target

| Target | What it controls | Settings |
|---|---|---|
| **Main / Control Room volume** | The main out | — |
| **Volume (strip in current bank)** | A fader by its position in the bank TotalMix currently shows | Channel, Bus, Pin bank start |
| **Volume (channel)** | The selected channel | — |
| **Input gain (preamp)** | Preamp gain, locked to inputs; stereo pairs linked | Channel, Bus, Device |
| **Pan (channel)** / **Pan (strip in current bank)** | Balance, `L50 / C / R50` | as above |
| **Per channel** | FX send (inputs, playbacks), FX return (outputs) | Channel, Bus |
| **EQ** | Band 1 type, gain, frequency, Q · Band 2 gain, frequency, Q · Band 3 type, gain, frequency, Q · Low cut frequency and slope | Channel, Bus |
| **Dynamics** | Compressor threshold, ratio, attack, release, make-up gain; expander threshold, ratio | Channel, Bus |
| **Auto Level** | Maximum gain, headroom, rise speed | Channel, Bus |
| **Room EQ** (outputs) | Volume correction, delay, and gain/frequency/Q of all nine bands (type on 1, 8, 9) | Channel |
| **Reverb** | Volume, pre-delay, width, room scale, smoothness, low cut, high cut; time and high damp (Space); attack, hold, release (Envelope types) | — |
| **Echo** | Volume, delay, feedback, width | — |

## How the classic protocol addresses channels

TotalMix addresses strips by their position in the currently visible bank, not by a fixed number, so a button can drift when you move around the mixer. To hold a button on one channel:

- **Bus** — *Leave as is* uses whatever bus is shown; *Follow TotalMix's selection* tracks the mixer; or pin *Input*, *Playback* or *Output*.
- **Pin bank start** — usually 0. With a pinned bus and bank start the plugin steers TotalMix to the right bank before acting.

Stereo pairs count as one channel, and changing a channel between mono and stereo shifts the numbering of everything after it. Set your channels up as you need them before assigning keys. This is a limitation of the classic protocol; the Global OSC actions don't have it.

Channels are still picked by name — the list is read live from the interface for the chosen bus and bank.

## Input gain and the Device setting

dB-accurate stepping needs the width of the preamp's gain range, and the classic protocol doesn't identify the interface. Pick yours under **Device**; unset, a 65 dB span is assumed. Getting it wrong only changes how far a detent travels — the number on the display is always TotalMix's own readout. See [Devices](../devices.md) for the table.

## What the key shows

![Classic actions in the TotalMix look](../images/v5_classic_look.png)

- **Faders** (main, strip, channel): the fader strip with M/S lit from the strip's flags (or from a fader at −∞). No meter: the classic protocol only reports levels for the visible bank, so a meter would freeze whenever the mixer scrolls; the Global OSC [Volume](../global-osc/volume.md) action has one.
- **Gain and pan**: knobs; gain fills across TotalMix's 0–1 wire range, pan from the centre.
- **Effect parameters**: knobs whose arc is the raw 0–1 value, coloured by section, with the section badge lit while the enable is on (for FX send/return, while the send is above −∞). Selection parameters (EQ and Room EQ band types, low cut slope) draw as a dropdown box with TotalMix's name for the entry; the classic protocol doesn't number list entries, so there are no position dots and no *Select an entry* key mode.

## Stepping, press and touch

As in [Dials and gestures](../dials-and-gestures.md). The classic vocabulary adds **Cue** for strips and channels; per-strip solo/PFL is inputs and playbacks only, per RME's table. Effect parameters display in TotalMix's own units; dB parameters step in dB once the plugin has seen two readings, frequencies step in Hz, selections step one entry per detent.
