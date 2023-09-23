// ASM (LLVM IR) generation from the AST, can be in an ascii format or in a binary object file

// TODO, if intermediate results are stored in "%Z[id]", then pad all identifier with not "Z"

import { Parser } from './LCParser';

export namespace Compiler {
  function todoCompileSimpleExpression(
    exp: Parser.expression,
    varCounter: { c: number } = { c: 0 }
  ): string {
    function isLLVMIRRegisterOrLiteral(str: string): boolean {
      return (
        str.match(/^%[0-9a-zA-Z_]+$/g) !== null ||
        str.match(/^[0-9e+-_]+$/g) !== null
      );
    }

    switch (exp.type) {
      case 'unary':
        let str = '';
        let value: string;
        let valueId: number;
        switch (exp.operator) {
          case '+':
            return todoCompileSimpleExpression(exp.body, varCounter);
          case '-':
            value = todoCompileSimpleExpression(exp.body, varCounter);
            valueId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(value) ? '' : value + '\n'
            }%Z${varCounter.c++} = sub ${'i64'} 0, ${
              isLLVMIRRegisterOrLiteral(value) ? value : '%Z' + valueId
            }\n`;
          case '~':
            value = todoCompileSimpleExpression(exp.body, varCounter);
            valueId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(value) ? '' : value + '\n'
            }%Z${varCounter.c++} = xor ${'i64'} -1, ${
              isLLVMIRRegisterOrLiteral(value) ? value : '%Z' + valueId
            }\n`;
          case '!':
            value = todoCompileSimpleExpression(exp.body, varCounter);
            valueId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(value) ? '' : value + '\n'
            }%Z${varCounter.c++} = xor ${'i64'} 1, ${
              isLLVMIRRegisterOrLiteral(value) ? value : '%Z' + valueId
            }\n`;
        }
        break;
      case 'binary':
        let leftSide: string;
        let leftSideVarId: number;
        let rightSide: string;
        let rightSideVarId: number;
        let tmp: number;
        switch (exp.operator) {
          case '|':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = or i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '^':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = xor i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '&':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = and i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '==':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp eq i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i64\n`;
          case '!=':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp ne i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i64\n`;
          case '<':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp slt i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i64\n`;
          case '>':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp sgt i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i64\n`;
          case '<=':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp sle i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i64\n`;
          case '>=':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp sge i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i64\n`;
          case '<<':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = shl i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '>>':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = lshr i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '+':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = add i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '-':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = sub i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '*':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = mul i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '/':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = sdiv i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '%':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = srem i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '**':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = exp i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
          case '***':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = root i64 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n`;
        }
        break;
      case 'grouping':
        return todoCompileSimpleExpression(exp.body, varCounter);
      case 'literal':
        return exp.literalValue.toString();
      case 'identifier':
        return '%' + exp.identifierToken.lexeme;
      case 'match':
        return 'NOT DONE YET';
      case 'propertyAccess':
        return 'NOT DONE YET';
      case 'functionCall':
        return 'NOT DONE YET';
      case 'func':
        return 'NOT DONE YET';
    }

    return '';
  }

  function todoCompileSimpleFunction(func: Parser.statement): string {
    if (func.type !== 'let') return 'ERROR';
    if (func.body.type !== 'func') return 'ERROR';

    const funcReturnType = 'i64';

    const funcIdentifier = func.identifierToken.lexeme;

    let funcParameters = '';
    for (const [key, param] of Object.entries(func.body.parameters))
      if (Number(key) === func.body.parameters.length - 1)
        funcParameters += `${'i64'} %${param.argument.identifierToken.lexeme}`;
      else
        funcParameters += `${'i64'} %${
          param.argument.identifierToken.lexeme
        }, `;

    let idCounter = { c: 0 };
    const funcBody = todoCompileSimpleExpression(func.body.body, idCounter);

    return `define ${funcReturnType} @${funcIdentifier}(${funcParameters}) {
  ${funcBody}
  ret ${funcReturnType} %Z${idCounter.c - 1}
}`;
  }

  // compiles down to llvm ir
  export function compile(
    ast: Parser.statement[],
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

const ans = Compiler.compile(
  Parser.parse('let x = func (a, b) => a + 4;').statements,
  '',
  ''
);
console.log(ans);
