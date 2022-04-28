// sdtools.common.js v1.0
var websocket = null,
    uuid = null,
    registerEventName = null,
    actionInfo = {},
    inInfo = {},
    runningApps = [],
    isQT = navigator.appVersion.includes('QtWebEngine');

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUUID;
    registerEventName = inRegisterEvent;
    // console.log(inUUID, inActionInfo);
    actionInfo = JSON.parse(inActionInfo); // cache the info
    inInfo = JSON.parse(inInfo);
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    addDynamicStyles(inInfo.colors);

    websocket.onopen = websocketOnOpen;
    websocket.onmessage = websocketOnMessage;

    // Allow others to get notified that the websocket is created
    var event = new Event('websocketCreate');
    document.dispatchEvent(event);
    loadConfiguration(actionInfo);
    if (actionInfo.action === "de.shells.totalmix.osctoggle.action") {
        Name = actionInfo.payload.settings.Name;
        Port = actionInfo.payload.settings.Port;
        IP = actionInfo.payload.settings.IP;
        SelectedAction = actionInfo.payload.settings.SelectedAction;
        Latch = actionInfo.payload.settings.Latch;
    } else if (actionInfo.action === "de.shells.totalmix.osconoff.action") {
        Name = actionInfo.payload.settings.Name;
        Port = actionInfo.payload.settings.Port;
        ListeningPort = actionInfo.payload.settings.ListeningPort;
        IP = actionInfo.payload.settings.IP;
        SelectedAction = actionInfo.payload.settings.SelectedAction;
        Bus = actionInfo.payload.settings.Bus;
        SelectedValue = actionInfo.payload.settings.SelectedValue;
        MuteSolo = actionInfo.payload.settings.MuteSolo;
        IncludeOscOnOff = actionInfo.payload.settings.IncludeOscOnOff;
    } else if (actionInfo.action === "de.shells.totalmix.oscchannel.action") {
        Name = actionInfo.payload.settings.Name;
        Port = actionInfo.payload.settings.Port;
        IP = actionInfo.payload.settings.IP;
        SelectedAction = actionInfo.payload.settings.SelectedAction;
        Bus = actionInfo.payload.settings.Bus;
        SelectedValue = actionInfo.payload.settings.SelectedValue;
        SelectedFunction = actionInfo.payload.settings.SelectedFunction;
    } else if (actionInfo.action === "de.shells.totalmix.midinote.action") {
        Channel = actionInfo.payload.settings.Channel;
        SelectedMidiAction = actionInfo.payload.settings.SelectedMidiAction;
        MidiNote = actionInfo.payload.settings.MidiNote;
        SelectedDevice = actionInfo.payload.settings.SelectedDevice;
        Devices = actionInfo.payload.settings.Devices;
    } else if (actionInfo.action === "de.shells.totalmix.midicc.action") {
        Channel = actionInfo.payload.settings.Channel;
        Control = actionInfo.payload.settings.Control;
        ControlValue = actionInfo.payload.settings.ControlValue;
        SelectedDevice = actionInfo.payload.settings.SelectedDevice;
        Devices = actionInfo.payload.settings.Devices;
    }
}

function websocketOnOpen() {
    var json = {
        event: registerEventName,
        uuid: uuid
    };
    websocket.send(JSON.stringify(json));

    // Notify the plugin that we are connected
    sendValueToPlugin('propertyInspectorConnected', 'property_inspector');
}

function websocketOnMessage(evt) {
    // console.log("received event:");
    // console.log(evt.data);
    // Received message from Stream Deck
    var jsonObj = JSON.parse(evt.data);

    if (jsonObj.event === 'sendToPropertyInspector') {
        var payload = jsonObj.payload;
        loadConfiguration(payload);
    }
    else if (jsonObj.event === 'didReceiveSettings') {
        var payload = jsonObj.payload;
        loadConfiguration(payload);
        // console.log("didReceiveSettings");
        // console.log(payload.settings);
    }
    else {
        // console.log("Unhandled websocketOnMessage: " + jsonObj.event);
    }
}

function loadConfiguration(payload) {
    // console.log('loadConfiguration');
    // console.log(payload);
    if (payload.payload != undefined) {
        updateUI(payload.action, payload.payload.settings);
    } else {
        updateUI(actionInfo.action, payload.settings);
    }
}

function setSettings(value, param) {
    // console.log("setSettings start:");
    // console.log(actionInfo.payload.settings);
    var payload = {};
    payload[param] = value;
    // console.log("setSettings payload:");
    // console.log(payload);
    let settings;
    if (param === "IP") { IP = payload.IP }
    if (param === "Port") { Port = payload.Port }
    if (param === "ListeningPort") { ListeningPort = payload.ListeningPort }
    if (param === "Name") { Name = payload.Name }
    if (param === "SelectedAction") { SelectedAction = payload.SelectedAction }
    if (param === "Latch") { Latch = payload.Latch }
    if (param === "SelectedMidiAction") { SelectedMidiAction = payload.SelectedMidiAction }
    if (param === "Bus") { Bus = payload.Bus }
    if (param === "SelectedValue") { SelectedValue = payload.SelectedValue }
    if (param === "MuteSolo") { MuteSolo = payload.MuteSolo }
    if (param === "Channel") { Channel = payload.Channel }
    if (param === "MidiNote") { MidiNote = payload.MidiNote }
    if (param === "SelectedDevice") { SelectedDevice = payload.SelectedDevice }
    if (param === "SelectedFunction") { SelectedFunction = payload.SelectedFunction }
    if (param === "Devices") { Devices = payload.Devices }
    if (param === "Control") { Control = payload.Control }
    if (param === "ControlValue") { ControlValue = payload.ControlValue }
    if (param === "IncludeOscOnOff") { IncludeOscOnOff = payload.IncludeOscOnOff }
    if (actionInfo.action === "de.shells.totalmix.osctoggle.action") {
        settings = {
            IP: IP,
            Port: Port,
            Name: Name,
            SelectedAction: SelectedAction,
            Latch: Latch
        }
    } else if (actionInfo.action === "de.shells.totalmix.osconoff.action") {
        settings = {
            IP: IP,
            Port: Port,
            ListeningPort: ListeningPort,
            Name: Name,
            SelectedAction: SelectedAction,
            Bus: Bus,
            SelectedValue: SelectedValue,
            MuteSolo: MuteSolo,
            IncludeOscOnOff: IncludeOscOnOff
        }
    } else if (actionInfo.action === "de.shells.totalmix.oscchannel.action") {
        settings = {
            IP: IP,
            Port: Port,
            Name: Name,
            SelectedAction: SelectedAction,
            Bus: Bus,
            SelectedValue: SelectedValue,
            SelectedFunction: SelectedFunction
        }
    } else if (actionInfo.action === "de.shells.totalmix.midinote.action") {
        settings = {
            Channel: Channel,
            SelectedMidiAction: SelectedMidiAction,
            MidiNote: MidiNote,
            SelectedDevice: SelectedDevice,
            Devices: Devices
        }
    } else if (actionInfo.action === "de.shells.totalmix.midicc.action") {
        settings = {
            Channel: Channel,
            Control: Control,
            ControlValue: ControlValue,
            SelectedDevice: SelectedDevice,
            Devices: Devices
        }
    }

    // console.log("setSettings end:");
    // console.log(settings);
    setSettingsToPlugin(settings);
}



function setSettingsToPlugin(payload) {
    if (websocket && (websocket.readyState === 1)) {
        const json = {
            'event': 'setSettings',
            'context': uuid,
            'payload': payload
        };
        websocket.send(JSON.stringify(json));
        var event = new Event('settingsUpdated');
        document.dispatchEvent(event);
    }
}

