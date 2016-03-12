'use strict';

(function popup() {
  var parseDomain = require('parse-domain');

  var $ = require('./libs/jquery');
  window.$ = window.jQuery = $;
  var progressJs = require('./libs/progress').progressJs;

  var msg = require('./modules/msg').init('popup');


  function autofocus() {
    var elem = $('[autofocus]:visible');
    if (elem && inViewport(elem.get(0))) {
      $(elem).focus();
    }
  }

  function bindSecretsListHandlers() {
    // filter visible secrets when searching
    $('.container').on('input', '#search', function onChange(event) {
      var query = $(event.target).val().trim();
      filterSecrets(query);

      // remember last search query
      chrome.storage.local.set({lastQuery: query});
    });

    // copy username
    $('.container').on('click', '.username-copy', function onClick(event) {
      var username = $(event.target).closest('.secret').find('.username');

      msg.bg('copyUsername', username.val(),
        function copyUsernameCallback() {
          // remove existing 'copied' indicators
          $('.copied').each(function forEachCopiedElem(i, elem) {
            $(elem).text($(elem).data('reset-text'));
            $(elem).removeClass('copied label-primary');
          });
          // indicate this username has been copied
          $(event.target).text($(event.target).data('copied-text'));
          $(event.target).addClass('copied label-primary');
        });
    });

    // copy password
    $('.container').on('click', '.password-copy', function onClick(event) {
      var secret = $(event.target).closest('.secret');
      var path = $(secret).data('path');
      var username = $(secret).data('username');

      msg.bg('copyPassword', path, username,
        function copyPasswordCallback(data) {
          if (data.error) {
            $(event.target).removeClass('copied label-primary');
            $(event.target).addClass('label-danger');

            showErrorNotification(data.error + ': ' + data.response);
          } else {
            // remove existing 'copied' indicators
            $('.copied').each(function forEachCopiedElem(i, elem) {
              $(elem).text($(elem).data('reset-text'));
              $(elem).removeClass('copied label-primary');
            });
            // indicate this password has been copied
            $(event.target).text($(event.target).data('copied-text'));
            $(event.target).removeClass('label-danger');
            $(event.target).addClass('copied label-primary');
          }
        });
    });

    // show password
    $('.container').on('click', '.password-show', function onClick(event) {
      var secretTemplate = $($('#secrets-list-item-template').html());
      var hiddenPasswordText = secretTemplate.find('input.password').val();
      var secret = $(event.target).closest('.secret');
      var path = $(secret).data('path');
      var username = $(secret).data('username');

      msg.bg('showPassword', path, username,
        function showPasswordCallback(data) {
          if (data.error) {
            $(secret).find('.password').val(hiddenPasswordText);
            $(event.target).removeClass('label-success');
            $(event.target).addClass('label-danger');

            showErrorNotification(data.error + ': ' + data.response);
          } else {
            $(secret).find('.password').val(data.password);
            $(event.target).removeClass('label-danger');
            $(event.target).addClass('label-success');
          }
        });
    });
  }

  function bindUnlockFormHandlers() {
    $('#unlock-form').on('submit', function onSubmit() {
      // don't go anywhere
      event.preventDefault();

      // reset unlock button's styling
      $('#unlock')
        .removeClass('btn-success btn-warning btn-danger')
        .addClass('btn-primary');

      var passphrase = $('#passphrase').val();

      // unlock in background.js
      msg.bg('testPassphrase', passphrase,
        function testPassphraseCallBack(unlocked) {
          // treat unlocked as a 3-way boolean
          if (unlocked === null) {
            showAlert('You must generate and save a key first. ' +
                      'Go to options to do so.');
          } else if (!unlocked) {
            // error
            $('#unlock')
              .removeClass('btn-primary btn-success')
              .addClass('btn-danger');
          } else {
            // show progress while retrieving secrets from server
            var progress = progressJs('#unlock')
              .setOptions({
                theme: 'blueOverlayRadiusHalfOpacity',
                overlayMode: true
              });
            progress.start();
            progress.autoIncrease(100);

            msg.bg('getSecrets', getSecretsCallback);
          }
        });
    });
  }

  function clearAlerts() {
    $('.alerts').empty();
  }

  function filterSecrets(query) {
    if (query) {
      // filter list
      $('.secret').each(function forEachSecretElem(i, secretElem) {
        var domain = $(secretElem).attr('data-domain');
        var username = $(secretElem).attr('data-username');
        var usernameNormalized = $(secretElem).attr('data-username-normalized');
        if (fuzzyContains(domain, query) ||
            fuzzyContains(username, query) ||
            fuzzyContains(usernameNormalized, query)) {
          $(secretElem).show();
        } else {
          $(secretElem).hide();
        }
      });
    } else {
      // show all
      $('.secret').show();
    }
  }

  function fillTopSecrets(done) {
    chrome.tabs.query({active: true, currentWindow: true},
      function queryTabsCallback(tabs) {
        var parts = parseDomain(tabs[0].url);
        if (parts === null) {
          // invalid domain (extension pages, settings etc.)
          done();
          return;
        }

        // place domain matches on top, with subdomain matches first
        var currentDomain = [parts.domain, parts.tld].join('.');
        var currentSubdomain = [parts.subdomain, currentDomain].join('.');

        // find matches
        var subdomainMatches = [];
        var domainMatches = [];
        $('#all-secrets .secret').each(
          function forEachSecretElem(i, secretElem) {
            var secretDomain = $(secretElem).attr('data-domain');

            // move matches to #top-list
            if (secretDomain.indexOf(currentSubdomain) === 0) {
              subdomainMatches.push($(secretElem).clone());
              $(secretElem).remove();
            }
            if (secretDomain.indexOf(currentDomain) === 0) {
              domainMatches.push($(secretElem).clone());
              $(secretElem).remove();
            }
          });

        if (subdomainMatches.length + domainMatches.length) {
          $('#top-secrets').show();

          $.each(subdomainMatches,
            function forEachSubdomainMatch(i, secretElem) {
              $(secretElem).appendTo($('#top-secrets'));
            });
          $.each(domainMatches,
            function forEachDomainMatch(i, secretElem) {
              $(secretElem).appendTo($('#top-secrets'));
            });
        }

        done();
      });
  }

  function fuzzyContains(hay, needle) {
    hay = hay.toLowerCase();

    var i = 0, n = -1, l;
    needle = needle.toLowerCase();
    for (; l = needle[i++] ;) {
      if (!~(n = hay.indexOf(l, n + 1))) {
        return false;
      }
    }
    return true;
  }

  function getSecretsCallback(data) {
    // end progress
    var progress = progressJs('#unlock');
    // set progress to 100 before calling 'end' to finish up faster
    progress.set(100);
    progress.end();

    if (!data.error) {
      // success
      $('#unlock')
        .removeClass('btn-primary btn-warning btn-danger')
        .addClass('btn-success');

      $('#unlock span').text('Unlocked');

      setTimeout(function showSecretsDelayed() {
        showSecrets(data.secrets);
      }, 200);
    } else {
      // error
      $('#unlock')
        .removeClass('btn-primary btn-danger btn-success')
        .addClass('btn-warning');

      showErrorNotification(data.error + ': ' + data.response);
    }
  }

  function hideSecrets() {
    $('#secrets').hide();
    $('#secrets').empty();
  }

  function hideUnlock() {
    $('#unlock-form').off('submit');
    $('#unlock-form').hide();
    $('#unlock').removeClass('active');
  }

  function inViewport(elem) {
    var html;
    var rect;
    html = document.documentElement;
    rect = elem.getBoundingClientRect();

    return (!!rect &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= html.clientHeight &&
      rect.left <= html.clientWidth
    );
  }

  function restoreLastQuery() {
    // filter list on render finish
    var currentQuery = $('#search').val().trim();
    if (!currentQuery) {
      chrome.storage.local.get('lastQuery',
        function getLastQueryCallback(items) {
          var lastQuery = items.lastQuery;
          if (lastQuery) {
            $('#search').val(lastQuery);
            autofocus();
            $('#search').select();
            filterSecrets(lastQuery);
          } else {
            autofocus();
          }
        });
    } else {
      filterSecrets(currentQuery);
      autofocus();
    }
  }

  function showAlert(alert) {
    // create alert
    var alertElem = $('<div role="alert">').addClass('alert alert-danger')
      .text(alert);

    // clear any existing alerts
    clearAlerts();

    // show new alert
    $(alertElem).appendTo($('.alerts'));
  }

  function showErrorNotification(message, title) {
    if (!title) {
      title = 'Error';
    }

    msg.bg('notify', 'pass-browser-error', {
      iconUrl: chrome.runtime.getURL('images/icon-locked-128.png'),
      message: message,
      priority: 0,
      title: title,
      type: 'basic'
    });
  }

  function showSecrets(secrets) {
    msg.bg('setUnlockIcon');

    hideUnlock();

    $('#secrets').show();

    // loop through secrets and show progress if any
    if (secrets.length) {
      var secretsList = $($('#secrets-list-template').html());

      // show search + list
      secretsList.appendTo($('#secrets'));

      // add secrets to #all-secrets
      var secretTemplate = $($('#secrets-list-item-template').html());
      $.each(secrets, function forEachSecret(i, secret) {
        var template = secretTemplate.clone();

        // add secret to list
        template.find('.domain').text(secret.domain)
          .attr('title', secret.domain);
        template.find('.username').val(secret.username)
          .attr('title', secret.username);
        template
          .attr('data-domain', secret.domain)
          .attr('data-path', secret.path)
          .attr('data-username-normalized', secret.username_normalized)
          .attr('data-username', secret.username)
          // do not display initially
          .css('display', 'none');  // .hide() won't work yet
        template.appendTo($('#all-secrets'));
      });

      // start progress while building list
      var animationDelay = 25;
      var progressIncrement = Math.ceil(100 / secrets.length);
      var progress = progressJs('#all-secrets');
      progress.start().autoIncrease(progressIncrement, animationDelay);

      // show secrets that matches the current page's domain to the top
      fillTopSecrets(function fillTopSecretsCallback() {
        // make secrets visible
        $.each($('.secret'), function forEachSecretElem(i, secretElem) {
          setTimeout(function showSecretDelayed() {
            // show element
            $(secretElem).show();

            if ((i + 1) === secrets.length) {
              // end progress
              progress.end();

              restoreLastQuery();
            }
          }, i * animationDelay);
        });
      });
    } else {
      var noSecretsMessage = $($('#no-secrets-template').html());
      noSecretsMessage.appendTo($('#secrets'));
    }
  }

  function showUnlock() {
    msg.bg('setLockIcon');

    hideSecrets();
  }

  $(function onDomReady() {
    $('#go-to-options').on('click', function onClick() {
      chrome.runtime.openOptionsPage();
    });

    bindSecretsListHandlers();
    bindUnlockFormHandlers();

    // open popup by showing the unlock form
    showUnlock();
  });
})();
