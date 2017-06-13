
var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

var typeMap = {
  "img": "IMAGE",
  "input": "IMAGE",
  "picture": "IMAGE",
  "audio": "MEDIA",
  "video": "MEDIA",
  "frame": "SUBDOCUMENT",
  "iframe": "SUBDOCUMENT",
  "object": "OBJECT",
  "embed": "OBJECT"
};

function getURLsFromObjectElement(element)
{
  var url = element.getAttribute("data");
  if (url)
    return [url];

  for (var i = 0; i < element.children.length; i++)
  {
    var child = element.children[i];
    if (child.localName != "param")
      continue;

    var name = child.getAttribute("name");
    if (name != "movie"  && // Adobe Flash
        name != "source" && // Silverlight
        name != "src"    && // Real Media + Quicktime
        name != "FileName") // Windows Media
      continue;

    var value = child.getAttribute("value");
    if (!value)
      continue;

    return [value];
  }

  return [];
}

function getURLsFromAttributes(element)
{
  var urls = [];

  if (element.src)
    urls.push(element.src);

  if (element.srcset)
  {
    var candidates = element.srcset.split(",");
    for (var i = 0; i < candidates.length; i++)
    {
      var url = candidates[i].trim().replace(/\s+\S+$/, "");
      if (url)
        urls.push(url);
    }
  }

  return urls;
}

function getURLsFromMediaElement(element)
{
  var urls = getURLsFromAttributes(element);

  for (var i = 0; i < element.children.length; i++)
  {
    var child = element.children[i];
    if (child.localName == "source" || child.localName == "track")
      urls.push.apply(urls, getURLsFromAttributes(child));
  }

  if (element.poster)
    urls.push(element.poster);

  return urls;
}

function getURLsFromElement(element)
{
  var urls;
  switch (element.localName)
  {
    case "object":
      urls = getURLsFromObjectElement(element);
      break;

    case "video":
    case "audio":
    case "picture":
      urls = getURLsFromMediaElement(element);
      break;

    default:
      urls = getURLsFromAttributes(element);
      break;
  }

  for (var i = 0; i < urls.length; i++)
  {
    if (/^(?!https?:)[\w-]+:/i.test(urls[i]))
      urls.splice(i--, 1);
  }

  return urls;
}

function checkCollapse(element)
{
  var mediatype = typeMap[element.localName];
  if (!mediatype)
    return;

  var urls = getURLsFromElement(element);
  if (urls.length == 0)
    return;

  ext.backgroundPage.sendMessage(
    {
      type: "filters.collapse",
      urls: urls,
      mediatype: mediatype,
      baseURL: document.location.href
    },

    function(collapse)
    {
      function collapseElement()
      {
        var propertyName = "display";
        var propertyValue = "none";
        if (element.localName == "frame")
        {
          propertyName = "visibility";
          propertyValue = "hidden";
        }

        if (element.style.getPropertyValue(propertyName) != propertyValue ||
            element.style.getPropertyPriority(propertyName) != "important")
          element.style.setProperty(propertyName, propertyValue, "important");
      }

      if (collapse)
      {
        collapseElement();

        if (MutationObserver)
          new MutationObserver(collapseElement).observe(
            element, {
              attributes: true,
              attributeFilter: ["style"]
            }
          );
      }
    }
  );
}

function getContentDocument(element)
{
  try
  {
    return element.contentDocument;
  }
  catch (e)
  {
    return null;
  }
}

