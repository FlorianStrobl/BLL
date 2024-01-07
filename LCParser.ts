import { Lexer } from './LCLexer';

// #region lexer code for parser
// can throw internal errors when assertions are not met
class Larser {
  private code: string;
  private lexer: Generator<Lexer.nextToken>;
  private skipComments: boolean;

  private state: { eof: false; currentToken: Lexer.token } | { eof: true };

  constructor(code: string, skipComments: boolean = false) {
    this.code = code;
    this.lexer = Lexer.lexeNextTokenIter(code);
    this.skipComments = skipComments;

    // just take the next token as usual
    this.state = { eof: false, currentToken: undefined as never };
    this.advanceToken();
    // check if an error happend
    if (this.state.eof === false && this.state.currentToken === undefined)
      throw new Error('Could not lexe the first token in larser.');
  }

  public noComments(): boolean {
    return this.skipComments;
  }

  public isEof(): boolean {
    return this.state.eof;
  }

  // assertion: not eof
  public getCurrentToken(): Lexer.token {
    if (this.state.eof === true)
      throw new Error(
        'Internal error: assertion was not met in larser. Assumed that the state is not eof.'
      );

    return this.state.currentToken;
  }

  // assertion: not eof
  public advanceToken(): void {
    if (this.state.eof)
      throw new Error(
        'Internal error: assertion was not met in larser. Assumed that the state is not eof.'
      );

    // this.previousToken = this.currentToken;

    const {
      done: iteratorDone,
      value: iteratorValue
    }: IteratorResult<Lexer.nextToken> = this.lexer.next();

    if (!iteratorDone && iteratorValue.type === 'token')
      // @ts-ignore
      this.state.currentToken = iteratorValue.value;
    else if (iteratorDone) this.state = { eof: true };
    else this.errorHandling();

    // skip comments if wanted
    if (
      this.skipComments &&
      !this.state.eof &&
      this.getCurrentToken().t === Lexer.tokenType.comment
    )
      this.advanceToken();
  }

  private errorHandling(): never {
    const tokens = Lexer.lexe(this.code);

    // internal error, since it previously said it would not be valid
    if (tokens.valid)
      throw new Error(
        'Internal parser error: did not accept the valid tokens from the lexer: ' +
          JSON.stringify(tokens.tokens)
      );

    throw new Error('Lexer can not lexe the code.');
  }
}
// #endregion

export namespace Parser {
  const parseErrors: parseError[] = [];
  let larser: Larser;

  // #region types
  type optional<T> = T | undefined;

  export type token = Lexer.token;
  type optToken = optional<token>;
  export type tokenType = Lexer.tokenType;
  export const tokenType: typeof Lexer.tokenType = Lexer.tokenType;

  type comment = { comments: token[] };
  type argumentList<T> = {
    argument: T;
    delimiterToken: optToken;
  }[];
  type hasBrackets =
    | {
        hasBrackets: true;
        openingBracketToken: token;
        closingBracketToken: token;
      }
    | { hasBrackets: false };
  type hasExplicitType =
    | {
        hasExplicitType: true;
        typeExpression: typeExpression;
        colonToken: token;
      }
    | {
        hasExplicitType: false;
      };

  // TODO
  export type parseError = { type: 'error'; message: string } & {
    value?: any;
    currentToken: optToken;
  };

