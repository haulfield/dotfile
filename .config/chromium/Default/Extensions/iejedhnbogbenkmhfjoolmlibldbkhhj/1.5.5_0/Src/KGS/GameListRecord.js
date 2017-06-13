"use strict";

/**
 * Copyright 2016 the GoUniverse project authors.
 * All rights reserved.
 * Project  GoUniverse
 * Author   Ilya Kirillov
 * Date     06.07.2016
 * Time     1:05
 */

function CKGSGameListRecord(oClient)
{
	this.m_oClient = oClient;
	this.m_oRooms  = {};

	this.m_nGameId     = -1;
	this.m_nRoomId     = -1;
	this.m_nGameType   = EKGSGameType.Ranked;
	this.m_nMoveNumber = 0;
	this.m_nObservers  = 0;
	this.m_sScore      = null;
	this.m_oBlack      = null;
	this.m_oWhite      = null;
	this.m_oOwner      = null;
	this.m_oBlack2     = null;
	this.m_oWhite2     = null;
	this.m_nHandicap   = 0;
	this.m_nBoardSize  = 19;
	this.m_bAdjourned  = false;
	this.m_bEvent      = false;
	this.m_bPrivate    = false;

	this.m_oChallengeCreator = null;
	this.m_oProposal         = null;
	this.m_sComment          = "";

	this.m_oLoadingGameTree  = null;
}
CKGSGameListRecord.prototype.Update = function(oGameRecord)
{
	this.private_ParseGameType(oGameRecord.gameType);

	this.m_nGameId  = oGameRecord.channelId;
	this.m_nRoomId  = oGameRecord.roomId;
	this.m_bPrivate = true === oGameRecord.private ? true : false;

	if (EKGSGameType.Challenge === this.m_nGameType)
		return this.private_ParseChallenge(oGameRecord);

	this.m_nMoveNumber = oGameRecord.moveNum;
	this.m_nObservers  = undefined !== oGameRecord.observers ? oGameRecord.observers : 0;
	this.m_sScore      = undefined !== oGameRecord.score ? this.m_oClient.private_ParseScore(oGameRecord.score) : null;

	if (oGameRecord.players.black)
		this.m_oBlack = GetKGSUser(oGameRecord.players.black);

	if (oGameRecord.players.white)
		this.m_oWhite = GetKGSUser(oGameRecord.players.white);

	if (oGameRecord.players.owner)
		this.m_oOwner = GetKGSUser(oGameRecord.players.owner);

	if (oGameRecord.players.black_2)
		this.m_oBlack2 = GetKGSUser(oGameRecord.players.black_2);

	if (oGameRecord.players.white_2)
		this.m_oWhite2 = GetKGSUser(oGameRecord.players.white_2);

	this.m_nHandicap  = oGameRecord.handicap ? parseInt(oGameRecord.handicap) : 0;
	this.m_nBoardSize = oGameRecord.size ? oGameRecord.size : 19;

	this.m_bAdjourned  = oGameRecord.adjourned ? oGameRecord.adjourned : false;
	this.m_bEvent      = oGameRecord.event ? oGameRecord.event : false;
};
CKGSGameListRecord.prototype.AddRoom = function(nRoomId)
{
	this.m_oRooms[nRoomId] = nRoomId;
};
CKGSGameListRecord.prototype.RemoveRoom = function(nRoomId)
{
	delete this.m_oRooms[nRoomId];

	for (var nId in this.m_oRooms)
	{
		return false;
	}

	return true;
};
CKGSGameListRecord.prototype.GetBlack = function()
{
	return this.m_oBlack;
};
CKGSGameListRecord.prototype.GetWhite = function()
{
	return this.m_oWhite;
};
CKGSGameListRecord.prototype.GetOwner = function ()
{
	return this.m_oOwner;
};
CKGSGameListRecord.prototype.GetBlack2 = function()
{
	return this.m_oBlack2;
};
CKGSGameListRecord.prototype.GetWhite2 = function()
{
	return this.m_oWhite2;
};
CKGSGameListRecord.prototype.GetObservers = function()
{
	return this.m_nObservers;
};
CKGSGameListRecord.prototype.GetGameType = function()
{
	return this.m_nGameType;
};
CKGSGameListRecord.prototype.private_ParseGameType = function(sGameType)
{
	this.m_nGameType = KGSCommon.GetGameType(sGameType);
};
CKGSGameListRecord.prototype.GetGameId = function()
{
	return this.m_nGameId;
};
CKGSGameListRecord.prototype.GetMoveNum = function()
{
	return this.m_nMoveNumber;
};
CKGSGameListRecord.prototype.GetScore = function()
{
	return this.m_sScore;
};
CKGSGameListRecord.prototype.IsPrivate = function()
{
	return this.m_bPrivate;
};
CKGSGameListRecord.prototype.IsAdjourned = function()
{
	return this.m_bAdjourned;
};
CKGSGameListRecord.prototype.IsEvent = function()
{
	return this.m_bEvent;
};
CKGSGameListRecord.prototype.GetRoomId = function()
{
	return this.m_nRoomId;
};
CKGSGameListRecord.prototype.GetBoardSize = function()
{
	return this.m_nBoardSize;
};
CKGSGameListRecord.prototype.GetHandicap = function()
{
	return this.m_nHandicap;
};
CKGSGameListRecord.prototype.private_ParseChallenge = function(oGameRecord)
{
	if (oGameRecord.players.challengeCreator)
		this.m_oChallengeCreator = GetKGSUser(oGameRecord.players.challengeCreator);

	this.m_oProposal = new CKGSChallengeProposal(oGameRecord.initialProposal);
	this.m_sComment  = oGameRecord.name ? oGameRecord.name : "";
};
CKGSGameListRecord.prototype.GetProposal = function()
{
	return this.m_oProposal;
};
CKGSGameListRecord.prototype.GetChallengeCreator = function()
{
	return this.m_oChallengeCreator;
};
CKGSGameListRecord.prototype.GetComment = function()
{
	return this.m_sComment;
};
CKGSGameListRecord.prototype.IsChallenge = function()
{
	return (this.m_nGameType === EKGSGameType.Challenge ? true : false);
};
CKGSGameListRecord.prototype.IsRobotChallenge = function()
{
	var isChallenge = this.IsChallenge();
	if (!isChallenge)
		return false;

	var oCreator = this.m_oChallengeCreator;
	if (!oCreator || true !== oCreator.IsRobot())
		return false;

	return true;
};
CKGSGameListRecord.prototype.IsProposalPrivate = function()
{
	return this.m_oProposal.IsPrivate();
};
CKGSGameListRecord.prototype.GetGameTitle = function()
{
	if (this.m_nGameType === EKGSGameType.Challenge)
	{
		if (this.m_oChallengeCreator)
			return "Challenge " + this.m_oChallengeCreator.GetName() + "[" + this.m_oChallengeCreator.GetStringRank() + "]";
		else
			return "Challenge";
	}
	else if (this.m_nGameType === EKGSGameType.Demonstration)
	{
		if (this.m_oOwner)
			return "Demonstration " + this.m_oOwner.GetName() + "[" + this.m_oOwner.GetStringRank() + "]";
		else
			return "Demonstration";
	}
	else
	{
		if (this.m_oBlack && this.m_oWhite && this.m_oBlack2 && this.m_oWhite2)
			return "Match " + this.m_oWhite.GetName() + "[" + this.m_oWhite.GetStringRank() + "], " + this.m_oWhite2.GetName() + "[" + this.m_oWhite2.GetStringRank() + "] vs. " + this.m_oBlack.GetName() + "[" + this.m_oBlack.GetStringRank() + "], " + this.m_oBlack2.GetName() + "[" + this.m_oBlack2.GetStringRank() + "]";
		else if (this.m_oBlack && this.m_oWhite)
			return "Match " + this.m_oWhite.GetName() + "[" + this.m_oWhite.GetStringRank() + "] vs. " + this.m_oBlack.GetName() + "[" + this.m_oBlack.GetStringRank() + "]";
		else
			return "Match";
	}
};
CKGSGameListRecord.prototype.GetLoadingGameTree = function()
{
	return this.m_oLoadingGameTree;
};
CKGSGameListRecord.prototype.SetLoadingGameTree = function(oGameTree)
{
	this.m_oLoadingGameTree = oGameTree;
};

