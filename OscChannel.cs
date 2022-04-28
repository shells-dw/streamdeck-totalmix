using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Threading.Tasks;
using SharpOSC;

namespace streamdeck_totalmix
{
    [PluginActionId("de.shells.totalmix.oscchannel.action")]
    public class OscChannel : PluginBase
    {
        private class PluginSettings
        {
            public static PluginSettings CreateDefaultSettings()
            {
                PluginSettings instance = new PluginSettings
                {
                    Name = "/1/volume1",
                    SelectedAction = "1",
                    Port = 7001,
                    IP = "127.0.0.1",
                    Bus = "Input",
                    SelectedValue = String.Empty,
                    SelectedFunction = "1"
                };
                return instance;
            }

            [FilenameProperty]
            [JsonProperty(PropertyName = "Name")]
            public string Name { get; set; }

            [JsonProperty(PropertyName = "Port")]
            public int Port { get; set; }

            [JsonProperty(PropertyName = "IP")]
            public string IP { get; set; }

            [JsonProperty(PropertyName = "SelectedAction")]
            public string SelectedAction { get; set; }

            [JsonProperty(PropertyName = "Bus")]
            public string Bus { get; set; }

            [JsonProperty(PropertyName = "SelectedValue")]
            public string SelectedValue { get; set; }

            [JsonProperty(PropertyName = "SelectedFunction")]
            public string SelectedFunction { get; set; }
        }

        #region Private Members

        private PluginSettings settings;
        private float dBInFloat;
        private string selectedValue;

        #endregion
        public OscChannel(SDConnection connection, InitialPayload payload) : base(connection, payload)
        {
            if (payload.Settings == null || payload.Settings.Count == 0)
            {
                this.settings = PluginSettings.CreateDefaultSettings();
                Connection.SetSettingsAsync(JObject.FromObject(settings));

                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscOnOff: Settings initially set: {this.settings}");
            }
            else
            {
                this.settings = payload.Settings.ToObject<PluginSettings>();
            }
        }


        public override void Dispose()
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscChannel: Destructor called");
        }

