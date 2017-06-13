(function() {
  var onRequest;

  onRequest = function(request, sender, sendResponse) {
    var ref, ref1;
    if (request.action !== 'runCiuvo') {
      return;
    }
    return typeof chrome !== "undefined" && chrome !== null ? (ref = chrome.storage) != null ? (ref1 = ref.local) != null ? ref1.get(function(data) {
      var addDisableButton, addDisableButtonCallback, contentScript, i, ref2;
      if ((data != null ? data.disable_smartprice : void 0) === true) {
        return;
      }
      if ((data != null ? data.disable_smartprice : void 0) === void 0 && (data != null ? (ref2 = data.user) != null ? ref2.is_premium : void 0 : void 0) === true) {
        return;
      }
      if (data != null ? data.user : void 0) {
        request.settings.uuid = data.user.id.toString();
      }
      contentScript = new window.ciuvoSDK.ContentScript(window.document, request.settings);
      contentScript.run();
      addDisableButton = function() {
        var cta, ctaContainer, newDiv, ref3, ref4, ref5, ref6, ref7, ref8;
        ctaContainer = (ref3 = window.document.querySelector("span[data-url^='https://ciuvo.com/message/firstrun/z3Nnno43']")) != null ? (ref4 = ref3.parentNode) != null ? (ref5 = ref4.parentNode) != null ? (ref6 = ref5.parentNode) != null ? (ref7 = ref6.childNodes) != null ? ref7[3] : void 0 : void 0 : void 0 : void 0 : void 0;
        if (ctaContainer == null) {
          return;
        }
        newDiv = window.document.createElement("div");
        newDiv.innerHTML = "<span style=\"\n    position: absolute;\n    color: #fff;\n    color: #ffffff;\n    display: block;\n    position: absolute;\n    top: -40px;\n    font-family: Helvetica,Arial,sans-serif;\n    font-size: 13px;\n    text-decoration: underline;\n    word-spacing: normal;\n    -webkit-touch-callout: none;\n    -webkit-user-select: none;\n    right: 100px;\n    width: 200px;\n    height: 40px;\n    text-align: center;\n    line-height: 40px;\n    background-color: rgb(73, 168, 215);\n    z-index: 999999999999;\n    cursor: pointer;\n\">Disable SmartPrice</span>";
        newDiv.addEventListener('click', (function(e) {
          var isOverlayOpen, ref10, ref11, ref8, ref9, sure;
          isOverlayOpen = window.document.querySelector("iframe[src^='https://ciuvo.com/message/firstrun/z3Nnno43']") != null;
          if (!isOverlayOpen) {
            return false;
          }
          sure = confirm("Are you sure to disable ZenMate SmartPrice?");
          if (!sure) {
            return false;
          }
          chrome.runtime.sendMessage({
            action: 'disableSmartPrice'
          });
          if ((ref8 = window.document.querySelector("span[data-url^='https://ciuvo.com/message/firstrun/z3Nnno43']")) != null) {
            if ((ref9 = ref8.parentNode) != null) {
              if ((ref10 = ref9.parentNode) != null) {
                if ((ref11 = ref10.parentNode) != null) {
                  ref11.remove();
                }
              }
            }
          }
          return false;
        }), false);
        cta = (ref8 = ctaContainer.childNodes) != null ? ref8[0] : void 0;
        ctaContainer.insertBefore(newDiv, cta);
        return true;
      };
      i = 0;
      return (addDisableButtonCallback = function() {
        var success;
        success = addDisableButton();
        i += 1;
        if (!((i > 20) || success)) {
          return setTimeout(addDisableButtonCallback, 1000);
        }
      })();
    }) : void 0 : void 0 : void 0;
  };

  chrome.runtime.onMessage.addListener(onRequest);

  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.document.location.href,
    visibility: document.webkitVisibilityState,
    top: window === window.top
  });

}).call(this);
