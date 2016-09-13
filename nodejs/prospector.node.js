var express = require('express');
var cors    = require('cors');
var app     = express();

var racemine = require('./parsers/racemine.node.js');

app.use(cors());

var PORT = 7223;  // "RACE".  Geddit?

app.get('/readResults', function (req, res) {
    if (req.query.url.indexOf(racemine.domain) !== -1) {
        racemine.readResults(req, res);
    } else {
        res.send('{"error": "Unknown host"}');
    }
});

app.get('/readDivisions', function (req, res) {
    if (req.query.url.indexOf(racemine.domain) !== -1) {
        racemine.readDivisions(req, res);
    } else {
        res.send('{"error": "Unknown host"}');
    }

});

app.get('/readBib', function (req, res) {
    if (req.query.bib.indexOf(racemine.domain) !== -1) {
        racemine.readBib(req, res);
    } else {
        res.send('{"error": "Unknown host"}');
    }
});


app.listen(PORT);
console.log('Running on port ' + PORT);

exports = module.exports = app;