  // #region stmt
  export type statement = comment &
    (
      | letStatement
      | typeStatement
      | { type: 'comment' }
      | { type: 'empty'; semicolonToken: token }
      | {
          type: 'group';
          name: string;
          body: statement[];
          groupToken: token;
          identifierToken: token;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | {
          type: 'import';
          filename: token;
          useToken: token;
          semicolonToken: token;
        }
    );

  export type letStatement = comment &
    ({
      type: 'let';
      name: string;
      body: expression;
      letToken: token;
      identifierToken: token;
      equalsToken: token;
      semicolonToken: token;
    } & genericAnnotation &
      hasExplicitType);

  export type typeStatement = comment &
    (
      | {
          type: 'type-alias';
          name: string;
          body: typeExpression;
          typeToken: token;
          identifierToken: token;
          equalsToken: token;
          semicolonToken: token;
        }
      | {
          type: 'complex-type';
          name: string;
          body: argumentList<complexTypeLine>;
          typeToken: token;
          identifierToken: token;
          openingBracketToken: token;
          closingBracketToken: token;
        }
    ) &
    genericAnnotation;

  type complexTypeLine = comment & {
    identifierToken: token;
    arguments: argumentList<typeExpression>;
  } & hasBrackets;

  type genericAnnotation =
    | {
        isGeneric: true;
        genericIdentifiers: argumentList<token>;
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
          type: 'propertyAccess'; // source.propertyToken
          propertyToken: token;
          source: expression;
          dotToken: token;
        }
      | {
          type: 'typeInstantiation'; // source->propertyToken
          typeLineToken: token;
          source: expression;
          arrowToken: token;
        }
      | {
          type: 'call'; // either a functionCall, or a complex type value instantiation
          arguments: argumentList<expression>;
          function: expression;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | { type: 'identifier'; identifier: string; identifierToken: token }
      | {
          type: 'literal';
          literalType: 'i32' | 'f64';
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
      | ({
          type: 'match';
          scrutinee: expression;
          body: argumentList<matchBodyLine>;
          matchToken: token;
          argOpeningBracketToken: token;
          argClosingBracketToken: token;
          bodyOpeningBracketToken: token;
          bodyClosingBracketToken: token;
        } & hasExplicitType)
    );

  export type funcExpression = {
    type: 'func';
    parameters: argumentList<funcExprParameter>;
    body: expression;
    funcToken: token;
    openingBracketToken: token;
    closingBracketToken: token;
    arrowToken: token;
  } & hasExplicitType;

  type funcExprParameter = {
    identifierToken: token;
  } & hasExplicitType &
    funcExprParamDefaultVal;

  type funcExprParamDefaultVal =
    | {
        hasDefaultValue: true;
        defaultValue: expression;
        defaultValueEqualsToken: token;
      }
    | { hasDefaultValue: false };

  export type matchBodyLine = comment & {
    body: expression;
    arrowToken: token;
  } & matchBodyLinePattern;

  type matchBodyLinePattern =
    | { isDefaultVal: true }
    | ({
        isDefaultVal: false;
        identifierToken: token;
        parameters: argumentList<token>;
      } & hasBrackets);
  // #endregion

  // #region types
  export type typeExpression = comment &
    (
      | {
          type: 'grouping';
          body: typeExpression;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | {
          type: 'genericSubstitution';
          expr: typeExpression;
          substitutions: argumentList<typeExpression>;
          openingBracketToken: token;
          closingBracketToken: token;
        }
      | {
          type: 'propertyAccess'; // source.propertyToken
          propertyToken: token;
          source: typeExpression;
          dotToken: token;
        }
      | {
          type: 'primitive-type';
          primitiveToken: token; // keyword like i32/f64
        }
      | {
          type: 'identifier';
          identifier: string; // generic/type identifier
          identifierToken: token;
        }
      | ({
          type: 'func-type';
          parameters: argumentList<typeExpression>;
          returnType: typeExpression;
          arrowToken: token;
        } & hasBrackets)
    );
  // #endregion
  // #endregion

  // #region helper
  // an error happend, store it in the error array and return error
  function newParseError(arg: string | parseError): parseError & never {
    // cast arg to parseError type
    if (typeof arg === 'string')
      arg = {
        type: 'error',
        message: arg,
        value: arg,
        currentToken: !isAtEnd() ? peek() : undefined
      };

    parseErrors.push(arg);
    return arg as never;
  }

  // #region traditional helper functions
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
      tokens === peek().l ||
      (Array.isArray(tokens) && tokens.includes(peek().l))
    );
  }

  // check if the current token type matches the tokenType
  // assertion: not eof
  function matchType(tokenType: tokenType): boolean {
    return tokenType === peek().t;
  }
  // #endregion

  // #region functional and advanced helper functions
  // checks if an unexpected eof happend, and throw an error if so
  function checkEofErr(errorOnEof: string): void {
    if (!isAtEnd()) return;

    newParseError(`Invalid eof while parsing code at [${errorOnEof}].`);
    throw 'eof'; // magic constant, dont change
  }

  // take the current comments, and put them in the comments array
  function consComments(comments: token[]): void {
    while (!isAtEnd() && matchType(tokenType.comment)) comments.push(advance());
  }

  // on match: advance
  function optMatchAdvance(token: string): optToken {
    return match(token) ? advance() : undefined;
  }

  // on match: advace else error
  // assertion: not eof
  function matchAdvOrErr(token: string, error: string | parseError): token {
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
  function callOnPresent<T>(present: unknown, callBack: () => T): optional<T> {
    return isPresent(present) ? callBack() : undefined;
  }

  function parseArgumentList<T>(
    parseArgument: () => T, // assertion: does not have delimiter as valid value
    endToken: string,
    delimiter: {
      delimiterToken: string;
      missingDelimiterError: string | parseError;
    },
    commentInfo:
      | { parseComments: true; comments: token[] }
      | {
          parseComments: false /* assertion: parseArgument parses all the comments and type T has "comments" property */;
          globalComments: token[]; // in case of no arguments to parse, e.g. `(/*comment*/)`
        },
    emptyList:
      | { noEmptyList: true; errorMessage: string | parseError }
      | { noEmptyList: false },
    noArgumentError: string,
    eofError: string
  ): argumentList<T> {
    const argumentList: argumentList<T> = [];
    let lastDelimiterToken: optToken = undefined;

    // needed in case of `parseComments=false`
    // since comments can come after the last delimiter token
    // or comments could come in empty argument lists
    let outerComments: token[] = [];

    if (commentInfo.parseComments) consComments(commentInfo.comments);
    else consComments(outerComments);

    while (!isAtEnd() && !match(endToken)) {
      // to check if anything was consumed and avoid endless loops
      const debugCurrentTokenIdx: number = peek().i;

      if (argumentList.length !== 0 && !isPresent(lastDelimiterToken))
        newParseError(delimiter.missingDelimiterError);

      if (commentInfo.parseComments) consComments(commentInfo.comments);
      checkEofErr(eofError);

      const argument: T = !match(
        delimiter.delimiterToken
      ) /*better error message*/
        ? parseArgument()
        : newParseError(noArgumentError);

      if (commentInfo.parseComments) consComments(commentInfo.comments);
      else if (outerComments.length !== 0) {
        // comments consumed before executing this loop
        // they belong to the current argument

        if (typeof argument === 'object' && argument !== null) {
          if ('comments' in argument && Array.isArray(argument.comments))
            argument.comments.push(...outerComments);
          else
            newParseError(
              `Could not save local comments: "${JSON.stringify(
                outerComments
              )}"`
            );
        } else
          throw new Error(
            'Internal parser error: unexpected type of argument while parsing an argument list'
          );

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

      if (commentInfo.parseComments) consComments(commentInfo.comments);
      else consComments(outerComments); // save comments into outerComments, in case that after them comes the endToken

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
        const lastArgument: T = argumentList.at(-1)!.argument;

        if (typeof lastArgument === 'object' && lastArgument !== null) {
          if (
            'comments' in lastArgument &&
            Array.isArray(lastArgument.comments)
          )
            lastArgument.comments.push(...outerComments);
          else
            newParseError(
              `Could not save local comments: "${JSON.stringify(
                outerComments
              )}"`
            );
        } else
          throw new Error(
            'Internal parser error: unexpected type of argument while parsing an argument list.'
          );
      }
    }

    return argumentList;
  }
  // #endregion
  // #endregion

  // #region parser
  // #region primary helper
  // #region for statements
  function parseComplexeTypeLine(): complexTypeLine {
    const comments: [] = []; // local comments

    consComments(comments);
    checkEofErr('Eof while parsing a line in a complex-type-statement');

    const identifierToken: token = matchTypeAdvanceOrError(
      tokenType.identifier,
      'Missing identifier in complex-type-statement line.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing a line of a complex-type-statement.');

    const openingBracketToken: optToken = optMatchAdvance('(');

    consComments(comments);
    checkEofErr(
      'Eof in complex-type-statement body line after parsing a "(" token.'
    );

    const parameterValues: argumentList<typeExpression> =
      callOnPresent(openingBracketToken, () =>
        parseArgumentList<typeExpression>(
          parseTypeExpression as () => typeExpression,
          ')',
          {
            delimiterToken: ',',
            missingDelimiterError:
              'Missing "," token between parameters in complex-type-statement body line.'
          },
          { parseComments: true, comments },
          { noEmptyList: false },
          'Invalid value while parsing arguments for a complex-type-statement body line',
          'Eof while parsing arguments for a complex-type-statement body line.'
        )
      ) ?? [];

    consComments(comments);
    checkEofErr('Eof while parsing a complex-type-statement.');

    const closingBracketToken: optToken = callOnPresent(
      openingBracketToken,
      () =>
        matchAdvOrErr(
          ')',
          'Missing ")" token in complex-type-statement body line.'
        )
    );

    // no consume comments for next line
    checkEofErr('Eof at the end of a complex-type-statement body line.');

    const parameters: hasBrackets =
      isPresent(openingBracketToken) ||
      isPresent(closingBracketToken) ||
      parameterValues.length !== 0
        ? {
            hasBrackets: true,
            openingBracketToken: openingBracketToken!,
            closingBracketToken: closingBracketToken!
          }
        : { hasBrackets: false };

    return {
      identifierToken,
      arguments: parameterValues,
      ...parameters,
      comments
    };
  }
  // #endregion

  // #region for type expressions
  // temporary internal type
  type argList = {
    type: 'arglist';
    body: argumentList<typeExpression>;
    openingBracketToken: token;
    closingBracketToken: token;
    comments: token[];
  };

  function parseTypeExpLv0(): typeExpression | parseError {
    const comments: token[] = [];

    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');

    // arglists are needed for function types
    const left: typeExpression | argList | parseError = parseTypeExprLv1();
    if (left.type === 'error') return left;

    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');

    if (match('->')) {
      // right-to-left precedence
      const arrowToken: token = advance();

      consComments(comments);
      checkEofErr('Eof while parsing a type expression.');

      const returnType: typeExpression = parseTypeExpLv0() as typeExpression;

      // depending on being the temporary type arglist or an other type
      // the parameters are either a single type
      // or a group of types
      const parameters: argumentList<typeExpression> =
        left.type === 'arglist'
          ? left.body
          : [{ argument: left, delimiterToken: undefined }];

      const brackets:
        | {
            hasBrackets: true;
            openingBracketToken: token;
            closingBracketToken: token;
          }
        | { hasBrackets: false } =
        left.type === 'arglist'
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
    if (left.type !== 'arglist') return left;
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
        return newParseError(
          'Empty brackets in type-expression are not allowed, if not used in a func-type.'
        );
      else if (left.body.length === 1 && isPresent(left.body[0].delimiterToken))
        return newParseError(
          'Invalid trailing comma in type-grouping-expression.'
        );
      // (val.body.length > 1)
      else
        return newParseError(
          'More than one type-expression in a group-expression are not allowed.'
        );
    }
  }

  function parseTypeExprLv1(): typeExpression | argList | parseError {
    const comments: token[] = [];

    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');

    let left: typeExpression | argList | parseError = parsePrimaryTypeExpr();
    if (left.type === 'error') return left;

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
        const dotToken: token = advance();

        consComments(comments);
        checkEofErr('Eof while parsing a type-expression.');

        const propertyToken: token = matchTypeAdvanceOrError(
          tokenType.identifier,
          'Must have an identifier as property token in a type-expression.'
        );

        consComments(comments);
        checkEofErr('Eof while parsing a type-expression.');

        left = {
          type: 'propertyAccess',
          source: left,
          propertyToken,
          dotToken,
          comments
        };
      } else {
        // must be '['
        const openingBracketToken: token = advance();

        consComments(comments);
        checkEofErr('Eof while parsing a type-expression.');

        const substitutions: argumentList<typeExpression> =
          parseArgumentList<typeExpression>(
            parseTypeExpression as () => typeExpression,
            ']',
            {
              delimiterToken: ',',
              missingDelimiterError:
                'Missing "," token in generic-type-substitution of a type-expression.'
            },
            { parseComments: true, comments },
            {
              noEmptyList: true,
              errorMessage:
                'Type substition of type-expressions need at least one argument.'
            },
            'Invalid argument in generic-type-substitution of type-expression.',
            'Eof while parsing a type-expression.'
          );

        const closingBracketToken: token = matchAdvOrErr(
          ']',
          'Missing "]" token in type-expression of generic-type-subsitution.'
        );

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

  function parsePrimaryTypeExpr(): typeExpression | argList | parseError {
    const comments: token[] = [];

    consComments(comments);
    checkEofErr('Eof while parsing a type-expression.');

    if (match('i32') || match('f64')) {
      return {
        type: 'primitive-type',
        primitiveToken: advance(),
        comments
      };
    } else if (matchType(tokenType.identifier)) {
      const identifierToken: token = advance();

      consComments(comments);
      checkEofErr('Eof while parsing a type-expression.');

      return {
        type: 'identifier',
        identifier: identifierToken.l,
        identifierToken,
        comments
      };
    } else if (match('(')) {
      const openingBracketToken: token = advance();

      consComments(comments);
      checkEofErr('Eof while parsing a type-expression.');

      const body: argumentList<typeExpression> =
        parseArgumentList<typeExpression>(
          parseTypeExpression as () => typeExpression,
          ')',
          {
            delimiterToken: ',',
            missingDelimiterError:
              'Missing "," token while parsing an argument list in a type-expression.'
          },
          { parseComments: true, comments },
          { noEmptyList: false },
          'Invalid value for grouping expression or argument list: expected a type but got something else.',
          'Eof while parsing an argument list in type-expression.'
        );

      consComments(comments);
      checkEofErr('Eof while parsing a type-expression.');

      const closingBracketToken: token = matchAdvOrErr(
        ')',
        'Missing ")" token in type-expression.'
      );

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
  const precedenceTable: {
    symbols: string | string[];
    arity: 'binary' | 'unary';
    associativity: 'left-to-right' | 'right-to-left' | /*none:*/ 'unary';
  }[] = [
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
  function parseExprLvl(
    symbols: string | string[],
    arity: 'binary' | 'unary',
    associativity: 'left-to-right' | 'right-to-left' | 'unary',
    nextLevel: () => expression
  ): expression {
    const comments: token[] = [];

    consComments(comments);
    checkEofErr('Eof while parsing an expression.');

    if (arity === 'unary') {
      // skip if not needed
      if (!match(symbols)) return nextLevel();

      const operatorToken: token = advance();

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      // parse same level as body
      const body: expression = parseExprLvl(
        symbols,
        arity,
        associativity,
        nextLevel
      );

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      return {
        type: 'unary',
        operator: operatorToken.l,
        body,
        operatorToken,
        comments
      };
    } else if (arity === 'binary') {
      if (
        associativity !== 'left-to-right' &&
        associativity !== 'right-to-left'
      )
        throw new Error(
          'Internal parser error: invalid use of TypeScripts type system'
        );

      let leftSide: expression = nextLevel();

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      if (associativity === 'left-to-right') {
        while (match(symbols)) {
          const operatorToken: token = advance();

          consComments(comments);
          checkEofErr('Eof while parsing an expression.');

          const rightSide: expression = nextLevel();

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
      } else if (associativity === 'right-to-left') {
        if (match(symbols)) {
          const operatorToken: token = advance();

          consComments(comments);
          checkEofErr('Eof while parsing an expression.');

          // same level because of associativity
          const rightSide: expression = parseExprLvl(
            symbols,
            arity,
            associativity,
            nextLevel
          );

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

    throw new Error(
      'Internal parser error: invalid use of typescripts type system'
    );
  }

  function parseExprLv10(): expression {
    const comments: token[] = [];

    consComments(comments);
    checkEofErr('Eof while parsing an expression.');

    let left: expression = parsePrimaryExprLv() as expression;

    consComments(comments);
    checkEofErr('Eof while parsing an expression.');

    while (match(['(', '.', '->'])) {
      if (peek().l === '.' || peek().l === '->') {
        // left-to-right precedence
        const token: token = advance();

        consComments(comments);
        checkEofErr('Eof while parsing an expression.');

        const propertyToken: token = matchTypeAdvanceOrError(
          tokenType.identifier,
          'The expression property-access needs a property of type identifier.'
        );

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
      } else if (peek().l === '(') {
        const openingBracketToken: token = advance();

        consComments(comments);
        checkEofErr('Eof while parsing an expression.');

        const args: argumentList<expression> = parseArgumentList<expression>(
          parseExpression as () => expression,
          ')',
          {
            delimiterToken: ',',
            missingDelimiterError:
              'Missing "," token in expression function call argument list.'
          },
          { parseComments: true, comments },
          { noEmptyList: false },
          'Invalid type-expression in function call argument list.',
          'Eof while parsing the expression function call argument list.'
        );

        consComments(comments);
        checkEofErr('Eof while parsing a function call expression.');

        const closingBracketToken: token = matchAdvOrErr(
          ')',
          'Missing ")" token in expression function call.'
        );

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
      } else
        throw new Error(
          `Internal parser error: expected the tokens "(" or "." in this expression.`
        );
    }

    return left;
  }

  // highest precedence level
  function parsePrimaryExprLv(): expression | parseError {
    const comments: token[] = [];

    consComments(comments);
    checkEofErr('Eof while parsing an expression.');

    if (match('(')) {
      const openingBracketToken: token = advance();

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      const body: expression = !match(')') // better error message
        ? (parseExpression() as expression)
        : newParseError('Missing body in grouping expression.');

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      const closingBracketToken: token = matchAdvOrErr(
        ')',
        'Missing ")" token in grouping expression.'
      );

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      return {
        type: 'grouping',
        body,
        openingBracketToken,
        closingBracketToken,
        comments
      };
    } else if (matchType(tokenType.literal)) {
      const literalToken: token = advance();

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      const lexeme: string = literalToken.l;
      const literalType: 'i32' | 'f64' =
        lexeme.includes('.') ||
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
    } else if (matchType(tokenType.identifier)) {
      const identifierToken: token = advance();

      consComments(comments);
      checkEofErr('Eof while parsing an expression.');

      return {
        type: 'identifier',
        identifier: identifierToken.l,
        identifierToken,
        comments
      };
    } else if (match('func')) return parseFuncExpression();
    else if (match('match')) return parseMatchExpression();

    return newParseError('Could not match any expression.');
  }

  function parseFuncExprParams(
    lastHadDefaultVal: { had: boolean },
    comments: token[]
  ): funcExprParameter {
    const identifierToken: token = matchTypeAdvanceOrError(
      tokenType.identifier,
      'Missing identifier in function expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing arguments of a function expression.');

    const colonToken: optToken = optMatchAdvance(':');

    consComments(comments);
    checkEofErr('Eof while parsing arguments of a function expression.');

    const typeExpression: optional<typeExpression> = callOnPresent(
      colonToken,
      () =>
        !match('=') && !match(',') // better error message
          ? (parseTypeExpression() as typeExpression)
          : newParseError(
              `Missing type annotation after parsing ":" token in function arguments for a function expression.`
            )
    );

    consComments(comments);
    checkEofErr('Eof while parsing arguments of a function expression.');

    const defaultValEqToken: optToken = optMatchAdvance('=');

    if (lastHadDefaultVal.had && !isPresent(defaultValEqToken))
      newParseError(
        'Parameters with default values in function expressions can not be followed by other parameteres without default values.'
      );
    if (isPresent(defaultValEqToken)) lastHadDefaultVal.had = true;

    callOnPresent(defaultValEqToken, () => {
      consComments(comments);
      checkEofErr('Eof while parsing arguments of a function expression.');
    });

    const value: optional<expression> = callOnPresent(defaultValEqToken, () =>
      !match(',') // better error message
        ? (parseExpression() as expression)
        : newParseError(
            `Missing expression after parsing "=" token in function parameter expression.`
          )
    );

    const typeAnnotation: hasExplicitType =
      isPresent(colonToken) || isPresent(typeExpression)
        ? {
            hasExplicitType: true,
            typeExpression: typeExpression!,
            colonToken: colonToken!
          }
        : { hasExplicitType: false };

    const defaultValue: funcExprParamDefaultVal =
      isPresent(defaultValEqToken) || isPresent(value)
        ? {
            hasDefaultValue: true,
            defaultValue: value!,
            defaultValueEqualsToken: defaultValEqToken!
          }
        : { hasDefaultValue: false };

    return {
      identifierToken,
      ...typeAnnotation,
      ...defaultValue
    };
  }

  // assert: func token at current point
  function parseFuncExpression(): expression {
    const comments: token[] = [];

    const funcToken: token = advance();

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const openingBracketToken: token = matchAdvOrErr(
      '(',
      'Missing "(" token in function expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const lastHadDefaultVal: { had: boolean } = { had: false };
    const params: argumentList<funcExprParameter> =
      parseArgumentList<funcExprParameter>(
        () => parseFuncExprParams(lastHadDefaultVal, comments),
        ')',
        {
          delimiterToken: ',',
          missingDelimiterError:
            'Missing "," token in argument list of a function expression.'
        },
        { parseComments: true, comments },
        { noEmptyList: false },
        'Missing function argument in function expression.',
        'Eof while parsing function arguments in a function expression.'
      );

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const closingBracketToken: token = matchAdvOrErr(
      ')',
      'Missing ")" token in function expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const colonToken: optToken = optMatchAdvance(':');

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const typeExpression: optional<typeExpression> = callOnPresent(
      colonToken,
      () =>
        !match('=>') // better error message
          ? (parseTypeExpression() as typeExpression)
          : newParseError(
              `Missing type-expression after parsing a ":" token for a return type annotation of a function expression.`
            )
    );

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const arrowToken: token = matchAdvOrErr(
      '=>',
      'Missing "=>" token in a function expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const body: expression = parseExpression() as expression;

    consComments(comments);
    checkEofErr('Eof while parsing a function expression.');

    const returnType: hasExplicitType =
      isPresent(colonToken) || isPresent(typeExpression)
        ? {
            hasExplicitType: true,
            typeExpression: typeExpression!,
            colonToken: colonToken!
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

  function parseMatchBodyLine(hadDefaultLine: { had: boolean }): matchBodyLine {
    const comments: token[] = [];

    consComments(comments);
    checkEofErr('Eof while parsing a match body line expression.');

    // optional, because of default value
    const identifierToken: optToken = matchType(tokenType.identifier)
      ? advance()
      : undefined;

    if (hadDefaultLine.had && !isPresent(identifierToken))
      newParseError(
        'Can not have two default value lines in a match body line expression.'
      );
    else if (hadDefaultLine.had)
      newParseError(
        'Can not have a default match body line, followed by another match body line.'
      );

    if (!isPresent(identifierToken)) hadDefaultLine.had = true;

    consComments(comments);
    checkEofErr('Eof while parsing a match body line expression.');

    const openingBracketToken: optToken = callOnPresent(identifierToken, () =>
      optMatchAdvance('(')
    );

    consComments(comments);
    checkEofErr('Eof while parsing a match body line expression.');

    const params: optional<argumentList<token>> = callOnPresent(
      identifierToken,
      () =>
        callOnPresent(openingBracketToken, () =>
          parseArgumentList<token>(
            () =>
              matchTypeAdvanceOrError(
                tokenType.identifier,
                'Expected identifier in match body line expression.'
              ),
            ')',
            {
              delimiterToken: ',',
              missingDelimiterError:
                'Missing "," token in match body line expression.'
            },
            { parseComments: true, comments },
            { noEmptyList: false },
            'Only identifiers are allowed in match body line expressions.',
            'Eof while parsing a match body line expression arguments.'
          )
        )
    );

    consComments(comments);
    checkEofErr('Eof while parsing arguments of a match expression.');

    const closingBracketToken: optToken = callOnPresent(identifierToken, () =>
      callOnPresent(openingBracketToken, () =>
        matchAdvOrErr(')', 'Missing ")" token in match body line.')
      )
    );

    consComments(comments);
    checkEofErr('Eof while parsing arguments of a match expression.');

    const arrowToken: token = matchAdvOrErr(
      '=>',
      'Missing "=>" token in match expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing arguments of a match expression.');

    const body: expression = !match(',') // better error message
      ? (parseExpression() as expression)
      : newParseError('Missing body in match expression line.');

    const brackets: hasBrackets =
      isPresent(openingBracketToken) || isPresent(closingBracketToken)
        ? {
            hasBrackets: true,
            openingBracketToken: openingBracketToken!,
            closingBracketToken: closingBracketToken!
          }
        : {
            hasBrackets: false
          };

    const identifierOrDefault: matchBodyLinePattern = isPresent(identifierToken)
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
  function parseMatchExpression(): expression {
    const comments: token[] = [];

    const matchToken: token = advance();

    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');

    const argOpeningBracketToken: token = matchAdvOrErr(
      '(',
      'Missing "(" token in match expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');

    const scrutinee: expression = !match(')') // better error message
      ? (parseExpression() as expression)
      : newParseError('Missing body of argument in a match expression.');

    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');

    const argClosingBracketToken: token = matchAdvOrErr(
      ')',
      'Missing ")" for scrutinee in match expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');

    const colonToken: optToken = optMatchAdvance(':');

    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');

    const typeAnnotation: optional<typeExpression> = callOnPresent(
      colonToken,
      () =>
        !match('{') // better error message
          ? (parseTypeExpression() as typeExpression)
          : newParseError(
              'Missing type expression in match expression with ":" annotation.'
            )
    );

    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');

    const bodyOpeningBracketToken: token = matchAdvOrErr(
      '{',
      'Missing "{" token in match expression.'
    );

    // no consumeComments for better local comments
    checkEofErr('Eof while parsing a match expression.');

    const hadDefaultLine: { had: boolean } = { had: false };
    const body: argumentList<matchBodyLine> = parseArgumentList<matchBodyLine>(
      () => parseMatchBodyLine(hadDefaultLine),
      '}',
      {
        delimiterToken: ',',
        missingDelimiterError: 'Missing "," token in match expression.'
      },
      { parseComments: false, globalComments: comments },
      {
        // TODO empty match body allowed for empty complex types?
        noEmptyList: true,
        errorMessage: 'Match expressions with empty bodys are not allowed.'
      },
      'Invalid value in match expression line. The must be structure "id(arg1, arg2, argN) => expr,"',
      'Eof while parsing a match expression.'
    );

    consComments(comments);
    checkEofErr('Eof while parsing a match expression.');

    const bodyClosingBracketToken: token = matchAdvOrErr(
      '}',
      'Missing "}" token in match expression.'
    );

    const explicitType: hasExplicitType =
      isPresent(colonToken) || isPresent(typeAnnotation)
        ? {
            hasExplicitType: true,
            typeExpression: typeAnnotation!,
            colonToken: colonToken!
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
  const parseExprLv0 = () =>
    parseExprLvl(
      precedenceTable[0].symbols,
      precedenceTable[0].arity,
      precedenceTable[0].associativity,
      parseExprLv1
    );
  const parseExprLv1 = () =>
    parseExprLvl(
      precedenceTable[1].symbols,
      precedenceTable[1].arity,
      precedenceTable[1].associativity,
      parseExprLv2
    );
  const parseExprLv2 = () =>
    parseExprLvl(
      precedenceTable[2].symbols,
      precedenceTable[2].arity,
      precedenceTable[2].associativity,
      parseExprLv3
    );
  const parseExprLv3 = () =>
    parseExprLvl(
      precedenceTable[3].symbols,
      precedenceTable[3].arity,
      precedenceTable[3].associativity,
      parseExprLv4
    );
  const parseExprLv4 = () =>
    parseExprLvl(
      precedenceTable[4].symbols,
      precedenceTable[4].arity,
      precedenceTable[4].associativity,
      parseExprLv5
    );
  const parseExprLv5 = () =>
    parseExprLvl(
      precedenceTable[5].symbols,
      precedenceTable[5].arity,
      precedenceTable[5].associativity,
      parseExprLv6
    );
  const parseExprLv6 = () =>
    parseExprLvl(
      precedenceTable[6].symbols,
      precedenceTable[6].arity,
      precedenceTable[6].associativity,
      parseExprLv7
    );
  const parseExprLv7 = () =>
    parseExprLvl(
      precedenceTable[7].symbols,
      precedenceTable[7].arity,
      precedenceTable[7].associativity,
      parseExprLv8
    );
  const parseExprLv8 = () =>
    parseExprLvl(
      precedenceTable[8].symbols,
      precedenceTable[8].arity,
      precedenceTable[8].associativity,
      parseExprLv9
    );
  const parseExprLv9 = () =>
    parseExprLvl(
      precedenceTable[9].symbols,
      precedenceTable[9].arity,
      precedenceTable[9].associativity,
      parseExprLv10
    );
  // #endregion
  // #endregion
  // #endregion

  // assert: not eof
  function parseStatement(): statement | parseError {
    if (isAtEnd())
      throw new Error(
        'Internal parser error: assertion not met. Code is eof but tried to parse a statement.'
      );

    const comments: token[] = [];
    consComments(comments);

    if (isAtEnd() && comments.length !== 0)
      return { type: 'comment', comments };

    // use those comments for the next statement if not at end
    // and if nothing matches (no next statement), return these at the end

    // check if current token matches some statements signature

    if (match('let')) {
      const letToken: token = advance();

      consComments(comments);
      checkEofErr('Eof in let-statement.');

      const identifierToken: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'Missing identifier in let-statement.'
      );

      consComments(comments);
      checkEofErr('Eof in let statement, after parsing the identifier.');

      const genericOpeningBracketToken: optToken = optMatchAdvance('[');

      consComments(comments);
      checkEofErr(
        'Eof after getting opening bracket for generic in let statement.'
      );

      const genericIdentifiers: optional<argumentList<token>> = callOnPresent(
        genericOpeningBracketToken,
        () =>
          parseArgumentList<token>(
            () =>
              matchTypeAdvanceOrError(
                tokenType.identifier,
                'Did not match an identifier in generic let-statement.'
              ),
            ']',
            {
              delimiterToken: ',',
              missingDelimiterError:
                'Missing "," token in generic let-statement declaration.'
            },
            { parseComments: true, comments },
            {
              noEmptyList: true,
              errorMessage:
                'Must have identifiers in generic let-statement list.'
            },
            'Missing identifier in generic let-statement.',
            'Unexpected eof in generic let-statement before parsing "]".'
          )
      );

      consComments(comments);
      checkEofErr('Eof in generic let-statement.');

      const genericClosingBracketToken: optToken = callOnPresent(
        genericOpeningBracketToken,
        () =>
          matchAdvOrErr(
            ']',
            'Missing closing bracket in generic let-statement declaration.'
          )
      );

      consComments(comments);
      checkEofErr('Eof after parsing "]" in generic let-statement.');

      const colonToken: optToken = optMatchAdvance(':');

      consComments(comments);
      checkEofErr('Eof in let-statement after parsing ":".');

      const typeAnnotation: optional<typeExpression> = callOnPresent(
        colonToken,
        () =>
          !match('=') // better error message
            ? (parseTypeExpression() as typeExpression)
            : newParseError(
                'Missing type annotation in let-statement after parsing ":".'
              )
      );

      consComments(comments);
      checkEofErr('Eof in let-statement. Expecting a "=" lexeme.');

      const equalsToken: token = matchAdvOrErr(
        '=',
        'Missing "=" token in let-statement.'
      );

      consComments(comments);
      checkEofErr('Eof in let-statement after parsing an "=" token.');

      const body: expression = !match(';') // better error message
        ? (parseExpression() as expression)
        : newParseError('Missing main body in let-expression.');

      consComments(comments);
      checkEofErr('Eof in let-statement.');

      const semicolonToken: token = matchAdvOrErr(
        ';',
        'Let-statements must be finished by a semicolon.'
      );

      const explicitType: hasExplicitType =
        isPresent(colonToken) || isPresent(typeAnnotation)
          ? {
              hasExplicitType: true,
              typeExpression: typeAnnotation!,
              colonToken: colonToken!
            }
          : {
              hasExplicitType: false
            };

      const genericAnnotation: genericAnnotation =
        isPresent(genericOpeningBracketToken) ||
        isPresent(genericClosingBracketToken) ||
        isPresent(genericIdentifiers)
          ? {
              isGeneric: true,
              genericIdentifiers: genericIdentifiers!,
              genericOpeningBracketToken: genericOpeningBracketToken!,
              genericClosingBracketToken: genericClosingBracketToken!
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
      const typeToken: token = advance();

      consComments(comments);
      checkEofErr('Eof in type-statement.');

      const identifierToken: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'Missing identifier in type-statement.'
      );

      consComments(comments);
      checkEofErr(
        'Eof after parsing an identifier token for a type-statement.'
      );

      const genericOpeningBracketToken: optToken = optMatchAdvance('[');

      consComments(comments);
      checkEofErr('Eof after parsing "[" in type-statement.');

      const genericIdentifiers: optional<argumentList<token>> = callOnPresent(
        genericOpeningBracketToken,
        () =>
          parseArgumentList<token>(
            () =>
              matchTypeAdvanceOrError(
                tokenType.identifier,
                'Invalid token in generic type-statement.'
              ),
            ']',
            {
              delimiterToken: ',',
              missingDelimiterError:
                'Missing "," token in generic type-statement.'
            },
            { parseComments: true, comments },
            {
              noEmptyList: true,
              errorMessage:
                'Must have identifiers in generic type-statement list'
            },
            'Invalid token in generic type-statement.',
            'Eof in generic type-statement.'
          )
      );

      consComments(comments);
      checkEofErr('Eof while parsing a type-statement.');

      const genericClosingBracketToken: optToken = callOnPresent(
        genericOpeningBracketToken,
        () =>
          matchAdvOrErr(
            ']',
            'Missing closing bracket in generic type-statement.'
          )
      );

      consComments(comments);
      checkEofErr('Eof while parsing a type-statement.');

      const generic: genericAnnotation =
        isPresent(genericOpeningBracketToken) ||
        isPresent(genericClosingBracketToken) ||
        isPresent(genericIdentifiers)
          ? {
              isGeneric: true,
              genericIdentifiers: genericIdentifiers!,
              genericOpeningBracketToken: genericOpeningBracketToken!,
              genericClosingBracketToken: genericClosingBracketToken!
            }
          : { isGeneric: false };

      if (match('=')) {
        const equalsToken: token = advance();

        consComments(comments);
        checkEofErr('Eof in type-alias-statement after "=" token.');

        const body: typeExpression = !match(';') // better error message
          ? (parseTypeExpression() as typeExpression)
          : newParseError('Missing type-expression in type-alias-statement.');

        consComments(comments);
        checkEofErr('Eof in type-statement.');

        const semicolonToken: token = matchAdvOrErr(
          ';',
          'Eof in type-statement.'
        );

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
        const openingBracketToken: token = advance();

        // no consumeComments for better local comments
        checkEofErr('Eof after parsing "{" token in complex-type-statement.');

        const body: argumentList<complexTypeLine> =
          parseArgumentList<complexTypeLine>(
            parseComplexeTypeLine,
            '}',
            {
              delimiterToken: ',',
              missingDelimiterError:
                'Missing "," token in complex-type-statement body.'
            },
            { parseComments: false, globalComments: comments },
            { noEmptyList: false },
            'Invalid or missing argument in complex-type body.',
            'Eof inside complex-type-statement.'
          );

        consComments(comments);
        checkEofErr('Eof in complex-type-statement.');

        const closingBracketToken: token = matchAdvOrErr(
          '}',
          'Missing "}" token in complex-type-statement.'
        );

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

      return newParseError(
        'Invalid type-statement: cannot resolve which type it should be. Missing "=" or "{" tokens.'
      );
    }

    if (match('group')) {
      const groupToken: token = advance();

      consComments(comments);
      checkEofErr('Eof in group-statement.');

      const identifierToken: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'Missing identifier in group-statement.'
      );

      consComments(comments);
      checkEofErr('Eof group-statement after parsing an identifier.');

      const openingBracketToken: token = matchAdvOrErr(
        '{',
        'Missing "{" token in group-statement.'
      );

      // no consume comments or eof check for better local comments

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) {
        const statement: statement | parseError = parseStatement();
        if (statement.type === 'error') break; // handled somewhere else
        if (statement.type === 'import')
          newParseError('Use-statements must be outside of a group-statement.');
        body.push(statement);
      }

      checkEofErr('Eof in group-statement before parsing a "}".');

      const closingBracketToken: token = matchAdvOrErr(
        '}',
        'Missing "}" in group-statement.'
      );

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
      const useToken: token = advance();

      consComments(comments);
      checkEofErr('Eof in use-statement.');

      const filename: token = matchTypeAdvanceOrError(
        tokenType.identifier,
        'Missing identifier in use-statement.'
      );

      consComments(comments);
      checkEofErr('Eof in use-statement before parsing a ";" token.');

      const semicolonToken: token = matchAdvOrErr(
        ';',
        'Missing ";" token in use-statement.'
      );

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

  function parseExpression(): expression | parseError {
    return parseExprLv0();
  }

  // TYPE -> TYPE // func
  // ( ) -> TYPE // func, empty grouping: must be arg list
  // ( TYPE { , TYPE }*  { , }? ) -> TYPE // func
  function parseTypeExpression(): typeExpression | parseError {
    return parseTypeExpLv0();
  }
  // #endregion

  export function parse(
    code: string,
    comments: { ignoreComments: boolean } = { ignoreComments: false }
  ):
    | { valid: true; statements: statement[] }
    | { valid: false; parseErrors: parseError[]; statements: statement[] } {
    parseErrors.splice(0, parseErrors.length); // remove all previous elements
    larser = new Larser(code, comments.ignoreComments); // can throw an error at this point

    const statements: statement[] = [];

    while (!isAtEnd()) {
      try {
        const statement: statement | parseError = parseStatement();
        if (statement.type === 'error') break; // stop parsing then
        statements.push(statement);
      } catch (error) {
        if (error === 'eof') return { valid: false, parseErrors, statements };
        else
          throw new Error(
            `Error while parsing the code "${code}"\nInternal parsing error: ${JSON.stringify(
              error
            )}`
          );
      }
    }

    return parseErrors.length === 0
      ? { valid: true, statements }
      : { valid: false, parseErrors, statements };
  }
}
