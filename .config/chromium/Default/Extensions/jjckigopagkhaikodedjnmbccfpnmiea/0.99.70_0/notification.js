
var backgroundPage = ext.backgroundPage.getWindow();
var require = backgroundPage.require;

var Utils = require("utils").Utils;
var Notification = require("notification").Notification;
var getActiveNotification = require("notificationHelper").getActiveNotification;

function getDocLinks(notification)
{
  if (!notification.links)
    return [];

  var docLinks = [];
  notification.links.forEach(function(link)
  {
    docLinks.push(Utils.getDocLink(link));
  });
  return docLinks;
}

function insertMessage(element, text, links)
{
  var match = /^(.*?)<(a|strong)>(.*?)<\/\2>(.*)$/.exec(text);
  if (!match)
  {
    element.appendChild(document.createTextNode(text));
    return;
  }

  var before = match[1];
  var tagName = match[2];
  var value = match[3];
  var after = match[4];

  insertMessage(element, before, links);

  var newElement = document.createElement(tagName);
  if (tagName === "a" && links && links.length)
    newElement.href = links.shift();
  insertMessage(newElement, value, links);
  element.appendChild(newElement);

  insertMessage(element, after, links);
}

window.addEventListener("load", function()
{
  var notification = getActiveNotification();
  if (!notification)
    return;

  var texts = Notification.getLocalizedTexts(notification);
  var titleElement = document.getElementById("notification-title");
  titleElement.textContent = texts.title;

  var docLinks = getDocLinks(notification);
  var messageElement = document.getElementById("notification-message");
  insertMessage(messageElement, texts.message, docLinks);

  messageElement.addEventListener("click", function(event)
  {
    var link = event.target;
    while (link && link !== messageElement && link.localName !== "a")
      link = link.parentNode;
    if (!link)
      return;
    event.preventDefault();
    event.stopPropagation();
    ext.pages.open(link.href);
  });

  if (notification.type == "question")
  {
    document.getElementById("notification-question").addEventListener("click", function(event)
    {
      event.preventDefault();
      event.stopPropagation();
      
      var approved = false;
      switch (event.target.id)
      {
        case "notification-yes":
          approved = true;
        case "notification-no":
          Notification.triggerQuestionListeners(notification.id, approved);
          Notification.markAsShown(notification.id);
          notification.onClicked();
          break;
      }
      window.close();
    }, true);
  }

  var notificationElement = document.getElementById("notification");
  notificationElement.className = notification.type;
  notificationElement.style.display = "block";
  
  document.getElementById("close-notification").addEventListener("click", function()
  {
    notificationElement.style.display = "none";
    notification.onClicked();
  }, false);
}, false);
