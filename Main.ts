import { Interpreter } from './LCInterpreter';
import { Compiler } from './LCCompiler';
import { Parser } from './LCParser';
import { Formatter } from './LCFormatter';
import * as errs from './LCCodeAnnotation';
import * as fs from 'fs';

// @ts-ignore
import { inspect } from 'util';
const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

// const ans = fs.readFileSync('./std.bll').toString();

/**
 * let a = 5; // no error
 * let a = 4; // error double (let)
 * group a { } // error double (let)
 * type a = i32; // no error
 *
 * group b { // no error
 *  let a = 3; // error double (let)
 *  let b = 4; // no error
 *  group b { // error double (let)
 *   let c = 4; // error double (let below)
 *  }
 *  let c = 3; // no error
 * }
 *
 * group d { // no error
 *  group e { // no error
 *   let g = 1; // no error
 *  }
 *  group f { // no error
 *   let g = 1; // no error
 *  }
 * }
 */

// #region preprocessing
const filename = 'src';
const code = `
type complex[T] {
  none,
  some(T)
}

let get = func (x: complex[i32]) =>
  match (x) {
    none => 0,
    some(value) => value
  };

let main = func (a) => a + (
  (- (2 - 3 - 4) == - -5)                  &
  (2.0 ** 3.0 ** 4.0  == 2.4178516392292583e+24) &
  (2 * 3 * 4 == 24)                        &
  ((2 + 3 * 4 == 2 + (3 * 4))              &
  ((2 + 3) * 4 != 2 + 3 * 4))              &
  (0.1 + 0.2 == 0.30000000000000004))
  ;`;
const argument: number = 5;
const code2 = `
// **

type binaryTree[T] {
  Empty,
  Tree(binaryTree, T, binaryTree)
}
//let main = func (arg: i32): i32 => 6(7, 8);

//let fn = func () => 3
//let test = func (x, y = fn()) => x % y;

// let my_func = func (x) => - 2 - (x + 3);
// with a=5 its -9
// let main = func (a) => (3)(my_func(a+1), my_func(a-1));

// a & ((a + 3a) % 7); with a=5 its 4
// let main = func (argument: i32): i32 => argument & ((argument + 3 * argument) % 7);


// let fac = func (n, erg) => n(erg, fac (n-1, erg+n));
// let main = func (arg: i32) => fac(arg, 0);

// let f[T]: (T, T -> T) -> T
//   = func (
//      v: T,
//      fn: T -> T = func (x: T): T => x
//     ): T => fn(v);

//let add = func (a, b) => a + b;

// let my_function = func (x, y) => x % y;
//let main = func (arg) => add(arg, 2);

// let factorial = func (n: i32): i32 => n( /*n==0*/ 1, /*n!=0*/ n * factorial(n-1) );

// with any arg: 22
//let main = func (arg: f64): f64 => f1();
// with arg2=5: 3
let f1 = func (arg2: f64 = 22.5): f64 => f(arg2);

// with arg=5: 16
// let main = func (arg: i32): i32 => f2(arg+2);
// with arg2=7: 16
// let f2 = func (arg2: i32): i32 => f(arg2+1, func (x) => 1 + x + arg2);

// ((a.b).c().d);
//let g = func (x, y) => x / y;
`;

const parsedCode = Parser.parse(code);
if (!parsedCode.valid)
  throw new Error(
    'could not parse the code! ' + parsedCode.parseErrors?.toString()
  ); // TODO formatted error

const formattedCode: string = Formatter.beautify(code);
const interpreterResult: number = Interpreter.interpret(
  { main: code },
  'main',
  argument
);
const asm: string = Compiler.compile(parsedCode.statements, code, filename);
// #endregion

const output: string = `${
  true
    ? `--------------------------------------------------------------------------
Beautified code:\n${formattedCode}\n`
    : ''
}${
  false
    ? `--------------------------------------------------------------------------
AST:\n${JSON.stringify(parsedCode.statements)}\n`
    : ''
}${
  false
    ? `--------------------------------------------------------------------------
Compiled code (asm):\n${asm}\n`
    : ''
}${
  true
    ? `--------------------------------------------------------------------------
Interpreted code with ${argument}:\n${interpreterResult}`
    : ''
}`;

console.log(output);

