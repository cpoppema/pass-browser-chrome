'use strict';

// hide notifications on click
chrome.notifications.onClicked.addListener(function callback(notificationId) {
  chrome.notifications.clear(notificationId);
});

(function background() {
  var openpgp = require('openpgp');
  var otplib = require('otplib');

  var server = require('./server');

  // remember the passphrase to get secrets while in the popup, this is cleared
  // when the popup hides or the timeout expires when the popup is hidden
  var __passphrase = null;
  var handlers;
  var msg;
  var popupIsOpen = false;
  var refreshTokenTimeout;
  var showTokenForPath = null;

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
   * Obtain token generator function.
   */
  function getTokenGenerator(path, username, done) {
    clearTimeout(refreshTokenTimeout);

    // add -otp suffix as per our specs
    username += '-otp';

    getPassword(path, username, function getPasswordCallback(result) {
      if (!result.error) {
        var url = new URL(result.password);
        if (url.pathname.substring(0, 6) === '//totp' && url.searchParams.get('secret')) {
          var secret = url.searchParams.get('secret');
          result.generate = function generateToken() {
            return otplib.authenticator.generate(secret);
          };
        } else if (url.pathname.substring(0, 6) === '//hotp') {
          result.error = 'Could not generate token';
          result.response = 'Sorry, HMAC-based One Time Password (HOTP) is not supported!';
        } else {
          result.error = 'Failed to read OTP secret';
          result.response = 'Reason unknown';
        }

        // clear
        result.password = null;
      }
      done(result);
    });
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

    copyToken: function copyToken(path, username, done) {
      getTokenGenerator(path, username, function getTokenGeneratorCallback(result) {
        if (!result.error) {
          // copy
          var lastToken = result.generate();
          copyToClipboard(lastToken);

          // refresh token as long as the popup is open
          refreshTokenTimeout = setTimeout(function refreshTokenCopy() {
            var newToken = result.generate();
            if (newToken !== lastToken) {
              lastToken = newToken;

              // when copying for last shown token, update visible token too
              if (showTokenForPath === path) {
                msg.cmd(['popup'], 'refreshTokenShow', path, lastToken);
              }
              msg.cmd(['popup'], 'refreshTokenCopy', path, lastToken);
            }

            if (popupIsOpen) {
              refreshTokenTimeout = setTimeout(refreshTokenCopy, 1000);
            } else {
              // clear
              result.generate = null;
            }
          }, 1000);

          done({token: lastToken});
        } else {
          done(result);
        }
      });
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

    fillToken: function fillToken(path, username, done) {
      getTokenGenerator(path, username, function getTokenGeneratorCallback(result) {
        if (!result.error) {
          done({token: result.generate()});
        } else {
          done(result);
        }
      });
    },

    forceLogout: function forceLogout() {
      handlers.setLockIcon();
      __passphrase = null;
      showTokenForPath = null;
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
        showTokenForPath = null;
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

    showToken: function showToken(path, username, done) {
      showTokenForPath = path;

      getTokenGenerator(path, username, function getTokenGeneratorCallback(result) {
        if (!result.error) {
          var lastToken = result.generate();

          // refresh token as long as the popup is open
          refreshTokenTimeout = setTimeout(function refreshTokenShow() {
            var newToken = result.generate();
            if (newToken !== lastToken) {
              lastToken = newToken;
              msg.cmd(['popup'], 'refreshTokenShow', path, lastToken);
            }

            if (popupIsOpen) {
              refreshTokenTimeout = setTimeout(refreshTokenShow, 1000);
            } else {
              // clear
              result.generate = null;
            }
          }, 1000);

          done({token: lastToken});
        } else {
          done(result);
        }
      });
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

  msg = require('./modules/msg').init('bg', handlers);

  // on load (also when the browser starts)
  handlers.testPassphraseIsExpired(testPassphraseIsExpiredCallBack);
})();
