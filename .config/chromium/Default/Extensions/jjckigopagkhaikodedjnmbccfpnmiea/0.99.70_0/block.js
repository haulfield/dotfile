
function init()
{

  window.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("dragstart", onDragStart, false);
  window.addEventListener("dragend", onDragEnd, false);

  $("#addButton").click(addFilters);
  $("#cancelButton").click(closeDialog.bind(null, false));

  $("button").button();

  ext.backgroundPage.sendMessage(
  {
    type: "forward",
    expectsResponse: true,
    payload:
    {
      type: "clickhide-init",
      width: Math.max(document.body.offsetWidth || document.body.scrollWidth),
      height: Math.max(document.body.offsetHeight || document.body.scrollHeight)
    }
  },
  function(response)
  {
    document.getElementById("filters").value = response.filters.join("\n");
  });

  document.getElementById("filters").focus();
}
window.addEventListener("load", init, false);

function onKeyDown(event)
{
  if (event.keyCode == 27)
  {
    event.preventDefault();
    closeDialog();
  }
  else if (event.keyCode == 13 && !event.shiftKey && !event.ctrlKey)
  {
    event.preventDefault();
    addFilters();
  }
}

function addFilters()
{
  ext.backgroundPage.sendMessage(
    {
      type: "add-filters",
      text: document.getElementById("filters").value
    },

    function(response)
    {
      if (response.status == "ok")
        closeDialog(true);
      else
        alert(response.error);
    }
  );
}

function closeDialog(success)
{
  ext.backgroundPage.sendMessage(
    {
      type: "forward",
      payload:
      {
        type: "clickhide-close",
        remove: (typeof success == "boolean" ? success : false)
      }
    }
  );
}

var dragStartX;
var dragStartY;
var dragEndX = null;
var dragEndY = null;

function onDragStart(event)
{
  var element = document.elementFromPoint(event.clientX, event.clientY);
  if (element && element.localName == "textarea")
  {

    event.preventDefault();
  }
  else
  {
    dragStartX = event.screenX;
    dragStartY = event.screenY;
  }
}

function onDragEnd(event)
{
  if (dragEndX == null)
    dragEndX = event.screenX;
  if (dragEndY == null)
    dragEndY = event.screenY;

  ext.backgroundPage.sendMessage({
    type: "forward",
    payload:
    {
      type: "clickhide-move",
      x: dragEndX - dragStartX,
      y: dragEndY - dragStartY
    }
  });

  dragStartX = null;
  dragStartY = null;
  dragEndX = null;
  dragEndY = null;
}

if (navigator.userAgent.indexOf(" Version/") != -1)
{
  window.addEventListener("drag", function(event)
  {
    dragEndX = event.screenX;
    dragEndY = event.screenY;
  }, false);
}
