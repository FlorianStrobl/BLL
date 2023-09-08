// @ts-ignore
import { inspect } from 'util';
import { Lexer } from './LCLexer';

const log = (args: any) => console.log(inspect(args, { depth: 999 }));

// TODO: add test codes, where after each step of a valid thing, it suddenly eofs and where between each thing a comment is

// TODO invalid char in lexer step results in random error in interpreter.ts

// TODO func (x: i32 = 5) => x;
// TODO match (number): i32 { case 0 => 5; default /*?? maybe just "case", or just the trailling thing?? TODO HERE*/ => 6; }
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

export namespace Parser {
  let larser: Larser;
  const parseErrors: parseError[] = [];

  function newParseError(arg: parseError): never {
    parseErrors.push({ arg, currentToken: peek() });
    return parseErrors as never;
  }

  function checkEofWithError(errorOnEof: string): void {
    if (isAtEnd())
      throw newParseError('Invalid eof while parsing code: ' + errorOnEof);
    // TODO not throw, BUT eof is the very last thing in the code: so could now check all the errors
  }

  // #region types
  type comment = { comments: Lexer.token[] };

  export type parseError = {} | any;

  // TODO each branch in complexe type statement should get its own comments in the formatter/prettier
  export type statement = comment &
    (
      | { type: 'comment' }
      | { type: 'empty'; semicolonToken: Lexer.token }
      | {
          type: 'import';
          localFileName: Lexer.token;
          useToken: Lexer.token;
          semicolonToken: Lexer.token;
        }
      | (
          | ({
              type: 'let';
              identifierToken: Lexer.token;
              body: expression & comment;
              letToken: Lexer.token;
              equalsToken: Lexer.token;
              semicolonToken: Lexer.token;
            } & hasExplicitType)
          | {
              type: 'type-alias';
              identifierToken: Lexer.token;
              typeValue: typeExpression;
              typeToken: Lexer.token;
              equalsToken: Lexer.token;
              semicolonToken: Lexer.token;
            }
          | {
              type: 'complex-type';
              identifierToken: Lexer.token;
              typeValue: complexTypeValue[];
              typeToken: Lexer.token;
              openingBracketToken: Lexer.token;
              closingBracketToken: Lexer.token;
            }
          | {
              type: 'group';
              identifierToken: Lexer.token;
              body: statement[];
              groupToken: Lexer.token;
              openingBracketToken: Lexer.token;
              closingBracketToken: Lexer.token;
            }
        )
    );
  type hasExplicitType =
    | {
        hasExplicitType: true;
        typeExpression: typeExpression;
        colonToken: Lexer.token;
      }
    | {
        hasExplicitType: false;
        typeExpression: typeExpression;
      };
  type complexTypeValue = {
    identifierToken: Lexer.token;
    parameters: {
      typeIdentifier: Lexer.token;
      commaToken?: Lexer.token;
    }[]; // TODO when brackets are not present, then no parameters can be there
    openingBracketToken?: Lexer.token;
    closingBracketToken?: Lexer.token /*TODO if has opening bracket, then must have closing bracket or vice versa*/;
    commaToken?: Lexer.token;
    // comments: Lexer.tokenType[] // TODO, add for better formatting
  };

  // TODO what about generics: func[T1, T2]
  export type funcExpression = {
    type: 'func';
    parameters: {
      identifierToken: Lexer.token;
      typeExpression: typeExpression;
      colonToken?: Lexer.token /*colon for type annotation*/;
      commaToken?: Lexer.token /*comma for next param*/;
    }[];
    body: expression;
    funcToken: Lexer.token;
    openingBracketToken: Lexer.token;
    closingBracketToken: Lexer.token;
    arrowToken: Lexer.token;
  } & hasExplicitType;

