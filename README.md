 ![GitHub](https://img.shields.io/github/license/shells-dw/streamdeck-totalmix)     ![GitHub last commit](https://img.shields.io/github/last-commit/shells-dw/streamdeck-totalmix)     [![Tip](https://img.shields.io/badge/Donate-PayPal-green.svg)]( https://www.paypal.com/donate?hosted_button_id=8KXD334CCEEC2) / [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y4CE9LH)


# Unofficial StreamDeck RME TotalMix FX Plugin - supporting MIDI and OSC

![Overview](/docs/images/GH_SocPic.png)

## What Is This (and what does it do?)

It's a plugin for the [Elgato Stream Deck][Stream Deck] that triggers actions as well as individual channel actions on the [RME TotalMix FX][] application.

It supports OSC protocol support which offers more functionality than MIDI commands (at least I implemented more in my plugin), is more solid than MIDI and doesn't interfere with your already existing MIDI setup.
The plugin however also supports MIDI wiht a limited feature set in case you don't want to use OSC.

## What Is It Not (and what can't it do?)

It's not a MIDI controller or axis emulator. The Elgato StreamDeck offers simple digital buttons. They are pressed and then a predefined action will trigger. You can thus not do anything that requires analog axis.
It also doesn't run on MacOS. Bummer, I know.

## Release / Installation

Inside the Release-folder you can find the precompiled plugin. Download and open it, your computer should already recognize this as a StreamDeck file and offer to open it with StreamDeck - which will have the plugin available in the list then.

## Setup for OSC

Enable OSC in RME TotalMix FX' settings (let's call it TotalMix from here on for ease of typing) and have it listen to OSC commands. Note that there are 4 OSC Remote Controllers available. If you already use one, set up two for the plugin specifically. This plugin uses 2 of them, 1 and 2. 1 is used for the main actions, 2 is used for the background thread that mirrors TotalMix changes to the Loupedeck.

- Open "Options" -> "Settings..." in TotalMix, then open the tab "OSC".
- Make sure Remote Controller 1 has a checkmark next to "In Use". By default TotalMix will use the ports 7001 and 9001.
- In the bottom, set the "Number of faders per bank" setting to reflect the amount of channels your interface offers (the plugin will offer channels based on that value).
- Then, do the same for Remote Controller 2. It will default to 7002 and 9002.

If you (have to) change these ports, make sure updating them in the plugin config as well!

Then, make sure to enable "Enable OSC control". Also link both Remote Controllers to the submix.

![Setup TotalMix OSC](/docs/images/OSC_setup1.png) ![Enable OSC](/docs/images/OSC_setup2.png)

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
Note: This had to be set on every button individually in older versions of this plugin. I decided to have a central location for these settings to unclutter the UI a bit.

## Setup for MIDI

_Only necessary if you do not use OSC or want to use MIDI alongside OSC._
You will need a MIDI driver on your device for TotalMix FX to monitor. If you already control TotalMix FX from a MIDI controller, this is probably not the thing for you anyways.
On Windows I used [virtualMidi][] but other packages like [loopBe][] should work just as well.

Once the virtual MIDI port is setup, select it in TotalMix, enable Mackie Control Support and make TotalMix listen to MIDI controls.

![Setup TotalMix MIDI](/docs/images/TM_MIDI_setup.png) ![Enable MIDI](/docs/images/TM_MIDI_en.png)

Triggering functions like loading snapshots/mixes, global mute, etc. will work without Mackie Support, but changing gains won't. So if you don't want to use that, you could theoretically leave Mackie Support off (for whatever reason you might have to do so).

Now, after installing the plugin to StreamDeck, you will see all MIDI devices your system knows about. Select the virtual MIDI port you set up (the one TotalMix listens to) as target. You will need to do that for every action you put on the StreamDeck console.

## Usage
### General

There are currently 5 options:

![StreamDeckPlugin_Category](/docs/images/SD_P_Cat.png)

#### MIDI

- Trigger Function: including loading snapshots, CUE, control room functions, master solo/mute/trim gains, mute hardware outputs.

- Control Fader and Gains: set fader values on all faders (on 16 hardware inputs, 16 software inputs, 16 hardware outputs which should be plenty for most RME devices) and set gain on 16 hardware input channels. Again, as the StreamDeck only offers digital buttons, you can only set a value that will then be triggered, for example 0db and max attenuation.

You can however include multiple instances of the actions in a multi-action (available by default with the StreamDeck software) to create setups with multiple changes, for example change multiple faders at once to quickly switch between multiple output paths. For example: One multi-action changes output 1 and 2 to max attenuation and puts 3/4 on 0dB, another action does the same reversed.

#### OSC

