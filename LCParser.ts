// AST generation
// let ...

import { Lexer } from './LCLexer';

/*
  ?: 0 or 1
  *: 0 or more
  +: 1 or more

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
    ( EXPRESSION )
    identifier
    identifier(ARG_LIST)
    identifier[TYPE_INFER](ARG_LIST)
    "func" identifier(PARAM_LIST) -> EXPRESSION
    "func" identifier[GENERIC_TYPE_LIST](PARAM_LIST) -> EXPRESSION
    UNARY_EXPRESSION
    BINARY_EXPRESSION
    NUMERIC_EXPRESSION

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
    ~ EXPRESSION
    - EXPRESSION
    + EXPRESSION

  BINARY_EXPRESSION:
    EXPRESSION *** EXPRESSION
    EXPRESSION ** EXPRESSION
    EXPRESSION * EXPRESSION
    EXPRESSION / EXPRESSION
    EXPRESSION % EXPRESSION
    EXPRESSION + EXPRESSION
    EXPRESSION - EXPRESSION
    EXPRESSION << EXPRESSION
    EXPRESSION >> EXPRESSION
    EXPRESSION < EXPRESSION
    EXPRESSION > EXPRESSION
    EXPRESSION <= EXPRESSION
    EXPRESSION >= EXPRESSION
    EXPRESSION != EXPRESSION
    EXPRESSION == EXPRESSION
    EXPRESSION & EXPRESSION
    EXPRESSION ^ EXPRESSION
    EXPRESSION | EXPRESSION

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
  interface letStatement {}

  let idx: number = 0;
  let _lexemes: Lexer.lexeme[] = [];
  let ast: {}[] = [];

  // #region
  function isAtEnd(): boolean {
    return idx >= _lexemes.length;
  }

  function peek(): Lexer.lexeme | undefined {
    if (isAtEnd()) return undefined;
    return _lexemes[idx];
  }

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

  function match(...tokens: string[]): boolean {
    for (const token of tokens) if (check(token)) return advance(), true;

    return false;
  }
  // #endregion

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

  function parseExpression(): any {
    if (match('func')) return parseFuncExpression();
    else return termExp();
  }

  // parse + and -
  function termExp() {
    // TODO
    let left: any = factor();

    while (match('+', '-')) {
      let operator = previous();
      left = {
        type: 'binary',
        operator,
        left,
        right: factor()
      };
    }

    return left;
  }

  // TODO, parse * and /
  function factor() {
    let left: any = primary(); // call next function

    while (match('*', '/')) {
      let operator = previous();
      left = {
        type: 'binary',
        operator,
        left,
        right: primary()
      };
    }

    return left;
  }

  // TODO, parse literals, highest precedence level
  function primary() {
    if (peek()!.type === Lexer.lexemeType.literal)
      return { type: 'literal', value: advance() };
    else if (peek()!.type === Lexer.lexemeType.identifier)
      return { type: 'identifier', value: advance() };
    else throw Error('could not match anything!'); // TODO
  }

  function parseFuncExpression() {}

  function parseLetStatement(): any {
    // matched "let" lastly

    const identifierToken = peek()!;
    if (identifierToken.type !== Lexer.lexemeType.identifier)
      throw Error('invalid token type in parse let statement'); // TODO

    const identifier = identifierToken.value;
    advance();

    if (!match('=')) throw Error("Expected '=' in let statement");

    const body = parseExpression();

    if (!match(';')) throw Error("Expected ';' in let statement");

    return { type: 'let statement', identifier, body };
  }

  function parseNamespaceStatement(): undefined {
    return undefined;
  }

  // TODO, gotPub
  function parsePubStatement(gotPub: boolean): any {
    if (match('let'))
      if (gotPub)
        return {
          type: 'public',
          value: parseLetStatement()
        };
      // TODO, stuff like that
      else return parseLetStatement();
    else if (match('namespace')) return parseNamespaceStatement();
    return undefined;
  }

  function parseEmptyStatement(): undefined {
    return undefined;
  }

  function parseImportStatement(): undefined {
    return undefined;
  }

  function parseStatement(): undefined {
    if (match(';')) return parseEmptyStatement();
    else if (match('pub')) return parsePubStatement(true);
    else if (match('import')) return parseImportStatement();
    else return parsePubStatement(false);
  }

  export function parse(lexemes: Lexer.lexeme[], originalCode: string) {
    _lexemes = lexemes;

    let program: any = [];
    while (!isAtEnd()) program.push(parseStatement());

    return program;
  }
}

const code = `
let x = 5 + 3 * 2;
let y = 2;
`;
console.log(Parser.parse(Lexer.lexe(code, 'code'), code));
