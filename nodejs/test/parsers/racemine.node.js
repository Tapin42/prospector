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

describe('Racemine.com parser', function () {

    describe('readBib', function () {

        this.timeout('20000');

        var targetUrl = 'http://georesults.racemine.com/USA-Productions/events/2016/Oakland-Triathlon-Festival/250/entrant';
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
            expect(json.participant.name).to.equal('JOE NAVRATIL');
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

            var expectedAry = ["27:13", "10:01", "01:06:45", "01:16", "47:49"];
            expect(compareAry(expectedAry, json.splits)).to.be.true;
        });

        it('should have the expected finish time', function () {
            expect(typeof(json.finishTime)).to.equal('string');

            var expectedTime = '02:33:06';
            expect(json.finishTime).to.equal(expectedTime);
        });

        it('should have the three breakdown groups, with valid values', function () {
            expect(typeof(json.groups)).to.equal('object');
            expect(typeof(json.groups.ageGroup)).to.equal('object');

            expect(typeof(json.groups.division)).to.equal('object');
            expect(typeof(json.groups.division.label)).to.equal('string');
            expect(json.groups.division.label).to.equal('INT-AGE GROUP');
            expect(typeof(json.groups.division.url)).to.equal('string');
            expect(json.groups.division.url).to.equal('http://georesults.racemine.com/USA-Productions/events/2016/Oakland-Triathlon-Festival/search?q=&SearchDivision=INT-AGE%20GROUP&SearchAgeGroup=All');
            
            expect(typeof(json.groups.gender)).to.equal('object');
            expect(typeof(json.groups.gender.label)).to.equal('string');
            expect(json.groups.gender.label).to.equal('M');
            expect(typeof(json.groups.gender.url)).to.equal('string');
            expect(json.groups.gender.url).to.equal('http://georesults.racemine.com/USA-Productions/events/2016/Oakland-Triathlon-Festival/search?q=&SearchDivision=INT-AGE%20GROUP&SearchGender=M&SearchAgeGroup=All');

            expect(typeof(json.groups.ageGroup)).to.equal('object');
            expect(typeof(json.groups.ageGroup.label)).to.equal('string');
            expect(json.groups.ageGroup.label).to.equal('M 40-44');
            expect(typeof(json.groups.ageGroup.url)).to.equal('string');
            expect(json.groups.ageGroup.url).to.equal('http://georesults.racemine.com/USA-Productions/events/2016/Oakland-Triathlon-Festival/search?q=&SearchDivision=INT-AGE%20GROUP&SearchGender=M&SearchAgeGroup=40-44');

        });
    });

    describe('readResults', function () {

        this.timeout('20000');

        var targetUrl = 'http://georesults.racemine.com/Santa-Cruz-Triathlon/events/2016/34th-Annual-Santa-Cruz-Triathlon-2016/search?q=&SearchDivision=OLY-AGE%20GROUP&SearchGender=M&SearchAgeGroup=40-44';
        var prospectorUrl = 'http://localhost:7223/readResults?url=' + encodeURIComponent(targetUrl);
        var json;

        before(function (done) {
            request(prospectorUrl, function (err, resp, body) {
                json = JSON.parse(body);
                done();
            });
        });

        it('should have a valid set of labels', function () {
            expect(typeof(json.labels)).to.equal('object');

            var expectedAry = ["Swim", "T1", "Bike", "T2", "Run"];
            expect(compareAry(expectedAry, json.labels)).to.be.true;
        });

        it('should have an array of entrants', function () {
            expect(typeof(json.entrants)).to.equal('object');
        });
    });
});