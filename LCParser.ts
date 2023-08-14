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
      };

  // TODO what about generics: func[T1, T2]
  export type funcExpression = {
    type: 'func';
    parameters: [
      Lexer.token /*identifier*/,
      typeExpression,
      Lexer.token | undefined /*colon for type*/,
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
  type typeExpression = comment &
    (
      | { type: 'infer' }
      | {
          type: 'primitive';
          value: Lexer.token; // keyword like i32/f32 or generic identifier/type identifier
        }
      | {
          type: 'func';
          parameters: typeExpression[];
          returnType: typeExpression;
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
      const lexerNext = this.lexer.next();
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
      const lexerNext = this.lexer.next();
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

    const currentToken = peek();
    larser.advanceToken();
    return currentToken;
  }

  function match(...tokens: string[]): boolean {
    if (isAtEnd()) return false;
    const currentToken = peek();
    return currentToken !== undefined && tokens.includes(currentToken.lexeme);
  }

  function matchType(...tokenTypes: Lexer.tokenType[]): boolean {
    if (isAtEnd()) return false;
    const currentToken = peek();
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

      const localFileName = matchType(Lexer.tokenType.identifier)
        ? advance()!
        : newParseError('TODO didnt get an identifier in use statement');

      consumeComments(comments);

      if (isAtEnd())
        return invalidEof('unexpected eof in use statement: missing semicolon');

      const semicolonToken = match(';')
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
          ? { hasExplicitType: false }
          : {
              hasExplicitType: true,
              typeExpression: typeAnnotation!,
              colonToken: colonToken
            };

      return {
        type: 'let',
        identifierToken,
        body,
        letToken,
        ...explicitType,
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
        const operatorToken = advance()!;
        consumeComments(comments);
        const rightSide = parseExprLvl1();
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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl2();

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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl3();

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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl4();

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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl5();

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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl6();

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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl7();

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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl8();

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
        const operatorToken = advance()!;
        const rightSide = parseExprLvl8(); // same level because precedence order

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
        const operatorToken = advance()!;
        const body = parseExprLvl9(); // same level?? TODO

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
        const token = advance()!;

        if (token.lexeme === '.') {
          // f.
          const propertyToken = matchType(Lexer.tokenType.identifier)
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
          const args: [expression, Lexer.token | undefined][] = [];
          while (!isAtEnd() && !match(')')) {
            // if last was not comma
            if (args.length !== 0 && args[args.length - 1][1] === undefined)
              newParseError(
                'TODO, missing comma in function call argument list'
              );
            const expression = parseExpression();
            const commaToken: Lexer.token | undefined = match(',')
              ? advance()!
              : undefined;
            args.push([expression, commaToken]);
          }

          // TODO trailling commas

          const closingBracketToken = advance()!;
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
        const openingBracketToken = advance()!;
        const body = parseExpression();
        const closingBracketToken = match(')')
          ? advance()!
          : newParseError('TODO did not close bracket in grouping expression');

        return {
          type: 'grouping',
          body,
          openingBracketToken,
          closingBracketToken
        };
      } else if (matchType(Lexer.tokenType.literal)) {
        const literalToken = advance()!;
        // TODO
        const literal =
          literalToken.lexeme === 'inf'
            ? Infinity
            : Number(literalToken.lexeme);
        return {
          type: 'literal',
          literal,
          literalToken
        };
      } else if (matchType(Lexer.tokenType.identifier)) {
        const identifierToken = advance()!;

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
        Lexer.token | undefined /*colon for type*/,
        Lexer.token | undefined /*comma for next param*/
      ][] {
        // TODO
        const params: [
          Lexer.token /*identifier*/,
          typeExpression,
          Lexer.token | undefined /*colon for type*/,
          Lexer.token | undefined /*comma for next param*/
        ][] = [];

        // TODO consumeComments() and isEof()
        while (!match(')')) {
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

          // TODO type with ":"
          const colonToken: Lexer.token | undefined = match(':')
            ? advance()!
            : undefined;

          const explicitType: typeExpression | undefined =
            colonToken === undefined ? undefined : parseTypeExpression();

          const commaToken: Lexer.token | undefined = match(',')
            ? advance()!
            : undefined;

          params.push([identifierToken, explicitType!, colonToken, commaToken]);
        }

        return params;
      }

      const funcToken = advance()!;

      // TODO generics

      const openingBracketToken: Lexer.token = match('(')
        ? advance()!
        : newParseError('TODO functions must be opend with (');

      const params = parseFuncExprParam();

      const closingBracketToken: Lexer.token = match(')')
        ? advance()!
        : newParseError('TODO functions must be closed with )');

      const colonToken = match(':') ? advance()! : undefined;
      const typeExpression: typeExpression =
        colonToken !== undefined
          ? parseTypeExpression()
          : (undefined as unknown as typeExpression);

      const arrowToken: Lexer.token = match('->')
        ? advance()!
        : newParseError('TODO functions must have a ->');

      const body: expression = parseExpression();

      // TODO
      const typeAnnotation: hasExplicitType =
        colonToken === undefined
          ? { hasExplicitType: false }
          : {
              hasExplicitType: true,
              typeExpression,
              colonToken
            };

      return {
        type: 'func',
        parameters: params, // TODO
        body,
        funcToken,
        openingBracketToken,
        closingBracketToken,
        ...typeAnnotation,
        arrowToken
      };
    }

    function parseMatchExpression(): expression {
      return {} as any;
    }

    return { ...parseExprLvl0(), comments };
  }

  function parseTypeExpression(): typeExpression {
    // TODO
    return {} as any;
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
  console.clear();
  const parsed = Parser.parse('let x = func (x, y z) -> 4;', 'test');
  console.timeEnd('t');

  console.log(
    inspect(parsed, {
      depth: 999
    })
  );
}

// debug();
