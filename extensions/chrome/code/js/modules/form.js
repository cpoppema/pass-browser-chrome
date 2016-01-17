// module for manipulating / validating the form shared between options and
// popup views.  when 'Go!' button is pressed, structured info is passed to
// provided callback.
//
// no unit tests for this module, it is jQuery manipulation mostly.
//

var $ = require('../libs/jquery');
var msg = require('../modules/msg').init('popup');


module.exports.init = function(callback) {
  $(function() {
    function checkPassphrase(event) {
      var passphrase = $('#passphrase').val();

      msg.bg('unlock', passphrase, function(unlocked) {
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
