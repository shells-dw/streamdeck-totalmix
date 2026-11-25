[← Documentation home](index.md)

# Troubleshooting

## Logs

Every key press, dial move and connection event is logged. When reporting an issue, attach the current log file:

- Windows: `%APPDATA%\Elgato\StreamDeck\Plugins\de.shells.totalmixgen2.sdPlugin\logs`
- macOS: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/de.shells.totalmixgen2.sdPlugin/logs`

## Nothing happens / keys show "—"

- *Enable OSC Control* in TotalMix's Options menu is off, or the Remote Controller is not *In Use*.
- The Remote Controller Address in TotalMix is empty. It must be `127.0.0.1`, or the Stream Deck machine's IP address if that is a different computer.
- A firewall prompt was declined. Both TotalMix and the plugin need network access, even on one machine.
- Ports don't match: the plugin's *Port incoming* / *Port outgoing* are TotalMix's *incoming* / *outgoing* ports for that Remote Controller. Defaults 7001/9001 (classic) and 7002/9002 (Global OSC).
- For the Global OSC actions, the controller's *Compatibility (Mode)* is not set to Global OSC, or *Send changes* / *Send status* are off in its Details.

## Faders show "—" for a while after starting the PC

TotalMix streams meter levels and status before it answers requests, so the first requests after a start can go unanswered. The plugin asks again until the data arrives, a channel or submix up to five times over about 30 s; the log shows `no answer to /sendsubmix/… yet; asking again`. A fader that still reads "—" after that is on a channel TotalMix does not report: hidden for OSC Remote, or a channel number past what the interface has.

## A yellow notice at the top of a button's settings

The plugin shows what is wrong with that button's connection; the same sentence is in the log.

- *TotalMix sends Global OSC data … but this is a classic button* (or the reverse): the button and its Remote Controller use different protocols. Either change the controller's *Compatibility (Mode)* or use the matching actions. The actions marked "(TotalMix 2.1+)" are the Global OSC ones.
- *udp/… is already in use*: see below.
- *Nothing received from TotalMix* or *does not answer requests*: check the points under "Nothing happens" for the ports named in the notice.

## "Port already in use" in the log

The plugin listens on the controller's *outgoing* port, and something else holds it. The log line says which:

- *by this plugin's classic / Global OSC buttons*: classic and Global OSC buttons name the same port. Each family needs its own Remote Controller and port pair.
- *by another program*: another OSC application, the v3 plugin on the same controllers, or TotalMix itself with *Port incoming* set to that number. The log line carries a command that names the program.

The plugin keeps retrying, so the buttons start working once the port is free.

## The channel list is empty

The plugin reads channel names from TotalMix. With no connection the list stays empty; check the points above, then press the refresh button next to the list. On the classic actions the list is limited by *Number of faders per bank* in TotalMix's OSC settings.

## A channel is missing from the list (Global OSC)

Channels hidden for *OSC Remote* in TotalMix's *Channel Layout* are left out of the lists. From TotalMix FX 2.1 beta 6 on, TotalMix also stops exchanging data for hidden input and playback channels, so a key that was already on such a channel shows "—" or no longer reacts. Unhide the channel for OSC, then press the refresh button next to the list.

## A key controls the wrong channel (classic)

The classic protocol addresses strips by position in the visible bank. Pin *Bus* and *Pin bank start* in the key's settings, and set channels to mono/stereo before assigning keys. The Global OSC actions address channels absolutely and don't have this problem.

## The gain-reduction bar stays empty

The bar needs the meter, the *Gain reduction* checkbox on that key, the channel's dynamics section switched on and *Send Level Messages*. A dimmed track beside the meter shows the bar is armed.

## The meter well stays empty

*Send Level Messages* is off for the Global OSC controller, which is the default in TotalMix. The classic actions have no meter.

## Reference level shows plain numbers

The interface isn't in the [device table](devices.md) yet, or TotalMix hasn't reported the device name (it arrives with *Send status*). Numbers still work; open an issue with your interface's list so it can be added.

## A Global OSC key doesn't react to a change made in TotalMix

TotalMix never reports the window state, so the show / hide keys track their own presses. Everything else follows *Send changes* in the controller's Details.

## Buttons from the old plugin are gone

v3 buttons don't carry over, the actions were consolidated. See [Setup, using both plugins](setup.md#using-both-plugins-coming-from-v3).

## DURec Stop needs two presses

That's TotalMix's own safeguard while recording, and the plugin keeps it.

## TotalMix stopped responding after sleep

Restart TotalMix. The plugin notices the restart and re-reads its state; on the classic connection it also clears its cached views.
