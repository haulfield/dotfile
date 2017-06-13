(function()
{
  window.ext = {};
  var EventTarget = ext._EventTarget = function()
  {
    this._listeners = [];
  };
  EventTarget.prototype = {
    addListener: function(listener)
    {
      if (this._listeners.indexOf(listener) == -1)
      {
        this._listeners.push(listener);
      }
    },
    removeListener: function(listener)
    {
      var idx = this._listeners.indexOf(listener);
      if (idx != -1)
      {
        this._listeners.splice(idx, 1);
      }
    },
    _dispatch: function()
    {
      var results = [];
      for (var i = 0; i < this._listeners.length; i++)
      {
        results.push(this._listeners[i].apply(null, arguments));
      }
      return results;
    }
  };
})();
(function()
{
  ext.onMessage = new ext._EventTarget();
  ext.backgroundPage = {
    sendMessage: chrome.runtime.sendMessage,
    getWindow: function()
    {
      return chrome.extension.getBackgroundPage();
    }
  };
  ext.getURL = chrome.extension.getURL;
  ext.i18n = chrome.i18n;
})();
