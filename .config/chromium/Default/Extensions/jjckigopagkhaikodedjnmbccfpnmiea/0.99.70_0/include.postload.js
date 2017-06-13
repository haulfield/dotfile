
var clickHide_activated = false;
var clickHide_filters = null;
var currentElement = null;
var highlightedElementsSelector = null;
var highlightedElementsInterval = null;
var clickHideFiltersDialog = null;
var clickHideCancelDialog = null;
var lastRightClickEvent = null;
var lastRightClickEventValid = false;
var lastMouseOverEvent = null;

function highlightElement(element, shadowColor, backgroundColor)
{
  unhighlightElement(element);

  var highlightWithOverlay = function()
  {
    var overlay = addElementOverlay(element);

    if (!overlay)
      return;

    highlightElement(overlay, shadowColor, backgroundColor);
    overlay.style.pointerEvents = "none";

    element._unhighlight = function()
    {
      overlay.parentNode.removeChild(overlay);
    };
  };

  var highlightWithStyleAttribute = function()
  {
    var originalBoxShadow = element.style.getPropertyValue("box-shadow");
    var originalBoxShadowPriority = element.style.getPropertyPriority("box-shadow");
    var originalBackgroundColor = element.style.getPropertyValue("background-color");
    var originalBackgroundColorPriority = element.style.getPropertyPriority("background-color");

    element.style.setProperty("box-shadow", "inset 0px 0px 5px " + shadowColor, "important");
    element.style.setProperty("background-color", backgroundColor, "important");

    element._unhighlight = function()
    {
      this.style.removeProperty("box-shadow");
      this.style.setProperty(
        "box-shadow",
        originalBoxShadow,
        originalBoxShadowPriority
      );

      this.style.removeProperty("background-color");
      this.style.setProperty(
        "background-color",
        originalBackgroundColor,
        originalBackgroundColorPriority
      );
    };
  };

  if ("prisoner" in element)
    highlightWithStyleAttribute();
  else
    highlightWithOverlay();
}


function unhighlightElement(element)
{
  if ("_unhighlight" in element)
  {
    element._unhighlight();
    delete element._unhighlight;
  }
}

function highlightElements(selectorString) {
  unhighlightElements();

  var elements = Array.prototype.slice.call(document.querySelectorAll(selectorString));
  highlightedElementsSelector = selectorString;

  highlightedElementsInterval = setInterval(function()
  {
    if (elements.length > 0)
    {
      var element = elements.shift();
      if (element != currentElement)
        highlightElement(element, "#fd6738", "#f6e1e5");
    }
    else
    {
      clearInterval(highlightedElementsInterval);
      highlightedElementsInterval = null;
    }
  }, 0);
}

function unhighlightElements() {
  if (highlightedElementsInterval)
  {
    clearInterval(highlightedElementsInterval)
    highlightedElementsInterval = null;
  }

  if (highlightedElementsSelector)
  {
    Array.prototype.forEach.call(
      document.querySelectorAll(highlightedElementsSelector),
      unhighlightElement
    );

    highlightedElementsSelector = null;
  }
}

function addElementOverlay(elt) {
  var position = "absolute";
  var offsetX = window.scrollX;
  var offsetY = window.scrollY;

  for (var e = elt; e; e = e.parentElement)
  {
    var style = getComputedStyle(e);

    if (style.display == "none")
      return null;

    if (style.position == "fixed")
    {
      position = "fixed";
      offsetX = offsetY = 0;
    }
  }

  var overlay = document.createElement('div');
  overlay.prisoner = elt;
  overlay.className = "__adsblock__overlay";
  overlay.setAttribute('style', 'opacity:0.4; display:inline-box; overflow:hidden; box-sizing:border-box;');
  var rect = elt.getBoundingClientRect();
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
  overlay.style.left = (rect.left + offsetX) + "px";
  overlay.style.top = (rect.top + offsetY) + "px";
  overlay.style.position = position;
  overlay.style.zIndex = 0x7FFFFFFE;

  document.documentElement.appendChild(overlay);
  return overlay;
}

