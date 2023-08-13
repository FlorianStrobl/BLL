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

  export type statement =
    | comment
    | ({ type: 'empty'; semicolonToken: Lexer.token } & comment)
    | ({
        type: 'import';
        useToken: Lexer.token;
        semicolonToken: Lexer.token;
        path: Lexer.token[];
      } & comment)
    | (pubStatements & isPublic);
  type isPublic =
    | {
        isPub: true;
        pubToken: Lexer.token;
      }
    | { isPub: false };
  type hasExplicitType =
    | {
        hasExplicitType: true;
        doublePointToken: Lexer.token;
        typeExpression: typeExpression;
      }
    | {
        hasExplicitType: false;
      };
  type pubStatements = comment &
    (
      | ({
          type: 'let';
          letToken: Lexer.token;
          identifierToken: Lexer.token;
          equalsToken: Lexer.token;
          semicolonToken: Lexer.token;
          body: expression & comment;
        } & hasExplicitType)
      | { type: 'type=' } // TODO
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
  // TODO
  export type expression =
    | { type: 'literal'; literalToken: Lexer.token; literal: any }
    | { type: 'identifier'; identifier: string; identifierToken: Lexer.token }
    // TODO what about func[T]
    | ({
        type: 'func';
        funcToken: Lexer.token;
        openingBracketToken: Lexer.token;
        closingBracketToken: Lexer.token;
        arrowToken: Lexer.token;
        argCommaTokens: Lexer.token[];
        arguments: [Lexer.token, typeExpression][];
        body: expression;
      } & hasExplicitType)
    | {
        type: 'grouping';
        openingBracketToken: Lexer.token;
        closingBracketToken: Lexer.token;
        body: expression;
      }
    | {
        type: 'unary';
        operator: string;
        operatorToken: Lexer.token;
        body: expression;
      }
    | {
        type: 'binary';
        operator: string;
        operatorToken: Lexer.token;
        leftSide: expression;
        rightSide: expression;
      }
    | {
        type: 'propertyAccess';
        dotToken: Lexer.token;
        source: expression;
        propertyToken: Lexer.token;
      }
    | {
        type: 'functionCall';
        function: expression;
        openingBracketToken: Lexer.token;
        closingBracketToken: Lexer.token;
        arguments: expression[];
        commaTokens: Lexer.token[];
      }
    | { type: 'match' };

  // types: i32, f32, infer, empty, generics?
  // TODO
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
      return { comments };
    }

    if (match(';')) {
      const semicolonToken: Lexer.token = advance()!;
      consumeComments(comments);
      return { type: 'empty', semicolonToken, comments };
    }

    if (match('use')) {
      const useToken: Lexer.token = advance()!;
      const path: Lexer.token[] = [];

      consumeComments(comments);

      if (isAtEnd()) return invalidEof('no use body in use statement');

      while (!isAtEnd() && !match(';')) {
        // TODO
        consumeComments(comments);

        if (isAtEnd() || match(';')) break;

        if (matchType(Lexer.tokenType.identifier) || match('.'))
          path.push(advance()!);
        else
          throw new Error(
            'TODO invalid use body statement while parsing code.'
          );
      }

      if (isAtEnd())
        return invalidEof('unexpected eof in use statement: missing semicolon');

      const semicolonToken = match(';')
        ? advance()!
        : newParseError('TOOD did not get semicolon in a use statement');

      return {
        type: 'import',
        semicolonToken,
        useToken,
        path,
        comments
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
          'unexpected eof in let statement after asuming an identifier'
        );

      const doublePointToken: Lexer.token | undefined = match(':')
        ? advance()!
        : undefined;

      consumeComments(comments);

      if (doublePointToken !== undefined && isAtEnd())
        return invalidEof('unexpected eof in let statement after getting ":"');

      const typeAnnotation: typeExpression | undefined =
        doublePointToken !== undefined ? parseTypeExpression() : undefined;

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

      return {
        ...isPub,
        type: 'let',
        letToken,
        identifierToken,
        equalsToken,
        semicolonToken,
        body,
        comments,
        ...(doublePointToken === undefined
          ? {
              hasExplicitType: false
            }
          : {
              hasExplicitType: true,
              doublePointToken,
              typeExpression: typeAnnotation
            })
      };
    } else if (match('type')) {
      // TODO type{ and type=
      return { ...isPub } as any;
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          leftSide,
          rightSide
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
          operatorToken,
          body
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
            dotToken: token,
            source: left,
            propertyToken
          };
        } else {
          //   f(
          const args: expression[] = [];
          const commaTokens: Lexer.token[] = [];
          while (!isAtEnd() && !match(')')) {
            // parse until we find `)` (end of argument list)
            if (args.length > 0 && match(',')) commaTokens.push(advance()!);
            args.push(parseExpression());
          }

          // TODO trailling commas

          const closingBracketToken = advance()!;
          left = {
            type: 'functionCall',
            openingBracketToken: token,
            closingBracketToken,
            commaTokens,
            arguments: args,
            function: left
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
          openingBracketToken,
          closingBracketToken,
          body
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
          literalToken,
          literal
        };
      } else if (matchType(Lexer.tokenType.identifier)) {
        const identifierToken = advance()!;

        return {
          type: 'identifier',
          identifierToken,
          identifier: identifierToken.lexeme
        };
      } else if (match('func')) return parseFuncExpression();
      else if (match('match')) return parseMatchExpression();
      else throw new Error('could not match anything in parsing expressions!');
      // TODO
    }

    function parseFuncExpression(): expression {
      function parseFuncExprArgs(): {
        args: [Lexer.token, typeExpression][];
        commas: Lexer.token[];
      } {
        const args: [Lexer.token, typeExpression][] = [];
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

          args.push([identifier, {} as any]);

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

      const funcToken = advance()!;

      if (!match('(')) throw Error('functions must be opend with ('); // TODO
      let openingBracketToken: Lexer.token = advance()!;

      let params: {
        args: [Lexer.token, typeExpression][];
        commas: Lexer.token[];
      } = parseFuncExprArgs();

      if (!match(')')) throw Error('functions must be closed with )'); // TODO
      let closingBracketToken: Lexer.token = advance()!;

      if (!match('->')) throw Error('functions must have a ->'); // TODO
      let arrowToken: Lexer.token = advance()!;

      const body: expression = parseExpression();

      return {
        type: 'func',
        funcToken,
        openingBracketToken,
        closingBracketToken,
        arrowToken,
        body,
        argCommaTokens: params.commas, // TODO
        arguments: params.args, // TODO
        hasExplicitType: false // TODO
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
// pub group test { let x = 5 + 2 * (func (x) -> x + 3 | 1 << 2 > 4).a.b() + nan + inf + 3e-3; }
// let _ = 1 + (2 - 3) * 4 / 5 ** 6 % 7;
// invalid to do: `a.(b).c` but (a.b).c is ok
// let _ = a(5+32,4)
const parsed = Parser.parse('let _ = (func (x) -> nan * x);', 'test');
console.timeEnd('t');

console.log(
  inspect(parsed, {
    depth: 999
  })
);