- Trigger Global Function: It supports loading snapshots/mixes and toggle master solo/mute, toggle FX reverb/echo, control room/main functions as well as activating fader groups, mute groups and solo groups.

- Toggle Channel Function: Currently it's possible to set mute and solo for up to each 16 input, playback and output channels. It can also mirror the current status of the channel mute/solo and show respective button images (reportedly not working with Windows 11).

- Control Channels: Here you can set up individual channel actions for all 48 channels, including: setting the volume, pan, phase, phantom power, autoset, loopback, stereo, cue, gain, width, autolevel, eq and comp. Obviously not everything is available for every channel, for example: gain is only supported on input channels with preamps obviously.

## Actions

### General

It's important to understand that whenever you can select a channel in the dropdown selection in this plugin, this affects TotalMix channel strips as you see them in the software. TotalMix combines a stereo channel to one channel strip. You will not have control over each individual mono channel that's part of a stereo channel.
What that means is that if you have, for example, a stereo output channel AN1/2, this will be output channel 1. AN3 will be output channel 2 then. However if you have AN1 and AN2 set to mono, AN3 is output channel 3 then. Bear that in mind when you configure actions that are targeted to individual channels
across multiple snapshots/mixes or when you change your channel layouts in regards to mono/stereo channels in TotalMix as this will likely break those actions on the StreamDeck and trigger actions on the wrong channels.

Sadly I can't do anything about that, it's just how TotalMix works currently.

#### MIDI: Trigger TotalMix Function

Select the MIDI device to use and the action you want to send. Simple as that!

![StreamDeckPlugin_Trigger](/docs/images/SD_P_T.png)


#### MIDI: Control Fader and Gains

Select the MIDI device to use and the channel you want to control the fader on, then set the desired value.

![StreamDeckPlugin_ControlChange](/docs/images/SD_P_CC.png)

This works as follows: the acceptable range is between a value of 0 - which is max attenuation (infinity) - and 127 which is max level. 0dB is a value of 104. I thought a while on how to make that kind of easier for the user, but didn't come up with anything that would work flexible, logical and still very detailed, so I kept it that way for now. If you got a good idea, tell me :-)

If you select Input Gain as target, the acceptable values are 0 to 65, just as in TotalMix FX.

#### OSC: Trigger Global Function

![StreamDeckPlugin_OSC](/docs/images/SD_P_OSC.png)

Select the function you want to use. Enabling the "Hold Mode" will only trigger the function as long as the button is pressed. Note: when selecting Snapshots, the Hold Mode will automaically engange.

#### OSC: Toggle Channel Function

![StreamDeckPlugin_OSC_2](/docs/images/SD_P_OSC_2.png)

Select the checkbox "Mirror TotalMix" to update the button's icon when it comes into focus in StreamDeck (e.g. when you open a folder containing the button, load a profile or start StreamDeck when it's on the top screen).

#### OSC: Control Channel

![StreamDeckPlugin_OSC_3](/docs/images/SD_P_OSC_3.png)

Select the functions to use in the drop-down field below. If the function requires a value to send, for example Volume, enter the "Value" field with the value. Not all functions work on all channels. You can't, for example, set Gain on a channel that has no preamp. The acceptable values are:
* Volume: 0-100. 0 is &#8734;, 82 is 0dB, 100 is +6dB. _Available in all channels._
* Pan: L100 to R100. Enter 0 for center. _Available in all channels._
* Gain/Gain Right: 0-65. _Available in all input channels with preamp, Gain Right is only available on stereo channels._
* Width: -1.00 to 1.00. _Available in all input channels without preamp and all playback channels._
* Phantom Power, Autoset: no value. _Available in all input channels with preamp._
* Loopback, Cue: no value. _Available in all output channels._
* Phase, Phase Right, Stereo, Cue, EQ, Comp, AutoLevel Enable: no value. _Available in all channels, Phase Right only on stereo channels._


# Limitations

- There is no MacOS support currently. I started looking into it, but no promises, this is all free-time hobby coding...
- MIDI: I developed this on Windows, using virtualMidi with a RME Fireface UC (which was the only device I currently have access to). It should theoretically work with most other RME interfaces too, as long as they support TotalMix FX.
- MIDI: It needs a virtual MIDI port, writing my own drivers and have them signed is definitely above my skillset, so you'll have to install a driver for that additionally. (e.g. [virtualMidi][], [loopBe][])

# I have an issue or miss a feature?

You can submit an issue or request a feature with [GitHub issues]. Please describe as good as possible what went wrong and also include any log files as they are incredibly helpful for me to figure out what went wrong. Logs can be found in %APPDATA%\Elgato\StreamDeck\Plugins\de.shells.totalmix.sdPlugin, and will be named pluginlog.log.
As described above I developed this with a Fireface UC which is the only device I have at home and with that constant access to so debugging/developing for any other RME device might not be the the easiest task, but I'll see what I can do.

