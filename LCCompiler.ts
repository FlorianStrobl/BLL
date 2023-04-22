// ASM generation from the AST, can be in an ascii format or in a binary object file

// TODO, if intermediate results are stored in "%Z[id]", then pad all identifier with not "Z"

import { Lexer } from './LCLexer';
import { Parser } from './LCParser';

export namespace Compiler {
  function todoCompileSimpleExpression(
    exp: Parser.expressionT,
    varCounter: { c: number } = { c: 0 }
  ): string {
    function isLLVMIRRegisterOrLiteral(str: string): boolean {
      return str.match(/^%[0-9a-zA-Z_]+$/g) !== null || str.match(/^[0-9e+-_]+$/g) !== null;
    }

    switch (exp.type) {
      case 'unary':
        let str = '';
        switch (exp.operator) {
          case '+':
            return todoCompileSimpleExpression(exp.body, varCounter);
          case '-':
            str = todoCompileSimpleExpression(exp.body, varCounter);
            //str += `%${++varCounter.c} = mul ${'i8'} -1, %${varCounter.c - 1}`;
            // TODO: insert mul -1, lastVal
            return str;
          case '~':
            str = todoCompileSimpleExpression(exp.body, varCounter);
            str += '';
            // TODO: insert not lastVal
            return str;
        }
      case 'binary':
        let leftSide;
        let leftSideVarId;
        let rightSide;
        let rightSideVarId;
        switch (exp.operator) {
          case '|':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = or i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '^':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = xor i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '&':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = and i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '==':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = icmp eq i1 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '!=':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = icmp ne i1 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '<':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = gr slt i1 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '>':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = icmp sgt i1 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '<=':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = icmp sle i1 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '>=':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = icmp sge i1 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '<<':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = shl i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '>>':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = rightShift i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '+':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = add i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '-':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = sub i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '*':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = mul i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '/':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = sdiv i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '%':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = srem i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '**':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = exp i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
          case '***':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = root i8 ${
              isLLVMIRRegisterOrLiteral(leftSide) ? leftSide : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide) ? rightSide : '%Z' + rightSideVarId
            }`}\n`;
        }
      case 'grouping':
        return todoCompileSimpleExpression(exp.value, varCounter);
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
  }

  function todoCompileSimpleFunction(func: Parser.statementT): string {
    if (func.type !== 'let') return 'ERROR';
    if (func.body.type !== 'func') return 'ERROR';

    const funcReturnType = 'i8';

    const funcIdentifier = func.identifier.value;

    let funcParameters = '';
    for (const [key, param] of Object.entries(func.body.params.args))
      if (Number(key) === func.body.params.args.length - 1)
        funcParameters += `${'i8'} %${param.value}`;
      else funcParameters += `${'i8'} %${param.value}, `;

    let idCounter = { c: 0 };
    const funcBody = todoCompileSimpleExpression(func.body.body, idCounter);

    return `define ${funcReturnType} @${funcIdentifier}(${funcParameters}) {
  ${funcBody}
  ret ${funcReturnType} %Z${idCounter.c - 1}
}`;
  }

  // compiles down to llvm ir
  export function compile(
    ast: Parser.statementT[],
    code: string,
    fileName: string
  ): string {
    let str = '';

    for (let i = 0; i < ast.length; ++i)
      if (ast[i].type === 'let' && (ast[i] as any).body.type === 'func')
        str += todoCompileSimpleFunction(ast[i]) + '\n\n';

    return str;
  }
}
