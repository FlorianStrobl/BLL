import { printMessage, ErrorID } from './FErrorMsgs';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar

// #region constants
const testCodes: string[] = [
  `
let num: i32 /* signed */ = + 5.5e-1; // an integer
/**/`
];

const mustLexe: string[] = [
  `;
/**//**/
/**/5
/**/let
/**/test
/**/+

5/**/
// 5"hey"
// 5let
// 5test
5+

let/**/
// let"hey"
letlet
lettest
// let+

test/**/
// test"hey"
testlet
testtest
test+

+/**/
+5
// +let, lexer error!
+test
+*

5 5.1e2 // TODO: 51.e-3
01_23_45_67_89
0123456789 0b1010 0x0123456789ABCDEFabcdef 0o01234567

/* You can /* nest comments *e/ by escaping slashes */

- > * -> * - >* ->*

_

~ & | ^ + - * / % = ( ) [ ] { } < > : ; . , !

! * ** *** + - % / < > = == != <= >= << >> ~ & | ^ : ; . , -> () [] {} //

********

~~5

;`
];

const mustNotLexe: string[] = [
  `
\\ \` ' " ? @ # $

5. 5e1. 5e1.2 5.1e 5.e 5e. 5e
0__3
0b 0x 0o 0b12A3 0xP 0o99A 09A4

5let
5test

"string"
/regexp/

*/

/*`
];

const keywords: string[] = [
  'import', // imports all public identifiers from other files

  'let', // binds a lambda term to an identifier
  'type', // binds a type to an identifier
  'namespace', // identifier as wrapper around identifiers
  'pub', // make an identifier public to the outside (files or namespaces)

  'func', // introduces a function

  // f32 literals:
  'nan',
  'infinity',

  // types:
  'i32', // 32 bit integer
  'f32', //single precision 32 bit float after the IEEE754-2008 standard
  'undetermined' // cannot be determined at compile time but must be done at compile time
].sort();

const symbols: string[] = [
  // only for same primitive types
  '+', // add
  '-', // sub
  '*', // multiplication
  '/', // divide (for integers: rounding down)
  '**', // exponentiation
  '***', // root
  '%', // remainder

  // only ints
  '&', // and
  '|', // or
  '^', // xor
  '~', // not
  '!', // logical not TODO (0 -> 1, any -> 0)
  '<<', // left shift
  '>>', // right shift

  // compare only same primitive types
  '==', // equal
  '!=', // not equal
  '<=', // less than or equal
  '>=', // greater than or equal
  '<', // less than
  '>', // greater than

  '=', // assigments of values to identifiers (let and type)
  '->', // functions
  ':', // type annotation
  ';', // end of let or type statement/empty statement
  ',', // seperator for arguments
  '.', // accessing public functions from namespaces

  '(', // grouping, function calls, function arguments/parameters
  ')',
  '{', // namespaces
  '}',
  '[', // generic type annotations
  ']'
]
  .sort(/*sort for length*/ (a, b) => b.length - a.length)
  .filter(/*remove doubles*/ (e, i, a) => !a.slice(0, i).includes(e));
// #endregion

export namespace Lexer {
  // #region types
  // https://stackoverflow.com/questions/14954721/what-is-the-difference-between-a-token-and-a-lexeme BLL
  export interface token {
    lexeme: string;
    type: lexemeType;
    idx: number;
  }

  export enum lexemeType {
    comment = '#comment', // "//...", "/*...*/"
    literal = '#literal', // 5.3e-4
    keyword = '#keyword', // let
    identifier = '#identifier', // identifier
    symbol = '#symbol' // +
  }

  // TODO
  type errorToken =
    | { codeInvalid: false; type: 'eof' /*reached end of file*/ }
    | {
        codeInvalid: true;
        type: 'missing space' /* "5let" is not allowed aka: literal followed by an identifier/keyword/literal or keyword followed by operator?? or identifier followed by literal */;
      }
    | { codeInvalid: true; type: 'invalid char'; chars: string }
    | { codeInvalid: true; type: 'eof in /* comment' };

