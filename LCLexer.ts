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
    'f32', // single precision 32 bit float from the IEEE754-2008 standard

    // literals:
    'inf', // f32 infinity
    'nan' // f32 not a number
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

  const stringStarts: string[] = ["'", '"', '`'];
  const stringEscapeSymbol: string = '\\'; // only valid inside strings
  const escapableStringChars: string[] = ['\\', 'n', 't', 'r', 'u'];
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
    ...stringStarts // because of error messages
  ];

  const maxSymbolLen: number = symbols.reduce(
    (a, b) => (b.length > a ? b.length : a),
    0
  );
  const firstCharOfKeywords: string[] = keywords
    .map((str) => str[0]) // get first char
    .filter((e, i, t) => t.indexOf(e) === i); // remove duplicates
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

  export type numericLiteralError =
    | { type: 'unexpected eof in numeric literal' }
    | {
        type: 'did not consume digits in numeric literal';
        idx: number;
      }
    | {
        type: 'already had "e" in numeric literal';
        firstE: number;
        currentE: number;
      }
    | {
        type: 'already had "e" in numeric literal and got now a "."';
        firstE: number;
        currentDot: number;
      }
    | {
        type: 'already had a dot in numeric literal';
        firstDot: number;
        currentDot: number;
      }
    | {
        type: 'numeric literal part started with underscore' /*TODO, is that actually possible, since that would be an identifier*/;
        idx: number;
      }
    | {
        type: 'part of numeric literal ended with underscore';
        underscores: number;
      }
    | {
        type: 'repeating underscores in numeric literal';
        underscores: number[];
      }
    | {
        type: 'had wrong alphabet in numeric literal';
        startingFrom: number;
      }
    | {
        // unused
        type: 'identifier connected to numeric literal';
        invalidIdentifierIdx: number;
      };

  export type lexerError = { lex: string; idx: number } & (
    | { type: 'invalid chars' }
    | {
        type: 'invalid chars in comment';
        idxs: number[];
      }
    | { type: 'invalid numeric literal'; errors: numericLiteralError[] }
    | {
        type: 'invalid operator';
        potentialOperators: string[];
      }
    | {
        type: 'eof in /* comment';
      }
    | { type: 'string used' }
    | { type: 'invalid character in string'; idxs: number[] }
    | { type: 'eof in string' }
    | {
        type: 'used escape symbol not properly in string';
        idxs: number[];
      }
    | {
        type: 'used escape symbol with \\u not properly in string';
        idxs: number[];
      }
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
  function consumeWord(code: string, idx: number): nextToken {
    // optimization: exclude most identifiers from the isKeyword check later
    const canBeKeyword: boolean = firstCharOfKeywords.includes(code[idx]);

    // increase the index to the maximum possible valid identifier length
    let endIdx: number = idx;
    for (
      ;
      idxValid(endIdx, code) &&
      (matchRange(code[endIdx], 'a', 'z') ||
        matchRange(code[endIdx], 'A', 'Z') ||
        matchRange(code[endIdx], '0', '9') ||
        matches(code[endIdx], '_'));
      ++endIdx
    );

    const identifier: string = code.substring(idx, endIdx);

    return {
      type: 'token',
      value: {
        lex: identifier,
        ty:
          canBeKeyword && keywords.includes(identifier)
            ? identifier === 'nan' || identifier === 'inf'
              ? tokenType.literal
              : tokenType.keyword
            : tokenType.identifier,
        idx
      }
    };
  }

  // assert: an operator is at idx
  function consumeSymbol(code: string, idx: number): nextToken {
    // speed optimization because symbols are usually short:
    let potentialSymEndIdx: number = Math.min(
      idx + maxSymbolLen /*could be out of range => Math.min*/,
      code.length
    );

    // decrease the end index, until it makes up a valid symbol
    for (
      ;
      idx < potentialSymEndIdx &&
      !symbols.includes(code.substring(idx, potentialSymEndIdx));
      --potentialSymEndIdx
    );

    // error: symbol in that form does not exist
    if (idx === potentialSymEndIdx) {
      // search for the biggest substring still matching with some symbol
      let biggestSubstr: string = '';
      for (
        let i = idx;
        idxValid(i, code) &&
        symbols.some((symbol) => symbol.startsWith(biggestSubstr + code[i]));
        biggestSubstr += code[i], ++i
      );

      return {
        type: 'error',
        value: {
          type: 'invalid operator',
          lex: biggestSubstr,
          idx,
          potentialOperators: symbols.filter((symbol) =>
            symbol.startsWith(biggestSubstr)
          )
        }
      };
    }

    return {
      type: 'token',
      value: {
        lex: code.substring(idx, potentialSymEndIdx),
        ty: tokenType.symbol,
        idx
      }
    };
  }

  // assertion: a numeric literal is at idx
  // TODO what about having an identifier directly behind the numeric literal?
  function consumeNumericLiteral(code: string, idx: number): nextToken {
    if (!(idxValid(idx, code) && matchRange(code[idx], '0', '9')))
      throw new Error(
        'Internal lexer error: assertions for lexing a numeric literal where not met.'
      );

    const errors: numericLiteralError[] = [];
    let endIdx: number = idx;

    // TODO lexe greedily all characters from the alphabet of the given type
    function maxDigitsIdx(
      startIdx: number,
      type: 'dec' | 'bin' | 'oct' | 'hex'
    ): number {
      if (!idxValid(startIdx, code))
        // TODO
        throw new Error(
          'Internal lexer error: did not met assertion for part of lexing numeric literal.'
        );

      let lastCharUnderscore: boolean = false;

      // if started with underscore bad too TODO
      if (code[startIdx] === '_')
        errors.push({
          type: 'numeric literal part started with underscore',
          idx: startIdx
        });

      let endIdx: number = startIdx;
      for (
        ;
        idxValid(endIdx, code) &&
        (code[endIdx] === '_' ||
          (type === 'dec'
            ? matchRange(code[endIdx], '0', '9')
            : type === 'bin'
            ? matchRange(code[endIdx], '0', '1')
            : type === 'oct'
            ? matchRange(code[endIdx], '0', '7')
            : matchRange(code[endIdx], '0', '9') ||
              matchRange(code[endIdx], 'a', 'f') ||
              matchRange(code[endIdx], 'A', 'F')));
        ++endIdx
      ) {
        // check for double underscores
        if (lastCharUnderscore && matches(code[endIdx], '_')) {
          const invalidIdxStart: number = endIdx;

          // get to the last underscore
          for (
            ;
            idxValid(endIdx, code) && matches(code[endIdx], '_');
            ++endIdx
          );

          errors.push({
            type: 'repeating underscores in numeric literal',
            underscores: new Array(endIdx - invalidIdxStart)
              .fill(0)
              .map((_, i) => i + invalidIdxStart)
          });
        }

        lastCharUnderscore = matches(code[endIdx], '_');
      }

      // if ended with underscore, bad TODO
      if (idxValid(endIdx - 1, code) && code[endIdx - 1] === '_')
        errors.push({
          type: 'part of numeric literal ended with underscore',
          underscores: endIdx - 1
        });

      return endIdx;
    }

    // check if it is a decimal or binary/octal/hex number literal
    if (
      matches(code[endIdx], '0') &&
      idxValid(endIdx + 1, code) &&
      matches(code[endIdx + 1], ['b', 'o', 'x'])
    ) {
      // binary/octal/hex-number literal
      endIdx += 2; // the "0b"/"0o"/"0x"
      const literalType: 'bin' | 'oct' | 'hex' =
        code[endIdx - 1] === 'b'
          ? 'bin'
          : code[endIdx - 1] === 'o'
          ? 'oct'
          : 'hex';

      if (!idxValid(endIdx, code))
        errors.push({ type: 'unexpected eof in numeric literal' });
      else {
        const consumedSomething: boolean =
          endIdx !== (endIdx = maxDigitsIdx(endIdx, literalType));

        if (!consumedSomething)
          errors.push({
            type: 'did not consume digits in numeric literal',
            idx: endIdx
          });

        // invalid alphabet must have been used in current numeric literal
        if (idxValid(endIdx, code) && matchRange(code[endIdx], '0', '9')) {
          // => lexe the next numeric literal (potentially with (the same) errors)
          // merge the lexemes and return the error
          const nextToken = lexeNextToken(code, endIdx);

          if (
            nextToken === 'eof' ||
            (nextToken.type === 'token' &&
              nextToken.value.ty !== tokenType.literal) ||
            (nextToken.type === 'error' &&
              nextToken.value.type !== 'invalid numeric literal')
          )
            throw new Error(
              'Internal lexer error: expected a numeric literal at current position.'
            );

          const newErrors: numericLiteralError[] =
            nextToken.type === 'error' &&
            nextToken.value.type === 'invalid numeric literal'
              ? nextToken.value.errors
              : [];

          return {
            type: 'error',
            value: {
              type: 'invalid numeric literal',
              lex: code.substring(idx, endIdx) + nextToken.value.lex,
              errors: [
                ...errors,
                // TODO idxs not as array
                {
                  type: 'had wrong alphabet in numeric literal',
                  startingFrom: endIdx
                },
                ...newErrors
              ],
              idx
            }
          };
        }
      }
    } else {
      // it must be a decimal literal

      // precomma part, cant eof because of assertion
      endIdx = maxDigitsIdx(idx, 'dec');

      let firstDotIdx: number = -1;
      let firstEIdx: number = -1;

      out: while (idxValid(endIdx, code)) {
        // TODO, what if already had a `.` or an `e`
        switch (code[endIdx]) {
          case '.':
            if (firstDotIdx !== -1) {
              errors.push({
                type: 'already had a dot in numeric literal',
                firstDot: firstDotIdx,
                currentDot: endIdx
              });
            } else if (firstEIdx !== -1) {
              errors.push({
                type: 'already had "e" in numeric literal and got now a "."',
                firstE: firstEIdx,
                currentDot: endIdx
              });
            } else firstDotIdx = endIdx;

            endIdx++;

            if (idxValid(endIdx, code)) {
              const consumedSomething: boolean =
                endIdx !== (endIdx = maxDigitsIdx(endIdx, 'dec'));

              if (!consumedSomething)
                errors.push({
                  type: 'did not consume digits in numeric literal',
                  idx: endIdx
                });
            } else errors.push({ type: 'unexpected eof in numeric literal' });
            break;
          case 'E':
          case 'e':
            if (firstEIdx !== -1) {
              errors.push({
                type: 'already had "e" in numeric literal',
                firstE: firstEIdx,
                currentE: endIdx
              });
            } else firstEIdx = endIdx;

            endIdx++;

            if (idxValid(endIdx, code)) {
              if (matches(code[endIdx], ['-', '+'])) endIdx++;

              if (idxValid(endIdx, code)) {
                const consumedSomething: boolean =
                  endIdx !== (endIdx = maxDigitsIdx(endIdx, 'dec'));

                if (!consumedSomething)
                  errors.push({
                    type: 'did not consume digits in numeric literal',
                    idx: endIdx
                  });
              } else errors.push({ type: 'unexpected eof in numeric literal' });
            } else errors.push({ type: 'unexpected eof in numeric literal' });
            break;
          default:
            break out;
        }
      }
    }

    if (errors.length !== 0)
      return {
        type: 'error',
        value: {
          type: 'invalid numeric literal',
          lex: code.substring(idx, endIdx),
          errors,
          idx
        }
      };

    return {
      type: 'token',
      value: {
        lex: code.substring(idx, endIdx),
        ty: tokenType.literal,
        idx
      }
    };
  }

  // assert: a comment is at idx
  function consumeComment(code: string, idx: number): nextToken {
    if (
      !(idxValid(idx, code) && matches(code[idx], '/')) ||
      !(idxValid(idx + 1, code) && matches(code[idx + 1], ['*', '/']))
    )
      throw new Error(
        'Internal lexer error: assertions for calling consumeComment where not met'
      );

    // two types: "/" and "*"
    const isType1: boolean = code[idx + 1] === '/';

    // search for the end of the string, and save the index in i
    let reachedCommentTy2End: boolean = false;
    let i: number = idx + 2;
    out: for (; idxValid(i, code); ++i) {
      switch (isType1) {
        case true:
          if (matches(code[i], '\n')) break out;
          break;
        case false:
          // type 2 comment ends with "*/"
          if (
            matches(code[i], '*') &&
            idxValid(i + 1, code) &&
            matches(code[i + 1], '/')
          ) {
            reachedCommentTy2End = true;
            i += 2;
            break out;
          }
          break;
      }
    }

    //  check if reached the very end of the code and type 2 comment was closed properly
    if (!isType1 && !reachedCommentTy2End)
      return {
        type: 'error',
        value: {
          type: 'eof in /* comment',
          lex: code.substring(idx, code.length),
          idx
        }
      };

    return {
      type: 'token',
      value: { lex: code.substring(idx, i), ty: tokenType.comment, idx }
    };

    // any char should be allowed inside a comment?
    // if (
    //   !comment
    //     .split('')
    //     .every((char) => validChars.includes(char) || char === '?')
    // )
    //   return {
    //     type: 'error',
    //     value: {
    //       type: 'invalid chars in comment',
    //       lex: comment,
    //       idx,
    //       idxs: comment
    //         .split('')
    //         .map((char, idx) =>
    //           !(validChars.includes(char) || char === '?') ? idx : -1
    //         )
    //         .filter((idx) => idx !== -1)
    //     }
    //   };
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
        // for "\uFFFF" strings
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

    // special error cases, TODO merge them in one message
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

    // matches beginning of an identifier, keyword, or float literal
    if (
      matchRange(code[idx], 'a', 'z') ||
      matchRange(code[idx], 'A', 'Z') ||
      matches(code[idx], '_')
    )
      return consumeWord(code, idx);

    // matches beginning of a numeric literal
    if (matchRange(code[idx], '0', '9'))
      return consumeNumericLiteral(code, idx);

    // matches the beginning of a comment
    // must be checked before consumeSymbol()
    if (
      matches(code[idx], '/') &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], ['/', '*'])
    )
      return consumeComment(code, idx);

    // matches the beginning of a symbol
    if (matches(code[idx], firstCharOfSymbols)) return consumeSymbol(code, idx);

    // lexe strings for detailed error messages
    if (matches(code[idx], stringStarts)) return consumeString(code, idx);

    // the current char does not match any valid token start
    // return an error in this case

    // check for mistake
    if (idxValid(idx, code) && matches(code[idx], validChars))
      throw new Error(
        `Internal lexer error: should be able to lexe the current character: "${code[idx]}"`
      );

    // get all the invalid chars behind the current invalid char by its end index
    let endIdx = idx;
    for (
      ;
      idxValid(endIdx, code) && !matches(code[endIdx], validChars);
      ++endIdx
    );

    return {
      type: 'error',
      value: {
        type: 'invalid chars',
        lex: code.substring(idx, endIdx),
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
        // TODO, should lexe those?
        [`5let`, 2],
        [`5test`, 2],
        ['0b1F', 2],
        ['0xAx', 2],
        [`09A4`, 2],
        ['0A', 2],
        ['0X', 2],
        ['0B', 2],
        ['0O', 2],
        ['0E0', 1],
        ['03434a35', 2],
        ['0x0243F02F_34FA_a', 1],
        ['nan', 1],
        ['inf', 1],
        ['//', 1],
        ['// ', 1],
        ['/**/', 1],
        ['/**/ ', 1],
        ['// 😀', 1],
        ['/*😀*/', 1],
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
        ['5E', 1],
        ['0x', 1],
        ['0b', 1],
        ['0o', 1],
        ['0o ', 1],
        ['0x ', 1],
        ['0b ', 1],
        ['0789_234_52._3_e3', 1],
        ['0789_234_52.3e3.3e2.', 1],
        ['4___2._3_', 1],
        ['4___2.__3_', 1],
        ['4___2._3__', 1],
        ['0x_0243F02F_34FA_a', 1],
        ['0x0243F02F_34FA_a_', 1],
        ['0b10230x1', 1],
        ['/*/', 1],
        ['/*/ ', 1],
        ['/*f/', 1],
        ['/**f/', 1],
        ['0xlk', 1],
        ['😀😀😀 3__4', 2],
        ['0b12', 1],
        ['0o78', 1],
        ['0o79', 1],
        ['0oA', 1],
        ['0bA', 1],
        ['03_.2', 1],
        ['03._2', 1],
        ['03.0__2', 1],
        ['03__3.0_2', 1],
        ['"string"', 1],
        ['5.3.2', 1],
        ['"😀"', 1],
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
        ['5e+', 1],
        ['5e3.6', 1],
        ['5e-', 1],
        ['0x', 1],
        ['0o', 1],
        ['0b', 1],
        ['0b123', 1],
        ['0o178', 1],
        ['0_.0e-0', 1],
        ['0_.e-0', 1],
        ['0.e-0', 1],
        ['0.0e-', 1],
        ['0.0e+', 1],
        ['0.0e', 1],
        ['0.e', 1],
        ['0.e0', 1],
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
}
