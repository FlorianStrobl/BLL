import { Lexer } from './LCLexer';
// @ts-ignore
import { inspect } from 'util';

export namespace Parser {
  let parserErrors: any[] = [];

  // #region types
  type comment = { comments: Lexer.token[] };

  type statement =
    | comment
    | ({ type: 'empty'; semicolonToken: Lexer.token } & comment)
    | ({ type: 'import' } & useStatement)
    | (pubStatements & isPublic);
  type isPublic =
    | {
        isPub: true;
        pubToken: Lexer.token;
      }
    | { isPub: false };
  type useStatement = {
    useToken: Lexer.token;
    path: Lexer.token[];
    semicolonToken: Lexer.token;
  } & comment;
  type pubStatements = comment &
    (
      | {
          type: 'let';
          letToken: Lexer.token;
          identifierToken: Lexer.token;
          equalsToken: Lexer.token;
          semicolonToken: Lexer.token;
          body: expression;
        }
      | { type: 'type=' }
      | { type: 'type{' }
      | {
          type: 'group';
          groupToken: Lexer.token;
          identifierToken: Lexer.token;
          openingBracketToken: Lexer.token;
          closingBracketToken: Lexer.token;
          body: statement[];
        }
    );

  // match, func, "nan", "inf", literals
  type expression = {} & comment;

  // types: i32, f32, infer, empty
  // #endregion

  // #region helper
  // part which handles the lexer
  class Larser {
    code: string;
    filename: string;

    lexer: Generator<Lexer.nextToken>;

    previousToken: Lexer.token;
    currentToken: Lexer.token;
    eof: boolean = false;

    constructor(code: string, filename: string) {
      this.code = code;
      this.filename = filename;
      this.lexer = Lexer.lexeNextTokenIter(code);

      const lexerNext = this.lexer.next();
      if (lexerNext.done === false && lexerNext.value.valid) {
        this.currentToken = lexerNext.value.value;
        this.previousToken = this.currentToken;
      } else if (
        lexerNext.done === false &&
        !lexerNext.value.valid &&
        lexerNext.value.value.type === 'eof'
      ) {
        this.eof = true;
        this.previousToken = {} as any;
        this.currentToken = {} as any;
      } else this.errorHandling();
    }

    public isEof(): boolean {
      return this.eof;
    }

    public getPreviousToken(): Lexer.token {
      return this.previousToken;
    }

    public getCurrentToken(): Lexer.token {
      return this.currentToken;
    }

    public advanceToken(): void {
      if (this.isEof()) return;

      this.previousToken = this.currentToken;
      const lexerNext = this.lexer.next();

      if (lexerNext.done === false && lexerNext.value.valid) {
        this.currentToken = lexerNext.value.value;
      } else if (
        lexerNext.done === false &&
        !lexerNext.value.valid &&
        lexerNext.value.value.type === 'eof'
      )
        this.eof = true;
      else this.errorHandling();
    }

    errorHandling(): never {
      // TODO
      const tokens = Lexer.lexe(this.code);
      throw new Error(
        this.filename +
          ': ' +
          (tokens === undefined ? 'no tokens' : tokens.toString())
      );
    }
  }

  let larser: Larser;

  function isAtEnd(): boolean {
    return larser.isEof();
  }

  function peek(): Lexer.token | undefined {
    if (isAtEnd()) return undefined;
    return larser.getCurrentToken();
  }

  function previous(): Lexer.token {
    return larser.getPreviousToken();
  }

  function advance(): Lexer.token | undefined {
    if (isAtEnd()) return undefined;

    larser.advanceToken();
    return larser.getPreviousToken();
  }

  function match(...tokens: string[]): Lexer.token | undefined {
    if (isAtEnd()) return undefined;

    for (const token of tokens)
      if (larser.getCurrentToken().lexeme === token) return advance();

    return undefined;
  }

