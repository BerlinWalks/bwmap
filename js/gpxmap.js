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

var GPXMAP = {};

GPXMAP.CSS = {
    'TRACK': 'gpxmap-track',
    'SELECT': 'gpxmap-select',
};

GPXMAP.gpxmap = function (id, options) {
    'use strict';
    var CSS = GPXMAP.CSS;

    // Create all configured tile layers.
    var tileLayers = options.tileLayers.map(function (layer) {
        return {
            'name': layer.name,
            'tileLayer': L.tileLayer(layer.url, layer.options),
        };
    });

    // Create layers control.
    var layersControl = L.control.layers(null, null, { 'hideSingleBase':true });
    tileLayers.forEach(function (layer) {
        layersControl.addBaseLayer(layer.tileLayer, layer.name);
    });

    // Create map with an initial tile layer and layers control.
    var gpxmap = L.map(id).
        addControl(L.control.scale()).
        addControl(layersControl).
        addLayer(tileLayers[0].tileLayer);

    UTIL.load(options.index).then(function (walks) {
        /*
         * Return a Promise that resolves to an array of GPX tracks once
         * all tracks have been loaded.
         */
        return Promise.all(walks.flatMap(function (walk) {
            // Load GPX file for each date.
            return walk.dates.map(function (date) {
                return UTIL.load(
                    options.gpx + date.substr(0, 10) +'.gpx', 'document'
                ).then(function (gpx) {
                    // Turn segments into MultiPolylines.
                    return {
                        'date': new Date(date),
                        'walk': walk,
                        'lines': GPX.parse(gpx).map(function (line) {
                            return line.map(L.latLng);
                        }),
                    };
                });
            });
        }));
    }).then(function (layers) {
        var yearGpx = {}, year, lg;

        // Group GPX layers by year.
        layers.forEach(function (layer) {
            var year = layer.date.getFullYear();

            var line = L.polyline(layer.lines, {
                'className': CSS.TRACK,
                'color': 'currentColor',
            });

            // Create a popup for each walk
            var popup = document.createElement('div');
            var anchor = document.createElement('a');

            popup.textContent =
                    [ layer.date.getDate()
                    , layer.date.getMonth() + 1
                    , layer.date.getFullYear()
                    ].join('/') + ' ';
            anchor.setAttribute('href', layer.walk.link);
            anchor.textContent = layer.walk.title;
            popup.appendChild(anchor);
            popup.appendChild(document.createTextNode(
                ' ' + (Math.round(GPX.distance(layer.lines) / 100) / 10) + 'km'
            ));
            line.bindPopup(popup);

            if (!yearGpx[year]) {
                yearGpx[year] = [];
            }
            yearGpx[year].push(line);
        });

        // Create one layer group per year and add to the map.
        for (year in yearGpx) if (yearGpx.hasOwnProperty(year)) {
            lg = L.layerGroup(yearGpx[year]);
            gpxmap.addLayer(lg);
            layersControl.addOverlay(lg, year);
        }

        // Adjust the map's viewport when all GPX tracks are loaded
        var bounds = L.latLngBounds(layers.flatMap(function (layer) {
            return layer.lines;
        }));
        gpxmap.setMaxBounds(bounds.pad(.05)).fitBounds(bounds);
    });
};
