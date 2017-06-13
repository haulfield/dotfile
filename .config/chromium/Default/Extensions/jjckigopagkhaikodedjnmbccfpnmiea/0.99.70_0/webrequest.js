
with(require("filterClasses"))
{
  this.Filter = Filter;
  this.BlockingFilter = BlockingFilter;
  this.WhitelistFilter = WhitelistFilter;
}
with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.DownloadableSubscription = DownloadableSubscription;
  this.SpecialSubscription = SpecialSubscription;
}
with(require("whitelisting"))
{
  this.isPageWhitelisted = isPageWhitelisted;
  this.isFrameWhitelisted = isFrameWhitelisted;
  this.processKey = processKey;
  this.getKey = getKey;
}
with(require("url"))
{
  this.stringifyURL = stringifyURL;
  this.isThirdParty = isThirdParty;
  this.extractHostFromFrame = extractHostFromFrame;
  this.extractHostFromUrl = extractHostFromUrl;
}
var FilterStorage = require("filterStorage").FilterStorage;
var FilterNotifier = require("filterNotifier").FilterNotifier;
var ElemHide = require("elemHide").ElemHide;
var defaultMatcher = require("matcher").defaultMatcher;
var Prefs = require("prefs").Prefs;
var Synchronizer = require("synchronizer").Synchronizer;
var Utils = require("utils").Utils;
var parseFilters = require("filterValidation").parseFilters;
var parseFilter = require("filterValidation").parseFilter;
var composeFilters = require("filterComposer").composeFilters;
var updateIcon = require("icon").updateIcon;
var initNotifications = require("notificationHelper").initNotifications;
var devtools = require("devtools");
var CSSRules = require("cssRules").CSSRules;
var RegExpFilter = require("filterClasses").RegExpFilter;
var platform = require("info").platform;
var showNextNotification = require("notificationHelper").showNextNotification;
var checkWhitelisted = require("whitelisting").checkWhitelisted;

var adskillerDomains = {};

customDb.getAll(function(result) {
    adskillerDomains = result;
});

ext.webRequest.getIndistinguishableTypes().forEach(function(types) {
    for (var i = 1; i < types.length; i++)
    {
      RegExpFilter.typeMap[types[i]] = RegExpFilter.typeMap[types[0]];
    }
});

FilterNotifier.addListener(function(action, arg)
{
  switch (action)
  {
    case "filter.added":
    case "filter.removed":
    case "filter.disabled":
      if (!(arg instanceof RegExpFilter))
        break;
    case "subscription.added":
    case "subscription.removed":
    case "subscription.disabled":
    case "subscription.updated":
    case "load":
      ext.webRequest.handlerBehaviorChanged();
      break;
  }
});

function __getDomain (_url){    
    var rege = /([^.]+\.)?([^.$\/]+)\.([^$\/]+)/;
    var url = _url.replace(/http(s)?(\:\/\/)?(www\.)?/, '');
        
    var  md  = rege.exec(url);
    if (md == null || md.length < 2) return false;
    md = (md[1] != undefined) ? md[1] + md[2] + '.' + md[3] : md[2] + '.' + md[3];
        
    return md;
}

function onBeforeRequestAsync(page, url, type, docDomain, thirdParty, sitekey, specificOnly, filter)
{
  if (filter)
    FilterNotifier.triggerListeners("filter.hitCount", filter, 0, 0, page);
  if (devtools) {
    devtools.logRequest(page, url, type, docDomain, thirdParty, sitekey, specificOnly, filter);
  }
}

function onBeforeRequestAdskiller(details) {
    var url = details.url;
    var domain = __getDomain(url);      
    var data = adskillerDomains[ domain ];
    
    if (data === undefined){
        return {"cancel" : false}; 
    }

    var r;
    var pre_reg;
    var ext;
    if (!data || data.type.indexOf(details.type) === -1 ) {
        return {"cancel" : false};
    }
    if (data.cancel_request){
        return {"cancel" : true};
    }
    
    data = ( Object.prototype.toString.call(data.data) !== "[object Object]") ? data.data : [data.data];
    
    for(var i = 0, cnt = data.length; i < cnt; i += 1){
        try {          
            if (data[i].pre_reg) {
                pre_reg = new RegExp( data[i].pre_reg );
                if ( pre_reg.test(url) !== data[i].pre_reg_result ) {
                    break;
                }
            }
            
            r = new RegExp( data[i].reg_from );
            if ( r.test(url) === data[i].reg_result ) {
                
                if ( data[i].append === undefined ) {
                    url = url.replace( r, data[i].reg_to );
                } else {
                    url += data[i].append;
                }
                
                ext = true;
                break;
            }
            
        } catch(e){
            return {"cancel" : false};
        }
        
    }
    
    if (ext) {
        return {"redirectUrl" : url};
    } else {
        return {"cancel" : false};
    }
}

function onBeforeRequest(url, type, page, frame)
{
  if (isFrameWhitelisted(page, frame))
    return false;

  var urlString = stringifyURL(url);
  var docDomain = extractHostFromFrame(frame);
  var thirdParty = isThirdParty(url, docDomain);
  var key = getKey(page, frame);
  var specificOnly = !!checkWhitelisted(page, frame, RegExpFilter.typeMap.GENERICBLOCK);
  var filter = defaultMatcher.matchesAny(
    stringifyURL(url),
    type, docDomain,
    isThirdParty(url, docDomain),
    key
  ); 
  setTimeout(onBeforeRequestAsync, 0, page, urlString, type, docDomain, thirdParty, key, specificOnly, filter);
  //setTimeout(onBeforeRequestAsync, 0, url, type, page, filter);
  if (filter instanceof BlockingFilter) {
      getStatBlockUrls(url.href, page._id, filter.text);
  }
  return (filter instanceof BlockingFilter);
}

//chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestAdskiller, {urls: ["<all_urls>"]}, ["blocking"]);

ext.webRequest.onBeforeRequest.addListener(onBeforeRequest);