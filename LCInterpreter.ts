// giving the language a runtime

import { Parser } from "./LCParser";

export namespace Interpreter {
  export function interpret(code: string, filename: string) {}

  export function interpretAst(ast: any) {}

  function evaluateExpression(expression): any {
    if (expression.type === 'binary') {
      switch (expression.operator) {
        case '+':
          return (
            evaluateExpression(expression.leftSide) +
            evaluateExpression(expression.rightSide)
          );
        case '-':
          return (
            evaluateExpression(expression.leftSide) -
            evaluateExpression(expression.rightSide)
          );
        case '*':
          return (
            evaluateExpression(expression.leftSide) *
            evaluateExpression(expression.rightSide)
          );
        case '/':
          return (
            evaluateExpression(expression.leftSide) /
            evaluateExpression(expression.rightSide)
          );
        case '**':
          return (
            evaluateExpression(expression.leftSide) **
            evaluateExpression(expression.rightSide)
          );
        case '%':
          return (
            evaluateExpression(expression.leftSide) %
            evaluateExpression(expression.rightSide)
          );
      }
    } else if (expression.type === 'literal') return expression.literal;
  }
}