// Sends an entire payload to the sendToPlugin method
function sendPayloadToPlugin(payload) {
    if (websocket && (websocket.readyState === 1)) {
        const json = {
            'action': actionInfo['action'],
            'event': 'sendToPlugin',
            'context': uuid,
            'payload': payload
        };
        websocket.send(JSON.stringify(json));
    }
}

// Sends one value to the sendToPlugin method
function sendValueToPlugin(value, param) {
    if (websocket && (websocket.readyState === 1)) {
        const json = {
            'action': actionInfo['action'],
            'event': 'sendToPlugin',
            'context': uuid,
            'payload': {
                [param]: value
            }
        };
        websocket.send(JSON.stringify(json));
    }
}

function openWebsite() {
    if (websocket && (websocket.readyState === 1)) {
        const json = {
            'event': 'openUrl',
            'payload': {
                'url': 'https://github.com/shells-dw/streamdeck-totalmix'
            }
        };
        websocket.send(JSON.stringify(json));
    }
}

if (!isQT) {
    document.addEventListener('DOMContentLoaded', function () {
        initPropertyInspector();
    });
}

window.addEventListener('beforeunload', function (e) {
    e.preventDefault();

    // Notify the plugin we are about to leave
    sendValueToPlugin('propertyInspectorWillDisappear', 'property_inspector');

    // Don't set a returnValue to the event, otherwise Chromium with throw an error.
});

function initPropertyInspector() {

}

