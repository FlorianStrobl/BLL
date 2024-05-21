let logIt = false; // log certain steps of the interpreter
let logItSimple = false;

// #region Lexer
// compiler/interpreter frontend: scanner
(function (Lexer) {
  // #region valid lexemes signatures
  const keywords = [
    // statements:
    'use',
    'group',
    'let',
    'type',
    // expressions:
    'func',
    'match',
    // types:
    'i32',
    'f64',
    // literals:
    'inf',
    'nan' // not a number of type f64
  ];
  const symbols = [
    // arithmetic operators which work for floats and integers
    '+',
    '-',
    '*',
    '/',
    // note for i32 division: crashes the program if the dividend is 0
    '**',
    // arithmetic, logical and shift operators which work on integers
    '!',
    // note on its behaviour: !0 == 1, !nonzeroInteger ==  0
    '%',
    '~',
    '&',
    '|',
    '^',
    '<<',
    '>>',
    // compare
    '==',
    '!=',
    '<=',
    '>=',
    '<',
    '>',
    // misc
    '=',
    '->',
    '=>',
    ':',
    ';',
    ',',
    '.',
    '(',
    ')',
    '{',
    '}',
    '[',
    ']'
  ];
  const stringStarts = ["'", '"', '`'];
  const stringEscapeSymbol = '\\'; // only valid inside strings
  const escapableStringChars = ['\\', 'n', 't', 'r', 'u'];
  const hexDigits = [
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
  const validChars = [
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
  const maxSymbolLen = symbols.reduce((a, b) => (b.length > a ? b.length : a), 0);
  const firstCharOfKeywords = keywords
    .map((str) => str[0]) // get first char
    .filter((e, i, t) => t.indexOf(e) === i); // remove duplicates
  const firstCharOfSymbols = symbols
    .map((str) => str[0])
    .filter((e, i, t) => t.indexOf(e) === i);
  let tokenType;
  (function (tokenType) {
    tokenType["keyword"] = "k";
    tokenType["identifier"] = "i";
    tokenType["symbol"] = "s";
    tokenType["literal"] = "l";
    tokenType["comment"] = "c"; // "//...", "/*...*/"
  })(tokenType = Lexer.tokenType || (Lexer.tokenType = {}));
  // #endregion
  // #region helper functions
  // checks if the string matches with the toMatch variable or one of its variants
  function matches(string, toMatch) {
    return (string === toMatch || (Array.isArray(toMatch) && toMatch.includes(string)));
  }
  // checks if the character matches the given UTF-16 index ranges
  function matchRange(char, fromChar, toChar) {
    return (fromChar.charCodeAt(0) <= char.charCodeAt(0) &&
      char.charCodeAt(0) <= toChar.charCodeAt(0));
  }
  // checks if index is out of range
  function idxValid(index, array) {
    // && index >= 0 && Number.isSafeInteger(index)
    return index < array.length;
  }
  // #endregion
  // #region consume functions
  // assert: an identifier is at idx
  function consumeWord(code, idx) {
    // increase the index to the maximum possible valid identifier length
    let endIdx = idx;
    while (idxValid(endIdx, code) &&
      (matchRange(code[endIdx], 'a', 'z') ||
        matchRange(code[endIdx], 'A', 'Z') ||
        matchRange(code[endIdx], '0', '9') ||
        matches(code[endIdx], '_')))
      ++endIdx;
    const identifier = code.substring(idx, endIdx);
    // optimization: exclude most identifiers to be a keyword
    const canBeKeyword = firstCharOfKeywords.includes(code[idx]);
    return {
      type: 'token',
      value: {
        l: identifier,
        t: canBeKeyword && keywords.includes(identifier)
          ? identifier === 'nan' || identifier === 'inf'
            ? tokenType.literal
            : tokenType.keyword
          : tokenType.identifier,
        i: idx
      }
    };
  }
  // assert: an operator is at idx
  function consumeSymbol(code, idx) {
    // speed optimization because symbols are usually short:
    let potentialSymEndIdx = Math.min(idx + maxSymbolLen /*could be out of range => Math.min*/, code.length);
    // decrease the end index, until it makes up a valid symbol
    while (idx < potentialSymEndIdx &&
      !symbols.includes(code.substring(idx, potentialSymEndIdx)))
      --potentialSymEndIdx;
    // error: symbol in that form does not exist
    if (idx === potentialSymEndIdx) {
      // search for the biggest substring still matching with some symbol
      let biggestSubstr = '';
      for (let i = idx; idxValid(i, code) &&
        symbols.some((symbol) => symbol.startsWith(biggestSubstr + code[i])); biggestSubstr += code[i], ++i)
        ;
      return {
        type: 'error',
        value: {
          type: 'invalid operator',
          l: biggestSubstr,
          i: idx,
          potentialOperators: symbols.filter((symbol) => symbol.startsWith(biggestSubstr))
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
  function consumeNumericLiteral(code, idx) {
    // if (!(idxValid(idx, code) && matchRange(code[idx], '0', '9')))
    //   throw new Error(
    //     'Internal lexer error: assertions for lexing a numeric literal where not met.'
    //   );
    const errors = [];
    let endIdx = idx;
    // lexe greedily all characters from the alphabet of the given type
    function maxDigitsIdx(startIdx, type = 'dec') {
      if (!idxValid(startIdx, code))
        throw new Error('Internal lexer error: did not met assertion for part of lexing numeric literal.');
      let lastCharUnderscore = false;
      // cant start with underscores
      if (code[startIdx] === '_')
        errors.push({
          type: 'numeric literal part started with underscore',
          idx: startIdx
        });
      let endIdx = startIdx;
      for (; idxValid(endIdx, code) &&
        (code[endIdx] === '_' ||
          (type === 'dec'
            ? matchRange(code[endIdx], '0', '9')
            : type === 'bin'
              ? matchRange(code[endIdx], '0', '1')
              : type === 'oct'
                ? matchRange(code[endIdx], '0', '7')
                : matchRange(code[endIdx], '0', '9') ||
                matchRange(code[endIdx], 'a', 'f') ||
                matchRange(code[endIdx], 'A', 'F'))); ++endIdx) {
        // check for double underscores
        if (lastCharUnderscore && matches(code[endIdx], '_')) {
          const invalidIdxStart = endIdx;
          // get to the last underscore
          for (; idxValid(endIdx, code) && matches(code[endIdx], '_'); ++endIdx)
            ;
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
    if (matches(code[endIdx], '0') &&
      idxValid(endIdx + 1, code) &&
      matches(code[endIdx + 1], ['b', 'o', 'x'])) {
      // binary/octal/hex-number literal
      endIdx += 2; // the "0b"/"0o"/"0x"
      const literalType = code[endIdx - 1] === 'b'
        ? 'bin'
        : code[endIdx - 1] === 'o'
          ? 'oct'
          : 'hex';
      if (!idxValid(endIdx, code))
        errors.push({ type: 'unexpected eof in numeric literal' });
      else {
        // get the next digits
        const consumedSomething = endIdx !== (endIdx = maxDigitsIdx(endIdx, literalType));
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
          if (nextToken === 'eof' ||
            (nextToken.type === 'token' &&
              nextToken.value.t !== tokenType.literal) ||
            (nextToken.type === 'error' &&
              nextToken.value.type !== 'invalid numeric literal'))
            throw new Error('Internal lexer error: expected a numeric literal at current position.');
          const newErrors = nextToken.type === 'error' &&
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
    }
    else {
      // it must be a decimal literal
      // precomma part, cant eof because of assertion
      endIdx = maxDigitsIdx(idx, 'dec');
      let firstDotIdx = -1;
      let firstEIdx = -1;
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
            }
            else if (firstEIdx !== -1) {
              errors.push({
                type: 'already had "e" in numeric literal and got now a "."',
                firstE: firstEIdx,
                currentDot: endIdx
              });
            }
            else
              firstDotIdx = endIdx;
            // "."
            endIdx++;
            if (idxValid(endIdx, code)) {
              const consumedSomething = endIdx !== (endIdx = maxDigitsIdx(endIdx, 'dec'));
              if (!consumedSomething)
                errors.push({
                  type: 'did not consume digits in numeric literal',
                  idx: endIdx
                });
            }
            else
              errors.push({ type: 'unexpected eof in numeric literal' });
            break;
          case 'E':
          case 'e':
            if (firstEIdx !== -1) {
              errors.push({
                type: 'already had "e" in numeric literal',
                firstE: firstEIdx,
                currentE: endIdx
              });
            }
            else
              firstEIdx = endIdx;
            // "e"
            endIdx++;
            if (idxValid(endIdx, code)) {
              if (matches(code[endIdx], ['-', '+']))
                endIdx++;
              if (idxValid(endIdx, code)) {
                const consumedSomething = endIdx !== (endIdx = maxDigitsIdx(endIdx, 'dec'));
                if (!consumedSomething)
                  errors.push({
                    type: 'did not consume digits in numeric literal',
                    idx: endIdx
                  });
              }
              else
                errors.push({ type: 'unexpected eof in numeric literal' });
            }
            else
              errors.push({ type: 'unexpected eof in numeric literal' });
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
  function consumeComment(code, idx) {
    // if (
    //   !(idxValid(idx, code) && matches(code[idx], '/')) ||
    //   !(idxValid(idx + 1, code) && matches(code[idx + 1], ['*', '/']))
    // )
    //   throw new Error(
    //     'Internal lexer error: assertions for calling consumeComment where not met'
    //   );
    // two types: "/" and "*"
    const isType1 = code[idx + 1] === '/';
    // search for the end of the string, and save the index in i
    let reachedCommentTy2End = false;
    let i = idx + 2;
    out: for (; idxValid(i, code); ++i) {
      switch (isType1) {
        case true:
          if (matches(code[i], '\n'))
            break out;
          break;
        case false:
          // type 2 comment ends with "*/"
          if (matches(code[i], '*') &&
            idxValid(i + 1, code) &&
            matches(code[i + 1], '/')) {
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
  function consumeString(code, idx) {
    // TODO, what about \n in the middle of a string?
    let i = idx;
    let string = code[i++]; // " | ' | `
    const stringEnd = string;
    const toEscapeChars = [stringEnd, ...escapableStringChars];
    const invalidSymbolIdxs = [];
    const escapeErrorIdxs = [];
    const escapeErrorU = [];
    let lastCharWasEscape = false;
    while (idxValid(i, code)) {
      const char = code[i++];
      string += char;
      // TODO
      if (!validChars.includes(char))
        invalidSymbolIdxs.push(i - 1);
      if (!lastCharWasEscape && matches(char, stringEnd))
        break;
      else if (!lastCharWasEscape)
        lastCharWasEscape = matches(code[i], stringEscapeSymbol);
      else if (lastCharWasEscape) {
        lastCharWasEscape = false;
        if (!matches(char, toEscapeChars))
          escapeErrorIdxs.push(i);
        // for "\uFFFF" strings
        else if (matches(char, 'u'))
          if (idxValid(i + 3, code) &&
            code
              .slice(i, i + 4)
              .split('')
              .every((char) => matches(char, hexDigits)))
            string += code[i++] + code[i++] + code[i++] + code[i++];
          else
            escapeErrorU.push(i);
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
  function lexeNextToken(code, idx) {
    // skip whitespaces
    while (idxValid(idx, code) &&
      (code[idx] === ' ' ||
        code[idx] === '\t' ||
        code[idx] === '\n' ||
        code[idx] === '\r'))
      ++idx;
    // reached end of file
    if (!idxValid(idx, code))
      return 'eof';
    // check if the current char matches some valid token and consume it
    // matches beginning of an identifier, keyword, or float literal
    if (matchRange(code[idx], 'a', 'z') ||
      matchRange(code[idx], 'A', 'Z') ||
      matches(code[idx], '_'))
      return consumeWord(code, idx);
    // matches beginning of a numeric literal
    if (matchRange(code[idx], '0', '9'))
      return consumeNumericLiteral(code, idx);
    // matches the beginning of a comment
    // must be checked before consumeSymbol() since `/` is also a symbol
    if (matches(code[idx], '/') &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], ['/', '*']))
      return consumeComment(code, idx);
    // matches the beginning of a symbol
    if (matches(code[idx], firstCharOfSymbols))
      return consumeSymbol(code, idx);
    // matches string start: lexe them for detailed error messages
    if (matches(code[idx], stringStarts))
      return consumeString(code, idx);
    // the current char does not match any valid token start
    // return an error in this case
    // check for mistake
    if (idxValid(idx, code) && matches(code[idx], validChars))
      throw new Error(`Internal lexer error: should be able to lexe the current character: "${code[idx]}"`);
    // get all the invalid chars behind the current invalid char by its end index
    let endInvCharsIdx = idx;
    while (idxValid(endInvCharsIdx, code) &&
      !matches(code[endInvCharsIdx], validChars))
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
  function* lexeNextTokenIter(code) {
    let idx = 0;
    while (true) {
      const nToken = lexeNextToken(code, idx);
      if (nToken === 'eof')
        return;
      const gotNewIdx = idx !== (idx = nToken.value.i + nToken.value.l.length);
      if (!gotNewIdx)
        throw new Error('Internal lexer error: could not lexe the next token.');
      yield nToken;
    }
  }
  Lexer.lexeNextTokenIter = lexeNextTokenIter;
  function lexe(code) {
    const tokens = [];
    const lexerErrors = [];
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
  Lexer.lexe = lexe;
  // #endregion
})((Lexer = {}));
// #endregion

// #region Parser

// #region lexer code for parser
// can throw internal errors when assertions are not met
class Larser {
  code;
  lexer;
  skipComments;
  state;
  constructor(code, skipComments = false) {
    this.code = code;
    this.lexer = Lexer.lexeNextTokenIter(code);
    this.skipComments = skipComments;
    // just take the next token as usual
    this.state = { eof: false, currentToken: undefined };
    this.advanceToken();
    // check if an error happend
    if (this.state.eof === false && this.state.currentToken === undefined)
      throw new Error('Could not lexe the first token in larser.');
  }
  noComments() {
    return this.skipComments;
  }
  isEof() {
    return this.state.eof;
  }
  // assertion: not eof
  getCurrentToken() {
    if (this.state.eof === true)
      throw new Error('Internal error: assertion was not met in larser. Assumed that the state is not eof.');
    return this.state.currentToken;
  }
  // assertion: not eof
  advanceToken() {
    if (this.state.eof)
      throw new Error('Internal error: assertion was not met in larser. Assumed that the state is not eof.');
    // this.previousToken = this.currentToken;
    const { done: iteratorDone, value: iteratorValue } = this.lexer.next();
    if (!iteratorDone && iteratorValue.type === 'token')
      // @ts-ignore
      this.state.currentToken = iteratorValue.value;
    else if (iteratorDone)
      this.state = { eof: true };
    else
      this.errorHandling();
    // skip comments if wanted
    if (this.skipComments &&
      !this.state.eof &&
      this.getCurrentToken().t === Lexer.tokenType.comment)
      this.advanceToken();
  }
  errorHandling() {
    const tokens = Lexer.lexe(this.code);
    // internal error, since it previously said it would not be valid
    if (tokens.valid)
      throw new Error('Internal parser error: did not accept the valid tokens from the lexer: ' +
        JSON.stringify(tokens.tokens));
    throw new Error('Lexer can not lexe the code.');
  }
}
// #endregion
(function (Parser) {
  const parseErrors = [];
  let larser;
  Parser.tokenType = Lexer.tokenType;
  // #region helper
  // an error happend, store it in the error array and return error
  function newParseError(arg) {
    // cast arg to parseError type
    if (typeof arg === 'string')
      arg = {
        type: 'error',
        message: arg,
        value: arg,
        currentToken: !isAtEnd() ? peek() : undefined
      };
    parseErrors.push(arg);
    return arg;
  }
  // #region traditional helper functions
  function isAtEnd() {
    return larser.isEof();
  }
  // returns the current token
  // assertion: not eof
  function peek() {
    return larser.getCurrentToken();
  }
  // returns the current token and advances to the next token
  // assertion: not eof
  function advance() {
    const currentToken = peek();
    larser.advanceToken();
    return currentToken;
  }
  // check if the current token matches the tokens
  // assertion: not eof
  function match(tokens) {
    return (tokens === peek().l ||
      (Array.isArray(tokens) && tokens.includes(peek().l)));
  }
  // check if the current token type matches the tokenType
  // assertion: not eof
  function matchType(tokenType) {
    return tokenType === peek().t;
  }
  // #endregion
  // #region functional and advanced helper functions
  // checks if an unexpected eof happend, and throw an error if so
  function checkEofErr(errorOnEof) {
    if (!isAtEnd())
      return;
    newParseError(`Invalid eof while parsing code at [${errorOnEof}].`);
    throw 'eof'; // magic constant, dont change
  }
  // take the current comments, and put them in the comments array
  function consComments(comments) {
    while (!isAtEnd() && matchType(Parser.tokenType.comment))
      comments.push(advance());
  }
  // on match: advance
  function optMatchAdvance(token) {
    return match(token) ? advance() : undefined;
  }
  // on match: advace else error
  // assertion: not eof
  function matchAdvOrErr(token, error) {
    return match(token) ? advance() : newParseError(error);
  }
  // on match type: advance else error
  // assertion: not eof
  function matchTypeAdvanceOrError(tokenType, error) {
    return matchType(tokenType) ? advance() : newParseError(error);
  }
  function isPresent(value) {
    return value !== undefined;
  }
  // calls the callback function if and only if present is there
  function callOnPresent(present, callBack) {
    return isPresent(present) ? callBack() : undefined;
  }
  function parseArgumentList(parseArgument, // assertion: does not have delimiter as valid value
    endToken, delimiter, commentInfo, emptyList, noArgumentError, eofError) {
    const argumentList = [];
    let lastDelimiterToken = undefined;
    // needed in case of `parseComments=false`
    // since comments can come after the last delimiter token
    // or comments could come in empty argument lists
    let outerComments = [];
    if (commentInfo.parseComments)
      consComments(commentInfo.comments);
    else
      consComments(outerComments);
    while (!isAtEnd() && !match(endToken)) {
      // to check if anything was consumed and avoid endless loops
      const debugCurrentTokenIdx = peek().i;
      if (argumentList.length !== 0 && !isPresent(lastDelimiterToken))
        newParseError(delimiter.missingDelimiterError);
      if (commentInfo.parseComments)
        consComments(commentInfo.comments);
      checkEofErr(eofError);
      const argument = !match(delimiter.delimiterToken) /*better error message*/
        ? parseArgument()
        : newParseError(noArgumentError);
      if (commentInfo.parseComments)
        consComments(commentInfo.comments);
      else if (outerComments.length !== 0) {
        // comments consumed before executing this loop
        // they belong to the current argument
        if (typeof argument === 'object' && argument !== null) {
          if ('comments' in argument && Array.isArray(argument.comments))
            argument.comments.push(...outerComments);
          else
            newParseError(`Could not save local comments: "${JSON.stringify(outerComments)}"`);
        }
        else
          throw new Error('Internal parser error: unexpected type of argument while parsing an argument list.');
        outerComments = [];
        // this could be before the next delimiter token, so must get all the comments now
        consComments(outerComments);
      }
      checkEofErr(eofError);
      // update it to the new delimiter token for next iteration
      lastDelimiterToken = optMatchAdvance(delimiter.delimiterToken);
      argumentList.push({
        argument,
        delimiterToken: lastDelimiterToken
      });
      if (commentInfo.parseComments)
        consComments(commentInfo.comments);
      else
        consComments(outerComments); // save comments into outerComments, in case that after them comes the endToken
      if (!isAtEnd() && debugCurrentTokenIdx === peek().i) {
        // nothing has been consumed, so this code is in an endless loop
        newParseError(noArgumentError);
        break;
      }
    }
    // no consume comments needed, since next token must be endToken
    checkEofErr(eofError);
    if (emptyList.noEmptyList && argumentList.length === 0)
      newParseError(emptyList.errorMessage);
    if (commentInfo.parseComments === false && outerComments.length !== 0) {
      if (argumentList.length === 0)
        // outer comments belongs to the outer scope because there are no arguments
        commentInfo.globalComments.push(...outerComments);
      else {
        // comments belong to the very last argument
        const lastArgument = argumentList.at(-1).argument;
        if (typeof lastArgument === 'object' && lastArgument !== null) {
          if ('comments' in lastArgument &&
            Array.isArray(lastArgument.comments))
            lastArgument.comments.push(...outerComments);
          else
            newParseError(`Could not save local comments: "${JSON.stringify(outerComments)}"`);
        }
        else
          throw new Error('Internal parser error: unexpected type of argument while parsing an argument list.');
      }
    }
    return argumentList;
  }
  // #endregion
  // #endregion
  // #region parser
  // #region primary helper
  // #region for statements
  function parseComplexeTypeLine() {
    const comments = []; // local comments
    consComments(comments);
    checkEofErr('Eof while parsing a line in a complex-type-statement');
    const identifierToken = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Missing identifier in complex-type-statement line.');
    consComments(comments);
    checkEofErr('Eof while parsing a line of a complex-type-statement.');
    const openingBracketToken = optMatchAdvance('(');
    consComments(comments);
    checkEofErr('Eof in complex-type-statement body line after parsing a "(" token.');
    const parameterValues = callOnPresent(openingBracketToken, () => parseArgumentList(parseTypeExpression, ')', {
      delimiterToken: ',',
      missingDelimiterError: 'Missing "," token between parameters in complex-type-statement body line.'
    }, { parseComments: true, comments }, { noEmptyList: false }, 'Invalid value while parsing arguments for a complex-type-statement body line', 'Eof while parsing arguments for a complex-type-statement body line.')) ?? [];
    consComments(comments);
    checkEofErr('Eof while parsing a complex-type-statement.');
    const closingBracketToken = callOnPresent(openingBracketToken, () => matchAdvOrErr(')', 'Missing ")" token in complex-type-statement body line.'));
    // no consume comments for next line
    checkEofErr('Eof at the end of a complex-type-statement body line.');
    const parameters = isPresent(openingBracketToken) ||
      isPresent(closingBracketToken) ||
      parameterValues.length !== 0
      ? {
        hasBrackets: true,
        openingBracketToken: openingBracketToken,
        closingBracketToken: closingBracketToken
      }
      : { hasBrackets: false };
    return {
      identifierToken,
      arguments: parameterValues,
      ...parameters,
      comments
    };
  }
  function parseTypeExpLv0() {
    const comments = [];
    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');
    // arglists are needed for function types
    const left = parseTypeExprLv1();
    if (left.type === 'error')
      return left;
    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');
    if (match('->')) {
      // right-to-left precedence
      const arrowToken = advance();
      consComments(comments);
      checkEofErr('Eof while parsing a type expression.');
      const returnType = parseTypeExpLv0();
      // depending on being the temporary type arglist or an other type
      // the parameters are either a single type
      // or a group of types
      const parameters = left.type === 'arglist'
        ? left.body
        : [{ argument: left, delimiterToken: undefined }];
      const brackets = left.type === 'arglist'
        ? {
          hasBrackets: true,
          openingBracketToken: left.openingBracketToken,
          closingBracketToken: left.closingBracketToken
        }
        : { hasBrackets: false };
      return {
        type: 'func-type',
        parameters,
        returnType,
        ...brackets,
        arrowToken,
        comments
      };
    }
    left.comments.push(...comments);
    if (left.type !== 'arglist')
      return left;
    else if (left.body.length === 1 && !isPresent(left.body[0].delimiterToken))
      return {
        type: 'grouping',
        body: left.body[0].argument,
        openingBracketToken: left.openingBracketToken,
        closingBracketToken: left.closingBracketToken,
        comments: left.comments
      };
    else {
      // invalid arglist used
      if (left.body.length === 0)
        return newParseError('Empty brackets in type-expression are not allowed, if not used in a func-type.');
      else if (left.body.length === 1 && isPresent(left.body[0].delimiterToken))
        return newParseError('Invalid trailing comma in type-grouping-expression.');
      // (val.body.length > 1)
      else
        return newParseError('More than one type-expression in a group-expression are not allowed.');
    }
  }
  function parseTypeExprLv1() {
    const comments = [];
    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');
    let left = parsePrimaryTypeExpr();
    if (left.type === 'error')
      return left;
    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');
    while (match(['.', '['])) {
      if (left.type === 'arglist') {
        if (left.body.length === 1 && !isPresent(left.body[0].delimiterToken))
          left = {
            type: 'grouping',
            body: left.body[0].argument,
            openingBracketToken: left.openingBracketToken,
            closingBracketToken: left.closingBracketToken,
            comments: left.comments
          };
        else
          newParseError('Arg list in current function scope is not allowed.');
      }
      if (match('.')) {
        const dotToken = advance();
        consComments(comments);
        checkEofErr('Eof while parsing a type-expression.');
        const propertyToken = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Must have an identifier as property token in a type-expression.');
        consComments(comments);
        checkEofErr('Eof while parsing a type-expression.');
        left = {
          type: 'propertyAccess',
          source: left,
          propertyToken,
          dotToken,
          comments
        };
      }
      else {
        // must be '['
        const openingBracketToken = advance();
        consComments(comments);
        checkEofErr('Eof while parsing a type-expression.');
        const substitutions = parseArgumentList(parseTypeExpression, ']', {
          delimiterToken: ',',
          missingDelimiterError: 'Missing "," token in generic-type-substitution of a type-expression.'
        }, { parseComments: true, comments }, {
          noEmptyList: true,
          errorMessage: 'Type substition of type-expressions need at least one argument.'
        }, 'Invalid argument in generic-type-substitution of type-expression.', 'Eof while parsing a type-expression.');
        const closingBracketToken = matchAdvOrErr(']', 'Missing "]" token in type-expression of generic-type-subsitution.');
        consComments(comments);
        checkEofErr('Eof while parsing a type-expression.');
        left = {
          type: 'genericSubstitution',
          expr: left,
          substitutions,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }
    }
    return left;
  }
  function parsePrimaryTypeExpr() {
    const comments = [];
    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');
    if (match('i32') || match('f64')) {
      return {
        type: 'primitive-type',
        primitiveToken: advance(),
        comments
      };
    }
    else if (matchType(Parser.tokenType.identifier)) {
      const identifierToken = advance();
      consComments(comments);
      checkEofErr('Eof while parsing a type-expression.');
      return {
        type: 'identifier',
        identifier: identifierToken.l,
        identifierToken,
        comments
      };
    }
    else if (match('(')) {
      const openingBracketToken = advance();
      consComments(comments);
      checkEofErr('Eof while parsing a type-expression.');
      const body = parseArgumentList(parseTypeExpression, ')', {
        delimiterToken: ',',
        missingDelimiterError: 'Missing "," token while parsing an argument list in a type-expression.'
      }, { parseComments: true, comments }, { noEmptyList: false }, 'Invalid value for grouping expression or argument list: expected a type but got something else.', 'Eof while parsing an argument list in type-expression.');
      consComments(comments);
      checkEofErr('Eof while parsing a type-expression.');
      const closingBracketToken = matchAdvOrErr(')', 'Missing ")" token in type-expression.');
      // could be just a grouping of an expression
      // or is an (empty or full) argument list for a function type
      return {
        type: 'arglist',
        body,
        openingBracketToken,
        closingBracketToken,
        comments
      };
    }
    return newParseError('Could not match any type-expression.');
  }
  // #endregion
  // #region for expression
  const precedenceTable = [
    { symbols: '|', arity: 'binary', associativity: 'left-to-right' },
    { symbols: '^', arity: 'binary', associativity: 'left-to-right' },
    { symbols: '&', arity: 'binary', associativity: 'left-to-right' },
    {
      symbols: ['==', '!='],
      arity: 'binary',
      associativity: 'left-to-right'
    },
    {
      symbols: ['<', '>', '<=', '>='],
      arity: 'binary',
      associativity: 'left-to-right'
    },
    {
      symbols: ['<<', '>>'],
      arity: 'binary',
      associativity: 'left-to-right'
    },
    {
      symbols: ['-', '+'],
      arity: 'binary',
      associativity: 'left-to-right'
    },
    {
      symbols: ['*', '/', '%'],
      arity: 'binary',
      associativity: 'left-to-right'
    },
    {
      symbols: '**',
      arity: 'binary',
      associativity: 'right-to-left'
    },
    {
      symbols: ['!', '-', '+', '~'],
      arity: 'unary',
      associativity: 'unary'
    }
  ];
  // parse an expression level, given the next inner level of precedence
  function parseExprLvl(symbols, arity, associativity, nextLevel) {
    const comments = [];
    consComments(comments);
    checkEofErr('Eof while parsing an expression.');
    if (arity === 'unary') {
      // skip if not needed
      if (!match(symbols))
        return nextLevel();
      const operatorToken = advance();
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      // parse same level as body
      const body = parseExprLvl(symbols, arity, associativity, nextLevel);
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      return {
        type: 'unary',
        operator: operatorToken.l,
        body,
        operatorToken,
        comments
      };
    }
    else if (arity === 'binary') {
      if (associativity !== 'left-to-right' &&
        associativity !== 'right-to-left')
        throw new Error('Internal parser error: invalid use of TypeScripts type system.');
      let leftSide = nextLevel();
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      if (associativity === 'left-to-right') {
        while (match(symbols)) {
          const operatorToken = advance();
          consComments(comments);
          checkEofErr('Eof while parsing an expression.');
          const rightSide = nextLevel();
          consComments(comments);
          checkEofErr('Eof while parsing an expression.');
          leftSide = {
            type: 'binary',
            operator: operatorToken.l,
            leftSide,
            rightSide,
            operatorToken,
            comments
          };
        }
      }
      else if (associativity === 'right-to-left') {
        if (match(symbols)) {
          const operatorToken = advance();
          consComments(comments);
          checkEofErr('Eof while parsing an expression.');
          // same level because of associativity
          const rightSide = parseExprLvl(symbols, arity, associativity, nextLevel);
          consComments(comments);
          checkEofErr('Eof while parsing an expression.');
          return {
            type: 'binary',
            operator: operatorToken.l,
            leftSide,
            rightSide,
            operatorToken,
            comments
          };
        }
      }
      return leftSide;
    }
    throw new Error('Internal parser error: invalid use of TypeScripts type system.');
  }
  function parseExprLv10() {
    const comments = [];
    consComments(comments);
    checkEofErr('Eof while parsing an expression.');
    let left = parsePrimaryExprLv();
    consComments(comments);
    checkEofErr('Eof while parsing an expression.');
    while (match(['(', '.', '->'])) {
      if (peek().l === '.' || peek().l === '->') {
        // left-to-right precedence
        const token = advance();
        consComments(comments);
        checkEofErr('Eof while parsing an expression.');
        const propertyToken = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'The expression property-access needs a property of type identifier.');
        consComments(comments);
        checkEofErr('Eof while parsing an expression.');
        if (token.l === '.')
          left = {
            type: 'propertyAccess',
            source: left,
            propertyToken,
            dotToken: token,
            comments
          };
        else {
          left = {
            type: 'typeInstantiation',
            source: left,
            typeLineToken: propertyToken,
            arrowToken: token,
            comments
          };
        }
      }
      else if (peek().l === '(') {
        const openingBracketToken = advance();
        consComments(comments);
        checkEofErr('Eof while parsing an expression.');
        const args = parseArgumentList(parseExpression, ')', {
          delimiterToken: ',',
          missingDelimiterError: 'Missing "," token in expression function call argument list.'
        }, { parseComments: true, comments }, { noEmptyList: false }, 'Invalid type-expression in function call argument list.', 'Eof while parsing the expression function call argument list.');
        consComments(comments);
        checkEofErr('Eof while parsing a function call expression.');
        const closingBracketToken = matchAdvOrErr(')', 'Missing ")" token in expression function call.');
        consComments(comments);
        checkEofErr('Eof while parsing an expression.');
        left = {
          type: 'call',
          function: left,
          arguments: args,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }
      else
        throw new Error(`Internal parser error: expected the tokens "(", "." or "->" in expression.`);
    }
    return left;
  }
  // highest precedence level
  function parsePrimaryExprLv() {
    const comments = [];
    consComments(comments);
    checkEofErr('Eof while parsing an expression.');
    if (match('(')) {
      const openingBracketToken = advance();
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      const body = !match(')') // better error message
        ? parseExpression()
        : newParseError('Missing body in grouping expression.');
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      const closingBracketToken = matchAdvOrErr(')', 'Missing ")" token in grouping expression.');
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      return {
        type: 'grouping',
        body,
        openingBracketToken,
        closingBracketToken,
        comments
      };
    }
    else if (matchType(Parser.tokenType.literal)) {
      const literalToken = advance();
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      const lexeme = literalToken.l;
      const literalType = lexeme.includes('.') ||
        (!lexeme.startsWith('0x') && lexeme.includes('e')) ||
        lexeme === 'inf' ||
        lexeme === 'nan'
        ? 'f64'
        : 'i32';
      return {
        type: 'literal',
        literalType,
        literalToken,
        comments
      };
    }
    else if (matchType(Parser.tokenType.identifier)) {
      const identifierToken = advance();
      consComments(comments);
      checkEofErr('Eof while parsing an expression.');
      return {
        type: 'identifier',
        identifier: identifierToken.l,
        identifierToken,
        comments
      };
    }
    else if (match('func'))
      return parseFuncExpression();
    else if (match('match'))
      return parseMatchExpression();
    return newParseError('Could not match any expression.');
  }
  function parseFuncExprParams(lastHadDefaultVal, comments) {
    const identifierToken = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Missing identifier in function expression.');
    consComments(comments);
    checkEofErr('Eof while parsing arguments of a function expression.');
    const colonToken = optMatchAdvance(':');
    consComments(comments);
    checkEofErr('Eof while parsing arguments of a function expression.');
    const typeExpression = callOnPresent(colonToken, () => !match('=') && !match(',') // better error message
      ? parseTypeExpression()
      : newParseError(`Missing type annotation after parsing ":" token in function arguments for a function expression.`));
    consComments(comments);
    checkEofErr('Eof while parsing arguments of a function expression.');
    const defaultValEqToken = optMatchAdvance('=');
    if (lastHadDefaultVal.had && !isPresent(defaultValEqToken))
      newParseError('Parameters with default values in function expressions can not be followed by other parameteres without default values.');
    if (isPresent(defaultValEqToken))
      lastHadDefaultVal.had = true;
    callOnPresent(defaultValEqToken, () => {
      consComments(comments);
      checkEofErr('Eof while parsing arguments of a function expression.');
    });
    const value = callOnPresent(defaultValEqToken, () => !match(',') // better error message
      ? parseExpression()
      : newParseError(`Missing expression after parsing "=" token in function parameter expression.`));
    const typeAnnotation = isPresent(colonToken) || isPresent(typeExpression)
      ? {
        hasExplicitType: true,
        typeExpression: typeExpression,
        colonToken: colonToken
      }
      : { hasExplicitType: false };
    const defaultValue = isPresent(defaultValEqToken) || isPresent(value)
      ? {
        hasDefaultValue: true,
        defaultValue: value,
        defaultValueEqualsToken: defaultValEqToken
      }
      : { hasDefaultValue: false };
    return {
      identifierToken,
      ...typeAnnotation,
      ...defaultValue
    };
  }
  // assert: func token at current point
  function parseFuncExpression() {
    const comments = [];
    const funcToken = advance();
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const openingBracketToken = matchAdvOrErr('(', 'Missing "(" token in function expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const lastHadDefaultVal = { had: false };
    const params = parseArgumentList(() => parseFuncExprParams(lastHadDefaultVal, comments), ')', {
      delimiterToken: ',',
      missingDelimiterError: 'Missing "," token in argument list of a function expression.'
    }, { parseComments: true, comments }, { noEmptyList: false }, 'Missing function argument in function expression.', 'Eof while parsing function arguments in a function expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const closingBracketToken = matchAdvOrErr(')', 'Missing ")" token in function expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const colonToken = optMatchAdvance(':');
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const typeExpression = callOnPresent(colonToken, () => !match('=>') // better error message
      ? parseTypeExpression()
      : newParseError(`Missing type-expression after parsing a ":" token for a return type annotation of a function expression.`));
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const arrowToken = matchAdvOrErr('=>', 'Missing "=>" token in a function expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const body = parseExpression();
    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');
    const returnType = isPresent(colonToken) || isPresent(typeExpression)
      ? {
        hasExplicitType: true,
        typeExpression: typeExpression,
        colonToken: colonToken
      }
      : {
        hasExplicitType: false
      };
    return {
      type: 'func',
      parameters: params,
      body,
      ...returnType,
      funcToken,
      openingBracketToken,
      closingBracketToken,
      arrowToken,
      comments
    };
  }
  function parseMatchBodyLine(hadDefaultLine) {
    const comments = [];
    consComments(comments);
    checkEofErr('Eof while parsing a match body line expression.');
    // optional, because of default value
    const identifierToken = matchType(Parser.tokenType.identifier)
      ? advance()
      : undefined;
    if (hadDefaultLine.had && !isPresent(identifierToken))
      newParseError('Can not have two default value lines in a match body line expression.');
    else if (hadDefaultLine.had)
      newParseError('Can not have a default match body line, followed by another match body line.');
    if (!isPresent(identifierToken))
      hadDefaultLine.had = true;
    consComments(comments);
    checkEofErr('Eof while parsing a match body line expression.');
    const openingBracketToken = callOnPresent(identifierToken, () => optMatchAdvance('('));
    consComments(comments);
    checkEofErr('Eof while parsing a match body line expression.');
    const params = callOnPresent(identifierToken, () => callOnPresent(openingBracketToken, () => parseArgumentList(() => matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Expected identifier in match body line expression.'), ')', {
      delimiterToken: ',',
      missingDelimiterError: 'Missing "," token in match body line expression.'
    }, { parseComments: true, comments }, { noEmptyList: false }, 'Only identifiers are allowed in match body line expressions.', 'Eof while parsing a match body line expression arguments.')));
    consComments(comments);
    checkEofErr('Eof while parsing arguments of a match expression.');
    const closingBracketToken = callOnPresent(identifierToken, () => callOnPresent(openingBracketToken, () => matchAdvOrErr(')', 'Missing ")" token in match body line.')));
    consComments(comments);
    checkEofErr('Eof while parsing arguments of a match expression.');
    const arrowToken = matchAdvOrErr('=>', 'Missing "=>" token in match expression.');
    consComments(comments);
    checkEofErr('Eof while parsing arguments of a match expression.');
    const body = !match(',') // better error message
      ? parseExpression()
      : newParseError('Missing body in match expression line.');
    const brackets = isPresent(openingBracketToken) || isPresent(closingBracketToken)
      ? {
        hasBrackets: true,
        openingBracketToken: openingBracketToken,
        closingBracketToken: closingBracketToken
      }
      : {
        hasBrackets: false
      };
    const identifierOrDefault = isPresent(identifierToken)
      ? {
        isDefaultVal: false,
        identifierToken,
        parameters: params ?? [],
        ...brackets
      }
      : { isDefaultVal: true };
    return {
      ...identifierOrDefault,
      body,
      arrowToken,
      comments
    };
  }
  // assert: match token at current point
  function parseMatchExpression() {
    const comments = [];
    const matchToken = advance();
    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');
    const argOpeningBracketToken = matchAdvOrErr('(', 'Missing "(" token in match expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');
    const scrutinee = !match(')') // better error message
      ? parseExpression()
      : newParseError('Missing body of argument in a match expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');
    const argClosingBracketToken = matchAdvOrErr(')', 'Missing ")" for scrutinee in match expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');
    const colonToken = optMatchAdvance(':');
    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');
    const typeAnnotation = callOnPresent(colonToken, () => !match('{') // better error message
      ? parseTypeExpression()
      : newParseError('Missing type expression in match expression with ":" annotation.'));
    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');
    const bodyOpeningBracketToken = matchAdvOrErr('{', 'Missing "{" token in match expression.');
    // no consumeComments for better local comments
    checkEofErr('Eof while parsing a match expression.');
    const hadDefaultLine = { had: false };
    const body = parseArgumentList(() => parseMatchBodyLine(hadDefaultLine), '}', {
      delimiterToken: ',',
      missingDelimiterError: 'Missing "," token in match expression.'
    }, { parseComments: false, globalComments: comments }, {
      // TODO empty match body allowed for empty complex types?
      noEmptyList: true,
      errorMessage: 'Match expressions with empty bodys are not allowed.'
    }, 'Invalid value in match expression line. The must be structure "id(arg1, arg2, argN) => expr,"', 'Eof while parsing a match expression.');
    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');
    const bodyClosingBracketToken = matchAdvOrErr('}', 'Missing "}" token in match expression.');
    const explicitType = isPresent(colonToken) || isPresent(typeAnnotation)
      ? {
        hasExplicitType: true,
        typeExpression: typeAnnotation,
        colonToken: colonToken
      }
      : { hasExplicitType: false };
    return {
      type: 'match',
      scrutinee,
      body,
      ...explicitType,
      matchToken,
      argOpeningBracketToken,
      argClosingBracketToken,
      bodyOpeningBracketToken,
      bodyClosingBracketToken,
      comments
    };
  }
  // #region first expr levels
  // unrolled because of performance
  const parseExprLv0 = () => parseExprLvl(precedenceTable[0].symbols, precedenceTable[0].arity, precedenceTable[0].associativity, parseExprLv1);
  const parseExprLv1 = () => parseExprLvl(precedenceTable[1].symbols, precedenceTable[1].arity, precedenceTable[1].associativity, parseExprLv2);
  const parseExprLv2 = () => parseExprLvl(precedenceTable[2].symbols, precedenceTable[2].arity, precedenceTable[2].associativity, parseExprLv3);
  const parseExprLv3 = () => parseExprLvl(precedenceTable[3].symbols, precedenceTable[3].arity, precedenceTable[3].associativity, parseExprLv4);
  const parseExprLv4 = () => parseExprLvl(precedenceTable[4].symbols, precedenceTable[4].arity, precedenceTable[4].associativity, parseExprLv5);
  const parseExprLv5 = () => parseExprLvl(precedenceTable[5].symbols, precedenceTable[5].arity, precedenceTable[5].associativity, parseExprLv6);
  const parseExprLv6 = () => parseExprLvl(precedenceTable[6].symbols, precedenceTable[6].arity, precedenceTable[6].associativity, parseExprLv7);
  const parseExprLv7 = () => parseExprLvl(precedenceTable[7].symbols, precedenceTable[7].arity, precedenceTable[7].associativity, parseExprLv8);
  const parseExprLv8 = () => parseExprLvl(precedenceTable[8].symbols, precedenceTable[8].arity, precedenceTable[8].associativity, parseExprLv9);
  const parseExprLv9 = () => parseExprLvl(precedenceTable[9].symbols, precedenceTable[9].arity, precedenceTable[9].associativity, parseExprLv10);
  // #endregion
  // #endregion
  // #endregion
  // assert: not eof
  function parseStatement() {
    if (isAtEnd())
      throw new Error('Internal parser error: assertion not met. Code is eof but tried to parse a statement.');
    const comments = [];
    consComments(comments);
    if (isAtEnd() && comments.length !== 0)
      return { type: 'comment', comments };
    // use those comments for the next statement if not at end
    // and if nothing matches (no next statement), return these at the end
    // check if current token matches some statements signature
    if (match('let')) {
      const letToken = advance();
      consComments(comments);
      checkEofErr('Eof in let-statement.');
      const identifierToken = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Missing identifier in let-statement.');
      consComments(comments);
      checkEofErr('Eof in let statement, after parsing the identifier.');
      const genericOpeningBracketToken = optMatchAdvance('[');
      consComments(comments);
      checkEofErr('Eof after getting opening bracket for generic in let statement.');
      const genericIdentifiers = callOnPresent(genericOpeningBracketToken, () => parseArgumentList(() => matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Did not match an identifier in generic let-statement.'), ']', {
        delimiterToken: ',',
        missingDelimiterError: 'Missing "," token in generic let-statement declaration.'
      }, { parseComments: true, comments }, {
        noEmptyList: true,
        errorMessage: 'Must have identifiers in generic let-statement list.'
      }, 'Missing identifier in generic let-statement.', 'Unexpected eof in generic let-statement before parsing "]".'));
      consComments(comments);
      checkEofErr('Eof in generic let-statement.');
      const genericClosingBracketToken = callOnPresent(genericOpeningBracketToken, () => matchAdvOrErr(']', 'Missing closing bracket in generic let-statement declaration.'));
      consComments(comments);
      checkEofErr('Eof after parsing "]" in generic let-statement.');
      const colonToken = optMatchAdvance(':');
      consComments(comments);
      checkEofErr('Eof in let-statement after parsing ":".');
      const typeAnnotation = callOnPresent(colonToken, () => !match('=') // better error message
        ? parseTypeExpression()
        : newParseError('Missing type annotation in let-statement after parsing ":".'));
      consComments(comments);
      checkEofErr('Eof in let-statement. Expecting a "=" lexeme.');
      const equalsToken = matchAdvOrErr('=', 'Missing "=" token in let-statement.');
      consComments(comments);
      checkEofErr('Eof in let-statement after parsing an "=" token.');
      const body = !match(';') // better error message
        ? parseExpression()
        : newParseError('Missing main body in let-expression.');
      consComments(comments);
      checkEofErr('Eof in let-statement.');
      const semicolonToken = matchAdvOrErr(';', 'Let-statements must be finished by a semicolon.');
      const explicitType = isPresent(colonToken) || isPresent(typeAnnotation)
        ? {
          hasExplicitType: true,
          typeExpression: typeAnnotation,
          colonToken: colonToken
        }
        : {
          hasExplicitType: false
        };
      const genericAnnotation = isPresent(genericOpeningBracketToken) ||
        isPresent(genericClosingBracketToken) ||
        isPresent(genericIdentifiers)
        ? {
          isGeneric: true,
          genericIdentifiers: genericIdentifiers,
          genericOpeningBracketToken: genericOpeningBracketToken,
          genericClosingBracketToken: genericClosingBracketToken
        }
        : { isGeneric: false };
      return {
        type: 'let',
        name: identifierToken.l,
        body,
        ...genericAnnotation,
        ...explicitType,
        letToken,
        identifierToken,
        equalsToken,
        semicolonToken,
        comments
      };
    }
    if (match('type')) {
      const typeToken = advance();
      consComments(comments);
      checkEofErr('Eof in type-statement.');
      const identifierToken = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Missing identifier in type-statement.');
      consComments(comments);
      checkEofErr('Eof after parsing an identifier token for a type-statement.');
      const genericOpeningBracketToken = optMatchAdvance('[');
      consComments(comments);
      checkEofErr('Eof after parsing "[" in type-statement.');
      const genericIdentifiers = callOnPresent(genericOpeningBracketToken, () => parseArgumentList(() => matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Invalid token in generic type-statement.'), ']', {
        delimiterToken: ',',
        missingDelimiterError: 'Missing "," token in generic type-statement.'
      }, { parseComments: true, comments }, {
        noEmptyList: true,
        errorMessage: 'Must have identifiers in generic type-statement list'
      }, 'Invalid token in generic type-statement.', 'Eof in generic type-statement.'));
      consComments(comments);
      checkEofErr('Eof while parsing a type-statement.');
      const genericClosingBracketToken = callOnPresent(genericOpeningBracketToken, () => matchAdvOrErr(']', 'Missing closing bracket in generic type-statement.'));
      consComments(comments);
      checkEofErr('Eof while parsing a type-statement.');
      const generic = isPresent(genericOpeningBracketToken) ||
        isPresent(genericClosingBracketToken) ||
        isPresent(genericIdentifiers)
        ? {
          isGeneric: true,
          genericIdentifiers: genericIdentifiers,
          genericOpeningBracketToken: genericOpeningBracketToken,
          genericClosingBracketToken: genericClosingBracketToken
        }
        : { isGeneric: false };
      if (match('=')) {
        const equalsToken = advance();
        consComments(comments);
        checkEofErr('Eof in type-alias-statement after "=" token.');
        const body = !match(';') // better error message
          ? parseTypeExpression()
          : newParseError('Missing type-expression in type-alias-statement.');
        consComments(comments);
        checkEofErr('Eof in type-statement.');
        const semicolonToken = matchAdvOrErr(';', 'Eof in type-statement.');
        return {
          type: 'type-alias',
          name: identifierToken.l,
          body,
          ...generic,
          typeToken,
          identifierToken,
          equalsToken,
          semicolonToken,
          comments
        };
      }
      if (match('{')) {
        const openingBracketToken = advance();
        // no consumeComments for better local comments
        checkEofErr('Eof after parsing "{" token in complex-type-statement.');
        const body = parseArgumentList(parseComplexeTypeLine, '}', {
          delimiterToken: ',',
          missingDelimiterError: 'Missing "," token in complex-type-statement body.'
        }, { parseComments: false, globalComments: comments }, { noEmptyList: false }, 'Invalid or missing argument in complex-type body.', 'Eof inside complex-type-statement.');
        consComments(comments);
        checkEofErr('Eof in complex-type-statement.');
        const closingBracketToken = matchAdvOrErr('}', 'Missing "}" token in complex-type-statement.');
        return {
          type: 'complex-type',
          name: identifierToken.l,
          body,
          ...generic,
          typeToken,
          identifierToken,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }
      return newParseError('Invalid type-statement: cannot resolve which type it should be. Missing "=" or "{" tokens.');
    }
    if (match('group')) {
      const groupToken = advance();
      consComments(comments);
      checkEofErr('Eof in group-statement.');
      const identifierToken = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Missing identifier in group-statement.');
      consComments(comments);
      checkEofErr('Eof group-statement after parsing an identifier.');
      const openingBracketToken = matchAdvOrErr('{', 'Missing "{" token in group-statement.');
      // no consume comments or eof check for better local comments
      const body = [];
      while (!isAtEnd() && !match('}')) {
        const statement = parseStatement();
        if (statement.type === 'error')
          break; // handled somewhere else
        if (statement.type === 'import')
          newParseError('Use-statements must be outside of a group-statement.');
        body.push(statement);
      }
      checkEofErr('Eof in group-statement before parsing a "}".');
      const closingBracketToken = matchAdvOrErr('}', 'Missing "}" in group-statement.');
      return {
        type: 'group',
        name: identifierToken.l,
        body,
        groupToken,
        identifierToken,
        openingBracketToken,
        closingBracketToken,
        comments
      };
    }
    if (match('use')) {
      const useToken = advance();
      consComments(comments);
      checkEofErr('Eof in use-statement.');
      const filename = matchTypeAdvanceOrError(Parser.tokenType.identifier, 'Missing identifier in use-statement.');
      consComments(comments);
      checkEofErr('Eof in use-statement before parsing a ";" token.');
      const semicolonToken = matchAdvOrErr(';', 'Missing ";" token in use-statement.');
      return {
        type: 'import',
        filename,
        useToken,
        semicolonToken,
        comments
      };
    }
    if (match(';'))
      return { type: 'empty', semicolonToken: advance(), comments };
    if (comments.length !== 0)
      // consumed comments above and no other thing matched
      // probably this case: group g { /*comment*/ }
      return { type: 'comment', comments };
    return newParseError('Parser could not match any statement.');
  }
  function parseExpression() {
    return parseExprLv0();
  }
  // TYPE -> TYPE // func
  // ( ) -> TYPE // func, empty grouping: must be arg list
  // ( TYPE { , TYPE }*  { , }? ) -> TYPE // func
  function parseTypeExpression() {
    return parseTypeExpLv0();
  }
  // #endregion
  function parse(code, comments = { ignoreComments: false }) {
    parseErrors.splice(0, parseErrors.length); // remove all previous elements
    larser = new Larser(code, comments.ignoreComments); // can throw an error at this point
    const statements = [];
    while (!isAtEnd()) {
      try {
        const statement = parseStatement();
        if (statement.type === 'error')
          break; // stop parsing then
        statements.push(statement);
      }
      catch (error) {
        if (error === 'eof')
          return { valid: false, parseErrors, statements };
        else
          throw new Error(`Error while parsing.\nInternal parsing error: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      }
    }
    return parseErrors.length === 0
      ? { valid: true, statements }
      : { valid: false, parseErrors, statements };
  }
  Parser.parse = parse;
})((Parser = {}));
// #endregion

// #region ProcessAST
(function (ProcessAST) {
  // #region constants and types
  const processingErrors = [];
  // #endregion
  // #region processors
  function newProcessingError(processingError) {
    processingErrors.push(processingError);
    return processingError;
  }
  // remove all the groupings and save the important statements into the datastructure
  function buildHashMap(ast, currentScope) {
    const processedAST = {
      imports: [],
      letDict: {},
      typeDict: {},
      namespaceScopes: []
    };
    // a list of all the namespaces in this scope
    // having twice the same namespace name will yield an error msg
    for (let statement of ast) {
      switch (statement.type) {
        case 'comment':
        case 'empty':
          // skip
          break;
        case 'import':
          processedAST.imports.push([statement.filename.l, statement]);
          break;
        case 'let':
          const letName = currentScope + statement.name;
          if (letName in processedAST.letDict ||
            processedAST.namespaceScopes.some(([name, stmt]) => name === letName))
            newProcessingError(`The let-identifier ${letName} is already defined in this scope.`);
          processedAST.letDict[letName] = statement;
          break;
        case 'type-alias':
        case 'complex-type':
          const typeName = currentScope + statement.name;
          if (typeName in processedAST.typeDict ||
            processedAST.namespaceScopes.some(([name, stmt]) => name === typeName))
            newProcessingError(`The type-identifier ${typeName} is already defined in this scope.`);
          processedAST.typeDict[typeName] = statement;
          break;
        case 'group':
          const groupName = currentScope + statement.name;
          // group name cannot be the filename or name of imported file,
          // this gets handled at a later stage
          if (processedAST.namespaceScopes.some(([name, stmt]) => name === groupName) ||
            groupName in processedAST.letDict ||
            groupName in processedAST.typeDict)
            newProcessingError(`The namespace ${groupName} already exists in this scope in the form of another group, a let- or a type-statement.`);
          else
            processedAST.namespaceScopes.push([groupName, statement]);
          const data = buildHashMap(statement.body, groupName + `/`);
          if (data.imports.length !== 0)
            throw new Error('Internal processing error: imports in namespaces are not allowed and should have been prohibited by the parser already.');
          processedAST.namespaceScopes.push(...data.namespaceScopes);
          for (const [letName, value] of Object.entries(data.letDict))
            if (letName in processedAST.letDict ||
              processedAST.namespaceScopes.some(([name, stmt]) => name === letName))
              newProcessingError(`The let-statement "${letName}" already existed in form of another let- or group-statement.`);
            else
              processedAST.letDict[letName] = value;
          for (const [typeName, value] of Object.entries(data.typeDict))
            if (typeName in processedAST.typeDict ||
              processedAST.namespaceScopes.some(([name, stmt]) => name === typeName))
              newProcessingError(`The type statement ${typeName} already exists in another type- or group-statement`);
            else
              processedAST.typeDict[typeName] = value;
          break;
      }
    }
    return processedAST;
  }
  // replace all the identifiers by the global path
  // or remains unchanged because it is local to generics
  function resolveIdentifiers(data, filename) {
    const importFilenames = data.imports.map(([name, stmt]) => name);
    // if "use std;" then "std.test => /std/test"
    // because we assume "test" exists in "std" is there
    // while "thisFilename.test => /thisFilename/test" with the test if it actually is there
    // resolve global identifier of types
    for (const [key, value] of Object.entries(data.typeDict)) {
      const infos = {
        scope: `/${get_outer_groups(key, 1).join('/')}/`,
        // not the own name for this one:
        localIdentifiers: value.isGeneric
          ? value.genericIdentifiers.map((gIdent) => gIdent.argument.l)
          : [],
        importFilenames,
        filename,
        typeDict: data.typeDict
      };
      if (value.type === 'type-alias')
        data.typeDict[key].body = processTypeExprIdent(value.body, infos);
      else if (value.type === 'complex-type') {
        // resolve type annotations correctly aswell
        data.typeDict[key].body = value.body.map((e) => {
          e.argument.arguments = e.argument.arguments.map((a) => {
            a.argument = processTypeExprIdent(a.argument, infos);
            return a;
          });
          return e;
        });
      }
    }
    // resolve global identifiers of lets
    for (const [key, value] of Object.entries(data.letDict)) {
      data.letDict[key] = processStmtIdent(value, `/${get_outer_groups(key, 1).join('/')}/`, importFilenames, filename, data.typeDict, data.letDict);
    }
  }
  function processStmtIdent(stmt, scope, importFilenames, filename, typeDict, letDict) {
    if (stmt.hasExplicitType)
      stmt.typeExpression = processTypeExprIdent(stmt.typeExpression, {
        scope,
        localIdentifiers: stmt.isGeneric
          ? stmt.genericIdentifiers.map((gIdent) => gIdent.argument.l)
          : [],
        importFilenames,
        filename,
        typeDict
      });
    stmt.body = processExprIdent(stmt.body, {
      scope,
      localTypeIdentifiers: stmt.isGeneric
        ? stmt.genericIdentifiers.map((gIdent) => gIdent.argument.l)
        : [],
      importFilenames,
      localExprIdentifiers: [],
      filename,
      typeDict,
      letDict
    });
    return stmt;
  }
  // resolve identifiers
  function processTypeExprIdent(typeExpr, info) {
    switch (typeExpr.type) {
      case 'primitive-type':
        return typeExpr;
      case 'grouping':
        typeExpr.body = processTypeExprIdent(typeExpr.body, info);
        return typeExpr.body;
      case 'func-type':
        typeExpr.returnType = processTypeExprIdent(typeExpr.returnType, info);
        typeExpr.parameters = typeExpr.parameters.map((param) => {
          param.argument = processTypeExprIdent(param.argument, info);
          return param;
        });
        return typeExpr;
      case 'genericSubstitution':
        typeExpr.expr = processTypeExprIdent(typeExpr.expr, info);
        typeExpr.substitutions = typeExpr.substitutions.map((subst) => {
          subst.argument = processTypeExprIdent(subst.argument, info);
          return subst;
        });
        return typeExpr;
      case 'identifier':
        // recursively do the same thing for the substitutions
        if (info.localIdentifiers.includes(typeExpr.identifier))
          return typeExpr;
        // must be of other scope
        for (let i = 0; i < get_outer_groups_len(info.scope); ++i) {
          // start by not removing the outer groups
          const possiblePath = `/${get_outer_groups(info.scope, i).join('/')}/${typeExpr.identifier}`;
          if (possiblePath in info.typeDict) {
            typeExpr.identifier = possiblePath;
            return typeExpr;
          }
        }
        // out of scope or just erroneous
        newProcessingError(`Can not find the identifier "${typeExpr.identifier}" in scope "${info.scope}".`);
        return typeExpr;
      case 'propertyAccess':
        let propertyAccessPath = typeExpr.propertyToken.l;
        // get the given propertyAccessPath
        let tmp = typeExpr.source;
        while (tmp.type === 'propertyAccess' || tmp.type === 'grouping') {
          if (tmp.type === 'grouping')
            tmp = tmp.body;
          else if (tmp.type === 'propertyAccess') {
            propertyAccessPath = tmp.propertyToken.l + '/' + propertyAccessPath;
            tmp = tmp.source;
          }
        }
        if (tmp.type === 'identifier') {
          propertyAccessPath = '/' + tmp.identifier + '/' + propertyAccessPath;
          // it could be, that this property access, accesses a different file
          // then the deepest identifier must be the other file name, which must be imported at the beginning
          if (info.importFilenames.includes(tmp.identifier))
            return {
              type: 'identifier',
              identifier: propertyAccessPath,
              identifierToken: typeExpr.propertyToken,
              comments: []
            };
        }
        else
          newProcessingError('A property access should only be possible by having the property being a propertyAccess itself or an identifier.');
        // got now the given path by the user in propertyAccessPath
        for (let i = get_outer_groups_len(info.scope); i >= 0; --i) {
          // remove the i times the outer scope, to start at the beginning from 0
          const possibleOuterScope = get_outer_groups(info.scope, i).join('/');
          const possiblePath = possibleOuterScope.length === 0
            ? propertyAccessPath
            : `/${possibleOuterScope}${propertyAccessPath}`;
          if (possiblePath in info.typeDict) {
            // or to `Object.assign(typeExpr, typeExpr.propertyToken)` and change a couple things
            return {
              type: 'identifier',
              identifier: possiblePath,
              identifierToken: typeExpr.propertyToken,
              comments: []
            };
          }
        }
        newProcessingError(`Could not find the identifier "${propertyAccessPath}" in type propertyAccess.`);
        return typeExpr;
    }
  }
  // #region helper functions
  // TODO copy pasted from LCInterpreter
  function deepCpy(value) {
    if (value === null)
      return value;
    switch (typeof value) {
      case 'object':
        if (Array.isArray(value))
          return value.map((val) => deepCpy(val));
        const newObj = {};
        for (const [key, val] of Object.entries(value))
          newObj[key] = deepCpy(val);
        return newObj;
      case 'undefined':
      case 'symbol':
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
      case 'function':
      default:
        return value;
    }
  }
  function resolveAliasOfComplexType(alias, dict) {
    let maxDepth = 2000; // fix `type alias = alias2; type alias2 = alias;`
    while (true) {
      alias = deepCpy(alias);
      --maxDepth;
      if (maxDepth <= 0 || alias === undefined)
        break;
      if (alias.type === 'complex-type')
        break;
      // propertyAccess and grouping are already resolved
      if (alias.body.type === 'identifier')
        alias = dict[alias.body.identifier];
      else if (alias.body.type === 'genericSubstitution')
        alias.body = alias.body.expr; // no problem, since working on a deepCpy
    }
    return alias;
  }
  // #endregion
  // resolve identifiers of expressions
  function processExprIdent(expr, info) {
    switch (expr.type) {
      case 'literal':
        return expr;
      case 'grouping':
        expr.body = processExprIdent(expr.body, info);
        return expr.body; // remove groups for efficiency
      case 'unary':
        expr.body = processExprIdent(expr.body, info);
        return expr;
      case 'binary':
        expr.leftSide = processExprIdent(expr.leftSide, info);
        expr.rightSide = processExprIdent(expr.rightSide, info);
        return expr;
      case 'call':
        expr.function = processExprIdent(expr.function, info);
        expr.arguments = expr.arguments.map((arg) => {
          arg.argument = processExprIdent(arg.argument, info);
          return arg;
        });
        return expr;
      case 'func':
        if (expr.hasExplicitType)
          expr.typeExpression = processTypeExprIdent(expr.typeExpression, {
            scope: info.scope,
            localIdentifiers: info.localTypeIdentifiers,
            importFilenames: info.importFilenames,
            filename: info.filename,
            typeDict: info.typeDict
          });
        expr.parameters = expr.parameters.map((param) => {
          if (param.argument.hasDefaultValue)
            param.argument.defaultValue = processExprIdent(param.argument.defaultValue, info);
          if (param.argument.hasExplicitType)
            param.argument.typeExpression = processTypeExprIdent(param.argument.typeExpression, {
              scope: info.scope,
              localIdentifiers: info.localTypeIdentifiers,
              importFilenames: info.importFilenames,
              filename: info.filename,
              typeDict: info.typeDict
            });
          return param;
        });
        const newLocalIdentifiers = expr.parameters.map((param) => param.argument.identifierToken.l);
        if (newLocalIdentifiers.some((ident, i) => newLocalIdentifiers.indexOf(ident) !== i))
          newProcessingError('Cannot have a function with multiple parameters with the same name.');
        // merge the local identifiers for this case
        if (newLocalIdentifiers.length !== 0)
          info = {
            ...info,
            localExprIdentifiers: [
              ...newLocalIdentifiers,
              ...info.localExprIdentifiers
            ]
          };
        expr.body = processExprIdent(expr.body, info);
        return expr;
      case 'match':
        expr.scrutinee = processExprIdent(expr.scrutinee, info);
        if (expr.hasExplicitType)
          expr.typeExpression = processTypeExprIdent(expr.typeExpression, {
            scope: info.scope,
            localIdentifiers: info.localTypeIdentifiers,
            importFilenames: info.importFilenames,
            filename: info.filename,
            typeDict: info.typeDict
          });
        expr.body = expr.body.map((matchLine) => {
          const newLocalIdentifiers = matchLine.argument.isDefaultVal === false
            ? matchLine.argument.parameters.map((param) => param.argument.l)
            : [];
          if (newLocalIdentifiers.some((ident, i) => newLocalIdentifiers.indexOf(ident) !== i))
            newProcessingError('Cannot have a match body line with two identifiers in the same line.');
          // merge local identifiers
          if (newLocalIdentifiers.length !== 0)
            info = {
              ...info,
              localExprIdentifiers: [
                ...newLocalIdentifiers,
                ...info.localExprIdentifiers
              ]
            };
          matchLine.argument.body = processExprIdent(matchLine.argument.body, info);
          return matchLine;
        });
        return expr;
      case 'typeInstantiation':
        expr.source = processExprIdent(expr.source, info);
        if (expr.source.type !== 'identifier' ||
          !(expr.source.identifier in info.typeDict))
          newProcessingError('Type instantiation must be done with a property of type complex-type.');
        else if (info.typeDict[expr.source.identifier].type !== 'complex-type') {
          // resolve problem:
          // type alias = alias2;
          // type alias2 = complexType;
          // alias->PropertyOfComplexType;
          let alias = resolveAliasOfComplexType(info.typeDict[expr.source.identifier], info.typeDict);
          if (alias?.type !== 'complex-type')
            newProcessingError('Type instantiation must be done with a property of type complex-type.');
        }
        return expr;
      case 'identifier':
        if (info.localExprIdentifiers.includes(expr.identifier))
          return expr;
        // not a local identifier
        for (let i = 0; i < get_outer_groups_len(info.scope); ++i) {
          const possiblePath = `/${get_outer_groups(info.scope, i).join('/')}/${expr.identifier}`;
          // could be for a type instatiation, and thus be typeDict
          if (possiblePath in info.letDict || possiblePath in info.typeDict) {
            expr.identifier = possiblePath;
            return expr;
          }
        }
        newProcessingError(`Could not find the identifier "${expr.identifier}" in the scope of an expression.`);
        return expr;
      case 'propertyAccess':
        let propertyAccessPath = expr.propertyToken.l;
        // get the given propertyAccessPath
        let tmp = expr.source;
        while (tmp.type === 'propertyAccess' || tmp.type === 'grouping') {
          if (tmp.type === 'grouping')
            tmp = tmp.body;
          else if (tmp.type === 'propertyAccess') {
            propertyAccessPath = tmp.propertyToken.l + '/' + propertyAccessPath;
            tmp = tmp.source;
          }
        }
        if (tmp.type === 'identifier') {
          propertyAccessPath = '/' + tmp.identifier + '/' + propertyAccessPath;
          // it could be, that this property access, accesses a different file
          // then the deepest identifier must be the other file name, which must be imported at the beginning
          if (info.importFilenames.includes(tmp.identifier))
            return {
              type: 'identifier',
              identifier: propertyAccessPath,
              identifierToken: expr.propertyToken,
              comments: []
            };
        }
        else
          newProcessingError('An property access should only be possible by having the property being a propertyAccess itself or an identifier.');
        // got now the given path by the user in propertyAccessPath
        for (let i = get_outer_groups_len(info.scope); i >= 0; --i) {
          // remove the i times the outer scope, to start at the beginning from 0
          const possibleOuterScope = get_outer_groups(info.scope, i).join('/');
          const possiblePath = possibleOuterScope.length === 0
            ? propertyAccessPath
            : `/${possibleOuterScope}${propertyAccessPath}`;
          // could be for a type instatiation, and thus be typeDict
          if (possiblePath in info.letDict || possiblePath in info.typeDict)
            return {
              type: 'identifier',
              identifier: possiblePath,
              identifierToken: expr.propertyToken,
              comments: []
            };
        }
        newProcessingError(`Could not find the identifier "${propertyAccessPath}" in propertyAccess expression.`);
        return expr;
    }
  }
  // #region helper funcs
  function get_outer_groups_len(dict_key) {
    return dict_key.split('/').filter((e) => e !== '').length;
  }
  function get_outer_groups(dict_key, removeLastNElements = 0) {
    const ans = dict_key.split('/').filter((e) => e !== '');
    ans.splice(ans.length - removeLastNElements, ans.length);
    return ans;
  }
  // #endregion
  // #endregion
  function processCode(code, filename /*should include the filename at the beginning!*/) {
    if (!filename.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/g))
      return {
        valid: false,
        processingErrors: ['tried to process the code with an invalid filename']
      };
    processingErrors.splice(0, processingErrors.length); // remove all the old errors
    const path = `/${filename}/`; // a path needs "/"
    const parsed = Parser.parse(code, {
      ignoreComments: true /*not needed for execution*/
    });
    if (parsed.valid === false)
      return {
        valid: false,
        processingErrors: [
          {
            type: 'Was not able to parse the code.',
            parserErrors: parsed.parseErrors
          }
        ]
      };
    const ast = parsed.statements;
    // step 1, build the hashmap of important statements
    const value = buildHashMap(ast, path);
    // check if some namespace has the same name as the filename or the imports
    for (const [name, stmt] of value.namespaceScopes)
      if (name === filename || value.imports.some(([n, s]) => n === name))
        newProcessingError(`The name of a group cannot be the same as the filename "${name}" or the name of one of the imports '[${value.imports
          .map(([n, s]) => n)
          .join(', ')}]'.`);
    // Can't proceed to step 2 if already had errors
    if (processingErrors.length !== 0)
      return { valid: false, processingErrors };
    // step 2, resolve all outer scope identifiers to their respective outer scope
    resolveIdentifiers(value, filename);
    if (processingErrors.length !== 0)
      return { valid: false, processingErrors, value };
    return { valid: true, value };
  }
  ProcessAST.processCode = processCode;
})((ProcessAST = {}));
// #endregion

// #region Formatter
// TODO fix comments, add line breaks on more than 80 chars per line, code folding, bracket matching, (imports at very top)
(function (Formatter) {
  Formatter.Colors = {
    symbol: `${0xab};${0xb2};${0xbf}`,
    comments: `${0x80};${0x80};${0x80}`,
    numberLiteral: `${0xe5};${0xc0};${0x7b}`,
    keywordGroup: `${0x05};${0x16};${0x50}`,
    keywordUse: `${0x00};${0x04};${0x35}`,
    keywordMatch: `${0x61};${0xaf};${0xef}`,
    keywordFunc: `${0x80};${0x00};${0x80}`,
    keywordLet: `${0xc6};${0x78};${0xdd}`,
    keywordType: `${0xc6};${0x78};${0xdd}`,
    identifier: `${0xe0};${0x6c};${0x75}`,
    filename: `${0x98};${0xa8};${0xa4}`,
    genericIdentifier: `${0x80};${0x80};${0x80}`,
    primitiveType: `${0xff};${0xa5};${0x00}` // orange
  };
  let indentSize = '  ';
  let colorActive = true;
  let htmlActive = false;
  function printComments(comments, indentation) {
    return comments.length === 0
      ? ''
      : comments
        .map((comment) => indentation + addColor(comment.l, Formatter.Colors.comments))
        .join('\n') + '\n';
  }
  function printTypeExpression(expression) {
    switch (expression.type) {
      case 'grouping':
        return (printComments(expression.comments, '') +
          (addColor('(', Formatter.Colors.symbol) +
            printTypeExpression(expression.body) +
            addColor(')', Formatter.Colors.symbol)));
      case 'primitive-type':
        return (printComments(expression.comments, '') +
          addColor(expression.primitiveToken.l, Formatter.Colors.primitiveType));
      case 'identifier':
        return (printComments(expression.comments, '') +
          addColor(expression.identifierToken.l, Formatter.Colors.identifier));
      case 'func-type':
        return (printComments(expression.comments, '') +
          (addColor('(', Formatter.Colors.symbol) +
            expression.parameters
              .map((argument) => printTypeExpression(argument.argument))
              .join(addColor(', ', Formatter.Colors.symbol)) +
            addColor(')', Formatter.Colors.symbol) +
            addColor(' -> ', Formatter.Colors.symbol) +
            printTypeExpression(expression.returnType)));
      case 'propertyAccess':
        return (printComments(expression.comments, '') +
          (printTypeExpression(expression.source) +
            addColor('.', Formatter.Colors.symbol) +
            addColor(expression.propertyToken.l, Formatter.Colors.identifier)));
      case 'genericSubstitution':
        return (printComments(expression.comments, '') +
          printTypeExpression(expression.expr) +
          addColor('[', Formatter.Colors.symbol) +
          expression.substitutions
            .map((e) => printTypeExpression(e.argument))
            .join(addColor(', ', Formatter.Colors.symbol)) +
          addColor(']', Formatter.Colors.symbol));
    }
  }
  Formatter.printTypeExpression = printTypeExpression;
  function printExpression(expression, indentation) {
    switch (expression.type) {
      case 'grouping':
        return (printComments(expression.comments, indentation) +
          (addColor('(', Formatter.Colors.symbol) +
            printExpression(expression.body, indentation) +
            addColor(')', Formatter.Colors.symbol)));
      case 'literal':
        return (printComments(expression.comments, indentation) +
          addColor(expression.literalToken.l, Formatter.Colors.numberLiteral));
      case 'identifier':
        return (printComments(expression.comments, indentation) +
          addColor(expression.identifierToken.l, Formatter.Colors.identifier));
      case 'propertyAccess':
        return (printComments(expression.comments, indentation) +
          (printExpression(expression.source, indentation) +
            addColor('.', Formatter.Colors.symbol) +
            addColor(expression.propertyToken.l, Formatter.Colors.identifier)));
      case 'typeInstantiation':
        return (printComments(expression.comments, indentation) +
          (printExpression(expression.source, indentation) +
            addColor('->', Formatter.Colors.symbol) +
            addColor(expression.typeLineToken.l, Formatter.Colors.identifier)));
      case 'call':
        return (printComments(expression.comments, indentation) +
          (printExpression(expression.function, indentation) +
            addColor('(', Formatter.Colors.symbol) +
            expression.arguments
              .map((argument) => printExpression(argument.argument, indentation))
              .join(addColor(', ', Formatter.Colors.symbol)) +
            addColor(')', Formatter.Colors.symbol)));
      case 'unary':
        return (printComments(expression.comments, indentation) +
          (addColor(expression.operator, Formatter.Colors.symbol) +
            printExpression(expression.body, indentation)));
      case 'binary':
        return (printComments(expression.comments, indentation) +
          (printExpression(expression.leftSide, indentation) +
            ' ' +
            addColor(expression.operator, Formatter.Colors.symbol) +
            ' ' +
            printExpression(expression.rightSide, indentation)));
      case 'func':
        const explicitType = expression.hasExplicitType
          ? addColor(': ', Formatter.Colors.symbol) +
          printTypeExpression(expression.typeExpression)
          : '';
        return (printComments(expression.comments, indentation) +
          (addColor('func ', Formatter.Colors.keywordFunc) +
            addColor('(', Formatter.Colors.symbol) +
            expression.parameters
              .map((parameter) => addColor(parameter.argument.identifierToken.l, Formatter.Colors.identifier) +
                (parameter.argument.hasExplicitType
                  ? addColor(': ', Formatter.Colors.symbol) +
                  printTypeExpression(parameter.argument.typeExpression)
                  : '') +
                (parameter.argument.hasDefaultValue
                  ? addColor(' = ', Formatter.Colors.symbol) +
                  printExpression(parameter.argument.defaultValue, indentation)
                  : ''))
              .join(addColor(', ', Formatter.Colors.symbol)) +
            addColor(')', Formatter.Colors.symbol) +
            explicitType +
            addColor(' => ', Formatter.Colors.symbol) +
            printExpression(expression.body, indentation)));
      case 'match':
        const explicitType_ = expression.hasExplicitType
          ? addColor(': ', Formatter.Colors.symbol) +
          printTypeExpression(expression.typeExpression)
          : '';
        if (expression.body.length <= 1)
          return (printComments(expression.comments, indentation) +
            addColor('match ', Formatter.Colors.keywordMatch) +
            addColor('(', Formatter.Colors.symbol) +
            printExpression(expression.scrutinee, indentation) +
            addColor(')', Formatter.Colors.symbol) +
            explicitType_ +
            addColor(' { ', Formatter.Colors.symbol) +
            (expression.body.length === 0
              ? ''
              : (() => {
                const arg = expression.body[0].argument;
                const pattern = arg.isDefaultVal === true
                  ? ''
                  : addColor(arg.identifierToken.l, Formatter.Colors.identifier) +
                  (arg.parameters.length === 0
                    ? ''
                    : addColor('(', Formatter.Colors.symbol) +
                    arg.parameters
                      .map((parameter) => addColor(parameter.argument.l, Formatter.Colors.identifier))
                      .join(addColor(', ', Formatter.Colors.symbol)) +
                    addColor(')', Formatter.Colors.symbol)) +
                  ' ';
                return (printComments(arg.comments, '') +
                  pattern +
                  addColor('=> ', Formatter.Colors.symbol) +
                  printExpression(arg.body, indentation));
              })() + ' ') +
            addColor('}', Formatter.Colors.symbol));
        return (printComments(expression.comments, indentation) +
          (addColor('match ', Formatter.Colors.keywordMatch) +
            addColor('(', Formatter.Colors.symbol) +
            printExpression(expression.scrutinee, indentation) +
            addColor(')', Formatter.Colors.symbol) +
            explicitType_ +
            addColor(' { ', Formatter.Colors.symbol) +
            '\n' +
            indentation +
            indentSize +
            expression.body
              .map((bodyLine) => {
                return (printComments(bodyLine.argument.comments, indentation) +
                  (bodyLine.argument.comments.length === 0
                    ? ''
                    : indentation + indentSize) +
                  ((bodyLine.argument.isDefaultVal === true
                    ? ''
                    : addColor(bodyLine.argument.identifierToken.l, Formatter.Colors.identifier) +
                    (bodyLine.argument.parameters.length !== 0
                      ? addColor('(', Formatter.Colors.symbol) +
                      bodyLine.argument.parameters
                        .map((a) => addColor(a.argument.l, Formatter.Colors.identifier))
                        .join(addColor(', ', Formatter.Colors.symbol)) +
                      addColor(')', Formatter.Colors.symbol)
                      : '')) +
                    addColor(bodyLine.argument.isDefaultVal ? '=> ' : ' => ', Formatter.Colors.symbol) +
                    printExpression(bodyLine.argument.body, indentation)));
              })
              .join(addColor(',\n' + indentation + indentSize, Formatter.Colors.symbol)) +
            ('\n' + indentation) +
            addColor('}', Formatter.Colors.symbol)));
    }
  }
  Formatter.printExpression = printExpression;
  function printStatement(statement, indent) {
    switch (statement.type) {
      case 'comment':
      case 'empty':
        // remove the ';' of empty statements
        return printComments(statement.comments, indent).trimEnd();
      case 'import':
        return (printComments(statement.comments, indent) +
          (indent +
            (addColor('use ', Formatter.Colors.keywordUse) +
              addColor(statement.filename.l, Formatter.Colors.filename) +
              addColor(';', Formatter.Colors.symbol))));
      case 'group':
        // empty groups get handled differently
        if (statement.body.length === 0)
          return (printComments(statement.comments, indent) +
            indent +
            addColor('group ', Formatter.Colors.keywordGroup) +
            addColor(statement.identifierToken.l, Formatter.Colors.identifier) +
            addColor(' { }', Formatter.Colors.symbol));
        return (printComments(statement.comments, indent) +
          (indent +
            (addColor('group ', Formatter.Colors.keywordGroup) +
              addColor(statement.identifierToken.l, Formatter.Colors.identifier) +
              addColor(' {\n', Formatter.Colors.symbol) +
              beautifyAST(statement.body, indent + indentSize) +
              indent +
              addColor('}', Formatter.Colors.symbol))));
      case 'let':
        const genericPart = statement.isGeneric
          ? addColor('[', Formatter.Colors.symbol) +
          statement.genericIdentifiers
            .map((genericIdentifier) => addColor(genericIdentifier.argument.l, Formatter.Colors.genericIdentifier))
            .join(addColor(', ', Formatter.Colors.symbol)) +
          addColor(']', Formatter.Colors.symbol)
          : '';
        const typePart = statement.hasExplicitType
          ? addColor(': ', Formatter.Colors.symbol) +
          printTypeExpression(statement.typeExpression)
          : '';
        // could include multiple comments
        const letBody = printExpression(statement.body, indent + indentSize).trimStart();
        return (printComments(statement.comments, indent) +
          (indent +
            (addColor('let ', Formatter.Colors.keywordLet) +
              addColor(statement.identifierToken.l, Formatter.Colors.identifier) +
              genericPart +
              typePart +
              addColor(' = ', Formatter.Colors.symbol) +
              letBody +
              addColor(';', Formatter.Colors.symbol))));
      case 'type-alias':
        const genericPart_ = statement.isGeneric
          ? addColor('[', Formatter.Colors.symbol) +
          statement.genericIdentifiers
            .map((genericIdentifier) => addColor(genericIdentifier.argument.l, Formatter.Colors.genericIdentifier))
            .join(addColor(', ', Formatter.Colors.symbol)) +
          addColor(']', Formatter.Colors.symbol)
          : '';
        return (printComments(statement.comments, indent) +
          (indent +
            (addColor('type ', Formatter.Colors.keywordType) +
              addColor(statement.identifierToken.l, Formatter.Colors.identifier) +
              genericPart_ +
              addColor(' = ', Formatter.Colors.symbol) +
              printTypeExpression(statement.body).trimStart() +
              addColor(';', Formatter.Colors.symbol))));
      case 'complex-type':
        const genericPart__ = statement.isGeneric
          ? addColor('[', Formatter.Colors.symbol) +
          statement.genericIdentifiers
            .map((genericIdentifier) => addColor(genericIdentifier.argument.l, Formatter.Colors.genericIdentifier))
            .join(addColor(', ', Formatter.Colors.symbol)) +
          addColor(']', Formatter.Colors.symbol)
          : '';
        const bodyStr = statement.body.length === 0
          ? addColor(' { }', Formatter.Colors.symbol)
          : addColor(' {\n', Formatter.Colors.symbol) +
          statement.body
            .map((complexTypeLine) => printComments(complexTypeLine.argument.comments, indent + indentSize) +
              indent +
              indentSize +
              addColor(complexTypeLine.argument.identifierToken.l, Formatter.Colors.identifier) +
              (complexTypeLine.argument.hasBrackets
                ? addColor('(', Formatter.Colors.symbol) +
                complexTypeLine.argument.arguments
                  .map((a) => printTypeExpression(a.argument))
                  .join(addColor(', ', Formatter.Colors.symbol)) +
                addColor(')', Formatter.Colors.symbol)
                : ''))
            .join(addColor(', ', Formatter.Colors.symbol) + '\n') +
          '\n' +
          indent +
          addColor('}', Formatter.Colors.symbol);
        return (printComments(statement.comments, indent) +
          (indent +
            (addColor('type ', Formatter.Colors.keywordType) +
              addColor(statement.identifierToken.l, Formatter.Colors.identifier) +
              genericPart__ +
              bodyStr)));
    }
  }
  Formatter.printStatement = printStatement;
  function addColor(msg, color) {
    if (!colorActive)
      return msg;
    return htmlActive
      ? `<span style="color: #${color
        .split(';')
        .map((n) => Number(n).toString(16))
        .join('')}">${msg}</span>`
      : `\x1b[38;2;${color}m` + msg + `\u001b[0m`;
  }
  function beautify(code, settings = { withColor: true, withComments: true, defaultIndentation: '  ' }) {
    indentSize = settings.defaultIndentation ?? '  ';
    colorActive = settings.withColor ?? true;
    htmlActive = settings.forHTML ?? false;
    const ast = Parser.parse(code, { ignoreComments: !settings.withComments });
    if (ast.valid === false)
      throw new Error(`Could not format code because code cannot be parsed.\nErrors: ${ast.parseErrors
        .map((err) => JSON.stringify(err))
        .join('\n')}.`);
    return beautifyAST(ast.statements);
  }
  Formatter.beautify = beautify;
  function beautifyAST(ast, currentIndent = '') {
    let code = '';
    let lastStatementType = ast.at(0)?.type ?? '';
    for (const statement of ast) {
      if (lastStatementType !== statement.type)
        code += '\n';
      lastStatementType = statement.type;
      code += printStatement(statement, currentIndent) + '\n';
    }
    return code;
  }
  Formatter.beautifyAST = beautifyAST;
})((Formatter = {}));
// #endregion

// #region Interpreter
(function (Interpreter) {
  let quickFixDeepCpy = false;
  // TODO: replace all the const exprs by their value
  function interpret(files, mainFilename, input, settings = {
    timeIt: false,
    scopeDeepCpyQuickFix: false
  }) {
    quickFixDeepCpy = settings.scopeDeepCpyQuickFix ?? false;
    settings.timeIt = settings.timeIt ?? false;
    if (typeof files === 'string')
      files = { [mainFilename]: files };
    if (settings.timeIt)
      console.time('pre-execution time');
    if (!(mainFilename in files))
      throw new Error(`The main file ${mainFilename} does not exist in the current files: [${Object.keys(files).join(', ')}]`);
    const processedAST = ProcessAST.processCode(files[mainFilename], mainFilename);
    if (processedAST.valid === false)
      throw new Error(`Invalid code in the main file named "${mainFilename}".\nErrors:\n${processedAST.processingErrors
        .map((err) => JSON.stringify(err))
        .join('\n')}`);
    // #region recursively import and preprocess files
    const importedFiles = [mainFilename];
    const toImportFiles = processedAST.value.imports.map(([filename, _]) => filename);
    while (toImportFiles.length !== 0) {
      const toImportFile = toImportFiles.pop();
      // do not import files twice so skip it
      if (importedFiles.includes(toImportFile))
        continue;
      importedFiles.push(toImportFile);
      if (!(toImportFile in files))
        throw new Error(`Cannot import file named "${toImportFile}". Available files are: [${Object.keys(files).join(', ')}]`);
      const processedFile = ProcessAST.processCode(files[toImportFile], toImportFile);
      if (processedFile.valid === false)
        throw new Error(`Couldnt compile the imported file "${toImportFile}" because of errors:\n${processedFile.processingErrors
          .map((err) => JSON.stringify(err))
          .join('\n')}`);
      // imported files, must be imported at the outer scope aswell
      toImportFiles.push(...processedFile.value.imports.map(([newFilename, _]) => newFilename));
      // save the new values in the main `processedAST` var
      processedAST.value.imports.push(...processedFile.value.imports);
      processedAST.value.namespaceScopes.push(...processedFile.value.namespaceScopes);
      // TODO same names in different files like "thisFilename.thisObj" could overwrite it
      Object.assign(processedAST.value.letDict, processedFile.value.letDict);
      Object.assign(processedAST.value.typeDict, processedFile.value.typeDict);
    }
    // #endregion
    const mainFilePath = `/${mainFilename}/main`;
    if (!(mainFilePath in processedAST.value.letDict))
      throw new Error(`Missing "main" function in the main file "${mainFilename}".`);
    const mainFunc = processedAST.value.letDict[mainFilePath];
    if (mainFunc.body.type !== 'func')
      throw new Error(`The "main" function in the main file must be a let-statement with a body of type function.`);
    else if (mainFunc.body.parameters.length !== 1)
      throw new Error(`The "main" function must take exactly one parameter as input.`);
    if (settings.timeIt)
      console.timeEnd('pre-execution time');
    // main :: T -> T, where T is either i32 or f64
    let mainFuncType = mainFunc.body.hasExplicitType &&
      mainFunc.body.typeExpression.type === 'primitive-type' &&
      (mainFunc.body.typeExpression.primitiveToken.l === 'i32' ||
        mainFunc.body.typeExpression.primitiveToken.l === 'f64')
      ? mainFunc.body.typeExpression.primitiveToken.l === 'i32'
        ? 'int'
        : 'float'
      : 'int';
    const inputSign = Math.sign(input);
    let formattedInput = Math.abs(input).toString().toLowerCase();
    if (formattedInput === Infinity.toString().toLowerCase())
      formattedInput = 'inf';
    if (!Number.isSafeInteger(Number(formattedInput)))
      mainFuncType = 'float';
    if (settings.timeIt)
      console.time('raw execution time');
    const result = executeExpr({
      type: 'expr',
      expr: {
        type: 'call',
        arguments: [
          {
            argument: {
              type: 'unary',
              operator: inputSign === -1 ? '-' : '+',
              operatorToken: 0,
              comments: 0,
              body: {
                type: 'literal',
                literalType: mainFuncType === 'int' ? 'i32' : 'f64',
                literalToken: {
                  l: formattedInput,
                  t: Parser.tokenType.literal,
                  i: -1
                },
                comments: 0
              }
            },
            delimiterToken: 0
          }
        ],
        function: {
          type: 'identifier',
          identifier: mainFilePath,
          identifierToken: {},
          comments: 0
        },
        openingBracketToken: 0,
        closingBracketToken: 0,
        comments: 0
      },
      closure: {}
    }, processedAST.value.letDict, processedAST.value.typeDict);
    if (settings.timeIt)
      console.timeEnd('raw execution time');
    // TODO: check with func type
    if (result.type !== 'int' && result.type !== 'float')
      throw new Error(`User error: "main()" should return an ${mainFuncType} but got the result: ${JSON.stringify(result)}.`);
    return result.value;
  }
  Interpreter.interpret = interpret;
  // #region helper functions
  // TODO copy pasted from LCIdentifierCheck
  function deepCpy(value) {
    if (value === null)
      return value;
    switch (typeof value) {
      case 'object':
        if (Array.isArray(value))
          return value.map((val) => deepCpy(val));
        const newObj = {};
        for (const [key, val] of Object.entries(value))
          newObj[key] = deepCpy(val);
        return newObj;
      case 'undefined':
      case 'symbol':
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
      case 'function':
      default:
        return value;
    }
  }
  function resolveAliasOfComplexType(alias, dict) {
    let maxDepth = 2000; // fix `type alias = alias2; type alias2 = alias;`
    while (true) {
      alias = deepCpy(alias);
      --maxDepth;
      if (maxDepth <= 0 || alias === undefined)
        break;
      if (alias.type === 'complex-type')
        break;
      // propertyAccess and grouping are already resolved
      if (alias.body.type === 'identifier')
        alias = dict[alias.body.identifier];
      else if (alias.body.type === 'genericSubstitution')
        alias.body = alias.body.expr; // no problem, since working on a deepCpy
    }
    return alias;
  }
  // #endregion
  function executeExpr(expr, lets, types) {
    if (expr.type === 'int' ||
      expr.type === 'float' ||
      expr.type === 'complexType')
      return expr;
    if (expr.type !== 'expr')
      throw new Error(`Internal interpreting error: the expression type ${JSON.stringify(expr)} is unknown.`);
    const parseExpr = expr.expr;
    let closure = quickFixDeepCpy ? deepCpy(expr.closure) : expr.closure;

    // HERE
    if (logIt) {
      let doIt = true;
      let message = parseExpr.type;

      if (parseExpr.type === "propertyAccess") doIt = false;
      if (parseExpr.type === "func") doIt = false;
      if (parseExpr.type === "grouping") doIt = false;
      if (parseExpr.type === "literal") doIt = false;

      if (parseExpr.type === "unary" || parseExpr.type === "binary")
        message = parseExpr.type + ": " + parseExpr.operator;

      if (parseExpr.type === "identifier" && !(parseExpr.identifier in closure)) doIt = false;
      else if (parseExpr.type === "identifier") message = "identifier: " + parseExpr.identifier;

      if (parseExpr.type === "call") {
        if (parseExpr.function.type === "identifier")
          message = "call: " + parseExpr.function.identifier;
        else message = "call: EXPRESSION";
        message += " [argCount: " + parseExpr.arguments.length + "]";
      }

      if (parseExpr.type === "match")
        message = "match";

      if (parseExpr.type === "typeInstantiation")
        message = "typeInstantiation: " + parseExpr.typeLineToken.l;

      if (logItSimple)
        console.log(message);
      else
        if (doIt) {
          console.log(
            '\n--------------------------------------------\nExecuting an expression with the the scope:\n',
            'Expression (' + message + "):\n",
            parseExpr,
            '\n\n**Closure:**\n',
            closure,
            '\n--------------------------------------------\n'
          );
        }
    }

    switch (parseExpr.type) {
      case 'propertyAccess':
        throw new Error(`Internal interpreting error: should not have a property access when interpreting because preprocessor handles this.`);
      case 'func':
        return expr;
      case 'grouping':
        return executeExpr({ type: 'expr', expr: parseExpr.body, closure }, lets, types);
      case 'literal':
        // return the actual value
        const literalVal = parseExpr.literalToken.l === 'inf'
          ? Infinity
          : Number(parseExpr.literalToken.l);
        if (parseExpr.literalType === 'i32') {
          if (!Number.isSafeInteger(literalVal))
            throw new Error(`The number ${parseExpr.literalToken.l} is not a valid integer.`);
          return { type: 'int', value: literalVal };
        }
        else if (parseExpr.literalType === 'f64')
          return {
            type: 'float',
            value: literalVal
          };
        throw new Error('Internal interpreting error: literal type must be `i32` or `f64`.');
      case 'unary':
        const unaryOp = parseExpr.operator;
        const bodyVal = executeExpr({ type: 'expr', expr: parseExpr.body, closure }, lets, types);
        if (bodyVal.type === 'complexType' || bodyVal.type === 'expr')
          throw new Error(`User error: the unary operator "${unaryOp}" can only be used with numeric values.`);
        switch (unaryOp) {
          case '+':
            return bodyVal;
          case '-':
            bodyVal.value = -bodyVal.value;
            return bodyVal;
          case '~':
            if (bodyVal.type !== 'int')
              throw new Error(`Unary operator "~" has signature i32 -> i32, but used value ${bodyVal.type}.`);
            bodyVal.value = ~bodyVal.value;
            return bodyVal;
          case '!':
            if (bodyVal.type !== 'int')
              throw new Error(`Unary operator "!" has signature i32 -> i32, but used value ${bodyVal.type}.`);
            bodyVal.value = Number(!bodyVal.value);
            return bodyVal;
          default:
            throw new Error(`Internal error: unknown unary operato ${unaryOp} used in interpreting step.`);
        }
      case 'binary':
        const binaryOp = parseExpr.operator;
        const left = executeExpr({
          type: 'expr',
          expr: parseExpr.leftSide,
          closure
        }, lets, types);
        const right = executeExpr({
          type: 'expr',
          expr: parseExpr.rightSide,
          closure
        }, lets, types);
        if (left.type === 'expr' ||
          left.type === 'complexType' ||
          right.type === 'expr' ||
          right.type === 'complexType')
          throw new Error(`User error: can only do the binary "${binaryOp}" operation on numeric values.`);
        else if (left.type !== right.type) {
          // TODO
          // console.log(
          //   'Annotation test',
          //   Annotate.annotate({
          //     type: 'error',
          //     value: {
          //       errorId: Annotate.ErrorId.eInvalidBinaryOpType,
          //       filename: 'TODO',
          //       code: 'TODO',
          //       startIndex: parseExpr.operatorToken.i,
          //       endIndex:
          //         parseExpr.operatorToken.i + parseExpr.operatorToken.l.length,
          //       binOpLex: parseExpr.operatorToken,
          //       rightOperant: parseExpr.rightSide,
          //       leftOperant: parseExpr.leftSide,
          //       rightType: right.type,
          //       leftType: left.type
          //     }
          //   })
          // );
          throw new Error(`User error: can only do the binary "${binaryOp}" operation on equally typed values.`);
        }
        switch (binaryOp) {
          case '+':
            left.value = left.value + right.value;
            return left;
          case '-':
            left.value = left.value - right.value;
            return left;
          case '*':
            left.value = left.value * right.value;
            return left;
          case '/':
            if (right.type === 'int' && right.value === 0)
              throw new Error(`User error: divided by 0.`);
            left.value = left.value / right.value;
            if (left.type === 'int')
              left.value = Math.trunc(left.value);
            return left;
          case '**':
            left.value = left.value ** right.value;
            return left;
          case '%':
            if (left.type !== 'int')
              throw new Error(`Binary operator "%" has signature i32 -> i32 -> i32, but used it with types ${left.type}.`);
            left.value = left.value % right.value;
            return left;
          case '&':
            if (left.type !== 'int')
              throw new Error(`Binary operator "&" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`);
            left.value = left.value & right.value;
            return left;
          case '|':
            if (left.type !== 'int')
              throw new Error(`Binary operator "|" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`);
            left.value = left.value | right.value;
            return left;
          case '^':
            if (left.type !== 'int')
              throw new Error(`Binary operator "^" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`);
            left.value = left.value ^ right.value;
            return left;
          case '<<':
            if (left.type !== 'int')
              throw new Error(`Binary operator "<<" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`);
            left.value = left.value << right.value;
            return left;
          case '>>':
            if (left.type !== 'int')
              throw new Error(`Binary operator ">>" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`);
            left.value = left.value >> right.value;
            return left;
          case '==':
            return {
              type: 'int',
              value: Number(left.value === right.value)
            };
          case '!=':
            return {
              type: 'int',
              value: Number(left.value !== right.value)
            };
          case '>':
            return {
              type: 'int',
              value: Number(left.value > right.value)
            };
          case '<':
            return {
              type: 'int',
              value: Number(left.value < right.value)
            };
          case '>=':
            return {
              type: 'int',
              value: Number(left.value >= right.value)
            };
          case '<=':
            return {
              type: 'int',
              value: Number(left.value <= right.value)
            };
          default:
            throw new Error(`Internal error: unknown unary operator "${binaryOp}" used in interpreting step.`);
        }
      case 'identifier':
        const ident = parseExpr.identifier;
        if (ident[0] !== '/' && ident in closure)
          return executeExpr(closure[ident], lets, types);
        else if (ident in lets)
          return executeExpr({
            type: 'expr',
            expr: lets[parseExpr.identifier].body,
            closure: {}
          }, lets, types);
        throw new Error(`Internal error: identifier "${parseExpr.identifier}" must be in current scope (either in the current closure or from lets in general) but couldnt be found.`);
      case 'call':
        // typeInstantiation, i32/f64, on Function, on Identifier (could all be on the return of a internal complicated thing from e.g. a match expr)
        let toCall = executeExpr({
          type: 'expr',
          expr: parseExpr.function,
          closure
        }, lets, types);
        switch (toCall.type) {
          case 'complexType':
            if (!(toCall.tyName in types))
              throw new Error(`User/Internal error: the types ${toCall.tyName} does not exists as a complex type in the current scope.`);
            // mutable to fix aliases
            let ty = types[toCall.tyName];
            const discriminator = toCall.discriminator;
            if (ty.type !== 'complex-type') {
              const fixAliases = resolveAliasOfComplexType(ty, types);
              if (fixAliases?.type !== 'complex-type')
                throw new Error(`User error: the type ${toCall.tyName} is not a complex type in the current scope.`);
              ty = fixAliases;
            }
            const internalComplexTypeIdx = ty.body.findIndex((val) => val.argument.identifierToken.l === discriminator);
            if (internalComplexTypeIdx === -1)
              throw new Error(`User error: the complex type pattern ${toCall.discriminator} is not part of the complex type ${ty.name}.`);
            const expectedArgCount = ty.body[internalComplexTypeIdx].argument.arguments.length;
            const givenArgCount = parseExpr.arguments.length;
            if (expectedArgCount !== givenArgCount)
              throw new Error(`User error: tried to instantiate type with too many arguments. Expected ${expectedArgCount} arguments, but got ${givenArgCount}.`);
            toCall.values.push(...parseExpr.arguments.map((arg) => executeExpr({
              type: 'expr',
              expr: arg.argument,
              closure
            }, lets, types)));
            return toCall;
          case 'expr':
            if (toCall.expr.type !== 'func')
              throw new Error(`User error: can only call functions, but got "${toCall.expr.type}".`);
            const givenArgs = parseExpr.arguments.map((arg) => ({
              type: 'expr',
              expr: arg.argument,
              closure
            }));
            const neededArgs = toCall.expr.parameters.map((param) => [
              param.argument.identifierToken.l,
              param.argument.hasDefaultValue
                ? {
                  type: 'expr',
                  expr: param.argument.defaultValue,
                  closure
                }
                : undefined
            ]);
            if (givenArgs.length > neededArgs.length)
              throw new Error('User error: called a function with too many arguments.');
            // DO NOT execute them, but let it be done in the lazy evaluation part!
            const finalArgs = [];
            for (let i = 0; i < neededArgs.length; ++i)
              if (i < givenArgs.length)
                finalArgs.push({
                  [neededArgs[i][0]]: givenArgs[i]
                });
              else if (neededArgs[i][1] !== undefined)
                finalArgs.push({
                  [neededArgs[i][0]]: neededArgs[i][1]
                });
              else
                throw new Error('User error: called function with missing argument(s) which dont have default values.');
            const newArgs = {};
            Object.assign(newArgs, ...finalArgs);
            return executeExpr({
              type: 'expr',
              expr: toCall.expr.body,
              closure: { ...toCall.closure, ...newArgs }
            }, lets, types);
          case 'float':
          case 'int':
            if (parseExpr.arguments.length !== 2)
              throw new Error(`User error: calling i32/f64 requires to have two expressions but got ${parseExpr.arguments.length} arguments.`);
            // if equal to 0, return the first element, else return the second element
            const toCallExpr = parseExpr.arguments[Number(toCall.value !== 0)].argument;
            return executeExpr({
              type: 'expr',
              expr: toCallExpr,
              closure
            }, lets, types);
          default:
            throw new Error('Internal error: tried calling something with a wrong type.');
        }
      case 'match':
        const scrutinee = executeExpr({
          type: 'expr',
          expr: parseExpr.scrutinee,
          closure
        }, lets, types);
        if (scrutinee.type !== 'complexType')
          throw new Error(`User error: can only match complex types but got "${scrutinee.type}".`);
        const toExecLineIdx = parseExpr.body.findIndex((pattern) => pattern.argument.isDefaultVal === false &&
          pattern.argument.identifierToken.l === scrutinee.discriminator);
        const defaultLineIdx = parseExpr.body.findIndex((pattern) => pattern.argument.isDefaultVal);
        const correctIdx = toExecLineIdx !== -1
          ? toExecLineIdx
          : // fall back to the default case if no pattern matches rn
          defaultLineIdx;
        if (correctIdx === -1)
          throw new Error(`User error: the pattern "${scrutinee.discriminator}" is missing in the current match expression!`);
        // add local closure/scope vars
        const matchLine = parseExpr.body[correctIdx].argument;
        const newCtxValueNames = matchLine.isDefaultVal === true
          ? []
          : matchLine.parameters.map((param) => param.argument.l);
        // allow having less values extracted than really needed
        // because in expr "(a->t)(params)", the first expr has no value given
        if (newCtxValueNames.length > scrutinee.values.length)
          throw new Error(`User error: too many values in scrutinee with the needed match body line. expected ${scrutinee.values.length}, but got ${newCtxValueNames.length}.`);
        const updatedClosureValues = {};
        for (let i = 0; i < scrutinee.values.length; ++i)
          updatedClosureValues[newCtxValueNames[i]] = scrutinee.values[i];
        return executeExpr({
          type: 'expr',
          expr: matchLine.body,
          closure: { ...closure, ...updatedClosureValues }
        }, lets, types);
      case 'typeInstantiation':
        if (parseExpr.source.type !== 'identifier')
          throw new Error('Internal error: type instantiations should always be from an (internal) identifier to an identifier.');
        // could be an alias at first, which gets resolved immediatly
        let complexType = types[parseExpr.source.identifier];
        if (complexType === undefined)
          throw new Error('Internal interpreting error: identifier is not accessible in current scope.');
        else if (complexType.type !== 'complex-type') {
          // try resolving the alias to a complex-type:
          const fixAliases = resolveAliasOfComplexType(complexType, types);
          if (fixAliases?.type !== 'complex-type')
            throw new Error('User error: tried type instantiation with a simple type.');
          complexType = fixAliases;
        }
        if (!complexType.body.some((e) => e.argument.identifierToken.l === parseExpr.typeLineToken.l))
          throw new Error(`User error: tried to do type instatiation with property ${parseExpr.typeLineToken.l} which doesnt exist on current complex type: ${complexType.name}.`);
        return {
          type: 'complexType',
          tyName: parseExpr.source.identifier,
          discriminator: parseExpr.typeLineToken.l,
          values: []
        };
    }
  }
})((Interpreter = {}));
// #endregion

function demo(code, input = 0, filename = "file", steps = "11111", logInterpreterSteps = false, logInterpreterStepsSimple = false, timeIt = true) {
  logIt = logInterpreterSteps;
  logItSimple = logInterpreterStepsSimple;

  const operations = [
    () => console.log("Lexed:\n", Lexer.lexe(code)),
    () => {
      const parsed = Parser.parse(code);
      console.log("\nParsed:\n", parsed);
      if (!parsed.valid) throw "";
    }
    ,
    () => console.log("\nProcessed:\n", ProcessAST.processCode(code, filename)),
    () => console.log("\nInterpreted:\n", Interpreter.interpret({ [filename]: code }, filename, input)),
    () => console.log("\nFormatted:\n", Formatter.beautify(code, { withColor: false, withComments: true, forHTML: false }))
  ];

  if (steps.length !== operations.length || !steps.match(/^[01]+$/g)) {
    const message = `Steps should be ${operations.length} different 0s and 1s, where the index means: 1. Lexer, 2. Parser, 3. Processor, 4. Interpreter, 5. Formatter.`;
    console.log(message);
    return message;
  }

  for (let i = 0; i < operations.length; ++i) {
    try {
      if (steps[i] === "1") {
        if (timeIt)
          console.time("Time");
        operations[i]();
        if (timeIt)
          console.timeEnd("Time");
      }
    } catch (e) {
      return e;
    }
  }
}
