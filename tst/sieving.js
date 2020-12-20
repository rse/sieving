/*
**  Sieving -- Query-Based Item-List Reduction
**  Copyright (c) 2018-2020 Dr. Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const chai = require("chai")
const { expect } = chai
chai.config.includeStack = true

const Sieving = require("../lib/sieving.node.js")
const sieve = Sieving.sieve

const items = [ "foo", "bar", "baz", "quux", "foo bar baz quux" ]

describe("Sieving Library", () => {
    it("API availability", function () {
        expect(Sieving).to.respondTo("sieve")
        expect(typeof Sieving).to.be.equal("function")
        const sieving = new Sieving()
        expect(sieving).to.respondTo("parse")
        expect(sieving).to.respondTo("dump")
        expect(sieving).to.respondTo("evaluate")
        expect(sieving).to.respondTo("sieve")
    })
    it("terms variants", () => {
        expect(sieve(items, "foo")).deep.equal([ "foo", "foo bar baz quux" ])
        expect(sieve(items, "fo?")).deep.equal([ "foo", "foo bar baz quux" ])
        expect(sieve(items, "/fo./")).deep.equal([ "foo", "foo bar baz quux" ])
        expect(sieve(items, "'foo'")).deep.equal([ "foo" ])
    })
    it("fuzzy matching", () => {
        expect(sieve(items, "bax",  { fuzzy: true })).deep.equal([ "bar", "baz" ])
        expect(sieve(items, "fox",  { fuzzy: true })).deep.equal([ "foo" ])
        expect(sieve(items, "qxux", { fuzzy: true })).deep.equal([ "quux" ])
    })
    it("complex queries", () => {
        expect(sieve(items, "foo")).deep.equal([ "foo", "foo bar baz quux" ])
        expect(sieve(items, "foo bar")).deep.equal([ "foo bar baz quux" ])
        expect(sieve(items, "foo +bar")).deep.equal([ "foo", "foo bar baz quux", "bar" ])
        expect(sieve(items, "foo +bar -baz")).deep.equal([ "foo", "bar" ])
        expect(sieve(items, "foo, bar")).deep.equal([ "foo", "foo bar baz quux", "bar" ])
        expect(sieve(items, "bar, foo")).deep.equal([ "bar", "foo bar baz quux", "foo" ])
    })
    it("query boosting", () => {
        expect(sieve(items, "'foo' +'bar' +'quux'")).deep.equal([ "foo", "bar", "quux" ])
        expect(sieve(items, "'foo' +'bar'^ +'quux'^2")).deep.equal([ "quux", "bar", "foo" ])
    })
})

