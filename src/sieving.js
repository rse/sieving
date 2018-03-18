/*
**  Sieving -- Query-Based Item-List Reduction
**  Copyright (c) 2018 Ralf S. Engelschall <rse@engelschall.com>
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

/*  external requirements  */
const ASTY       = require("asty-astq")
const PEG        = require("pegjs-otf")
const PEGUtil    = require("pegjs-util")
const chalk      = require("chalk")
const objectHash = require("object-hash")
const minimatch  = require("minimatch")
const dice       = require("dice-coefficient")

/*  pre-parse PEG grammar (replaced by browserify)  */
var PEGparser = PEG.generateFromFile(`${__dirname}/sieving.pegjs`, {
    optimize: "size",
    trace: false
})

/*  the API class  */
class Sieving {
    /*  create API instance  */
    constructor (options = {}) {
        /*  determine options  */
        this.options = Object.assign({}, {
            wrap:      true,
            fieldId:   "id",
            fieldPrio: "prio",
            fieldNs:   ""
        }, options)

        /*  initialize internal state  */
        this.ast = null
    }

    /*  parse query string into Abstract Syntax Tree (AST)  */
    parse (query) {
        /*  sanity check argument  */
        if (typeof query !== "string")
            throw new Error("invalid query argument")

        /*  parse specification into Abstract Syntax Tree (AST)  */
        const asty = new ASTY()
        let result = PEGUtil.parse(PEGparser, query, {
            startRule: "root",
            makeAST: (line, column, offset, args) => {
                return asty.create.apply(asty, args).pos(line, column, offset)
            }
        })
        if (result.error !== null)
            throw new Error("parse: query parsing failure:\n" +
                PEGUtil.errorMessage(result.error, true).replace(/^/mg, "ERROR: ") + "\n")
        this.ast = result.ast

        /*  post-process AST: sanity check structure  */
        let nodes = this.ast.query(`
            .// term [
                @op == "subtraction" && @boost
            ]
        `)
        if (nodes.length > 0) {
            let node = nodes[0]
            let { line, column } = node.pos()
            throw new Error("parse: boosting not allowed on negated term " +
                `(line ${line}, column ${column}): "${node.get("value")}"`)
        }
        nodes = this.ast.query(`
            .// query [
                / term [ @op == "subtraction" ] &&
                count(/ term [ @op != "subtraction" ]) == 0
            ]
        `)
        if (nodes.length > 0) {
            let node = nodes[0]
            let { line, column } = node.pos()
            throw new Error("parse: negated terms only not allowed " +
                `(line ${line}, column ${column})`)
        }
    }

    /*  dump the Abstract Syntax Tree (AST) with colorization  */
    dump () {
        if (this.ast !== null) {
            /* eslint no-console: off */
            console.log(this.ast.dump(Infinity, (type, text) => {
                switch (type) {
                    case "tree":     text = chalk.grey(text);   break
                    case "type":     text = chalk.blue(text);   break
                    case "value":    text = chalk.yellow(text); break
                    case "position": text = chalk.grey(text);   break
                    default:
                }
                return text
            }))
        }
    }

