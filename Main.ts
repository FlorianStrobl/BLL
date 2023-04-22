import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Compiler } from './LCCompiler';

const file = 'src';
const code = ``;

const lexemes = Lexer.lexe(code, file);
let ast = Parser.parse(lexemes, code, file);
console.log(ast);
ast = {
  returnType: 'i32',
  identifier: 'f',
  params: {
    args: [
      { value: 'x', type: 'i32' },
      { value: 'y', type: 'i32' }
    ]
  },
  body: {
    type: { value: '-', type: '#operator', idx: 470 },
    left: {
      type: { value: '+', type: '#operator', idx: 462 },
      left: { type: { value: 'x', type: '#identifier', idx: 460 } },
      right: {
        type: { value: '*', type: '#operator', idx: 466 },
        left: { type: { value: 'y', type: '#identifier', idx: 464 } },
        right: { type: { value: 'x', type: '#identifier', idx: 468 } }
      }
    },
    right: {
      type: '()',
      value: {
        type: { value: '/', type: '#operator', idx: 475 },
        left: { type: { value: 'x', type: '#identifier', idx: 473 } },
        right: { type: { value: 'x', type: '#identifier', idx: 477 } }
      }
    }
  }
} as any;
const asm = Compiler.compile(ast, code, file);

console.log(asm);