  type nextToken =
    | {
        valid: true;
        value: token;
        newidx: number;
      }
    | {
        valid: false;
        value: errorToken;
        newidx: number;
      };
  // #endregion

  function matches(character: string, regexp: RegExp): boolean {
    return character[0].match(regexp) !== null;
  }

  function idxValid(idx: number, obj: { length: number }) {
    return idx < obj.length;
  }

  // #region consume functions
  // assert: an identifier is at idx
  function consumeIdentifier(code: string, idx: number): nextToken {
    let i: number = idx;
    let identifier: string = '';

    const alphaNumeric = /[_a-zA-Z0-9]/;
    while (idxValid(i, code) && matches(code[i], alphaNumeric))
      identifier += code[i++];

    // TODO check if it is followed by something else than just whitespace, because that would be invalid

    return {
      valid: true,
      value: {
        lexeme: identifier,
        type: keywords.includes(identifier)
          ? lexemeType.keyword
          : lexemeType.identifier,
        idx
      },
      newidx: i
    };
  }

  // assert: a comment is at idx
  function consumeComment(code: string, idx: number): nextToken {
    let i: number = idx + 1; /*assertion: index is valid*/
    let comment: string = code[idx];

    if (code[i] === '/') {
      // comment type 1: "//"
      while (idxValid(i, code) && code[i] !== '\n') comment += code[i++];
    } else if (code[i] === '*') {
      // comment type 2: "/*"
      comment += code[i++]; // "*"

      // TODO
      console.log('here', code, i);

      while (
        idxValid(i, code) &&
        idxValid(i + 1, code) &&
        !(code[i] === '*' && code[i + 1] === '/')
      ) {
        console.log('exec', code, i);
        comment += code[i++];
      }

      console.log('after exec');

      // TODO, wrong since it could be the very last two characters
      if (!idxValid(i, code) || !idxValid(i + 1, code))
        return {
          valid: false,
          value: { codeInvalid: true, type: 'eof in /* comment' },
          newidx: i
        };

      // idx valid
      if (code[i] !== '*' || code[i + 1] !== '/')
        return {
          valid: false,
          value: { codeInvalid: true, type: 'eof in /* comment' },
          newidx: i
        };

      comment += code[i++] + code[i++];
    }
    // else not a comment, handled before calling this function

    return {
      valid: true,
      value: { lexeme: comment, type: lexemeType.comment, idx },
      newidx: i
    };
  }

  // assert: a numeric literal is at idx
  function consumeNumericLiteral(code: string, idx: number): nextToken {
    function consumeDigits() {
      // TODO, check if i is not outside of code
      let lastCharWasDigit = false;
      while (idxValid(i, code) && matches(code[i], /[0-9]|_/g)) {
        if (matches(code[i], /[0-9]/g)) {
          // digit
          lastCharWasDigit = true;
          literal += code[i++];
        } else if (lastCharWasDigit && matches(code[i + 1], /[0-9]/g)) {
          // _
          lastCharWasDigit = false;
          literal += code[i++]; // must be "_"
        } else {
          // _ but followed by something different than a digit

          throw Error(
            // TODO, error: `_` must be inbetween digits
            'Error in `consumeDigits` from `consumeNumericLiteral` in `Lexer`: a `_` in a numeric literal, must be preceded and followed by a digit'
          );
        }
      }
    }

    function consumeE() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // "e" or "E"

      // now optional "+" OR "-"
      if (code[i] === '+' || code[i] === '-') literal += code[i++];

      const literalBefore = literal;
      consumeDigits();
      const runned: boolean = literalBefore !== literal;

      if (!runned)
        // TODO
        throw Error(
          'Error in `consumeNumericLiteral`: unexpected end of numeric literal after `e`'
        );
    }

