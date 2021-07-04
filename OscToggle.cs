using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using System.Runtime;
using System.Diagnostics;
using SharpOSC;

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

        public override void KeyPressed(KeyPayload payload)
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscToggle: Key Pressed");
            if (this.settings.Name == "showhideui")
            {
                Process[] p = Process.GetProcessesByName("TotalMixFX");
              //  hWnd = (int)p[0].MainWindowHandle;
              hWnd = p[0].MainWindowHandle;
                if (hWndCache == IntPtr.Zero)
                {
                    hWndCache = hWnd;
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
            this.SendOscCommand(this.settings.Name, 1, this.settings.IP, this.settings.Port);
        }

        public override void KeyReleased(KeyPayload payload) { }

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