function clickHide_showDialog(filters)
{
  clickHide_filters = filters;

  clickHideFiltersDialog = document.createElement("iframe");
  clickHideFiltersDialog.src = ext.getURL("block.html");
  clickHideFiltersDialog.setAttribute("style", "position: fixed !important; visibility: hidden; display: block !important; border: 0px !important;");
  clickHideFiltersDialog.style.WebkitBoxShadow = "5px 5px 20px rgba(0,0,0,0.5)";
  clickHideFiltersDialog.style.zIndex = 0x7FFFFFFF;

  clickHideFiltersDialog.style.left = "50px";
  clickHideFiltersDialog.style.top = "50px";

  clickHideFiltersDialog.onmouseout = function()
  {
    if (clickHideFiltersDialog)
      clickHideFiltersDialog.style.setProperty("opacity", "0.7");
  };
  clickHideFiltersDialog.onmouseover = function()
  {
    if (clickHideFiltersDialog)
      clickHideFiltersDialog.style.setProperty("opacity", "1.0");
  };

  document.documentElement.appendChild(clickHideFiltersDialog);
}

function clickHide_show_cancel() {
  if (window !== top) {
      return;
  }
  clickHideCancelDialog = document.createElement("iframe");
  clickHideCancelDialog.src = ext.getURL("select.html");
  clickHideCancelDialog.setAttribute("style", "position: fixed !important; display: block !important; border: 0px !important;");
  clickHideCancelDialog.style.WebkitBoxShadow = "5px 5px 20px rgba(0,0,0,0.5)";
  clickHideCancelDialog.style.zIndex = 0x7FFFFFFF;

  clickHideCancelDialog.style.left = "0px";
  clickHideCancelDialog.style.top = "0px";
  clickHideCancelDialog.style.width = "328px";
  clickHideCancelDialog.style.height = "161px";
  clickHideCancelDialog.style.visibility = "visible";

  document.documentElement.appendChild(clickHideCancelDialog);
}

function clickHide_activate() {
  if(document == null)
    return;

  if (clickHide_activated || clickHideFiltersDialog)
    clickHide_deactivate();

  [].forEach.call(
    document.querySelectorAll('object,embed,iframe,frame'),
    function(element)
    {
      getFiltersForElement(element, function(filters)
      {
        if (filters.length > 0)
          addElementOverlay(element);
      });
    }
  );

  clickHide_activated = true;
  document.addEventListener("mousedown", clickHide_stopPropagation, true);
  document.addEventListener("mouseup", clickHide_stopPropagation, true);
  document.addEventListener("mouseenter", clickHide_stopPropagation, true);
  document.addEventListener("mouseleave", clickHide_stopPropagation, true);
  document.addEventListener("mouseover", clickHide_mouseOver, true);
  document.addEventListener("mouseout", clickHide_mouseOut, true);
  document.addEventListener("click", clickHide_mouseClick, true);
  document.addEventListener("keydown", clickHide_keyDown, true);

  ext.onExtensionUnloaded.addListener(clickHide_deactivate);
}

function clickHide_rulesPending() {
  clickHide_activated = false;

  if (clickHideFiltersDialog)
  {
    document.documentElement.removeChild(clickHideFiltersDialog);
    clickHideFiltersDialog = null;
  }

  document.removeEventListener("mousedown", clickHide_stopPropagation, true);
  document.removeEventListener("mouseup", clickHide_stopPropagation, true);
  document.removeEventListener("mouseenter", clickHide_stopPropagation, true);
  document.removeEventListener("mouseleave", clickHide_stopPropagation, true);
  document.removeEventListener("mouseover", clickHide_mouseOver, true);
  document.removeEventListener("mouseout", clickHide_mouseOut, true);
  document.removeEventListener("click", clickHide_mouseClick, true);
  document.removeEventListener("keydown", clickHide_keyDown, true);
}

function clickHide_cancel_deactivate() {
  if (clickHideCancelDialog)
  {
    document.documentElement.removeChild(clickHideCancelDialog);
    clickHideCancelDialog = null;
  }
}

function clickHide_deactivate()
{
  clickHide_rulesPending();

  clickHide_filters = null;
  lastRightClickEvent = null;

  if (currentElement)
  {
    currentElement.removeEventListener("contextmenu",  clickHide_elementClickHandler, true);
    unhighlightElement(currentElement);
    currentElement = null;
  }
  unhighlightElements();

  var overlays = document.getElementsByClassName("__adsblock__overlay");
  while (overlays.length > 0)
    overlays[0].parentNode.removeChild(overlays[0]);

  ext.onExtensionUnloaded.removeListener(clickHide_deactivate);
}

function clickHide_stopPropagation(e)
{
  e.stopPropagation();
}

function clickHide_elementClickHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  clickHide_mouseClick(e);
}

