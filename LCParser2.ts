import { Lexer } from './LCLexer';

export namespace Parser {
  // #region types
  type statement = {};
  type expression = {};
  // #endregion

  // #region helper
  // part which handles the lexer
  class Larser {
    code: string;
    filename: string;

    lexer: Generator<Lexer.nextToken>;

    currentToken: Lexer.token;
    eof: boolean = false;

    constructor(code: string, filename: string) {
      this.code = code;
      this.filename = filename;
      this.lexer = Lexer.lexeNextTokenIter(code);

      const lexerNext = this.lexer.next();
      if (lexerNext.done === false && lexerNext.value.valid)
        this.currentToken = lexerNext.value.value;
      else if (
        lexerNext.done === false &&
        !lexerNext.value.valid &&
        lexerNext.value.value.type === 'eof'
      ) {
        this.eof = true;
        this.currentToken = {} as any;
      } else this.errorHandling();
    }

    public isEof(): boolean {
      return this.eof;
    }

    public getCurrentToken(): Lexer.token {
      return this.currentToken;
    }

    public advanceToken(): void {
      if (!this.isEof()) {
        const lexerNext = this.lexer.next();
        if (lexerNext.done === false && lexerNext.value.valid)
          this.currentToken = lexerNext.value.value;
        else if (
          lexerNext.done === false &&
          !lexerNext.value.valid &&
          lexerNext.value.value.type === 'eof'
        )
          this.eof = true;
        else this.errorHandling();
      }
    }

    errorHandling(): never {
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

  function peek(): Lexer.token {
    return null as any;
  }

  function previous(): Lexer.token {
    return null as any;
  }

  function advance(): Lexer.token {
    return null as any;
  }

  function check(value: string): boolean {
    return false;
  }

  function match(...tokens: string[]): Lexer.token {
    return null as any;
  }
  // #endregion

  export function parse(code: string, filename: string): statement[] {
    larser = new Larser(code, filename);
    const statements: statement[] = [];

    while (!isAtEnd()) {
      console.log(larser.getCurrentToken());
      larser.advanceToken();
    }

    return statements;
  }
}

Parser.parse('let x: i32 = 5;', 'test');
