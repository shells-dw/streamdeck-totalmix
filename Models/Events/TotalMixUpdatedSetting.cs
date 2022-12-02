namespace streamdeck_totalmix.Models.Events
{
    using System;
    public class TotalMixUpdatedSetting : EventArgs
    {
        public string Address { get; }

        public TotalMixUpdatedSetting(string address)
        {
            Address = address;
        }
    }
}
