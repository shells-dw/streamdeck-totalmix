var websocket = null,
    uuid = null,
    inInfo = null,
    actionInfo = {},
    currentAction,
    settingsModel = {
        Channel: 1,
        Note: 57,
        ControlValue: 0,
        Control: 1,
        SelectedDevice: "0",
        Devices: [],
        FunctSelect: 1,
        Name: "0",
        SettingValue: 1.0,
        Port: 7001,
        IP: "127.0.0.1",
        SelectedAction: "1",
        ActiveSnap: "0",
        Bus: "in",
        MuteSolo: "mute"
    };

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUUID;
    actionInfo = JSON.parse(inActionInfo);
    inInfo = JSON.parse(inInfo);
    console.log(inInfo);

    websocket = new WebSocket('ws://127.0.0.1:' + inPort);
    /*   if (actionInfo.payload.settings.settingsModel) {
   
       } */
    console.log(actionInfo);
    if (actionInfo.action === "de.shells.totalmix.note.action") {
        currentAction = "note";
        if (actionInfo.payload.settings.settingsModel) {
            settingsModel.FunctSelect = actionInfo.payload.settings.settingsModel.FunctSelect;
            settingsModel.Devices = actionInfo.payload.settings.settingsModel.Devices;
            settingsModel.SelectedDevice = actionInfo.payload.settings.settingsModel.SelectedDevice;
            settingsModel.Channel = actionInfo.payload.settings.settingsModel.Channel;
        }
    } else if (actionInfo.action === "de.shells.totalmix.cc.action") {
        currentAction = "cc";
        if (actionInfo.payload.settings.settingsModel) {
            settingsModel.ControlValue = actionInfo.payload.settings.settingsModel.ControlValue;
            settingsModel.Control = actionInfo.payload.settings.settingsModel.Control;
            settingsModel.Devices = actionInfo.payload.settings.settingsModel.Devices;
            settingsModel.SelectedDevice = actionInfo.payload.settings.settingsModel.SelectedDevice;
            settingsModel.Channel = actionInfo.payload.settings.settingsModel.Channel;
        }
    } else if (actionInfo.action === "de.shells.totalmix.osctoggle.action") {
        currentAction = "osctoggle";
        if (actionInfo.payload.settings.settingsModel) {
            settingsModel.Name = actionInfo.payload.settings.settingsModel.Name;
            settingsModel.Port = actionInfo.payload.settings.settingsModel.Port;
            settingsModel.IP = actionInfo.payload.settings.settingsModel.IP;
            settingsModel.SelectedAction = actionInfo.payload.settings.settingsModel.SelectedAction;
        }
    } else if (actionInfo.action === "de.shells.totalmix.osconoff.action") {
        currentAction = "osconoff";
        if (actionInfo.payload.settings.settingsModel) {
            settingsModel.Name = actionInfo.payload.settings.settingsModel.Name;
            settingsModel.Port = actionInfo.payload.settings.settingsModel.Port;
            settingsModel.IP = actionInfo.payload.settings.settingsModel.IP;
            settingsModel.SelectedAction = actionInfo.payload.settings.settingsModel.SelectedAction;
            settingsModel.Bus = actionInfo.payload.settings.settingsModel.Bus;
            settingsModel.MuteSolo = actionInfo.payload.settings.settingsModel.MuteSolo;
        }
    }


    websocket.onopen = function () {
        var json = { event: inRegisterEvent, uuid: inUUID };
        websocket.send(JSON.stringify(json));

        requestGlobalSettings(inUUID);
    };

    initPropertyInspector(5);

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        var jsonObj = JSON.parse(evt.data);
        var sdEvent = jsonObj['event'];
        console.log("jsonObj");
        console.log(jsonObj);
        switch (sdEvent) {
            case "didReceiveSettings":
                if (jsonObj.payload.settings.settingsModel) {
                    settingsModel.Control = jsonObj.payload.settings.settingsModel.Control;
                    settingsModel.ControlValue = jsonObj.payload.settings.settingsModel.ControlValue;
                    settingsModel.Channel = jsonObj.payload.settings.settingsModel.Channel;
                    settingsModel.Devices = jsonObj.payload.settings.settingsModel.Devices;
                    settingsModel.SelectedDevice = jsonObj.payload.settings.settingsModel.SelectedDevice;
                    settingsModel.FunctSelect = jsonObj.payload.settings.settingsModel.FunctSelect;
                    settingsModel.Name = actionInfo.payload.settings.settingsModel.Name;
                    settingsModel.SettingValue = actionInfo.payload.settings.settingsModel.SettingValue;
                    settingsModel.Port = actionInfo.payload.settings.settingsModel.Port;
                    settingsModel.IP = actionInfo.payload.settings.settingsModel.IP;
                    settingsModel.SelectedAction = actionInfo.payload.settings.settingsModel.SelectedAction;
                    settingsModel.Bus = actionInfo.payload.settings.settingsModel.Bus;
                    settingsModel.MuteSolo = actionInfo.payload.settings.settingsModel.MuteSolo;
                }
                updatePI();
                break;
            default:
                break;
        }
    };
}

