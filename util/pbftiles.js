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

const fs = require('fs');
const geojsonVt = require('geojson-vt');
const vtpbf = require('vt-pbf');

const gj = JSON.parse(fs.readFileSync(process.stdin.fd, 'utf8'));
const tileindex = geojsonVt(gj, { 'indexMaxZoom': 13, 'indexMaxPoints': 0 });

for (let { z, x, y } of tileindex.tileCoords) {
    mkdirp(`${z}/${x}`);
    fs.writeFileSync(
        `${z}/${x}/${y}.pbf`,
        vtpbf.fromGeojsonVt({ '': tileindex.getTile(z, x, y) })
    );
}

function mkdirp(dir) {
    dir = dir.split('/');
    for (let i = 0; i !== dir.length; ++i) {
        const d = dir.slice(0, 1 + i).join('/');
        try {
            fs.mkdirSync(d);
        } catch (ex) {
            if ('EEXIST' !== ex.code) {
                throw ex;
            }
        }
    }
}