function updateUI(pl, settings) {
    // console.log("updateUI pl:");
    // console.log(pl);
    // console.log("updateUI settings:");
    // console.log(settings);
    if (pl === "de.shells.totalmix.midinote.action") {
        let x = ['<div class="sdpi-item" id="devices">',
            '<div class="sdpi-item-label">Midi Device</div>',
            '<select class="sdpi-item-value select" id="selDevices" onchange="setSettings(event.target.value, \'SelectedDevice\')">',
            '</select>',
            '</div>',
            '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Function</div>',
            '    <select class="sdpi-item-value select" id="FunctSelect" onchange="mapToMidiNote(event.target.value)">',
            '    <optgroup label="Snapshots">',
            '        <option value="1">Snapshot 1</option>',
            '        <option value="2">Snapshot 2</option>',
            '        <option value="3">Snapshot 3</option>',
            '        <option value="4">Snapshot 4</option>',
            '        <option value="5">Snapshot 5</option>',
            '        <option value="6">Snapshot 6</option>',
            '        <option value="7">Snapshot 7</option>',
            '        <option value="8">Snapshot 8</option>',
            '    </optgroup>',
            '    <optgroup label="Cue">',
            '        <option value="9">Cue Main Out / PH 7/8</option>',
            '        <option value="10">Cue Phones 1</option>',
            '        <option value="11">Cue Phones 2</option>',
            '        <option value="12">Cue Phones 3</option>',
            '        <option value="13">Cue Phones 4</option>',
            '    </optgroup>',
            '    <optgroup label="Main/Control Room">',
            '        <option value="14">Dim</option>',
            '        <option value="15">Mono</option>',
            '        <option value="16">Talkback</option>',
            '        <option value="17">Recall</option>',
            '        <option value="18">Speaker B</option>',
            '    </optgroup>',
            '    <optgroup label="Master">',
            '        <option value="19">Master Solo</option>',
            '        <option value="20">Master Mute</option>',
            '        <option value="21">Trim Gains</option>',
            '    </optgroup>',
            '    <optgroup label="Mute Hardware Outputs (mutes both on Stereo)">',
            '        <option value="22">Mute PH 7</option>',
            '        <option value="23">Mute PH 8</option>',
            '        <option value="24">Mute SPDIF L</option>',
            '        <option value="25">Mute SPDIF R</option>',
            '        <option value="26">Mute AS 1</option>',
            '        <option value="27">Mute AS 2</option>',
            '        <option value="28">Mute ADAT 3</option>',
            '        <option value="29">Mute ADAT 4</option>',
            '    </optgroup></select>',
            '</div>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Details</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>More Info</summary>',
            '        <p>Make sure TotalMix FX listens to a MIDI driver on your system, has Mackie Control Support enabled to be able to use all functions - and actually listens to MIDI ("in use" checkbox).</p>',
            '        <p><b>Midi Device</b><br>Select MIDI device that TotalMix monitors</p>',
            '        <p><b>Select Function</b><br>Select the function you want to trigger in TotalMix</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');

        document.getElementById('placeholder').innerHTML = x;
        document.getElementById('FunctSelect').value = settings.SelectedMidiAction;
        document.getElementById('selDevices').value = settings.SelectedDevice;

        let newSelect = document.getElementById('selDevices');
        newSelect.innerHTML = '';
        if (!settings.Devices) {
            setTimeout(2000);
        }
        for (let i = 0; i < settings.Devices.length; i++) {
            const element = settings.Devices[i];
            var opt = document.createElement("option");
            opt.value = i;
            opt.innerHTML = element;
            newSelect.appendChild(opt);
        }
        newSelect.value = settings.SelectedDevice;

    } else if (pl === "de.shells.totalmix.midicc.action") {
        let x = ['<div class="sdpi-item" id="devices">',
            '<div class="sdpi-item-label">Midi Device</div>',
            '<select class="sdpi-item-value select" id="selDevices" onchange="setSettings(event.target.value, \'SelectedDevice\')">',
            '</select>',
            '</div>',
            '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Channel</div>',
            '    <select class="sdpi-item-value select" id="ControlChange" onchange="setControlChangeSetting(event.target.value)">',
            '    <optgroup label="Fader Setting Hardware Inputs">',
            '        <option value="1-HI">Hardware Input 1</option>',
            '        <option value="2-HI">Hardware Input 2</option>',
            '        <option value="3-HI">Hardware Input 3</option>',
            '        <option value="4-HI">Hardware Input 4</option>',
            '        <option value="5-HI">Hardware Input 5</option>',
            '        <option value="6-HI">Hardware Input 6</option>',
            '        <option value="7-HI">Hardware Input 7</option>',
            '        <option value="8-HI">Hardware Input 8</option>',
            '        <option value="9-HI">Hardware Input 9</option>',
            '        <option value="10-HI">Hardware Input 10</option>',
            '        <option value="11-HI">Hardware Input 11</option>',
            '        <option value="12-HI">Hardware Input 12</option>',
            '        <option value="13-HI">Hardware Input 13</option>',
            '        <option value="14-HI">Hardware Input 14</option>',
            '        <option value="15-HI">Hardware Input 15</option>',
            '        <option value="16-HI">Hardware Input 16</option>',
            '    </optgroup>',
            '    <optgroup label="Fader Setting Software Inputs">',
            '        <option value="1-SI">Software Input 1</option>',
            '        <option value="2-SI">Software Input 2</option>',
            '        <option value="3-SI">Software Input 3</option>',
            '        <option value="4-SI">Software Input 4</option>',
            '        <option value="5-SI">Software Input 5</option>',
            '        <option value="6-SI">Software Input 6</option>',
            '        <option value="7-SI">Software Input 7</option>',
            '        <option value="8-SI">Software Input 8</option>',
            '        <option value="9-SI">Software Input 9</option>',
            '        <option value="10-SI">Software Input 10</option>',
            '        <option value="11-SI">Software Input 11</option>',
            '        <option value="12-SI">Software Input 12</option>',
            '        <option value="13-SI">Software Input 13</option>',
            '        <option value="14-SI">Software Input 14</option>',
            '        <option value="15-SI">Software Input 15</option>',
            '        <option value="16-SI">Software Input 16</option>',
            '    </optgroup>',
            '    <optgroup label="Fader Setting Hardware Outputs">',
            '        <option value="1-HO">Hardware Output 1</option>',
            '        <option value="2-HO">Hardware Output 2</option>',
            '        <option value="3-HO">Hardware Output 3</option>',
            '        <option value="4-HO">Hardware Output 4</option>',
            '        <option value="5-HO">Hardware Output 5</option>',
            '        <option value="6-HO">Hardware Output 6</option>',
            '        <option value="7-HO">Hardware Output 7</option>',
            '        <option value="8-HO">Hardware Output 8</option>',
            '        <option value="9-HO">Hardware Output 9</option>',
            '        <option value="10-HO">Hardware Output 10</option>',
            '        <option value="11-HO">Hardware Output 11</option>',
            '        <option value="12-HO">Hardware Output 12</option>',
            '        <option value="13-HO">Hardware Output 13</option>',
            '        <option value="14-HO">Hardware Output 14</option>',
            '        <option value="15-HO">Hardware Output 15</option>',
            '        <option value="16-HO">Hardware Output 16</option>',
            '    </optgroup>',
            '    <optgroup label="Gain Setting Hardware Inputs">',
            '        <option value="1-GI">Gain Hardware Input Channel 1</option>',
            '        <option value="2-GI">Gain Hardware Input Channel 2</option>',
            '        <option value="3-GI">Gain Hardware Input Channel 3</option>',
            '        <option value="4-GI">Gain Hardware Input Channel 4</option>',
            '        <option value="5-GI">Gain Hardware Input Channel 5</option>',
            '        <option value="6-GI">Gain Hardware Input Channel 6</option>',
            '        <option value="7-GI">Gain Hardware Input Channel 7</option>',
            '        <option value="8-GI">Gain Hardware Input Channel 8</option>',
            '        <option value="9-GI">Gain Hardware Input Channel 9</option>',
            '        <option value="10-GI">Gain Hardware Input Channel 10</option>',
            '        <option value="11-GI">Gain Hardware Input Channel 11</option>',
            '        <option value="12-GI">Gain Hardware Input Channel 12</option>',
            '        <option value="13-GI">Gain Hardware Input Channel 13</option>',
            '        <option value="14-GI">Gain Hardware Input Channel 14</option>',
            '        <option value="15-GI">Gain Hardware Input Channel 15</option>',
            '        <option value="16-GI">Gain Hardware Input Channel 16</option>',
            '    </optgroup></select>',
            '</div>',
            '<div class="sdpi-item" id="value_value">',
            '    <div class="sdpi-item-label">Fader/Gain Value</div>',
            '    <input id="txtValue" class="sdpi-item-value" type="number" inputmode="numeric" pattern="[0-9]*"',
            '        placeholder="Fader Value 0-127 / Gain 0-65" onchange="setFaderGainSetting(event.target.value)" />',
            '</div>',
            '<details class="message">',
            '<summary>Fader: 0 is infinity, 104 is 0dB 127 is max volume</summary>',
            '</details>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Details</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>More Info</summary>',
            '        <p>Make sure TotalMix FX listens to a MIDI driver on your system, has Mackie Control Support enabled to be able to use all functions - and actually listens to MIDI ("in use" checkbox).</p>',
            '        <p>Midi Device<br>Select MIDI device that TotalMix monitors</p>',
            '        <p>Select Channel<br>Select the Channel you want to change the fader/gain setting on<br>Note: Stereo channels count as 1, so for example AN1/2 are channel 1, AN3 would be channel 2 then.</p>',
            '        <p>Fader/Gain Value<br>Enter the desired fader/gain value. The range on faders is 0 to 127 and 0dB is 104<br>The range on gain is 0 to 65</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');
        document.getElementById('placeholder').innerHTML = x;

        let getMidiCCIndex = midiCCMapping.indexOf(settings.Channel + "-" + settings.Control);
        if (settings.Channel <= 4 && settings.Control !== 9) {
            getMidiCCIndex = getMidiCCIndex + 1;
            getMidiCCIndex = getMidiCCIndex + "-HI";
        } else if (settings.Channel >= 5 && settings.Channel <= 8 && settings.Control !== 9) {
            let calc = Math.floor(getMidiCCIndex / 16)
            getMidiCCIndex = getMidiCCIndex - (calc * 16) + 1
            getMidiCCIndex = getMidiCCIndex + "-SI";
        } else if (settings.Channel >= 9 && settings.Channel <= 12 && settings.Control !== 9) {
            let calc = Math.floor(getMidiCCIndex / 16)
            getMidiCCIndex = getMidiCCIndex - (calc * 16) + 1
            getMidiCCIndex = getMidiCCIndex + "-HO";
        } else if (settings.Control === 9) {
            let calc = Math.floor(getMidiCCIndex / 16)
            getMidiCCIndex = getMidiCCIndex - (calc * 16) + 1
            getMidiCCIndex = getMidiCCIndex + "-GI";
        }
        // console.log("ControlChange: " + getMidiCCIndex);
        document.getElementById('ControlChange').value = getMidiCCIndex;
        document.getElementById('txtValue').value = settings.ControlValue;
        document.getElementById('selDevices').value = settings.SelectedDevice;

        let newSelect = document.getElementById('selDevices');
        newSelect.innerHTML = '';
        for (let i = 0; i < settings.Devices.length; i++) {
            const element = settings.Devices[i];
            var opt = document.createElement("option");
            opt.value = i;
            opt.innerHTML = element;
            newSelect.appendChild(opt);
        }
        newSelect.value = settings.SelectedDevice;

    } else if (pl === "de.shells.totalmix.osctoggle.action") {
        let x = ['<div class="sdpi-item" id="required_text">',
            '<div class="sdpi-item-label">IP-Address</div>',
            '<input class="sdpi-item-value" id="totalmixIP" value="127.0.0.1" placeholder="192.168.1.150" required pattern="\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" onchange="setSettings(event.target.value, \'IP\')">',
            '</div>',
            '<div class="sdpi-item" id="required_text">',
            '<div class="sdpi-item-label">Port</div>',
            '<input class="sdpi-item-value" id="totalmixPort" value="7001" placeholder="7001" required pattern="\\d{1,5}" onchange="setSettings(event.target.value, \'Port\')">',
            '</div>',
            '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Function</div>',
            '    <select class="sdpi-item-value select" id="OscToggleSelect" onchange="selectedOscTriggerCommand(event.target.value)">',
            '    <optgroup label="Snapshots">',
            '        <option value="1">Snapshot 1</option>',
            '        <option value="2">Snapshot 2</option>',
            '        <option value="3">Snapshot 3</option>',
            '        <option value="4">Snapshot 4</option>',
            '        <option value="5">Snapshot 5</option>',
            '        <option value="6">Snapshot 6</option>',
            '        <option value="7">Snapshot 7</option>',
            '        <option value="8">Snapshot 8</option>',
            '    </optgroup>',
            '    <optgroup label="Global">',
            '        <option value="9">Global Mute</option>',
            '        <option value="10">Global Solo</option>',
            '    </optgroup>',
            '    <optgroup label="FX">',
            '        <option value="11">Reverb Enable</option>',
            '        <option value="12">Echo Enable</option>',
            '    </optgroup>',
            '    <optgroup label="Main">',
            '        <option value="13">Trim</option>',
            '        <option value="14">Dim</option>',
            '        <option value="15">Speaker B</option>',
            '        <option value="16">Recall</option>',
            '        <option value="17">Mute FX</option>',
            '        <option value="18">Mono</option>',
            '        <option value="19">External In</option>',
            '        <option value="20">Talkback</option>',
            '    </optgroup>',
            '    <optgroup label="Control Groups">',
            '        <option value="21">Mute Groups 1</option>',
            '        <option value="22">Mute Groups 2</option>',
            '        <option value="23">Mute Groups 3</option>',
            '        <option value="24">Mute Groups 4</option>',
            '        <option value="25">Solo Groups 1</option>',
            '        <option value="26">Solo Groups 2</option>',
            '        <option value="27">Solo Groups 3</option>',
            '        <option value="28">Solo Groups 4</option>',
            '        <option value="29">Fader Groups 1</option>',
            '        <option value="30">Fader Groups 2</option>',
            '        <option value="31">Fader Groups 3</option>',
            '        <option value="32">Fader Groups 4</option>',
            '    </optgroup>',
            '    <optgroup label="UI">',
            '        <option value="33">Show/Hide Totalmix UI</option>',
            '    </optgroup></select > ',
            '</div>',
            '<div type="checkbox" class="sdpi-item">',
            '       <div class="sdpi-item-label">Hold Mode (only active while pressed)</div>',
            '       <input class="sdpi-item-value" id="chk0" type="checkbox" value="nolatch" onclick="latch(this);setSettings(document.getElementById(\'chk0\').value, \'nolatch\')""">',
            '       <label for="chk0"><span></span></label>',
            '</div>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Details</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>More Info</summary>',
            '        <p>Make sure TotalMix FX has OSC setup and it\'s in use.</p>',
            '        <p>Enter IP and port as set up in TotalMix FX if it\s not running on your local PC with default port settings.</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');
        document.getElementById('placeholder').innerHTML = x;
        if (settings.SelectedAction === undefined) {
            document.getElementById('OscToggleSelect').value = "1";
        } else {
            document.getElementById('OscToggleSelect').value = settings.SelectedAction;
        }
        if (settings.IP === undefined) {
            document.getElementById('totalmixIP').value = "127.0.0.1";
        } else {
            document.getElementById('totalmixIP').value = settings.IP;
        }
        if (settings.Port === undefined) {
            document.getElementById('totalmixPort').value = "7001";
        } else {
            document.getElementById('totalmixPort').value = settings.Port;
        }
        if (settings.Latch == true) {
            document.getElementById("chk0").checked = true;
        } else {
            document.getElementById("chk0").checked = false;
        }
    } else if (pl === "de.shells.totalmix.osconoff.action") {
        let x = ['<div class="sdpi-item" id="required_text">',
            '<div class="sdpi-item-label">IP-Address</div>',
            '<input class="sdpi-item-value" id="totalmixIP" value="" placeholder="127.0.0.1" required pattern="\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" onchange="setSettings(event.target.value, \'IP\')">',
            '</div>',
            '<div class="sdpi-item" id="required_text">',
            '<div class="sdpi-item-label">Port</div>',
            '<input class="sdpi-item-value" id="totalmixPort" value="" placeholder="7001" required pattern="\\d{1,5}" onchange="setSettings(event.target.value, \'Port\')">',
            '</div>',
            '        <div type="radio" class="sdpi-item" id="adjust_radio">',
            ' <div class="sdpi-item-label">Mute or Solo</div>',
            ' <div class="sdpi-item-value ">',
            '     <span class="sdpi-item-child">',
            '         <input id="rdio1" type="radio" value="mute" name="rdio" onchange="selectedOscToggleCommand(document.getElementById(\'OscOnOffSelect\').value)">',
            '        <label for="rdio1" class="sdpi-item-label"><span></span>mute</label>',
            '    </span>',
            '     <span class="sdpi-item-child">',
            '         <input id="rdio2" type="radio" value="solo" name="rdio" onchange="selectedOscToggleCommand(document.getElementById(\'OscOnOffSelect\').value)">',
            '         <label for="rdio2" class="sdpi-item-label"><span></span>solo</label>',
            '     </span>',
            '  </div>',
            '</div>',
            '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Function</div>',
            '    <select class="sdpi-item-value select" id="OscOnOffSelect" onchange="selectedOscToggleCommand(event.target.value)">',
            '    <optgroup label="Inputs">',
            '        <option value="1">Input Channel 1</option>',
            '        <option value="2">Input Channel 2</option>',
            '        <option value="3">Input Channel 3</option>',
            '        <option value="4">Input Channel 4</option>',
            '        <option value="5">Input Channel 5</option>',
            '        <option value="6">Input Channel 6</option>',
            '        <option value="7">Input Channel 7</option>',
            '        <option value="8">Input Channel 8</option>',
            '        <option value="9">Input Channel 9</option>',
            '        <option value="10">Input Channel 10</option>',
            '        <option value="11">Input Channel 11</option>',
            '        <option value="12">Input Channel 12</option>',
            '        <option value="13">Input Channel 13</option>',
            '        <option value="14">Input Channel 14</option>',
            '        <option value="15">Input Channel 15</option>',
            '        <option value="16">Input Channel 16</option>',
            '    </optgroup>',
            '    <optgroup label="Software">',
            '        <option value="17">Playback Channel 1</option>',
            '        <option value="18">Playback Channel 2</option>',
            '        <option value="19">Playback Channel 3</option>',
            '        <option value="20">Playback Channel 4</option>',
            '        <option value="21">Playback Channel 5</option>',
            '        <option value="22">Playback Channel 6</option>',
            '        <option value="23">Playback Channel 7</option>',
            '        <option value="24">Playback Channel 8</option>',
            '        <option value="25">Playback Channel 9</option>',
            '        <option value="26">Playback Channel 10</option>',
            '        <option value="27">Playback Channel 11</option>',
            '        <option value="28">Playback Channel 12</option>',
            '        <option value="29">Playback Channel 13</option>',
            '        <option value="30">Playback Channel 14</option>',
            '        <option value="31">Playback Channel 15</option>',
            '        <option value="32">Playback Channel 16</option>',
            '    </optgroup>',
            '    <optgroup label="Outputs">',
            '        <option value="33">Output Channel 1</option>',
            '        <option value="34">Output Channel 2</option>',
            '        <option value="35">Output Channel 3</option>',
            '        <option value="36">Output Channel 4</option>',
            '        <option value="37">Output Channel 5</option>',
            '        <option value="38">Output Channel 6</option>',
            '        <option value="39">Output Channel 7</option>',
            '        <option value="40">Output Channel 8</option>',
            '        <option value="41">Output Channel 9</option>',
            '        <option value="42">Output Channel 10</option>',
            '        <option value="43">Output Channel 11</option>',
            '        <option value="44">Output Channel 12</option>',
            '        <option value="45">Output Channel 13</option>',
            '        <option value="46">Output Channel 14</option>',
            '        <option value="47">Output Channel 15</option>',
            '        <option value="48">Output Channel 16</option>',
            '    </optgroup></select>',
            '</div>',
            '<div type="checkbox" class="sdpi-item">',
            '       <div class="sdpi-item-label">Mirror TotalMix Settings</div>',
            '       <input class="sdpi-item-value" id="chk0" type="checkbox" value="includeInInitialize" onclick="includeOscOnOff(this);setSettings(document.getElementById(\'totalmixListeningPort\').value, \'ListeningPort\')"">',
            '       <label for="chk0"><span></span></label>',
            '</div>',
            '<details class="message">',
            '    <summary>Info on Mirror TotalMix (click)</summary>',
            '   <h4>Information:</h4>',
            '    <p>Checking this checkbox will make the plugin query TotalMix when the button comes into focus (which is when the button is loaded - if the StreamDeck is started or when a folder is accessed that contains the button).<br>Note: When you use buttons for Input/Playback/Output channels on the same Deck all buttons will be unresponsive for 2 seconds for each category (e.g. having 5 buttons for Input, 5 for Output, will make the buttons unavailable for 4 seconds.)</p>',
            '</details>',
            '<div class="sdpi-item" id="required_text">',
            '<div class="sdpi-item-label">Port outgoing (in TotalMix)</div>',
            '<input class="sdpi-item-value" id="totalmixListeningPort" value="" placeholder="9001" required pattern="\\d{1,5}" onchange="setSettings(event.target.value, \'ListeningPort\')">',
            '</div>',
            '<details class="message">',
            '    <summary>Only relevant for Mirror TotalMix settings</summary>',
            '</details>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Details</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>More Info</summary>',
            '        <p>Make sure TotalMix FX has OSC setup and it\'s in use.</p>',
            '        <p>Enter IP and port as set up in TotalMix FX if it\s not running on your local PC with default port settings.</p>',
            '        <p>Select Channel:<br>Stereo channels count as 1, so, for example, if stereo channel AN1/2 is channel 1, AN3 would be channel 2 then.</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');
        document.getElementById('placeholder').innerHTML = x;
        if (settings.SelectedAction === undefined) {
            document.getElementById('OscOnOffSelect').value = "1";
        } else {
            document.getElementById('OscOnOffSelect').value = settings.SelectedAction;
        }
        if (settings.IP === undefined) {
            document.getElementById('totalmixIP').value = "127.0.0.1";
        } else {
            document.getElementById('totalmixIP').value = settings.IP;
        }
        if (settings.Port === undefined) {
            document.getElementById('totalmixPort').value = "7001";
        } else {
            document.getElementById('totalmixPort').value = settings.Port;
        }
        if (settings.ListeningPort === undefined) {
            document.getElementById('totalmixListeningPort').value = "9001";
        } else {
            document.getElementById('totalmixListeningPort').value = settings.ListeningPort;
        }
        if (settings.MuteSolo === "mute") {
            document.getElementById("rdio1").checked = true;
        } else if (settings.MuteSolo === "solo") {
            document.getElementById("rdio2").checked = true;
        }
        // console.log("includeininitialize: " + settings.IncludeOscOnOff);
        if (settings.IncludeOscOnOff == true) {
            document.getElementById("chk0").checked = true;
        } else {
            document.getElementById("chk0").checked = false;
        }
    } else if (pl === "de.shells.totalmix.oscchannel.action") {
        let x = ['<div class="sdpi-item" id="required_text">',
            '<div class="sdpi-item-label">IP-Address</div>',
            '<input class="sdpi-item-value" id="totalmixIP" value="" placeholder="127.0.0.1" required pattern="\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" onchange="setSettings(event.target.value, \'IP\')">',
            '</div>',
            '<div class="sdpi-item" id="required_text">',
            '<div class="sdpi-item-label">Port</div>',
            '<input class="sdpi-item-value" id="totalmixPort" value="" placeholder="7001" required pattern="\\d{1,5}" onchange="setSettings(event.target.value, \'Port\')">',
            '</div>',
            '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Channel</div>',
            '    <select class="sdpi-item-value select" id="OscChannelSelect" onchange="setSettings(event.target.value, \'SelectedAction\');selectedOscChannelFunction(document.getElementById(\'OscChannelSelectCommand\').value,event.target.value)">',
            '    <optgroup label="Inputs">',
            '        <option value="1">Input Channel 1</option>',
            '        <option value="2">Input Channel 2</option>',
            '        <option value="3">Input Channel 3</option>',
            '        <option value="4">Input Channel 4</option>',
            '        <option value="5">Input Channel 5</option>',
            '        <option value="6">Input Channel 6</option>',
            '        <option value="7">Input Channel 7</option>',
            '        <option value="8">Input Channel 8</option>',
            '        <option value="9">Input Channel 9</option>',
            '        <option value="10">Input Channel 10</option>',
            '        <option value="11">Input Channel 11</option>',
            '        <option value="12">Input Channel 12</option>',
            '        <option value="13">Input Channel 13</option>',
            '        <option value="14">Input Channel 14</option>',
            '        <option value="15">Input Channel 15</option>',
            '        <option value="16">Input Channel 16</option>',
            '    </optgroup>',
            '    <optgroup label="Software">',
            '        <option value="17">Playback Channel 1</option>',
            '        <option value="18">Playback Channel 2</option>',
            '        <option value="19">Playback Channel 3</option>',
            '        <option value="20">Playback Channel 4</option>',
            '        <option value="21">Playback Channel 5</option>',
            '        <option value="22">Playback Channel 6</option>',
            '        <option value="23">Playback Channel 7</option>',
            '        <option value="24">Playback Channel 8</option>',
            '        <option value="25">Playback Channel 9</option>',
            '        <option value="26">Playback Channel 10</option>',
            '        <option value="27">Playback Channel 11</option>',
            '        <option value="28">Playback Channel 12</option>',
            '        <option value="29">Playback Channel 13</option>',
            '        <option value="30">Playback Channel 14</option>',
            '        <option value="31">Playback Channel 15</option>',
            '        <option value="32">Playback Channel 16</option>',
            '    </optgroup>',
            '    <optgroup label="Outputs">',
            '        <option value="33">Output Channel 1</option>',
            '        <option value="34">Output Channel 2</option>',
            '        <option value="35">Output Channel 3</option>',
            '        <option value="36">Output Channel 4</option>',
            '        <option value="37">Output Channel 5</option>',
            '        <option value="38">Output Channel 6</option>',
            '        <option value="39">Output Channel 7</option>',
            '        <option value="40">Output Channel 8</option>',
            '        <option value="41">Output Channel 9</option>',
            '        <option value="42">Output Channel 10</option>',
            '        <option value="43">Output Channel 11</option>',
            '        <option value="44">Output Channel 12</option>',
            '        <option value="45">Output Channel 13</option>',
            '        <option value="46">Output Channel 14</option>',
            '        <option value="47">Output Channel 15</option>',
            '        <option value="48">Output Channel 16</option>',
            '    </optgroup>',
            '    <optgroup label="Master">',
            '        <option value="37">Master</option>',
            '    </optgroup></select>',
            '</div>', '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Function</div>',
            '    <select class="sdpi-item-value select" id="OscChannelSelectCommand" onchange="selectedOscChannelFunction(event.target.value);document.getElementById(\'OscChannelSelect\').value">',
            '    <optgroup label="Inputs">',
            '        <option value="1">Volume</option>',
            '        <option value="2">Pan</option>',
            '        <option value="3">Phase</option>',
            '        <option value="4">Phase Right</option>',
            '        <option value="5">Phantom Power</option>',
            '        <option value="6">Autoset</option>',
            '        <option value="7">Loopback</option>',
            '        <option value="8">Stereo</option>',
            '        <option value="9">Cue</option>',
            '        <option value="10">Gain</option>',
            '        <option value="11">Gain Right</option>',
            '        <option value="12">Width</option>',
            '        <option value="13">EQ Enable</option>',
            '        <option value="14">Comp Enable</option>',
            '        <option value="15">AutoLevel Enable</option>',
            '    </optgroup></select>',
            '</div>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Value</div>',
            '    <input class="sdpi-item-value" id="selectedValue" value="" placeholder="Enter value if applicable" onchange="setSettings(event.target.value, \'SelectedValue\')">',
            '</div>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Help</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>Acceptable Values / Channel Availability</summary>',
            '        <p><font style="font-weight:bold">Volume</font>: 0-100.<br>0 is &#8734;, 82 is 0dB, 100 is +6dB<br><font style="font-style: italic">Available: All Channels</font></p>',
            '        <p><font style="font-weight:bold">Pan</font>: L100 to R100.<br>Enter 0 for center<br><font style="font-style: italic">Available: All Channels</font></p>',
            '        <p><font style="font-weight:bold">Gain/Gain Right</font>: 0-65.<br><font style="font-style: italic">Available: All Input Channels with Preamp - Gain Right only available on Stereo Channels</font></p>',
            '        <p><font style="font-weight:bold">Width</font>: -1.00 to 1.00.<br><font style="font-style: italic">Available: All Input Channels without Preamp and all Playback Channels</font></p>',
            '        <p><font style="font-weight:bold">Phantom Power, Autoset</font>: no value<br><font style="font-style: italic">Available: All Input Channels with Preamp</font></p>',
            '        <p><font style="font-weight:bold">Loopback, Cue</font>: no value<br><font style="font-style: italic">Available: All Output Channels</font></p>',
            '        <p><font style="font-weight:bold">Phase, Phase Right, Stereo, Cue, EQ, Comp, AutoLevel Enable</font>: no value<br><font style="font-style: italic">Available: All Channels / Phase Right only on Stereo Channels</font></p>',
            '    </details>',
            '</div>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Details</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>More Info</summary>',
            '        <p>Make sure TotalMix FX has OSC setup and it\'s in use.</p>',
            '        <p>Enter IP and port as set up in TotalMix FX if it\s not running on your local PC with default port settings.</p>',
            '        <p>Select Channel:<br>Stereo channels count as 1, so, for example, if stereo channel AN1/2 is channel 1, AN3 would be channel 2 then.</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');
        document.getElementById('placeholder').innerHTML = x;
        if (settings.SelectedAction === undefined) {
            document.getElementById('OscChannelSelect').value = "1";
        } else {
            document.getElementById('OscChannelSelect').value = settings.SelectedAction;
        }
        if (settings.SelectedFunction === undefined) {
            document.getElementById('OscChannelSelectCommand').value = "1";
        } else {
            document.getElementById('OscChannelSelectCommand').value = settings.SelectedFunction;
        }
        if (settings.SelectedValue === undefined) {
            document.getElementById('selectedValue').value = "";
        } else {
            document.getElementById('selectedValue').value = settings.SelectedValue;
        }
        if (settings.IP === undefined) {
            document.getElementById('totalmixIP').value = "127.0.0.1";
        } else {
            document.getElementById('totalmixIP').value = settings.IP;
        }
        if (settings.Port === undefined) {
            document.getElementById('totalmixPort').value = "7001";
        } else {
            document.getElementById('totalmixPort').value = settings.Port;
        }
    }
}


