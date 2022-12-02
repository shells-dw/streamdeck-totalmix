// OSC Listener

namespace streamdeck_totalmix
{
    using Rug.Osc;
    using System;
    using System.Collections.Generic;
    using System.Text.RegularExpressions;
    using System.Threading.Tasks;
    internal class Listener
    {
        // assign variables
        static OscReceiver receiver;

        // main listener Task
        public async Task<Task> Listen(String bus, String address, Single value)
        {

            // Create the receiver
            receiver = new OscReceiver(Globals.interfaceBackgroundSendPort);

            // Connect the receiver
            receiver.Connect();

            // Start the listen thread
            await Sender.Send(address, value, Globals.interfaceIp, Globals.interfaceBackgroundPort);

            Task.Run(() => ListenLoop(bus)).Wait(1000);
            //     await ListenLoop(bus);
            // close the Reciver 
            receiver.Close();
            return Task.CompletedTask;
        }

        private Task ListenLoop(object bus)
        {
            try
            {
                while (receiver.State != OscSocketState.Closed)
                {
                    // making sure to add the key if it doesn't exist already (we need it anyway and don't like exceptions)
                    if (!Globals.bankSettings.ContainsKey($"{bus}"))
                    {
                        Globals.bankSettings.Add($"{bus}", new Dictionary<String, String>());
                    }
                    // if we are in a state to recieve
                    if (receiver.State == OscSocketState.Connected)
                    {
                        // get the next message 
                        // this will block until one arrives or the socket is closed
                        OscPacket packet = receiver.Receive();

                        // we're expecting only bundles at this time, so define the received packet as bundle
                        OscBundle bundle = packet as OscBundle;

                        // abort condition RegEx - the device sends a heartbeat of sorts ("/") every second
                        String snapRegEx = @"^\/$";
                        var r = new Regex(snapRegEx, RegexOptions.IgnoreCase);
                        if (bundle != null)
                        {
                            // match for abort condition
                            Match m = r.Match(((Rug.Osc.OscMessage)bundle[0]).Address.ToString());

                            // add every received bundle to the Global Dict
                            for (var i = 0; i < bundle.Count; i++)
                            {
                //                if (Globals.bankSettings[$"{bus}"].ContainsKey(((Rug.Osc.OscMessage)bundle[i]).Address))
                 //               {
                                    //    Globals.bankSettings[$"{bus}"].Remove(((Rug.Osc.OscMessage)bundle[i]).Address);
                                    Globals.bankSettings[$"{bus}"][$"{((Rug.Osc.OscMessage)bundle[i]).Address}"] = ((Rug.Osc.OscMessage)bundle[i])[0].ToString();
                                    if (((Rug.Osc.OscMessage)bundle[i]).Address == "/1/micgain16Val") {
                                        return Task.CompletedTask;
                                     }
                //                }
                 //       Globals.bankSettings[$"{bus}"].Add(((Rug.Osc.OscMessage)bundle[i]).Address, ((Rug.Osc.OscMessage)bundle[i])[0].ToString());
                    }

                    // matched
                    if (m.Success)
                    {
                        return Task.CompletedTask;
                    }
                }
            }
                }
    }

            // TODO
            catch
            {
                // if the socket was connected when this happens
                // then do something useful with it
                if (receiver.State == OscSocketState.Connected)
                {
                    // something useful

                    return Task.CompletedTask;
                }
            }
            return Task.CompletedTask;
        }
    }
}
