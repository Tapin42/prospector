var DATA_URL = 'data.csv';
//var DATA_URL = 'http://georesults.racemine.com/USA-Productions/events/2016/Half-Moon-Bay-Triathlons/results';
var BIB_NUMBER = 250;
var ZERO_DURATION = '0:00:00';

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

    var nodeEntrantUrl = "http://" + window.location.hostname + ":7223/readBib?bib=" + encodeURIComponent($('#entrantUrl').val());
    console.log(nodeEntrantUrl);

    $.ajax(nodeEntrantUrl)
        .then(function (data, textStatus, jqXHR) {
            populateResults(JSON.parse(data));
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            $('#entrantDetails').text('Error: ' + errorThrown);
        });
}

function populateResults(results) {

    function buildUrl(opts) {
        var baseUrl = $('#entrantUrl').val();
        var rawUrl = baseUrl.substr(0, baseUrl.lastIndexOf(results.bib));
        var queryParams = ['q='];

        opts.division && queryParams.push('SearchDivision=' + opts.division);
        opts.gender && queryParams.push('SearchGender=' + opts.gender);
        if (opts.ageGroup) {
            queryParams.push('SearchAgeGroup=' + opts.ageGroup);
        } else {
            queryParams.push('SearchAgeGroup=All');
        }

        rawUrl = rawUrl + 'search?' + queryParams.join('&');

        return "http://" + window.location.hostname + ":7223/readResults?url=" + encodeURIComponent(rawUrl);
    }

    $('#Results_Name').text(results.name);
    $('#Results_Bib').text(results.bib);
    $('#Results_Division').text(results.division);
    $('#Results_Gender').text(results.gender);
    $('#Results_AG').text(results.ageGroup);

    $('#Compare_Division').click(function() {
        doTheThing({
            url: buildUrl({
                division: results.division
            }),
            bib: results.bib
        });
    });

    $('#Compare_Gender').click(function() {
        doTheThing({
            url: buildUrl({
                division: results.division,
                gender: results.gender
            }),
            bib: results.bib
        });
    });

    $('#Compare_AG').click(function() {
        doTheThing({
            url: buildUrl({
                division: results.division,
                gender: results.gender,
                ageGroup: results.ageGroup.split(' ')[1]
            }),
            bib: results.bib
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
            nonFinishers: true
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
    }
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
        D.resolve(settings, JSON.parse(data));
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
    var data = rawData;
    var filters = settings.filters;

    if (filters.division) {
        data = data.filter(function (val) {
            return val.division === filters.division;
        });
    }

    if (filters.gender) {
        data = data.filter(function (val) {
            return val.gender === filters.gender;
        });
    }

    if (filters.ageGroup) {
        var bounds = filters.ageGroup.split('-').map(function (val) {
            return parseInt(val);
        });

        data = data.filter(function (val) {
            var age = parseInt(val.age);
            return age >= bounds[0] && age <= bounds[1];
        });
    }

    if (!filters.nonStarters) {
        data = data.filter(function (val) {
            return val.duration.swim !== ZERO_DURATION;
        });
    }

    if (!filters.nonFinishers) {
        data = data.filter(function (val) {
            return val.duration.total !== ZERO_DURATION;
        });
    }

    if (data.length) {
        D.resolve(settings, data);
    } else {
        D.reject(null, 'filterData failure', 'no data left after filtering');
    }

    return D.promise();
}

function computeStats(settings, filteredData) {
    var D = $.Deferred();
    var data = {};

    var dataWithElapsed = createAllTimes(filteredData);

    var bibStats = dataWithElapsed.filter(function (val) {
        return val.bib === settings.bib+'';
    });
    if (bibStats.length !== 1) {
        D.reject(null, 'computeStats failure', 'bib not present in filtered data');
    }
    // Flatten it.  This would be faster to just loop through manually and grab the first row, of course.
    bibStats = bibStats[0];

    var interestingBits = { 
        bib: settings.bib
    };

    if (bibStats.penalty && bibStats.penalty !== ZERO_DURATION) {
        interestingBits.penalty = true;
    }

    var threshKeys = [ 'duration.swim', 
                       'duration.t1', 'elapsed.t1', 
                       'duration.bike', 'elapsed.bike', 
                       'duration.t2', 'elapsed.t2', 
                       'duration.run', 'duration.total' ];
    var leadersKeys = [ 'duration.swim', 'duration.t1', 'duration.bike', 'duration.t2', 'duration.total' ];
    
    var thresh = { };
    $.each(threshKeys, function (idx, val) {
        var keys = val.split('.');
        thresh[val] = duration.convertToSeconds(bibStats[keys[0]][keys[1]]);
        interestingBits[val] = {
            pos: 1,
            total: 0,
            leaders: new Set([])
        };
    });

    $.each(dataWithElapsed, function (racerIdx, racerVals) {
        $.each(threshKeys, function (threshIdx, stage) {
            var keys = stage.split('.');
            if (racerVals[keys[0]][keys[1]] !== ZERO_DURATION) {
                interestingBits[stage].total += 1;

                if (duration.convertToSeconds(racerVals[keys[0]][keys[1]]) < thresh[stage]) {
                    interestingBits[stage].pos += 1;

                    // If this is one that we care about passed N/passed by M, put the bib in the array
                    if (leadersKeys.indexOf(stage) !== -1) {
                        interestingBits[stage].leaders.add(racerVals.bib);
                    }
                }
            }
        });
    });

    $.each(leadersKeys, function (leaderIdx, stage) {
        if (leaderIdx === 0) {
            // At the beginning, you get passed by everyone ahead of you and nobody behind you
            interestingBits[stage].passedBy = interestingBits[stage].leaders.size;
            interestingBits[stage].passed = interestingBits[stage].total - interestingBits[stage].pos;
        } else {
            var leadersBefore = new Set(interestingBits[leadersKeys[leaderIdx-1]].leaders);
            var leadersNow = new Set(interestingBits[stage].leaders);

            // Anyone in "leadersNow" but not in "leadersBefore" is someone who passed us.
            // Likewise, anyone in "leadersBefore" but not in "leadersNow" is someone we passed.
            
            leadersBefore.forEach(function (val) {
                if (leadersNow.has(val)) {
                    leadersBefore.delete(val);
                    leadersNow.delete(val);
                }
            });

            interestingBits[stage].passedBy = leadersNow.size;
            interestingBits[stage].passed = leadersBefore.size;
        }
    });

    D.resolve(interestingBits);


    return D.promise();
}

function createAllTimes(inData) {
    // Copy the data, because memory isn't a concern in 2016, right? :-P
    var rv = JSON.parse(JSON.stringify(inData));

    $.each(rv, function (idx, val) {
        val.elapsed      = { };
        val.elapsed.swim = val.duration.swim;
        val.elapsed.t1   = addDurations(val.duration.swim, val.duration.t1);
        val.elapsed.bike = addDurations(val.elapsed.t1, val.duration.bike);
        val.elapsed.t2   = addDurations(val.elapsed.bike, val.duration.t2);
    });

    return rv;
}

function addDurations(d1, d2) {
    return duration.convertToString(duration.convertToSeconds(d1) + duration.convertToSeconds(d2));
}

function displayResults(resultData) {
    var D = $.Deferred();

    console.log(resultData);

    function fillInPassers($elt, data) {
        $elt.html(data.pos + '<div class="passers">(Passed ' + data.passed + ', passed by ' + data.passedBy + ')</div>');
    }

    $('#BibNum').text(resultData.bib);

    $('#Swim_Nth').text(resultData['duration.swim'].pos);
    fillInPassers($('#Swim_Pos'), resultData['duration.swim']);
    $('#Swim_Total').text(resultData['duration.swim'].total);

    $('#T1_Nth').text(resultData['duration.t1'].pos);
    fillInPassers($('#T1_Pos'), resultData['elapsed.t1']);
    $('#T1_Total').text(resultData['duration.t1'].total);

    $('#Bike_Nth').text(resultData['duration.bike'].pos);
    fillInPassers($('#Bike_Pos'), resultData['elapsed.bike']);
    $('#Bike_Total').text(resultData['duration.bike'].total);

    $('#T2_Nth').text(resultData['duration.t2'].pos);
    fillInPassers($('#T2_Pos'), resultData['elapsed.t2']);
    $('#T2_Total').text(resultData['duration.t2'].total);

    $('#Run_Nth').text(resultData['duration.run'].pos);
    fillInPassers($('#Run_Pos'), resultData['duration.total']);
    $('#Run_Total').text(resultData['duration.run'].total);

    return D.promise();
}

function displayError(data, status, err) {
    $('#results').text('ERROR: ' + err);
}