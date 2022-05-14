using BarRaider.SdTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;
using SharpOSC;
using System.Drawing;
using System.Text.RegularExpressions;

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
                    ListeningPort = 9001,
                    Port = 7001,
                    IP = "127.0.0.1",
                    Bus = String.Empty,
                    MuteSolo = String.Empty,
                    SettingValue = 1.0f,
                    IncludeOscOnOff = false
                };
                return instance;
            }

            [FilenameProperty]
            [JsonProperty(PropertyName = "Name")]
            public string Name { get; set; }

            [JsonProperty(PropertyName = "Port")]
            public int Port { get; set; }

            [JsonProperty(PropertyName = "ListeningPort")]
            public int ListeningPort { get; set; }

            [JsonProperty(PropertyName = "IP")]
            public string IP { get; set; }

            [JsonProperty(PropertyName = "SelectedAction")]
            public string SelectedAction { get; set; }

            [JsonProperty(PropertyName = "Bus")]
            public string Bus { get; set; }

            [JsonProperty(PropertyName = "MuteSolo")]
            public string MuteSolo { get; set; }

            [JsonProperty(PropertyName = "SettingValue")]
            public float SettingValue { get; set; }

            [JsonProperty(PropertyName = "IncludeOscOnOff")]
            public bool IncludeOscOnOff { get; set; }
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
            /*           if (this.settings.IncludeOscOnOff == true && this.settings.IP != null && this.settings.Name != null && this.settings.Port != 0 && this.settings.Bus != null)
                       {
                           if (payload.State == 1)
                           {
                               Image actionDefaultImage = Image.FromFile(@"Images/actionDefaultImage.png");
                               var actionDefaultImageBase64 = Tools.ImageToBase64(actionDefaultImage, true);
                               Connection.SetImageAsync(actionDefaultImageBase64);
                           }
                               TotalMixListener(this.settings.Bus, this.settings.IP, this.settings.Port);

                           var DictToUse = bankSettingInputBus;
                           if (this.settings.Bus == "Input")
                           {
                               DictToUse = bankSettingInputBus;
                           }
                           else if (this.settings.Bus == "Playback")
                           {
                               DictToUse = bankSettingPlaybackBus;
                           }
                           else if (this.settings.Bus == "Output")
                           {
                               DictToUse = bankSettingOutputBus;
                           }
                           if (DictToUse.ContainsKey(this.settings.Name))
                           {
                               if (DictToUse.TryGetValue("/1/bus" + settings.Bus, out string busValue))
                               {
                                   if (busValue == "1")
                                   {
                                       if (DictToUse.TryGetValue(this.settings.Name, out string result))
                                       {
                                           Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: In TotalMixListener: result: " + result);
                                           Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: In TotalMixListener: settings.Name: " + settings.Name);
                                           if (result == "1")
                                           {
                                               if (settings.Name.Contains("solo"))
                                               {

                                                   connection.StreamDeckConnection.SetStateAsync(1, connection.ContextId);
                                                   Image actionSoloImage = Image.FromFile(@"Images/actionSoloImage.png");
                                                   var actionSoloImageBase64 = Tools.ImageToBase64(actionSoloImage, true);
                                                   Connection.SetImageAsync(actionSoloImageBase64);

                                               }
                                               else
                                               {
                                                   connection.StreamDeckConnection.SetStateAsync(1, connection.ContextId);
                                                   Image actionMutedImage = Image.FromFile(@"Images/actionMutedImage.png");
                                                   var actionMutedImageBase64 = Tools.ImageToBase64(actionMutedImage, true);
                                                   Connection.SetImageAsync(actionMutedImageBase64);

                                               }
                                           }
                                       }
                                       else
                                       {
                                           Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Could not find the specific key in bankSetting dict");
                                       }
                                   }
                               }
                           }
                       }*/
        }


        public override void Dispose()
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Destructor called");
            bankSettingInputBus.Clear();
            bankSettingPlaybackBus.Clear();
            bankSettingOutputBus.Clear();
        }

        public override void KeyPressed(KeyPayload payload)
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Key Pressed");
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
            if (payload.State == 1)
            {
                SendOscCommand(this.settings.Name, 0, this.settings.IP, this.settings.Port);
                Image actionDefaultImage = Image.FromFile(@"Images/actionDefaultImage.png");
                var actionDefaultImageBase64 = Tools.ImageToBase64(actionDefaultImage, true);
                Connection.SetImageAsync(actionDefaultImageBase64);

            }
            else
            {
                SendOscCommand(this.settings.Name, 1, this.settings.IP, this.settings.Port);
                if (settings.Name.Contains("solo"))
                {
                    Image actionSoloImage = Image.FromFile(@"Images/actionSoloImage.png");
                    var actionSoloImageBase64 = Tools.ImageToBase64(actionSoloImage, true);
                    Connection.SetImageAsync(actionSoloImageBase64);
                }
                else
                {
                    Image actionMutedImage = Image.FromFile(@"Images/actionMutedImage.png");
                    var actionMutedImageBase64 = Tools.ImageToBase64(actionMutedImage, true);
                    Connection.SetImageAsync(actionMutedImageBase64);
                }
            }
        }

        public override void KeyReleased(KeyPayload payload)
        {

        }
        private int counter;
        private int tickCounter = 0;
        public override void OnTick()
        {
            tickCounter++;
            System.IO.FileInfo fi = new System.IO.FileInfo(@"pluginlog.log");
            long size = fi.Length;
  //          Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: filesize " + size);
            if (fi.Length > 10000000)
            {
                string path = @"pluginlog.log";
                System.IO.File.WriteAllText(path, String.Empty);
                System.IO.TextWriter tw = new System.IO.StreamWriter(path, true);
                tw.WriteLine("flushed for size");
                tw.Close();
            }
            Console.WriteLine("File Size in Bytes: {0}", size);
            if (this.settings.IncludeOscOnOff == true && this.settings.IP != null && this.settings.Name != null && this.settings.Port != 0 && this.settings.Bus != null)
            {
                TotalMixListener(this.settings.Bus, this.settings.IP, this.settings.Port);
                var DictToUse = bankSettingInputBus;
                if (this.settings.Bus == "Input")
                {
                    DictToUse = bankSettingInputBus;
                }
                else if (this.settings.Bus == "Playback")
                {
                    DictToUse = bankSettingPlaybackBus;
                }
                else if (this.settings.Bus == "Output")
                {
                    DictToUse = bankSettingOutputBus;
                }
                if (DictToUse.ContainsKey(this.settings.Name))
                {
                    if (DictToUse.TryGetValue("/1/bus" + settings.Bus, out string busValue))
                    {
                        if (busValue == "1")
                        {
                            if (DictToUse.TryGetValue(this.settings.Name, out string result))
                            {
                                if (counter > 20)
                                {
                                    Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: TickCounter " + tickCounter);
                                    Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: In TotalMixListener: result: " + result);
                                    Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: In TotalMixListener: settings.Name: " + settings.Name);
                                    counter = 0;
                                }
                                counter++;
                                if (result == "1")
                                {
                                    if (settings.Name.Contains("solo"))
                                    {

                                        Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        Image actionSoloImage = Image.FromFile(@"Images/actionSoloImage.png");
                                        var actionSoloImageBase64 = Tools.ImageToBase64(actionSoloImage, true);
                                        Connection.SetImageAsync(actionSoloImageBase64);

                                    }
                                    else
                                    {
                                        Connection.StreamDeckConnection.SetStateAsync(1, Connection.ContextId);
                                        Image actionMutedImage = Image.FromFile(@"Images/actionMutedImage.png");
                                        var actionMutedImageBase64 = Tools.ImageToBase64(actionMutedImage, true);
                                        Connection.SetImageAsync(actionMutedImageBase64);

                                    }
                                }
                                else
                                {
                                    //    Image actionDefaultImage = Image.FromFile(@"Images/actionDefaultImage.png");
                                    //    var actionDefaultImageBase64 = Tools.ImageToBase64(actionDefaultImage, true);
                                    //    Connection.SetImageAsync(actionDefaultImageBase64);
                                    if (settings.Name.Contains("solo"))
                                    {

                                        Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        Image actionSoloOffImage = Image.FromFile(@"Images/actionSoloOffImage.png");
                                        var actionSoloOffImageBase64 = Tools.ImageToBase64(actionSoloOffImage, true);
                                        Connection.SetImageAsync(actionSoloOffImageBase64);

                                    }
                                    else
                                    {
                                        Connection.StreamDeckConnection.SetStateAsync(0, Connection.ContextId);
                                        Image actionUnmutedImage = Image.FromFile(@"Images/actionUnmutedImage.png");
                                        var actionUnmutedImageBase64 = Tools.ImageToBase64(actionUnmutedImage, true);
                                        Connection.SetImageAsync(actionUnmutedImageBase64);

                                    }
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
        }

        public override void ReceivedSettings(ReceivedSettingsPayload payload)
        {
            Tools.AutoPopulateSettings(settings, payload.Settings);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"OscOnOff: Settings loaded: {payload.Settings}");
        }

        public override void ReceivedGlobalSettings(ReceivedGlobalSettingsPayload payload) { }

        #region Private Methods

        private Task SaveSettings()
        {
            return Connection.SetSettingsAsync(JObject.FromObject(settings));
        }

        #endregion

        public static Dictionary<string, string> bankSettingInputBus = new Dictionary<string, string>();
        public static Dictionary<string, string> bankSettingPlaybackBus = new Dictionary<string, string>();
        public static Dictionary<string, string> bankSettingOutputBus = new Dictionary<string, string>();

        public Task TotalMixListener(string bus, string ip, int port)
        {
 //           Thread.Sleep(250);
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: In Listener");
            bankSettingInputBus.Clear();
            bankSettingPlaybackBus.Clear();
            bankSettingOutputBus.Clear();

            var listener = new UDPListener(settings.ListeningPort);
            OscBundle message = null;
            bool done = false;
            string snapRegEx = @"^\/$";
            Regex r = new Regex(snapRegEx, RegexOptions.IgnoreCase);
            SendOscCommand("/1/bus" + bus, 1.0f, ip, port);
            while (done == false)
            {
                message = (OscBundle)listener.Receive();
                if (message != null)
                {
                    Match m = r.Match(message.Messages[0].Address);

                    if (bus == "Input")
                    {
                        for (int i = 0; i < message.Messages.Count; i++)
                        {
                            if (bankSettingInputBus.ContainsKey(message.Messages[i].Address))
                            {
                                bankSettingInputBus.Remove(message.Messages[i].Address);
                            }
                            bankSettingInputBus.Add(message.Messages[i].Address, message.Messages[i].Arguments[0].ToString());
                        }
                        if ((m.Success && bankSettingInputBus.Count >= 5) || bankSettingInputBus.Count > 145)
                        {
                            break;
                        }
                    }
                    if (bus == "Playback")
                    {
                        for (int i = 0; i < message.Messages.Count; i++)
                        {
                            if (bankSettingPlaybackBus.ContainsKey(message.Messages[i].Address))
                            {
                                bankSettingPlaybackBus.Remove(message.Messages[i].Address);
                            }
                            bankSettingPlaybackBus.Add(message.Messages[i].Address, message.Messages[i].Arguments[0].ToString());
                        }
                        break;
                    }
                    if (bus == "Output")
                    {
                        for (int i = 0; i < message.Messages.Count; i++)
                        {
                            if (bankSettingOutputBus.ContainsKey(message.Messages[i].Address))
                            {
                                bankSettingOutputBus.Remove(message.Messages[i].Address);
                            }
                            bankSettingOutputBus.Add(message.Messages[i].Address, message.Messages[i].Arguments[0].ToString());
                        }
                        break;
                    }
                }
            }

    //        Thread.Sleep(500);
            listener.Close();
            Logger.Instance.LogMessage(TracingLevel.INFO, "OscOnOff: Out Listener");
            return Task.CompletedTask;
        }

        public void SendOscCommand(string name, float value, string ip, int port)
        {
            var message = new OscMessage(name, value);
            var sender = new UDPSender(ip, port);
            sender.Send(message);
        }
    }
}