'use strict';

(function() {
  console.log('BACKGROUND SCRIPT WORKS!');

  var openpgp = require('openpgp');

  // remember the passphrase to get secrets while in the popup, this is cleared
  // when the popup hides
  var __passphrase = null;

  /**
   * Helper function to copy text to clipboard.
   */
  function copyToClipboard(text) {
    var input = document.createElement('textarea');
    document.body.appendChild(input);
    input.value = text;
    input.focus();
    input.select();
    document.execCommand('Copy');
    input.remove();
  }

  /**
   * Retrieve password from server.
   */
  function __getPassword(path, username, done) {
    chrome.storage.local.get('server', function(items) {
      var server = items.server || 'http://localhost:8080';
      var secretsUri = server + '/secret/';

      function handler() {
        if (this.status === 200 &&
          this.responseText !== null) {
          var responseText = this.responseText;

          chrome.storage.local.get('privateKey', function(items) {
            var privateKey = openpgp.key.readArmored(items.privateKey).keys[0];
            privateKey.decrypt(__passphrase);

            var pgpMessage = openpgp.message.readArmored(responseText);
            openpgp.decryptMessage(privateKey, pgpMessage).then(function(plaintext) {
              // success!
              done({
                error: null,
                password: plaintext
              });
            }).catch(function(error) {
              // something went wrong
              done({
                error: 1,
                response: 'Unknown error'
              });
            });
          });
        } else {
          // something went wrong
          done({
            error: this.status,
            response: JSON.parse(this.responseText)
          });
        }
      }

      chrome.storage.local.get('publicKey', function(items) {
        // provide public key id as authentication
        var publicKey = openpgp.key.readArmored(items.publicKey).keys[0];
        var keyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase();

        var client = new XMLHttpRequest();
        client.onload = handler;
        client.open('POST', secretsUri);
        client.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        client.send(JSON.stringify({keyId: keyId, path: path, username: username}));
      });
    });
  }

  var handlers = {
    copyUsername: function(username, done) {
      copyToClipboard(username);

      done();
    },

    copyPassword: function(path, username, done) {
      __getPassword(path, username, function(result) {
        if (!result.error) {
          // copy
          copyToClipboard(result.password);

          // clear
          result.password = null;
        }
        done(result);
      });
    },

    generateKeys: function(options, done) {
      openpgp.generateKeyPair(options).then(done);
    },

    getIdForKey: function(key, done) {
      var publicKey = openpgp.key.readArmored(key).keys[0];
      var keyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase();
      done(keyId);
    },

    getSecrets: function(done) {
      chrome.storage.local.get('server', function(items) {
        var server = items.server || 'http://localhost:8080';
        var secretsUri = server + '/secrets/';

        function handler() {
          if (this.status === 200 &&
            this.responseText !== null) {
            // success!
            done({
              error: null,
              secrets: JSON.parse(this.responseText)
            });
          } else {
            // something went wrong
            done({
              error: this.status,
              response: JSON.parse(this.responseText)
            });
          }
        }

        chrome.storage.local.get('publicKey', function(items) {
          if (items.publicKey) {
            // provide public key id as authentication
            var publicKey = openpgp.key.readArmored(items.publicKey).keys[0];
            var keyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase();

            var client = new XMLHttpRequest();
            client.onload = handler;
            client.open('POST', secretsUri);
            client.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
            client.send(JSON.stringify({keyId: keyId}));
          } else {
            // error
          }
        });
      });
    },

    notify: function(notificationId, options) {
      console.log(options);
      chrome.notifications.create(notificationId, options);
    },

    onDisconnect: function(context, tabId) {
      if (context === 'popup') {
        __passphrase = null;
      }
    },

    showPassword: function(path, username, done) {
      __getPassword(path, username, done);
    },

    testPassphrase: function(passphrase, done) {
      __passphrase = passphrase;

      // retrieve private key to test passphrase
      chrome.storage.local.get('privateKey', function(items) {
        var privateKey = openpgp.key.readArmored(items.privateKey).keys[0];
        if (typeof privateKey === typeof void 0) {
          done(null);
        } else {
          var unlocked = privateKey.decrypt(passphrase);
          done(unlocked);
        }
      });
    }
  };

  require('./modules/msg').init('bg', handlers);
})();
