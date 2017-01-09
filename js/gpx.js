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

var GPX = {};

GPX.NS = 'http://www.topografix.com/GPX/1/1';

/**
 * Compute the length of a Polyline, in radians.
 */
GPX.distance = function (latLngs) {
    'use strict';

    var Earth = L.CRS.Earth;
    if (0 === latLngs.length) {
        return 0;
    }

    // Generalise everything to MultiPolylines.
    if (!latLngs.hasOwnProperty('length')) {
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
};

/**
 * Parse the given GPX document and return an array of tracks, each
 * consisting of a list of latitude/longitude pairs.
 */
GPX.parse = function (gpx) {
    'use strict';

    var root = gpx.documentElement;
    if (GPX.NS !== root.namespaceURI || 'gpx' !== root.localName) {
        throw new Error('Invalid GPX root element: '+ root.tagName);
    }

    return Array.prototype.filter.call(root.childNodes, function (node) {
        // Extract `trk` and `rte` elements.
        return GPX.NS === node.namespaceURI &&
               ('trk' === node.localName || 'rte' === node.localName);
    }).flatMap(function (trkOrRte) {
        /*
         * Extract `trkseg` elements from all `trk` elements, keep `rte`
         * elements.
         */
        if ('rte' === trkOrRte.localName) {
            return [ trkOrRte ];
        }
        return Array.prototype.filter.call(trkOrRte.childNodes, function (node) {
            return GPX.NS === node.namespaceURI && 'trkseg' === node.localName;
        });
    }).map(function (trksegOrRte) {
        return Array.prototype.filter.call(trksegOrRte.childNodes, function (node) {
            // Extract `trkpt` and `rtept` elements.
            return GPX.NS === node.namespaceURI &&
                   ('trkpt' === node.localName || 'rtept' === node.localName);
        }).map(function (wpt) {
            return ['lat', 'lon'].map(function (attr) {
                return +wpt.getAttribute(attr);
            });
        });
    });
};
