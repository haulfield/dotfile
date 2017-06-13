var GCal = (function(my){
  var selectors = {
    title: '.ui-sch.ep-title input',
    descript: '.ui-sch textarea',
    video: '.ui-sch .rtcs',
    where: '.ep-dp-input .ui-sch input'
  };
  var loc = function(s) {
    return chrome.i18n.getMessage(s) || s.substr(1);
  };
  var login = '';
  var loadingLists = false;
  var loadingNumbers = false;
  var lifesizeButton = null;
  var descriptionTextarea = null;
  var whereInput = null;
  var titleInput = null;
  var addVideoCallNode;
  var defaultCalling;
  var defaultInvitation = '';
  var baseUrl = '';
  var invitationTitle = loc('_invite_email_subject');
  var invitationGreeting = loc('_invite_email_body1');
  var customNumbers = [];
  var primaryNumber = null;
  var inviteUrls = [];

  var meetingList = [];

  my.init = function() {
    loadingNumbers = true;
    HTML.display('#lifesizeLoader', true);
    window.addEventListener("load", function(e){
      initUser();
    });
    sendMessage('getSettings', {}, function(settings){
    });
    sendMessage('getPrimaryNumber', {}, function(number){
      primaryNumber = loc('_country_code_' + number.countryCode) + ': ' + number.phoneNumber;
    });
    sendMessage('getInviteUrls', {}, function(urls){
      inviteUrls = urls;
    });
    sendMessage('getCustomNumbers', {} , function(numbers) {
      if (!loadingLists) {
        HTML.display('#lifesizeLoader', false);
      }
      loadingNumbers = false;

      if (!Array.isArray(numbers)) return;
      customNumbers = numbers.map(function(number) {
        return loc('_country_code_' + number.countryCode) + ': ' + number.phoneNumber;
      });
    })
  };


  var initUser = function(){
    chrome.storage.local.get(null, function(data){
      processNode( document.body );
      if (!data.authorized) return;
      login = data.login;
      defaultCalling = data.defaultCalling;
      defaultInvitation = data.defaultInvitation || '';
      baseUrl = data.baseUrl;
      initObserver();
    });
  };


  /**
   * ================== Mutation Observer
   */
  var initObserver = function(){
    var target = document.querySelector('body');

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          processChildList(mutation.addedNodes);
        }
      });
    });

    var config = { subtree: true, childList: true, characterData: true };
    observer.observe(target, config);
  };


  var processChildList = function(children){
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];
      processNode(node);
    }
  };


  var processNode = function(node){
    // ignore text nodes
    if (node.nodeType === 3) return;
    var descript = node.parentNode.querySelector(selectors.descript);
    var videoWrap = node.parentNode.querySelector(selectors.video);
    var where = node.parentNode.querySelector(selectors.where);
    var title = node.parentNode.querySelector(selectors.title);
    if (where) whereInput = where;
    if (title) titleInput = title;
    if (descript) descriptionTextarea = descript;
    if (videoWrap && !videoWrap.querySelector('#lifesizeButton')) {
      addLifesizeUI(videoWrap);
    }
  };

  /**
   * ================== UI
   */


  /**
   * Inject button
   * @param {node} wrap - parent element
   */
  var addLifesizeUI = function(wrap){
    var img = document.createElement('span');
    img.id = "lifesizeButton";
    img.className = 'lk-button';
    img.innerHTML = '<span>'+loc('_meet_on_lifesize')+'</span>';
    $(img).prepend('<img src="' + chrome.extension.getURL('/img/icon_white_32x27.png') + '"/>');
    wrap.appendChild(img);

    var status = document.createElement('div');
    status.id = 'lifesizeStatus';
    status.textContent = 'status';
    status.style.display = 'none';
    wrap.appendChild(status);

    var loader = document.createElement('img');
    loader.id = 'lifesizeLoader';
    loader.src = chrome.extension.getURL('/img/loader.gif');
    if (!loadingNumbers) {
      loader.style.display = 'none';
    }
    wrap.appendChild(loader);

    lifesizeButton = img;

    lifesizeButton.onclick = function(){
      addVideoCallNode = wrap.firstChild;
      addVideoCallNode.style.display = 'none';
      videoButtonClickHandler(this);
    };
  };


  /**
   * Get meeting list, append selectbox with rooms
   */
  var videoButtonClickHandler = function(button){
    var injected = document.querySelectorAll('#lifesizeSelect');
    if (loadingLists || loadingNumbers || (injected && injected.length)) return;
    $(button).addClass('active');
    meetingList = [];
    var $selectWrap = $('<div></div>');
     $(lifesizeButton).after($selectWrap);
    getRoomList($selectWrap);
  };

  var getRoomList = function($selectWrap) {
    HTML.display('#lifesizeLoader', true);
    HTML.display('#lifesizeStatus', false);
    loadingLists = true;
    chrome.runtime.sendMessage({cmd: 'getRoomList'}, function(response){
      HTML.display('#lifesizeStatus', false);
      if (!loadingNumbers) {
        HTML.display('#lifesizeLoader', false);
      }
      loadingLists = false;
      if (response.error) {
        document.querySelector('#lifesizeStatus').textContent = response.error;
        HTML.display('#lifesizeStatus', true);
        return;
      }
      meetingList = response;
      var select = HTML.generateSelect(meetingList, defaultCalling, selectOnChangeHandler);
      $selectWrap.html(select);
      var $searchable = $(select).chosen({search_contains: true});
      $(select).trigger("change");
    });
  };

  /**
   * Create invitation and put to the textarea
   */
  var selectOnChangeHandler = function(){
    if (!this.selectedOptions.length) return;
    var meetingTitle = this.selectedOptions[0].text;
    whereInput.value = loc('_lifesize_cloud');

    var meeting = getMeeting(this.value);
    var indent = '   ';
    var extensionString = ' ' + loc('_extension') + ' ' + this.value;

    if (!meeting) return;
    var title = loc('_invite_email_subject').replace(/{Meeting_name}/g, meetingTitle);
    var body1 = loc('_invite_email_body1').replace(/{Meeting_name}/g, meetingTitle);
    var callMe = indent + inviteUrls.guestInviteUrl.replace(/\/[\d]+/gi, '/' + this.value) + '\n\n';
    var body2 = indent + loc('_invite_email_body2').replace(/{Extn}/g, this.value);
    var body3 = '\n' + indent + loc('_invite_email_body3').replace(/{NumbersLink}/g, indent + inviteUrls.clusterInboundPSTNNumberListURL +'\n\n');
    var body4 = loc('_invite_email_body4');

    var printedNumbers = customNumbers.map(function(number) {
      return '   ' + number + extensionString + '\n';
    });

    if (!printedNumbers.length) {
      printedNumbers = ['   ' + primaryNumber + extensionString + '\n'];
    }

    var passcode;
    if (meeting.pinProtected) {
      passcode = '   ' + loc('_invite_email_passcode_protected') + '\n';
      body1 += passcode;
      body2 += passcode;
    } else if (meeting.pin && meeting.pin.length) {
      passcode = '   ' + loc('_invite_email_enter_passcode').replace(/{Passcode}/g, meeting.pin) + '\n';
      body1 += passcode;
      body2 += passcode;
    }

    if (defaultInvitation) {
      body1 = defaultInvitation + '\n\n' + body1;
    }

    var descriptionTextArray = [body1, callMe, body2, printedNumbers.join(''), body3, body4];
    descriptionTextarea.value = descriptionTextArray.join('');

    // WEB-1390, ignore SKY-3487 Set Title of google calendar invite
    titleInput.value = title;

    var e = document.createEvent('HTMLEvents');
    e.initEvent('change', true, true);
    descriptionTextarea.dispatchEvent(e);

    e = document.createEvent('HTMLEvents');
    e.initEvent('change', true, true);
    titleInput.dispatchEvent(e);
    addVideoCallNode.style.display = 'none';
  };

  var getMeeting = function(id) {
    var meetings = $.grep(meetingList, function(e) {
      return e.value == id;
    });
    if (!meetings || meetings.length !== 1) return null;
    return meetings[0];
  }

  /**
   * Send message to the extension background script
   * @param {string} cmd - what kind of data will be sent
   * @param  {object} data
   */
  var sendMessage = function(cmd, data, callback){
    if (!callback) callback = function(){};
    chrome.runtime.sendMessage({
      cmd: cmd,
      data: data
    }, callback);
  };


  return my;

})(GCal || {});

GCal.init();
