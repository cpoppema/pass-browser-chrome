'use strict';

var crc = require('crc')
  , fs = require('fs')
  , fsAccess = require('fs-access')
  , path = require('path')
  , walk = require('walk')
  , unorm = require('unorm');


module.exports = (function() {
  var passwordDir = process.env.PASSWORD_STORE_DIR;

  /**
   * Build an ascii armored pgp message.
   */
  function buildPgpMessage(data) {
    var pgpMessage = '';
    pgpMessage += '-----BEGIN PGP MESSAGE-----\n\n';
    pgpMessage += data.toString('base64') + '\n';
    pgpMessage += '=' + getChecksum(data) + '\n';
    pgpMessage += '-----END PGP MESSAGE-----';

    return pgpMessage;
  }

  /**
   * Calculate the checksum for given data.
   */
  function getChecksum(data) {
    // build ascii armored pgp message
    var hash = crc.crc24(data);
    return new Buffer('' +
        String.fromCharCode(hash >> 16) +
        String.fromCharCode((hash >> 8) & 0xFF) +
        String.fromCharCode(hash & 0xFF),
      'ascii').toString('base64');
  }

  /**
   * Get the file data from a secret's file (.gpg).
   */
  function getGpg(relPath, username, done) {
    var secretPath = path.resolve(path.normalize(path.join(passwordDir, relPath, username + '.gpg')));

    // return 400 bad request if secretPath ends up outside of passwordDir
    if (path.relative(passwordDir, secretPath).substr(0, 2) === '..') {
      done({errno: 400, message: 'Invalid secret requested.'});
    } else {
      fs.stat(secretPath, function(err, fileStats) {
        if (err) {
          if (err.errno === 34 || err.errno === -2) {
            // return 503 service unavailable if there is no file .gpg-id
            done({errno: 503, message: 'Key file (.gpg-id) does not exist.'});
          } else {
            // return 500 server errir if *something* went wrong
            done({errno: 500, message: 'Unknown server error.'});
          }
        } else {
          if (!fileStats.isFile()) {
            // return 400 bad request if secretPath is not a secret after all
            done({errno: 400, message: 'Invalid secret requested.'});
          } else {
            fsAccess(secretPath, function(err) {
              if (err) {
                // return 503 service unavailable if secret is unreadable
                done({errno: 503, message: 'Secret file is not readable.'});
              } else {
                fs.readFile(secretPath, function(err, data) {
                  if (err) {
                    // return 500 server errir if *something* went wrong
                    done({errno: 500, message: 'Unknown server error.'});
                  } else {
                    done(null, data);
                  }
                });
              }
            });
          }
        }
      });
    }
  }

  /**
   * Get a list of secrets currently on disk.
   */
  function getList(done) {
    var secrets = [];

    var walker = walk.walk(passwordDir, {
      followLinks: false
    });

    walker.on('file', function(root, fileStats, next) {
      if (root === passwordDir) {
        // skip everything in the root directory
        next();
      } else {
        var domain = path.basename(root);
        var extension = path.extname(fileStats.name);
        var username = path.basename(fileStats.name, extension);
        var relPath = path.relative(passwordDir, root);

        // skip everything without a domain
        if (domain) {
          // add file to secrets
          secrets.push({domain: domain, username: username, path: relPath});
        }

        next();
      }
    });

    walker.on('errors', function(root, nodeStatsArray, next) {
      console.log('error', nodeStatsArray);
      next();
    });

    walker.on('end', function() {
      // sort case insensitive and accent insensitive
      secrets = secrets.sort(function(secret1, secret2) {
        return (secret1.domain.localeCompare(secret2.domain) ||
                unorm.nfkd(secret1.username).localeCompare(unorm.nfkd(secret2.username)));
      });

      done(secrets);
    });
  }

  return {
    buildPgpMessage: buildPgpMessage,
    getChecksum: getChecksum,
    getGpg: getGpg,
    getList: getList,
  };
})();
