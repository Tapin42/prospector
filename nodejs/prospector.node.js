var express    = require('express');
var cors       = require('cors');
var fs         = require('fs');
var urlObj     = require('url');
var app        = express();

var PORT       = 7223;  // "RACE".  Geddit?
var PARSER_DIR = './parsers';

var parsers = [];

try {
    var parserFiles = fs.readdirSync(PARSER_DIR);

    for (var i=0; i<parserFiles.length; i++) {
        var newParser = require(PARSER_DIR + '/' + parserFiles[i]);
        parsers.push(newParser);
    }

} catch (err) {
    console.log("No parsers available or broken parser(s) present, this isn't going to end well.");
}

function assignTargetDomain(req, res, next) {
    req.targetDomain = '';

    if (req.query.url) {
        var url = urlObj.parse(req.query.url);
        req.targetDomain = url.host;
    }

    console.log('Requested host: ' + req.targetDomain);
    next();
}

function pickParser(req) {
    for (var i=0; i<parsers.length; i++) {
        if (req.targetDomain.indexOf(parsers[i].domain) !== -1) {
            return parsers[i];
        }
    }
    throw new Error('No parser available for ' + req.targetDomain);
}

function readResults(req, res) {
    try {
        pickParser(req).readResults(req, res);
    } catch (e) {
        res.send('{"error": "' + e + '"}');
    }
};

function readDivisions(req, res) {
    try {
        pickParser(req).readDivisions(req, res);
    } catch (e) {
        res.send('{"error": "' + e + '"}');        
    }
};

function readBib(req, res) {
    try {
        pickParser(req).readBib(req, res);
    } catch (e) {
        res.send('{"error": "' + e + '"}');
    }
};

app.use(cors());
app.use(assignTargetDomain);
app.get('/readResults', readResults);
app.get('/readDivisions', readDivisions);
app.get('/readBib', readBib);

app.listen(PORT);
console.log('Running on port ' + PORT);

exports = module.exports = app;