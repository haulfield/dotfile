"use strict";

/**
 * Copyright 2016 the GoUniverse project authors.
 * All rights reserved.
 * Project  GoUniverse
 * Author   Ilya Kirillov
 * Date     26.06.2016
 * Time     2:33
 */

function CKGSInformationWindow()
{
	CKGSInformationWindow.superclass.constructor.call(this);

	this.m_nDefW = 410;
	this.m_nDefH = 270;
}
CommonExtend(CKGSInformationWindow, CKGSWindowOKBase);

CKGSInformationWindow.prototype.Init = function(sDivId, oPr)
{
	if (oPr.H)
		this.m_nDefH = oPr.H;

	if (oPr.W)
		this.m_nDefW = oPr.W;

	CKGSInformationWindow.superclass.Init.call(this, sDivId, oPr, false);

	this.Set_Caption(oPr.Caption);

	var oMainDiv     = this.HtmlElement.ConfirmInnerDiv;
	var oMainControl = this.HtmlElement.ConfirmInnerControl;

	oMainDiv.style.backgroundColor = "rgb(243, 243, 243)";
	this.HtmlElement.OkCancelDiv.style.borderTop = "";
	this.HtmlElement.OkCancelDiv.style.backgroundColor = "rgb(243, 243, 243)";

	if (undefined !== oPr.Image)
	{
		var oImageElement = this.protected_CreateDivElement(oMainDiv, oMainDiv.id + "I");
		var oTextElement  = this.protected_CreateDivElement(oMainDiv, oMainDiv.id + "T");

		var oImageControl = CreateControlContainer(oMainDiv.id + "I");
		oImageControl.Bounds.SetParams(0, 0, 1000, 0, true, true, false, true, 70, -1);
		oImageControl.Anchor = (g_anchor_left | g_anchor_top | g_anchor_bottom);
		oMainControl.AddControl(oImageControl);

		oImageElement.style.display = "table";
		var oInnerImage = document.createElement("div");
		oInnerImage.className = "WarningText";
		oImageElement.appendChild(oInnerImage);

		var oSpan            = document.createElement("span");
		oSpan.className      = oPr.Image;
		oInnerImage.appendChild(oSpan);

		var oTextControl = CreateControlContainer(oMainDiv.id + "T");
		oTextControl.Bounds.SetParams(70, 0, 5, 0, true, true, true, true, -1, -1);
		oTextControl.Anchor = (g_anchor_left | g_anchor_top | g_anchor_bottom  | g_anchor_right);
		oMainControl.AddControl(oTextControl);

		oTextElement.style.display = "table";
		var oInnerText = document.createElement("div");
		oInnerText.className = "WarningText";
		oTextElement.appendChild(oInnerText);
		Common.Set_InnerTextToElement(oInnerText, oPr.Text);
	}
	else
	{
		var oTextElement  = oMainDiv;
		oTextElement.style.display = "table";
		var oInnerText = document.createElement("div");
		oInnerText.className = "WarningText";
		oTextElement.appendChild(oInnerText);
		Common.Set_InnerTextToElement(oInnerText, oPr.Text);
	}

	if (oPr && oPr.Client)
		this.m_oClient = oPr.Client;

	this.Update_Size(true);
	this.Show(oPr);
};
CKGSInformationWindow.prototype.Get_DefaultWindowSize = function()
{
	return {W : this.m_nDefW, H : this.m_nDefH};
};
CKGSInformationWindow.prototype.Close = function()
{
	CKGSInformationWindow.superclass.Close.call(this);
	RemoveWindow(this);
};

function CKGSInformationIdleWindow()
{
	CKGSInformationIdleWindow.superclass.constructor.call(this);

	this.m_nDefW = 412;
	this.m_nDefH = 220;
}
CommonExtend(CKGSInformationIdleWindow, CKGSInformationWindow);

CKGSInformationIdleWindow.prototype.Init = function(sDivId, oPr)
{
	oPr.Text    = "It has been a long time since you used this client. In 10 minutes, the server will assume that you are gone and log you out. If you want to stay logged in, then just press the \"OK\" button in this window to let the server know that you want to stay.";
	oPr.Image   = "WarningSpanWarning";
	oPr.Caption = "Warning";

	CKGSInformationIdleWindow.superclass.Init.call(this, sDivId, oPr);
};
CKGSInformationIdleWindow.prototype.Close = function()
{
	CKGSInformationIdleWindow.superclass.Close.call(this);
	this.m_oClient.WakeUp();
};