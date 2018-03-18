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

declare module "Sieving" {
    class Sieving {
        /*  create Sieving instance  */
        public constructor(
            options?: {
                wrap:      boolean,  /*  whether to internally wrap items  */
                fieldId:   string,   /*  name of identifier field in items  */
                fieldPrio: string,   /*  name of priority field in items  */
                fieldNs:   string    /*  name of namespace field in items  */
            }
        )

        /*  parse query into an internal AST  */
        parse(
            query: string            /*  query string  */
        ): void;

        /*  dump internal AST to console (for debugging purposes only)  */
        dump(
        ): void;

        /*  evaluate internal AST (for custom matching)  */
        evaluate(
            queryResults: (
                ns:        string,   /*  term namespace (empty string by default)  */
                type:      string,   /*  term type ("regexp", "glob", "quoted", or "bare")  */
                value:     string    /*  term value  */
            ) => any[]
        ): any[];

        /*  sieve items by evaluating query with standard matching  */
        sieve(
            items: any[],            /*  list of items to sieve/filter  */
            options?: {
                fuzzy:     boolean   /*  whether to fuzzy match quoted and bare terms  */
            }
        ): any[];

        /*  sieve items by evaluating query with standard matching (stand-alone)  */
        static sieve(
            items: any[],            /*  list of items to sieve/filter  */
            query: string,           /*  query string  */
            options?: {
                wrap:      boolean,  /*  whether to internally wrap items  */
                fieldId:   string,   /*  name of identifier field in items  */
                fieldPrio: string,   /*  name of priority field in items  */
                fieldNs:   string,   /*  name of namespace field in items  */
                fuzzy:     boolean   /*  whether to fuzzy match quoted and bare terms  */
            }
        ): any[];
    }
    export = Sieving
}