# Contribute

If you're interested in using this plugin but something you really need is missing, let me know. I naturally don't have access to all RME devices, so I can't really try things on the boxes themselves, but eventually we might find a way to work something out.

If you happen to have a working and proper MIDI implementation sheet for RME devices, I'd be happy to implement them in the plugin.
Currently the OSC documentation looks way better than what's there for MIDI. One could think they don't want people to develop these kind of things...

# Support

If you'd like to drop me a coffee for the hours I've spent on this: [![Tip](https://img.shields.io/badge/Donate-PayPal-green.svg)]( https://www.paypal.com/donate?hosted_button_id=8KXD334CCEEC2) or use Ko-Fi [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y4CE9LH)


# Changelog## [3.1.1] - 2022-12-05
### Improved
- Made track/channel name display optional but default for all actions 
## [3.1.0] - 2022-12-05
### Improved
- Support for more/less than 16 channels!
    - During button load the plugin now tries to determine how many channels your interface offers (which is rather what the user set in "faders per bank" setting in TotalMix OSC setup) and offers these channels now in the plugin
    -> which allows interfaces with more (or less) channels to be fully supported as well now :)
## [3.0.0] - 2022-12-02
### General
- Partial rewrite of the plugin with lots of improvements, not necessarily every little change will be represented here
- This update might not be completely compatible with existing actions/buttons made with earlier versions. You might have to redo your buttons. It's annoying, I know, but I can't keep multiple code-bases to cover all eventualities active in the same plugin to keep full compatibility.
### Updated
- Mirror function reworked. Switched the library and how it's implemented to make it more robust, quicker, less ressource intensive and compatible with Windows 11
- added multiple additional icons to make actions more clear (less using default "Mixer"-style logo which made different actions look the same)
- Track names (channel names) as set in TotalMix are reflected on the StreamDeck to make it easier to distinguish buttons.
- Phantom Power is now able to be mirrored too and moved to Trigger Channel Functions
- overall more beautification ;)
### Fixed
- Windows 11 issues should be fixed now.
- Plugin (or at least mirroring) stopping working after it ran a while should be fixed now.
- Some less common actions have been sending a wrong value and never worked - fixed now.
## [2.2.1] - 2022-05-14
### Updated
- updated readme.md to reflect potential issues with Windows 11 and mirror channel
- moved files locally from a dying drive, git recognizes them all as modified now and I can't be bothered to mess with that, so I'm pushing it, but nothing should have changed except for a bit of debugging I added for testing this Windows 11 thing in osconoff.cs.
## [2.2.0] - 2022-04-29
### Improvement
- Updated default graphics
- Updated README.md to reflect graphics changes
## [2.1.0] - 2022-04-28
### Improvement
- Show/Hide UI should work now even when/after moving back to Stream Deck top level
### Various
- removed unused namespaces from all modules, cleaned up a bit, updated readme.md
## [2.0.0] - 2022-04-20
### Feature
- hold-mode (no latch mode) for OSC Global Functions
- enable toggle icons for all modules
### Fixed
- various minor fixes
## [1.2.1] - 2021-07-04
### Fixed
- calulations updated for 16 channels in OSC Channel handling
## [1.2.0] - 2021-07-04
### Fixed
- Mirrored buttons initilization delay

### Added
- Real time updates for channel mute/solo. StreamDeck should now (with a slight delay at times for technical reasons) update the button state if a channel is muted or solo-ed inside TotalMix or by other means (if you enable the mirror-checkbox on that button)
- Option to hide/restore the TotalMix window (using Windows techniques, haven't found out how RME does that with ARC, probably not exposed for third parties)
- Support for up to 48 channels (3x 16) _pending testing, I don't have access to a 16 channel RME interface myself at the moment_

# Disclaimer
I'm in no way affiliated with RME or Elgato. I wrote this plugin out of personal interest.

<!-- Reference Links -->

[Stream Deck]: https://www.elgato.com/gaming/stream-deck/ "Elgato's Stream Deck product page"
[RME TotalMix FX]: https://www.rme-audio.de/totalmix-fx.html "RME's TotalmMix FX product page"
[RME ARC USB]: https://www.rme-audio.de/arc-usb.html "RME's ARC USB product page"
[virtualMidi]: https://www.tobias-erichsen.de/software/virtualmidi.html "virtualMIDI product page"
[loopBe]: https://www.nerds.de/en/loopbe1.html "loopBe product page"
[GitHub issues]: https://github.com/shells-dw/streamdeck-totalmix/issues "GitHub issues link"

