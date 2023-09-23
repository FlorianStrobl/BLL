// giving the language a runtime

/*
TODO: add full type support, to check if the stuff is even valid!!
TODO: create a tree structure with all the namespaces/groups; then create a function which can return all accessable `let` and `type` identifiers from any point of that tree strucutre
TODO: add caching for funcs with only i32/float args or for vars which are of primitive type and not a function type in order to not evaluate them twice
*/

// let main = func (arg: f32): f32 => arg; // also allowed!
// program correct closures!

// @ts-ignore
import { inspect } from 'util';
const log = (args: any) => console.log(inspect(args, { depth: 999 }));

import { Parser } from './LCParser';
import { Lexer } from './LCLexer';

export namespace Interpreter {
  const globalLetIdentifiers: {
    identifier: string;
    expr: Parser.expression;
  }[] = [];

  // TODO identifiers can only be named once in the entire script. e.g. doing twice let x; is invalid
  // even if that happens in different namespaces
  export function interpret(
    code: string,
    filename: string, // TODO for errors
    argument: number
  ): number {
    const ast = Parser.parse(code);
    // TODO: actually check if ast is valid with types (e.g. let x: i32 = 5.3; or calling function with wrong arg types) and non duplicate identifiers (not even in differnt groups)
    if (ast === undefined)
      throw new Error('TODO could not parse the code for interpreting');
    return interpretAst(ast.statements, argument);
  }

