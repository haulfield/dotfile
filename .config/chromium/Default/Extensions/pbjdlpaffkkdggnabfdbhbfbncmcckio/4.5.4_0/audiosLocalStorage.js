function getAudiosOnOptionsPage () {
    let ids = [];
    try {
        ids = JSON.parse(localStorage.pendingAudios);
    } catch (e) {
        localStorage.pendingAudios = JSON.stringify(ids);
    }
    return ids;
}

function _setAudiosOnOptionsPage (audios) {
    localStorage.pendingAudios = JSON.stringify(audios);
}
function addManyAudiosToOptionsPageAndStartDownload (audios) {
    const existingAudios = getAudiosOnOptionsPage();
    for (let audio of audios) {
        existingAudios.push(audio);
    }
    _setAudiosOnOptionsPage(existingAudios);
    if (window.processQueue) {
        //from background page
        processQueue()
    } else {
        // from options page
        chrome.runtime.sendMessage({type : 'processQueue'});
    }
    const badge = existingAudios.length > 0 ? existingAudios.length.toString() : "";
    chrome.browserAction.setBadgeText({text : badge});

}

function getNextAudioToDownload() {
    return new Promise((r,rej) => {
        const existingAudios = getAudiosOnOptionsPage();
        const audio = existingAudios[0];
        if (!audio) {
            return r(undefined);
        }
        if (!audio.url) {
            fillUrlsForNextNAudios(existingAudios).then(() => {
                const updatedAudios = getAudiosOnOptionsPage();
                const updateAudio = updatedAudios[0];
                if (!updateAudio.url) {
                    console.error("Unable to get URL for next audio: ", audio, " url is empty even after fetch from VK. ");
                    return rej(audio);
                } else {
                    return r(updateAudio);
                }
            });
        } else {
            return r(audio);
        }
    });
}

function fillUrlsForNextNAudios (existingAudios) {
    return new Promise(function (resolve, reject) {
        // we need to use original collection, to allow saving of this collection later
        const audiosToFill = existingAudios.length < GET_INFO_PAGE_SIZE ? existingAudios : existingAudios.slice(0, GET_INFO_PAGE_SIZE - 1);
        const ids = audiosToFill.map(el => el.fullId);
        getAudiosInfo(ids, 0, ids.length).then(results => {
            const idToAudioFromVK = results.reduce((map, obj) => {
                    map[getFullIdFromVkResponse(obj)] = obj;
                    return map;
                }, {}
            );
            for (const audioToFill of audiosToFill) {
                const audioFromVK = idToAudioFromVK[audioToFill.fullId];
                if (audioFromVK) {
                    audioToFill.url = audioFromVK[2];
                }
            }
            _setAudiosOnOptionsPage(existingAudios);
            resolve();
        });
    });
}

function removeAudioFromQueue (audio) {
    _setAudiosOnOptionsPage(getAudiosOnOptionsPage().filter(function (a) {
        if (audio.url && a.url) {
            return a.url != audio.url;
        }
        if (audio.fullId && a.fullId) {
            return audio.fullId != a.fullId;
        }
    }));
    let badge = getAudiosOnOptionsPage().length > 0 ? getAudiosOnOptionsPage().length.toString() : "";
    chrome.browserAction.setBadgeText({text : badge});
}

function clearQueue () {
    _setAudiosOnOptionsPage([]);
    chrome.browserAction.setBadgeText({text : ''});

}