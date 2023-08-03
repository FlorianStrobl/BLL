import { printMessage, ErrorID } from './FErrorMsgs';

// check gcc, clang, ghci, chromium v8, firefox, java, .NET w/ C#

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar
// https://stackoverflow.com/questions/14954721/what-is-the-difference-between-a-token-and-a-lexeme BLL

// TODO, not peek() and consumeChar() = bad because not standard?

// #region constants
const testCodes: string[] = [
  `
let num: i32 /* signed */ = + 5.5e-1; // an integer
/**/`,
  `
// import std;
// import my_libs/./wrong_lib/../math_lib/./my_math_lib.bll;

let num1 = 5;
let num2 = 0x5;
let num3 = 0b1;
let num4 = 0o7;

/* You can /* nest comments *\\/ by escaping slashes */

// example code
let a: i32 = IO.in[i32](0); // gets an i32 from the console
let b: i32 = Math.sq(a); // a ** 2, TODO compiler/interpreter must deduce that Math.sq[i32] is called and not Math.sq[f32]
let c: i32 = IO.out(b); // prints b and assigneds b to c

let d = func (x: i32) -> 5_4.1e-3;
// 5, 5.1e2,  5., 5e, 5e., 5.e, 5.1e, 5e1., 5e1.2
`
];

const mustLexe: string[] = [
  `;
/**//**/
/**/5
/**/let
/**/test
/**/+

5/**/
// 5"hey"
// 5let
// 5test
5+

let/**/
// let"hey", lexer error!
letlet // identifier
lettest // identifier
let+

test/**/
// test"hey", lexer error!
testlet // identifier
testtest
test+

+/**/
+5
+let
+test
+* // two operators

5 5.1e2 // TODO: 51.e-3
01_23_45_67_89
0123456789 0b1010 0x0123456789ABCDEFabcdef 0o01234567

/* You can /* nest comments *e/ by escaping slashes */

- > * -> * - >* ->*

_

~ & | ^ + - * / % = ( ) [ ] { } < > : ; . , !

! * ** *** + - % / < > = == != <= >= << >> ~ & | ^ : ; . , -> () [] {} //

********

~~5

"string"

;`,
  '',
  ' ',
  ' \t\n\r'
];

const mustNotLexe: string[] = [
  `
\\ \` ' "" ? @ # $

😀 ඒ ქ ℂ ∑ ぜ ᾙ ⅶ 潼

5. 5e1. 5e1.2 5.1e 5.e 5e. 5e
0__3
0b 0x 0o 0b12A3 0xP 0o99A 09A4

5let
5test

/regexp/

*/

/*`,
  '/*',
  '/* ',
  '/**',
  '/** ',
  '/*/'
];

const keywords: string[] = [
  'import', // imports all public identifiers from other files

  'let', // binds a lambda term to an identifier
  'type', // binds a type to an identifier
  'namespace', // identifier as wrapper around identifiers
  'pub', // make an identifier public to the outside (files or namespaces)

  'func', // introduces a function

  // f32 literals:
  'nan',
  'infinity',

  // types:
  'i32', // 32 bit integer
  'f32', //single precision 32 bit float after the IEEE754-2008 standard
  'undetermined' // cannot be determined at compile time but must be done at compile time
].sort();

const symbols: string[] = [
  // only for same primitive types
  '+', // add
  '-', // sub
  '*', // multiplication
  '/', // divide (for integers: rounding down)
  '**', // exponentiation
  '***', // root
  '%', // remainder

  // only ints
  '&', // and
  '|', // or
  '^', // xor
  '~', // not
  '!', // logical not TODO (0 -> 1, any -> 0)
  '<<', // left shift
  '>>', // right shift

  // compare only same primitive types
  '==', // equal
  '!=', // not equal
  '<=', // less than or equal
  '>=', // greater than or equal
  '<', // less than
  '>', // greater than

  '=', // assigments of values to identifiers (let and type)
  '->', // functions
  ':', // type annotation
  ';', // end of let or type statement/empty statement
  ',', // seperator for arguments
  '.', // accessing public functions from namespaces

  '(', // grouping, function calls, function arguments/parameters
  ')',
  '{', // namespaces
  '}',
  '[', // generic type annotations
  ']'
]
  .sort(/*sort for length*/ (a, b) => b.length - a.length)
  .filter(/*remove doubles*/ (e, i, a) => !a.slice(0, i).includes(e));
