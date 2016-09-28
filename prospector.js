var DATA_URL = 'data.csv';
//var DATA_URL = 'http://georesults.racemine.com/USA-Productions/events/2016/Half-Moon-Bay-Triathlons/results';
var BIB_NUMBER = 250;

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
            populateResults(JSON.parse(data));
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
            bib: results.bib
        });
    });

    $('#Compare_Gender').click(function() {
        doTheThing({
            url: buildUrl(results.groups.gender.url),
            bib: results.bib
        });
    });

    $('#Compare_AG').click(function() {
        doTheThing({
            url: buildUrl(results.groups.ageGroup.url),
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
    },

    isZero: function (dur) {
        return dur === "0:00:00" || dur === "00:00:00";
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
            return !duration.isZero(val.duration.swim);
        });
    }

    if (!filters.nonFinishers) {
        data = data.filter(function (val) {
            return !duration.isZero(val.duration.total);
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

    if (bibStats.penalty && !duration.isZero(bibStats.penalty)) {
        interestingBits.penalty = true;
    }

    var legKeys = [ 'swim', 't1', 'bike', 't2', 'run' ];
    var thresh = { }
    $.each(legKeys, function (idx, leg) {
        // First, the thresholds as provided by the racer in question -- what was their 
        // time (and total elapsed time) on each leg?
        thresh[leg] = {
            duration: duration.convertToSeconds(bibStats.legs[leg].duration),
            elapsed: duration.convertToSeconds(bibStats.legs[leg].elapsed)
        }

        // Then, set up the work area for how we'll evaluate the rest of the field --
        // - Each time we see a faster duration, we'll increment the appropriate counter
        // - Each time we see a faster elapsed time to that point, we'll note the faster racer's bib number
        //
        // By doing this, we can see 
        // - How fast this leg was compared to the field
        // - If the race ended at this leg, what position we'd be in
        // - How many people we passed or were passed by on the leg (since one person faster and one person 
        //   slower would result in the exact same position)
        interestingBits[leg] = {
            pos: 1,
            total: 0,
            leaders: new Set([])
        };

    });

    // And here's where we actually do the comparisons we mentioned above
    $.each(dataWithElapsed, function (racerIdx, racerVals) {
        $.each(legKeys, function (legIdx, leg) {
            
            if (!duration.isZero(racerVals.legs[leg].elapsed)) {
                interestingBits[leg].total += 1;

                // Was this person faster in this individual leg?
                if (duration.convertToSeconds(racerVals.legs[leg].duration) < thresh[leg].duration) {
                    interestingBits[leg].pos += 1;
                }

                // Was this person faster to get to the end of this leg, taking all legs 
                // to this point into account?
                if (duration.convertToSeconds(racerVals.legs[leg].elapsed) < thresh[leg].elapsed) {
                    interestingBits[leg].leaders.add(racerVals.bib);
                }
            }
        });
    });

    $.each(legKeys, function (legIdx, leg) {
        if (legIdx === 0) {
            // At the beginning, you get passed by everyone ahead of you and nobody behind you
            // (nb these stats could be computed in several ways, since "pos" and "leaders.size" should be
            // closely related)
            interestingBits[leg].passedBy = interestingBits[leg].leaders.size;
            interestingBits[leg].passed = interestingBits[leg].total - interestingBits[leg].pos;
        
        } else {
            var prevKey       = legKeys[legIdx-1];
            var curKey        = leg;
            var leadersBefore = new Set(interestingBits[prevKey].leaders);
            var leadersNow    = new Set(interestingBits[curKey].leaders);

            // Anyone in "leadersNow" but not in "leadersBefore" is someone who passed us.
            // Likewise, anyone in "leadersBefore" but not in "leadersNow" is someone we passed.
            
            leadersBefore.forEach(function (val) {
                if (leadersNow.has(val)) {
                    leadersBefore.delete(val);
                    leadersNow.delete(val);
                }
            });

            interestingBits[leg].passedBy = leadersNow.size;
            interestingBits[leg].passed = leadersBefore.size;
        }
    });

    D.resolve(interestingBits);


    return D.promise();
}

function createAllTimes(inData) {
    // Copy the data, because memory isn't a concern in 2016, right? :-P
    var rv = JSON.parse(JSON.stringify(inData));

    $.each(rv, function (idx, val) {
        val.legs      = { };
        val.legs.swim = { 
            duration: val.duration.swim,
            elapsed: val.duration.swim
        };

        val.legs.t1 = {
            duration: val.duration.t1,
            elapsed: addDurations(val.legs.swim.elapsed, val.duration.t1)
        };
        
        val.legs.bike = {
            duration: val.duration.bike,
            elapsed: addDurations(val.legs.t1.elapsed, val.duration.bike)
        };

        val.legs.t2 = {
            duration: val.duration.t2,
            elapsed: addDurations(val.legs.bike.elapsed, val.duration.t2)
        };

        // For the run, prefer the total duration as provided over our calculations, if available.
        val.legs.run = {
            duration: val.duration.run,
            elapsed: val.duration.total ? val.duration.total : addDurations(val.legs.t2.elapsed, val.duration.run)
        };

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
        $elt.html((1+data.leaders.size) + '<div class="passers">(Passed ' + data.passed + ', passed by ' + data.passedBy + ')</div>');
    }

    $('#BibNum').text(resultData.bib);

    $('#Swim_Nth').text(resultData.swim.pos);
    fillInPassers($('#Swim_Pos'), resultData.swim);
    $('#Swim_Total').text(resultData.swim.total);

    $('#T1_Nth').text(resultData.t1.pos);
    fillInPassers($('#T1_Pos'), resultData.t1);
    $('#T1_Total').text(resultData.t1.total);

    $('#Bike_Nth').text(resultData.bike.pos);
    fillInPassers($('#Bike_Pos'), resultData.bike);
    $('#Bike_Total').text(resultData.bike.total);

    $('#T2_Nth').text(resultData.t2.pos);
    fillInPassers($('#T2_Pos'), resultData.t2);
    $('#T2_Total').text(resultData.t2.total);

    $('#Run_Nth').text(resultData.run.pos);
    fillInPassers($('#Run_Pos'), resultData.run);
    $('#Run_Total').text(resultData.run.total);

    return D.promise();
}

function displayError(data, status, err) {
    $('#results').text('ERROR: ' + err);
}