function ElementHidingTracer(selectors)
{
  this.selectors = selectors;

  this.changedNodes = [];
  this.timeout = null;

  this.observer = new MutationObserver(this.observe.bind(this));
  this.trace = this.trace.bind(this);

  if (document.readyState == "loading")
    document.addEventListener("DOMContentLoaded", this.trace);
  else
    this.trace();
}
ElementHidingTracer.prototype = {
  checkNodes: function(nodes)
  {
    var matchedSelectors = [];
    for (var i = 0; i < this.selectors.length; i++)
    {
      var selector = this.selectors[i];

      for (var j = 0; j < nodes.length; j++)
      {
        var elements = nodes[j].querySelectorAll(selector);
        var matched = false;

        for (var k = 0; k < elements.length; k++)
        {
          if (getComputedStyle(elements[k]).display == "none")
          {
            matchedSelectors.push(selector);
            matched = true;
            break;
          }
        }

        if (matched)
          break;
      }
    }
    if (matchedSelectors.length > 0)
      ext.backgroundPage.sendMessage({
        type: "devtools.traceElemHide",
        selectors: matchedSelectors
      });
  },

  onTimeout: function()
  {
    this.checkNodes(this.changedNodes);
    this.changedNodes = [];
    this.timeout = null;
  },

  observe: function(mutations)
  {
    for (var i = 0; i < this.changedNodes.length; i++)
    {
      if (!document.contains(this.changedNodes[i]))
        this.changedNodes.splice(i--, 1);
    }

    for (var j = 0; j < mutations.length; j++)
    {
      var mutation = mutations[j];
      var node = mutation.target;

      if (!document.contains(node))
        continue;

      if (mutation.type == "attributes")
        node = node.parentNode;

      var addNode = true;
      for (var k = 0; k < this.changedNodes.length; k++)
      {
        var previouslyChangedNode = this.changedNodes[k];

        if (previouslyChangedNode.contains(node))
        {
          addNode = false;
          break;
        }

        if (node.contains(previouslyChangedNode))
          this.changedNodes.splice(k--, 1);
      }

      if (addNode)
        this.changedNodes.push(node);
    }

    if (this.timeout == null)
      this.timeout = setTimeout(this.onTimeout.bind(this), 1000);
  },

  trace: function()
  {
    this.checkNodes([document]);

    this.observer.observe(
      document,
      {
        childList: true,
        attributes: true,
        subtree: true
      }
    );
  },

  disconnect: function()
  {
    document.removeEventListener("DOMContentLoaded", this.trace);
    this.observer.disconnect();
    clearTimeout(this.timeout);
  }
};

function runInPageContext(fn, arg)
{
  var script = document.createElement("script");
  script.type = "application/javascript";
  script.async = false;
  script.textContent = "(" + fn + ")(" + JSON.stringify(arg) + ");";
  document.documentElement.appendChild(script);
  document.documentElement.removeChild(script);
}

function wrapWebSocket()
{
  if (typeof WebSocket == "undefined")
    return;

  var eventName = "block-" + Math.random().toString(36).substr(2);

  document.addEventListener(eventName, function(event)
  {
    ext.backgroundPage.sendMessage({
      type: "request.websocket",
      url: event.detail.url
    }, function (block)
    {
      document.dispatchEvent(
        new CustomEvent(eventName + "-" + event.detail.url, {detail: block})
      );
    });
  });

  runInPageContext(function(eventName)
  {
    var RealWebSocket = WebSocket;
    var closeWebSocket = Function.prototype.call.bind(RealWebSocket.prototype.close);
    var addEventListener = document.addEventListener.bind(document);
    var removeEventListener = document.removeEventListener.bind(document);
    var dispatchEvent = document.dispatchEvent.bind(document);
    var CustomEvent = window.CustomEvent;

    function checkRequest(url, callback)
    {
      var incomingEventName = eventName + "-" + url;
      function listener(event)
      {
        callback(event.detail);
        removeEventListener(incomingEventName, listener);
      }
      addEventListener(incomingEventName, listener);

      dispatchEvent(new CustomEvent(eventName, {
        detail: {url: url}
      }));
    }

    function WrappedWebSocket(url)
    {
      if (!(this instanceof WrappedWebSocket)) return RealWebSocket();
      if (arguments.length < 1) return new RealWebSocket();

      var websocket;
      if (arguments.length == 1)
        websocket = new RealWebSocket(url);
      else
        websocket = new RealWebSocket(url, arguments[1]);

      checkRequest(websocket.url, function(blocked)
      {
        if (blocked)
          closeWebSocket(websocket);
      });

      return websocket;
    }
    WrappedWebSocket.prototype = RealWebSocket.prototype;
    WebSocket = WrappedWebSocket.bind();
    Object.defineProperties(WebSocket, {
      CONNECTING: {value: RealWebSocket.CONNECTING, enumerable: true},
      OPEN: {value: RealWebSocket.OPEN, enumerable: true},
      CLOSING: {value: RealWebSocket.CLOSING, enumerable: true},
      CLOSED: {value: RealWebSocket.CLOSED, enumerable: true},
      prototype: {value: RealWebSocket.prototype}
    });

    RealWebSocket.prototype.constructor = WebSocket;
  }, eventName);
}

