import { printMessage, ErrorID } from './FErrorMsgs';

// check gcc, clang, ghci, chromium v8, firefox, java, .NET w/ C#
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar
// https://stackoverflow.com/questions/14954721/what-is-the-difference-between-a-token-and-a-lexeme BLL
// TODO, not peek() and consumeChar() = bad because not standard?

export namespace Lexer {
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
  ]; //.sort();

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
    '!', // logical not (0 -> 1, any -> 0)
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
  ];
  //  .sort((a, b) => b.length - a.length)
  //  .filter(/*remove doubles*/ (e, i, a) => !a.slice(0, i).includes(e));

  const alphaNumeric: RegExp = /[0-9a-zA-Z_]/;
  const identifierStart: RegExp = /[a-zA-Z_]/;
  const hexDigits: RegExp = /[0-9a-fA-F]/;
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
  // #endregion

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
        type: 'invalid numeric literal';
        chars: string;
        idx: number;
      }
    | {
        codeInvalid: true;
        type: 'identifier connected to numeric literal';
        chars: string;
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

    const commentType1Start = '/';
    const commentType2Start = '*';
    if (matches(code[i], commentType1Start)) {
      const commentType1Stop = '\n';
      while (idxValid(i, code) && !matches(code[i], commentType1Stop))
        comment += code[i++];
    } else if (matches(code[i], commentType2Start)) {
      comment += code[i++];

      const commentType2Stop1 = '*';
      const commentType2Stop2 = '/';

      let hadCommentType2Stop1: boolean = false;
      while (idxValid(i, code)) {
        if (hadCommentType2Stop1 && matches(code[i], commentType2Stop2)) {
          comment += code[i++];
          break;
        }

        hadCommentType2Stop1 = false;
        if (matches(code[i], commentType2Stop1)) hadCommentType2Stop1 = true;

        comment += code[i++];
      }

      // incase idxValid() stopped
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
      value: { lexeme: comment, type: lexemeType.comment, idx },
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
        (matches(code[i], hexDigits) || matches(code[i], '_'))
      ) {
        if (matches(code[i], alphabet)) {
          consumedSomething = true;
          lastCharWasDigit = true;
          lastCharWasUnderscore = false;
          literal += code[i++];
        } else if (lastCharWasDigit && matches(code[i], '_')) {
          consumedSomething = true;
          lastCharWasDigit = false;
          lastCharWasUnderscore = true;
          literal += code[i++];
        } else if (!lastCharWasDigit && matches(code[i], '_')) {
          consumedSomething = true;
          lastCharWasDigit = false;
          lastCharWasUnderscore = true;
          invalidUnderscoresMiddle.push(i);
          literal += code[i++];
        } else if (matches(code[i], hexDigits) && !matches(code[i], alphabet)) {
          if (matches(code[i], 'e')) break; // TODO
          invalidHadWrongAlpabet = true;
          literal += code[i++];
        }
      }

      if (lastCharWasUnderscore) invalidUnderscoresEnd.push(i);

      return consumedSomething;
    }

    let i: number = idx;
    let literal: string = '';

    let alphabet: RegExp | string[] = decimalDigits;
    const binaryDigits: string[] = ['0', '1'];
    const octalDigits: string[] = ['0', '1', '2', '3', '4', '5', '6', '7'];

    let gotDotOrE: boolean = false;
    let cantHaveDotOrE: boolean = false;
    let invalidDidNotConsumDigits: boolean = false;
    let invalidHadWrongAlpabet: boolean = false;
    const invalidUnderscoresMiddle: number[] = [];
    const invalidUnderscoresEnd: number[] = [];

    const startNonDecimalLiteral = '0';
    const nonDecimalLiteral = ['x', 'b', 'o'];
    if (
      matches(code[i], startNonDecimalLiteral) &&
      idxValid(i + 1, code) &&
      matches(code[i + 1], nonDecimalLiteral)
    ) {
      cantHaveDotOrE = true;

      literal += code[i++];
      const char: string = code[i++];
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
      literal += code[i++];

      if (!consumeDigits()) invalidDidNotConsumDigits = true;
    }

    if (idxValid(i, code) && matches(code[i], 'e')) {
      gotDotOrE = true;

      literal += code[i++];
      if (matches(code[i], ['+', '-'])) literal += code[i++];

      if (!consumeDigits()) invalidDidNotConsumDigits = true;

      if (matches(code[i], '.')) {
        cantHaveDotOrE = true;
        gotDotOrE = true;
        literal += code[i++];
        consumeDigits();
      }
    }

    if (matches(code[i], identifierStart)) {
      // TODO, add index as information
      const nextToken: nextToken = consumeIdentifier(code, i);

      if (
        nextToken.valid &&
        (nextToken.value.type === lexemeType.identifier ||
          nextToken.value.type === lexemeType.keyword)
      ) {
        return {
          valid: false,
          value: {
            codeInvalid: true,
            type: 'identifier connected to numeric literal',
            chars: literal + nextToken.value.lexeme,
            idx
          },
          newidx: nextToken.newidx
        };
      } else {
        throw new Error(
          `Internal error while parsing numeric literal and a following identifier at position ${i}`
        );
      }
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
    } else if (invalidUnderscoresMiddle.length !== 0) {
      return {
        valid: false,
        value: {
          codeInvalid: true,
          chars: literal,
          type: 'repeating underscores in numeric literal',
          underscores: invalidUnderscoresMiddle,
          idx
        },
        newidx: i
      };
    } else if (
      (gotDotOrE && cantHaveDotOrE) ||
      invalidHadWrongAlpabet ||
      invalidDidNotConsumDigits
    ) {
      return {
        valid: false,
        newidx: i,
        value: {
          codeInvalid: true,
          type: 'invalid numeric literal',
          chars: literal,
          idx
        }
      };
    }

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

    while (idxValid(i, code) && matches(code[i], alphaNumeric))
      identifier += code[i++];

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
    let symbol: string = '';

    while (
      idxValid(i, code) &&
      symbols.some((s) => s.startsWith(symbol + code[i]))
    )
      symbol += code[i++];

    // got: "->"; valid: "->*"; invalid: "-", ">", "->"
    const symbolGot: string = symbol;
    while (!symbols.includes(symbol)) {
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
      value: { lexeme: symbol, type: lexemeType.symbol, idx },
      newidx: i
    };
  }

  // assert: a string is at idx
  function consumeString(code: string, idx: number): nextToken {
    // TODO, what about \n in the middle of a string?
    let i: number = idx;
    let string: string = code[i++];

    const stringEnd: string = string;
    const escapeSymbol = '\\';
    const toEscapSymbols = [stringEnd, '\\', 'n', 't', 'r', 'u'];

    let escaped: boolean = false;
    let escapeErrorIdxs: number[] = [];
    let escapeErrorU: number[] = [];
    while (idxValid(i, code) && !(matches(code[i], stringEnd) && !escaped)) {
      if (!escaped) {
        if (matches(code[i], escapeSymbol)) escaped = true;
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

        escaped = false;
      }
    }

    if (idxValid(i, code) && matches(code[i], stringEnd)) string += code[i++];
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

  function matches(
    character: string,
    toMatch: string | string[] | RegExp
  ): boolean {
    return (
      typeof character === 'string' &&
      character.length === 1 &&
      ((typeof toMatch === 'string' && character === toMatch) ||
        (Array.isArray(toMatch) && toMatch.includes(character)) ||
        (toMatch instanceof RegExp && character.match(toMatch) !== null))
    );
  }

  function idxValid(idx: number, obj: number | { length: number }) {
    return (
      0 <= idx &&
      Number.isSafeInteger(idx) &&
      (typeof obj === 'number' ? idx < obj : idx < obj.length)
    );
  }

  function lexeNextToken(code: string, idx: number): nextToken {
    const whitespaces = [' ', '\t', '\n', '\r'];
    while (idxValid(idx, code) && matches(code[idx], whitespaces)) ++idx;

    if (!idxValid(idx, code))
      return {
        valid: false,
        value: { type: 'eof', codeInvalid: false, idx },
        newidx: idx
      };

    const commentStart1 = '/';
    const commentStart2 = ['/', '*'];
    if (
      matches(code[idx], commentStart1) &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], commentStart2)
    )
      return consumeComment(code, idx);

    if (matches(code[idx], identifierStart))
      return consumeIdentifier(code, idx);

    if (matches(code[idx], decimalDigits))
      return consumeNumericLiteral(code, idx);

    const firstCharSymbols: string[] = symbols.map((e) => e[0]);
    if (firstCharSymbols.includes(code[idx])) return consumeSymbol(code, idx);

    const stringStart = ['"', "'", '`'];
    if (matches(code[idx], stringStart)) return consumeString(code, idx);

    let invalidChars: string = '';
    const validChars = /['`" \t\n\r0-9a-zA-Z_\-+*/%&|^~=!><;:,.(){}[\]]/;
    while (idxValid(idx, code) && !matches(code[idx], validChars))
      invalidChars += code[idx++];
    return {
      valid: false,
      newidx: idx,
      value: {
        type: 'invalid chars',
        chars: invalidChars,
        codeInvalid: true,
        idx
      }
    };
  }

  export function* lexeNextTokenIter(
    code: string
  ): Generator<nextToken, undefined> {
    let newIdx: number = 0;
    let nToken: nextToken;

    do {
      let idxBefore: number = newIdx;
      nToken = lexeNextToken(code, newIdx);
      newIdx = nToken.newidx;

      if (nToken.value.type !== 'eof' && idxBefore === newIdx)
        throw new Error('Internal error. Could not lexe the next token.');
      else if (nToken.value.type !== 'eof') yield nToken;
    } while (nToken.value.type !== 'eof');

    return undefined;
  }

  export function lexe(
    code: string
  ):
    | { valid: true; tokens: token[] }
    | { valid: false; errors: errorToken[]; tokens: token[] } {
    const tokens: token[] = [];
    const errors: errorToken[] = [];

    for (const token of Lexer.lexeNextTokenIter(code)) {
      if (token.valid) tokens.push(token.value);
      else errors.push(token.value);
    }

    if (errors.length === 0) return { valid: true, tokens };
    else return { valid: false, errors, tokens };
  }

  function debugLexer() {
    const c: string = ''; // `0.0e-`;
    if (c !== '') console.log(Lexer.lexe(c));

    const mustLexe: [string, number][] = [
      [
        `
let num: i32 /* signed */ = + 5.5_3e+2; // an integer
/**/`,
        11
      ],
      [
        `
import std;
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
      '51.e-3'
    ];

    for (const code of mustLexe) {
      const lexed = Lexer.lexe(code[0]);
      if (!lexed.valid || lexed.tokens.length !== code[1])
        console.error(
          'error in mustLexe, invalid lexer for code:',
          code[0],
          lexed,
          lexed.tokens.length
        );
    }
    for (const code of mustNotLexe) {
      let lexed = Lexer.lexe(code);
      if (lexed.valid)
        console.error(
          'error in mustNotLexe, invalid lexer for code:',
          code,
          lexed
        );
    }

    console.log('runned debug lexer');
  }

  debugLexer();
}

// https://runjs.co/s/I1irVl3Rf
// https://www.typescriptlang.org/play?#code/PTAECkEMDdIZQMYCcCWAHALsAKgTzQKaKqagCOAriggNYDOGkSGoA5lQCYEBQIo2ACxR1Qw0JFAIA9gFsZBAHYYAdPwEFc4pAVGsFU7R1AAjTRnWg0SKaySQ5KBa1AAbSE4qRWBZbwBUgmJikC50UuKSsvJKfsDcvGAARDK4AGIUCggYKFIKiaIiEgBmGVk5CqAA7kIIAqCMNASFoHSOrC46ChQyxgRICeKFFUzs0SzuRtoYFEgKzV09fVXqFQQAHgQIFBgEHL4lmdm5oCnph+UAFGsAXKALvUgAlLf3SwDe3KCgfJUo5vUWRIdDD5Rq4SoGDgAGlAuR0CHcoC4RUcOgksFQkGMHV8X2BJ1wADUmCgsR0Xt0HqAALygACsAG5Pt8wBjSdimpJEb0TlIOCgUbsqn86uYdIlqfkpIQ7BgDLiCcTMRyaYqSWSdABqUAARiZXz4ySJ6o5+TE+kqoAudNA2p1j3ENAkADZfMyfkIOgD4bl+UcKkaleyvQBCWkADjNIgwSAoPANYDFkS4ogqScSb1AAF98tipLRhS4XCYdOtNttdgrqigvRcUkGNaAw6Bww6Pl8E97QIlNZqpTLIHKkKnkARIHROUm2Y3YC44yZNHCFV9e-WTR19dn4p3EYkBfkGIOCGNJOpaNGLNIFH7yu6wBNQGWtjsL+LMzmTC58zQYQKu1eb2OSpx3qWMfGZP862NZUvWpCM22ZTtEivMIcS-Vh8isRwMFfLRRkUHDEJZVMu2MOxaF2aNwiTFCpBxIjaLQmwLiIr4AHJ1FwNjvj8WomEgLIlhcP4+hCEQZAoBgSxaGZrAyLgjFMJEpAoFVKCkF9YiIx5NyzR9Qh0dsOz4P9033SJrz+coqhAooxIIGF0wIAzcy-AsxCfCs9m3DtGJ8dCLjsgydOZLMfL4REmDsTRglcYQWCkIpQFnOM6AVfFXiQABBJBoopRYkAAbQAXVVQqAAYYR1GEACYYQAZmKpk727IoDHyL9pRECEkBoOLGi7RJqw6DqpGla5mTa4cWI7VwCBYFBVXKnjHw2Z8hV6KadCTFEkCkkTZWs2JNy+RaAB5QAAFhWgCrNyGFvBw09NkaRSCC21by2yJwuwUdYFp2Q7jmOoje0W4A-DYeaRE8nYjEHLtFCMRLHwEuoDsHI64i+BDZp+EVBsK0Biv7UShxhOEuQqR6uxS+NjPvFgk1YFBoEUSwpFaf0YWqPodDQTm7oqZaxB2lA9pYZzjwI5c1RgnRaTXeXbTuSk+hy6LCpQJrQvCsAleDHRgiZoQRAF7DdUuhUphmCoDcbbU1iZMKBmKUp-Sp6SESLIVfn+RILlAR5El8fEbdmXZiTnAh8qpRW0ndy46RCvzlAC8O-o4KO4x0oA
