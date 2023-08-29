/*
**  Sieving -- Query-Based Item-List Reduction
**  Copyright (c) 2018-2023 Dr. Ralf S. Engelschall <rse@engelschall.com>
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

{
    var unroll = options.util.makeUnroll(location, options)
    var ast    = options.util.makeAST   (location, options)
}

root
    =   q:queries eof {
            return q
        }

queries
    =   prolog:ws? head:query tail:(outerUnionOperation query)+ epilog:ws? {
            let queries = head
            for (const item of tail) {
                let [ op, query ] = item
                queries = op.add(queries, query)
            }
            if (prolog) queries.set("prolog", prolog + (queries.get("prolog") || ""))
            if (epilog) queries.set("epilog", (queries.get("epilog") || "") + epilog)
            return queries
        }
    /   prolog:ws? query:query epilog:ws? {
            if (prolog) query.set("prolog", prolog + (query.get("prolog") || ""))
            if (epilog) query.set("epilog", (query.get("epilog") || "") + epilog)
            return query
        }

query
    =   head:term tail:(ws op:operation? ws? term)+ {
            let result = head
            for (const item of tail) {
                let [ ws, op, ws2, term ] = item
                if (!op) {
                    let pos = term.pos()
                    op = ast("intersection").set({ text: "" })
                        .pos(pos.line, pos.column, pos.offset)
                }
                op.set({ prolog: ws.get("text") })
                if (ws2)
                    op.set({ epilog: ws2.get("text") })
                result = op.add(result, term)
            }
            return result
        }
    /   term

term
    =   prolog:$("(") queries:queries epilog:$(")") {
            return ast("group").set({ prolog: prolog, epilog: epilog }).add(queries)
        }
    /   ns:namespace? term:(regexp / glob / quoted / bareword) boost:boost? {
            let result = ast("term")
            if (ns)
                result.add(ns)
            result.add(term)
            if (boost)
                result.add(boost)
            return result
        }

outerUnionOperation "outer union operation"
    =   ws? "," ws? {
            return ast("union").set({ text: text() })
        }

operation "intersection/union/subtraction operation"
    =   $("=" / "&") {
            return ast("intersection").set({ text: text() })
        }
    /   $("+" / "|") {
            return ast("union").set({ text: text() })
        }
    /   $("-" / "!") {
            return ast("subtraction").set({ text: text() })
        }

namespace "namespace"
    =   ch:$([$#%@&]) {
            return ast("namespace").set({ text: text(), value: ch })
        }
    /   id:id ":" {
            return ast("namespace").set({ text: text(), value: id.get("value") })
        }

boost "boost"
    =   "^" n:number? {
            return ast("boost").set({ text: text(), value: n ? n.get("value") : 1 })
        }

number "numeric literal"
    =   n:$([0-9]* "." [0-9]+) {
            return ast("number").set({ text: text(), value: parseFloat(n) })
        }
    /   n:$([0-9]+) {
            return ast("number").set({ text: text(), value: parseInt(n, 10) })
        }

id "identifier"
    =   s:$([a-zA-Z][a-zA-Z0-9-_]*) {
            return ast("id").set({ text: text(), value: s })
        }

regexp "regular expression literal"
    =   "/" re:$(("\\/" / [^/])*) "/" {
            var v
            try { v = new RegExp(re.replace(/\\\//g, "/")) }
            catch (e) { error(e.message) }
            return ast("regexp").set({ text: text(), value: v })
        }

glob "glob literal"
    =   s:$(
            (![*?\[\]{}\r\n\t\v\f (),^+-] .)*
            ("*" / "?" / "[" / "]" / "{" / "}")
            (![\r\n\t\v\f (),^+-] .)*
        ) {
            return ast("glob").set({ text: text(), value: s })
        }

bareword "bareword literal"
    =   s:$((![\r\n\t\v\f (),^+-] .)+) {
            return ast("bareword").set({ text: text(), value: s })
        }

quoted "single-quoted or double-quoted string literal"
    =   "\"" s:((stringEscapedChar / [^"])*) "\"" {
            return ast("dquoted").set({ text: text(), value: s.join("") })
        }
    /   "'" t:$(("\\'" / [^'])*) "'" {
            return ast("squoted").set({ text: text(), value: t.replace(/\\'/g, "'") })
        }

stringEscapedChar "escaped string character"
    =   "\\\\" { return "\\"   }
    /   "\\\"" { return "\""   }
    /   "\\b"  { return "\b"   }
    /   "\\v"  { return "\x0B" }
    /   "\\f"  { return "\f"   }
    /   "\\t"  { return "\t"   }
    /   "\\r"  { return "\r"   }
    /   "\\n"  { return "\n"   }
    /   "\\e"  { return "\x1B" }
    /   "\\x" n:$([0-9a-fA-F][0-9a-fA-F]) {
            return String.fromCharCode(parseInt(n, 16))
        }
    /   "\\u" n:$([0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) {
            return String.fromCharCode(parseInt(n, 16))
        }

ws "whitespaces"
    =   $([ \t\r\n]+) {
            return ast("ws").set({ text: text() })
        }

eof "end of file"
    =   !.

