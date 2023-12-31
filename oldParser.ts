import { Lexer } from './LCLexer';

// old code: missing larser, index in code and comments

// Recursive Descent Parsing
export namespace Parser {
  // #region types
  type token = Lexer.token;

  type importBodyT = { path: token[]; semicolon: token };

  type funcExpressionT = {
    openingBracket: token;
    closingBracket: token;
    params: { args: token[]; commas: token[] };
    arrow: token;
    body: expressionT;
  };

  export type expressionT =
    | {
        type: 'unary';
        operator: '-' | '+' | '~' | '!';
        operatorLex: token;
        body: expressionT;
      }
    | {
        type: 'binary';
        operator:
          | '|'
          | '^'
          | '&'
          | '=='
          | '!='
          | '<'
          | '>'
          | '<='
          | '>='
          | '<<'
          | '>>'
          | '+'
          | '-'
          | '*'
          | '/'
          | '%'
          | '**'
          | '***';
        operatorLex: token;
        left: expressionT;
        right: expressionT;
      }
    | {
        type: 'grouping';
        openingBracket: token;
        value: expressionT;
        endBracket: token;
      }
    | { type: 'literal'; literal: token }
    | { type: 'identifier-path'; path: any }
    | { type: 'identifier'; identifier: token }
    | {
        type: 'functionCall';
        functionIdentifier: token;
        callArguments: any;
        openBrace: token;
        closingBrace: token;
      }
    | ({
        type: 'func';
        typeLex: token;
      } & funcExpressionT);

  type letStatementT = {
    identifier: token;
    body: expressionT;
    assigmentOperator: token;
    semicolon: token;
  };

  type namespaceStatementT = {
    identifier: token;
    body: statementT[];
    openingBracket: token;
    closingBracket: token;
  };

  type pubStatementT =
    | ({ type: 'let'; typeLex: token } & letStatementT)
    | ({ type: 'namespace'; typeLex: token } & namespaceStatementT);

  export type statementT =
    | {
        type: ';';
        typeLex: token;
      }
    | ({
        type: string;
        typeLex: token;
        public: boolean;
        publicLex?: token;
      } & pubStatementT)
    | ({ type: 'import'; typeLex: token } & importBodyT);
  // #endregion

  let idx: number = 0;
  let _lexemes: Lexer.token[] = [];
  let _code: string = '';
  let _fileName: string = '';
  const tokenTypes = Lexer.tokenType;

  // #region helper
  function isAtEnd(): boolean {
    return idx >= _lexemes.length;
  }

  function peek(): Lexer.token | undefined {
    if (isAtEnd()) return undefined;
    return _lexemes[idx];
  }

  // function peek_next(): Lexer.lexeme | undefined {
  //   if (idx + 1 < _lexemes.length) return undefined;
  //   return _lexemes[idx + 1];
  // }

  function previous(): Lexer.token {
    if (idx === 0) return undefined as unknown as Lexer.token;
    return _lexemes[idx - 1];
  }

  function advance(): Lexer.token | undefined {
    if (isAtEnd()) return undefined;
    return idx++, previous();
  }

  function match(...tokens: string[]): Lexer.token | undefined {
    function check(value: string): boolean {
      if (isAtEnd()) return false;
      return peek()?.l === value; // peek() only undefined if isAtEnd() === false
    }

    for (const token of tokens) if (check(token)) return advance();
    return undefined;
  }
  // #endregion

  // #region expressions
  function parseExpression(): expressionT {
    //if (match('func')) return parseFuncExpression();
    return parseExprLvl0();
  }

  function parseExprLvl0(): expressionT {
    let left: expressionT = parseExprLvl1();

    while (match('|')) {
      left = {
        type: 'binary',
        operator: '|',
        operatorLex: previous(),
        left,
        right: parseExprLvl1()
      };
    }

    return left;
  }

  function parseExprLvl1(): expressionT {
    let left: expressionT = parseExprLvl2();

    while (match('^')) {
      left = {
        type: 'binary',
        operator: '^',
        operatorLex: previous(),
        left,
        right: parseExprLvl2()
      };
    }

    return left;
  }

  function parseExprLvl2(): expressionT {
    let left: expressionT = parseExprLvl3();

    while (match('&')) {
      left = {
        type: 'binary',
        operator: '&',
        operatorLex: previous(),
        left,
        right: parseExprLvl3()
      };
    }

    return left;
  }

  function parseExprLvl3(): expressionT {
    let left: expressionT = parseExprLvl4();

    while (match('==', '!=')) {
      left = {
        type: 'binary',
        operator: previous().l as '==',
        operatorLex: previous(),
        left,
        right: parseExprLvl4()
      };
    }

    return left;
  }

