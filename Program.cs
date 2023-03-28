using BarRaider.SdTools;
using streamdeck_totalmix;
using System;
using System.Net;
using System.Threading.Tasks;

namespace de.shells.totalmix
{
    class Program
    {

        static void Main(string[] args)
        {
            // Uncomment this line of code to allow for debugging
             //    while (!System.Diagnostics.Debugger.IsAttached) { System.Threading.Thread.Sleep(100); }

            Logger.Instance.LogMessage(TracingLevel.INFO, "Program Main() _ start");

            IPAddress ipAddress = IPAddress.TryParse(System.Configuration.ConfigurationManager.AppSettings["interfaceIp"], out ipAddress) ? ipAddress : IPAddress.Loopback;
            Globals.interfaceIp = ipAddress;
            Globals.interfacePort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfacePort"]);
            Globals.interfaceSendPort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfaceSendPort"]);
            Globals.interfaceBackgroundPort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfaceBackgroundPort"]);
            Globals.interfaceBackgroundSendPort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfaceBackgroundSendPort"]);
            Globals.mirroringRequested = Boolean.Parse(System.Configuration.ConfigurationManager.AppSettings["mirroringRequested"]);
            Globals.killAndRestartOnStuck = Boolean.Parse(System.Configuration.ConfigurationManager.AppSettings["killAndRestartOnStuck"]);
            Logger.Instance.LogMessage(TracingLevel.INFO, $"Program Settings received:\nGlobals.interfaceIp: {Globals.interfaceIp}\nGlobals.interfacePort: {Globals.interfacePort}\nGlobals.interfaceSendPort: {Globals.interfaceSendPort}\nGlobals.interfaceBackgroundPort: {Globals.interfaceBackgroundPort}\nGlobals.interfaceBackgroundSendPort: { Globals.interfaceBackgroundSendPort}\nGlobals.mirroringRequested: {Globals.mirroringRequested}\nGlobals.killAndRestartOnStuck: {Globals.killAndRestartOnStuck}");

            Task.Run(() => HelperFunctions.CheckForTotalMix());

            SDWrapper.Run(args);
        }


    }
}
