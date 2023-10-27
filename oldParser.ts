import { Lexer } from './LCLexer';
// for debugging only
// @ts-ignore
import { inspect } from 'util';

// TODO, make a larser: if found one error, stop parsing immediatly and finish the lexing, then print the errors

// type = and type {} for special purpose enums/union

/**
 * type test {
  t1,
  t2(a.x)
}

type a {
  x(i32, f32, i32)
}

type optional[t] {
  None,
  Some(t)
}

let f = func (x: test): optional[a] ->
  match(x): optional[a] {
    test.t1 -> optional.Nonel;
    test.t2(aa, bb, cc) -> optional.Some(a.x(aa, bb, cc));
  };

  // func[t] (x: t) -> t;
 */

// Recursive Descent Parsing
export namespace Parser {
  // #region types
  type token = Lexer.token;

  // TODO, need all idxs
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

  let idx: number = 0; // larser
  let _lexemes: Lexer.token[] = []; // TODO, real time adding of lexems (larser)
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
      return peek()?.lex === value; // peek() only undefined if isAtEnd() === false
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
        operator: previous().lex as '==',
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
        operator: previous().lex as '<',
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
        operator: previous().lex as '<<',
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
        operator: previous().lex as '+',
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
        operator: previous().lex as '*',
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
        operator: previous().lex as '**',
        operatorLex: previous(),
        left,
        right: parseExprLvl8() // same level because precedence order
      };
    }

    return left;
  }

  function parseExprLvl9(): expressionT {
    // unary:
    // TODO, "!"
    if (match('!', '-', '+', '~')) {
      return {
        type: 'unary',
        operator: previous().lex as '-',
        operatorLex: previous(),
        body: parseExprLvl9()
      };
    }

    return parseExprLvl10();
  }

  // TODO just to debug
  function parseExprLvl10() {
    let left: any = primary();
    while (match('(', '.')) {
      if (previous().lex === '.') {
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

  // TODO, parse literals, highest precedence level
  function primary(): expressionT {
    if (match('(')) {
      // TODO
      const expression: expressionT = {
        type: 'grouping',
        openingBracket: previous(),
        value: parseExpression(),
        endBracket: undefined as unknown as token
      };
      if (!match(')')) throw Error('Expression wasnt closed'); // TODO
      expression.endBracket = previous();
      return expression;
    } else if (peek()!.ty === tokenTypes.literal) {
      return { type: 'literal', literal: advance()! };
    } else if (peek()!.ty === tokenTypes.identifier) {
      // TODO do not do () because of (x.y).z
      // TODO, x, x(), x.y, x.y() but not x.y().z
      let identifier = advance()!;

      return { type: 'identifier', identifier: identifier };

      if (peek()!.lex !== '.') {
        // let openBrace;
        // if ((openBrace = match('('))) {
        //   let callArguments = [parseExpression()]; // TODO TODO because there can be "," in between!
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
        if (peek()!.ty === tokenTypes.identifier) path.push(advance());
        else throw Error('`identifier . not an identifier` is not ok'); // TODO
      }

      let openBrace: Lexer.token | undefined;
      if ((openBrace = match('('))) {
        let parseBody = parseExpression(); // TODO TODO because there can be "," in between!
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
    // TODO
  }

  function parseFuncExpression(): funcExpressionT {
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

    const body: expressionT = parseExpression();

    return { openingBracket, closingBracket, params, arrow, body };
  }

  function parseFuncArgExprType(): expressionT {
    return undefined as any;
  }

  // TODO
  function parseFuncExprArgs(): { args: token[]; commas: token[] } {
    const args: token[] = [];
    const commas: token[] = [];

    while (peek()?.lex !== ')') {
      if (args.length > 0) {
        let lastComma = match(',');
        if (lastComma === undefined)
          throw Error('argument list must have commas in between'); // TODO
        commas.push(lastComma);

        // TODO: warning for trailing commas
        if (peek()?.lex === ')') break; // had trailing comma
      }

      let identifier: Lexer.token | undefined = advance();
      if (identifier === undefined || identifier.ty !== tokenTypes.identifier)
        throw Error('must have identifier between two commas'); // TODO

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
    if (identifier?.ty !== tokenTypes.identifier)
      throw Error('invalid token type in parse let statement'); // TODO

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
    if (identifier?.ty !== tokenTypes.identifier)
      throw Error('namespaces must have a name'); // TODO

    let openingBracket: Lexer.token | undefined;
    if (!(openingBracket = match('{')))
      throw Error('namespaces must be opend by a bracket'); // TODO

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

  // TODO, gotPub
  function parsePubStatement(): pubStatementT {
    if (match('let'))
      return { type: 'let', typeLex: previous(), ...parseLetStatement() };
    else if (match('namespace'))
      return {
        type: 'namespace',
        typeLex: previous(),
        ...parseNamespaceStatement()
      };
    else throw Error('Couldnt match any statement'); // TODO
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
        ); // TODO
      path.push(slash);
    }

    let path: token[] = [];

    if (peek()?.lex === '.') parseDots();

    let semicolon: Lexer.token | undefined;
    while (!(semicolon = match(';'))) {
      let identifier = advance();
      if (identifier !== undefined && identifier.ty === tokenTypes.identifier) {
        path.push(identifier);

        let slash: Lexer.token | undefined;
        if ((slash = match('/'))) {
          path.push(slash);
          // its /./ or /../
          while (peek()?.lex === '.') parseDots();
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
    _lexemes = lexemes.filter((l) => l.ty !== tokenTypes.comment);
    _code = code;
    _fileName = fileName;

    // TODO, ast must have comments in it, in order to print them with the formatter
    let program: statementT[] = [];
    while (!isAtEnd()) program.push(parseStatement());

    // TODO, on error return undefined

    return program;
  }
}

const c = 'let x = 5;';
console.log(Parser.parse(Lexer.lexe(c).tokens, 'test', 'test'));

// check gcc, clang, ghci, chromium v8, firefox, java, .NET w/ C#, go, rustc, py
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar
// AST generation
// let ...

// recursive descent instead of (LALR) Look-Ahead, Left-to-right, Rightmost Derivation parser

/*
TODO Larser aka lexing while parsing
if invalid lexeme comes, just break parsing and continue lexing to the end, to get all the errors of the lexer
*/

// see: https://www.wikiwand.com/en/Extended_Backus-Naur_form
// https://www.geeksforgeeks.org/types-of-parsers-in-compiler-design/

/*
  ?: 0 or 1
  *: 0 or more
  +: 1 or more
  in () is the order of evaluation for expressions: precedence and associativity

  STATEMENT:
    ;
    "import" IMPORT_PATH ;
    "pub" PUB_STATEMENTS
    PUB_STATEMENTS

  IMPORT_PATH:
    identifier (. identifier)?
    identifier / (.)+ / IMPORT_PATH

  PUB_STATEMENTS:
    "namespace" identifier { (STATEMENT)* }
    "let" identifier = EXPRESSION ;
    "let" identifier: TYPE = EXPRESSION ;
    "type" identifier = TYPE_EXPRESSION ;

  TYPE:
    ( TYPE )
    "f32"
    "i32"
    "undetermined"
    TYPE -> TYPE

  TYPE_EXPRESSION:
    TYPE

  TYPE_INFER:
    identifier : TYPE
    TYPE_INFER , TYPE_INFER

  EXPRESSION:
    ( EXPRESSION )                   (10, n/a)
    identifier                       (10, n/a)
    identifier.identifier??? TODO    (10, n/a)
    NUMERIC_EXPRESSION               (10, n/a)
    identifier(ARG_LIST)             (10, n/a)
    identifier[TYPE_INFER](ARG_LIST) (10, n/a)
    "func" identifier(PARAM_LIST) -> EXPRESSION
    "func" identifier[GENERIC_TYPE_LIST](PARAM_LIST) -> EXPRESSION
    UNARY_EXPRESSION
    BINARY_EXPRESSION

  ARG_LIST:

    EXPRESSION
    ARG_LIST, ARG_LIST

  PARAM_LIST:

    identifier
    identifier: TYPE
    PARAM_LIST, PARAM_LIST

  GENERIC_TYPE_LIST:
    identifier
    GENERIC_TYPE_LIST, GENERIC_TYPE_LIST

  UNARY_EXPRESSION:
    ~ EXPRESSION  (9, right to left TODO)
    - EXPRESSION  (9, right to left)
    + EXPRESSION  (9, right to left)

  BINARY_EXPRESSION:
    EXPRESSION *** EXPRESSION (8, right to left)
    EXPRESSION ** EXPRESSION (8, right to left)
    EXPRESSION * EXPRESSION (7, left to right)
    EXPRESSION / EXPRESSION (7, left to right)
    EXPRESSION % EXPRESSION (7, left to right)
    EXPRESSION + EXPRESSION (6, left to right)
    EXPRESSION - EXPRESSION (6, left to right)
    EXPRESSION << EXPRESSION (5, left to right)
    EXPRESSION >> EXPRESSION (5, left to right)
    EXPRESSION < EXPRESSION (4, left to right)
    EXPRESSION > EXPRESSION (4, left to right)
    EXPRESSION <= EXPRESSION (4, left to right)
    EXPRESSION >= EXPRESSION (4, left to right)
    EXPRESSION != EXPRESSION (3, left to right)
    EXPRESSION == EXPRESSION (3, left to right)
    EXPRESSION & EXPRESSION (2, left to right)
    EXPRESSION ^ EXPRESSION (1, left to right)
    EXPRESSION | EXPRESSION (0, left to right)

  NUMERIC_EXPRESSION:
    "nan"
    "infinity"
    numeric_literal
*/

/*
numeric_literal to binary_float/binary_int:

if numeric_literal is bin|hex|oct:
  // no decimal places nor e+5/e-2
  convert_literal_to_decimal_literal()

0. remove all the "_"
1. resolve "e" by shifting the string to the side by the amount specified (while paying attention to the potential ".")
2. int part before "." resolve
3. decimal part before "." resolve (maybe by starting as an int, and then dividing by 10**i)
4. add int part and decimal part while rounding

for_sure_float: true|false
*/

// const code = `
// //let x = ((5 + 3) * y ** 3 * 3 + 3 * 2 + 7 *** 4 + 4 ** 4 *** 3 * 1);
// /*
// import SameFolderButDiffFile;
// import ./SameFolderButDiffFile;
// import ../HigherFolderFile;
// import folder/file;
// import folder2/../../pastFile;
// */
// //let f = func (x,y,) -> x + y;
// //let rightToLeft = a ** b ** c;
// //let leftToRight = a + b + c;

// //let f = func (x) -> 2 * x;

// //let f = func (x) -> func (y) -> x + y;
// //let g = func (x) -> func (y) -> std.h(x + y);

// let a = func (x, y) -> x + y * x - (x / x);
// `;
// const lexedCode = Lexer.lexe(code, 'code');
// console.log(inspect(Parser.parse(lexedCode, code, 'src'), { depth: 9999 }));

// function consume(
//   token: string | Lexer.lexemeType
// ): { worked: true; token: Lexer.lexeme } | { worked: false } {
//   if (token in Lexer.lexemeType) {
//     if (_lexemes[idx].type === token)
//       return { worked: true, token: _lexemes[idx++] };
//   } else if (_lexemes[idx].value === token)
//     return { worked: true, token: _lexemes[idx++] };

//   return { worked: false };
// }

// function peek(): Lexer.lexeme;
// function peek(token: string): { token: Lexer.lexeme; matches: boolean };
// function peek(
//   token?: string
// ): Lexer.lexeme | { token: Lexer.lexeme; matches: boolean } {
//   if (token === undefined) return _lexemes[idx];
//   else return { token: _lexemes[idx], matches: _lexemes[idx].value === token };
// }
