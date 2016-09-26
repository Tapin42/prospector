var request = require('request');
var cheerio = require('cheerio');
var urlObj  = require('url');
var Q       = require('q');

var RESULTS_URL = 'https://www.athlinks.com/Athletes/270213731/Race/265578040';

function readResults(req, res) { 
}

function convertToApi(url) {
    var urlBits = urlObj.parse(url);
    var rawPath = urlBits.pathname;
    var pathBits = rawPath.split('/');

    if (pathBits[1] !== 'Athletes' || pathBits[3] !== 'Race') {
        return 'Unexpected URL';
    }

    // From '/Athletes/[AID]/Race/[RID]' to '/Athletes/Api/[AID]/Races/[RID]'
    pathBits[3] = 'Races';
    pathBits.splice(2, 0, 'Api');

    urlBits.pathname = pathBits.join('/');
    return urlObj.format(urlBits);
}

function getAgeGroupFilterValue(ageGroupFilterUrl, ageGroupLabel) {
    var deferred = Q.defer();
    var ageGroupFinalUrl = '';

    // Binary Gender!  The Bay Area-me is sorely disappointed in the coder-me.
    var gender = 'Male';
    if (ageGroupLabel[0] === 'F') {
        gender = 'Female';
    }
    var ages = ageGroupLabel.split(' ')[1];

    request(ageGroupFilterUrl, function (err, resp, data) {
        if (!err) {
            var json = JSON.parse(data);

            if (json && json.Success && json.Result && json.Result.ViewModeFilterRangeDropDown) {
                var filterValue = '';
                for (var i=0; i<json.Result.ViewModeFilterRangeDropDown.length && filterValue === ''; i++) {
                    var filter = json.Result.ViewModeFilterRangeDropDown[i];
                    if (filter.Text[0] === gender[0] && filter.Text.split(' ')[1] === ages) {
                        filterValue = filter.Value;
                    }
                }
                if (filterValue) {
                    ageGroupFinalUrl = ageGroupFilterUrl + 
                        '&viewModeFilterRangeData=' + filterValue;
                }
            }
        // } else {
        //     // Couldn't retrieve the filters, so we're SOL
        }

        deferred.resolve(ageGroupFinalUrl);
    });

    return deferred.promise;
}

function parseBibInfo(rawJson) {
    var deferred = Q.defer();
    var json = JSON.parse(rawJson);
    if (json.Success) {
        var result = json.Result;
        var rv = {
            participant: {
                name:     result.DisplayName,
                bib:      result.BibNum
            },
            groups: {
                division: {
                    label: result.Race.Courses[0].CourseName,
                    url: 'TODO-Division'
                },
                gender: {
                    label: result.Gender,
                    url: 'TODO-Gender'
                },
                ageGroup: {
                    label: result.ClassName,
                    url: 'TODO-AgeGroup'
                }

            }
        };

        var race = result.Race;
        var course = race.Courses[0];
        var courseData = [course.CourseID, course.EventCourseID, course.ResultCount, course.CoursePatternID].join(':');
        rv.groups.division.url = 
            'https://www.athlinks.com/Events/Race/Api/' + race.RaceID + '/Course/Results' +
                '?isViewModeChange=false' + 
                '&courseData=' + encodeURIComponent(courseData);
        // First page of males is always M1
        rv.groups.gender.url = rv.groups.division.url +
                '&viewMode=O' +
                '&viewModeFilterRangeData=M1';
        // This one actually requires a second call, which we'll do a bit lower down.
        var ageGroupFilterUrl = rv.groups.division.url +
                '&viewMode=A';



        rv.splits = [];
        for (var i=0; i<result.LegEntries.length; i++) {
            rv.splits.push(result.LegEntries[i].TicksString);
        }
        rv.finishTime = result.TicksString;

        switch (result.Race.Courses[0].RaceCatDesc) {
            case 'Duathlon':
                rv.splitLabels = ['R1', 'T1', 'Bike', 'T2', 'R2'];
                break;

            case 'Triathlon & Multisport':
                rv.splitLabels = ['Swim', 'T1', 'Bike', 'T2', 'Run'];
                break;

            default:
                // TODO this'll be wrong for running races that report intermediate splits; figure that out when
                // I find a good example
                rv.splitLabels = [];
                break;
        }

        // Now we'll go ahead and worry about the async stuff we still have left to fill in
        getAgeGroupFilterValue(ageGroupFilterUrl, rv.groups.ageGroup.label).then(function (ageGroupUrl) {
            rv.groups.ageGroup.url = ageGroupUrl;
            deferred.resolve(rv);
        }).fail(function () {
            deferred.reject({ error: "Unable to figure out the age group filter" });
        })
    } else {
        deferred.reject({ error: "Server reported failure retrieving participant information" });
    }

    return deferred.promise;
}

function readBib(req, res) {
    var url = req.query.url || RESULTS_URL;
    var bibUrl = convertToApi(url);

    console.log('Requesting ' + bibUrl + '...');
    request(bibUrl, function (err, resp, json) {
        if (!err) {
            console.log('Got ' + bibUrl + ', parsing...');
            parseBibInfo(json).then(function (rv) {
                res.setHeader('content-type', 'application/json');
                res.send(JSON.stringify(rv));
                console.log('Done');
            });
        } else {
            res.send('Error reading from "' + bibUrl + '".');
        }
    });
}

module.exports = {
    domain:        'athlinks.com',
    readResults:   readResults,
    readBib:       readBib
};
