var url_favicon_google = "http://www.google.com/s2/favicons?domain=";

var i18n = ext.i18n;

var backgroundPage = ext.backgroundPage.getWindow();
var require = backgroundPage.require;
var prev_locale = "";
with(require("filterClasses"))
{
  this.Filter = Filter;
  this.WhitelistFilter = WhitelistFilter;
}

with(require("subscriptionClasses"))
{
  this.Subscription = Subscription;
  this.SpecialSubscription = SpecialSubscription;
  this.DownloadableSubscription = DownloadableSubscription;
}
with(require("filterValidation"))
{
  this.parseFilter = parseFilter;
  this.parseFilters = parseFilters;
}

var FilterStorage = require("filterStorage").FilterStorage;
var FilterNotifier = require("filterNotifier").FilterNotifier;
var Prefs = require("prefs").Prefs;
var Synchronizer = require("synchronizer").Synchronizer;
var Utils = require("utils").Utils;


ext.backgroundPage.sendMessage({
    type: "app.listen",
    filter: ["addSubscription", "focusSection"]
});




function onAddWhiteDomain(e) {
    e.preventDefault();
    document.querySelector(".white-container").classList.toggle("edit");
}

function addWhiteDomain(e) {
    onAddWhiteDomain(e);
    var domain = $(".add-white-text").val();
    if (domain.indexOf("http") !== 0) {
        domain = "http://" + domain;
    }
    domain = domain.replace(/\s/g, "")
    domain = chrome.extension.getBackgroundPage().extractHostFromUrl(domain);
    domain = domain.replace(/^www\./, "");
    $(".add-white-text").val("");
    if (!domain)
        return;
    chrome.storage.local.get( 'white_domains', function(storage) {
        var white_domains = [];
        if (storage.white_domains) {
            white_domains = storage.white_domains;
        }
        if (white_domains.indexOf(domain) !== -1) {
            return;
        }
        white_domains.unshift(domain);
        chrome.storage.local.set({'white_domains': white_domains});

        var filterText = "@@||" + domain + "^$document";
        FilterStorage.addFilter(Filter.fromText(filterText));

        var ul = $("<ul>", { class: "list"}).append(
          $("<li>", { class: "list-item"}).append(
              $("<div>", { class: "white-favicon"}).append(
                  $("<img>", { src: url_favicon_google + domain})
              )).append($("<div>", { class: "white-address", "text": domain})).append(
                $("<div>", { class: "del-btn"}).click(delWhiteDomain)
          )
        );
        $("#white-domains").prepend(ul);
    });
}

function delWhiteDomain(e) {
    var elem = e.currentTarget;
    var domain = $(elem).prev().text();
    $(elem).parent().remove();
    chrome.storage.local.get( 'white_domains', function(storage) {
        var white_domains = storage.white_domains;
        if (white_domains.indexOf(domain) !== -1) {
            white_domains.splice(white_domains.indexOf(domain), 1);
        }
        chrome.storage.local.set({'white_domains': white_domains});

        FilterStorage.removeFilter(Filter.fromText("@@||" + domain + "^$document"));
    });
}

function getWhiteDomains() {
    chrome.storage.local.get( 'white_domains', function(storage) {        
        if (!storage.white_domains) {
            return;
        }
        var white_domains = storage.white_domains;
        var is_whites = $("#white-domains").find("ul > li");
        if (white_domains.length === is_whites.length) {
            return;
        }
        $("#white-domains").html("");
        for (var i = 0; i < white_domains.length; i++) {
            var domain = white_domains[i];
            var ul = $("<ul>", { class: "list"}).append(
                $("<li>", { class: "list-item"}).append(
                    $("<div>", { class: "white-favicon"}).append(
                        $("<img>", { src: url_favicon_google + domain})
                    )).append($("<div>", { class: "white-address", "text": domain})).append(
                      $("<div>", { class: "del-btn"}).click(delWhiteDomain)
                    )
            );
            $("#white-domains").append(ul);
        }
    });
}

function showEditUserFilters(e) {
    e.preventDefault();
    document.querySelector(".user-filters-list-container").classList.toggle("edit");
}