// #endregion

export namespace Lexer {
  // #region types
  export interface token {
    lexeme: string;
    type: lexemeType;
    idx: number;
  }

  export enum lexemeType {
    comment = '#comment', // "//...", "/*...*/"
    literal = '#literal', // "5.3e-4", "0xFF00FF"
    keyword = '#keyword', // "let", "func"
    identifier = '#identifier', // "_a_z_A_Z_0_9"
    symbol = '#symbol' // "+", "-", "*", "/", "==", "!=", "<", ">", "<=", ">=", ",", "(", ")", "{", "}", "=", "->", "."
  }

  // TODO
  type errorToken =
    | { codeInvalid: false; type: 'eof' /*reached end of file*/ }
    | {
        codeInvalid: true;
        type: 'missing space' /* "5let" is not allowed aka: literal followed by an identifier/keyword/literal or keyword followed by operator?? or identifier followed by literal */;
      }
    | { codeInvalid: true; type: 'invalid char'; chars: string }
    | { codeInvalid: true; type: 'eof in /* comment' }
    | { codeInvalid: true; type: 'string used'; chars: string }
    | { codeInvalid: true; type: 'eof in string'; chars: string }
    | {
        codeInvalid: true;
        type: 'used escape symbol not properly in string';
        chars: string;
        idxs: number[];
      };

  type nextToken =
    | {
        valid: true;
        value: token;
        newidx: number;
      }
    | {
        valid: false;
        value: errorToken;
        newidx: number;
      };
  // #endregion

  function matches(character: string, regexp: RegExp): boolean {
    return typeof character === 'string' && character[0].match(regexp) !== null;
  }

  function idxValid(idx: number, obj: { length: number }) {
    return idx < obj.length;
  }

  // #region consume functions
  // assert: a comment is at idx
  function consumeComment(code: string, idx: number): nextToken {
    let i: number = idx + 1; /*assertion: index is valid*/
    let comment: string = code[idx];

    if (code[i] === '/') {
      // comment type 1: "//"
      while (idxValid(i, code) && code[i] !== '\n') {
        comment += code[i++];
      }
    } else if (code[i] === '*') {
      // comment type 2: "/*"
      comment += code[i++]; // "*"

      // TODO
      console.log('here', code, i);

      while (
        idxValid(i, code) &&
        idxValid(i + 1, code) &&
        !(code[i] === '*' && code[i + 1] === '/')
      ) {
        console.log('exec', code, i);
        comment += code[i++];
      }

      console.log('after exec');

      // TODO, wrong since it could be the very last two characters
      if (!idxValid(i, code) || !idxValid(i + 1, code)) {
        return {
          valid: false,
          value: { codeInvalid: true, type: 'eof in /* comment' },
          newidx: i
        };
      }

      // idx valid
      if (code[i] !== '*' || code[i + 1] !== '/') {
        return {
          valid: false,
          value: { codeInvalid: true, type: 'eof in /* comment' },
          newidx: i
        };
      }

      comment += code[i++] + code[i++];
    }
    // else not a comment, handled before calling this function

    return {
      valid: true,
      value: { lexeme: comment, type: lexemeType.comment, idx },
      newidx: i
    };
  }

