"use strict";
VK.Widgets.Group("vk_groups", {mode : 0, width : "535"}, 66225004);


// show widget only when there is no audios to download
if (getAudiosOnOptionsPage().length == 0) {
    document.getElementById('pending_info').style.display = '';
} else {
    document.getElementById('pending_controls').style.display = '';
}

var oneAudioTemplate =
    "<div class='one-pending-audio'>  " +
    "   <span class='full_title'><span class='artist'>$artist</span>  –  <span class='title'>$title</span></span> <span class='audio_remove'></span>" +
    "</div>";
var pendingAudiosDiv = document.querySelector('#pending_audios');

// обновляем список на закачку
for (var audio of getAudiosOnOptionsPage()) {
    if (!audio) continue;
    let oneAudio = document.createElement("div");
    oneAudio.innerHTML = oneAudioTemplate.replace("$artist", audio.artist).replace("$title", audio.title);
    oneAudio.myAudio= audio;
    oneAudio.title = 'Удалить трек из очереди на закачку';
    oneAudio.addEventListener("click", function () {
        if (oneAudio.dataset.removed !== 'true') {
            removeAudioFromOptionsPage(oneAudio);
        } else {
            addManyAudiosToOptionsPageAndStartDownload([oneAudio.myAudio]);

            oneAudio.dataset.removed = false;
            oneAudio.title = 'Удалить трек из очереди на закачку';
            oneAudio.classList.remove('removed_audio');

        }
    });
    pendingAudiosDiv.appendChild(oneAudio);

}

function removeAudioFromOptionsPage(oneAudio) {
    removeAudioFromQueue(oneAudio.myAudio);
    oneAudio.dataset.removed = true;
    oneAudio.title = 'Вернуть трек в очередь на закачку';
    oneAudio.classList.add('removed_audio');
}

function removeAudio (url) {
    removeAudioFromQueue({url : url});
}

document.querySelector('#clearQueueLink').addEventListener('click', clearQueueLink);
document.querySelector('#forceDownload').addEventListener('click', chrome.extension.getBackgroundPage().forceStartingOfNextDownload);


function clearQueueLink() {
    var list = document.querySelectorAll('.one-pending-audio');
    for (let i=0;i<list.length;i++) {
        removeAudioFromOptionsPage(list[i].parentNode);
    }
    clearQueue();
}
var tabs = document.querySelectorAll('.tab');
for (let i = 0 ; i < tabs.length ; i++) {
    let tab = tabs[i];
    tab.addEventListener('click', function() {
        let divId = tab.id.replace('link_', '');
        let contents = document.querySelectorAll('.tab_content');
        document.querySelector('.selected').classList.remove('selected');
        tab.classList.add('selected');
        for (let j = 0; j < contents.length; j++ ) {
            let content = contents[j];
            if (content.id != divId) {
                content.style.display = 'none';
            } else {
                content.style.display = '';
            }
        }
    })
}