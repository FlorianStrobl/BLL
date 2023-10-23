import { Lexer } from './LCLexer';
// @ts-ignore
import { inspect } from 'util';
// import * as F from './FErrorMsgs';

const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

// #region lexer code for parser
// can throw internal errors when assertions are not met
class Larser {
  private code: string;
  private lexer: Generator<Lexer.nextToken>;

  private state:
    | { eof: false; currentToken: Lexer.token }
    | { eof: true; currentToken: undefined };

  constructor(code: string) {
    this.code = code;
    this.lexer = Lexer.lexeNextTokenIter(code);

    this.state = { eof: false, currentToken: undefined as never };
    this.advanceToken();
    if (this.state.eof === false && this.state.currentToken === undefined)
      throw 'lexe first token';
  }

  public isEof(): boolean {
    return this.state.eof;
  }

  // assertion: not eof
  public getCurrentToken(): Lexer.token {
    if (this.isEof()) throw 'current token eof';

    return this.state.currentToken!;
  }

  // assertion: not eof
  public advanceToken(): void {
    if (this.isEof()) throw 'current token eof advance';

    // this.previousToken = this.currentToken;

    const iteratorNext: IteratorResult<Lexer.nextToken> = this.lexer.next();
    const iteratorValue: Lexer.nextToken = iteratorNext.value;
    const isEof: boolean = iteratorValue.type === 'eof';

    // TODO maybe repeat if "soft error": !value.valid but also !value.codeInvalid
    if (!isEof && iteratorValue.type === 'token')
      this.state = { eof: false, currentToken: iteratorValue.value };
    else if (isEof) this.state = { eof: true, currentToken: undefined };
    else this.errorHandling();
  }

  private errorHandling(): never {
    const tokens = Lexer.lexe(this.code);

    if (tokens.valid)
      throw new Error(
        'Internal parser error: did not accept the valid tokens from the lexer: ' +
          JSON.stringify(tokens.tokens)
      );

    throw 'lexer can not lexe';
  }
}
// #endregion

export namespace Parser {
  let parseErrors: parseError[] = [];
  let larser: Larser;

  // #region types
  type optional<T> = T | undefined;

  export type token = Lexer.token;
  type optToken = optional<Lexer.token>;
  type tokenType = Lexer.tokenType;
  const tokenType: typeof Lexer.tokenType = Lexer.tokenType;

  type argumentList<T, localComments extends boolean> = ({
    argument: T;
    delimiterToken: optToken;
  } & (localComments extends true ? { localComments: token[] } : {}))[];
  type comment = { comments: token[] };
  type precedenceInformation = {
    symbols: string | string[];
    arity: 'binary' | 'unary';
    associativity: 'left-to-right' | 'right-to-left' | 'unary';
  };

  // TODO
  export type parseError = {
    type: 'error';
    message: string;
    value?: any;
    currentToken?: token;
  };