    function consumeHex() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // 0
      literal += code[i++]; // x
      while (matches(code[i], /[0-9a-fA-F]/g)) literal += code[i++];
      // TODO, what if matches different numeric literal now, ERROR
    }

    function consumeBinary() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // 0
      literal += code[i++]; // b
      while (idxValid(i, code) && matches(code[i], /[01]/g))
        literal += code[i++];
      // TODO, what if matches different numeric literal now, ERROR
    }

    function consumeOctal() {
      // TODO, check if i is not outside of code
      literal += code[i++]; // 0
      literal += code[i++]; // o
      while (matches(code[i], /[0-7]/g)) literal += code[i++];
      // TODO, what if matches different numeric literal now, ERROR
    }

    let i: number = idx;
    let literal: string = '';

    const specialLiteral = /[xbo]/;
    if (
      code[idx] === '0' &&
      idxValid(idx + 1, code) &&
      matches(code[idx + 1], specialLiteral)
    ) {
      switch (code[idx + 1]) {
        case 'x':
          consumeHex();
          break;
        case 'b':
          consumeBinary();
          break;
        case 'o':
          consumeOctal();
          break;
      }
      return {
        valid: true,
        value: { lexeme: literal, type: lexemeType.literal, idx },
        newidx: i
      };
    }

    // first digits
    consumeDigits();

    if (idxValid(i, code) && code[i] === '.') {
      // is fraction
      literal += code[i++]; // "."

      const literalBefore = literal;
      consumeDigits();
      const runned: boolean = literalBefore !== literal;

      if (!runned)
        throw Error(
          'Error in `consumeNumericLiteral`: unexpected end of numeric literal after `.`'
        );
    }

    // `consumeE` could throw an error
    if (idxValid(i, code) && code[i].toLowerCase() === 'e') consumeE();

    return {
      valid: true,
      value: { lexeme: literal, type: lexemeType.literal, idx },
      newidx: i
    };
  }

  // assert: an operator is at idx
  function consumeOperator(code: string, idx: number): nextToken {
    let i: number = idx;
    let operator: string = code[i++];

    while (
      idxValid(i, code) &&
      symbols.some((symbol) => symbol.startsWith(operator + code[i]))
    )
      operator += code[i++];

    // consider "->*" valid and "->" not
    while (!symbols.includes(operator)) {
      if (operator === '') {
        // consider "-", ">" and "->" invalid
        // but "->*" valid, and got "->"

        // TODO return the error
        printMessage('error', {
          id: ErrorID.invalidCharacter,
          code: code,
          idx: idx,
          endIdx: idx,
          file: 'TODO'
        } as any);
        i++; // skip the next character
        break;
      }

      // consider "-", ">" and "->*" valid
      // but got "->"
      operator = operator.slice(0, operator.length - 1);
      i--;
    }

    return {
      valid: true,
      value: { lexeme: operator, type: lexemeType.symbol, idx },
      newidx: i
    };
  }
  // #endregion

  function lexeNextToken(code: string, idx: number): nextToken {
    const whitespaces = /[ \t\n\r]/;
    while (idxValid(idx, code) && matches(code[idx], whitespaces)) ++idx;

    if (!idxValid(idx, code))
      return {
        valid: false,
        value: { type: 'eof', codeInvalid: false },
        newidx: idx
      };

    const commentStart = /[/]/;
    if (matches(code[idx], commentStart)) {
      const commentStart2 = /[/*]/;
      if (idxValid(idx + 1, code) && matches(code[idx + 1], commentStart2))
        return consumeComment(code, idx);
    }

    const identifierStart = /[_a-zA-Z]/;
    if (matches(code[idx], identifierStart)) {
      return consumeIdentifier(code, idx);
    }

    const numberStart = /[0-9]/;
    if (matches(code[idx], numberStart)) {
      return consumeNumericLiteral(code, idx);
    }

    const firstCharSymbols = symbols.map((e) => e[0]);
    if (firstCharSymbols.includes(code[idx])) {
      return consumeOperator(code, idx);
    }

    // TODO add string support for better errors, that means also \u{xxxx}
    // and \", \\, \n, \r, \t

    let invalidChars: string = '';
    const validChars = /[ \t\n\r0-9a-zA-Z_\-+*/%&|^~!<>=:;,.(){}[\]]/;
    while (idxValid(idx, code) && !matches(code[idx], validChars))
      invalidChars += code[idx++];

    return {
      valid: false,
      newidx: idx,
      value: { type: 'invalid char', chars: invalidChars, codeInvalid: true }
    };
  }

  export function* lexeNextTokenIter(
    code: string,
    filename: string
  ): Generator<nextToken, undefined> {
    let val: nextToken = lexeNextToken(code, 0);

    while (val?.value?.type !== 'eof') {
      if (!val.valid) {
        // TODO add full error message
        printMessage('error', {
          id: ErrorID.invalidCharacter,

          code: code, // the code
          file: filename, // name of the file where the error occured
          idx: val.newidx, // start position in string with the error
          endIdx: val.newidx, // end position in string with the error

          msg: '', // the error message to print

          compilerStep: 'lexer' // the part in the compiler where it caused the error
        });
      }

      yield val;
      val = lexeNextToken(code, val.newidx);
    }

    return undefined;
  }

  export function lexe(code: string, filename: string): token[] | undefined {
    const lexemes: token[] = [];

    for (const token of Lexer.lexeNextTokenIter(code, filename))
      if (token.valid) lexemes.push(token.value);
      else return undefined;

    return lexemes;
  }
}

