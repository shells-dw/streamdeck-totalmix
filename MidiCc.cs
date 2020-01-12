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

namespace streamdeck_totalmix
{
    [PluginActionId("de.shells.totalmix.midicc.action")]

public class MidiCc : PluginBase
    {
        private class PluginSettings
        {
            public static PluginSettings CreateDefaultSettings()
            {
                string[] MidiDevicesPresent = MidiDeviceManager.Default.OutputDevices.Select(d => d.Name).ToArray();
                PluginSettings instance = new PluginSettings
                {
                    Channel = 1,
                    Control = 102,
                    ControlValue = 0,
                    SelectedDevice = "0",
                    Devices = MidiDevicesPresent
                };
                return instance;
            }
            public static PluginSettings UpdateMidiDevices(int channel, int control, int controlvalue, string selecteddevice)
            {
                string[] MidiDevicesPresent = MidiDeviceManager.Default.OutputDevices.Select(d => d.Name).ToArray();
                PluginSettings instance = new PluginSettings
                {
                    Channel = channel,
                    Control = control,
                    ControlValue = controlvalue,
                    SelectedDevice = selecteddevice,
                    Devices = MidiDevicesPresent
                };
                return instance;
            }

            [FilenameProperty]
            [JsonProperty(PropertyName = "Channel")]
            public int Channel { get; set; }

            [JsonProperty(PropertyName = "Control")]
            public int Control { get; set; }

            [JsonProperty(PropertyName = "ControlValue")]
            public int ControlValue { get; set; }

            [JsonProperty(PropertyName = "SelectedDevice")]
            public string SelectedDevice { get; set; }

            [JsonProperty(PropertyName = "Devices")]
            public string[] Devices { get; private set; }

        }

        #region Private Members

        private PluginSettings settings;

        #endregion
        public MidiCc(SDConnection connection, InitialPayload payload) : base(connection, payload)
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
                this.settings = PluginSettings.UpdateMidiDevices(this.settings.Channel, this.settings.Control, this.settings.ControlValue, this.settings.SelectedDevice);
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
            this.MidiCC(this.settings.Channel, this.settings.Control, this.settings.ControlValue);
        }

        public override void KeyReleased(KeyPayload payload) {
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

        public void MidiCC(int channel, int control, int value)
        {
            var midiChannel = (Channel)(channel - 1);
            if (MidiDevice.MidiDevice.outputDevice.IsOpen)
            {
                MidiDevice.MidiDevice.outputDevice.Send(new ControlChangeMessage(midiChannel, control, value));
            }
        }
    }
}