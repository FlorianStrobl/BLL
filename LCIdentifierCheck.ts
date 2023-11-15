import { Parser } from './LCParser';
// @ts-ignore
import { inspect } from 'util';

const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

export namespace ProcessAST {
  // #region constants and types
  const processingErrors: processingError[] = [];

  export type processingError = unknown;

  export interface processedAST {
    imports: [string, Parser.statement][]; // hold a reference to the original AST
    // can be undef because e.g. std does not have a main func
    // e.g. "/main": { main } or "/group1/my_type": { my_type }
    letDict: { [path: string]: Parser.statementLet }; // Map<string, Parser.statement>
    typeDict: { [path: string]: Parser.statementTypes }; // Map<string, Parser.statement>
    namespaceScopes: [string, Parser.statement][];
  }

  type typeExprProcessingInfo = {
    scope: string;
    localIdentifiers: string[];
    importFilenames: string[];
    filename: string;
    typeDict: { [path: string]: Parser.statementTypes };
  };
  // #endregion

  // #region processors
  function newProcessingError(
    processingError: processingError
  ): processingError | never {
    processingErrors.push(processingError);
    return processingError;
  }

  // processExprLevel2 and processTypeExprLevel2:
  // go inside the exprs and replace the identifiers by their respective path

  // use std; let x = std.hey; type t[T] = T;

  // third level: type resolution for lets and type checking for types(?)

  // remove all the groupings and save the important statements into the datastructure
  function buildHashMap(
    ast: Parser.statement[],
    currentScope: string
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
      switch (statement.type) {
        case 'comment':
        case 'empty':
          // skip
          break;
        case 'import':
          processedAST.imports.push([statement.filename.lex, statement]);
          break;
        case 'let':
          const letName: string = currentScope + statement.name;

          if (
            letName in processedAST.letDict ||
            processedAST.namespaceScopes.some(
              ([name, stmt]) => name === letName
            )
          )
            newProcessingError(
              `let identifier ${letName} is already in the in the file`
            );

          processedAST.letDict[letName] = statement;
          break;
        case 'type-alias':
        case 'complex-type':
          const typeName: string = currentScope + statement.name;

          if (
            typeName in processedAST.typeDict ||
            processedAST.namespaceScopes.some(
              ([name, stmt]) => name === typeName
            )
          )
            newProcessingError(`type identifier ${typeName} alreay exists`);

          processedAST.typeDict[typeName] = statement;
          break;
        case 'group':
          const groupName: string = currentScope + statement.name;
          // group name cannot be the filename or name of imported file,
          // this gets handled at a later stage

          if (
            processedAST.namespaceScopes.some(
              ([name, stmt]) => name === groupName
            ) ||
            groupName in processedAST.letDict ||
            groupName in processedAST.typeDict
          )
            newProcessingError(
              `the namespace ${groupName} already exists in this scope in form of another group, let or type statement`
            );
          else processedAST.namespaceScopes.push([groupName, statement]);

          const data: processedAST = buildHashMap(
            statement.body,
            groupName + `/`
          );

          if (data.imports.length !== 0)
            throw new Error(
              'Internal processing error: imports in namespaces are not allowed and should be prohibited by the parser.'
            );

          processedAST.namespaceScopes.push(...data.namespaceScopes);

          for (const [letName, value] of Object.entries(data.letDict))
            if (
              letName in processedAST.letDict ||
              processedAST.namespaceScopes.some(
                ([name, stmt]) => name === letName
              )
            )
              newProcessingError(
                `the let statement "${letName}" already existed in form of another let or group statement`
              );
            else processedAST.letDict[letName] = value;

          for (const [typeName, value] of Object.entries(data.typeDict))
            if (
              typeName in processedAST.typeDict ||
              processedAST.namespaceScopes.some(
                ([name, stmt]) => name === typeName
              )
            )
              newProcessingError(
                `the type statement ${typeName} already exists in another type or group statement`
              );
            else processedAST.typeDict[typeName] = value;

          break;
      }
    }

