import { Parser } from './LCParser';
import { ProcessAST } from './LCIdentifierCheck';
// import { Annotate } from './LCCodeAnnotation';
// @ts-ignore
//import { inspect } from 'util';

// TODO types

//const log = (args: any) =>
//  console.log(inspect(args, { depth: 999, colors: true }));

export namespace Interpreter {
  let quickFix: boolean = false;

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
        // TODO, needs some kind of closure, because when calling this value, it could already have WAY different closure values, because of very late lazy evaluation
        closure: { [localIdent: string]: internalVal };
      }
    | {
        type: 'complexType';
        tyName: string;
        discriminator: string;
        values: internalVal[];
      };

  // TODO:
  // interpreting preprocessing aka. remove all the type annotations, since they are useless for actual execution
  // have a data type wrapper for `i32`, `f64` and complex types and save the structure of complex types
  // (like its discriminator, to know what path to take in match exprs)
  // replace all the identifiers by their value if possible (check for recursive things even between two different idents)
  // replace all the const exprs by their value
  export function interpret(
    files: { [filename: string]: string },
    mainFilename: string,
    input: number,
    settings: { timeIt?: boolean; scopeDeepCpyQuickFix?: boolean } = {
      timeIt: false,
      scopeDeepCpyQuickFix: false
    }
  ): number {
    quickFix = settings.scopeDeepCpyQuickFix ?? false;
    settings.timeIt = settings.timeIt ?? false;

    if (settings.timeIt) console.time('pre-execution time');

    if (!(mainFilename in files))
      throw new Error(
        `The main file ${mainFilename} does not exist in the current files: $${JSON.stringify(
          Object.keys(files)
        )}`
      );

    const processedAST = ProcessAST.processCode(
      files[mainFilename],
      mainFilename
    );

    if (!processedAST.valid)
      throw new Error(
        `Invalid code in main file: ${mainFilename}. Errors: ${JSON.stringify(
          processedAST.processingErrors
        )}`
      );

    // #region recursively import files
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
          `The imported file ${toImportFile} is missing from the files ${JSON.stringify(
            Object.keys(files)
          )}`
        );

      const processedFile = ProcessAST.processCode(
        files[toImportFile],
        toImportFile
      );

      // TODO better error, since it could be "recursively" imported from an imported file
      if (!processedFile.valid)
        throw new Error(
          `Couldnt compile the imported file ${toImportFile} because of error: ${JSON.stringify(
            processedFile.processingErrors
          )}`
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
      Object.assign(processedAST.value.letDict, processedFile.value.letDict);
      Object.assign(processedAST.value.typeDict, processedFile.value.typeDict);
    }
    // #endregion

    // now process all the imports, and import their imports if needed
    const mainFilePath = `/${mainFilename}/main`;
    if (!(mainFilePath in processedAST.value.letDict))
      throw new Error(
        `Missing "main" function in the main file ${mainFilename}.`
      );

    const mainFunc = processedAST.value.letDict[mainFilePath];
    if (mainFunc.body.type !== 'func')
      throw new Error(
        `the "main" function in the main file must be a let statement with a body of type function.`
      );
    else if (mainFunc.body.parameters.length !== 1)
      throw new Error(
        `the "main" function must take exactly one parameter as input`
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
    let formattedInput: string = Math.abs(input).toString().toLowerCase();
    if (formattedInput === Infinity.toString().toLowerCase())
      formattedInput = 'inf';
    if (!Number.isSafeInteger(Number(formattedInput))) mainFuncType = 'float';
    const inputSign: number = Math.sign(input);

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

    // TODO add f64 support
    // TODO mainFuncType
    if (result.type !== 'int' && result.type !== 'float')
      throw new Error(
        `User error: "main()" should return an ${mainFuncType} but got the result: ${JSON.stringify(
          result
        )}`
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
        )} is unknown`
      );

    const parseExpr: Parser.expression = expr.expr;
    let closure: {
      [localIdent: string]: internalVal;
    } = quickFix ? deepCpy(expr.closure) : expr.closure; // TODO is deepCpy really necessary?

    switch (parseExpr.type) {
      case 'propertyAccess':
        throw new Error(
          `Internal interpreting error: should not have a property access when interpreting`
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
          'Internal interpreting error: literal type must be `i32` or `f64`'
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
                `User error: can only do the unary "~" operation on i32 values`
              );
            bodyVal.value = ~bodyVal.value;
            return bodyVal;
          case '!':
            if (bodyVal.type !== 'int')
              throw new Error(
                `User error: can only do the unary "!" operation on i32 values`
              );
            bodyVal.value = Number(!bodyVal.value);
            return bodyVal;
          default:
            throw new Error(
              `Internal error: unknown unary operato ${unaryOp} used in interpreting step`
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
            `User error: can only do the binary "${binaryOp}" operation on numeric values`
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
            `User error: can only do the binary "${binaryOp}" operation on equally typed values`
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
              throw new Error(`User error: can only use "%" with i32 values`);
            left.value = left.value % right.value;
            return left;
          case '&':
            if (left.type !== 'int')
              throw new Error(`User error: can only use "&" with i32 values`);
            left.value = left.value & right.value;
            return left;
          case '|':
            if (left.type !== 'int')
              throw new Error(`User error: can only use "|" with i32 values`);
            left.value = left.value | right.value;
            return left;
          case '^':
            if (left.type !== 'int')
              throw new Error(`User error: can only use "^" with i32 values`);
            left.value = left.value ^ right.value;
            return left;
          case '<<':
            // TODO limits for size
            if (left.type !== 'int')
              throw new Error(`User error: can only use "<<" with i32 values`);
            left.value = left.value << right.value;
            return left;
          case '>>':
            // TODO limits for size
            if (left.type !== 'int')
              throw new Error(`User error: can only use ">>" with i32 values`);
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
              `Internal error: unknown unary operator "${binaryOp}" used in interpreting step`
            );
        }
      case 'identifier':
        // TODO working with closures

        if (parseExpr.identifier in closure)
          return executeExpr(closure[parseExpr.identifier], lets, types);
        // TODO actually execute and not just suspend for later??
        // TODO, really? and why first lets and then types?
        else if (parseExpr.identifier in lets)
          return executeExpr(
            {
              type: 'expr',
              expr: lets[parseExpr.identifier].body,
              closure: {} // TODO other closure?
            },
            lets,
            types
          );
        // TODO user error or internal error, or no error?
        else return expr;

        // yeah?
        throw new Error(
          `User error: identifier ${JSON.stringify(
            parseExpr
          )} must be in current scope (either in the current closure or from lets in general)`
        );
      case 'call':
        // TODO fix closure stuff

        // typeInstantiation, on i32/f64, on Function, on Identifier (could all be on the return of a internal complicated thing from e.g. a match expr)
        // TODO yeah??
        let toCall = executeExpr(
          {
            type: 'expr',
            expr: parseExpr.function,
            closure
          },
          lets,
          types
        );

        // TODO
        // while (toCall.type === 'expr' && toCall.expr.type === 'identifier')
        //   toCall = executeExpr(
        //     { type: 'expr', expr: toCall.expr, closure: closure },
        //     lets,
        //     types,
        //     closure
        //   );

        // TODO
        switch (toCall.type) {
          case 'complexType':
            // TODO, check if amount is right
            if (!(toCall.tyName in types))
              throw new Error(
                `User/Internal error: the types ${toCall.tyName} does not exists as a complex type in the current scope`
              );

            const ty: Parser.typeStatement = types[toCall.tyName];

            if (ty.type !== 'complex-type')
              throw new Error(
                `User error: the type ${toCall.tyName} is not a complex type in the current scope`
              );

            const internalComplexTypeIdx: number = ty.body.findIndex(
              (val) =>
                val.argument.identifierToken.l === (toCall as any).discriminator
            );

            if (internalComplexTypeIdx === -1)
              throw new Error(
                `User error: the complex type pattern ${toCall.discriminator} is not part of the complex type ${ty.name}`
              );

            const expectedArgCount: number =
              ty.body[internalComplexTypeIdx].argument.arguments.length;
            const givenArgCount: number = parseExpr.arguments.length;
            if (expectedArgCount !== givenArgCount)
              throw new Error(
                `User error: tried to instantiate type with too many arguments. Expected ${expectedArgCount} arguments, but got ${givenArgCount}`
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
            // TODO: what about executing ints??
            if (toCall.expr.type !== 'func')
              throw new Error(
                `User error: can only call functions, but got: ${toCall.expr.type}`
              );

            //closure = deepCpy(closure) as never;
            // TODO, deep copy needed
            // TODO, if toCall is from different scope, then just remove the entire closure

            const givenArgs = parseExpr.arguments.map<internalVal>((arg) => ({
              type: 'expr',
              expr: arg.argument,
              closure
            }));
            const neededArgs = toCall.expr.parameters.map<
              [string, internalVal | undefined]
            >((param) => [
              param.argument.identifierToken.l,
              param.argument.hasDefaultValue
                ? {
                    type: 'expr',
                    expr: param.argument.defaultValue,
                    closure
                  }
                : undefined
            ]);

            if (givenArgs.length > neededArgs.length)
              throw new Error(
                'User error: called a function with too many arguments'
              );

            // TODO still working??
            // TODO DO NOT execute them, but let it be done in the lazy evaluation part!
            const finalArgs: { [localIdent: string]: internalVal }[] = [];
            for (let i = 0; i < neededArgs.length; ++i)
              if (i < givenArgs.length)
                finalArgs.push({
                  // TODO NOT like this because of lazy evaluation and performance reasons!
                  [neededArgs[i][0]]: givenArgs[i]
                });
              else if (neededArgs[i][1] !== undefined)
                finalArgs.push({
                  [neededArgs[i][0]]: neededArgs[i][1]!
                });
              else
                throw new Error(
                  'User error: called function with missing argument(s) which dont have default values'
                );

            // TODO HERE, not sure if that is actually the closure, since the old values may not be accessible anymore actually
            //toCall.closure = deepCpy(closure);
            Object.assign(toCall.closure, ...finalArgs);

            return executeExpr(
              {
                type: 'expr',
                expr: toCall.expr.body,
                // TODO too hacky, does it need to be deep copied?
                closure: toCall.closure
              },
              lets,
              types
            );
          case 'float':
          case 'int':
            // TODO: if equal to 0, return the first element, else return the second element
            if (parseExpr.arguments.length !== 2)
              throw new Error(
                `User error: calling i32/f64 requires to have two expr but got: ${parseExpr.arguments.length}`
              );

            if (toCall.value === 0)
              return executeExpr(
                {
                  type: 'expr',
                  expr: parseExpr.arguments[0].argument,
                  closure
                },
                lets,
                types
              );
            else
              return executeExpr(
                {
                  type: 'expr',
                  expr: parseExpr.arguments[1].argument,
                  closure
                },
                lets,
                types
              );
          default:
            throw new Error(
              'Internal error: tried calling something with a wrong type'
            );
        }
      case 'match':
        // TODO fix closure

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
            `User error: can only match complex types but got: ${scrutinee.type}`
          );

        const toExecLineIdx: number = parseExpr.body.findIndex(
          (pattern) =>
            !pattern.argument.isDefaultVal &&
            pattern.argument.identifierToken.l === scrutinee.discriminator
        );
        const defaultLineIdx: number = parseExpr.body.findIndex(
          (pattern) => pattern.argument.isDefaultVal
        );

        const correctIdx: number =
          toExecLineIdx !== -1
            ? toExecLineIdx
            : // fall back to the default case if no pattern matches rn
            defaultLineIdx !== -1
            ? defaultLineIdx
            : -1;

        if (correctIdx === -1)
          throw new Error(
            `User error: the pattern "${scrutinee.discriminator}" is missing in the current match expression!`
          );

        // TODO new local closure/scope, just like when calling functions

        const matchLine: Parser.matchBodyLine =
          parseExpr.body[correctIdx].argument;
        const newCtxValueNames: string[] = matchLine.isDefaultVal
          ? []
          : matchLine.parameters.map((param) => param.argument.l);

        // allow having less values extracted than really needed
        if (newCtxValueNames.length > scrutinee.values.length)
          throw new Error(
            `User error: invalid amount of values in scrutinee with the needed match body line. expected ${scrutinee.values.length}, but got ${newCtxValueNames.length}`
          );

        const doubleIdentifier: number = newCtxValueNames.findIndex(
          (val, i) => i !== newCtxValueNames.lastIndexOf(val)
        );

        if (doubleIdentifier !== -1)
          throw new Error(
            `User error: wrote a match body line with twice the same identifier: ${newCtxValueNames[doubleIdentifier]}`
          );

        // TODO
        const updatedClosureValues: {
          [localIdent: string]: internalVal;
        } = {};
        for (let i = 0; i < scrutinee.values.length; ++i)
          updatedClosureValues[newCtxValueNames[i]] = scrutinee.values[i];

        // TODO
        // Object.assign({}, updatedClosureValues);

        // TODO
        return executeExpr(
          {
            type: 'expr',
            expr: matchLine.body,
            // TODO HERE
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

        const complexType = types[parseExpr.source.identifier];
        if (complexType === undefined)
          throw new Error(
            'Internal interpreting error: identifier should be accessible in current scope, but isnt'
          );
        else if (complexType.type !== 'complex-type')
          // TODO, was that checked before? then it must be an internal error!
          throw new Error(
            'User error: tried type instantiation with a simple type.'
          );

        if (
          !complexType.body.some(
            (e) => e.argument.identifierToken.l === parseExpr.typeLineToken.l
          )
        )
          throw new Error(
            `User error: tried to do type instatiation with property ${parseExpr.typeLineToken.l} which doesnt exist on current complex type: ${complexType.name}`
          );

        // TODO, is parseExpr.source.identifier === complexType.name??
        return {
          type: 'complexType',
          tyName: parseExpr.source.identifier,
          discriminator: parseExpr.typeLineToken.l,
          values: []
        };
    }
  }
}

// const test = Interpreter.interpret(
//   {
//     t: `
// let f = func (a, b) => func (c) => a + b + c;
// let main = func (argument: i32): i32 => 3 * f(argument, 1)(2);
//     `,
//     test: `
// //let sum = func (zahl) => (zahl == 0)(zahl + sum(zahl - 1), 0);

