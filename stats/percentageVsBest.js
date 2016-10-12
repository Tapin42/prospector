var STAT_percentageVsBest = {

    AVERAGE_TOP_PCT_FINISHERS: 0.25,
    MIN_TOP_FINISHERS: 3,

    // 
    // The results of this compute function will include:
    // 
    // - percentVsBest: Percentage of the person responsible for the single best time for the split
    // - percentVsBestN: Percentage of the (configurable) computed marker time
    // 
    // These values will be stored in the "percentVsBest" key as an object with two keys:
    // 
    // - splits: An array of objects of the the above, one per split
    // - finish: A single object of the above
    // 
    // {
    //      percentVsBest: {
    //          finish: {
    //              percentVsBest: ...,
    //              percentVsBestN: ...
    //          },
    //          splits: [{ percentVsBest: ..., percentVsBestN: ... }, 
    //                   { percentVsBest: ..., percentVsBestN: ... },
    //                   { percentVsBest: ..., percentVsBestN: ... },
    //                   { percentVsBest: ..., percentVsBestN: ... },
    //                   { percentVsBest: ..., percentVsBestN: ... }]
    //      }
    // }
    // 
    compute: function (settings, data) {
        var D = $.Deferred();

        // First, find the times for the person we're worried about
        var bibStats = (function () {
            var bibIdx;
            var foundBib = false;
            for (bibIdx = 0; bibIdx<data.entrants.length && !foundBib; bibIdx++) {
                if ((data.entrants[bibIdx].bib+'') === (settings.bib+'')) {
                    foundBib = true;
                }
            }
            if (!foundBib) {
                D.reject(null, 'STAT_percentageVsBest failure', 'bib not present in filtered data');
            } else {
                // The index would've been incremented one too many
                bibIdx -= 1;
            }

            return data.entrants[bibIdx];
        })();

        // Next, let's create ordered arrays of the times.
        var splitTimes = [],
        var finishTimes = [],
        $.each(data.entrants, function (idx, val) {
            if (idx === 0) {
                // Create the multidimensional array in splitTimes
                for (i=0; i<val.splits.length; i++) {
                    splitTimes.push([val.splits[i]]);
                }
            } else {
                // Just push the new times into the array
                for (i=0; i<val.splits.length; i++) {
                    splitTimes[i].push(val.splits[i]);
                }
            }
            // Either way, push the finish time in
            finishTimes.push(val.finish);
        });

        // And once the arrays are created, we can sort them
        var sortedSplitTimes = [];
        var sortedFinishTimes = [];

        function compareTimeStrings(a, b) {
            return duration.convertToSeconds(a) - duration.convertToSeconds(b);
        }

        sortedFinishTimes = finishTimes.sort(compareTimeStrings);
        for (var i=0; i<splitTimes.length; i++) {
            sortedSplitTimes[i] = splitTimes[i].sort(compareTimeStrings);
        }

        // Average the top-N values and assign them
        var averageFinishTime;
        var averageSplitTime = [];
        var pctFinishers = settings.avgTopPctFinishers || STAT_percentageVsBest.AVERAGE_TOP_PCT_FINISHERS;
        var minFinishers = settings.minTopFinishers || STAT_percentageVsBest.MIN_TOP_FINISHERS;

        // Take the top percent...
        var numFinishers = Math.floor(pctFinishers * finishTimes.length);
        // ...unless that's too few (compared to our min-allowed)...
        if (numFinishers < minFinishers) {
            numFinishers = minFinishers;
        }
        // ...unless that's more than the total number of entrants we're looking at
        if (numFinishers > finishTimes.length) {
            numFinishers = finishTimes.length;
        }

        // Sum all the durations...
        for (var iEntrant=0; iEntrant<numFinishers; iEntrant++) {
            averageFinishTime += duration.convertToSeconds(sortedFinishTimes[iEntrant]);
            for (iSplit=0; iSplit<sortedSplitTimes.length; iSplit++) {
                if (iEntrant === 0) {
                    averageSplitTime[iSplit] = duration.convertToSeconds(sortedSplitTimes[iSplit][iEntrant]);
                } else {
                    averageSplitTime[iSplit] += duration.convertToSeconds(sortedSplitTimes[iSplit][iEntrant]);
                }
            }
        }
        // ...and average them
        averageFinishTime = Math.floor(averageFinishTime/numFinishers);
        for (var i=0; i<averageSplitTime.length; i++) {
            averageSplitTime[i] = Math.floor(averageSplitTime[i]/numFinishers);
        }

        // A quick note: We're going to compute percentages to the nearest tenth of a percent, so we use (n*1000)/10 to truncate
        function determinePercent(bibTime, markerTime) {
            return Math.round(duration.convertToSeconds(bibTime)*1000/duration.convertToSeconds(markerTime))/10;
        }

        // And finally fill out the data block
        var rv = {
            finish: {
                percentVsBest: determinePercent(bibStats.finish, sortedFinishTimes[0]),
                percentVsBestN: determinePercent(bibStats.finish, averageFinishTime)
            },
            splits: []
        };
        for (var i=0; i<splitTimes.length; i++) {
            // NB: We're creating the array of times here, and pushing on an object that contains the two keys that we want
            rv.splits.push([{
                percentVsBest: determinePercent(bibStats.splits[i], sortedSplitTimes[i][0]),
                percentVsBestN: determinePercent(bibStats.splits[i], averageSplitTime[i])
            }]);
        }

        data.percentVsBest = rv;
        D.resolve(settings, data);

        return D.promise();
    },

    // Display the table of percentages
    render: function (data) {
        var D = $.Deferred();
        console.log('ERROR: Unimplemented');
        D.resolve(data);
        return D.promise();
    }
};
