chrome.browserAction.onClicked.addListener(function(tab) {
  /* 
  No tabs or host permissions needed!
  */
  chrome.tabs.executeScript({
    code: 'var shopifyFD = document.createElement("script");shopifyFD.type = "text/javascript";shopifyFD.src = "https://freakdesign-us.s3.amazonaws.com/shopify/shopifyFD/s/shopifyFD.min.js";document.getElementsByTagName("head")[0].appendChild(shopifyFD);'
  });
});