// TODO: consumeNumericLiteral fix

// compiler/interpreter frontend: scanner
export namespace Lexer {
  // #region valid lexemes signatures
  const keywords: string[] = [
    // statements:
    'use', // imports all identifiers from other file (either local file, or global file)
    'group', // identifier as wrapper around identifiers
    'let', // binds a lambda term to an identifier (can be generic)
    'type', // binds a type (alias or complex) to an identifier (can be generic)

    // expressions:
    'func', // function expression
    'match', // expression to unwrap values of complex-types

    // types:
    'i32', // signed 32 bit integer in two's complement
    'f32' // single precision 32 bit float from the IEEE754-2008 standard
  ];

  const symbols: string[] = [
    // only for same primitive types
    '+', // add (binary, unary, i32/f32)
    '-', // sub (binary, unary, i32/f32)
    '*', // multiplication (binary, i32/f32)
    '/', // divide (binary, f32/for i32: rounding down, TODO what about div by 0 on i32: make it undefined behaviour)
    '**', // exponentiation (binary, i32/f32)
    //'***', // root or log (binary, i32/f32)
    '!', // logical not (unary, 0 -> 1, any -> 0, i32/f32)

    // only ints
    '%', // remainder (binary, i32)
    '~', // not (unary, i32)
    '&', // and (binary, i32)
    '|', // or (binary, i32)
    '^', // xor (binary, i32)
    '<<', // logical left shift (binary, i32)
    '>>', // logical right shift (binary, i32)

    // compare
    '==', // equal (binary, i32/f32)
    '!=', // not equal (binary, i32/f32)
    '<=', // less than or equal (binary, i32/f32)
    '>=', // greater than or equal (binary, i32/f32)
    '<', // less than (binary, i32/f32)
    '>', // greater than (binary, i32/f32)

    // misc
    '=', // assigments of values to identifiers in let and type statements
    '->', // used for func signatures
    '=>', // used in func definitions and match expressions
    ':', // type annotation for let, func and match
    ';', // end of use, let or type-alias statement/empty statement
    ',', // seperator for arguments in funcs or calling funcs (with trailing commas too)
    '.', // accessing identifiers from groups

    '(', // grouping, func arguments/parameters/calls, complex type line
    ')',
    '{', // groups or complex type statements, or match expressions
    '}',
    '[', // generic type annotations for lets and types
    ']'
  ];

