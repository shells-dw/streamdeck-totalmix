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

Enable OSC in RME TotalMix FX' settings (let's call it TotalMix from here on for ease of typing) and have it listen to OSC commands. Please also set the "Number of faders per bank" to 16, or it will not fully work.

![Setup TotalMix OSC](/docs/images/TM_OSC_setup.png) ![Enable OSC](/docs/images/TM_OSC_en.png) ![Setup TotalMix OSC 2](/docs/images/TM_OSC_setup2.png)

No additional software is needed. In theory this should also be able to control a TotalMix instance running on a different computer than the StreamDeck is attached to - as long as you can reach this machine on the given port with UDP packets. 

Note: if you're using a (software) firewall on your PC and/or any firewall between the StreamDeck and the target PC - make sure to allow the plugin to communicate with the TotalMix port as well as allow TotalMix to listen to it. 

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

- Toggle Channel Function: Currently it's possible to set mute and solo for up to each 16 input, playback and output channels. It can also load the current status of the channel mute/solo when you load a page that has these buttons on it, so they will directly switch the button image to the active state.

- Control Channels: Here you can set up individual channel actions for all 48 channels, including: setting the volume, pan, phase, phantom power, autoset, loopback, stereo, cue, gain, width, autolevel, eq and comp. Obviously not everything is available for every channel, for example: gain is only supported on input channels with preamps obviously.

### Actions

#### General

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

Enter the IP of the TotalMix instance to control (127.0.0.1 is fine when it runs on the same PC as StreamDeck), the port you set in TotalMix (labelled as "port incoming" in TotalMix) and select the function you want to use.

#### OSC: Toggle Channel Function

![StreamDeckPlugin_OSC_2](/docs/images/SD_P_OSC_2.png)

Enter the IP of the TotalMix instance to control (127.0.0.1 is fine when it runs on the same PC as StreamDeck), the port you set in TotalMix (labelled as "port incoming" in TotalMix) and select the function you want to use.
You have 16 Input, 16 Playback and 16 Output channels available (remember when I said you should set TotalMix to have 16 Faders per bank? That's partly why) for which you can each Mute or Solo.
Select the checkbox "Mirror TotalMix" to update the button's icon when it comes into focus in StreamDeck (e.g. when you open a folder containing the button, load a profile or start StreamDeck when it's on the top screen).
Note: due to the nature of how OSC works and I have implemented the solution this is not a permanent monitoring, it's only initialized on load of a button, if you then switch the status in TotalMix or by other means, it will not be reflected on the deck.

#### OSC: Control Channel

![StreamDeckPlugin_OSC_3](/docs/images/SD_P_OSC_3.png)

Enter the IP of the TotalMix instance to control (127.0.0.1 is fine when it runs on the same PC as StreamDeck), the port you set in TotalMix (labelled as "port incoming" in TotalMix) and select the function you want to use.
You have 16 Input, 16 Playback and 16 Output channels available (remember when I said you should set TotalMix to have 12 Faders per bank? That's partly why) plus Master, for which you can trigger functions.
Select the functions to use in the drop-down field below. If the function requires a value to send, for example Volume, enter the "Value" field with the value. Not all functions work on all channels. You can't, for example, set Gain on a channel that has no preamp. The acceptable values are:
* Volume: 0-100. 0 is &#8734;, 82 is 0dB, 100 is +6dB. _Available in all channels._
* Pan: L100 to R100. Enter 0 for center. _Available in all channels._
* Gain/Gain Right: 0-65. _Available in all input channels with preamp, Gain Right is only available on stereo channels._
* Width: -1.00 to 1.00. _Available in all input channels without preamp and all playback channels._
* Phantom Power, Autoset: no value. _Available in all input channels with preamp._
* Loopback, Cue: no value. _Available in all output channels._
* Phase, Phase Right, Stereo, Cue, EQ, Comp, AutoLevel Enable: no value. _Available in all channels, Phase Right only on stereo channels._


# Limitations

- Windows 10 with .NET Framework is required to run this plugin.
- OSC: getting the active state when loading a deck... it only checks when the deck is loaded, for example if you open a folder that contains those buttons, or switch to a profile that does, etc. so when stuff is changed on the UI in the computer, via MIDI or a snapshot is loaded, that will not reflect on the buttons. It will take roughly 2 seconds per input/playback/output group when a deck containing buttons that mirror TotalMix settings is opened, regardless how many buttons of that group are on the Deck. Meaning if you have 12 Input channel buttons, it will take 2 seconds, if you have 1 input, 1 playback and 1 output button, it will take 6.
- MIDI: I developed this on Windows, using virtualMidi with a RME Fireface UC (which was the only device I currently have access to). It should theoretically work with most other RME interfaces too, as long as they support TotalMix FX.
- There is no MacOS support. It would mean a total rewrite of the plugin in Xcode to have it work on MacOS natively, for which I don't have the time.
- MIDI: It needs a virtual MIDI port, writing my own drivers and have them signed is definitely above my skillset, so you'll have to install a driver for that additionally. (e.g. [virtualMidi][], [loopBe][])

# I have an issue or miss a feature?

You can submit an issue or request a feature with [GitHub issues]. Please describe as good as possible what went wrong and also include any log files as they are incredibly helpful for me to figure out what went wrong. Logs can be found in %APPDATA%\Elgato\StreamDeck\Plugins\de.shells.totalmix.sdPlugin, and will be named pluginlog.log.
As described above I developed this with a Fireface UC which is the only device I have at home and with that constant access to so debugging/developing for any other RME device might not be the the easiest task, but I'll see what I can do.

# Contribute

If you're interested in using this plugin but something you really need is missing, let me know. I naturally don't have access to all RME devices, so I can't really try things on the boxes themselves, but eventually we might find a way to work something out.

If you happen to have a working and proper MIDI implementation sheet for RME devices, I'd be happy to implement them in the plugin.
Currently the OSC documentation looks way better than what's there for MIDI. One could think they don't want people to develop these kind of things...

# Support

If you'd like to drop me a coffee for the hours I've spent on this: [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)]( https://www.paypal.com/donate?hosted_button_id=8KXD334CCEEC2)


# Changelog

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

