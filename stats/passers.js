var STAT_passers = {
    
    // 
    // The results of this compute function will include:
    // 
    // - position: If the race were only this leg, where would the entrant finish?
    // - leaders: A set of all of the people who were in front of the entrant at the end of the leg, based on the full
    //              race clock
    // - total: The total number of people who completed this leg of the race
    // - passedBy: The number of people who passed the entrant during this leg of the race
    // - passers: The number of people whom the entrant passed during this leg of the race
    // 
    // These values will be stored in the "passers" key as an array, one block of info per split.
    // 
    compute: function (settings, data) {
        var D = $.Deferred();

        var passers = [];

        var bibIdx;
        var foundBib = false;
        for (bibIdx = 0; bibIdx<data.entrants.length && !foundBib; bibIdx++) {
            if ((data.entrants[bibIdx].bib+'') === (settings.bib+'')) {
                foundBib = true;
            }
        }
        if (!foundBib) {
            D.reject(null, 'STAT_passers failure', 'bib not present in filtered data');
        } else {
            // The index would've been incremented one too many
            bibIdx -= 1;
        }

        var bibStats = data.entrants[bibIdx];

        var thresh = { 
            splits: [],
            elapsed: []
        };

        for (var i=0; i<bibStats.splits.length; i++) {
            thresh.splits[i] = duration.convertToSeconds(bibStats.splits[i]);
            thresh.elapsed[i] = duration.convertToSeconds(data.elapsedTime[bibIdx][i]);

            // And let's set up the info for each split, as well
            passers[i] = {
                pos: 1,
                total: 0,
                leaders: new Set([])                
            };
        }

        // - Each time we see a faster duration, we'll increment the appropriate counter
        // - Each time we see a faster elapsed time to that point, we'll note the faster racer's bib number
        //
        // By doing this, we can see 
        // - How fast this split was compared to the field
        // - If the race ended at this split, what position we'd be in
        // - How many people we passed or were passed by on the split (since one person faster and one person 
        //   slower would result in the exact same position)
        $.each(data.entrants, function (racerIdx, racerVals) {
            var entrantSplits = data.entrants[racerIdx].splits;
            var entrantElapsed = data.elapsedTime[racerIdx];

            for (var i=0; i<bibStats.splits.length; i++) {
                if (!duration.isZero(entrantSplits[i])) {
                    passers[i].total += 1;

                    // Was this person faster in this individual leg?
                    if (duration.convertToSeconds(entrantSplits[i]) < thresh.splits[i]) {
                        passers[i].pos += 1;
                    }

                    // Was this person faster to get to the end of this leg, taking all legs 
                    // to this point into account?
                    if (duration.convertToSeconds(entrantElapsed[i]) < thresh.elapsed[i]) {
                        passers[i].leaders.add(racerVals.bib);
                    }
                }
            }
        });

        // And finally, use the above to actually generate the stats
        for (var i=0; i<bibStats.splits.length; i++) {
            if (i === 0) {
                // At the beginning, you get passed by everyone ahead of you and nobody behind you
                // (nb these stats could be computed in several ways, since "pos" and "leaders.size" should be
                // closely related)
                passers[i].passedBy = passers[i].leaders.size;
                passers[i].passed = passers[i].total - passers[i].pos;
            
            } else {
                var leadersBefore = new Set(passers[i-1].leaders);
                var leadersNow    = new Set(passers[i].leaders);

                // Anyone in "leadersNow" but not in "leadersBefore" is someone who passed us.
                // Likewise, anyone in "leadersBefore" but not in "leadersNow" is someone we passed.
                
                leadersBefore.forEach(function (val) {
                    if (leadersNow.has(val)) {
                        leadersBefore.delete(val);
                        leadersNow.delete(val);
                    }
                });

                passers[i].passedBy = leadersNow.size;
                passers[i].passed = leadersBefore.size;
            }
        };
        
        data.passers = passers;
        D.resolve(settings, data);

        return D.promise();        
    },

    // Display the table of passers/passed by/etc
    render: function (data) {
        var D = $.Deferred();

        var template = '\
                <div class="table-responsive"> \
                    <table class="table table-bordered table-striped"> \
                        <thead> \
                            <tr> \
                                <th></th> \
                                <th class="text-xs-center">Nth fastest leg</th> \
                                <th class="text-xs-center">Exited in position</th> \
                                <th class="text-xs-center">...out of</th> \
                            </tr> \
                        </thead> \
                        <tbody id="passersBody"></tbody> \
                    </table> \
                </div';
        $('#results').append(template);

        for (var i=0; i<data.passers.length; i++) {
            passers = data.passers[i];
            var splitRow = '\
                    <tr> \
                        <th class="text-nowrap" scope="row">' + data.labels[i] + '</th> \
                        <td>' + passers.pos + '</td> \
                        <td>' + (1+passers.leaders.size) + '<div class="passers">(Passed ' + passers.passed + ', passed by ' + passers.passedBy + ')</div></td> \
                        <td>' + passers.total + '</td> \
                    </tr>';
            $('#passersBody').append(splitRow);
        }

        D.resolve(data);
        return D.promise();
    }
};