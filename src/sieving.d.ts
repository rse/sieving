/*!
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

declare module "Sieving" {
    class Sieving {
        /*  create Sieving instance  */
        public constructor(
            options?: {
                wrap:      boolean,  /*  whether to internally wrap items (default: true)  */
                nsIds:     string[], /*  list of allowed namespace identifier and namespace symbols (default: [])  */
                fieldId:   string,   /*  name of identifier field in items (default: "id")  */
                fieldPrio: string,   /*  name of priority field in items (default: "prio" ) */
                fieldNs:   string    /*  name of namespace field in items (default: "")  */
            }
        )

        /*  parse query into an internal AST  */
        parse(
            query:         string    /*  query string  */
        ): void

        /*  dump internal AST as text (for debugging purposes only)  */
        dump(
            colorize?:     boolean   /*  whether to colorize output (default: true)  */
        ): string

        /*  format internal AST into query string  */
        format(
        ): string

        /*  evaluate internal AST (for custom matching)  */
        evaluate(
            queryResults: (
                ns:        string,   /*  term namespace (default: "")  */
                type:      string,   /*  term type ("regexp", "glob", "quoted", or "bare")  */
                value:     string    /*  term value  */
            ) => any[]
        ): any[]

        /*  sieve items by evaluating query with standard matching  */
        sieve(
            items: any[],            /*  list of items to sieve/filter  */
            options?: {
                fuzzy:     boolean   /*  whether to fuzzy match quoted and bare terms (default: false)  */
                maxLS:     number,   /*  maximum Levenshtein distance for fuzzy matching (default: 2)  */
                minDC:     number    /*  minimum Dice-Coefficient for fuzzy matching (default: 0.50)  */
            }
        ): any[]

        /*  sieve items by evaluating query with standard matching (stand-alone)  */
        static sieve(
            items: any[],            /*  list of items to sieve/filter  */
            query: string,           /*  query string  */
            options?: {
                wrap:      boolean,  /*  whether to internally wrap items (default: true)  */
                nsIds:     string[], /*  list of allowed namespace identifier and namespace symbols (default: [])  */
                fieldId:   string,   /*  name of identifier field in items (default: "id")  */
                fieldPrio: string,   /*  name of priority field in items (default: "prio" ) */
                fieldNs:   string,   /*  name of namespace field in items (default: "")  */
                fuzzy:     boolean,  /*  whether to fuzzy match quoted and bare terms (default: false)  */
                maxLS:     number,   /*  maximum Levenshtein distance for fuzzy matching (default: 2)  */
                minDC:     number    /*  minimum Dice-Coefficient for fuzzy matching (default: 0.50)  */
                debug:     boolean   /*  whether to dump the internal AST to stdout  */
            }
        ): any[]
    }
    export = Sieving
}

