'use strict';

var openpgp = require('openpgp');


function doPostRequest(path, data, done) {
  function getItemsCallback(items) {
    // provide public key id as authentication
    var publicKey = openpgp.key.readArmored(items.publicKey).keys[0];
    var keyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase();

    var server = items.server;
    var uri = server + path;

    function handler() {
      var responseText = this.responseText;
      if (this.getResponseHeader('content-type') === 'application/json') {
        responseText = JSON.parse(this.responseText);
      }

      if (this.status === 200 && this.responseText !== null) {
        // success!
        done({
          error: null,
          response: responseText
        });
      } else {
        // something went wrong
        done({
          error: this.status,
          response: responseText
        });
      }
    }

    var client = new XMLHttpRequest();
    client.onload = handler;
    client.open('POST', uri);
    client.setRequestHeader('Content-Type', 'application/json');

    var payload = {keyId: keyId};
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        payload[key] = data[key];
      }
    }
    client.send(JSON.stringify(payload));
  }
  chrome.storage.local.get(['server', 'publicKey'], getItemsCallback);
}


function Server() {}

Server.prototype.getSecrets = function getSecrets(done) {
  doPostRequest('/secrets/', {}, done);
};

Server.prototype.getPassword = function getPassword(path, username, done) {
  doPostRequest('/secret/', {
    path: path,
    username: username
  }, done);
};

module.exports = new Server();
