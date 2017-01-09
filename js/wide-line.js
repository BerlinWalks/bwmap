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

/**
 * A Polyline whose mouse handlers react to nearby events.
 *
 * This is implemented by drawing a wider, invisible line underneath and
 * attaching event handlers to that.
 */
var WideLine = L.Layer.extend({
    'initialize': function (latlngs, options) {
        this.lines = [
            L.polyline(latlngs, { 'opacity': 0, 'weight': 20 }),
            L.polyline(latlngs, Object.assign(
                {},
                options,
                { 'interactive': false }
            )),
        ];
    },

    'super': function (method) {
        if (L.Layer.prototype[method]) {
            L.Layer.prototype[method].apply(this, arguments);
        }
    },

    'each': function (func) {
        return this.lines.map(function (line) { return func(line); });
    },

    'onAdd': function (map) {
        this.super('onAdd', map);
        this.each(function (line) { map.addLayer(line); });
        return this;
    },

    'onRemove': function (map) {
        this.super('onRemove', map);
        this.each(function (line) { map.removeLayer(line); });
        return this;
    },

    'setStyle': function () {
        // Modify style of the visible line.
        this.lines[1].setStyle.apply(this.lines[1], arguments);
        return this;
    },

    'on': function () {
        // Attach event handlers to wide invisible line.
        this.lines[0].on.apply(this.lines[0], arguments);
        return this;
    },

    'off': function () {
        // Attach event handlers to wide invisible line.
        this.lines[0].off.apply(this.lines[0], arguments);
        return this;
    },

    'bindPopup': function () {
        // Attach event handlers to wide invisible line.
        this.lines[0].bindPopup.apply(this.lines[0], arguments);
        return this;
    },
});

function wideline(latlngs, options) {
    return new WideLine(latlngs, options);
}
