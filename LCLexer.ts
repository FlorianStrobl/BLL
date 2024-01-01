// compiler/interpreter frontend: scanner
export namespace Lexer {
  // #region valid lexemes signatures
  const keywords: string[] = [
    // statements:
    'use', // imports all identifiers from other file (either from the local files, or global file)
    'group', // identifier as wrapper around identifiers which helps readability
    'let', // binds a lambda term to an identifier and can be generic
    'type', // binds a type (alias or complex) to an identifier and can be generic

    // expressions:
    'func', // function expression
    'match', // expression to unwrap values of complex-types

    // types:
    'i32', // signed 32 bit integer using two's complement for decoding
    'f64', // single precision 32 bit float being conform to the IEEE754-2008 standard

    // literals:
    'inf', // infinity of type f64
    'nan' // not a number of type f64
  ];

  const symbols: string[] = [
    // arithmetic operators which work for floats and integers
    '+', // addition (unary or binary, i32/f64)
    '-', // subtraction (unary or binary, i32/f64)
    '*', // multiplication (binary, i32/f64)
    '/', // division (binary, f64/i32)
    // note for i32 division: crashes the program if the dividend is 0
    '**', // exponentiation (binary, i32/f64)

    // arithmetic, logical and shift operators which work on integers
    '!', // logical not (unary, i32)
    // note on its behaviour: !0 == 1, !nonzeroInteger ==  0
    '%', // remainder (binary, i32)
    '~', // not (unary, i32)
    '&', // and (binary, i32)
    '|', // or (binary, i32)
    '^', // xor (binary, i32)
    '<<', // logical left shift (binary, i32)
    '>>', // logical right shift (binary, i32)

    // compare
    '==', // equal (binary, i32/f64)
    '!=', // not equal (binary, i32/f64)
    '<=', // less than or equal (binary, i32/f64)
    '>=', // greater than or equal (binary, i32/f64)
    '<', // less than (binary, i32/f64)
    '>', // greater than (binary, i32/f64)

    // misc
    '=', // assigments of values to identifiers in let and type statements
    '->', // used for func signatures and for instantiating complex type values
    '=>', // used in func definitions and match expressions
    ':', // type annotation for let, func and match
    ';', // end of use, let or type-alias statement/empty statement
    ',', // seperator for arguments in funcs or calling funcs (with trailing commas too)
    '.', // accessing identifiers from groups

    '(', // grouping, func arguments/parameters/calls or complex type line
    ')',
    '{', // groups, complex type statements or match expressions
    '}',
    '[', // generic type annotations for let and type statements
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
    // whitespaces:
    ' ',
    '\t',
    '\n',
    '\r',
    '_',
    // A-Z:
    ...new Array(26).fill('').map((_, i) => String.fromCharCode(65 + i)),
    // a-z:
    ...new Array(26).fill('').map((_, i) => String.fromCharCode(97 + i)),
    // 0-9:
    ...new Array(10).fill('').map((_, i) => i.toString()),
    // symbols:
    ...'+-*/%&|^~=!><;:,.(){}[]'.split(''),
    // because of error messages:
    ...stringStarts
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
    // lexeme: raw character sequence in the src code, matching a token pattern
    l: string;
    t: tokenType;
    // index of the lexeme in the src code
    i: number;
  }

  export enum tokenType {
    keyword = 'k', // "let", "func"
    identifier = 'i', // "_a_z_A_Z_0_9"
    symbol = 's', // "+", "-", "*", "/", "==", "!=", "<", ">", "<=", ">=", ",", "(", ")", "{", "}", "=", "->", "."
    literal = 'l', // "5.3e-4", "0xFF00FF", "nan", "inf"
    comment = 'c' // "//...", "/*...*/"
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
        type: 'numeric literal part started with underscore';
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

  export type lexerError = { l: string; i: number } & (
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
  // checks if the string matches with the toMatch variable or one of its variants
  function matches(string: string, toMatch: string | string[]): boolean {
    return (
      string === toMatch || (Array.isArray(toMatch) && toMatch.includes(string))
    );
  }

  // checks if the character matches the given UTF-16 index ranges
  function matchRange(char: string, fromChar: string, toChar: string): boolean {
    return (
      fromChar.charCodeAt(0) <= char.charCodeAt(0) &&
      char.charCodeAt(0) <= toChar.charCodeAt(0)
    );
  }

  // checks if index is out of range
  function idxValid(index: number, array: { length: number }): boolean {
    // && index >= 0 && Number.isSafeInteger(index)
    return index < array.length;
  }
  // #endregion

  // #region consume functions
  // assert: an identifier is at idx
  function consumeWord(code: string, idx: number): nextToken {
    // increase the index to the maximum possible valid identifier length
    let endIdx: number = idx;
    while (
      idxValid(endIdx, code) &&
      (matchRange(code[endIdx], 'a', 'z') ||
        matchRange(code[endIdx], 'A', 'Z') ||
        matchRange(code[endIdx], '0', '9') ||
        matches(code[endIdx], '_'))
    )
      ++endIdx;

    const identifier: string = code.substring(idx, endIdx);

    // optimization: exclude most identifiers to be a keyword
    const canBeKeyword: boolean = firstCharOfKeywords.includes(code[idx]);
    return {
      type: 'token',
      value: {
        l: identifier,
        t:
          canBeKeyword && keywords.includes(identifier)
            ? identifier === 'nan' || identifier === 'inf'
              ? tokenType.literal
              : tokenType.keyword
            : tokenType.identifier,
        i: idx
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
    while (
      idx < potentialSymEndIdx &&
      !symbols.includes(code.substring(idx, potentialSymEndIdx))
    )
      --potentialSymEndIdx;

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
          l: biggestSubstr,
          i: idx,
          potentialOperators: symbols.filter((symbol) =>
            symbol.startsWith(biggestSubstr)
          )
        }
      };
    }

    return {
      type: 'token',
      value: {
        l: code.substring(idx, potentialSymEndIdx),
        t: tokenType.symbol,
        i: idx
      }
    };
  }

