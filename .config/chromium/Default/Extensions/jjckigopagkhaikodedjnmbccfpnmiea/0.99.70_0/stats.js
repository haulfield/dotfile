
(function()
{
  var backgroundPage = ext.backgroundPage.getWindow();
  var require = backgroundPage.require;
  var getBlockedPerPage = require("stats").getBlockedPerPage;
  var FilterNotifier = require("filterNotifier").FilterNotifier;
  var Prefs = require("prefs").Prefs;
  
  var currentPage;
  
  var messageMark = {};
   
  function onLoad()
  {
    document.getElementById("share-box").addEventListener("click", share, false);
    var showIconNumber = document.getElementById("show-iconnumber");
    showIconNumber.setAttribute("aria-checked", Prefs.show_statsinicon);
    showIconNumber.addEventListener("click", toggleIconNumber, false);
    document.querySelector("label[for='show-iconnumber']").addEventListener("click", toggleIconNumber, false);

    ext.pages.query({active: true, lastFocusedWindow: true}, function(pages)
    {
      currentPage = pages[0];
      updateStats();

      FilterNotifier.addListener(onNotify);

      document.getElementById("stats-container").removeAttribute("hidden");
    });
  }
  
  function onUnload()
  {
    FilterNotifier.removeListener(onNotify);
  }
  
  function onNotify(action, item)
  {
    if (action == "filter.hitCount")
      updateStats();
  }
  
  function updateStats()
  {
    var statsPage = document.getElementById("stats-page");
    var blockedPage = getBlockedPerPage(currentPage).toLocaleString();
    i18n.setElementText(statsPage, "stats_label_page", [blockedPage]);
    
    var statsTotal = document.getElementById("stats-total");
    var blockedTotal = Prefs.blocked_total.toLocaleString();
    i18n.setElementText(statsTotal, "stats_label_total", [blockedTotal]);
  }
  
  function share(ev)
  {
    var blocked = Prefs.blocked_total;
    if (blocked <= 9000 || blocked >= 10000)
      blocked = blocked.toLocaleString();
    else
      blocked = i18n.getMessage("stats_over", (9000).toLocaleString());
 
  }
  
  function toggleIconNumber()
  {
    Prefs.show_statsinicon = !Prefs.show_statsinicon;
    document.getElementById("show-iconnumber").setAttribute("aria-checked", Prefs.show_statsinicon);
  }
  
  document.addEventListener("DOMContentLoaded", onLoad, false);
  window.addEventListener("unload", onUnload, false);
})();
