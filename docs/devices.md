[← Documentation home](index.md)

# Devices

The plugin holds a small table of RME interfaces for two things TotalMix does not tell it: the width of the preamp gain range, and the reference-level lists. Over Global OSC the interface is recognised from the device name TotalMix reports, and a trailing unit number such as "Fireface UCX II (1)" is ignored. For the classic input gain dial you pick it under *Device*.

## Preamp gain range

| Device | Gain range | Source |
|---|---|---|
| Fireface UFX II, UFX+, UFX III | 75 dB | UFX II and UFX+ from RME's product pages; UFX III inferred (same preamp family) |
| Fireface UCX II | 75 dB | UCX II manual |
| 12Mic / 12Mic-D | 75 dB | RME |
| M-1610 Pro | 75 dB | inferred |
| Fireface 802 / 802 FS | 75 dB | inferred |
| Fireface UCX, UC, UFX | 65 dB | UCX from RME's product page; UC and UFX inferred |
| Babyface Pro / Pro FS | 65 dB | Babyface Pro FS manual (TotalMix's control spans 0 to 65 dB; the marketed 76 dB includes the PAD) |
| Fireface 400 / 800 | 65 dB | inferred |
| Babyface (original) | 60 dB | inferred |
| unknown | 65 dB (classic), 75 dB (Global OSC) | fallback |

A wrong entry only changes how far a detent travels; the displayed value is always TotalMix's readout.

## Reference levels

Reference level is a list parameter on the [FX & Dynamics](global-osc/effects.md) action. The list differs by interface and by bus, and sometimes by channel, so the plugin resolves it per device and bus:

| Device | Line inputs | Outputs | Source |
|---|---|---|---|
| Fireface UCX II | +13 dBu, +19 dBu | +4 dBu, +13 dBu, +19 dBu | UCX II manual, technical reference |
| Fireface UFX III | +13 dBu, +19 dBu | +4 dBu, +13 dBu, +19 dBu; +24 dBu on the XLR outputs 1/2 only | UFX III manual ch. 19.1 / 20.1 |
| M-1610 Pro | +4, +13, +19, +24 dBu | +4, +13, +19, +24 dBu | inferred from RME's level guide; order unverified |
| Fireface UFX, UFX+, UFX II, 802 / 802 FS, UC, UCX | −10 dBV, +4 dBu, Lo Gain | −10 dBV, +4 dBu, Hi Gain | UFX manual and UC product page; the rest by generation |
| Babyface Pro / Pro FS | −10 dBV, +4 dBu (TRS inputs 3/4) | none, output level is a hardware switch | Babyface Pro FS manual |
| unknown | plain numbers, not clamped | | |

Lists are in rising order of 0 dBFS level, matching what TotalMix shows. Mic and instrument inputs have no level switch; TotalMix ignores a write to a channel that lacks one. Where one channel's list is shorter than the bus list (UFX III TRS outputs vs. XLR), the plugin offers the longer list and TotalMix ignores the extra entry.

If your interface is missing or a list is wrong, please open an issue with the entries TotalMix shows for inputs and outputs, and it can be added.
