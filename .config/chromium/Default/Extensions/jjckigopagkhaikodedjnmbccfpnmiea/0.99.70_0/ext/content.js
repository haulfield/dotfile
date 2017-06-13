chrome.runtime.onMessage.addListener(function(message, sender, sendResponse)
{
  return ext.onMessage._dispatch(message, {}, sendResponse).indexOf(true) != -1;
});

ext.onExtensionUnloaded = (function()
{
  var port = null;

  return {
    addListener: function(listener)
    {
      if (!port)
        port = chrome.runtime.connect();
      
      port.onDisconnect.addListener(listener);
    },
    removeListener: function(listener)
    {
      if (port)
      {
        port.onDisconnect.removeListener(listener)

        if (!port.onDisconnect.hasListeners())
        {
          port.disconnect();
          port = null;
        }
      }
    }
  };
})();
