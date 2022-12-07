using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Threading.Tasks;
using System.Drawing;
using BarRaider.SdTools.Wrappers;

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

            [JsonProperty(PropertyName = "MuteSolo")]
            public string MuteSolo { get; set; }

            [JsonProperty(PropertyName = "SettingValue")]
            public float SettingValue { get; set; }

            [JsonProperty(PropertyName = "MirrorTotalMix")]
            public bool MirrorTotalMix { get; set; }

            [JsonProperty(PropertyName = "DisplayChannelName")]
            public bool DisplayChannelName { get; set; }

            [JsonProperty(PropertyName = "ChannelCount")]
            public Int32 ChannelCount { get; set; }
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
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Key Pressed");
            if (Globals.backgroundConnection && Globals.commandConnection)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: both connections present");
                char channel = this.settings.Name[this.settings.Name.Length - 1];
                Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue($"/1/trackname{channel}", out string trackname);
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort);
                if (payload.State == 1)
                {
                    Sender.Send(this.settings.Name, 0, Globals.interfaceIp, Globals.interfacePort);
                    DrawImage(trackname, "Images/actionDefaultImage.png");
                    Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                }
                else
                {
                    Sender.Send(this.settings.Name, 1, Globals.interfaceIp, Globals.interfacePort);
                    if (settings.Name.Contains("solo"))
                    {
                        DrawImage(trackname, "Images/soloOn.png");
                    }
                    else if (settings.Name.Contains("phantom"))
                    {
                        DrawImage(trackname, "Images/phantomOn.png");
                    }
                    else if (settings.Name.Contains("mute"))
                    {
                        DrawImage(trackname, "Images/muteOn.png");
                    }
                    Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                }
            } 
            if (!Globals.backgroundConnection && Globals.commandConnection)
            {
                Sender.Send($"/1/bus{this.settings.Bus}", 1, Globals.interfaceIp, Globals.interfacePort).Wait();
                if (payload.State == 1)
                {
                    Sender.Send(this.settings.Name, 0, Globals.interfaceIp, Globals.interfacePort);
                    DrawImage("", "Images/actionDefaultImage.png");
                    Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                }
                else
                {
                    Sender.Send(this.settings.Name, 1, Globals.interfaceIp, Globals.interfacePort);
                    if (settings.Name.Contains("solo"))
                    {
                        DrawImage("", "Images/soloOn.png");
                    }
                    else if (settings.Name.Contains("phantom"))
                    {
                        DrawImage("", "Images/phantomOn.png");
                    }
                    else if (settings.Name.Contains("mute"))
                    {
                        DrawImage("", "Images/muteOn.png");
                    }
                    Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                }
            }
            else
            {
                //
            }
            
        }

        public override void KeyReleased(KeyPayload payload)
        {

        }
        public override void OnTick()
        {
            if (!Globals.commandConnection)
            {
                DrawImage("No connection", "Images/mixerOff.png", 9);
            }
            else
            {
                if (this.settings.MirrorTotalMix == true && Globals.backgroundConnection == true && this.settings.Name != null && this.settings.Bus != null)
                {
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
                        Logger.Instance.LogMessage(TracingLevel.INFO, $"OscOnOff: OnTick, mirror, try catch => {ex.Message}");
                    }
                }
                if (this.settings.MirrorTotalMix == false && this.settings.Name != null && this.settings.Bus != null)
                {
                    String trackname = "";
                    try
                    {
                        char channel = this.settings.Name[this.settings.Name.Length - 1];
                        Globals.bankSettings[$"{this.settings.Bus}"].TryGetValue($"/1/trackname{channel}", out trackname);
                    }
                    catch
                    {
                        //
                    }
                    finally
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
                    }
                }
                if (!Globals.backgroundConnection && this.settings.MirrorTotalMix == true)
                {
                    DrawImage("⚠ mirror error", "Images/actionDefaultImage.png", 8);
                }
            }
        }

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Tools.AutoPopulateSettings(settings, payload.Settings);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscOnOff: Settings loaded: {payload.Settings}");
        }

        private void DrawImage(String trackname, String imagePath, Int32 size = 12)
        {
            TitleParameters tp = new TitleParameters(new FontFamily("Arial"), System.Drawing.FontStyle.Bold, size, Color.White, false, TitleVerticalAlignment.Bottom);
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


        #endregion

    }
}