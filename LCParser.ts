import { Lexer } from './LCLexer';
// @ts-ignore
import { inspect } from 'util';

const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

// #region lexer code for the parser
class Larser {
  private code: string;
  private lexer: Generator<Lexer.nextToken>;

  private state:
    | { eof: false; currentToken: Lexer.token }
    | { eof: true; currentToken: undefined };

  constructor(code: string) {
    this.code = code;
    this.lexer = Lexer.lexeNextTokenIter(code);

    this.state = { eof: false, currentToken: undefined as any };
    this.advanceToken();
    if (this.state.eof === false && this.state.currentToken === undefined)
      throw new Error(
        'Internal error, could not lexe the very first token correctly in the parsing step.'
      );
  }

  public isEof(): boolean {
    return this.state.eof;
  }

  // assertion: not eof
  public getCurrentToken(): Lexer.token {
    if (this.isEof())
      throw new Error(
        'Internal error while parsing. Tried getting the current token, even tho the code is eof.'
      );

    return this.state.currentToken!;
  }

  // assertion: not eof
  public advanceToken(): void {
    if (this.isEof())
      throw new Error(
        'Internal error while parsing. Tried advancing to next token, even tho the code is eof.'
      );

    // this.previousToken = this.currentToken;

    const lexerNext: IteratorResult<Lexer.nextToken, Lexer.nextToken> =
      this.lexer.next();
    const lexerNextValue: Lexer.nextToken = lexerNext.value;

    const lexerIsNotDone: boolean = lexerNext.done === false;
    const eof: boolean =
      lexerIsNotDone &&
      !lexerNextValue.valid &&
      lexerNextValue.value.type === 'eof';

    // TODO maybe repeat if "soft error": !value.valid but also !value.codeInvalid
    if (!eof && lexerNextValue.valid)
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

    // TODO
    console.error(tokens);
    throw '';
  }
}
// #endregion

export namespace Parser {
  const parseErrors: parseError[] = [];
  let larser: Larser;

  // #region types
  type comment = { comments: lexToken[] };

  // #region stmt
  export type statement = comment &
    (
      | { type: 'comment' }
      | { type: 'empty'; semicolonToken: lexToken }
      | {
          type: 'group';
          identifierToken: lexToken;
          body: statement[];
          groupToken: lexToken;
          openingBracketToken: lexToken;
          closingBracketToken: lexToken;
        }
      | {
          type: 'import';
          localFileName: lexToken;
          useToken: lexToken;
          semicolonToken: lexToken;
        }
      | ({
          type: 'let';
          identifierToken: lexToken;
          body: expression & comment;
          letToken: lexToken;
          equalsToken: lexToken;
          semicolonToken: lexToken;
        } & hasExplicitType &
          genericAnnotation)
      | {
          type: 'type-alias';
          identifierToken: lexToken;
          typeValue: typeExpression;
          typeToken: lexToken;
          equalsToken: lexToken;
          semicolonToken: lexToken;
        }
      | {
          type: 'complex-type';
          identifierToken: lexToken;
          // TODO each branch in complexe type statement should get its own comments in the formatter/prettier
          typeValue: complexTypeValue[];
          typeToken: lexToken;
          openingBracketToken: lexToken;
          closingBracketToken: lexToken;
        }
    );

  type complexTypeValue = {
    identifierToken: lexToken;
    parameters: {
      typeIdentifierToken: lexToken;
      commaToken: optLexToken;
    }[]; // TODO when brackets are not present, then no parameters can be there
    openingBracketToken: optLexToken;
    closingBracketToken: optLexToken /*TODO if has opening bracket, then must have closing bracket or vice versa*/;
    commaToken: optLexToken;
    // comments: lexTokenType[] // TODO, add for better formatting
  };

  type genericAnnotation =
    | { isGeneric: false }
    | {
        isGeneric: true;
        genericIdentifiers: {
          identifierToken: lexToken;
          commaToken: optLexToken;
        }[];
        genericOpeningBracketToken: lexToken;
        genericClosingBracketToken: lexToken;
      };
  // #endregion

  // #region expr
  // match, func, "nan", "inf", literals
  // TODO each branch in match expression should get its own comments in the formatter/prettier
  export type expression =
    | {
        type: 'literal';
        literalType: 'i32';
        literal: number;
        literalToken: lexToken;
      }
    | {
        type: 'literal';
        literalType: 'f32';
        literal: number;
        literalToken: lexToken;
      }
    | { type: 'identifier'; identifierToken: lexToken }
    | funcExpression
    | {
        type: 'grouping';
        body: expression;
        openingBracketToken: lexToken;
        closingBracketToken: lexToken;
      }
    | {
        type: 'unary';
        operator: string;
        body: expression;
        operatorToken: lexToken;
      }
    | {
        type: 'binary';
        operator: string;
        leftSide: expression;
        rightSide: expression;
        operatorToken: lexToken;
      }
    | {
        type: 'propertyAccess';
        source: expression;
        propertyToken: lexToken;
        dotToken: lexToken;
      }
    | {
        type: 'functionCall';
        function: expression;
        arguments: {
          argumentExpression: expression;
          commaToken: optLexToken;
        }[];
        openingBracketToken: lexToken;
        closingBracketToken: lexToken;
      }
    | { type: 'match' /*TODO, put in comments[] for each and every branch!*/ };

