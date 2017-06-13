
require.scopes.info = {
  get addonID()
  {
    return chrome.i18n.getMessage("@@extension_id");
  },
  addonName: "adskillerdblock",
  addonVersion: "0.1",
  addonRoot: "",

  application: "chrome",
  get applicationVersion()
  {
    return this.platformVersion;
  },

  platform: "chromium",
  get platformVersion()
  {
    var match = /\bChrome\/(\S+)/.exec(navigator.userAgent);
    return (match ? match[1] : "0");
  }
};