  // #region stmt
  export type statement = comment &
    (
      | { type: 'comment' }
      | { type: 'empty'; semicolonToken: token }
      | {
          type: 'group';
          identifierToken: token;
          body: statement[];
          groupToken: token;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | {
          type: 'import';
          filename: token;
          useToken: token;
          semicolonToken: token;
        }
      | ({
          type: 'type-alias';
          identifierToken: token;
          body: typeExpression;
          typeToken: token;
          equalsToken: token;
          semicolonToken: token;
        } & genericAnnotation)
      | ({
          type: 'complex-type';
          identifierToken: token;
          body: argumentList<complexTypeLine, true>;
          typeToken: token;
          openingBracketToken: token;
          closingBracketToken: token;
        } & genericAnnotation)
      | ({
          type: 'let';
          identifierToken: token;
          body: expression;
          letToken: token;
          equalsToken: token;
          semicolonToken: token;
        } & genericAnnotation &
          explicitType)
    );

  type complexTypeLine = comment & {
    identifierToken: token;
    parameters: complexTypeValParams;
  };

  type complexTypeValParams =
    | {
        hasParametersList: true;
        value: argumentList<typeExpression, false>;
        openingBracketToken: token;
        closingBracketToken: token;
      }
    | { hasParametersList: false };

  type genericAnnotation =
    | {
        isGeneric: true;
        genericIdentifiers: argumentList<token, false>;
        genericOpeningBracketToken: token;
        genericClosingBracketToken: token;
      }
    | { isGeneric: false };
  // #endregion

  // #region expr
  export type expression = comment &
    (
      | funcExpression
      | {
          type: 'grouping';
          body: expression;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | {
          type: 'propertyAccess'; // source.property
          propertyToken: token;
          source: expression;
          dotToken: token;
        }
      | {
          type: 'functionCall';
          arguments: argumentList<expression, false>;
          function: expression;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | { type: 'identifier'; identifierToken: token }
      | {
          type: 'literal';
          literalType: 'i32' | 'f32';
          value: number; // "NaN", "Infinity", 0, 1.5, ...
          literalToken: token;
        }
      | {
          type: 'unary';
          operator: string;
          body: expression;
          operatorToken: token;
        }
      | {
          type: 'binary';
          operator: string;
          leftSide: expression;
          rightSide: expression;
          operatorToken: token;
        }
      | {
          type: 'match' /*TODO ; put in comments[] for each and every branch!*/;
          argBody: expression;
          body: argumentList<matchBodyLine, true>;
          explicitType: explicitType;
          matchToken: token;
          argOpeningBracketToken: token;
          argClosingBracketToken: token;
          bodyOpeningBracketToken: token;
          bodyClosingBracketToken: token;
        }
    );

  export type funcExpression = {
    type: 'func';
    parameters: argumentList<funcExprParameter, false>;
    body: expression;
    returnType: explicitType;
    funcToken: token;
    openingBracketToken: token;
    closingBracketToken: token;
    arrowToken: token;
  };

  type funcExprParameter = {
    identifierToken: token;
    typeAnnotation: explicitType;
    defaultValue: funcExprParamDefaultVal;
  };

  type funcExprParamDefaultVal =
    | {
        hasDefaultValue: true;
        value: expression;
        defaultValueEqualsToken: token;
      }
    | { hasDefaultValue: false };

  type matchBodyLine = comment & {
    identifierToken: token;
    parameters: matchBodyLineArgs;
    body: expression;
    arrowToken: token;
  };

  type matchBodyLineArgs =
    | {
        hasParameters: true;
        parameters: argumentList<token, false>;
        openingBracketToken: token;
        closingBracketToken: token;
      }
    | {
        hasParameters: false;
      };
  // #endregion

  // #region types
  // TODO wab propertAccess of complex types?
  export type typeExpression = comment &
    (
      | {
          type: 'grouping';
          body: typeExpression;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | {
          type: 'primitive-type';
          primitiveToken: token; // keyword like i32/f32
        }
      | {
          type: 'identifier';
          identifierToken: token; // generic/type identifier
          generic:
            | {
                hasGenericSubstitution: true;
                values: argumentList<typeExpression, false>;
                closingBracketToken: token;
                openingBracketToken: token;
              }
            | { hasGenericSubstitution: false };
        }
      | {
          type: 'func-type';
          parameters: argumentList<typeExpression, false>;
          returnType: typeExpression;
          brackets:
            | {
                hasBrackets: true;
                openingBracketToken: token;
                closingBracketToken: token;
              }
            | { hasBrackets: false };
          arrowToken: token;
        }
    );

  type explicitType =
    | {
        explicitType: true;
        typeExpression: typeExpression;
        colonToken: token;
      }
    | {
        explicitType: false;
      };
  // #endregion
  // #endregion

  // #region helper
  // an error happend, store it in the error array and return it
  function newParseError(arg: string | parseError): parseError & never {
    // cast arg to parseError type
    arg =
      typeof arg === 'string'
        ? {
            type: 'error',
            message: arg,
            value: arg,
            currentToken: !isAtEnd() ? peek() : undefined
          }
        : arg;

    parseErrors.push(arg);
    return arg as never;
  }

  // #region traditional
  function isAtEnd(): boolean {
    return larser.isEof();
  }

  // returns the current token
  // assertion: not eof
  function peek(): token {
    return larser.getCurrentToken();
  }

  // returns the current token and advances to the next token
  // assertion: not eof
  function advance(): token {
    const currentToken: token = peek();
    larser.advanceToken();
    return currentToken;
  }

  // check if the current token matches the tokens
  // assertion: not eof
  function match(tokens: string | string[]): boolean {
    return (
      tokens === peek().lex ||
      (Array.isArray(tokens) && tokens.includes(peek().lex))
    );
  }

  // check if the current token type matches the tokenType
  // assertion: not eof
  function matchType(tokenType: tokenType): boolean {
    return tokenType === peek().ty;
  }
  // #endregion

  // #region functional
  // checks if an unexpected eof happend, and throw an error if so
  function checkEofWithError(errorOnEof: string): void {
    if (!isAtEnd()) return;

    newParseError('Invalid eof while parsing code: ' + errorOnEof);
    throw 'eof';
  }

  // take all incomming comments, and put them in the comments array
  function consumeComments(comments: token[]): void {
    while (!isAtEnd() && matchType(tokenType.comment)) comments.push(advance());
  }

  // on match: advance
  function optionalMatchAdvance(token: string): optToken {
    return match(token) ? advance() : undefined;
  }

  // on match: advace else error
  // assertion: not eof
  function matchAdvanceOrError(
    token: string,
    error: string | parseError
  ): token {
    return match(token) ? advance() : newParseError(error);
  }

  // on match type: advance else error
  // assertion: not eof
  function matchTypeAdvanceOrError(
    tokenType: tokenType,
    error: string | parseError
  ): token {
    return matchType(tokenType) ? advance() : newParseError(error);
  }

  function isPresent<T>(value: T | undefined): value is NonNullable<T> {
    return value !== undefined;
  }

  // calls the callback function if and only if present is there
  function callOnPresent<T, U>(
    present: NonNullable<U> | undefined,
    callBack: () => T
  ): optional<T> {
    return isPresent(present) ? callBack() : undefined;
  }

  // TODO perLineComment
  // TODO what if it is "(/*comment*/)" WHERE DOES THE COMMENT GET RETURNED, when it is localComments??
  // TODO what about error messages for `(5,,)`
  function parseArgumentList<T, localComments extends boolean>(
    parseArgument: () => T, // assertion: does not have delimiter as valid value
    comments: token[],
    hasLocalComments: localComments,
    endToken: string,
    delimiter: { token: string; missingError: string | parseError },
    emptyList:
      | { noEmptyList: true; errorMessage: string | parseError }
      | { noEmptyList: false },
    invalidArgumentError: string,
    eofError: string
  ): argumentList<T, localComments> {
    const argumentList: argumentList<T, localComments> = [];
    let lastDelimiterToken: optToken = undefined;

    let localComments: token[] = [];

    if (hasLocalComments) consumeComments(localComments);
    else consumeComments(comments);

    while (!isAtEnd() && !match(endToken)) {
      if (hasLocalComments) consumeComments(localComments);
      else consumeComments(comments);

      checkEofWithError(eofError);

      if (argumentList.length !== 0 && !isPresent(lastDelimiterToken))
        newParseError(delimiter.missingError);

      const debugCurrentTokenIdx: number = peek().idx;

      const argument: T = match(delimiter.token) /*better error message*/
        ? newParseError(invalidArgumentError)
        : parseArgument();

      if (hasLocalComments) consumeComments(localComments);
      else consumeComments(comments);

      checkEofWithError(eofError);

      lastDelimiterToken = optionalMatchAdvance(delimiter.token);

      if (hasLocalComments) {
        argumentList.push({
          argument,
          delimiterToken: lastDelimiterToken,
          localComments: [...localComments]
        });

        // clear comments for next run
        localComments = [];
        consumeComments(localComments);
      } else {
        argumentList.push({
          argument,
          delimiterToken: lastDelimiterToken
        } as never);

        consumeComments(comments);
      }

      checkEofWithError(eofError);

      // better error message
      if (debugCurrentTokenIdx === peek().idx) {
        newParseError(invalidArgumentError);
        break;
      }
    }

    // no consume comments

    checkEofWithError(eofError);

    if (hasLocalComments && localComments.length !== 0)
      comments.push(...localComments);

    if (emptyList.noEmptyList && argumentList.length === 0)
      newParseError(emptyList.errorMessage);

    return argumentList;
  }
  // #endregion
  // #endregion

  // #region parser
  // assert: not eof
  function parseStatement(): statement | parseError {
    if (isAtEnd())
      throw new Error('Internal parser error: assertion not met, code is eof.');

    // TODO local comments and eof
    function parseComplexeTypeLine(): complexTypeLine {
      const localComments: [] = []; // TODO add special comments to each complex type

      consumeComments(localComments);

      checkEofWithError(
        'Invalid eof while parsing a line in a complex type statement'
      );

      const identifierToken: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'TODO invalid complex type statement: missing identifier'
      );

      consumeComments(localComments);

      checkEofWithError(
        'Invalid eof while parsing a line in a complex type statement, after getting an identifier'
      );

      const openingBracketToken: optToken = optionalMatchAdvance('(');

      if (isPresent(openingBracketToken)) consumeComments(localComments);

      checkEofWithError(
        'invalid eof in complex type statement after getting a "("'
      );

      const parameterValues: argumentList<typeExpression, false> =
        callOnPresent(openingBracketToken, () =>
          parseArgumentList<typeExpression, false>(
            parseTypeExpression,
            localComments,
            false, // TODO does this make sense??
            ')',
            {
              token: ',',
              missingError:
                'TODO missing comma between two parameters in complex type value'
            },
            { noEmptyList: false },
            'TODO invalid value while parsing arguments for a complex type line',
            'TODO invalid eof while parsing arguments from a complex type line'
          )
        ) ?? [];

      // TODO needed?
      if (isPresent(openingBracketToken)) consumeComments(localComments);

      const closingBracketToken: optToken = callOnPresent(
        openingBracketToken,
        () =>
          matchAdvanceOrError(')', 'missing closing bracket in complex type')
      );

      checkEofWithError('Invalid eof at the end of a complex type expression');

      // TODO what about `type Test { id id id, id id };`

      const parameters: complexTypeValParams =
        isPresent(openingBracketToken) ||
        isPresent(closingBracketToken) ||
        parameterValues.length !== 0
          ? {
              hasParametersList: true,
              value: parameterValues,
              openingBracketToken: openingBracketToken!,
              closingBracketToken: closingBracketToken!
            }
          : { hasParametersList: false };

      return {
        identifierToken,
        parameters,
        comments: localComments
      };
    }

    const comments: token[] = [];
    consumeComments(comments);

    if (isAtEnd() && comments.length !== 0)
      // else use those comments for the next statement
      // and if nothing matches, return these at the end
      return { type: 'comment', comments };

    if (match(';'))
      return { type: 'empty', semicolonToken: advance(), comments };

    if (match('group')) {
      const groupToken: token = advance();

      consumeComments(comments);

      checkEofWithError('unexpected eof in group statement');

      const identifierToken: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'TODO can not have an undefined identifier for a group statement'
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in group statement after getting an identifier'
      );

      const openingBracketToken: token = matchAdvanceOrError(
        '{',
        'TODO cant have a group statement without an opening brackt "{"'
      );

      // no consume comments or eof check

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) {
        const statement: statement | parseError = parseStatement();
        if (statement.type === 'error') break; // handled somewhere else
        body.push(statement);
      }

      checkEofWithError('unexpected eof in group statement');

      const closingBracketToken: token = matchAdvanceOrError(
        '}',
        'TODO internal error, did not match "}" but expected it for end of group statement'
      );

      return {
        type: 'group',
        identifierToken,
        body,
        groupToken,
        openingBracketToken,
        closingBracketToken,
        comments
      };
    }

    if (match('use')) {
      const useToken: token = advance();

      consumeComments(comments);

      checkEofWithError('no use body in use statement');

      const filename: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'did not get an identifier in use statement'
      );

      consumeComments(comments);

      checkEofWithError('unexpected eof in use statement: missing semicolon');

      const semicolonToken: token = matchAdvanceOrError(
        ';',
        'TODO did not get semicolon in a use statement'
      );

      return {
        type: 'import',
        filename,
        useToken,
        semicolonToken,
        comments
      };
    }

    if (match('type')) {
      const typeToken: token = advance();

      consumeComments(comments);

      checkEofWithError('TODO nothing after type keyword');

      const identifierToken: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'TODO invalid type expression: missing identifier'
      );

      consumeComments(comments);

      checkEofWithError('eof after identifier token in type statement');

      const genericOpeningBracketToken: optToken = optionalMatchAdvance('[');

      consumeComments(comments);

      checkEofWithError('eof after getting "[" in type statement');

      const genericIdentifiers: optional<argumentList<token, false>> =
        callOnPresent(genericOpeningBracketToken, () =>
          parseArgumentList<token, false>(
            () =>
              matchTypeAdvanceOrError(
                tokenType.identifier,
                'invalid token in generic type statement'
              ),
            comments,
            false,
            ']',
            {
              token: ',',
              missingError: 'missing comma in generic type statement'
            },
            { noEmptyList: true, errorMessage: 'TODO' },
            'invalid token in generic type statement',
            'unexpected eof in generic type statement'
          )
        );

      consumeComments(comments);

      checkEofWithError('eof inside type statement');

      const genericClosingBracketToken: optToken = callOnPresent(
        genericOpeningBracketToken,
        () =>
          matchAdvanceOrError(
            ']',
            'missing closing bracket in generic type statement'
          )
      );

      consumeComments(comments);

      checkEofWithError('eof inside type statement');

      const generic: genericAnnotation = isPresent(genericOpeningBracketToken)
        ? {
            isGeneric: true,
            genericIdentifiers: genericIdentifiers!,
            genericOpeningBracketToken: genericOpeningBracketToken!,
            genericClosingBracketToken: genericClosingBracketToken!
          }
        : { isGeneric: false };

      if (match('=')) {
        const equalsToken: token = advance();

        consumeComments(comments);

        checkEofWithError('got nothing after "=" in type statement');

        const body: typeExpression = !match(';') // better error message
          ? parseTypeExpression()
          : newParseError('got no type expression in type alias');

        consumeComments(comments);

        checkEofWithError('TODO got nothing after type expression');

        const semicolonToken: token = matchAdvanceOrError(
          ';',
          'TODO did not finish the type expression'
        );

        return {
          type: 'type-alias',
          identifierToken,
          body,
          ...generic,
          typeToken,
          equalsToken,
          semicolonToken,
          comments
        };
      }
      if (match('{')) {
        const openingBracketToken: token = advance();

        checkEofWithError(
          'unexpected eof after getting a "{" in complex type statement'
        );

        // no consume for better local comments

        const body: argumentList<complexTypeLine, true> = parseArgumentList<
          complexTypeLine,
          true
        >(
          parseComplexeTypeLine,
          comments,
          true,
          '}',
          { token: ',', missingError: 'missing comma in complex type body' },
          { noEmptyList: false },
          'invalid or missing argument in complex type body',
          'eof inside complex type statement'
        );

        consumeComments(comments);

        checkEofWithError('eof in complex type statement');

        const closingBracketToken: token = matchAdvanceOrError(
          '}',
          'TODO internal error'
        );

        return {
          type: 'complex-type',
          identifierToken,
          body,
          ...generic,
          typeToken,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }

      return newParseError(
        'TODO invalid type expression: cannot resolve which type it should be. Missing "=" or "{"'
      );
    }

    if (match('let')) {
      const letToken: token = advance();

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement');

      const identifierToken: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'TODO cant have an undefined identifier for a let statement'
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in let statement after asuming an identifier'
      );

      const genericOpeningBracketToken: optToken = optionalMatchAdvance('[');

      consumeComments(comments);

      checkEofWithError(
        'error after getting opening bracket for generic in let statement'
      );

      const genericIdentifiers: optional<argumentList<token, false>> =
        callOnPresent(genericOpeningBracketToken, () =>
          parseArgumentList<token, false>(
            () =>
              matchTypeAdvanceOrError(
                tokenType.identifier,
                'did not match an identifier in generic let statement'
              ),
            comments,
            false,
            ']',
            {
              token: ',',
              missingError:
                'missing comma token in generic let statement declaration'
            },
            {
              noEmptyList: true,
              errorMessage:
                'must have identifiers in let generic let statement list'
            },
            'did not match an identifier in generic let statement',
            'unexpected eof in generic let statement'
          )
        );

      consumeComments(comments);

      checkEofWithError('in let statement');

      const genericClosingBracketToken: optToken = callOnPresent(
        genericOpeningBracketToken,
        () =>
          matchAdvanceOrError(
            ']',
            'missing closing bracket in generic let statement declaration'
          )
      );

      consumeComments(comments);

      checkEofWithError(
        'error after getting closing bracket for generic in let statement'
      );

      const colonToken: optToken = optionalMatchAdvance(':');

      consumeComments(comments);

      // error message must be true, else it would have errored above
      checkEofWithError('unexpected eof in let statement after getting ":"');

      const typeAnnotation: optional<typeExpression> = callOnPresent(
        colonToken,
        () =>
          !match('=') // better error messages
            ? parseTypeExpression()
            : newParseError(
                'missing type annotation in let statement after getting a ":"'
              )
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in let statement while expecting a "="'
      );

      const equalsToken: token = matchAdvanceOrError(
        '=',
        'TODO cant have a let statement without a "=" symbol'
      );

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement after "="');

      const body: expression = !match(';') // better error message
        ? parseExpression()
        : newParseError('TODO no body in let expression');

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement');

      const semicolonToken: token = matchAdvanceOrError(
        ';',
        'TODO let statements must be finished with a ";" symbol'
      );

      const explicitType: explicitType = isPresent(colonToken)
        ? {
            explicitType: true,
            typeExpression: typeAnnotation!,
            colonToken
          }
        : {
            explicitType: false
          };

      const genericAnnotation: genericAnnotation = isPresent(
        genericOpeningBracketToken
      )
        ? {
            isGeneric: true,
            genericIdentifiers: genericIdentifiers!,
            genericOpeningBracketToken: genericOpeningBracketToken!,
            genericClosingBracketToken: genericClosingBracketToken!
          }
        : { isGeneric: false };

      return {
        type: 'let',
        identifierToken,
        body,
        ...explicitType,
        ...genericAnnotation,
        letToken,
        equalsToken,
        semicolonToken,
        comments
      };
    }

