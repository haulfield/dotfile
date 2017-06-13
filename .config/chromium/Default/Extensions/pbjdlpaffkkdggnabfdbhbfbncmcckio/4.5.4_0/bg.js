'use strict';
const GET_INFO_PAGE_SIZE = 5;
const DOWNLOAD_ONE_VIDEO_CHUNK_SIZE = 5000000;
var serviceWorkerPingIntervaLId = undefined;
if (!chrome.runtime) {
    // Chrome 20-21
    chrome.runtime = chrome.extension;
} else if (!chrome.runtime.onMessage && chrome.extension) {
    // Chrome 22-25
    chrome.runtime.onMessage = chrome.extension.onMessage;
    chrome.runtime.sendMessage = chrome.extension.sendMessage;
    chrome.runtime.onMessageExternal = chrome.extension.onMessageExternal;
    chrome.runtime.onConnect = chrome.extension.onConnect;
    chrome.runtime.connect = chrome.extension.connect;
}

chrome.runtime.onMessage.removeListener(handleMessage);
chrome.runtime.onMessage.addListener(handleMessage);

chrome.runtime.onInstalled.addListener(
    function () {
        if (!localStorage.showBitrate) {
            localStorage.showBitrate = "showHover";
        }
        chrome.runtime.onMessage.removeListener(handleMessage);
        chrome.runtime.onMessage.addListener(handleMessage);
    }
);

let queueIsInProcessing = false;
let currentAlbumDownloadId = {};

let videoInProgressInfo = {videoId : {title:"", completedCount:"", totalCount:""}};

chrome.runtime.onMessageExternal.addListener(
    function (audios, sender, sendResponse) {
        if (audios.type) {
            return handleMessage(audios, sender, sendResponse);
        }

        if (!audios || !audios.length) {
            return;
        }

        addManyAudiosToOptionsPageAndStartDownload(audios);
    });


chrome.downloads.onChanged.addListener(function (delta) {
    if (!delta.state ||
        (delta.state.current != 'complete' && delta.state.current != "interrupted")) {
        return;
    }
    if (currentAlbumDownloadId.downloadId !== delta.id) {
        return;
    }
    // we just downloaded one track from queue
    queueIsInProcessing = false;
    processQueue();

});

function processQueue () {
    // there must be only one download item from album at time
    if (!queueIsInProcessing) {
        getNextAudioToDownload().then(audio => {
            if (audio) {
                queueIsInProcessing = true;
                removeAudioFromQueue(audio);
                downloadAudio(audio, true);
            }
        }).catch(audio => {
            console.log('unable to download audio ',audio, " trying to download next audio.");
            removeAudioFromQueue(audio);
            forceStartingOfNextDownload();
        });

    }
}