  function matchType(...tokens: Lexer.tokenType[]): Lexer.token | undefined {
    if (isAtEnd()) return undefined;

    for (const token of tokens)
      if (larser.getCurrentToken().type === token) return advance();

    return undefined;
  }

  function newParseError(...args: any[]): never {
    parserErrors = [...parserErrors, ...args];
    return {} as never;
  }
  // #endregion

  // #region parser
  function parseExpression(): expression {
    function parseExprLvl0(): expression {
      let left: expression = parseExprLvl1();

      while (match('|')) {
        left = {
          type: 'binary',
          operator: '|',
          operatorLex: previous(),
          left,
          right: parseExprLvl1()
        } as any;
      }

      return left;
    }

    function parseExprLvl1(): expression {
      let left: expression = parseExprLvl2();

      while (match('^')) {
        left = {
          type: 'binary',
          operator: '^',
          operatorLex: previous(),
          left,
          right: parseExprLvl2()
        } as any;
      }

      return left;
    }

    function parseExprLvl2(): expression {
      let left: expression = parseExprLvl3();

      while (match('&')) {
        left = {
          type: 'binary',
          operator: '&',
          operatorLex: previous(),
          left,
          right: parseExprLvl3()
        } as any;
      }

      return left;
    }

    function parseExprLvl3(): expression {
      let left: expression = parseExprLvl4();

      while (match('==', '!=')) {
        left = {
          type: 'binary',
          operator: previous().lexeme as '==',
          operatorLex: previous(),
          left,
          right: parseExprLvl4()
        } as any;
      }

      return left;
    }

    function parseExprLvl4(): expression {
      let left: expression = parseExprLvl5();

      while (match('<', '>', '<=', '>=')) {
        left = {
          type: 'binary',
          operator: previous().lexeme as '<',
          operatorLex: previous(),
          left,
          right: parseExprLvl5()
        } as any;
      }

      return left;
    }

    function parseExprLvl5(): expression {
      let left: expression = parseExprLvl6();

      while (match('<<', '>>')) {
        left = {
          type: 'binary',
          operator: previous().lexeme as '<<',
          operatorLex: previous(),
          left,
          right: parseExprLvl6()
        } as any;
      }

      return left;
    }

    function parseExprLvl6(): expression {
      let left: expression = parseExprLvl7();

      while (match('+', '-')) {
        left = {
          type: 'binary',
          operator: previous().lexeme as '+',
          operatorLex: previous(),
          left,
          right: parseExprLvl7()
        } as any;
      }

      return left;
    }

    function parseExprLvl7(): expression {
      let left: expression = parseExprLvl8();

      while (match('*', '/', '%')) {
        left = {
          type: 'binary',
          operator: previous().lexeme as '*',
          operatorLex: previous(),
          left,
          right: parseExprLvl8()
        } as any;
      }

      return left;
    }

    function parseExprLvl8(): expression {
      let left: expression = parseExprLvl9();

      // right to left precedence:
      // if because precedence order
      if (match('**', '***')) {
        left = {
          type: 'binary',
          operator: previous().lexeme as '**',
          operatorLex: previous(),
          left,
          right: parseExprLvl8() // same level because precedence order
        } as any;
      }

      return left;
    }

    function parseExprLvl9(): expression {
      // unary:
      // TODO, "!"
      if (match('!', '-', '+', '~')) {
        return {
          type: 'unary',
          operator: previous().lexeme as '-',
          operatorLex: previous(),
          body: parseExprLvl9()
        } as any;
      }

      return parseExprLvl10();
    }

    // TODO just to debug
    function parseExprLvl10(): expression {
      let left: expression = primary();
      while (match('(', '.')) {
        if (previous().lexeme === '.') {
          const property = advance();
          left = { type: 'PropertyAccess', target: left, property } as any;
        } else {
          //   f(
          let args: any = [];
          while (!match(')')) {
            // parse until we find `)` (end of argument list)
            if (args.length > 0) match(',');
            args.push(parseExpression());
          }
          left = { type: 'FunctionCall', callee: left, args } as any;
        }
      }
      return left;
    }

    // TODO, parse literals, highest precedence level
    function primary(): expression {
      if (match('(')) {
        // TODO
        const expression: expression = {
          type: 'grouping',
          openingBracket: previous(),
          value: parseExpression(),
          endBracket: undefined as unknown
        } as any;
        if (!match(')')) throw Error('Expression wasnt closed'); // TODO
        // @ts-expect-error
        expression.endBracket = previous();
        return expression;
      } else if (peek()!.type === Lexer.tokenType.literal) {
        return { type: 'literal', literal: advance()! } as any;
      } else if (peek()!.type === Lexer.tokenType.identifier) {
        // TODO do not do () because of (x.y).z
        // TODO, x, x(), x.y, x.y() but not x.y().z
        let identifier = advance()!;

        return { type: 'identifier', identifier: identifier } as any;
      } else if (match('func')) {
        return {
          type: 'func',
          typeLex: previous(),
          ...parseFuncExpression()
        } as any;
      } else
        throw new Error('could not match anything in parsing expressions!');
      // TODO
    }

    function parseFuncExpression(): expression {
      function parseFuncExprArgs(): {
        args: Lexer.token[];
        commas: Lexer.token[];
      } {
        const args: Lexer.token[] = [];
        const commas: Lexer.token[] = [];

        while (peek()?.lexeme !== ')') {
          if (args.length > 0) {
            let lastComma = match(',');
            if (lastComma === undefined)
              throw Error('argument list must have commas in between'); // TODO
            commas.push(lastComma);

            // TODO: warning for trailing commas
            if (peek()?.lexeme === ')') break; // had trailing comma
          }

          let identifier: Lexer.token | undefined = advance();
          if (
            identifier === undefined ||
            identifier.type !== Lexer.tokenType.identifier
          )
            throw Error('must have identifier between two commas'); // TODO

          args.push(identifier);

          let doublePoint: Lexer.token | undefined;
          if ((doublePoint = match(':'))) {
            function parseFuncArgExprType(): expression {
              return undefined as any;
            }
            let typeAnnotation = parseFuncArgExprType();
            // @ts-expect-error
            args[args.length - 1].type = typeAnnotation;
            // @ts-expect-error
            args[args.length - 1].doublePoint = doublePoint;
          }
        }
        return { args, commas };
      }

      let openingBracket: Lexer.token | undefined;
      if (!(openingBracket = match('(')))
        throw Error('functions must be opend with ('); // TODO

      let params: {
        args: Lexer.token[];
        commas: Lexer.token[];
      } = parseFuncExprArgs();

      let closingBracket: Lexer.token | undefined;
      if (!(closingBracket = match(')')))
        throw Error('functions must be closed with )'); // TODO

      let arrow: Lexer.token | undefined;
      if (!(arrow = match('->'))) throw Error('functions must have a ->'); // TODO

      const body: expression = parseExpression();

      return { openingBracket, closingBracket, params, arrow, body } as any;
    }

    return parseExprLvl0();
  }

