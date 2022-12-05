// helper functions

namespace streamdeck_totalmix
{
    using BarRaider.SdTools;
    using System;
    using System.Linq;

    internal class HelperFunctions
    {
        // here the magic happens (imagine the sparkles and rainbows yourself) - kidding, just taking the address and value from the call, combining it with the Global variables and send that all to the interface
        public static void SendOscCommand(String name, Single value, String interfaceIp, Int32 interfacePort)
        {
            Sender.Send(name, value, interfaceIp, interfacePort);
        }

        // get channel count by counting how man /1/panx there are (could have used any value, but pan is nice and short...)
        public void GetChannelCount()
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