function downloadHlsVideo (video, sendResponse) {
    const title = video.title;
    const videoId = video.videoId;
    const quality = video.quality;
    const listId = video.playlistId;
    getVideoInfo(videoId, listId).then(answer => {
        let link;
        // if link is available
        if (quality == '-1') {
            link = getLinkToHighestAvailableVideoOrSource(answer);
        } else {
            link = answer['url' + quality];
        }

        if (link) {
            downloadVideo({url : link, title : title});
            sendResponse({status : "SIMPLE_DOWNLOAD"});
        } else {
            // try to download HLS
            if (answer.hls) {
                makeRequest("GET", answer.hls).then(function (responseText) {
                    let strings = responseText.split('\n');
                    let nextStringContainsUrl = false;
                    let urls = {};
                    for (let i = 0 ; i < strings.length ; i++) {
                        let string = strings[i];
                        if (nextStringContainsUrl) {
                            if (string.indexOf('_240p') != -1) {
                                urls.url240 = string;
                            } else if (string.indexOf('_360p') != -1) {
                                urls.url360 = string;
                            } else if (string.indexOf('_480p') != -1) {
                                urls.url420 = string;
                            } else if (string.indexOf('_720p') != -1) {
                                urls.url720 = string;
                            } else if (string.indexOf('_1080p') != -1) {
                                urls.url1080 = string;
                            } else {
                                urls.source = string;
                            }
                            nextStringContainsUrl = false;
                        } else {
                            nextStringContainsUrl = string.indexOf('#EXT-X-STREAM-INF:') != -1 && string.indexOf('BANDWIDTH') != -1;
                        }
                    }
                    let playlistUrl = getLinkToHighestAvailableVideoOrSource(urls);
                    let baseUrl = playlistUrl.substr(0, playlistUrl.lastIndexOf('/')) + '/';
                    makeRequest("GET", playlistUrl).then(function (responseText) {
                        let extInfs = responseText.split('\n');
                        let nextStringContainsExtUrl = false;
                        let videoUrls = [];
                        for (let j = 0 ; j < extInfs.length ; j++) {
                            let extInfOrUrl = extInfs[j];
                            if (nextStringContainsExtUrl) {
                                let chunkUrl = baseUrl + extInfOrUrl;
                                videoUrls.push(chunkUrl);
                                nextStringContainsExtUrl = false;
                            } else {
                                nextStringContainsExtUrl = extInfOrUrl.indexOf("#EXTINF") != -1;
                            }
                        }
                        let promises = [];
                        //videoInProgressInfo {videoId : {title:"", completedCount:"", totalCount:""}}
                        let currentVideoInfo = {title : title, completedCount : 0, totalCount : videoUrls.length};
                        videoInProgressInfo[videoId] = currentVideoInfo;
                        videoUrls = videoUrls.slice(0, 2);
                        for (let url of videoUrls) {
                            let sizePromise = makeRequest("SIZE",url);
                            promises.push(sizePromise);
                            sizePromise.then(function () {
                                currentVideoInfo.completedCount++;
                                chrome.browserAction.setBadgeText({text : Math.round(currentVideoInfo.completedCount / currentVideoInfo.totalCount * 100) + '%'});
                                if (currentVideoInfo.completedCount == currentVideoInfo.totalCount) {
                                    chrome.browserAction.setBadgeText({text:''});
                                }
                            });
                        }

                        Promise.all(promises).then(function(promises) {
                            const sum = promises.reduce(function (a, b) {
                                return parseInt(a) + parseInt(b)
                            },0);
                            const fileStream = streamSaver.createWriteStream(title + '.mp4', sum);
                            const writer = fileStream.getWriter();
                            fetchAndWriteHlsVideo(writer, videoUrls, 0);
                            delete videoInProgressInfo[videoId];
                            chrome.browserAction.setBadgeText({text:''});
                        }).catch(function(error) {
                            console.log("Unable to download HLS video with id ", videoId, " and quality ", quality, " ," +
                                " error:", error);                        }) ;
                    });

                }).catch(function (error) {
                    console.log("Unable to download HLS video with id ", videoId, " and quality ", quality, " ," +
                        " error:", error);

                });

            } else {
                console.error("Unable to download HLS video with id ", videoId, " and quality ", quality);
            }
        }
        console.log(answer);
    });
}

function getLinkToHighestAvailableVideoOrSource (answer) {
    const brs = ['1080','720', '480', '360', '240'];
    for (const br of brs) {
        if (answer['url' + br]) {
            return answer['url' + br];
        }
    }

    if (answer.source) {
        return answer.source;
    }
    return undefined;
}

