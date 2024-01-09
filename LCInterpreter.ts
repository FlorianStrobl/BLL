import { Parser } from './LCParser';
import { ProcessAST } from './LCIdentifierCheck';
import { Formatter } from './LCFormatter';
// import { Annotate } from './LCCodeAnnotation';

export namespace Interpreter {
  let quickFixDeepCpy: boolean = false;

  function deepCpy<T>(value: T): T {
    if (value === null) return value;

    switch (typeof value) {
      case 'object':
        if (Array.isArray(value)) return value.map((val) => deepCpy(val)) as T;

        const newObj: any = {};
        for (const [key, val] of Object.entries(value))
          newObj[key] = deepCpy(val);
        return newObj as T;
      case 'undefined':
      case 'symbol':
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
      case 'function':
      default:
        return value;
    }
  }

  type internalVal =
    | { type: 'int'; value: number }
    | { type: 'float'; value: number }
    | {
        type: 'expr';
        expr: Parser.expression;
        closure: { [localIdent: string]: internalVal };
      }
    | {
        type: 'complexType';
        tyName: string;
        discriminator: string;
        values: internalVal[];
      };

  // TODO: replace all the const exprs by their value
  export function interpret(
    files: string | { [filename: string]: string },
    mainFilename: string,
    input: number,
    settings: { timeIt?: boolean; scopeDeepCpyQuickFix?: boolean } = {
      timeIt: false,
      scopeDeepCpyQuickFix: false
    }
  ): number {
    quickFixDeepCpy = settings.scopeDeepCpyQuickFix ?? false;
    settings.timeIt = settings.timeIt ?? false;

    if (typeof files === 'string') files = { [mainFilename]: files };

    if (settings.timeIt) console.time('pre-execution time');

    if (!(mainFilename in files))
      throw new Error(
        `The main file ${mainFilename} does not exist in the current files: [${Object.keys(
          files
        ).join(', ')}]`
      );

    const processedAST = ProcessAST.processCode(
      files[mainFilename],
      mainFilename
    );

    if (processedAST.valid === false)
      throw new Error(
        `Invalid code in the main file named "${mainFilename}".\nErrors:\n${processedAST.processingErrors
          .map((err) => JSON.stringify(err))
          .join('\n')}`
      );

    // #region recursively import and preprocess files
    const importedFiles: string[] = [mainFilename];

    const toImportFiles: string[] = processedAST.value.imports.map(
      ([filename, _]) => filename
    );
    while (toImportFiles.length !== 0) {
      const toImportFile: string = toImportFiles.pop()!;

      // do not import files twice so skip it
      if (importedFiles.includes(toImportFile)) continue;
      importedFiles.push(toImportFile);

      if (!(toImportFile in files))
        throw new Error(
          `Cannot import file named "${toImportFile}". Available files are: [${Object.keys(
            files
          ).join(', ')}]`
        );

      const processedFile = ProcessAST.processCode(
        files[toImportFile],
        toImportFile
      );

      if (processedFile.valid === false)
        throw new Error(
          `Couldnt compile the imported file "${toImportFile}" because of errors:\n${processedFile.processingErrors
            .map((err) => JSON.stringify(err))
            .join('\n')}`
        );

      // imported files, must be imported at the outer scope aswell
      toImportFiles.push(
        ...processedFile.value.imports.map(([newFilename, _]) => newFilename)
      );

      // save the new values in the main `processedAST` var
      processedAST.value.imports.push(...processedFile.value.imports);
      processedAST.value.namespaceScopes.push(
        ...processedFile.value.namespaceScopes
      );
      // TODO same names in different files like "thisFilename.thisObj" could overwrite it
      Object.assign(processedAST.value.letDict, processedFile.value.letDict);
      Object.assign(processedAST.value.typeDict, processedFile.value.typeDict);
    }
    // #endregion

    const mainFilePath = `/${mainFilename}/main`;
    if (!(mainFilePath in processedAST.value.letDict))
      throw new Error(
        `Missing "main" function in the main file "${mainFilename}".`
      );

    const mainFunc = processedAST.value.letDict[mainFilePath];
    if (mainFunc.body.type !== 'func')
      throw new Error(
        `The "main" function in the main file must be a let-statement with a body of type function.`
      );
    else if (mainFunc.body.parameters.length !== 1)
      throw new Error(
        `The "main" function must take exactly one parameter as input.`
      );

    if (settings.timeIt) console.timeEnd('pre-execution time');

    // main :: T -> T, where T is either i32 or f64
    let mainFuncType: 'int' | 'float' =
      mainFunc.body.hasExplicitType &&
      mainFunc.body.typeExpression.type === 'primitive-type' &&
      (mainFunc.body.typeExpression.primitiveToken.l === 'i32' ||
        mainFunc.body.typeExpression.primitiveToken.l === 'f64')
        ? mainFunc.body.typeExpression.primitiveToken.l === 'i32'
          ? 'int'
          : 'float'
        : 'int';

    const inputSign: number = Math.sign(input);
    let formattedInput: string = Math.abs(input).toString().toLowerCase();
    if (formattedInput === Infinity.toString().toLowerCase())
      formattedInput = 'inf';
    if (!Number.isSafeInteger(Number(formattedInput))) mainFuncType = 'float';

    if (settings.timeIt) console.time('raw execution time');
    const result: internalVal = executeExpr(
      {
        type: 'expr',
        expr: {
          type: 'call',
          arguments: [
            {
              argument: {
                type: 'unary',
                operator: inputSign === -1 ? '-' : '+',
                operatorToken: 0 as never,
                comments: 0 as never,
                body: {
                  type: 'literal',
                  literalType: mainFuncType === 'int' ? 'i32' : 'f64',
                  literalToken: {
                    l: formattedInput,
                    t: Parser.tokenType.literal,
                    i: -1
                  },
                  comments: 0 as never
                }
              },
              delimiterToken: 0 as never
            }
          ],
          function: {
            type: 'identifier',
            identifier: mainFilePath,
            identifierToken: {} as never,
            comments: 0 as never
          },
          openingBracketToken: 0 as never,
          closingBracketToken: 0 as never,
          comments: 0 as never
        },
        closure: {}
      },
      processedAST.value.letDict,
      processedAST.value.typeDict
    );
    if (settings.timeIt) console.timeEnd('raw execution time');

    // TODO: check with func type
    if (result.type !== 'int' && result.type !== 'float')
      throw new Error(
        `User error: "main()" should return an ${mainFuncType} but got the result: ${JSON.stringify(
          result
        )}.`
      );

    return result.value;
  }

