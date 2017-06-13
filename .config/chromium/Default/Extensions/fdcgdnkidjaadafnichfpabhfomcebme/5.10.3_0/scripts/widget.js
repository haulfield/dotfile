'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var $toggleBtn = document.getElementById('toggle-btn');
var $message = document.getElementById('message');
var $headline = document.getElementById('headline');
var $description = document.getElementById('description');
var $iframe = document.getElementById('iframe-widget');
var $submitBtn = document.getElementById('submit-btn');
var $dismissBtn = document.getElementById('dismiss-btn');

/*
 * Helpers
 */

// request the content script to resize the iframe
function resize(params) {
  window.top.postMessage(_extends({
    action: 'zm:resize'
  }, params), '*');
}

// hide or show toggle button and content
function toggleVisibility(isShown) {
  $toggleBtn.classList.toggle('active', isShown);
  $message.classList.toggle('hidden', !isShown);
}

function showMessage() {
  resize({
    height: 400,
    width: 375
  });

  // toggle the own controls
  setTimeout(function () {
    return toggleVisibility(true);
  }, 50);
}

/*
 * Logic
 */

// listen for message updates
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.subject !== 'widgetMessage') {
    return;
  }

  var messages = msg.payload.messages;


  if (messages) {
    if (messages.iframe) {
      $message.classList.add('iframe');
      $message.classList.remove('plain');
      $iframe.src = messages.iframe;
    } else {
      $message.classList.remove('iframe');
      $message.classList.add('plain');
      $headline.textContent = messages.headline;
      $description.textContent = messages.description;
      $submitBtn.textContent = messages.action.label;
      $submitBtn.dataset.url = messages.action.url || '';
      $dismissBtn.textContent = messages.dismiss;
    }
  }

  if (msg.payload.show) {
    showMessage();
  } else {
    // hide message
    toggleVisibility(false);
  }
});

$submitBtn.addEventListener('click', function () {
  chrome.runtime.sendMessage({
    subject: 'getPremium',
    payload: {
      url: this.dataset.url
    }
  });

  resize({
    height: 70,
    width: 70
  });
});

$dismissBtn.addEventListener('click', function () {
  chrome.runtime.sendMessage({
    subject: 'dismiss'
  });

  resize({
    height: 0,
    width: 0
  });
});

$toggleBtn.addEventListener('click', function () {
  if ($message.classList.contains('hidden')) {
    showMessage();
  } else {
    toggleVisibility(false);

    // signal the background to hide the message for all tabs
    chrome.runtime.sendMessage({
      subject: 'hideMessage'
    });

    resize({
      height: 70,
      width: 70,
      timeout: 500
    });
  }
});

/*
 * Initial call
 */

// send initial request to get message status
chrome.runtime.sendMessage({
  subject: 'getWidgetMessage'
});