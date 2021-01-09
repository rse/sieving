
Sieving
=======

Query-Based Item-List Reduction for JavaScript

<p/>
<img src="https://nodei.co/npm/sieving.png?downloads=true&stars=true" alt=""/>

<p/>
<img src="https://david-dm.org/rse/sieving.png" alt=""/>

About
-----

Sieving is a JavaScript library for reducing/filtering a JavaScript
list of items, based on a simple simple query language. It is intended
to be used for item list filtering or item list searching purposes
within Browser or Node.js environments. Internally, Sieving is based
on a full-blown query parser, supports optional fuzzy matching and
namespacing of items, and supports union, intersection and subtraction
of the result sets.

A query like...

```
foo bar^ +baz -quux, baz
```

...on a result set basis and mathematically means...

```
(((MATCH("foo") ∩ BOOST(MATCH("bar"), 1)) ∪ MATCH("baz")) ∖ MATCH("quux")) ∪ MATCH("baz")
```

...or expressed in a functional way:

```
UNION(
    SUBTRACT(
        UNION(
            INTERSECT(
                MATCH("foo"),
                BOOST(MATCH("bar"), 1)),
            MATCH("baz")),
        MATCH("quux")),
    MATCH("baz"))
```

Installation
------------

```shell
$ npm install sieving
```

Usage
-----

```js
const Sieving = require("sieving")

let items = [ "foo", "bar", "baz", "quux", "foo bar", "foo baz", "foo quux", "foo bar quux" ]

/*  step-by-step usage  */
let sieving = new Sieving()
sieving.parse("foo +bar -quux, baz^")
console.log(sieving.format())
console.log(sieving.dump())
let result = sieving.sieve(items)
console.log(result)

/*  all-in-one usage  */
result = Sieving.sieve(items, "foo +bar -quux, baz^")
console.log(result)
```

Output:

```
queries [1,1]
├── query [1,1]
│   ├── term (value: "foo", type: "bare") [1,1]
│   ├── term (op: "union", value: "bar", type: "bare") [1,5]
│   └── term (op: "subtraction", value: "quux", type: "bare") [1,10]
└── query [1,17]
    └── term (value: "baz", type: "bare", boost: 1) [1,17]

[ 'baz', 'foo', 'foo bar', 'foo baz', 'bar' ]
[ 'baz', 'foo', 'foo bar', 'foo baz', 'bar' ]
```

Examples
--------

```js
const { sieve }  = require("sieving")
const { expect } = require("chai")

let items = [ "foo", "bar", "baz", "quux", "foo bar baz quux" ]

expect(sieve(items, "foo"))  .deep.equal([ "foo", "foo bar baz quux" ])
expect(sieve(items, "fo?"))  .deep.equal([ "foo", "foo bar baz quux" ])
expect(sieve(items, "/fo./")).deep.equal([ "foo", "foo bar baz quux" ])
expect(sieve(items, "'foo'")).deep.equal([ "foo" ])

expect(sieve(items, "bax",  { fuzzy: true })).deep.equal([ "bar", "baz" ])
expect(sieve(items, "fox",  { fuzzy: true })).deep.equal([ "foo" ])
expect(sieve(items, "qxux", { fuzzy: true })).deep.equal([ "quux" ])

expect(sieve(items, "foo"))          .deep.equal([ "foo", "foo bar baz quux" ])
expect(sieve(items, "foo bar"))      .deep.equal([ "foo bar baz quux" ])
expect(sieve(items, "foo +bar"))     .deep.equal([ "foo", "foo bar baz quux", "bar" ])
expect(sieve(items, "foo +bar -baz")).deep.equal([ "foo", "bar" ])
expect(sieve(items, "foo, bar"))     .deep.equal([ "foo", "foo bar baz quux", "bar" ])
expect(sieve(items, "bar, foo"))     .deep.equal([ "bar", "foo bar baz quux", "foo" ])
```

Query Syntax
------------

The following is a symbolic grammar describing the supported
query syntax. For more subtle details, see the [actual PEG grammar](src/sieving.pegjs)
of the underlying parser.

