// define Global variables

namespace streamdeck_totalmix
{
    using System;
    using System.Collections.Generic;

    public static class Globals
    {
        // holds all page 1 responses for all 3 busses, once filled
        public static Dictionary<String, Dictionary<String, String>> bankSettings = new Dictionary<String, Dictionary<String, String>>();

        // channel count
        public static Int32 channelCount;

        // Globals for the device connection data, filled at start, read from then on
        public static String interfaceIp;
        public static Int32 interfacePort;
        public static Int32 interfaceSendPort;
        public static Int32 interfaceBackgroundPort;
        public static Int32 interfaceBackgroundSendPort;
        public static String mirroringRequested;
        public static Boolean listeningActive;

        // throttle queries
        public static DateTime lastQuery = DateTime.Now;
    }
}
