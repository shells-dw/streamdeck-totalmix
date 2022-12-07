// helper functions

namespace streamdeck_totalmix
{
    using BarRaider.SdTools;
    using System;
    using System.Linq;
    using System.Net.NetworkInformation;
    using System.Net;
    using System.Threading.Tasks;

    internal class HelperFunctions
    {
        public static void UpdateDeviceSettingDict()
        {
            if (Globals.backgroundConnection)
            {
                if (!Globals.listeningActive)
                {
                    Globals.listeningActive = true;
                    while (true)
                    {
                        Listener.Listen("Input", $"/1/busInput", 1).Wait();
                        Listener.Listen("Output", $"/1/busOutput", 1).Wait();
                        Listener.Listen("Playback", $"/1/busPlayback", 1).Wait();
                    }
                }
            }
        }
        public static Boolean CheckForTotalMix()
        {
            IPGlobalProperties properties = IPGlobalProperties.GetIPGlobalProperties();
            IPEndPoint[] endPoints = properties.GetActiveUdpListeners();
            foreach (IPEndPoint e in endPoints)
            {
                if (e.Port == Globals.interfacePort)
                {
                    Globals.commandConnection = true;
                }
                if (e.Port == Globals.interfaceBackgroundPort)
                {
                    Globals.backgroundConnection = true;
                }
                if (Globals.commandConnection && Globals.backgroundConnection) return true;
            }
            return false;
        }

        // get channel count by counting how man /1/panx there are (could have used any value, but pan is nice and short...)
        public static void GetChannelCount()
        {
            try
            {
                Globals.channelCount = Globals.bankSettings["Input"].Where(d => d.Key.Contains("/1/pan")).ToDictionary(d => d.Key, d => d.Value).Count;
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
