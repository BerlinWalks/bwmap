#!/usr/bin/env python3
#
# Copyright 2017, Joachim Kuebart <joachim.kuebart@gmail.com>
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#    1. Redistributions of source code must retain the above copyright
#       notice, this list of conditions and the following disclaimer.
#
#    2. Redistributions in binary form must reproduce the above copyright
#       notice, this list of conditions and the following disclaimer in the
#       documentation and/or other materials provided with the
#       distribution.
#
#    3. Neither the name of the copyright holder nor the names of its
#       contributors may be used to endorse or promote products derived
#       from this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
# LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
# CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
# INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
# CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
# ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
# POSSIBILITY OF SUCH DAMAGE.

from bisect import bisect
from datetime import datetime
import html
import json
from sys import argv, stderr, stdin, stdout
from urllib.parse import urljoin
from urllib.request import urlopen
from mkdb import extract_people, json_datetime#, words

if len(argv) < 2:
        exit('''\
Usage: %s URL

        Generate a JSON database of walks documented in the blog at the
        given URL. The URL should refer to a WordPress API endpoint.

        A GeoJSON file with details of all the walks is read from standard
        input.''' %
        argv[0])

def paginate(url):
        '''Retrieve all pages from the given URL.'''
        page = 1
        while True:
                result = json.load(urlopen(urljoin(url, '?page=%d' % page)))
                if not result:
                        break
                for item in result:
                        yield item
                page += 1

# The categories used by the given blog
categories = {
        cat['id']: cat['name']
                for cat in paginate(urljoin(argv[1], 'categories'))
}

def process_post(post):
        '''Extract the walk described in the given WordPress post.'''
        ppl = extract_people(html.unescape(post['content']['rendered']))
        return {
                'categories': [
                        categories[cat] for cat in post['categories']
                ],
                'time': datetime.strptime(post['date'], '%Y-%m-%dT%H:%M:%S').
                                astimezone(),
                'bboxes': [],
                'dates': [],
                'distances': [],
                'link': post['link'],
                'walkers': len(ppl),
                'people': ppl,
                'title': html.unescape(post['title']['rendered']),
        }

if '__main__' == __name__:
        walks = sorted([
                (walk['time'].date(), -i, walk)
                for i, walk in enumerate([
                        process_post(post)
                        for post in paginate(urljoin(argv[1], 'posts'))
                ])
        ])

        # Associate information from GeoJSON to index.
        geojson = json.load(stdin)
        assert 'FeatureCollection' == geojson['type']
        for gj in geojson['features']:
                assert 'Feature' == gj['type']
                date = datetime.strptime(gj['properties']['date'], '%Y-%m-%d').\
                        date()

                # Choose the closest matching walk.
                idx = bisect(walks, (date, 0))
                if len(walks) <= idx or \
                   date - walks[idx - 1][0] <= walks[idx][0] - date:
                        idx -= 1
                _, _, walk = walks[idx]
                if 3 < abs((date - walk['time'].date()).days):
                        print('dateDiff: %r %r' % (date, walk), file = stderr)
                        continue

                walk['bboxes'].append(gj['bbox'])
                walk['dates'].append(date)
                walk['distances'].append(gj['properties']['distance'])

        json.dump([ walk for (_, _, walk) in walks if len(walk['dates'])]
                , stdout
                , default = json_datetime
                , indent = ' '
                , separators = (',', ':')
                , sort_keys = True
        )
        #for word in words:
        #       print(word)
