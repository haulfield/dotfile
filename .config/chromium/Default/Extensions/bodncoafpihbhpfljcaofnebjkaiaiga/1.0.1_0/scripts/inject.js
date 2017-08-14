/* global chrome, console */
/* eslint no-console: 0 */

chrome.runtime.onMessage.addListener(
    function(request/*,sender, sendResponse*/) {
        switch (request.action) {
        case 'relay-to-tab':
            console.log("Relaying: " + request.callback);
            window.postMessage({
                type: 'ScreenShareResponse',
                callback: request.callback,
                response: request.argument
            }, "*");
        }
    }
);

window.addEventListener('message', function(event) {
    if (event.source !== window ||
        event.data === undefined ||
        event.data.type !== "ScreenShareAction") {
        return;
    }
    if (event.data.callback !== undefined) {
        chrome.runtime.sendMessage(null, {
            action: event.data.action,
            argument: event.data.argument
        }, function(response) {

            window.postMessage({
                type: 'ScreenShareResponse',
                callback: event.data.callback,
                response: response
            }, "*");
        });
    } else {
        chrome.runtime.sendMessage(null, {
            action: event.data.action,
            argument: event.data.argument
        });
    }
});
console.log("ScreenShareInjected");
window.postMessage({ type: 'ScreenShareInjected' }, '*');
