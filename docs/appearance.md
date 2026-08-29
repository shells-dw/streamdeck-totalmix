[← Documentation home](index.md)

# Appearance

Every action — Global OSC and classic — has an **Appearance** setting in its property inspector.

## TotalMix look (default)

Keys and Stream Deck+ displays are drawn by the plugin on every change, in colours and proportions taken from the mixer:

![Strip anatomy](images/v5_strip_anatomy.png)

- **Fader strips** for levels: channel name in the header, M and S pills lit by the mixer, the meter (Global OSC, once *Send Level Messages* is on), RME's scale with 0 dB marked, the cap on the real fader curve, and the readout in dB. The meter carries a peak-hold line: held for 1.5 s, then falling at 12 dB/s. Clipping turns the meter red. Meters repaint at most five times a second on a 1 dB grid; the **Meter** checkbox on a Global OSC Volume key switches the meter off for that key if you'd rather save deck traffic. The classic Levels action draws the strip without a meter — the classic protocol only reports levels for the visible bank, which didn't make for a usable meter.
- **Knobs** for preamp gain (fills from the left up to your interface's maximum), pan (fills from the centre, `L50 / C / R50`) and effect parameters (arc in the section's colour, value beside it, parameter name and section badge underneath).
- **Dropdown boxes** for list parameters, with the entry name and a row of position dots.
- **Buttons** for toggles and triggers: blue for mute-type switches, orange for solo/PFL and talkback, red for 48V and record, orange text for the effect sections, with the channel name underneath.
- **Panels** for the Display action: meter, device name, connection state, DSP gauge, DURec clock and transport symbol.

When TotalMix is not reachable the artwork greys out and the readout shows "—". The chevron in a key's header shows which way it nudges.

![Key states](images/v5_key_states.png)

## Icon look

The previous artwork: a static icon per parameter with the value as the key title. On dials, name, value and a position bar on a black display that washes blue for mute and orange for solo; an effect dial shows orange text while its section is on.

## Custom images and titles

A custom image or title set in Stream Deck's own key settings always wins over whatever the plugin draws. That's the way to give a key your own icon while keeping its behaviour.

## Display action

Its Appearance options are "TotalMix panel" and "Plain title". See [Display](global-osc/display.md).
