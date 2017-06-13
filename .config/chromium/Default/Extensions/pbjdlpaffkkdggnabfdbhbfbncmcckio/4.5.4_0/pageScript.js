(function () {
    "use strict";
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

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

    function updateAlbumListNew (nodesCollection) {
        const elementToQuery = nodesCollection.parentNode || nodesCollection;
        const albums = elementToQuery.querySelectorAll('.audio_page_block__playlists_items .audio_pl__cover');
        for (let i = 0 ; i < albums.length ; i++) {
            updateOneAlbumNew(albums[i]);
        }

        const allAudios = document.querySelector('.audio_page__audio_rows');
        if (allAudios) {
            const anyAudio = allAudios.querySelector('.audio_row');
            if (anyAudio) {
                const anyAudioId = anyAudio.dataset.fullId;
                if (anyAudioId) {
                    updateDownloadAllAudiosFromMainPlaylist(anyAudioId.split('_')[0], allAudios);
                }
            }
        }
    }


    function checkHtml5Video (nodeWithEmbed) {
        return nodeWithEmbed.tagName != 'EMBED' && !nodeWithEmbed.querySelector('embed');
    }

    function generateDownloadALbumButton (albumId, text, clazz) {
        var downloadAllLink = document.createElement('div');
        downloadAllLink.className = clazz || "downloadAllNew";
        downloadAllLink.addEventListener("click", downloadAlbum(albumId));
        downloadAllLink.addEventListener("mouseover", function () {
            showTooltip(this, {text : text, black : 1, shift : [7, 2, 0]})
        });
        return downloadAllLink;
    }

    function updateDownloadAllAudiosFromMainPlaylist(ownerId, allAudiosElement) {
        //already updated
        if (allAudiosElement.querySelector('.downloadAllNew')) {
            return;
        }

        const downloadAllLink = generateDownloadALbumButton(ownerId+"_-1", 'Скачать все аудиозаписи','downloadAllButtonMain');
        const header = allAudiosElement.querySelector('h2');
        if (header) {
            header.appendChild(downloadAllLink);
        }

    }

    function updateOneAlbumNew (album, skipNormalizationOfA) {
        if (!skipNormalizationOfA && album.tagName !== 'A') {
            album = album.querySelector('a');
        }

        //already updated
        if (album.querySelector('.downloadAllNew')) {
            return;
        }
        var downloadAllLink = generateDownloadALbumButton(album.parentNode.dataset['rawId'], 'Скачать весь альбом');
        let elementToInserDownloadLink = album.querySelector('.audio_pl__cover_stats');
        if (!elementToInserDownloadLink) {
            //это кнопка со всеми аудиозаписями
            elementToInserDownloadLink = album;
        }
        if (elementToInserDownloadLink) {
            elementToInserDownloadLink.appendChild(downloadAllLink);
        } else {
            console.log("Unable to create link to download album", album);
        }


    }


    updateAlbumListNew(document);


    var body = document.querySelector('body');
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'childList') {
                for (let i = 0 ; i < mutation.addedNodes.length ; i++) {
                    // if audio
                    const audioClassName = "audio_row";
                    if (hasClass(mutation.addedNodes[i], audioClassName)) {
                        updateOneAudio(mutation.addedNodes[i]);
                    } else {
                        updateLinks(mutation.addedNodes[i]);
                    }


                    if (mutation.addedNodes[i].nodeType != 1 && mutation.addedNodes[i].nodeType != 9) {
                        continue;
                    }

                    if (mutation.addedNodes[i].querySelectorAll(".audio_pl_item").length > 0) {
                        updateAlbumListNew(mutation.addedNodes[i]);
                    }

                    if (mutation.addedNodes[i].id == "video_player" || hasClass(mutation.addedNodes[i], 'videoplayer') || hasClass(mutation.addedNodes[i], 'video_box_wrap')) {
                        updateVideoFrame(mutation.addedNodes[i]);
                    }
                }
            }

            var body = document.querySelector('body');
            observer.observe(body, {
                childList : true,
                subtree : true
            });
        });
    });
    observer.observe(body, {
        childList : true,
        subtree : true
    });


    function getAlbumInfo (full_album_id) {
        if (!isNewVk()) {

            var album = {};
            album.album_id = full_album_id;
            album.list = [];

            if (full_album_id == 0 || full_album_id == "all") {
                album.album_id = "all";
            }

            var list = full_album_id == 0 || full_album_id == "all" ? cur.audiosList[full_album_id] : cur.audiosList["album" + full_album_id];
            for (var audio of list) {
                let normalizedAudio = {};
                normalizedAudio.artist = audio[5];
                normalizedAudio.title = audio[6];
                normalizedAudio.url = audio[2];
                normalizedAudio.fullId = audio[0] + '_' + audio[1];
                album.list.push(normalizedAudio);
            }

            var albumName = "Audio";
            if (cur.albums[full_album_id]) {
                albumName = cur.albums[full_album_id].title;
            }
            album.title = albumName;
            return Promise.resolve(album);
        } else {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();

                const user_id = full_album_id.split('_')[0];
                const album_id = full_album_id.split('_')[1];

                var body = 'access_hash=&type=playlist&offset=0&act=load_section&al=1&owner_id=' + user_id + '&playlist_id=' + album_id;

                if (album_id === '-1') {
                    body += "&al=1&is_loading_all=1&claim=0"
                }

                xhr.open("POST", 'https://vk.com/al_audio.php', true);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.setRequestHeader('X-Requested-With', "XMLHttpRequest");

                xhr.onreadystatechange = function (e) {
                    if (xhr.readyState !== 4) return;

                    if (xhr.status !== 200) {
                        console.log("failed to download album", album_id, xhr.responseText);
                        reject();
                    } else {
                        const data = xhr.responseText;
                        if (data.indexOf("<!json>") !== -1) {
                            var info = parseVkResponse(data);
                            if (!info || !info[0]) {
                                return;
                            }
                            info = info[0];

                            const ret = {};
                            ret.album_id = full_album_id;
                            ret.title = info.title;
                            ret.list = [];
                            for (let audio of info.list) {
                                const normalizedAudio = {};
                                normalizedAudio.artist = audio[4];
                                normalizedAudio.title = audio[3];
                                normalizedAudio.fullId = audio[1] + '_' + audio[0];
                                ret.list.push(normalizedAudio);
                            }
                            console.log(ret);
                            resolve(ret);
                        } else {
                            console.log('Unable to get audio info, response is ', xhr.responseText, 'audioINfo'), audio_id, url;
                        }
                    }
                };

                xhr.send(body);
            });
        }

    }


    function downloadAlbum (album_id) {
        return function (e) {
            e.preventDefault();
            e.stopPropagation();
            getAlbumInfo(album_id).then(function (album) {
                var downloadAlbumDiv = document.createElement("div");
                downloadAlbumDiv.dataset.album = album.title;
                downloadAlbumDiv.id = "downloadAlbumWindow";

                var downloadButton = document.createElement("div");
                downloadButton.style.height = "26px";
                downloadButton.innerHTML = '<div class="button_blue fl_l"><button onclick="downloadChecked()">Скачать выделенные</button></div>';

                var selectAllCheckbox = document.createElement("input");
                selectAllCheckbox.type = "checkbox";
                selectAllCheckbox.id = 'check-all-audio-to-download';
                selectAllCheckbox.setAttribute('checked', 'checked');
                selectAllCheckbox.setAttribute('onclick', "selectAll(this)");
                downloadButton.appendChild(selectAllCheckbox);

                const lab = document.createElement('label');
                lab.setAttribute('for','check-all-audio-to-download');
                lab.innerHTML = 'Выделить все';
                downloadButton.appendChild(lab);

                downloadAlbumDiv.appendChild(downloadButton);

                downloadAlbumDiv.innerHTML += '<br/>';


                for (var audio of album.list) {
                    var element = document.createElement('div');
                    const currentUrl = audio.url ? ' data-url="' + audio.url + '"' : '';
                    element.innerHTML = '<input id="vkd_' + audio.fullId + '"' + currentUrl + ' data-artist="' + audio.artist + '" data-title="' + audio.title + '"' +
                        ' data-full-id="' + audio.fullId + '"' +
                        ' class="downloadAlbumCheckbox" type="checkbox" checked="checked" value="vkd_' + audio.fullId + '"/><label' +
                        ' for="' + "vkd_" + audio.fullId + '">' + audio.artist + ' - ' + audio.title + '</label>';
                    downloadAlbumDiv.appendChild(element);
                }
                var box = new MessageBox({dark : 1});
                box.setOptions({title : "Скачать альбом " + album.title, hideButtons : true});
                show(boxLayerBG);
                box.content(downloadAlbumDiv.outerHTML);
                box.show();
            });
        }
    }

    function hideDownloadAllWindow () {
        var albumWindow = document.querySelector("#downloadAlbumWindow");
        if (albumWindow)
            albumWindow.parentNode.removeChild(albumWindow);
    }

    // TODO move
    updateLinks(document);
    updateVideoFrame(document.querySelector("#video_player"));
    updateVideoFrame(document.querySelector(".video_player"));

    function isNewVk () {
        return true;
    }

    function updateLinks (collection) {
        if (collection.nodeType == 1 || collection.nodeType == 9) {
            var audioSelector = isNewVk() ? '.audio_row' : ".audio";
            var audios = collection.querySelectorAll(audioSelector);
            for (var i = 0 ; i < audios.length ; i++) {
                updateOneAudio(audios[i]);
            }
        }
    }


    function updateOneAudio (audio) {
        'use strict';
        let link = getMP3Link(audio);
        if (vkd_settings["showBitrate"] == "showHover") {
            audio.addEventListener("mouseover", calculateBitrate, false);
        }

        if (vkd_settings["showBitrate"] == "showAll") {
            calculateBitrate(audio);
        }
        var audioActs = audio.querySelector('.audio_acts');
        if (audioActs.querySelector('.downloadButton')) {
            return;
        }
        var info = getAudioInfo(audio);
        var artist = info.artist;
        var title = info.title;

        const stringTitle = artist + " - " + title + ".mp3";

        let downloadButton = document.createElement("div");
        downloadButton.className = "downloadButton audio_act";

        downloadButton.setAttribute("style", "display:block");
        const htmlLink = document.createElement("a");
        htmlLink.className = "downloadButton";
        htmlLink.setAttribute("download", stringTitle);
        const imageUrl = extensionsURL + "icon_album.png";
        htmlLink.setAttribute("style", "cursor: pointer;    display: block;" +
            "width: 24px;height: 24px;background: url(" + imageUrl + ") center no-repeat;display:block;");
        htmlLink.setAttribute("href", link);

        htmlLink.onmouseover = function () {
            showTooltip(this, {
                text : 'Скачать',
                black : 1,
                shift : [8, 5, 0],
                needLeft : 1,
                appendParentCls : '_ui_rmenu_sublist'
            });
        };
        /*  htmlLink.addEventListener("dragstart", function (evt) {
         evt.dataTransfer.setData("DownloadURL", "audio/mpeg:" + stringTitle + ":" + link);
         }, false);*/
        downloadButton.appendChild(
            htmlLink);
        // TODO объединить с getAudioInfo
        const
            audiosToDownload = {
                artist : artist,
                title : title,
                url : link,
                album : "",
                fullId : audio.dataset.fullId
            };
        htmlLink.addEventListener('click', function () {
            chrome.runtime.sendMessage(vkdId, {
                type : 'downloadAudio',
                audio : audiosToDownload,
                newVk : isNewVk()
            });
        });
        htmlLink.addEventListener('click',
            trackDownloadClick);
        audioActs.insertBefore(downloadButton, audioActs.firstChild);
    }

    function text (response) {
        return response.text()
    }

    function getMP3Link (audio) {
        if (isNewVk()) {
            return null;
        }
        if (audio.id) {
            return audio.querySelector("#" + audio.id.replace("audio", "audio_info")).value.split(",")[0];
        }
    }

    function getAudioInfo (audio) {
        if (audio.id) {
            if (!isNewVk()) {
                var audio_inf = audio.querySelector("#" + audio.id.replace("audio", "audio_info"));
                return {
                    type : "getAudioInfo",
                    url : audio_inf.value.split(",")[0],
                    length : audio_inf.value.split(",")[1]
                };
            } else {
                const info = JSON.parse(audio.dataset["audio"]);
                return {
                    type : "getAudioInfo",
                    fullId : audio.dataset.fullId,
                    length : info[5],
                    artist : info[4],
                    title : info[3],
                }
            }
        }
    }


    function calculateBitrate (event) {
        var audio = event;
        //check that this is audio
        if (!event.parentNode) {
            audio = event.currentTarget;
        }// проверить className = "downloadButton", то добавлять только тогда
        if (!audio.querySelector(".bitrate")) {
            chrome.runtime.sendMessage(vkdId, getAudioInfo(audio), function (response) {

                const durationDiv = audio.querySelector(".audio_duration");
                durationDiv.style.position = "relative";
                durationDiv.style.top = '-5px';
                durationDiv.classList.add('bitrate');

                const size = document.createElement('div');
                size.innerText = response.size;
                size.className = "size";
                const downloadButton = audio.querySelector('.downloadButton');
                durationDiv.appendChild(size);

                let hq = audio.querySelector('.audio_hq_label');
                hq.classList.add('bitrated_audio');
                hq.classList.add('br' + response.bitrate);
                hq.textContent = response.bitrate;


            });
            audio.removeEventListener("mouseover", calculateBitrate, false);
        }

    }


    function trackDownloadClick (e) {
        try {
            _gaq.push(['_trackEvent', 'Audio', 'Downloaded', e.target.download]);
        } catch (exc) {
            console.log(exc);
        }
        console.log(e.target.download + " downloaded");
        e.preventDefault();
        e.stopPropagation();
        return false;
    }


    function trackVideoDownload (url, title) {
        _gaq.push(['_trackEvent', 'Video', 'Downloaded', url + "[Title:" + title + "]"]);
    }

    function hasClass (element, cls) {
        return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
    }


    function downloadVideoClickHandler (nodeWithEmbed) {
        let video = nodeWithEmbed.querySelector('video');
        if (video) {
            let src = video.src;
            let title = undefined;
            try {
                title = nodeWithEmbed.querySelector('.videoplayer_title').textContent;
            } catch (e) {

            }
            if (src.startsWith('blob') /*|| vkd_settings['alwaysHls'] == 'true'*/) {
                //HLS video
                let videoId = video.closest('.video_box_wrap').id.replace('video_box_wrap', '');
                var qualityElement = document.querySelector('.videoplayer_quality_select ._item[aria-checked="true"]');
                let quality = undefined;
                if (qualityElement) {
                    quality = qualityElement.dataset['value'];
                }
                let z = getParameterByName('z');
                let playlistId = undefined;
                if (z.startsWith('video') && z.indexOf('/') != -1) {
                    playlistId = z.split('/')[1];
                }


                chrome.runtime.sendMessage(vkdId, {
                    type : 'downloadHlsVideo',
                    video : {
                        title : title,
                        videoId : videoId,
                        quality : quality,
                        playlistId : playlistId
                    }
                });
                showDoneBox("Закачка скоро начнется. <br/>" +
                    " Это может занять длительное время, в зависимости от" +
                    " длительности ролика (около одной минуты).<br/>" +
                    " На иконке расширения будет показан прогресс подготовки.<br/><br/>"
                    , {out : 5000, w : 700});
            } else {
                chrome.runtime.sendMessage(vkdId, {
                    type : 'downloadVideo',
                    video : {title : title, url : decodeURIComponent(src)}
                });
            }
            trackVideoDownload(src, title);
        } else {
            console.log('unable to find video tag');
        }
    }

    function getElementToInsertVideoPlayer (nodeWithEmbed) {
        var elementsByClassName = document.getElementsByClassName('video_box');
        if (elementsByClassName && elementsByClassName[0]) {
            return elementsByClassName[0];
        }

        var newVkFullPlayer = nodeWithEmbed.closest('.video_box_wrap');
        if (newVkFullPlayer) {
            return newVkFullPlayer;
        }

        return nodeWithEmbed;
    }

    function updateVideoFrameSizeIfNeeded (nodeWithEmbed, downloadButton) {
        // post preview
        if (nodeWithEmbed.tagName === 'EMBED') {
            var videoWrapper = nodeWithEmbed.closest('.page_video_inline_wrap');
            var topPostWrapper = nodeWithEmbed.closest(".page_post_sized_thumbs");

            if (videoWrapper && topPostWrapper) {
                if (videoWrapper.style.height == '287px') {
                    videoWrapper.style.height = '310px';
                }

                if (topPostWrapper.style.height == '286px') {
                    videoWrapper.style.height = '310px';
                }
                nodeWithEmbed.style.height = '286px';
                nodeWithEmbed.style.display = 'block';
                downloadButton.style.display = 'block';
            }
        }

    }

    function updateVideoFrame (nodeWithEmbed) {
        if (!nodeWithEmbed)
            return;

        if (checkHtml5Video(nodeWithEmbed)) {
            let action = nodeWithEmbed.querySelector('.videoplayer_share_actions');
            if (!action || action.querySelector('.downloadVideoButton')) {
                return;
            }


            let downloadButton = document.createElement("DIV");
            downloadButton.className = 'downloadVideoButton';
            downloadButton.innerHTML = '';
            downloadButton.addEventListener('click', function () {
                downloadVideoClickHandler(nodeWithEmbed);
            });

            let bottomControls = document.querySelector('.videoplayer_controls');
            if (bottomControls) {
                let downloadButtonBottom = document.createElement("DIV");
                downloadButtonBottom.className = 'downloadVideoButtonBottom videoplayer_controls_item';
                downloadButtonBottom.innerHTML = '';
                downloadButtonBottom.addEventListener('click', function () {
                    downloadVideoClickHandler(nodeWithEmbed);
                });
                downloadButtonBottom.addEventListener("mouseover", function () {
                    showTooltip(this, {text : 'Скачать видео', black : 1, shift : [75, 0, 5]})
                });
                bottomControls.appendChild(downloadButtonBottom);
            }

            action.appendChild(downloadButton);

        } else {
            if (nodeWithEmbed.tagName !== 'EMBED') {
                nodeWithEmbed = nodeWithEmbed.querySelector('embed');
            }
            var url = [];
            var fv = nodeWithEmbed.getAttribute("flashvars");
            url['240'] = getQueryVariable(fv, "url240");
            url['360'] = getQueryVariable(fv, "url360");
            url['480'] = getQueryVariable(fv, "url480");
            url['720'] = getQueryVariable(fv, "url720");
            url['1080'] = getQueryVariable(fv, "url1080");

            var titleFromFlash = decodeURIComponent(getQueryVariable(fv, "md_title"));
            var divider = document.createElement("div");
            divider.className = "divider fl_l";
            divider.innerText = "|";

            var wrapper = document.createElement("div");
            wrapper.className = "videoDownloaderWrapper";
            var titleDiv = document.createElement("div");
            titleDiv.innerText = "Скачать:";
            titleDiv.setAttribute("style", "");
            wrapper.appendChild(titleDiv);
            var count = 0;
            url.forEach(function (entry, key) {
                if (entry) {

                    var link = document.createElement("a");
                    link.setAttribute("download", titleFromFlash);
                    link.setAttribute("href", decodeURIComponent(entry));
                    link.className = "downloadVideoLink";
                    link.innerText = key;
                    link.onclick = function () {
                        trackVideoDownload(key, title)
                    };
                    link.addEventListener('click', function (e) {
                        chrome.runtime.sendMessage(vkdId, {
                            type : 'downloadVideo',
                            video : {title : titleFromFlash, url : decodeURIComponent(entry)}
                        });
                        e.preventDefault();
                    });
                    wrapper.appendChild(link);
                    count++;
                }

            });
            if (count == 0) {
                titleDiv.parentNode.removeChild(titleDiv);
            }
            var elementToInsert = getElementToInsertVideoPlayer(nodeWithEmbed);
            if (!elementToInsert.querySelector('.videoDownloaderWrapper')) {
                elementToInsert.appendChild(wrapper);
                updateVideoFrameSizeIfNeeded(nodeWithEmbed, wrapper);
            }
        }
    }

    function getQueryVariable (text, variable) {
        var vars = text.split("&");
        for (var i = 0 ; i < vars.length ; i++) {
            var pair = vars[i].split("=");
            if (pair[0] == variable) {
                return pair[1];
            }
        }
    }
})();