function getSizeOfRangedHttpRequest (xmlhttp) {
    const contentRange = xmlhttp.getResponseHeader('Content-Range');
    //content-range:bytes 0-4609878/4609879
    const rangeArr = contentRange.split(/[ -\/]/);
    //["bytes", "0", "4609878", "4609879"]
    const lengthInBytes = parseInt(rangeArr[3]);
    return lengthInBytes;
}
function handleMessage (request, sender, sendResponse) {
    switch (request.type) {
        case "getAudioInfo":
            getLinkForOneAudio(request.fullId, request.url).then(function (url) {

                const length = request.length;
                const xmlhttp = new XMLHttpRequest();
                xmlhttp.open("GET", url, true);
                xmlhttp.setRequestHeader('Range', 'bytes=0-0');

                xmlhttp.onreadystatechange = function () {
                    if (xmlhttp.readyState === 4) {
                        const lengthInBytes = getSizeOfRangedHttpRequest(xmlhttp);
                        const bitrate = lengthInBytes * 8 / 1024 / length;
                        const temp = Math.round(bitrate / 32);

                        sendResponse({
                            bitrate : Math.min(32 * temp, 320),
                            size : (lengthInBytes / 1024.0 / 1024.0).toFixed(0) + "MB"
                        });
                    }
                };
                xmlhttp.send(null);

            });
            break;

        case "getVkdSettings":
            const vkd_settings = {};
            vkd_settings.showBitrate = localStorage.showBitrate;
            sendResponse({vkd_settings : vkd_settings});
            break;

        case "downloadAudio":
            downloadAudio(request.audio, false, request.newVk);
            return false;
        case "downloadHlsVideo":
            // title, videoId
            downloadHlsVideo(request.video, sendResponse);
            return true;

        case "downloadVideo":
            downloadVideo(request.video);
            return false;
        case "processQueue":
            processQueue();
            break;

    }
    return true;
}
function forceStartingOfNextDownload () {
    queueIsInProcessing = false;
    processQueue();
}
const restrictedSymbols = /[|\/\\+":*?<>]/g;

function downloadAudio (oneAudioInfo, saveDownloadId) {
    getLinkForOneAudio(oneAudioInfo.fullId, oneAudioInfo.url)
        .then(function (url) {
            const audioInfo = {};
            audioInfo.album = replaceRestrictedSymbols(oneAudioInfo.album);
            audioInfo.artist = replaceRestrictedSymbols(oneAudioInfo.artist);
            audioInfo.title = replaceRestrictedSymbols(oneAudioInfo.title);
            audioInfo.url = url;
            oneAudioInfo.url = url;
            let filename;
            let onlyFileName = audioInfo.artist.trim() + " - " + audioInfo.title.trim() + ".mp3";
            onlyFileName = onlyFileName.replace(/^ +/, "");

            if (!onlyFileName) {
                onlyFileName = 'Unnamed';
            }
            if (audioInfo.album) {
                if (audioInfo.album.endsWith(".")) {
                    audioInfo.album = audioInfo.album.substring(0, audioInfo.album.length - 1);
                }
                filename = sanitizePathString(localStorage.audioDownloadFolder) + '/' + sanitizePathString(audioInfo.album) + "/" + onlyFileName;
            } else {
                filename = sanitizePathString(localStorage.audioDownloadFolder) + '/' + onlyFileName;
            }
            downloadItem(
                audioInfo.url,
                filename,
                function (downloadId) {
                    if (saveDownloadId) {
                        currentAlbumDownloadId = oneAudioInfo;
                        currentAlbumDownloadId.downloadId = downloadId;
                    }
                });
        });
}

function getFullIdFromVkResponse (vkResponseElement) {
    return vkResponseElement[1] + '_' + vkResponseElement[0];
}
//["456239023", "739502", "", "Like Toy Soldier&#039;s", "Eminem ", 321, 0, 0, "", 0, 4, "", "[]"]
function parseVkResponse (text) {
    const answer = text.split('<!>');
    let navVersion = intval(answer.shift());
    let newStatic = answer.shift();
    let langId = intval(answer.shift());
    let langVer = intval(answer.shift());
    let code = intval(answer.shift());
    for (let i = answer.length - 1 ; i >= 0 ; --i) {
        let ans = answer[i];
        if (ans.substr(0, 2) == '<!') {
            const from = ans.indexOf('>');
            const type = ans.substr(2, from - 2);
            ans = ans.substr(from + 1);
            switch (type) {
                case 'json' :
                    answer[i] = JSON.parse(ans);
                    break;
                case 'int'  :
                    answer[i] = intval(ans);
                    break;
                case 'float':
                    answer[i] = floatval(ans);
                    break;
                case 'bool' :
                    answer[i] = intval(ans) ? true : false;
                    break;
                case 'null' :
                    answer[i] = null;
                    break;
                case 'pageview_candidate':
                    answer.pop(); // <!pageview> must be last one or before <!debug>
                    break;
                case 'debug':
                    answer.pop(); // <!debug> must be last one
                    break;
            }
        }
    }
    return answer;
}

function getLinkForOneAudio (audio_id, url) {
    if (url) {
        return Promise.resolve(decodeLink(url));
    }
    return new Promise(function (resolve) {

        getAudiosInfo([audio_id]).then(function (answer) {
            if (answer && answer[0] && answer[0][2]) {
                resolve(decodeLink(answer[0][2]));
            } else {
                console.log('Unable to get audio info, response is ', answer, 'audioINfo'), audio_id, url;
            }
        });
    });
}

/**
 *
 * @param audio_ids_array
 * @returns {Promise}
 */
function getAudiosInfo (audio_ids_array, startIndex, endIndex) {
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        let realStartIndex = startIndex || 0;
        let realEndIndex = endIndex || GET_INFO_PAGE_SIZE;
        const tmpArray = audio_ids_array.slice(realStartIndex, realEndIndex);
        if (tmpArray.length === 0) {
            resolve([]);
        }
        const body = 'act=reload_audio&al=1&ids=' + tmpArray.join(',');

        xhr.open("POST", 'https://vk.com/al_audio.php', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('X-Requested-With', "XMLHttpRequest");

        xhr.responseType = 'text';
        xhr.onreadystatechange = function (e) {
            if (xhr.readyState != 4) return;

            if (xhr.status != 200) {
                console.log("failed to download audio", audio_ids_array, xhr.responseText);
                reject();
            } else {
                const text = xhr.responseText;
                const answer = parseVkResponse(text);
                resolve(answer[0]);
            }
        };
        xhr.send(body);
    });
}