// type Tree[T] {
// E,
// F(T, Tree[T], Tree[T])
// }

// let sumTree = func (tree) =>
// match (tree) {
//   E => 0,
//   F(wert, left, right) => wert + sumTree(left) + sumTree(right)
// };

// use lc;

// // lc.F(lc.fix(lc.F))(lc.three)
// // lc.y(lc.F)(lc.three)
// // lc.fact(lc.three)
// // lc.churchIntToI32( lc.theta(lc.F)(lc.two) )

// //let main = func (n) => lc.churchIntToI32( lc.y(lc.F)(lc.two) );

// type data { mid(data), end(i32) }
// let d = data->mid(data->mid(data->end));
// //let main = func (n) => (func (n=3+7) => n-2)(n);

// //let o = func (n) => (n == 0.0)( n*o(n-1.0), 1.0 );

// //let main = func (n) => o(100.0);

// //let main = func (n) => (n==0)(n*main(n-1), 1);

// //let aaa = func (y) => x-3;//error, because x is not defined
// //let aa = func (x) => aaa(x-1);
// //let main = func (n) => aa(5+n);

// use math;
// use stack;
// let p = stack.push;
// let a = p(3, p(4, p(12, stack.newStack)));
// let main = func (n) => match (stack.get(5, stack.concat(a, a))) {
//   none => -1,
//   some(A) => A
// };
//     `,
//     lc: `
//   // booleans
//   let true = func (x) => func (y) => x;
//   let false = func (x) => func (y) => y;