  // assertion: ast is type safe and identifiers can resolve without errors
  // TODO type checking and infering everything needed
  function interpretAst(ast: Parser.statement[], argument: number): number {
    function extractValues(
      statements: Parser.statement[],
      namespacePath: string[] = []
    ): {
      lets: { statement: Parser.statement; path: string[] }[];
      types: { type: Parser.statement; path: string[] }[];
    } {
      const lets: { statement: Parser.statement; path: string[] }[] = [];
      const types: { type: Parser.statement; path: string[] }[] = [];

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
            lets.push({ statement, path: [...namespacePath] });
            break;
          case 'type-alias':
            types.push({ type: statement, path: [...namespacePath] });
            break;
          case 'complex-type':
            types.push({ type: statement, path: [...namespacePath] });
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
      globalLetIdentifiers.push({
        identifier: (l.statement.type === 'let' &&
          l.statement.identifierToken.lexeme) as string,
        expr: (l.statement.type === 'let' && l.statement.body) as any
      });
    }
    // TODO repeat for types aso

    const mainFuncIdx = val.lets.findIndex(
      (obj) =>
        obj.statement.type === 'let' &&
        obj.statement.identifierToken.lexeme === 'main' &&
        obj.path.length === 0
    );
    if (mainFuncIdx === -1)
      throw new Error('TODO no `main(i32): i32` was found');
    const mainFunc = val.lets[mainFuncIdx].statement;

    // TODO evaluate main function with argument
    const result =
      mainFunc.type === 'let' &&
      evaluateExpression({
        type: 'functionCall',
        function: mainFunc.body,
        openingBracketToken: {} as any,
        closingBracketToken: {} as any,
        arguments: [
          {
            argument: {
              type: 'literal',
              literalType: 'i32',
              literalValue: argument,
              literalToken: {} as any,
              comments: []
            },
            delimiterToken: undefined
          }
        ],
        comments: []
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
        return expression.literalValue;
      case 'grouping':
        return evaluateExpression(expression.body, localIdentifiers);
      case 'identifier':
        const localValue = localIdentifiers.find(
          (id) => id[0] === expression.identifierToken.lexeme
        );
        if (localValue !== undefined)
          // TODO
          return evaluateExpression(localValue[1], localIdentifiers);
        else
          return evaluateExpression(
            globalLetIdentifiers.find(
              (id) => id.identifier === expression.identifierToken.lexeme
            )!.expr, // TODO invalid `!`
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
        // TODO
        const rawValue = evaluateExpression(
          expression.function,
          localIdentifiers
        );
        const numberFunction: Parser.funcExpression = {
          type: 'func',
          parameters: [
            {
              argument: {
                identifierToken: {
                  lexeme: '$',
                  type: Lexer.tokenType.identifier,
                  idx: -1
                },
                typeAnnotation: { hasTypeAnnotation: false }
              },
              delimiterToken: undefined
            },
            {
              argument: {
                identifierToken: {
                  lexeme: '$$',
                  type: Lexer.tokenType.identifier,
                  idx: -1
                },
                typeAnnotation: { hasTypeAnnotation: false }
              },
              delimiterToken: undefined
            }
          ],
          body:
            rawValue === 0
              ? {
                  type: 'identifier',
                  identifierToken: {
                    lexeme: '$',
                    type: Lexer.tokenType.identifier,
                    idx: -1
                  },
                  comments: []
                }
              : {
                  type: 'identifier',
                  identifierToken: {
                    lexeme: '$$',
                    type: Lexer.tokenType.identifier,
                    idx: -1
                  },
                  comments: []
                },
          funcToken: {} as any,
          openingBracketToken: {} as any,
          closingBracketToken: {} as any,
          arrowToken: {} as any,
          returnType: { explicitType: false }
        };
        const func: Parser.funcExpression =
          typeof rawValue === 'number' ? numberFunction : rawValue;
        const callingArguments = expression.arguments; // TODO evaluate them first?
        const funcParameters = func.parameters;
        if (callingArguments.length !== funcParameters.length)
          throw new Error(
            'TODO called function without right amount of arguments'
          );

        for (let i = 0; i < funcParameters.length; ++i) {
          localIdentifiers.push([
            funcParameters[i].argument.identifierToken.lexeme,
            callingArguments[i].argument
          ]);
        }

        // TODO local identifiers are wrong this way!! calling a function, will not give all the localIdentifiers to the callee, but only some... (or even none actually??)

        // then call the thing body
        const ans = evaluateExpression(func.body, localIdentifiers);

        // TODO wrong thing??
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

// TODO:
// mustInterpret: []
// mustNotInterpretButParse: []

function debug() {
  const code = `
let y = 4635 + 1;
let x = func (a, b,) => b + y / 2 + a*2;

// doing main(12)
let main = func (arg) => x(arg, 3 + arg,) + 1;
  `;
  log(Interpreter.interpret(code, '', 12));
}

console.clear();
log(
  Interpreter.interpret(
    `
let x = 5;
let main = func (arg) => x * 2 + arg;
`,
    '',
    3
  )
);

// debug();

// log(
//   Interpreter.interpret(
//     `
// // TODO this "x" is not the one from the "main" func
// //let test = (func (x, y) => x + y + 1)(5, 3); // 9
// //let main = func (x) => x(1, test);
// // let main = func (x) => (5 != 4 & 3 != 2)(1 /* returned when true */, 2 /* returned when false */);

// let fac = func (n) => n(1, fac(n-1)*n);
// let main = func (arg) => fac(arg);
// `,
//     '',
//     2
//   )
// );
//console.clear();
log(
  Interpreter.interpret(
    `
/*
type OptionalInt[T] {
  Some(T),
  None
}

let a: OptionalInt[i32] = OptionalInt.Some(5);

let b = func (opt: OptionalInt[i32]): i32 =>
  match (opt) {
    case OptionalInt.Some(var) => var,
    case OptionalInt.None => 0
  };

let c = b(a);

let fac = func (n) => match (n) {
  case 0 => 1,
  default => n * fac(n - 1)
};
*/


let const4: i32 = 4;
let f = func (x) => 2 + 3 * x;
let constFunc5: () -> i32 = func () => 5;
let const1 = (func (x) => x) (1);

let main = func (arg: i32): i32 => 1 + (51 != const1 + g(arg));

let g = func (arg: i32): i32 => (const4 + constFunc5()) + f(arg + 6);

let a = func (x) => func (y) => x + y;
let b = a(5);
let c = b(3); // 8
`,
    '',
    7
  )
);

/*
let identity = (func (x) => x) (1);

let f = func (x) => 2 + 3 * x;
let g: i32 = 4;
let h: () -> i32 = func () => 5;

let main = func (arg: i32): i32 => 51 == identity + main2(arg);
let main2 = func (arg: i32): i32 => (g + h()) + f(arg + 6);
*/
