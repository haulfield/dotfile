
var backgroundPage = ext.backgroundPage.getWindow();
var require = backgroundPage.require;

var i18n = ext.i18n;

var Filter = require("filterClasses").Filter;
var FilterStorage = require("filterStorage").FilterStorage;
var Prefs = require("prefs").Prefs;
var isPageWhitelisted = require("whitelisting").isPageWhitelisted;
var getDecodedHostname = require("url").getDecodedHostname;

var page = null;

function init()
{
  if (!Prefs["shouldShowBlockElementMenu"]) {
      document.getElementById("clickhide").style.display = "none";
  }
  ext.pages.query({active: true, lastFocusedWindow: true}, function(pages)
  {
    page = pages[0];

    if (page)
    {
      if (isPageWhitelisted(page)) { 
        document.getElementById("on-checkbox").checked = false;
        document.getElementById("for-checkbox").innerHTML = i18n.getMessage("on_un_check_site");
        document.getElementById("clickhide").style.display = "none";
      } else {
        document.getElementById("on-checkbox").checked = true;
        document.getElementById("for-checkbox").innerHTML = i18n.getMessage("on_check_site");
        document.getElementById("clickhide").style.display = "block";
      }
    }
  });
  
  //document.getElementById("for-checkbox").addEventListener("click", toggleEnabled, false);
  document.getElementById("on-checkbox").addEventListener("change", toggleEnabled, false);
  document.getElementById("clickhide").addEventListener("click", activateClickHide, false);
  document.getElementById("options").addEventListener("click", function()
  {
    ext.showOptions();
  }, false);
}
window.addEventListener("DOMContentLoaded", init, false);

function updatePage(e) {
    chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
        chrome.tabs.reload(tabs[0].id);
    });
}

function toggleEnabled(e)
{
  var elem = document.getElementById("on-checkbox");
  var host = getDecodedHostname(page.url).replace(/^www\./, "");
  if (!elem.checked) {
    document.getElementById("clickhide").style.display = "none";
    document.getElementById("for-checkbox").innerHTML = i18n.getMessage("on_un_check_site");
    chrome.storage.local.get( 'white_domains', function(storage) {
        var white_domains = [];
        if (storage.white_domains) {
            white_domains = storage.white_domains;
        }
        white_domains.unshift(host);
        chrome.storage.local.set({'white_domains': white_domains});

        var filter = Filter.fromText("@@||" + host + "^$document");    
        if (filter.subscriptions.length && filter.disabled)
          filter.disabled = false;
        else
        {
          filter.disabled = false;
          FilterStorage.addFilter(filter);
        }
        chrome.extension.getBackgroundPage().refreshIconAndContextMenuForAllPages();
    });
  } else {
    if (Prefs["shouldShowBlockElementMenu"]) {
        document.getElementById("clickhide").style.display = "block";
    }
    document.getElementById("for-checkbox").innerHTML = i18n.getMessage("on_check_site");
    chrome.storage.local.get( 'white_domains', function(storage) {
        var white_domains = storage.white_domains;
        chrome.storage.local.get( 'user_filters', function(storage) {
            var user_filters= storage.user_filters;
            chrome.storage.local.get( 'user_blocked', function(storage) {
                var user_blocked= storage.user_blocked;
                if (!user_blocked) user_blocked = [];
                if (white_domains && white_domains.length > 0) {
                    if (white_domains.indexOf(host) !== -1) {
                        white_domains.splice(white_domains.indexOf(host), 1);    
                        chrome.storage.local.set({'white_domains': white_domains});
                    }
                }
                if (user_filters && user_filters.length > 0) {
                    if (user_filters.indexOf("@@" + host + "/$document") !== -1) {
                        user_filters.splice(user_filters.indexOf("@@" + host + "/$document"), 1);    
                        chrome.storage.local.set({'user_filters': user_filters});
                    }
                }
                if (user_blocked.indexOf(host) === -1) {
                    user_blocked.push(host);
                    chrome.storage.local.set({'user_blocked': user_blocked});
                }
                var filter = isPageWhitelisted(page);
                while (filter)
                {
                  FilterStorage.removeFilter(filter);
                  if (filter.subscriptions.length)
                    filter.disabled = true;
                  filter = isPageWhitelisted(page);
                }
                chrome.extension.getBackgroundPage().refreshIconAndContextMenuForAllPages();
            });
        });
    });
  }
  updatePage();
}

function activateClickHide()
{
  page.sendMessage({type: "clickhide-activate"});
  ext.closePopup();
}