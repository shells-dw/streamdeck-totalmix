using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using RtMidi.Core;
using RtMidi.Core.Devices;
using RtMidi.Core.Devices.Infos;
using RtMidi.Core.Enums;
using RtMidi.Core.Messages;

namespace MidiDevice
{
    static class MidiDevice
    {
        public static IMidiOutputDevice outputDevice;
    }
}
namespace streamdeck_totalmix
{
    [PluginActionId("de.shells.totalmix.midinote.action")]

public class MidiNote : PluginBase
    {
        private class PluginSettings
        {
            public static PluginSettings CreateDefaultSettings()
            {
                string[] MidiDevicesPresent = MidiDeviceManager.Default.OutputDevices.Select(d => d.Name).ToArray();
                PluginSettings instance = new PluginSettings
                {
                    Channel = 1,
                    SelectedMidiAction = "1",
                    MidiNote = 54,
                    SelectedDevice = "0",
                    Devices = MidiDevicesPresent
                };
                return instance;
            }
            public static PluginSettings UpdateMidiDevices(int channel, string selectedmidiaction, int midinote, string selecteddevice)
            {
                string[] MidiDevicesPresent = MidiDeviceManager.Default.OutputDevices.Select(d => d.Name).ToArray();
                PluginSettings instance = new PluginSettings
                {
                    Channel = channel,
                    SelectedMidiAction = selectedmidiaction,
                    MidiNote = midinote,
                    SelectedDevice = selecteddevice,
                    Devices = MidiDevicesPresent
                };
                return instance;
            }

            [FilenameProperty]
            [JsonProperty(PropertyName = "Channel")]
            public int Channel { get; set; }

            [JsonProperty(PropertyName = "SelectedMidiAction")]
            public string SelectedMidiAction { get; set; }

            [JsonProperty(PropertyName = "MidiNote")]
            public int MidiNote { get; set; }

            [JsonProperty(PropertyName = "SelectedDevice")]
            public string SelectedDevice { get; set; }

            [JsonProperty(PropertyName = "Devices")]
            public string[] Devices { get; private set; }

        }

        #region Private Members

        private PluginSettings settings;

        #endregion
        public MidiNote(SDConnection connection, InitialPayload payload) : base(connection, payload)
        {
            if (payload.Settings == null || payload.Settings.Count == 0)
            {
                this.settings = PluginSettings.CreateDefaultSettings();
                Connection.SetSettingsAsync(JObject.FromObject(settings));

                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscToggle: Settings initially set: {this.settings}");
            }
            else
            {

                this.settings = payload.Settings.ToObject<PluginSettings>();
                this.settings = PluginSettings.UpdateMidiDevices(this.settings.Channel, this.settings.SelectedMidiAction, this.settings.MidiNote, this.settings.SelectedDevice);
                Connection.SetSettingsAsync(JObject.FromObject(settings));
            }
        }

        public override void Dispose()
        {
           Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Destructor called");
        }

        public override void KeyPressed(KeyPayload payload)
        {
            this.settings = payload.Settings.ToObject<PluginSettings>();
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Key Pressed");
        IMidiOutputDeviceInfo outputDeviceInfo = MidiDeviceManager.Default.OutputDevices.ElementAt(Int32.Parse(this.settings.SelectedDevice));
        MidiDevice.MidiDevice.outputDevice = outputDeviceInfo.CreateDevice();
        if (!MidiDevice.MidiDevice.outputDevice.IsOpen)
        {
                MidiDevice.MidiDevice.outputDevice.Open();
        }
        this.MidiOn(this.settings.Channel, this.settings.MidiNote);
    }

        public override void KeyReleased(KeyPayload payload) {
        this.MidiOff(this.settings.Channel, this.settings.MidiNote);
        if (MidiDevice.MidiDevice.outputDevice != null)
        {
                MidiDevice.MidiDevice.outputDevice.Close();
        }
    }

        public override void OnTick() { }

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscToggle: Payload Settings loaded: {payload.Settings}");
            //Tools.AutoPopulateSettings(settings, payload.Settings);

            Connection.SetSettingsAsync(JObject.FromObject(payload.Settings));
        }

        public override void ReceivedGlobalSettings(ReceivedGlobalSettingsPayload payload) { }

        #region Private Methods

        private Task SaveSettings()
        {
            return Connection.SetSettingsAsync(JObject.FromObject(settings));
        }

        #endregion

        public void MidiOn(int channel, int note)
        {
            var midiChannel = (Channel)(channel - 1);
            var midiNote = (Key)note;
            if (MidiDevice.MidiDevice.outputDevice.IsOpen)
            {
                MidiDevice.MidiDevice.outputDevice.Send(new NoteOnMessage(midiChannel, midiNote, 1));
            }
        }

        public void MidiOff(int channel, int note)
        {
            var midiChannel = (Channel)(channel - 1);
            var midiNote = (Key)note;
            if (MidiDevice.MidiDevice.outputDevice.IsOpen)
            {
                MidiDevice.MidiDevice.outputDevice.Send(new NoteOffMessage(midiChannel, midiNote, 1));
            }
        }
    }
}