  function parseExprLvl4(): expressionT {
    let left: expressionT = parseExprLvl5();

    while (match('<', '>', '<=', '>=')) {
      left = {
        type: 'binary',
        operator: previous().l as '<',
        operatorLex: previous(),
        left,
        right: parseExprLvl5()
      };
    }

    return left;
  }

  function parseExprLvl5(): expressionT {
    let left: expressionT = parseExprLvl6();

    while (match('<<', '>>')) {
      left = {
        type: 'binary',
        operator: previous().l as '<<',
        operatorLex: previous(),
        left,
        right: parseExprLvl6()
      };
    }

    return left;
  }

  function parseExprLvl6(): expressionT {
    let left: any = parseExprLvl7();

    while (match('+', '-')) {
      left = {
        type: 'binary',
        operator: previous().l as '+',
        operatorLex: previous(),
        left,
        right: parseExprLvl7()
      };
    }

    return left;
  }

  function parseExprLvl7(): expressionT {
    let left: expressionT = parseExprLvl8();

    while (match('*', '/', '%')) {
      left = {
        type: 'binary',
        operator: previous().l as '*',
        operatorLex: previous(),
        left,
        right: parseExprLvl8()
      };
    }

    return left;
  }

  function parseExprLvl8(): expressionT {
    let left: expressionT = parseExprLvl9();

    // right to left precedence:
    // if because precedence order
    if (match('**', '***')) {
      left = {
        type: 'binary',
        operator: previous().l as '**',
        operatorLex: previous(),
        left,
        right: parseExprLvl8() // same level because precedence order
      };
    }

    return left;
  }

  function parseExprLvl9(): expressionT {
    // unary:
    if (match('!', '-', '+', '~')) {
      return {
        type: 'unary',
        operator: previous().l as '-',
        operatorLex: previous(),
        body: parseExprLvl9()
      };
    }

    return parseExprLvl10();
  }

  function parseExprLvl10() {
    let left: any = primary();
    while (match('(', '.')) {
      if (previous().l === '.') {
        const property = advance();
        left = { type: 'PropertyAccess', target: left, property };
      } else {
        //   f(
        let args: any = [];
        while (!match(')')) {
          // parse until we find `)` (end of argument list)
          if (args.length > 0) match(',');
          args.push(parseExpression());
        }
        left = { type: 'FunctionCall', callee: left, args };
      }
    }
    return left;
  }

  // highest precedence level
  function primary(): expressionT {
    if (match('(')) {
      const expression: expressionT = {
        type: 'grouping',
        openingBracket: previous(),
        value: parseExpression(),
        endBracket: undefined as unknown as token
      };
      if (!match(')')) throw Error('Expression wasnt closed');
      expression.endBracket = previous();
      return expression;
    } else if (peek()!.t === tokenTypes.literal) {
      return { type: 'literal', literal: advance()! };
    } else if (peek()!.t === tokenTypes.identifier) {
      // TODO do not do () because of (x.y).z
      // TODO, x, x(), x.y, x.y() but not x.y().z
      let identifier = advance()!;

      return { type: 'identifier', identifier: identifier };

      if (peek()!.l !== '.') {
        // let openBrace;
        // if ((openBrace = match('('))) {
        //   let callArguments = [parseExpression()]; // TODO because there can be "," in between!
        //   let closingBrace = match(')');
        //   if (closingBrace === undefined) throw Error(''); // TODO
        //   return {
        //     type: 'functionCall',
        //     functionIdentifier: identifier,
        //     callArguments,
        //     openBrace,
        //     closingBrace
        //   };
        // }
        // TODO x()
      }

      // is id1.id2

      const path: any = [identifier];
      let dot: Lexer.token | undefined;
      while ((dot = match('.'))) {
        path.push(dot);
        if (peek()!.t === tokenTypes.identifier) path.push(advance());
        else throw Error('`identifier . not an identifier` is not ok');
      }

      let openBrace: Lexer.token | undefined;
      if ((openBrace = match('('))) {
        let parseBody = parseExpression(); // TODO because there can be "," in between!
        let closingBrace = match(')');
        return {
          type: 'identifier-path',
          path,
          // @ts-expect-error
          body: parseBody,
          openBrace,
          closingBrace
        }; // TODO wrong!
      }

      return { type: 'identifier-path', path };
    } else if (match('func')) {
      return {
        type: 'func',
        typeLex: previous(),
        ...parseFuncExpression()
      };
    } else throw new Error('could not match anything in parsing expressions!');
  }

  function parseFuncExpression(): funcExpressionT {
    let openingBracket: Lexer.token | undefined;
    if (!(openingBracket = match('(')))
      throw Error('functions must be opend with (');

    let params: {
      args: Lexer.token[];
      commas: Lexer.token[];
    } = parseFuncExprArgs();

    let closingBracket: Lexer.token | undefined;
    if (!(closingBracket = match(')')))
      throw Error('functions must be closed with )');

    let arrow: Lexer.token | undefined;
    if (!(arrow = match('->'))) throw Error('functions must have a ->');

    const body: expressionT = parseExpression();

    return { openingBracket, closingBracket, params, arrow, body };
  }