  // assertion: a numeric literal is at idx
  // TODO what about having an identifier directly behind the numeric literal?
  function consumeNumericLiteral(code: string, idx: number): nextToken {
    // if (!(idxValid(idx, code) && matchRange(code[idx], '0', '9')))
    //   throw new Error(
    //     'Internal lexer error: assertions for lexing a numeric literal where not met.'
    //   );

    const errors: numericLiteralError[] = [];
    let endIdx: number = idx;

    // lexe greedily all characters from the alphabet of the given type
    function maxDigitsIdx(
      startIdx: number,
      type: 'dec' | 'bin' | 'oct' | 'hex' = 'dec'
    ): number {
      if (!idxValid(startIdx, code))
        throw new Error(
          'Internal lexer error: did not met assertion for part of lexing numeric literal.'
        );

      let lastCharUnderscore: boolean = false;

      // cant start with underscores
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

      // can't end with underscore too
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
        // get the next digits
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
          const nextToken: nextToken | 'eof' = lexeNextToken(code, endIdx);

          if (
            nextToken === 'eof' ||
            (nextToken.type === 'token' &&
              nextToken.value.t !== tokenType.literal) ||
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
              l: code.substring(idx, endIdx) + nextToken.value.l,
              errors: [
                ...errors,
                // TODO idxs not as array
                {
                  type: 'had wrong alphabet in numeric literal',
                  startingFrom: endIdx
                },
                ...newErrors
              ],
              i: idx
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

      // consume all the following dots and Es even if consumed some already
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

            // "."
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

            // "e"
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
          l: code.substring(idx, endIdx),
          errors,
          i: idx
        }
      };

    return {
      type: 'token',
      value: {
        l: code.substring(idx, endIdx),
        t: tokenType.literal,
        i: idx
      }
    };
  }

  // assert: a comment is at idx
  function consumeComment(code: string, idx: number): nextToken {
    // if (
    //   !(idxValid(idx, code) && matches(code[idx], '/')) ||
    //   !(idxValid(idx + 1, code) && matches(code[idx + 1], ['*', '/']))
    // )
    //   throw new Error(
    //     'Internal lexer error: assertions for calling consumeComment where not met'
    //   );

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
          l: code.substring(idx, code.length),
          i: idx
        }
      };

    return {
      type: 'token',
      value: { l: code.substring(idx, i), t: tokenType.comment, i: idx }
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
        value: { type: 'eof in string', l: string, i: idx }
      };
    else if (escapeErrorIdxs.length !== 0)
      return {
        type: 'error',
        value: {
          type: 'used escape symbol not properly in string',
          l: string,
          i: idx,
          idxs: escapeErrorIdxs
        }
      };
    else if (escapeErrorU.length !== 0)
      return {
        type: 'error',
        value: {
          type: 'used escape symbol with \\u not properly in string',
          l: string,
          i: idx,
          idxs: escapeErrorU
        }
      };
    else if (invalidSymbolIdxs.length !== 0)
      return {
        type: 'error',
        value: {
          type: 'invalid character in string',
          l: string,
          i: idx,
          idxs: invalidSymbolIdxs
        }
      };

    return {
      type: 'error',
      value: { type: 'string used', l: string, i: idx }
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
    // must be checked before consumeSymbol() since `/` is also a symbol
    if (
      matches(code[idx], '/') &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], ['/', '*'])
    )
      return consumeComment(code, idx);

    // matches the beginning of a symbol
    if (matches(code[idx], firstCharOfSymbols)) return consumeSymbol(code, idx);

    // matches string start: lexe them for detailed error messages
    if (matches(code[idx], stringStarts)) return consumeString(code, idx);

    // the current char does not match any valid token start
    // return an error in this case

    // check for mistake
    if (idxValid(idx, code) && matches(code[idx], validChars))
      throw new Error(
        `Internal lexer error: should be able to lexe the current character: "${code[idx]}"`
      );

    // get all the invalid chars behind the current invalid char by its end index
    let endInvCharsIdx: number = idx;
    while (
      idxValid(endInvCharsIdx, code) &&
      !matches(code[endInvCharsIdx], validChars)
    )
      ++endInvCharsIdx;

    return {
      type: 'error',
      value: {
        type: 'invalid chars',
        l: code.substring(idx, endInvCharsIdx),
        i: idx
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
        idx !== (idx = nToken.value.i + nToken.value.l.length);
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
        lexerErrors: lexerError[];
        tokens: token[];
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
}
