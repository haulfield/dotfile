/**
 * API class
 */

var API = (function (my) {
  my.environment = 'lifesizecloud.com';
  chrome.storage.local.set({baseUrl: my.environment});

  var URL = 'https://manage.' + my.environment + '/api/';
  var loc = function(s) {
    return chrome.i18n.getMessage(s) || s.substr(1);
  };
  var friendlyError = loc('_error_friendly');

  my.ssoLogoutUrl = 'https://login.' + my.environment + '/ls/logout?next=' + 'https://webapp.' + my.environment;

  my.login = function(login, password, callbacks){
    my.get('login', { login: login, password: password, source: 'CHROME_EXTENSION'}, {
      success: function(response){
        var error = my.getError(response);
        if (!error) {
          chrome.storage.local.set({
            login: login,
            password: password,
            authorized: true,
            ssoLoggedIn: false,
            sso: false
          });
        }
        else {
          chrome.storage.local.set({authorized: false});
        }
        callbacks.success(response);
      },
      error: function() {
        callbacks.error(friendlyError);
      }
    });
  };

  my.ssoLogout = function(callbacks) {
    chrome.storage.local.set({
      user: null,
      login: '',
      authorized: false,
      sso: true,
      ssoLoggedIn: false,
      cachedRoomList: null
    });

    chrome.tabs.create({ url: my.ssoLogoutUrl }, function(ssoTab) {
      App.setSso({ tabId: ssoTab.id });
      my.logout(callbacks);
    });
  };

  my.ssoEmailCheck = function(login) {
    var sso = false;
    return lsapi.default.ssoEmailCheck(login, my.environment).then(function(result) {
      if (result && (result.loginSupportType === '2' || result.loginSupportType === '1')) {
        chrome.storage.local.set({
          login: login,
          ssoLoggedIn: true
        });
        chrome.tabs.create({ url: result.loginServiceURL }, function(ssoTab) {
          App.setSso({ login: login, tabId: ssoTab.id });
        });

        sso = true;
      }

      return {
        login: login,
        sso: sso
      };
    }).catch(function(error) {
      throw error;
    });
  };

  my.getCustomNumbers = function() {
    return new Promise(function(resolve, reject) {
      chrome.storage.local.get(['login', 'password', 'ssoLoggedIn'], function (response) {
        var params = response.ssoLoggedIn ? { sso: true } : {email: response.login, password: response.password };
        lsapi.default.getCustomNumbers(params, my.environment).then(
          function(result) {
            resolve(result);
          }
        ).catch(function(err) {
          reject(err)
        });
      })
    });
  };

  my.getPrimaryNumber = function() {
    return lsapi.default.getPrimaryNumber(my.environment);
  };

  my.getInviteUrls = function() {
    return new Promise(function(resolve, reject) {
      chrome.storage.local.get(['login', 'password', 'ssoLoggedIn'], function (response) {
        var params = response.ssoLoggedIn ? { sso: true } : {email: response.login, password: response.password };
        lsapi.default.getInviteUrls(params, my.environment).then(
          function(result) {
            resolve(result);
          }
        ).catch(function(err) {
          reject(err)
        });
      })
    });
  };

  my.logout = function(callbacks){
    chrome.storage.local.set({
      login: '',
      authorized: false,
      isAuthorizing: false,
      cachedRoomList: null
    });
    chrome.extension.sendRequest(chrome.runtime.id, { 'loggedOut': true }, function() {});
    my.get('logout', {}, {
      success: function(response){
        if (callbacks && callbacks.success) {
          callbacks.success(response);
        }
      },
      error: function() {
        if (callbacks && callbacks.error){
          callbacks.error("There was a problem contacting the server. Please try again later.");
        }
      }
    });
  };

  my.hasValidSession = function() {
    return new Promise(function(resolve, reject) {
      chrome.storage.local.set({
        isAuthorizing: true
      });
      chrome.extension.sendRequest(chrome.runtime.id, { 'isAuthorizing': true }, function() {});
      chrome.storage.local.get(null, function(data){
        if (!data.login) {
          chrome.storage.local.set({
            authorized: false,
            isAuthorizing: false
          });
          resolve(false);
        }
        my.get('hasValidSession', null, {
          success: function(response) {
            var error = my.getError(response);
            if (error) {
              chrome.storage.local.set({
                authorized: false,
                isAuthorizing: false
              });
              chrome.extension.sendRequest(chrome.runtime.id, { 'loggedOut': true }, function() {});
              resolve(false);
            } else {
              chrome.storage.local.set({
                authorized: true,
                isAuthorizing: false
              });
              if (data.sso) {
                chrome.extension.sendRequest(chrome.runtime.id, { 'ssoLoggedIn': true }, function() {});
              }
              resolve(true);
            }
          },
          error: function(response){
            chrome.storage.local.set({
              authorized: false,
              isAuthorizing: false
            });
            chrome.extension.sendRequest(chrome.runtime.id, { 'loggedOut': true }, function() {});
            resolve(false);
          }
        });
      });
    });
  };

  my.getCurrentUser = function() {
    return new Promise(function(resolve, reject) {
      chrome.storage.local.get(null, function(data){
        my.get('getUserAccountList', {search: data.login}, {
          success: function(response){
            var error = my.getError(response);
            if (error || !response.userList.length) {
              reject({error: error});
            } else {
              var user = response.userList[0];
              resolve({
                value: user.extension || user.connectionsID,
                text: user.userName,
                type: 'user'
              });
            }
          },
          error: function(response){
            resolve({error: friendlyError});
          }
        });
      });
    });
  };

  function getMeetings() {
    return new Promise(function(resolve, reject) {
      my.get('getMeetingAccountList', {}, {
        success: function(response){
          var error = my.getError(response);
          if (error) {
            reject({error: error});
          } else {
            var meetingList = [];
            for (var i = 0, len = response.meetingList.length; i < len; i++) {
              var room = response.meetingList[i];
              meetingList.push({
                value: room.connectionsID,
                text: room.title,
                type: 'meeting',
                pin: room.pin,
                owner: room.ownerConnectionsID
              });
            }
            resolve(meetingList);
          }
        },
        error: function(response){
          resolve({error: friendlyError});
        }
      });
    });
  }

  function getDevices() {
    return new Promise(function(resolve, reject) {
      my.get('getDeviceList', {}, {
        success: function(response){
          var error = my.getError(response);
          if (error) {
            reject({error: error});
          } else {
            var deviceList = [];
            var distinctList = {};
            for (var i = 0, len = response.deviceList.length; i < len; i++) {
              var device = response.deviceList[i];
              if (device.usageType === 'SHARED') {
                var serializedDevice = {
                  value: device.connectionsID,
                  text: device.systemName,
                  type: 'user',
                  regStatus: device.regStatus,
                  pairingTimeMillis: device.pairingTimeMillis
                };

                if(typeof(distinctList[serializedDevice.value]) == "undefined") {
                  distinctList[serializedDevice.value] = serializedDevice;
                } else {
                  var competingDevice = distinctList[serializedDevice.value];
                  var winningDevice;

                  if (serializedDevice.regStatus === 'REGISTERED' && competingDevice.regStatus !== serializedDevice.regStatus) {
                    winningDevice = serializedDevice;
                  } else if (competingDevice.regStatus === 'REGISTERED' && serializedDevice.regStatus !== competingDevice.regStatus) {
                    winningDevice = competingDevice;
                  } else {
                    winningDevice = serializedDevice.pairingTimeMillis > competingDevice.pairingTimeMillis ? serializedDevice : competingDevice;
                  }

                  distinctList[device.connectionsID] = winningDevice;
                }
              }
            }

            var distinctArray = Object.keys(distinctList);
            for (var ii = 0, distLen = distinctArray.length; ii < distLen; ii++) {
              deviceList.push(distinctList[distinctArray[ii]])
            }

            resolve(deviceList);
          }
        },
        error: function(response){
          resolve({error: friendlyError});
        }
      });
    });
  }

  function _getRoomList() {
    return Promise.all([getMeetings(), getDevices(), my.getCurrentUser()]).then(function(values) {
      var devices = values[1];
      var currentUser = values[2];
      var meetings = values[0].map(function(meeting) {

        if (meeting.pin && meeting.pin.length > 0 && meeting.owner !== currentUser.value) {
          meeting.pinProtected = true;
          meeting.pin = "";
        }

        return meeting;
      });

      var roomList = meetings.concat(devices);

      roomList.sort(function(a,b) {
        return a.text.toLowerCase() > b.text.toLowerCase() ? 1 : -1;
      });

      roomList.unshift(currentUser);
      chrome.storage.local.set({ cachedRoomList: roomList });
      return roomList;
    });
  }

  my.getRoomList = function() {
    return new Promise(function(resolve, reject) {
      chrome.storage.local.get(null, function(data){
        if (data && data.cachedRoomList && data.cachedRoomList.length) {
          resolve(data.cachedRoomList);
          _getRoomList();
        } else {
          _getRoomList().then(function(result) {
            resolve(result);
          }).catch(function(error) {
            resolve(error);
          });
        }
      });
    });
  };

  /**
   * Perform ajax request
   * @param  {string} path      api command
   * @param  {object} data      params
   * @param  {object} callbacks {success, error}
   */
  my.get = function(path, data, callbacks){
    $.get(URL + path, data)
      .done(function(response){
        if (callbacks && callbacks.success) callbacks.success(response);
      })
      .fail(function(response){
        if (callbacks && callbacks.error) callbacks.error(response);
      });
  };


  /**
   * Extract error message from response
   * @param  {object} response
   * @return {string}          error message
   */
  my.getError = function(response){
    if (!response) return loc('_error_unknown');
    if (response.RES === 'OK') return '';
    if (response.RES === 'KO') {
      if ( response.COD === 'E0401' || response.COD === 'E0115' ) {
        return loc('_error_invalid');
      }
      if (response.COD === 'E0101') {
        return loc('_please_login');
      }
      if ( response.COD === 'E0109') {
        my.logout();
        return '<p>'+loc('_account_expired')+'</p>';
      }
      return response.MSG;
    }
  };

  return my;

})(API || {});
