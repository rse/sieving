
Sieving
========

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

Query Syntax Grammar
--------------------

```
queries    ::=  query ("," query)*
query      ::=  term (" " term)*
term       ::=  operation? namespace? text boost?
operation  ::=  "+" | "-"
namespace  ::=  id ":"
text       ::=  quoted | regexp | glob | bareword
boost      ::=  "^" number?
quoted     ::=  /"(\\"|[^"])*"/ | /'(\\'|[^'])*'/
regexp     ::=  /\/(\\\/|[^\/])*\//
glob       ::=  /.*[*?[\]{}].*/
bareword   ::=  /.+/
number     ::=  /\d*\.\d+/ | /\d+/
```

Application Programming Interface (API)
---------------------------------------

```js
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

