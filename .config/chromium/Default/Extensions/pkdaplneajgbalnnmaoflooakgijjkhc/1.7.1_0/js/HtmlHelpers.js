/**
 * HTML Helpers
 */
var HTML = (function(my){

  my.generateSelect = function(options, selected, handler){
    var selectList = document.createElement("select");
    selectList.id = "lifesizeSelect";
    var placeholder = chrome.i18n.getMessage("_select_header");
    selectList.setAttribute('data-placeholder', placeholder);

    for (var i = 0; i < options.length; i++) {
        var option = document.createElement("option");
        option.value = options[i].value;
        option.text = options[i].text;
        if (option.value === selected) option.selected = true;
        selectList.appendChild(option);
    }
    selectList.onchange = handler;
    return selectList;
  };

  my.display = function(selector, show){
    var node = document.querySelector(selector);
    if (!node) return;
    if (show) node.style.display = 'block';
    else node.style.display = 'none';
  };


  my.span = function(text){
    return '<span>' + text + '</span>';
  };

  return my;

})(HTML || {});