        public override void KeyPressed(KeyPayload payload)
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscChannel: Key Pressed");
            // volume
            if (settings.SelectedFunction == "1")
            {
                int selectedValue = 0;
                if (settings.SelectedValue != "")
                {
                    selectedValue = Int32.Parse(settings.SelectedValue);
                }
                dBInFloat = (float)Math.Round(selectedValue / 100.0, 2);
                SetBus();
                SendOscCommand(settings.Name, dBInFloat, settings.IP, settings.Port);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set Volume: {settings.Name} {dBInFloat}");
            }
            // gain/gainRight
            else if (settings.SelectedFunction == "10" || settings.SelectedFunction == "11")
            {
                for (int i = 0; i < 16; i++)
                {
                    SendOscCommand("/2/track-", 1.0f, settings.IP, settings.Port);
                }
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= 16)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                }
                else if (Int32.Parse(settings.SelectedAction) > 16)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-input channel: {settings.SelectedAction}");
                    return;
                }
                for (int i = 0; i < channelNumber; i++)
                {
                    if (i > 0)
                    {
                        SendOscCommand("/2/track+", 1.0f, settings.IP, settings.Port);
                    }
                }
                int selectedValue = 0;
                if (settings.SelectedValue != "")
                {
                    selectedValue = Int32.Parse(settings.SelectedValue);
                }
                dBInFloat = (float)Math.Round(selectedValue / 65.0, 2);
                SetBus();
                SendOscCommand(settings.Name, dBInFloat, settings.IP, settings.Port);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set Volume: {settings.Name} {dBInFloat}");
            }
            // pan
            else if (settings.SelectedFunction == "2")
            {
                if (settings.SelectedValue.Contains("LR"))
                {
                    selectedValue = "0";
                }
                else if (settings.SelectedValue.Contains("L"))
                {
                    selectedValue = settings.SelectedValue.Replace('L', '-');
                }
                else if (settings.SelectedValue.Contains("R"))
                {
                    selectedValue = settings.SelectedValue.Replace('R', '+');
                }
                else if (settings.SelectedValue == "0")
                {
                    selectedValue = settings.SelectedValue;
                }
                else
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on channel: {settings.SelectedAction} with value: {settings.SelectedValue}");
                    return;
                }
                dBInFloat = (float)Math.Round((Int32.Parse(selectedValue) + 100) / 200.0, 2);
                SetBus();
                SendOscCommand(settings.Name, dBInFloat, settings.IP, settings.Port);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Pan Channel: {settings.Name} {dBInFloat}");
            } // All Channels Toggles
            else if (settings.SelectedFunction == "3" || settings.SelectedFunction == "4" || settings.SelectedFunction == "8" || settings.SelectedFunction == "13" || settings.SelectedFunction == "14" || settings.SelectedFunction == "15")
            {
                for (int i = 0; i < 16; i++)
                {
                    SendOscCommand("/2/track-", 1.0f, settings.IP, settings.Port);
                }

                SetBus();
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= 16)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                } else if (Int32.Parse(settings.SelectedAction) >= 16 && Int32.Parse(settings.SelectedAction) <= 32)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - 16;
                } else if (Int32.Parse(settings.SelectedAction) >= 33 && Int32.Parse(settings.SelectedAction) <= 48)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - 32;
                }

                for (int i = 0; i < channelNumber; i++)
                    {
                        if (i > 0)
                        {
                            SendOscCommand("/2/track+", 1.0f, settings.IP, settings.Port);
                        }
                    }
                    SendOscCommand(settings.Name, 1.0f, settings.IP, settings.Port);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name} on Channel: {channelNumber} -> {settings.Name}");
            }
            // Input Channels Only Toggle
            else if (settings.SelectedFunction == "5" || settings.SelectedFunction == "6")
            {
                SetBus();
                for (int i = 0; i < 16; i++)
                {
                    SendOscCommand("/2/track-", 1.0f, settings.IP, settings.Port);
                }
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= 16)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                }
                else if (Int32.Parse(settings.SelectedAction) > 16)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-input channel: {settings.SelectedAction}");
                    return;
                }
                for (int i = 0; i < channelNumber; i++)
                {
                    if (i > 0)
                    {
                        SendOscCommand("/2/track+", 1.0f, settings.IP, settings.Port);
                    }
                }
                SendOscCommand(settings.Name, 1.0f, settings.IP, settings.Port);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name}: {channelNumber} -> {settings.Name}");
            }
            // width
            else if (settings.SelectedFunction == "12")
            {
                SetBus();
                for (int i = 0; i < 16; i++)
                {
                    SendOscCommand("/2/track-", 1.0f, settings.IP, settings.Port);
                }
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= 16)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                }
                else if (Int32.Parse(settings.SelectedAction) >= 17 && Int32.Parse(settings.SelectedAction) <= 32)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - 16;
                }
                else if (Int32.Parse(settings.SelectedAction) > 32)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-input/playback channel: {settings.SelectedAction}");
                    return;
                }
                for (int i = 0; i < channelNumber; i++)
                {
                    if (i > 0)
                    {
                        SendOscCommand("/2/track+", 1.0f, settings.IP, settings.Port);
                    }
                }
                float selectedValue = 0.0f;
                if (settings.SelectedValue != "")
                {
                    selectedValue = float.Parse(settings.SelectedValue);
                }
                if (selectedValue < -100)
                {
                    selectedValue = -100;
                } else if (selectedValue > 100)
                {
                    selectedValue = 100;
                }
                dBInFloat = (float)Math.Round((selectedValue + 100) / 200, 2);
                SendOscCommand(settings.Name, dBInFloat, settings.IP, settings.Port);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name}: {channelNumber} -> {settings.Name}");
            }
            //Output Channels only Toggle
            else if (settings.SelectedFunction == "7" || settings.SelectedFunction == "9")
            {
                SetBus();
                for (int i = 0; i < 16; i++)
                {
                    SendOscCommand("/2/track-", 1.0f, settings.IP, settings.Port);
                }
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 33 && Int32.Parse(settings.SelectedAction) <= 48)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - 32;
                }
                else if (Int32.Parse(settings.SelectedAction) < 33)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-output channel: {settings.SelectedAction}");
                    return;
                }
                for (int i = 0; i < channelNumber; i++)
                {
                    if (i > 0)
                    {
                        SendOscCommand("/2/track+", 1.0f, settings.IP, settings.Port);
                    }
                }
                SendOscCommand(settings.Name, 1.0f, settings.IP, settings.Port);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name}: {channelNumber} -> {settings.Name}");
            }
        }

        public override void KeyReleased(KeyPayload payload)
        {

        }

        public override void OnTick() { }

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Tools.AutoPopulateSettings(settings, payload.Settings);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Settings loaded: {payload.Settings}");
        }

        public override void ReceivedGlobalSettings(ReceivedGlobalSettingsPayload payload) { }

        #region Private Methods

        private Task SaveSettings()
        {
            return Connection.SetSettingsAsync(JObject.FromObject(settings));
        }

        #endregion


        public void SendOscCommand(string name, float value, string ip, int port)
        {
            var message = new OscMessage(name, value);
            var sender = new UDPSender(ip, port);
            sender.Send(message);
        }

        public void SetBus()
        {
            if (this.settings.Bus == "Input")
            {
                SendOscCommand("/1/busInput", 1.0f, settings.IP, settings.Port);
            }
            else if (this.settings.Bus == "Playback")
            {
                SendOscCommand("/1/busPlayback", 1.0f, settings.IP, settings.Port);
            }
            else if (this.settings.Bus == "Output")
            {
                SendOscCommand("/1/busOutput", 1.0f, settings.IP, settings.Port);
            }
        }
    }
}