function getVideoInfo (videoId, listId) {
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();

        let body = 'act=show&al=1&module=im&video=' + videoId;

        if (listId) {
            body += "&list=" + listId;
        }
        xhr.open("POST", 'https://vk.com/al_video.php', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('X-Requested-With', "XMLHttpRequest");

        xhr.responseType = 'text';
        xhr.onreadystatechange = function (e) {
            if (xhr.readyState != 4) return;

            if (xhr.status != 200) {
                console.log("failed to download audio", listId, xhr.responseText);
                reject();
            } else {
                const text = xhr.responseText;
                const answer = parseVkResponse(text);
                resolve(answer[5].player.params[0]);
            }
        };
        xhr.send(body);
    });
}

function floatval (value) {
    if (value === true) return 1;
    return parseFloat(value) || 0;
}

function intval (value) {
    if (value === true) return 1;
    return parseInt(value) || 0;
}
function sanitizePathString (audioDownloadFolder) {
    audioDownloadFolder = audioDownloadFolder || '';

    audioDownloadFolder = audioDownloadFolder.replace('\\', '/');
    if (audioDownloadFolder.endsWith('/')) {
        audioDownloadFolder = audioDownloadFolder.substring(0, audioDownloadFolder.length - 1);
    }

    if (audioDownloadFolder.endsWith('.')) {
        audioDownloadFolder = audioDownloadFolder.substring(0, audioDownloadFolder.length - 1);
    }
    return replaceRestrictedSymbols(audioDownloadFolder);
}

String.prototype.replaceAt = function (index, character) {
    return this.substr(0, index) + character + this.substr(index + character.length);
};

function replaceRestrictedSymbols (str) {
    if (str && str[0] == '.') {
        str = str.replaceAt(0, '_');
    }
    str = str.replace(/quot;/g, "\"").replace(/<em>/g, '').replace(/<\/em>/g, '').replace('&amp;', '&');
    const array = str.split("");
    for (let i = 0 ; i < array.length ; i++) {
        const number = array[i].charCodeAt(0);
        if (isWhiteSpace(number) || number == 173) {
            array[i] = ' ';
        }
    }
    return array.join("").replace(restrictedSymbols, '').trim();
}