  export type funcExpression = {
    type: 'func';
    parameters: {
      identifierToken: lexToken;
      typeExpression: typeExpression;
      colonToken: optLexToken /*colon for type annotation*/;
      commaToken: optLexToken /*comma for next param*/;
    }[];
    body: expression;
    funcToken: lexToken;
    openingBracketToken: lexToken;
    closingBracketToken: lexToken;
    arrowToken: lexToken;
  } & hasExplicitType;
  // #endregion

  // #region types
  // TODO generics?, wab propertAccess of complex types?
  export type typeExpression = comment &
    (
      | { type: 'implicit' }
      | {
          type: 'primitive-type';
          primitiveToken: lexToken; // keyword like i32/f32 or generic identifier/type identifier
        }
      | {
          type: 'func-type';
          parameters: {
            typeExpression: typeExpression;
            commaToken: optLexToken;
          }[];
          returnType: typeExpression;
          openingBracketToken: optLexToken;
          closingBracketToken: optLexToken;
          arrowToken: lexToken;
        }
      | {
          type: 'grouping';
          body: typeExpression;
          openingBracketToken: lexToken;
          closingBracketToken: lexToken;
        }
    );

  type hasExplicitType =
    | {
        explicitType: true;
        typeExpression: typeExpression;
        colonToken: lexToken;
      }
    | {
        explicitType: false;
        typeExpression: typeExpression;
      };
  // #endregion

  export type parseError =
    | string
    | { type: 'error'; value: any; currentToken: optLexToken };
  // #endregion

  // #region helper
  type optional<T> = T | undefined;

  type lexToken = Lexer.token;
  type optLexToken = optional<lexToken>;
  type lexTokenType = Lexer.tokenType;
  const lexTokenType: typeof Lexer.tokenType = Lexer.tokenType;

  type argumentList<T> = {
    argument: T;
    delimiterToken: optLexToken;
  }[];

  // #region traditional
  function isAtEnd(): boolean {
    return larser.isEof();
  }

  // returns the current token
  function peek(): optLexToken {
    if (isAtEnd()) return undefined; // TODO shouldnt it just crash if that happens? invalid internal code, same with advance()
    return larser.getCurrentToken();
  }

  // returns the current token and advances to the next token
  function advance(): optLexToken {
    if (isAtEnd()) return undefined;

    const currentToken: optLexToken = peek();
    larser.advanceToken();
    return currentToken;
  }

  // returns if the current token matches the tokens
  function match(...tokens: string[]): boolean {
    const currentToken: optLexToken = peek();
    return isPresent(currentToken) && tokens.includes(currentToken.lexeme);
  }

  // returns if the current token type matches the tokenTypes
  function matchType(...tokenTypes: lexTokenType[]): boolean {
    const currentToken: optLexToken = peek();
    return isPresent(currentToken) && tokenTypes.includes(currentToken.type);
  }
  // #endregion

  // #region functional
  function consumeComments(comments: lexToken[]): void {
    while (!isAtEnd() && matchType(lexTokenType.comment))
      comments.push(advance()!);
  }

  function newParseError(arg: parseError): never {
    parseErrors.push({ type: 'error', value: arg, currentToken: peek() });
    return { type: 'error', parserError: arg } as never;
  }

  function checkEofWithError(errorOnEof: string): void {
    if (isAtEnd())
      throw (
        (newParseError('Invalid eof while parsing code: ' + errorOnEof),
        parseErrors)
      );
    // TODO not throw, BUT eof is the very last thing in the code: so could now check all the errors

    // should print out all errors in a formatted way, aswell as the eof error
    // then stop the program *but* then the parser would have to import logger...
  }

  // return advace on match else error
  function matchAdvanceOrError(
    token: string,
    error: parseError
  ): lexToken | never {
    return match(token) ? advance()! : newParseError(error);
  }

  // return advance on match type else error
  function matchTypeAdvanceOrError(
    tokenType: lexTokenType,
    error: parseError
  ): lexToken | never {
    return matchType(tokenType) ? advance()! : newParseError(error);
  }

  // return advance on match
  function optionalMatchAdvance(token: string): optLexToken {
    return match(token) ? advance()! : undefined;
  }

  function isPresent<T>(value: T | undefined): value is NonNullable<T> {
    return value !== undefined;
  }

