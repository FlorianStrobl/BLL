import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';
import { Interpreter } from './LCInterpreter';
import { prettier } from './LCFormatter';

const filename = 'src';
const code = `
// **
let my_func =
func (x, y) ->
  x + x - x * x / x % x
  & x | x ^ x << x >> x
  == 1 != 2 < 3 > 4 <= 5 >= 6;

//let g = func (x, y) -> x / y;
`;

const lexemes = Lexer.lexe(code);
if (lexemes.valid) {
  const ast: Parser.statementT[] | undefined = Parser.parse(
    lexemes.tokens,
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
} else console.log('lexer error:', ...lexemes.errors);
