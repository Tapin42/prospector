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


function normalizeTime(inTime) {
    // This is going to be super-dumb for now.  Get rid of hours if it's just 00.
    var timeBits = inTime.split(':');
    if (timeBits.length === 3 && timeBits[0] === '00') {
        timeBits.shift();
    }
    return timeBits.join(':');
}

function buildUrl(opts) {
    var baseUrl = opts.baseUrl;
    var rawUrl = baseUrl.substr(0, baseUrl.lastIndexOf(opts.bib));
    var queryParams = ['q='];

    // All of this logic is Racemine-specific.  Which means it should really be on the back-end
    opts.division && queryParams.push('SearchDivision=' + encodeURIComponent(opts.division));
    opts.gender && queryParams.push('SearchGender=' + encodeURIComponent(opts.gender));
    if (opts.ageGroup) {
        queryParams.push('SearchAgeGroup=' + encodeURIComponent(opts.ageGroup));
    } else {
        queryParams.push('SearchAgeGroup=All');
    }

    rawUrl = rawUrl + 'search?' + queryParams.join('&');

    return rawUrl;
}

function parseBibInfo(html, bibUrl) {
    var $ = cheerio.load(html);

    var rv = {
        participant: {
            name:     null,
            bib:      null
        },
        groups: {
            division: {
                label: null,
                url: 'TODO-Division'
            },
            gender: {
                label: null,
                url: 'TODO-Gender'
            },
            ageGroup: {
                label: null,
                url: 'TODO-AgeGroup'
            }
        }
    };

    rv.participant.name = $('#modalStats h3:first-child').text();

    var $stats = $('#modalStats table > tbody');
    var storeLabels = false;
    var labels = [];
    var splits = [];

    $stats.children('tr').each(function (idx, elem) {
        $tr = $(this);
        var hdr = $tr.find('th').text();
        var val = $tr.find('td').text();

        if (storeLabels) {
            labels.push(hdr);
        }

        switch (hdr) {
            case 'Bib Number': 
                rv.participant.bib = val; 
                break;

            case 'Gender': 
                rv.groups.gender.label = val; 
                break;
            
            case 'Start Time': 
                storeLabels = true; 
                break;
            
            case 'Swim': 
            case 'T1': 
            case 'Bike': 
            case 'T2': 
            case 'Run': 
            case 'Run 1':
            case 'Run 2':
                splits.push(normalizeTime(val));
                break;

            case 'Elapsed': 
                rv.finishTime = val;
                labels.pop();
                storeLabels = false;
                break;
        };

        // And unfortunately the divisions and AG name are positional...
        if (idx === 1) {
            rv.groups.division.label = hdr;
        } else if (idx === 3) {
            rv.groups.ageGroup.label = hdr;
        }
    });

    // Determine which labels to use
    rv.splitLabels = [];  // Still need to figure out a reasonable default here
    if (labels.length === 5) {
        if (labels[0].match(/swim/i)) {
            // Assume triathlon
            rv.splitLabels = ['Swim', 'T1', 'Bike', 'T2', 'Run'];
        } else if (labels[0].match(/run/i)) {
            // Assume duathlon
            rv.splitLabels = ['R1', 'T1', 'Bike', 'T2', 'R2'];
        }
    }
    rv.splits = splits;

    // Build the URLs
    var opts = {
        baseUrl: bibUrl,
        bib: rv.participant.bib,
        division: rv.groups.division.label,
    };
    rv.groups.division.url = buildUrl(opts);
    
    opts.gender = rv.groups.gender.label;
    rv.groups.gender.url = buildUrl(opts);

    opts.ageGroup = rv.groups.ageGroup.label;
    rv.groups.ageGroup.url = buildUrl(opts);

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


function readBib(req, res) {
    var bibUrl = req.query.url ? req.query.url : BIB_URL;
    console.log('Requesting ' + bibUrl + '...');
    request(bibUrl, function (err, resp, html) {
        if (!err) {
            console.log('Got ' + bibUrl + ', parsing...');
            res.send(JSON.stringify(parseBibInfo(html, bibUrl)));
            console.log('Done');
        } else {
            res.send('Error reading from "' + bibUrl + '".');
        }
    });
}

module.exports = {
    domain:        'racemine.com',
    readResults:   readResults,
    readBib:       readBib
};
