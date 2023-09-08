import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
// @ts-ignore
import { inspect } from 'util';

const log = (args: any) => console.log(inspect(args, { depth: 999 }));

// TODO
type astAsStatements = {
  imports: Parser.statement[]; // TODO no path allowed!

  mainFunc: Parser.funcExpression;

  typeAliases: { statement: Parser.statement; path: Lexer.token[] }[];
  genericTypeAliases: { statement: Parser.statement; path: Lexer.token[] }[];

  complexTypes: { statement: Parser.statement; path: Lexer.token[] }[];
  genericComplexTypes: { statement: Parser.statement; path: Lexer.token[] }[];

  lets: {
    statement: Parser.statement;
    path: Lexer.token[] /*TODO path for the groups*/;
  }[];
  genericLets: { statement: Parser.statement; path: Lexer.token[] }[];

  // TODO for better error messages in hindsight and to check if doubles are there
  groups: {
    statement: Parser.statement;
    path: Lexer.token[];
  }[];
};

// TODO check if identifiers are used multiple times:
// use a hashmap where we store the amount of times an identifier was used, and if
// we get more than one for a field, we store that index (strs) in a seperate array, and at the end, we report all the indexes in the seperate array

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
`;
debug(testCode);