function addDynamicStyles(clrs) {
    const node = document.getElementById('#sdpi-dynamic-styles') || document.createElement('style');
    if (!clrs.mouseDownColor) clrs.mouseDownColor = fadeColor(clrs.highlightColor, -100);
    const clr = clrs.highlightColor.slice(0, 7);
    const clr1 = fadeColor(clr, 100);
    const clr2 = fadeColor(clr, 60);
    const metersActiveColor = fadeColor(clr, -60);

    node.setAttribute('id', 'sdpi-dynamic-styles');
    node.innerHTML = `

    input[type="radio"]:checked + label span,
    input[type="checkbox"]:checked + label span {
        background-color: ${clrs.highlightColor};
    }

    input[type="radio"]:active:checked + label span,
    input[type="radio"]:active + label span,
    input[type="checkbox"]:active:checked + label span,
    input[type="checkbox"]:active + label span {
      background-color: ${clrs.mouseDownColor};
    }

    input[type="radio"]:active + label span,
    input[type="checkbox"]:active + label span {
      background-color: ${clrs.buttonPressedBorderColor};
    }

    td.selected,
    td.selected:hover,
    li.selected:hover,
    li.selected {
      color: white;
      background-color: ${clrs.highlightColor};
    }

    .sdpi-file-label > label:active,
    .sdpi-file-label.file:active,
    label.sdpi-file-label:active,
    label.sdpi-file-info:active,
    input[type="file"]::-webkit-file-upload-button:active,
    button:active {
      background-color: ${clrs.buttonPressedBackgroundColor};
      color: ${clrs.buttonPressedTextColor};
      border-color: ${clrs.buttonPressedBorderColor};
    }

    ::-webkit-progress-value,
    meter::-webkit-meter-optimum-value {
        background: linear-gradient(${clr2}, ${clr1} 20%, ${clr} 45%, ${clr} 55%, ${clr2})
    }

    ::-webkit-progress-value:active,
    meter::-webkit-meter-optimum-value:active {
        background: linear-gradient(${clr}, ${clr2} 20%, ${metersActiveColor} 45%, ${metersActiveColor} 55%, ${clr})
    }
    `;
    document.body.appendChild(node);
};