/**
 * TODO:
 * LCVisualization.ts
 * LCtoASM.ts
 * LCOptimization.ts
 * LCLinter.ts:
 *  - rename a function/symbol in the entire code base
 *  - errors and warnings/hints?
 *  - code snippets
 *  - code lens?
 * LCLinker.ts:
 *  - ASM in form of .o to an executable (asm has e.g. lables for "main:" which need to be resolved for jmps...)
 * LCIntelliSense:
 *  -  auto-completion, code navigation (goto definition), syntax checking, ...
 *  - https://code.visualstudio.com/api/language-extensions/programmatic-language-features
 *  - https://code.visualstudio.com/api/language-extensions/language-server-extension-guide
 * LCDebugger.ts:
 * - step by step debugger with call-stack, break points, data inspection, ...
 */

// https://runjs.co/s/I1irVl3Rf
// https://www.typescriptlang.org/play?#code/PTAECkEMDdIZQMYCcCWAHALsAKgTzQKaKqagCOAriggNYDOGkSGoA5lQCYEBQIo2ACxR1Qw0JFAIA9gFsZBAHYYAdPwEFc4pAVGsFU7R1AAjTRnWg0SKaySQ5KBa1AAbSE4qRWBZbwBUgmJikC50UuKSsvJKfsDcvGAARDK4AGIUCggYKFIKiaIiEgBmGVk5CqAA7kIIAqCMNASFoHSOrC46ChQyxgRICeKFFUzs0SzuRtoYFEgKzV09fVXqFQQAHgQIFBgEHL4lmdm5oCnph+UAFGsAXKALvUgAlLf3SwDe3KCgfJUo5vUWRIdDD5Rq4SoGDgAGlAuR0CHcoC4RUcOgksFQkGMHV8X2BJ1wADUmCgsR0Xt0HqAALygACsAG5Pt8wBjSdimpJEb0TlIOCgUbsqn86uYdIlqfkpIQ7BgDLiCcTMRyaYqSWSdABqUAARiZXz4ySJ6o5+TE+kqoAudNA2p1j3ENAkADZfMyfkIOgD4bl+UcKkaleyvQBCWkADjNIgwSAoPANYDFkS4ogqScSb1AAF98tipLRhS4XCYdOtNttdgrqigvRcUkGNaAw6Bww6Pl8E97QIlNZqpTLIHKkKnkARIHROUm2Y3YC44yZNHCFV9e-WTR19dn4p3EYkBfkGIOCGNJOpaNGLNIFH7yu6wBNQGWtjsL+LMzmTC58zQYQKu1eb2OSpx3qWMfGZP862NZUvWpCM22ZTtEivMIcS-Vh8isRwMFfLRRkUHDEJZVMu2MOxaF2aNwiTFCpBxIjaLQmwLiIr4AHJ1FwNjvj8WomEgLIlhcP4+hCEQZAoBgSxaGZrAyLgjFMJEpAoFVKCkF9YiIx5NyzR9Qh0dsOz4P9033SJrz+coqhAooxIIGF0wIAzcy-AsxCfCs9m3DtGJ8dCLjsgydOZLMfL4REmDsTRglcYQWCkIpQFnOM6AVfFXiQABBJBoopRYkAAbQAXVVQqAAYYR1GEACYYQAZmKpk727IoDHyL9pRECEkBoOLGi7RJqw6DqpGla5mTa4cWI7VwCBYFBVXKnjHw2Z8hV6KadCTFEkCkkTZWs2JNy+RaAB5QAAFhWgCrNyGFvBw09NkaRSCC21by2yJwuwUdYFp2Q7jmOoje0W4A-DYeaRE8nYjEHLtFCMRLHwEuoDsHI64i+BDZp+EVBsK0Biv7UShxhOEuQqR6uxS+NjPvFgk1YFBoEUSwpFaf0YWqPodDQTm7oqZaxB2lA9pYZzjwI5c1RgnRaTXeXbTuSk+hy6LCpQJrQvCsAleDHRgiZoQRAF7DdUuhUphmCoDcbbU1iZMKBmKUp-Sp6SESLIVfn+RILlAR5El8fEbdmXZiTnAh8qpRW0ndy46RCvzlAC8O-o4KO4x0oA
