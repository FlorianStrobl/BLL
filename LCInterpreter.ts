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

    return result as any;
  }

  // number of function ptr
  function evaluateExpression(
    expression: Parser.expression
  ): number | Parser.funcExpression {
    switch (expression.type) {
      case 'literal':
        return expression.literal;
      case 'grouping':
        return evaluateExpression(expression.body);
      case 'identifier':
        return '' as any;
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
            return 'error' as any;
        }
      case 'binary':
        const leftSide: any = evaluateExpression(expression.leftSide as any);
        const rightSide: any = evaluateExpression(expression.rightSide as any);
        switch (expression.operator) {
          case '+':
            return leftSide + rightSide;
          case '-':
            return leftSide - rightSide;
          case '*':
            return leftSide * rightSide;
          case '/':
            return leftSide / rightSide;
          case '**':
            return leftSide ** rightSide;
          case '***':
            return Math.log(leftSide) / Math.log(rightSide);
          case '%':
            return leftSide % rightSide;
          case '&':
            return leftSide & rightSide;
          case '|':
            return leftSide | rightSide;
          case '^':
            return leftSide ^ rightSide;
          case '<<':
            return leftSide << rightSide;
          case '>>':
            return leftSide >> rightSide;
          case '==':
            return Number(leftSide == rightSide);
          case '!=':
            return Number(leftSide != rightSide);
          case '<=':
            return Number(leftSide <= rightSide);
          case '>=':
            return Number(leftSide >= rightSide);
          case '<':
            return Number(leftSide < rightSide);
          case '>':
            return Number(leftSide > rightSide);
          default:
            // TODO
            return NaN;
        }
      case 'func':
        return expression;
      case 'functionCall':
        // take function, safe the arg names and position + replace them with the calles arg list and then interpret the code as usual
        const func: Parser.funcExpression = evaluateExpression(
          expression.function
        ) as any;
        const args = expression.arguments.map((exp) => evaluateExpression(exp));
        // TODO
        return 12;
      case 'propertyAccess':
      case 'match':
      default:
        return 'TODO' as any;
    }
  }
}

function debug() {
  const code = `
pub let x = func () -> 5;

let main = x();
  `;
  console.log(
    inspect(Interpreter.interpret(code, '', 5), {
      depth: 999
    })
  );
}

debug();
