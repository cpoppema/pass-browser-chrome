'use strict'

var bodyParser = require('body-parser')
  , connect = require('connect')
  , errorhandler = require('errorhandler')
  , fileStreamRotator = require('file-stream-rotator')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , morgan = require('morgan')
  , nodemailer = require('nodemailer')
  , path = require('path')
  , sendmailTransport = require('nodemailer-sendmail-transport')

var app = connect()

// parse incoming requests as json
app.use(bodyParser.json())

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
  app.use(errorhandler({log: function(err, str, req) {
    var title = 'Error in ' + req.method + ' ' + req.url

    notifier.notify({
      title: title,
      message: str,
      urgency: 'critical'
    })
  }}))
} else {
  app.use(errorhandler({log: function(err, str, req) {
    var transporter = nodemailer.createTransport(sendmailTransport({
      path: '/usr/sbin/sendmail'
    }))
    transporter.sendMail({
      to: (process.env.ERROR_MAILTO || 'root@localhost'),
      from: (process.env.ERROR_MAILTO || 'root@localhost'),
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
  , HOST = process.env.HOST || '0.0.0.0'

// if (PORT === 443) {
//   var options = {
//     key: fs.readFileSync('key.pem'),
//     cert: fs.readFileSync('cert.pem')
//   }
//   https.createServer(options, app).listen(PORT, HOST)
// } else {
  http.createServer(app).listen(PORT, HOST)
// }
