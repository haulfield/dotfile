chrome.browserAction.onClicked.addListener(function(tab) {
  /* 
  No tabs or host permissions needed!
  */
  chrome.tabs.executeScript({
    code: 'var custom_js=document.createElement("script");custom_js.type="text/javascript";custom_js.src="https://freakdesign-us.s3.amazonaws.com/shopify/custom_fields/s/freakdesign_custom_fields.min.js";document.getElementsByTagName("head")[0].appendChild(custom_js);'
  });
});