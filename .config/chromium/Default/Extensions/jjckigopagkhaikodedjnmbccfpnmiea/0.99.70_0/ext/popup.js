(function()
{
  var backgroundPage = chrome.extension.getBackgroundPage();
  window.ext = Object.create(backgroundPage.ext);

  ext.closePopup = function()
  {
    window.close();
  };

  ext.backgroundPage = {
    sendMessage: chrome.runtime.sendMessage,

    getWindow: function()
    {
      return backgroundPage;
    }
  };
})();
