var Popup = (function(my){

  var bg = chrome.extension.getBackgroundPage();

  my.init = function() {
    initUI();
    initMessaging();
    initUser();
    chrome.extension.onRequest.addListener(function(request) {
      if (request.ssoLoggedIn) {
        showCongratulations();
      }
      if (request.isAuthorizing) {
        loading();
      }
      if (request.loggedOut) {
        notLoading();
      }
    }.bind(my));
  };

  var loc = bg.App.loc;

  var loading = function() {
    $('#loader').show();
    $('#status').hide();
    $('button.btn').hide();
  };

  var notLoading = function() {
    $('#loader').hide();
    $('#status').hide();
    $('button.btn').show();
  }

  var initUI = function(){

    $('#loader').hide();

    $('a').click(function(e){
      e.preventDefault();
    });

    $('a[target="_blank"]').click(function(e){
      e.preventDefault();
      chrome.tabs.create({url: $(this).attr('href')});
    });


    $('.content').on('submit', '.form-emailcheck', function(e){
      e.preventDefault();
      var login = $('input#emailCheck');
      var loginVal = login.val();

      if (validateInput(login[0], "#emailCheck", "#emailCheckError")){
        $('#loader').show();
        $('#status').hide();
        bg.API.ssoEmailCheck(loginVal).then(function(result) {
          if (!result.sso) {
            showLoginForm(loginVal);
            $('input#password').focus();
          }
        }).catch(onError.bind(this));
      }
    });

    $('.content').on('submit', '.form-signin', function(e){
      e.preventDefault();
      var login = $('input#login');
      var password = $('input#password');
      var loginVal = login.val();

      if (validateInput(login[0], "#login", "#loginError") && validateInput(password[0], "#password", "#passwordError")){
        $('#loader').show();
        $('#status').hide();
        bg.API.login(loginVal, password.val(), {
          success: function(response){
            var error = bg.API.getError(response);
            if (error) {
              onError(error);
              return;
            }
            bg.API.getCurrentUser().then(function() {
              $('#loader').hide();
              showCongratulations();
            }).catch(function() {
              $('#loader').hide();
              showAccountExpired();
            });
          },
          error: onError
        });
      }
    });

    $('.content').on('click', '.action-close', function(){

    });
  };

  var validateUserAccount = function(login) {

  };

  var validateInput = function(field, inputId, inputError) {
    $(inputId).removeClass("has-error");
    $(inputError).html("");
    if (!field) {
      return false;
    }
    if (field.validity.valid) {
      return true;
    }
    $(inputId).addClass("has-error");
    $(inputError).html(field.validationMessage);
    return false;
  };

  var initUser = function(){
    chrome.storage.local.get(null, function(data){
      if (data.isAuthorizing) {
        loading();
      } else if (!data.authorized || !data.login) {
        showEmailCheckForm(data.login);
      }
      else {
        showPopupMenu();
      }
    });
  };


  var initMessaging = function(){
    chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        if (!sender.tab) return;
        if (request.cmd === '') {
        }
      });
  };


  /**
   * Success/Error Handlers
   */

  var onSuccess = function(response){
    $('#status')
      .hide()
      .html( HTML.span(response.success) )
      .removeClass()
      .addClass('alert alert-success')
      .slideDown();
    $('#loader').hide();
    setTimeout(function(){
      $('#status').hide();
    }, 3000);
  };


  var onError = function(response){
    var text = typeof response === 'string' ? response : response.statusText;
    $('#status')
      .hide()
      .html( HTML.span(text) )
      .removeClass()
      .addClass('alert alert-danger')
      .slideDown();
    $('#loader').hide();
    setTimeout(function(){
      $('#status').hide();
    }, 5000);

  };


  /**
   * Show templates
   */

  var showEmailCheckForm = function(login) {
    var data = {
      login: login || '',
      _sign_in_info: loc('_sign_in_info'),
      _email: loc('_email'),
      _sign_in: loc('_sign_in')
    };

    var template = $('#emailCheck').html();
    var resHtml = Mustache.to_html(template, data);
    var $content = $('.content');
    $content.html(resHtml);
    if (login) {
      $content.find('input#emailCheck').val(login).focus();
    }
  }

  var showLoginForm = function(login, password){
    var data = {
      login: login || '',
      password: password || '',
      _sign_in_info: loc('_sign_in_info'),
      _email: loc('_email'),
      _password: loc('_password'),
      _sign_in: loc('_sign_in')
    };
    var template = $('#loginTpl').html();
    var resHtml = Mustache.to_html(template, data);
    var $content = $('.content');
    $('#loader').hide();
    $content.html(resHtml);
    var $login = $content.find('#login');
    $login[0].oninput = function() {
      showEmailCheckForm($login.val());
    };
  };


  var showCongratulations = function(){
    $('#loader').hide();
    var template = $('#popupMenuTpl-congrats').html();
    var resHtml = Mustache.to_html(template, {
      _congratulations: loc('_congratulations'),
      _login_success_info: loc('_login_success_info'),
      _advanced_settings: loc('_advanced_settings'),
      _schedule_meeting: loc('_schedule_meeting')
    });
    $('.content').html(resHtml);
  };

  var showAccountExpired = function(){
    var template = $('#popupMenuTpl-accountExpired').html();
    var resHtml = Mustache.to_html(template,{
      _account_expired: loc('_account_expired')
    });
    $('.content').html(resHtml);
    $('.content').on('click', 'a', function(){
     chrome.tabs.create({url: $(this).attr('href')});
     return false;
   });
  };

  var showPopupMenu = function(){
    var template = $('#popupMenuTpl').html();
    var resHtml = Mustache.to_html(template, {
      _extension_settings: loc('_extension_settings'),
      _schedule_google: loc('_schedule_google')
    });
    $('.content').html(resHtml);
  };

  return my;

})(Popup || {});

  Popup.init();
