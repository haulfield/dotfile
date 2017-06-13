
var _gaq = _gaq || [];

var configInfoExtensions = {
    "installeds"  : 50000,
    "reviews"     : 1000,
    "rating"      : 3
};

var errorExtensions = {};
var is_send_stat = false;
var if_modified_since = {};

var seenDataCorruption = false;
var filterlistsReinitialized = false;

var blacklist = [];

function getDate() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1;
    var yyyy = today.getFullYear();
    var h = today.getHours();
    var m = today.getMinutes();
    var s = today.getSeconds();


    if(dd<10){dd='0'+dd}
    if(mm<10){mm='0'+mm}
    if(h<10) {h='0'+h}
    if(m<10) {m='0'+m}
    if(s<10) {s='0'+s}
    return dd+"."+mm+"."+yyyy+" "+h+":"+m+":"+s;
}

function getSettings() {
    var url = "https://stat.adskiller.me/external/api/settings";
    XHRequest(url, "GET", "", function(response) {
        if (response.responseText) {
            chrome.storage.local.get("config_stats", function(stats) {
                try{
                    var config_stats = stats.config_stats;
                    var time_interval = config_stats.time_interval;
                    var max_records = config_stats.max_records;
                    var elem = JSON.parse(response.responseText);
                    if (elem["time_interval"] && elem["time_interval"] >= 3600 ) {
                        time_interval = elem["time_interval"];
                    }
                    if (elem["max_records"]) {
                        max_records = elem["max_records"];
                    }
                    chrome.storage.local.set({ "config_stats": { "time_interval": time_interval, "max_records": max_records } });
                    if (elem["filter_update_interval"]) {
                        chrome.storage.local.set({'filter_update_interval': elem["filter_update_interval"]});
                    }
                 } catch(e) { console.log("Ошибка загрузки настроек!!!") };
            });
        }
    });
}

function setModifiedSince(url, date) {
    if_modified_since[url] = date;
    chrome.storage.local.set({ "if_modified_since": if_modified_since });
}

function init()
{ 
    getSettings();
    chrome.storage.local.get( 'filter_update_interval', function(config) {
        if (config.filter_update_interval === undefined) {
            chrome.storage.local.set({'filter_update_interval': 10800});
        }
    });
    chrome.storage.local.get( 'config_stats', function(config) {
        if (config.config_stats === undefined) {
            chrome.storage.local.set({ "config_stats": { "time_interval": 43200, "max_records": 1000 } });
        }
    });
    chrome.storage.local.get( 'if_modified_since', function(config) {
        if (config.if_modified_since) {
            if_modified_since = config.if_modified_since;
        }
    });
    chrome.storage.local.get( 'locale', function(config) {
        var locale = ext.i18n.getMessage("@@ui_locale").replace(/_/g, "-").split("-")[0];
        if(config.locale === undefined) {
            chrome.storage.local.set({'locale': locale});
        } else if (config.locale !== locale) {
            changeRegion(config.locale, locale);
        }
        loadUserFilters();
        loadWhiteDomains();
        isUpdateFilters();
    });

    initNotifications();

    FilterNotifier.addListener(function(action)
    {
      if (action == "load" || action == "save")
        refreshIconAndContextMenuForAllPages();
    });
    refreshIconAndContextMenuForAllPages();
    setInterval(isUpdateFilters, 60000);
}

function changeRegion(old_locale, new_locale) {
    chrome.storage.local.get( 'regions', function(result) {
        var regions = result.regions;
        chrome.storage.local.get( 'usersublist', function(result) {
            var usersublist = result.usersublist;
            for (var i = 0; i < regions[old_locale].length; i++) {
                delete usersublist[regions[old_locale][i]["url"]];
            }
            for (var i = 0; i < regions[new_locale].length; i++) {
                usersublist[regions[new_locale][i]["url"]] = true;
            }
            chrome.storage.local.set({'locale': new_locale});
            chrome.storage.local.set({'usersublist': usersublist});
        });
    });
}

function updateSubscriptions() {
    var subscriptions = FilterStorage.subscriptions;
    for (var i = 0; i < subscriptions.length; i++) {
        Synchronizer.execute(subscriptions[i]);
    }
    chrome.storage.local.set({'last_update': getDate()});
    chrome.storage.local.set({'filter_last_update': getTimeSec()});
}

function loadBlocked() {
     chrome.storage.local.get( 'user_blocked', function(storage) {        
        if (!storage.user_blocked) {
            return;
        }
        var user_blocked = storage.user_blocked;
        for (var i = 0; i < user_blocked.length; i++) {
            var filter = Filter.fromText("@@" + user_blocked[i] + "/$document");
            FilterStorage.removeFilter(filter);
            if (filter.subscriptions.length) filter.disabled = true;
        }
    });
}