//   // logical operations on booleans
//   let if = func (b) => func (x) => func (y) => b(x)(y);
//   let not = func (x) => x(false)(true);
//   let and = func (x) => func (y) => x(y)(x);
//   let or = func (x) => func (y) => x(x)(y);

//   // church numerals
//   let zero = func (f) => func (x) => x;
//   let one = func (f) => func (x) => f(x);
//   let two = func (f) => func (x) => f( f(x) );
//   let three = succ(two);
//   let four = succ(three);
//   let five = succ(four);

//   // successor/predecessor of church numerals
//   let succ = func (n) => func (f) => func (x) => f( n(f)(x) );
//   let pred = func (n) => func (f) => func (x) =>
//     n( func (g) => func (h) => h(g(f)) )( func (u) => x )( func (u) => u );
//   let pred2 = func (n) => // way slower
//     n( func (g) => func (k) => isZero( g(one) )( k )( succ( g(k) ) ) )( func (v) => zero )( zero );
//   let pred3 = func (n) => first( n(phi)(pair(zero)(zero)) );

//   // arithmetic on church numerals
//   let plus = func (n) => func (m) => func (f) => func (x) => m( f )( n(f)(x) );
//   let mult = func (n) => func (m) => func (f) => m( n(f) );
//   let pow = func (base) => func (exp) => exp(base);
//   let sub = func (n) => func (m) => m(pred)(n); // n - m with n > m, else 0

