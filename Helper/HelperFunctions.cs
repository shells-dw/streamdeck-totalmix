// helper functions

namespace streamdeck_totalmix
{
    using BarRaider.SdTools;
    using System;
    using System.Linq;
    using System.Net.NetworkInformation;
    using System.Net;
    using System.Threading.Tasks;
    using System.Threading;
    using Newtonsoft.Json.Linq;
    using System.Collections.Generic;
    using System.Security.Policy;

    internal class HelperFunctions
    {
        public static async void UpdateDeviceSettingDict()
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "UpdateDeviceSettingDict()");
            if (Globals.backgroundConnection)
            {
                if (!Globals.listeningActive)
                {
                    Globals.listeningActive = true;
                    Logger.Instance.LogMessage(TracingLevel.INFO, "UpdateDeviceSettingDict() _ start endless loop");
                    while (true)
                    {
                        try
                        {
                            await Listener.Listen("Input", "/1/busInput", 1);
                            await Task.Delay(100);
                            await Listener.Listen("Output", "/1/busOutput", 1);
                            await Task.Delay(100);
                            await Listener.Listen("Playback", "/1/busPlayback", 1);
                            await Task.Delay(100);
                        }
                        catch (Exception ex)
                        {
                            Logger.Instance.LogMessage(TracingLevel.INFO, "UpdateDeviceSettingDict: " + ex.Message);
                        }
                    }
                }
            }
        }
        public static Boolean CheckForTotalMix()
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "CheckForTotalMix()");
            IPGlobalProperties properties = IPGlobalProperties.GetIPGlobalProperties();
            IPEndPoint[] endPoints = properties.GetActiveUdpListeners();
            foreach (IPEndPoint e in endPoints)
            {
                if (e.Port == Globals.interfacePort)
                {
                    Globals.commandConnection = true;
                    Logger.Instance.LogMessage(TracingLevel.INFO, "Globals.commandConnection = true");
                }
                if (e.Port == Globals.interfaceBackgroundPort)
                {
                    Globals.backgroundConnection = true;
                    Logger.Instance.LogMessage(TracingLevel.INFO, "Globals.backgroundConnection = true");
                }
                if (Globals.commandConnection && Globals.backgroundConnection) return true;
            }
            Logger.Instance.LogMessage(TracingLevel.INFO, "CheckForTotalMix() = false");
            return false;
        }

        // get channel count by counting how man /1/panx there are (could have used any value, but pan is nice and short...)
        public static void GetChannelCount()
        {
            try
            {
                Int32 counter = 0;
                while (!Globals.bankSettings.ContainsKey("Input") && counter < 20)
                {
                    Thread.Sleep(100);
                    counter++;
                }
                counter = 0;
                while (!Globals.bankSettings["Input"].ContainsKey("/1/pan1") && counter < 20)
                {
                    Thread.Sleep(100);
                    counter++;
                }
                Dictionary<string, string> TempDict = new Dictionary<string, string>(Globals.bankSettings["Input"]);
                Globals.channelCount = TempDict.Where(d => d.Key.Contains("/1/pan")).ToDictionary(d => d.Key, d => d.Value).Count;
            }
            catch
            {
                Globals.channelCount = 16;
            }
        }

        // needed that for something... hmm
        public class SelectableEnumItem
        {
            public String Key { get; set; }
            public String Value { get; set; }
        }
    }
}