  // match, func, "nan", "inf", literals
  // TODO each branch in match expression should get its own comments in the formatter/prettier
  export type expression =
    | {
        type: 'literal';
        literalType: 'i32';
        literal: number;
        literalToken: Lexer.token;
      }
    | {
        type: 'literal';
        literalType: 'f32';
        literal: number;
        literalToken: Lexer.token;
      }
    | { type: 'identifier'; identifierToken: Lexer.token }
    | funcExpression
    | {
        type: 'grouping';
        body: expression;
        openingBracketToken: Lexer.token;
        closingBracketToken: Lexer.token;
      }
    | {
        type: 'unary';
        operator: string;
        body: expression;
        operatorToken: Lexer.token;
      }
    | {
        type: 'binary';
        operator: string;
        leftSide: expression;
        rightSide: expression;
        operatorToken: Lexer.token;
      }
    | {
        type: 'propertyAccess';
        source: expression;
        propertyToken: Lexer.token;
        dotToken: Lexer.token;
      }
    | {
        type: 'functionCall';
        function: expression;
        arguments: {
          argumentExpression: expression;
          commaToken?: Lexer.token;
        }[];
        openingBracketToken: Lexer.token;
        closingBracketToken: Lexer.token;
      }
    | { type: 'match' /*TODO, put in comments[] for each and every branch!*/ };

  // TODO generics?, wab propertAccess of complex types?
  export type typeExpression = comment &
    (
      | { type: 'implicit' }
      | {
          type: 'primitive-type';
          value: Lexer.token; // keyword like i32/f32 or generic identifier/type identifier
        }
      | {
          type: 'func-type';
          parameters: {
            typeExpression: typeExpression;
            commaToken?: Lexer.token;
          }[];
          returnType: typeExpression;
          openingBracketToken?: Lexer.token;
          closingBracketToken?: Lexer.token;
          arrowToken: Lexer.token;
        }
      | {
          type: 'grouping';
          body: typeExpression;
          openingBracketToken: Lexer.token;
          closingBracketToken: Lexer.token;
        }
    );
  // #endregion

  // #region helper
  // part which handles the lexer
  class Larser {
    private code: string;
    private lexer: Generator<Lexer.nextToken>;

    private state:
      | { eof: false; currentToken: Lexer.token }
      | { eof: true; currentToken: undefined };

