import { Parser } from './LCParser';

export namespace ProcessAST {
  // #region constants and types
  const processingErrors: processingError[] = [];

  export type processingError = unknown;

  export interface processedAST {
    imports: [string, Parser.statement][]; // hold a reference to the original AST
    // e.g. "/main": { main } or "/group1/my_type": { my_type }
    letDict: { [path: string]: Parser.letStatement }; // Map<string, Parser.statement>
    typeDict: { [path: string]: Parser.typeStatement }; // Map<string, Parser.statement>
    namespaceScopes: [string, Parser.statement][];
  }

  type typeExprProcessingInfo = {
    scope: string;
    localIdentifiers: string[];
    importFilenames: string[];
    filename: string;
    typeDict: { [path: string]: Parser.typeStatement };
  };
  // #endregion

  // #region processors
  function newProcessingError(
    processingError: processingError
  ): processingError & never {
    processingErrors.push(processingError);
    return processingError as never;
  }

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
          processedAST.imports.push([statement.filename.l, statement]);
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
              `The let-identifier ${letName} is already defined in this scope.`
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
            newProcessingError(
              `The type-identifier ${typeName} is already defined in this scope.`
            );

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
              `The namespace ${groupName} already exists in this scope in the form of another group, a let- or a type-statement.`
            );
          else processedAST.namespaceScopes.push([groupName, statement]);

          const data: processedAST = buildHashMap(
            statement.body,
            groupName + `/`
          );

          if (data.imports.length !== 0)
            throw new Error(
              'Internal processing error: imports in namespaces are not allowed and should have been prohibited by the parser already.'
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
                `The let-statement "${letName}" already existed in form of another let- or group-statement.`
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
                `The type statement ${typeName} already exists in another type- or group-statement`
              );
            else processedAST.typeDict[typeName] = value;

          break;
      }
    }

    return processedAST;
  }

  // replace all the identifiers by the global path
  // or remains unchanged because it is local to generics
  function resolveIdentifiers(data: processedAST, filename: string): void {
    const importFilenames: string[] = data.imports.map(([name, stmt]) => name);

    // if "use std;" then "std.test => /std/test"
    // because we assume "test" exists in "std" is there
    // while "thisFilename.test => /thisFilename/test" with the test if it actually is there

    // resolve global identifier of types
    for (const [key, value] of Object.entries(data.typeDict)) {
      const infos: typeExprProcessingInfo = {
        scope: `/${get_outer_groups(key, 1).join('/')}/`, // scope
        // not the own name for this one:
        localIdentifiers: value.isGeneric
          ? value.genericIdentifiers.map((gIdent) => gIdent.argument.l)
          : [],
        importFilenames,
        filename,
        typeDict: data.typeDict
      };

      if (value.type === 'type-alias')
        data.typeDict[key].body = processTypeExprIdent(value.body, infos);
      else if (value.type === 'complex-type') {
        // resolve type annotations correctly aswell
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
    stmt: Parser.letStatement,
    scope: string,
    importFilenames: string[],
    filename: string,
    typeDict: {
      [path: string]: Parser.typeStatement;
    },
    letDict: {
      [path: string]: Parser.letStatement;
    }
  ): Parser.letStatement {
    // TODO test this code

    if (stmt.hasExplicitType)
      stmt.typeExpression = processTypeExprIdent(stmt.typeExpression, {
        scope,
        localIdentifiers: stmt.isGeneric
          ? stmt.genericIdentifiers.map((gIdent) => gIdent.argument.l)
          : [],
        importFilenames,
        filename,
        typeDict
      });

    stmt.body = processExprIdent(stmt.body, {
      scope,
      localTypeIdentifiers: stmt.isGeneric
        ? stmt.genericIdentifiers.map((gIdent) => gIdent.argument.l)
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
        let propertyAccessPath: string = typeExpr.propertyToken.l;

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
            propertyAccessPath = tmp.propertyToken.l + '/' + propertyAccessPath;
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
          `Could not find the following identifier in type propertyAccess: "${propertyAccessPath}"`
        );

        return typeExpr;
    }
  }

  // resolve identifiers of expressions
  function processExprIdent(
    expr: Parser.expression,
    info: {
      scope: string;
      filename: string;
      localTypeIdentifiers: string[];
      localExprIdentifiers: string[];
      importFilenames: string[];
      typeDict: {
        [path: string]: Parser.typeStatement;
      };
      letDict: {
        [path: string]: Parser.letStatement;
      };
    }
  ): Parser.expression {
    switch (expr.type) {
      case 'literal':
        return expr;
      case 'grouping':
        expr.body = processExprIdent(expr.body, info);
        return expr.body; // remove groups for efficiency
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
          (param) => param.argument.identifierToken.l
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
          const newLocalIdentifiers: string[] =
            matchLine.argument.isDefaultVal === false
              ? matchLine.argument.parameters.map((param) => param.argument.l)
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
          `could not find the current identifier "${expr.identifier}" in the scope of this expression`
        );

        return expr;
      case 'propertyAccess':
        let propertyAccessPath: string = expr.propertyToken.l;

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
            propertyAccessPath = tmp.propertyToken.l + '/' + propertyAccessPath;
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
          `Could not find the following identifier in expr propertyAccess: "${propertyAccessPath}"`
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
    if (!filename.match(/^[a-zA-Z_][a-zA-Z0-9_]+$/g))
      throw new Error(
        'Internal processing error: tried to process the code with an invalid filename.'
      );

    processingErrors.splice(0, processingErrors.length); // remove all the old errors
    const path: string = `/${filename}/`; // a path needs "/"

    const parsed = Parser.parse(code, {
      ignoreComments: true /*not needed for execution*/
    });
    if (parsed.valid === false)
      return {
        valid: false,
        processingErrors: [
          {
            type: 'Was not able to parse the code.',
            parserErrors: parsed.parseErrors
          }
        ]
      };

    const ast: Parser.statement[] = parsed.statements;

    // step 1, build the hashmap of important statements
    const value: processedAST = buildHashMap(ast, path);

    // check if some namespace has the same name as the filename or the imports
    for (const [name, stmt] of value.namespaceScopes)
      if (name === filename || value.imports.some(([n, s]) => n === name))
        newProcessingError(
          `The name of a group cannot be the same as the filename "${name}" or the name of one of the imports '${JSON.stringify(
            value.imports.map(([n, s]) => n)
          )}'.`
        );

    // Can't proceed to step 2 if already had errors
    if (processingErrors.length !== 0)
      return { valid: false, processingErrors };

    // step 2, resolve all outer scope identifiers to their respective outer scope
    resolveIdentifiers(value, filename);

    if (processingErrors.length !== 0)
      return { valid: false, processingErrors, value };

    return { valid: true, value };
  }
}
