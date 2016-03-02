'use strict';

// hide notifications on click
chrome.notifications.onClicked.addListener(function callback(notificationId) {
  chrome.notifications.clear(notificationId);
});

(function background() {
  var openpgp = require('openpgp');

  var server = require('./server');

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
  function getPassword(path, username, done) {
    function getPasswordCallback(data) {
      if (data.error) {
        done(data);
      } else {
        chrome.storage.local.get('privateKey',
          function getPrivateKeyCallback(items) {
            var privateKey = openpgp.key.readArmored(items.privateKey);
            privateKey.keys[0].decrypt(__passphrase);

            var pgpMessage = openpgp.message.readArmored(data.response);
            openpgp
              .decryptMessage(privateKey.keys[0], pgpMessage)
              .then(function onSuccess(plaintext) {
                // success!

                // read only the first line as the password
                var eol = plaintext.indexOf('\n');
                if (eol !== -1) {
                  plaintext = plaintext.slice(0, eol);
                }

                done({password: plaintext});
              })
              .catch(function onError(error) {
                // something went wrong
                done({
                  error: 400,
                  response: 'Unknown error when decrypting received password'
                });
              });
          });
      }
    }

    server.getPassword(path, username, getPasswordCallback);
  }

  var handlers = {
    copyUsername: function copyUsername(username, done) {
      copyToClipboard(username);

      done();
    },

    copyPassword: function copyPassword(path, username, done) {
      getPassword(path, username, function getPasswordCallback(result) {
        if (!result.error) {
          // copy
          copyToClipboard(result.password);

          // clear
          result.password = null;
        }
        done(result);
      });
    },

    generateKeys: function generateKeys(options, done) {
      openpgp.generateKeyPair(options).then(done);
    },

    getIdForKey: function getIdForKey(key, done) {
      var publicKey = openpgp.key.readArmored(key).keys[0];
      var keyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase();
      done(keyId);
    },

    getSecrets: function getSecrets(done) {
      function getSecretsCallback(data) {
        if (data.error) {
          done(data);
        } else {
          chrome.storage.local.get('privateKey',
            function getPrivateKeyCallback(items) {
              var privateKey = openpgp.key.readArmored(items.privateKey);
              privateKey.keys[0].decrypt(__passphrase);

              var pgpMessage = openpgp.message.readArmored(data.response);
              openpgp
                .decryptMessage(privateKey.keys[0], pgpMessage)
                .then(function onSuccess(plaintext) {
                  // success!
                  done({secrets: JSON.parse(plaintext)});
                })
                .catch(function onError(error) {
                  // something went wrong
                  done({
                    error: 400,
                    response: 'Unknown error when decrypting received secrets'
                  });
                });
            });
        }
      }

      server.getSecrets(getSecretsCallback);
    },

    getUserIdForKey: function getUserIdForKey(key, done) {
      var publicKey = openpgp.key.readArmored(key).keys[0];
      var userId = publicKey.users[0].userId.userid;
      done(userId);
    },

    notify: function notify(notificationId, options) {
      chrome.notifications.create(notificationId, options);
    },

    onDisconnect: function onDisconnect(context, tabId) {
      // forget the passphrase and change the icon when the popup is hidden
      if (context === 'popup') {
        __passphrase = null;
        this.setLockIcon();
      }
    },

    setLockIcon: function setLockIcon() {
      chrome.browserAction.setIcon({
        path: chrome.runtime.getURL('images/icon-locked-128.png')
      });
    },

    setUnlockIcon: function setUnlockIcon() {
      chrome.browserAction.setIcon({
        path: chrome.runtime.getURL('images/icon-unlocked-128.png')
      });
    },

    showPassword: function showPassword(path, username, done) {
      getPassword(path, username, done);
    },

    testPassphrase: function testPassphrase(passphrase, done) {
      // remember passhrase while popup is visible
      __passphrase = passphrase;

      // test passphrase with private key
      function getPrivateKeyCallback(items) {
        var privateKey = openpgp.key.readArmored(items.privateKey).keys[0];
        if (typeof privateKey === typeof void 0) {
          done(null);
        } else {
          var unlocked = privateKey.decrypt(passphrase);
          done(unlocked);
        }
      }
      chrome.storage.local.get('privateKey', getPrivateKeyCallback);
    }
  };

  require('./modules/msg').init('bg', handlers);
})();