function onEditUserFilters(e) {
    showEditUserFilters(e);

    var userFiltersBox = document.getElementById("user-filters-list");
    var text = "";
    for (var i = 0; i < userFiltersBox.length; i++) {
        text += userFiltersBox.options[i].value + "\n";
    }
    document.getElementById("edit-filters").value = text;
}

function getUserFilters() {
    chrome.storage.local.get( 'user_filters', function(storage) {        
        if (!storage.user_filters) {
            return;
        }
        var user_filters = storage.user_filters;
        var is_filters = $("#user-filters-list").find("option");
        if (user_filters.length === is_filters.length) {
            return;
        }
        $("#user-filters-list").html("");
        for (var i = 0; i < user_filters.length; i++) {
            var selector = user_filters[i];
            $("#user-filters-list").append($("<option>", { text: selector}));
        }
    });
}

function addUserFilter(e) {
    e.preventDefault();
    var text = $(".user-filter-text").val();
    chrome.storage.local.get( 'user_filters', function(storage) {
        var user_filters = [];
        if (storage.user_filters) {
            user_filters = storage.user_filters;
        }
        if (user_filters.indexOf(text) !== -1) {
            return;
        }
        var result = parseFilter(text);
        if (result.error) {
            alert(result.error);
            return;
        }

        if (result.filter) {        
            $(".user-filter-text").val("");
            $("#user-filters-list").prepend($("<option>", { text: text}));
                
            user_filters.unshift(text);
            chrome.storage.local.set({'user_filters': user_filters});

            FilterStorage.addFilter(result.filter);
        }
    });
}

function delUserFilters(e) {
    e.preventDefault();
    var elems = $('#user-filters-list').find(":selected");
    chrome.storage.local.get( 'user_filters', function(storage) {
        var user_filters = storage.user_filters;
        for (var i = 0; i < elems.length; i++) {
            var selector = $(elems[i]).text();
            $(elems[i]).remove();
            if (user_filters.indexOf(selector) !== -1) {
                user_filters.splice(user_filters.indexOf(selector), 1);
            }            
            FilterStorage.removeFilter(Filter.fromText(selector));
        }
        chrome.storage.local.set({'user_filters': user_filters});
    });
}

function saveListFilters(e) {
    e.preventDefault();
    var text = document.getElementById("edit-filters").value;
    var result = parseFilters(text);

    var errors = result.errors.filter(function(e) {
        return e.type != "unexpected-filter-list-header";
    });

    if (errors.length > 0) {
        alert(errors.join("\n"));
        return;
    }
    var old_options = $("#user-filters-list").find("option");
    var remove = [];
    for (var i = 0; i < old_options.length; i++) {
        remove.push($(old_options[i]).text());
        $(old_options[i]).remove();
    }
    var selectors = text.split("\n");
    var user_filters = [];
    for (var i = 0; i < selectors.length; i++) {
        var result = parseFilter(selectors[i]);
        if (result.error) {
            alert(result.error);
            return;
        }

        if (result.filter) {
            $("#user-filters-list").append($("<option>", { text: selectors[i]}));            
            user_filters.unshift(selectors[i]);

            FilterStorage.addFilter(result.filter);

            if (remove.indexOf(selectors[i]) !== -1) {
                remove.splice(remove.indexOf(selectors[i]), 1);
            }            
        }
    }
    for (var i = 0; i < remove.length; i++) {
        FilterStorage.removeFilter(Filter.fromText(remove[i]));
    }
    chrome.storage.local.set({'user_filters': user_filters});
    showEditUserFilters(e);
}

function onChangeRegion(e) {
    e.preventDefault();
    document.querySelector(".region-container").classList.toggle("edit");
}

