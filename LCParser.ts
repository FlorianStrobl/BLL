// AST generation
// let ...

import { Lexer } from './LCLexer';
// @ts-ignore
import { inspect } from 'util';

// see: https://www.wikiwand.com/en/Extended_Backus-Naur_form

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
    "u32"
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
    "NaN"
    "Infinity"
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

export namespace Parser {
  // Recursive Descent Parsing
  interface letStatement {}

  let idx: number = 0;
  let _lexemes: Lexer.lexeme[] = [];
  let _code: string = '';
  const lexemeTypes = Lexer.lexemeType;

  // #region
  function isAtEnd(): boolean {
    return idx >= _lexemes.length;
  }

  function peek(): Lexer.lexeme | undefined {
    if (isAtEnd()) return undefined;
    return _lexemes[idx];
  }

  // function peek_next(): Lexer.lexeme | undefined {
  //   if (idx + 1 < _lexemes.length) return undefined;
  //   return _lexemes[idx + 1];
  // }

  function previous(): undefined | Lexer.lexeme {
    if (idx === 0) return undefined;
    return _lexemes[idx - 1];
  }

  function advance(): Lexer.lexeme | undefined {
    if (isAtEnd()) return undefined;
    return idx++, previous();
  }

  function check(value: string): boolean {
    if (isAtEnd()) return false;
    return peek()?.value === value; // peek() only undefined if isAtEnd() === false
  }

  function match(...tokens: string[]): Lexer.lexeme | undefined {
    for (const token of tokens) if (check(token)) return advance();
    return undefined;
  }
  // #endregion

  // #region expressions
  function parseExpression(): any {
    //if (match('func')) return parseFuncExpression();
    return parseExprLvl0();
  }

  function parseExprLvl0() {
    let left: any = parseExprLvl1();

    while (match('|')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl1()
      };
    }

