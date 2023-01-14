﻿// helper functions

namespace streamdeck_totalmix
{
    using BarRaider.SdTools;
    using System;
    using System.Linq;
    using System.Net.NetworkInformation;
    using System.Net;
    using System.Threading.Tasks;
    using System.Threading;
    using System.Collections.Generic;
    using System.IO;
    using System.Text.RegularExpressions;

    internal class HelperFunctions
    {
        private static CancellationTokenSource _cancellationTokenSource = new CancellationTokenSource();
        public static async void UpdateDeviceSettingDict()
        {
            Logger.Instance.LogMessage(TracingLevel.INFO, "UpdateDeviceSettingDict()");
            _cancellationTokenSource = new CancellationTokenSource();
            if (Globals.backgroundConnection)
            {
                if (!Globals.listeningActive)
                {
                    Globals.listeningActive = true;
                    Logger.Instance.LogMessage(TracingLevel.INFO, "UpdateDeviceSettingDict() _ start endless loop");
                    while (true && !_cancellationTokenSource.IsCancellationRequested)
                    {
                        try
                        {
                            await Listener.Listen("Input", "/1/busInput", 1);
                            await Task.Delay(100);
                            await Listener.Listen("Output", "/1/busOutput", 1);
                            await Task.Delay(100);
                            await Listener.Listen("Playback", "/1/busPlayback", 1);
                            await Task.Delay(100);
                            CheckForTotalMix();
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
            Globals.commandConnection = false;
            Globals.backgroundConnection = false;
            while (!Globals.commandConnection && !Globals.backgroundConnection)
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
                        if (!Globals.mirroringRequested)
                        {
                            GetChannelCount();
                            return false;
                        }
                    }
                    if (e.Port == Globals.interfaceBackgroundPort)
                    {
                        Globals.backgroundConnection = true;
                        Logger.Instance.LogMessage(TracingLevel.INFO, "Globals.backgroundConnection = true");
                    }
                    if (Globals.commandConnection && Globals.backgroundConnection)
                    {
                        Task.Run(() => UpdateDeviceSettingDict());
                        GetChannelCount();
                        return true;
                    }
                }
                if (!Globals.backgroundConnection)
                {
                    _cancellationTokenSource.Cancel();
                    while (Globals.commandConnection && !Globals.backgroundConnection)
                    {
                        Task.Run(() => Task.Delay(5000)).Wait();
                        CheckForTotalMix();

                    }
                }
                Task.Run(() => Task.Delay(1000)).Wait();
            }
            Logger.Instance.LogMessage(TracingLevel.INFO, "CheckForTotalMix() = false");
            return false;
        }

        // get channel count by counting how man /1/panx there are (could have used any value, but pan is nice and short...)
        public static void GetChannelCount()
        {
            if (Globals.backgroundConnection)
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
            if (Globals.commandConnection && !Globals.backgroundConnection)
            {
                Globals.channelCount = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["channelCount"]);
            }
        }

        

        public static List<String> GetTotalMixConfig(String setting)
        {
            var totalMixDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + "\\TotalMixFx";
            List<string> current = null;
            current = new List<string>();
            if (Directory.Exists(totalMixDir))
            {
                FileInfo[] totalMixConfig = Directory.GetFiles(totalMixDir, "last.*.xml").Select(x => new FileInfo(x)).ToArray();
                var currentConfig = totalMixConfig.OrderByDescending(f => f.LastWriteTime).FirstOrDefault();
                if (setting == "SnapshotName")
                {
                    foreach (var line in File.ReadAllLines(currentConfig.ToString()))
                    {
                        if (line.Contains("SnapshotName"))
                        {
                            Match snapshotNames = Regex.Match(line, "v\\=\\\"(.*\\b)");
                            if (snapshotNames.Success == true)
                            {
                                current.Add(snapshotNames.Groups[1].Value);
                            }
                        }
                        if (line.Contains("<Inputs>"))
                        {
                            return current;
                        }
                    }
                }
            }
            return current;
        }

 

        // needed that for something... hmm
        public class SelectableEnumItem
        {
            public String Key { get; set; }
            public String Value { get; set; }
        }
    }
}