function getRegions() {
    chrome.storage.local.get( 'regions', function(storage) {
        if (!storage.regions) {
            return;
        }
        var regions = storage.regions;
        var is_regions = $("#select-region").find("option");
        if (Object.keys(regions).length !== is_regions.length) {
            $("#select-region").html("");
            for (var i in regions) {
                var region = regions[i];
                $("#select-region").append($("<option>", { value: i, class: "select-region-item", text: region[0].specialization}));
            }
        }
        //$("#my_select :last").attr("selected", "selected");
        chrome.storage.local.get('locale', function(result) {
            chrome.storage.local.get( 'usersublist', function(storage) {
                var usersublist = storage.usersublist;
                var count = 0;
                for (var i in usersublist) {
                    if (usersublist[i] == true) {
                        count++;
                    }
                }
                var text = i18n.getMessage("undefined");
                if((result.locale !== undefined) && (result.locale !== "")) {
                    if (count > 1) {
                        text = i18n.getMessage("select_filters");
                    } else if ($("#select-region > option[value="+result.locale+"]").text()) {
                        text = $("#select-region > option[value="+result.locale+"]").text();
                        if (prev_locale !== result.locale) {
                            prev_locale = result.locale;
                            $("#select-region > option[value="+result.locale+"]").attr("selected", "selected");
                        }
                    }
                }
                $("#region-show").text(text)
            });
        });
    });
}

function saveRegion(e) {
    e.preventDefault();
    chrome.storage.local.get( 'regions', function(storage) {
        var regions = storage.regions;
        chrome.storage.local.get( 'usersublist', function(storage) {
            var userlist = storage.usersublist;
    	    var locale = $("#select-region > option:selected").val();
    	    var region = regions[locale];
    	    var text = $("#select-region > option:selected").text();
    	    chrome.storage.local.set( {'locale': locale} );
    	    $("#region-show").text(text)	    
    	    document.querySelector(".region-container").classList.toggle("edit");
            for (var i in userlist) {
                var subscription = Subscription.fromURL(i);
                FilterStorage.removeSubscription(subscription);
            }
    	    userlist = {};
            for (var i = 0; i < region.length; i++) {
                var subscription = Subscription.fromURL(region[i].url);
                subscription.disabled = false;
                subscription.title = region[i].title;
                FilterStorage.addSubscription(subscription);
                Synchronizer.execute(subscription);
            	userlist[region[i].url] = true;
            }
            chrome.storage.local.set({'usersublist': userlist});
            isUserSublist();
        });
	});
}

function onShowOptions(e) {
    if (e) e.preventDefault();
    document.querySelector(".show-hide-extended").classList.toggle("shown");
    document.querySelector(".show-hide-extended").classList.toggle("hidden");
    document.querySelector(".extended-container").classList.toggle("none");
}

function changeContext(e) {
    e.preventDefault();
    Prefs["shouldShowBlockElementMenu"] = document.querySelector("#show-context").checked;
}


function changeWhites(e) {
    e.preventDefault();
    var checked = document.querySelector(".show-cool-ads").checked;
    chrome.storage.local.set({'is_whites': checked});
    var subscription = Subscription.fromURL(Prefs.subscriptions_exceptionsurl);
    if (!subscription)
        return;
    subscription.disabled = false;
    subscription.title = "Allow non-intrusive advertising";
    if (checked) {
        FilterStorage.addSubscription(subscription);
        if (subscription instanceof DownloadableSubscription)
            Synchronizer.execute(subscription);
    } else {
        chrome.extension.getBackgroundPage()._gaq.push(['_trackEvent', "acceptable_Ads_checkbox", "uncheck"]);
        FilterStorage.removeSubscription(subscription);
    }
    chrome.extension.getBackgroundPage().addSubscription();
}