  function executeExpr(
    expr: internalVal,
    lets: {
      [path: string]: Parser.letStatement;
    },
    types: {
      [path: string]: Parser.typeStatement;
    }
  ): internalVal {
    if (
      expr.type === 'int' ||
      expr.type === 'float' ||
      expr.type === 'complexType'
    )
      return expr;

    if (expr.type !== 'expr')
      throw new Error(
        `Internal interpreting error: the expression type ${JSON.stringify(
          expr
        )} is unknown.`
      );

    const parseExpr: Parser.expression = expr.expr;
    let closure: {
      [localIdent: string]: internalVal;
    } = quickFixDeepCpy ? deepCpy(expr.closure) : expr.closure;

    switch (parseExpr.type) {
      case 'propertyAccess':
        throw new Error(
          `Internal interpreting error: should not have a property access when interpreting because preprocessor handles this.`
        );
      case 'func':
        return expr;
      case 'grouping':
        return executeExpr(
          { type: 'expr', expr: parseExpr.body, closure },
          lets,
          types
        );
      case 'literal':
        // return the actual value
        const literalVal: number =
          parseExpr.literalToken.l === 'inf'
            ? Infinity
            : Number(parseExpr.literalToken.l);

        if (parseExpr.literalType === 'i32') {
          if (!Number.isSafeInteger(literalVal))
            throw new Error(
              `The number ${parseExpr.literalToken.l} is not a valid integer.`
            );
          return { type: 'int', value: literalVal };
        } else if (parseExpr.literalType === 'f64')
          return {
            type: 'float',
            value: literalVal
          };

        throw new Error(
          'Internal interpreting error: literal type must be `i32` or `f64`.'
        );
      case 'unary':
        const unaryOp: string = parseExpr.operator;
        const bodyVal: internalVal = executeExpr(
          { type: 'expr', expr: parseExpr.body, closure },
          lets,
          types
        );
        if (bodyVal.type === 'complexType' || bodyVal.type === 'expr')
          throw new Error(
            `User error: the unary operator "${unaryOp}" can only be used with numeric values.`
          );

        switch (unaryOp) {
          case '+':
            return bodyVal;
          case '-':
            bodyVal.value = -bodyVal.value;
            return bodyVal;
          case '~':
            if (bodyVal.type !== 'int')
              throw new Error(
                `Unary operator "~" has signature i32 -> i32, but used value ${bodyVal.type}.`
              );
            bodyVal.value = ~bodyVal.value;
            return bodyVal;
          case '!':
            if (bodyVal.type !== 'int')
              throw new Error(
                `Unary operator "!" has signature i32 -> i32, but used value ${bodyVal.type}.`
              );
            bodyVal.value = Number(!bodyVal.value);
            return bodyVal;
          default:
            throw new Error(
              `Internal error: unknown unary operato ${unaryOp} used in interpreting step.`
            );
        }
      case 'binary':
        const binaryOp: string = parseExpr.operator;
        const left: internalVal = executeExpr(
          {
            type: 'expr',
            expr: parseExpr.leftSide,
            closure
          },
          lets,
          types
        );
        const right: internalVal = executeExpr(
          {
            type: 'expr',
            expr: parseExpr.rightSide,
            closure
          },
          lets,
          types
        );

        if (
          left.type === 'expr' ||
          left.type === 'complexType' ||
          right.type === 'expr' ||
          right.type === 'complexType'
        )
          throw new Error(
            `User error: can only do the binary "${binaryOp}" operation on numeric values.`
          );
        else if (left.type !== right.type) {
          // TODO
          // console.log(
          //   'Annotation test',
          //   Annotate.annotate({
          //     type: 'error',
          //     value: {
          //       errorId: Annotate.ErrorId.eInvalidBinaryOpType,
          //       filename: 'TODO',
          //       code: 'TODO',

          //       startIndex: parseExpr.operatorToken.i,
          //       endIndex:
          //         parseExpr.operatorToken.i + parseExpr.operatorToken.l.length,

          //       binOpLex: parseExpr.operatorToken,
          //       rightOperant: parseExpr.rightSide,
          //       leftOperant: parseExpr.leftSide,
          //       rightType: right.type,
          //       leftType: left.type
          //     }
          //   })
          // );

          throw new Error(
            `User error: can only do the binary "${binaryOp}" operation on equally typed values.`
          );
        }

        switch (binaryOp) {
          case '+':
            left.value = left.value + right.value;
            return left;
          case '-':
            left.value = left.value - right.value;
            return left;
          case '*':
            left.value = left.value * right.value;
            return left;
          case '/':
            if (right.type === 'int' && right.value === 0)
              throw new Error(`User error: divided by 0.`);
            left.value = left.value / right.value;
            if (left.type === 'int') left.value = Math.trunc(left.value);
            return left;
          case '**':
            left.value = left.value ** right.value;
            return left;
          case '%':
            if (left.type !== 'int')
              throw new Error(
                `Binary operator "%" has signature i32 -> i32 -> i32, but used it with types ${left.type}.`
              );
            left.value = left.value % right.value;
            return left;
          case '&':
            if (left.type !== 'int')
              throw new Error(
                `Binary operator "&" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`
              );
            left.value = left.value & right.value;
            return left;
          case '|':
            if (left.type !== 'int')
              throw new Error(
                `Binary operator "|" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`
              );
            left.value = left.value | right.value;
            return left;
          case '^':
            if (left.type !== 'int')
              throw new Error(
                `Binary operator "^" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`
              );
            left.value = left.value ^ right.value;
            return left;
          case '<<':
            if (left.type !== 'int')
              throw new Error(
                `Binary operator "<<" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`
              );
            left.value = left.value << right.value;
            return left;
          case '>>':
            if (left.type !== 'int')
              throw new Error(
                `Binary operator ">>" has signature i32 -> i32 -> i32, but used it with type ${left.type}.`
              );
            left.value = left.value >> right.value;
            return left;
          case '==':
            return {
              type: 'int',
              value: Number(left.value === right.value)
            };
          case '!=':
            return {
              type: 'int',
              value: Number(left.value !== right.value)
            };
          case '>':
            return {
              type: 'int',
              value: Number(left.value > right.value)
            };
          case '<':
            return {
              type: 'int',
              value: Number(left.value < right.value)
            };
          case '>=':
            return {
              type: 'int',
              value: Number(left.value >= right.value)
            };
          case '<=':
            return {
              type: 'int',
              value: Number(left.value <= right.value)
            };

          default:
            throw new Error(
              `Internal error: unknown unary operator "${binaryOp}" used in interpreting step.`
            );
        }
      case 'identifier':
        const ident: string = parseExpr.identifier;
        if (ident[0] !== '/' && ident in closure)
          return executeExpr(closure[ident], lets, types);
        else if (ident in lets)
          return executeExpr(
            {
              type: 'expr',
              expr: lets[parseExpr.identifier].body,
              closure: {}
            },
            lets,
            types
          );

        throw new Error(
          `Internal error: identifier "${parseExpr.identifier}" must be in current scope (either in the current closure or from lets in general) but couldnt be found.`
        );
      case 'call':
        // typeInstantiation, i32/f64, on Function, on Identifier (could all be on the return of a internal complicated thing from e.g. a match expr)
        let toCall: internalVal = executeExpr(
          {
            type: 'expr',
            expr: parseExpr.function,
            closure
          },
          lets,
          types
        );

        switch (toCall.type) {
          case 'complexType':
            if (!(toCall.tyName in types))
              throw new Error(
                `User/Internal error: the types ${toCall.tyName} does not exists as a complex type in the current scope.`
              );

            const ty: Parser.typeStatement = types[toCall.tyName];
            const discriminator: string = toCall.discriminator;

            if (ty.type !== 'complex-type')
              throw new Error(
                `User error: the type ${toCall.tyName} is not a complex type in the current scope.`
              );

            const internalComplexTypeIdx: number = ty.body.findIndex(
              (val) => val.argument.identifierToken.l === discriminator
            );
            if (internalComplexTypeIdx === -1)
              throw new Error(
                `User error: the complex type pattern ${toCall.discriminator} is not part of the complex type ${ty.name}.`
              );

            const expectedArgCount: number =
              ty.body[internalComplexTypeIdx].argument.arguments.length;
            const givenArgCount: number = parseExpr.arguments.length;
            if (expectedArgCount !== givenArgCount)
              throw new Error(
                `User error: tried to instantiate type with too many arguments. Expected ${expectedArgCount} arguments, but got ${givenArgCount}.`
              );

            toCall.values.push(
              ...parseExpr.arguments.map((arg) =>
                executeExpr(
                  {
                    type: 'expr',
                    expr: arg.argument,
                    closure
                  },
                  lets,
                  types
                )
              )
            );
            return toCall;
          case 'expr':
            if (toCall.expr.type !== 'func')
              throw new Error(
                `User error: can only call functions, but got "${toCall.expr.type}".`
              );

            const givenArgs: internalVal[] =
              parseExpr.arguments.map<internalVal>((arg) => ({
                type: 'expr',
                expr: arg.argument,
                closure
              }));
            const neededArgs: [string, internalVal | undefined][] =
              toCall.expr.parameters.map<[string, internalVal | undefined]>(
                (param) => [
                  param.argument.identifierToken.l,
                  param.argument.hasDefaultValue
                    ? {
                        type: 'expr',
                        expr: param.argument.defaultValue,
                        closure
                      }
                    : undefined
                ]
              );

            if (givenArgs.length > neededArgs.length)
              throw new Error(
                'User error: called a function with too many arguments.'
              );

            // DO NOT execute them, but let it be done in the lazy evaluation part!
            const finalArgs: { [localIdent: string]: internalVal }[] = [];
            for (let i = 0; i < neededArgs.length; ++i)
              if (i < givenArgs.length)
                finalArgs.push({
                  [neededArgs[i][0]]: givenArgs[i]
                });
              else if (neededArgs[i][1] !== undefined)
                finalArgs.push({
                  [neededArgs[i][0]]: neededArgs[i][1]!
                });
              else
                throw new Error(
                  'User error: called function with missing argument(s) which dont have default values.'
                );

            const newArgs: {
              [localIdent: string]: internalVal;
            } = {};
            Object.assign(newArgs, ...finalArgs);

            return executeExpr(
              {
                type: 'expr',
                expr: toCall.expr.body,
                closure: { ...toCall.closure, ...newArgs }
              },
              lets,
              types
            );
          case 'float':
          case 'int':
            if (parseExpr.arguments.length !== 2)
              throw new Error(
                `User error: calling i32/f64 requires to have two expressions but got ${parseExpr.arguments.length} arguments.`
              );

            // if equal to 0, return the first element, else return the second element
            const toCallExpr: Parser.expression =
              parseExpr.arguments[Number(toCall.value !== 0)].argument;

            return executeExpr(
              {
                type: 'expr',
                expr: toCallExpr,
                closure
              },
              lets,
              types
            );
          default:
            throw new Error(
              'Internal error: tried calling something with a wrong type.'
            );
        }
      case 'match':
        const scrutinee: internalVal = executeExpr(
          {
            type: 'expr',
            expr: parseExpr.scrutinee,
            closure
          },
          lets,
          types
        );

        if (scrutinee.type !== 'complexType')
          throw new Error(
            `User error: can only match complex types but got "${scrutinee.type}".`
          );

        const toExecLineIdx: number = parseExpr.body.findIndex(
          (pattern) =>
            pattern.argument.isDefaultVal === false &&
            pattern.argument.identifierToken.l === scrutinee.discriminator
        );
        const defaultLineIdx: number = parseExpr.body.findIndex(
          (pattern) => pattern.argument.isDefaultVal
        );

        const correctIdx: number =
          toExecLineIdx !== -1
            ? toExecLineIdx
            : // fall back to the default case if no pattern matches rn
              defaultLineIdx;

        if (correctIdx === -1)
          throw new Error(
            `User error: the pattern "${scrutinee.discriminator}" is missing in the current match expression!`
          );

        // add local closure/scope vars

        const matchLine: Parser.matchBodyLine =
          parseExpr.body[correctIdx].argument;
        const newCtxValueNames: string[] =
          matchLine.isDefaultVal === true
            ? []
            : matchLine.parameters.map((param) => param.argument.l);

        // allow having less values extracted than really needed
        // because in expr "(a->t)(params)", the first expr has no value given
        if (newCtxValueNames.length > scrutinee.values.length)
          throw new Error(
            `User error: too many values in scrutinee with the needed match body line. expected ${scrutinee.values.length}, but got ${newCtxValueNames.length}.`
          );

        const updatedClosureValues: {
          [localIdent: string]: internalVal;
        } = {};
        for (let i = 0; i < scrutinee.values.length; ++i)
          updatedClosureValues[newCtxValueNames[i]] = scrutinee.values[i];

        return executeExpr(
          {
            type: 'expr',
            expr: matchLine.body,
            closure: { ...closure, ...updatedClosureValues }
          },
          lets,
          types
        );
      case 'typeInstantiation':
        if (parseExpr.source.type !== 'identifier')
          throw new Error(
            'Internal error: type instantiations should always be from an (internal) identifier to an identifier.'
          );

        const complexType: Parser.typeStatement =
          types[parseExpr.source.identifier];
        if (complexType === undefined)
          throw new Error(
            'Internal interpreting error: identifier is not accessible in current scope.'
          );
        else if (complexType.type !== 'complex-type')
          throw new Error(
            'User error: tried type instantiation with a simple type.'
          );

        if (
          !complexType.body.some(
            (e) => e.argument.identifierToken.l === parseExpr.typeLineToken.l
          )
        )
          throw new Error(
            `User error: tried to do type instatiation with property ${parseExpr.typeLineToken.l} which doesnt exist on current complex type: ${complexType.name}.`
          );

        return {
          type: 'complexType',
          tyName: parseExpr.source.identifier,
          discriminator: parseExpr.typeLineToken.l,
          values: []
        };
    }
  }
}
