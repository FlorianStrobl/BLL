// ASM generation from the AST, can be in an ascii format or in a binary object file

import { Lexer } from './LCLexer';
import { Parser } from './LCParser';

export namespace Compiler {
  function todoCompileSimpleExpression(
    exp: Parser.expressionT,
    varCounter: { c: number } = { c: 0 }
  ): string {
    function isLLVMIRRegister(str: string): boolean {
      return str.match(/^%[0-9a-zA-Z_]+$/g) !== null;
    }

    switch (exp.type) {
      case 'unary':
        let str = '';
        switch (exp.operator) {
          case '+':
            return todoCompileSimpleExpression(exp.body, varCounter);
          case '-':
            str = todoCompileSimpleExpression(exp.body, varCounter);
            //str += `%${++varCounter.c} = mul ${'i32'} -1, %${varCounter.c - 1}`;
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
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = or i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '^':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = xor i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '&':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = and i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '==':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = icmp eq i1 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '!=':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = icmp neq i1 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '<':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = gr eq i1 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '>':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = icmp le i1 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '<=':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = icmp ge i1 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '>=':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = icmp leq i1 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '<<':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = leftShift i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '>>':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = rightShift i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '+':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = add i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '-':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = sub i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '*':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = mul i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '/':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = div i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '%':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = mod i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '**':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = exp i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
            }`}\n`;
          case '***':
            leftSide = todoCompileSimpleExpression(exp.left, varCounter);
            leftSideVarId = varCounter.c;
            rightSide = todoCompileSimpleExpression(exp.right, varCounter);
            rightSideVarId = varCounter.c;
            return `${isLLVMIRRegister(leftSide) ? '' : leftSide + '\n'}${
              isLLVMIRRegister(rightSide) ? '' : rightSide + '\n'
            }${`%${varCounter.c++} = root i32 ${
              isLLVMIRRegister(leftSide) ? leftSide : '%' + leftSideVarId
            }, ${
              isLLVMIRRegister(rightSide) ? rightSide : '%' + rightSideVarId
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

    const funcReturnType = 'i32';

    const funcIdentifier = func.identifier.value;

    let funcParameters = '';
    for (const [key, param] of Object.entries(func.body.params.args))
      if (Number(key) === func.body.params.args.length - 1)
        funcParameters += `${'i32'} %${param.value}`;
      else funcParameters += `${'i32'} %${param.value}, `;

    let idCounter = { c: 0 };
    const funcBody = todoCompileSimpleExpression(func.body.body, idCounter);

    return `define ${funcReturnType} @${funcIdentifier}(${funcParameters}) {
  ${funcBody}
  ret ${funcReturnType} %${idCounter.c - 1}
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
