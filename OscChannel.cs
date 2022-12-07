using BarRaider.SdTools;
using BarRaider.SdTools.Wrappers;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Drawing;
using System.Threading.Tasks;

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
                    Bus = "Input",
                    SelectedValue = String.Empty,
                    SelectedFunction = "1",
                    DisplayChannelName = true,
                    ChannelCount = Globals.channelCount
                };
                return instance;
            }

            [FilenameProperty]
            [JsonProperty(PropertyName = "Name")]
            public string Name { get; set; }

            [JsonProperty(PropertyName = "SelectedAction")]
            public string SelectedAction { get; set; }

            [JsonProperty(PropertyName = "Bus")]
            public string Bus { get; set; }

            [JsonProperty(PropertyName = "SelectedValue")]
            public string SelectedValue { get; set; }

            [JsonProperty(PropertyName = "SelectedFunction")]
            public string SelectedFunction { get; set; }

            [JsonProperty(PropertyName = "ChannelCount")]
            public Int32 ChannelCount { get; set; }

            [JsonProperty(PropertyName = "DisplayChannelName")]
            public bool DisplayChannelName { get; set; }
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
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send(settings.Name, dBInFloat, Globals.interfaceIp, Globals.interfacePort);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set Volume: {settings.Name} {dBInFloat}");
            }
            // gain/gainRight
            else if (settings.SelectedFunction == "10" || settings.SelectedFunction == "11")
            {
                Sender.Send("/setBankStart", 0, Globals.interfaceIp, Globals.interfacePort);
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= Globals.channelCount)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                }
                else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-input channel: {settings.SelectedAction}");
                    return;
                }
                Sender.Send("/setBankStart", channelNumber - 1, Globals.interfaceIp, Globals.interfacePort);
                int selectedValue = 0;
                if (settings.SelectedValue != "")
                {
                    selectedValue = Int32.Parse(settings.SelectedValue);
                }
                dBInFloat = (float)Math.Round(selectedValue / 65.0, 2);
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send(settings.Name, dBInFloat, Globals.interfaceIp, Globals.interfacePort);
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
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send(settings.Name, dBInFloat, Globals.interfaceIp, Globals.interfacePort);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Pan Channel: {settings.Name} {dBInFloat}");
            } // All Channels Toggles
            else if (settings.SelectedFunction == "3" || settings.SelectedFunction == "4" || settings.SelectedFunction == "8" || settings.SelectedFunction == "13" || settings.SelectedFunction == "14" || settings.SelectedFunction == "15")
            {

                Sender.Send("/setBankStart", 0, Globals.interfaceIp, Globals.interfacePort);

                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= Globals.channelCount)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                }
                else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount && Int32.Parse(settings.SelectedAction) <= Globals.channelCount * 2)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - Globals.channelCount;
                }
                else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount && Int32.Parse(settings.SelectedAction) <= Globals.channelCount * 3)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - (Globals.channelCount * 2);
                }

                Sender.Send("/setBankStart", channelNumber - 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send(settings.Name, 1, Globals.interfaceIp, Globals.interfacePort);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name} on Channel: {channelNumber} -> {settings.Name}");
            }
            // Input Channels Only Toggle
            else if (settings.SelectedFunction == "5" || settings.SelectedFunction == "6")
            {
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send("/setBankStart", 0, Globals.interfaceIp, Globals.interfacePort);
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= Globals.channelCount)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                }
                else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-input channel: {settings.SelectedAction}");
                    return;
                }

                Sender.Send("/setBankStart", channelNumber - 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send(settings.Name, 1, Globals.interfaceIp, Globals.interfacePort);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name}: {channelNumber} -> {settings.Name}");
            }
            // width
            else if (settings.SelectedFunction == "12")
            {
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send("/setBankStart", 0, Globals.interfaceIp, Globals.interfacePort);

                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= Globals.channelCount)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction);
                }
                else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount && Int32.Parse(settings.SelectedAction) <= Globals.channelCount * 2)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - Globals.channelCount;
                }
                else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount * 2)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-input/playback channel: {settings.SelectedAction}");
                    return;
                }
                Sender.Send("/setBankStart", channelNumber - 1, Globals.interfaceIp, Globals.interfacePort);
                float selectedValue = 0.0f;
                if (settings.SelectedValue != "")
                {
                    selectedValue = float.Parse(settings.SelectedValue);
                }
                if (selectedValue < -100)
                {
                    selectedValue = -100;
                }
                else if (selectedValue > 100)
                {
                    selectedValue = 100;
                }
                dBInFloat = (float)Math.Round((selectedValue + 100) / 200, 2);
                Sender.Send(settings.Name, dBInFloat, Globals.interfaceIp, Globals.interfacePort);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name}: {channelNumber} -> {settings.Name}");
            }
            //Output Channels only Toggle
            else if (settings.SelectedFunction == "7" || settings.SelectedFunction == "9")
            {
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send("/setBankStart", 0, Globals.interfaceIp, Globals.interfacePort);
                int channelNumber = 1;
                if (Int32.Parse(settings.SelectedAction) >= Globals.channelCount * 2 && Int32.Parse(settings.SelectedAction) <= Globals.channelCount * 3)
                {
                    channelNumber = Int32.Parse(settings.SelectedAction) - Globals.channelCount * 2;
                }
                else if (Int32.Parse(settings.SelectedAction) < Globals.channelCount * 2)
                {
                    Connection.ShowAlert();
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Tried to set {settings.Name} on non-output channel: {settings.SelectedAction}");
                    return;
                }
                Sender.Send("/setBankStart", channelNumber - 1, Globals.interfaceIp, Globals.interfacePort);
                Sender.Send(settings.Name, 1, Globals.interfaceIp, Globals.interfacePort);
                Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Set {settings.Name}: {channelNumber} -> {settings.Name}");
            }
        }

        public override void KeyReleased(KeyPayload payload)
        {

        }

        public override void OnTick()
        {
            if (!Globals.commandConnection)
            {
                DrawImage("No connection", "Images/mixerOff.png");
            }
            var trackname = "";
            try
            {
                Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue($"/1/trackname{ChannelNumber()}", out trackname);
            }
            catch
            {
                //
            }
            finally
            {
                switch (this.settings.SelectedFunction)
                {
                    case "1":
                        DrawImage(trackname, "Images/volume.png");
                        break;
                    case "2":
                        DrawImage(trackname, "Images/pan.png");
                        break;
                    case "3":
                        DrawImage(trackname, "Images/phaseOff.png");
                        break;
                    case "4":
                        DrawImage(trackname, "Images/phaseRightOff.png");
                        break;
                    case "5":
                        DrawImage(trackname, "Images/phantomOff.png");
                        break;
                    case "6":
                        DrawImage(trackname, "Images/autoset.png");
                        break;
                    case "7":
                        DrawImage(trackname, "Images/loopback.png");
                        break;
                    case "8":
                        DrawImage(trackname, "Images/stereo.png");
                        break;
                    case "9":
                        DrawImage(trackname, "Images/cueOff.png");
                        break;
                    case "10":
                        DrawImage(trackname, "Images/gain.png");
                        break;
                    case "11":
                        DrawImage(trackname, "Images/gain.png");
                        break;
                    default:
                        break;
                }
            }
        }
        private Int32 ChannelNumber()
        {
            if (Int32.Parse(settings.SelectedAction) >= 1 && Int32.Parse(settings.SelectedAction) <= Globals.channelCount)
            {
                return _ = Int32.Parse(settings.SelectedAction);
            }
            else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount && Int32.Parse(settings.SelectedAction) <= Globals.channelCount * 2)
            {
                return _ = Int32.Parse(settings.SelectedAction) - Globals.channelCount;
            }
            else if (Int32.Parse(settings.SelectedAction) > Globals.channelCount * 2 && Int32.Parse(settings.SelectedAction) <= Globals.channelCount * 3)
            {
                return _ = Int32.Parse(settings.SelectedAction) - Globals.channelCount * 2;
            }
            return 0;
        }
        private void DrawImage(String trackname, String imagePath)
        {
            TitleParameters tp = new TitleParameters(new FontFamily("Arial"), System.Drawing.FontStyle.Bold, 12, Color.White, false, TitleVerticalAlignment.Bottom);
            using (Image image = Tools.GenerateGenericKeyImage(out Graphics graphics))
            {
                Image actionImage = Image.FromFile(@imagePath);
                graphics.DrawImage(actionImage, 0, 0, image.Width, image.Height);
                if (settings.DisplayChannelName)
                {
                    graphics.AddTextPath(tp, image.Width, image.Height, trackname);
                }
                Connection.SetImageAsync(image);
                graphics.Dispose();
            }
        }

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Tools.AutoPopulateSettings(settings, payload.Settings);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Settings loaded: {payload.Settings}");
        }

        public override void ReceivedGlobalSettings(ReceivedGlobalSettingsPayload payload) { }

        #region Private Methods

        #endregion
    }
}