'use strict';

(function server() {
  function doPostRequest(path, data, done) {
    function getItemsCallback(items) {
      // provide public key as authentication
      var publicKey = items.publicKey;

      var server = items.server;
      var uri = server + path;

      function noServerError() {
        done({
          error: 404,
          response: 'Server did not respond or timed out.'
        });
      }

      var payload = {publicKey: publicKey};
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          payload[key] = data[key];
        }
      }
      fetch(uri, { headers: { 'content-type': 'application/json' }, method: 'POST', body: JSON.stringify(payload) })
        .then(function received(response) {
          if (!response.ok) {
            noServerError();
          } else {
            var isJsonResponse = false;
            for (var header of response.headers) {
              if (header[0] === 'content-type' && header[1].slice(0, 16) === 'application/json') {
                isJsonResponse = true;
                break;
              }
            }

            if (isJsonResponse) {
              response.json().then(function parsedJsonResponse(json) {
                if (json.error) {
                  done({
                    error: response.status,
                    response: json.error,
                  });
                } else {
                  done(json);
                }
              });
            } else {
              done({
                error: response.status,
                response: response.statusText
              });
            }
          }
        })
        .catch(noServerError);
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
