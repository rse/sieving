
const { sieve }  = require(".")
const { expect } = require("chai")

let items = [ "foo", "bar", "baz", "quux", "foo bar baz quux" ]

expect(sieve(items, "foo"))  .deep.equal([ "foo", "foo bar baz quux" ])
expect(sieve(items, "fo?"))  .deep.equal([ "foo", "foo bar baz quux" ])
expect(sieve(items, "/fo./")).deep.equal([ "foo", "foo bar baz quux" ])
expect(sieve(items, "'foo'")).deep.equal([ "foo" ])

expect(sieve(items, "bax",  { fuzzy: true })).deep.equal([ "bar", "baz" ])
expect(sieve(items, "fox",  { fuzzy: true })).deep.equal([ "foo" ])
expect(sieve(items, "qxux", { fuzzy: true })).deep.equal([ "quux" ])