  // calls the callback function if and only if present is not undefined
  function callOnPresent<T, U>(
    present: undefined,
    callBack: () => T
  ): undefined;
  function callOnPresent<T, U>(present: NonNullable<U>, callBack: () => T): T;
  function callOnPresent<T, U>(present: U, callBack: () => T): optional<T>;
  function callOnPresent<T, U>(
    present: undefined | NonNullable<U> | U,
    callBack: () => T
  ): optional<T> {
    return isPresent(present) ? callBack() : undefined;
  }

  function parseArgumentList<T>(
    closingBracket: string,
    delimiter: optional<string>,
    parseArgument: () => T,
    comments: lexToken[],
    invalidArgumentError: string = 'could not parse a valid argument',
    missingDelimiterError: string = 'missing comma token while parsing arguments',
    eofError: string = 'unexpected eof while parsing arguments'
  ): argumentList<T> {
    const argumentList: argumentList<T> = [];

    consumeComments(comments);

    while (!isAtEnd() && !match(closingBracket)) {
      const currentTokenDebug: lexToken = peek()!;

      consumeComments(comments);

      checkEofWithError(eofError);

      if (
        isPresent(delimiter) &&
        argumentList.length !== 0 &&
        !isPresent(argumentList[argumentList.length - 1].delimiterToken)
      )
        newParseError(missingDelimiterError);

      const argument: T = parseArgument();

      consumeComments(comments);

      checkEofWithError(eofError);

      const delimiterToken: optLexToken = isPresent(delimiter)
        ? optionalMatchAdvance(delimiter)
        : undefined;

      argumentList.push({ argument, delimiterToken });

      consumeComments(comments);

      checkEofWithError(eofError);

      if (!iterationAdvanced(currentTokenDebug, invalidArgumentError)) break;
    }

    checkEofWithError(eofError);

    return argumentList;
  }

  function iterationAdvanced(
    curTokenBeforeLoopIter: lexToken,
    errorMsgOnSameToken: parseError = 'TODO same token'
  ): boolean {
    if (isPresent(peek()) && curTokenBeforeLoopIter.idx === peek()!.idx)
      return newParseError(errorMsgOnSameToken), false;
    return true;
  }
  // #endregion

  // #endregion