//   // arithmetic checks on church numerals
//   let isZero = func (n) => n(func (x) => false)(true);
//   // <=
//   let leq = func (n) => func (m) => isZero( sub(n)(m) );

//   // tuples and linked lists
//   // (a, b)
//   let pair = func (a) => func (b) => func (extract) => extract(a)(b);
//   let first = func (p) => p(true);
//   let second = func (p) => p(false);
//   let nil = func (x) => true;
//   let null = func (p) => p( func (x) => func (y) => false ); // checks if the p is a pair or nil
//   // (m, n) -> (n, n + 1)
//   let phi = func (x) => pair( second(x) )( succ( second(x) ) );

//   // combinators
//   let id = func (x) => x;
//   let fix = func (f) => f( fix(f) );
//   let y = func (f) => (func (x) => f(x(x)))(func (x) => f(x(x)));
//   let theta = (func(x)=>func(y)=>y(x(x(y))))(func(x)=>func(y)=>y(x(x(y))));

//   // SKI-combinator
//   let I = func (x) => x;
//   let K = func (x) => func (y) => x;
//   let S = func (x) => func (y) => func (z) => x(z)(y(z));

//   // BCKW-system
//   let B = func (x) => func (y) => func (z) => x(y(z));
//   let C = func (x) => func (y) => func (z) => x(z)(y);
//   let W = func (x) => func (y) => x(y)(y);

