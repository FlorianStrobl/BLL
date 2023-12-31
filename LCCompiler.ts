// ASM (LLVM IR) generation from the AST

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
            }%Z${varCounter.c++} = sub ${'i32'} 0, ${
              isLLVMIRRegisterOrLiteral(value) ? value : '%Z' + valueId
            }\n`;
          case '~':
            value = todoCompileSimpleExpression(exp.body, varCounter);
            valueId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(value) ? '' : value + '\n'
            }%Z${varCounter.c++} = xor ${'i32'} -1, ${
              isLLVMIRRegisterOrLiteral(value) ? value : '%Z' + valueId
            }\n`;
          case '!':
            value = todoCompileSimpleExpression(exp.body, varCounter);
            valueId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(value) ? '' : value + '\n'
            }%Z${varCounter.c++} = xor ${'i32'} 1, ${
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
            }${`%Z${varCounter.c++} = or i32 ${
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
            }${`%Z${varCounter.c++} = xor i32 ${
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
            }${`%Z${varCounter.c++} = and i32 ${
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
            }${`%Z${(tmp = varCounter.c++)} = icmp eq i32 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i32\n`;
          case '!=':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp ne i32 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i32\n`;
          case '<':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp slt i32 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i32\n`;
          case '>':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp sgt i32 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i32\n`;
          case '<=':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp sle i32 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i32\n`;
          case '>=':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${(tmp = varCounter.c++)} = icmp sge i32 ${
              isLLVMIRRegisterOrLiteral(leftSide)
                ? leftSide
                : '%Z' + leftSideVarId
            }, ${
              isLLVMIRRegisterOrLiteral(rightSide)
                ? rightSide
                : '%Z' + rightSideVarId
            }`}\n%Z${varCounter.c++} = zext i1 %Z${tmp} to i32\n`;
          case '<<':
            leftSide = todoCompileSimpleExpression(exp.leftSide, varCounter);
            leftSideVarId = varCounter.c - 1;
            rightSide = todoCompileSimpleExpression(exp.rightSide, varCounter);
            rightSideVarId = varCounter.c - 1;
            return `${
              isLLVMIRRegisterOrLiteral(leftSide) ? '' : leftSide + '\n'
            }${
              isLLVMIRRegisterOrLiteral(rightSide) ? '' : rightSide + '\n'
            }${`%Z${varCounter.c++} = shl i32 ${
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
            }${`%Z${varCounter.c++} = lshr i32 ${
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
            }${`%Z${varCounter.c++} = add i32 ${
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
            }${`%Z${varCounter.c++} = sub i32 ${
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
            }${`%Z${varCounter.c++} = mul i32 ${
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
            }${`%Z${varCounter.c++} = sdiv i32 ${
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
            }${`%Z${varCounter.c++} = srem i32 ${
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
            }${`%Z${varCounter.c++} = exp i32 ${
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
            }${`%Z${varCounter.c++} = root i32 ${
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
        function floatLiteralToFloat(literal: string): number {
          // NaN gets handled correctly
          return literal === 'inf' ? Infinity : Number(literal);
        }

        // TODO error if numeric literal is out of bounce
        function intLiteralToInt(literal: string): number {
          return Number(literal);
        }

        return exp.literalType === 'i32'
          ? intLiteralToInt(exp.literalToken.l).toString()
          : floatLiteralToFloat(exp.literalToken.l).toString();
      case 'identifier':
        return '%' + exp.identifierToken.l;
      case 'match':
        return 'NOT DONE YET';
      case 'propertyAccess':
        return 'NOT DONE YET';
      case 'call':
        let _str: string = '';
        const idxBefore: number = varCounter.c;
        // TODO even wrong, because of lazy evaluation... (do not exec all the expr beforhand)
        for (const arg of exp.arguments) {
          _str += `%Z${varCounter.c++} = i32 ${todoCompileSimpleExpression(
            arg.argument,
            varCounter
          )}\n`;
        }
        const difference: number = varCounter.c - idxBefore;

        let funcName: string = 'DEBUG';
        funcName =
          exp.function.type === 'identifier'
            ? exp.function.identifierToken.l
            : funcName;

        return `${_str} %Z${varCounter.c++} = call i32 @${funcName}(${new Array(
          difference
        )
          .fill(0)
          .map((_, i) => `i32 %Z${i}`)
          .join(', ')})`;
      case 'func':
        return 'NOT DONE YET';
    }

    return '';
  }

  function todoCompileSimpleFunction(func: Parser.statement): string {
    if (func.type !== 'let') return 'ERROR';
    if (func.body.type !== 'func') return 'ERROR';

    const funcReturnType = 'i32';

    const funcIdentifier = func.identifierToken.l;

    let funcParameters = '';
    for (const [key, param] of Object.entries(func.body.parameters))
      if (Number(key) === func.body.parameters.length - 1)
        funcParameters += `${'i32'} %${param.argument.identifierToken.l}`;
      else funcParameters += `${'i32'} %${param.argument.identifierToken.l}, `;

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
    let str = `target triple = "i386-pc-linux-gnu"
@.str = private constant [12 x i8] c"answer: %i\\0A\\00"\n`;

    for (let i = 0; i < ast.length; ++i)
      if (ast[i].type === 'let' && (ast[i] as any).body.type === 'func')
        str += todoCompileSimpleFunction(ast[i]) + '\n\n';

    return str + '\ndeclare i32 @printf(i8*, ...)';
  }
}
