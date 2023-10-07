const { Lexer } = require('./LCLexer.js');
const { Parser } = require('./LCParser.js');
// import { Lexer } from "./LCLexer.mjs";
// const { Parser } = require('./LCParser.js');

const validChars = [
  ' ',
  '\t',
  '\n',
  '\r',
  '_',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  //"'",
  //'"',
  //'`',
  ...'+-*/%&|^~=!><;:,.(){}[]'.split('')
];
// file "FuzzTarget.js"

// tsc .\LCParser.ts --downlevelIteration --allowJs
// npx jazzer FuzzTarget corpus --timeout=5 --sync
module.exports.fuzz = function (data /*: Buffer */) {
  const fuzzerData = data.toString();

  //const lexed = Lexer.lexe(fuzzerData);
  //if (lexed.valid && lexed.tokens.length > 0) {
    const parsed = Parser.parse(fuzzerData);
 // }
};
