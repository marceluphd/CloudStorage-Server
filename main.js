const express = require('express');
const bodyParser = require('body-parser');

// DB Helpers
const Users = require('./database-helpers/users');

// Middleware
const JsonKeyValidator = require('./middleware/json-validator');
const UserLoginValidator = require('./middleware/login-validator')
const RequestLogger = require('./middleware/request_logger')

// Config
const config = require('./config');
config.port = config.port || 8080;
config.verbose = config.verbose || false;
config.allow_registering = config.allow_registering || false;
config.test_routes = config.test_routes || false; 

config.requests_limiter_window_minutes = config.requests_limiter_window_minutes || 15 * 60 * 1000;
config.requests_limiter_max_requests = config.requests_limiter_max_requests || 500;

config.slowdown_window_minutes = config.slowdown_window_minutes || 15 * 60 * 1000;
config.slowdown_max_requests = config.slowdown_max_requests || 500;
config.slowdown_delay_ms = config.slowdown_delay_ms || 500;

var app = express()

// returns as key (for limiting and slowing down requests) returns the username or the ip (if no username is provided)
usernameOrIpKeyGenerator = function(req) {
    if (req.body['username'] != null) return req.body.username;
    else return req.ip;
};

// Setup Middlwares
app.use(bodyParser.json());

// requests throttler and limiter
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
    windowMs: config.requests_limiter_window_minutes * 60 * 1000,
    max: config.requests_limiter_max_requests,
    handler: function(req, res) {
        res.status(429).send({error: true, message: "Too Many Requests. Wait and try again."});
    },
    keyGenerator: usernameOrIpKeyGenerator
});

// requests slowdown
const slowDown = require('express-slow-down');
const speedLimiter = slowDown({
    windowMs: config.slowdown_window_minutes * 60 * 1000, 
    delayAfter: config.slowdown_max_requests,
    delayMs: config.slowdown_delay_ms,
    keyGenerator: usernameOrIpKeyGenerator
});

app.use(limiter);
app.use(speedLimiter);
if(config.verbose) app.use(RequestLogger());
app.use('/data', JsonKeyValidator(['username', 'password']));
app.use('/data', UserLoginValidator(app.locals.users))

// Debug Routes
if(config.test_routes) {
    app.get('/', function(req, res) {
        res.end(JSON.stringify(req.body));
    });
    app.post('/', function(req, res) {
        res.end(JSON.stringify(req.body));
    });
}

// Single Object Operations
app.get('/data/object', function (req, res) {
    req.userObj.get(req.body, function(err, result) {
        res.status(err? 400: 200);
        result["error"] = err;
        res.send(result);
    });
});
app.post('/data/object', function (req, res) {
    req.userObj.put(req.body, function(err) {
        res.status(err? 400: 200);
        res.send({"error": err});
    });
});

// Collections Operations
app.post('/data/collection', function (req, res) {
   req.userObj.add(req.body, function(err) {
    res.status(err? 400: 200);   
    res.send({"error": err});
   });
});
app.get('/data/collection', function(req, res) {
    req.userObj.filter(req.body, function(err, result) {
        if(err) {
            res.status(400).send({"error": true});
        } else {
            var parsedResult = {};
            parsedResult.error = false;
            parsedResult['result'] = result;
            res.send(parsedResult);
        }
    });
});

// Route for Registering new users
app.post('/user/register', function (req, res) {
    if(config.allow_registering) {   
        var username = req.body.username
        var password = req.body.password
        app.locals.users.register(username, password, function(error) {
            res.send({"error" : error})
        });
    } else {
        res.status(400).send("400 - Registering not allowed");
    }
})

// Connect to databae and run server
var db = require('./database-helpers/database');
db.initDatabaseConnection(config.mongodb_url, function(err, db) {
    if(!err) {
        app.locals.users = new Users(db);
        console.log("Server Listening on localhost:" + config.port);
        app.listen(config.port, '0.0.0.0');
    } else {
        console.log("Database init error");
    }
});