  // assert: a numeric literal is at idx
  function consumeNumericLiteral(code: string, idx: number): nextToken {
    function consumeDigits() {
      // TODO, check if i is not outside of code
      let lastCharWasDigit = false;
      while (idxValid(i, code) && matches(code[i], /[0-9]|_/g)) {
        if (matches(code[i], /[0-9]/g)) {
          // digit
          lastCharWasDigit = true;
          literal += code[i++];
        } else if (lastCharWasDigit && matches(code[i + 1], /[0-9]/g)) {
          // _
          lastCharWasDigit = false;
          literal += code[i++]; // must be "_"
        } else {
          // _ but followed by something different than a digit

          // TODO no throw!!
          throw Error(
            // TODO, error: `_` must be inbetween digits
            'Error in `consumeDigits` from `consumeNumericLiteral` in `Lexer`: a `_` in a numeric literal, must be preceded and followed by a digit'
          );
        }
      }
    }

    function consumeE() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // "e" or "E"

      // now optional "+" OR "-"
      if (code[i] === '+' || code[i] === '-') {
        literal += code[i++];
      }

      const literalBefore = literal;
      consumeDigits();
      const runned: boolean = literalBefore !== literal;

      if (!runned) {
        // TODO
        throw Error(
          'Error in `consumeNumericLiteral`: unexpected end of numeric literal after `e`'
        );
      }
    }

