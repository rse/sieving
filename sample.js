
const Sieving = require(".")
let sieving = new Sieving()

let items = [ "foo", "bar", "baz", "quux", "foo:bar:quux", "foo:baz:quux" ]
sieving.parse("foo +bar -quux, baz^")
sieving.dump()
let result = sieving.sieve(items, true)
console.log(result)