//   let U = func (x) => x(x);
//   let omega = U(U);

//   // factorial, but defined recursively
//   let fact = func (n) => isZero(n)( one )( mult(n)( fact( pred(n) ) ) );
//   let F = func (f) => func (n) => isZero(n)(one)(mult(n)(f(pred(n))));

//   // gaussian sum
//   let sum = func (n) => isZero(n)( n )( plus(n)( sum (pred(n)) ) );

//   // lc to bll and vice versa
//   let boolToI32 = func (bool) => bool(1)(0);
//   let churchIntToI32 = func (uint) => uint(func (x) => x + 1)(0);
//   let i32ToChurchInt = func (n) => (n <= 0)(succ( i32ToChurchInt(n - 1) ), zero);
//   `,
//     stack: `
// type opt[T] {
//   none,
//   some(T)
// }

// type st[T] {
//   finished,
//   value(T, st[T])
// }

// let newStack[T]: st[T] = st->finished;
// let push[T]: (T, st[T]) -> st[T] = func (value: T, stack: st[T]): st[T] => st->value(value, stack);
// let pop[T]: st[T] -> st[T] = func (stack: st[T]): st[T] => match (stack): st[T] {
//   finished => newStack,
//   value(val, rest) => rest
// };
// let peek[T]: st[T] -> opt[T] = func (stack: st[T]): opt[T] => match (stack): opt[T] {
//   finished => opt->none,
//   value(val, rest) => opt->some(val)
// };

// let contains[T]: (T, st[T]) -> i32 = func (value: T, stack: st[T]): i32 => match (stack): i32 {
//   finished => 0,
//   value(val, rest) => (val == value)(contains(value, rest), 1)
// };

// // getBeforeIdx/getAfterIdx + concat

// // TODO error: ([a, b, c], [d, e, f]) => [a, b, c, f, e, d]
// let concat[T]: (st[T], st[T]) -> st[T] =
//   func (st1: st[T], st2: st[T]): st[T] =>
//     (length(st2)==0)(
//       match (st2) {
//         value(val, rest) =>
//           concat(push(val, st1), rest)
//       },
//       st1
//     );

// // TODO, not working at all
// let removeLast: st[T] -> st[T] = func (stack: st[T]): st[T] =>
//   match (stack) {
//     finished -> newStack,
//     value(v, rest) => (match (rest) { finished => 1, => 0 })(removeLast(rest), 0 /*is finished*/)
//   };

// let length[T]: st[T] -> i32 = func (stack: st[T]): i32 => match (stack) {
//   finished => 0,
//   value(_, rest) => 1 + length(rest)
// };

