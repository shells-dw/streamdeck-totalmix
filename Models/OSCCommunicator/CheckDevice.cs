// OSC Check

namespace streamdeck_totalmix
{
    using Rug.Osc;
    using System;
    using System.Text.RegularExpressions;
    using System.Threading.Tasks;
    internal class CheckDevice
    {
        // assign variables
        static OscReceiver receiver;


        // main listener Task
        public Task Listen(Int32 port)
        {
            // Create the receiver
            receiver = new OscReceiver(port);
            receiver.Connect();
            Task.Run(() => ListenLoop()).Wait(5000);
            receiver.Close();
          return Task.CompletedTask;
        }
        private Task ListenLoop()
        {
            try
            {
                while (receiver.State != Rug.Osc.OscSocketState.Closed)
                {
                    if (receiver.State == Rug.Osc.OscSocketState.Connected)
                    {
                        var packet = receiver.Receive();

                        // we're expecting only bundles at this time, so define the received packet as bundle
                        OscBundle bundle = packet as OscBundle;

                        // abort condition RegEx - the device sends a heartbeat of sorts ("/") every second
                        String snapRegEx = @"^\/$";
                        var r = new Regex(snapRegEx, RegexOptions.IgnoreCase);
                        if (bundle != null)
                        {
                            // match for abort condition
                            Match m = r.Match(((Rug.Osc.OscMessage)bundle[0]).Address.ToString());

                            // matched
                            if (m.Success)
                            {
                                break;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                if (ex.Message == "The receiver socket has been disconnected")
                    // Ignore
                    return Task.CompletedTask;
                ;
            }
          return Task.CompletedTask;
        }
    }
}
