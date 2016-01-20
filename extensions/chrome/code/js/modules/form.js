// module for manipulating / validating the form shared between options and
// popup views.  when 'Go!' button is pressed, structured info is passed to
// provided callback.
//
// no unit tests for this module, it is jQuery manipulation mostly.
//
'use strict';

var $ = require('../libs/jquery');
var msg = require('../modules/msg').init('form');


module.exports.init = function(callback) {

  $(function() {
    function clearAlerts() {
      $('.alerts').empty();
    }

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
      $('#secrets').empty();
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
          if (unlocked === null) {
            // create alert
            var alertElem = $('<div role="alert">').addClass('alert alert-danger')
              .text('You must generate and save a key first. Go to options to do so.');

            // clear any existing alerts
            clearAlerts();

            // show new alert
            $(alertElem).appendTo($('.alerts'));
          } else if (unlocked) {
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

                      // add secrets to DOM
                      $.each(data.secrets, function(i, secret) {
                        // add secret to list
                        var secretTemplate = $($('#secrets-list-item-template').clone().get(0).content).children();
                        secretTemplate.find('.domain').text(secret.domain);
                        secretTemplate.find('.username').val(secret.username).attr('title', secret.username);
                        secretTemplate
                          .attr('data-domain', secret.domain)
                          .attr('data-path', secret.path)
                          .attr('data-username', secret.username)
                          // do not display initially
                          .css('display', 'none');  // .hide() won't work
                        secretTemplate.appendTo($('#list'));
                      });

                      var animationDelay = 150;
                      // start progress while building list
                      var progressIncrement = Math.ceil(100 / data.secrets.length);
                      progressJs = require('../libs/progress').progressJs('#list');
                      progressJs.start().autoIncrease(progressIncrement, animationDelay);

                      // make secrets visible
                      $.each(data.secrets, function(i, secret) {
                        setTimeout(function() {
                          // show element
                          var secretElem = $('.secret[data-path="' + secret.path + '"]:not(:visible):first');
                          secretElem.show();

                          // show progress
                          progressJs.set((i + 1) * progressIncrement);

                          if ((i + 1) === data.secrets.length) {
                            // end progress
                            progressJs.end();

                            // filter list on render finish
                            var currentQuery = $('#search').val().trim();
                            if (!currentQuery) {
                              chrome.storage.local.get('lastQuery', function(items) {
                                var lastQuery = items.lastQuery;
                                if (lastQuery) {
                                  $('#search').val(lastQuery);
                                  filterSecrets(lastQuery);
                                }
                              });
                            } else {
                              filterSecrets(currentQuery);
                            }
                          }
                        }, i * animationDelay);
                      });
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

    function filterSecrets(query) {
      // filter list
      $('.secret').each(function(i, secretElem) {
        if (fuzzyContains($(secretElem).attr('data-domain'), query) ||
            fuzzyContains($(secretElem).attr('data-username'), query)) {
          $(secretElem).show();
        } else {
          $(secretElem).hide();
        }
      });
    }

    $('.container').on('input', '#search', function(event) {
      var query = $(event.target).val().trim();
      chrome.storage.local.set({lastQuery: query}, function() {
        if (query) {
          filterSecrets(query);
        } else {
          $('.secret').show();
        }
      });
    });

    // always show unlock form
    enableUnlock();
  });
};
