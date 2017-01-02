#!/usr/bin/env python3
#
# Copyright 2017, Joachim Kuebart <joachim.kuebart@gmail.com>
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are
# met:
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
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
# IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
# THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
# PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
# CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
# EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
# PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
# PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
# LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
# NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
# SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import html
import json
from os import path
import re
from sys import argv
from urllib.request import urlopen
from xml.etree import ElementTree

# Some well-known fully qualified element names
ATOM_CATEGORY = '{http://www.w3.org/2005/Atom}category'
ATOM_CONTENT =  '{http://www.w3.org/2005/Atom}content'
ATOM_ENTRY =    '{http://www.w3.org/2005/Atom}entry'
ATOM_FEED =     '{http://www.w3.org/2005/Atom}feed'
ATOM_LINK =     '{http://www.w3.org/2005/Atom}link'
ATOM_PUBLISHED = '{http://www.w3.org/2005/Atom}published'
ATOM_SUBTITLE = '{http://www.w3.org/2005/Atom}subtitle'
ATOM_TITLE =    '{http://www.w3.org/2005/Atom}title'
CONTENT_ENCODED = '{http://purl.org/rss/1.0/modules/content/}encoded'

if len(argv) < 2:
        exit('''\
Usage: %s URL...

        Generate a JSON database of GPX tracks documented in the blog at
        the given URLs. The URLs should refer to RSS feeds.''' % argv[0])

# Read database of people's names, stored in people.txt
people = frozenset(person.rstrip('\n') for person in open(
        path.join(path.dirname(path.realpath(__file__)), 'people.txt')
))

# A collection of words not found in the people database
words = set()

def extract_people(desc):
        '''Extract people mentioned in the given extract.'''
        ppl = set()
        for word in re.split('\W+', desc[:1024]):
                if word in people:
                        ppl.add(word)
                else:
                        # Remember words not known to be people's names
                        words.add(word)

        return sorted(ppl)

def process_atom_entry(entry):
        '''Extract the walk described in the given Atom entry.'''
        return {
                'title': html.unescape(entry.find(ATOM_TITLE + "[@type='html']").text),
                'link': entry.find(ATOM_LINK + "[@rel='alternate']").get('href'),
                'category': entry.find(ATOM_CATEGORY).get('term'),
                'dates': [
                        datetime.strptime(
                                entry.find(ATOM_PUBLISHED).text,
                                '%Y-%m-%dT%H:%M:%SZ'
                        ).
                        replace(tzinfo = timezone.utc).
                        astimezone()
                ],
                'people': extract_people(html.unescape(
                        entry.find(ATOM_CONTENT + "[@type='html']").text
                )),
        }

def process_rss_item(item):
        '''Extract the walk described in the given RSS item.'''
        walk = {
                'dates': [
                        parsedate_to_datetime(item.find('pubDate').text).
                                astimezone()
                ],
                'people': extract_people(html.unescape(
                        item.find(CONTENT_ENCODED).text
                )),
        }

        for prop in ['title', 'link', 'category']:
                walk[prop] = item.find(prop).text

        return walk

def json_datetime(obj):
        '''Utility function for JSON date formatting.'''
        if not isinstance(obj, datetime):
                raise TypeError("Object of type '%s' is not JSON serializable" % type(obj))
        return obj.isoformat()

walks = []
for url in argv[1:]:
        root = ElementTree.parse(urlopen(url)).getroot()
        if ATOM_FEED == root.tag:
                walks += (
                        process_atom_entry(entry)
                                for entry in root.findall(ATOM_ENTRY)
                )
        elif 'rss' == root.tag:
                walks += (
                        process_rss_item(item)
                                for chan in root
                                for item in chan.findall('item')
                )
        else:
                exit('%s: unsupported feed' % root.tag)

print(json.dumps(walks
        , default = json_datetime
        , indent = ' '
        , separators = (',', ':')
        , sort_keys = True
))
#for word in words:
#       print(word)