// let getFromTop[T]: (i32, st[T]) -> opt[T] =
//   func (idx: i32, stack: st[T]): opt[T] =>
// (idx >= 0)(
//     opt->none,
//     match (stack) {
//       finished => opt->none,
//       value(val, rest) => (idx == 0)(
//         getFromTop(idx-1, rest),
//         opt->some(val)
//       )
//     },
// );

// let get[T]: (i32, st[T]) -> opt[T] =
//   func (idx: i32, stack: st[T]): opt[T] =>
//     getFromTop(length(stack)-1-idx, stack);
//     `,
//     linkedList: `
//     // get, set, length
//     // push, pop, shift, unshift
//     // splice

//     // map, filter, sort, reverse, concat, slice
//     // every, some, indexOf, includes/find, reduce, reduceRight
//     `,
//     binaryTrees: ``,
//     dataTypes: `
//     // array, tuple, set, (bin-) trees, linked list, hashmap/associative array
//     `,
//     set: `
//     // union, intersection, symmetricDifference, difference
//     // isDisjointFrom, isSubsetOf, isSupersetOf
//     // size, has
//     // add, remove
//     `,
//     map: `
//     // set, has, get, delete
//     // values(), keys()
//     `,
//     monads: ``,
//     math: `

// // IEEE754 double precision floats (64 Bits: 1 sign bit, 11 exponent bits, 52 explicit mantissa bits; 1023 bias)
// let zero: f64 = 0.0;
// let one: f64 = 1.0;
// let NaN: f64 = nan;
// let infinity: f64 = inf;
// let negativeInfinity: f64 = -inf;
// let epsilon: f64 = 2.0 ** -52.0;
// let maxSafeInteger: f64 = 2.0 ** (53.0) - 1.0;
// let maxValue: f64 = 2.0 ** 1023.0 * (2.0 - 2.0 ** -52.0);
// let minValue: f64 = 2.0 ** -1074.0;
// let largestLessThanOne: f64 = 1.0 - 2.0 ** -53.0;
// let smallestMoreThanOne: f64 = 1.0 + epsilon;
// let minNormalizedNumber: f64 = 2.0 ** -1022.0;
// let maxDenormalizedNumber: f64 = 2.0 ** -1022.0 * (1.0 - 2.0 ** -52.0);

// // constants
// let PI: f64 = 3.141592653589793;
// let SQRT2: f64 = 1.4142135623730951; // sqrt(2)
// let SQRT1_2: f64 = 0.7071067811865476; // sqrt(1/2)
// let E: f64 = 2.718281828459045;
// let LN10: f64 = 2.302585092994046; // log_E(10)
// let LN2: f64 = 0.6931471805599453; // log_E(2)
// let LOGE: f64 = 0.4342944819032518; // log_10(E)
// let LBE: f64 = 1.4426950408889634; // log_2(E)

// //
// let false: i32 = 0;
// let true: i32 = 1;

// //
// let isFalse: i32 -> i32 = func (n: i32): i32 => n == 0;
// let isTrue: i32 -> i32 = func (n: i32): i32 => n != 0;

// //
// let add[T]: (T, T) -> T = func (a: T, b: T): T => a + b;
// let sub[T]: (T, T) -> T = func (a, T, b: T): T => a - b;
// let mul[T]: (T, T) -> T = func (a, T, b: T): T => a * b;
// let div[T]: (T, T) -> T = func (a, T, b: T): T => a / b;
// let exp[T]: (T, T) -> T = func (a, T, b: T): T => a ** b;

// let rem: (i32, i32) -> i32 = func (a: i32, b: i32): i32 => a % b;
// let negate[T]: T -> T = func (n: T): T => -n;
// let not: i32 -> i32 = func (n: i32): i32 => !n;
// let binNot: i32 -> i32 = func (n: i32): i32 => ~n;
// let and: (i32, i32) -> i32 = func (a: i32, b: i32): i32 => a & b;
// let or: (i32, i32) -> i32 = func (a: i32, b: i32): i32 => a | b;
// let xor: (i32, i32) -> i32 = func (a: i32, b: i32): i32 => a ^ b;
// let lshift: (i32, i32) -> i32 = func (a: i32, b: i32): i32 => a << b;
// let rshift: (i32, i32) -> i32 = func (a: i32, b: i32): i32 => a >> b;