/*
test:
""
" "
" \t\n\r"
"/*"
"/* "
"/**"
"/** "
"/*\/"
*/

console.log(Lexer.lexe(`/*`, 'file'));

/*
// JavaScript/TypeScript quickstart guide
// This is a comment.
/*This is also a comment*\/
// Comments are ignored by the programming language.

// "myFunction" is a function which takes a single number
// as an argument and returns a number when executed
function myFunction(x: number): number {
  // with the "let" keyword, one can define a variable
  let myVariable: number = 5;
  // variables can be modified by using the "=" operator
  myVariable = myVariable + 1;
  // "myVariable" is now (5 + 1) aka 6

  // while the condition "myVariable != 8" is true
  // the code in the "{ }" block will be executed
  while (myVariable != 8) {
    // the "++" operator increases the variable by one
    ++myVariable;
  }

  // an "if" statement checks the condition
  // and executes the "{ }" block, if the condition was true
  if (myVariable == 8) {
    // "console.log" prints the argument,
    // in the brackeds to the console
    console.log(
      'hey' /*text literals called "strings" must be surrounded by quotes*\/
    );
  } else {
    // if the "if" condition was false, the "else" block is executed

    console.log(false);
  }

  // an array is a list of values
  let numberArray: number[] = [0, 1, 2, 3];

  // works like the "while" loop
  for (
    let i = 0 /* executed before the first iteration *\/;
    i < 4 /* condition, gets checked before executing the next iteration *\/;
    ++i /* gets executed at the end of each iteration *\/
  ) {
    // with the "[ ]" operator, one can get the value
    // at the given position where position 0 is the first element
    myVariable = myVariable + numberArray[i];
  }

  // myVariable is at this point 14
  return myVariable + x;
}

// a function can be called with "( )"
let returnedValue: number = myFunction(5);
*/

// TODO, not peek() and consumeChar() = bad because not standard?
/**
 * Comments and whitespace: // and /* * /,  , \n, \t
 * Literals: +-.5e-3, 0xFF00FF
 * Keywords: let, fn, in, out
 * Identifier: _a_z_A_Z_0_9
 * Operator: +, -, *, /, ==, !=, <, >, <=, >=, ,, (, ), {, }, =, ->, .
 *
 * TypeSystem: ...
 */
// TODO, also lex strings (for errors)
// +, - (unary and binary), *, /, **, ***, %
// &, |, ^, ~, <<, >>
// ==, !=, <=, >=, <, >
// =, :, ->, () (grouping and argument list), ;, ,, . (for accessing public values from namespaces), {} (for namespaces), [] (for type templating)

