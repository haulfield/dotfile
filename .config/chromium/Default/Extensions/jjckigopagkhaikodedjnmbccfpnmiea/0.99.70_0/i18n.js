
var i18n = ext.i18n;

ext.backgroundPage.sendMessage(
  {
    type: "app.get",
    what: "localeInfo"
  },
  function(localeInfo)
  {
    document.documentElement.lang = localeInfo.locale;
    document.documentElement.dir = localeInfo.bidiDir;
  }
);

ext.i18n.setElementText = function(element, stringName, arguments)
{
  function processString(str, element)
  {
    var match = /^(.*?)<(a|strong)>(.*?)<\/\2>(.*)$/.exec(str);
    if (match)
    {
      processString(match[1], element);

      var e = document.createElement(match[2]);
      processString(match[3], e);
      element.appendChild(e);

      processString(match[4], element);
    }
    else
      element.appendChild(document.createTextNode(str));
  }

  while (element.lastChild)
    element.removeChild(element.lastChild);
  processString(ext.i18n.getMessage(stringName, arguments), element);
}

function loadI18nStrings()
{
  var nodes = document.querySelectorAll("[class^='i18n_']");
  for(var i = 0; i < nodes.length; i++)
  {
    var node = nodes[i];
    var arguments = JSON.parse("[" + node.textContent + "]");
    if (arguments.length == 0)
      arguments = null;

    var className = node.className;
    if (className instanceof SVGAnimatedString)
      className = className.animVal;
    var stringName = className.split(/\s/)[0].substring(5);

    ext.i18n.setElementText(node, stringName, arguments);
  }
}

function i18n_timeDateStrings(when)
{
  var d = new Date(when);
  var timeString = d.toLocaleTimeString();

  var now = new Date();
  if (d.toDateString() == now.toDateString())
    return [timeString];
  else
    return [timeString, d.toLocaleDateString()];
}

window.addEventListener("DOMContentLoaded", loadI18nStrings, true);
