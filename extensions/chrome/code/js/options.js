'use strict';

(function() {
  console.log('OPTIONS SCRIPT WORKS!');

  var openpgp = require('openpgp');

  var $ = require('./libs/jquery');

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