/** UTILITIES */

/*
    Quick utility to lighten or darken a color (doesn't take color-drifting, etc. into account)
    Usage:
    fadeColor('#061261', 100); // will lighten the color
    fadeColor('#200867'), -100); // will darken the color
*/
function fadeColor(col, amt) {
    const min = Math.min, max = Math.max;
    const num = parseInt(col.replace(/#/g, ''), 16);
    const r = min(255, max((num >> 16) + amt, 0));
    const g = min(255, max((num & 0x0000FF) + amt, 0));
    const b = min(255, max(((num >> 8) & 0x00FF) + amt, 0));
    return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, 0);
}

function includeOscOnOff(state) {
    if (state.checked == true) {
        // console.log("checkbox checked");
        setSettings(true, 'IncludeOscOnOff');
    } else {
        // console.log("checkbox unchecked");
        setSettings(false, 'IncludeOscOnOff');
    }
}

function latch(state) {
    if (state.checked == true) {
        // console.log("checkbox checked");
        setSettings(true, 'Latch');
    } else {
        // console.log("checkbox unchecked");
        setSettings(false, 'Latch');
    }
}

function selectedOscTriggerCommand(selectedOscTriggerCommand) {
    setSettings(selectedOscTriggerCommand, 'SelectedAction');
    switch (selectedOscTriggerCommand) {
        case "1":
            name = "/3/snapshots/8/1";
            setSettings(true, 'Latch');
            break;
        case "2":
            name = "/3/snapshots/7/1";
            setSettings(true, 'Latch');
            break;
        case "3":
            name = "/3/snapshots/6/1";
            setSettings(true, 'Latch');
            break;
        case "4":
            name = "/3/snapshots/5/1";
            setSettings(true, 'Latch');
            break;
        case "5":
            name = "/3/snapshots/4/1";
            setSettings(true, 'Latch');
            break;
        case "6":
            name = "/3/snapshots/3/1";
            setSettings(true, 'Latch');
            break;
        case "7":
            name = "/3/snapshots/2/1";
            setSettings(true, 'Latch');
            break;
        case "8":
            name = "/3/snapshots/1/1";
            setSettings(true, 'Latch');
            break;
        case "9":
            name = "/3/globalMute";
            break;
        case "10":
            name = "/3/globalSolo";
            break;
        case "11":
            name = "/3/reverbEnable";
            break;
        case "12":
            name = "/3/echoEnable";
            break;
        case "13":
            name = "/1/trim";
            break;
        case "14":
            name = "/1/mainDim";
            break;
        case "15":
            name = "/1/mainSpeakerB";
            break;
        case "16":
            name = "/1/mainRecall";
            break;
        case "17":
            name = "/1/mainMuteFx";
            break;
        case "18":
            name = "/1/mainMono";
            break;
        case "19":
            name = "/1/mainExtIn";
            break;
        case "20":
            name = "/1/mainTalkback";
            break;
        case "21":
            name = "/3/muteGroups/4/1";
            break;
        case "22":
            name = "/3/muteGroups/3/1";
            break;
        case "23":
            name = "/3/muteGroups/2/1";
            break;
        case "24":
            name = "/3/muteGroups/1/1";
            break;
        case "25":
            name = "/3/soloGroups/4/1";
            break;
        case "26":
            name = "/3/soloGroups/3/1";
            break;
        case "27":
            name = "/3/soloGroups/2/1";
            break;
        case "28":
            name = "/3/soloGroups/1/1";
            break;
        case "29":
            name = "/3/faderGroups/4/1";
            break;
        case "30":
            name = "/3/faderGroups/3/1";
            break;
        case "31":
            name = "/3/faderGroups/2/1";
            break;
        case "32":
            name = "/3/faderGroups/1/1";
            break;
        case "33":
            name = "showhideui";
            setSettings(true, 'Latch');
            break;
        default:
            break;
    }
    setSettings(name, 'Name');
}

function selectedOscToggleCommand(selectedOscToggleCommand) {
    setSettings(selectedOscToggleCommand, 'SelectedAction');
    var selectedRadios = document.getElementsByName('rdio');
    var selectedRadio;
    for (var i = 0, length = selectedRadios.length; i < length; i++) {
        if (selectedRadios[i].checked) {
            selectedRadio = selectedRadios[i].value;
            break;
        }
    }
    switch (selectedOscToggleCommand) {
        case "1":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/1";
            } else {
                name = "/1/solo/1/1";
            }
            bus = "Input";
            break;
        case "2":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/2";
            } else {
                name = "/1/solo/1/2";
            }
            bus = "Input";
            break;
        case "3":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/3";
            } else {
                name = "/1/solo/1/3";
            }
            bus = "Input";
            break;
        case "4":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/4";
            } else {
                name = "/1/solo/1/4";
            }
            bus = "Input";
            break;
        case "5":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/5";
            } else {
                name = "/1/solo/1/5";
            }
            bus = "Input";
            break;
        case "6":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/6";
            } else {
                name = "/1/solo/1/6";
            }
            bus = "Input";
            break;
        case "7":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/7";
            } else {
                name = "/1/solo/1/7";
            }
            bus = "Input";
            break;
        case "8":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/8";
            } else {
                name = "/1/solo/1/8";
            }
            bus = "Input";
            break;
        case "9":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/9";
            } else {
                name = "/1/solo/1/9";
            }
            bus = "Input";
            break;
        case "10":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/10";
            } else {
                name = "/1/solo/1/10";
            }
            bus = "Input";
            break;
        case "11":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/11";
            } else {
                name = "/1/solo/1/11";
            }
            bus = "Input";
            break;
        case "12":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/12";
            } else {
                name = "/1/solo/1/12";
            }
            bus = "Input";
            break;
        case "13":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/13";
            } else {
                name = "/1/solo/1/13";
            }
            bus = "Input";
            break;
        case "14":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/14";
            } else {
                name = "/1/solo/1/14";
            }
            bus = "Input";
            break;
        case "15":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/15";
            } else {
                name = "/1/solo/1/15";
            }
            bus = "Input";
            break;
        case "16":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/16";
            } else {
                name = "/1/solo/1/16";
            }
            bus = "Input";
            break;
        case "17":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/1";
            } else {
                name = "/1/solo/1/1";
            }
            bus = "Playback";
            break;
        case "18":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/2";
            } else {
                name = "/1/solo/1/2";
            }
            bus = "Playback";
            break;
        case "19":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/3";
            } else {
                name = "/1/solo/1/3";
            }
            bus = "Playback";
            break;
        case "20":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/4";
            } else {
                name = "/1/solo/1/4";
            }
            bus = "Playback";
            break;
        case "21":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/5";
            } else {
                name = "/1/solo/1/5";
            }
            bus = "Playback";
            break;
        case "22":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/6";
            } else {
                name = "/1/solo/1/6";
            }
            bus = "Playback";
            break;
        case "23":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/7";
            } else {
                name = "/1/solo/1/7";
            }
            bus = "Playback";
            break;
        case "24":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/8";
            } else {
                name = "/1/solo/1/8";
            }
            bus = "Playback";
            break;
        case "25":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/9";
            } else {
                name = "/1/solo/1/9";
            }
            bus = "Playback";
            break;
        case "26":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/10";
            } else {
                name = "/1/solo/1/10";
            }
            bus = "Playback";
            break;
        case "27":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/11";
            } else {
                name = "/1/solo/1/11";
            }
            bus = "Playback";
            break;
        case "28":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/12";
            } else {
                name = "/1/solo/1/12";
            }
            bus = "Playback";
            break;
        case "29":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/13";
            } else {
                name = "/1/solo/1/13";
            }
            bus = "Playback";
            break;
        case "30":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/14";
            } else {
                name = "/1/solo/1/14";
            }
            bus = "Playback";
            break;
        case "31":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/15";
            } else {
                name = "/1/solo/1/15";
            }
            bus = "Playback";
            break;
        case "32":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/16";
            } else {
                name = "/1/solo/1/16";
            }
            bus = "Playback";
            break;
        case "33":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/1";
            } else {
                name = "/1/solo/1/1";
            }
            bus = "Output";
            break;
        case "34":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/2";
            } else {
                name = "/1/solo/1/2";
            }
            bus = "Output";
            break;
        case "35":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/3";
            } else {
                name = "/1/solo/1/3";
            }
            bus = "Output";
            break;
        case "36":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/4";
            } else {
                name = "/1/solo/1/4";
            }
            bus = "Output";
            break;
        case "37":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/5";
            } else {
                name = "/1/solo/1/5";
            }
            bus = "Output";
            break;
        case "38":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/6";
            } else {
                name = "/1/solo/1/6";
            }
            bus = "Output";
            break;
        case "39":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/7";
            } else {
                name = "/1/solo/1/7";
            }
            bus = "Output";
            break;
        case "40":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/8";
            } else {
                name = "/1/solo/1/8";
            }
            bus = "Output";
            break;
        case "41":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/9";
            } else {
                name = "/1/solo/1/9";
            }
            bus = "Output";
            break;
        case "42":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/10";
            } else {
                name = "/1/solo/1/10";
            }
            bus = "Output";
            break;
        case "43":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/11";
            } else {
                name = "/1/solo/1/11";
            }
            bus = "Output";
            break;
        case "44":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/12";
            } else {
                name = "/1/solo/1/12";
            }
            bus = "Output";
            break;
        case "45":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/13";
            } else {
                name = "/1/solo/1/13";
            }
            bus = "Output";
            break;
        case "46":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/14";
            } else {
                name = "/1/solo/1/14";
            }
            bus = "Output";
            break;
        case "47":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/15";
            } else {
                name = "/1/solo/1/15";
            }
            bus = "Output";
            break;
        case "48":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/16";
            } else {
                name = "/1/solo/1/16";
            }
            bus = "Output";
            break;
        default:
            break;
    }
    setSettings(name, 'Name');
    setSettings(bus, 'Bus');
    setSettings(selectedRadio, 'MuteSolo');
}