function CKGSChallengeProposal(oGameRecord)
{
	this.m_nGameType  = EKGSGameType.Free;
	this.m_nRules     = EKGSGameRules.Japanese;
	this.m_sKomi      = "6.5";
	this.m_nHandicap  = 0;
	this.m_nSize      = 19;
	this.m_oTime      = new CTimeSettings();
	this.m_bNigiri    = true === oGameRecord.nigiri ? true : false;
	this.m_arrPlayers = [];
	this.m_oWhite     = null;
	this.m_oBlack     = null;
	this.m_bPrivate   = true === oGameRecord.private ? true : false;

	this.private_ParseGameType(oGameRecord.gameType);
	this.private_ParseRules(oGameRecord.rules);
	this.private_ParsePlayers(oGameRecord.players);
}
CKGSChallengeProposal.prototype.private_ParseGameType = function(sGameType)
{
	this.m_nGameType = KGSCommon.GetGameType(sGameType);
};
CKGSChallengeProposal.prototype.GetGameType = function()
{
	return this.m_nGameType;
};
CKGSChallengeProposal.prototype.GetRules = function()
{
	return this.m_nRules;
};
CKGSChallengeProposal.prototype.GetKomi = function()
{
	return this.m_sKomi;
};
CKGSChallengeProposal.prototype.GetHandicap = function()
{
	return this.m_nHandicap;
};
CKGSChallengeProposal.prototype.GetBoardSize = function()
{
	return this.m_nSize;
};
CKGSChallengeProposal.prototype.IsNigiri = function()
{
	return this.m_bNigiri;
};
CKGSChallengeProposal.prototype.private_ParseRules = function(oRules)
{
	this.m_nRules    = KGSCommon.GetGameRules(oRules.rules);
	this.m_sKomi     = "" + oRules.komi;
	this.m_nSize     = oRules.size ? oRules.size : 19;
	this.m_nHandicap = oRules.handicap ? oRules.handicap : 0;

	var sTimeType = oRules.timeSystem;
	if ("absolute" === sTimeType)
		this.m_oTime.SetAbsolute(oRules.mainTime);
	else if ("byo_yomi" === sTimeType)
		this.m_oTime.SetByoYomi(oRules.mainTime, oRules.byoYomiTime, oRules.byoYomiPeriods);
	else if ("canadian" === sTimeType)
		this.m_oTime.SetCanadian(oRules.mainTime, oRules.byoYomiTime, oRules.byoYomiStones);
};
CKGSChallengeProposal.prototype.private_ParsePlayers = function(arrPlayers)
{
	if (!arrPlayers || !arrPlayers.length)
		return;

	for (var nIndex = 0, nCount = arrPlayers.length; nIndex < nCount; ++nIndex)
	{
		var oRecord = arrPlayers[nIndex];
		if ("white" === oRecord["role"] && oRecord["user"])
		{
			this.m_oWhite = GetKGSUser(oRecord["user"]);
		}
		else if ("black" === oRecord["role"] && oRecord["user"])
		{
			this.m_oBlack = GetKGSUser(oRecord["user"]);
		}
	}
};
CKGSChallengeProposal.prototype.GetTimeSettingsString = function()
{
	return this.m_oTime.GetTimeSystemString();
};
CKGSChallengeProposal.prototype.GetTimeSettings = function()
{
	return this.m_oTime;
};
CKGSChallengeProposal.prototype.GetBlack = function()
{
	return this.m_oBlack;
};
CKGSChallengeProposal.prototype.IsPrivate = function()
{
	return this.m_bPrivate;
};