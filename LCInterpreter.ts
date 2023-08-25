// giving the language a runtime

/*
TODO: add full type support, to check if the stuff is even valid!!
TODO: create a tree structure with all the namespaces/groups; then create a function which can return all accessable `let` and `type` identifiers from any point of that tree strucutre
*/

// @ts-ignore
import { inspect } from 'util';
const log = (args: any) => console.log(inspect(args, { depth: 999 }));

import { Parser } from './LCParser';

export namespace Interpreter {
  const globalIdentifiers: [string, Parser.expression][] = [];

  // TODO identifiers can only be named once in the entire script. e.g. doing twice let x; is invalid
  // even if that happens in different namespaces
  export function interpret(
    code: string,
    filename: string,
    argument: number
  ): number {
    const ast = Parser.parse(code);
    // TODO: actually check if ast is valid with types (e.g. let x: i32 = 5.3; or calling function with wrong arg types) and non duplicate identifiers (not even in differnt groups)
    if (ast === undefined) throw new Error('TODO');
    return interpretAst(ast.statements, argument);
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
      lets: [Parser.statement, string[]][];
      types: [Parser.statement, string[]][];
    } {
      const lets: [Parser.statement, string[]][] = [];
      const types: [Parser.statement, string[]][] = [];

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
            lets.push([statement, [...namespacePath]]);
            break;
          case 'type-allias':
            types.push([statement, [...namespacePath]]);
            break;
          case 'complex-type':
            types.push([statement, [...namespacePath]]);
            break;
          case 'import':
            // TODO: check the identifiers locally, then replace all "_" with " " and search again, and lastly check if it is in a global scope like "%appdata%/bll/std/" or something like that
            // then parse that file and repeat for imports, until all files are found and their full bodys are now merged into one file.
            // but save which identifier was from which file, to do better errors
            break;
          case 'comment':
          case 'empty':
          default:
            break;
        }
      }

      return { lets, types };
    }

    const val = extractValues(ast);
    // TODO, what about groups
    for (const l of val.lets) {
      globalIdentifiers.push([
        (l[0].type === 'let' && l[0].identifierToken.lexeme) as string,
        (l[0].type === 'let' && l[0].body) as any
      ]);
    }
    // TODO repeat for types aso

    const mainFuncIdx = val.lets.findIndex(
      ([statement, path]) =>
        statement.type === 'let' &&
        statement.identifierToken.lexeme === 'main' &&
        path.length === 0
    );
    if (mainFuncIdx === -1)
      throw new Error('TODO no `main(i32): i32` was found');
    const mainFunc = val.lets[mainFuncIdx][0];

    // TODO evaluate main function with argument
    const result =
      mainFunc.type === 'let' &&
      evaluateExpression({
        type: 'functionCall',
        function: mainFunc.body,
        openingBracketToken: {} as any,
        closingBracketToken: {} as any,
        arguments: [
          [
            {
              type: 'literal',
              literalType: 'i32',
              literal: argument,
              literalToken: {} as any
            },
            undefined
          ]
        ]
      });

    return result as any;
  }

  // TODO or a match expr/type can be returnt
  // number of function ptr
  function evaluateExpression(
    expression: Parser.expression,
    localIdentifiers: [string, Parser.expression][] = []
  ): number | Parser.funcExpression {
    switch (expression.type) {
      case 'literal':
        return expression.literal;
      case 'grouping':
        return evaluateExpression(expression.body, localIdentifiers);
      case 'identifier':
        const localValue = localIdentifiers.find(
          (id) => id[0] === expression.identifierToken.lexeme
        );
        if (localValue !== undefined) {
          // TODO
          return evaluateExpression(localValue[1], localIdentifiers);
        }
        return evaluateExpression(
          globalIdentifiers.find(
            (id) => id[0] === expression.identifierToken.lexeme
          )![1],
          localIdentifiers
        );
      case 'unary':
        const expVal = evaluateExpression(expression.body, localIdentifiers);
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
        const leftSide: any = evaluateExpression(
          expression.leftSide,
          localIdentifiers
        );
        const rightSide: any = evaluateExpression(
          expression.rightSide,
          localIdentifiers
        );
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
          expression.function,
          localIdentifiers
        ) as any;
        const callingArguments = expression.arguments; // TODO evaluate them first?
        const funcParameters = func.parameters;
        if (callingArguments.length !== funcParameters.length)
          throw new Error(
            'TODO called function without right amount of arguments'
          );

        for (let i = 0; i < funcParameters.length; ++i) {
          localIdentifiers.push([
            funcParameters[i][0].lexeme,
            callingArguments[i][0]
          ]);
        }

        // then call the thing body
        const ans = evaluateExpression(func.body, localIdentifiers);

        for (let i = 0; i < funcParameters.length; ++i) localIdentifiers.pop();

        // TODO
        return ans;
      case 'propertyAccess':
      case 'match':
      default:
        return 'TODO' as any;
    }
  }
}

function debug() {
  const code = `
let y = 4635 + 1;
let x = func (a, b,) -> b + y / 2 + a*2;

// doing main(12)
let main = func (arg) -> x(arg, 3 + arg,) + 1;
  `;
    log(Interpreter.interpret(code, '', 12))
  ;
}

// debug();


  log(
    Interpreter.interpret(
      `
/*
type OptionalInt[T] {
  Some(T),
  None
}

let a: OptionalInt[i32] = OptionalInt.Some(5);

let b = func (opt: OptionalInt[i32]): i32 ->
  match (opt) {
    case OptionalInt.Some(var) -> var,
    case OptionalInt.None -> 0
  };

let c = b(a);

let fac = func (n) -> match (n) {
  case 0 -> 1,
  default -> n * fac(n - 1)
};
*/

let identity = (func (x) -> x) (3);

let f = func (x) -> 2 + 3 * x;
let g: i32 = 5;
let h: () => i32 = func () -> 3;

let main = func (arg: i32): i32 -> identity + main2(arg);
let main2 = func (arg: i32): i32 -> (g + h()) + f(5);
`,
      '',
      2
    )

);