```
queries    ::=  query ("," query)*                  // union of queries
query      ::=  term (" " term)*                    // intersection of terms
term       ::=  operation? namespace? text boost?   // single query term
operation  ::=  "+" | "-"                           // force union or subtraction of term
namespace  ::=  symbol | id ":"                     // match against a particular namespace
text       ::=  quoted | regexp | glob | bareword   // four variants of the term
boost      ::=  "^" number?                         // optionally boost the results
quoted     ::=  /"(\\"|[^"])*"/ | /'(\\'|[^'])*'/   // double- or single-quoted term
regexp     ::=  /\/(\\\/|[^\/])*\//                 // regular expression term
glob       ::=  /.*[*?[\]{}].*/                     // glob-style term
bareword   ::=  /.+/                                // bareword term
number     ::=  /\d*\.\d+/ | /\d+/                  // floating or integer number
symbol     ::=  /^[$#%@&]$/                         // namesapce symbol
id         ::=  /^[a-zA-Z][a-zA-Z0-9-_]*$/          // namespace identifier
```

Application Programming Interface (API)
---------------------------------------

The following is the API as a TypeScript declaration.
See also the [actual TypeScript definition file](src/sieving.d.ts).

```ts
declare module "Sieving" {
    class Sieving {
        /*  create Sieving instance  */
        public constructor(
            options?: {
                wrap:      boolean,  /*  whether to internally wrap items (default: true)  */
                nsIds:     string[], /*  list of allowed namespace identifier and namespace symbols (default: [])  */
                fieldId:   string,   /*  name of identifier field in items (default: "id")  */
                fieldPrio: string,   /*  name of priority field in items (default: "prio" ) */
                fieldNs:   string    /*  name of namespace field in items (default: "")  */
            }
        )

        /*  parse query into an internal AST  */
        parse(
            query:         string,   /*  query string  */
            options?: {
                lts:       boolean,  /*  parse query string into LST (default: true)  */
                ast:       boolean   /*  parse query string into AST (default: true)  */
            }
        ): void

        /*  dump internal AST as text (for debugging purposes only)  */
        dump(
            colorize?:     boolean   /*  whether to colorize output (default: true)  */
        ): string

        /*  format internal AST into query string  */
        format(
           format:         string    /*  format of output (default "text", or "html", "xml" or "json")  */
        ): string

        /*  evaluate internal AST (for custom matching)  */
        evaluate(
            queryResults: (
                ns:        string,   /*  term namespace (default: "")  */
                type:      string,   /*  term type ("regexp", "glob", "squoted", "dquoted", or "bareword")  */
                value:     string    /*  term value  */
            ) => any[]
        ): any[]

        /*  sieve items by evaluating query with standard matching  */
        sieve(
            items: any[],            /*  list of items to sieve/filter  */
            options?: {
                fuzzy:     boolean,  /*  whether to fuzzy match quoted and bare terms (default: false)  */
                maxLS:     number,   /*  maximum Levenshtein distance for fuzzy matching (default: 2)  */
                minDC:     number    /*  minimum Dice-Coefficient for fuzzy matching (default: 0.50)  */
            }
        ): any[]

        /*  sieve items by evaluating query with standard matching (stand-alone)  */
        static sieve(
            items: any[],            /*  list of items to sieve/filter  */
            query: string,           /*  query string  */
            options?: {
                wrap:      boolean,  /*  whether to internally wrap items (default: true)  */
                nsIds:     string[], /*  list of allowed namespace identifier and namespace symbols (default: [])  */
                fieldId:   string,   /*  name of identifier field in items (default: "id")  */
                fieldPrio: string,   /*  name of priority field in items (default: "prio" ) */
                fieldNs:   string,   /*  name of namespace field in items (default: "")  */
                fuzzy:     boolean,  /*  whether to fuzzy match quoted and bare terms (default: false)  */
                maxLS:     number,   /*  maximum Levenshtein distance for fuzzy matching (default: 2)  */
                minDC:     number    /*  minimum Dice-Coefficient for fuzzy matching (default: 0.50)  */
                debug:     boolean   /*  whether to dump the internal AST to stdout  */
            }
        ): any[]
    }
    export = Sieving
}
```

License
-------

Copyright &copy; 2018-2021 Dr. Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

