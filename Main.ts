import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';
import { prettier } from './LCFormatter';

const file = 'src';
const code = `
let f = func (x, y) -> 3 * x - y % x + 4;
//let g = func (x, y) -> x / y;
`;

const lexemes = Lexer.lexe(code, file);
const ast = Parser.parse(lexemes, code, file);
const asm = Compiler.compile(ast, code, file);
console.log(asm);
//console.log(prettier.prettier(ast));
