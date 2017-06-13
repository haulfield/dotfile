
if (require("info").platform == "chromium")
{
  var tabsLoading = {};

  chrome.webNavigation.onCreatedNavigationTarget.addListener(function(details)
  {
    var sourcePage = new ext.Page({id: details.sourceTabId});
    var sourceFrame = ext.getFrame(details.sourceTabId, details.sourceFrameId);

    if (!sourceFrame || isFrameWhitelisted(sourcePage, sourceFrame))
      return;

    var documentHost = extractHostFromFrame(sourceFrame);
    if (!documentHost)
      return;

    tabsLoading[details.tabId] = documentHost;
    checkPotentialPopup(details.tabId, details.url, documentHost);
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab)
  {
    if (!(tabId in tabsLoading))
    {
      return;
    }

    if ("url" in changeInfo)
      checkPotentialPopup(tabId, tab.url, tabsLoading[tabId]);

    if ("status" in changeInfo && changeInfo.status == "complete" && tab.url != "about:blank")
      delete tabsLoading[tabId];
  });
}

function checkPotentialPopup(tabId, url, documentHost)
{
  url = new URL(url || "about:blank");

  var filter = defaultMatcher.matchesAny(
    stringifyURL(url), "POPUP",
    documentHost, isThirdParty(url, documentHost)
  );

  if (filter instanceof BlockingFilter)
    chrome.tabs.remove(tabId);
}