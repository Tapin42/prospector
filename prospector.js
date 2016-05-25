var DATA_URL = 'data.csv';
//var DATA_URL = 'http://georesults.racemine.com/USA-Productions/events/2016/Half-Moon-Bay-Triathlons/results';
var DIVISIONS_URL = 'http://localhost:7223/readDivisions';
var BIB_NUMBER = 887;
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

var divisions = {};

function loadAgeGroups(division) {
    var ageGroups = divisions[division];
    $('#ageGroupDrop').empty();
    if (ageGroups) {
        $.each(ageGroups, function (idx, val) {
            $('<li id="ag' + idx + '">' + val.StartAge + '-' + val.EndAge + '</li>').appendTo('#ageGroupDrop');
        });
        $('#ageGroupDropLabel').removeClass('disabled');
    } else {
        $('#ageGroupDropLabel').addClass('disabled');
    }
}

function loadDivisions() {
    $.ajax(DIVISIONS_URL)
        .then(function (data, status, jqXHR) {
            var divisionsRaw = JSON.parse(data);

            $.each(divisionsRaw, function (idx, val) {
                divisions[val.Name] = val.AgeGroups;
            });

            $.each(Object.keys(divisions), function (idx, val) {
                $('<li id="div' + idx + '" onclick="loadAgeGroups(\'' + val + '\')">' + val + '</li>').appendTo('#divisionDrop');
            });
            $('#divisionDropLabel').removeClass('disabled');

        })
        .fail(function (data, status, err) {
            // TODO Something better than this, I mean geez.  C'mon.
            alert('Couldn\'t read the divisions');
        });
}

// Zhu Li!
function doTheThing() {
    var settings = {
        url: DATA_URL,
        bib: queryString['bib'] || BIB_NUMBER,
        filters: {
            nonStarters: true,
            nonFinishers: true
        }
    };

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

function parseData(settings, data, status, jqXHR) {
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
                rawData.push(val.split(/,/));
            } else {
                position = buildPositions(val);
            }
        });
        D.resolve(settings, position, rawData);
    } else {
        D.reject(null, 'parseData failure', 'non-success status');
    }

    return D.promise();
}

function filterData(settings, position, rawData) {
    var D = $.Deferred();
    var data = rawData;
    var filters = settings.filters;

    if (filters.division) {
        data = data.filter(function (val) {
            return val[position['Division']] === filters.division;
        });
    }

    if (filters.gender) {
        data = data.filter(function (val) {
            return val[position['Gender']] === filters.gender;
        });
    }

    if (filters.ageGroup) {
        var bounds = filters.ageGroup.split('-').map(function (val) {
            return parseInt(val);
        });

        data = data.filter(function (val) {
            var age = parseInt(val[position['Age']]);
            return age >= bounds[0] && age <= bounds[1];
        });
    }

    if (!filters.nonStarters) {
        data = data.filter(function (val) {
            return val[position['Swim']] !== ZERO_DURATION;
        });
    }

    if (!filters.nonFinishers) {
        data = data.filter(function (val) {
            return val[position['Elapsed']] !== ZERO_DURATION;
        });
    }

    if (data.length) {
        D.resolve(settings, position, data);
    } else {
        D.reject(null, 'filterData failure', 'no data left after filtering');
    }

    return D.promise();
}

function computeStats(settings, position, filteredData) {
    var D = $.Deferred();
    var data = {};

    var bibStats = filteredData.filter(function (val) {
        return val[position['Bib']] === settings.bib+'';
    });
    if (bibStats.length !== 1) {
        D.reject(null, 'computeStats failure', 'bib not present in filtered data');
    }
    // Flatten it.  This would be faster to just loop through manually and grab the first row, of course.
    bibStats = bibStats[0];

    var dataWithElapsed = createAllTimes(position, filteredData);

    var interestingBits = { 
        bib: settings.bib
    };

    if (bibStats[position['USAT Penalty']] !== ZERO_DURATION) {
        interestingBits.penalty = true;
    }

    var threshKeys = [ 'Swim', 'T1', 'T1_elapsed', 'Bike', 'Bike_elapsed', 'T2', 'T2_elapsed', 'Run', 'Elapsed' ];
    var leadersKeys = [ 'Swim', 'T1_elapsed', 'Bike_elapsed', 'T2_elapsed', 'Elapsed' ];
    
    var thresh = { };
    $.each(threshKeys, function (idx, val) {
        thresh[val] = duration.convertToSeconds(bibStats[position[val]]);
        interestingBits[val] = {
            pos: 1,
            total: 0,
            leaders: new Set([])
        };
    });

    $.each(dataWithElapsed, function (racerIdx, racerVals) {
        $.each(threshKeys, function (threshIdx, stage) {
            if (racerVals[position[stage]] !== ZERO_DURATION) {
                interestingBits[stage].total += 1;

                if (duration.convertToSeconds(racerVals[position[stage]]) < thresh[stage]) {
                    interestingBits[stage].pos += 1;

                    // If this is one that we care about passed N/passed by M, put the bib in the array
                    if (leadersKeys.indexOf(stage) !== -1) {
                        interestingBits[stage].leaders.add(racerVals[position['Bib']]);
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

function createAllTimes(position, inData) {
    // Copy the data, because memory isn't a concern in 2016, right? :-P
    var rv = inData.slice();

    // Set up the positional indices, to be consistent
    position['T1_elapsed']   = Object.keys(position).length;
    position['Bike_elapsed'] = Object.keys(position).length;
    position['T2_elapsed']   = Object.keys(position).length;
    
    $.each(rv, function (idx, val) {
        val[position['T1_elapsed']]   = addDurations(val[position['Swim']], val[position['T1']]);
        val[position['Bike_elapsed']] = addDurations(val[position['T1_elapsed']], val[position['Bike']]);
        val[position['T2_elapsed']]   = addDurations(val[position['Bike_elapsed']], val[position['T2']]);
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

    $('#Swim_Nth').text(resultData['Swim'].pos);
    fillInPassers($('#Swim_Pos'), resultData['Swim']);
    $('#Swim_Total').text(resultData['Swim'].total);

    $('#T1_Nth').text(resultData['T1'].pos);
    fillInPassers($('#T1_Pos'), resultData['T1_elapsed']);
    $('#T1_Total').text(resultData['T1'].total);

    $('#Bike_Nth').text(resultData['Bike'].pos);
    fillInPassers($('#Bike_Pos'), resultData['Bike_elapsed']);
    $('#Bike_Total').text(resultData['Bike'].total);

    $('#T2_Nth').text(resultData['T2'].pos);
    fillInPassers($('#T2_Pos'), resultData['T2_elapsed']);
    $('#T2_Total').text(resultData['T2'].total);

    $('#Run_Nth').text(resultData['Run'].pos);
    fillInPassers($('#Run_Pos'), resultData['Elapsed']);
    $('#Run_Total').text(resultData['Run'].total);

    return D.promise();
}

function displayError(data, status, err) {
    $('#results').text('ERROR: ' + err);
}