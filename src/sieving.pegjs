/*!
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

{
    var unroll = options.util.makeUnroll(location, options)
    var ast    = options.util.makeAST   (location, options)
}

search
    =   q:queries eof {
            return q
        }

queries
    =   _ first:query rest:(_ "," _ query)* _ {
            return ast("queries").add(unroll(first, rest, 3))
        }

query
    =   first:term rest:(ws term)* {
            return ast("query").add(unroll(first, rest, 1))
        }

term
    =   op:operation? ns:namespace? term:(quoted / bareword / regexp / glob) boost:boost? {
            return ast("term").merge(op).merge(ns).merge(term).merge(boost)
        }

operation "operation option"
    =   "+" {
            return ast("operation").set({ op: "union" })
        }
    /   "-" {
            return ast("operation").set({ op: "subtraction" })
        }

namespace "namespace option"
    =   id:id ":" {
            return ast("namespace").set({ ns: id.get("value") })
        }

boost "boost option"
    =   "^" n:number? {
            return ast("boost").set({ boost: n ? n.get("value") : 1 })
        }

number "numeric literal"
    =   n:$([0-9]* "." [0-9]+) {
            return ast("number").set({ value: parseFloat(n) })
        }
    /   n:$([0-9]+) {
            return ast("number").set({ value: parseInt(n, 10) })
        }

id "identifier"
    =   s:$([a-zA-Z][a-zA-Z0-9-_]*) {
            return ast("id").set({ value: s })
        }

regexp "regular expression literal"
    =   "/" re:$(("\\/" / [^/])*) "/" {
            var v
            try { v = new RegExp(re.replace(/\\\//g, "/")) }
            catch (e) { error(e.message) }
            return ast("regex", true).set({ value: v, type: "regexp" })
        }

glob "glob"
    =   s:$(
            (![*?\[\]{}\r\n\t\v\f ,~^+-] .)*
            ("*" / "?" / "[" / "]" / "{" / "}")
            (![\r\n\t\v\f ,~^+-] .)*
        ) {
            return ast("string").set({ value: s, type: "glob" })
        }

bareword "bareword"
    =   s:$((![\r\n\t\v\f ,~^+-] .)+) {
            return ast("string").set({ value: s, type: "bare" })
        }

quoted "single-quoted or double-quoted string literal"
    =   "\"" s:((stringEscapedChar / [^"])*) "\"" {
            return ast("string").set({ value: s.join(""), type: "quoted" })
        }
    /   "'" t:$(("\\'" / [^'])*) "'" {
            return ast("string").set({ value: t.replace(/\\'/g, "'"), type: "quoted" })
        }

stringEscapedChar "escaped string character"
    =   "\\\\" { return "\\"   }
    /   "\\\"" { return "\""   }
    /   "'"    { return "'"    }
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

_ "optional whitespace"
    =   ws*

ws "whitespaces"
    =   [ \t\r\n]+

eof "end of file"
    =   !.

