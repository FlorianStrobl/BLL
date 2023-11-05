import { Parser } from './LCParser';
// @ts-ignore
import { inspect } from 'util';

const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

export namespace ProcessAST {
  // #region types
  const processingErrors: processingError[] = [];

  export type processingError = unknown;

  export interface processedAST {
    imports: [string, Parser.statement][]; // hold a reference to the original AST
    // can be undef because e.g. std does not have a main func
    // e.g. "/main": { main } or "/group1/my_type": { my_type }
    letDict: { [path: string]: Parser.statementLet }; // Map<string, Parser.statement>
    typeDict: { [path: string]: Parser.statementTypes }; // Map<string, Parser.statement>
    namespaceScopes: string[];
  }
  // #endregion

  // #region processors
  function newProcessingError(processingError: string | unknown): never {
    processingErrors.push(processingError);
    return processingError as never;
  }

  // #region step 1
  // remove all the groupings TODO, couldnt that just be in step 2?

  // processExprLevel2 and processTypeExprLevel2:
  // go inside the exprs and replace the identifiers by their respective path
  // what about:
  // let x = std.hey;
  // type t[T] = T;

  // third level: type resolution for lets and type checking for types(?)

  // remove all the groupings and save the important statements into the datastructure
  function processASTGrps(
    ast: Parser.statement[],
    currentScope: string,
    filename: string
  ): processedAST {
    const processedAST: processedAST = {
      imports: [],
      letDict: {},
      typeDict: {},
      namespaceScopes: []
    };

    // a list of all the namespaces in this scope
    // having twice the same namespace name will yield an error msg
    for (let statement of ast) {
      statement = processStmtGrp(statement);

      switch (statement.type) {
        case 'comment':
        case 'empty':
          // skip
          break;
        case 'import':
          processedAST.imports.push([statement.filename.lex, statement]);
          break;
        case 'group':
          // TODO group name cannot be the filename
          if (statement.name === filename)
            // TODO what about imports
            newProcessingError(
              `a namespace cannot be named just like its filename: ${statement.name}`
            );
          else if (
            processedAST.namespaceScopes.includes(
              currentScope + statement.name
            ) ||
            `${currentScope + statement.name}` in processedAST.letDict ||
            `${currentScope + statement.name}` in processedAST.typeDict
          )
            newProcessingError(
              `the namespace ${
                currentScope + statement.name
              } already exists in this scope in form of another group, let or type statement`
            );
          else processedAST.namespaceScopes.push(currentScope + statement.name);

          const data: processedAST = processASTGrps(
            statement.body,
            `${currentScope}${statement.name}/`,
            filename
          );

          processedAST.namespaceScopes.push(...data.namespaceScopes);

          if (data.imports.length !== 0)
            throw new Error(
              'Internal processing error: imports in namespaces are not allowed and should be prohibited by the parser.'
            );

          for (const [key, value] of Object.entries(data.letDict))
            if (key in processedAST.letDict)
              // not check if key is in the current scope of namespaces, because key is from a different scope
              newProcessingError(
                `the let statement "${key}" already existed in form of another let or group statement`
              );
            else processedAST.letDict[key] = value;

          for (const [key, value] of Object.entries(data.typeDict))
            if (key in processedAST.typeDict)
              // not check if key is in the current scope of namespaces, because key is from a different scope
              newProcessingError(`already had ${key} as a value`);
            else processedAST.typeDict[key] = value;

          break;
        case 'let':
          if (
            currentScope + statement.name in processedAST.letDict ||
            processedAST.namespaceScopes.includes(currentScope + statement.name)
          )
            newProcessingError(
              `let identifier ${
                currentScope + statement.name
              } is already in the in the file`
            );

          processedAST.letDict[currentScope + statement.name] = statement;
          break;
        case 'type-alias':
        case 'complex-type':
          if (
            currentScope + statement.name in processedAST.typeDict ||
            processedAST.namespaceScopes.includes(currentScope + statement.name)
          )
            newProcessingError(
              `type identifier ${currentScope + statement.name} alreay exists`
            );

          processedAST.typeDict[currentScope + statement.name] = statement;
          break;
      }
    }

    return processedAST;
  }

