Toolbox
=======

togj
----

This utility merges a number of GPX files into a GeoJSON file containing
all tracks on standard output. The command expects the directory name as an
argument.


wpidx
-----

This utility retrieves posts from a WordPress blog via its [REST
API](http://v2.wp-api.org/).

Standard input is expected to contain a GeoJSON file. Information about the
tracks are added to the corresponding blog posts.

Standard output consists of a JSON file containing details for each item,
particularly their title, category, dates, distances and URL.

A list of participants is also generated for each item. The names are
extracted from the full-text description if the file `people.txt` contains
a list of names.

```sh
$ ./togj.js gpx/ | ./wpidx.py 'https://public-api.wordpress.com/wp/v2/sites/berlinwalks.wordpress.com/'
```

Sample output looks like this:

```json
[ { "bboxes":[ [ 13.37656, 52.50382, 13.41175, 52.51622 ] ],
    "categories":[ "Berliner Mauerweg" ],
    "dates":[ "2011-10-28" ],
    "distances":[ 4383 ],
    "link":"https://berlinwalks.wordpress.com/2011/10/28/berliner-mauerweg-part-1/",
    "people":[ "Charlie", "Liam", "Lisa", "Martin", "Rafi" ],
    "time":"2011-10-28T23:22:19+02:00",
    "title":"Berliner Mauerweg \u2013 Part 1",
    "walkers":5
  },
  { "bboxes":[ [ 13.41079, 52.4686, 13.47299, 52.51019 ] ],
    "categories":[ "Berliner Mauerweg" ],
    "dates":[ "2011-10-30" ],
    "distances":[ 9989 ],
    "link":"https://berlinwalks.wordpress.com/2011/10/30/berliner-mauerweg-part-2/",
    "people":[ "Christine", "Gernot", "Lisa" ],
    "time":"2011-10-30T15:37:39+01:00",
    "title":"Berliner Mauerweg \u2013 Part 2",
    "walkers":3
  }
]
```


pbftiles
--------

This tool creates multi-resolution [vector tiles][VT] in [protocol
buffer][PBF] format. It expects a GeoJSON file on standard input.

```sh
$ ./togj.js gpx/ | ./pbftiles.js
```


mkdb (obsolete)
----

This utility retrieves a list of RSS or Atom feeds whose URLs are specified
on the command line. Use `file:` URLs to read local files.

The standard output consists of a JSON file containing details for each
item, particularly their title, category, date and URL.

A list of participants is also generated for each item. The names are
extracted from the full-text description if the file `people.txt` contains
a list of names.

```sh
$ ./mkdb.py 'http://berlinwalks.wordpress.com/2011/10/feed'
```


bwfeeds (obsolete)
-------

This utility generates a list of URLs of RSS feeds for the BerlinWalks
blog, one for each month since its inception until today. This is necessary
in order to retrieve RSS feeds for all posts because each feed only
contains a limited number of items.

Its intended use is as argument generator for `mkdb`, like so:

```sh
$ ./bwfeeds.sh | xargs ./mkdb.py
```


[PBF]:  https://developers.google.com/protocol-buffers/
[VT]:   https://github.com/mapbox/vector-tile-spec/
