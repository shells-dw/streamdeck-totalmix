[← Documentation home](index.md)

# Troubleshooting

## Logs

Every key press, dial move and connection event is logged. When reporting an issue, attach the current log file:

- Windows: `%APPDATA%\Elgato\StreamDeck\Plugins\de.shells.totalmixgen2.sdPlugin\logs`
- macOS: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/de.shells.totalmixgen2.sdPlugin/logs`

## Nothing happens / keys show "—"

- *Enable OSC Control* in TotalMix's Options menu is off, or the Remote Controller is not *In Use*.
- The Remote Controller Address in TotalMix is empty. It must be `127.0.0.1` (or the Stream Deck machine's IP).
- A firewall prompt was declined. Both TotalMix and the plugin need to send and receive UDP.
- Ports don't match: TotalMix's *incoming* port is the plugin's *Port incoming* and vice versa. Defaults 7001/9001 (classic) and 7002/9002 (Global OSC).
- For the Global OSC actions, the controller's *Compatibility (Mode)* is not set to Global OSC, or *Send changes* / *Send status* are off in its Details.

## "Port already in use" in the log

Two connections share one incoming port — typically the classic and the Global OSC slot both on 7001, or the v3 plugin still running on the same controllers. Give each connection its own port (under *Connection* in the button, or *Defaults for new buttons* for new ones) and match it in TotalMix.

## The channel list is empty

The plugin reads channel names from TotalMix. With no connection the list stays empty; check the points above, then press the refresh button next to the list. On the classic actions the list is limited by *Number of faders per bank* in TotalMix's OSC settings.

## A key controls the wrong channel (classic)

The classic protocol addresses strips by position in the visible bank. Pin *Bus* and *Pin bank start* in the key's settings, and set channels to mono/stereo before assigning keys. The Global OSC actions address channels absolutely and don't have this problem.

## The meter well stays empty

*Send Level Messages* is off for the Global OSC controller — it's off by default in TotalMix. The classic actions have no meter.

## Reference level shows plain numbers

The interface isn't in the [device table](devices.md) yet, or TotalMix hasn't reported the device name (it arrives with *Send status*). Numbers still work; open an issue with your interface's list so it can be added.

## A Global OSC key doesn't react to a change made in TotalMix

Groups (mute / solo / fader) are receive-only in RME's protocol: TotalMix never reports their state, so those keys track their own presses. Everything else should follow; if it doesn't, check *Send changes* in the controller's Details.

## Buttons from the old plugin are gone

v3 buttons don't carry over — the actions were consolidated. See [Setup → Using both plugins](setup.md#using-both-plugins-coming-from-v3).

## DURec Stop needs two presses

That's TotalMix's own safeguard while recording, and the plugin keeps it.

## TotalMix stopped responding after sleep

Restart TotalMix. The plugin notices the restart and re-reads its state; on the classic connection it also clears its cached views.
