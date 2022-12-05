using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Drawing;
using System.Collections.Generic;
using System.Linq;
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
            }
        }

        public override void Dispose()
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Destructor called");
        }

        [DllImport("user32.dll")]
        public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
        private const int SW_HIDE = 0;
        private const int SW_RESTORE = 5;
        private IntPtr hWnd;
        private IntPtr hWndCache;
        private int hWndId;
        private int counter;

        delegate bool EnumThreadDelegate(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern bool EnumThreadWindows(int dwThreadId, EnumThreadDelegate lpfn,
            IntPtr lParam);

        static IEnumerable<IntPtr> EnumerateProcessWindowHandles(int processId)
        {
            var handles = new List<IntPtr>();

            foreach (ProcessThread thread in Process.GetProcessById(processId).Threads)
                EnumThreadWindows(thread.Id,
                    (hWnd, lParam) => { handles.Add(hWnd); return true; }, IntPtr.Zero);

            return handles;
        }

        public override void KeyPressed(KeyPayload payload)
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Key Pressed");
            if (this.settings.Name == "showhideui")
            {
                Process[] p = Process.GetProcessesByName("TotalMixFX");
                //  hWnd = (int)p[0].MainWindowHandle;
                hWnd = p[0].MainWindowHandle;
                IntPtr WindowHandle = EnumerateProcessWindowHandles(p[0].Id).First();
                if (hWndCache == IntPtr.Zero)
                {
                    //    hWndCache = hWnd;
                    hWndCache = WindowHandle;
                }
                hWndId = (int)p[0].Id;
                if (hWnd == (IntPtr)0)
                {
                    ShowWindowAsync(hWndCache, SW_RESTORE);
                }
                else
                {
                    ShowWindowAsync(hWnd, SW_HIDE);
                }
            }
            if (this.settings.Name != "showhideui")
            {
                Task.Run(() => HelperFunctions.SendOscCommand(this.settings.Name, 1, Globals.interfaceIp, Globals.interfacePort)).GetAwaiter().GetResult();
            }
            this.counter++;
            if (this.settings.Latch == true)
            {
                Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
            }
            DrawImage("Global Mute", "Images/mixerOn.png");

            if (this.counter % 2 == 0)
            {
                DrawImage("Global Mute", "Images/actionDefaultImage.png");
            }
        }

        public override void KeyReleased(KeyPayload payload)
        {

            if (this.settings.Latch == true)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Key Released");
                if (this.settings.Name != "showhideui")
                {
                    Task.Run(() => HelperFunctions.SendOscCommand(this.settings.Name, 1, Globals.interfaceIp, Globals.interfacePort)).GetAwaiter().GetResult();
                }
                DrawImage("Global Mute", "Images/actionDefaultImage.png");
                Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                this.counter--;
            }
        }

        public override void OnTick()
        {
            TimeSpan elapsedSpan = new TimeSpan(DateTime.Now.Ticks - Globals.lastQuery.Ticks);
            if (Globals.bankSettings["Input"].Count != 0 || elapsedSpan.TotalSeconds > 10)
            {
                if (elapsedSpan.TotalSeconds > 1)
                {
                    Globals.lastQuery = DateTime.Now;
                    Listener listener = new Listener();
                    listener.Listen("Input", "/1/busInput", 1);
                }
            }
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
            catch
            {
                //
            }
        }
        private void DrawImage(String trackname, String imagePath)
        {
            TitleParameters tp = new TitleParameters(new FontFamily("Arial"), System.Drawing.FontStyle.Bold, 11, Color.White, false, TitleVerticalAlignment.Bottom);
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