using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Drawing;
using BarRaider.SdTools.Wrappers;

namespace streamdeck_totalmix
{
    [PluginActionId("de.shells.totalmix.osctoggle.action")]
    public class OscToggle : PluginBase
    {
        private class PluginSettings
        {
            public static PluginSettings CreateDefaultSettings()
            {
                PluginSettings instance = new PluginSettings
                {
                    Name = "/3/snapshots/8/1",
                    SelectedAction = "1",
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

            [JsonProperty(PropertyName = "ChannelCount")]
            public Int32 ChannelCount { get; set; }

            [JsonProperty(PropertyName = "Latch")]
            public Boolean Latch { get; set; }

            [JsonProperty(PropertyName = "DisplayChannelName")]
            public bool DisplayChannelName { get; set; }
        }

        #region Private Members

        private PluginSettings settings;

        #endregion
        public OscToggle(SDConnection connection, InitialPayload payload) : base(connection, payload)
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
                if (!payload.Settings.ContainsKey("DisplayChannelName"))
                {
                    this.settings.DisplayChannelName = true;
                    Connection.SetSettingsAsync(JObject.FromObject(settings));
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: !payload.Settings.ContainsKey(\"DisplayChannelName\")");
                }
                if (!payload.Settings.ContainsKey("ChannelCount"))
                {
                    this.settings.ChannelCount = Globals.channelCount;
                    Connection.SetSettingsAsync(JObject.FromObject(settings));
                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: !payload.Settings.ContainsKey(\"ChannelCount\")");
                }
                if (this.settings.ChannelCount != Globals.channelCount)
                {
                    this.settings.ChannelCount = Globals.channelCount;
                    Connection.SetSettingsAsync(JObject.FromObject(settings));

                    Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Channel Count differed to OSC, set to: {Globals.channelCount}");
                }
            }
        }

        public override void Dispose()
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Destructor called");
        }

        

        public override void KeyPressed(KeyPayload payload)
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Key Pressed");
            if (this.settings.Name == "showhideui")
            {
                HelperFunctions _helper = new HelperFunctions();
                _helper.ShowHideUi();
            }
            if (this.settings.Name != "showhideui")
            {
                Sender.Send(this.settings.Name, 1, Globals.interfaceIp, Globals.interfacePort);
            }
            if (this.settings.Latch == true)
            {
                Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
            }
            if (settings.SelectedAction == "34" || settings.SelectedAction == "35")
            {
                if (Globals.mirroringRequested && Globals.backgroundConnection && this.settings.Name != null)
                {
                    try
                    {
                        if (Globals.bankSettings["Input"].ContainsKey(this.settings.Name))
                        {
                            if (Globals.bankSettings["Input"].TryGetValue("/1/busInput", out string busValue))
                            {
                                if (busValue == "1")
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue(this.settings.Name, out string result))
                                    {
                                        var dresult = decimal.Parse(result);
                                        Decimal step = 0.02M;
                                        var newValue = settings.SelectedAction == "35" ? dresult - step : dresult + step;
                                        if (newValue < 0) newValue = 0;
                                        Sender.Send(settings.Name, (Single)newValue, Globals.interfaceIp, Globals.interfacePort);
                                        Globals.bankSettings["Input"]["/1/mastervolume"] = newValue.ToString();
                                        Logger.Instance.LogMessage(TracingLevel.INFO, $"OscToggle: Set Volume: {settings.Name} {(Single)newValue}");
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Logger.Instance.LogMessage(TracingLevel.INFO, $"OscChannel: Volume Raise/Lower => {ex.Message}");
                    }
                }
            }
            DrawImage("", "Images/mixerOn.png");
        }

        public override void KeyReleased(KeyPayload payload)
        {

            if (this.settings.Latch == true)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Key Released");
                if (this.settings.Name != "showhideui")
                {
                    Sender.Send(this.settings.Name, 1, Globals.interfaceIp, Globals.interfacePort);
                }
                DrawImage("", "Images/actionDefaultImage.png");
                Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
            }
        }

