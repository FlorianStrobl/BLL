import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';
import { prettier } from './LCFormatter';

const file = 'src';
const code = `pub let f = func (x, y) -> /*test*/ x + y * x - (x / x);`;

const lexemes = Lexer.lexe(code, file);
let ast = Parser.parse(lexemes, code, file);
//console.log(prettier.prettier(ast));
const asm = Compiler.compile(ast, code, file);

console.log(asm);