    return processedAST;
  }

  // TODO remove groupings?
  // replace all the identifiers by the global path or remaining local to generics
  function processASTIdent(data: processedAST, filename: string): void {
    const importFilenames: string[] = data.imports.map(([name, stmt]) => name);

    // TODO: "std.test => /std/test" because we assume it is there
    // "localFilename.test => /localFilename/test" with the test if it actually is there

    // resolve global identifier of types
    for (const [key, value] of Object.entries(data.typeDict)) {
      const infos: typeExprProcessingInfo = {
        scope: `/${get_outer_groups(key, 1).join('/')}/`, // scope
        // not the own name for this one:
        localIdentifiers: value.isGeneric
          ? value.genericIdentifiers.map((gIdent) => gIdent.argument.lex)
          : [],
        importFilenames,
        filename,
        typeDict: data.typeDict
      };
      if (value.type === 'type-alias')
        data.typeDict[key].body = processTypeExprIdent(value.body, infos);
      else if (value.type === 'complex-type') {
        data.typeDict[key].body = value.body.map((e) => {
          e.argument.arguments = e.argument.arguments.map((a) => {
            a.argument = processTypeExprIdent(a.argument, infos);
            return a;
          });
          return e;
        });
      }
    }

    // resolve global identifiers of lets
    for (const [key, value] of Object.entries(data.letDict)) {
      data.letDict[key] = processStmtIdent(
        value,
        `/${get_outer_groups(key, 1).join('/')}/`,
        importFilenames,
        filename,
        data.typeDict,
        data.letDict
      );
    }
  }

  function processStmtIdent(
    stmt: Parser.statementLet,
    scope: string,
    importFilenames: string[],
    filename: string,
    typeDict: {
      [path: string]: Parser.statementTypes;
    },
    letDict: {
      [path: string]: Parser.statementLet;
    }
  ): Parser.statementLet {
    // TODO test this code

    if (stmt.hasExplicitType)
      stmt.typeExpression = processTypeExprIdent(stmt.typeExpression, {
        scope,
        localIdentifiers: stmt.isGeneric
          ? stmt.genericIdentifiers.map((gIdent) => gIdent.argument.lex)
          : [],
        importFilenames,
        filename,
        typeDict
      });

    stmt.body = processExprIdent(stmt.body, {
      scope,
      localTypeIdentifiers: stmt.isGeneric
        ? stmt.genericIdentifiers.map((gIdent) => gIdent.argument.lex)
        : [],
      importFilenames,
      localExprIdentifiers: [],
      filename,
      typeDict,
      letDict
    });

    return stmt;
  }

  // resolve identifiers
  function processTypeExprIdent(
    typeExpr: Parser.typeExpression,
    info: typeExprProcessingInfo
  ): Parser.typeExpression {
    switch (typeExpr.type) {
      case 'primitive-type':
        return typeExpr;
      case 'grouping':
        typeExpr.body = processTypeExprIdent(typeExpr.body, info);
        return typeExpr;
      case 'func-type':
        typeExpr.returnType = processTypeExprIdent(typeExpr.returnType, info);

        typeExpr.parameters = typeExpr.parameters.map((param) => {
          param.argument = processTypeExprIdent(param.argument, info);
          return param;
        });

        return typeExpr;
      case 'genericSubstitution':
        typeExpr.expr = processTypeExprIdent(typeExpr.expr, info);

        typeExpr.substitutions = typeExpr.substitutions.map((subst) => {
          subst.argument = processTypeExprIdent(subst.argument, info);
          return subst;
        });

        return typeExpr;
      case 'identifier':
        // recursively do the same thing for the substitutions
        if (info.localIdentifiers.includes(typeExpr.identifier))
          return typeExpr;

        // must be of other scope
        for (let i = 0; i < get_outer_groups_len(info.scope); ++i) {
          // start by not removing the outer groups
          const possiblePath: string = `/${get_outer_groups(info.scope, i).join(
            '/'
          )}/${typeExpr.identifier}`;
          if (possiblePath in info.typeDict) {
            typeExpr.identifier = possiblePath;
            return typeExpr;
          }
        }

        // out of scope or just erroneous

        newProcessingError(
          `cant find the source of the identifier: ${typeExpr.identifier} in scope ${info.scope}`
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
          propertyAccessPath = '/' + tmp.identifier + '/' + propertyAccessPath;

          // it could be, that this property access, accesses a different file
          // then the deepest identifier must be the other file name, which must be imported at the beginning
          if (info.importFilenames.includes(tmp.identifier))
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
        for (let i = get_outer_groups_len(info.scope); i >= 0; --i) {
          // remove the i times the outer scope, to start at the beginning from 0
          const possibleOuterScope: string = get_outer_groups(
            info.scope,
            i
          ).join('/');
          const possiblePath: string =
            possibleOuterScope.length === 0
              ? propertyAccessPath
              : `/${possibleOuterScope}${propertyAccessPath}`;

          if (possiblePath in info.typeDict) {
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

        return typeExpr;
    }
  }

  // resolve identifiers
  function processExprIdent(
    expr: Parser.expression,
    info: {
      scope: string;
      filename: string;
      localTypeIdentifiers: string[];
      localExprIdentifiers: string[];
      importFilenames: string[];
      typeDict: {
        [path: string]: Parser.statementTypes;
      };
      letDict: {
        [path: string]: Parser.statementLet;
      };
    }
  ): Parser.expression {
    switch (expr.type) {
      case 'literal':
        return expr;
      case 'grouping':
        expr.body = processExprIdent(expr.body, info);
        return expr;
      case 'unary':
        expr.body = processExprIdent(expr.body, info);
        return expr;
      case 'binary':
        expr.leftSide = processExprIdent(expr.leftSide, info);
        expr.rightSide = processExprIdent(expr.rightSide, info);
        return expr;
      case 'call':
        expr.function = processExprIdent(expr.function, info);

        expr.arguments = expr.arguments.map((arg) => {
          arg.argument = processExprIdent(arg.argument, info);
          return arg;
        });

        return expr;
      case 'func':
        if (expr.hasExplicitType)
          expr.typeExpression = processTypeExprIdent(expr.typeExpression, {
            scope: info.scope,
            localIdentifiers: info.localTypeIdentifiers,
            importFilenames: info.importFilenames,
            filename: info.filename,
            typeDict: info.typeDict
          });

        expr.parameters = expr.parameters.map((param) => {
          if (param.argument.hasDefaultValue)
            param.argument.defaultValue = processExprIdent(
              param.argument.defaultValue,
              info
            );

          if (param.argument.hasExplicitType)
            param.argument.typeExpression = processTypeExprIdent(
              param.argument.typeExpression,
              {
                scope: info.scope,
                localIdentifiers: info.localTypeIdentifiers,
                importFilenames: info.importFilenames,
                filename: info.filename,
                typeDict: info.typeDict
              }
            );
          return param;
        });

        const newLocalIdentifiers: string[] = expr.parameters.map(
          (param) => param.argument.identifierToken.lex
        );

        // TODO test this out
        // merge the local identifiers for this case
        if (newLocalIdentifiers.length !== 0)
          info.localExprIdentifiers = [
            ...newLocalIdentifiers,
            ...info.localExprIdentifiers
          ];

        expr.body = processExprIdent(expr.body, info);

        return expr;
      case 'match':
        expr.scrutinee = processExprIdent(expr.scrutinee, info);

        if (expr.hasExplicitType)
          expr.typeExpression = processTypeExprIdent(expr.typeExpression, {
            scope: info.scope,
            localIdentifiers: info.localTypeIdentifiers,
            importFilenames: info.importFilenames,
            filename: info.filename,
            typeDict: info.typeDict
          });

        expr.body = expr.body.map((matchLine) => {
          const newLocalIdentifiers: string[] = !matchLine.argument.isDefaultVal
            ? matchLine.argument.parameters.map((param) => param.argument.lex)
            : [];

          // merge local identifiers
          if (newLocalIdentifiers.length !== 0)
            info.localExprIdentifiers = [
              ...newLocalIdentifiers,
              ...info.localExprIdentifiers
            ];

          matchLine.argument.body = processExprIdent(
            matchLine.argument.body,
            info
          );

          return matchLine;
        });

        return expr;
      case 'typeInstantiation':
        expr.source = processExprIdent(expr.source, info);

        if (
          expr.source.type !== 'identifier' ||
          !(expr.source.identifier in info.typeDict) ||
          info.typeDict[expr.source.identifier].type !== 'complex-type'
        )
          newProcessingError(
            'type instantiation must be done with a property of type complex-type'
          );

        return expr;
      case 'identifier':
        if (info.localExprIdentifiers.includes(expr.identifier)) return expr;

        // not a local identifier

        // TODO info.scope really the actual thing!??
        for (let i = 0; i < get_outer_groups_len(info.scope); ++i) {
          const possiblePath: string = `/${get_outer_groups(info.scope, i).join(
            '/'
          )}/${expr.identifier}`;

          // could be for a type instatiation, and thus be typeDict
          if (possiblePath in info.letDict || possiblePath in info.typeDict) {
            expr.identifier = possiblePath;
            return expr;
          }
        }

        newProcessingError(
          `could not find the current identifier ${expr.identifier} in the scope of this expression`
        );

        return expr;
      case 'propertyAccess':
        let propertyAccessPath: string = expr.propertyToken.lex;

        // get the given propertyAccessPath
        let tmp: Parser.expression = expr.source;
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
          propertyAccessPath = '/' + tmp.identifier + '/' + propertyAccessPath;

          // it could be, that this property access, accesses a different file
          // then the deepest identifier must be the other file name, which must be imported at the beginning
          if (info.importFilenames.includes(tmp.identifier))
            // TODO
            return {
              type: 'identifier',
              identifier: propertyAccessPath,
              identifierToken: expr.propertyToken,
              comments: []
            };
        } else
          throw new Error(
            'Internal processing error: an expr property access should only be possible by having the property being a propertyAccess itself or an identifier.'
          );

        // got now the given path by the user in propertyAccessPath

        // TODO really works in the right order?
        for (let i = get_outer_groups_len(info.scope); i >= 0; --i) {
          // remove the i times the outer scope, to start at the beginning from 0
          const possibleOuterScope: string = get_outer_groups(
            info.scope,
            i
          ).join('/');
          const possiblePath: string =
            possibleOuterScope.length === 0
              ? propertyAccessPath
              : `/${possibleOuterScope}${propertyAccessPath}`;

          // could be for a type instatiation, and thus be typeDict
          if (possiblePath in info.letDict || possiblePath in info.typeDict)
            return {
              type: 'identifier',
              identifier: possiblePath,
              identifierToken: expr.propertyToken,
              comments: []
            };
        }

        newProcessingError(
          `Could not find the following identifier in expr propertyAccess: ${propertyAccessPath}`
        );

        return expr;
    }
  }

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
    if (!filename.match(/^[a-zA-Z0-9_]+$/g))
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
        processingErrors: [
          { type: 'could not parse code', parserErrors: parsed.parseErrors }
        ]
      };

    const ast: Parser.statement[] = parsed.statements;

    // step 1, build the hashmap of important statements
    const value: processedAST = buildHashMap(ast, path);

    // check if some namespace has the same name as the filename or the imports
    for (const [name, stmt] of value.namespaceScopes)
      if (name === filename || value.imports.some(([n, s]) => n === name))
        newProcessingError(
          `a group cannot be named as the filename or one of its imports: ${name}`
        );

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
/*
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

let xo[T] = T->hey(5);

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
`;*/
const str = `
group ns {
  type BinTree[T] {
    empty,
    full(BinTree[T], T, BinTree[T])
  }

  let const = 3;
}

group inners {
let test: ns.BinTree[i32] = func (x: ns.BinTree = ns.BinTree->empty) => x | multSwap + ns.const + y;
}

// 0
type Never { }
// 1
type Unit { u }
// 2
type Bool { true, false }

// *
type Tuple[A, B] { tup(A, B) }
// +
type Or[A, B] { either(A), or(B) }

type add[A, B] = Or[A, B];
type mult[A, B] = Tuple[A, B];

// commutativity of mult
let multSwap[A, B] = func (x: mult[A, B]): mult[B, A] =>
  match (x) {
    tup(a, b) => Tuple->tup(b, a)
  };
// associativity of mult 1
let multReorder1[A, B, C] = func (x: mult[A, mult[B, C]]): mult[mult[A, B], C] =>
  match (x) {
    tup(a, y) => match (y) {
      tup(b, c) => Tuple->tup(Tuple->tup(a, b), c)
    }
  };
// associativity of mult 2
let multReorder2[A, B, C] = func (x: mult[mult[A, B], C]): mult[A, mult[B, C]] =>
  match (x) {
    tup(y, c) => match (y) {
      tup(a, b) => Tuple->tup(a, Tuple->tup(b, c))
    }
  };
// identity of mult
let multIdentity[A] = func (x: mult[A, Unit]): A =>
  match (x) {
    tup(a, unit) => a
  };
// absorbtion of mult
let multAbsorb[A] = func (x: mult[A, Never]): Never => match (x) { => x /*TODO, empty match is ok for "Never" types*/ };

// identity of add
let addIdentity[A] = func (x: add[A, Never]): A =>
  match (x) {
    either(a) => a,
    or(b) => b // TODO is a "Never" type, so it is assignable to A
  };

let distributivity1[A, B, C] = func (x: mult[A, add[B, C]]): add[mult[A, B], mult[A, C]] =>
  match (x) {
    tup(a, y) => match (y) {
      either(b) => Or->either(Tuple->tup(a, b)),
      or(c) => Or->or(Tuple->tup(a, c))
    }
  };`;
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
        case 'typeInstantiation':
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