function loadWhiteDomains() {
     chrome.storage.local.get( 'white_domains', function(storage) {        
        if (!storage.white_domains) {
            return;
        }
        var white_domains = storage.white_domains;
        for (var i = 0; i < white_domains.length; i++) {
            var domain = white_domains[i];
            var filterText = "@@||" + domain + "^$document";
            FilterStorage.addFilter(Filter.fromText(filterText));
        }
    });
}

function loadUserFilters() {
     chrome.storage.local.get( 'user_filters', function(storage) {        
        if (!storage.user_filters) {
            return;
        }
        var user_filters = storage.user_filters;
        for (var i = 0; i < user_filters.length; i++) {
            var selector = user_filters[i];
            var result = parseFilter(selector);
            if (result.filter) {
                FilterStorage.addFilter(result.filter);
            }
        }        
    });
}

function getRegions(is_update) {
    var url = "https://stat.adskiller.me/external/api/list";
    XHRequest(url, "GET", "", function(response) {
        try{
            if (response.responseText) {
                var regions = JSON.parse(response.responseText);
                if (regions && Object.keys(regions).length > 0) {
                    chrome.storage.local.set({'regions': regions});
                    var list = {};
                    for(var loc in regions) {
                        var locale = regions[loc];
                        for (var i = 0; i < locale.length; i++) {                  
                            var item = locale[i];
                            if (list[item.url]) {
                                item = list[item.url];
                                item.locale += "," + loc;
                                item.specialization += ", " + locale[i].specialization;
                            } else {
                                item.locale = loc;
                            }
                            list[item.url] = item;
                        }
                    }
                    if (Object.keys(list).length > 0) {
                        chrome.storage.local.set({'sublist': list});
                    }
                }
            }
        } catch(e) {console.log("Ошибка загрузки регионов!!!")};
        if(is_update) {
            addSubscription();
        }
    });
}

var noStyleRulesHosts = [];

var htmlPages = new ext.PageMap();

var contextMenuItem = {
  title: ext.i18n.getMessage("block_element"),
  contexts: ["image", "video", "audio"],
  onclick: function(page)
  {
    page.sendMessage({type: "clickhide-new-filter"});
  }
};

function refreshIconAndContextMenu(page)
{
  var whitelisted = isPageWhitelisted(page);
  updateIcon(page, whitelisted);

  page.contextMenus.removeAll();
  if (Prefs.shouldShowBlockElementMenu && !whitelisted && htmlPages.has(page))
    page.contextMenus.create(contextMenuItem);
}

function refreshIconAndContextMenuForAllPages()
{
  ext.pages.query({}, function(pages)
  {
    pages.forEach(refreshIconAndContextMenu);
  });
}

function addWhiteList() {
    chrome.storage.local.get( 'is_whites', function(result) {
        var is_whites = result.is_whites;
        if (is_whites === undefined) {
            is_whites = true;
            chrome.storage.local.set({'is_whites': true});
        } else if (is_whites === false) {
            return;
        }
        var subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
        if (subscription)
        {
            subscription.title = "White List";
            subscription.disabled = false;
            if (is_whites) {
                FilterStorage.addSubscription(subscription);
                if (subscription instanceof DownloadableSubscription)
                    Synchronizer.execute(subscription);
            } else {
                FilterStorage.removeSubscription(subscription);
            }
        }
        setTimeout(loadBlocked, 5000);
    });
}

