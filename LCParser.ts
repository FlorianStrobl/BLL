import { Lexer } from './LCLexer';
// @ts-ignore
import { inspect } from 'util';

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

    const lexerNext: IteratorResult<Lexer.nextToken, Lexer.nextToken> =
      this.lexer.next();
    const lexerNextValue: Lexer.nextToken = lexerNext.value;

    const lexerIsNotDone: boolean = lexerNext.done === false;
    const eof: boolean = lexerIsNotDone && lexerNextValue.type === 'eof';

    // TODO maybe repeat if "soft error": !value.valid but also !value.codeInvalid
    if (!eof && lexerNextValue.type === 'token')
      this.state = { eof: false, currentToken: lexerNextValue.value };
    else if (eof) this.state = { eof: true, currentToken: undefined };
    else this.errorHandling();
  }

  private errorHandling(): never {
    const tokens = Lexer.lexe(this.code);

    if (tokens.valid)
      throw new Error(
        'Internal error, parser does not accepped the valid tokens from the lexer: ' +
          tokens.tokens?.toString()
      );

    // console.error(tokens);
    throw 'lexer can not lexe';
  }
}
// #endregion

const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

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

  export type parseError = {
    type: 'error';
    message: string;
    value?: any;
    currentToken?: optToken;
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

  // TODO has default value for a parameter
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
  // #endregion

  // #region types
  // TODO generics just like calling stuff?, wab propertAccess of complex types?
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
          identifierToken: token; // generic identifier/type identifier
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
    // return tokens.includes(peek().lexeme);
    return (
      tokens === peek().lexeme ||
      (Array.isArray(tokens) && tokens.includes(peek().lexeme))
    );
  }

  // check if the current token type matches the tokenType
  // assertion: not eof
  function matchType(tokenType: tokenType): boolean {
    return tokenType === peek().type;
  }
  // #endregion

  // #region functional
  // take all incomming comments, and put them in the comments array
  function consumeComments(comments: token[]): void {
    while (!isAtEnd() && matchType(tokenType.comment)) comments.push(advance());
  }

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

  // checks if an unexpected eof happend, and throw an error if so
  function checkEofWithError(errorOnEof: string): void {
    if (!isAtEnd()) return;

    newParseError('Invalid eof while parsing code: ' + errorOnEof);
    throw 'eof';

    // TODO should print out all errors in a formatted way, aswell as the eof error
    // then stop the program *but* then the parser would have to import logger...
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

  // calls the callback function if and only if present is not undefined
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
    delimiterToken: string,
    missingDelimiterError: string | parseError,
    invalidArgumentError: string,
    eofError: string,
    emptyList:
      | { noEmptyList: true; errorMessage: string | parseError }
      | { noEmptyList: false }
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
        newParseError(missingDelimiterError);

      const debugCurrentTokenIdx: number = peek().idx;

      const argument: T = match(delimiterToken) /*better error msgs*/
        ? newParseError(invalidArgumentError)
        : parseArgument();

      if (hasLocalComments) consumeComments(localComments);
      else consumeComments(comments);

      // no isAtEnd check!

      lastDelimiterToken = optionalMatchAdvance(delimiterToken);

      if (hasLocalComments) {
        argumentList.push({
          argument,
          delimiterToken: lastDelimiterToken,
          localComments: [...localComments]
        });
      } else
        argumentList.push({
          argument,
          delimiterToken: lastDelimiterToken
        } as never);

      // TODO get comments after the delimiter token?
      if (hasLocalComments) {
        // clear comments for next run
        // TODO WHAT IF NOTHING COMES AFTER THIS ONE!!!!!
        localComments = [];
        consumeComments(localComments);
      } else consumeComments(comments);

      checkEofWithError(eofError);

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
  // can throw eof
  function parseStatement(): statement | parseError {
    checkEofWithError('could not parse any statement because of eof');

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

      checkEofWithError(
        'unexpected eof in group statement after the opening bracket'
      );

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) {
        const statement: statement | parseError = parseStatement();
        if (statement.type === 'error') break;
        body.push(statement);
      }

      checkEofWithError('unexpected eof in group statement');

      const closingBracketToken: token = matchAdvanceOrError(
        '}',
        'TODO internal error, did not match what thought would have been matched'
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
            ',',
            'missing comma in generic type statement',
            'invalid token in generic type statement',
            'unexpected eof in generic type statement',
            { noEmptyList: true, errorMessage: 'TODO' }
          )
        );

      consumeComments(comments);

      checkEofWithError('TODO');

      const genericClosingBracketToken: optToken = callOnPresent(
        genericOpeningBracketToken,
        () =>
          matchAdvanceOrError(
            ']',
            'missing closing bracket in generic type statement'
          )
      );

      consumeComments(comments);

      checkEofWithError('TODO');

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

        const body: typeExpression = !match(';') // better error messages
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
          typeToken,
          equalsToken,
          semicolonToken,
          comments,
          ...generic
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
          ',',
          'missing comma in complex type body',
          'invalid or missing argument in complex type body',
          'eof inside complex type statement',
          { noEmptyList: false }
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
          typeToken,
          openingBracketToken,
          closingBracketToken,
          comments,
          ...generic
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
            ',',
            'missing comma token in generic let statement declaration',
            'did not match an identifier in generic let statement',
            'unexpected eof in generic let statement',
            {
              noEmptyList: true,
              errorMessage:
                'must have identifiers in let generic let statement list'
            }
          )
        );

      if (
        isPresent(genericOpeningBracketToken) &&
        (!isPresent(genericIdentifiers) || genericIdentifiers.length === 0)
      )
        newParseError('missing generic token values in generic let statement');

      if (isPresent(genericOpeningBracketToken)) consumeComments(comments);

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

      if (isPresent(colonToken))
        checkEofWithError('unexpected eof in let statement after getting ":"');

      const typeAnnotation: optional<typeExpression> = callOnPresent(
        colonToken,
        () =>
          !match('=') /*better error messages*/
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

      const body: expression = !match(';') /*better error messages*/
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

    return newParseError('TODO could not parse any statement properly');
  }

  // isEof checks
  function parseExpression(): expression {
    function parseExprLvl0(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl1();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      // TODO isAtEnd() and consumeComment()
      while (match('|')) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl1();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl1(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl2();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match('^')) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl2();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl2(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl3();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match('&')) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl3();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl3(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl4();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match(['==', '!='])) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl4();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl4(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl5();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match(['<', '>', '<=', '>='])) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl5();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl5(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl6();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match(['<<', '>>'])) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl6();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl6(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl7();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match(['-', '+'])) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl7();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl7(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      let leftSide: expression = parseExprLvl8();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      while (match(['*', '/', '%'])) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl8();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl8(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      const leftSide: expression = parseExprLvl9();

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      // right to left precedence:
      // if because precedence order
      if (match(['**', '***'])) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const rightSide: expression = parseExprLvl8(); // TODO right? same level because precedence order

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        return {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken,
          comments
        };
      }

      return leftSide;
    }

    function parseExprLvl9(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      // unary:
      if (match(['!', '-', '+', '~'])) {
        const operatorToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const body: expression = parseExprLvl9(); // same level?? TODO

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        return {
          type: 'unary',
          operator: operatorToken.lexeme,
          body,
          operatorToken,
          comments
        };
      }

      return parseExprLvl10();
    }

    // TODO debug and consumeComments(comments)/isAtEnd()
    function parseExprLvl10(): expression {
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

        if (token.lexeme === '.') {
          // f.
          const propertyToken: token = matchTypeAdvanceOrError(
            tokenType.identifier,
            'TODO invalid property access'
          );

          // TODO error: what about having e.g. just a `5` for propertyToken
          // wrong error rn...

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
            ',',
            'TODO, missing comma in function call argument list',
            'TODO wrong type expression in function call argument list',
            'TODO unexpected eof while parsing a function call argument list',
            { noEmptyList: false }
          );

          checkEofWithError('Had eof in function calling expression');
          const closingBracketToken: token = matchAdvanceOrError(
            ')',
            'TODO internal error'
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

      // TODO error if numeric literal is out of bounce
      function floatLiteralToFloat(literal: string): number {
        return literal === 'inf' ? Infinity : Number(literal);
      }

      function intLiteralToInt(literal: string): number {
        return Number(literal);
      }

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

      if (match('(')) {
        const openingBracketToken: token = advance();

        consumeComments(comments);
        checkEofWithError('invalid eof while parsing an expression');

        const body: expression = parseExpression();

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

        const lexeme: string = literalToken.lexeme;
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

    function parseFuncExpression(): expression {
      const comments: token[] = [];

      consumeComments(comments);
      checkEofWithError('invalid eof while parsing an expression');

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
        ',',
        'Invalid func expression: missing comma in argument list',
        'TODO invalid function argument parsed',
        'TODO unexpected eof while parsing function arguments',
        { noEmptyList: false }
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

    function parseMatchExpression(): expression {
      // TODO
      return {} as any;
    }

    return parseExprLvl0();
  }

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
          ',',
          'TODO missing comma between two parameters in complex type value',
          'TODO invalid value while parsing arguments for a complex type line',
          'TODO invalid eof while parsing arguments from a complex type line',
          { noEmptyList: false }
        )
      ) ?? [];

    if (isPresent(openingBracketToken)) consumeComments(localComments);

    const closingBracketToken: optToken = callOnPresent(
      openingBracketToken,
      () => matchAdvanceOrError(')', 'missing closing bracket in complex type')
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
  function parseTypeExpression(): typeExpression {
    type argList = {
      type: 'arglist';
      body: argumentList<typeExpression, false>;
      openingBracketToken: Lexer.token;
      closingBracketToken: Lexer.token;
      comments: Lexer.token[];
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
          ',',
          'missing comma in generic type substitution',
          'TODO invalid argument in generic type substitution',
          'unexpected eof while parsing ',
          {
            noEmptyList: true,
            errorMessage: 'a type substition needs at least one argument'
          }
        );

        // TODO probably not needed since handled above
        // if (values.length === 0)
        //   newParseError(
        //     'invalid amount of value substitution for complex type identifier'
        //   );

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
          ',',
          'missing comma token while parsing an argument list in type expression',
          'invalid value for grouping expression or argument list: expected a type but got something else',
          'unexpected eof while parsing an argument list in type expression',
          { noEmptyList: false }
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
    try {
      larser = new Larser(code);
      parseErrors = [];

      const statements: statement[] = [];

      while (!isAtEnd()) {
        try {
          const statement: statement | parseError = parseStatement();
          if (statement.type === 'error') break;
          statements.push(statement);
        } catch (error) {
          if (error === 'eof') return { valid: false, parseErrors, statements };
          else
            throw `Internal error while parsing: "${JSON.stringify(
              code
            )}"\nINTERNAL ERROR: ${JSON.stringify(error)}`;
        }
      }

      return parseErrors.length === 0
        ? { valid: true, statements }
        : { valid: false, parseErrors, statements };
    } catch (e) {
      if (
        !e?.toString().includes('eof') &&
        !e?.toString().includes('lexer can not lexe')
      )
        throw e;

      // else console.error('eof');
      return {} as any;
    }
  }

  function debugParser() {
    const timerAndIO: boolean = true;

    const timerName: string = 'Parser tests';
    if (timerAndIO) console.time(timerName);

    const mustParse: string[] = [
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
      '',
      '      let f = func (x, a = 5, b = c) => a;',
      '//comment',
      `let x = func (a, b) => a + 4 - 2;`,
      `type
      simpleType =

  f32 ->  (f32     ,     f32,) -> i32

  ; // test
  ;/*test*/; group t {//ok
  }`,
      `let x[A]: A = func (x: A = 4
    +3): A => x;`,
      `
      let a: () -> A = 0;
      let b: B -> C = 1;
      let c: (D,) -> E = 2;
      let d: (F,G[H],) -> I = 3;
      let e: (J,K,L) -> M = 4;
      let f: (N) -> O = 5;
      `,
      'let x: A -> (B) -> (C,) -> (D, E) -> (F) = 5;',
      'let x: A -> ((B) -> (C )) -> (D, E) -> (F) = 5;',
      '// test',
      '/* test */',
      '/*test*/ /*hey*/ ; /*tast*/ /*ok*/',
      'group test { let a[T, T2] = 5; let b = 3; let c = 2; }',
      'use test;',
      'let test = 5;',
      'type test = i32;',
      'type test { }',
      'group test { }',
      'let test = ! ~ + - 1 + 1 - 1 * 1 / 1 ** 1 *** 1 % 1 & 1 | 1 ^ 1 << 1 >> 1 == 1 != 1 <= 1 >= 1 < 1 > 1;',
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
      'let x = func (x: i32 -> i32,) => 5;',
      'let a = func (x: (i32) -> i32) => x(5);',
      'let a = func (x: () -> i32) => 5;',
      '/* comment */ let /*0*/ x /*1*/ : /*2*/ ( /*3*/ i32 /*4*/ , /*5*/ ) /*6*/ -> /*7*/ i32 /*8*/ = /*9*/ func /*10*/ ( /*11*/ x /*12*/ , /*13*/ ) /*14*/ => /*15*/ 5 /*16*/ ; /*17*/',
      'group test /*0*/ { /*1*/ let x = 5; /*2*/ } /*3*/',
      `group test {
        type t = i32;
        let a: ((t,t,) -> t,) -> t =
          func (x: (t,t,) -> t,): t => x(5, 3,);
      }`,
      `type t {
        identifier1(),
        identifier2(i32),
        identifier3,
      }

      type t2 = t;`,
      'type complexType { test, test2(), test3(i32 -> f32, hey, ) }',
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
  `
    ];
    const mustNotParseButLexe: string[] = [
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
        Lexer.lexe(mustParse[i])
          .tokens.map((t) => t.lexeme)
          .join(`/*comment ${i}*/`)
      );

    let successfullTests: number = 0;
    for (const code of mustParse) {
      try {
        let ans = parse(code);

        if (!ans?.valid) {
          console.error('Should parse:', code);
          log(ans);
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

    if (timerAndIO) console.timeEnd(timerName);

    // console.time('t');
    // // group test { let x = 5 + 2 * (func (x) => x + 3 | 1 << 2 > 4).a.b() + nan + inf + 3e-3; }
    // // let _ = 1 + (2 - 3) * 4 / 5 ** 6 % 7;
    // // invalid to do: `a.(b).c` but (a.b).c is ok
    // // let _ = a(5+32,4)

    // // use std; let _ = (func (x) => 3 * x)(5);

    // // let x: (i32) -> ((f32), (tust,) -> tast -> (tist)) -> (test) = func (a, b, c) -> 4;
    // // TODO where are the opening brackets of tust??
    // const parsed = parse(
    //   'let x: (i32) -> ((f32), (tust,) -> tast -> () -> (tist)) -> (test) = func (a, b, c) => 4;'
    // );
    // console.timeEnd('t');

    // log(parsed);
  }

  // for (let i = 0; i < 2; ++i) debugParser();
}

// log(Parser.parse('let x = 3;'));

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
    .tokens.map((t) => t.lexeme)
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
