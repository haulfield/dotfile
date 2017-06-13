
function init()
{
  window.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("dragstart", onDragStart, false);
  window.addEventListener("dragend", onDragEnd, false);

  $("#cancelButton").click(closeDialog.bind(null, false));

}
window.addEventListener("load", init, false);

function onKeyDown(event)
{
  if (event.keyCode == 27)
  {
    event.preventDefault();
    closeDialog();
  }
}


function closeDialog(success)
{
  ext.backgroundPage.sendMessage(
    {
      type: "forward",
      payload:
      {
        type: "clickhide-cancel-close",
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
      type: "clickhide-cancel-move",
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