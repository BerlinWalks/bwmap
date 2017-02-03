#!/usr/bin/env node
/*
 * Copyright 2017, Joachim Kuebart <joachim.kuebart@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   1. Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *
 *   2. Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the
 *      distribution.
 *
 *   3. Neither the name of the copyright holder nor the names of its
 *      contributors may be used to endorse or promote products derived
 *      from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DAYS = 24 * HOURS;

const assert = require('assert');
const fs = require('fs');
const togeojson = require('@mapbox/togeojson');
const DOMParser = require('xmldom').DOMParser;

// Fake browser environment to load leaflet.
global.document = {
    createElement() { return {}; },
    'documentElement': { 'style': {} },
};
global.navigator = { 'platform': '', 'userAgent': '' };
global.window = { 'devicePixelRatio': 1 };
const L = require('leaflet');

/**
 * If this looks familiar that's because it's binary search. We find
 * 0 <= i <= array.length such that !pred(i - 1) && pred(i) under the
 * assumption !pred(-1) && pred(length).
 */
function search(array, pred) {
    let le = -1, ri = array.length;
    while (1 + le !== ri) {
        let mi = le + ((ri - le) >> 1);
        if (pred(array[mi])) {
            ri = mi;
        } else {
            le = mi;
        }
    }
    return ri;
}

// Missing monadic operation.
if ('function' !== typeof Array.prototype.flatMap) {
    Object.defineProperty(Array.prototype, 'flatMap', {
        'value': function () {
            return Array.prototype.concat.apply([],
                Array.prototype.map.apply(this, arguments)
            );
        },
    });
}

/**
 * Invoke `func` with a start and end index into `array` for each range of
 * elements that are equivalent according to `equal`.
 */
function forEachUniqueRange(array, equal, func) {
    const res = [];
    for (let lo = 0, hi; lo !== array.length; lo = hi) {
        for (hi = 1 + lo; hi !== array.length && equal(array[lo], array[hi]); ++hi)
            ;
        res.push(func(lo, hi));
    }
    return res;
}

/**
 * Compute the length of a Polyline, in radians.
 */
function distance(latLngs) {
    var Earth = L.CRS.Earth;
    if (0 === latLngs.length) {
        return 0;
    }

    // Generalise everything to MultiPolylines.
    if (!latLngs[0].hasOwnProperty('length')) {
        latLngs = [ latLngs ];
    }

    return latLngs.reduce(function (dist, seg) {
        var i, p, q;

        if (1 < seg.length) {
            for (i = seg.length - 1, p = seg[i]; 0 <= i; p = q, --i) {
                q = seg[i];
                dist += Earth.distance(p, q);
            }
        }
        return dist;
    }, 0);
}

/**
 * Load the named GPX file as GeoJSON and return an array of features. The
 * file name is added to every feature's properties.
 */
function gpxToJson(gpxFileName) {
    const gpx = togeojson.gpx(new DOMParser().parseFromString(
        fs.readFileSync(gpxFileName, 'utf8')
    ));
    assert.equal(gpx.type, 'FeatureCollection');
    return gpx.features.map(function (feature) {
        assert.equal(feature.type, 'Feature');
        const properties = Object.assign({}, feature.properties, {
            'gpxFileName': gpxFileName.substr(1 + gpxFileName.lastIndexOf('/')),
        });
        return { 'type': 'Feature', properties, 'geometry': feature.geometry };
    });
}

/**
 * If the feature is a MultiLine, split it up into an array of Lines while
 * preserving properties. If there is a 'coordTimes' property, it is
 * treated specially and the 'time' property is adjusted accordingly.
 */
function multiSplit(feature) {
    assert.equal(feature.type, 'Feature');
    if ('MultiLineString' !== feature.geometry.type) {
        return [ feature ];
    }

    return feature.geometry.coordinates.map(function (coordinates, i) {
        // Clone properties for each generated feature.
        const properties = Object.assign({}, feature.properties);

        // Select appropriate coordTimes.
        if (properties.coordTimes) {
            assert(i < properties.coordTimes.length);
            assert.equal(properties.coordTimes[i].length, coordinates.length);
            assert.equal(properties.time, properties.coordTimes[0][0]);
            properties.coordTimes = properties.coordTimes[i];
            properties.time = properties.coordTimes[0];
        }

        return {
            'type': 'Feature',
            properties,
            'geometry': { 'type': 'LineString', coordinates },
        };
    });
}

/**
 * If the Line feature has a 'coordTimes' property which spans several days,
 * split the feature into one Line per day.
 */
