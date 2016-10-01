var STAT_elapsedTimes = {

    // 
    // The results of this compute function will include:
    // 
    // - One array of elapsed times, computed by summing the splits, for each entrant
    // 
    // These values will be stored in the "elapsedTime" key as an array, one block of info per race entrant.
    // 
    compute: function (settings, data) {
        var D = $.Deferred();

        data.elapsedTime = [];

        $.each(data.entrants, function (idx, val) {
            var newElapsed;
            $.each(val.splits, function (splitIdx, splitVal) {
                if (splitIdx === 0) {
                    newElapsed = [ splitVal ];
                } else if (duration.isZero(splitVal)) {
                    // If the split is a zero, the racer didn't complete this leg; everything beyond here should be zero
                    newElapsed.push('00:00');
                } else {
                    newElapsed.push(addDurations(newElapsed[newElapsed.length-1], splitVal));
                }
            });
            data.elapsedTime[idx] = newElapsed;
        });

        D.resolve(settings, data);

        return D.promise();
    },

    // This function doesn't render anything of note
    render: function (data) {
        var D = $.Deferred();
        D.resolve(data);
        return D.promise();
    }
};
