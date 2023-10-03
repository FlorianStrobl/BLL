import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Interpreter } from './LCInterpreter';
import { Compiler } from './LCCompiler';
import { Formatter } from './LCFormatter';
import * as errs from './FErrorMsgs';
import * as test from './LCIdentifierCheck';

// @ts-ignore
import { inspect } from 'util';
const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

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

const filename = 'src';
const code = `
// **
let my_func = func (x) => - 2 - (x + 3);

// let fac = func (n, erg) => n(erg, fac (n-1, erg+n));
// let main = func (arg: i32) => fac(arg, 0);

let main = func (a) => (${3})(my_func(a+1), my_func(a-1));

// ((a.b).c().d);
//let g = func (x, y) => x / y;
`;
const argument: number = 5;

const lexedCode = Lexer.lexe(code);
if (!lexedCode.valid)
  throw new Error(
    'could not lexe the code! ' + lexedCode.lexerErrors?.toString()
  ); // TODO formatted error

const parsedCode = Parser.parse(code);
if (!parsedCode.valid)
  throw new Error(
    'could not parse the code! ' + parsedCode.parseErrors?.toString()
  ); // TODO formatted error

const formattedCode: string = Formatter.beautify(parsedCode.statements);
const interpreterResult: number = Interpreter.interpretAst(
  parsedCode.statements,
  argument
);
const asm: string = Compiler.compile(parsedCode.statements, code, filename);

console.log(`--------------------------------------------------------------------------
Beautified code:`);
console.log(formattedCode);
console.log(`--------------------------------------------------------------------------
AST:`);
log(parsedCode.statements);
console.log(`--------------------------------------------------------------------------
Compiled code (asm):`);
console.log(asm);
console.log(`--------------------------------------------------------------------------
Interpreted code with ${argument}:`);
console.log(interpreterResult);

// https://runjs.co/s/I1irVl3Rf
// https://www.typescriptlang.org/play?#code/PTAECkEMDdIZQMYCcCWAHALsAKgTzQKaKqagCOAriggNYDOGkSGoA5lQCYEBQIo2ACxR1Qw0JFAIA9gFsZBAHYYAdPwEFc4pAVGsFU7R1AAjTRnWg0SKaySQ5KBa1AAbSE4qRWBZbwBUgmJikC50UuKSsvJKfsDcvGAARDK4AGIUCggYKFIKiaIiEgBmGVk5CqAA7kIIAqCMNASFoHSOrC46ChQyxgRICeKFFUzs0SzuRtoYFEgKzV09fVXqFQQAHgQIFBgEHL4lmdm5oCnph+UAFGsAXKALvUgAlLf3SwDe3KCgfJUo5vUWRIdDD5Rq4SoGDgAGlAuR0CHcoC4RUcOgksFQkGMHV8X2BJ1wADUmCgsR0Xt0HqAALygACsAG5Pt8wBjSdimpJEb0TlIOCgUbsqn86uYdIlqfkpIQ7BgDLiCcTMRyaYqSWSdABqUAARiZXz4ySJ6o5+TE+kqoAudNA2p1j3ENAkADZfMyfkIOgD4bl+UcKkaleyvQBCWkADjNIgwSAoPANYDFkS4ogqScSb1AAF98tipLRhS4XCYdOtNttdgrqigvRcUkGNaAw6Bww6Pl8E97QIlNZqpTLIHKkKnkARIHROUm2Y3YC44yZNHCFV9e-WTR19dn4p3EYkBfkGIOCGNJOpaNGLNIFH7yu6wBNQGWtjsL+LMzmTC58zQYQKu1eb2OSpx3qWMfGZP862NZUvWpCM22ZTtEivMIcS-Vh8isRwMFfLRRkUHDEJZVMu2MOxaF2aNwiTFCpBxIjaLQmwLiIr4AHJ1FwNjvj8WomEgLIlhcP4+hCEQZAoBgSxaGZrAyLgjFMJEpAoFVKCkF9YiIx5NyzR9Qh0dsOz4P9033SJrz+coqhAooxIIGF0wIAzcy-AsxCfCs9m3DtGJ8dCLjsgydOZLMfL4REmDsTRglcYQWCkIpQFnOM6AVfFXiQABBJBoopRYkAAbQAXVVQqAAYYR1GEACYYQAZmKpk727IoDHyL9pRECEkBoOLGi7RJqw6DqpGla5mTa4cWI7VwCBYFBVXKnjHw2Z8hV6KadCTFEkCkkTZWs2JNy+RaAB5QAAFhWgCrNyGFvBw09NkaRSCC21by2yJwuwUdYFp2Q7jmOoje0W4A-DYeaRE8nYjEHLtFCMRLHwEuoDsHI64i+BDZp+EVBsK0Biv7UShxhOEuQqR6uxS+NjPvFgk1YFBoEUSwpFaf0YWqPodDQTm7oqZaxB2lA9pYZzjwI5c1RgnRaTXeXbTuSk+hy6LCpQJrQvCsAleDHRgiZoQRAF7DdUuhUphmCoDcbbU1iZMKBmKUp-Sp6SESLIVfn+RILlAR5El8fEbdmXZiTnAh8qpRW0ndy46RCvzlAC8O-o4KO4x0oA
