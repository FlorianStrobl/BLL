// AST generation
// let ...

import { Lexer } from './LCLexer';

/*
  STATEMENT:
    "import" identifier;
    "pub" STATEMENT // not "pub import ..." tho
    "let" identifier = EXPRESSION;
    "let" identifier: TYPE = EXPRESSION;
    "type" identifier = TYPE_EXPRESSION;
    "namespace" identifier { STATEMENT }

  TYPE:
    "f32"
    "u32"
    "undetermined"
    TYPE -> TYPE

  TYPE_INFER:
    identifier : TYPE
    TYPE_INFER , TYPE_INFER

  EXPRESSION:
    ( EXPRESSION )
    UNARY_EXPRESSION
    BINARY_EXPRESSION
    NUMERIC_EXPRESSION
    "func" idenfitier(PARAM_LIST) -> EXPRESSION
    identifier(ARG_LIST)
    identifier[TYPE_INFER](ARG_LIST)
    identifier

  UNARY_EXPRESSION:
    - EXPRESSION
    + EXPRESSION

  BINARY_EXPRESSION:
    EXPRESSION + EXPRESSION
    EXPRESSION * EXPRESSION
    EXPRESSION ** EXPRESSION

  NUMERIC_EXPRESSION:
    "NaN"
    "Infinity"
    numeric_literal
*/

export namespace Parser {
  interface letStatement {}

  function consumeLetStatement(lexemes: Lexer.lexeme[], idx: number) {}

  export function parse(lexemes: Lexer.lexeme[], originalCode: string) {}
}
