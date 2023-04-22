import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';

const file = 'src';
const code = ``;

const lexemes = Lexer.lexe(code, file);
const ast = Parser.parse(lexemes, code, file);
const asm = Compiler.compile(ast, code, file);

console.log(asm);