  function processStmtGrp(stmt: Parser.statement): Parser.statement {
    switch (stmt.type) {
      case 'import':
      case 'empty':
      case 'comment':
        return stmt;
      case 'let':
        // no need to process the generic identifiers

        if (stmt.hasExplicitType)
          stmt.typeExpression = processTypeExprGrp(stmt.typeExpression);

        stmt.body = processExprGrp(stmt.body);
        return stmt;
      case 'type-alias':
        // no need to process the generic identifiers
        stmt.body = processTypeExprGrp(stmt.body);
        return stmt;
      case 'complex-type':
        // no need to process the generic identifiers
        stmt.body = stmt.body.map((line) => {
          line.argument.arguments = line.argument.arguments.map((arg) => {
            arg.argument = processTypeExprGrp(arg.argument);
            return arg;
          });
          return line;
        });
        return stmt;
      case 'group':
        stmt.body = stmt.body.map((st) => processStmtGrp(st));
        return stmt;
    }
  }

  function processExprGrp(expr: Parser.expression): Parser.expression {
    switch (expr.type) {
      case 'grouping':
        return expr; // TODO, then it is aboslutely dumb to do this entire thing
      //return processExprGrp(expr.body);
      case 'binary':
        // TODO do i not loose information this way?
        expr.leftSide = processExprGrp(expr.leftSide);
        expr.rightSide = processExprGrp(expr.rightSide);
        return expr;
      case 'unary':
        expr.body = processExprGrp(expr.body);
        return expr;
      case 'call':
        expr.function = processExprGrp(expr.function);
        expr.arguments = expr.arguments.map((e) => {
          e.argument = processExprGrp(e.argument);
          return e;
        });
        return expr;
      case 'func':
        expr.parameters = expr.parameters.map((e) => {
          if (e.argument.hasDefaultValue)
            e.argument.defaultValue = processExprGrp(e.argument.defaultValue);
          if (e.argument.hasExplicitType)
            e.argument.typeExpression = processTypeExprGrp(
              e.argument.typeExpression
            );
          return e;
        });

        if (expr.hasExplicitType)
          expr.typeExpression = processTypeExprGrp(expr.typeExpression);

        expr.body = processExprGrp(expr.body);
        return expr;
      case 'propertyAccess':
        expr.source = processExprGrp(expr.source);
        return expr;
      case 'typeInstatiation':
        expr.source = processExprGrp(expr.source);
        return expr;
      case 'match':
        expr.scrutinee = processExprGrp(expr.scrutinee);

        if (expr.hasExplicitType)
          expr.typeExpression = processTypeExprGrp(expr.typeExpression);

        expr.body = expr.body.map((e) => {
          // dont need to process the pattern itself

          e.argument.body = processExprGrp(e.argument.body);
          return e;
        });
        return expr;
      case 'identifier':
      case 'literal':
        return expr;
    }
  }

  // remove groupings
  function processTypeExprGrp(
    expr: Parser.typeExpression
  ): Parser.typeExpression {
    switch (expr.type) {
      case 'grouping':
        return expr; // TODO
      //return processTypeExprGrp(expr.body);
      case 'func-type':
        expr.returnType = processTypeExprGrp(expr.returnType);
        expr.parameters = expr.parameters.map((e) => {
          e.argument = processTypeExprGrp(e.argument);
          return e;
        });
        return expr;
      case 'identifier':
        return expr;
      case 'primitive-type':
        return expr;
      case 'propertyAccess':
        expr.source = processTypeExprGrp(expr.source);
        if (expr.source.type === 'primitive-type')
          newProcessingError('Cant get the property of a primitive type.');
        else if (expr.source.type === 'func-type')
          newProcessingError('Cant get the property of a function type.');
        // if (expr.source.type === 'grouping')

        return expr;
      case 'genericSubstitution':
        expr.expr = processTypeExprGrp(expr.expr);

        expr.substitutions = expr.substitutions.map((e) => {
          e.argument = processTypeExprGrp(e.argument);
          return e;
        });

        return expr;
    }
  }
  // #endregion

  // #region step 2
  // replace all the identifiers by the global path or remaining local to generics
  function processASTIdent(data: processedAST, filename: string): void {
    const importFilenames: string[] = data.imports.map((imp) => imp[0]);

    // TODO: "std.test => /std/test" because we assume it is there
    // "localFilename.test => /localFilename/test" with the test if it actually is there

    // resolve global identifier of types
    for (const [key, value] of Object.entries(data.typeDict)) {
      if (value.type === 'type-alias') {
        // TODO is own name not also importent?
        data.typeDict[key].body = processTypeExprIdent(
          value.body,
          `/${get_outer_groups(key, 1).join('/')}/`, // scope
          value.isGeneric
            ? value.genericIdentifiers.map((gIdent) => gIdent.argument.lex)
            : [],
          importFilenames,
          filename,
          data.typeDict
        );
      } else if (value.type === 'complex-type') {
        // TODO
        data.typeDict[key].body = value.body.map((e) => {
          e.argument.arguments = e.argument.arguments.map((a) => {
            a.argument = processTypeExprIdent(
              a.argument,
              `/${get_outer_groups(key, 1).join('/')}/`, // scope
              value.isGeneric
                ? value.genericIdentifiers.map((gIdent) => gIdent.argument.lex)
                : [],
              importFilenames,
              filename,
              data.typeDict
            );
            return a;
          });
          return e;
        });
      }
    }

    // resolve global identifiers of lets
    for (const [key, value] of Object.entries(data.letDict)) {
    }
  }

