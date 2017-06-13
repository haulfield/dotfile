"use strict";

/**
 * Copyright 2016 the GoUniverse project authors.
 * All rights reserved.
 * Project  GoUniverse
 * Author   Ilya Kirillov
 * Date     21.12.2016
 * Time     23:52
 */

var EKGSUsersListRecord = {
	Name  : 1,
	Notes : 2
};

function CKGSUsersList(oApp)
{
	CKGSUsersList.superclass.constructor.call(this);

	this.m_oHeaders = {
		Sizes : [0, 130],
		Count : 2,
		1     : "Name",
		2     : "Notes"
	};

	this.m_nSortType = EKGSUsersListRecord.Name;
	this.m_oApp      = oApp;

	this.m_fOnSelect   = null;
	this.m_fOnUnselect = null;
}

CommonExtend(CKGSUsersList, CListBase);

CKGSUsersList.prototype.private_Sort = function (oRecord1, oRecord2)
{
	var SortType = this.m_nSortType;
	if (EKGSUsersListRecord.Name === SortType)
	{
		if (Common.Compare_Strings(oRecord1.m_sName, oRecord2.m_sName) < 0)
			return -1;
		else if (Common.Compare_Strings(oRecord1.m_sName, oRecord2.m_sName) > 0)
			return 1;
	}
	else if (-EKGSUsersListRecord.Name === SortType)
	{
		if (Common.Compare_Strings(oRecord1.m_sName, oRecord2.m_sName) < 0)
			return 1;
		else if (Common.Compare_Strings(oRecord1.m_sName, oRecord2.m_sName) > 0)
			return -1;
	}

	return 0;
};
CKGSUsersList.prototype.Is_Sortable = function(nColNum)
{
	if (0 === nColNum)
		return true;

	return false;
};
CKGSUsersList.prototype.Get_Record = function(aLine)
{
	var oRecord = new CKGSUsersListRecord(this.m_oApp.GetClient());
	oRecord.Update(aLine);
	return oRecord;
};
CKGSUsersList.prototype.Handle_DoubleClick = function(Record)
{
};
CKGSUsersList.prototype.Handle_RightClick = function(oRecord, e)
{
	if (this.m_oApp && oRecord)
		return this.m_oApp.ShowUserContextMenu(e.pageX - 2, e.pageY + 2, oRecord.m_sName);

	return null;
};
CKGSUsersList.prototype.Handle_Select = function(oRecord)
{
	if (this.m_fOnSelect)
		this.m_fOnSelect(oRecord.m_sName, oRecord.m_sNotes);
};
CKGSUsersList.prototype.Handle_Unselect = function()
{
	if (this.m_fOnUnselect)
		this.m_fOnUnselect();
};
CKGSUsersList.prototype.SetSelectCallback = function(fCallBack)
{
	this.m_fOnSelect = fCallBack;
};
CKGSUsersList.prototype.SetUnselectCallback = function(fCallback)
{
	this.m_fOnUnselect = fCallback;
};

function CKGSUsersListRecord(oClient)
{
	CKGSUsersListRecord.superclass.constructor.call(this);

	this.m_oClient = oClient;
	this.m_sName   = "";
	this.m_oUser   = null;
	this.m_sNotes  = "";
}

CommonExtend(CKGSUsersListRecord, CListRecordBase);

CKGSUsersListRecord.prototype.Draw = function(oContext, dX, dY, eType)
{
	var sString = "";
	switch(eType)
	{
		case EKGSUsersListRecord.Name : sString += this.m_sName + "[" + this.m_sRank + "]"; break;
		case EKGSUsersListRecord.Notes : sString += this.m_sNotes;
	}

	oContext.fillText(sString, dX, dY);
};
CKGSUsersListRecord.prototype.Get_Key = function()
{
	return this.m_sName.toLowerCase();
};
CKGSUsersListRecord.prototype.Update = function(aLine)
{
	var oUserExt  = aLine[1];
	this.m_oUser  = oUserExt.User;
	this.m_sName  = this.m_oUser.GetName();
	this.m_sRank  = this.m_oUser.GetStringRank();
	this.m_sNotes = oUserExt.Notes;
};
CKGSUsersListRecord.prototype.Compare = function(sName)
{
	if (this.m_sName === sName)
		return true;

	return false;
};