'use strict';

var fs = require('fs')
  , fsAccess = require('fs-access')
  , lineReader = require('line-reader')
  , path = require('path')
  , Promise = require('bluebird')
  ;

module.exports = function() {
  return function(req, res, next) {
    var passwordDir = process.env.PASSWORD_STORE_DIR;

    // make sure passwordDir is a readable directory
    if (!passwordDir) {
      res.writeHead(503, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        'error': 'PASSWORD_STORE_DIR is not specified.'
      }, null, 2));
    } else {
      fs.stat(passwordDir, function(err, dirStats) {
        if (err) {
          if (err.errno === 34 || err.errno === -2) {
            res.writeHead(503, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
              'error': 'PASSWORD_STORE_DIR does not exist.'
            }, null, 2));
          } else {
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
              'error': 'Unknown error.'
            }, null, 2));
          }
        } else {
          if (!dirStats.isDirectory()) {
            res.writeHead(503, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
              'error': 'PASSWORD_STORE_DIR is not a directory.'
            }, null, 2));
          } else {
            fsAccess(passwordDir, function(err) {
              if (err) {
                res.writeHead(503, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                  'error': 'PASSWORD_STORE_DIR is not readable.'
                }, null, 2));
              } else {
                // verify long or short key id is in the .gpg-id file
                var gpgIdFile = path.join(passwordDir, '.gpg-id');
                fs.stat(gpgIdFile, function(err, fileStats) {
                  if (err) {
                    if (err.errno === 34 || err.errno === -2) {
                      res.writeHead(503, {'Content-Type': 'application/json'});
                      res.end(JSON.stringify({
                        'error': 'Key file (.gpg-id) does not exist.'
                      }, null, 2));
                    } else {
                      res.writeHead(500, {'Content-Type': 'application/json'});
                      res.end(JSON.stringify({
                        'error': 'Unknown error.'
                      }, null, 2));
                    }
                  } else {
                    if (!fileStats.isFile()) {
                      res.writeHead(503, {'Content-Type': 'application/json'});
                      res.end(JSON.stringify({
                        'error': 'Key file (.gpg-id) is not a file.'
                      }, null, 2));
                    } else {
                      fsAccess(gpgIdFile, function(err) {
                        if (err) {
                          res.writeHead(503, {'Content-Type': 'application/json'});
                          res.end(JSON.stringify({
                            'error': 'Key file (.gpg-id) is not readable.'
                          }, null, 2));
                        } else {
                          // received keys
                          var longKeyId = req.body.keyId;
                          if (typeof longKeyId === typeof void 0) {
                            res.writeHead(401, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({
                              'error': 'Invalid key.'
                            }, null, 2));
                          } else {
                            var shortKeyId = longKeyId.substr(-8);

                            // read key file
                            var isAuthenticated = false;
                            var eachLine = Promise.promisify(lineReader.eachLine);
                            eachLine(gpgIdFile, function(line) {
                              isAuthenticated = (line === longKeyId || line === shortKeyId);
                              return !isAuthenticated;
                            }).then(function() {
                              if (!isAuthenticated) {
                                console.log('Key rejected:', longKeyId, shortKeyId);
                                res.writeHead(401, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify({
                                  'error': 'Invalid key.'
                                }, null, 2));
                              } else {
                                // key exists in key file, continue
                                next();
                              }
                            });
                          }
                        }
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
  };
};
