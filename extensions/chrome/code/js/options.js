// ;(function() {
//   console.log('OPTIONS SCRIPT WORKS!');

//   // // here we use SHARED message handlers, so all the contexts support the same
//   // // commands. but this is NOT typical messaging system usage, since you usually
//   // // want each context to handle different commands. for this you don't need
//   // // handlers factory as used below. simply create individual `handlers` object
//   // // for each context and pass it to msg.init() call. in case you don't need the
//   // // context to support any commands, but want the context to cooperate with the
//   // // rest of the extension via messaging system (you want to know when new
//   // // instance of given context is created / destroyed, or you want to be able to
//   // // issue command requests from this context), you may simply omit the
//   // // `hadnlers` parameter for good when invoking msg.init()
//   // var handlers = require('./modules/handlers').create('options');
//   // var msg = require('./modules/msg').init('options', handlers);
//   // var form = require('./modules/form');
//   // var runner = require('./modules/runner');

//   // form.init(runner.go.bind(runner, msg));
// })();

'use strict';

var openpgp = require('openpgp');

var $ = require('./libs/jquery');

(function() {
  /**
   * Save keys to 'chrome.local'.
   */
  function saveKeys() {
    var publicKey = $('#public-key').val();
    var privateKey = $('#private-key').val();

    chrome.storage.local.get('hasKey', function(items) {
      chrome.storage.local.set({
        hasKey: true,
        publicKey: publicKey,
        privateKey: privateKey
      }, function() {
        // Update status to let user know options were saved.
        if (items.hasKey) {
          $('#status').text('Key overwritten.');
        } else {
          $('#status').text('Key saved.');
        }
        setTimeout(function() {
          $('#status').text('');
        }, 750);
      });
    });
  }
  $('#save').on('click', saveKeys);

  /**
   * Generate key and display in textarea.
   */
  function generateKey() {
    $('#public-key').val('Generating..');
    $('#private-key').val('');
    $('#key-gen').prop('disabled', true);

    var options = {
        numBits: 2048,
        userId: require('./libs/UUID').generate(),
        passphrase: $('#passphrase').val()
    };

    openpgp.generateKeyPair(options).then(function(keypair) {
      $('#private-key').val(keypair.privateKeyArmored);
      $('#public-key').val(keypair.publicKeyArmored);
      $('#passphrase').val('');
      $('#key-gen').prop('disabled', false);
      $('#save').prop('disabled', false);
    });
  }
  $('#key-gen').on('click', generateKey);

  // show key on load
  chrome.storage.local.get('publicKey', function(items) {
    if (items.publicKey) {
      $('#public-key').val(items.publicKey);
    }
  });
})();
