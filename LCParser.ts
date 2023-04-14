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
