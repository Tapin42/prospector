var expect    = require('chai').expect;
var request   = require('request');


function compareAry(a1, a2) {
    if (a1.length !== a2.length) {
        return false;
    }
    for (var i=0; i<a1.length; i++) {
        if (a1[i] !== a2[i]) {
            return false;
        }
    }
    return true;
}

describe('Eternaltiming.com parser', function () {

    describe('readBib', function () {

        this.timeout('10000');

        var targetUrl = 'http://raceresults.eternaltiming.com/index.cfm/20151107_Marin_County_Triathlon.htm?Fuseaction=Results&Bib=628';
        var prospectorUrl = 'http://localhost:7223/readBib?url=' + encodeURIComponent(targetUrl);
        var json;

        before(function (done) {
            request(prospectorUrl, function (err, resp, body) {
                json = JSON.parse(body);
                done();
            });
        });

        it('should have a participant.name', function () {
            expect(typeof(json.participant)).to.equal('object');
            expect(json.participant.name).to.equal('Jackson, Daniel');
        });

        it('should have a participant.bib', function () {
            expect(typeof(json.participant)).to.equal('object');
            expect(json.participant.bib).to.equal('628');
        });

        it('should have a list of labels for the splits (triathlon)', function () {
            expect(typeof(json.splitLabels)).to.equal('object');
            expect(json.splitLabels.length).to.equal(5);
            
            var expectedAry = ['Swim', 'Transition', 'Bike', 'Transition', 'Run'];
            expect(compareAry(expectedAry, json.splitLabels)).to.be.true;
        });

        it('should have the expected splits', function () {
            expect(typeof(json.splits)).to.equal('object');
            expect(json.splits.length).to.equal(5);

            var expectedAry = ['00:24:28', '00:02:41', '01:15:34', '00:01:28', '00:46:48'];
            expect(compareAry(expectedAry, json.splits)).to.be.true;
        });

        it('should have the expected finish time', function () {
            expect(typeof(json.finishTime)).to.equal('string');

            var expectedTime = '02:30:59';
            expect(json.finishTime).to.equal(expectedTime);
        });

        it('should have the three breakdown groups, with valid values', function () {
            expect(typeof(json.groups)).to.equal('object');
            expect(typeof(json.groups.ageGroup)).to.equal('object');

            expect(typeof(json.groups.division)).to.equal('object');
            expect(typeof(json.groups.division.label)).to.equal('string');
            expect(json.groups.division.label).to.equal('Olympic Triathlon Individual');
            expect(typeof(json.groups.division.url)).to.equal('string');
            expect(json.groups.division.url).to.equal('http://raceresults.eternaltiming.com/index.cfm/20151107_Marin_County_Triathlon.htm?Fuseaction=Results&Class=Olympic%20Triathlon%20Individual~All');
            
            expect(typeof(json.groups.gender)).to.equal('object');
            expect(typeof(json.groups.gender.label)).to.equal('string');
            expect(json.groups.gender.label).to.equal('M');
            // expect(typeof(json.groups.gender.url)).to.equal('string');
            // expect(json.groups.gender.url).to.equal('https://www.athlinks.com/Events/Race/Api/505280/Course/Results?isViewModeChange=false&courseData=753481%3A751266%3A341%3A118&viewMode=O&viewModeFilterRangeData=M1');

            expect(typeof(json.groups.ageGroup)).to.equal('object');
            expect(typeof(json.groups.ageGroup.label)).to.equal('string');
            expect(json.groups.ageGroup.label).to.equal('M40-44');
            expect(typeof(json.groups.ageGroup.url)).to.equal('string');
            expect(json.groups.ageGroup.url).to.equal('http://raceresults.eternaltiming.com/index.cfm/20151107_Marin_County_Triathlon.htm?Fuseaction=Results&Class=Olympic%20Triathlon%20Individual~M40-44');

        });
    });

    // describe('readResults', function () {

    //     this.timeout('20000');

    //     var targetUrl = 'https://www.athlinks.com/Events/Race/Api/505280/Course/Results?isViewModeChange=false&courseData=753481%3A751266%3A341%3A118&viewMode=A&viewModeFilterRangeData=M6510376';
    //     var prospectorUrl = 'http://localhost:7223/readResults?url=' + encodeURIComponent(targetUrl);
    //     var json;

    //     before(function (done) {
    //         request(prospectorUrl, function (err, resp, body) {
    //             json = JSON.parse(body);
    //             done();
    //         });
    //     });

    //     it('should have a valid set of labels', function () {
    //         expect(typeof(json.labels)).to.equal('object');

    //         var expectedAry = ["Swim", "Transition", "Bike/Cycle", "Transition", "Run"];
    //         expect(compareAry(expectedAry, json.labels)).to.be.true;
    //     });

    //     it('should have an array of entrants', function () {
    //         expect(typeof(json.entrants)).to.equal('object');
    //     });

    //     it('should have expected stats in each entrant block', function () {
    //         var entrant = json.entrants[0];
    //         expect(entrant.bib).to.equal('271');
    //         expect(entrant.name).to.equal('ERICK PIERCE');
    //         expect(entrant.finish).to.equal('2:15:15');

    //         var expectedAry = ["20:39", "08:55", "1:00:36", "01:20", "43:44"];
    //         expect(entrant.splits.length).to.equal(5);
    //         expect(compareAry(expectedAry, entrant.splits)).to.be.true;
    //     });
    // });

});