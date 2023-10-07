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

// npx jazzer FuzzTarget corpus
module.exports.fuzz = function (data /*: Buffer */) {
  const fuzzerData = data.toString();

  if (Lexer.lexe(fuzzerData).valid) {
    const parsed = Parser.parse(fuzzerData);
    console.log(`valid: ${parsed.valid}`);
  }

  // for (const char of fuzzerData) if (!validChars.includes(char)) return;

  // if (Lexer.lexe(fuzzerData).valid === true) {
  //   console.log(`TEST THIS CODE "${fuzzerData}"
  //   because "${JSON.stringify(Lexer.lexe(fuzzerData))}" or "${JSON.stringify(
  //     Lexer.lexeNextTokenIter(fuzzerData).next()
  //   )}"`);

  //   // Parser.parse(fuzzerData);
  // }
};
