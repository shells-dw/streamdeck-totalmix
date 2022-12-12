// OSC Listener

namespace streamdeck_totalmix
{
    using BarRaider.SdTools;
    using Rug.Osc;
    using System;
    using System.Collections.Generic;
    using System.Text.RegularExpressions;
    using System.Threading.Tasks;
    internal class Listener
    {
        // assign variables
        static OscReceiver receiver;
        private static readonly object threadLock = new object();
        // main listener Task
        public static Task Listen(String bus, String address, Single value)
        {
            try
            {
                // Create the receiver
                receiver = new OscReceiver(Globals.interfaceBackgroundSendPort);
            }
            catch (Exception ex)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "Listener:  new OscReceiver: " + ex.Message);
            }

            // Connect the receiver
            try
            {
                // connect to the socket 
                receiver.Connect();
            }
            catch (Exception ex)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: receiver.Connect(): " + ex.Message);
                receiver.Dispose();
                receiver = null;
                Task.FromException(ex);
            }

            try
            {
                // Start the listen thread
                Sender.Send(address, value, Globals.interfaceIp, Globals.interfaceBackgroundPort).Wait();
            }
            catch (Exception ex)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Sender.Send(): " + ex.Message);
            }

            try
            {
                lock (threadLock)
                {
                    ListenLoop(bus).Wait();
                }
            }
            catch (Exception ex)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Listenloop(): " + ex.Message);
            }
            // close the Reciver 
            lock (threadLock)
            {
                receiver.Close();
            }
            return Task.CompletedTask;
        }

        private static Task ListenLoop(object bus)
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
                        //   OscPacket packet = receiver.Receive();
                        OscPacket packet;

                        // abort condition RegEx - the device sends a heartbeat of sorts ("/") every second
                        String snapRegEx = @"^\/$";
                        var r = new Regex(snapRegEx, RegexOptions.IgnoreCase);
                        try
                        {
                            while (receiver.TryReceive(out packet) == true)
                            {
                                // we're expecting only bundles at this time, so define the received packet as bundle
                                OscBundle bundle = packet as OscBundle;

                                if (packet.Error == OscPacketError.None)
                                {
                                    if (bundle != null)
                                    {
                                        // match for abort condition
                                        Match m = r.Match(((Rug.Osc.OscMessage)bundle[0]).Address.ToString());

                                        // add every received bundle to the Global Dict
                                        for (var i = 0; i < bundle.Count; i++)
                                        {
                                            Match uninterestingValues = Regex.Match(((Rug.Osc.OscMessage)bundle[i]).Address.ToString(), "^.{3}(?>label|select)");
                                            if (uninterestingValues.Success == false)
                                            {
                                                Globals.bankSettings[$"{bus}"][$"{((Rug.Osc.OscMessage)bundle[i]).Address}"] = ((Rug.Osc.OscMessage)bundle[i])[0].ToString();
                                                if (((Rug.Osc.OscMessage)bundle[i]).Address == $"/1/micgain{Globals.channelCount}Val")
                                                {
                                                    return Task.CompletedTask;
                                                }
                                            }
                                        }

                                        // matched
                                        if (m.Success)
                                        {
                                            return Task.CompletedTask;
                                        }
                                    }
                                }
                                else
                                {
                                    Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Error reading packet: " + packet.Error);
                                    Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Error reading packet: " + packet.ErrorMessage);
                                    return Task.CompletedTask;
                                }
                            }

                        }
                        catch (Exception ex)
                        {
                            Logger.Instance.LogMessage(TracingLevel.INFO, "Listener:  while (receiver.TryReceive(out packet) == true): " + ex.Message);
                        }
                    }
                }
            }

            // TODO
            catch (Exception ex)
            {
                Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: catch main try: " + ex.Message);
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
