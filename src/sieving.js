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

/*  external requirements  */
const ASTY        = require("asty-astq")
const PEG         = require("pegjs-otf")
const PEGUtil     = require("pegjs-util")
const chalk       = require("chalk")
const objectHash  = require("object-hash")
const minimatch   = require("minimatch")
const dice        = require("dice-coefficient")
const levenshtein = require("fast-levenshtein")

/*  pre-parse PEG grammar (replaced by browserify)  */
const PEGparser = PEG.generateFromFile(`${__dirname}/sieving.pegjs`, {
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
        const result = PEGUtil.parse(PEGparser, query, {
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
            const node = nodes[0]
            const { line, column } = node.pos()
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
            const node = nodes[0]
            const { line, column } = node.pos()
            throw new Error("parse: negated terms only not allowed " +
                `(line ${line}, column ${column})`)
        }
    }

    /*  dump the Abstract Syntax Tree (AST) with colorization  */
    dump (colorize = true) {
        /*  sanity check context  */
        if (this.ast === null)
            throw new Error("evaluate: still no AST of query available")

        /*  pass-through control to ASTy's dump functionality  */
        return this.ast.dump(Infinity, (type, text) => {
            if (colorize) {
                switch (type) {
                    case "tree":     text = chalk.grey(text);   break
                    case "type":     text = chalk.blue(text);   break
                    case "value":    text = chalk.yellow(text); break
                    case "position": text = chalk.grey(text);   break
                    default:
                }
            }
            return text
        })
    }

    /*  format Abstract Syntax Tree (AST) into query string  */
    format () {
        /*  evaluate an AST node  */
        const formatNode = (node) => {
            let query = ""
            if (node.type() === "queries") {
                /*  format all queries  */
                node.query("/ query").forEach((node, i, nodes) => {
                    /*  format query  */
                    query += formatNode(node) /* RECURSION */
                    if (i < nodes.length - 1)
                        query += ", "
                })
            }
            else if (node.type() === "query") {
                /*  format all terms  */
                node.query("/ term").forEach((node) => {
                    /*  format term  */
                    if (query !== "")
                        query += " "
                    if (node.get("op") === "union")
                        query += "+"
                    else if (node.get("op") === "subtraction")
                        query += "-"
                    query += formatNode(node) /* RECURSION */
                })
            }
            else if (node.type() === "term") {
                /*  format single term  */
                const value = node.get("value")
                const ns    = node.get("ns")
                const boost = node.get("boost")
                if (ns)
                    query += `${ns}:`
                query += value
                if (boost)
                    query += (boost === 1 ? "^" : `^${boost}`)
            }
            return query
        }

        /*  format AST from the root node  */
        return formatNode(this.ast)
    }

    /*  evaluate the Abstract Syntax Tree (AST)  */
    evaluate (queryResults) {
        /*  sanity check arguments  */
        if (typeof queryResults !== "function")
            throw new Error("evaluate: invalid argument")

        /*  sanity check context  */
        if (this.ast === null)
            throw new Error("evaluate: still no AST of query available")

        /*  perform set-operations on result lists  */
        const listUnion = (a, b) => {
            const r = []
            const idx = {}
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
            const r = []
            const idx = {}
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
            const r = []
            const idx = {}
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
                    const subResult = evaluateNode(node) /* RECURSION */

                    /*  process results  */
                    result = result !== null ? listUnion(result, subResult) : subResult
                })
            }
            else if (node.type() === "query") {
                /*  evaluate all terms  */
                node.query("/ term").forEach((node) => {
                    /*  evaluate term  */
                    const subResult = evaluateNode(node) /* RECURSION */

                    /*  process results  */
                    if (node.get("op") === "union")
                        result = result !== null ? listUnion(result, subResult) : subResult
                    else if (node.get("op") === "subtraction")
                        result = result !== null ? listSubtraction(result, subResult) : []
                    else
                        result = result !== null ? listIntersection(result, subResult) : subResult
                })
            }
            else if (node.type() === "term") {
                const type  = node.get("type")
                const value = node.get("value")
                const ns    = node.get("ns")    || this.options.fieldNs
                const boost = node.get("boost") || 0
                result = queryResults(ns, type, value)

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

        /*  sanity check context  */
        if (this.ast === null)
            throw new Error("sieve: still no AST of query available")

        /*  determine options  */
        options = Object.assign({}, {
            fuzzy:  false,
            maxLS:  2,
            minDC:  0.50
        }, options)

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
                const itemValue = valueOfItem(item)
                if (type === "regexp")
                    return value.exec(itemValue)
                else if (type === "glob")
                    return minimatch(itemValue, `*${value}*`)
                else if (type === "quoted")
                    return (itemValue === value
                        || (options.fuzzy
                            && (dice(itemValue, value) >= options.minDC
                                || levenshtein.get(itemValue, value) <= options.maxLS)))
                else if (type === "bare")
                    return (itemValue.indexOf(value) >= 0
                        || (options.fuzzy
                            && (dice(itemValue, value) >= options.minDC
                                || levenshtein.get(itemValue, value) <= options.maxLS)))
                else
                    throw new Error("filter: invalid type")
            })
        })
    }

    /*  static function for all-in-one sieving  */
    static sieve (items, query, options = {}) {
        const sieving = new Sieving(options)
        sieving.parse(query)
        if (options.debug)
            sieving.dump()
        return sieving.sieve(items, options)
    }
}

/*  export the API class  */
module.exports = Sieving