    return left;
  }

  function parseExprLvl1() {
    let left: any = parseExprLvl2();

    while (match('^')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl2()
      };
    }

    return left;
  }

  function parseExprLvl2() {
    let left: any = parseExprLvl3();

    while (match('&')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl3()
      };
    }

    return left;
  }

  function parseExprLvl3() {
    let left: any = parseExprLvl4();

    while (match('==', '!=')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl4()
      };
    }

    return left;
  }

  function parseExprLvl4() {
    let left: any = parseExprLvl5();

    while (match('<', '>', '<=', '>=')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl5()
      };
    }

    return left;
  }

  function parseExprLvl5() {
    let left: any = parseExprLvl6();

    while (match('<<', '>>')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl6()
      };
    }

    return left;
  }

  function parseExprLvl6() {
    let left: any = parseExprLvl7();

    while (match('+', '-')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl7()
      };
    }

    return left;
  }

  function parseExprLvl7() {
    let left: any = parseExprLvl8();

    while (match('*', '/', '%')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl8()
      };
    }

    return left;
  }

  function parseExprLvl8(): any {
    let left: any = parseExprLvl9();

    // right to left precedence:
    // if because precedence order
    if (match('**', '***')) {
      left = {
        type: previous(),
        left,
        right: parseExprLvl8() // same level because precedence order
      };
    }

    return left;
  }

  function parseExprLvl9(): any {
    // unary:
    if (match('-', '+', '~')) {
      return {
        type: { type: 'unary', value: previous() },
        body: parseExprLvl9()
      };
    }

    return primary();
  }

  // TODO, parse literals, highest precedence level
  function primary() {
    if (match('(')) {
      // TODO
      const expression: any = {
        type: '()',
        value: parseExpression(),
        endBracket: undefined
      };
      if (!match(')')) throw Error('Expression wasnt closed'); // TODO
      return expression;
    } else if (peek()!.type === lexemeTypes.literal) return { type: advance() };
    else if (peek()!.type === lexemeTypes.identifier) {
      // TODO, x, x(), x.y, x.y() but not x.y().z
      let identifier = advance()!;
      const path: any = [];
      let dot;
      if ((dot = match('.'))) {
        path.push(identifier);
        path.push(dot);
        // TODO
        while (peek()?.type === lexemeTypes.identifier) {
          path.push(advance());
          // TODO TODO TODO HERE, "id1 id2" does work rn
          if (dot = match("."))path.push(dot);
          //else throw Error(""); // TODO wrong
        }
      }
      if (path.length === 0) return { type: identifier };
      else return { type: 'identifier path', path };
    } else if (match('func'))
      return { type: previous(), value: parseFuncExpression() };
    else throw Error('could not match anything in parsing expressions!'); // TODO
  }

  function parseFuncExpression() {
    let openingBracket;
    if (!(openingBracket = match('(')))
      throw Error('functions must be opend with ('); // TODO

    let params = parseFuncExprArgs();

    let closingBracket;
    if (!(closingBracket = match(')')))
      throw Error('functions must be closed with )'); // TODO

    let arrow;
    if (!(arrow = match('->'))) throw Error('functions must have a ->'); // TODO

    let body = parseExpression();
    return { openingBracket, closingBracket, params, arrow, body };
  }

  function parseFuncArgExprType() {}

  // TODO
  function parseFuncExprArgs(): any {
    const args: any = [];
    const commas: any = [];

    while (peek()?.value !== ')') {
      if (args.length > 0) {
        let lastComma = match(',');
        if (lastComma === undefined)
          throw Error('argument list must have commas in between'); // TODO
        commas.push(lastComma);

        // TODO: warning for trailing commas
        if (peek()?.value === ')') break; // had trailing comma
      }

      let identifier = advance();
      if (
        identifier === undefined ||
        identifier.type !== lexemeTypes.identifier
      )
        throw Error('must have identifier between two commas'); // TODO

      args.push(identifier);

      let doublePoint;
      if ((doublePoint = match(':'))) {
        let typeAnnotation = parseFuncArgExprType();
        args[args.length - 1].type = typeAnnotation;
        args[args.length - 1].doublePoint = doublePoint;
      }
    }

    return { args, commas };
  }
  // #endregion

  // #region statements
  function parseLetStatement(): any {
    // matched "let" lastly

    const identifier = advance()!;
    if (identifier.type !== lexemeTypes.identifier)
      throw Error('invalid token type in parse let statement'); // TODO

    let assigment;
    if (!(assigment = match('='))) throw Error("Expected '=' in let statement");

    const body = parseExpression();

    let semicolon;
    if (!(semicolon = match(';'))) throw Error("Expected ';' in let statement");

    return { identifier, body, assigment, semicolon };
  }

  function parseNamespaceStatement(): any {
    const identifier = advance();
    if (identifier?.type !== lexemeTypes.identifier)
      throw Error('namespaces must have a name'); // TODO

    let openingBracket;
    if (!(openingBracket = match('{')))
      throw Error('namespaces must be opend by a bracket'); // TODO

    const body: any = [];
    let closingBracket;
    while (!(closingBracket = match('}'))) body.push(parseStatement());

    return {
      identifier,
      body,
      openingBracket,
      closingBracket
    };
  }

  // TODO, gotPub
  function parsePubStatement(): any {
    if (match('let')) return { type: previous(), ...parseLetStatement() };
    else if (match('namespace'))
      return { type: previous(), ...parseNamespaceStatement() };
    else throw Error('Couldnt match any statement'); // TODO
  }

  function parseImportStatement(): any {
    function parseDots() {
      // assert, current character is a dot
      let dot = match('.');

      if (dot === undefined) throw Error('INTERNAL ERROR, assertion wasnt met');

      path.push(dot);
      if ((dot = match('.'))) path.push(dot);

      let slash;
      if (!(slash = match('/')))
        throw Error(
          'error in import statement, starting dots must be followed by a /'
        ); // tODO
      path.push(slash);
    }

    let path: any = [];

    if (peek()?.value === '.') parseDots();

    let semicolon;
    while (!(semicolon = match(';'))) {
      let identifier = advance();
      if (
        identifier !== undefined &&
        identifier.type === lexemeTypes.identifier
      ) {
        path.push(identifier);

        let slash;
        if ((slash = match('/'))) {
          path.push(slash);
          // its /./ or /../
          while (peek()?.value === '.') parseDots();
          //else: its folder/value
        }
      } else throw Error('import statement must have identifiers in it');
    }

    return { semicolon, path };
  }

  function parseStatement(): any {
    if (match(';')) return { type: previous() }; // empty statement
    else if (match('pub'))
      return {
        type: previous(),
        value: parsePubStatement()
      };
    else if (match('import'))
      return { type: previous(), ...parseImportStatement() };
    else return parsePubStatement();
  }
  // #endregion

  export function parse(lexemes: Lexer.lexeme[], originalCode: string): any[] {
    _lexemes = lexemes.filter((l) => l.type !== lexemeTypes.comment);
    _code = originalCode;

    // TODO, ast must have comments in it, in order to print them with the formatter
    let program: any[] = [];
    while (!isAtEnd()) program.push(parseStatement());

    return program;
  }
}

const code = `
//let x = ((5 + 3) * y ** 3 * 3 + 3 * 2 + 7 *** 4 + 4 ** 4 *** 3 * 1);

/*
import SameFolderButDiffFile;
import ./SameFolderButDiffFile;
import ../HigherFolderFile;
import folder/file;
import folder2/../../pastFile;
*/
//let f = func (x,y,) -> x + y;
//let rightToLeft = a ** b ** c;
//let leftToRight = a + b + c;

//let f = func (x) -> 2 * x;

let f = func (x) -> func (y) -> x + y;
`;
const lexedCode = Lexer.lexe(code, 'code');
console.log(inspect(Parser.parse(lexedCode, code), { depth: 9999 }));

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
//   else
//     return { token: _lexemes[idx], matches: _lexemes[idx].value === token };
// }
