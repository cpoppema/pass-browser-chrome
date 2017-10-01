'use strict';

// hide notifications on click
chrome.notifications.onClicked.addListener(function callback(notificationId) {
  chrome.notifications.clear(notificationId);
});

(function background() {
  var openpgp = require('openpgp');

  var server = require('./server');

  // remember the passphrase to get secrets while in the popup, this is cleared
  // when the popup hides or the timeout expires when the popup is hidden
  var __passphrase = null;
  var handlers;
  var popupIsOpen = false;

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
            var privateKey = openpgp.key.readArmored(items.privateKey).keys[0];
            privateKey.decrypt(__passphrase);

            var pgpMessage = openpgp.message.readArmored(data.response);
            openpgp
              .decrypt({
                message: pgpMessage,
                privateKey: privateKey,
              })
              .then(function onSuccess(plaintext) {
                // success!

                // read only the first line as the password
                var eol = plaintext.data.indexOf('\n');
                if (eol !== -1) {
                  plaintext.data = plaintext.data.slice(0, eol);
                }

                done({password: plaintext.data});
              })
              .catch(function onError(error) {
                console.error(error);

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

  /**
   * Helper function to reset __passphrase and lock icon if timeout expired.
   */
  function testPassphraseIsExpiredCallBack(expired) {
    if (expired && !popupIsOpen) {
      __passphrase = null;
      handlers.setLockIcon();
    }
  }

  /**
   * Re-validate current session if some particular settings have changed.
   */
  chrome.storage.onChanged.addListener(
    function onChange(changes, namespace) {
      for (var key in changes) {
        if (key === 'timeout') {
          handlers.testPassphraseIsExpired(testPassphraseIsExpiredCallBack);
        }
        if (key === 'server' || key === 'publicKey' || key === 'privateKey') {
          __passphrase = null;
          handlers.setLockIcon();
        }
      }
    });

  handlers = {
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

    fillForm: function fillForm(path, username, done) {
      getPassword(path, username, function getPasswordCallback(result) {
        done(result);
      });
    },

    forceLogout: function forceLogout() {
      handlers.setLockIcon();
      __passphrase = null;
      chrome.storage.local.set({expireAt: null});
    },

    generateKeys: function generateKeys(options, done) {
      openpgp.generateKey(options).then(done);
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
              var privateKey = openpgp.key.readArmored(items.privateKey).keys[0];
              privateKey.decrypt(__passphrase);

              var pgpMessage = openpgp.message.readArmored(data.response);
              openpgp
                .decrypt({
                  message: pgpMessage,
                  privateKey: privateKey,
                })
                .then(function onSuccess(plaintext) {
                  // success!
                  done({secrets: JSON.parse(plaintext.data)});
                })
                .catch(function onError(error) {
                  console.error(error);

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

    onConnect: function onConnect(context, tabId) {
      // keep track of the popup's state to prevent expiring the passphrase
      // when the popup is open (this would invalidate all actions from the
      // popup, causing unexpected errors)
      if (context === 'popup') {
        popupIsOpen = true;
      }
    },

    onDisconnect: function onDisconnect(context, tabId) {
      // immediately test if the passphrase is expired when the popup hides,
      // this works regardless of the timeout setting
      if (context === 'popup') {
        popupIsOpen = false;
        handlers.testPassphraseIsExpired(testPassphraseIsExpiredCallBack);
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
      // test passphrase with private key
      chrome.storage.local.get(['privateKey', 'timeout', 'publicKey'],
        function getPrivateKeyCallback(items) {
          var privateKey = openpgp.key.readArmored(items.privateKey).keys[0];
          if (typeof privateKey === typeof void 0) {
            done(null);
          } else {
            var unlocked = privateKey.decrypt(passphrase);

            if (unlocked === true) {
              // at least remember passhrase while popup is visible
              __passphrase = passphrase;

              if (items.timeout) {
                // set expiration time for passphrase, this will be checked
                // the next time the popup is opened
                var now = new Date().getTime();
                var timeout = items.timeout * 1000; // convert to ms
                var expireAt = now + timeout;

                // save an encrypted value of expireAt
                var publicKey = items.publicKey;
                openpgp
                  .encrypt({
                    data: '' + expireAt,
                    publicKeys: openpgp.key.readArmored(publicKey).keys,
                  })
                  .then(function sendPgpResponse(armored) {
                    var pgpMessage = armored.data;
                    chrome.storage.local.set({expireAt: pgpMessage});

                    // let passphrase self-expire
                    setTimeout(function testPassphraseIsExpiredTimeout() {
                      var cb = testPassphraseIsExpiredCallBack;
                      handlers.testPassphraseIsExpired(cb);
                    }, timeout);

                    done(unlocked);
                  });
              } else {
                done(unlocked);
              }
            } else {
              done(unlocked);
            }
          }
        });
    },

    testPassphraseIsExpired: function testPassphraseIsExpired(done) {
      var expired;

      if (__passphrase === null) {
        done(true);
      } else {
        chrome.storage.local.get(['timeout', 'expireAt', 'privateKey'],
          function getTimeoutCallback(items) {
            if (!items.expireAt || !items.timeout) {
              expired = true;
              done(expired);
            } else {
              var privateKey = openpgp.key.readArmored(items.privateKey).keys[0];
              privateKey.decrypt(__passphrase);

              // read an encrypted value of expireAt
              var pgpMessage = openpgp.message.readArmored(items.expireAt);
              openpgp
                .decrypt({
                  message: pgpMessage,
                  privateKey: privateKey,
                })
                .then(function onSuccess(plaintext) {
                  // success!
                  var now = new Date().getTime();
                  try {
                    var expireAt = parseInt(plaintext.data, 10);
                    expired = expireAt < now;
                  } catch (e) {
                    expired = true;
                  }

                  done(expired);
                })
                .catch(function onError(error) {
                  console.error(error);

                  // something went wrong
                  expired = true;
                  done(expired);
                });
            }
          });
      }
    }
  };

  require('./modules/msg').init('bg', handlers);

  // on load (also when the browser starts)
  handlers.testPassphraseIsExpired(testPassphraseIsExpiredCallBack);
})();