function ElemHide()
{
  this.shadow = this.createShadowTree();
  this.style = null;
  this.tracer = null;

  this.propertyFilters = new CSSPropertyFilters(
    window,
    function(callback)
    {
      ext.backgroundPage.sendMessage({
        type: "filters.get",
        what: "cssproperties"
      }, callback);
    },
    this.addSelectors.bind(this)
  );
}
ElemHide.prototype = {
  selectorGroupSize: 200,

  createShadowTree: function()
  {
    if (!("createShadowRoot" in document.documentElement))
      return null;

    if (/\.(?:google|blogger)\.com$/.test(document.domain))
      return null;

    var shadow = document.documentElement.createShadowRoot();
    shadow.appendChild(document.createElement("shadow"));

    if ("shadowRoot" in Element.prototype)
    {
      runInPageContext(function()
      {
        var ourShadowRoot = document.documentElement.shadowRoot;
        var desc = Object.getOwnPropertyDescriptor(Element.prototype, "shadowRoot");
        var shadowRoot = Function.prototype.call.bind(desc.get);

        Object.defineProperty(Element.prototype, "shadowRoot", {
          configurable: true, enumerable: true, get: function()
          {
            var shadow = shadowRoot(this);
            return shadow == ourShadowRoot ? null : shadow;
          }
        });
      }, null);
    }

    return shadow;
  },

  addSelectors: function(selectors)
  {
    if (selectors.length == 0)
      return;

    if (!this.style)
    {
      this.style = document.createElement("style");
      (this.shadow || document.head
                   || document.documentElement).appendChild(this.style);

      if (!this.style.sheet)
        return;
    }

    if (this.shadow)
    {
      var preparedSelectors = [];
      for (var i = 0; i < selectors.length; i++)
      {
        var subSelectors = splitSelector(selectors[i]);
        for (var j = 0; j < subSelectors.length; j++)
          preparedSelectors.push("::content " + subSelectors[j]);
      }
      selectors = preparedSelectors;
    }
    for (var i = 0; i < selectors.length; i += this.selectorGroupSize)
    {
      var selector = selectors.slice(i, i + this.selectorGroupSize).join(", ");
      this.style.sheet.addRule(selector, "display: none !important;");
    }
  },

  apply: function()
  {
    var selectors = null;
    var propertyFiltersLoaded = false;

    var checkLoaded = function()
    {
      if (!selectors || !propertyFiltersLoaded)
        return;

      if (this.tracer)
        this.tracer.disconnect();
      this.tracer = null;

      if (this.style && this.style.parentElement)
        this.style.parentElement.removeChild(this.style);
      this.style = null;

      this.addSelectors(selectors.selectors);
      this.propertyFilters.apply();

      if (selectors.trace) {
        this.tracer = new ElementHidingTracer(selectors.selectors);
      }
    }.bind(this);

    ext.backgroundPage.sendMessage({type: "get-selectors"}, function(response)
    {
      selectors = response;
      checkLoaded();
    });

    this.propertyFilters.load(function()
    {
      propertyFiltersLoaded = true;
      checkLoaded();
    });
  }
};

if (document instanceof HTMLDocument)
{
  wrapWebSocket();

  var elemhide = new ElemHide();
  elemhide.apply();

  document.addEventListener("error", function(event)
  {
    checkCollapse(event.target);
  }, true);

  document.addEventListener("load", function(event)
  {
    var element = event.target;
    if (/^i?frame$/.test(element.localName))
      checkCollapse(element);
  }, true);
}
