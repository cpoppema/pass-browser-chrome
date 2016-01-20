// module for manipulating / validating the form shared between options and
// popup views.  when 'Go!' button is pressed, structured info is passed to
// provided callback.
//
// no unit tests for this module, it is jQuery manipulation mostly.
//
'use strict';

var $ = require('../libs/jquery');
var msg = require('../modules/msg').init('popup');

module.exports.init = function(callback) {
  $(function() {
    function disableUnlock() {
      $('#unlock-form').off('submit');
      $('#unlock-form').hide();
      $('#unlock').removeClass('active');
    }

    function enableSecrets() {
      disableUnlock();

      $('#secrets').show();
    }

    function disableSecrets() {
      $('#secrets').hide();
      $('#secrets').html('');
    }

    function enableUnlock() {
      disableSecrets();

      $('#unlock-form').on('submit', function resetUnlockButton() {
        // reset unlock button's styling
        $('#unlock')
          .removeClass('btn-success btn-warning btn-danger')
          .addClass('btn-primary');
      });
      $('#unlock-form').on('submit', function checkPassphrase(event) {
        var passphrase = $('#passphrase').val();

        // unlock in background.js
        msg.bg('unlock', passphrase, function(unlocked) {
          if (unlocked) {
            // start progress while retrieving secrets from server
            var progressJs = require('../libs/progress').progressJs('#unlock')
              .setOptions({
                theme: 'blueOverlayRadiusHalfOpacity',
                overlayMode: true
              });
            progressJs.start();
            progressJs.autoIncrease(100);

            msg.bg('getSecrets', function(data) {
              if (data.error) {
                progressJs.end();
                $('#unlock')
                  .removeClass('btn-primary btn-danger btn-success')
                  .addClass('btn-warning');

                if (data.error < 500) {
                  $('#unlock span').text(data.response.error);
                } else {
                  msg.bg('notify', 'pass-private-server-server-error', {
                    type: 'basic',
                    title: 'Server Error',
                    message: data.response.error,
                    iconUrl: chrome.runtime.getURL('images/icon128x128.png'),
                    priority: 1
                  });
                }
              } else {
                // succcess
                setTimeout(function() {
                  $('#unlock')
                    .removeClass('btn-primary btn-warning btn-danger')
                    .addClass('btn-success');
                  $('#unlock span').text('Unlocked');
                  progressJs.end();

                  setTimeout(function() {
                    // hide unlock form and switch to secrets
                    enableSecrets();

                    // loop through secrets and show progress if any
                    if (data.secrets.length) {
                      var secretsList = $($('#secrets-list-template').clone().get(0).content).children();
                      secretsList.appendTo($('#secrets'));

                      // bind copy/show events
                      $('#list').on('click', '.username-copy', function(event) {
                        var username = $(event.target).closest('.secret').find('.username');
                        msg.bg('copyUsername', username.val(), function() {
                          $('.copied').each(function(i, elem) {
                            $(elem).text($(elem).data('reset-text'));
                            $(elem).removeClass('copied label-primary');
                          });
                          if (!$(event.target).data('reset-text')) {
                            $(event.target).data('reset-text', $(event.target).text());
                          }
                          $(event.target).text($(event.target).data('copied-text'));
                          $(event.target).addClass('copied label-primary');
                        });
                      });
                      $('#list').on('click', '.password-copy', function(event) {
                        var secret = $(event.target).closest('.secret');
                        var path = secret.data('path');
                        var username = secret.data('username');
                        msg.bg('copyPassword', path, username, function() {
                          $('.copied').each(function(i, elem) {
                            $(elem).text($(elem).data('reset-text'));
                            $(elem).removeClass('copied label-primary');
                          });
                          if (!$(event.target).data('reset-text')) {
                            $(event.target).data('reset-text', $(event.target).text());
                          }
                          $(event.target).text($(event.target).data('copied-text'));
                          $(event.target).addClass('copied label-primary');
                        });
                      });
                      $('#list').on('click', '.password-show', function(event) {
                        var secret = $(event.target).closest('.secret');
                        var path = secret.data('path');
                        var username = secret.data('username');
                        msg.bg('getPassword', path, username, function(password) {
                          $(secret).find('.password').val(password);
                        });
                      });

                      // start progress while building list
                      progressJs = require('../libs/progress').progressJs('#list');
                      progressJs.start();
                      progressJs.increase(5);
                      var progressIncrement = Math.ceil(100 / data.secrets.length);

                      $.each(data.secrets.sort(function(secret1, secret2) {
                        // localeCompare is case-insensitive
                        return (secret1.domain.localeCompare(secret2.domain) ||
                                secret1.username.localeCompare(secret2.username));
                      }), function(i, secret) {
                        setTimeout(function() {
                          // add secret to list
                          var secretTemplate = $($('#secrets-list-item-template').clone().get(0).content).children();
                          secretTemplate.find('.domain').text(secret.domain);
                          secretTemplate.find('.username').val(secret.username).attr('title', secret.username);
                          secretTemplate
                            .attr('data-path', secret.path)
                            .attr('data-username', secret.username);
                          secretTemplate.appendTo($('#list'));

                          // show progress
                          progressJs.increase(progressIncrement);
                        }, i * 100);
                      });
                      setTimeout(function() {
                        progressJs.end();
                      }, data.secrets.length * 100);
                    } else {
                      // no secrets retrieved from server
                      if (data.error) {
                        console.log(data.error);
                      } else {
                        var noSecretsMessage = $($('#no-secrets-template').clone().get(0).content).children();
                        noSecretsMessage.appendTo($('#secrets'));
                      }
                    }
                  }, 500);
                }, 1000);
              }
            });
          } else {
            // error
            $('#unlock')
              .removeClass('btn-primary btn-success')
              .addClass('btn-danger');
          }
        });
        event.preventDefault();
      });
    }

    function restorePopup() {
      enableUnlock();
    }
    restorePopup();
  });
};
