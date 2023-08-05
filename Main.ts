import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';
import { Interpreter } from './LCInterpreter';
import { prettier } from './LCFormatter';
// @ts-ignore
import { inspect } from 'util';

const filename = 'src';
const code = `
// **
let my_func = func (x) -> - 2 - (x + 3);

//let g = func (x, y) -> x / y;
`;

const lexemes = Lexer.lexe(code);
if (lexemes.valid) {
  const ast: Parser.statementT[] | undefined = Parser.parse(
    lexemes.tokens,
    code,
    filename
  );

  console.log(inspect(ast, { depth: 999 }));

  if (ast) {
    const asm = Compiler.compile(ast, code, filename);
    console.log(asm);
    //Interpreter.interpret(ast);
    //console.log("code: ", prettier.prettier(ast));
  } else {
    console.log('invalid ast');
  }
} else console.log('lexer error:', ...lexemes.errors);

namespace TEST {
  export namespace TEST2 {
    export const X = 5;
  }
}

TEST.TEST2.X;