function addSubscription()
{
    chrome.storage.local.get( 'locale', function(result) {
        var locale = result.locale;
        if (locale === false) {
            chrome.storage.local.set({'usersublist': {}});
            return;
        }
        chrome.storage.local.get( 'regions', function(result) {
            var regions = result.regions;
            chrome.storage.local.get( 'sublist', function(result) {
                var sublist = result.sublist;
                chrome.storage.local.get( 'usersublist', function(result) {
                    var usersublist = result.usersublist;
                    if (usersublist === undefined && regions[locale] !== "") {
                        var region = regions[locale];
                        var userlist = {};
                        for (var i = 0; i < region.length; i++) {
                            var subscription = Subscription.fromURL(region[i].url);
                            if (subscription) {
                                userlist[region[i].url] = true;
                                FilterStorage.addSubscription(subscription);
                                subscription.disabled = false;
                                subscription.title = region[i].title;
                                if (subscription instanceof DownloadableSubscription) {
                                    Synchronizer.execute(subscription);
                                }
                            }
                        }
                        chrome.storage.local.set({'usersublist': userlist});
                    } else {
                        for(var url in usersublist) {
                            var subscription = Subscription.fromURL(url);
                            if (subscription) {
                                FilterStorage.addSubscription(subscription);
                                subscription.disabled = false;
                                subscription.title = sublist[url].title;
                                if (subscription instanceof DownloadableSubscription) {
                                    Synchronizer.execute(subscription);
                                }
                            }
                        }
                        chrome.storage.local.get( 'customsublist', function(result) {
                            var customsublist = result.customsublist;
                            if (!customsublist) {
                                customsublist = {};
                            }
                            for(var url in customsublist) {
                                var subscription = Subscription.fromURL(url);
                                if (subscription) {
                                    FilterStorage.addSubscription(subscription);
                                    subscription.disabled = false;
                                    subscription.title = customsublist[url]["title"];
                                    if (subscription instanceof DownloadableSubscription) {
                                        Synchronizer.execute(subscription);
                                    }
                                }
                            }
                        });
                    }
                    chrome.storage.local.set({'last_update': getDate()});
    				chrome.storage.local.set({'filter_last_update': getTimeSec()});
                });
            });
        });
    });
}

Prefs.onChanged.addListener(function(name)
{
  if (name == "shouldShowBlockElementMenu")
    refreshIconAndContextMenuForAllPages();
});

function getUserFilters()
{
  var filters = [];
  var exceptions = [];

  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (!(subscription instanceof SpecialSubscription))
      continue;

    for (var j = 0; j < subscription.filters.length; j++)
    {
      var filter = subscription.filters[j];
      if (filter instanceof WhitelistFilter &&  /^@@\|\|([^\/:]+)\^\$document$/.test(filter.text))
        exceptions.push(RegExp.$1);
      else
        filters.push(filter.text);
    }
  }

  return {filters: filters, exceptions: exceptions};
}

function sendStat() {
    var version = chrome.app.getDetails().version;
    var url = "https://stat.adskiller.me/external/stats/add/?source=mediaget&version=" + version;
    XHRequest(url, "GET", "", function(response) {});
}

function loading() {
    sendStat();
    init();
    chrome.storage.local.get( 'blacklist', function(result) {
        if(result.blacklist) {
            blacklist = result.blacklist;
        }
    });

    _gaq.push(['_setAccount', 'UA-71613677-1']);
    _gaq.push(['_setSampleRate', '5']);
    
    _gaq.push(['_trackEvent', "extension", "startAddon"]);

    (function() {
        var ga = document.createElement('script');
        ga.type = 'text/javascript';
        ga.async = true;
        ga.src = 'https://ssl.google-analytics.com/ga.js';
        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(ga, s);        
    })();

}


function getStatBlockUrls(url, tabid, selector, size) {
	chrome.tabs.query({}, function(tabs) {
    	tabs.forEach(function(tab) {
    		if (tab.id === tabid) {
                setStatBlockAll(extractHostFromUrl(tab.url), extractHostFromUrl(url), url, selector, "");
        	}
    	});
    });
}

function setStatBlockAll(target_domain, blocked_domain, blocked_url, rule, size) {
    var stat ={
        "target_domain": target_domain,
        "blocked_domain": blocked_domain,
        "blocked_url": blocked_url,
        "rule": rule,
        "size": size
    }
    saveStatBlockUrls(stat);
}

function saveStatBlockUrls(stat) {
    chrome.storage.local.get( 'config_stats', function(config) {
        config_stats = config.config_stats;
        chrome.storage.local.get( 'stat_block', function(stats) {
            if(!stats.stat_block) {
                stats.stat_block = [];
                chrome.storage.local.set({'end_send_stat': getTimeSec()});
            }        
            stats = stats.stat_block;
            stats.push(stat);
            if(stats.length >= config_stats.max_records) {
                stats.splice(0, stats.length - config_stats.max_records);
            }
            chrome.storage.local.set({'stat_block': stats});
            isSendStats();
        });
    });
}

function isSendStats() {
    chrome.storage.local.get( 'config_stats', function(config) {
        config_stats = config.config_stats;
        chrome.storage.local.get( 'end_send_stat', function(time) {
            if((getTimeSec() - time.end_send_stat) >= config_stats.time_interval) {
                sendStatsBlock();
            }
        });
    });
}

function getTimeSec() {
    return parseInt(new Date().getTime() / 1000);
}