function selectedOscChannelFunction(selectedOscChannelFunction, oscChannelSelect) {
    // console.log("oscChannelSelect in selectedOscChannelFunction: " + oscChannelSelect);
    if (oscChannelSelect == undefined) {
        oscChannelSelect = actionInfo.payload.settings.SelectedAction;
    }
    // console.log("selectedOscChannelFunction: " + selectedOscChannelFunction);
    // console.log("entry: actionInfo.payload.settings.SelectedAction " + actionInfo.payload.settings.SelectedAction);
    // console.log("entry: oscChannelSelect: " + oscChannelSelect);
    switch (selectedOscChannelFunction) {
        case "1":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/1/volume" + oscChannelSelect;
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/1/volume" + (parseInt(oscChannelSelect) - 12);
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/1/volume" + (parseInt(oscChannelSelect) - 24);
                bus = "Output";
            } else if (parseInt(oscChannelSelect) === 37) {
                name = "/1/mastervolume";
                bus = "Output";
            }
            break;
        case "2":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/1/pan" + oscChannelSelect;
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/1/pan" + (parseInt(oscChannelSelect) - 12);
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/1/pan" + (parseInt(oscChannelSelect) - 24);
                bus = "Output";
            }
            break;
        case "3":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/phase";
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/2/phase";
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/phase";
                bus = "Output";
            }
            break;
        case "4":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/phaseRight";
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/2/phaseRight";
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/phaseRight";
                bus = "Output";
            }
            break;
        case "5":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/phantom";
                bus = "Input";
            }
            break;
        case "6":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/autoset";
                bus = "Input";
            }
            break;
        case "7":
            if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/loopback";
                bus = "Output";
            }
            break;
        case "8":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/stereo";
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/2/stereo";
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/stereo";
                bus = "Output";
            }
            break;
        case "9":
            if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/cue";
                bus = "Output";
            }
            break;
        case "10":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/gain";
                bus = "Input";
            }
            break;
        case "11":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/gainRight";
                bus = "Input";
            }
            break;
        case "12":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/width";
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/2/width";
                bus = "Playback";
            }
            break;
        case "13":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/eqEnable";
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/2/eqEnable";
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/eqEnable";
                bus = "Output";
            }

            break;
        case "14":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/compexpEnable";
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/2/compexpEnable";
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/compexpEnable";
                bus = "Output";
            }

            break;
        case "15":
            if (parseInt(oscChannelSelect) >= 1 && parseInt(oscChannelSelect) <= 12) {
                name = "/2/alevEnable";
                bus = "Input";
            } else if (parseInt(oscChannelSelect) >= 13 && parseInt(oscChannelSelect) <= 24) {
                name = "/2/alevEnable";
                bus = "Playback";
            } else if (parseInt(oscChannelSelect) >= 25 && parseInt(oscChannelSelect) <= 36) {
                name = "/2/alevEnable";
                bus = "Output";
            }
            break;
        default:
            break;
    }

            setSettings(selectedOscChannelFunction, "SelectedFunction");
    setSettings(name, 'Name');
    setSettings(bus, 'Bus');
}

