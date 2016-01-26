'use strict';

(function() {
  console.log('OPTIONS SCRIPT WORKS!');

  var $ = require('./libs/jquery');

  var msg = require('./modules/msg').init('popup');

  var keyPair = {
    publicKey: null,
    privateKey: null
  };

  $(function() {
    // show data on load
    chrome.storage.local.get(['publicKey', 'server'], function(items) {
      if (items.publicKey) {
        $('#public-key').val(items.publicKey);

        // get key id
        msg.bg('getIdForKey', items.publicKey, function(keyId) {
          $('#public-key-id').val(keyId);
        });
        // get user id
        msg.bg('getUserIdForKey', items.publicKey, function(userId) {
          $('#key-name').val(userId);
        });
      }
      if (items.server) {
        $('#server').val(items.server);
      }
    });

    $('#key-gen').click(function(event) {
      // don't go anywhere
      event.preventDefault();

      // reset in-memory form values
      keyPair = {
        publicKey: null,
        privateKey: null
      };

      // clear visible key, disable save
      $('#public-key, #public-key-id').val('');
      $('#save')
        .removeClass('btn-success')
        .prop('disabled', true);

      // show warnings for required input
      $.each($(event.target).closest('form').find(':input[required]'), function(i, inputElem) {
        if (!$(inputElem).val().trim().length) {
          $(inputElem)
            .addClass('form-control-warning')
            .closest('.form-group')
            .addClass('has-warning');
        } else {
          $(inputElem)
            .removeClass('form-control-warning')
            .closest('.form-group')
            .removeClass('has-warning');
        }
      });

      // stop if a form input still has an error
      if ($(event.target).closest('form').find('.has-warning').length) {
        $(event.target).closest('form').find('.has-warning:first :input').focus();
        return;
      }

      // show indication of progress
      $('#public-key').val('Generating..');

      // generate keys and display data in form
      var options = {
        numBits: 2048,
        userId: $('#key-name').val(),
        passphrase: $('#passphrase').val()
      };
      msg.bg('generateKeys', options, function(keypair) {
        keyPair.publicKey = keypair.publicKeyArmored;
        keyPair.privateKey = keypair.privateKeyArmored;

        $('#public-key').val(keyPair.publicKey);

        $('#passphrase').val('');
        $('#key-gen').prop('disabled', false);
        $('#save')
          .addClass('btn-success')
          .prop('disabled', false);

        // get key id
        msg.bg('getIdForKey', keyPair.publicKey, function(keyId) {
          $('#public-key-id').val(keyId);
        });
      });
    });

    $('#save').click(function(event) {
      chrome.storage.local.get('publicKey', function(items) {
        chrome.storage.local.set({
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          server: $('#server').val().trim()
        }, function() {
          // update status to let user know options were saved
          if (items.publicKey) {
            $('#status').text('Key overwritten.');
          } else {
            $('#status').text('Key saved.');
          }
          setTimeout(function() {
            $('#status').text('');
          }, 750);
        });
      });
    });
  });
})();