function updatePI() {
    if (currentAction === "note") {
        let x = ['<div class="sdpi-item" id="devices">',
            '<div class="sdpi-item-label">Midi Device</div>',
            '<select class="sdpi-item-value select" id="selDevices" onchange="setSettings(event.target.value, \'SelectedDevice\')">',
            '</select>',
            '</div>',
            '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Function</div>',
            '    <select class="sdpi-item-value select" id="FunctSelect" onchange="setSettings(event.target.value, \'FunctSelect\')">',
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
            '        <p>Make sure TotalMix FX listens to a MIDI driver on your system, has Mackie Control Support enabled to be able to use all functions - and actually listens to MIDI.</p>',
            '        <p><b>Midi Device</b><br>Select MIDI device that TotalMix monitors</p>',
            '        <p><b>Select Function</b><br>Select the function you want to trigger in TotalMix</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home - I wrote it to support all channels of a 802 though. In theory, that is. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if I we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');

        document.getElementById('placeholder').innerHTML = x;
        let getMidiNoteIndex = midiNoteMapping.indexOf(settingsModel.FunctSelect);
        document.getElementById('FunctSelect').value = getMidiNoteIndex + 1;
        document.getElementById('selDevices').value = settingsModel.SelectedDevice;

        let newSelect = document.getElementById('selDevices');
        newSelect.innerHTML = '';
        for (let i = 0; i < settingsModel.Devices.length; i++) {
            const element = settingsModel.Devices[i];
            var opt = document.createElement("option");
            opt.value = i;
            opt.innerHTML = element;
            newSelect.appendChild(opt);
        }
        newSelect.value = settingsModel.SelectedDevice;

    } else if (currentAction === "cc") {
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
            '        <p>Make sure TotalMix FX listens to a MIDI driver on your system, has Mackie Control Support enabled to be able to use all functions - and actually listens to MIDI.</p>',
            '        <p>Midi Device<br>Select MIDI device that TotalMix monitors</p>',
            '        <p>Select Channel<br>Select the Channel you want to change the fader/gain setting on</p>',
            '        <p>Fader/Gain Value<br>Enter the desired fader/gain value. The range on faders is 0 to 127 and 0dB is 104<br>The range on gain is 0 to 65</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home - I wrote it to support all channels of a 802 though. In theory, that is. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if I we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');
        document.getElementById('placeholder').innerHTML = x;

        let getMidiCCIndex = midiCCMapping.indexOf(settingsModel.Channel + "-" + settingsModel.Control);
        if (settingsModel.Channel <= 4 && settingsModel.Control !== 9) {
            getMidiCCIndex = getMidiCCIndex + 1;
            getMidiCCIndex = getMidiCCIndex + "-HI";
        } else if (settingsModel.Channel >= 5 && settingsModel.Channel <= 8 && settingsModel.Control !== 9) {
            let calc = Math.floor(getMidiCCIndex / 16)
            getMidiCCIndex = getMidiCCIndex - (calc * 16) + 1
            getMidiCCIndex = getMidiCCIndex + "-SI";
        } else if (settingsModel.Channel >= 9 && settingsModel.Channel <= 12 && settingsModel.Control !== 9) {
            let calc = Math.floor(getMidiCCIndex / 16)
            getMidiCCIndex = getMidiCCIndex - (calc * 16) + 1
            getMidiCCIndex = getMidiCCIndex + "-HO";
        } else if (settingsModel.Control === 9) {
            let calc = Math.floor(getMidiCCIndex / 16)
            getMidiCCIndex = getMidiCCIndex - (calc * 16) + 1
            getMidiCCIndex = getMidiCCIndex + "-GI";
        }

        document.getElementById('ControlChange').value = getMidiCCIndex;
        document.getElementById('txtValue').value = settingsModel.ControlValue;
        document.getElementById('selDevices').value = settingsModel.SelectedDevice;

        let newSelect = document.getElementById('selDevices');
        newSelect.innerHTML = '';
        for (let i = 0; i < settingsModel.Devices.length; i++) {
            const element = settingsModel.Devices[i];
            var opt = document.createElement("option");
            opt.value = i;
            opt.innerHTML = element;
            newSelect.appendChild(opt);
        }
        newSelect.value = settingsModel.SelectedDevice;

    } else if (currentAction === "osctoggle") {
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
            '    <select class="sdpi-item-value select" id="OscSelect" onchange="selectedOscTriggerCommand(event.target.value)">',
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
            '    </optgroup></select>',
            '</div>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Details</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>More Info</summary>',
            '        <p>Make sure TotalMix FX has OSC setup and it\'s in use.</p>',
            '        <p>Enter IP and port as set up in TotalMix FX.</p>',
            '        <p>Currently OSC control only supports these few toggles, it\'s WIP - more will come soon.</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home In theory, that is. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if I we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');
        document.getElementById('placeholder').innerHTML = x;
        if (settingsModel.SelectedAction === null) {
            document.getElementById('OscSelect').value = "1";
            setSettings("1", 'SelectedAction');
        } else {
            document.getElementById('OscSelect').value = settingsModel.SelectedAction;
        }
        if (settingsModel.IP === null) {
            document.getElementById('totalmixIP').value = "127.0.0.1";
            setSettings("127.0.0.1", 'IP');
        } else {
            document.getElementById('totalmixIP').value = settingsModel.IP;
        }
        if (settingsModel.Port === 0) {
            document.getElementById('totalmixPort').value = "7001";
            setSettings(7001, 'Port');
        } else {
            document.getElementById('totalmixPort').value = settingsModel.Port;
        }
    } else if (currentAction === "osconoff") {
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
            '         <input id="rdio1" type="radio" value="mute" name="rdio" onchange="selectedOscToggleCommand(document.getElementById(\'OscSelect\').value)">',
            '        <label for="rdio1" class="sdpi-item-label"><span></span>mute</label>',
            '    </span>',
            '     <span class="sdpi-item-child">',
            '         <input id="rdio2" type="radio" value="solo" name="rdio" onchange="selectedOscToggleCommand(document.getElementById(\'OscSelect\').value)">',
            '         <label for="rdio2" class="sdpi-item-label"><span></span>solo</label>',
            '     </span>',
            '  </div>',
            '</div>',
            '<div class="sdpi-item" id="select_single">',
            '    <div class="sdpi-item-label">Select Function</div>',
            '    <select class="sdpi-item-value select" id="OscSelect" onchange="selectedOscToggleCommand(event.target.value)">',
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
            '    </optgroup>',
            '    <optgroup label="Software">',
            '        <option value="13">Playback Channel 1</option>',
            '        <option value="14">Playback Channel 2</option>',
            '        <option value="15">Playback Channel 3</option>',
            '        <option value="16">Playback Channel 4</option>',
            '        <option value="17">Playback Channel 5</option>',
            '        <option value="18">Playback Channel 6</option>',
            '        <option value="19">Playback Channel 7</option>',
            '        <option value="20">Playback Channel 8</option>',
            '        <option value="21">Playback Channel 9</option>',
            '        <option value="22">Playback Channel 10</option>',
            '        <option value="23">Playback Channel 11</option>',
            '        <option value="24">Playback Channel 12</option>',
            '    </optgroup>',
            '    <optgroup label="Outputs">',
            '        <option value="25">Output Channel 1</option>',
            '        <option value="26">Output Channel 2</option>',
            '        <option value="27">Output Channel 3</option>',
            '        <option value="28">Output Channel 4</option>',
            '        <option value="29">Output Channel 5</option>',
            '        <option value="30">Output Channel 6</option>',
            '        <option value="31">Output Channel 7</option>',
            '        <option value="32">Output Channel 8</option>',
            '        <option value="33">Output Channel 9</option>',
            '        <option value="34">Output Channel 10</option>',
            '        <option value="35">Output Channel 11</option>',
            '        <option value="36">Output Channel 12</option>',
            '    </optgroup></select>',
            '</div>',
            '<div class="sdpi-item">',
            '    <div class="sdpi-item-label">Details</div>',
            '    <details class="sdpi-item-value">',
            '        <summary>More Info</summary>',
            '        <p>Make sure TotalMix FX has OSC setup and it\'s in use.</p>',
            '        <p>Enter IP and port as set up in TotalMix FX.</p>',
            '        <p>Currently OSC control supports solo/mute the channels, other options might come later</p>',
            '<p>Note: I developed and tested this plugin on a Fireface UC - which is the box I have at home In theory, that is. Drop me an issue on GitHub in case something doesn\'t work as expected on other hardware and I see if I we can figure that out</p>',
            '<p><span class="linkspan" onclick="openWebsite()">Link: more detailed instructions</span></p>',
            '    </details>',
            '</div>'].join('');
        document.getElementById('placeholder').innerHTML = x;
        if (settingsModel.SelectedAction === null) {
            document.getElementById('OscSelect').value = "1";
            setSettings("1", 'SelectedAction');
        } else {
            document.getElementById('OscSelect').value = settingsModel.SelectedAction;
        }
        console.log(settingsModel.MuteSolo);
        if (settingsModel.MuteSolo === "mute") {
            document.getElementById("rdio1").checked = true;
        } else if (settingsModel.MuteSolo === "solo") {
            document.getElementById("rdio2").checked = true;
        }
        if (settingsModel.IP === null) {
            document.getElementById('totalmixIP').value = "127.0.0.1";
            setSettings("127.0.0.1", 'IP');
        } else {
            document.getElementById('totalmixIP').value = settingsModel.IP;
        }
        if (settingsModel.Port === 0) {
            document.getElementById('totalmixPort').value = "7001";
            setSettings(7001, 'Port');
        } else {
            document.getElementById('totalmixPort').value = settingsModel.Port;
        }
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