function isWhiteSpace (number) {
    return number == 9 ||
        number == 10 ||
        number == 11 ||
        number == 12 ||
        number == 13 ||
        number == 32 ||
        number == 133 ||
        number == 160 ||
        number == 5760 ||
        (number >= 8192 && number <= 8202) ||
        number == 8232 ||
        number == 8233 ||
        number == 8239 ||
        number == 8287 ||
        number == 8232 ||
        number == 12288 ||
        number == 6158 ||
        number == 8203 ||
        number == 8204 ||
        number == 8205 ||
        number == 8288 ||
        number == 65279
}


async function downloadVideo (video) {
    const videoInfo = {};
    videoInfo.url = video.url;
    videoInfo.title = replaceRestrictedSymbols(video.title);
    if (!videoInfo.title) {
        videoInfo.title = 'Unnamed';
    }
    const size = await makeRequest("SIZE", video.url) - 1;

    const fileStream = streamSaver.createWriteStream(videoInfo.title + '.mp4', size);
    const writer = fileStream.getWriter();
    fetchAndWriteFilePartially(writer, video.url, 0, Math.min(DOWNLOAD_ONE_VIDEO_CHUNK_SIZE,size), size);

    //downloadItem(url, sanitizePathString(localStorage.videoDownloadFolder) + "/" + videoInfo.title + ".mp4", function () {
    //});
}


function downloadItem (url, filename, callbackOnComplete) {
    filename = filename.replace(/^\/*/, '');
    chrome.downloads.download({
            url : url,
            filename : filename
        },
        function (downloadId) {
            // если не получилось скачать - скачиваем жестко заменяя все символы, кроме букв, скобок и цифр
            if (!downloadId) {
                chrome.downloads.download({
                        url : url,
                        filename : strictReplace(filename)
                    },
                    callbackOnComplete
                );
            } else {
                if (callbackOnComplete) {
                    callbackOnComplete(downloadId);
                }
            }
        }
    );
}

function strictReplace (fileName) {
    return fileName.replace(/[^0-9A-zА-я ()\[\]\-./]+/g, "");
}

function startServiceWorker () {
    if (serviceWorkerPingIntervaLId) {
        return;
    }

    serviceWorkerPingIntervaLId = setInterval(function () {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", '/dummyurl', true);
        xhr.send();
    }, 30000);

    let xhr = new XMLHttpRequest();
    xhr.open("GET", '/dummyurl', true);
    xhr.send();
}

function stopServiceWorker() {
    if (serviceWorkerPingIntervaLId) {
        clearInterval(serviceWorkerPingIntervaLId);
        serviceWorkerPingIntervaLId = undefined;
    }
}

function fetchAndWriteHlsVideo (writer, urls, index) {
    try {
        startServiceWorker();
        let xhr = new XMLHttpRequest();
        xhr.open("GET", urls[index], true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function (event) {
            let array = new Uint8Array(xhr.response);
            writer.write(array).then(function () {
                if (index + 1 < urls.length) {
                    fetchAndWriteHlsVideo(writer, urls, index + 1);
                } else {
                    writer.close();
                    stopServiceWorker();
                }
            });
        };
        xhr.onerror = function () {
            console.error("Unable to download chunk:", index, ", url", urls[index]);
            // retry
            if (index < urls.length) {
                fetchAndWriteHlsVideo(writer, urls, index);
            } else {
                stopServiceWorker();
            }
        };
        xhr.send();

    } catch (e) {
        console.error("Unable to download chunk:", index, ", url", urls[index]);
        // retry
        if (index < urls.length) {
            fetchAndWriteHlsVideo(writer, urls, index);
        } else {
            stopServiceWorker();
        }
    }
}
function fetchAndWriteFilePartially (writer, url, startOffset, endOffset, total) {
    try {
        startServiceWorker();
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        //xhr.setRequestHeader('Range', 'bytes=100-200');
        xhr.setRequestHeader('Range', 'bytes='+startOffset+'-'+endOffset);
        xhr.onload = function () {
            const array = new Uint8Array(xhr.response);
            const contentRange = xhr.getResponseHeader('Content-Range');
            //content-range:bytes 0-4609878/4609879
            const rangeArr = contentRange.split(/[ -\/]/);
            //["bytes", "0", "4609878", "4609879"]
            const received = parseInt(rangeArr[2]);
            writer.write(array).then(function () {
                if (received < total) {
                    fetchAndWriteFilePartially(writer, url, received + 1, getEndOffset(received, total), total);
                } else {
                    writer.close();
                    stopServiceWorker();
                }
            });
        };
        xhr.onerror = function () {
            console.error("Unable to download offset:", startOffset, ' ', endOffset, ", url", url);
            stopServiceWorker();
        };
        xhr.send();

    } catch (e) {
        console.error("Unable to download offset:", startOffset, ' ', endOffset, ", url", url);
        stopServiceWorker();
    }
}


function getEndOffset(startOffset, totalLength ) {
    if (startOffset + DOWNLOAD_ONE_VIDEO_CHUNK_SIZE > totalLength) {
        return totalLength;
    } else {
        return startOffset + DOWNLOAD_ONE_VIDEO_CHUNK_SIZE;
    }
}

/**
 * возвращает responseText, для HEAD возвращает Content-Length
 * @param method
 * @param url
 * @returns {Promise}
 */
function makeRequest (method, url) {
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open(method == 'SIZE'? 'GET' : method, url);
        if (method == 'SIZE') {
            xhr.setRequestHeader('Range', 'bytes=0-0');
        }
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                if (method == "SIZE") {
                    resolve(getSizeOfRangedHttpRequest(xhr));
                } else {
                    resolve(xhr.responseText);
                }
            } else {
                reject({
                    status : this.status,
                    statusText : xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status : this.status,
                statusText : xhr.statusText
            });
        };
        xhr.send();
    });
}