// let eq[T]: (T, T) -> T = func (a: T, b: T): i32 => a == b;
// let neq[T]: (T, T) -> T = func (a: T, b: T): i32 => a != b;
// let le[T]: (T, T) -> T = func (a: T, b: T): i32 => a <= b;
// let lt[T]: (T, T) -> T = func (a: T, b: T): i32 => a < b;
// let ge[T]: (T, T) -> T = func (a: T, b: T): i32 => a >= b;
// let gt[T]: (T, T) -> T = func (a: T, b: T): i32 => a > b;

// //
// let sign: f64 -> f64 = func (n: f64): f64 => (n < 0.0)((n==0.0)(1.0, n), -1.0);
// let abs: f64 -> f64 = func (n: f64): f64 => (n==0.0)(sign(n) * n, 0.0);
// let isFinite: f64 -> i32 = func (n: f64): i32 => isNaN(n)((n==inf|n==-inf)(1, 0), 0);
// let isInteger: f64 -> i32 = func (n: f64): i32 => 0; // TODO
// let isNaN: f64 -> i32 = func (n: f64): i32 => n != n;
// let toInt: f64 -> i32 = func (n: f64): i32 => 0; // TODO
// let toFloat: i32 -> f64 = func (n: i32): f64 => 0.0; // TODO
// let sin: f64 -> f64 = func (n: f64): f64 => 0.0; // TODO
// let asin: f64 -> f64 = func (n: f64): f64 => 0.0; // TODO
// let sinh: f64 -> f64 = func (n: f64): f64 => 0.0; // TODO
// let sqrt: f64 -> f64 = func (n: f64): f64 => n ** 0.5;
// let cbrt: f64 -> f64 = func (n: f64): f64 => n ** (1.0/3.0);
// let floor: f64 -> f64 = func (n: f64): f64 => 0.0; // TODO
// let ceil: f64 -> f64 = func (n: f64): f64 => 0.0; // TODO
// let round: f64 -> f64 = func (n: f64): f64 => 0.0; // TODO
// let ln: f64 -> f64 = func (n: f64): f64 => 0.0; // TODO
//     `,
//     test2: `
//   type tuple[A, B] {
//     t(A, B)
//   }

//   type array[T] {
//     null,
//     value(T, array[T])
//   }

//   let first[A, B] = func (tup: tuple[A, B]): A => match (tup) {
//     t(A, B) => A
//   };
//   let second[A, B] = func (tup: tuple[A, B]): B => match (tup) {
//     t(A, B) => B
//   };

//   let new_stack = func () => array->null;
//   let push[T] = func (arr: array[T], value: T): array[T] => array->value(value, arr);
//   let pop[T] = func (arr: array[T]): tuple[array[T], T] => match (arr) {
//     null => arr, // error
//     value(v, a) => tuple->t(v, a)
//   };
//   let pop_value[T] = func (arr: array[T]): T => first(pop(arr));
//   let pop_array[T] = func (arr: array[T]): array[T] => second(pop(arr));
//   let top[T] = func (arr: array[T]): T => match (arr) {
//     null => arr, // error
//     value(v, a) => v
//   };
//   let is_empty[T] = func (arr: array[T]): i32 => match (arr) {
//     null => 1,
//     => 0
//   };

//   let example = push(push(new_stack(), 5), 2);

//   // TODO
//   let insert_inbetween[T] = func (val: T, before: array[T], after: array[T]): array[T] =>
//     array->value(val, before);

//   let main = func (n) => is_empty(example);
//   `
//   },
//   't',
//   7
// );

//log(test);

console.log(
  Interpreter.interpret(
    {
      main: `

let fac: i32 -> i32 = func (n: i32) => (n<=0)(n * fac(n-1), 1);
let sum: i32 -> i32 = func (n: i32) => (n<=0)(n + sum(n-1), 0);
let fac2: i32 -> i32 = func (n: i32): i32 => n(1, n*fac2(n-1));
let fac3: i32 -> i32 = func (n: i32, res: i32 = 1): i32 => n(res, fac3(n-1, res*n));

let sum_check: i32 -> i32 = func (n: i32) => (n*(n+1)/2) == sum(n);

let a = func (x) => (x-1)*(b(x+1));
let b = func (x) => x+2;

let main = func (n) => fac3(n);`
    },
    'main',
    100,
    { timeIt: true }
  )
);
