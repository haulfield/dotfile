var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ?
                         'runtime' : 'extension';
			 
window.addEventListener("message", function(event) {
	if (event.source != window)
		return;

	if (event.data.type && event.data.type == 'kg.feedback.capture') {
		chrome[runtimeOrExtension].sendMessage('capture', function(dataUrl) {
			window.postMessage({type: 'kg.feedback.captureCallback', dataUrl: dataUrl}, '*');			
		});	
	}
}, false);

var div = document.createElement('div');
div.id = 'feedback-ext-installed';
div.style.display = 'none';
document.body.appendChild(div);