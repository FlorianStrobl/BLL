// giving the language a runtime

import { Parser } from './LCParser';
// @ts-ignore
import { inspect } from 'util';

export namespace Interpreter {
  let identifiers: any[] = [];

  export function interpret(
    code: string,
    filename: string,
    argument: number
  ): number {
    const ast = Parser.parse(code, filename);
    // check if ast is valid
    if (ast === undefined) throw new Error('TODO');
    return interpretAst(ast, argument);
  }

  // TODO type checking and infering everything needed
  export function interpretAst(
    ast: Parser.statement[],
    argument: number
  ): number {
    function extractValues(
      statements: Parser.statement[],
      namespacePath: string[] = []
    ): {
      lets: [Parser.statement, string[], boolean][];
      types: [Parser.statement, string[], boolean][];
    } {
      const lets: [Parser.statement, string[], boolean][] = [];
      const types: [Parser.statement, string[], boolean][] = [];

      for (const statement of statements) {
        switch (statement.type) {
          case 'group':
            // TODO what if namespace itself is not public: would change the public value of the var to the outside world (which is already different for each and every thing lol)
            const vals = extractValues(statement.body, [
              ...namespacePath,
              statement.identifierToken.lexeme
            ]);
            lets.push(...vals.lets);
            types.push(...vals.types);
            break;
          case 'let':
            lets.push([statement, [...namespacePath], statement.isPub]);
            break;
          case 'type=':
            types.push([statement, [...namespacePath], statement.isPub]);
            break;
          case 'type{':
            types.push([statement, [...namespacePath], statement.isPub]);
            break;
          case 'import':
            break; // really needed??
          case 'comment':
          case 'empty':
          default:
            break;
        }
      }

      return { lets, types };
    }

    const val = extractValues(ast);
    const mainFuncIdx = val.lets.findIndex(
      ([statement, path, isPub]) =>
        statement.type === 'let' &&
        statement.identifierToken.lexeme === 'main' &&
        path.length === 0
    );
    const mainFunc = val.lets[mainFuncIdx][0];

    // TODO evaluate main function with argument
    const result = mainFunc.type === 'let' && evaluateExpression(mainFunc.body);

    return result;
  }

  // number of function ptr
  function evaluateExpression(expression: Parser.expression): number | any {
    switch (expression.type) {
      case 'literal':
        return expression.literal;
      case 'grouping':
        return evaluateExpression(expression.body);
      case 'identifier':
        return;
      case 'unary':
        const expVal = evaluateExpression(expression.body);
        switch (expression.operator) {
          case '+':
            return expVal;
          case '-':
            return -expVal;
          case '~':
            return ~expVal;
          case '!':
            return Number(!expVal);
          default:
            return 'error';
        }
      case 'binary':
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
      case 'functionCall':
      case 'func':
      case 'propertyAccess':
      case 'match':
      default:
        return;
    }
  }
}

function debug() {
  const code = `
let x = 5;
let main = 5 + 3 - 1;

group Test {
  group Hey {
    let g = 7;
  }
  pub let z = 3;
}
  `;
  console.log(
    inspect(Interpreter.interpret(code, '', 5), {
      depth: 999
    })
  );
}

debug();
