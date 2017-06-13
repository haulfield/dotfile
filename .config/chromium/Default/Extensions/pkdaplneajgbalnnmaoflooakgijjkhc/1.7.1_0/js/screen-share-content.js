/* jshint undef: false */

// Notify our page the extension is installed.
// https://developer.chrome.com/webstore/inline_installation
var isInstalledNode = document.createElement('div');
isInstalledNode.id = 'ls-extension-installed';

var installerNode = document.querySelector('#ls-extension');
installerNode.appendChild(isInstalledNode);

document.addEventListener("requestScreenShare", function(evt) {
  chrome.runtime.sendMessage({requestScreen: true}, function(res) {
  });
});

// Recieve message from eventPage
chrome.runtime.onMessage.addListener(
  function(req, sender, sendResponse) {
    // respond back to website with 'screenShareEvent'
    var e = document.createEvent('MessageEvent');
    e.initMessageEvent('screenShareEvent', true, true, req.streamId);
    document.dispatchEvent(e);
  }
);