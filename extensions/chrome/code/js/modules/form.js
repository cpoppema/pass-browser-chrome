// module for manipulating / validating the form shared between options and
// popup views.  when 'Go!' button is pressed, structured info is passed to
// provided callback.
//
// no unit tests for this module, it is jQuery manipulation mostly.
//
var openpgp = require('openpgp');

var $ = require('../libs/jquery');


module.exports.init = function(callback) {
  $(function() {
    function checkPassphrase(event) {
      var passphrase = $('#passphrase').val();

      // retrieve private key to test passphrase input
      chrome.storage.local.get('private_key', function(items) {
        var privateKey = openpgp.key.readArmored(items.private_key).keys[0];
        var unlocked = privateKey.decrypt(passphrase);
        if(unlocked) {
          // succcess
          $('#unlock')
            .removeClass('btn-primary btn-danger')
            .addClass('btn-success');
          $('#passphrase').val('');
        } else {
          // error
          $('#unlock')
            .removeClass('btn-primary btn-success')
            .addClass('btn-danger');
        }
      });

      event.preventDefault();
    }
    $('#unlock-form').on('submit', checkPassphrase);
  });

};
