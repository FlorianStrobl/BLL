import { delimiter } from 'path';
import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
// @ts-ignore
import { inspect } from 'util';

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

const log = (args: any) =>
  console.log(inspect(args, { depth: 999, colors: true }));

// TODO
type parserValue = { statement: Parser.statement; path: Lexer.token[] };
type astAsStatements = {
  imports: Parser.statement[]; // TODO no path allowed!

  mainFunc: Parser.funcExpression;

  typeAliases: parserValue[];
  genericTypeAliases: parserValue[];

  complexTypes: parserValue[];
  genericComplexTypes: parserValue[];

  lets: parserValue[];
  genericLets: parserValue[];

  groups: parserValue[];
};

export interface processedAST {
  imports: [string, Parser.statement][]; // hold a reference to the original AST
  // can be undef because e.g. std does not have a main func
  mainFunc: undefined | Parser.statement;
  // e.g. "l/main": { main } or "t/group1/my_type": { my_type }
  letDict: { [path: string]: Parser.statementLet }; // Map<string, Parser.statement>
  typeDict: { [path: string]: Parser.statementTypes }; // Map<string, Parser.statement>
}

// #region processors
function processTypeExpr(expr: Parser.typeExpression): Parser.typeExpression {
  switch (expr.type) {
    case 'grouping':
      return processTypeExpr(expr.body);
    case 'func-type':
      expr.returnType = processTypeExpr(expr.returnType);
      expr.parameters = expr.parameters.map((e) => {
        e.argument = processTypeExpr(e.argument);
        return e;
      });
      return expr;
    case 'identifier':
    case 'primitive-type':
      return expr;
  }
}

function processExpr(expr: Parser.expression): Parser.expression {
  switch (expr.type) {
    case 'grouping':
      return processExpr(expr.body);
    case 'binary':
      // TODO do i not loose information this way?
      expr.leftSide = processExpr(expr.leftSide);
      expr.rightSide = processExpr(expr.rightSide);
      return expr;
    case 'unary':
      expr.body = processExpr(expr.body);
      return expr;
    case 'call':
      expr.function = processExpr(expr.function);
      expr.arguments = expr.arguments.map((e) => {
        e.argument = processExpr(e.argument);
        return e;
      });
      return expr;
    case 'func':
      // TODO process the types
      expr.parameters = expr.parameters.map((e) => {
        if (e.argument.defaultValue.hasDefaultValue)
          e.argument.defaultValue.value = processExpr(
            e.argument.defaultValue.value
          );
        if (e.argument.typeAnnotation.explicitType)
          e.argument.typeAnnotation.typeExpression = processTypeExpr(
            e.argument.typeAnnotation.typeExpression
          );
        return e;
      });
      expr.body = processExpr(expr.body);
      return expr;
    case 'propertyAccess':
      expr.source = processExpr(expr.source);
      return expr;
    case 'match':
      expr.scrutinee = processExpr(expr.scrutinee);
      expr.body = expr.body.map((e) => {
        e.argument.body = processExpr(e.argument.body);
        return e;
      });
      return expr;
    case 'identifier':
    case 'literal':
      return expr;
  }
}

function processStmt(stmt: Parser.statement): Parser.statement {
  switch (stmt.type) {
    case 'import':
    case 'empty':
    case 'comment':
      return stmt;
    case 'let':
      if (stmt.explicitType)
        stmt.typeExpression = processTypeExpr(stmt.typeExpression);
      stmt.body = processExpr(stmt.body);
      return stmt;
    case 'type-alias':
      stmt.body = processTypeExpr(stmt.body);
      return stmt;
    case 'complex-type':
      stmt.body = stmt.body.map((e) => {
        if (!e.argument.parameters.hasParameterList) return e;
        e.argument.parameters.value = e.argument.parameters.value.map((ee) => ({
          argument: processTypeExpr(ee.argument),
          delimiterToken: ee.delimiterToken
        }));
        return e;
      });
      return stmt;
    case 'group':
      for (let i = 0; i < stmt.body.length; ++i)
        stmt.body[i] = processStmt(stmt.body[i]);
      return stmt;
  }
}

// processExprLevel2 and processTypeExprLevel2:
// go inside the exprs and replace the identifiers by their respective path
// what about:
// let x = std.hey;
// type t[T] = T;

// third level: type resolution for lets and type checking for types(?)