  function processStmtIdent(): void {}

  // resolve identifiers
  function processTypeExprIdent(
    typeExpr: Parser.typeExpression,
    scope: string,
    localIdentifiers: string[],
    importFilenames: string[],
    filename: string,
    typeDict: { [path: string]: Parser.statementTypes }
  ): Parser.typeExpression {
    switch (typeExpr.type) {
      case 'grouping':
        typeExpr.body = processTypeExprIdent(
          typeExpr.body,
          scope,
          localIdentifiers,
          importFilenames,
          filename,
          typeDict
        );
        return typeExpr;
        throw new Error(
          'Internal processor error: should have removed all groupings already'
        );
      case 'func-type':
        typeExpr.returnType = processTypeExprIdent(
          typeExpr.returnType,
          scope,
          localIdentifiers,
          importFilenames,
          filename,
          typeDict
        );

        typeExpr.parameters = typeExpr.parameters.map((param) => {
          param.argument = processTypeExprIdent(
            param.argument,
            scope,
            localIdentifiers,
            importFilenames,
            filename,
            typeDict
          );
          return param;
        });

        return typeExpr;
      case 'primitive-type':
        return typeExpr;
      case 'genericSubstitution':
        typeExpr.expr = processTypeExprIdent(
          typeExpr.expr,
          scope,
          localIdentifiers,
          importFilenames,
          filename,
          typeDict
        );

        typeExpr.substitutions = typeExpr.substitutions.map((subst) => {
          subst.argument = processTypeExprIdent(
            subst.argument,
            scope,
            localIdentifiers,
            importFilenames,
            filename,
            typeDict
          );
          return subst;
        });

        return typeExpr;

      case 'identifier':
        // recursively do the same thing for the substitutions
        if (localIdentifiers.includes(typeExpr.identifier)) return typeExpr;

        // must be of other scope
        for (let i = 0; i < get_outer_groups_len(scope); ++i) {
          // start by not removing the outer groups
          const possiblePath: string =
            `/${get_outer_groups(scope, i).join('/')}/` + typeExpr.identifier;

          if (possiblePath in typeDict) {
            typeExpr.identifier = possiblePath;
            return typeExpr;
          }
        }

        // out of scope or just erroneous

        newProcessingError(
          `cant find the source of the identifier: ${typeExpr.identifier} in scope ${scope}`
        );
        return typeExpr;
      case 'propertyAccess':
        let propertyAccessPath: string = typeExpr.propertyToken.lex;

        // get the given propertyAccessPath
        let tmp: Parser.typeExpression = typeExpr.source;
        let depthCounter: number = 1;
        for (
          ;
          tmp.type === 'propertyAccess' || tmp.type === 'grouping';
          ++depthCounter
        ) {
          if (tmp.type === 'grouping') tmp = tmp.body;
          else if (tmp.type === 'propertyAccess') {
            propertyAccessPath =
              tmp.propertyToken.lex + '/' + propertyAccessPath;
            tmp = tmp.source;
          }
        }
        if (tmp.type === 'identifier') {
          // TODO, what if it is from an import something
          propertyAccessPath = '/' + tmp.identifier + '/' + propertyAccessPath;

          if (importFilenames.includes(tmp.identifier))
            // TODO
            return {
              type: 'identifier',
              identifier: propertyAccessPath,
              identifierToken: typeExpr.propertyToken,
              comments: []
            };
        } else
          throw new Error(
            'Internal processing error: a type property access should only be possible by having the property being a propertyAccess itself or an identifier.'
          );

        // got now the given path by the user in propertyAccessPath

        // TODO really works in the right order?
        for (let i = get_outer_groups_len(scope); i >= 0; --i) {
          // remove the i times the outer scope, to start at the beginning from 0
          const possibleScope: string = get_outer_groups(scope, i).join('/');
          const possiblePath: string =
            possibleScope.length === 0
              ? propertyAccessPath
              : `/${possibleScope}${propertyAccessPath}`;

          if (possiblePath in typeDict) {
            // or to `Object.assign(typeExpr, typeExpr.propertyToken)` and change a couple things
            return {
              type: 'identifier',
              identifier: possiblePath,
              identifierToken: typeExpr.propertyToken,
              comments: []
            };
          }
        }

        newProcessingError(
          `Could not find the following identifier in type propertyAccess: ${propertyAccessPath}`
        );
        return {
          type: 'identifier',
          identifier: 'ERROR#',
          identifierToken: (typeExpr as any).propertyToken,
          comments: []
        };
    }
  }

