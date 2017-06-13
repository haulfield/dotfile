// screen sharing
var activeTab;

function doCallback() {
  chrome.desktopCapture.chooseDesktopMedia(
    ["screen", "window"], // "screen", "window", or "tab"
    activeTab,
    function(streamId) {
      chrome.tabs.sendMessage(activeTab.id, {streamId: streamId});
    }
  );
}
chrome.runtime.onMessage.addListener(
  function(req, sender, sendResponse) {
    if (req.requestScreen) {
      activeTab = sender.tab;
      sendResponse({
        message: "Message from: " + sender.tab.url
      });
      doCallback();
    }
  }
);

var injectIntoTabs = function() {
  chrome.tabs.query({
    status: 'complete',
    url: [ 'https://*.lifesizecloud.com/*', 'https://*.lifesizeclouddev.com/*', 'https://*.lifesizecloudbeta.com/*' ]
  }, function(tabs) {
     for (var i in tabs) {
      var tab = tabs[i];
      chrome.tabs.executeScript(tab.id, {
        file: 'js/screen-share-content.js',
        runAt: 'document_start'
      });
    }
  });
}

injectIntoTabs();
