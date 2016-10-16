var STATS = [
    STAT_elapsedTimes,
    STAT_passers,
    STAT_percentageVsBest
];


// http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
var queryString = (function(a) {
    if (a == "") return {};
    var b = {};
    for (var i = 0; i < a.length; ++i)
    {
        var p=a[i].split('=', 2);
        if (p.length == 1)
            b[p[0]] = "";
        else
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
})(window.location.search.substr(1).split('&'));

function getEntrant() {

    var nodeEntrantUrl = "http://" + window.location.hostname + ":7223/readBib?url=" + encodeURIComponent($('#entrantUrl').val());
    console.log(nodeEntrantUrl);

    $.ajax(nodeEntrantUrl)
        .then(function (data, textStatus, jqXHR) {
            if (typeof(data) === 'string') {
                data = JSON.parse(data);
            }
            populateResults(data);
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            $('#entrantDetails').text('Error: ' + errorThrown);
        });
}

function buildUrl(url) {
    return 'http://' + window.location.hostname + ':7223/readResults?url=' + encodeURIComponent(url);
}

function populateResults(results) {

    $('#Results_Name').text(results.participant.name);
    $('#Results_Bib').text(results.participant.bib);
    $('#Results_Division').text(results.groups.division.label);
    $('#Results_Gender').text(results.groups.gender.label);
    $('#Results_AG').text(results.groups.ageGroup.label);

    $('#Compare_Division').click(function() {
        doTheThing({
            url: buildUrl(results.groups.division.url),
            bib: results.participant.bib
        });
    });

    $('#Compare_Gender').click(function() {
        doTheThing({
            url: buildUrl(results.groups.gender.url),
            bib: results.participant.bib
        });
    });

    $('#Compare_AG').click(function() {
        doTheThing({
            url: buildUrl(results.groups.ageGroup.url),
            bib: results.participant.bib
        });
    });

    window.results = results;
}

// Zhu Li!
function doTheThing(options) {
    if (!options) {
        options = {};
    }

    var settings = {
        url: options.url || DATA_URL,
        bib: options.bib || queryString['bib'] || BIB_NUMBER,
        filters: {
            nonStarters: true,
            nonFinishers: false
        }
    };

    var parseData = parseDataRacemine;

    loadData(settings)
        .then(parseData)
        .then(filterData)
        .then(computeStats)
        .then(displayResults)
        .fail(displayError);
}

// Duration utility object.  May want to put this in a separate source file at some point.
var duration = {

    convertToSeconds: function (strDur) {
        var bits = strDur.split(':');
        var nSecs = parseInt(bits.pop());
        if (bits.length) {
            // Minutes
            nSecs += parseInt(bits.pop()*60);
        }
        if (bits.length) {
            // Hours
            nSecs += parseInt(bits.pop()*60*60);
        }

        return nSecs;
    },

    convertToString: function (secs) {
        function pad(n, width, z) {
            z = z || '0';
            n = n + '';
            return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
        }

        var rv = '';

        // Hours
        rv += Math.floor((secs/(60*60)))+':';
        secs %= (60*60);

        // Minutes
        rv += pad(Math.floor(secs/60), 2, '0')+':';
        secs %= 60;

        // Seconds
        rv += pad(secs, 2, '0')+'';

        return rv;
    },

    isZero: function (dur) {
        return dur === "0:00:00" || dur === "00:00:00";
    }
}

function addDurations(d1, d2) {
    return duration.convertToString(duration.convertToSeconds(d1) + duration.convertToSeconds(d2));
}

function loadData(settings) {
    var D = $.Deferred();

    $.ajax(settings.url)
        .then(function (data, status, jqXHR) {
            D.resolve(settings, data, status, jqXHR);
        })
        .fail(function (data, status, err) {
            D.reject(settings, data, status, err);
        });

    return D.promise();
}

//TODO: This takes the results from the node side, and is already (stringified) JSON.  parseDataCsv
//  builds an array of data with positional data taken from the header.  Honestly, we should probably
//  switch parseDataCsv and the downstream handlers to build a JSON array like the node-side results,
//  since that's how we'll want to build everything anyway
function parseDataRacemine(settings, data, status, jqXHR) {
    var D = $.Deferred();
    if (status === 'success') {
        if (typeof(data) === 'string') {
            data = JSON.parse(data);
        }
        D.resolve(settings, data);
    } else {
        D.reject(null, 'parseData failure', 'non-success status');
    }

    return D.promise();
}

function parseDataCsv(settings, data, status, jqXHR) {
    function buildPositions(rawHeader) {
        var posData = rawHeader.split(/,/);
        var rv = {};
        $.each(posData, function (idx, val) {
            rv[val] = idx;
        });

        return rv;
    }

    var D = $.Deferred();
    if (status === 'success') {
        var position = {};
        var rawData = [];

        $.each(data.split(/\r\n|\n/), function (idx, val) {
            if (idx > 0) {
                var row = val.split(/,/);
                rawData.push({
                    bib: row[position['Bib']],
                    name: row[position['Name']],
                    team: row[position['Team']],
                    start: row[position['Start']],
                    division: row[position['Division']],
                    gender: row[position['Gender']],
                    age: row[position['Age']],
                    duration: {
                        swim: row[position['Swim']],
                        t1: row[position['T1']],
                        bike: row[position['Bike']],
                        t2: row[position['T2']],
                        run: row[position['Run']],
                        total: row[position['Elapsed']]
                    },
                    placements: {
                        division: row[position['Div Place']],
                        gender: row[position['Gender Place']],
                        age: row[position['Age Place']]
                    }
                });
            } else {
                position = buildPositions(val);
            }
        });
        D.resolve(settings, rawData);
    } else {
        D.reject(null, 'parseData failure', 'non-success status');
    }

    return D.promise();
}

function filterData(settings, rawData) {
    var D = $.Deferred();
    var entrantData = rawData.entrants;
    var filters = settings.filters;

    if (!filters.nonStarters) {
        entrantData = entrantData.filter(function (val) {
            return !duration.isZero(val.splits[0]);
        });
    }

    if (!filters.nonFinishers) {
        entrantData = entrantData.filter(function (val) {
            return !duration.isZero(val.finish);
        });
    }

    if (entrantData.length) {
        rawData.entrants = entrantData;
        D.resolve(settings, rawData);
    } else {
        D.reject(null, 'filterData failure', 'no data left after filtering');
    }

    return D.promise();
}

function computeStats(settings, filteredData) {
    var D = $.Deferred();

    var promise = STATS[0].compute(settings, filteredData);
    for (var i=1; i < STATS.length; i++) {
        if (STATS[i].compute) {
            promise = promise.then(STATS[i].compute);
        } else {
            console.log('Stats package at index ' + i  + ' appears to be incomplete.  Discarding it.');
            STATS.splice(i, 1);
        }
    }
    promise.then(function (settings, data) {
        D.resolve(data);
    });
    
    return D.promise();
}

function displayResults(resultData) {
    var D = $.Deferred();

    var promise = STATS[0].render(resultData);
    for (var i=1; i < STATS.length; i++) {
        promise = promise.then(STATS[i].render);
    }
    promise.then(function (data) {
        D.resolve(data);
    });

    return D.promise();
}

function displayError(data, status, err) {
    $('#results').text('ERROR: ' + err);
}