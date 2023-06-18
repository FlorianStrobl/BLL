import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';
import { prettier } from './LCFormatter';

const file = 'src';
const code = `
let f = func (x, y) -> 3 * x - y % x + 4;
//let g = func (x, y) -> x / y;
`;

const lexemes: Lexer.token[] | undefined = Lexer.lexe(code, file);
if (lexemes) {
  const ast: Parser.statementT[] | undefined = Parser.parse(
    lexemes,
    code,
    file
  );

  if (ast) {
    //console.log(prettier.prettier(ast));
    const asm = Compiler.compile(ast, code, file);
    console.log(asm);
  } else {
    console.log('invalid ast');
  }
} else {
  console.log('invalid lexemes');
}
