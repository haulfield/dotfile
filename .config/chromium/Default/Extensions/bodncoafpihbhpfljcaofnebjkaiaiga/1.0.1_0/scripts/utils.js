/* global _RoomName, decodeURIComponent */

window.createUtils = function (config) {
    var normalizeRoomName = _RoomName.normalize;

    var extractRoomName = function (url) {
        //partly extracted from javascript the good parts
        var queryAndHashRegex = /(?:\?([^#]*))?(?:#(.*))?$/;
        var removeQueryAndHash = function (url) {
            return url.replace(queryAndHashRegex, "");
        };

        if (!url) {
            return null;
        }

        var index = url.indexOf(config.host);
        if (index !== 0) {
            return null;
        }

        var roomName = normalizeRoomName(decodeURIComponent(removeQueryAndHash(url.substring(config.host.length))));
        return (!roomName) ? null : roomName;
    };

    var chatRoomNameToUrl = function (roomName) {
        return '/chat.html#' + roomName;
    };

    var extractChatRoomName = function (extensionId, url) {
        if (!url) {
            return url;
        }

        var prefix = 'chrome-extension://' + extensionId + chatRoomNameToUrl('');
        var index = url.indexOf(prefix);

        return index !== 0 ? null : url.substring(prefix.length);
    };

    var extractExtensionUrl = function (extensionId, url) {
        if (!url) {
            return url;
        }

        var prefix = 'chrome-extension://' + extensionId;
        var index = url.indexOf(prefix);

        return index !== 0 ? null : url.substring(prefix.length);
    };

    return {
        extractRoomName: extractRoomName,
        chatRoomNameToUrl: chatRoomNameToUrl,
        extractChatRoomName: extractChatRoomName,
        extractExtensionUrl: extractExtensionUrl
    };
};
