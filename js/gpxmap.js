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

var GpxMap = React.createClass({
'getInitialState': function () {
    return { 'layers': [] };
},

'componentDidMount': function () {
    'use strict';
    var self = this;

    UTIL.load(self.props.index).then(function (walks) {
        /*
         * Return a Promise that resolves to an array of GPX tracks once
         * all tracks have been loaded.
         */
        return Promise.all(walks.flatMap(function (walk) {
            // Load GPX file for each date.
            return walk.dates.map(function (date) {
                return UTIL.load(
                    self.props.gpx + date.substr(0, 10) +'.gpx', 'document'
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
        self.setState({ 'layers': layers });
    });
},

'render': function () {
    'use strict';
    var CSS = GpxMap.CSS, $ = React.createElement;
    var yearGpx = {}, years = [], layersControl, mapProps;

    // Group GPX layers by year.
    this.state.layers.forEach(function (layer) {
        var year = layer.date.getFullYear();

        if (!yearGpx[year]) {
            years.push(year);
            yearGpx[year] = [];
        }
        yearGpx[year].push($(Responsive, {
                'key': layer.date,
                'component': WideLine,
                'className': CSS.TRACK,
                'positions': layer.lines,
                'color': '#17f',
                'weight': 2,
                'opacity': .8,
                'hovering': {
                    'weight': 4,
                    'opacity': 1,
                }
            },
            $(ReactLeaflet.Popup, null, $('div', null,
                [ layer.date.getDate()
                , layer.date.getMonth() + 1
                , layer.date.getFullYear()
                ].join('/') + ' ',
                $('a', { 'href': layer.walk.link, }, layer.walk.title),
                ' ' + (Math.round(GPX.distance(layer.lines) / 100) / 10) + 'km'
            ))
        ));
    });
    years.sort();

    // Create base layers and overlays inside layers control.
    layersControl = $(ReactLeaflet.LayersControl,
        { 'hideSingleBase': true },
        this.props.tileLayers.map(function (layer, i) {
            return $(ReactLeaflet.LayersControl.BaseLayer,
                { 'name': layer.name, 'key': layer.name, 'checked': 0 === i },
                $(ReactLeaflet.TileLayer, {
                    'url': layer.url,
                    'attribution': layer.options.attribution,
                })
            );
        }),
        years.map(function (year) {
            return $(ReactLeaflet.LayersControl.Overlay,
                { 'name': ''+ year, 'key': year, 'checked': true },
                $(ReactLeaflet.LayerGroup, null, yearGpx[year])
            );
        })
    );

    // Adjust the map's viewport when all GPX tracks are loaded
    if (0 < this.state.layers.length) {
        mapProps = {
            'bounds': L.latLngBounds(this.state.layers.flatMap(function (layer) {
                return layer.lines;
            })),
        };
        mapProps.maxBounds = mapProps.bounds.pad(.05);
    } else {
        mapProps = null;
    }

    // Create map with an initial tile layer and layers control.
    return $(ReactLeaflet.Map, mapProps,
        $(ReactLeaflet.ScaleControl),
        layersControl
    );
},
});

GpxMap.CSS = {
    'TRACK': 'gpxmap-track',
};
