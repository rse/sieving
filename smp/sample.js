
const Sieving = require("..")

let items = [ "foo", "bar", "baz", "quux", "foo bar", "foo baz", "foo quux", "foo bar quux" ]

/*  step-by-step usage  */
let sieving = new Sieving({ nsIds: [ "foo", "#" ] })
const query = "foo + ('foo' \"f\\\"\\x20oo\") foo*bar /foo.*bar/, foo bar +foo -foo, foo:bar #bar, foo^ bar^42"
sieving.parse(query)
console.log(sieving.dump())
let result = sieving.sieve(items)
console.log(result)

/*  all-in-one usage  */
result = Sieving.sieve(items, "foo +bar -quux, baz^")
console.log(result)

