using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using System.Diagnostics;
using SharpOSC;
using System.Drawing;
using System.Collections.Generic;
using System.Linq;

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
                    Port = 7001,
                    IP = "127.0.0.1"
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

            [JsonProperty(PropertyName = "Latch")]
            public bool Latch { get; set; }
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
             this.SendOscCommand(this.settings.Name, 1, this.settings.IP, this.settings.Port);
            }
            this.counter++;
            if (this.settings.Latch == true)
            {
                Connection.SetStateAsync(1);
            }
            Image actionOnImage = Image.FromFile(@"Images/actionOnImage.png");
            var actionOnImageBase64 = Tools.ImageToBase64(actionOnImage, true);
            Connection.SetImageAsync(actionOnImageBase64);

            if (this.counter % 2 == 0)
            {
                Image actionDefaultImage = Image.FromFile(@"Images/actionDefaultImage.png");
                var actionDefaultImageBase64 = Tools.ImageToBase64(actionDefaultImage, true);
                Connection.SetImageAsync(actionDefaultImageBase64);
            }
        }

        public override void KeyReleased(KeyPayload payload)
        {

            if (this.settings.Latch == true)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Key Released");
                if (this.settings.Name != "showhideui")
                {
                    this.SendOscCommand(this.settings.Name, 1, this.settings.IP, this.settings.Port);
                }
                Image actionDefaultImage = Image.FromFile(@"Images/actionDefaultImage.png");
                var actionDefaultImageBase64 = Tools.ImageToBase64(actionDefaultImage, true);
                Connection.SetImageAsync(actionDefaultImageBase64);
                this.counter--;
                Connection.SetStateAsync(0);
            }
        }

        public override void OnTick() { }

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Tools.AutoPopulateSettings(settings, payload.Settings);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscToggle: Settings loaded: {payload.Settings}");
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
    }
}