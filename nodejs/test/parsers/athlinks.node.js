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

describe('Athlinks.com parser', function () {

    describe('readBib', function () {

        this.timeout('10000');

        var targetUrl = 'https://www.athlinks.com/Athletes/270213731/Race/265578040';
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
            expect(json.participant.name).to.equal('Joe Navratil');
        });

        it('should have a participant.bib', function () {
            expect(typeof(json.participant)).to.equal('object');
            expect(json.participant.bib).to.equal('250');
        });

        it('should have a list of labels for the splits (triathlon)', function () {
            expect(typeof(json.splitLabels)).to.equal('object');
            expect(json.splitLabels.length).to.equal(5);
            
            var expectedAry = ['Swim', 'T1', 'Bike', 'T2', 'Run'];
            expect(compareAry(expectedAry, json.splitLabels)).to.be.true;
        });

        it('should have the expected splits', function () {
            expect(typeof(json.splits)).to.equal('object');
            expect(json.splits.length).to.equal(5);

            var expectedAry = ["27:13", "10:01", "1:06:45", "01:16", "47:49"];
            expect(compareAry(expectedAry, json.splits)).to.be.true;
        });

        it('should have the expected finish time', function () {
            expect(typeof(json.finishTime)).to.equal('string');

            var expectedTime = '2:33:06';
            expect(json.finishTime).to.equal(expectedTime);
        });

        it('should have the three breakdown groups, with valid values', function () {
            expect(typeof(json.groups)).to.equal('object');
            expect(typeof(json.groups.ageGroup)).to.equal('object');

            expect(typeof(json.groups.division)).to.equal('object');
            expect(typeof(json.groups.division.label)).to.equal('string');
            expect(json.groups.division.label).to.equal('Olympic Triathlon : Swim 1500 Meters, Bike 24.9 Miles, Run 6.2 Miles');
            expect(typeof(json.groups.division.url)).to.equal('string');
            expect(json.groups.division.url).to.equal('https://www.athlinks.com/Events/Race/Api/505280/Course/Results?isViewModeChange=false&courseData=753481%3A751266%3A341%3A118');
            
            expect(typeof(json.groups.gender)).to.equal('object');
            expect(typeof(json.groups.gender.label)).to.equal('string');
            expect(json.groups.gender.label).to.equal('M');
            expect(typeof(json.groups.gender.url)).to.equal('string');
            expect(json.groups.gender.url).to.equal('https://www.athlinks.com/Events/Race/Api/505280/Course/Results?isViewModeChange=false&courseData=753481%3A751266%3A341%3A118&viewMode=O&viewModeFilterRangeData=M1');

            expect(typeof(json.groups.ageGroup)).to.equal('object');
            expect(typeof(json.groups.ageGroup.label)).to.equal('string');
            expect(json.groups.ageGroup.label).to.equal('M 40-44');
            expect(typeof(json.groups.ageGroup.url)).to.equal('string');
            expect(json.groups.ageGroup.url).to.equal('https://www.athlinks.com/Events/Race/Api/505280/Course/Results?isViewModeChange=false&courseData=753481%3A751266%3A341%3A118&viewMode=A&viewModeFilterRangeData=M6510376');

        });
    });
});