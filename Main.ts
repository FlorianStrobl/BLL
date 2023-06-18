import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';
import { Interpreter } from './LCInterpreter';
import { prettier } from './LCFormatter';

const filename = 'src';
const code = `
let f = func (x, y) -> 3 * x - y % x + 4;
//let g = func (x, y) -> x / y;
`;

const lexemes: Lexer.token[] | undefined = Lexer.lexe(code, filename);
if (lexemes) {
  const ast: Parser.statementT[] | undefined = Parser.parse(
    lexemes,
    code,
    filename
  );

  if (ast) {
    const asm = Compiler.compile(ast, code, filename);
    console.log(asm);
    //Interpreter.interpret(ast);
    //console.log("code: ", prettier.prettier(ast));
  } else {
    console.log('invalid ast');
  }
} else {
  console.log('invalid lexemes');
}
