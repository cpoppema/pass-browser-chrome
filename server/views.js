'use strict';

var store = require('./store');


module.exports = function(router) {
  router.post('/secrets', function(req, res) {

    store.getList(function(secrets) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(secrets, null, 2));
    });
  });

  router.post('/secret', function(req, res) {
    // retrieve path + username from request
    var relPath = req.body.path;
    if (typeof relPath === typeof void 0) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        error: 'Invalid secret requested.'
      }, null, 2));
    }
    var username = req.body.username;
    if (typeof username === typeof void 0) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        error: 'Invalid secret requested.'
      }, null, 2));
    }

    store.getGpg(relPath, username, function(err, data) {
      if (!err) {

        var pgpMessage = store.buildPgpMessage(data);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(pgpMessage);
      } else {
        res.writeHead(err.errno, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          error: err.message
        }, null, 2));
      }
    });
  });
};