  function processExprIdent(): void {}
  // #endregion

  // #region helper funcs
  function get_outer_groups_len(dict_key: string): number {
    return dict_key.split('/').filter((e) => e !== '').length;
  }

  function get_outer_groups(
    dict_key: string,
    removeLastNElements: number = 0
  ): string[] {
    const ans: string[] = dict_key.split('/').filter((e) => e !== '');
    ans.splice(ans.length - removeLastNElements, ans.length);
    return ans;
  }
  // #endregion
  // #endregion

  export function processCode(
    code: string,
    filename: string /*should include the filename at the beginning!*/
  ):
    | { valid: true; value: processedAST }
    | {
        valid: false;
        processingErrors: processingError[];
        value?: processedAST;
      } {
    if (!filename.match(/^[a-zA-Z]+$/g))
      throw new Error(
        'Internal processing error: tried to process the code with an invalid filename.'
      );

    processingErrors.splice(0, processingErrors.length); // remove all the old errors
    const path: string = `/${filename}/`; // a path needs "/"

    // TODO der name der datei is valide bei propertyAccess statements damit es auch reibungslos bei anderen Dateien klappt

    // TODO HERE NOW no identifiers in groups, lets and types which are the same as in the imports or as the filename itself

    const parsed = Parser.parse(code, { noComments: true });
    if (!parsed.valid)
      return {
        valid: false,
        processingErrors: [{ type: 'could not parse code' }]
      };

    const ast: Parser.statement[] = parsed.statements;

    // step 1, build the hashmap of important statements and remove all the groupings in these
    const value: processedAST = processASTGrps(ast, path, filename);

    // cant proceed to step 2 when already had errors
    if (processingErrors.length !== 0)
      return { valid: false, processingErrors };

    // step 2, resolve all outer scope identifiers to their respective outer scope
    processASTIdent(value, filename);
    // TODO HERE NOW

    if (processingErrors.length !== 0)
      return { valid: false, processingErrors, value };

    return { valid: true, value };
  }
}

const str = `
//let main = func () => 5;

//let x = 5 + hey; // should error because no hey is in scope
//let f = func (x) => func (x) => x+0; // x is of type i32
//let g = f(4)(5) == 5;

use std;

type l = std.h;

type a = i32;
type b = ((filename).a);
type c[a] = a -> b;

//type y = ((((i32)) -> ((f32)))).test.hey;

type lol[k] {
  a(i32),
  b(b, k, lol)
}

group hey {
  type x = ((((filename))).hey).inner.hasAccess;
  type x2 = hey.inner.hasAccess;
  type x3 = inner.hasAccess;
  // type x4 = hasAccess; // error
  type b = x[((i32)) -> i32];
  // type c = f; // cant find it

  group inner {
    type hasAccess = b[b, i32, x]; // should be /filename/hey/b
  }
}

group other {
  group inner {
    group inner {}
  }
  group val {}
}

group h {
  type f {
    g(i32, i32, i32, i32)
  }
}

let a = h.f->g(34,62,5,73);
`;
const a = ProcessAST.processCode(str, 'filename');

log(a);

namespace Interpreter {
  // TODO:
  // interpreting preprocessing aka. remove all the type annotations, since they are useless for actual execution
  // have a data type wrapper for `i32`, `f32` and complex types and save the structure of complex types
  // (like its discriminator, to know what path to take in match exprs)
  // replace all the identifiers by their value if possible (check for recursive things even between two different idents)
  // replace all the const exprs by their value
  export function interpret(
    code: string,
    input: number,
    filename: string
  ): any {
    const processedAST = ProcessAST.processCode(code, filename);
    if (!processedAST.valid) throw new Error('Invalid code');
    // now process all the imports, and import their imports if needed
    if (!('/' + filename + '/main' in processedAST.value.letDict))
      throw new Error('Must have a main() in the main file.');

    // TODO
    return evalAst(
      processedAST.value.letDict,
      processedAST.value.typeDict,
      input,
      filename
    ) as never;
  }