  // #region parser
  // TODO comments could be ANYWHERE, just aswell as a bad eof
  // TODO test with real code, but insert a comment between each and every token!
  // TODO check everywhere isAtEnd() and comments
  function parseStatement(): statement {
    if (isAtEnd())
      throw new Error(
        'Internal Parser error. Tried to parse a statement at eof.'
      );

    const comments: lexToken[] = [];
    consumeComments(comments);

    if (isAtEnd() && comments.length !== 0)
      // else use those comments for the next statement
      // and if nothing matches, return these
      return { type: 'comment', comments };

    if (match(';')) {
      const semicolonToken: lexToken = advance()!;
      return { type: 'empty', semicolonToken, comments };
    }

    if (match('use')) {
      const useToken: lexToken = advance()!;

      consumeComments(comments);

      checkEofWithError('no use body in use statement');

      const localFileName: lexToken = matchTypeAdvanceOrError(
        lexTokenType.identifier,
        'did not get an identifier in use statement'
      );

      consumeComments(comments);

      checkEofWithError('unexpected eof in use statement: missing semicolon');

      const semicolonToken: lexToken = matchAdvanceOrError(
        ';',
        'TODO did not get semicolon in a use statement'
      );

      return {
        type: 'import',
        localFileName,
        useToken,
        semicolonToken,
        comments
      };
    }

    if (match('group')) {
      const groupToken: lexToken = advance()!;

      consumeComments(comments);

      checkEofWithError('unexpected eof in group statement');

      const identifierToken: lexToken = matchTypeAdvanceOrError(
        lexTokenType.identifier,
        'TODO can not have an undefined identifier for a group statement'
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in group statement after getting an identifier'
      );

      const openingBracketToken: lexToken = matchAdvanceOrError(
        '{',
        'TODO cant have a group statement without an opening brackt "{"'
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in group statement after the opening bracket'
      );

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) {
        const currentTokenDebug: lexToken = peek()!;

        body.push(parseStatement());

        if (
          !iterationAdvanced(
            currentTokenDebug,
            'TODO did not match a statement in group statement'
          )
        )
          break;
      }
      checkEofWithError('unexpected eof in group statement');
      const closingBracketToken: lexToken = matchAdvanceOrError(
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

    // add generics
    if (match('let')) {
      const letToken: lexToken = advance()!;

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement');

      const identifierToken: lexToken = matchTypeAdvanceOrError(
        lexTokenType.identifier,
        'TODO cant have an undefined identifier for a let statement'
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in let statement after asuming an identifier'
      );

      const genericOpeningBracketToken: optLexToken = optionalMatchAdvance('[');

      const isGeneric: boolean = isPresent(genericOpeningBracketToken);

      consumeComments(comments);

      checkEofWithError(
        'error after getting opening bracket for generic in let statement'
      );

      // TODO error messages aso
      const argumentList: optional<argumentList<lexToken>> = isGeneric
        ? parseArgumentList(
            ']',
            ',',
            () =>
              matchTypeAdvanceOrError(
                lexTokenType.identifier,
                'did not match an identifier in generic let statement'
              ),
            comments,
            'did not match an identifier in generic let statement',
            'missing comma token in generic let statement declaration',
            'unexpected eof in generic let statement'
          )
        : undefined;

      // TODO HERE NOW generics at this step
      const genericIdentifiers: optional<
        {
          identifierToken: lexToken;
          commaToken: optLexToken;
        }[]
      > = isGeneric
        ? argumentList?.map((e) => ({
            identifierToken: e.argument,
            commaToken: e.delimiterToken
          }))
        : undefined;

      if (
        isGeneric &&
        (!isPresent(genericIdentifiers) || genericIdentifiers.length === 0)
      )
        newParseError('missing generic token values in generic let statement');

      const genericClosingBracketToken: optLexToken = isGeneric
        ? matchAdvanceOrError(
            ']',
            'missing closing bracket in generic let statement declaration'
          )
        : undefined;

      consumeComments(comments);

      checkEofWithError(
        'error after getting closing bracket for generic in let statement'
      );

      const colonToken: optLexToken = optionalMatchAdvance(':');

      consumeComments(comments);

      callOnPresent(colonToken, () =>
        checkEofWithError('unexpected eof in let statement after getting ":"')
      );

      const typeAnnotation: optional<typeExpression> = callOnPresent(
        colonToken,
        () => {
          /*if for better error messages*/
          if (!match('=')) return parseTypeExpression();
        }
      );

      callOnPresent(colonToken, () => {
        if (!isPresent(typeAnnotation))
          newParseError(
            'missing type annotation in let statement after getting a ":"'
          );
      });

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in let statement while expecting a "="'
      );

      const equalsToken: lexToken = matchAdvanceOrError(
        '=',
        'TODO cant have a let statement without a "=" symbol'
      );

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement after "="');

      const body: expression & comment = !match(';') /*better error messages*/
        ? parseExpression()
        : newParseError('TODO no body in let expression');

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement');

      const semicolonToken: lexToken = matchAdvanceOrError(
        ';',
        'TODO let statements must be finished with a ";" symbol'
      );

      const explicitType: hasExplicitType = isPresent(colonToken)
        ? {
            explicitType: true,
            typeExpression: typeAnnotation!,
            colonToken
          }
        : {
            explicitType: false,
            typeExpression: { type: 'implicit', comments: [] }
          };

      const genericAnnotation: genericAnnotation = isGeneric
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

    // NOW, TODO add generics
    if (match('type')) {
      const typeToken: lexToken = advance()!;

      consumeComments(comments);

      checkEofWithError('TODO nothing after type keyword');

      const identifierToken: lexToken = matchTypeAdvanceOrError(
        lexTokenType.identifier,
        'TODO invalid type expression: missing identifier'
      );

      consumeComments(comments);

      checkEofWithError('Nothing after identifier token in type expression');

      const genericOpeningBracketToken: optLexToken = optionalMatchAdvance('[');
      const isGeneric: boolean = isPresent(genericOpeningBracketToken);

      consumeComments(comments);
      checkEofWithError('TODO');

      const argumentList: any[] = [];

      consumeComments(comments);
      checkEofWithError('TODO');

      // TODO add generic
      const genericClosingBracketToken: optLexToken = undefined;

      if (match('=')) {
        const equalsToken: lexToken = advance()!;

        consumeComments(comments);

        checkEofWithError('got nothing after "=" in type statement');

        // TODO refactor but how??
        const typeValue: typeExpression | undefined = !match(';') // better error messages
          ? parseTypeExpression()
          : undefined;

        if (!isPresent(typeValue))
          newParseError('got no type expression in type alias');

        consumeComments(comments);

        checkEofWithError('TODO got nothing after type expression');

        const semicolonToken: lexToken = matchAdvanceOrError(
          ';',
          'TODO did not finish the type expression'
        );

        return {
          type: 'type-alias',
          identifierToken,
          typeValue,
          typeToken,
          equalsToken,
          semicolonToken,
          comments
        };
      } else if (match('{')) {
        const openingBracketToken: lexToken = advance()!;

        consumeComments(comments);

        const localComments: [] = []; // TODO add special comments to each complex type
        const typeValue: complexTypeValue[] = [];
        while (!isAtEnd() && !match('}')) {
          const currentTokenDebug: lexToken = peek()!;

          consumeComments(comments);

          checkEofWithError(
            'TODO invalid empty body in complex type expression'
          );

          if (
            typeValue.length !== 0 &&
            !isPresent(typeValue[typeValue.length - 1].commaToken)
          )
            newParseError('TODO, missing comma in complex type body');

          typeValue.push(parseComplexeTypeLine());

          if (!iterationAdvanced(currentTokenDebug)) break;
        }
        checkEofWithError('eof in complex type statement');
        const closingBracketToken: lexToken = matchAdvanceOrError(
          '}',
          'TODO internal error'
        )!;

        return {
          type: 'complex-type',
          identifierToken,
          typeValue,
          typeToken,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }

      return newParseError(
        'TODO invalid type expression: cannot resolve which type it should be. Missing "=" or "{"'
      );

      // TODO NOW comments and eof
      function parseComplexeTypeLine(): complexTypeValue {
        consumeComments(comments);

        checkEofWithError(
          'Invalid eof while parsing a line in a complex type statement'
        );

        const identifierToken: lexToken = matchTypeAdvanceOrError(
          lexTokenType.identifier,
          'TODO invalid complex type statement: missing identifier'
        );

        consumeComments(comments);

        checkEofWithError(
          'Invalid eof while parsing a line in a complex type statement, after getting an identifier'
        );

        const openingBracketToken: optLexToken = optionalMatchAdvance('(');

        consumeComments(comments);

        checkEofWithError(
          'Invalid eof in complex type statement after getting a "("'
        );

        const parameters: {
          typeIdentifierToken: lexToken;
          commaToken: optLexToken;
        }[] = [];
        // TODO endless loop because if no `)` in the code, then it wont advance further?
        while (isPresent(openingBracketToken) && !isAtEnd() && !match(')')) {
          const currentTokenDebug: lexToken = peek()!;

          consumeComments(comments);

          checkEofWithError(
            'TODO invalid eof while parsing arguments from a complex type line'
          );

          if (
            parameters.length !== 0 &&
            !isPresent(parameters[parameters.length - 1].commaToken)
          )
            newParseError(
              'TODO missing comma between two parameters in complex type value'
            );

          const typeIdentifierToken: lexToken =
            matchType(lexTokenType.identifier) || match('i32') || match('f32')
              ? advance()!
              : newParseError('TODO invalid expression in complex type value');

          consumeComments(comments);

          const commaToken: optLexToken = optionalMatchAdvance(',');

          parameters.push({
            typeIdentifierToken,
            commaToken
          });

          if (!iterationAdvanced(currentTokenDebug)) break;
        }

        const closingBracketToken: optLexToken = matchAdvanceOrError(
          ')',
          'TODO missing closing bracket in complex type'
        );

        consumeComments(comments);

        checkEofWithError(
          'Invalid eof at the end of a complex type expression'
        );

        // TODO what about `type Test { id id id, id id };`
        if (
          !(
            (isPresent(openingBracketToken) &&
              isPresent(closingBracketToken)) ||
            (!isPresent(openingBracketToken) && !isPresent(closingBracketToken))
          )
        )
          newParseError('TODO missing brackets in complexe type');

        const commaToken: optLexToken = optionalMatchAdvance(',');

        return {
          identifierToken,
          parameters,
          openingBracketToken,
          closingBracketToken,
          commaToken
        };
      }
    }

    if (comments.length !== 0)
      // if consumed comments above and no other thing matched
      // then return the comments as its own thing
      // probably this case: group g { /*comment*/ }
      return { type: 'comment', comments };

    // TODO need to advance() maybe for not getting stuck into a loop?
    return newParseError('TODO could not parse any statement properly');
  }

  // TODO add comments and isAtEnd() support
  function parseExpression(): expression & comment {
    const comments: lexToken[] = [];

    function parseExprLvl0(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl1();
      consumeComments(comments);

      // TODO isAtEnd() and consumeComment()
      while (match('|')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl1();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl1(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl2();
      consumeComments(comments);

      while (match('^')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl2();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl2(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl3();
      consumeComments(comments);

      while (match('&')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl3();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl3(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl4();
      consumeComments(comments);

      while (match('==', '!=')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl4();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl4(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl5();
      consumeComments(comments);

      while (match('<', '>', '<=', '>=')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl5();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl5(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl6();
      consumeComments(comments);

      while (match('<<', '>>')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl6();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl6(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl7();
      consumeComments(comments);

      while (match('-', '+')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl7();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl7(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl8();
      consumeComments(comments);

      while (match('*', '/', '%')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl8();
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl8(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl9();
      consumeComments(comments);

      // right to left precedence:
      // if because precedence order
      if (match('**', '***')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const rightSide: expression = parseExprLvl8(); // TODO right? same level because precedence order
        consumeComments(comments);

        leftSide = {
          type: 'binary',
          operator: operatorToken.lexeme,
          leftSide,
          rightSide,
          operatorToken
        };
      }

      return leftSide;
    }

    function parseExprLvl9(): expression {
      // unary:
      if (match('!', '-', '+', '~')) {
        const operatorToken: lexToken = advance()!;
        consumeComments(comments);
        const body: expression = parseExprLvl9(); // same level?? TODO
        consumeComments(comments);

        return {
          type: 'unary',
          operator: operatorToken.lexeme,
          body,
          operatorToken
        };
      }

      return parseExprLvl10();
    }

    // TODO debug and consumeComments(comments)/isAtEnd()
    function parseExprLvl10(): expression {
      consumeComments(comments);
      let left: expression = primary();
      consumeComments(comments);

      while (match('(', '.')) {
        const token: lexToken = advance()!;

        if (token.lexeme === '.') {
          // f.
          const propertyToken: lexToken = matchTypeAdvanceOrError(
            lexTokenType.identifier,
            'TODO invalid property access'
          );

          // TODO error: what about having e.g. just a `5` for propertyToken
          // wrong error rn...

          left = {
            type: 'propertyAccess',
            source: left,
            propertyToken,
            dotToken: token
          };
        } else {
          //   f(
          const args: {
            argumentExpression: expression;
            commaToken: optLexToken;
          }[] = [];
          // TODO what about error messages for `(5,,)`
          while (!isAtEnd() && !match(')')) {
            const currentTokenDebug: lexToken = peek()!;

            // if last was not comma
            if (
              args.length !== 0 &&
              !isPresent(args[args.length - 1].commaToken)
            )
              newParseError(
                'TODO, missing comma in function call argument list'
              );

            consumeComments(comments);

            const argumentExpression: expression = parseExpression();

            consumeComments(comments);

            const commaToken: optLexToken = optionalMatchAdvance(',');

            args.push({ argumentExpression, commaToken });

            if (!iterationAdvanced(currentTokenDebug)) break;
          }

          checkEofWithError('Had eof in function calling expression');
          const closingBracketToken: lexToken = matchAdvanceOrError(
            ')',
            'TODO internal error'
          );
          left = {
            type: 'functionCall',
            function: left,
            arguments: args,
            openingBracketToken: token,
            closingBracketToken
          };
        }
      }

      return left;
    }

    // TODO, parse literals, highest precedence level
    function primary(): expression {
      // TODO error if numeric literal is out of bounce
      function floatLiteralToFloat(literal: string): number {
        return literal === 'inf' ? Infinity : Number(literal);
      }

      function intLiteralToInt(literal: string): number {
        return Number(literal);
      }

      consumeComments(comments);

      if (match('(')) {
        const openingBracketToken: lexToken = advance()!;
        consumeComments(comments);
        // TODO isEof checks
        const body: expression = parseExpression();
        consumeComments(comments);
        const closingBracketToken: lexToken = matchAdvanceOrError(
          ')',
          'TODO did not close bracket in grouping expression'
        );

        consumeComments(comments);

        return {
          type: 'grouping',
          body,
          openingBracketToken,
          closingBracketToken
        };
      } else if (matchType(lexTokenType.literal)) {
        const literalToken: lexToken = advance()!;

        consumeComments(comments);

        const lexeme: string = literalToken.lexeme;
        const literalType: 'i32' | 'f32' =
          lexeme.includes('.') ||
          (!lexeme.startsWith('0x') && lexeme.includes('e')) ||
          lexeme === 'inf' ||
          lexeme === 'nan'
            ? 'f32'
            : 'i32';
        const literal: number =
          literalType === 'i32'
            ? intLiteralToInt(lexeme)
            : floatLiteralToFloat(lexeme);

        return {
          type: 'literal',
          literalType,
          literal,
          literalToken
        };
      } else if (matchType(lexTokenType.identifier)) {
        const identifierToken: lexToken = advance()!;
        consumeComments(comments);
        return {
          type: 'identifier',
          identifierToken
        };
      } else if (match('func')) return parseFuncExpression();
      else if (match('match')) return parseMatchExpression();

      consumeComments(comments);

      return newParseError(
        'TODO could not match anything in parsing expressions'
      );
    }

    function parseFuncExpression(): expression {
      if (!match('func'))
        throw new Error(
          'Internal error, called this function, even tho here is no function'
        );

      function parseFuncExprParam(): {
        identifierToken: lexToken;
        typeExpression: typeExpression;
        colonToken: optLexToken /*colon for type annotation*/;
        commaToken: optLexToken;
      }[] {
        const params: {
          identifierToken: lexToken;
          typeExpression: typeExpression;
          colonToken: optLexToken /*colon for type annotation*/;
          commaToken: optLexToken;
        }[] = [];

        consumeComments(comments);

        // TODO consumeComments() and isEof()
        while (!isAtEnd() && !match(')')) {
          const currentTokenDebug: lexToken = peek()!;

          consumeComments(comments);

          if (
            params.length !== 0 &&
            !isPresent(params[params.length - 1].commaToken)
          )
            newParseError(
              'Invalid func expression: missing comma in argument list'
            );

          // TODO could also be, that the user forget a ")" and there was no identifier intended
          const identifierToken: lexToken = matchTypeAdvanceOrError(
            lexTokenType.identifier,
            'TODO Invalid func expression: expected an identifier'
          );

          const colonToken: optLexToken = optionalMatchAdvance(':');

          const explicitType: optional<typeExpression> = callOnPresent(
            colonToken,
            () => parseTypeExpression()
          );

          const commaToken: optLexToken = optionalMatchAdvance(',');

          params.push({
            identifierToken,
            typeExpression: explicitType ?? { type: 'implicit', comments: [] },
            colonToken,
            commaToken
          });

          if (!iterationAdvanced(currentTokenDebug)) break;
        }

        return params;
      }

      const funcToken: lexToken = advance()!;

      consumeComments(comments);

      const openingBracketToken: lexToken = matchAdvanceOrError(
        '(',
        'TODO functions must be opend with ('
      );

      consumeComments(comments);

      const params = parseFuncExprParam();

      consumeComments(comments);

      const closingBracketToken: lexToken = matchAdvanceOrError(
        ')',
        'TODO functions must be closed with )'
      );

      consumeComments(comments);

      const colonToken: optLexToken = optionalMatchAdvance(':');
      consumeComments(comments);

      const typeExpression: optional<typeExpression> = callOnPresent(
        colonToken,
        () => parseTypeExpression()
      );

      consumeComments(comments);

      const arrowToken: lexToken = matchAdvanceOrError(
        '=>',
        'TODO functions must have a =>'
      );

      consumeComments(comments);

      const body: expression = parseExpression();

      consumeComments(comments);

      const typeAnnotation: hasExplicitType = isPresent(colonToken)
        ? {
            explicitType: true,
            typeExpression: typeExpression!,
            colonToken
          }
        : {
            explicitType: false,
            typeExpression: { type: 'implicit', comments: [] }
          };

      return {
        type: 'func',
        parameters: params,
        body,
        ...typeAnnotation,
        funcToken,
        openingBracketToken,
        closingBracketToken,
        arrowToken
      };
    }

    function parseMatchExpression(): expression {
      return {} as any;
    }

    return { ...parseExprLvl0(), comments };
  }

  // TODO isAtEnd() and consumeComments()
  function parseTypeExpression(): typeExpression {
    const comments: lexToken[] = [];

    if (match('i32') || match('f32') || matchType(lexTokenType.identifier)) {
      const value: lexToken = advance()!;
      const primitive: typeExpression = {
        type: 'primitive-type',
        primitiveToken: value,
        comments: []
      };

      const arrowToken: optLexToken = optionalMatchAdvance('->');

      if (!isPresent(arrowToken)) return primitive;

      return {
        type: 'func-type',
        parameters: [{ typeExpression: primitive, commaToken: undefined }],
        returnType: parseTypeExpression(),
        openingBracketToken: undefined,
        closingBracketToken: undefined,
        arrowToken,
        comments
      };
    } else if (match('(')) {
      const openingBracketToken: lexToken = advance()!;

      consumeComments(comments);

      const closingBracket: optLexToken = optionalMatchAdvance(')');

      const body: {
        typeExpression: typeExpression;
        commaToken: optLexToken;
      }[] = [];
      while (!isPresent(closingBracket) && !isAtEnd() && !match(')')) {
        const currentTokenDebug: lexToken = peek()!;

        consumeComments(comments);

        if (body.length !== 0 && !isPresent(body[body.length - 1].commaToken))
          newParseError(
            'TODO did not get a comma in last type expression, while grouping types'
          );

        consumeComments(comments);

        // TODO some error checking for better msgs maybe
        const type: typeExpression = parseTypeExpression();

        consumeComments(comments);
        // TODO isAtEnd() check...

        const commaToken: optLexToken = optionalMatchAdvance(',');

        // TODO what if now comes a comment??

        body.push({ typeExpression: type, commaToken });

        if (!iterationAdvanced(currentTokenDebug)) break;
      }

      const closingBracketToken: lexToken = isPresent(closingBracket)
        ? closingBracket
        : matchAdvanceOrError(
            ')',
            'TODO did not close bracket in type-grouping expression'
          );

      const arrowToken: optLexToken = optionalMatchAdvance('->');

      if (isPresent(arrowToken)) {
        const returnType: typeExpression = parseTypeExpression();

        return {
          type: 'func-type',
          parameters: body,
          returnType,
          openingBracketToken,
          closingBracketToken,
          arrowToken,
          comments
        };
      } else {
        if (isPresent(closingBracket) || body.length === 0)
          newParseError('TODO, did not get any type in grouping expression');
        if (body.length !== 1)
          newParseError('TODO got multiple types in a grouping expression');
        else if (body.length === 1 && isPresent(body[0].commaToken))
          newParseError(
            'TODO got a trailing comma at the end of a grouping expression'
          );

        return {
          type: 'grouping',
          // TODO couldnt it also be undefined here??
          body: body[0].typeExpression,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }
    }

    return newParseError('TODO did not match any type expression statement');
  }
  // #endregion

  export function parse(
    code: string
  ):
    | { valid: true; statements: statement[] }
    | { valid: false; parseErrors: parseError[]; statements: statement[] } {
    larser = new Larser(code);

    // TODO swap with arg list
    const statements: statement[] = [];
    while (!isAtEnd()) {
      const currentTokenDebug: lexToken = peek()!;

      statements.push(parseStatement());

      // error handling to not create infinite loops
      // an error should have been returned above already
      if (
        !iterationAdvanced(
          currentTokenDebug,
          'could not parse a statement in global scope'
        )
      )
        break;
    }

    return parseErrors.length === 0
      ? { valid: true, statements }
      : { valid: false, parseErrors, statements };
  }

  function debugParser() {
    const mustParse: string[] = [
      '',
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
      `type weekdays {
        Saturday,
        Sunday,
        Monday,
        Tuesday,
        Wednesday,
        Thursday,
        Friday
      }

      let f = func (weekday: weekdays): i32 =>
        match (weekday): i32 {
          case Saturday => 1;
          case Sunday => 1;
          0; // default for the other days
        };`,
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
      `
      use file;

      let i = nan;
      let j = inf;
      let u = i;
      let x: i32 = 1;
      let y: f32 = 2.0;
      let z[A] =
        (func (x: A): A => x) (3);
      let f[B]: B -> i32 =
        func (y: B): i32 => 4 + y;

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
      }`
    ];
    const mustNotParseButLexe: string[] = [
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
      '+',
      '!',
      'use;',
      'use',
      'use test',
      'let func',
      'let x',
      'let x]',
      'let x[',
      'let func ] =>',
      'let x = func (x: i32 => i32) => 5;',
      'let x = func (x: i32 -> i32) -> 5;',
      'let x',
      'let x =',
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

    const mustParseWithComments: string[] = new Array(mustParse.length)
      .fill(0)
      .map((_, i) =>
        Lexer.lexe(mustParse[i])
          .tokens.map((t) => t.lexeme)
          .join(`/*comment ${i}*/`)
      );

    for (const a of mustParse) {
      //   // TODO
      //   const ans = parse(a);
      //   if (!ans.valid) throw new Error('could not parse: ' + ans.toString());
    }

    for (const a of mustNotParseButLexe) {
      // if (!Lexer.lexe(a).valid)
      //  throw new Error('this code should be lexable: ' + a);
      // const ans = parse(a);
      // if (ans.valid) throw new Error('should not parse: ' + ans.toString());
    }

    console.time('t');
    // group test { let x = 5 + 2 * (func (x) => x + 3 | 1 << 2 > 4).a.b() + nan + inf + 3e-3; }
    // let _ = 1 + (2 - 3) * 4 / 5 ** 6 % 7;
    // invalid to do: `a.(b).c` but (a.b).c is ok
    // let _ = a(5+32,4)

    // use std; let _ = (func (x) => 3 * x)(5);

    // let x: (i32) -> ((f32), (tust,) -> tast -> (tist)) -> (test) = func (a, b, c) -> 4;
    // TODO where are the opening brackets of tust??
    const parsed = parse(
      'let x: (i32) -> ((f32), (tust,) -> tast -> () -> (tist)) -> (test) = func (a, b, c) => 4;'
    );
    console.timeEnd('t');

    log(parsed);
  }

  // for (let i = 0; i < 1; ++i) debugParser();
}

const code = [
  `
  use file;

  let i = nan;
  let j = inf;
  let u = i;
  let x: i32 = 1;
  let y: f32 = 2.0;
  let z[A] =
    (func (x: A): A => x) (3);
  let f[B]: B -> i32 =
    func (y: B): i32 => 4 + y;

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

console.log(codeWithComments);
const parsedCode = Parser.parse(codeWithComments);

console.log('is code valid:', parsedCode.valid);
console.log('CODE:');
for (const stmt of parsedCode.statements) log(stmt);
if (!parsedCode.valid) console.error('ERRORS:');
if (!parsedCode.valid) for (const err of parsedCode.parseErrors) log(err);

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