    function consumeHex() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // 0
      literal += code[i++]; // x
      while (matches(code[i], /[0-9a-fA-F]/g)) {
        literal += code[i++];
      }
      // TODO, what if matches different numeric literal now, ERROR
    }

    function consumeBinary() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // 0
      literal += code[i++]; // b
      while (idxValid(i, code) && matches(code[i], /[01]/g)) {
        literal += code[i++];
      }
      // TODO, what if matches different numeric literal now, ERROR
    }

    function consumeOctal() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // 0
      literal += code[i++]; // o
      while (matches(code[i], /[0-7]/g)) {
        literal += code[i++];
      }
      // TODO, what if matches different numeric literal now, ERROR
    }

    let i: number = idx;
    let literal: string = '';

    const specialLiteral = /[xbo]/;
    if (
      code[idx] === '0' &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], specialLiteral)
    ) {
      switch (code[idx + 1]) {
        case 'x':
          consumeHex();
          break;
        case 'b':
          consumeBinary();
          break;
        case 'o':
          consumeOctal();
          break;
      }
      // TODO error messages and followed by str literal
      return {
        valid: true,
        value: { lexeme: literal, type: lexemeType.literal, idx },
        newidx: i
      };
    }

    // first digits
    consumeDigits();

    if (idxValid(i, code) && code[i] === '.') {
      // is fraction
      literal += code[i++]; // "."

      const literalBefore = literal;
      consumeDigits();
      const runned: boolean = literalBefore !== literal;

      if (!runned) {
        // TODO
        throw Error(
          'Error in `consumeNumericLiteral`: unexpected end of numeric literal after `.`'
        );
      }
    }

    // `consumeE` could throw an error
    if (idxValid(i, code) && code[i].toLowerCase() === 'e') {
      consumeE();
    }

    // TODO invalid if followed by an alpha numeric character

    return {
      valid: true,
      value: { lexeme: literal, type: lexemeType.literal, idx },
      newidx: i
    };
  }

  // assert: an identifier is at idx
  function consumeIdentifier(code: string, idx: number): nextToken {
    let i: number = idx;
    let identifier: string = '';

    const alphaNumeric = /[_a-zA-Z0-9]/;
    while (idxValid(i, code) && matches(code[i], alphaNumeric)) {
      identifier += code[i++];
    }

    // TODO check if it is followed by something else than just whitespace, because that would be invalid (if its a string at least, for keyword and for identifier)

    return {
      valid: true,
      value: {
        lexeme: identifier,
        type: keywords.includes(identifier)
          ? lexemeType.keyword
          : lexemeType.identifier,
        idx
      },
      newidx: i
    };
  }

  // assert: an operator is at idx
  function consumeSymbol(code: string, idx: number): nextToken {
    let i: number = idx;
    let symbol: string = code[i++];

    while (
      idxValid(i, code) &&
      symbols.some((symbol) => symbol.startsWith(symbol + code[i]))
    ) {
      symbol += code[i++];
    }

    // consider "->*" valid and "->" not
    while (!symbols.includes(symbol)) {
      if (symbol === '') {
        // consider "-", ">" and "->" invalid
        // but "->*" valid, and got "->"

        // TODO return the error
        printMessage('error', {
          id: ErrorID.invalidCharacter,
          code: code,
          idx: idx,
          endIdx: idx,
          file: 'TODO'
        } as any);
        i++; // skip the next character
        break;
      }

      // consider "-", ">" and "->*" valid
      // but got "->"
      symbol = symbol.slice(0, symbol.length - 1);
      i--;
    }

    return {
      valid: true,
      value: { lexeme: symbol, type: lexemeType.symbol, idx },
      newidx: i
    };
  }

  // assert: a string is at idx
  function consumeString(code: string, idx: number): nextToken {
    let i: number = idx;
    let string: string = code[i++];

    const stringEnd = /"/;
    const escapeSymbol = /\\/;
    const escapedSymbols = /["\\nrtu]/;
    let escaped: boolean = false;
    let escapeErrorIdxs: number[] = [];
    while (idxValid(i, code) && !(matches(code[i], stringEnd) && !escaped)) {
      if (escaped) {
        escaped = false;
        if (matches(code[i], escapedSymbols)) {
          string += code[i++];
          // TODO if char was "u", it has to be followed by 4 digits
        } else {
          escapeErrorIdxs.push(i);
          string += code[i++];
        }
      } else if (matches(code[i], escapeSymbol)) {
        escaped = true;
        string += code[i++];
      } else {
        string += code[i++];
      }
    }

    if (idxValid(i, code) && matches(code[i], stringEnd)) {
      string += code[i++];
    } else {
      return {
        valid: false,
        value: { codeInvalid: true, type: 'eof in string', chars: string },
        newidx: i
      };
    }

    if (escapeErrorIdxs.length !== 0) {
      return {
        valid: false,
        value: {
          codeInvalid: true,
          type: 'used escape symbol not properly in string',
          chars: string,
          idxs: escapeErrorIdxs
        },
        newidx: i
      };
    }

    return {
      valid: false,
      value: { codeInvalid: true, type: 'string used', chars: string },
      newidx: i
    };
  }
  // #endregion

  function lexeNextToken(code: string, idx: number): nextToken {
    const whitespaces = /[ \t\n\r]/;
    while (idxValid(idx, code) && matches(code[idx], whitespaces)) {
      ++idx;
    }

    if (!idxValid(idx, code)) {
      return {
        valid: false,
        value: { type: 'eof', codeInvalid: false },
        newidx: idx
      };
    }

    const commentStart = /[/]/;
    if (matches(code[idx], commentStart)) {
      const commentStart2 = /[/*]/;
      if (idxValid(idx + 1, code) && matches(code[idx + 1], commentStart2)) {
        return consumeComment(code, idx);
      }
    }

    const identifierStart = /[_a-zA-Z]/;
    if (matches(code[idx], identifierStart)) {
      return consumeIdentifier(code, idx);
    }

    const numberStart = /[0-9]/;
    if (matches(code[idx], numberStart)) {
      return consumeNumericLiteral(code, idx);
    }

    const firstCharSymbols = symbols.map((e) => e[0]);
    if (firstCharSymbols.includes(code[idx])) {
      return consumeSymbol(code, idx);
    }

    // TODO add string support for better errors, that means also \u{xxxx}
    // and \", \\, \n, \r, \t
    const stringStart = /"/;
    if (matches(code[idx], stringStart)) {
      return consumeString(code, idx);
    }

    let invalidChars: string = '';
    const validChars = /[ \t\n\r0-9a-zA-Z_\-+*/%&|^~!<>=:;,.(){}[\]]/;
    while (idxValid(idx, code) && !matches(code[idx], validChars)) {
      invalidChars += code[idx++];
    }

    return {
      valid: false,
      newidx: idx,
      value: { type: 'invalid char', chars: invalidChars, codeInvalid: true }
    };
  }

  export function* lexeNextTokenIter(
    code: string,
    filename: string
  ): Generator<nextToken, undefined> {
    let val: nextToken = lexeNextToken(code, 0);

    // TODO
    while (val.value.type !== 'eof') {
      if (!val.valid) {
        // TODO add full error message
        printMessage('error', {
          id: ErrorID.invalidCharacter,

          code: code, // the code
          file: filename, // name of the file where the error occured
          idx: val.newidx, // start position in string with the error
          endIdx: val.newidx, // end position in string with the error

          msg: '', // the error message to print

          compilerStep: 'lexer' // the part in the compiler where it caused the error
        });
      }

      yield val;
      val = lexeNextToken(code, val.newidx);
    }

    return undefined;
  }

  export function lexe(code: string, filename: string): token[] | errorToken[] {
    const lexemes: token[] = [];
    const errors: errorToken[] = [];

    for (const token of Lexer.lexeNextTokenIter(code, filename)) {
      if (token.valid) lexemes.push(token.value);
      else errors.push(token.value);
    }

    if (errors.length === 0) return lexemes;
    else return errors;
  }
}

console.log(Lexer.lexe("5/**/identifier;\"stringtest\"3//", 'file'));

// https://runjs.co/s/I1irVl3Rf
// https://www.typescriptlang.org/play?#code/PTAECkEMDdIZQMYCcCWAHALsAKgTzQKaKqagCOAriggNYDOGkSGoA5lQCYEBQIo2ACxR1Qw0JFAIA9gFsZBAHYYAdPwEFc4pAVGsFU7R1AAjTRnWg0SKaySQ5KBa1AAbSE4qRWBZbwBUgmJikC50UuKSsvJKfsDcvGAARDK4AGIUCggYKFIKiaIiEgBmGVk5CqAA7kIIAqCMNASFoHSOrC46ChQyxgRICeKFFUzs0SzuRtoYFEgKzV09fVXqFQQAHgQIFBgEHL4lmdm5oCnph+UAFGsAXKALvUgAlLf3SwDe3KCgfJUo5vUWRIdDD5Rq4SoGDgAGlAuR0CHcoC4RUcOgksFQkGMHV8X2BJ1wADUmCgsR0Xt0HqAALygACsAG5Pt8wBjSdimpJEb0TlIOCgUbsqn86uYdIlqfkpIQ7BgDLiCcTMRyaYqSWSdABqUAARiZXz4ySJ6o5+TE+kqoAudNA2p1j3ENAkADZfMyfkIOgD4bl+UcKkaleyvQBCWkADjNIgwSAoPANYDFkS4ogqScSb1AAF98tipLRhS4XCYdOtNttdgrqigvRcUkGNaAw6Bww6Pl8E97QIlNZqpTLIHKkKnkARIHROUm2Y3YC44yZNHCFV9e-WTR19dn4p3EYkBfkGIOCGNJOpaNGLNIFH7yu6wBNQGWtjsL+LMzmTC58zQYQKu1eb2OSpx3qWMfGZP862NZUvWpCM22ZTtEivMIcS-Vh8isRwMFfLRRkUHDEJZVMu2MOxaF2aNwiTFCpBxIjaLQmwLiIr4AHJ1FwNjvj8WomEgLIlhcP4+hCEQZAoBgSxaGZrAyLgjFMJEpAoFVKCkF9YiIx5NyzR9Qh0dsOz4P9033SJrz+coqhAooxIIGF0wIAzcy-AsxCfCs9m3DtGJ8dCLjsgydOZLMfL4REmDsTRglcYQWCkIpQFnOM6AVfFXiQABBJBoopRYkAAbQAXVVQqAAYYR1GEACYYQAZmKpk727IoDHyL9pRECEkBoOLGi7RJqw6DqpGla5mTa4cWI7VwCBYFBVXKnjHw2Z8hV6KadCTFEkCkkTZWs2JNy+RaAB5QAAFhWgCrNyGFvBw09NkaRSCC21by2yJwuwUdYFp2Q7jmOoje0W4A-DYeaRE8nYjEHLtFCMRLHwEuoDsHI64i+BDZp+EVBsK0Biv7UShxhOEuQqR6uxS+NjPvFgk1YFBoEUSwpFaf0YWqPodDQTm7oqZaxB2lA9pYZzjwI5c1RgnRaTXeXbTuSk+hy6LCpQJrQvCsAleDHRgiZoQRAF7DdUuhUphmCoDcbbU1iZMKBmKUp-Sp6SESLIVfn+RILlAR5El8fEbdmXZiTnAh8qpRW0ndy46RCvzlAC8O-o4KO4x0oA
