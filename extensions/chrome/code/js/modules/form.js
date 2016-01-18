// module for manipulating / validating the form shared between options and
// popup views.  when 'Go!' button is pressed, structured info is passed to
// provided callback.
//
// no unit tests for this module, it is jQuery manipulation mostly.
//

var $ = require('../libs/jquery');
window.$ = window.jQuery = $;
var msg = require('../modules/msg').init('popup');

/**
 * Helper function to get values from a nested object.
 *
 * Example:
 *
 * var tree = {
 *   'objects': {
 *     'project1': {
 *       'authors': [
 *         'alice',
 *         'bob'
 *       ]
 *     },
 *     'project2': {
 *       'authors': {
 *         'special': [
 *           'charlie'
 *         ]
 *       }
 *     }
 *   }
 * };
 *
 * turns into:
 *
 * { 'project1.authors': [ 'alice', 'bob' ],
 *   'project2.authors.special': [ 'charlie' ] }
 */
function flattenObject(ob) {
    var toReturn = {};

    for (var i in ob) {
        if (!ob.hasOwnProperty(i)) {
            continue;
        }

        if ((typeof ob[i]) === 'object') {
            var flatObject = flattenObject(ob[i]);
            for (var x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) {
                    continue;
                }

                if(Array.isArray(ob[i])) {
                    if(!(i in toReturn)) {
                        toReturn[i] = [];
                    }
                    toReturn[i].push(flatObject[x]);
                } else {
                    toReturn[i + '/' + x] = flatObject[x];
                }
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}

module.exports.init = function(callback) {
  $(function() {
    function enableUnlock() {
      disableSecrets();

      $('#unlock-form').on('submit', function resetUnlockButton() {
        // reset unlock button's styling
        $('#unlock')
          .removeClass('btn-success btn-danger')
          .addClass('btn-primary');
      });
      $('#unlock-form').on('submit', function checkPassphrase(event) {
        var passphrase = $('#passphrase').val();

        // unlock in background.js
        msg.bg('unlock', passphrase, function(unlocked) {
          if(unlocked) {
            // start progress while retrieving secrets from server
            var progressJs = require('../libs/progress').progressJs('#unlock')
              .setOptions({
                theme: 'blueOverlayRadiusHalfOpacity',
                overlayMode: true
              });
            progressJs.start();
            progressJs.autoIncrease(100);

            msg.bg('getSecrets', function(data) {
              // succcess
              setTimeout(function() {
                $('#unlock')
                  .removeClass('btn-primary btn-danger')
                  .addClass('btn-success');
                progressJs.end();

                // hide unlock form and switch to secrets
                enableSecrets();

                // loop through secrets and show progress if any
                if(Object.keys(data.secrets).length) {
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
                      if(!$(event.target).data('reset-text')) {
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
                      if(!$(event.target).data('reset-text')) {
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

                  var secrets = flattenObject(data.secrets);
                  var reverseSecrets = {};
                  $.each(secrets, function(path, usernames) {
                    $.each(usernames, function(i, username) {
                      reverseSecrets[username] = path;
                    });
                  });
                  var usernames = Object.keys(reverseSecrets);

                  var progressIncrement = Math.ceil(100 / usernames.length);

                  $.each(usernames.sort(function(string1, string2) {
                      return string1.localeCompare(string2); // localeCompare is case-insensitive
                  }), function(i, username) {
                    console.log(i, username);
                    setTimeout(function() {
                      // add secret to list
                      var path = reverseSecrets[username];
                      var secret = $($('#secrets-list-item-template').clone().get(0).content).children();
                      secret.find('.path').text(path);
                      secret.find('.username').val(username).attr('title', username);
                      secret
                        .attr('data-path', path)
                        .attr('data-username', username);
                      secret.appendTo($('#list'));

                      // show progress
                      progressJs.increase(progressIncrement);
                    }, i * 100);
                  });
                  setTimeout(function() {
                    progressJs.end();
                  }, usernames.length * 100);
                } else {
                  // no secrets retrieved from server
                  if(data.error) {

                  } else {
                    var noSecretsMessage = $($('#no-secrets-template').clone().get(0).content).children();
                    noSecretsMessage.appendTo($('#secrets'));
                  }
                }
              }, 1000);
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

    function restorePopup() {
      enableUnlock();
    }
    restorePopup();
  });
};
