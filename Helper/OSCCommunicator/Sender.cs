// OSC Sender

using BarRaider.SdTools;
using Rug.Osc;
using System;
using System.Net;
using System.Threading.Tasks;

namespace streamdeck_totalmix
{
    internal class Sender
    {
        public static Task Send(String name, Single value, IPAddress ip, Int32 port)
        {

            OscSender sender = null;
            try { sender = new OscSender(local: IPAddress.Any, localPort: 0, remote: ip, remotePort: port); }
            catch (Exception ex)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "Sender:  new OscSender: " + ex.Message);
                sender.Dispose();
                sender = null;
            }
            finally { sender = new OscSender(local: IPAddress.Any, localPort: 0, remote: ip, remotePort: port); }

            try
            {
                // connect to the socket 
                sender.Connect();
            }
            catch (Exception ex)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: receiver.Connect(): " + ex.Message);
                sender.Dispose();
                sender = null;
                Task.FromException(ex);
            }

            // Send a new message
            sender.Send(new OscMessage(name, value));

            sender.Close();
            return Task.CompletedTask;
        }
    }
}