function isObject(obj) { return Object.prototype.toString.call(obj) === '[object Object]'; }

function each(object, callback) {
    if (!isObject(object) && typeof object.length !== 'undefined') {
        for (var i = 0, length = object.length; i < length; i++) {
            var value = object[i];
            if (callback.call(value, i, value) === false) break;
        }
    } else {
        for (var name in object) {
            if (!Object.prototype.hasOwnProperty.call(object, name)) continue;
            if (callback.call(object[name], name, object[name]) === false)
                break;
        }
    }

    return object;
}

var a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN0PQRSTUVWXYZO123456789+/=";
var s = {
    v : function (t) {
        return t.split("").reverse().join("")
    },
    r : function (t, i) {
        t = t.split("");
        for (var e, o = a + a, s = t.length ; s-- ;)
            e = o.indexOf(t[s]),
            ~e && (t[s] = o.substr(e - i, 1));
        return t.join("")
    },
    x : function (t, i) {
        var e = [];
        return i = i.charCodeAt(0),
            each(t.split(""), function (t, o) {
                e.push(String.fromCharCode(o.charCodeAt(0) ^ i))
            }),
            e.join("")
    }
}


function decodeLink(linkWithUnavailable) {
    if (~linkWithUnavailable.indexOf("audio_api_unavailable")) {
        var extra = linkWithUnavailable.split("?extra=")[1].split("#")
            , e = decodePart(extra[1]);
        if (extra = decodePart(extra[0]),
            !e || !extra)
            return linkWithUnavailable;
        e = e.split(String.fromCharCode(9));
        for (var a, r, l = e.length; l--; ) {
            if (r = e[l].split(String.fromCharCode(11)),
                    a = r.splice(0, 1, extra)[0],
                    !s[a])
                return linkWithUnavailable;
            extra = s[a].apply(null, r)
        }
        if (extra && "http" === extra.substr(0, 4))
            return extra
    }
    return linkWithUnavailable
}



function decodePart(part) {
    if (!part || part.length % 4 == 1)
        return !1;
    for (var i, e, o = 0, s = 0, r = ""; e = part.charAt(s++); )
        e = a.indexOf(e),
        ~e && (i = o % 4 ? 64 * i + e : e,
        o++ % 4) && (r += String.fromCharCode(255 & i >> (-2 * o & 6)));
    return r
}
