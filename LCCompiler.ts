// ASM generation from the AST, can be in an ascii format or in a binary object file

import { Lexer } from './LCLexer';
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
        let leftSide;
        let rightSide;
        switch (exp.operator) {
          case '|':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( |, ${leftSide}, ${rightSide})`;
          case '^':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( ^, ${leftSide}, ${rightSide})`;
          case '&':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( &, ${leftSide}, ${rightSide})`;
          case '==':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( ==, ${leftSide}, ${rightSide})`;
          case '!=':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( !=, ${leftSide}, ${rightSide})`;
          case '<':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( <, ${leftSide}, ${rightSide})`;
          case '>':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( >, ${leftSide}, ${rightSide})`;
          case '<=':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( <=, ${leftSide}, ${rightSide})`;
          case '>=':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( >=, ${leftSide}, ${rightSide})`;
          case '<<':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( <<, ${leftSide}, ${rightSide})`;
          case '>>':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( >>, ${leftSide}, ${rightSide})`;
          case '+':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( +, ${leftSide}, ${rightSide})`;
          case '-':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( -, ${leftSide}, ${rightSide})`;
          case '*':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( *, ${leftSide}, ${rightSide})`;
          case '/':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( /, ${leftSide}, ${rightSide})`;
          case '%':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( %, ${leftSide}, ${rightSide})`;
          case '**':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( **, ${leftSide}, ${rightSide})`;
          case '***':
            leftSide = todoCompileSimpleExpression(exp.left);
            rightSide = todoCompileSimpleExpression(exp.right);
            return `( ***, ${leftSide}, ${rightSide})`;
        }
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

  function todoCompileSimpleFunction(func: Parser.statementT): string {
    if (func.type !== 'let') return 'ERROR';
    if (func.body.type !== 'func') return 'ERROR';

    const funcReturnType = 'i32';

    const funcIdentifier = func.identifier.value;

    let funcParameters = '';
    for (const [key, param] of Object.entries(func.body.params.args))
      if (Number(key) === func.body.params.args.length - 1)
        funcParameters += `${'i32'} %${param.value}`;
      else funcParameters += `${'i32'} %${param.value}, `;

    const funcBody = todoCompileSimpleExpression(func.body.body);

    return `define ${funcReturnType} @${funcIdentifier}(${funcParameters}) {
  ${funcBody}
}`;
  }

  // compiles down to llvm ir
  export function compile(
    ast: Parser.statementT[],
    code: string,
    fileName: string
  ): string {
    if (ast[0].type === 'let' && ast[0].body.type === 'func')
      return todoCompileSimpleFunction(ast[0]);

    return '';
  }
}
