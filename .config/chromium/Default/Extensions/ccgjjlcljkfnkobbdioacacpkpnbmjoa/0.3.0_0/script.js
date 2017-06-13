var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ?
                         'runtime' : 'extension';
			 
chrome[runtimeOrExtension].onMessage.addListener(function(message, sender, sendResponse) {
	if(message == 'capture') {
		chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
			sendResponse(dataUrl); 
		})  
	}
	return true;
});