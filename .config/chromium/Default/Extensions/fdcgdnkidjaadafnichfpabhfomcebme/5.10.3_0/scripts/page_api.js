'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function (root, initPageApi) {
  if ((typeof module === 'undefined' ? 'undefined' : _typeof(module)) === 'object' && module.exports) {
    module.exports = initPageApi;
  } else {
    initPageApi();
  }
})(undefined, function () {
  function injectFn() {
    window.__zm = {
      toggle: function toggle(enabled) {
        document.dispatchEvent(new CustomEvent('toggle', { detail: enabled }));
      },
      setPageExcludes: function setPageExcludes(list) {
        document.dispatchEvent(new CustomEvent('setPageExcludes', {
          detail: list
        }));
      },
      update: function update() {
        document.dispatchEvent(new CustomEvent('updateZM'));
      },
      removeCredentials: function removeCredentials() {
        document.dispatchEvent(new CustomEvent('removeCredentials'));
      },
      updateWithCredentials: function updateWithCredentials(creds) {
        document.dispatchEvent(new CustomEvent('updateWithCredentials', {
          detail: creds
        }));
      },
      getData: function getData(cb) {
        ts = Date.now();
        document.dispatchEvent(new CustomEvent('request:getData', {
          detail: ts
        }));

        document.addEventListener('response:getData', function (e) {
          if (e.detail.timestamp === ts && cb) {
            return cb({ user: e.detail.user, device: e.detail.device });
          }
        });
      }
    };
  }

  var inject = '(' + injectFn + ')();';

  document.addEventListener('toggle', function (e) {
    chrome.runtime.sendMessage({ subject: 'toggle', payload: e.detail });
  });

  document.addEventListener('setPageExcludes', function (e) {
    chrome.runtime.sendMessage({
      subject: 'setPageExcludes',
      payload: e.detail
    });
  });

  document.addEventListener('updateZM', function (e) {
    chrome.runtime.sendMessage({ subject: 'update' });
  });

  document.addEventListener('removeCredentials', function (e) {
    chrome.runtime.sendMessage({ subject: 'removeCredentials' });
  });

  document.addEventListener('updateWithCredentials', function (e) {
    chrome.runtime.sendMessage({
      subject: 'updateWithCredentials',
      payload: e.detail
    });
  });

  document.addEventListener('request:getData', function (e) {
    chrome.runtime.sendMessage({
      subject: 'request:getData',
      payload: { timestamp: e.detail }
    });
  });

  chrome.runtime.onMessage.addListener(function (msg, sender) {
    if (msg && msg.subject) {
      document.dispatchEvent(new CustomEvent(msg.subject, {
        detail: msg.payload
      }));
    }
  });

  var script = document.createElement('script');
  script.innerHTML = inject;
  var parent = document.body || document.head || document.documentElement;
  parent.appendChild(script);
});