        public override void OnTick()
        {
            if (!Globals.commandConnection)
            {
                DrawImage("No connection", "Images/mixerOff.png", 9);
            }
            else
            {
                if (Globals.backgroundConnection)
                {
                    try
                    {
                        switch (this.settings.SelectedAction)
                        {
                            case "9":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/globalMute"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/globalMute", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Global Mute", "Images/muteOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Global Mute", "Images/muteOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "10":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/globalSolo"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/globalSolo", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Global Solo", "Images/soloOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Global Solo", "Images/soloOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "11":
                                DrawImage("Reverb", "Images/actionDefaultImage.png");
                                break;
                            case "12":
                                DrawImage("Echo", "Images/actionDefaultImage.png");
                                break;
                            case "13":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/trim"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/trim", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Trim", "Images/trimOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Trim", "Images/trimOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "14":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/mainDim"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/mainDim", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Main Dim", "Images/dimOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Main Dim", "Images/dimOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "15":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/mainSpeakerB"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/mainSpeakerB", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Speaker B", "Images/speakerBOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Speaker B", "Images/speakerBOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "16":
                                DrawImage("Recall", "Images/recall.png");
                                break;
                            case "17":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/mainMuteFx"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/mainMuteFx", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Main Mute FX", "Images/muteFXOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Main Mute FX", "Images/muteFXOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "18":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/mainMono"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/mainMono", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Main Mono", "Images/monoOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Main Mono", "Images/monoOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "19":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/mainExtIn"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/mainExtIn", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Ext In", "Images/extInOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Ext In", "Images/extInOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "20":
                                if (Globals.bankSettings["Input"].ContainsKey("/1/mainTalkback"))
                                {
                                    if (Globals.bankSettings["Input"].TryGetValue("/1/mainTalkback", out string result))
                                    {
                                        if (result == "1")
                                        {
                                            DrawImage("Talkback", "Images/talkbackOn.png");
                                            Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        }
                                        else
                                        {
                                            DrawImage("Talkback", "Images/talkbackOff.png");
                                            Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        }
                                    }
                                }
                                break;
                            case "33":
                                DrawImage("Show/hide UI", "Images/actionDefaultImage.png");
                                break;
                            case "34":
                                DrawImage("Main Volume", "Images/volumeRaise.png");
                                break;
                            case "35":
                                DrawImage("Main Volume", "Images/volumeLower.png");
                                break;
                            default:
                                if (1 <= Int32.Parse(this.settings.SelectedAction) && Int32.Parse(this.settings.SelectedAction) <= 8)
                                {
                                    DrawImage(HelperFunctions.GetTotalMixConfig("SnapshotName")[Int32.Parse(this.settings.SelectedAction) - 1], "Images/actionDefaultImage.png");
                                }
                                else
                                {
                                    DrawImage("", "Images/actionDefaultImage.png");
                                }
                                break;
                        }
                    }
                    catch
                    {
                        //
                    }
                }
                if (!Globals.backgroundConnection)
                {
                    switch (this.settings.SelectedAction)
                    {
                        case "9":
                            DrawImage("Global Mute", "Images/muteOff.png");
                            break;
                        case "10":
                            DrawImage("Global Solo", "Images/soloOff.png");
                            break;
                        case "11":
                            DrawImage("Reverb", "Images/actionDefaultImage.png");
                            break;
                        case "12":
                            DrawImage("Echo", "Images/actionDefaultImage.png");
                            break;
                        case "13":
                            DrawImage("Trim", "Images/trimOff.png");
                            break;
                        case "14":
                            DrawImage("Main Dim", "Images/dimOff.png");
                            break;
                        case "15":
                            DrawImage("Speaker B", "Images/speakerBOff.png");
                            break;
                        case "16":
                            DrawImage("Recall", "Images/recall.png");
                            break;
                        case "17":
                            DrawImage("Main Mute FX", "Images/muteFXOff.png");
                            break;
                        case "18":
                            DrawImage("Main Mono", "Images/monoOff.png");
                            break;
                        case "19":
                            DrawImage("Ext In", "Images/extInOff.png");
                            break;
                        case "20":
                            DrawImage("Talkback", "Images/talkbackOff.png");
                            break;
                        case "33":
                            DrawImage("Show/hide UI", "Images/actionDefaultImage.png");
                            break;
                        default:
                            if (1 <= Int32.Parse(this.settings.SelectedAction) && Int32.Parse(this.settings.SelectedAction) <= 8)
                            {
                                DrawImage($"Snapshot {this.settings.SelectedAction}", "Images/actionDefaultImage.png");
                            }
                            else
                            {
                                DrawImage("", "Images/actionDefaultImage.png");
                            }
                            break;
                    }
                }
            }
        }
        private void DrawImage(String trackname, String imagePath, Int32 size = 11)
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

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Tools.AutoPopulateSettings(settings, payload.Settings);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscToggle: Settings loaded: {payload.Settings}");
        }

        public override void ReceivedGlobalSettings(ReceivedGlobalSettingsPayload payload) { }
    }
}