function setFaderGainSetting(selectedsetting) {
    if (selectedsetting > 127) {
        selectedsetting = 127;
    }
    setSettings(selectedsetting, 'ControlValue');
}

function mapToMidiNote(selectedAction) {
    let selectedListItem = parseInt(selectedAction);
    // console.log("typeof selectedlistitem " + typeof (selectedListItem));
    // console.log("selectedAction: " + selectedAction);
    // console.log("mapping[]: " + midiNoteMapping[selectedAction - 1]);
    setSettings(selectedAction, 'SelectedMidiAction');
    setSettings(midiNoteMapping[selectedAction - 1], 'MidiNote');
}

function setControlChangeSetting(selectedListItem) {
    if (selectedListItem.split("-")[1] === "HI") {
        var mapToArray = selectedListItem.split("-")[0];
        mapToArray = parseInt(mapToArray, 10);
    }
    else if (selectedListItem.split("-")[1] === "SI") {
        var mapToArray = selectedListItem.split("-")[0];
        mapToArray = parseInt(mapToArray, 10) + 16;
    }
    else if (selectedListItem.split("-")[1] === "HO") {
        var mapToArray = selectedListItem.split("-")[0];
        mapToArray = parseInt(mapToArray, 10) + 32;
    }
    else if (selectedListItem.split("-")[1] === "GI") {
        var mapToArray = selectedListItem.split("-")[0];
        mapToArray = parseInt(mapToArray, 10) + 48;
    }
    let getMidiCCString = midiCCMapping[mapToArray - 1];
    let splitted = getMidiCCString.split("-");
    setSettings(splitted[0], 'Channel');
    setSettings(splitted[1], 'Control');
}

