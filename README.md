
Sieving
=======

Query-Based Item-List Reduction for JavaScript

<p/>
<img src="https://nodei.co/npm/sieving.png?downloads=true&stars=true" alt=""/>

<p/>
<img src="https://david-dm.org/rse/sieving.png" alt=""/>

About
-----

This is a JavaScript library for reducing/filtering a JavaScript list
of items, based on a query language. It is intended to be used for item
filtering or searching purposes within browser or Node.js environments.

Installation
------------

```shell
$ npm install sieving
```

Usage
-----

```js
const Sieving = require("sieving")

let items = [ "foo", "bar", "baz", "quux", "foo:bar:quux", "foo:baz:quux" ]

/*  step-by-step usage  */
let sieving = new Sieving()
sieving.parse("foo +bar -quux, baz^")
sieving.dump()
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

[ 'baz', 'foo:baz:quux', 'foo', 'bar' ]
[ 'baz', 'foo:baz:quux', 'foo', 'bar' ]
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
namespace  ::=  id ":"                              // match against a particular namespace
text       ::=  quoted | regexp | glob | bareword   // four variants of the term
boost      ::=  "^" number?                         // optionally boost the results
quoted     ::=  /"(\\"|[^"])*"/ | /'(\\'|[^'])*'/   // double- or single-quoted term
regexp     ::=  /\/(\\\/|[^\/])*\//                 // regular expression term
glob       ::=  /.*[*?[\]{}].*/                     // glob-style term
bareword   ::=  /.+/                                // bareword term
number     ::=  /\d*\.\d+/ | /\d+/                  // floating or integer number
```

```js
const { sieve } = require("sieving")
let items = [ "foo", "bar", "baz", "quux", "foo:bar:quux", "foo:baz:quux" ]
console.log(sieve(items, "foo")) // -> [ "foo" ]
console.log(sieve(items, "fox")) // -> []
console.log(sieve(items, "fox", { fuzzy: true })) // -> [ "foo" ]
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
                wrap:      boolean,  /*  whether to internally wrap items  */
                fieldId:   string,   /*  name of identifier field in items  */
                fieldPrio: string,   /*  name of priority field in items  */
                fieldNs:   string    /*  name of namespace field in items  */
            }
        )

        /*  parse query into an internal AST  */
        parse(
            query: string            /*  query string  */
        ): void;

        /*  dump internal AST to console (for debugging purposes only)  */
        dump(
        ): void;

        /*  evaluate internal AST (for custom matching)  */
        evaluate(
            queryResults: (
                ns:        string,   /*  term namespace (empty string by default)  */
                type:      string,   /*  term type ("regexp", "glob", "quoted", or "bare")  */
                value:     string    /*  term value  */
            ) => any[]
        ): any[];

        /*  sieve items by evaluating query with standard matching  */
        sieve(
            items: any[],            /*  list of items to sieve/filter  */
            options?: {
                fuzzy:     boolean   /*  whether to fuzzy match quoted and bare terms  */
            }
        ): any[];

        /*  sieve items by evaluating query with standard matching (stand-alone)  */
        static sieve(
            items: any[],            /*  list of items to sieve/filter  */
            query: string,           /*  query string  */
            options?: {
                wrap:      boolean,  /*  whether to internally wrap items  */
                fieldId:   string,   /*  name of identifier field in items  */
                fieldPrio: string,   /*  name of priority field in items  */
                fieldNs:   string,   /*  name of namespace field in items  */
                fuzzy:     boolean   /*  whether to fuzzy match quoted and bare terms  */
            }
        ): any[];
    }
    export = Sieving
}
```

License
-------

Copyright (c) 2018 Ralf S. Engelschall (http://engelschall.com/)

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