function getList() {
    chrome.storage.local.get( 'sublist', function(storage) {
        if (!storage.sublist) {
            return;
        }
        var sublist = storage.sublist;
        var is_sublist = $("#select-filter").find("option");
        if (Object.keys(sublist).length !== is_sublist.length - 1) {
            $("#select-filter").html("");
            for(var url in sublist) {
                $("#select-filter").append($("<option>", { value: url, class: "select-filter-item", text: sublist[url].title + " (" + sublist[url].specialization + ")"}));
            }
            $("#select-filter").append($("<option>", { value: "custom", class: "select-filter-item", text: i18n.getMessage("filters_addSubscriptionOther_label")}));
        }
        chrome.storage.local.get( 'usersublist', function(storage) {
            var usersublist = storage.usersublist;
            if (!usersublist) {
                usersublist = {};
            }
            chrome.storage.local.get( 'customsublist', function(storage) {
                var customsublist = storage.customsublist;
                if (!customsublist) {
                    customsublist = {};
                }
                var is_sublist = $("#filter-list").find("li");
                if ((Object.keys(usersublist).length + Object.keys(customsublist).length) !== is_sublist.length) {
                    $("#filter-list").html("");
                    for(var url in usersublist) {
                        var checked = usersublist[url] ? true : false;
                        var li = $("<li>", { class: "list-item" }).append(
                                        $("<input>", { class: "filter-checkbox", type: "checkbox", checked: checked, id: url}).on("change", onChangeFilter)
                                    ).append(
                                        $("<label>", { for: url, class: "filter-checkbox-label"}).append(
                                            $("<span>", { class: "filter-btn"}).append(
                                                $("<span>", { class: "filter-off", text: "off"})
                                            ).append(
                                                $("<span>", { class: "filter-on", text: "on"})
                                            ).append(
                                                $("<span>", { class: "filter-btn-bg"})
                                            )
                                        ).append(
                                                $("<span>", { text: sublist[url].title + " (" + sublist[url].specialization + ")"})
                                        )
                                    ).append(
                                        $("<div>", { class: "del-btn", 'data-url': url}).click(delUrlList)
                                );
                        $("#filter-list").append(li);
                    }
                    for(var url in customsublist) {
                        var checked = customsublist[url]["enable"] ? true : false;
                        var li = $("<li>", { class: "list-item" }).append(
                                        $("<input>", { class: "filter-checkbox", type: "checkbox", checked: checked, id: url}).on("change", onChangeFilter)
                                    ).append(
                                        $("<label>", { for: url, class: "filter-checkbox-label"}).append(
                                            $("<span>", { class: "filter-btn"}).append(
                                                $("<span>", { class: "filter-off", text: "off"})
                                            ).append(
                                                $("<span>", { class: "filter-on", text: "on"})
                                            ).append(
                                                $("<span>", { class: "filter-btn-bg"})
                                            )
                                        ).append(
                                                $("<span>", { text: customsublist[url]["title"]})
                                        )
                                    ).append(
                                        $("<div>", { class: "del-btn", 'data-url': url}).click(delUrlList)
                                );
                        $("#filter-list").append(li);
                    }
                }
            });
        });
    });
    chrome.storage.local.get( 'last_update', function(storage) {
        $("#last-update").text(storage.last_update);
    });
}

function onChangeList(e) {
    var _class = "";
    if (e) {
        e.preventDefault();
        _class = $(e.currentTarget).attr('class');
    }
    document.querySelector(".filter-list-form").classList.toggle("edit");
    var url = $("#select-filter > option:selected").val();
    if (_class.indexOf("select-filter-cancel") ===-1 && _class.indexOf("select-filter-submit") ===-1 && (url == "custom")) {
        $("#customSubscriptionContainer").show();
    } else {
        $("#customSubscriptionContainer").hide();
    }
}

