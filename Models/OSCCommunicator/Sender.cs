// OSC Sender

using Rug.Osc;
using System;
using System.Net;
using System.Threading.Tasks;

namespace streamdeck_totalmix
{
    internal class Sender
    {
        public static Task Send(String name, Single value, String ip, Int32 port)
        {
            // This is the ip address we are going to send to
            IPAddress address = IPAddress.Parse(ip);
            
            // Create a new sender instance
            using (OscSender sender = new OscSender(address: IPAddress.Loopback, localPort: 0, remotePort: port))
            {
                // Connect the sender socket  
                sender.Connect();

                // Send a new message
                sender.Send(new OscMessage(name, value));
                return Task.CompletedTask;
            }
        }
    }
}