function getBlockableElementOrAncestor(element, callback)
{  
  while (element && element != document.documentElement
                 && element != document.body)
  {
    if (!(element instanceof HTMLElement) || element.localName == "area")
      element = element.parentElement;

    else if (element.localName == "map")
    {
      var images = document.querySelectorAll("img[usemap]");
      var image = null;

      for (var i = 0; i < images.length; i++)
      {
        var usemap = images[i].getAttribute("usemap");
        var index = usemap.indexOf("#");

        if (index != -1 && usemap.substr(index + 1) == element.name)
        {
          image = images[i];
          break;
        }
      }

      element = image;
    }

    else
    {
      getFiltersForElement(element, function(filters)
      {
        if (filters.length > 0)
          callback(element);
        else
          getBlockableElementOrAncestor(element.parentElement, callback);
      });

      return;
    }
  }

  callback(null);
}

function clickHide_mouseOver(e)
{
  lastMouseOverEvent = e;

  getBlockableElementOrAncestor(e.target, function(element)
  {
    if (e == lastMouseOverEvent)
    {
      lastMouseOverEvent = null;

      if (clickHide_activated)
      {
        if (currentElement)
          unhighlightElement(currentElement);

        if (element)
        {
          highlightElement(element, "#d6d84b", "#f8fa47");
          element.addEventListener("contextmenu", clickHide_elementClickHandler, true);
        }

        currentElement = element;
      }
    }
  });

  e.stopPropagation();
}

function clickHide_mouseOut(e)
{
  if (!clickHide_activated || currentElement != e.target)
    return;

  unhighlightElement(currentElement);
  currentElement.removeEventListener("contextmenu", clickHide_elementClickHandler, true);
  e.stopPropagation();
}

function clickHide_keyDown(e)
{
  if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.keyCode == 13 /*DOM_VK_RETURN*/)
     clickHide_mouseClick(e);
  else if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.keyCode == 27 /*DOM_VK_ESCAPE*/)
  {
    ext.backgroundPage.sendMessage(
    {
      type: "forward",
      payload:
      {
        type: "clickhide-deactivate"
      }
    });
    e.preventDefault();
    e.stopPropagation();
  }
}

function getFiltersForElement(element, callback)
{
  ext.backgroundPage.sendMessage(
    {
      type: "compose-filters",
      tagName: element.localName,
      id: element.id,
      src: element.getAttribute("src"),
      style: element.getAttribute("style"),
      classes: [].slice.call(element.classList),
      urls: getURLsFromElement(element),
      mediatype: typeMap[element.localName],
      baseURL: document.location.href
    },
    function(response)
    {
      callback(response.filters, response.selectors);
    }
  );
}

function clickHide_mouseClick(e)
{
  if (!currentElement || !clickHide_activated)
    return;

  var elt = currentElement;
  if (currentElement.classList.contains("__adsblock__overlay"))
    elt = currentElement.prisoner;

  getFiltersForElement(elt, function(filters, selectors)
  {
    ext.backgroundPage.sendMessage(
    {
      type: "forward",
      payload:
      {
        type: "clickhide-show-dialog",
        clickHideFilters: filters
      }
    });

    if (selectors.length > 0)
      highlightElements(selectors.join(","));

    highlightElement(currentElement, "#fd1708", "#f6a1b5");
  });

  e.preventDefault();
  e.stopPropagation();
}

function removeDotSegments(u) {
  var r = '', m = [];
  if (/\./.test(u)) {
    while (u !== undefined && u !== '') {
      if (u === '.' || u === '..') {
        u = '';
      } else if (/^\.\.\//.test(u)) {
        u = u.substring(3);
      } else if (/^\.\//.test(u)) { // starts with ./
        u = u.substring(2);
      } else if (/^\/\.(\/|$)/.test(u)) { // starts with /./ or consists of /.
        u = '/' + u.substring(3);
      } else if (/^\/\.\.(\/|$)/.test(u)) { // starts with /../ or consists of /..
        u = '/' + u.substring(4);
        r = r.replace(/\/?[^\/]+$/, '');
      } else {
        m = u.match(/^(\/?[^\/]*)(\/.*)?$/);
        u = m[2];
        r = r + m[1];
      }
    }
    return r;
  } else {
    return u;
  }
}

