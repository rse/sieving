
const Sieving = require("..")

let items = [ "foo", "bar", "baz", "quux", "foo bar", "foo baz", "foo quux", "foo bar quux" ]

/*  step-by-step usage  */
let sieving = new Sieving()
sieving.parse("foo +bar -quux, baz^")
console.log(sieving.dump())
let result = sieving.sieve(items)
console.log(result)

/*  all-in-one usage  */
result = Sieving.sieve(items, "foo +bar -quux, baz^")
console.log(result)