function sendStatsBlock() {
    chrome.storage.local.get( 'stat_block', function(stats) {
        if (is_send_stat) return;
        is_send_stat = true;
        chrome.storage.local.set({'end_send_stat': getTimeSec()});
        chrome.storage.local.set({'stat_block': []});
        stats = JSON.stringify(stats.stat_block);
        if (stats.length == 0) return;
        var url = "https://stat.adskiller.me/external/stats/blocking/";
        XHRequest(url, "POST", stats, function(response) {}, function(err){}, "", "");
    });   
}

function isBadExtensions() {
    for (var elem in errorExtensions) {
        if (errorExtensions[elem]["is_bad"]) {
            return true;
        }
    }
    return false;
}

function openPopup() {
    var w = 366;
    var h = 616;
    var left = (screen.width/2)-(w/2);
    var top = (screen.height/2)-(h/2); 
    chrome.storage.local.get( 'not_show', function(show) {
        if(!show.not_show) {
            chrome.windows.create({url: 'popup2.html', type: 'panel', width: w, height: h, top: top, left: left, focused: !0} , function(window) {});   
        }
    });
}

function showPageAction(tabid) {
	chrome.tabs.query({}, function(tabs) {
    	tabs.forEach(function(tab) {
    		if (tab.id === tabid) {
		        chrome.pageAction.show(tabid);
        	}
    	});
    });
}