function processAST(
  ast: Parser.statement[],
  currentPath: string
): processedAST {
  const processedAST: processedAST = {
    imports: [],
    mainFunc: undefined,
    letDict: {},
    typeDict: {}
  };

  for (let statement of ast) {
    statement = processStmt(statement);
    switch (statement.type) {
      case 'comment':
      case 'empty':
        // skip
        break;
      case 'import':
        processedAST.imports.push([statement.filename.lex, statement]);
        break;
      case 'group':
        const data = processAST(
          statement.body,
          currentPath + statement.name + '/'
        );
        // just ignore possible data.mainFunc's
        if (data.imports.length !== 0)
          throw new Error(
            'Internal processing error: imports in namespaces are not allowed and should be prohibited by the parser.'
          );

        for (const [key, value] of Object.entries(data.letDict))
          if (key in processedAST.letDict)
            throw new Error('TODO what the fuck how.');
          else processedAST.letDict[key] = value;

        for (const [key, value] of Object.entries(data.typeDict))
          if (key in processedAST.typeDict)
            throw new Error('TODO what the fuck how.');
          else processedAST.typeDict[key] = value;

        break;
      case 'let':
        if (currentPath + statement.name in processedAST.letDict)
          throw new Error('Identifier already exists');

        processedAST.letDict[currentPath + statement.name] = statement;

        // do not need to check, if already a mainFunc exists in processedAST, since it would have errored above already
        if (statement.type === 'let' && statement.name === 'main')
          processedAST.mainFunc = statement;
        break;
      case 'type-alias':
      case 'complex-type':
        if (currentPath + statement.name in processedAST.letDict)
          throw new Error('Identifier already exists');

        processedAST.typeDict[currentPath + statement.name] = statement;
        break;
    }
  }

  return processedAST;
}

function get_outer_groups(dict_key: string): string[] {
  return dict_key.split('/').slice(1, -1);
}
// #endregion

export function processCode(
  code: string,
  currentPath: string = '/' /*should include the filename at the beginning!*/
): { valid: true; value: processedAST } | { valid: false } {
  const parsed = Parser.parse(code, { noComments: true });
  if (!parsed.valid) return { valid: false };

  const ast: Parser.statement[] = parsed.statements;
  const value = processAST(ast, currentPath);

  return { valid: true, value };
}

const str = `
// hey!
/*mhm*/
use std;
use hey;

let main = 5;

group test {
  group inner {
    let main = other;
  }

  let main = 4;
  //use hey;
  type whut = /*above comment*/ (((i32))) -> ((f23));
  type lal {
    way1,
    // per branch comment
    way2(),
    way3((i32), f32)
  }
  let test[hey]: i32 -> hey = func /*first*/ (x: i32 = 5): i32 => /*above comment*/ /*and second*/ -x /*and third*/ + 1 / inf != nan;

  //let x = match (x) { /*test comment*/ };
  //let x = match (x): i32 { };
  let x = match (x) { => 4, };
  //let x = match (x) { a => 4, };
  //let x = match (x) { a(h,l,m) => 4, };
  //let x = match (x) { a(h,l,m) => 4, /*per branch comment*/ b => 5 };
  //let x = match (x) { a(h,l,m) => 4, => 5 };
}`;
const a = processCode(str);

log(a);

// check if type alias, complex type, groups and lets are not double defined in statements
// then check if no identifier was used, which is not defined somewhere

// THEN do type checking and check if identifier was used with correct scope!

// TODO check if identifiers are used multiple times:
// use a hashmap where we store the amount of times an identifier was used, and if
// we get more than one for a field, we store that index (strs) in a seperate array, and at the end, we report all the indexes in the seperate array

// after building the hashmap with all its values and know each and every value only comes once: check if implicit identifier use happens (also checks local params from funcs for this one!)

function test(ast: Parser.statement[]): astAsStatements {
  const answer: astAsStatements = {
    imports: [],

    mainFunc: undefined as any,

    typeAliases: [],
    genericTypeAliases: [],

    complexTypes: [],
    genericComplexTypes: [],

    lets: [],
    genericLets: [],

    groups: []
  };

  resolveInnerPart(ast);

  return answer;

  function resolveInnerPart(
    ast: Parser.statement[],
    path: Lexer.token[] = []
  ): void {
    path = [...path];

    for (const statement of ast) {
      switch (statement.type) {
        case 'let':
          // TODO main func
          // TODO generic lets
          answer.lets.push({
            statement,
            path
          });
          break;
        case 'type-alias':
          // TODO generic type alias
          answer.typeAliases.push({ statement, path });
          break;
        case 'complex-type':
          // TODO generic type alias
          answer.complexTypes.push({ statement, path });
          break;

        case 'group':
          path.push(statement.identifierToken);
          resolveInnerPart(statement.body, path);
          path.pop();

          statement.body = undefined as any; // to save valuable ram space
          answer.groups.push({ statement, path });
          break;

        case 'import':
          if (path.length !== 0)
            console.error('TODO use statement must be at global scope!');

          answer.imports.push(statement);
          break;

        case 'comment':
        case 'empty':
        default:
          break;
      }
    }
  }
}

function debug(code: string): void {
  const astData = Parser.parse(code);
  if (astData.valid) log(test(astData.statements));
  else console.error(astData.parseErrors, astData.statements);
}

const testCode: string = `
use std;

let main = func (arg) => arg;

let f = 5;

type ty = i32;

type cty {
  name1,
  name2(ty)
}

group G {
  let f2 = 6;
}

group H {
  let f2 = 4;
}
`;
//debug(testCode);
