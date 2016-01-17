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
var flattenObject = function(ob) {
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
};

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
              $('#unlock')
                .removeClass('btn-primary btn-danger')
                .addClass('btn-success');
              progressJs.end();

              // hide unlock form and switch to secrets
              enableSecrets();

              // loop through secrets and show progress if any
              if(Object.keys(data.secrets).length) {
                var secrets = flattenObject(data.secrets);
                var increment = Math.ceil(100 / Object.keys(secrets).length);

                // start progress while building list
                progressJs = require('../libs/progress').progressJs('#secrets-list');
                progressJs.start();
                $.each(secrets, function(i, secret) {
                  progressJs.increase(increment);

                  // add secret to list
                  console.log(i, secret);
                });
                progressJs.end();
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
      $('#secrets-list').html('');
    }

    function restorePopup() {
      enableUnlock();
    }
    restorePopup();
  });
};
