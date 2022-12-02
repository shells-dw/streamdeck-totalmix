// helper functions

namespace streamdeck_totalmix
{
    using System;
    using System.Threading.Tasks;

    internal class HelperFunctions
    {
       
        // here the magic happens (imagine the sparkles and rainbows yourself) - kidding, just taking the address and value from the call, combining it with the Global variables and send that all to the interface
        public static void SendOscCommand(String name, Single value, String interfaceIp, Int32 interfacePort)
        {
            Sender.Send(name, value, interfaceIp, interfacePort);
        }

        // needed that for something... hmm
        public class SelectableEnumItem
        {
            public String Key { get; set; }
            public String Value { get; set; }
        }
    }
}
