/* globals exports:false */
/* eslint no-var:0 */
// protocol enum used for both client and server

function ensurePrependedSlash(roomName) {
    if (roomName && roomName[0] !== '/') {
        return '/' + roomName;
    }
    return roomName;
}

(function (exports) {
    var reservedNames = [
        'protocol',
        'templates',
        'styles',
        'scripts',
        'libraries',
        'i',
        'images',
        'information',
        'error',
        'extensions',
        'translations',
        'robots.txt',
        'assets',
        'apple-app-site-association'
    ];

    exports.requirements = 'the room name cannot start with / or be any of these reserved words: ' + reservedNames.join(', ') + '.';

    exports.pattern = '(?!(?:' + reservedNames.join('|') + ')(?:\/.*|$))([^?#]+)';

    exports.normalize = function (rawName) {
        var rawNameWithSlash = ensurePrependedSlash(rawName);
        return (rawNameWithSlash + "").trim().toLowerCase().replace(/\/*$/, '');
    };

    /**
     * URI encodes the given roomName, preserving the leading slash.
     *
     * Only the leading slash is preserved, all others will be encoded.
     *
     * @param roomName a normalized room name
     */
    exports.uriEncoded = function (roomName) {
        return ensurePrependedSlash(encodeURIComponent(roomName.substr(1)));
    };

    //Must start with slash and cannot be preceded by namespaces that we currently use in our app.
    exports.validRoomNamePattern = new RegExp('^\\/' + exports.pattern + '$');

    exports.isLegalRoomName = function (name) {
        return exports.validRoomNamePattern.test(name);
    };
// makes the code available to the browser, as exports only works for requiring the code in Node.js
})(typeof exports === 'undefined' ? this['_RoomName'] = {} : exports);
