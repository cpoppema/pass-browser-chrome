'use strict';

(function options() {
  var $ = require('./libs/jquery');

  var msg = require('./modules/msg').init('options');

  var form,
    keyPair = {
      publicKey: null,
      privateKey: null
    };

  function disableSaveButton() {
    $('#save')
      .removeClass('btn-success')
      .prop('disabled', true);
  }

  function enableSaveButton() {
    $('#save')
      .addClass('btn-success')
      .prop('disabled', false);
  }

  function enableSaveOnFormChange() {
    // enable save button when one of these fields change, other field changes
    // require a new keypair
    var fieldNames = [
      'server',
      'timeout',
    ];
    $.each(fieldNames, function bindInputChange(i, fieldName) {
      // get field element
      var field = $(form).find('[name="' + fieldName + '"]');

      // bind event
      $(field).off('input');
      var originalValue = $(field).val();
      $(field).on('input change', function toggleSaveOnChange() {
        var fieldHasChanged = $(field).is('[type="checkbox"],[type="radio"]') ||
          $(field).val() !== originalValue;
        var isRequired = $(field).is('[required]');

        if (fieldHasChanged && !isRequired ||
            fieldHasChanged && isRequired && $(field).val().trim() !== ''
        ) {
          enableSaveButton();
        } else {
          // don't prevent a new key from being saved
          if (!$(form).data('contains-new-key')) {
            disableSaveButton();
          }
        }
      });
    });
  }

  function formIsValid() {
    // show warnings for required input
    $.each($(form).find(':input[required]'),
      function checkRequiredInputs(i, inputElem) {
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

    // return true if there is still an error with the form input
    return !$(form).find('.has-warning').length;
  }

  function generateKeyPair() {
    // reset in-memory form values
    keyPair = {
      publicKey: null,
      privateKey: null
    };

    // clear visible key, disable save
    $('#public-key, #public-key-id').val('');
    disableSaveButton();

    if (!formIsValid()) {
      $(form).find('.has-warning:first :input').focus();
    } else {
      // show indications of progress
      $('#key-gen').prop('disabled', true);
      $('#public-key').val('Generating..');

      // generate keys and display data in form
      var options = {
        numBits: 2048,
        userId: $('#key-name').val(),
        passphrase: $('#passphrase').val()
      };
      msg.bg('generateKeys', options, function generateKeysCallback(keypair) {
        keyPair.publicKey = keypair.publicKeyArmored;
        keyPair.privateKey = keypair.privateKeyArmored;

        $('#public-key').val(keyPair.publicKey);

        $('#passphrase').val('');
        $('#key-gen').prop('disabled', false);

        $(form).data('contains-new-key', true);
        enableSaveButton();

        // get key id
        msg.bg('getIdForKey', keyPair.publicKey,
          function getIdForKeyCallback(keyId) {
            $('#public-key-id').val(keyId);
          });
      });
    }
  }

  function preloadOptionsForm() {
    chrome.storage.local.get(['publicKey', 'server', 'timeout'],
      function getCurrentOptionsCallback(items) {
        // get server address
        if (items.server) {
          $('#server').val(items.server);
        }

        // get timeout in seconds
        if (typeof items.timeout !== typeof void 0) {
          $('#timeout [value="' + items.timeout + '"]')
            .prop('checked', true)
            .parent().addClass('active');
        } else {
          $('#timeout :input:first')
            .prop('checked', true)
            .parent().addClass('active');
        }

        // get public key
        if (items.publicKey) {
          $('#public-key').val(items.publicKey);

          // get key id
          msg.bg('getIdForKey', items.publicKey,
            function getIdForKeyCallback(keyId) {
              $('#public-key-id').val(keyId);
            });

          // get key name
          msg.bg('getUserIdForKey', items.publicKey,
            function getUserIdForKeyCallback(userId) {
              $('#key-name').val(userId);
            });

          // enable save when form has changed
          enableSaveOnFormChange();
        } else {
          $(form).find(':input:first').focus();
        }
      });
  }

  function saveOptions(event) {
    var options = {
      server: $('#server').val().trim(),
      timeout: parseInt($('#timeout input:checked').val(), 10),
    };
    if (keyPair.publicKey) {
      options.publicKey = keyPair.publicKey;
    }
    if (keyPair.privateKey) {
      options.privateKey = keyPair.privateKey;
    }

    chrome.storage.local.set(options,
      function saveOptionsCallback() {
        $('#status').text('Options saved.');
        setTimeout(function hideStatus() {
          $('#status').text('');
        }, 750);
      });

    enableSaveOnFormChange();
    disableSaveButton();
  }

  function toggleTimeout(event) {
    $('#timeout .active').removeClass('active');
    $(event.target)
      .prop('checked', true)
      .parent().addClass('active');
  }

  $(function onDomReady() {
    form = $('#options-form');
    $(form).on('submit', function onSubmit(event) {
      // don't go anywhere
      event.preventDefault();
    });

    // some value changes disable/enable the save button, prevent disabling
    // the save button whenever a value resets to its original value, after
    // a new key has been generated
    $(form).data('contains-new-key', false);

    // show current options
    preloadOptionsForm();

    // bind click events
    $('#key-gen').on('click', generateKeyPair);
    $('#timeout :input').on('change', toggleTimeout);
    $('#save').on('click', saveOptions);
  });
})();