  // TODO
  function parseFuncArgExprType(): expressionT {
    return undefined as any;
  }

  // TODO
  function parseFuncExprArgs(): { args: token[]; commas: token[] } {
    const args: token[] = [];
    const commas: token[] = [];

    while (peek()?.l !== ')') {
      if (args.length > 0) {
        let lastComma = match(',');
        if (lastComma === undefined)
          throw Error('argument list must have commas in between');
        commas.push(lastComma);

        // TODO: warning for trailing commas
        if (peek()?.l === ')') break; // had trailing comma
      }

      let identifier: Lexer.token | undefined = advance();
      if (identifier === undefined || identifier.t !== tokenTypes.identifier)
        throw Error('must have identifier between two commas');

      args.push(identifier);

      let doublePoint: Lexer.token | undefined;
      if ((doublePoint = match(':'))) {
        let typeAnnotation = parseFuncArgExprType();
        // @ts-expect-error
        args[args.length - 1].type = typeAnnotation;
        // @ts-expect-error
        args[args.length - 1].doublePoint = doublePoint;
      }
    }
    return { args, commas };
  }
  // #endregion

  // #region statements
  function parseLetStatement(): letStatementT {
    // matched "let" lastly

    const identifier: Lexer.token | undefined = advance();
    if (identifier?.t !== tokenTypes.identifier)
      throw Error('invalid token type in parse let statement');

    let assigmentOperator: Lexer.token | undefined;
    if (!(assigmentOperator = match('=')))
      throw Error("Expected '=' in let statement");

    const body: expressionT = parseExpression();

    let semicolon: Lexer.token | undefined;
    if (!(semicolon = match(';'))) throw Error("Expected ';' in let statement");

    return { identifier, body, assigmentOperator, semicolon };
  }

  function parseNamespaceStatement(): namespaceStatementT {
    const identifier: Lexer.token | undefined = advance();
    if (identifier?.t !== tokenTypes.identifier)
      throw Error('namespaces must have a name');

    let openingBracket: Lexer.token | undefined;
    if (!(openingBracket = match('{')))
      throw Error('namespaces must be opend by a bracket');

    const body: statementT[] = [];
    let closingBracket: Lexer.token | undefined;
    while (!(closingBracket = match('}'))) body.push(parseStatement());

    return {
      identifier,
      body,
      openingBracket,
      closingBracket
    };
  }

  function parsePubStatement(): pubStatementT {
    if (match('let'))
      return { type: 'let', typeLex: previous(), ...parseLetStatement() };
    else if (match('namespace'))
      return {
        type: 'namespace',
        typeLex: previous(),
        ...parseNamespaceStatement()
      };
    else throw Error('Couldnt match any statement');
  }

  function parseImportStatement(): importBodyT {
    function parseDots() {
      // assert, current character is a dot
      let dot: Lexer.token | undefined = match('.');

      if (dot === undefined) throw Error('INTERNAL ERROR, assertion wasnt met');

      path.push(dot);
      if ((dot = match('.'))) path.push(dot);

      let slash: Lexer.token | undefined;
      if (!(slash = match('/')))
        throw Error(
          'error in import statement, starting dots must be followed by a /'
        );
      path.push(slash);
    }

    let path: token[] = [];

    if (peek()?.l === '.') parseDots();

    let semicolon: Lexer.token | undefined;
    while (!(semicolon = match(';'))) {
      let identifier = advance();
      if (identifier !== undefined && identifier.t === tokenTypes.identifier) {
        path.push(identifier);

        let slash: Lexer.token | undefined;
        if ((slash = match('/'))) {
          path.push(slash);
          // its /./ or /../
          while (peek()?.l === '.') parseDots();
          //else: its folder/value
        }
      } else throw Error('import statement must have identifiers in it');
    }

    return { semicolon, path };
  }

  function parseStatement(): statementT {
    if (match(';'))
      return { type: ';', typeLex: previous() }; // empty statement
    else if (match('pub'))
      return {
        public: true,
        publicLex: previous(),
        ...parsePubStatement()
      };
    else if (match('import'))
      return { type: 'import', typeLex: previous(), ...parseImportStatement() };
    else return { public: false, publicLex: undefined, ...parsePubStatement() };
  }
  // #endregion

  export function parse(
    lexemes: Lexer.token[],
    code: string,
    fileName: string
  ): statementT[] | undefined {
    _lexemes = lexemes.filter((l) => l.t !== tokenTypes.comment);
    _code = code;
    _fileName = fileName;

    let program: statementT[] = [];
    while (!isAtEnd()) program.push(parseStatement());

    return program;
  }
}