function dateSplit(feature) {
    assert.equal(feature.type, 'Feature');
    if ('LineString' !== feature.geometry.type ||
        !feature.properties || !feature.properties.coordTimes ||
        feature.properties.coordTimes.length !== feature.geometry.coordinates.length)
    {
        const properties = Object.assign({}, feature.properties, {
            'date': (feature.properties.time || feature.properties.gpxFileName).substr(0, 10),
        });
        return [ {
            'type': 'Feature',
            properties,
            'geometry': feature.geometry,
        } ];
    }

    assert.equal(
        feature.properties.coordTimes.length,
        feature.geometry.coordinates.length,
        `${feature.properties.gpxFileName}: ${feature.properties.time}`
    );
    return forEachUniqueRange(
        feature.properties.coordTimes,
        (lhs, rhs) => lhs.substr(0, 10) === rhs.substr(0, 10),
        function (lo, hi) {
            // Clone properties for each generated feature.
            const properties = Object.assign({}, feature.properties);

            // Split up coordTimes and coordinates.
            properties.coordTimes = properties.coordTimes.slice(lo, hi);
            properties.time = properties.coordTimes[0];
            properties.date = properties.time.substr(0, 10);
            const coordinates = feature.geometry.coordinates.slice(lo, hi);
            return {
                'type': 'Feature',
                properties,
                'geometry': { 'type': 'LineString', coordinates },
            };
        }
    );
}

/**
 * Compare two GeoJSON features according to their 'time' property, falling
 * back to 'date'.
 */
function timeCompare(lhs, rhs) {
    assert.equal(lhs.type, 'Feature');
    assert.equal(rhs.type, 'Feature');
    const time0 = lhs.properties.time || lhs.properties.date;
    const time1 = rhs.properties.time || rhs.properties.date;
    return time0 < time1 ? -1 : time1 < time0 ? 1 : 0;
}


if (process.argv.length < 3) {
    process.stderr.write(`usage: ${process.argv[1]} directory
        directory       Should contain an index.json file and any number of
                        .gpx files.
`);
    process.exit(1);
}

const GPXDIR = process.argv[2];

const index = JSON.parse(fs.readFileSync(`${GPXDIR}/index.json`));
index.sort(function (lhs, rhs) {
    assert.equal(lhs.dates.length, 1, "Index must have exactly one date");
    assert.equal(rhs.dates.length, 1, "Index must have exactly one date");
    return lhs.dates[0] < rhs.dates[0] ? -1
         : rhs.dates[0] < lhs.dates[0] ? 1
         : 0;
});

// An array of GeoJSON features, sorted by date.
const walks = fs.readdirSync(GPXDIR).
    filter(file => file.endsWith('.gpx')).
    flatMap(file => gpxToJson(`${GPXDIR}/${file}`)).
    flatMap(multiSplit).
    filter(feature => 'LineString' === feature.geometry.type).
    flatMap(dateSplit).
    sort(timeCompare);

// Merge GeoJSON features for the same date by optionally creating MultiLines.
const geojson = {
    'type': 'FeatureCollection',
    'features': forEachUniqueRange(
        walks,
        (lhs, rhs) => lhs.properties.date === rhs.properties.date,
        function (lo, hi) {
            if (hi - lo <= 1) {
                return walks[lo];
            }

            const slice = walks.slice(lo, hi);

            // Merge coordTimes and coordinates into nested arrays.
            const properties = { 'date': slice[0].properties.date };
            if (slice[0].properties.coordTimes) {
                properties.coordTimes = slice.map(function (walk, i) {
                    assert.equal(
                        walk.properties.coordTimes.length,
                        walk.geometry.coordinates.length
                    );
                    return walk.properties.coordTimes;
                });
                properties.time = properties.coordTimes[0][0];
            }
            const coordinates = slice.map(walk => walk.geometry.coordinates);

            return {
                'type': 'Feature',
                properties,
                'geometry': { 'type': 'MultiLineString', coordinates },
            };
        }
    ).map(function (walk) {
        const properties = walk.properties;
        const date = properties.date;

        // Find the index entry corresponding to the date.
        const idx = search(index,
            entry => date < entry.dates[0].substr(0, 10)
        ) - 1;
        assert(0 <= idx, `No matching index for ${properties.gpxFileName}.`);

        // Warn about unusually large discrepancy.
        const dateDiff = Date.parse(date) -
                         Date.parse(index[idx].dates[0].substr(0, 10));
        if (3 * DAYS < dateDiff) {
            throw new Error(['dateDiff', date, index[idx].dates[0]].join(': '));
        }

        // Transfer index properties to GeoJSON.
        const depth = 'LineString' === walk.geometry.type ? 0 : 1;
        walk.properties = {
            //'coordTimes': properties.coordTimes,
            date,
            'distance': Math.round(distance(
                    L.GeoJSON.coordsToLatLngs(walk.geometry.coordinates, depth)
                )),
        };
        for (p of [ 'categories', 'link', 'people', 'title', 'walkers' ]) {
            walk.properties[p] = index[idx][p];
        }

        return walk;
    }),
};

process.stdout.write(JSON.stringify(geojson, null, ' '));
