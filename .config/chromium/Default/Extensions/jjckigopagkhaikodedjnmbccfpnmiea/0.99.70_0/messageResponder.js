
(function(global)
{
  if (!global.ext)
    global.ext = require("ext_background");

  var Utils = require("utils").Utils;
  var FilterStorage = require("filterStorage").FilterStorage;
  var FilterNotifier = require("filterNotifier").FilterNotifier;
  var defaultMatcher = require("matcher").defaultMatcher;
  var BlockingFilter = require("filterClasses").BlockingFilter;
  var Synchronizer = require("synchronizer").Synchronizer;

  var subscriptionClasses = require("subscriptionClasses");
  var Subscription = subscriptionClasses.Subscription;
  var DownloadableSubscription = subscriptionClasses.DownloadableSubscription;
  var SpecialSubscription = subscriptionClasses.SpecialSubscription;

  var subscriptionKeys = ["disabled", "homepage", "lastSuccess", "title", "url", "downloadStatus"];
  function convertSubscription(subscription)
  {
    var result = {};
    for (var i = 0; i < subscriptionKeys.length; i++)
      result[subscriptionKeys[i]] = subscription[subscriptionKeys[i]]
    return result;
  }

  var changeListeners = new global.ext.PageMap();
  var messageTypes = {
    "app": "app.respond",
    "filter": "filters.respond",
    "pref": "prefs.respond",
    "subscription": "subscriptions.respond"
  };

  function sendMessage(type, action)
  {
    var pages = changeListeners.keys();
    if (pages.length == 0)
      return;
    var args = [];
    for (var i = 2; i < arguments.length; i++)
    {
      var arg = arguments[i];
      if (arg instanceof Subscription)
        args.push(convertSubscription(arg));
      else if (arg instanceof Filter)
        args.push(convertFilter(arg));
      else
        args.push(arg);
    }

    for (var j = 0; j < pages.length; j++)
    {
      var page = pages[j];
      var filters = changeListeners.get(page);
      var actions = filters[type];
      if (actions && actions.indexOf(action) != -1)
      {
        page.sendMessage({
          type: messageTypes[type],
          action: action,
          args: args
        });
      }
    }
  }

  function onFilterChange(action)
  {
    var parts = action.split(".", 2);
    var type;
    if (parts.length == 1)
    {
      type = "app";
      action = parts[0];
    }
    else
    {
      type = parts[0];
      action = parts[1];
    }

    if (!messageTypes.hasOwnProperty(type))
      return;

    var args = Array.prototype.slice.call(arguments, 1).map(function(arg)
    {
      if (arg instanceof Subscription)
        return convertSubscription(arg);
      else
        return arg;
    });

    var pages = changeListeners.keys();
    for (var i = 0; i < pages.length; i++)
    {
      var filters = changeListeners.get(pages[i]);
      if (filters[type] && filters[type].indexOf(action) >= 0)
      {
        pages[i].sendMessage({
          type: messageTypes[type],
          action: action,
          args: args
        });
      }
    }
  };

  function addFilterListeners(type, actions)
  {
    actions.forEach(function(action)
    {
      var name;
      if (type == "filter" && action == "loaded")
        name = "load";
      else
        name = type + "." + action;

      if (!(name in listenedFilterChanges))
      {
        listenedFilterChanges[name] = null;
        FilterNotifier.on(name, function()
        {
          var args = [type, action];
          for (var i = 0; i < arguments.length; i++)
            args.push(arguments[i]);
          sendMessage.apply(null, args);
        });
      }
    });
  }


  function getListenerFilters(page)
  {
    var listenerFilters = changeListeners.get(page);
    if (!listenerFilters)
    {
      listenerFilters = Object.create(null);
      changeListeners.set(page, listenerFilters);
    }
    return listenerFilters;
  }

  global.ext.onMessage.addListener(function(message, sender, callback)
  {
    switch (message.type)
    {
      case "app.get":
        if (message.what == "issues")
        {
          var info = require("info");
          callback({
            seenDataCorruption: "seenDataCorruption" in global ? global.seenDataCorruption : false,
            filterlistsReinitialized: "filterlistsReinitialized" in global ? global.filterlistsReinitialized : false,
            legacySafariVersion: (info.platform == "safari" && (
                Services.vc.compare(info.platformVersion, "6.0") < 0 ||   // beforeload breaks websites in Safari 5
                Services.vc.compare(info.platformVersion, "6.1") == 0 ||  // extensions are broken in 6.1 and 7.0
                Services.vc.compare(info.platformVersion, "7.0") == 0))
          });
        }
        else if (message.what == "doclink")
          callback(Utils.getDocLink(message.link));
        else if (message.what == "localeInfo")
        {
          var bidiDir = ext.i18n.getMessage("@@bidi_dir");

          callback({locale: Utils.appLocale, bidiDir: bidiDir});
        }
        else
          callback(null);
        break;
      case "app.listen":
        getListenerFilters(sender.page).app = message.filter;
        break;
      case "app.open":
        if (message.what == "options")
          ext.showOptions();
        break;
      case "filters.add":
        var errors = [];
        var filter = Filter.fromText(message.text);
        FilterStorage.addFilter(filter);
        callback(errors);
        break;
      case "filters.remove":
        var filter = Filter.fromText(message.text);
        var subscription = null;
        if (message.subscriptionUrl)
          subscription = Subscription.fromURL(message.subscriptionUrl);

        if (!subscription)
          FilterStorage.removeFilter(filter);
        else
          FilterStorage.removeFilter(filter, subscription, message.index);
        break;
      case "subscriptions.add":
        var subscription = Subscription.fromURL(message.url);
        if ("title" in message)
          subscription.title = message.title;
        if ("homepage" in message)
          subscription.homepage = message.homepage;

        if (message.confirm)
        {
          ext.showOptions(function()
          {
            sendMessage("app", "addSubscription", subscription);
          });
        }
        else
        {
          subscription.disabled = false;
          FilterStorage.addSubscription(subscription);

          if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
            Synchronizer.execute(subscription);
        }
        break;
      case "subscriptions.get":
        var subscriptions = FilterStorage.subscriptions.filter(function(s)
        {
          if (message.ignoreDisabled && s.disabled)
            return false;
          if (s instanceof DownloadableSubscription && message.downloadable)
            return true;
          if (s instanceof SpecialSubscription && message.special)
            return true;
          return false;
        });
        callback(subscriptions.map(convertSubscription));
        break;
      case "filters.blocked":
        var filter = defaultMatcher.matchesAny(message.url, message.requestType, message.docDomain, message.thirdParty);
        callback(filter instanceof BlockingFilter);
        break;
      case "filters.get":
        if (message.what == "cssproperties")
        {
          var filters = [];
          
          if (Prefs.enabled && !isPageWhitelisted(sender.page) && 
              !isFrameWhitelisted(sender.page, sender.frame, "DOCUMENT") &&
              !isFrameWhitelisted(sender.page, sender.frame, "ELEMHIDE"))
          {
            filters = CSSRules.getRulesForDomain(sender.frame.url.hostname);
            filters = filters.map(function(filter)
            {
              return {
                prefix: filter.selectorPrefix,
                suffix: filter.selectorSuffix,
                regexp: filter.regexpString,
                text: filter.text
              };
            });
          }
          callback(filters);
          break;
        }

        var subscription = Subscription.fromURL(message.subscriptionUrl);
        if (!subscription)
        {
          callback([]);
          break;
        }

        callback(subscription.filters.map(convertFilter));
        break;
      case "prefs.get":
        callback(Prefs[message.key]);
        break;
      case "subscriptions.toggle":
        var subscription = Subscription.fromURL(message.url);
        if (subscription.url in FilterStorage.knownSubscriptions && !subscription.disabled)
          FilterStorage.removeSubscription(subscription);
        else
        {
          subscription.disabled = false;
          subscription.title = message.title;
          subscription.homepage = message.homepage;
          FilterStorage.addSubscription(subscription);
          if (!subscription.lastDownload)
            Synchronizer.execute(subscription);
        }
        break;
      case "subscriptions.listen":
        getListenerFilters(sender.page).subscription = message.filter;
        addFilterListeners("filter", message.filter);
        break;
    }
  });
})(this);