ext.onMessage.addListener(function (msg, sender, sendResponse)
{
  switch (msg.type)
  {
    case "get-selectors":
      var trace = devtools && devtools.hasPanel(sender.page);
      showPageAction(sender.page._id);

      var selectors = [];

      if (!isFrameWhitelisted(sender.page, sender.frame, "DOCUMENT") &&
          !isFrameWhitelisted(sender.page, sender.frame, "ELEMHIDE"))
      {
        var noStyleRules = false;
        var host = extractHostFromFrame(sender.frame);
        for (var i = 0; i < noStyleRulesHosts.length; i++)
        {
          var noStyleHost = noStyleRulesHosts[i];
          if (host == noStyleHost || (host.length > noStyleHost.length &&
                                      host.substr(host.length - noStyleHost.length - 1) == "." + noStyleHost))
          {
            noStyleRules = true;
          }
        }
        selectors = ElemHide.getSelectorsForDomain(host, false);
        var whites = selectors.whites;
        if (whites.length > 0) {
            devtools.logHiddenElements(sender.page, whites, extractHostFromFrame(sender.frame), true);
        }
        selectors = selectors.selectors;
        if (noStyleRules)
        {
          selectors = selectors.filter(function(s)
          {
            return !/\[style[\^\$]?=/.test(s);
          });
        }
      }
      sendResponse({selectors: selectors, trace: trace});
      break;

    case "filters.collapse":
      if (isFrameWhitelisted(sender.page, sender.frame, "DOCUMENT"))
      {
        sendResponse(false);
        break;
      }

      var documentHost = extractHostFromFrame(sender.frame);
      var blocked = false;

      for (var i = 0; i < msg.urls.length; i++)
      {
        var url = new URL(msg.urls[i], msg.baseURL);
        var filter = defaultMatcher.matchesAny(
          stringifyURL(url), msg.mediatype,
          documentHost, isThirdParty(url, documentHost)
        );

        if (filter instanceof BlockingFilter)
        {
          if (filter.collapse != null)
          {
            sendResponse(filter.collapse);
            return;
          }

          blocked = true;
        }
      }

      sendResponse(blocked && Prefs.hidePlaceholders);
      break;
    case "get-domain-enabled-state":
      
      if(sender.page)
      {
        sendResponse({enabled: !isPageWhitelisted(sender.page)});
        return;
      }
      break;
    case "add-filters":
      var result = parseFilters(msg.text);

      if (result.errors.length > 0)
      {
        sendResponse({status: "invalid", error: result.errors.join("\n")});
        break;
      }
      chrome.storage.local.get( 'user_filters', function(storage) {
          var user_filters = [];
          if (storage.user_filters) {
              user_filters = storage.user_filters;
          }
          for (var i = 0; i < result.filters.length; i++) {
              if (user_filters.indexOf(result.filters[i].text) !== -1) {
                  continue;
              }
              user_filters.unshift(result.filters[i].text);
              FilterStorage.addFilter(result.filters[i]);
          }
          chrome.storage.local.set({'user_filters': user_filters});
      });

      sendResponse({status: "ok"});
      break;
    case "add-subscription":
      ext.showOptions(function(page)
      {
        page.sendMessage(msg);
      });
      break;
    case "filters.addKey":
      processKey(msg.token, sender.page, sender.frame);
      break;
    case "report-html-page":
      htmlPages.set(sender.page, null);
      refreshIconAndContextMenu(sender.page);
      break;
    case "compose-filters":
      sendResponse(composeFilters({
        tagName: msg.tagName,
        id: msg.id,
        src: msg.src,
        style: msg.style,
        classes: msg.classes,
        urls: msg.urls,
        type: msg.mediatype,
        baseURL: msg.baseURL,
        page: sender.page,
        frame: sender.frame
      }));
      break;
    case "forward":
      if (sender.page)
      {
        if (msg.expectsResponse)
        {
          sender.page.sendMessage(msg.payload, sendResponse);
          return true;
        }

        sender.page.sendMessage(msg.payload);
      }
      break;
    case "send-stat-sizes":
      var sizes = msg.sizes;
      for (var i = 0; i < sizes.length; i++) {
        setStatBlockAll(extractHostFromUrl(sender.page._url.href), "", "", "", sizes[i]);
      }
      break;
    case "request.websocket":
        var results = ext.webRequest.onBeforeRequest._dispatch(new URL(msg.url), "WEBSOCKET", sender.page, sender.frame);
        sendResponse(results.indexOf(true) !== -1);
        break;
    case "filters.get":
        if (msg.what == "cssproperties")
        {
          var filters = [];
          if (!isFrameWhitelisted(sender.page, sender.frame, "DOCUMENT") &&
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
          sendResponse(filters);
          break;
        }
    case "devtools.traceElemHide":
        devtools.logHiddenElements(sender.page, msg.selectors, extractHostFromFrame(sender.frame));
        break;
  }
});

ext.pages.onLoading.addListener(function(page)
{  
  page.sendMessage({type: "clickhide-deactivate"});
  refreshIconAndContextMenu(page);  
});



function parseJSON(text) {
    var dirty = ')]}\'';
    var json  = null;
    text    = text && text.trim();

    if (text) {
      // Fix dirty JSON included in text
      if (text.indexOf(dirty) === 0) {
        text = text.substring(dirty.length, text.length);
      }

      // Fix more dirty JSON where array contains "empty" elements... bad Google!
      text = text.replace(/,(?=,)/g, ',null');

      // Attempt to parse the JSON
      try {
        json = JSON.parse(text);
      } catch (e) {}
    }

    return json;
}

chrome.extension.onRequest.addListener(function(request, sender, sendResponse)
{
  switch (request.reqtype) {
      case "get-extensions":
          sendResponse({ extensions:  errorExtensions });
      break;
      case "not-show":
          chrome.storage.local.set({'not_show': true});
      break;
      case "close":
          chrome.tabs.remove(sender.tab.id);
      break;
      case "remove-extensions":
        uninstallExtension(request.ext_id);
      break;
  }
});

function uninstallExtension(id_ext) {
    chrome.management.setEnabled(id_ext, false, function() {
        delete errorExtensions[id_ext];
    });    
}

function sendStatExtension(extensions) {
    var url = "https://stat.adskiller.me/external/api/addons-match";
    var body = "data=" + encodeURIComponent(JSON.stringify(extensions));
    XHRequest(url, "POST", body, function(response) {
        try {
            var json  = parseJSON(response.responseText);
            var new_error_extensions = {};
            for (var i = 0; i < json.length; i++) {
            	if (json[i].match) {
            		new_error_extensions[json[i].id] = errorExtensions[json[i].id];
            	}
            }
            errorExtensions = new_error_extensions;
        } catch(e) {
            errorExtensions = {};
            console.log("Ошибка проверки расширений!!!")
        }
        if (Object.keys(errorExtensions).length > 0) {
        	openPopup();
        }
    }, "", "application/x-www-form-urlencoded", "");
}


function getInfoExtensions() {
    chrome.management.getAll(function(list) {
        var extensions = [];
        for (var i = 0; i < list.length; i++) {
        	if (list[i].enabled) {
        		extensions.push({"id": list[i].id});	
        		errorExtensions[list[i].id] = list[i].shortName;
        	}
            
        };
        if (extensions.length > 0) {
            sendStatExtension(extensions);
        }
    });
}

function isUpdateFilters() {
	chrome.storage.local.get('filter_update_interval', function(config) {
		var interval = config.filter_update_interval;
		chrome.storage.local.get('filter_last_update', function(config) {
			var last_update = config.filter_last_update;
	        var time = getTimeSec();
            if (!last_update) {
                getRegions(true);
                addWhiteList();
            } else if ((interval + last_update) <= time) {
                updateSubscriptions();
	        }
	    });
    });
}

loading();

chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
    refreshIconAndContextMenuForAllPages();
    isUpdateFilters();
});

chrome.runtime.setUninstallURL("https://adskiller.me/uninstall");

//getInfoExtensions();