//  TODO: have a lexeNextToken() function which also can work as an iterator
// test: /* You can /* nest comments *\/ by escaping slashes */
// console.log(
//   Lexer.lexe(
//     `
//   // import std;
//   // import my_libs/./wrong_lib/../math_lib/./my_math_lib.bll;

//   let num1 = 5;
//   let num2 = 0x5;
//   let num3 = 0b1;
//   let num4 = 0o7;

//   /* You can /* nest comments *\\/ by escaping slashes */

//   // example code
//   let a: i32 = IO.in[i32](0); // gets an i32 from the console
//   let b: i32 = Math.sq(a); // a ** 2, TODO compiler/interpreter must deduce that Math.sq[i32] is called and not Math.sq[f32]
//   let c: i32 = IO.out(b); // prints b and assigneds b to c

//   let d = func (x: i32) -> 5_4.1e-3;
//   // 5, 5.1e2,   5., 5e, 5e., 5.e, 5.1e, 5e1., 5e1.2
// `,
//     'src'
//   )
// );

// export function lexe(code: string, fileName: string): lexeme[] | never {
//   return [];

//   let hadError: boolean = false;

//   code += ' '; // add space at the end

//   const lexedCode: lexeme[] = [];
//   for (let charIdx: number = 0; charIdx < code.length; ++charIdx) {
//     if (matches(code[charIdx], /[ \t\n\r]/g))
//       // is whitespace
//       continue; // go to next character

//     // could be `//` or `/*` for comment:
//     if (code[charIdx] === '/') {
//       if (code[charIdx + 1] === '/' || code[charIdx + 1] === '*') {
//         // consume comment
//         const commentData = consumeComment(code, charIdx);

//         lexedCode.push({
//           value: commentData.comment,
//           type: lexemeType.comment,
//           idx: charIdx
//         });

//         charIdx = commentData.lastIdx;
//         continue;
//       }
//       // else, do not `continue` since it was the operator /
//     }

//     // character is not whitespace and is not a comment
//     // it must be an identifier, keyword, literal or operator

//     if (matches(code[charIdx], /[a-zA-Z_]/g)) {
//       // is keyword or identifier
//       const identifierData = consumeIdentifier(code, charIdx);

//       lexedCode.push({
//         value: identifierData.identifier,
//         type: keywords.includes(identifierData.identifier)
//           ? lexemeType.keyword
//           : lexemeType.identifier,
//         idx: charIdx
//       });

//       charIdx = identifierData.lastIdx;
//       continue;
//     } else if (
//       /*first character of some operator matches up with current symbol. does not mean this char is also an operator stand alone, so this could throw an error in this case.*/ operators
//         .map((s) => s[0])
//         .includes(code[charIdx])
//     ) {
//       // is symbol
//       const operatorData = consumeOperator(code, charIdx);
//       // TODO could be a symbol with multiple chars

//       lexedCode.push({
//         value: operatorData.operator,
//         type: lexemeType.operator,
//         idx: charIdx
//       });

//       charIdx = operatorData.lastIdx;
//       continue;
//     } else if (matches(code[charIdx], /[0-9]/g)) {
//       // is numeric literal
//       const literalData = consumeNumericLiteral(code, charIdx);

//       lexedCode.push({
//         value: literalData.literal,
//         type: lexemeType.literal,
//         idx: charIdx
//       });

//       charIdx = literalData.lastIdx;
//       continue;
//     } else {
//       // do a while here to get errors which are on the same line/behind each other
//       hadError = true;

//       printMessage('error', {
//         id: ErrorID.invalidCharacter,
//         code: code,
//         idx: charIdx,
//         endIdx: charIdx,
//         file: fileName
//       } as any);

//       // throw Error(
//       //   // TODO
//       //   `Error in \`lexer\`: unkown character \`${code[charIdx]}\` at position ${charIdx}`
//       // );
//     }
//   }

//   if (!hadError) return lexedCode;
//   // else
//   console.error('code could not compile');
//   return [];
// }
