(function (exports) {
'use strict';

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

    function zip() {
        var args = Array.prototype.slice.call(arguments);
        return Object.keys(args[0]).map(function (i) {
            return args.map(function (a) { return a[i]; });
        });
    }

    /**
     * An immutable value type for summaries.
     */
    function summary() {
        return summaryImp(0, 0);

        // Private implementation
        function summaryImp(m_walks, m_distance) {
            var self = {};

            self.walks = function () { return m_walks; };
            self.distance = function () { return m_distance; };

            self.toString = function () {
                return [
                    m_walks +' walks', (Math.round(m_distance / 100) / 10) +'km',
                ].join(' — ');
            };

            self.accumulate = function (dist) {
                return summaryImp(1 + m_walks, dist + m_distance);
            };

            return self;
        }
    }

    /**
     * The summary pane reacts to changes in the visible year layers.
     */
    function summaryPane(walks, onChange) {
        var self = {};
        var m_visibleYears = {};
        var m_summary = summary();

        function handleVisible(year, visible) {
            if (visible != m_visibleYears[year]) {
                m_visibleYears[year] = visible;
                m_summary = walks.flatMap(function (walk) {
                        return zip(walk.dates, walk.distances);
                    }).reduce(function (sum, dateDistance) {
                        if (m_visibleYears[dateDistance[0].substr(0, 4)]) {
                            return sum.accumulate(dateDistance[1]);
                        } else {
                            return sum;
                        }
                    }, summary());
                if (onChange) {
                    onChange.call(self);
                }
            }
        }

        self.addLayer = function (layer, year) {
            layer.on('add', handleVisible.bind(null, year, true)).
                on('remove', handleVisible.bind(null, year, false));
            return self;
        };

        self.removeLayer = function (layer) {
            layer.off('add').off('remove');
            return self;
        };

        self.render = function () {
            var frag = document.createDocumentFragment(), div;
            if (m_summary.walks()) {
                div = document.createElement('div');
                div.textContent = ''+ m_summary;
                frag.appendChild(div);
            }
            return frag;
        };

        return self;
    }

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

// Missing monadic operation
if ('function' !== typeof Array.prototype.flatMap) {
    Object.defineProperty(Array.prototype, 'flatMap', {
        'value': function () {
            'use strict';

            // return [].concat(f(this[0]), f(this[1]), ...)
            return Array.prototype.concat.apply([],
                Array.prototype.map.apply(this, arguments)
            );
        },
    });
}

/**
 * Return a Promise that resolves to the response object on success. If
 * `type` is unspecified, JSON is assumed.
 */
function load(url, type) {
    'use strict';

    var xhr = new XMLHttpRequest();

    xhr.open('GET', url);
    xhr.responseType = type || 'json';

    return new Promise(function (resolve, reject) {
        xhr.onload = function () {
            if (200 === this.status) {
                resolve(this.response);
            } else {
                reject(new Error([url, this.status, this.statusText].join(': ')));
            }
        };
        xhr.send();
    });
}

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

var CSS = {
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
    var le = -1, ri = array.length;
    while (1 + le !== ri) {
        var mi = le + ((ri - le) >> 1);
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
    var popup = document.createDocumentFragment();
    var anchor = document.createElement('a');
    var idx = search(walk.dates, function (d) { return date <= d; });

    if (walk.dates[idx] !== date) {
        console.log('walkPopup', date, walk);
        return;
    }

    var elem0 = document.createElement('h3');
    elem0.textContent = walk.title;
    popup.appendChild(elem0);

    elem0 = document.createElement('div');
    elem0.textContent = [
            [ +date.substr(8, 2)
            , +date.substr(5, 2)
            , +date.substr(0, 4)
            ].join('/'),
            +(walk.distances[idx] / 1000).toFixed(1) +'km',
            walk.walkers +' walkers',
            walk.categories.join(' — '),
            '',
        ].join(' — ');

    anchor.setAttribute('href', walk.link);
    anchor.textContent = 'blog';
    elem0.appendChild(anchor);
    popup.appendChild(elem0);

    elem0 = document.createElement('p');
    elem0.textContent = walk.people.sort().join(' • ');
    popup.appendChild(elem0);

    return popup;
}

function gpxmap(id, options) {
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

    // Create the DOM structure for our map.
    var domContainer = L.DomUtil.get(id);
    L.DomUtil.addClass(domContainer, CSS.VBOX);

    // Create map with an initial tile layer and layers control.
    var gpxmap = L.map(L.DomUtil.create('div', CSS.VIEW, domContainer)).
        addControl(L.control.scale()).
        addControl(layersControl).
        addLayer(tileLayers[0].tileLayer);

    var domDetails = L.DomUtil.create('div', CSS.DETAILS, domContainer);

    var hiddenYear = {};
    function trackStyle(hover, selected) {
        return function (props) {
            var year = props.date.substr(0, 4);
            return hiddenYear[year] ? [] : {
                'className': CSS.TRACK,
                'color': yearColour(year - 2011),
                'opacity': hover ? 1 : .8,
                'weight': hover ? 4 : selected ? 3.5 : 2,
            };
        };
    }

    // This layer shows walking tracks.
    var walkLayer = L.vectorGrid.protobuf(
        options.url, {
            'pane': 'overlayPane',
            'maxNativeZoom': 13,
            'getFeatureId': function (walk) { return walk.properties.date; },
            'vectorTileLayerStyles': { '': trackStyle(false) },
        }
    ).addTo(gpxmap);

    // This layer has invisible mouse-responsive tracks.
    var selected;
    var mouseLayer = L.vectorGrid.protobuf(
        options.url, {
            'pane': 'overlayPane',
            'maxNativeZoom': 13,
            'getFeatureId': function (walk) { return walk.properties.date; },
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
        var date = evt.layer.properties.date;
        if (date === selected) {
            walkLayer.setFeatureStyle(date, trackStyle(false, true));
        } else {
            walkLayer.resetFeatureStyle(date);
        }
    }).addTo(gpxmap);

    load(options.index).then(function (walks) {
        // Collect all years.
        var years = {};
        walks.flatMap(function (walk) { return walk.dates; }).
            forEach(function (date) { years[date.substr(0, 4)] = true; });

        // Build popup from matching index entry.
        mouseLayer.on('click', function (evt) {
            var date = evt.layer.properties.date;
            var idx = search(walks, function (walk) {
                return date < walk.dates[0];
            }) - 1;
            var popup = walkPopup(date, walks[idx]);

            L.DomEvent.stopPropagation(evt);
            if (date === selected) {
                return;
            }
            if (selected) {
                walkLayer.resetFeatureStyle(selected);
            }
            if (popup) {
                L.DomUtil.empty(domDetails);
                domDetails.appendChild(walkPopup(date, walks[idx]));
                selected = date;
                walkLayer.setFeatureStyle(selected, trackStyle(true, true));
            }
        });

        // Set up a summary pane that reacts when years are toggled.
        function renderSummary() {
            var h3 = L.DomUtil.create('h3');

            h3.textContent = options.title;
            L.DomUtil.empty(domDetails);
            domDetails.appendChild(h3);
            domDetails.appendChild(this.render());
        }
        var sumPane = summaryPane(walks, renderSummary);
        gpxmap.on('click', function () {
            if (selected) {
                walkLayer.resetFeatureStyle(selected);
                selected = void 0;
                renderSummary.call(sumPane);
            }
        });

        // Create one layer group per year and add to the map.
        Object.keys(years).forEach(function (year) {
            var lg = L.layerGroup().on('add', function () {
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
        var bounds = L.latLngBounds(walks.flatMap(function (walk) {
            return walk.bboxes;
        }).flatMap(function (bbox) {
            var l = bbox.length >> 1;
            return L.GeoJSON.coordsToLatLngs([
                [ bbox[0], bbox[1] ], [ bbox[l], bbox[1 + l] ]
            ]);
        }));
        gpxmap.setMaxBounds(bounds.pad(.05)).fitBounds(bounds);
    });

    return gpxmap;
}

exports.CSS = CSS;
exports.gpxmap = gpxmap;

}((this.GPXMAP = this.GPXMAP || {})));