  type internalVal =
    | { type: 'int'; value: number }
    | { type: 'float'; value: number }
    | {
        type: 'func';
        value: Parser.funcExpression;
        closure: { [localIdent: string]: internalVal };
      }
    | {
        type: 'complexType';
        tyName: string;
        discriminator: number;
        values: internalVal[];
      };

  function evalAst(
    astLet: { [path: string]: Parser.statementLet },
    astType: { [path: string]: Parser.statementTypes },
    startInput: number,
    filename: string
  ): internalVal {
    const main: Parser.statementLet | undefined =
      astLet['/' + filename + '/main'];

    if (
      main === undefined ||
      main.name !== 'main' ||
      main.body.type !== 'func' ||
      main.body.parameters.length !== 1
    )
      throw new Error('TODO no/wrong main func');

    function eval_(
      expr: Parser.expression,
      localData: { [localIdent: string]: internalVal }
    ): internalVal {
      switch (expr.type) {
        case 'unary':
          const d = eval_(expr.body, localData);
          console.log('DAT', expr.operator, d);
          if (expr.operator === '-') {
            console.log('HAHA', -d);
            return -d as never;
          } else return 0 as never;
        case 'binary':
          return 0 as never;
        case 'call':
          // TODO could be identifier with function or a group
          if (!(expr.function.type === 'func')) {
          } else {
            localData = { ...localData };
            for (let i = 0; i < expr.function.parameters.length; ++i) {
              const store: unknown =
                i >= expr.arguments.length
                  ? expr.function.parameters[i].argument.hasDefaultValue
                    ? (expr.function.parameters[i].argument as any).defaultValue
                    : 'err'
                  : expr.arguments[i].argument;

              localData[
                expr.function.parameters[i].argument.identifierToken.lex
              ] = store as never;
            }
            console.log('try to eval', expr.function.body, localData);
            const th = eval_(expr.function.body, localData);
            console.log('LOL', th);
            return th;
          }
          return 'HUH' as never;
        case 'func':
          return 0 as never;
        case 'identifier':
          // TODO
          if (expr.identifier in localData)
            return eval_(localData[expr.identifier] as never, localData);
          // TODO, else goto global scope
          return 0 as never;
        case 'literal':
          // TODO
          return Number(expr.literalToken.lex) as never;
        case 'match':
        case 'propertyAccess':
          return 0 as never;
        case 'typeInstatiation':
          return 0 as never;
        case 'grouping':
          throw new Error(
            'Internal interpreting error: groupings should have been removed already for performance reasons'
          );
      }
    }

    const c = eval_(
      {
        type: 'call',
        function: main.body,
        arguments: [
          {
            argument: {
              type: 'literal',
              literalType: 'i32', // TODO type
              literalToken: {
                ty: Parser.tokenType.literal,
                idx: -1,
                lex: startInput.toString() // TODO type
              },
              comments: []
            },
            delimiterToken: undefined
          }
        ],
        openingBracketToken: undefined as never,
        closingBracketToken: undefined as never,
        comments: []
      },
      {}
    );
    console.log('lastly', c);
    return c;
  }
}

// console.log(
//   Interpreter.interpret(
//     `
// let main = func (x) => - - x;

// group h {
//   type f {
//     g(i32, i32, i32, i32)
//   }
// }

// let a = h.f->g(34,62,5,73);
// `,
//     3,
//     `that`
//   )
// );

// TODO propertyToken on a funcType does not make sense and should error

/*
group test {}
let test = 5; // error because already group with the same name
type test = i32; // error, but not because of let, but because of group
group test {} // error because of type, let and group
*/

/**
 * remove all groups by doing groupName/identifierName
 * remove all comments from the tree by replacing them with "[]"
 * remove all empty or comment statements
 * group all filenames from imports
 * (expr) -> expr since it makes no difference
 * check if vars are accessible in current context and not double
 *
 * check types later
 */

// check if type alias, complex type, groups and lets are not double defined in statements
// then check if no identifier was used, which is not defined somewhere

// THEN do type checking and check if identifier was used with correct scope!

// TODO check if identifiers are used multiple times:
// use a hashmap where we store the amount of times an identifier was used, and if
// we get more than one for a field, we store that index (strs) in a seperate array, and at the end, we report all the indexes in the seperate array

// after building the hashmap with all its values and know each and every value only comes once: check if implicit identifier use happens (also checks local params from funcs for this one!)
