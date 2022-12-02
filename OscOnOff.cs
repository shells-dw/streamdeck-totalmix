using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Threading.Tasks;
using System.Drawing;
using System.Threading;
using BarRaider.SdTools.Wrappers;
using RtMidi.Core.Enums;

namespace streamdeck_totalmix
{
    [PluginActionId("de.shells.totalmix.osconoff.action")]
    public class OscOnOff : PluginBase
    {
        private class PluginSettings
        {
            public static PluginSettings CreateDefaultSettings()
            {
                PluginSettings instance = new PluginSettings
                {
                    Name = String.Empty,
                    SelectedAction = "1",
                    Bus = String.Empty,
                    MuteSolo = String.Empty,
                    SettingValue = 1.0f,
                    MirrorTotalMix = false,
                    DisplayChannelName = true
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

            [JsonProperty(PropertyName = "MuteSolo")]
            public string MuteSolo { get; set; }

            [JsonProperty(PropertyName = "SettingValue")]
            public float SettingValue { get; set; }

            [JsonProperty(PropertyName = "MirrorTotalMix")]
            public bool MirrorTotalMix { get; set; }

            [JsonProperty(PropertyName = "DisplayChannelName")]
            public bool DisplayChannelName { get; set; }
        }

        #region Private Members

        private PluginSettings settings;

        #endregion
        public OscOnOff(SDConnection connection, InitialPayload payload) : base(connection, payload)
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
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Destructor called");
        }
        public override void KeyPressed(KeyPayload payload)
        {
            Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue(this.settings.Name, out string address);
            char channel = this.settings.Name[this.settings.Name.Length - 1];
            Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue($"/1/trackname{channel}", out string trackname);
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Key Pressed");
            if (this.settings.Bus == "Input")
            {
                Task.Run(() => HelperFunctions.SendOscCommand("/1/busInput", 1, Globals.interfaceIp, Globals.interfacePort)).GetAwaiter().GetResult();
            }
            else if (this.settings.Bus == "Playback")
            {
                Task.Run(() => HelperFunctions.SendOscCommand("/1/busPlayback", 1, Globals.interfaceIp, Globals.interfacePort)).GetAwaiter().GetResult();
            }
            else if (this.settings.Bus == "Output")
            {
                Task.Run(() => HelperFunctions.SendOscCommand("/1/busOutput", 1, Globals.interfaceIp, Globals.interfacePort)).GetAwaiter().GetResult();
            }
            if (payload.State == 1)
            {
                Task.Run(() => HelperFunctions.SendOscCommand(this.settings.Name, 0, Globals.interfaceIp, Globals.interfacePort)).GetAwaiter().GetResult();
                DrawImage(trackname, "Images/actionDefaultImage.png");

            }
            else
            {
                Task.Run(() => HelperFunctions.SendOscCommand(this.settings.Name, 1, Globals.interfaceIp, Globals.interfacePort)).GetAwaiter().GetResult();
                if (settings.Name.Contains("solo"))
                {
                    DrawImage(trackname, "Images/soloOn.png");
                }
                if (settings.Name.Contains("phantom"))
                {
                    DrawImage(trackname, "Images/phantomOn.png");
                }
                else
                {
                    DrawImage(trackname, "Images/muteOn.png");
                }
                Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
            }
        }

        public override void KeyReleased(KeyPayload payload)
        {

        }
        public override void OnTick()
        {
            if (this.settings.MirrorTotalMix == true && this.settings.Name != null && this.settings.Bus != null)
            {
                TimeSpan elapsedSpan = new TimeSpan(DateTime.Now.Ticks - Globals.lastQuery.Ticks);
                if (Globals.bankSettings[$"{this.settings.Bus}"].Count != 0 || elapsedSpan.TotalSeconds > 10)
                {
                    if (elapsedSpan.TotalSeconds > 1)
                    {
                        Globals.lastQuery = DateTime.Now;
                        Listener listener = new Listener();
                        listener.Listen(this.settings.Bus, $"/1/bus{this.settings.Bus}", 1);
                    }
                }
                try
                {
                    if (Globals.bankSettings[$"{this.settings.Bus}"].ContainsKey(this.settings.Name))
                    {
                        if (Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue("/1/bus" + this.settings.Bus, out string busValue))
                        {
                            if (busValue == "1")
                            {
                                if (Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue(this.settings.Name, out string result))
                                {
                                    char channel = this.settings.Name[this.settings.Name.Length - 1];
                                    Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue($"/1/trackname{channel}", out string trackname);
                                    if (result == "1")
                                    {
                                        if (settings.Name.Contains("solo"))
                                        {
                                            DrawImage(trackname, "Images/soloOn.png");
                                        }
                                        if (settings.Name.Contains("phantom"))
                                        {
                                            DrawImage(trackname, "Images/phantomOn.png");
                                        }
                                        if (settings.Name.Contains("mute"))
                                        {
                                            DrawImage(trackname, "Images/muteOn.png");
                                        }
                                        Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                    }
                                    else
                                    {
                                        if (settings.Name.Contains("solo"))
                                        {
                                            DrawImage(trackname, "Images/soloOff.png");
                                        }
                                        if (settings.Name.Contains("phantom"))
                                        {
                                            DrawImage(trackname, "Images/phantomOff.png");
                                        }
                                        if (settings.Name.Contains("mute"))
                                        {
                                            DrawImage(trackname, "Images/muteOff.png");
                                        }
                                        Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                    }
                                }
                                else
                                {
                                    Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Could not find the specific key in bankSetting dict");
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscOnOff: OnTick, try catch => {ex.Message}");
                }
            }
        }

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Tools.AutoPopulateSettings(settings, payload.Settings);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscOnOff: Settings loaded: {payload.Settings}");
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

        public override void ReceivedGlobalSettings(ReceivedGlobalSettingsPayload payload) { }

        #region Private Methods

        private Task SaveSettings()
        {
            return Connection.SetSettingsAsync(JObject.FromObject(settings));
        }

        #endregion

    }
}