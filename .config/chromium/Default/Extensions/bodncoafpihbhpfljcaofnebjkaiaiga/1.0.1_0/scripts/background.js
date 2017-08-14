/* global chrome, console, config, createTabs, createUtils */
/* eslint no-console: 0 */

var utils = createUtils(config);
var tabs = createTabs(config, utils, chrome);

var createShareScreen = function (chrome) {
    return function (sender) {
        chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], sender.tab, function (streamId) {
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'relay-to-tab',
                callback: 'share-screen',
                argument: streamId
            }, function () {
                console.log("Message sent with stream %s", streamId);
            });
        });
    };
};

var shareScreen = createShareScreen(chrome);

/* Message passing from the inject.js */
var registerMessageHandler = function(chrome) {
    var messageHandler = function(request, sender, sendResponse) {
        switch (request.action) {
        case 'check-extension':
            // Respond with the version number
            var version = chrome.runtime.getManifest().version;
            sendResponse({
                version: version
            });
            break;
        case 'share-screen':
            shareScreen(sender, sendResponse);
        }
    };

    chrome.runtime.onMessage.addListener(messageHandler);
};

/* Injection to tabs already open when the extension is loaded. */
var injectToExistingTabs = function(chrome, tabs) {
    tabs.forAppearInTabs(function(tabs) {
        tabs.forEach(function (tab) {
            chrome.tabs.executeScript(tab.id, {
                file: 'scripts/inject.js',
                runAt: 'document_start'
            });
        });
    });
};

/* Launch! */
registerMessageHandler(chrome);
injectToExistingTabs(chrome, tabs);
