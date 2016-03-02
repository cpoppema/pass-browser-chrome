'use strict';

(function server() {
  function doPostRequest(path, data, done) {
    function getItemsCallback(items) {
      // provide public key as authentication
      var publicKey = items.publicKey;

      var server = items.server;
      var uri = server + path;

      function handler() {
        if (this.responseText !== null &&
            this.getResponseHeader('content-type') === 'application/json'
        ) {
          // response parsed, it might still contain an error
          var response = JSON.parse(this.responseText);
          if (response.error) {
            done({
              error: this.status,
              response: response.error
            });
          } else {
            done(response);
          }
        } else {
          // unknown error, simply pass status code and status text
          done({
            error: this.status,
            response: this.statusText
          });
        }
      }

      var client = new XMLHttpRequest();
      client.onload = handler;
      client.open('POST', uri);
      client.setRequestHeader('Content-Type', 'application/json');
      client.timeout = 5000;

      function noServerError() {
        done({
          error: 404,
          response: 'Server did not respond or timed out.'
        });
      }
      client.ontimeout = noServerError;
      client.onerror = noServerError;

      var payload = {publicKey: publicKey};
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
})();
