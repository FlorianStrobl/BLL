import { Parser } from './LCParser';

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
  export function interpretAst(
    ast: Parser.statement[],
    argument: number
  ): number {
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
              statement.identifierToken.l
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
          l.statement.identifierToken.l) as string,
        expr: (l.statement.type === 'let' && l.statement.body) as any
      });
    }
    // TODO repeat for types aso

    const mainFuncIdx = val.lets.findIndex(
      (obj) =>
        obj.statement.type === 'let' &&
        obj.statement.identifierToken.l === 'main' &&
        obj.path.length === 0
    );
    if (mainFuncIdx === -1)
      throw new Error('TODO no `main(i32): i32` was found');
    const mainFunc = val.lets[mainFuncIdx].statement;

    // TODO evaluate main function with argument
    const result =
      mainFunc.type === 'let' &&
      evaluateExpression({
        type: 'call',
        function: mainFunc.body,
        openingBracketToken: {} as any,
        closingBracketToken: {} as any,
        arguments: [
          {
            argument: {
              type: 'literal',
              literalType: 'i32',
              literalToken: {
                l: argument.toString(),
                t: Parser.tokenType.literal,
                i: -1
              },
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
    function floatLiteralToFloat(literal: string): number {
      // NaN gets handled correctly
      return literal === 'inf' ? Infinity : Number(literal);
    }

    // TODO error if numeric literal is out of bounce
    function intLiteralToInt(literal: string): number {
      return Number(literal);
    }

    switch (expression.type) {
      case 'literal':
        return expression.literalType === 'i32'
          ? intLiteralToInt(expression.literalToken.l)
          : floatLiteralToFloat(expression.literalToken.l);
      case 'grouping':
        return evaluateExpression(expression.body, localIdentifiers);
      case 'identifier':
        const localValue = localIdentifiers.find(
          (id) => id[0] === expression.identifierToken.l
        );
        if (localValue !== undefined)
          // TODO
          return evaluateExpression(localValue[1], localIdentifiers);
        else
          return evaluateExpression(
            globalLetIdentifiers.find(
              (id) => id.identifier === expression.identifierToken.l
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
      case 'call':
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
                  l: '$',
                  t: Parser.tokenType.identifier,
                  i: -1
                },
                hasExplicitType: false,
                hasDefaultValue: false
              },
              delimiterToken: undefined
            },
            {
              argument: {
                identifierToken: {
                  l: '$$',
                  t: Parser.tokenType.identifier,
                  i: -1
                },
                hasExplicitType: false,
                hasDefaultValue: false
              },
              delimiterToken: undefined
            }
          ],
          body:
            rawValue === 0
              ? {
                  type: 'identifier',
                  identifier: '$',
                  identifierToken: {
                    l: '$',
                    t: Parser.tokenType.identifier,
                    i: -1
                  },
                  comments: []
                }
              : {
                  type: 'identifier',
                  identifier: '$$',
                  identifierToken: {
                    l: '$$',
                    t: Parser.tokenType.identifier,
                    i: -1
                  },
                  comments: []
                },
          funcToken: {} as any,
          openingBracketToken: {} as any,
          closingBracketToken: {} as any,
          arrowToken: {} as any,
          hasExplicitType: false
        };
        const func: Parser.funcExpression =
          typeof rawValue === 'number' ? numberFunction : rawValue;
        const callingArguments = expression.arguments; // TODO evaluate them first? (no lazy evaluation)
        const funcParameters = func.parameters;

        const givenArgumentCount: number = callingArguments.length;
        const defaultParameterAmountCount: number = funcParameters
          .map((e) => (e.argument.hasDefaultValue ? (1 as number) : 0))
          .reduce((a, b) => a + b);

        if (givenArgumentCount > funcParameters.length)
          throw new Error('TODO too many arguments when called');

        // TODO test if this works
        if (
          givenArgumentCount + defaultParameterAmountCount <
          funcParameters.length
        )
          throw new Error(
            `TODO called function ${func.body} with too few arguments:
            number of given arguments: ${givenArgumentCount}
            number of default parameters: ${defaultParameterAmountCount}
            expected number of parameters: ${funcParameters.length}`
          );

        // TODO swich up with scopes
        for (let i = 0; i < funcParameters.length; ++i) {
          const curParam = funcParameters[i].argument;
          localIdentifiers.push([
            curParam.identifierToken.l,
            i < callingArguments.length
              ? callingArguments[i].argument
              : curParam.hasDefaultValue
              ? curParam.defaultValue
              : (new Error('internal error') as never)
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
