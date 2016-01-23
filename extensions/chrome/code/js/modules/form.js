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

    function hideUnlock() {
      $('#unlock-form').off('submit');
      $('#unlock-form').hide();
      $('#unlock').removeClass('active');
    }

    function showSecrets() {
      hideUnlock();

      $('#secrets').show();
    }

    function hideSecrets() {
      $('#secrets').hide();
      $('#secrets').empty();
    }

    function showUnlock() {
      hideSecrets();

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
                $('#unlock')
                  .removeClass('btn-primary btn-warning btn-danger')
                  .addClass('btn-success');
                $('#unlock span').text('Unlocked');
                progressJs.end();
                setTimeout(function() {
                  // hide unlock form and switch to secrets
                  showSecrets();

                  // loop through secrets and show progress if any
                  if (data.secrets.length) {
                    var secretsList = $($('#secrets-list-template').clone().get(0).content).children();
                    var secretTemplate = $($('#secrets-list-item-template').clone().get(0).content).children();

                    // show search + list
                    secretsList.appendTo($('#secrets'));

                    // bind copy/show events
                    $('.container').on('click', '.username-copy', function(event) {
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
                    $('.container').on('click', '.password-copy', function(event) {
                      var secret = $(event.target).closest('.secret');
                      var path = secret.data('path');
                      var username = secret.data('username');
                      msg.bg('copyPassword', path, username, function(result) {
                        if (result.error) {
                          $(event.target).removeClass('copied label-primary');
                          $(event.target).addClass('label-danger');
                        } else {
                          $('.copied').each(function(i, elem) {
                            $(elem).text($(elem).data('reset-text'));
                            $(elem).removeClass('copied label-primary');
                          });
                          if (!$(event.target).data('reset-text')) {
                            $(event.target).data('reset-text', $(event.target).text());
                          }
                          $(event.target).text($(event.target).data('copied-text'));
                          $(event.target).removeClass('label-danger');
                          $(event.target).addClass('copied label-primary');
                        }
                      });
                    });
                    $('.container').on('click', '.password-show', function(event) {
                      var hiddenPasswordText = secretTemplate.find('input.password').val();
                      var secret = $(event.target).closest('.secret');
                      var path = secret.data('path');
                      var username = secret.data('username');
                      msg.bg('showPassword', path, username, function(result) {
                        if (result.error) {
                          $(secret).find('.password').val(hiddenPasswordText);
                          $(event.target).removeClass('label-success');
                          $(event.target).addClass('label-danger');
                        } else {
                          $(secret).find('.password').val(result.password);
                          $(event.target).removeClass('label-danger');
                          $(event.target).addClass('label-success');
                        }
                      });
                    });

                    // add secrets to #all-secrets
                    $.each(data.secrets, function(i, secret) {
                      var template = secretTemplate.clone();
                      // add secret to list
                      template.find('.domain').text(secret.domain);
                      template.find('.username').val(secret.username).attr('title', secret.username);
                      template
                        .attr('data-domain', secret.domain)
                        .attr('data-path', secret.path)
                        .attr('data-username', secret.username)
                        // do not display initially
                        .css('display', 'none');  // .hide() won't work
                      template.appendTo($('#all-secrets'));
                    });

                    var animationDelay = 25;

                    // start progress while building list
                    var progressIncrement = Math.ceil(100 / data.secrets.length);
                    progressJs = require('../libs/progress').progressJs('#all-secrets');
                    progressJs.start().autoIncrease(progressIncrement, animationDelay);

                    // place domain matches on top, with subdomain
                    // matches first
                    fillTopSecrets(function() {
                      // make secrets visible
                      $.each($('.secret'), function(i, secretElem) {
                        setTimeout(function() {
                          // show element
                          $(secretElem).show();

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
                                  $('#search').focus();
                                  $('#search').select();
                                  filterSecrets(lastQuery);
                                }
                              });
                            } else {
                              filterSecrets(currentQuery);
                            }
                          }
                        }, i * animationDelay);
                      });
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
                }, 200);
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

    function fillTopSecrets(done) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var parseDomain = require('parse-domain');
        var parts = parseDomain(tabs[0].url);
        var currentSubdomain = [parts.subdomain, parts.domain, parts.tld].join('.');
        var currentDomain = [parts.domain, parts.tld].join('.');

        // find matches
        var subdomainMatches = [];
        var domainMatches = [];
        $('#all-secrets .secret').each(function(i, secretElem) {
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

        // add matches in order to #top-secrets
        if (subdomainMatches.length + domainMatches.length) {
          $('#top-secrets').show();
          $.each(subdomainMatches, function(i, secretElem) {
            $(secretElem).appendTo($('#top-secrets'));
          });
          $.each(domainMatches, function(i, secretElem) {
            $(secretElem).appendTo($('#top-secrets'));
          });
        }

        done();
      });
    }

    // always show unlock form
    showUnlock();
  });
};
