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

;(function() {
  /**
   * Save keys to 'chrome.local'.
   */
  function save_keys() {
    var public_key = document.getElementById('public-key').value;
    var private_key = document.getElementById('private-key').value;

    chrome.storage.local.get('device_has_key', function(items) {
      chrome.storage.local.set({
        device_has_key: true,
        public_key: public_key,
        private_key: private_key
      }, function() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        if(items.device_has_key) {
          status.textContent = 'Key overwritten.';
        } else {
          status.textContent = 'Key saved.';
        }
        setTimeout(function() {
          status.textContent = '';
        }, 750);
      });
    });
  }
  document.getElementById('save').addEventListener('click', save_keys);

  /**
   * Generate key and display in textarea.
   */
  function generate_key() {
    document.getElementById('public-key').value = 'Generating..';
    document.getElementById('private-key').value = '';
    document.getElementById('key-gen').disabled = true;

    // var kbpgp = require('kbpgp');
    // var F = kbpgp["const"].openpgp;

    // var progressElement = '#public-key';
    // var progressJs = require('./libs/progress').progressJs(progressElement);
    // progressJs.onprogress(function(targetElement, percent) {
    //   // the 'end' is uncertain, since this is percent-based, do % 100
    //   if(percent === 99) {
    //     setTimeout(function() {
    //       var progressjsId = parseInt(targetElement.getAttribute('data-progressjs'));
    //       var percentElement = document.querySelector('.progressjs-container > .progressjs-progress[data-progressjs="' + progressjsId + '"] > .progressjs-inner');
    //       percentElement.style.width = '1%';
    //     }, 25);
    //   }
    // });

    // var opts = {
    //   asp: new kbpgp.ASP({
    //     progress_hook: function(o) {
    //       progressJs.increase(1);
    //     }
    //   }),
    //   userid: require('./libs/UUID').generate(),
    //   primary: {
    //     nbits: 2048,
    //     flags: F.certify_keys | F.sign_data | F.auth | F.encrypt_comm | F.encrypt_storage,
    //     expire_in: 0  // never expire
    //   },
    //   subkeys: [
    //     {
    //       nbits: 2048,
    //       flags: F.sign_data,
    //       expire_in: 86400 * 365
    //     }, {
    //       nbits: 2048,
    //       flags: F.encrypt_comm | F.encrypt_storage,
    //       expire_in: 86400 * 365
    //     }
    //   ]
    // };

    // progressJs.start();

    // var t0 = Date.now();
    // kbpgp.KeyManager.generate(opts, function(err, alice) {
    //   if (!err) {
    //     // sign alice's subkeys
    //     alice.sign({}, function(err) {
    //       alice.export_pgp_private ({
    //         passphrase: document.getElementById('passphrase').value
    //       }, function(err, pgp_private) {
    //         console.log("private key: ", pgp_private);

    //         document.getElementById('private-key').value = pgp_private;
    //       });
    //       alice.export_pgp_public({}, function(err, pgp_public) {
    //         console.log("public key: ", pgp_public);

    //         console.log(Date.now() - t0);
    //         progressJs.end();
    //         document.getElementById('public-key').value = pgp_public;
    //         document.getElementById('key-gen').disabled = false;
    //         document.getElementById('passphrase').value = '';
    //         document.getElementById('save').disabled = false;
    //       });
    //     });
    //   }
    // });
    var openpgp = require('openpgp');
    var options = {
        numBits: 2048,
        userId: require('./libs/UUID').generate(),
        passphrase: document.getElementById('passphrase').value
    };

    openpgp.generateKeyPair(options).then(function(keypair) {
      document.getElementById('private-key').value = keypair.privateKeyArmored;
      document.getElementById('public-key').value = keypair.publicKeyArmored;
      document.getElementById('passphrase').value = '';
      document.getElementById('key-gen').disabled = false;
      document.getElementById('save').disabled = false;
    }).catch(function(error) {});
  }
  document.getElementById('key-gen').addEventListener('click', generate_key);
})();
