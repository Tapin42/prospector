var request = require('request');
var cheerio = require('cheerio');
var urlObj  = require('url');
var Q       = require('q');

var DIVISIONS_URL = 'http://georesults.racemine.com/USA-Productions/events/2016/Oakland-Triathlon-Festival/results';
// var DIVISIONS_URL = 'http://localhost/prospector/nodejs/oakland_tri_results.html';
var BIB_URL = 'http://georesults.racemine.com/USA-Productions/events/2016/Oakland-Triathlon-Festival/250/entrant/share';
// var BIB_URL = 'http://localhost/prospector/nodejs/oakland_bib_250.html';
var RESULTS_URL = 'http://georesults.racemine.com/usa-productions/events/2016/oakland-triathlon-festival/search?q=&SearchDivision=INT-AGE+GROUP&SearchGender=M&SearchAgeGroup=40-44&pageSize=50&EventKey=15478&page=1&sortcolumn=&sortdirection=&_=1470152672573';
// var RESULTS_URL = 'http://georesults.racemine.com/usa-productions/events/2016/oakland-triathlon-festival/search?q=&SearchDivision=INT-AGE+GROUP&pageSize=50&EventKey=15478&page=1&sortcolumn=&sortdirection=&_=1470152672573';

// "http://georesults.racemine.com/usa-productions/events/2016/oakland-triathlon-festival/search?q=
// &SearchDivision=INT-AGE+GROUP
// &SearchGender=M
// &SearchAgeGroup=40-44
// &pageSize=50
// &EventKey=15478
// &page=1
// &sortcolumn=
// &sortdirection=
// &_=1470152672573";

function parseBibInfo(html) {
    var $ = cheerio.load(html);

    var rv = {
        name: null,
        bib: null,
        division: null,
        gender: null,
        ageGroup: null,
        duration: {
            swim: null,
            t1: null,
            bike: null,
            t2: null,
            run: null,
            total: null
        }
    };

    rv.name = $('#modalStats h3:first-child').text();

    var $stats = $('#modalStats table > tbody');
    $stats.children('tr').each(function (idx, elem) {
        $tr = $(this);
        var hdr = $tr.find('th').text();
        var val = $tr.find('td').text();

        switch (hdr) {
            case 'Bib Number': rv.bib = val; break;
            case 'Gender': rv.gender = val; break;
            case 'Swim': rv.duration.swim = val; break;
            case 'T1': rv.duration.t1 = val; break;
            case 'Bike': rv.duration.bike = val; break;
            case 'T2': rv.duration.t2 = val; break;
            case 'Run': rv.duration.run = val; break;
            case 'Elapsed': rv.duration.total = val; break;
        };

        // And unfortunately the divisions and AG name are positional...
        if (idx === 1) {
            rv.division = hdr;
        } else if (idx === 3) {
            rv.ageGroup = hdr;
        }
    });

    return rv;
}

function parseSearchInfo(html) {
    var $ = cheerio.load(html);

    var rv = []; 
    var cols = {
        bib: -1,
        duration: {
            swim: -1,
            t1: -1,
            bike: -1,
            t2: -1,
            run: -1,
            total: -1
        }
    };

    var $cols = $('table > thead > tr');
    $cols.children('th').each(function (idx, elem) {
        var hdr = $(this).text();

        switch (hdr) {
            case 'Bib': cols.bib = idx; break;
            case 'Swim': cols.duration.swim = idx; break;
            case 'T1': cols.duration.t1 = idx; break;
            case 'Bike': cols.duration.bike = idx; break;
            case 'T2': cols.duration.t2 = idx; break;
            case 'Run': cols.duration.run = idx; break;
            case 'Elapsed': cols.duration.total = idx; break;
        }
    });

    var $stats = $('table > tbody');
    $stats.children('tr').each(function (idx, elem) {
        var entrant = {
            bib: null,
            duration: {
                swim: null,
                t1: null,
                bike: null,
                t2: null,
                run: null,
                total: null
            }
        };

        $(this).children('td').each(function (tdIdx, tdElem) {
            if (tdIdx === cols.bib) {
                entrant.bib = $(tdElem).find('span').text();
            } else if (tdIdx === cols.duration.swim) {
                entrant.duration.swim = $(tdElem).find('span').text();
            } else if (tdIdx === cols.duration.t1) {
                entrant.duration.t1 = $(tdElem).find('span').text();
            } else if (tdIdx === cols.duration.bike) {
                entrant.duration.bike = $(tdElem).find('span').text();
            } else if (tdIdx === cols.duration.t2) {
                entrant.duration.t2 = $(tdElem).find('span').text();
            } else if (tdIdx === cols.duration.run) {
                entrant.duration.run = $(tdElem).find('span').text();
            } else if (tdIdx === cols.duration.total) {
                entrant.duration.total = $(tdElem).find('span').text();
            }
        });

        rv[idx] = entrant;
    });

    return rv;
}

