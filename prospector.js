var DATA_URL = 'data.csv';
var BIB_NUMBER = 233;
var ZERO_DURATION = '0:00:00';

// Zhu Li!
function doTheThing() {
    var settings = {
        url: DATA_URL,
        bib: BIB_NUMBER,
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
    
    var thresh = { };
    $.each(threshKeys, function (idx, val) {
        thresh[val] = duration.convertToSeconds(bibStats[position[val]]);
        interestingBits[val] = {
            pos: 1,
            total: 0
        };
    });

    $.each(dataWithElapsed, function (racerIdx, racerVals) {
        $.each(threshKeys, function (threshIdx, stage) {
            if (racerVals[position[stage]] !== ZERO_DURATION) {
                interestingBits[stage].total += 1;

                if (duration.convertToSeconds(racerVals[position[stage]]) < thresh[stage]) {
                    interestingBits[stage].pos += 1;
                }
            }
        });
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

    $('#BibNum').text(resultData.bib);

    $('#Swim_Nth').text(resultData['Swim'].pos);
    $('#Swim_Pos').text(resultData['Swim'].pos);
    $('#Swim_Total').text(resultData['Swim'].total);

    $('#T1_Nth').text(resultData['T1'].pos);
    $('#T1_Pos').text(resultData['T1_elapsed'].pos);
    $('#T1_Total').text(resultData['T1'].total);

    $('#Bike_Nth').text(resultData['Bike'].pos);
    $('#Bike_Pos').text(resultData['Bike_elapsed'].pos);
    $('#Bike_Total').text(resultData['Bike'].total);

    $('#T2_Nth').text(resultData['T2'].pos);
    $('#T2_Pos').text(resultData['T2_elapsed'].pos);
    $('#T2_Total').text(resultData['T2'].total);

    $('#Run_Nth').text(resultData['Run'].pos);
    $('#Run_Pos').text(resultData['Elapsed'].pos);
    $('#Run_Total').text(resultData['Run'].total);

    return D.promise();
}

function displayError(data, status, err) {
    $('#results').text('ERROR: ' + err);
}