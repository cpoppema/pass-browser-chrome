'use strict';

/**
 * Node modules.
 */
var bodyParser = require('body-parser')
  , connect = require('connect')
  , connectRoute = require('connect-route')
  , errorHandler = require('errorhandler')
  , fileStreamRotator = require('file-stream-rotator')
  , fs = require('fs')
  , morgan = require('morgan')
  , nodeMailer = require('nodemailer')
  , path = require('path')
  , sendmailTransport = require('nodemailer-sendmail-transport')
  ;

/**
 * Local modules.
 */
var auth = require('./auth')
  , views = require('./views');

var app = connect();

/**
 * Logging.
 */

// ensure log directory exists
var logDirectory = path.join(__dirname, '/log');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

// create rotating access stream
var accessLogStream = fileStreamRotator.getStream({
  filename: path.join(logDirectory, '/access-%DATE%.log'),
  frequency: 'daily',
  verbose: false,
  date_format: 'YYYY-MM-DD'
});
// create rotating error stream
var errorLogStream = fileStreamRotator.getStream({
  filename: path.join(logDirectory, '/error-%DATE%.log'),
  frequency: 'daily',
  verbose: false,
  date_format: 'YYYY-MM-DD'
});

app.use(morgan('combined', {
  stream: accessLogStream,
  skip: function(req, res) { return res.statusCode >= 400; }
}));
app.use(morgan('combined', {
  stream: errorLogStream,
  skip: function(req, res) { return res.statusCode < 400; }
}));

/**
 * Parse the incoming request body as json.
 */
app.use(bodyParser.json());

/**
 * Authentication
 */
app.use(auth());

/**
 * Routing.
 */

app.use(connectRoute(views));

/**
 * Error handling.
 */

if (process.env.NODE_ENV === 'dev') {
  var notifier = require('node-notifier');
  // log everything to stdout
  app.use(morgan('short'), {stream: process.stdout});

  // must be 'used' after url routing otherwise none of the exceptions in a
  // view reaches this 'next' middleware
  app.use(errorHandler({log: function(err, str, req) {
    var title = 'Error in ' + req.method + ' ' + req.url;

    notifier.notify({
      title: title,
      message: str,
      urgency: 'critical'
    });
  }}));
} else {
  app.use(errorHandler({log: function(err, str, req) {
    var transporter = nodeMailer.createTransport(sendmailTransport({
      path: '/usr/sbin/sendmail'
    }));
    transporter.sendMail({
      to: (process.env.ERROR_MAILTO || 'root@localhost'),
      from: (process.env.ERROR_MAILFROM || 'root@localhost'),
      subject: 'ERROR: ' + err.constructor.name + ' in ' + req.method + ' ' + req.url,
      text: err.stack,
      // html: err.stack.replace(/(?:\r\n|\r|\n)/g, '<br>')
    }, function callback(err, info) {
      if (err) {
        console.error(err);
      }
    });
  }}));
}

/**
 * Server start.
 */

app.listen(process.env.PORT || 8080);