  // TODO comments could be ANYWHERE, just aswell as a bad eof
  // TODO test with real code, but insert a comment between each and every token!
  // TODO check everywhere isAtEnd()
  function parseStatement(): statement {
    // #region helper
    function consumeComments(commentArr: Lexer.token[]): Lexer.token[] {
      if (isAtEnd()) return commentArr; // TODO, also for others
      while (matchType(Lexer.tokenType.comment)) commentArr.push(previous());
      return commentArr;
    }

    function invalidEof(...args: any[]): never {
      return newParseError('TODO invalid eof while parsing', ...args);
    }
    // #endregion

    function parseUseBody(): useStatement {
      const useToken: Lexer.token = previous();
      const path: Lexer.token[] = [];
      const comments: Lexer.token[] = [];

      if (isAtEnd()) return invalidEof('no use body in use statement');

      while (!isAtEnd() && !match(';')) {
        if (matchType(Lexer.tokenType.comment)) comments.push(previous());
        else if (matchType(Lexer.tokenType.identifier)) path.push(previous());
        else if (match('.')) path.push(previous());
        else
          throw new Error(
            'TODO invalid use body statement while parsing code.'
          );
      }

      if (previous().lexeme !== ';' && isAtEnd())
        return invalidEof('use body was not correctly finished');

      return {
        semicolonToken: previous(),
        useToken,
        path,
        comments
      };
    }

    if (isAtEnd()) return invalidEof('no statement parsed');

    if (matchType(Lexer.tokenType.comment)) {
      const comments: Lexer.token[] = [previous()];
      consumeComments(comments);
      return { comments };
    }

    if (match(';')) {
      const semicolonToken: Lexer.token = previous();
      const comments: Lexer.token[] = [];
      consumeComments(comments);
      return { type: 'empty', semicolonToken, comments };
    }

    if (match('use')) {
      return {
        type: 'import',
        ...parseUseBody()
      };
    }

    const comments: Lexer.token[] = [];
    let isPub: isPublic = { isPub: false };
    if (match('pub')) {
      isPub = {
        isPub: true,
        pubToken: previous()
      };
    }

    consumeComments(comments);

    // must have gotten `pub`, else before that we would have gotten the error already
    if (isAtEnd()) return invalidEof('no statement parsed after getting "pub"');

    if (match('group')) {
      const groupToken: Lexer.token = previous();

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in group statement');

      const identifierToken: Lexer.token | undefined = matchType(
        Lexer.tokenType.identifier
      );
      if (identifierToken === undefined)
        newParseError(
          'TODO cant have an undefined identifier for a group statement'
        );

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in group statement');

      const openingBracketToken: Lexer.token | undefined = match('{');
      if (openingBracketToken === undefined)
        newParseError(
          "TODO cant have a group statement without an opening brackt '{'"
        );

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in group statement');

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) body.push(parseStatement());
      // TODO isAtEnd()
      if (previous().lexeme !== '}' && isAtEnd())
        return invalidEof('unexpected eof in group statement');
      const closingBracketToken: Lexer.token = previous();

      consumeComments(comments);

      return {
        ...isPub,
        type: 'group',
        groupToken,
        identifierToken,
        openingBracketToken,
        closingBracketToken,
        body,
        comments
      };
    } else if (match('let')) {
      const letToken: Lexer.token = previous();

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement');

      const identifierToken: Lexer.token | undefined = matchType(
        Lexer.tokenType.identifier
      );
      if (identifierToken === undefined)
        newParseError(
          'TODO cant have an undefined identifier for a let statement'
        );

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement');

      const equalsToken: Lexer.token | undefined = match('=');
      if (equalsToken === undefined)
        newParseError("TODO cant have a let statement without a '=' symbol");

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement');

      const body: expression = parseExpression();

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement');

      const semicolonToken: Lexer.token | undefined = match(';');
      if (semicolonToken === undefined)
        newParseError("TODO let statements must be finished with a ';' symbol");

      return {
        ...isPub,
        type: 'let',
        letToken,
        identifierToken,
        equalsToken,
        semicolonToken,
        body,
        comments
      };
    } else if (match('type')) {
      // type{ and type=
      return { ...isPub } as any;
    }

    throw new Error('TODO could not parse any statement properly');
  }
  // #endregion

  export function parse(code: string, filename: string): statement[] {
    larser = new Larser(code, filename);

    const statements: statement[] = [];
    while (!isAtEnd()) statements.push(parseStatement());
    if (parserErrors.length === 0) return statements;

    console.error(parserErrors);
    console.log(statements);
    newParseError();
  }
}

console.log(
  inspect(
    Parser.parse(
      'pub group test { /*0*/ pub /*1*/ let /*2*/ x /*3*/ = 5 + 2 * (3 + 2) ; /*6*/ } /*7*/',
      'test'
    ),
    {
      depth: 999
    }
  )
);
