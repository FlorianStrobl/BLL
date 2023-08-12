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
  type typeExpression = {} & comment;
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
  // #endregion

  // #region parser
  function parseExpression(): expression {
    function parseExprLvl0(): expression {
      let left: expression = parseExprLvl1();

      // TODO isAtEnd() and consumeComment()
      while (match('|')) {
        left = {
          type: 'binary',
          operator: '|',
          operatorLex: advance()!,
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
          operatorLex: advance()!,
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
          operatorLex: advance()!,
          left,
          right: parseExprLvl3()
        } as any;
      }

      return left;
    }

    function parseExprLvl3(): expression {
      let left: expression = parseExprLvl4();

      while (match('==', '!=')) {
        const operatorToken = advance()!;
        left = {
          type: 'binary',
          operator: operatorToken.lexeme as '==',
          operatorToken,
          left,
          right: parseExprLvl4()
        } as any;
      }

      return left;
    }

    function parseExprLvl4(): expression {
      let left: expression = parseExprLvl5();

      while (match('<', '>', '<=', '>=')) {
        const operatorToken = advance()!;
        left = {
          type: 'binary',
          operator: operatorToken.lexeme as '<',
          operatorToken,
          left,
          right: parseExprLvl5()
        } as any;
      }

      return left;
    }

    function parseExprLvl5(): expression {
      let left: expression = parseExprLvl6();

      while (match('<<', '>>')) {
        const operatorToken = advance()!;
        left = {
          type: 'binary',
          operator: operatorToken.lexeme as '<<',
          operatorToken,
          left,
          right: parseExprLvl6()
        } as any;
      }

      return left;
    }

    function parseExprLvl6(): expression {
      let left: expression = parseExprLvl7();

      while (match('+', '-')) {
        const operatorToken = advance()!;
        left = {
          type: 'binary',
          operator: operatorToken.lexeme as '+',
          operatorToken,
          left,
          right: parseExprLvl7()
        } as any;
      }

      return left;
    }

    function parseExprLvl7(): expression {
      let left: expression = parseExprLvl8();

      while (match('*', '/', '%')) {
        const operatorToken = advance()!;
        left = {
          type: 'binary',
          operator: operatorToken.lexeme as '*',
          operatorToken,
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
        const operatorToken = advance()!;

        left = {
          type: 'binary',
          operator: operatorToken.lexeme as '**',
          operatorToken,
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
        const operatorToken = advance()!;

        return {
          type: 'unary',
          operator: operatorToken.lexeme as '-',
          operatorToken,
          body: parseExprLvl9()
        } as any;
      }

      return parseExprLvl10();
    }

    // TODO just to debug
    function parseExprLvl10(): expression {
      let left: expression = primary();
      while (match('(', '.')) {
        const lex = advance()!;
        if (lex.lexeme === '.') {
          const property = advance();
          left = {
            type: 'PropertyAccess',
            target: left,
            property,
            dotToken: lex
          } as any;
        } else {
          //   f(
          const args: any = [];
          while (!isAtEnd() && !match(')')) {
            // parse until we find `)` (end of argument list)
            if (args.length > 0 && match(',')) advance();
            args.push(parseExpression());
          }
          const closingBracketToken = advance()!;
          left = {
            type: 'FunctionCall',
            callee: left,
            args,
            openingBracketToken: lex,
            closingBracketToken
          } as any;
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
          openingBracket: advance(),
          value: parseExpression(),
          endBracket: undefined as unknown
        } as any;
        if (!match(')')) throw Error('Expression wasnt closed'); // TODO
        // @ts-expect-error
        expression.endBracket = advance()!;
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
          typeLex: advance()!,
          ...parseFuncExpression()
        } as any;
      } else if (match('match')) {
        // TODO
        return {} as any;
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
            if (!match(','))
              throw Error('argument list must have commas in between'); // TODO
            commas.push(advance()!);

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

          if (match(':')) {
            let doublePoint: Lexer.token = advance()!;
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

      if (!match('(')) throw Error('functions must be opend with ('); // TODO
      let openingBracket: Lexer.token = advance()!;

      let params: {
        args: Lexer.token[];
        commas: Lexer.token[];
      } = parseFuncExprArgs();

      if (!match(')')) throw Error('functions must be closed with )'); // TODO
      let closingBracket: Lexer.token = advance()!;

      if (!match('->')) throw Error('functions must have a ->'); // TODO
      let arrow: Lexer.token = advance()!;

      const body: expression = parseExpression();

      return { openingBracket, closingBracket, params, arrow, body } as any;
    }

    return parseExprLvl0();
  }

  // TODO comments could be ANYWHERE, just aswell as a bad eof
  // TODO test with real code, but insert a comment between each and every token!
  // TODO check everywhere isAtEnd()
  function parseStatement(): statement {
    // #region helper functions
    function invalidEof(...args: any[]): never {
      return newParseError('TODO invalid eof while parsing', ...args);
    }

    function consumeComments(commentArr: Lexer.token[]): void {
      if (isAtEnd()) return;
      while (!isAtEnd() && matchType(Lexer.tokenType.comment))
        commentArr.push(advance()!);
    }

    function parseUseBody(): useStatement {
      const useToken: Lexer.token = advance()!;
      const path: Lexer.token[] = [];
      const comments: Lexer.token[] = [];

      if (isAtEnd()) return invalidEof('no use body in use statement');

      while (!isAtEnd() && !match(';')) {
        if (matchType(Lexer.tokenType.comment)) comments.push(advance()!);
        else if (matchType(Lexer.tokenType.identifier)) path.push(advance()!);
        else if (match('.')) path.push(advance()!);
        else
          throw new Error(
            'TODO invalid use body statement while parsing code.'
          );
      }

      const semicolonToken = advance()!;
      // TODO
      if (semicolonToken.lexeme !== ';' && isAtEnd())
        return invalidEof('use body was not correctly finished');

      return {
        semicolonToken,
        useToken,
        path,
        comments
      };
    }
    // #endregion

    if (isAtEnd()) return invalidEof('no statement parsed');
    const comments: Lexer.token[] = [];

    if (matchType(Lexer.tokenType.comment)) {
      consumeComments(comments);
      return { comments };
    }

    if (match(';')) {
      const semicolonToken: Lexer.token = advance()!;
      consumeComments(comments);
      return { type: 'empty', semicolonToken, comments };
    }

    if (match('use')) {
      return {
        type: 'import',
        ...parseUseBody()
      };
    }

    const isPub: isPublic = match('pub')
      ? {
          isPub: true,
          pubToken: advance()!
        }
      : { isPub: false };

    consumeComments(comments);

    // must have gotten `pub`, else we would have gotten the eof error already/had returned
    if (isAtEnd()) return invalidEof('no statement parsed after getting "pub"');

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
          'unexpected eof in let statement after the identifier'
        );

      const equalsToken: Lexer.token = match('=')
        ? advance()!
        : newParseError("TODO cant have a let statement without a '=' symbol");

      consumeComments(comments);

      if (isAtEnd())
        return invalidEof('unexpected eof in let statement after =');

      const body: expression = parseExpression();

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('unexpected eof in let statement');

      const semicolonToken: Lexer.token = match(';')
        ? advance()!
        : newParseError(
            "TODO let statements must be finished with a ';' symbol"
          );

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
      // TODO type{ and type=
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
    return 'error' as never;
  }
}

// TODO: add test codes, where after each step of a valid thing, it suddenly eofs and where between each thing a comment is

console.time('t');
const parsed = Parser.parse(
  'pub group test { let x = 5 + 2 * (func () -> 5).a.6(); }',
  'test'
);
console.timeEnd('t');

console.log(
  inspect(parsed, {
    depth: 999
  })
);
