"use strict";

(function()
{
  	var inspectedTabId = chrome.devtools.inspectedWindow.tabId;
  	var port = chrome.runtime.connect({name: "devtools-" + inspectedTabId});

  	ext.onMessage = port.onMessage;
  	ext.devtools = chrome.devtools;
})();
