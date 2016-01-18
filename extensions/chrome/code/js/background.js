;(function() {

  console.log('BACKGROUND SCRIPT WORKS!');

  // here we use SHARED message handlers, so all the contexts support the same
  // commands. in background, we extend the handlers with two special
  // notification hooks. but this is NOT typical messaging system usage, since
  // you usually want each context to handle different commands. for this you
  // don't need handlers factory as used below. simply create individual
  // `handlers` object for each context and pass it to msg.init() call. in case
  // you don't need the context to support any commands, but want the context to
  // cooperate with the rest of the extension via messaging system (you want to
  // know when new instance of given context is created / destroyed, or you want
  // to be able to issue command requests from this context), you may simply
  // omit the `hadnlers` parameter for good when invoking msg.init()
  // var handlers = require('./modules/handlers').create('bg');
  // // adding special background notification handlers onConnect / onDisconnect
  // function logEvent(ev, context, tabId) {
  //   console.log(ev + ': context = ' + context + ', tabId = ' + tabId);
  // }
  // handlers.onConnect = logEvent.bind(null, 'onConnect');
  // handlers.onDisconnect = logEvent.bind(null, 'onDisconnect');
  // var msg = require('./modules/msg').init('bg', handlers);

  // // issue `echo` command in 10 seconds after invoked,
  // // schedule next run in 5 minutes
  // function helloWorld() {
  //   console.log('===== will broadcast "hello world!" in 10 seconds');
  //   setTimeout(function() {
  //     console.log('>>>>> broadcasting "hello world!" now');
  //     msg.bcast('echo', 'hello world!', function() {
  //       console.log('<<<<< broadcasting done');
  //     });
  //   }, 10 * 1000);
  //   setTimeout(helloWorld, 5 * 60 * 1000);
  // }

  // // start broadcasting loop
  // helloWorld();

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

  var openpgp = require('openpgp');

  var handlers = {
    unlock: function(passphrase, done) {
      // retrieve private key to test passphrase
      chrome.storage.local.get('private_key', function(items) {
        var privateKey = openpgp.key.readArmored(items.private_key).keys[0];
        var unlocked = privateKey.decrypt(passphrase);
        done(unlocked);
      });
    },

    getSecrets: function(done) {
      chrome.storage.local.get('server', function(items) {
        var server = items.server || 'http://localhost:8080';
        var secretsUri = server + '/secrets/';

        function processData(data) {
          done(JSON.parse(data));
        }

        function handler() {
          if(this.status === 200 &&
            this.responseText !== null) {
            // success!
            processData(this.responseText);
          } else {
            // something went wrong
          }
        }

        var client = new XMLHttpRequest();
        client.onload = handler;
        client.open('GET', secretsUri);
        client.send();
      });
    },

    copyUsername: function(username, done) {
      copyToClipboard(username);

      done();
    },

    copyPassword: function(path, username, done) {
      // get password from server

      // decrypt
      var password = '******';

      // copy
      copyToClipboard(password);

      done();
    },

    getPassword: function(path, username, done) {
      // get password from server

      // decrypt
      var password = '++++++';

      // return password
      done(password);
    }
  };

  var msg = require('./modules/msg').init('bg', handlers);
})();
