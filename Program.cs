using BarRaider.SdTools;
using streamdeck_totalmix;
using System;
using System.Threading.Tasks;

namespace de.shells.totalmix
{
    class Program
    {

        static void Main(string[] args)
        {
            // Uncomment this line of code to allow for debugging
        //     while (!System.Diagnostics.Debugger.IsAttached) { System.Threading.Thread.Sleep(100); }

            Globals.interfaceIp = System.Configuration.ConfigurationManager.AppSettings["interfaceIp"];
            Globals.interfacePort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfacePort"]);
            Globals.interfaceSendPort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfaceSendPort"]);
            Globals.interfaceBackgroundPort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfaceBackgroundPort"]);
            Globals.interfaceBackgroundSendPort = Int32.Parse(System.Configuration.ConfigurationManager.AppSettings["interfaceBackgroundSendPort"]);

            HelperFunctions.CheckForTotalMix();
            Task.Run(() => HelperFunctions.UpdateDeviceSettingDict());
            HelperFunctions.GetChannelCount();

            SDWrapper.Run(args);
        }


    }
}