    if (comments.length !== 0)
      // consumed comments above and no other thing matched
      // probably this case: group g { /*comment*/ }
      return { type: 'comment', comments };

    return newParseError('could not parse any statement properly');
  }

  // TODO isEof checks
  function parseExpression(): expression {
    const precedenceTable: precedenceInformation[] = [
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
        symbols: ['**', '***'],
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
    function parseExprLvl(
      symbols: string | string[],
      arity: 'binary' | 'unary',
      associativity: 'left-to-right' | 'right-to-left' | 'unary',
      nextLevel: () => expression
    ): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      if (arity === 'unary') {
        // skip
        if (!match(symbols)) return nextLevel();

        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        // parse same level as body
        const body: expression = parseExprLvl(
          symbols,
          arity,
          associativity,
          nextLevel
        );

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        return {
          type: 'unary',
          operator: operatorToken.lex,
          body,
          operatorToken,
          comments
        };
      } else if (arity === 'binary') {
        if (
          associativity !== 'left-to-right' &&
          associativity !== 'right-to-left'
        )
          throw new Error('Internal error, misuse of typescripts type system');

        let leftSide: expression = nextLevel();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        if (associativity === 'left-to-right') {
          while (match(symbols)) {
            const operatorToken: token = advance();

            consumeComments(comments);
            checkEofWithError('invalid eof while parsing an expression');

            const rightSide: expression = nextLevel();

            consumeComments(comments);
            checkEofWithError('invalid eof while parsing an expression');

            leftSide = {
              type: 'binary',
              operator: operatorToken.lex,
              leftSide,
              rightSide,
              operatorToken,
              comments
            };
          }
        } else if (associativity === 'right-to-left') {
          if (match(symbols)) {
            const operatorToken: token = advance();

            consumeComments(comments);
            checkEofWithError('invalid eof while parsing an expression');

            // ourself because of associativity
            const rightSide: expression = parseExprLvl(
              symbols,
              arity,
              associativity,
              nextLevel
            );

            consumeComments(comments);
            checkEofWithError('invalid eof while parsing an expression');

            return {
              type: 'binary',
              operator: operatorToken.lex,
              leftSide,
              rightSide,
              operatorToken,
              comments
            };
          }
        }

        return leftSide;
      }

      throw new Error('Internal error, misuse of typescripts type system');
    }

    // #region first expr levels
    const parseExpr0 = () =>
      parseExprLvl(
        precedenceTable[0].symbols,
        precedenceTable[0].arity,
        precedenceTable[0].associativity,
        parseExpr1
      );
    const parseExpr1 = () =>
      parseExprLvl(
        precedenceTable[1].symbols,
        precedenceTable[1].arity,
        precedenceTable[1].associativity,
        parseExpr2
      );
    const parseExpr2 = () =>
      parseExprLvl(
        precedenceTable[2].symbols,
        precedenceTable[2].arity,
        precedenceTable[2].associativity,
        parseExpr3
      );
    const parseExpr3 = () =>
      parseExprLvl(
        precedenceTable[3].symbols,
        precedenceTable[3].arity,
        precedenceTable[3].associativity,
        parseExpr4
      );
    const parseExpr4 = () =>
      parseExprLvl(
        precedenceTable[4].symbols,
        precedenceTable[4].arity,
        precedenceTable[4].associativity,
        parseExpr5
      );
    const parseExpr5 = () =>
      parseExprLvl(
        precedenceTable[5].symbols,
        precedenceTable[5].arity,
        precedenceTable[5].associativity,
        parseExpr6
      );
    const parseExpr6 = () =>
      parseExprLvl(
        precedenceTable[6].symbols,
        precedenceTable[6].arity,
        precedenceTable[6].associativity,
        parseExpr7
      );
    const parseExpr7 = () =>
      parseExprLvl(
        precedenceTable[7].symbols,
        precedenceTable[7].arity,
        precedenceTable[7].associativity,
        parseExpr8
      );
    const parseExpr8 = () =>
      parseExprLvl(
        precedenceTable[8].symbols,
        precedenceTable[8].arity,
        precedenceTable[8].associativity,
        parseExpr9
      );
    const parseExpr9 = () =>
      parseExprLvl(
        precedenceTable[9].symbols,
        precedenceTable[9].arity,
        precedenceTable[9].associativity,
        parseExpr10
      );
    // #endregion

    // TODO debug and consumeComments(comments)/isAtEnd()
    function parseExpr10(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let left: expression = primary();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match(['(', '.'])) {
        const token: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        if (token.lex === '.') {
          // TODO left-to-right precedence
          // wrong rn!?

          // f.
          const propertyToken: token = matchTypeAdvanceOrError(
            tokenType.identifier,
            'TODO invalid property access'
          );

          left = {
            type: 'propertyAccess',
            source: left,
            propertyToken,
            dotToken: token,
            comments
          };
        } else {
          //   f(
          const args: argumentList<expression, false> = parseArgumentList<
            expression,
            false
          >(
            parseExpression,
            comments,
            false,
            ')',
            {
              token: ',',
              missingError: 'TODO, missing comma in function call argument list'
            },
            { noEmptyList: false },
            'wrong type expression in function call argument list',
            'unexpected eof while parsing a function call argument list'
          );

          // TODO consume comments?
          checkEofWithError('eof in function calling expression');

          const closingBracketToken: token = matchAdvanceOrError(
            ')',
            'TODO internal error' // yes?
          );

          left = {
            type: 'functionCall',
            function: left,
            arguments: args,
            openingBracketToken: token,
            closingBracketToken,
            comments
          };
        }
      }

      return left;
    }

    // TODO, parse literals, highest precedence level
    function primary(): expression {
      const comments: token[] = [];

      function floatLiteralToFloat(literal: string): number {
        return literal === 'inf' ? Infinity : Number(literal);
      }

      // TODO error if numeric literal is out of bounce
      function intLiteralToInt(literal: string): number {
        return Number(literal);
      }

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      if (match('(')) {
        const openingBracketToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const body: expression = !match(')') // better error message
          ? parseExpression()
          : newParseError('invalid grouping expression: got no body');

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const closingBracketToken: token = matchAdvanceOrError(
          ')',
          'TODO did not close bracket in grouping expression'
        );

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        return {
          type: 'grouping',
          body,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      } else if (matchType(tokenType.literal)) {
        const literalToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const lexeme: string = literalToken.lex;
        const literalType: 'i32' | 'f32' =
          lexeme.includes('.') ||
          (!lexeme.startsWith('0x') && lexeme.includes('e')) ||
          lexeme === 'inf' ||
          lexeme === 'nan'
            ? 'f32'
            : 'i32';
        const literalValue: number =
          literalType === 'i32'
            ? intLiteralToInt(lexeme)
            : floatLiteralToFloat(lexeme);

        return {
          type: 'literal',
          literalType,
          value: literalValue,
          literalToken,
          comments
        };
      } else if (matchType(tokenType.identifier)) {
        const identifierToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        return {
          type: 'identifier',
          identifierToken,
          comments
        };
      } else if (match('func')) return parseFuncExpression();
      else if (match('match')) return parseMatchExpression();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      return newParseError(
        'TODO could not match anything in parsing expressions'
      );
    }

    // assert: func token at current point
    function parseFuncExpression(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const funcToken: token = advance();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const openingBracketToken: token = matchAdvanceOrError(
        '(',
        'TODO functions must be opend with ('
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      let lastParameterHadDefaultValue: boolean = false;
      const params: argumentList<funcExprParameter, false> = parseArgumentList<
        funcExprParameter,
        false
      >(
        () => {
          // TODO could also be, that the user forget a ")" and there was no identifier intended
          const identifierToken: token = matchTypeAdvanceOrError(
            tokenType.identifier,
            'TODO Invalid func expression: expected an identifier'
          );

          consumeComments(comments);
          checkEofWithError(
            'invalid eof while parsing arguments of a func expression'
          );

          const colonToken: optToken = optionalMatchAdvance(':');

          consumeComments(comments);
          checkEofWithError(
            'invalid eof while parsing arguments of a func expression'
          );

          const typeExpression: optional<typeExpression> = callOnPresent(
            colonToken,
            parseTypeExpression
          );

          consumeComments(comments);
          checkEofWithError(
            'invalid eof while parsing arguments of a func expression'
          );

          const defaultValueEqualsToken: optToken = optionalMatchAdvance('=');

          // TODO if last one has a default value, this new one needs it too
          if (
            lastParameterHadDefaultValue &&
            !isPresent(defaultValueEqualsToken)
          )
            newParseError(
              'having, in a func expression, a parameter with a default value, then all the following parameters need a default value aswell'
            );

          if (isPresent(defaultValueEqualsToken))
            lastParameterHadDefaultValue = true;

          callOnPresent(defaultValueEqualsToken, () => {
            consumeComments(comments);
            checkEofWithError(
              'invalid eof while parsing arguments of a func expression'
            );
          });

          const value: optional<expression> = callOnPresent(
            defaultValueEqualsToken,
            parseExpression
          );

          const typeAnnotation: explicitType =
            isPresent(colonToken) || isPresent(typeExpression)
              ? {
                  explicitType: true,
                  typeExpression: typeExpression!,
                  colonToken: colonToken!
                }
              : { explicitType: false };

          const defaultValue: funcExprParamDefaultVal =
            isPresent(defaultValueEqualsToken) || isPresent(value)
              ? {
                  hasDefaultValue: true,
                  value: value!,
                  defaultValueEqualsToken: defaultValueEqualsToken!
                }
              : { hasDefaultValue: false };

          return {
            identifierToken,
            typeAnnotation,
            defaultValue
          };
        },
        comments,
        false,
        ')',
        {
          token: ',',
          missingError:
            'Invalid func expression: missing comma in argument list'
        },
        { noEmptyList: false },
        'TODO invalid function argument parsed',
        'TODO unexpected eof while parsing function arguments'
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const closingBracketToken: token = matchAdvanceOrError(
        ')',
        'TODO functions must be closed with )'
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const colonToken: optToken = optionalMatchAdvance(':');

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const typeExpression: optional<typeExpression> = callOnPresent(
        colonToken,
        parseTypeExpression
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const arrowToken: token = matchAdvanceOrError(
        '=>',
        'TODO functions must have a =>'
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const body: expression = parseExpression();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a func expression');

      const returnType: explicitType = isPresent(colonToken)
        ? {
            explicitType: true,
            typeExpression: typeExpression!,
            colonToken
          }
        : {
            explicitType: false
          };

      return {
        type: 'func',
        parameters: params,
        body,
        returnType,
        funcToken,
        openingBracketToken,
        closingBracketToken,
        arrowToken,
        comments
      };
    }

    // assert: match token at current point
    function parseMatchExpression(): expression {
      // TODO parse comments per branch!!!

      function parseMatchBodyLine(): matchBodyLine {
        const comments: token[] = [];

        const identifierToken: token = matchTypeAdvanceOrError(
          tokenType.identifier,
          'TODO Invalid match expression: expected an identifier'
        );

        consumeComments(comments);
        checkEofWithError(
          'invalid eof while parsing arguments of a match expression'
        );

        // TODO parameters parsing
        const openingBracketToken: optToken = optionalMatchAdvance('(');

        consumeComments(comments);
        checkEofWithError(
          'invalid eof while parsing arguments of a match expression'
        );

        const params: optional<argumentList<token, false>> = callOnPresent(
          openingBracketToken,
          () =>
            parseArgumentList<token, false>(
              () =>
                matchTypeAdvanceOrError(
                  tokenType.identifier,
                  'expected identifier in match body line expr'
                ),
              comments,
              false,
              ')',
              {
                token: ',',
                missingError:
                  'missing comma token between two identifier in match body line expr'
              },
              { noEmptyList: false },
              'only identifier are allowed in match expr',
              'unexpected eof while parsing match body line expr args'
            )
        );

        consumeComments(comments);
        checkEofWithError(
          'invalid eof while parsing arguments of a match expression'
        );

        const closingBracketToken: optToken = callOnPresent(
          openingBracketToken,
          () =>
            matchAdvanceOrError(
              ')',
              'closing bracket of local match body line was not closed'
            )
        );

        consumeComments(comments);
        checkEofWithError(
          'invalid eof while parsing arguments of a match expression'
        );

        const arrowToken: token = matchAdvanceOrError(
          '=>',
          'missing arrow token in match expr'
        );

        consumeComments(comments);
        checkEofWithError(
          'invalid eof while parsing arguments of a match expression'
        );

        const body = !match(',') // better error message
          ? parseExpression()
          : newParseError('missing body in match expression line');

        const parameters: matchBodyLineArgs = isPresent(openingBracketToken)
          ? {
              hasParameters: true,
              parameters: params!,
              openingBracketToken: openingBracketToken!,
              closingBracketToken: closingBracketToken!
            }
          : { hasParameters: false };

        return {
          identifierToken,
          parameters,
          body,
          arrowToken,
          comments
        };
      }

      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const matchToken: token = advance();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const argOpeningBracketToken: token = matchAdvanceOrError(
        '(',
        'missing bracket in match expression'
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const argBody: expression = !match(')') // better error message
        ? parseExpression()
        : newParseError('missing body of argument to match expression');

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const argClosingBracketToken: token = matchAdvanceOrError(
        ')',
        'missing closing bracket in match argument body expression'
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const colonToken: optToken = optionalMatchAdvance(':');

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const typeAnnotation: optional<typeExpression> = callOnPresent(
        colonToken,
        () =>
          !match('{')
            ? parseTypeExpression()
            : newParseError('missing type expression in typed match expr')
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const bodyOpeningBracketToken: token = matchAdvanceOrError(
        '{',
        'missing opening bracket in match body expression'
      );

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing a match expression');

      const body: argumentList<matchBodyLine, true> = parseArgumentList<
        matchBodyLine,
        true
      >(
        parseMatchBodyLine,
        comments,
        true,
        '}',
        {
          token: ',',
          missingError: 'missing comma between two lines in a match expression'
        },
        {
          noEmptyList: true,
          errorMessage: 'got a match expression without something in the body'
        },
        'a line in a match expression must have the structure "id(args) => expr"',
        'invalid eof in arg'
      );

      // TODO consume comments needed, since local ones?
      consumeComments(comments);

      checkEofWithError('invalid eof while parsing a match expression');

      const bodyClosingBracketToken: token = matchAdvanceOrError(
        '}',
        'missing closing bracket in match body expression'
      );

      const explicitType: explicitType = isPresent(colonToken)
        ? {
            explicitType: true,
            typeExpression: typeAnnotation!,
            colonToken: colonToken!
          }
        : { explicitType: false };

      // TODO, check for bugs
      return {
        type: 'match',
        argBody,
        body,
        explicitType,
        matchToken,
        argOpeningBracketToken,
        argClosingBracketToken,
        bodyOpeningBracketToken,
        bodyClosingBracketToken,
        comments
      };
    }

    return parseExpr0();
  }

  /*
  Type:
    i32
    f32
    IDENTIFIER
    IDENTIFIER[ TYPE {, TYPE}* { , }? ]
    ( TYPE ) // grouping
    ( TYPE ) -> TYPE // func
    () -> TYPE // empty grouping: must be arg list
    ( TYPE { , TYPE }+  { , }? ) -> TYPE // none empty grouping: arg list
    TYPE -> TYPE // parse as binary operator with check
*/
  // TODO complexTypeVal[i32] for complex type subsitution
  function parseTypeExpression(): typeExpression {
    // temporary type
    type argList = {
      type: 'arglist';
      body: argumentList<typeExpression, false>;
      openingBracketToken: token;
      closingBracketToken: token;
      comments: token[];
    };

    function parseTypeExpression0(): typeExpression {
      const comments: token[] = [];

      consumeComments(comments);

      checkEofWithError('unexpected eof while parsing a type expression');

      // val cant be grouping expression here
      let val: typeExpression | argList = primary();

      consumeComments(comments);

      checkEofWithError('unexpected eof while parsing a type expression');

      if (match('->')) {
        const arrowToken: token = advance();

        consumeComments(comments);

        checkEofWithError('unexpected eof while parsing a type expression');

        const returnType: typeExpression = parseTypeExpression0();

        const brackets:
          | {
              hasBrackets: true;
              openingBracketToken: token;
              closingBracketToken: token;
            }
          | { hasBrackets: false } =
          val.type === 'arglist'
            ? {
                hasBrackets: true,
                openingBracketToken: val.openingBracketToken,
                closingBracketToken: val.closingBracketToken
              }
            : { hasBrackets: false };

        const parameters: argumentList<typeExpression, false> =
          val.type === 'arglist'
            ? val.body
            : [{ argument: val, delimiterToken: undefined }];

        return {
          type: 'func-type',
          parameters,
          returnType,
          brackets,
          arrowToken,
          comments
        };
      }

      if (val.type === 'arglist') {
        if (val.body.length === 1 && !isPresent(val.body[0].delimiterToken)) {
          val = {
            type: 'grouping',
            body: val.body[0].argument,
            openingBracketToken: val.openingBracketToken,
            closingBracketToken: val.closingBracketToken,
            comments: val.comments
          };
        } else if (
          val.body.length === 1 &&
          isPresent(val.body[0].delimiterToken)
        )
          return newParseError(
            'invalid trailing comma in type grouping expression'
          );
        else if (val.body.length === 0)
          return newParseError(
            'got empty brackets in type expression, without being a func type'
          );
        else if (val.body.length > 1)
          return newParseError(
            'got more than one type expression in type grouping expression'
          );
        else
          return newParseError(
            'got arglist as type expression without being followed by an arrow for a func expression'
          );
      }

      return val;
    }

    // isAtEnd and consumeComments
    function primary(): typeExpression | argList {
      const comments: token[] = [];

      consumeComments(comments);

      checkEofWithError('TODO');

      if (match('i32') || match('f32')) {
        return {
          type: 'primitive-type',
          primitiveToken: advance(),
          comments
        };
      } else if (matchType(tokenType.identifier)) {
        const identifierToken: token = advance();

        consumeComments(comments);

        checkEofWithError(
          'unexpected eof in type expression after getting an identifier in a type expression'
        );

        // TODO what if invalid thing "id subs,]" instead of "id [ subs, ]"
        if (!match('['))
          return {
            type: 'identifier',
            identifierToken,
            comments,
            generic: { hasGenericSubstitution: false }
          };

        // did match "["
        const openingBracketToken: token = advance();

        consumeComments(comments);

        checkEofWithError(
          'unexpected eof after getting a "[" in a type expression'
        );

        const values: argumentList<typeExpression, false> = parseArgumentList<
          typeExpression,
          false
        >(
          parseTypeExpression,
          comments,
          false,
          ']',
          {
            token: ',',
            missingError: 'missing comma in generic type substitution'
          },
          {
            noEmptyList: true,
            errorMessage: 'a type substition needs at least one argument'
          },
          'TODO invalid argument in generic type substitution',
          'unexpected eof while parsing '
        );

        consumeComments(comments);

        checkEofWithError('TODO');

        const closingBracketToken: token = matchAdvanceOrError(
          ']',
          'TODO missing closing bracket token in type expression for generic type substitution'
        );

        return {
          type: 'identifier',
          identifierToken,
          comments,
          generic: {
            hasGenericSubstitution: true,
            values,
            openingBracketToken,
            closingBracketToken
          }
        };
      } else if (match('(')) {
        const openingBracketToken: token = advance();

        checkEofWithError(
          'unexpected eof after getting a ( in type expression'
        );

        const body: argumentList<typeExpression, false> = parseArgumentList<
          typeExpression,
          false
        >(
          parseTypeExpression,
          comments,
          false,
          ')',
          {
            token: ',',
            missingError:
              'missing comma token while parsing an argument list in type expression'
          },
          { noEmptyList: false },
          'invalid value for grouping expression or argument list: expected a type but got something else',
          'unexpected eof while parsing an argument list in type expression'
        );

        consumeComments(comments);

        checkEofWithError('unexpected eof while parsing an argument list');

        const closingBracketToken: token = matchAdvanceOrError(')', 'TODO');

        return {
          type: 'arglist',
          body,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }

      return newParseError('TODO could not match any type expression');
    }

    return parseTypeExpression0();
  }
  // #endregion

  export function parse(
    code: string
  ):
    | { valid: true; statements: statement[] }
    | { valid: false; parseErrors: parseError[]; statements: statement[] } {
    parseErrors = [];
    try {
      larser = new Larser(code);
    } catch (e) {
      throw e;
    }

    const statements: statement[] = [];

    while (!isAtEnd()) {
      try {
        const statement: statement | parseError = parseStatement();
        if (statement.type === 'error') break;
        statements.push(statement);
      } catch (error) {
        if (error === 'eof') return { valid: false, parseErrors, statements };
        else
          throw `Error while parsing the code "${code}"\nInternal parsing error: ${JSON.stringify(
            error
          )}`;
      }
    }

    return parseErrors.length === 0
      ? { valid: true, statements }
      : { valid: false, parseErrors, statements };
  }

  function debugParser(
    times: number = 2,
    timerAndIO: boolean = true,
    example: boolean = false
  ) {
    const x = Parser.parse('let xyz: i32 = 52 == 0x5a; // test');
    if (times !== 0 && timerAndIO && example)
      console.log(`[Debug Parser] Example parser: '${JSON.stringify(x)}'`);

    if (times !== 0 && timerAndIO)
      console.log('lexer works: ', Lexer.debugLexer(1, false, false));

    // TODO test all operator precedences

    for (let i = 0; i < times; ++i) {
      const timerName: string = 'Parser tests';
      if (timerAndIO) console.time(timerName);

      // #region tests
      // let _ = 1 + (2 - 3) * 4 / 5 ** 6 % 7;
      // invalid to do: `a.(b).c` but (a.b).c is ok
      // let _ = a(5+32,4)
      // use std; let _ = (func (x) => 3 * x)(5);
      // let x: (i32) -> ((f32), (tust,) -> tast -> (tist)) -> (test) = func (a, b, c) -> 4;
      // let x: (i32) -> ((f32), (tust,) -> tast -> () -> (tist)) -> (test) = func (a, b, c) => 4;
      const mustParse: [string, number][] = [
        [
          `group t {
        let t = match (t) {
          f => match (x) { a() => f, g => c }
        };
      }`,
          1
        ],
        [
          `type Tree[T] {
        empty(),
        otherEmpty,
        full(Tree, T, Tree,),
      }

      let getNodeCount[T] = func (tree: Tree = Tree.full(Tree.empty, 3, Tree.empty)): i32 =>
        match (tree): i32 { // is Tree here an identifier or expression!?
          empty => 0,
          otherEmpty() => 0,
          full(t1, _, t2,) => 1 + getNodeCount(t1) + getNodeCount(t2),
        };`,
          2
        ],
        [
          `let x = func (a) =>
        (- (2 - 3 - 4) == - -5)                  &
        (2 ** 3 ** 4  == 2.4178516392292583e+24) &
        (2 * 3 * 4 == 24)                        &
        ((2 + 3 * 4 == 2 + (3 * 4)) & ((2 + 3) * 4 != 2 + 3 * 4));`,
          1
        ],
        [
          `group test { let x = 5 + 2 * (func (x) => x + 3 | 1 << 2 > 4).a.b() + nan + inf + 3e-3; }`,
          1
        ],
        [
          `use std;

    let x: i32 = 5 << 3;
    let y: f32 = nan / inf;
    let a[X] = func (x: X = 5): f32 => 5.3;

    let b = (func (x) => x == x)(5);

    type time[T,] = f32 -> (T, f32,) -> (i32);
    type other = i32;

    type hey[A] {
      day1,
      day2(time),
      day3
    }

    type alias = hey;

    group test {
      let val = 4 + 3 * 3 % 3 & 3 - a(3);
    }`,
          10
        ],
        ['', 0],
        ['      let f = func (x, a = 5, b = c) => a;', 1],
        ['//comment', 1],
        [`let x = func (a, b) => a + 4 - 2;`, 1],
        [
          `type
      simpleType =

  f32 ->  (f32     ,     f32,) -> i32

  ; // test
  ;/*test*/; group t {//ok
  }`,
          4
        ],
        [
          `let x[A]: A = func (x: A = 4
    +3): A => x;`,
          1
        ],
        [
          `
      let a: () -> A = 0;
      let b: B -> C = 1;
      let c: (D,) -> E = 2;
      let d: (F,G[H],) -> I = 3;
      let e: (J,K,L) -> M = 4;
      let f: (N) -> O = 5;
      `,
          6
        ],
        ['let x: A -> (B) -> (C,) -> (D, E) -> (F) = 5;', 1],
        ['let x: A -> ((B) -> (C )) -> (D, E) -> (F) = 5;', 1],
        ['// test', 1],
        ['/* test */', 1],
        ['/*test*/ /*hey*/ ; /*tast*/ /*ok*/', 2],
        ['group test { let a[T, T2] = 5; let b = 3; let c = 2; }', 1],
        ['use test;', 1],
        ['let test = 5;', 1],
        ['type test = i32;', 1],
        ['type test { }', 1],
        ['group test { }', 1],
        [
          'let test = ! ~ + - 1 + 1 - 1 * 1 / 1 ** 1 *** 1 % 1 & 1 | 1 ^ 1 << 1 >> 1 == 1 != 1 <= 1 >= 1 < 1 > 1;',
          1
        ],
        [
          `let a: f32 = 4.5e3;
      // a
      type cmpx[hey] {
        // b
        A(i32 /*c*/, f32),
        // this test
        // F
        B,
        // d
        C(hey, i32, /*ok works*/),
        D
        // e
      }
      type two {
        // test
      }
      // other
      // test two`,
          4
        ],
        // `type weekdays {
        //   Saturday,
        //   Sunday,
        //   Monday,
        //   Tuesday,
        //   Wednesday,
        //   Thursday,
        //   Friday
        // }

        // let f = func (weekday: weekdays): i32 =>
        //   match (weekday): i32 {
        //     case Saturday => 1;
        //     case Sunday => 1;
        //     0; // default for the other days
        //   };`,
        ['let x = func (x: i32 -> i32,) => 5;', 1],
        ['let a = func (x: (i32) -> i32) => x(5);', 1],
        ['let a = func (x: () -> i32) => 5;', 1],
        [
          '/* comment */ let /*0*/ x /*1*/ : /*2*/ ( /*3*/ i32 /*4*/ , /*5*/ ) /*6*/ -> /*7*/ i32 /*8*/ = /*9*/ func /*10*/ ( /*11*/ x /*12*/ , /*13*/ ) /*14*/ => /*15*/ 5 /*16*/ ; /*17*/',
          2
        ],
        ['group test /*0*/ { /*1*/ let x = 5; /*2*/ } /*3*/', 2],
        [
          `group test {
        type t = i32;
        let a: ((t,t,) -> t,) -> t =
          func (x: (t,t,) -> t,): t => x(5, 3,);
      }`,
          1
        ],
        [
          `type t {
        identifier1(),
        identifier2(i32),
        identifier3,
      }

      type t2 = t;`,
          2
        ],
        ['type complexType { test, test2(), test3(i32 -> f32, hey, ) }', 1],
        [
          `
  use file;

  let i = nan;
  let j = inf;
  let u = i;
  let x: i32 = 1;
  let y: f32 = 2.0;
  let z[A] =
    (func (x: A): A => x) (3); // A == i32
  let f[B]: B -> i32 =
    func (y: B): i32 => 4 + y; // B == i32

  type alias = f32;
  type complex {
    type1,
    type2(),
    type3(i32, f32),
    type4
  }

  group G0 {
    group G1 { let a = 5; }
    let b = 6.0;
  }
  `,
          11
        ]
      ];
      const mustNotParseButLexe: string[] = [
        'let x = func (,) => 4; // invalid trailling comma',
        '}',
        `let f = func (x, a = 5, b) => a;`,
        'x = 5',
        'let x: A -> ((B) -> (C,)) -> (D, E) -> (F) = 5;',
        'test',
        '5',
        '5.0',
        'i32',
        'f32',
        'nan',
        'inf',
        'use',
        'let',
        'type',
        'group',
        'func',
        'match',
        'func (x) => x',
        'let x = func ( => 5;',
        'let x = func () 5;',
        'let x = func () => 5',
        '+',
        '!',
        'use;',
        'use',
        'use test',
        'group p {',
        'let nan',
        'let func',
        'let () => )',
        'let x',
        'let x]',
        'let x[',
        'let func ] =>',
        'let x = func (x: i32 => i32) => 5;',
        'let x = func (x: i32 -> i32) -> 5;',
        'let x',
        'let y =',
        'let x = 5',
        'let x = ;',
        'let x 5 ;',
        'let = 5 ;',
        'x = 5 ;',
        'let x: = 5;',
        `type t {
        identifier1()
        identifier2(i32)
        identifier3
      }`
      ];

      // TODO add for each mustParse a comment in between each value
      // TODO for each mustParse, remove one by one the last token,
      // and check if the code does not crash
      const mustParseWithComments: string[] = new Array(mustParse.length)
        .fill(0)
        .map((_, i) =>
          Lexer.lexe(mustParse[i][0])
            .tokens.map((t) => t.lex)
            .join(`/*comment ${i}*/`)
        );

      let successfullTests: number = 0;
      for (const code of mustParse) {
        try {
          let ans = parse(code[0]);

          if (!ans?.valid) {
            console.error('Should parse:', code);
            log(ans);
          } else if (ans.statements.length !== code[1]) {
            console.error(
              'Got wrong number of parsed statements:',
              ans.statements.length,
              'but expected: ',
              code[1],
              'code: ',
              code[0]
            );
          } else successfullTests++;
        } catch (e) {
          console.error('INTERNAL ERROR:', code, e);
        }
      }
      for (const code of mustNotParseButLexe) {
        if (!Lexer.lexe(code).valid)
          throw new Error('this code should be lexable: ' + code);

        try {
          let ans = parse(code);
          if (ans.valid) {
            console.log('Should not parse: ', code);
            log(ans);
          } else successfullTests++;
        } catch (e) {
          console.error('INTERNAL ERROR', code, e);
        }
      }

      if (
        timerAndIO &&
        successfullTests === mustParse.length + mustNotParseButLexe.length
      ) {
        console.debug(
          `Parsed successfully ${successfullTests} tests and ${
            mustParse.map((e) => e[0]).reduce((a, b) => a + b).length +
            mustNotParseButLexe.reduce((a, b) => a + b).length
          } characters.`
        );
      } else if (
        successfullTests !==
        mustParse.length + mustNotParseButLexe.length
      )
        console.error(
          `${
            mustParse.length + mustNotParseButLexe.length - successfullTests
          } failed tests in the Parser-stage!`
        );
      // #endregion

      if (timerAndIO) console.timeEnd(timerName);
    }
  }

  debugParser(0, true, false);
}

`
type Tree[T] {
  empty(),
  full(Tree, T, Tree)
}

let tree = Tree.empty();

let value = match (tree): i32 {
  empty => -1,
  full(left, val, right) => val
};

let main = func (arg) => value == -1;
`;

// log(
//   Parser.parse(`
//   type Tree[T] {
//     empty(),
//     otherEmpty,
//     full(Tree, T, Tree,),
//   }

//   let getNodeCount[T] = func (tree: Tree = Tree.full(Tree.empty, 3, Tree.empty)): i32 =>
//     match (tree): i32 { // is Tree here an identifier or expression!?
//       empty => 0,
//       otherEmpty() => 0,
//       full(t1, _, t2,) => 1 + getNodeCount(t1) + getNodeCount(t2),
//     };`)
// );

// #region debug
const code = [
  'let id[T]: T -> T -> T = 5;',
  `
  use file;

  let i = nan;
  let j = inf;
  let u = i;
  let x: i32 = 1;
  let y: f32 = 2.0;
  let z[A] =
    (func (x: A): A => x) (3);
  let f[B,]: B -> i32 =
    func (y: B,): i32 => 4 + y;

  type alias = f32;
  type complex {
    type1,
    type2(),
    type3(i32, f32),
    type4
  }

  group G0 {
    group G1 { let a = 5; }
    let b = 6.0;
  }
  `,
  'type complexType { test, test2(), test3(i32 -> f32, hey, ) }',
  'let f[T,B,Z,]: ((T, B,) -> i32) -> Z = func (g) => g()',
  'use test let func ;',
  `group test { let a[] = 5; let b = 3; let c = 2; }`,
  `let x = func (x, y, z) => 1;`
];
const codeWithComments: string =
  '/**/' +
  Lexer.lexe(code[0])
    .tokens.map((t) => t.lex)
    .join(' /*comment*/ ') +
  '/**/';

//console.log(codeWithComments);
const parsedCode = Parser.parse(code[0]);

if (false) {
  console.log('is code valid:', parsedCode.valid);
  console.log('CODE:');
  for (const stmt of parsedCode.statements) log(stmt);
  if (!parsedCode.valid) console.error('ERRORS:');
  // @ts-ignore
  if (!parsedCode.valid) for (const err of parsedCode.parseErrors) log(err);
}
// #endregion

// #region comments
// TODO parsing: "match expressions", "generics for types statement" and "substituting value for generic inside a type"
// then debug parser (tests, comments, eof) and benchmark speed

// let id[T]: (T -> T) -> (T -> T) = func (x: T -> T): T -> T => x;

// must do, must not do

/*
 Check list:
 var, let, const, function, namespace, type, interface, export
 switch, for, while, do, yield, return, enum, new, continue, break
 void, any, unknown, never, null, undefined, as
 Error, throw, try catch
 Infinity, NaN
 ?:, =, {, [, ', ", `, !, ?, =>
 TODO, HERE, NOW, BLL Text
*/
// TODO comments could be ANYWHERE, just aswell as a bad eof
// TODO test with real code, but insert a comment between each and every token!
// TODO check everywhere isAtEnd() and comments
// TODO: add test codes, where after each step of a valid thing, it suddenly eofs and where between each thing a comment is

// TODO invalid char in lexer step results in random error in interpreter.ts

// TODO func (x: i32 = 5) => x;
// TODO match (number): i32 { case 0 => 5; default /*?? maybe just "case", or just the trailing thing?? TODO HERE*/ => 6; }
// TODO calling integers/floats in order to add `==` support: 5(0)(1)
// TODO add generic types in funcs and types
// TODO isAtEnd() and consumeComments(comments)
// TODO endless loop error

// TODO church numerals: +, -, *, **, ==, <=

// TODO check if identifiers are used properly (in generics, types and their bodys, lets, groups, parameters in funcs, ...) + if all types alligne

// TODO functions as types because of `let f = func () => f;` where the type of `f` is literally: `() -> f`

// TODO check this always invalid case: let f = func [T](x: T, y: T): T => x + y();

// TODO generics only for `let` and `type` statements, and not in the expr things

// TODO generics need to have bounds, like `i32 | f32` in order to check if all of the expressions, where a value of the generic type is used, is valid. so: `let f[T: i32 | f32] = func (x: T) => x(1, 2, 3, 4);` is invalid, if calling a `i32` or `f32` is not valid

// TODO add calling `i32` and `f32` with the signature: `T => (T => T)`

// TODO add map() to arrs in std
// TODO type expressions need sometimes annotation for generics

// TODO imports with `use` keyword, are not allowed inside groups but only global scope

// TODO add `let x: thatType[itsGenericValueHere] = ...;`
//                          ^ property access, prob like function calling
// it is a substitution for a generic value in its type

/*
  TODO
  type x[T] = T;

  // x[] must be doable in a type expression to substitute the generic types
  let f = func (a: x[i32]): x[32] => a;
*/

/*
  TODO
  let f = 4;
  let f = 5; // error
  let f = 6; // error aswell! but what is the error message?
*/

// Rust: `type TypeAlias = i32;`
// Rust: `use std;`

/*
type ZeroVariants { }

type RustEnum {
  A,
  B(),
  C(i32)
}
*/

// https://doc.rust-lang.org/reference/items.html rust Statements

// console.clear();
// log(
//   Parser.parse(`
// type ZeroVariants { }

// type RustEnum {
//   A,
//   B(),
//   C(i32)
// }
// `)
// );

// log(
//   Parser.parse(`
// type t {
//   identifier1(),
//   identifier2(i32),
//   identifier3,
// }

// type t2 = t;

// let x = func (a) => a * (t + 1) / 2.0;
// `)
// );
// #endregion
