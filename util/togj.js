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
const tj = require('@mapbox/togeojson');
const DOMParser = require('xmldom').DOMParser;

// Fake browser environment to load leaflet.
global.document = {
    createElement() { return {}; },
    'documentElement': { 'style': {} }
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
    while (1 + le != ri) {
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
Array.prototype.flatMap = function () {
    return Array.prototype.concat.apply([],
        Array.prototype.map.apply(this, arguments)
    );
};

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

walks = {
    'type': 'FeatureCollection',
    'features': fs.readdirSync(GPXDIR).
        filter(file => file.endsWith('.gpx')).
        flatMap(function (file) {
            // Load the GPX file.
            const gpx = tj.gpx(new DOMParser().parseFromString(
                fs.readFileSync(`${GPXDIR}/${file}`, 'utf8')
            ));
            assert.equal(gpx.type, 'FeatureCollection');

            // Produce one GeoJSON feature per track inside the GPX.
            return gpx.features.
                filter(feature =>
                        'LineString' === feature.geometry.type ||
                        'MultiLineString' === feature.geometry.type
                ).map(function (walk) {
                    const properties = walk.properties || {};
                    assert.equal(walk.type, 'Feature');

                    // If GPX has no time information, use file date.
                    assert(
                        !properties.coordTimes || properties.time,
                        'coordTimes without time stamp'
                    );
                    const date = properties.time
                               ? properties.time.substr(0, 10)
                               : file.substr(0, 10);

                    // Find the index entry corresponding to the file.
                    const idx = search(index,
                        entry => date < entry.dates[0].substr(0, 10)
                    ) - 1;
                    assert(0 <= idx, `No matching index for ${file}.`);

                    // Warn about unusually large discrepancy.
                    const dateDiff = Date.parse(date) -
                                     Date.parse(index[idx].dates[0].substr(0, 10));
                    if (3 * DAYS < dateDiff) {
                        throw new Error(['dateDiff', file, date, index[idx].dates[0]].join(': '));
                    }

                    // Transfer index properties to GeoJSON.
                    let depth = 'LineString' === walk.geometry.type ? 0
                                                                    : 1;
                    const dist = distance(
                        L.GeoJSON.coordsToLatLngs(walk.geometry.coordinates, depth)
                    );
                    walk.properties = { date, 'distance': Math.round(dist) };
                    for (p of [ 'categories', 'link', 'people', 'title', 'walkers' ]) {
                        walk.properties[p] = index[idx][p];
                    }

                    return walk;
                });
        }),
};

console.log(JSON.stringify(walks, null, ' '));