function getParameterByName (name, url) {
    if (!url) {
        url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return '';
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function parseVkResponse (text) {
    var answer = text.split('<!>');
    var navVersion = intval(answer.shift());
    var newStatic = answer.shift();
    var langId = intval(answer.shift());
    var langVer = intval(answer.shift());
    var code = intval(answer.shift());
    for (var i = answer.length - 1 ; i >= 0 ; --i) {
        var ans = answer[i];
        if (ans.substr(0, 2) == '<!') {
            var from = ans.indexOf('>');
            var type = ans.substr(2, from - 2);
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

// эта функция должна быть вне замыкания, чтобы клик по кнопке имел к ней досутп
function downloadChecked () {
    var albumWindow = document.querySelector("#downloadAlbumWindow");
    var checkboxes = albumWindow.querySelectorAll(".downloadAlbumCheckbox");
    var audiosToDownload = [];
    for (var i = 0 ; i < checkboxes.length ; i++) {
        if (!checkboxes[i].checked)
            continue;
        var audio = checkboxes[i];
        var artist = audio.dataset.artist;
        var title = audio.dataset.title;
        var albumName = albumWindow.dataset.album;
        audiosToDownload.push({
            artist : artist,
            title : title,
            url : audio.dataset.url,
            album : albumName,
            fullId : audio.dataset.fullId
        });

    }
    chrome.runtime.sendMessage(vkdId, audiosToDownload);

}

function selectAll (checkbox) {
    var checks = document.querySelectorAll("#downloadAlbumWindow .downloadAlbumCheckbox");
    for (var i = 0 ; i < checks.length ; i++) {
        checks[i].checked = checkbox.checked;
    }
}