  const decimalDigits: string[] = new Array(10)
    .fill('')
    .map((_, i) => i.toString());
  const octalDigits: string[] = new Array(8)
    .fill('')
    .map((_, i) => i.toString());
  const binaryDigits: string[] = ['0', '1'];
  const hexDigits: string[] = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F'
  ];

  const nonDecimalLiteralStart: string = '0';
  const nonDecimalLiteralTypes: string[] = ['x', 'b', 'o'];

  const commentStart: string = '/';
  const commentType1Start: '/' = '/';
  const commentType2Start: '*' = '*';
  const commentTypes: string[] = [commentType1Start, commentType2Start];

  const commentType1Stop: string = '\n';
  const commentType2Stop1: string = '*';
  const commentType2Stop2: string = '/';

  const possibleStringStarts: string[] = ["'", '"', '`'];
  const stringEscapeSymbol: string = '\\'; // only valid inside strings
  const escapableStringChars: string[] = ['\\', 'n', 't', 'r', 'u'];

  const validChars: string[] = [
    ' ',
    '\t',
    '\n',
    '\r',
    '_',
    ...new Array(26).fill('').map((_, i) => String.fromCharCode(65 + i)),
    ...new Array(26).fill('').map((_, i) => String.fromCharCode(97 + i)),
    ...new Array(10).fill('').map((_, i) => i.toString()),
    ...'+-*/%&|^~=!><;:,.(){}[]'.split(''),
    ...possibleStringStarts // because of error messages
  ];

  const firstCharOfSymbols: string[] = symbols
    .map((str) => str[0])
    .filter((e, i, t) => t.indexOf(e) === i);
  // #endregion

  // #region types, interfaces and enums
  export interface token {
    // raw character sequence in the src code, matching a token pattern
    lex: string;
    ty: tokenType;
    // index of the lexeme in the src code
    idx: number;
  }

  export enum tokenType {
    comment = 'c', // "//...", "/*...*/"
    literal = 'l', // "5.3e-4", "0xFF00FF", "nan", "inf"
    keyword = 'k', // "let", "func"
    identifier = 'i', // "_a_z_A_Z_0_9"
    symbol = 's' // "+", "-", "*", "/", "==", "!=", "<", ">", "<=", ">=", ",", "(", ")", "{", "}", "=", "->", "."
  }

  export type nextToken =
    | {
        type: 'token';
        value: token;
      }
    | {
        type: 'error';
        value: lexerError;
      };

  // TODO, number errors merged into one big message
  export type lexerError = { lex: string; idx: number } & (
    | {
        type: 'invalid chars in comment';
        idxs: number[];
      }
    | { type: 'invalid chars' }
    | {
        type: 'eof in /* comment';
      }
    | { type: 'string used' }
    | { type: 'eof in string' }
    | {
        type: 'used escape symbol not properly in string';
        idxs: number[];
      }
    | {
        type: 'used escape symbol with \\u not properly in string';
        idxs: number[];
      }
    | {
        type: 'invalid operator';
      }
    | {
        type: 'did not consume digits in numeric literal';
        idxs: number[];
      }
    | {
        type: 'identifier connected to numeric literal';
        invalidIdentifierIdx: number;
      }
    | {
        type: 'part of numeric literal ended with underscore';
        underscores: number[];
      }
    | {
        type: 'repeating underscores in numeric literal';
        underscores: number[];
      }
    | {
        // TODO unused
        type: 'not digits after dot in numeric literal';
        dotIdx: number;
      }
    | {
        type: 'got a dot or e in a numeric literal which cant have it at that place';
        // TODO idx
      }
    | {
        type: 'had wrong alphabet in numeric literal';
        idxs: number[];
      }
    | { type: 'invalid character in string'; idxs: number[] }
  );
  // #endregion

  // #region helper functions
  function matches(string: string, toMatch: string | string[]): boolean {
    return (
      string === toMatch || (Array.isArray(toMatch) && toMatch.includes(string))
    );
  }

  function matchRange(char: string, fromChar: string, toChar: string): boolean {
    return (
      fromChar.charCodeAt(0) <= char.charCodeAt(0) &&
      char.charCodeAt(0) <= toChar.charCodeAt(0)
    );
  }

  function idxValid(index: number, array: { length: number }): boolean {
    // && index >= 0 && Number.isSafeInteger(index)
    return index < array.length;
  }
  // #endregion

  // #region consume functions
  // assert: an identifier is at idx
  function consumeIdentifier(code: string, idx: number): nextToken {
    let identifier: string = '';

    for (
      let i = idx;
      idxValid(i, code) &&
      (matchRange(code[i], 'a', 'z') ||
        matchRange(code[i], 'A', 'Z') ||
        matchRange(code[i], '0', '9') ||
        code[i] === '_');
      ++i
    )
      identifier += code[i];

    return {
      type: 'token',
      value: {
        lex: identifier,
        ty:
          identifier === 'nan' || identifier === 'inf'
            ? tokenType.literal
            : keywords.includes(identifier)
            ? tokenType.keyword
            : tokenType.identifier,
        idx
      }
    };
  }

  // assert: an operator is at idx
  function consumeSymbol(code: string, idx: number): nextToken {
    let i: number = idx;
    let symbol: string = '';

    // reduce the search space
    // const possibleSymbols: string[] = symbols; // symbols.filter((sym) =>sym.startsWith(code[i]));
    while (
      idxValid(i, code) &&
      symbols.some((sym) => sym.startsWith(symbol + code[i]))
    )
      symbol += code[i++];

    // fix the following case:
    // got: "->"; valid: "->*"; invalid: "-", "->"
    const symbolGot: string = symbol;
    while (!symbols.includes(symbol)) {
      // remove the last character
      symbol = symbol.slice(0, -1);
      i--;

      // no characters left, invalid symbol from the get-go
      if (symbol.length === 0)
        return {
          type: 'error',
          value: {
            type: 'invalid operator',
            lex: symbolGot,
            idx
          }
        };
    }

    return {
      type: 'token',
      value: { lex: symbol, ty: tokenType.symbol, idx }
    };
  }

  // assert: a numeric literal is at idx
  function consumeNumericLiteral(code: string, idx: number): nextToken {
    function consumeDigits(): boolean {
      let consumedSomething: boolean = false;
      let lastCharWasDigit: boolean = false;
      let lastCharWasUnderscore: boolean = false;

      const localAlphabet: string[] =
        alphabet === hexDigits ? hexDigits : decimalDigits;
      while (
        idxValid(i, code) &&
        (matches(code[i], localAlphabet) || matches(code[i], '_'))
      ) {
        if (matches(code[i], alphabet)) {
          consumedSomething = true;
          lastCharWasDigit = true;
          lastCharWasUnderscore = false;
          literal += code[i++];
        } else if (matches(code[i], '_')) {
          // TODO could also be directly after a "e" or "." aka new error
          if (!lastCharWasDigit) invalidDoubleUnderscore.push(i);

          consumedSomething = true;
          lastCharWasDigit = false;
          lastCharWasUnderscore = true;

          literal += code[i++]; // _
        } else if (
          matches(code[i], decimalDigits) &&
          !matches(code[i], alphabet)
        ) {
          invalidAlphabet.push(i);
          literal += code[i++];
        }
      }

      if (lastCharWasUnderscore) invalidUnderscoresEnd.push(i);

      return consumedSomething;
    }

    function consumeDot(): void {
      gotDot = true;
      literal += code[i++]; // .
      if (!consumeDigits()) invalidDidNotConsumDigits.push(i);
    }

    function consumeE(): void {
      gotE = true;
      literal += code[i++]; // e
      if (matches(code[i], ['+', '-'])) literal += code[i++]; // + | -
      if (!consumeDigits()) invalidDidNotConsumDigits.push(i);
    }

    let i: number = idx;
    let literal: string = '';

    let alphabet: string[] = decimalDigits;

    let gotE: boolean = false;
    let gotDot: boolean = false;
    let cantHaveDotOrE: boolean = false;
    let isNonDecimal: boolean = false;
    const invalidDidNotConsumDigits: number[] = [];
    const invalidDoubleUnderscore: number[] = [];
    const invalidUnderscoresEnd: number[] = [];
    const invalidAlphabet: number[] = [];

    if (
      matches(code[i], nonDecimalLiteralStart) &&
      idxValid(i + 1, code) &&
      matches(code[i + 1], nonDecimalLiteralTypes)
    ) {
      isNonDecimal = true;

      literal += code[i++]; // 0
      const char: string = code[i++]; // x | o | b
      literal += char;
      switch (char) {
        case 'x':
          alphabet = hexDigits;
          break;
        case 'b':
          alphabet = binaryDigits;
          break;
        case 'o':
          alphabet = octalDigits;
          break;
      }

      if (!consumeDigits()) invalidDidNotConsumDigits.push(i);
    } else consumeDigits(); // assertion: will have something to lexe

    // TODO, what if it is "5e1.toString()"

    let didSomething: boolean = true;
    // better error messages with while loop: consider "5e1e2.3e2.3"
    while (didSomething) {
      didSomething = false;

      if (idxValid(i, code) && matches(code[i], '.')) {
        if (gotDot || gotE) {
          // TODO error messages
          cantHaveDotOrE = true;
        }

        didSomething = true;
        consumeDot();
      }
      if (idxValid(i, code) && matches(code[i], 'e')) {
        if (gotE) {
          // TODO error messages
          cantHaveDotOrE = true;
        }

        didSomething = true;
        consumeE();
      }
    }

    // TODO needed?
    // for better error messages
    if (
      idxValid(i, code) &&
      (code[i] === '_' ||
        matchRange(code[i], 'a', 'z') ||
        matchRange(code[i], 'A', 'Z'))
    ) {
      const nextToken: nextToken = consumeIdentifier(code, i);

      if (
        nextToken.type === 'token' &&
        (nextToken.value.ty === tokenType.identifier ||
          nextToken.value.ty === tokenType.keyword ||
          nextToken.value.ty === tokenType.literal)
      ) {
        return {
          type: 'error',
          value: {
            type: 'identifier connected to numeric literal',
            lex: literal + nextToken.value.lex,
            invalidIdentifierIdx: nextToken.value.idx,
            idx
          }
        };
      } else
        throw new Error(
          `Internal lexer error while parsing numeric literal and a following identifier at position ${i}`
        );
    }

    // TODO, add all errors in one, because multiple
    // arrays could be none empty
    if (invalidUnderscoresEnd.length !== 0) {
      return {
        type: 'error',
        value: {
          type: 'part of numeric literal ended with underscore',
          lex: literal,
          underscores: invalidUnderscoresEnd,
          idx
        }
      };
    } else if (invalidDoubleUnderscore.length !== 0) {
      return {
        type: 'error',
        value: {
          type: 'repeating underscores in numeric literal',
          lex: literal,
          underscores: invalidDoubleUnderscore,
          idx
        }
      };
    } else if ((gotE || gotDot) && (cantHaveDotOrE || isNonDecimal)) {
      return {
        type: 'error',
        value: {
          type: 'got a dot or e in a numeric literal which cant have it at that place',
          lex: literal,
          idx
        }
      };
    } else if (invalidAlphabet.length !== 0) {
      return {
        type: 'error',
        value: {
          type: 'had wrong alphabet in numeric literal',
          lex: literal,
          idxs: invalidAlphabet,
          idx
        }
      };
    } else if (invalidDidNotConsumDigits.length !== 0) {
      return {
        type: 'error',
        value: {
          type: 'did not consume digits in numeric literal',
          lex: literal,
          idxs: invalidDidNotConsumDigits,
          idx
        }
      };
    }

    return {
      type: 'token',
      value: { lex: literal, ty: tokenType.literal, idx }
    };
  }

  // assert: a comment is at idx
  function consumeComment(code: string, idx: number): nextToken {
    let comment: string = code[idx];
    let i: number = idx + 1; // safe because assertion

    // safe because of assertion
    const commentType: typeof commentType1Start | typeof commentType2Start =
      code[i] as any;
    comment += code[i++];

    if (commentType === '/') {
      while (idxValid(i, code) && !matches(code[i], commentType1Stop))
        comment += code[i++];
    } else if (commentType === '*') {
      let hadCommentType2Stop1: boolean = false;
      while (idxValid(i, code)) {
        const char: string = code[i++];
        comment += char;

        if (hadCommentType2Stop1 && matches(char, commentType2Stop2)) break;
        hadCommentType2Stop1 = matches(char, commentType2Stop1);
      }

      // in case idxValid() stopped
      if (
        comment.length < 4 ||
        !matches(comment[comment.length - 2], commentType2Stop1) ||
        !matches(comment[comment.length - 1], commentType2Stop2)
      )
        return {
          type: 'error',
          value: {
            type: 'eof in /* comment',
            lex: comment,
            idx
          }
        };
    } else
      throw new Error(
        'Internal lexer error: assertion for consumeComment was not met.'
      );

    if (
      comment
        .split('')
        .every((char) => validChars.includes(char) || char === '?')
    )
      return {
        type: 'token',
        value: { lex: comment, ty: tokenType.comment, idx }
      };
    else
      return {
        type: 'error',
        value: {
          type: 'invalid chars in comment',
          lex: comment,
          idx,
          idxs: comment
            .split('')
            .map((char, idx) =>
              !(validChars.includes(char) || char === '?') ? idx : -1
            )
            .filter((idx) => idx !== -1)
        }
      };
  }

  // assert: a string is at idx
  function consumeString(code: string, idx: number): nextToken {
    // TODO, what about \n in the middle of a string?
    let i: number = idx;
    let string: string = code[i++]; // " | ' | `

    const stringEnd: string = string;
    const toEscapeChars: string[] = [stringEnd, ...escapableStringChars];
    const invalidSymbolIdxs: number[] = [];
    const escapeErrorIdxs: number[] = [];
    const escapeErrorU: number[] = [];

    let lastCharWasEscape: boolean = false;
    while (idxValid(i, code)) {
      const char: string = code[i++];
      string += char;

      // TODO
      if (!validChars.includes(char)) invalidSymbolIdxs.push(i - 1);

      if (!lastCharWasEscape && matches(char, stringEnd)) break;
      else if (!lastCharWasEscape)
        lastCharWasEscape = matches(code[i], stringEscapeSymbol);
      else if (lastCharWasEscape) {
        lastCharWasEscape = false;

        if (!matches(char, toEscapeChars)) escapeErrorIdxs.push(i);
        else if (matches(char, 'u'))
          if (
            idxValid(i + 3, code) &&
            code
              .slice(i, i + 4)
              .split('')
              .every((char) => matches(char, hexDigits))
          )
            string += code[i++] + code[i++] + code[i++] + code[i++];
          else escapeErrorU.push(i);
      }
    }

    if (!idxValid(i, code))
      return {
        type: 'error',
        value: { type: 'eof in string', lex: string, idx }
      };
    else if (escapeErrorIdxs.length !== 0)
      return {
        type: 'error',
        value: {
          type: 'used escape symbol not properly in string',
          lex: string,
          idx,
          idxs: escapeErrorIdxs
        }
      };
    else if (escapeErrorU.length !== 0)
      return {
        type: 'error',
        value: {
          type: 'used escape symbol with \\u not properly in string',
          lex: string,
          idx,
          idxs: escapeErrorU
        }
      };
    else if (invalidSymbolIdxs.length !== 0)
      return {
        type: 'error',
        value: {
          type: 'invalid character in string',
          lex: string,
          idx,
          idxs: invalidSymbolIdxs
        }
      };

    return {
      type: 'error',
      value: { type: 'string used', lex: string, idx }
    };
  }
  // #endregion

  // #region lexer functions
  function lexeNextToken(code: string, idx: number): nextToken | 'eof' {
    // skip whitespaces
    while (
      idxValid(idx, code) &&
      (code[idx] === ' ' ||
        code[idx] === '\t' ||
        code[idx] === '\n' ||
        code[idx] === '\r')
    )
      ++idx;

    // reached end of file
    if (!idxValid(idx, code)) return 'eof';

    // check if the current char matches some valid token and consume it

    // matches beginning of an identifier
    if (
      matchRange(code[idx], 'a', 'z') ||
      matchRange(code[idx], 'A', 'Z') ||
      code[idx] === '_'
    )
      return consumeIdentifier(code, idx);

    // matches beginning of a numeric literal
    if (matchRange(code[idx], '0', '9'))
      return consumeNumericLiteral(code, idx);

    // matches the beginning of a comment
    // must be before consumeSymbol()
    if (
      matches(code[idx], commentStart) &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], commentTypes)
    )
      return consumeComment(code, idx);

    // matches the beginning of a symbol
    if (matches(code[idx], firstCharOfSymbols)) return consumeSymbol(code, idx);

    // lexe strings for detailed error messages
    if (matches(code[idx], possibleStringStarts))
      return consumeString(code, idx);

    // the current char does not match any valid token start
    // return an error in this case

    if (idxValid(idx, code) && matches(code[idx], validChars))
      throw new Error(
        `Internal lexer error: should be able to lexe the current character: "${code[idx]}"`
      );

    let invalidChars: string = '';
    for (let i = idx; idxValid(i, code) && !matches(code[i], validChars); ++i)
      invalidChars += code[i];

    return {
      type: 'error',
      value: {
        type: 'invalid chars',
        lex: invalidChars,
        idx
      }
    };
  }

  export function* lexeNextTokenIter(
    code: string
  ): Generator<nextToken, undefined, undefined> {
    let idx: number = 0;

    while (true) {
      const nToken: nextToken | 'eof' = lexeNextToken(code, idx);

      if (nToken === 'eof') return;

      const gotNewIdx: boolean =
        idx !== (idx = nToken.value.idx + nToken.value.lex.length);

      if (!gotNewIdx)
        throw new Error('Internal lexer error: could not lexe the next token.');

      yield nToken;
    }
  }

  export function lexe(code: string):
    | {
        valid: true;
        tokens: token[];
      }
    | {
        valid: false;
        tokens: token[];
        lexerErrors: lexerError[];
      } {
    const tokens: token[] = [];
    const lexerErrors: lexerError[] = [];

    for (const token of Lexer.lexeNextTokenIter(code))
      switch (token.type) {
        case 'token':
          tokens.push(token.value);
          break;
        case 'error':
          lexerErrors.push(token.value);
          break;
      }

    return lexerErrors.length === 0
      ? { valid: true, tokens }
      : { valid: false, tokens, lexerErrors };
  }
  // #endregion

  export function debugLexer(
    times: number = 2,
    timerAndIO: boolean = true,
    example: boolean = false
  ): boolean {
    const timerName: string = 'Lexer tests';

    const x = Lexer.lexe('let xyz: i32 = 52 == 0x5a; // test');
    if (times !== 0 && timerAndIO && example)
      console.log(`[Debug Lexer] Example tokens: '${JSON.stringify(x)}'`);

    let correct: boolean = false;

    for (let i = 0; i < times; ++i) {
      // #region tests
      const mustLexe: [string, number][] = [
        ['//test\n//other comment', 2],
        ['// ?', 1],
        ['.5', 2],
        [
          'a id+a _a___b3c_ + ++ -+ => 3 0.4e2 0.5e-2 0xff 0b10101 0o4025 /**comment / with * **/ let keywords // test comment ??',
          21
        ],
        ['', 0],
        ['let x = (func (a) => a)(3+1);', 17],
        [
          `
let num: i32 /* signed */ = + 5.5_3e+2; // an integer
/**/`,
          11
        ],
        [
          `
use std;
// use my_libs/./wrong_lib/../math_lib/./my_math_lib.bl l;

let num1 = 5;
let num2 = 0x5;
let num3 = 0b1;
let num4 = 0o7;

/* You can /* nest comments * / by escaping slashes */

// example code
let a: i32 = IO.in[i32](0); // gets an i32 from the console
let b: i32 = Math.sq(a); // a ** 2, TO DO compiler/interpreter must deduce that Math.sq[i32] is called and not Math.sq[f32]
let c: i32 = IO.out(b); // prints b and assigneds b to c
let a: i32 = 3 == 3;

let d = func (x: i32) => 5_4.1e-3;
// 5, 5.1e2,  5., 5e, 5e., 5.e, 5.1e, 5e1., 5e1.2
`,
          90
        ],
        [
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

5 5.1e2 51.0e-3
01_23_45_67_89
0123456789 0b1010 0x0123456789ABCDEFabcdef 0o01234567

/* You can /* nest comments *e/ by escaping slashes */

- > * -> * - >* ->*

_

~ & | ^ + - * / % = ( ) [ ] { } < > : ; . , !

! * ** ** + - % / < > = == != <= >= << >> ~ & | ^ : ; . , -> => () [] {} //

********

~~5

// "string"

;`,
          132
        ],
        ['let x: i32 = 5;', 7],
        ['', 0],
        [' ', 0],
        [' \t\n\r', 0],
        ['5/**/identifier;3++hey//', 9],
        [';', 1],
        ['a', 1],
        ['_', 1],
        ['let', 1],
        ['identifier_', 1],
        ['id1_ id_2 _id3', 3],
        ['//', 1],
        [`*/`, 2],
        ['/**/', 1],
        ['.5', 2],
        [`/regexp/`, 3],
        ['0', 1],
        ['5', 1],
        ['5.3', 1],
        ['5.3e3', 1],
        ['5.3e+3', 1],
        ['5.3e-3', 1],
        ['5e3', 1],
        ['0b0', 1],
        ['0b01', 1],
        ['0x0', 1],
        ['0x0123456789abcdefABCDEF', 1],
        ['0o0', 1],
        ['0o01234567', 1],
        [`0_0_1_2_3_4_5_6_7_8_9_3.0_1_2_3e+0_1_2_3`, 1],
        [`_0_0_1_2_3_4_5_6_7_8_9_3.0_1_2_3e-0_1_2_3`, 3],
        ['~', 1],
        ['!', 1],
        ['%', 1],
        ['^', 1],
        ['&', 1],
        ['*', 1],
        ['(', 1],
        [')', 1],
        ['_', 1],
        ['-', 1],
        ['+', 1],
        ['=', 1],
        ['[', 1],
        ['{', 1],
        [']', 1],
        ['}', 1],
        ['|', 1],
        [';', 1],
        [':', 1],
        ['/', 1],
        ['.', 1],
        ['>', 1],
        [',', 1],
        ['<', 1],
        ['0xa+3', 3],
        ['0xE+3', 3],
        ['0xaE+3', 3],
        ['03_4.2', 1],
        ['0xeee', 1],
        ['534e354', 1],
        ['03_3.0_2', 1],
        ['0.0e-0', 1],
        ['0e0', 1],
        [
          `type test {
        t1,
        t2(a.x)
      }

      type a {
        x(i32, f32, i32)
      }

      type optional[t] {
        None,
        Some(t)
      }

      let f = func (x: test): optional[a] =>
        match(x): optional[a] {
          test.t1 => optional.None;
          test.t2(aa, bb, cc) => optional.Some(a.x(aa, bb, cc));
        };`,
          99
        ],
        ...symbols.map((e: string) => [e, 1] as [string, number]),
        ...keywords.map((e: string) => [e, 1] as [string, number])
      ];
      const mustNotLexe: [string, number][] = [
        ['0xlk', 1],
        ['// 😀', 1],
        ['😀😀😀 3__4', 2],
        ['0b12', 1],
        ['0o78', 1],
        ['0o79', 1],
        ['0oA', 1],
        ['0xAx', 1],
        ['0bA', 1],
        ['03_.2', 1],
        ['03._2', 1],
        ['03.0__2', 1],
        ['03__3.0_2', 1],
        ['"string"', 1],
        ['5.3.2', 1],
        ['"😀"', 1],
        ['/*😀*/', 1],
        ['"""', 2],
        [`\\`, 1],
        [`'`, 1],
        [`\``, 1],
        [`"`, 1],
        [`?`, 1],
        [`@`, 1],
        [`#`, 1],
        [`$`, 1],
        [`0_3_.0_3e+0_3`, 1],
        [`😀 ඒ ქ ℂ ∑ ぜ ᾙ ⅶ 潼`, 9],
        [`5e1.`, 1],
        [`5e1.2`, 1],
        [`5.1e`, 1],
        [`5.e`, 1],
        [`5e.`, 1],
        [`5e`, 1],
        [`0b12A3`, 1],
        [`0xP`, 1],
        [`0o99A`, 1],
        [`09A4`, 1],
        [`5let`, 1],
        [`5test`, 1],
        ['/*', 1],
        ['/* ', 1],
        ['/**', 1],
        ['/** ', 1],
        ['/*/', 1],
        ['/* * /', 1],
        ['/*** /', 1],
        ['5.', 1],
        ['5_', 1],
        ['5_3_', 1],
        ['5__3', 1],
        ['5e', 1],
        ['5E', 1],
        ['5e+', 1],
        ['5e3.6', 1],
        ['5e-', 1],
        ['0x', 1],
        ['0o', 1],
        ['0b', 1],
        ['0b123', 1],
        ['0b1F', 1],
        ['0o178', 1],
        ['0A', 1],
        ['0X', 1],
        ['0B', 1],
        ['0O', 1],
        ['03434a35', 1],
        ['0_.0e-0', 1],
        ['0_.e-0', 1],
        ['0.e-0', 1],
        ['0.0e-', 1],
        ['0.0e+', 1],
        ['0.0e', 1],
        ['0.e', 1],
        ['0.e0', 1],
        ['0E0', 1],
        ['\\u1234', 1],
        ['\\uFFfF', 1],
        ['\\uxy', 1],
        ['51.e-3', 1],
        ['0o012345678', 1],
        ['"', 1],
        ['5..3', 1],
        ['5e1e2', 1], // TODO, why?
        ["'\\u4zzz'", 1],
        ["'\\u '", 1],
        ["'\\t'", 1],
        ["'", 1],
        ["''", 1],
        ['``', 1],
        ['""', 1],
        ["'\\\\'", 1],
        ["'\\\\\\'", 1],
        [
          "'\
      [hey'",
          1
        ],
        ['5e_4', 1]
      ];

      if (timerAndIO) console.time(timerName);

      let successfullTests: number = 0;
      for (const code of mustLexe) {
        const lexed = Lexer.lexe(code[0]);
        if (!lexed.valid || lexed.tokens.length !== code[1])
          console.error(
            'error in mustLexe, invalid lexer for code:',
            code[0],
            lexed,
            lexed.tokens.length
          );
        else successfullTests++;
      }
      for (const code of mustNotLexe) {
        const lexed = Lexer.lexe(code[0]);
        if (lexed.valid || lexed.lexerErrors.length !== code[1])
          console.error(
            'error in mustNotLexe, invalid lexer for code:',
            code[0],
            lexed
          );
        else successfullTests++;
      }
      if (timerAndIO) console.timeEnd(timerName);

      correct = successfullTests === mustLexe.length + mustNotLexe.length;
      if (timerAndIO && correct) {
        console.debug(
          `Lexer successfully lexed ${successfullTests} tests and ${
            mustLexe.map((e) => e[0]).join('').length +
            mustNotLexe.map((e) => e[0]).join('').length
          } characters.`
        );
      } else if (!correct)
        console.error(
          `${
            mustLexe.length + mustNotLexe.length - successfullTests
          } failed tests in the Lexer-stage!`
        );
      // #endregion
    }

    return correct;
  }

  debugLexer(0, true, false);

  // console.time();
  // for (let i = 0; i < 1000 * 1000; ++i) {
  //   //consumeIdentifier('jksfdjf_sd234_jkfsd3', 0);
  //   //Lexer.lexe('jksfdjf_sd234_jkfsd3');

  //   //consumeIdentifier('jksfdjf_s 234_jkfsd3', 0);
  //   //consumeIdentifier('jksfdjf_s 234_jkfsd3', 10);

  //   // Lexer.lexe('***+-=>/<=-^|*-<++(}');
  //   //consumeNumericLiteral("03_2_6.3_5e-2_3", 0);
  //   //consumeNumericLiteral("0xAF04E8", 0);
  //   //consumeComment('/* test */', 0);
  //   //consumeComment('// test', 0);
  //   //Lexer.lexe(" \t \t \r \n\n\n   \r\t\t    ");
  // }
  // console.timeEnd();
}
