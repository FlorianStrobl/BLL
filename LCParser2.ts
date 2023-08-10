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
    return {} as any;
  }

  // TODO comments could be ANYWHERE, just aswell as a bad eof
  // TODO test with real code, but insert a comment between each and every token!
  // TODO check everywhere isAtEnd()
  function parseStatement(): statement {
    function consumeComments(commentArr: Lexer.token[]): Lexer.token[] {
      while (matchType(Lexer.tokenType.comment)) commentArr.push(previous());
      return commentArr;
    }

    function parseUseBody(): useStatement {
      const useToken: Lexer.token = previous();
      const path: Lexer.token[] = [];
      const comments: Lexer.token[] = [];

      while (!match(';')) {
        if (matchType(Lexer.tokenType.comment)) comments.push(previous());
        else if (matchType(Lexer.tokenType.identifier)) path.push(previous());
        else if (match('.')) path.push(previous());
        else
          throw new Error(
            'TODO invalid use body statement while parsing code.'
          );
      }

      return {
        semicolonToken: previous(),
        useToken,
        path,
        comments
      };
    }

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

    if (match('group')) {
      const groupToken: Lexer.token = previous();

      consumeComments(comments);

      const identifierToken: Lexer.token | undefined = matchType(
        Lexer.tokenType.identifier
      );
      if (identifierToken === undefined)
        newParseError(
          'TODO cant have an undefined identifier for a group statement'
        );

      consumeComments(comments);

      const openingBracketToken: Lexer.token | undefined = match('{');
      if (openingBracketToken === undefined)
        newParseError(
          "TODO cant have a group statement without an opening brackt '{'"
        );

      consumeComments(comments);

      const body: statement[] = [];
      while (!isAtEnd() && !match('}')) body.push(parseStatement());
      // TODO isAtEnd()
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

      const identifierToken: Lexer.token | undefined = matchType(
        Lexer.tokenType.identifier
      );
      if (identifierToken === undefined)
        newParseError(
          'TODO cant have an undefined identifier for a let statement'
        );

      consumeComments(comments);

      const equalsToken: Lexer.token | undefined = match('=');
      if (equalsToken === undefined)
        newParseError("TODO cant have a let statement without a '=' symbol");

      consumeComments(comments);

      const body: expression = parseExpression();

      consumeComments(comments);

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
      'pub group test { /*0*/ pub /*1*/ let /*2*/ x /*3*/ = /*4*/ 5 /*5*/ ; /*6*/ } /*7*/',
      'test'
    ),
    {
      depth: 999
    }
  )
);
