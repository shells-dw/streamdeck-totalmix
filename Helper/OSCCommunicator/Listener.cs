// OSC Listener

namespace streamdeck_totalmix
{
    using BarRaider.SdTools;
    using Newtonsoft.Json.Linq;
    using System;
    using Rug.Osc;
    using System.Collections.Generic;
    using System.Net.Sockets;
    using System.Net;
    using System.Text;
    using System.Text.RegularExpressions;
    using System.Threading;
    using System.Threading.Tasks;
    internal class Listener
    {
        // assign variables
            static OscReceiver _receiver;

        
                // main listener Task
                public static Task Listen(String bus, String address, Single value)
                {
                    try
                    {
                        // Create the receiver
                        _receiver = new OscReceiver(Globals.interfaceBackgroundSendPort);
                    }
                    catch (Exception ex)
                    {
                        Logger.Instance.LogMessage(TracingLevel.INFO, "Listener:  new OscReceiver: " + ex.Message);
                    }

                    // Connect the receiver
                    try
                    {
                        // connect to the socket 
                        _receiver.Connect();
                    }
                    catch (Exception ex)
                    {
                        Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: receiver.Connect(): " + ex.Message);
                        _receiver.Dispose();
                        _receiver = null;
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
                        Task.Run(() => ListenLoop(bus)).Wait(5000);
                    }
                    catch (Exception ex)
                    {
                        Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Listenloop(): " + ex.Message);
                    }
                    // close the Reciver 
                    _receiver.Close();

                    if (_receiver != null)
                    {
                        // dispose of the reciever
                        _receiver.Dispose();
                        _receiver = null;
                    }
                    return Task.CompletedTask;
                }

                private static Task ListenLoop(object bus)
                {
                    try
                    {
                        while (_receiver.State != OscSocketState.Closed)
                        {
                            // making sure to add the key if it doesn't exist already (we need it anyway and don't like exceptions)
                            if (!Globals.bankSettings.ContainsKey($"{bus}"))
                            {
                                Globals.bankSettings.Add($"{bus}", new Dictionary<String, String>());
                            }
                            // if we are in a state to recieve
                            if (_receiver != null && _receiver.State == OscSocketState.Connected)
                            {
                                // get the next message 
                                // this will block until one arrives or the socket is closed
                                //   OscPacket packet = receiver.Receive();
                                OscPacket packet;

                                try
                                {
                                    while (_receiver.TryReceive(out packet) == true)
                                    {
                                   //     Logger.Instance.LogMessage(TracingLevel.INFO, "while (receiver.TryReceive(out packet) == true _ before");
                                        // we're expecting only bundles at this time, so define the received packet as bundle
                                        OscBundle bundle = packet as OscBundle;

                                        if (packet.Error == OscPacketError.None)
                                        {
                                           try
                                            {
                                                // add every received bundle to the Global Dict
                                                for (var i = 0; i < bundle.Count; i++)
                                                {
                                                    Match heartbeat = Regex.Match(((Rug.Osc.OscMessage)bundle[i]).Address.ToString(), @"^\/$");
                                                    if (heartbeat.Success == true)
                                                    {
                                                        return Task.CompletedTask;
                                                    }
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
                                            }
                                            catch (Exception ex)
                                            {
                                                Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Error inside main function - bundle might be null: " + packet.ErrorMessage);
                                                return Task.FromException(ex);

                                            }
                                        }
                                        else
                                        {
                                            Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Error reading packet: " + packet.Error);
                                            Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: Error reading packet: " + packet.ErrorMessage);
                                            return Task.CompletedTask;
                                        }

                                //        Logger.Instance.LogMessage(TracingLevel.INFO, "while (receiver.TryReceive(out packet) == true _ after");
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Logger.Instance.LogMessage(TracingLevel.INFO, "Listener:  while (receiver.TryReceive(out packet) == true): " + ex.Message);
                                    Task.FromException(ex);
                                }
                            }
                        }
                        return Task.CompletedTask;
                    }

                    // TODO
                    catch (Exception ex)
                    {
                        Logger.Instance.LogMessage(TracingLevel.INFO, "Listener: catch main try: " + ex.Message);
                        // if the socket was connected when this happens
                        // then do something useful with it
                        if (_receiver != null && _receiver.State == OscSocketState.Connected)
                        {
                            // something useful
                            return Task.CompletedTask;
                        }
                    }
                    return Task.CompletedTask;
                }
    }
}