// maps selected value to control change to send
var midiCCMapping = [
    "1-102", //	Hardware Input 1
    "1-103", //	Hardware Input 2
    "1-104", //	Hardware Input 3
    "1-105", //	Hardware Input 4
    "1-106", //	Hardware Input 5
    "1-107", //	Hardware Input 6
    "1-108", //	Hardware Input 7
    "1-109", //	Hardware Input 8
    "1-110", //	Hardware Input 9
    "1-111", //	Hardware Input 10
    "1-112", //	Hardware Input 11
    "1-113", //	Hardware Input 12
    "1-114", //	Hardware Input 13
    "1-115", //	Hardware Input 14
    "1-116", //	Hardware Input 15
    "1-117", //	Hardware Input 16
    "5-102", //	Software Input 1
    "5-103", //	Software Input 2
    "5-104", //	Software Input 3
    "5-105", //	Software Input 4
    "5-106", //	Software Input 5
    "5-107", //	Software Input 6
    "5-108", //	Software Input 7
    "5-109", //	Software Input 8
    "5-110", //	Software Input 9
    "5-111", //	Software Input 10
    "5-112", //	Software Input 11
    "5-113", //	Software Input 12
    "5-114", //	Software Input 13
    "5-115", //	Software Input 14
    "5-116", //	Software Input 15
    "5-117", //	Software Input 16
    "9-102", //	Hardware Output 1
    "9-103", //	Hardware Output 2
    "9-104", //	Hardware Output 3
    "9-105", //	Hardware Output 4
    "9-106", //	Hardware Output 5
    "9-107", //	Hardware Output 6
    "9-108", //	Hardware Output 7
    "9-109", //	Hardware Output 8
    "9-110", //	Hardware Output 9
    "9-111", //	Hardware Output 10
    "9-112", //	Hardware Output 11
    "9-113", //	Hardware Output 12
    "9-114", //	Hardware Output 13
    "9-115", //	Hardware Output 14
    "9-116", //	Hardware Output 15
    "9-117", //	Hardware Output 16
    "1-9", // Gain Hardware Input Channel 1
    "2-9", // Gain Hardware Input Channel 2
    "3-9", // Gain Hardware Input Channel 3
    "4-9", // Gain Hardware Input Channel 4
    "5-9", // Gain Hardware Input Channel 5
    "6-9", // Gain Hardware Input Channel 6
    "7-9", // Gain Hardware Input Channel 7
    "8-9", // Gain Hardware Input Channel 8
    "9-9", // Gain Hardware Input Channel 9
    "10-9", //	Gain Hardware Input Channel 10
    "11-9", //	Gain Hardware Input Channel 11
    "12-9", //	Gain Hardware Input Channel 12
    "13-9", //	Gain Hardware Input Channel 13
    "14-9", //	Gain Hardware Input Channel 14
    "15-9", //	Gain Hardware Input Channel 15
    "16-9", //	Gain Hardware Input Channel 16    
];

// maps value of select to midi note to send
var midiNoteMapping = [
    54, // Snapshot 1
    55, // Snapshot 2
    56, // Snapshot 3
    57, // Snapshot 4
    58, // Snapshot 5
    59, // Snapshot 6
    60, // Snapshot 7
    61, // Snapshot 8
    62, // Cue Main Out
    63, // Cue Phones 1
    64, // Cue Phones 2
    65, // Cue Phones 3
    66, // Cue Phones 4
    93, // Dim
    42, // Mono
    94, // Talkback
    95, // Recall
    50, // Speaker B
    43, // Master Solo
    44, // Master Mute
    45, // Trim Gains
    16, // Mute PH 7
    17, // Mute PH 8
    18, // Mute SPDIF L
    19, // Mute SPDIF R
    20, // Mute AS 3
    21, // Mute AS 4
    22, // Mute ADAT 1
    23  // Mute ADAT 2
];

// maps midi note to send to channel to send it on
var midiChannelMapping = {
    54: 1, // Snapshot 1
    55: 1, // Snapshot 2
    56: 1, // Snapshot 3
    57: 1, // Snapshot 4
    58: 1, // Snapshot 5
    59: 1, // Snapshot 6
    60: 1, // Snapshot 7
    61: 1, // Snapshot 8
    62: 1, // Cue Main Out
    63: 1, // Cue Phones 1
    64: 1, // Cue Phones 2
    65: 1, // Cue Phones 3
    66: 1, // Cue Phones 4
    93: 1, // Dim
    42: 1, // Mono
    94: 1, // Talkback
    95: 1, // Recall
    50: 1, // Speaker B
    43: 1, // Master Solo
    44: 1, // Master Mute
    45: 1, // Trim Gains
    16: 1, // Mute PH 7
    17: 1, // Mute PH 8
    18: 1, // Mute SPDIF L
    19: 1, // Mute SPDIF R
    20: 1, // Mute AS 1
    21: 1, // Mute AS 2
    22: 1, // Mute ADAT 1
    23: 1  // Mute ADAT 2
};