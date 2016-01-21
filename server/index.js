'use strict'

var bodyParser = require('body-parser')
  , connect = require('connect')
  , crc = require('crc')
  , errorHandler = require('errorhandler')
  , fileStreamRotator = require('file-stream-rotator')
  , fs = require('fs')
  , fsAccess = require('fs-access')
  , http = require('http')
  , https = require('https')
  , morgan = require('morgan')
  , nodeMailer = require('nodemailer')
  , path = require('path')
  , sendmailTransport = require('nodemailer-sendmail-transport')
  , walk = require('walk')
  ;

var keyAuth = require('./key-auth');

var app = connect()

// parse incoming requests as json
app.use(bodyParser.json())

// authentication using a public key's id
app.use(keyAuth());

/**
 * Logging.
 */

// ensure log directory exists
var logDirectory = path.join(__dirname, '/log')
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)

// create rotating access stream
var accessLogStream = fileStreamRotator.getStream({
  filename: path.join(logDirectory, '/access-%DATE%.log'),
  frequency: 'daily',
  verbose: false,
  date_format: 'YYYY-MM-DD'
})
// create rotating error stream
var errorLogStream = fileStreamRotator.getStream({
  filename: path.join(logDirectory, '/error-%DATE%.log'),
  frequency: 'daily',
  verbose: false,
  date_format: 'YYYY-MM-DD'
})

app.use(morgan('combined', {
  stream: accessLogStream,
  skip: function (req, res) { return res.statusCode >= 400 }
}))
app.use(morgan('combined', {
  stream: errorLogStream,
  skip: function (req, res) { return res.statusCode < 400 }
}))

/**
 * Routing.
 */

app.use('/index', function (req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'})
  res.end(JSON.stringify({'message': 'hello, world!'}, null, 2))
})

app.use('/secrets', function(req, res) {
  // // 'walk' will simply concatenate the root with the filename, resulting
  // // in /path//filename if the trailing if the trailing slash is kept here
  // var passwordDir = process.env.PASSWORD_STORE_DIR.replace(/\/$/, '');
  var passwordDir = process.env.PASSWORD_STORE_DIR;
  var secrets = [];

  var walker = walk.walk(passwordDir, {
    followLinks: false
  });

  walker.on('file', function (root, fileStats, next) {
    if(root === passwordDir) {
      // skip everything in the root directory
      next();
    } else {
      var domain = path.basename(root);
      var extension = path.extname(fileStats.name);
      var username = path.basename(fileStats.name, extension);
      var relPath = path.relative(passwordDir, root);

      // skip everything without a domain
      if(domain) {
        // add file to secrets
        secrets.push({domain: domain, username: username, path: relPath});
      }

      next();

      // fs.readFile(fileStats.name, function () {
      //   // doStuff
      //   next();
      // });
    }
  });

  walker.on('errors', function (root, nodeStatsArray, next) {
    console.log('error', nodeStatsArray);
    next();
  });

  walker.on('end', function () {
    secrets = secrets.sort(function(secret1, secret2) {
      // localeCompare is case-insensitive
      return (secret1.domain.localeCompare(secret2.domain) ||
              secret1.username.localeCompare(secret2.username));
    });

    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(JSON.stringify(secrets, null, 2))
  });
});

app.use('/secret', function(req, res) {
  var passwordDir = process.env.PASSWORD_STORE_DIR;

  var relPath = req.body.path;
  if (typeof relPath === typeof void 0) {
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      'error': 'Invalid secret requested.'
    }, null, 2));
  }
  var username = req.body.username;
  if (typeof username === typeof void 0) {
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      'error': 'Invalid secret requested.'
    }, null, 2));
  }

  var secretPath = path.resolve(path.normalize(path.join(passwordDir, relPath, username + '.gpg')));
  if (path.relative(passwordDir, secretPath).substr(0, 2) === '..') {
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      'error': 'Invalid secret requested.'
    }, null, 2));
  }

  fs.stat(secretPath, function(err, fileStats) {
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
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          'error': 'Invalid secret requested.'
        }, null, 2));
      } else {
        fsAccess(secretPath, function(err) {
          if (err) {
            res.writeHead(503, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
              'error': 'Secret file is not readable.'
            }, null, 2));
          } else {
            fs.readFile(secretPath, function(err, data) {
              if(err) {
                res.writeHead(503, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                  'error': 'Unknown error.'
                }, null, 2));
              } else {
                // build ascii armored pgp message
                var checksum = function() {
                  var c = crc.crc24(data);
                  return new Buffer('' +
                      String.fromCharCode(c >> 16) +
                      String.fromCharCode((c >> 8) & 0xFF) +
                      String.fromCharCode(c & 0xFF),
                    'ascii').toString('base64');
                }();

                var pgpMessage = '';
                pgpMessage += '-----BEGIN PGP MESSAGE-----\n\n';
                pgpMessage += data.toString('base64') + '\n';
                pgpMessage += '=' + checksum + '\n';
                pgpMessage += '-----END PGP MESSAGE-----';

                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(pgpMessage);
              }
            });
          }
        });
      }
    }
  });
});


/**
 * Error handling.
 *
 * Test by executing 'fs.stat(null)' in a view.
 */

if (process.env.NODE_ENV === 'dev') {
  var notifier = require('node-notifier')
  // log everything to stdout
  app.use(morgan('short'), {stream: process.stdout})

  // must be 'used' after url routing otherwise none of the exceptions in a
  // view reaches this 'next' middleware
  app.use(errorHandler({log: function(err, str, req) {
    var title = 'Error in ' + req.method + ' ' + req.url

    notifier.notify({
      title: title,
      message: str,
      urgency: 'critical'
    })
  }}))
} else {
  app.use(errorHandler({log: function(err, str, req) {
    var transporter = nodeMailer.createTransport(sendmailTransport({
      path: '/usr/sbin/sendmail'
    }))
    transporter.sendMail({
      to: (process.env.ERROR_MAILTO || 'root@localhost'),
      from: (process.env.ERROR_MAILFROM || 'root@localhost'),
      subject: 'ERROR: ' + err.constructor.name + ' in ' + req.method + ' ' + req.url,
      text: err.stack,
      // html: err.stack.replace(/(?:\r\n|\r|\n)/g, '<br>')
    }, function callback(err, info) {
      if(err) {
        console.error(err)
      }
    })
  }}))
}

/**
 * Server start.
 */

var PORT = process.env.PORT || 8080
  , HOST = 'localhost'
http.createServer(app).listen(PORT, HOST)
