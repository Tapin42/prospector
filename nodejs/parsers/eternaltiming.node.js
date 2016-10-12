var request = require('request');
var cheerio = require('cheerio');
var urlObj  = require('url');
var Q       = require('q');

function parseLabels($) {
    var rv = [];
    $('.resultsTable th[colspan="3"]').each(function () { 
        rv.push($(this).text());
        rv.push('Transition');
    });
    rv.pop();

    return rv;
}

function parseEntrants($) {
    var entrants = [];

    $('.resultsTable tbody tr').each(function () {
        var entrant = {};

        var $cols = $(this).children('td');
        
        entrant.bib      = $cols.eq(0).text();
        entrant.name     = $cols.eq(1).text();
        entrant.gender   = $cols.eq(3).text();
        entrant.division = $cols.eq(5).text();
        entrant.ageGroup = $cols.eq(6).text();
        entrant.finish   = $cols.eq(8).text();
        entrant.splits   = [
            $cols.eq(12).text(), $cols.eq(14).text(), $cols.eq(16).text(), $cols.eq(18).text(), $cols.eq(20).text()
        ];

        entrants.push(entrant);
    });

    return entrants;
}

function buildUrl(baseUrl, clas) {
    var url = urlObj.parse(baseUrl, true);
    delete url.query.Bib;
    url.query.Class = clas;
    url.search = null;

    return urlObj.format(url);
}

function parseBibInfo(html, bibUrl) {
    var $ = cheerio.load(html);

    var labels = parseLabels($);
    var entrants = parseEntrants($);
    var bibInfo = entrants[0];

    var rv = {
        participant: {
            name:     bibInfo.name,
            bib:      bibInfo.bib
        },
        groups: {
            division: {
                label: bibInfo.division,
                url: buildUrl(bibUrl, bibInfo.division + '~All')
            },
            gender: {
                label: bibInfo.gender,
                url: null // This site doesn't support gender breakdowns as such.  Weird.
            },
            ageGroup: {
                label: bibInfo.ageGroup,
                url: buildUrl(bibUrl, bibInfo.division + '~' + bibInfo.ageGroup)
            }
        },
        splitLabels: labels,
        splits: bibInfo.splits,
        finishTime: bibInfo.finish
    };

    return rv;
}

function parseResults(html) {
    var $ = cheerio.load(html);

    var labels = parseLabels($);
    var entrants = parseEntrants($);

    return {
        labels: labels,
        entrants: entrants
    };
}

function readResults(req, res) {
    var url = req.query.url;
    console.log('Requesting ' + bibUrl + '...');
    request({
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36'
            }
        }, function (err, resp, html) {
        if (!err) {
            console.log('Got ' + url + ', parsing...');
            res.setHeader('content-type', 'application/json');
            res.send(JSON.stringify(parseResults(html)));
            console.log('Done');
        } else {
            res.send('Error reading from "' + url + '".');
        }
    });
}

function readBib(req, res) {
    var bibUrl = req.query.url;
    console.log('Requesting ' + bibUrl + '...');
    request({ 
            url: bibUrl, 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36'
            }
        }, function (err, resp, html) {
        if (!err) {
            console.log('Got ' + bibUrl + ', parsing...');
            res.setHeader('content-type', 'application/json');
            res.send(JSON.stringify(parseBibInfo(html, bibUrl)));
            console.log('Done');
        } else {
            res.send('Error reading from "' + bibUrl + '".');
        }
    });
}

module.exports = {
    domain:        'eternaltiming.com',
    readResults:   readResults,
    readBib:       readBib
};
