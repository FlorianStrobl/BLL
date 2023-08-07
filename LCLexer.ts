export namespace Lexer {
  // TODO usually peek() and consumeChar()

  // #region constants
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
  ];

  const symbols: string[] = [
    // only for same primitive types
    '+', // add (binary, unary)
    '-', // sub (binary, unary)
    '*', // multiplication (binary)
    '/', // divide (binary, for integers: rounding down)
    '**', // exponentiation (binary)
    '***', // root (binary)
    '%', // remainder (binary)

    // only ints
    '&', // and (binary)
    '|', // or (binary)
    '^', // xor (binary)
    '~', // not (unary)
    '!', // logical not (unary, 0 -> 1, any -> 0)
    '<<', // logical left shift (binary)
    '>>', // logical right shift (binary)

    // compare only same primitive types
    '==', // equal (binary)
    '!=', // not equal (binary)
    '<=', // less than or equal (binary)
    '>=', // greater than or equal (binary)
    '<', // less than (binary)
    '>', // greater than (binary)

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
  ];

  const whitespaces: string[] = [' ', '\t', '\n', '\r'];

  // new Array(10).fill(0).map((_, i) => i.toString());
  const decimalDigits: string[] = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9'
  ];
  const octalDigits: string[] = ['0', '1', '2', '3', '4', '5', '6', '7'];
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

  //...new Array(26).fill('').map((_, i) => String.fromCharCode(65 /*97*/ + i)),
  const identifierStart: string[] = [
    '_',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z'
  ];
  const alphaNumeric: string[] = [
    // _, a-z, A-Z
    ...identifierStart,
    // 0-9
    ...decimalDigits
  ];

  const commentStart: string = '/';
  const commentTypes: string[] = ['/', '*'];
  const commentType1Start: string = '/';
  const commentType2Start: string = '*';

  const commentType1Stop: string = '\n';
  const commentType2Stop1: string = '*';
  const commentType2Stop2: string = '/';

  const stringStart: string[] = ["'", '"', '`'];
  const escapeSymbol: string = '\\'; // only valid inside strings

  const validChars: string[] = [
    ...whitespaces,
    ...alphaNumeric,
    ...stringStart,
    ...'+-*/%&|^~=!><;:,.(){}[]'.split('')
  ];

  const firstCharSymbols: string[] = symbols.map((str) => str[0]);
  // #endregion

  // #region types
  export enum tokenType {
    comment = '#comment', // "//...", "/*...*/"
    literal = '#literal', // "5.3e-4", "0xFF00FF"
    keyword = '#keyword', // "let", "func"
    identifier = '#identifier', // "_a_z_A_Z_0_9"
    symbol = '#symbol' // "+", "-", "*", "/", "==", "!=", "<", ">", "<=", ">=", ",", "(", ")", "{", "}", "=", "->", "."
  }

  export interface token {
    lexeme: string; // the raw character sequence in the src code, matching a token pattern
    type: tokenType;
    idx: number; // index of the lexeme in the src code
  }

  // TODO
  type errorToken =
    | { codeInvalid: false; type: 'eof' /*reached end of file*/; idx: number }
    | {
        codeInvalid: true;
        type: 'missing space' /* "5let" is not allowed aka: literal followed by an identifier/keyword/literal or keyword followed by operator?? or identifier followed by literal */;
        idx: number;
      }
    | { codeInvalid: true; type: 'invalid chars'; chars: string; idx: number }
    | {
        codeInvalid: true;
        type: 'eof in /* comment';
        chars: string;
        idx: number;
      }
    | { codeInvalid: true; type: 'string used'; chars: string; idx: number }
    | { codeInvalid: true; type: 'eof in string'; chars: string; idx: number }
    | {
        codeInvalid: true;
        type: 'used escape symbol not properly in string';
        chars: string;
        idxs: number[];
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'used escape symbol with u not properly in string';
        chars: string;
        idxs: number[];
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'invalid symbol';
        chars: string;
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'did not consume digits in numeric literal';
        chars: string;
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'identifier connected to numeric literal';
        chars: string;
        invalidIdentifierIdx: number;
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'part of numeric literal ended with underscore';
        chars: string;
        underscores: number[];
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'repeating underscores in numeric literal';
        chars: string;
        underscores: number[];
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'not lexed digits after dot in numeric literal';
        chars: string;
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'got a dot or e in a numeric literal which cant have it at that place';
        chars: string;
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'had wrong alphabet in numeric literal';
        chars: string;
        idx: number;
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

  // #region consume functions
  // assert: a comment is at idx
  function consumeComment(code: string, idx: number): nextToken {
    let comment: string = code[idx];
    let i: number = idx + 1; // safe because assertion

    if (matches(code[i], commentType1Start)) {
      while (idxValid(i, code) && !matches(code[i], commentType1Stop))
        comment += code[i++];
    } else if (matches(code[i], commentType2Start)) {
      comment += code[i++]; // *

      let hadCommentType2Stop1: boolean = false;
      while (idxValid(i, code)) {
        if (hadCommentType2Stop1 && matches(code[i], commentType2Stop2)) {
          comment += code[i++]; // /
          break;
        }

        if (matches(code[i], commentType2Stop1)) hadCommentType2Stop1 = true;
        else hadCommentType2Stop1 = false;

        comment += code[i++];
      }

      // in case idxValid() stopped
      if (
        comment.length < 4 ||
        !matches(comment[comment.length - 2], commentType2Stop1) ||
        !matches(comment[comment.length - 1], commentType2Stop2)
      )
        return {
          valid: false,
          value: {
            codeInvalid: true,
            type: 'eof in /* comment',
            chars: comment,
            idx
          },
          newidx: i
        };
    }

    return {
      valid: true,
      value: { lexeme: comment, type: tokenType.comment, idx },
      newidx: i
    };
  }

  // assert: a numeric literal is at idx
  function consumeNumericLiteral(code: string, idx: number): nextToken {
    function consumeDigits(): boolean {
      let consumedSomething: boolean = false;
      let lastCharWasDigit: boolean = false;
      let lastCharWasUnderscore: boolean = false;

      while (
        idxValid(i, code) &&
        (matches(code[i], alphabet === hexDigits ? hexDigits : decimalDigits) ||
          matches(code[i], '_'))
      ) {
        if (matches(code[i], alphabet)) {
          consumedSomething = true;
          lastCharWasDigit = true;
          lastCharWasUnderscore = false;
          literal += code[i++];
        } else if (matches(code[i], '_')) {
          if (!lastCharWasDigit) invalidDoubleUnderscore.push(i);

          consumedSomething = true;
          lastCharWasDigit = false;
          lastCharWasUnderscore = true;

          literal += code[i++]; // _
        } else if (
          matches(code[i], decimalDigits) &&
          !matches(code[i], alphabet)
        ) {
          invalidHadWrongAlpabet = true;
          literal += code[i++];
        }
      }

      if (lastCharWasUnderscore) invalidUnderscoresEnd.push(i);

      return consumedSomething;
    }

    let i: number = idx;
    let literal: string = '';

    let alphabet: string[] = decimalDigits;

    let gotDotOrE: boolean = false;
    let cantHaveDotOrE: boolean = false;
    let invalidDidNotConsumDigits: boolean = false;
    let invalidHadWrongAlpabet: boolean = false;
    const invalidDoubleUnderscore: number[] = [];
    const invalidUnderscoresEnd: number[] = [];

    if (
      matches(code[i], nonDecimalLiteralStart) &&
      idxValid(i + 1, code) &&
      matches(code[i + 1], nonDecimalLiteralTypes)
    ) {
      cantHaveDotOrE = true;

      literal += code[i++]; // 0
      const char: string = code[i++]; // x | o | b
      literal += char;
      switch (char) {
        case 'x':
          alphabet = hexDigits;
          if (!consumeDigits()) invalidDidNotConsumDigits = true;
          break;
        case 'b':
          alphabet = binaryDigits;
          if (!consumeDigits()) invalidDidNotConsumDigits = true;
          break;
        case 'o':
          alphabet = octalDigits;
          if (!consumeDigits()) invalidDidNotConsumDigits = true;
          break;
      }
    } else consumeDigits();

    if (idxValid(i, code) && matches(code[i], '.')) {
      gotDotOrE = true;

      literal += code[i++]; // .

      if (!consumeDigits()) invalidDidNotConsumDigits = true;
    }

    if (idxValid(i, code) && matches(code[i], 'e')) {
      gotDotOrE = true;

      literal += code[i++]; // e
      if (matches(code[i], ['+', '-'])) literal += code[i++]; // + | -

      if (!consumeDigits()) invalidDidNotConsumDigits = true;

      if (matches(code[i], '.')) {
        // TODO, what if it is "5e1.toString()"
        cantHaveDotOrE = true;
        gotDotOrE = true;
        literal += code[i++];
        consumeDigits();
      }
    }

    if (matches(code[i], identifierStart)) {
      const nextToken: nextToken = consumeIdentifier(code, i);

      if (
        nextToken.valid &&
        (nextToken.value.type === tokenType.identifier ||
          nextToken.value.type === tokenType.keyword)
      ) {
        return {
          valid: false,
          value: {
            codeInvalid: true,
            type: 'identifier connected to numeric literal',
            chars: literal + nextToken.value.lexeme,
            invalidIdentifierIdx: nextToken.value.idx,
            idx
          },
          newidx: nextToken.newidx
        };
      } else
        throw new Error(
          `Internal error while parsing numeric literal and a following identifier at position ${i}`
        );
    }

    if (invalidUnderscoresEnd.length !== 0) {
      return {
        valid: false,
        value: {
          codeInvalid: true,
          chars: literal,
          type: 'part of numeric literal ended with underscore',
          underscores: invalidUnderscoresEnd,
          idx
        },
        newidx: i
      };
    } else if (invalidDoubleUnderscore.length !== 0) {
      return {
        valid: false,
        value: {
          codeInvalid: true,
          chars: literal,
          type: 'repeating underscores in numeric literal',
          underscores: invalidDoubleUnderscore,
          idx
        },
        newidx: i
      };
    } else if (gotDotOrE && cantHaveDotOrE) {
      return {
        valid: false,
        newidx: i,
        value: {
          codeInvalid: true,
          type: 'got a dot or e in a numeric literal which cant have it at that place',
          chars: literal,
          idx
        }
      };
    } else if (invalidHadWrongAlpabet) {
      return {
        valid: false,
        newidx: i,
        value: {
          codeInvalid: true,
          type: 'had wrong alphabet in numeric literal',
          chars: literal,
          idx
        }
      };
    } else if (invalidDidNotConsumDigits) {
      return {
        valid: false,
        newidx: i,
        value: {
          codeInvalid: true,
          type: 'did not consume digits in numeric literal',
          chars: literal,
          idx
        }
      };
    }

    return {
      valid: true,
      value: { lexeme: literal, type: tokenType.literal, idx },
      newidx: i
    };
  }

  // assert: an identifier is at idx
  function consumeIdentifier(code: string, idx: number): nextToken {
    let i: number = idx;
    let identifier: string = '';

    while (idxValid(i, code) && matches(code[i], alphaNumeric))
      identifier += code[i++];

    return {
      valid: true,
      value: {
        lexeme: identifier,
        type: keywords.includes(identifier)
          ? tokenType.keyword
          : tokenType.identifier,
        idx
      },
      newidx: i
    };
  }

  // assert: an operator is at idx
  function consumeSymbol(code: string, idx: number): nextToken {
    let i: number = idx;
    let symbol: string = '';

    // reduce the search space
    const possibleSymbols: string[] = symbols.filter((str) =>
      str.startsWith(code[i])
    );
    while (
      idxValid(i, code) &&
      possibleSymbols.some((str) => str.startsWith(symbol + code[i]))
    )
      symbol += code[i++];

    // got: "->"; valid: "->*"; invalid: "-", ">", "->"
    const symbolGot: string = symbol;
    while (!possibleSymbols.includes(symbol)) {
      if (symbol.length === 0) {
        return {
          valid: false,
          value: {
            codeInvalid: true,
            type: 'invalid symbol',
            chars: symbolGot,
            idx
          },
          newidx: i
        };
      }

      symbol = symbol.substring(0, symbol.length - 1);
      i--;
    }

    return {
      valid: true,
      value: { lexeme: symbol, type: tokenType.symbol, idx },
      newidx: i
    };
  }

  // assert: a string is at idx
  function consumeString(code: string, idx: number): nextToken {
    // TODO, what about \n in the middle of a string?
    let i: number = idx;
    let string: string = code[i++]; // " | ' | `

    const stringEnd: string = string;
    const toEscapSymbols: string[] = [stringEnd, '\\', 'n', 't', 'r', 'u'];
    let lastCharWasEscape: boolean = false;
    let escapeErrorIdxs: number[] = [];
    let escapeErrorU: number[] = [];
    while (
      idxValid(i, code) &&
      !(matches(code[i], stringEnd) && !lastCharWasEscape)
    ) {
      if (!lastCharWasEscape) {
        if (matches(code[i], escapeSymbol)) lastCharWasEscape = true;
        string += code[i++];
      } else {
        if (!matches(code[i], toEscapSymbols)) {
          escapeErrorIdxs.push(i);
          string += code[i++];
        } else {
          const char: string = code[i++];
          string += char;

          if (matches(char, 'u')) {
            if (
              idxValid(i, code) &&
              idxValid(i + 3, code) &&
              matches(code[i], hexDigits) &&
              matches(code[i + 1], hexDigits) &&
              matches(code[i + 2], hexDigits) &&
              matches(code[i + 3], hexDigits)
            )
              string += code[i++] + code[i++] + code[i++] + code[i++];
            else escapeErrorU.push(i);
          }
        }

        lastCharWasEscape = false;
      }
    }

    if (idxValid(i, code) && matches(code[i], stringEnd))
      string += code[i++]; // " | ' | `
    else
      return {
        valid: false,
        value: { codeInvalid: true, type: 'eof in string', chars: string, idx },
        newidx: i
      };

    if (escapeErrorIdxs.length !== 0)
      return {
        valid: false,
        value: {
          codeInvalid: true,
          type: 'used escape symbol not properly in string',
          chars: string,
          idxs: escapeErrorIdxs,
          idx
        },
        newidx: i
      };
    else if (escapeErrorU.length !== 0)
      return {
        valid: false,
        value: {
          codeInvalid: true,
          type: 'used escape symbol with u not properly in string',
          chars: string,
          idxs: escapeErrorU,
          idx
        },
        newidx: i
      };

    return {
      valid: false,
      value: { codeInvalid: true, type: 'string used', chars: string, idx },
      newidx: i
    };
  }
  // #endregion

  function matches(character: string, toMatch: string | string[]): boolean {
    return (
      (typeof toMatch === 'string' && character === toMatch) ||
      toMatch.includes(character)
    );
  }

  function idxValid(idx: number, obj: { length: number }) {
    return idx < obj.length && idx >= 0;
  }

  function lexeNextToken(code: string, idx: number): nextToken {
    while (idxValid(idx, code) && matches(code[idx], whitespaces)) ++idx;

    if (!idxValid(idx, code))
      return {
        valid: false,
        value: { type: 'eof', codeInvalid: false, idx },
        newidx: idx
      };

    if (
      matches(code[idx], commentStart) &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], commentTypes)
    )
      return consumeComment(code, idx);

    if (matches(code[idx], identifierStart))
      return consumeIdentifier(code, idx);

    if (matches(code[idx], decimalDigits))
      return consumeNumericLiteral(code, idx);

    if (firstCharSymbols.includes(code[idx])) return consumeSymbol(code, idx);

    if (matches(code[idx], stringStart)) return consumeString(code, idx);

    let invalidChars: string = '';
    while (idxValid(idx, code) && !matches(code[idx], validChars))
      invalidChars += code[idx++];
    return {
      valid: false,
      value: {
        type: 'invalid chars',
        chars: invalidChars,
        codeInvalid: true,
        idx
      },
      newidx: idx
    };
  }

  export function* lexeNextTokenIter(code: string): Generator<nextToken> {
    let newIdx: number = 0;
    let nToken: nextToken;

    do {
      nToken = lexeNextToken(code, newIdx);

      if (nToken.value.type !== 'eof' && nToken.newidx === newIdx)
        throw new Error('Internal error. Could not lexe the next token.');

      newIdx = nToken.newidx;
      if (nToken.value.type !== 'eof') yield nToken;
    } while (nToken.value.type !== 'eof');
  }

  export function lexe(
    code: string
  ):
    | { valid: true; tokens: token[] }
    | { valid: false; tokens: token[]; errors: errorToken[] } {
    const tokens: token[] = [];
    const errors: errorToken[] = [];

    for (const token of Lexer.lexeNextTokenIter(code))
      if (token.valid) tokens.push(token.value);
      else errors.push(token.value);

    if (errors.length === 0) return { valid: true, tokens };
    else return { valid: false, tokens, errors };
  }

  function debugLexer(): void {
    const timerAndIO: boolean = true;

    const timerName: string = 'Lexer tests';
    if (timerAndIO) console.time(timerName);

    const c: string = ''; // `0.0e-`;
    if (c !== '') console.log(Lexer.lexe(c));

    const mustLexe: [string, number][] = [
      ['let x = (func (a) -> a)(3+1);', 17],
      [
        `
let num: i32 /* signed */ = + 5.5_3e+2; // an integer
/**/`,
        11
      ],
      [
        `
import std;
// import my_libs/./wrong_lib/../math_lib/./my_math_lib.bl l;

let num1 = 5;
let num2 = 0x5;
let num3 = 0b1;
let num4 = 0o7;

/* You can /* nest comments *\\/ by escaping slashes */

// example code
let a: i32 = IO.in[i32](0); // gets an i32 from the console
let b: i32 = Math.sq(a); // a ** 2, TO DO compiler/interpreter must deduce that Math.sq[i32] is called and not Math.sq[f32]
let c: i32 = IO.out(b); // prints b and assigneds b to c
let a: i32 = 3 == 3;

let d = func (x: i32) -> 5_4.1e-3;
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

! * ** *** + - % / < > = == != <= >= << >> ~ & | ^ : ; . , -> () [] {} //

********

~~5

// "string"

;`,
        130
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
      ['0xeee', 1],
      ['534e354', 1],
      ['0.0e-0', 1],
      ['0e0', 1],
      ['5.3.2', 3],
      ...symbols.map((e: string) => [e, 1] as [string, number]),
      ...keywords.map((e: string) => [e, 1] as [string, number])
    ];
    const mustNotLexe: string[] = [
      `\\`,
      `'`,
      `\``,
      `"`,
      `?`,
      `@`,
      `#`,
      `$`,
      `0_3_.0_3e+0_3`,
      `😀 ඒ ქ ℂ ∑ ぜ ᾙ ⅶ 潼`,
      `5e1.`,
      `5e1.2`,
      `5.1e`,
      `5.e`,
      `5e.`,
      `5e`,
      `0b12A3`,
      `0xP`,
      `0o99A`,
      `09A4`,
      `5let`,
      `5test`,
      '/*',
      '/* ',
      '/**',
      '/** ',
      '/*/',
      '5.',
      '5_',
      '5_3_',
      '5__3',
      '5e',
      '5E',
      '5e+',
      '5e3.6',
      '5e-',
      '0x',
      '0o',
      '0b',
      '0b123',
      '0b1F',
      '0o178',
      '0A',
      '0X',
      '0B',
      '0O',
      '03434a35',
      '0_.0e-0',
      '0_.e-0',
      '0.e-0',
      '0.0e-',
      '0.0e+',
      '0.0e',
      '0.e',
      '0.e0',
      '0E0',
      '\\u1234',
      '\\uFFfF',
      '\\uxy',
      '51.e-3',
      '0o012345678',
      '"',
      '5..3',
      '5e1e2' // TODO, why?
    ];

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
      let lexed = Lexer.lexe(code);
      if (lexed.valid)
        console.error(
          'error in mustNotLexe, invalid lexer for code:',
          code,
          lexed
        );
      else successfullTests++;
    }

    if (
      timerAndIO &&
      successfullTests === mustLexe.length + mustNotLexe.length
    ) {
      console.debug(
        `Lexer successfully lexed ${successfullTests} tests and ${
          mustLexe.map((e) => e[0]).reduce((a, b) => a + b).length +
          mustNotLexe.reduce((a, b) => a + b).length
        } characters.`
      );
    } else if (successfullTests !== mustLexe.length + mustNotLexe.length)
      console.error(
        `${
          mustLexe.length + mustNotLexe.length - successfullTests
        } failed tests in the Lexer-stage!`
      );

    if (timerAndIO) console.timeEnd(timerName);
  }

  // for (let i = 0; i < 1; ++i) debugLexer();
}
