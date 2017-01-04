Toolbox
=======

wpidx
-----

This utility retrieves posts from a WordPress blog via its [REST
API](http://v2.wp-api.org/).

The standard output consists of a JSON file containing details for each
item, particularly their title, category, date and URL.

A list of participants is also generated for each item. The names are
extracted from the full-text description if the file `people.txt` contains
a list of names.

```sh
$ ./wpidx.py 'https://public-api.wordpress.com/wp/v2/sites/berlinwalks.wordpress.com/'
```

The output is identical to that of `mkdb`.


mkdb
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

Sample output looks like this:

```json
[ { "categories":[ "Berliner Mauerweg" ],
    "dates":[ "2011-10-30T14:37:39+01:00" ],
    "link":"https://berlinwalks.wordpress.com/2011/10/30/berliner-mauerweg-part-2/",
    "people":[ "Christine", "Gernot" ],
    "title":"Berliner Mauerweg \u2013 Part 2"
  },
  { "categories":[ "Berliner Mauerweg" ],
    "dates":[ "2011-10-28T23:22:19+02:00" ],
    "link":"https://berlinwalks.wordpress.com/2011/10/28/berliner-mauerweg-part-1/",
    "people":[ "Charlie", "Liam", "Martin", "Rafi" ],
    "title":"Berliner Mauerweg \u2013 Part 1"
  },
  { "categories":[ "Background" ],
    "dates":[ "2011-10-27T16:41:01+02:00" ],
    "link":"https://berlinwalks.wordpress.com/2011/10/27/hello-world/",
    "people":[ "Leandro" ],
    "title":"Berlin walks- how, when and where it all started"
  }
]
```


bwfeeds
-------

This utility generates a list of URLs of RSS feeds for the BerlinWalks
blog, one for each month since its inception until today. This is necessary
in order to retrieve RSS feeds for all posts because each feed only
contains a limited number of items.

Its intended use is as argument generator for `mkdb`, like so:

```sh
$ ./bwfeeds.sh | xargs ./mkdb.py
```
