
## Setup for OSC

Enable OSC in RME TotalMix FX' settings (let's call it TotalMix from here on for ease of typing) and have it listen to OSC commands.
Note that there are 4 OSC Remote Controllers available. If you already use one, set up two for the plugin specifically.
This plugin uses 2 of them, 1 and 2. 1 is used for the main actions, 2 is used for the background thread that mirrors TotalMix changes to the Loupedeck.

- Open "Options" -> "Settings..." in TotalMix, then open the tab "OSC".
- Make sure Remote Controller 1 has a checkmark next to "In Use". By default TotalMix will use the ports 7001 and 9001.

Note: on MacOS, you'll have to enter "127.0.0.1" in the Remote Controller Address textbox, otherwise it will not work.

- Please also set the "Number of faders per bank" to 16, or it will not fully work.
- Then, do the same for Remote Controller 2. It will default to 7002 and 9002.

If you (have to) change these ports, make sure updating them in the plugin config as well!

Then, make sure to enable "Enable OSC control". Also link both Remote Controllers to the submix. 

No additional software is needed. In theory this should also be able to control a TotalMix instance running on a different computer than the StreamDeck is attached to - as long as you can reach this machine on the given port with UDP packets. 

Note: if you're using a (software) firewall on your PC and/or any firewall between the StreamDeck and the target PC - make sure to allow the plugin to communicate with the TotalMix port as well as allow TotalMix to listen to it. 

## de.shells.totalmix.exe.config
Windows: %appdata%\Elgato\StreamDeck\Plugins\de.shells.totalmix.sdPlugin
contains the file de.shells.totalmix.exe.config (which is created with default values during the first start of the plugin and read during every start)

```xml
  <appSettings>
    <add key="interfaceIp" value="127.0.0.1" />
    <add key="interfacePort" value="7001" />
    <add key="interfaceSendPort" value="9001" />
    <add key="interfaceBackgroundPort" value="7002" />
    <add key="interfaceBackgroundSendPort" value="9002" />
  </appSettings>
```
where you can configure non-default values or the TotalMix connection.

