import { Lexer } from './LCLexer';
// @ts-ignore
import { inspect } from 'util';

export namespace Parser {
  let larser: Larser;
  const parserErrors: any[] = [];

  function newParseError(...args: any[]): never {
    parserErrors.push(...args);
    return {} as never;
  }

  // #region types
  type comment = { comments: Lexer.token[] };

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
              type: 'type-allias';
              identifierToken: Lexer.token;
              typeValue: typeExpression;
              typeToken: Lexer.token;
              equalsToken: Lexer.token;
              semicolonToken: Lexer.token;
            }
          | {
              type: 'complex-type';
              identifierToken: Lexer.token;
              typeValue: any /*TODO*/;
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

  // TODO what about generics: func[T1, T2]
  export type funcExpression = {
    type: 'func';
    parameters: [
      Lexer.token /*identifier*/,
      typeExpression,
      Lexer.token | undefined /*colon for type annotation*/,
      Lexer.token | undefined /*comma for next param*/
    ][];
    body: expression;
    funcToken: Lexer.token;
    openingBracketToken: Lexer.token;
    closingBracketToken: Lexer.token;
    arrowToken: Lexer.token;
  } & hasExplicitType;

  // match, func, "nan", "inf", literals
  // TODO
  export type expression =
    | { type: 'literal'; literal: any; literalToken: Lexer.token }
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
        arguments: [expression, Lexer.token | undefined /*comma*/][];
        openingBracketToken: Lexer.token;
        closingBracketToken: Lexer.token;
      }
    | { type: 'match' /*TODO*/ };

  // TODO generics?, wab propertAccess of complex types?
  export type typeExpression = comment &
    (
      | { type: 'infer' }
      | {
          type: 'primitive-type';
          value: Lexer.token; // keyword like i32/f32 or generic identifier/type identifier
        }
      | {
          type: 'func-type';
          parameters: [typeExpression, Lexer.token | undefined /* commas */][];
          returnType: typeExpression;
          openingBracketToken: Lexer.token | undefined;
          closingBracketToken: Lexer.token | undefined;
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
    private filename: string;
    private lexer: Generator<Lexer.nextToken>;

    private currentToken: Lexer.token;
    private eof: boolean = false;

    constructor(code: string, filename: string) {
      this.code = code;
      this.filename = filename;
      this.lexer = Lexer.lexeNextTokenIter(code);

      // TODO maybe repeat if "soft error": !value.valid but also !value.codeInvalid
      const lexerNext: IteratorResult<Lexer.nextToken, any> = this.lexer.next();
      const lexerIsNotDone: boolean = lexerNext.done === false;
      if (
        lexerIsNotDone &&
        !lexerNext.value.valid &&
        lexerNext.value.value.type === 'eof'
      ) {
        this.eof = true;
        this.currentToken = {} as never;
      } else if (lexerIsNotDone && lexerNext.value.valid) {
        this.currentToken = lexerNext.value.value;
      } else this.errorHandling();
    }

    public isEof(): boolean {
      return this.eof;
    }

    // assertion: not eof
    public getCurrentToken(): Lexer.token {
      if (this.isEof())
        throw new Error(
          'Internal error while parsing. Tried getting the current token, even tho the code is eof.'
        );
      return this.currentToken;
    }

    // assertion: not eof
    public advanceToken(): void {
      if (this.isEof())
        throw new Error(
          'Internal error while parsing. Tried advancing to next token, even tho the code is eof.'
        );

      // this.previousToken = this.currentToken;
      const lexerNext:IteratorResult<Lexer.nextToken, any> = this.lexer.next();
      const lexerIsNotDone: boolean = lexerNext.done === false;

      this.eof =
        lexerIsNotDone &&
        !lexerNext.value.valid &&
        lexerNext.value.value.type === 'eof';

      if (lexerIsNotDone && lexerNext.value.valid)
        this.currentToken = lexerNext.value.value;
      else if (!this.eof) this.errorHandling();
    }

    private errorHandling(): never {
      // TODO
      const tokens = Lexer.lexe(this.code);
      throw new Error(
        this.filename +
          ': ' +
          (tokens === undefined ? 'no tokens' : tokens.toString())
      );
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
    if (isAtEnd()) return false;
    const currentToken: Lexer.token | undefined = peek();
    return currentToken !== undefined && tokens.includes(currentToken.lexeme);
  }

  function matchType(...tokenTypes: Lexer.tokenType[]): boolean {
    if (isAtEnd()) return false;
    const currentToken: Lexer.token | undefined = peek();
    return currentToken !== undefined && tokenTypes.includes(currentToken.type);
  }

  function consumeComments(commentArr: Lexer.token[]): void {
    while (!isAtEnd() && matchType(Lexer.tokenType.comment))
      commentArr.push(advance()!);
  }

  function invalidEof(...args: any[]): never {
    return newParseError('TODO invalid eof while parsing', ...args);
  }
  // #endregion

  // #region parser
  // TODO comments could be ANYWHERE, just aswell as a bad eof
  // TODO test with real code, but insert a comment between each and every token!
  // TODO check everywhere isAtEnd()
  function parseStatement(): statement {
    if (isAtEnd()) return invalidEof('no statement parsed');

    const comments: Lexer.token[] = [];
    if (matchType(Lexer.tokenType.comment)) {
      consumeComments(comments);
      return { type: 'comment', comments };
    }

    if (match(';')) {
      const semicolonToken: Lexer.token = advance()!;
      consumeComments(comments);
      return { type: 'empty', semicolonToken, comments };
    }

    if (match('use')) {
      const useToken: Lexer.token = advance()!;

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('no use body in use statement');

      const localFileName :  Lexer.token= matchType(Lexer.tokenType.identifier)
        ? advance()!
        : newParseError('TODO didnt get an identifier in use statement');

      consumeComments(comments);

      if (isAtEnd())
        return invalidEof('unexpected eof in use statement: missing semicolon');

      const semicolonToken: Lexer.token = match(';')
        ? advance()!
        : newParseError('TOOD did not get semicolon in a use statement');

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

      if (isAtEnd()) return invalidEof('unexpected eof in group statement');

      const identifierToken: Lexer.token = matchType(Lexer.tokenType.identifier)
        ? advance()!
        : newParseError(
            'TODO cant have an undefined identifier for a group statement'
          );

      consumeComments(comments);

      if (isAtEnd())
        return invalidEof(
          'unexpected eof in group statement after getting an identifier'
        );

      const openingBracketToken: Lexer.token = match('{')
        ? advance()!
        : newParseError(
            "TODO cant have a group statement without an opening brackt '{'"
          );

      consumeComments(comments);

      if (isAtEnd())
        return invalidEof(
          'unexpected eof in group statement after the opening bracket'
        );

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) body.push(parseStatement());
      if (isAtEnd()) return invalidEof('unexpected eof in group statement');
      const closingBracketToken: Lexer.token = advance()!;

      consumeComments(comments);

      return {
        type: 'group',
        identifierToken,
        body,
        groupToken,
        openingBracketToken,
        closingBracketToken,
        comments
      };
    } else if (match('let')) {
      const letToken: Lexer.token = advance()!;

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement');

      const identifierToken: Lexer.token = matchType(Lexer.tokenType.identifier)
        ? advance()!
        : newParseError(
            'TODO cant have an undefined identifier for a let statement'
          );

      consumeComments(comments);

      if (isAtEnd())
        return invalidEof(
          'unexpected eof in let statement after asuming an identifier'
        );

      const colonToken: Lexer.token | undefined = match(':')
        ? advance()!
        : undefined;

      consumeComments(comments);

      if (colonToken !== undefined && isAtEnd())
        return invalidEof('unexpected eof in let statement after getting ":"');

      const typeAnnotation: typeExpression | undefined =
        colonToken !== undefined ? parseTypeExpression() : undefined;

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement TODO');

      const equalsToken: Lexer.token = match('=')
        ? advance()!
        : newParseError("TODO cant have a let statement without a '=' symbol");

      consumeComments(comments);

      if (isAtEnd())
        return invalidEof('unexpected eof in let statement after =');

      const body: expression & comment = parseExpression();

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement');

      const semicolonToken: Lexer.token = match(';')
        ? advance()!
        : newParseError(
            "TODO let statements must be finished with a ';' symbol"
          );

      const explicitType: hasExplicitType =
        colonToken === undefined
          ? {
              hasExplicitType: false,
              typeExpression: { type: 'infer', comments: [] }
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
    } else if (match('type')) {
      // TODO type{ and type=
      return {} as any;
    }

    throw new Error('TODO could not parse any statement properly');
  }

  function parseExpression(): expression & comment {
    // TODO add comments and isAtEnd() support
    const comments: Lexer.token[] = [];

    function parseExprLvl0(): expression {
      consumeComments(comments);
      let leftSide: expression = parseExprLvl1();
      consumeComments(comments);

      // TODO isAtEnd() and consumeComment()
      while (match('|')) {
        const operatorToken: Lexer.token = advance()!;
        consumeComments(comments);
        const rightSide: expression= parseExprLvl1();
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
      let leftSide: expression = parseExprLvl2();

      while (match('^')) {
        const operatorToken : Lexer.token= advance()!;
        const rightSide:expression = parseExprLvl2();

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
      let leftSide: expression = parseExprLvl3();

      while (match('&')) {
        const operatorToken: Lexer.token = advance()!;
        const rightSide: expression = parseExprLvl3();

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
      let leftSide: expression = parseExprLvl4();

      while (match('==', '!=')) {
        const operatorToken: Lexer.token = advance()!;
        const rightSide: expression = parseExprLvl4();

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
      let leftSide: expression = parseExprLvl5();

      while (match('<', '>', '<=', '>=')) {
        const operatorToken: Lexer.token = advance()!;
        const rightSide: expression = parseExprLvl5();

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
      let leftSide: expression = parseExprLvl6();

      while (match('<<', '>>')) {
        const operatorToken: Lexer.token = advance()!;
        const rightSide: expression = parseExprLvl6();

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
      let leftSide: expression = parseExprLvl7();

      while (match('-', '+')) {
        const operatorToken : Lexer.token= advance()!;
        const rightSide : expression= parseExprLvl7();

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
      let leftSide: expression = parseExprLvl8();

      while (match('*', '/', '%')) {
        const operatorToken: Lexer.token = advance()!;
        const rightSide: expression = parseExprLvl8();

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
      let leftSide: expression = parseExprLvl9();

      // right to left precedence:
      // if because precedence order
      if (match('**', '***')) {
        const operatorToken: Lexer.token = advance()!;
        const rightSide: expression = parseExprLvl8(); // TODO right? same level because precedence order

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
        const body: expression = parseExprLvl9(); // same level?? TODO

        return {
          type: 'unary',
          operator: operatorToken.lexeme,
          body,
          operatorToken
        };
      }

      return parseExprLvl10();
    }

    // TODO just to debug
    function parseExprLvl10(): expression {
      let left: expression = primary();

      while (match('(', '.')) {
        const token: Lexer.token = advance()!;

        if (token.lexeme === '.') {
          // f.
          const propertyToken: Lexer.token = matchType(Lexer.tokenType.identifier)
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
            // TODO make obj out of that?
          const args: [expression, Lexer.token | undefined][] = [];
          // TODO what about error messages for `(5,,)`
          while (!isAtEnd() && !match(')')) {
            // if last was not comma
            if (args.length !== 0 && args[args.length - 1][1] === undefined)
              newParseError(
                'TODO, missing comma in function call argument list'
              );
            const expression: expression = parseExpression();
            const commaToken: Lexer.token | undefined = match(',')
              ? advance()!
              : undefined;
            args.push([expression, commaToken]);
          }

          if (isAtEnd())
            return invalidEof('Had eof in function calling expression');
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
      if (match('(')) {
        const openingBracketToken: Lexer.token = advance()!;
        const body: expression   = parseExpression();
        const closingBracketToken: Lexer.token = match(')')
          ? advance()!
          : newParseError('TODO did not close bracket in grouping expression');

        return {
          type: 'grouping',
          body,
          openingBracketToken,
          closingBracketToken
        };
      } else if (matchType(Lexer.tokenType.literal)) {
        const literalToken: Lexer.token = advance()!;
        // TODO
        const literal: number =
          literalToken.lexeme === 'inf'
            ? Infinity
            : Number(literalToken.lexeme);
        return {
          type: 'literal',
          literal,
          literalToken
        };
      } else if (matchType(Lexer.tokenType.identifier)) {
        const identifierToken: Lexer.token = advance()!;

        return {
          type: 'identifier',
          identifierToken
        };
      } else if (match('func')) return parseFuncExpression();
      else if (match('match')) return parseMatchExpression();
      else throw new Error('could not match anything in parsing expressions!');
      // TODO
    }

    function parseFuncExpression(): expression {
      function parseFuncExprParam(): [
        Lexer.token /*identifier*/,
        typeExpression,
        Lexer.token | undefined /*colon for type annotation*/,
        Lexer.token | undefined /*comma for next param*/
      ][] {
        // TODO obj out of that??
        const params: [
          Lexer.token /*identifier*/,
          typeExpression,
          Lexer.token | undefined /*colon for type annotation*/,
          Lexer.token | undefined /*comma for next param*/
        ][] = [];

        // TODO consumeComments() and isEof()
        while (!isAtEnd() && !match(')')) {
          consumeComments(comments);

          if (params.length !== 0 && params[params.length - 1][3] === undefined)
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

          params.push([
            identifierToken,
            explicitType ?? { type: 'infer', comments: [] },
            colonToken,
            commaToken
          ]);
        }

        return params;
      }

      if (!match('func'))
        throw new Error(
          'Internal error, called this function, even tho here is no function'
        );
      const funcToken: Lexer.token = advance()!;

      // TODO generics

      const openingBracketToken: Lexer.token = match('(')
        ? advance()!
        : newParseError('TODO functions must be opend with (');

      const params = parseFuncExprParam();

      const closingBracketToken: Lexer.token = match(')')
        ? advance()!
        : newParseError('TODO functions must be closed with )');

      const colonToken: Lexer.token | undefined = match(':') ? advance()! : undefined;
      const typeExpression: typeExpression | undefined =
        colonToken !== undefined ? parseTypeExpression() : undefined;

      const arrowToken: Lexer.token = match('->')
        ? advance()!
        : newParseError('TODO functions must have a ->');

      const body: expression = parseExpression();

      const typeAnnotation: hasExplicitType =
        colonToken === undefined
          ? {
              hasExplicitType: false,
              typeExpression: { type: 'infer', comments: [] }
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

      const arrowToken = match('=>') ? advance()! : undefined;
      if (arrowToken === undefined) return primitive;

      return {
        type: 'func-type',
        parameters: [[primitive, undefined]],
        returnType: parseTypeExpression(), // same level because precedence order
        openingBracketToken: undefined,
        closingBracketToken: undefined,
        arrowToken,
        comments
      };
    } else if (match('(')) {
      const openingBracketToken: Lexer.token = advance()!;
      consumeComments(comments);
      const closingBracket: Lexer.token | undefined = match(')') ? advance()! : undefined;
      // TODO HERE it could directly come a `)` for a `() => T` type

      const body: [
        typeExpression,
        Lexer.token | undefined /* comma token */
      ][] = [];
      while (closingBracket === undefined && !isAtEnd() && !match(')')) {
        consumeComments(comments);

        if (body.length !== 0 && body[body.length - 1][1] === undefined)
          newParseError(
            'TODO did not get a comma in last type expression, while grouping types'
          );

        const type: typeExpression = parseTypeExpression();

        consumeComments(comments);
        // TODO isAtEnd() check...

        const commaToken: Lexer.token | undefined = match(',') ? advance()! : undefined;

        body.push([type, commaToken]);
      }

      const closingBracketToken: Lexer.token =
        closingBracket !== undefined
          ? closingBracket
          : match(')')
          ? advance()!
          : newParseError(
              'TODO did not close bracket in type-grouping expression'
            );

      const arrowToken: Lexer.token | undefined = match('=>') ? advance()! : undefined;
      if (arrowToken !== undefined) {
        return {
          type: 'func-type',
          parameters: body,
          returnType: parseTypeExpression(), // same level because precedence order
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
        else if (body.length === 1 && body[0][1] !== undefined)
          newParseError(
            'TODO got a trailling comma at the end of a grouping expression'
          );

        return {
          type: 'grouping',
          body: (body[0] ?? [])[0],
          openingBracketToken,
          closingBracketToken,
          comments
        };
      }
    } else throw new Error('TODO did not match any type expression statement');
  }
  // #endregion

  export function parse(
    code: string,
    filename: string
  ): statement[] | undefined {
    larser = new Larser(code, filename);

    const statements: statement[] = [];
    while (!isAtEnd()) statements.push(parseStatement());

    if (parserErrors.length === 0) return statements;

    console.error(
      inspect(parserErrors, {
        depth: 999
      })
    );
    console.log(
      inspect(statements, {
        depth: 999
      })
    );
  }
}

// TODO: add test codes, where after each step of a valid thing, it suddenly eofs and where between each thing a comment is

function debug() {
  console.time('t');
  // group test { let x = 5 + 2 * (func (x) -> x + 3 | 1 << 2 > 4).a.b() + nan + inf + 3e-3; }
  // let _ = 1 + (2 - 3) * 4 / 5 ** 6 % 7;
  // invalid to do: `a.(b).c` but (a.b).c is ok
  // let _ = a(5+32,4)

  // use std; let _ = (func (x) -> 3 * x)(5);

  // let x: (i32) => ((f32), (tust,) => tast => (tist)) => (test) = func (a, b, c) -> 4;
  // TODO where are the opening brackets of tust??
  const parsed = Parser.parse(
    'let x: (i32) => ((f32), (tust,) => tast => () => (tist)) => (test) = func (a, b, c) -> 4;',
    'test'
  );
  console.timeEnd('t');

  console.log(
    inspect(parsed, {
      depth: 999
    })
  );
}

debug();
