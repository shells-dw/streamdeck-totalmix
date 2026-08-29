[← Documentation home](index.md)

# Setup

The plugin talks to TotalMix over OSC on the local network (or the loopback interface when both run on the same machine). TotalMix offers four *Remote Controllers*; the plugin uses one per protocol:

| | Remote Controller | Mode | Ports (incoming / outgoing) |
|---|---|---|---|
| Classic actions | 1 | classic (default) | 7001 / 9001 |
| Global OSC actions "(TotalMix 2.1+)" | 2 | **Global OSC** | 7002 / 9002 |

Set up whichever family you intend to use; both only if you want both. Open **Options → Settings… → OSC** in TotalMix.

![Setup TotalMix OSC](images/OSC_setup1.png)

## Global OSC (TotalMix FX 2.1+)

1. Tick **In Use** on Remote Controller 2.
2. Enter `127.0.0.1` in *Remote Controller Address* (or the IP of the machine running Stream Deck).
3. Leave the ports at incoming 7002 / outgoing 9002 — those are the plugin's defaults.
4. Set *Compatibility (Mode)* to **Global OSC**.
5. Click *Details* and enable at least **Send changes** and **Send status**. Recommended as well: **Send faders in linear scale** and **Send all data on start (enable)**.
6. Tick **Send Level Messages** if you want peak meters on the fader strips and the Display action. It costs some traffic and nothing else; leave it off if you don't want meters.

![Global OSC](images/Global_OSC_setup1-1.png) ![Global OSC details](images/Global_OSC_setup1-2.png)

## Classic OSC (TotalMix FX 1.96 – 2.0, or the classic actions)

1. Tick **In Use** on Remote Controller 1.
2. Enter `127.0.0.1` (or the Stream Deck machine's IP) in *Remote Controller Address*.
3. Leave the ports at incoming 7001 / outgoing 9001.
4. Set **Number of faders per bank** to your interface's channel count. The plugin can only read as many channels as this allows.
5. Leave **Send Level Messages** off — the classic actions don't use meters.

![Classic OSC](images/OSC_setup2.png) ![Classic OSC](images/OSC_setup3.png)

## Finish, for either

- Tick **Enable OSC Control** in TotalMix's *Options* menu.
- Make sure *Submix linked to OSC Controller* is ticked for every Remote Controller that is *In Use*.
- When Windows or macOS asks whether TotalMix and the Stream Deck plugin may use the network, allow it. A blocked firewall prompt is the most common reason for "nothing happens".

No additional software is needed.

## If your ports or host are different

Every button carries its own connection settings under **Connection** in its property inspector. To avoid typing them on thirty buttons, open any action's inspector (except Effects & Dynamics, which only reads them) and expand **Defaults for new buttons**: host, ports and dB-per-step set there are copied into each button as you add it. They live in Stream Deck's own storage, so they survive plugin updates.

- Changing a default does not move buttons already on your deck; they keep the connection they were created with. This is deliberate — it lets one dial sit on Remote Controller 1 while another sits on a different slot.
- The classic and the Global OSC actions keep separate defaults, because they address separate controllers.
- TotalMix can run on another computer: set its IP as the host and allow UDP through any firewall in between.
- Every Remote Controller needs its own *incoming* port. If two connections share one (say both on 7001), the plugin logs a "port already in use" message naming the port.

## Using both plugins (coming from v3)

This plugin has a different UUID from the v3 plugin, so both install side by side — but they cannot share Remote Controllers. v3 uses controllers 1 and 2, and so does this one. If you want both active, move one to controller 3 or 4 and set the ports accordingly under *Connection* / *Defaults for new buttons*. Otherwise uninstall v3.

Buttons from v3 do not carry over. MIDI is gone (OSC does everything it did and reports state back); stay on 3.3.5 if you depend on it. The `de.shells.totalmix.exe.config` file is gone too — connection settings are per button.