    /*  evaluate the Abstract Syntax Tree (AST)  */
    evaluate (callback) {
        if (typeof callback !== "function")
            throw new Error("evaluate: invalid callback argument")

        /*  perform set-operations on result lists  */
        const listUnion = (a, b) => {
            let r = []
            let idx = {}
            a.forEach((x) => {
                r.push(x)
                idx[x[this.options.fieldId]] = true
            })
            b.forEach((x) => {
                if (!idx[x[this.options.fieldId]])
                    r.push(x)
            })
            return r
        }
        const listIntersection = (a, b) => {
            let r = []
            let idx = {}
            b.forEach((x) => {
                idx[x[this.options.fieldId]] = x
            })
            a.forEach((x) => {
                if (idx[x[this.options.fieldId]])
                    r.push(x)
            })
            return r
        }
        const listSubtraction = (a, b) => {
            let r = []
            let idx = {}
            b.forEach((x) => {
                idx[x[this.options.fieldId]] = x
            })
            a.forEach((x) => {
                if (!idx[x[this.options.fieldId]])
                    r.push(x)
            })
            return r
        }

        /*  evaluate an AST node  */
        const evaluateNode = (node) => {
            let result = null
            if (node.type() === "queries") {
                /*  evaluate all queries  */
                node.query("/ query").forEach((node) => {
                    /*  evaluate query  */
                    let subResult = evaluateNode(node) /* RECURSION */

                    /*  process results  */
                    if (result !== null)
                        result = listUnion(result, subResult)
                    else
                        result = subResult
                })
            }
            if (node.type() === "query") {
                /*  evaluate all terms  */
                node.query("/ term").forEach((node) => {
                    /*  evaluate term  */
                    let subResult = evaluateNode(node) /* RECURSION */

                    /*  process results  */
                    if (node.get("op") === "union")
                        result = result !== null ? listUnion(result, subResult) : subResult
                    else if (node.get("op") === "subtraction")
                        result = result !== null ? listSubtraction(result, subResult) : []
                    else if (result !== null)
                        result = listIntersection(result, subResult)
                    else
                        result = subResult
                })
            }
            else if (node.type() === "term") {
                let type  = node.get("type")
                let value = node.get("value")
                let ns    = node.get("ns")    || this.options.fieldNs
                let boost = node.get("boost") || 0
                result = callback(ns, type, value)

                /*  post-process result  */
                result = result.map((item) => {
                    /*  optionally wrap result item  */
                    if (this.options.wrap)
                        item = { value: item }

                    /*  provide id field  */
                    if (item[this.options.fieldId] === undefined)
                        item[this.options.fieldId] =
                            objectHash(this.options.wrap ? item.value : item)

                    /*  provide priority field  */
                    if (item[this.options.fieldPrio] === undefined)
                        item[this.options.fieldPrio] = 1

                    /*  optionally boost item  */
                    if (boost !== 0)
                        item[this.options.fieldPrio] *= (1 + boost)

                    return item
                })
            }
            if (result === null)
                result = []
            return result
        }

        /*  evaluate AST from the root node  */
        let result = evaluateNode(this.ast)

        /*  sort result according to (boosted) priority  */
        result = result.sort((a, b) =>
            b[this.options.fieldPrio] - a[this.options.fieldPrio])

        /*  optionally reduce to plain results again  */
        if (this.options.wrap)
            result = result.map((item) => item.value)

        return result
    }

    /*  sieve items by evaluating against the Abstract Syntax Tree (AST)  */
    sieve (items, options = {}) {
        /*  sanity check arguments  */
        if (!(typeof items === "object" && items instanceof Array))
            throw new Error("filter: invalid items argument (expected array)")
        if (typeof options !== "object")
            throw new Error("filter: invalid options argument (expected object)")

        /*  determine options  */
        options = Object.assign({}, { fuzzy: false }, options)

        /*  evaluate the AST  */
        return this.evaluate((ns, type, value) => {
            const valueOfItem = (item) => {
                if (typeof item === "string")
                    return item
                else if (typeof item === "object" && ns !== "" && item[ns] !== undefined)
                    return item[ns]
                else
                    throw new Error("filter: cannot determine item value of item")
            }
            return items.filter((item) => {
                let itemValue = valueOfItem(item)
                if (type === "regexp")
                    return value.exec(itemValue)
                else if (type === "glob")
                    return minimatch(itemValue, `*${value}*`)
                else if (type === "quoted") {
                    return (
                        itemValue === value
                        || (options.fuzzy && dice(itemValue, value) >= 0.5)
                    )
                }
                else if (type === "bare") {
                    return (
                        itemValue.indexOf(value) >= 0
                        || (options.fuzzy && dice(itemValue, value) >= 0.5)
                    )
                }
            })
        })
    }

    /*  static function for all-in-one sieving  */
    static sieve (items, query, options = {}) {
        const sieving = new Sieving(options)
        sieving.parse(query)
        return sieving.sieve(items, options)
    }
}

/*  export the API class  */
module.exports = Sieving

