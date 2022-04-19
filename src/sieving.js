/*
**  Sieving -- Query-Based Item-List Reduction
**  Copyright (c) 2018-2022 Dr. Ralf S. Engelschall <rse@engelschall.com>
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
const Tokenizr    = require("tokenizr")

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
        this.options = {
            wrap:      true,
            nsIds:     [],
            fieldId:   "id",
            fieldPrio: "prio",
            fieldNs:   "",
            ...options
        }

        /*  initialize internal state  */
        this.query = null
        this.lts   = null
        this.ast   = null
    }

    /*  parse query string into Abstract Syntax Tree (AST)  */
    parse (query, options = {}) {
        /*  sanity check argument  */
        if (typeof query !== "string")
            throw new Error("parse: invalid \"query\" argument")
        if (typeof options !== "object")
            throw new Error("parse: invalid \"options\" argument")

        /*  determine options  */
        options = {
            lts: true,
            ast: true,
            ...options
        }

        /*  store query  */
        this.query = query

        /*
         *  ==== tokenize query string into a Linear Token Stream (LTS) ====
         */

        this.lts = null
        if (options.lts) {
            /*  define tokenizer  */
            const tokenizer = new Tokenizr()
            tokenizer.rule(/\s+/, (ctx, match) => {
                ctx.accept("ws")
            })
            tokenizer.rule(/\+/, (ctx, match) => {
                ctx.accept("union", "+")
            })
            tokenizer.rule(/-/, (ctx, match) => {
                ctx.accept("subtraction", "-")
            })
            tokenizer.rule(/,/, (ctx, match) => {
                ctx.accept("union", ",")
            })
            tokenizer.rule(/[$#%@&]/, (ctx, match) => {
                ctx.accept("namespace")
            })
            tokenizer.rule(/([a-zA-Z_][a-zA-Z_0-9]*):/, (ctx, match) => {
                ctx.accept("namespace", match[1])
            })
            tokenizer.rule(/"((?:\\\"|[^"])*)"/, (ctx, match) => {
                const value = match[1]
                    .replace(/\\\\/g, "\\").replace(/\\"/g, "\"").replace(/\\"/g, "\"")
                    .replace(/\\b/g, "\b").replace(/\\v/g, "\v").replace(/\\f/g, "\f")
                    .replace(/\\t/g, "\t").replace(/\\n/g, "\n").replace(/\\r/g, "\r")
                    .replace(/\\e/g, "\e")
                    .replace(/\\x([0-9a-fA-f]{2})/g, (_, num) => String.fromCharCode(parseInt(num, 16)))
                    .replace(/\\u([0-9a-fA-f]{4})/g, (_, num) => String.fromCharCode(parseInt(num, 16)))
                ctx.accept("dquoted", value)
            })
            tokenizer.rule(/'((?:\\\'|[^'])*)'/, (ctx, match) => {
                const value = match[1].replace(/\\'/g, "'")
                ctx.accept("squoted", value)
            })
            tokenizer.rule(/\/((?:\\\/|[^/])*)\//, (ctx, match) => {
                let value = null
                try {
                    value = new RegExp(match[1])
                }
                catch (ex) {
                    value = null
                }
                if (value !== null)
                    ctx.accept("regexp", value)
                else
                    ctx.reject()
            })
            tokenizer.rule(/[^*?\[\]{}\r\n\t\v\f (),^+-]*[*?\[\]{}][^\r\n\t\v\f (),^+-]*/, (ctx, match) => {
                ctx.accept("glob")
            })
            /*
            tokenizer.rule(/[^*?\[\]{}\r\n\t\v\f (),^+-]+/, (ctx, match) => {
                ctx.accept("bareword")
            })
            */
            tokenizer.rule(/[a-zA-ZäöüÄÖÜß0-9_]+/, (ctx, match) => {
                ctx.accept("bareword")
            })
            tokenizer.rule(/\^(\d*)/, (ctx, match) => {
                ctx.accept("boost", match[1] ? parseInt(match[1]) : 1)
            })
            tokenizer.rule(/[()]/, (ctx, match) => {
                ctx.accept("group")
            })
            tokenizer.rule(/.+$/, (ctx, match) => {
                ctx.accept("error")
            })

            /*  tokenize the query  */
            try {
                tokenizer.input(query)
                this.lts = tokenizer.tokens()
            }
            catch (err) {
                throw new Error(`parse: query tokenizing failed: ${err}`)
            }
        }

        /*
         *  ==== parse query string into Abstract Syntax Tree (AST) ====
         */

        this.ast = null
        if (options.ast) {
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
            nodes = this.ast.query(`
                .// term [ @ns ]
            `)
            if (nodes.length > 0) {
                for (const node of nodes) {
                    const ns = node.get("ns")
                    if (this.options.nsIds.indexOf(ns) < 0) {
                        const { line, column } = node.pos()
                        if (ns.match(/^[$#%@&]$/))
                            throw new Error(`parse: namespace symbol "${ns}" not allowed ` +
                                `(line ${line}, column ${column})`)
                        else
                            throw new Error(`parse: namespace identifier "${ns}" not allowed ` +
                                `(line ${line}, column ${column})`)
                    }
                }
            }
        }
    }

    /*  dump the Linear Token Stream (LTS) and Abstract Syntax Tree (AST) with colorization  */
    dump (colorize = true) {
        let output = ""

        /*  dump query  */
        let title = "Query String:"
        output += `${colorize ? chalk.inverse.bold(title) : title}\n`
        if (colorize)
            output += chalk.blue(this.query)
        else
            output += this.query
        output += "\n\n"

        /*  dump LST  */
        title = "Linear Token Stream:"
        output += `${colorize ? chalk.inverse.bold(title) : title}\n`
        if (this.lts === null)
            output += "(still no LTS available)"
        else {
            for (const token of this.lts) {
                output += token.toString((type, text) => {
                    if (colorize) {
                        switch (type) {
                            case "type":   text = chalk.blue(text);   break
                            case "value":  text = chalk.green(text);  break
                            case "text":   text = chalk.yellow(text); break
                            case "pos":    text = chalk.yellow(text); break
                            case "line":   text = chalk.yellow(text); break
                            case "column": text = chalk.yellow(text); break
                            default:
                        }
                    }
                    return text
                }) + "\n"
            }
            output += "\n"
        }

        /*  dump AST  */
        title = "Abstract Syntax Tree:"
        output += `${colorize ? chalk.inverse.bold(title) : title}\n`
        if (this.ast === null)
            output += "(still no AST available)"
        else {
            output += this.ast.dump(Infinity, (type, text) => {
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

        return output
    }

    /*  format query string into a linear token stream  */
    format (format = "text") {
        /*  sanity check argument  */
        if (!(typeof format === "string" && format.match(/^(?:text|xml|html|json)/)))
            throw new Error("format: invalid \"format\" argument")

        /*  sanity check context  */
        if (this.lts === null)
            throw new Error("format: still no LTS of query available")

        /*  iterate over all tokens  */
        let output = ""
        const xmlEscape = (text) => {
            return text
                .replace(/\&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
        }
        for (const token of this.lts) {
            if (token.type === "EOF")
                continue
            if (format === "text")
                output += token.text
            else if (format === "xml")
                output += `<${token.type}>${xmlEscape(token.text)}</${token.type}>\n`
            else if (format === "html")
                output += `<span class="${token.type}">${xmlEscape(token.text)}</span>\n`
            else if (format === "json")
                output += `{ type: "${token.type}", text: ${JSON.stringify(token.text)} },\n`
        }
        if (format === "xml")
            output = `<query>\n${output}</query>\n`
        else if (format === "html")
            output = `<span class="query">\n${output}</span>\n`
        else if (format === "json")
            output = `[\n${output}]\n`
        return output
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
            if (node.type() === "union") {
                const [ n1, n2 ] = node.childs()
                const r1 = evaluateNode(n1) /* RECURSION */
                const r2 = evaluateNode(n2) /* RECURSION */
                result = listUnion(r1, r2)
            }
            else if (node.type() === "intersection") {
                const [ n1, n2 ] = node.childs()
                const r1 = evaluateNode(n1) /* RECURSION */
                const r2 = evaluateNode(n2) /* RECURSION */
                result = listIntersection(r1, r2)
            }
            else if (node.type() === "subtraction") {
                const [ n1, n2 ] = node.childs()
                const r1 = evaluateNode(n1) /* RECURSION */
                const r2 = evaluateNode(n2) /* RECURSION */
                result = listSubtraction(r1, r2)
            }
            else if (node.type() === "group") {
                const n1 = node.child(0)
                result = evaluateNode(n1) /* RECURSION */
            }
            else if (node.type() === "term") {
                const nN = node.query("/ ns")
                const nM = node.query("/ squoted, / dquoted, / regexp, / glob, / bareword")
                const nB = node.query("/ boost")

                /*  gather information  */
                const ns    = nN.length === 1 ? nN[0].get("value") : this.options.fieldNs
                const type  = nM[0].type()
                const value = nM[0].get("value")
                const boost = nB.length === 1 ? nB[0].get("value") : 0

                /*  retrieve single result list via callback  */
                result = queryResults(ns, type, value)

                /*  post-process result  */
                result = result.map((item) => {
                    /*  optionally wrap result item  */
                    if (this.options.wrap)
                        item = { value: item }

                    /*  provide id field  */
                    if (item[this.options.fieldId] === undefined)
                        item[this.options.fieldId] = objectHash(this.options.wrap ? item.value : item)

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
            throw new Error("sieve: invalid items argument (expected array)")
        if (typeof options !== "object")
            throw new Error("sieve: invalid options argument (expected object)")

        /*  sanity check context  */
        if (this.ast === null)
            throw new Error("sieve: still no AST of query available")

        /*  determine options  */
        options = {
            fuzzy:  false,
            maxLS:  2,
            minDC:  0.50,
            ...options
        }

        /*  evaluate the AST  */
        return this.evaluate((ns, type, value) => {
            const valueOfItem = (item) => {
                if (typeof item === "string")
                    return item
                else if (typeof item === "object" && ns !== "" && item[ns] !== undefined)
                    return item[ns]
                else
                    throw new Error("sieve: cannot determine item value of item")
            }
            return items.filter((item) => {
                const itemValue = valueOfItem(item)
                if (type === "regexp")
                    return value.exec(itemValue)
                else if (type === "glob")
                    return minimatch(itemValue, `*${value}*`)
                else if (type === "dquoted" || type === "squoted")
                    return (itemValue === value
                        || (options.fuzzy
                            && (dice(itemValue, value) >= options.minDC
                                || levenshtein.get(itemValue, value) <= options.maxLS)))
                else if (type === "bareword")
                    return (itemValue.indexOf(value) >= 0
                        || (options.fuzzy
                            && (dice(itemValue, value) >= options.minDC
                                || levenshtein.get(itemValue, value) <= options.maxLS)))
                else
                    throw new Error("sieve: invalid type")
            })
        })
    }

    /*  static function for all-in-one sieving  */
    static sieve (items, query, options = {}) {
        const sieving = new Sieving(options)
        sieving.parse(query)
        if (options.debug)
            console.log(sieving.dump())
        return sieving.sieve(items, options)
    }
}

/*  export the API class  */
module.exports = Sieving

