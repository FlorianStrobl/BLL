// ASM generation from the AST, can be in an ascii format or in a binary object file

import { Parser } from './LCParser';

export namespace Compiler {
  function todoCompileSimpleExpression(exp: Parser.expressionT): string {
    switch (exp.type) {
      case 'unary':
        switch (exp.operator) {
          case '+':
            return todoCompileSimpleExpression(exp.body);
          case '-':
            let bodyNegative = todoCompileSimpleExpression(exp.body);
            // TODO: insert mul -1, lastVal
            return bodyNegative;
          case '~':
            let bodyNot = todoCompileSimpleExpression(exp.body);
            // TODO: insert not lastVal
            return bodyNot;
        }
      case 'binary':
        switch (exp.operator) {
          case '|':
            break;
          case '^':
            break;
          case '&':
            break;
          case '==':
            break;
          case '!=':
            break;
          case '<':
            break;
          case '>':
            break;
          case '<=':
            break;
          case '>=':
            break;
          case '<<':
            break;
          case '>>':
            break;
          case '+':
            break;
          case '-':
            break;
          case '*':
            break;
          case '/':
            break;
          case '%':
            break;
          case '**':
            break;
          case '***':
            break;
        }
        break;
      case 'grouping':
        return todoCompileSimpleExpression(exp.value);
      case 'literal':
        const literalValue = Number(exp.literal.value);
        return literalValue.toString();
      case 'identifier':
        return '%' + exp.identifier.value;
      case 'identifier-path':
        return 'NOT DONE YET';
      case 'functionCall':
        return 'NOT DONE YET';
      case 'func':
        return 'NOT DONE YET';
    }
    return '';
  }

  function todoCompileSimpleFunction(func: any): string {
    let funcReturnType = func.returnType;

    let funcIdentifier = func.identifier;

    let funcParameters = '';
    for (const [key, param] of Object.entries(
      func.params.args as { type: string; value: string }[]
    ))
      if (Number(key) === func.params.args.length - 1)
        funcParameters += `${param.type} %${param.value}`;
      else funcParameters += `${param.type} %${param.value},`;
    funcParameters.slice(0, -1);

    let funcBody = todoCompileSimpleExpression(func.body);

    return `define ${funcReturnType} @${funcIdentifier}(${funcParameters}) {
  ${funcBody}
}`;
  }

  // compiles down to llvm ir
  export function compile(ast: any, code: string, fileName: string): string {
    return todoCompileSimpleFunction(ast);
  }
}