    constructor(code: string) {
      this.code = code;
      this.lexer = Lexer.lexeNextTokenIter(code);
      // just for init
      this.state = { eof: false, currentToken: undefined as any };

      this.advanceToken();
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
      const lexerIsNotDone: boolean = lexerNext.done === false;

      const eof: boolean =
        lexerIsNotDone &&
        !lexerNext.value.valid &&
        lexerNext.value.value.type === 'eof';

      // TODO maybe repeat if "soft error": !value.valid but also !value.codeInvalid
      if (!eof && lexerNext.value.valid)
        this.state = { eof: false, currentToken: lexerNext.value.value };
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

  function isAtEnd(): boolean {
    return larser.isEof();
  }

  function peek(): Lexer.token | undefined {
    if (isAtEnd()) return undefined;
    return larser.getCurrentToken();
  }

  function advance(): Lexer.token | undefined {
    if (isAtEnd()) return undefined;

    const currentToken: Lexer.token | undefined = peek();
    larser.advanceToken();
    return currentToken;
  }

  function match(...tokens: string[]): boolean {
    const currentToken: Lexer.token | undefined = peek();
    return currentToken !== undefined && tokens.includes(currentToken.lexeme);
  }

  function matchType(...tokenTypes: Lexer.tokenType[]): boolean {
    const currentToken: Lexer.token | undefined = peek();
    return currentToken !== undefined && tokenTypes.includes(currentToken.type);
  }

  function matchAndAdvanceOrError(
    token: string,
    error: parseError
  ): Lexer.token | never {
    if (match(token)) return advance()!;
    else newParseError(error);
  }

  function matchTypeAndAdvanceOrError(
    tokenType: Lexer.tokenType,
    error: parseError
  ): Lexer.token | never {
    if (matchType(tokenType)) return advance()!;
    else newParseError(error);
  }

  function optionalMatchAndAdvance(
    ...tokens: string[]
  ): Lexer.token | undefined {
    if (match(...tokens)) return advance()!;
  }

  function consumeComments(commentArr: Lexer.token[]): void {
    while (!isAtEnd() && matchType(Lexer.tokenType.comment))
      commentArr.push(advance()!);
  }
  // #endregion

  // #region parser
  // TODO comments could be ANYWHERE, just aswell as a bad eof
  // TODO test with real code, but insert a comment between each and every token!
  // TODO check everywhere isAtEnd() and comments
  function parseStatement(): statement {
    checkEofWithError('no statement parsed');

    const comments: Lexer.token[] = [];
    if (matchType(Lexer.tokenType.comment)) {
      // TODO then comments at the top will always be extra info
      consumeComments(comments);
      return { type: 'comment', comments };
    }

    if (match(';')) {
      const semicolonToken: Lexer.token = advance()!;
      return { type: 'empty', semicolonToken, comments: [] };
    }

    if (match('use')) {
      const useToken: Lexer.token = advance()!;

      consumeComments(comments);

      checkEofWithError('no use body in use statement');

      const localFileName: Lexer.token = matchTypeAndAdvanceOrError(
        Lexer.tokenType.identifier,
        'did not get an identifier in use statement'
      );

      consumeComments(comments);

      checkEofWithError('unexpected eof in use statement: missing semicolon');

      const semicolonToken: Lexer.token = matchAndAdvanceOrError(
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
      const groupToken: Lexer.token = advance()!;

      consumeComments(comments);

      checkEofWithError('unexpected eof in group statement');

      const identifierToken: Lexer.token = matchTypeAndAdvanceOrError(
        Lexer.tokenType.identifier,
        'TODO can not have an undefined identifier for a group statement'
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in group statement after getting an identifier'
      );

      const openingBracketToken: Lexer.token = matchAndAdvanceOrError(
        '{',
        "TODO cant have a group statement without an opening brackt '{'"
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in group statement after the opening bracket'
      );

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) body.push(parseStatement());
      checkEofWithError('unexpected eof in group statement');
      const closingBracketToken: Lexer.token = advance()!;

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

    if (match('let')) {
      const letToken: Lexer.token = advance()!;

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement');

      const identifierToken: Lexer.token = matchTypeAndAdvanceOrError(
        Lexer.tokenType.identifier,
        'TODO cant have an undefined identifier for a let statement'
      );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in let statement after asuming an identifier'
      );

      const colonToken: Lexer.token | undefined = optionalMatchAndAdvance(':');

      consumeComments(comments);

      if (colonToken !== undefined)
        checkEofWithError('unexpected eof in let statement after getting ":"');

      const typeAnnotation: typeExpression | undefined =
        colonToken !== undefined && !match('=') /*better error messages*/
          ? parseTypeExpression()
          : undefined;

      if (colonToken !== undefined && typeAnnotation === undefined)
        newParseError(
          'missing type annotation in let statement after getting a ":"'
        );

      consumeComments(comments);

      checkEofWithError(
        'unexpected eof in let statement while expecting a "="'
      );

      const equalsToken: Lexer.token = matchAndAdvanceOrError(
        '=',
        'TODO cant have a let statement without a "=" symbol'
      );

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement after "="');

      // TODO refactor, but how?
      const body: expression & comment = !match(';') /*better error messages*/
        ? parseExpression()
        : newParseError('TODO no body in let expression');

      consumeComments(comments);

      checkEofWithError('unexpected eof in let statement');

      const semicolonToken: Lexer.token = matchAndAdvanceOrError(
        ';',
        'TODO let statements must be finished with a ";" symbol'
      );

      const explicitType: hasExplicitType =
        colonToken === undefined
          ? {
              hasExplicitType: false,
              typeExpression: { type: 'implicit', comments: [] }
            }
          : {
              hasExplicitType: true,
              typeExpression: typeAnnotation!,
              colonToken: colonToken
            };

      return {
        type: 'let',
        identifierToken,
        body,
        ...explicitType,
        letToken,
        equalsToken,
        semicolonToken,
        comments
      };
    }

    // NOW
    if (match('type')) {
      // TODO
      const typeToken: Lexer.token = advance()!;

      function parseComplexeTypeLine(): complexTypeValue {
        consumeComments(comments);

        // TODO HERE NOW
        const identifierToken: Lexer.token = matchType(
          Lexer.tokenType.identifier
        )
          ? advance()!
          : newParseError(
              'TODO invalid complex type statement: missing identifier'
            );

        consumeComments(comments);

        const openingBracketToken: Lexer.token | undefined = match('(')
          ? advance()!
          : undefined;

        consumeComments(comments);

        const parameters: {
          typeIdentifier: Lexer.token;
          commaToken?: Lexer.token;
        }[] = [];
        // TODO endless loop because if no `)` in the code, then it wont advance further?
        while (openingBracketToken !== undefined && !isAtEnd() && !match(')')) {
          consumeComments(comments);

          if (
            parameters.length !== 0 &&
            parameters[parameters.length - 1].commaToken === undefined
          )
            newParseError(
              'TODO missing comma between two parameters in complex type value'
            );

          const typeIdentifier: Lexer.token =
            matchType(Lexer.tokenType.identifier) ||
            match('i32') ||
            match('f32')
              ? advance()!
              : (advance() /*TODO probably needed??*/,
                newParseError('TODO invalid expression in complex type value'));

          const commaToken: Lexer.token | undefined = match(',')
            ? advance()!
            : undefined;

          parameters.push({
            typeIdentifier,
            commaToken
          });
        }

        const closingBracketToken: Lexer.token | undefined = match(')')
          ? advance()!
          : undefined;

        consumeComments(comments);

        // TODO what about `type Test { id id id, id id };`
        if (
          !(
            (openingBracketToken === undefined &&
              closingBracketToken === undefined) ||
            (openingBracketToken !== undefined &&
              closingBracketToken !== undefined)
          )
        )
          newParseError('TODO missing brackets in complexe type');

        const commaToken: Lexer.token | undefined = match(',')
          ? advance()!
          : undefined;

        return {
          identifierToken,
          parameters,
          openingBracketToken,
          closingBracketToken,
          commaToken
        };
      }

      consumeComments(comments);
      // TODO isAtEnd() check

      const identifierToken: Lexer.token = matchType(Lexer.tokenType.identifier)
        ? advance()!
        : newParseError('TODO invalid type expression: missing identifier');

      consumeComments(comments);

      if (match('=')) {
        const equalsToken: Lexer.token = advance()!;

        consumeComments(comments);

        const typeValue: typeExpression = parseTypeExpression();

        consumeComments(comments);
        // TODO isAtEnd() checking and errors

        const semicolonToken: Lexer.token = match(';')
          ? advance()!
          : newParseError('TODO did not finish the type expression');

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
        const openingBracketToken: Lexer.token = advance()!;

        consumeComments(comments);

        const body: complexTypeValue[] = [];
        while (!isAtEnd() && !match('}')) {
          consumeComments(comments);

          if (
            body.length !== 0 &&
            body[body.length - 1].commaToken === undefined
          )
            newParseError('TODO, missing comma in complex type body');

          body.push(parseComplexeTypeLine());
        }
        checkEofWithError('eof in complex type statement');
        const closingBracketToken: Lexer.token = advance()!;

        return {
          type: 'complex-type',
          identifierToken,
          typeValue: body,
          typeToken,
          openingBracketToken,
          closingBracketToken,
          comments
        };
      } else
        return newParseError(
          'TODO invalid type expression: cannot resolve which type it should be'
        );
    }

    newParseError('TODO could not parse any statement properly');
    return {
      error: 'TODO could not parse any statement properly',
      lastToken: advance()
    } as never;
  }

  // TODO add comments and isAtEnd() support
  function parseExpression(): expression & comment {
    const comments: Lexer.token[] = [];

    function parseExprLvl0(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl1();
      consumeComments(comments);

      // TODO isAtEnd() and consumeComment()
      while (match('|')) {
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const operatorToken: Lexer.token = advance()!;
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
        const token: Lexer.token = advance()!;

        if (token.lexeme === '.') {
          // f.
          const propertyToken: Lexer.token = matchType(
            Lexer.tokenType.identifier
          )
            ? advance()!
            : newParseError('TODO invalid property access');

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
            commaToken?: Lexer.token;
          }[] = [];
          // TODO what about error messages for `(5,,)`
          while (!isAtEnd() && !match(')')) {
            // if last was not comma
            if (
              args.length !== 0 &&
              args[args.length - 1].commaToken === undefined
            )
              newParseError(
                'TODO, missing comma in function call argument list'
              );

            consumeComments(comments);

            const argumentExpression: expression = parseExpression();

            consumeComments(comments);

            const commaToken: Lexer.token | undefined = match(',')
              ? advance()!
              : undefined;

            args.push({ argumentExpression, commaToken });
          }

          checkEofWithError('Had eof in function calling expression');
          const closingBracketToken: Lexer.token = advance()!;
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
        const openingBracketToken: Lexer.token = advance()!;
        consumeComments(comments);
        const body: expression = parseExpression();
        consumeComments(comments);
        const closingBracketToken: Lexer.token = match(')')
          ? advance()!
          : newParseError('TODO did not close bracket in grouping expression');

        consumeComments(comments);

        return {
          type: 'grouping',
          body,
          openingBracketToken,
          closingBracketToken
        };
      } else if (matchType(Lexer.tokenType.literal)) {
        const literalToken: Lexer.token = advance()!;

        consumeComments(comments);

        const lexeme: string = literalToken.lexeme;
        const literalType: 'i32' | 'f32' =
          lexeme.includes('.') ||
          (!lexeme.startsWith('0x') && lexeme.includes('e'))
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
      } else if (matchType(Lexer.tokenType.identifier)) {
        const identifierToken: Lexer.token = advance()!;
        consumeComments(comments);
        return {
          type: 'identifier',
          identifierToken
        };
      } else if (match('func')) return parseFuncExpression();
      else if (match('match')) return parseMatchExpression();

      consumeComments(comments);

      newParseError('TODO could not match anything in parsing expressions');
      return {
        error: 'TODO could not match anything in parsing expressions',
        lastToken: advance()
      } as never;
    }

    function parseFuncExpression(): expression {
      function parseFuncExprParam(): {
        identifierToken: Lexer.token;
        typeExpression: typeExpression;
        colonToken?: Lexer.token /*colon for type annotation*/;
        commaToken?: Lexer.token;
      }[] {
        const params: {
          identifierToken: Lexer.token;
          typeExpression: typeExpression;
          colonToken?: Lexer.token /*colon for type annotation*/;
          commaToken?: Lexer.token;
        }[] = [];

        // TODO consumeComments() and isEof()
        while (!isAtEnd() && !match(')')) {
          consumeComments(comments);

          if (
            params.length !== 0 &&
            params[params.length - 1].commaToken === undefined
          )
            newParseError(
              'Invalid func expression: missing comma in argument list'
            );

          const identifierToken: Lexer.token = matchType(
            Lexer.tokenType.identifier
          )
            ? advance()!
            : newParseError(
                'TODO Invalid func expression: expected an identifier'
              );

          const colonToken: Lexer.token | undefined = match(':')
            ? advance()!
            : undefined;

          const explicitType: typeExpression | undefined =
            colonToken !== undefined ? parseTypeExpression() : undefined;

          const commaToken: Lexer.token | undefined = match(',')
            ? advance()!
            : undefined;

          params.push({
            identifierToken,
            typeExpression: explicitType ?? { type: 'implicit', comments: [] },
            colonToken,
            commaToken
          });
        }

        return params;
      }

      if (!match('func'))
        throw new Error(
          'Internal error, called this function, even tho here is no function'
        );
      const funcToken: Lexer.token = advance()!;

      consumeComments(comments);

      // TODO generics

      const openingBracketToken: Lexer.token = match('(')
        ? advance()!
        : newParseError('TODO functions must be opend with (');

      consumeComments(comments);

      const params = parseFuncExprParam();

      consumeComments(comments);

      const closingBracketToken: Lexer.token = match(')')
        ? advance()!
        : newParseError('TODO functions must be closed with )');

      consumeComments(comments);

      const colonToken: Lexer.token | undefined = match(':')
        ? advance()!
        : undefined;

      consumeComments(comments);

      const typeExpression: typeExpression | undefined =
        colonToken !== undefined ? parseTypeExpression() : undefined;

      consumeComments(comments);

      const arrowToken: Lexer.token = match('=>')
        ? advance()!
        : newParseError('TODO functions must have a =>');

      consumeComments(comments);

      const body: expression = parseExpression();

      consumeComments(comments);

      const typeAnnotation: hasExplicitType =
        colonToken === undefined
          ? {
              hasExplicitType: false,
              typeExpression: { type: 'implicit', comments: [] }
            }
          : {
              hasExplicitType: true,
              typeExpression: typeExpression!,
              colonToken
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
    const comments: Lexer.token[] = [];

    if (match('i32') || match('f32') || matchType(Lexer.tokenType.identifier)) {
      const value: Lexer.token = advance()!;
      const primitive: typeExpression = {
        type: 'primitive-type',
        value,
        comments: []
      };

      const arrowToken = match('->') ? advance()! : undefined;
      if (arrowToken === undefined) return primitive;

      return {
        type: 'func-type',
        parameters: [{ typeExpression: primitive }],
        returnType: parseTypeExpression(),
        openingBracketToken: undefined,
        closingBracketToken: undefined,
        arrowToken,
        comments
      };
    } else if (match('(')) {
      const openingBracketToken: Lexer.token = advance()!;
      consumeComments(comments);
      const closingBracket: Lexer.token | undefined = match(')')
        ? advance()!
        : undefined;
      // TODO HERE it could directly come a `)` for a `() -> T` type

      const body: {
        typeExpression: typeExpression;
        commaToken?: Lexer.token;
      }[] = [];
      while (closingBracket === undefined && !isAtEnd() && !match(')')) {
        consumeComments(comments);

        if (body.length !== 0 && body[body.length - 1].commaToken === undefined)
          newParseError(
            'TODO did not get a comma in last type expression, while grouping types'
          );

        consumeComments(comments);

        const type: typeExpression = parseTypeExpression();

        consumeComments(comments);
        // TODO isAtEnd() check...

        const commaToken: Lexer.token | undefined = match(',')
          ? advance()!
          : undefined;

        body.push({ typeExpression: type, commaToken });
      }

      const closingBracketToken: Lexer.token =
        closingBracket !== undefined
          ? closingBracket
          : match(')')
          ? advance()!
          : newParseError(
              'TODO did not close bracket in type-grouping expression'
            );

      const arrowToken: Lexer.token | undefined = match('->')
        ? advance()!
        : undefined;
      if (arrowToken !== undefined) {
        return {
          type: 'func-type',
          parameters: body,
          returnType: parseTypeExpression(),
          openingBracketToken,
          closingBracketToken,
          arrowToken,
          comments
        };
      } else {
        if (closingBracket !== undefined || body.length === 0)
          newParseError('TODO, did not get any type in group expression');
        if (body.length !== 1)
          newParseError('TODO got multiple types in a grouping expression');
        else if (body.length === 1 && body[0].commaToken !== undefined)
          newParseError(
            'TODO got a trailling comma at the end of a grouping expression'
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

    newParseError('TODO did not match any type expression statement');
    return {
      error: 'TODO did not match any type expression statement',
      lastToken: advance()
    } as never;
  }
  // #endregion

  // TODO instead of returning undefined: return parseError[]
  export function parse(
    code: string
  ):
    | { valid: true; statements: statement[] }
    | { valid: false; parseErrors: parseError[]; statements: statement[] } {
    larser = new Larser(code);

    const statements: statement[] = [];
    while (!isAtEnd()) statements.push(parseStatement());

    if (parseErrors.length === 0) return { valid: true, statements };
    return { valid: false, parseErrors, statements };
  }

  function debugParser() {
    const mustParse: string[] = [
      '',
      '// test',
      '/* test */',
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

      type t2 = t;`
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
      '+',
      '!',
      'use;',
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

    for (const a of mustParse) {
      // TODO
      //const ans = parse(a);
      //if (!ans.valid) throw new Error('could not parse: ' + ans.toString());
    }

    for (const a of mustNotParseButLexe) {
      //if (!Lexer.lexe(a).valid)
      //  throw new Error('this code should be lexable: ' + a);
      //const ans = parse(a);
      //if (ans.valid) throw new Error('should not parse: ' + ans.toString());
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

log(Parser.parse('let a = 5;'));
// log(Parser.parse('/*test*/ ; /*tast*/ /*ok*/'));