function readResultPage(urlText, prevResults) {
    var deferred = Q.defer();
    var rv = (prevResults && prevResults.length) ? prevResults : [];
    var url = urlObj.parse(urlText, true);
    url.query._ = Date.now();
    
    // Default page size and page number
    if (!url.query.pageSize) {
        url.query.pageSize = 50;
    }

    if (!url.query.page) {
        url.query.page = 1;
    }

    url.search = null;

    console.log('Requesting ' + urlObj.format(url) + '...');
    request(urlObj.format(url), function (err, resp, html) {
        if (!err) {
            console.log('Got ' + urlObj.format(url) + ', parsing with cheerio...');
            var $ = cheerio.load(html);

            var newResults = parseSearchInfo(html);

            if (newResults && newResults.length) {
                rv = rv.concat(newResults);
            }

            console.log('page: ' + url.query.page + ' / pageSize: ' + url.query.pageSize + ' / newResults.length: ' + newResults.length);
            if (newResults.length === parseInt(url.query.pageSize)) {
                // Silly clone...
                var nextUrl = urlObj.parse(urlObj.format(url), true);
                // console.log('nextUrl, after cloning but before page increment: ' + urlObj.format(nextUrl));
                // ... and request the next page
                nextUrl.query.page = parseInt(nextUrl.query.page) + 1;
                nextUrl.search = null;
                // console.log('nextUrl, after page increment: ' + urlObj.format(nextUrl));

                readResultPage(urlObj.format(nextUrl), rv)
                    .then(function (allResults) {
                        deferred.resolve(allResults);
                    }).fail (function () {
                        deferred.reject();
                    });
            } else {
                deferred.resolve(rv);
            }
        } else {
            deferred.reject(err);
        }
    });

    return deferred.promise;
}

function readResults(req, res) {
    var url = req.query.url || RESULTS_URL;

    readResultPage(url)
        .then(function (rv) {
            res.send(JSON.stringify(rv));
            console.log('Done');
        })
        .fail(function (rv) {
            res.send('Error reading from "' + urlObj.format(url) + '": ' + rv + '.');
        });
}


//TODO: Prove this is useful, or eliminate it.  It's not currently being used and is in danger of 
//      just being cruft.  Might already be past that point.
function readDivisions(req, res) {
    var url = DIVISIONS_URL;
    console.log('Requesting ' + url + '...');
    request(url, function (err, resp, html) {
        if (!err) {
            console.log('Got ' + url + ', parsing with cheerio...');
            var $ = cheerio.load(html);
            // console.log('Looking for divisions...');
            // console.log(req);
            // for (var k in res) {
            //     console.log('k: ' + k);
            // }
            // console.log(req.origin);

            res.send($('#Divisions').val());
            console.log('Done');
        } else {
            res.send('Error reading from "' + url + '".');
        }
    });
}

function readBib(req, res) {
    var bibUrl = req.query.url ? req.query.url : BIB_URL;
    console.log('Requesting ' + bibUrl + '...');
    request(bibUrl, function (err, resp, html) {
        if (!err) {
            console.log('Got ' + bibUrl + ', parsing...');
            res.send(JSON.stringify(parseBibInfo(html)));
            console.log('Done');
        } else {
            res.send('Error reading from "' + bibUrl + '".');
        }
    })
}

module.exports = {
    domain:'racemine.com',
    readResults: readResults,
    readDivisions: readDivisions,
    readBib: readBib
};