function saveList(e) {
    e.preventDefault();
    chrome.storage.local.get( 'sublist', function(storage) {
        var sublist = storage.sublist;
        chrome.storage.local.get( 'usersublist', function(storage) {
            var usersublist = storage.usersublist;
            chrome.storage.local.get( 'customsublist', function(storage) {
                var customsublist = storage.customsublist;
                if (customsublist === undefined) {
                    customsublist = {};
                }
                var url = $("#select-filter > option:selected").val();
                var title = "";
                if ((url == "custom") && (customsublist[url] === undefined)) {
                    url = $("#customSubscriptionLocation").val().trim();
                    title = $("#customSubscriptionTitle").val().trim();
                    var subscription = Subscription.fromURL(url);
                    if (!/^https?:.*\.txt/i.test(url) || !subscription) {
                        alert(i18n.getMessage("not_parse_filter"));
                        $("#customSubscriptionLocation").focus();
                        return;
                    }
                    if (!title) title = url;

                    var custom = {};
                    custom["title"] = $("#customSubscriptionTitle").val();
                    custom["enable"] = true;
                    customsublist[$("#customSubscriptionLocation").val()] = custom;
                    chrome.storage.local.set({'customsublist': customsublist});
                    $("#customSubscriptionLocation").val("");
                    $("#customSubscriptionTitle").val("");
                } else if (usersublist[url] === undefined) {
                    usersublist[url] = true;
                    title = sublist[url].title + " (" + sublist[url].specialization + ")";
                    chrome.storage.local.set({'usersublist': usersublist}); 
                }
                if (title && url) {                    
                    var subscription = Subscription.fromURL(url);
                    subscription.disabled = false;
                    subscription.title = title;
                    FilterStorage.addSubscription(subscription);
                    if (subscription instanceof DownloadableSubscription)
                      Synchronizer.execute(subscription);
                }
                onChangeList(e);
                isUserSublist();
                chrome.extension.getBackgroundPage().addSubscription();
            });
        });
    });
}

function delUrlList(e) {
    e.preventDefault();
    var elem = e.currentTarget;
    var url = $(elem).data("url");
    $(elem).parent().remove();
    chrome.storage.local.get( 'sublist', function(storage) {
        var sublist = storage.sublist;
        chrome.storage.local.get( 'usersublist', function(storage) {
            var usersublist = storage.usersublist;
            FilterStorage.removeSubscription(Subscription.fromURL(url));
            if (usersublist && usersublist[url]) {
                delete usersublist[url];
                chrome.storage.local.set({'usersublist': usersublist});
                if (Object.keys(usersublist).length === 0) {
                    chrome.storage.local.set({'locale': ""});
                }
            }
            chrome.storage.local.get( 'customsublist', function(storage) {
                var customsublist = storage.customsublist;
                if (customsublist && customsublist[url]) {
                    delete customsublist[url];
                    chrome.storage.local.set({'customsublist': customsublist});
                }
                isUserSublist();
            });
        });
    });
}

function isUserSublist() {
    chrome.storage.local.get( 'sublist', function(storage) {
        var sublist = storage.sublist;
        chrome.storage.local.get( 'usersublist', function(storage) {
            var usersublist = storage.usersublist;
            var loc = false;
            var count = 0;
            for (var i in usersublist) {
                if (usersublist[i] == true) {
                    count++;
                    loc = sublist[i].locale.split(",");
                }
            }
            if (count == 1 && loc.length == 1) {
                chrome.storage.local.set({'locale': loc[0]});
            } else {
                chrome.storage.local.get( 'locale', function(storage) {
                    if (storage.locale == "") {
                        chrome.storage.local.set({'locale': loc[0]});
                    }
                });
            }
            loadPrefs();
        });
    });
}

function onChangeFilter(e) {
    e.preventDefault();
    var elem = e.currentTarget;
    var url = $(elem).attr("id");
    chrome.storage.local.get( 'sublist', function(storage) {
    	var sublist = storage.sublist;
    	chrome.storage.local.get( 'usersublist', function(storage) {
            var usersublist = storage.usersublist;
            chrome.storage.local.get( 'customsublist', function(storage) {
        		var customsublist = storage.customsublist;
        		var subscription = Subscription.fromURL(url);
	            subscription.disabled = false;
        		if (usersublist[url]) {
        			usersublist[url] = elem.checked;
        			subscription.title = sublist[url].title;
        		} else if(customsublist[url]) {
        			customsublist[url].enable = elem.checked;
        			subscription.title = customsublist[url].title;
        		} else {
        			return;
        		}
	            if (elem.checked) {
	                FilterStorage.addSubscription(subscription);
	                if (subscription instanceof DownloadableSubscription)
	                  Synchronizer.execute(subscription);
	            } else {
	                FilterStorage.removeSubscription(subscription);
	            }
	            chrome.storage.local.set({'usersublist': usersublist});
	            chrome.storage.local.set({'customsublist': customsublist});
	            isUserSublist();
	        });
        });
    });
}

