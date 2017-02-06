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

import L from 'leaflet';
import {} from './VectorGrid';
import require from 'require';
import { summaryPane } from './summary.js';
import {} from './util.js';

export const CSS = {
    'DETAILS': 'gpxmap-details',
    'HBOX': 'gpxmap-hbox',
    'SELECT': 'gpxmap-select',
    'TRACK': 'gpxmap-track',
    'VBOX': 'gpxmap-vbox',
    'VIEW': 'gpxmap-view',
};

/**
 * If this looks familiar that's because it's binary search. We find
 * 0 <= i <= array.length such that !pred(i - 1) && pred(i) under the
 * assumption !pred(-1) && pred(length).
 */
function search(array, pred) {
    let le = -1, ri = array.length;
    while (1 + le !== ri) {
        const mi = le + ((ri - le) >> 1);
        if (pred(array[mi])) {
            ri = mi;
        } else {
            le = mi;
        }
    }
    return ri;
}

function yearColour(idx) {
    return ['hsl(',
        170 + 45 * (idx >> 1), ',',
        100, '%,',
        27 * (1 + idx % 2), '%)'
    ].join('');
}

function walkPopup(date, walk) {
    const idx = search(walk.dates, d => date <= d);

    if (walk.dates[idx] !== date) {
        console.log('walkPopup', date, walk);
        return;
    }

    const popup = document.createDocumentFragment();
    let elem0 = document.createElement('h3');
    elem0.textContent = walk.title;
    popup.appendChild(elem0);

    elem0 = document.createElement('div');
    elem0.textContent = [
            [ +date.substr(8, 2)
            , +date.substr(5, 2)
            , +date.substr(0, 4)
            ].join('/'),
            +(walk.distances[idx] / 1000).toFixed(1) +'km',
            `${walk.walkers} walkers`,
            walk.categories.join(' — '),
            '',
        ].join(' — ');

    const anchor = document.createElement('a');
    anchor.setAttribute('href', walk.link);
    anchor.textContent = 'blog';
    elem0.appendChild(anchor);
    popup.appendChild(elem0);

    elem0 = document.createElement('p');
    elem0.textContent = walk.people.sort().join(' • ');
    popup.appendChild(elem0);

    return popup;
}

export function gpxmap(id, options) {
    // Create all configured tile layers.
    const tileLayers = options.tileLayers.map(function (layer) {
        return {
            'name': layer.name,
            'tileLayer': L.tileLayer(layer.url, layer.options),
        };
    });

    // Create layers control.
    const layersControl = L.control.layers(null, null, { 'hideSingleBase':true });
    tileLayers.forEach(function (layer) {
        layersControl.addBaseLayer(layer.tileLayer, layer.name);
    });

    // Create the DOM structure for our map.
    const domContainer = L.DomUtil.get(id);
    L.DomUtil.addClass(domContainer, CSS.VBOX);

    // Create map with an initial tile layer and layers control.
    const gpxmap = L.map(L.DomUtil.create('div', CSS.VIEW, domContainer)).
        addControl(L.control.scale()).
        addControl(layersControl).
        addLayer(tileLayers[0].tileLayer);

    const domDetails = L.DomUtil.create('div', CSS.DETAILS, domContainer);

    const hiddenYear = {};
    function trackStyle(hover, selected) {
        return function (props) {
            const year = props.date.substr(0, 4);
            return hiddenYear[year] ? [] : {
                'className': CSS.TRACK,
                'color': yearColour(year - 2011),
                'opacity': hover ? 1 : .8,
                'weight': hover ? 4 : selected ? 3.5 : 2,
            };
        };
    }

    // This layer shows walking tracks.
    const walkLayer = L.vectorGrid.protobuf(
        options.url, {
            'pane': 'overlayPane',
            'maxNativeZoom': 13,
            getFeatureId(walk) { return walk.properties.date; },
            'vectorTileLayerStyles': { '': trackStyle(false) },
        }
    ).addTo(gpxmap);

    // This layer has invisible mouse-responsive tracks.
    let selected;
    const mouseLayer = L.vectorGrid.protobuf(
        options.url, {
            'pane': 'overlayPane',
            'maxNativeZoom': 13,
            getFeatureId(walk) { return walk.properties.date; },
            'vectorTileLayerStyles': { '': function (props) {
                return hiddenYear[props.date.substr(0, 4)] ? [] : {
                    'opacity': 0,
                    'weight': 20,
                };
            } },
            'interactive': true,
        }
    ).on('mouseover', function (evt) {
        walkLayer.setFeatureStyle(evt.layer.properties.date, trackStyle(true));
    }).on('mouseout', function (evt) {
        const date = evt.layer.properties.date;
        if (date === selected) {
            walkLayer.setFeatureStyle(date, trackStyle(false, true));
        } else {
            walkLayer.resetFeatureStyle(date);
        }
    }).addTo(gpxmap);

    require([ `dA/json!${options.index}` ], function (walks) {
        // Collect all years.
        const years = {};
        walks.flatMap(walk => walk.dates).
            forEach(date => years[date.substr(0, 4)] = true);

        // Build popup from matching index entry.
        mouseLayer.on('click', function (evt) {
            const date = evt.layer.properties.date;

            L.DomEvent.stopPropagation(evt);
            if (date === selected) {
                return;
            }
            if (selected) {
                walkLayer.resetFeatureStyle(selected);
            }

            const idx = search(walks, walk => date < walk.dates[0]) - 1;
            const popup = walkPopup(date, walks[idx]);
            if (popup) {
                L.DomUtil.empty(domDetails);
                domDetails.appendChild(walkPopup(date, walks[idx]));
                selected = date;
                walkLayer.setFeatureStyle(selected, trackStyle(true, true));
            }
        });

        // Set up a summary pane that reacts when years are toggled.
        function renderSummary() {
            const h3 = L.DomUtil.create('h3');

            h3.textContent = options.title;
            L.DomUtil.empty(domDetails);
            domDetails.appendChild(h3);
            domDetails.appendChild(this.render());
        }
        const sumPane = summaryPane(walks, renderSummary);
        gpxmap.on('click', function () {
            if (selected) {
                walkLayer.resetFeatureStyle(selected);
                selected = void 0;
                renderSummary.call(sumPane);
            }
        });

        // Create one layer group per year and add to the map.
        Object.keys(years).forEach(function (year) {
            const lg = L.layerGroup().on('add', function () {
                if (hiddenYear[year]) {
                    selected = void 0;
                    hiddenYear[year] = false;
                    walkLayer.redraw();
                    mouseLayer.redraw();
                }
            }).on('remove', function () {
                if (!hiddenYear[year]) {
                    selected = void 0;
                    hiddenYear[year] = true;
                    walkLayer.redraw();
                    mouseLayer.redraw();
                }
            });
            gpxmap.addLayer(lg);
            layersControl.addOverlay(lg, year);
            sumPane.addLayer(lg, year);
        });

        // Adjust the map's viewport when all GPX tracks are loaded
        const bounds = L.latLngBounds(walks.flatMap(walk => walk.bboxes).
            flatMap(function (bbox) {
                const l = bbox.length >> 1;
                return L.GeoJSON.coordsToLatLngs([
                    [ bbox[0], bbox[1] ], [ bbox[l], bbox[1 + l] ]
                ]);
            })
        );
        gpxmap.setMaxBounds(bounds.pad(.05)).fitBounds(bounds);
    });

    return gpxmap;
}
