'use strict';

/**
 * Copyright 2016 the HtmlGoBoard project authors.
 * All rights reserved.
 * Project  WebSDK
 * Author   Ilya Kirillov
 * Date     14.03.15
 * Time     13:05
 */


function GetEditorURL()
{
    return chrome.extension.getURL('Src/index.html');
}

chrome.browserAction.onClicked.addListener(function()
{
    chrome.tabs.create({url: GetEditorURL()});
});