function onChangeListFilters(e) {
    e.preventDefault();
    if($(e.currentTarget).val() == "custom") {
        $("#customSubscriptionContainer").show();
        $("#customSubscriptionTitle").focus();
    } else {
        $("#customSubscriptionContainer").hide();
    }
}

function updateFilters(e) {
    e.preventDefault();
    chrome.extension.getBackgroundPage().updateSubscriptions();
    chrome.storage.local.get( 'last_update', function(storage) {
        $("#last-update").text(storage.last_update);
    });
}

function loadPrefs() {
    getWhiteDomains();
    getUserFilters();
    getRegions();
    getList();
}

function loadOptions() {
    document.querySelector(".show-context").checked = Prefs["shouldShowBlockElementMenu"];
    chrome.storage.local.get( 'is_whites', function(result) {
        if (result.is_whites) {
            document.querySelector(".show-cool-ads").checked = true;
        }
    });
    chrome.storage.local.get('locale', function(result) {
    	document.querySelector("#rating-btn").href = document.querySelector("#rating-btn").href + result.locale;
    });
    $("#customSubscriptionContainer").hide();
    loadPrefs();
    $("#add-site").click(onAddWhiteDomain);
    $(".add-white-cancel").click(onAddWhiteDomain);
    $(".add-white-submit").click(addWhiteDomain);
    $(".user-filter-add-btn").click(addUserFilter);
    $(".remove-filter-btn").click(delUserFilters);
    $(".edit-filter-btn").click(onEditUserFilters);
    $(".cancel-filter-btn").click(showEditUserFilters);
    $(".save-filter-btn").click(saveListFilters);
    $(".region-change-btn").click(onChangeRegion);
    $(".select-region-cancel").click(onChangeRegion);
    $(".select-region-submit").click(saveRegion);
    $(".show-extended-btn").click(onShowOptions);
    $(".hide-extended-btn").click(onShowOptions);
    $(".show-context").on("change", changeContext);
    $(".show-cool-ads").on("change", changeWhites);
    $("#add-filter").click(onChangeList);
    $(".select-filter-cancel").click(onChangeList);
    $(".select-filter-submit").click(saveList);
    $(".select-filter").change(onChangeListFilters);
    $(".refresh-filters-btn").click(updateFilters);

    setInterval(loadPrefs, 2000);

    ext.onMessage.addListener(function(message)
    {
        switch (message.type)
        {
            case "app.respond":
                switch (message.action)
                {
                    case "addSubscription":
                        var subscr = message.args[0];
                        if (confirm(i18n.getMessage("add_subscription_confirm") + " " + subscr.title)) {
                            chrome.storage.local.get('customsublist', function(storage) {
                                var customsublist = storage.customsublist;
                                if (!customsublist) {
                                    customsublist = {};
                                }
                                var subscription = Subscription.fromURL(subscr.url);
                                subscription.disabled = false;
                                subscription.title = subscr.title;
                                FilterStorage.addSubscription(subscription);
                                Synchronizer.execute(subscription);

                                var custom = {};
                                custom["title"] = subscription.title;
                                custom["enable"] = true;
                                customsublist[subscription.url] = custom;
                                chrome.storage.local.set({'customsublist': customsublist});
                                isUserSublist();
                                onShowOptions();
                                //startSubscriptionSelection(subscription.title, subscription.url);
                            });
                        } else {
                            window.close();
                        }
                        break;
                }
        }
    });
}

function startSubscriptionSelection(title, url)
{
  var list = document.getElementById("select-filter");
  if (list.length == 0)
  {
    return;
  }
  onShowOptions();
  $("#select-filter > option[value=custom]").attr("selected", "selected");
  onChangeList();
  if (typeof url != "undefined")
  {
    list.selectedIndex = list.length - 1;
    document.getElementById("customSubscriptionTitle").value = title;
    document.getElementById("customSubscriptionLocation").value = url;
  }
  document.getElementById("select-filter").scrollIntoView(true);
}

$(loadOptions);