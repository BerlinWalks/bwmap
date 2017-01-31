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

var Summary = (function () {
    'use strict';

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
    function summaryPane(features, onChange) {
        var self = {};
        var m_visibleYears = {};
        var m_summary = summary();

        function handleVisible(year, visible) {
            if (visible != m_visibleYears[year]) {
                m_visibleYears[year] = visible;
                m_summary = features.reduce(function (sum, layer) {
                    if (m_visibleYears[layer.properties.date.substr(0, 4)]) {
                        return sum.accumulate(layer.properties.distance);
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
                div = L.DomUtil.create('div', null, frag);
                div.textContent = ''+ m_summary;
            }
            return frag;
        };

        return self;
    }

    // Export public symbols
    return {
        'summaryPane': summaryPane,
    };
}());