function selectedOscTriggerCommand(selectedOscTriggerCommand) {
    setSettings(selectedOscTriggerCommand, 'SelectedAction');
    switch (selectedOscTriggerCommand) {
        case "1":
            name = "/3/snapshots/8/1";
            break;
        case "2":
            name = "/3/snapshots/7/1";
            break;
        case "3":
            name = "/3/snapshots/6/1";
            break;
        case "4":
            name = "/3/snapshots/5/1";
            break;
        case "5":
            name = "/3/snapshots/4/1";
            break;
        case "6":
            name = "/3/snapshots/3/1";
            break;
        case "7":
            name = "/3/snapshots/2/1";
            break;
        case "8":
            name = "/3/snapshots/1/1";
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
                name = "/1/mute/1/1";
            } else {
                name = "/1/solo/1/1";
            }
            bus = "Playback";
            break;
        case "14":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/2";
            } else {
                name = "/1/solo/1/2";
            }
            bus = "Playback";
            break;
        case "15":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/3";
            } else {
                name = "/1/solo/1/3";
            }
            bus = "Playback";
            break;
        case "16":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/4";
            } else {
                name = "/1/solo/1/4";
            }
            bus = "Playback";
            break;
        case "17":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/5";
            } else {
                name = "/1/solo/1/5";
            }
            bus = "Playback";
            break;
        case "18":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/6";
            } else {
                name = "/1/solo/1/6";
            }
            bus = "Playback";
            break;
        case "19":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/7";
            } else {
                name = "/1/solo/1/7";
            }
            bus = "Playback";
            break;
        case "20":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/8";
            } else {
                name = "/1/solo/1/8";
            }
            bus = "Playback";
            break;
        case "21":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/9";
            } else {
                name = "/1/solo/1/9";
            }
            bus = "Playback";
            break;
        case "22":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/10";
            } else {
                name = "/1/solo/1/10";
            }
            bus = "Playback";
            break;
        case "23":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/11";
            } else {
                name = "/1/solo/1/11";
            }
            bus = "Playback";
            break;
        case "24":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/12";
            } else {
                name = "/1/solo/1/12";
            }
            bus = "Playback";
            break;
        case "25":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/1";
            } else {
                name = "/1/solo/1/1";
            }
            bus = "Output";
            break;
        case "26":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/2";
            } else {
                name = "/1/solo/1/2";
            }
            bus = "Output";
            break;
        case "27":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/3";
            } else {
                name = "/1/solo/1/3";
            }
            bus = "Output";
            break;
        case "28":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/4";
            } else {
                name = "/1/solo/1/4";
            }
            bus = "Output";
            break;
        case "29":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/5";
            } else {
                name = "/1/solo/1/5";
            }
            bus = "Output";
            break;
        case "30":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/6";
            } else {
                name = "/1/solo/1/6";
            }
            bus = "Output";
            break;
        case "31":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/7";
            } else {
                name = "/1/solo/1/7";
            }
            bus = "Output";
            break;
        case "32":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/8";
            } else {
                name = "/1/solo/1/8";
            }
            bus = "Output";
            break;
        case "33":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/9";
            } else {
                name = "/1/solo/1/9";
            }
            bus = "Output";
            break;
        case "34":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/10";
            } else {
                name = "/1/solo/1/10";
            }
            bus = "Output";
            break;
        case "35":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/11";
            } else {
                name = "/1/solo/1/11";
            }
            bus = "Output";
            break;
        case "36":
            if (selectedRadio == "mute") {
                name = "/1/mute/1/12";
            } else {
                name = "/1/solo/1/12";
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

function setFaderGainSetting(selectedsetting) {
    if (selectedsetting > 127) {
        selectedsetting = 127;
    }
    setSettings(selectedsetting, 'ControlValue');
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

function requestGlobalSettings(inUUID) {
    if (websocket) {
        var json = {
            "event": "getGlobalSettings",
            "context": inUUID
        };
        websocket.send(JSON.stringify(json));
    }
}

function initPropertyInspector(initDelay) {
    setTimeout(function () {
        updatePI();
    }, initDelay || 100);
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

const setSettings = (value, param) => {
    if (websocket) {
        settingsModel[param] = value;
        let settings;
        if (currentAction === "cc") {
            settings = {
                Channel: settingsModel.Channel,
                ControlValue: settingsModel.ControlValue,
                Control: settingsModel.Control,
                SelectedDevice: settingsModel.SelectedDevice,
                Devices: settingsModel.Devices
            };
        } else if (currentAction === "note") {
            settings = {
                Channel: midiChannelMapping[midiNoteMapping[settingsModel.FunctSelect - 1]],
                Devices: settingsModel.Devices,
                SelectedDevice: settingsModel.SelectedDevice,
                FunctSelect: midiNoteMapping[settingsModel.FunctSelect - 1]
            };
        } else if (currentAction === "osctoggle") {
            settings = {
                IP: settingsModel.IP,
                Port: settingsModel.Port,
                Name: settingsModel.Name,
                SelectedAction: settingsModel.SelectedAction
            };
        } else if (currentAction === "osconoff") {
            settings = {
                IP: settingsModel.IP,
                Port: settingsModel.Port,
                Name: settingsModel.Name,
                SelectedAction: settingsModel.SelectedAction,
                Bus: settingsModel.Bus,
                MuteSolo: settingsModel.MuteSolo
            };
        }
        var json = {
            "event": "setSettings",
            "context": uuid,
            "payload": {
                "settingsModel": settings
            }
        };
        websocket.send(JSON.stringify(json));
    }
};