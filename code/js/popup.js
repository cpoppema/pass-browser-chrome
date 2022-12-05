'use strict';

(function popup() {
  var matchSorter = require('match-sorter').default;
  var parseDomain = require('parse-domain');

  var $ = require('jquery');
  window.$ = window.jQuery = $;
  var msg;
  var progressJs = require('./libs/progress').progressJs;


  function autofocus() {
    var elem = $('[autofocus]:visible');
    if (elem && inViewport(elem.get(0))) {
      $(elem).focus();
    }
  }

  function bindLinksHandlers() {
    $('#go-to-options').on('click', function onClick() {
      chrome.runtime.openOptionsPage();
    });

    $('#logout').on('click', function onClick() {
      // kill progress
      if ($('#all-secrets[data-progressjs]').length) {
        var secretsProgress = progressJs('#all-secrets');
        secretsProgress.kill();
      }
      if ($('.token-expiry[data-progressjs]').length) {
        var tokenProgress = progressJs('.token-expiry[data-progressjs]');
        tokenProgress.kill();
      }

      // forget passphrase
      msg.bg('forceLogout');

      // toggle visibility
      hideSecrets();
      showUnlock();

      // return focus
      autofocus();
    });
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

      copyToClipboard(username);

      // remove existing 'copied' indicators
      $('.copied').each(function forEachCopiedElem(i, elem) {
        $(elem).text($(elem).data('reset-text'));
        $(elem).removeClass('copied label-primary');
      });
      // indicate this username has been copied
      $(event.target).text($(event.target).data('copied-text'));
      $(event.target).addClass('copied label-primary');
    });

    // copy password
    $('.container').on('click', '.password-copy', function onClick(event) {
      var secret = $(event.target).closest('.secret');
      var password = $(secret).find('.password');

      // copy-to-clipboard doesn't work from a service worker (yet)
      // so:
      // - copy an already shown password, or..
      // - fetch it, show it, copy it, hide it
      if ($(secret).find('.password-show').hasClass('label-success')) {
        copyToClipboard(password);

        // remove existing 'copied' indicators
        $('.copied').each(function forEachCopiedElem(i, elem) {
          $(elem).text($(elem).data('reset-text'));
          $(elem).removeClass('copied label-primary');
        });
        // indicate this password has been copied
        $(event.target).text($(event.target).data('copied-text'));
        $(event.target).removeClass('label-danger');
        $(event.target).addClass('copied label-primary');
      } else {
        var secretTemplate = $($('#secrets-list-item-template').html());
        var hiddenPasswordText = secretTemplate.find('input.password').val();
        var path = $(secret).data('path');
        var username = $(secret).data('username');

        msg.bg('showPassword', path, username,
          function showPasswordCallback(data) {
            if (data.error) {
              $(password).val(hiddenPasswordText);
              $(event.target).removeClass('copied label-primary');
              $(event.target).addClass('label-danger');

              showErrorNotification(data.error + ': ' + data.response);
            } else {
              // show it
              $(password).val(data.password);
              $(event.target).removeClass('label-danger');
              // copy it
              copyToClipboard(password);
              // hide it
              $(password).val(hiddenPasswordText);

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
      }
    });

    // show password
    $('.container').on('click', '.password-show', function onClick(event) {
      var secretTemplate = $($('#secrets-list-item-template').html());
      var hiddenPasswordText = secretTemplate.find('input.password').val();
      var secret = $(event.target).closest('.secret');
      var password = $(secret).find('.password');
      var path = $(secret).data('path');
      var username = $(secret).data('username');

      msg.bg('showPassword', path, username,
        function showPasswordCallback(data) {
          if (data.error) {
            $(password).val(hiddenPasswordText);
            $(event.target).removeClass('label-success');
            $(event.target).addClass('label-danger');

            showErrorNotification(data.error + ': ' + data.response);
          } else {
            $(password).val(data.password);
            $(event.target).removeClass('label-danger');
            $(event.target).addClass('label-success');
          }
        });
    });

    // copy username and/or password into a form
    $('.container').on('click', '.form-fill', function onClick(event) {
      var secret = $(event.target).closest('.secret');
      var path = $(secret).data('path');
      var username = $(secret).data('username');

      // get currently visible tab id
      chrome.tabs.query({active: true, currentWindow: true},
        function queryTabsCallback(tabs) {
          var tabId = tabs[0].id;

          msg.bg('fillForm', path, username,
            function fillFormCallback(data) {
              // remove any success or danger classes from other buttons
              $('.form-fill').removeClass('label-success label-danger');

              if (data.error) {
                $(event.target).removeClass('label-success');
                $(event.target).addClass('label-danger');

                showErrorNotification(data.error + ': ' + data.response);
              } else {
                msg.bcast(tabId, ['ct'], 'fillForm', username, data.password);
                $(event.target).removeClass('label-danger');
                $(event.target).addClass('label-success');
              }
            });
        });
    });

    // copy token
    $('.container').on('click', '.token-copy', function onClick(event) {
      var secret = $(event.target).closest('.secret');
      var token = $(secret).find('.token');

      // copy-to-clipboard doesn't work from a service worker (yet)
      // so:
      // - always fetch it, show it, copy it, hide it
      var secretTemplate = $($('#secrets-list-item-template').html());
      var hiddenTokenText = secretTemplate.find('input.token').val();
      var path = $(secret).data('path');
      var username = $(secret).data('username');

      var copy = !$(secret).find('.token-show').hasClass('label-success');
      msg.bg('showToken', path, username, copy,
        function showTokenCallback(data) {
          if (data.error) {
            stopTokenProgress();
            $(event.target).removeClass('copied label-primary');
            $(event.target).addClass('label-danger');

            showErrorNotification(data.error + ': ' + data.response);
          } else {
            // show it
            $(token).val(data.token);
            $(event.target).removeClass('label-danger');
            // copy it
            copyToClipboard(token);
            if (copy) {
              // hide it
              $(token).val(hiddenTokenText);
            }

            // remove existing 'copied' indicators
            $('.copied').each(function forEachCopiedElem(i, elem) {
              $(elem).text($(elem).data('reset-text'));
              $(elem).removeClass('copied label-primary');
            });
            // indicate this token has been copied
            $(event.target).text($(event.target).data('copied-text'));
            $(event.target).removeClass('label-danger');
            $(event.target).addClass('copied label-primary');
          }
        });
    });

    // show token
    $('.container').on('click', '.token-show', function onClick(event) {
      var secretTemplate = $($('#secrets-list-item-template').html());
      var hiddenTokenText = secretTemplate.find('input.token').val();
      var secret = $(event.target).closest('.secret');
      var path = $(secret).data('path');
      var username = $(secret).data('username');

      var copy = false;
      msg.bg('showToken', path, username, copy,
        function showTokenCallback(data) {
          // remove any success or danger classes from other buttons
          $('.token-show').removeClass('label-success label-danger');

          if (data.error) {
            stopTokenProgress();

            $(secret).find('.token').val(hiddenTokenText);
            $(event.target).removeClass('label-success');
            $(event.target).addClass('label-danger');

            showErrorNotification(data.error + ': ' + data.response);
          } else {
            $(secret).find('.token').val(data.token);
            $(event.target).removeClass('label-danger');
            $(event.target).addClass('label-success');

             tokenProgress($(secret).find('.token-expiry').get(0));
          }
        });
    });

    // copy token into a form
    $('.container').on('click', '.token-fill', function onClick(event) {
      var secret = $(event.target).closest('.secret');
      var path = $(secret).data('path');
      var username = $(secret).data('username');

      // get currently visible tab id
      chrome.tabs.query({active: true, currentWindow: true},
        function queryTabsCallback(tabs) {
          var tabId = tabs[0].id;

          msg.bg('fillToken', path, username,
            function fillFormCallback(data) {
              // remove any success or danger classes from other buttons
              $('.token-fill').removeClass('label-success label-danger');

              stopTokenProgress();

              if (data.error) {
                $(event.target).removeClass('label-success');
                $(event.target).addClass('label-danger');

                showErrorNotification(data.error + ': ' + data.response);
              } else {
                msg.bcast(tabId, ['ct'], 'fillToken', data.token);
                $(event.target).removeClass('label-danger');
                $(event.target).addClass('label-success');
              }
            });
        });
    });
  }

  function bindUnlockFormHandlers() {
    $('#unlock-form').on('submit', function onSubmit(event) {
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
            getSecrets();
          }
        });
    });
  }

  function clearAlerts() {
    $('.alerts').empty();
  }

  /**
   * Helper function to copy text from an input element to clipboard.
   *
   * copy-to-clipboard doesn't work from a service worker:
   * https://bugs.chromium.org/p/chromium/issues/detail?id=1160302
   */
  function copyToClipboard(input) {
    input.focus();
    input.select();
    document.execCommand('Copy');
    input.blur();
    // blur does not deselect input text
    var selection = window.getSelection();
    selection.removeAllRanges();
  }

  function filterSecrets(query) {
    if (query) {
      var all_secrets = [];
      var ranked_secrets_objs;

      // build objs for secrets
      $('#all-secrets .secret').each(function forEachSecretElem(i, secretElem) {
        var domain = secretElem.getAttribute('data-domain');
        var username = secretElem.getAttribute('data-username');
        var usernameNormalized = secretElem.getAttribute('data-username-normalized');
        var secret = {
          'domain': domain,
          'username': username,
          'usernameNormalized': usernameNormalized,
        };
        $(secretElem).data('secret', secret);
        all_secrets.push(secret);
      });

      // rank secret objs
      ranked_secrets_objs = matchSorter(all_secrets, query, {
        keys: [
          'domain',
          'usernameNormalized',
          'username',
        ],
      });

      // give every html element its ranking
      $('#all-secrets .secret').each(function forEachSecretElem(i, secretElem) {
        var domain = secretElem.getAttribute('data-domain');
        var username = secretElem.getAttribute('data-username');
        var usernameNormalized = secretElem.getAttribute('data-username-normalized');
        var secret = $(secretElem).data('secret');
        $(secretElem).data('ranked-position', ranked_secrets_objs.indexOf(secret));
      });

      // order html elements by ranking
      $('#all-secrets .secret').detach().sort(function compareSecretElem(a, b) {
        return $(a).data('ranked-position') - $(b).data('ranked-position');

      }).appendTo($('#all-secrets'));

      // show/hide matches
      $('#all-secrets .secret').detach().each(function forEachSecretElem(i, secretElem) {
        if ($(secretElem).data('ranked-position') !== -1) {
          $(secretElem).show();
        } else {
          $(secretElem).hide();
        }
      }).appendTo($('#all-secrets'));
    } else {
      // re-sort based on data-original-order
      $('#all-secrets .secret').detach().sort(function compareSecretElem(a, b) {
        return $(a).data('original-order') - $(b).data('original-order');
      }).appendTo($('#all-secrets'));

      // show all
      $('#all-secrets .secret').detach().each(function forEachSecretElem(i, secretElem) {
        $(secretElem).show();
      }).appendTo($('#all-secrets'));
    }
  }

  function fillTopSecrets(done) {
    chrome.tabs.query({active: true, currentWindow: true},
      function queryTabsCallback(tabs) {
        var currentDomain = '';
        var currentSubdomain = '';

        var parts = parseDomain(tabs[0].url);
        if (parts === null) {
          parts = {};
          parts.scheme = tabs[0].url.split('://')[0];

          if (['http',
               'https',
               'file',
              ].indexOf(parts.scheme) === -1) {
            // invalid (extension pages, settings etc.)
            done();
            return;
          } else {
            // ip addresses or simply a hostname, look for exact match instead
            // of matching parsed (sub)domain
            parts.host = tabs[0].url.split('://')[1].split('/')[0];
            parts.path = tabs[0].url.split('://')[1].split('/')[1];

            currentDomain = parts.host;
          }
        } else {
          currentDomain = [parts.domain, parts.tld].join('.');
          currentSubdomain = [parts.subdomain, currentDomain].join('.');
        }

        // place domain matches on top of the rest, with subdomain matches first
        var subdomainMatches = [];
        var domainMatches = [];
        $('#all-secrets .secret').each(
          function forEachSecretElem(i, secretElem) {
            var secretDomain = $(secretElem).attr('data-domain');

            // move matches to #top-list
            if (currentSubdomain.length) {
              if (secretDomain.indexOf(currentSubdomain) === 0) {
                subdomainMatches.push($(secretElem).clone());
                $(secretElem).remove();
              }
            }
            if (currentDomain.length) {
              if (secretDomain.indexOf(currentDomain) === 0) {
                domainMatches.push($(secretElem).clone());
                $(secretElem).remove();
              }
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

  function getSecrets() {
    // show progress while retrieving secrets from server
    startProgress('#unlock');
    msg.bg('getSecrets', getSecretsCallback);
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

      setTimeout(function renderSecretsDelayed() {
        renderSecrets(data.secrets);
      }, 200);
    } else {
      // error
      $('#unlock')
        .removeClass('btn-primary btn-danger btn-success')
        .addClass('btn-warning');

      showErrorNotification(data.error + ': ' + data.response);
    }
  }

  function hideLogout() {
    $('#logout').hide();
  }

  function hideSecrets() {
    $('#secrets').hide();
    $('#secrets').empty();

    hideLogout();
  }

  function hideUnlock() {
    $('#unlock-form').hide();
    $('#unlock-form').empty();
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

  function renderSecrets(secrets) {
    var progress;
    showSecrets(false);

    // loop through secrets and show progress if any
    if (secrets.length) {
      // index secrets site/username, look for -otp secrets (one-time-password)
      // used for Two-Factor-Authentication (2FA) and render them as such
      var secretsIndex = {};
      $.each(secrets, function forEachSecretIndex(i, secret) {
        var key = secret.path + '/' + secret.username_normalized;
        secretsIndex[key] = secret;
      });

      // now it's built, check every secret again to see if there's a
      // non-otp secret to attach to
      var shallowCopy = $.extend({}, secrets);
      $.each(shallowCopy, function forEachSecretIndex(j, secret) {
        var key_with_otp = secret.path + '/' + secret.username_normalized + '-otp';
        if (secretsIndex[key_with_otp] !== undefined) {
          secret.otp = true;
          secrets.splice(secrets.indexOf(secretsIndex[key_with_otp]), 1);
        }
      });

      // add secrets to #all-secrets
      var secretTemplate = $($('#secrets-list-item-template').html());
      $.each(secrets, function forEachSecret(i, secret) {
        var template = secretTemplate.clone();

        // if there's otp available, add class
        if (secret.otp) {
          template.addClass('otp-enabled');
        }

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
          .attr('data-original-order', i)
          // do not display initially
          .css('display', 'none');  // .hide() won't work yet
        template.appendTo($('#all-secrets'));
      });

      if (!$('#all-secrets[data-progressjs]').length) {
        // start progress while building list
        progress = startProgress('#all-secrets');
      } else {
        // reset pace
        progress = startProgress('#all-secrets');
      }

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
          }, i * (Math.max(5, 500 / secrets.length)));
        });
      });
    } else {
      if ($('#all-secrets[data-progressjs]').length) {
        // end progress
        progress = progressJs('#all-secrets');
        progress.end();
      }
      var noSecretsMessage = $($('#no-secrets-template').html());
      noSecretsMessage.appendTo($('#secrets'));
    }
  }

  function restoreLastQuery() {
    if (!$('#search').length) {
      return;
    }

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

  function showLogout() {
    $('#logout').show();
  }

  function showSecrets(showProgress) {
    msg.bg('setUnlockIcon');

    if (!$('#secrets').is(':visible')) {
      // toggle visibility
      hideUnlock();
      $('#secrets').show();

      var secretsList = $($('#secrets-list-template').html());

      // show search + list
      secretsList.appendTo($('#secrets'));
    }

    if (showProgress) {
      startProgress('#all-secrets');
    }

    chrome.storage.local.get('timeout', function getTimeoutCallback(items) {
      if (items.timeout) {
        showLogout();
      }
    });
  }

  function showUnlock() {
    msg.bg('setLockIcon');

    // toggle visibility
    hideSecrets();

    $('#unlock-form').show();
    var unlockForm = $($('#unlock-form-template').html());
    unlockForm.appendTo($('#unlock-form'));
  }

  function startProgress(elem, reset) {
    var progress = progressJs(elem);

    switch (elem) {
      case '#unlock':
        progress.setOptions({
          theme: 'blueOverlayRadiusHalfOpacity',
          overlayMode: true
        });
        progress.start().autoIncrease(100);
        break;
      case '#all-secrets':
        var animationDelay = 25;
        var nofSecrets = $('.secret').length;
        var progressIncrement;

        if (nofSecrets) {
          var percentage = 100;

          if (reset) {
            var id = parseInt($(elem).attr('data-progressjs'));
            var percentElement = $('[data-progressjs="' + id + '"]')
                                   .filter('> .progressjs-inner');
            var width = percentElement.style.width;
            var existingPercent = parseInt(width.replace('%', ''));
            percentage = percentage - existingPercent;
          }
          progressIncrement = Math.ceil(percentage / nofSecrets);
        } else {
          progressIncrement = 1;
        }

        progress.start().autoIncrease(progressIncrement, animationDelay);
        break;
    }

    return progress;
  }

  function stopTokenProgress(elem) {
    // stop others
    if ($('.token-expiry[data-progressjs]').length) {
      if (!elem || $('.token-expiry[data-progressjs]').get(0) !== elem) {
        var otherProgress = progressJs('.token-expiry[data-progressjs]');
        otherProgress.kill();
      }
    }
  }

  function tokenProgress(elem) {
    stopTokenProgress(elem);

    // start this one
    if ($('.token-expiry[data-progressjs]').get(0) !== elem) {
      var progress = progressJs(elem);

      var timeToNext30Seconds = (30 * 1000) - new Date().getTime() % (30 * 1000);
      progress.start().set((timeToNext30Seconds + 1000) / (30 * 1000) * 100);

      var timeToNextSecond = new Date().getTime() % 1000;
      var update = function() {
        if ($(elem).attr('data-progressjs')) {
          timeToNext30Seconds = (30 * 1000) - new Date().getTime() % (30 * 1000);
          progress.set((timeToNext30Seconds + 1000) / (30 * 1000) * 100);

          setTimeout(update, 1000);
        }
      };
      setTimeout(update, timeToNextSecond);
    }
  }

  $(function onDomReady() {
    bindLinksHandlers();
    bindSecretsListHandlers();
    bindUnlockFormHandlers();

    // show nothing
    hideSecrets();
    hideUnlock();

    // test if the passphrase has expired and show the form or secrets
    msg.bg('testPassphraseIsExpired',
      function testPassphraseIsExpiredCallBack(expired) {
        if (expired) {
          // open popup by showing unlock form
          showUnlock();

          // return focus
          autofocus();
        } else {
          // open popup by showing secrets
          showSecrets(true);
          getSecrets();
        }
      });
  });

  var handlers = {
    refreshTokenCopy: function refreshTokenCallback(path, token) {
      var secret = $('.secret[data-path="' + path + '"]');

      // if this token was copied, mark as red
      var copyBtn = $(secret).find('.token-copy');
      var copied = copyBtn.hasClass('copied');
      if (copied) {
        $(copyBtn).text($(copyBtn).data('reset-text'));
        $(copyBtn).removeClass('copied label-primary');
        $(copyBtn).addClass('label-danger');
      }
    },

    refreshTokenShow: function refreshTokenCallback(path, token) {
      var secret = $('.secret[data-path="' + path + '"]');

      // show token
      $(secret).find('.token').val(token);

      // if this token was copied, mark as red
      var copyBtn = $(secret).find('.token-copy');
      var copied = copyBtn.hasClass('copied');
      if (copied) {
        $(copyBtn).text($(copyBtn).data('reset-text'));
        $(copyBtn).removeClass('copied label-primary');
        $(copyBtn).addClass('label-danger');
      }
    },
  };

  msg = require('./modules/msg').init('popup', handlers);
})();