if ("ext" in window && document instanceof HTMLDocument)
{
  document.addEventListener('contextmenu', function(e)
  {
    lastRightClickEvent = e;

    lastRightClickEventValid = true;
    ext.backgroundPage.sendMessage(
    {
      type: "forward",
      payload:
      {
        type: "clickhide-clear-last-right-click-event"
      }
    });
  }, true);

  document.addEventListener("click", function(event)
  {
    if (event.button == 2)
    {
      return;
    }
    if (event.isTrusted == false)
    {
      return;
    }
    var link = event.target;
    while (!(link instanceof HTMLAnchorElement))
    {
      link = link.parentNode;
      if (!link)
      {
        return;
      }
    }
    var queryString = null;
    if (link.protocol != "http:" && link.protocol != "https:")
    {
      var match = /^abp:\/*subscribe\/*\?(.*)/i.exec(link.href);
      if (match)
      {
        queryString = match[1];
      }
    }
    if (!queryString)
    {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    var params = queryString.split("&");
    var title = null;
    var url = null;
    for (var i = 0; i < params.length; i++)
    {
      var parts = params[i].split("=", 2);
      if (parts.length != 2 || !/\S/.test(parts[1]))
      {
        continue;
      }
      switch (parts[0])
      {
      case "title":
        title = decodeURIComponent(parts[1]);
        break;
      case "location":
        url = decodeURIComponent(parts[1]);
        break;
      }
    }
    if (!url)
    {
      return;
    }
    if (!title)
    {
      title = url;
    }
    title = title.trim();
    url = url.trim();
    if (!/^(https?|ftp):/.test(url))
    {
      return;
    }
    ext.backgroundPage.sendMessage(
    {
      type: "subscriptions.add",
      title: title,
      url: url,
      confirm: true
    });
  }, true);

  ext.onMessage.addListener(function(msg, sender, sendResponse)
  {
    switch (msg.type)
    {
      case "get-clickhide-state":
        sendResponse({active: clickHide_activated});
        break;
      case "clickhide-activate":
        clickHide_activate();
        clickHide_show_cancel();
        break;
      case "clickhide-deactivate":
        clickHide_cancel_deactivate();
        clickHide_deactivate();
        break;
      case "clickhide-new-filter":
        if(lastRightClickEvent)
        {
          var event = lastRightClickEvent;
          getBlockableElementOrAncestor(event.target, function(element)
          {
            clickHide_activate();
            currentElement = element;
            clickHide_mouseClick(event);
          });
        }
        break;
      case "clickhide-init":
        if (clickHideFiltersDialog)
        {
          sendResponse({filters: clickHide_filters});

          clickHideFiltersDialog.style.width = msg.width + "px";
          clickHideFiltersDialog.style.height = msg.height + "px";
          clickHideFiltersDialog.style.visibility = "visible";
        }
        break;
      case "clickhide-move":
        if (clickHideFiltersDialog)
        {
          var rect = clickHideFiltersDialog.getBoundingClientRect();
          var x = Math.max(0, Math.min(rect.left + msg.x, window.innerWidth - rect.width));
          var y = Math.max(0, Math.min(rect.top + msg.y, window.innerHeight - rect.height));
          
          clickHideFiltersDialog.style.left = x + "px";
          clickHideFiltersDialog.style.top = y + "px";
        }
        break;
      case "clickhide-cancel-move":
        if (clickHideCancelDialog)
        {
          var rect = clickHideCancelDialog.getBoundingClientRect();
          var x = Math.max(0, Math.min(rect.left + msg.x, window.innerWidth - rect.width));
          var y = Math.max(0, Math.min(rect.top + msg.y, window.innerHeight - rect.height));
          
          clickHideCancelDialog.style.left = x + "px";
          clickHideCancelDialog.style.top = y + "px";
        }
        break;
      case "clickhide-close":
        if (currentElement && msg.remove)
        {
          checkCollapse(currentElement.prisoner || currentElement);

          updateStylesheet();
        }
        clickHide_deactivate();
        break;
      case "clickhide-cancel-close":
        clickHide_cancel_deactivate();
        clickHide_deactivate();
        break;
      case "clickhide-show-dialog":
        clickHide_cancel_deactivate();
        clickHide_rulesPending();
        if (window.self == window.top)
          clickHide_showDialog(msg.clickHideFilters);
        break;
      case "clickhide-clear-last-right-click-event":
        if (lastRightClickEventValid)
          lastRightClickEventValid = false;
        else
          lastRightClickEvent = null;
        break;
    }
  });

  if (window == window.top)
    ext.backgroundPage.sendMessage({type: "report-html-page"});
}
