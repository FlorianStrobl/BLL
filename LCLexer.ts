// TODO, not peek() and consumeChar() = bad because not standard?
/**
 * Comments and whitespace: // and /* * /,  , \n, \t
 * Literals: +-.5e-3, 0xFF00FF
 * Keywords: let, fn, in, out
 * Identifier: _a_z_A_Z_0_9
 * Operator: +, -, *, /, ==, !=, <, >, <=, >=, ,, (, ), {, }, =, =>, .
 *
 * TypeSystem: ...
 */
import { printMessage, ErrorID } from './FErrorMsgs'; // @ts-ignore
import { inspect } from 'util';

export namespace Lexer {
  // #region constants
  const keywords: string[] = [
    'let', // bind a function to an identifier
    'func', // create a function
    'pub', // make function public from a namespace
    'namespace', // wrapper around functions
    'type', // create an identifier bound to a type
    'NaN', // NaN::f32
    'Infinity', // Infinity::f32
    'f32', // type: single precision 32 bit float after the IEEE754-2008 standard
    'u32', // type: unsigned 32 bit integer
    'undetermined', // type: cannot be determined at compile time but must be done at compile time
    'import' // import namespace from other file
  ];

  // +, - (unary and binary), *, /, **, ***, %
  // &, |, ^, ~, <<, >>
  // ==, !=, <=, >=, <, >
  // =, :, ->, () (grouping and argument list), ;, ,, . (for accessing public values from namespaces), {} (for namespaces), [] (for type templating)
  const symbols: string[] = [
    "'" /*to delete*/,
    '!' /*to delete*/,
    '#' /*to delete*/,
    '?' /*to delete*/,
    '"' /*to delete*/,
    '+', // add
    '-', // sub
    '*', // multiplication
    '/', // divide (for integers: rounding down)
    '**', // exponentiation
    '***', // root
    '%', // remainder

    '&', // and
    '|', // or
    '^', // xor
    '~', // not
    '<<', // left shift
    '>>', // right shift

    '==', // equal
    '!=', // not equal
    '<=', // greater than or equal
    '>=', // less than or equal
    '>', // less than
    '<', // greater than

    '=', // assigment (also for default values)
    ':', // type annotation
    '->', // function
    ';', // end of a statement
    ',', // seperator for arguments
    '.', // accessing public functions from namespaces

    '(', // grouping
    ')',
    '{',
    '}',
    '[',
    ']'
  ]
    .sort(/*sort for length*/ (a, b) => b.length - a.length)
    .filter(/*remove doubles*/ (e, i, a) => !a.slice(0, i).includes(e));
  // #endregion

  function matches(character: string, regexp: RegExp): boolean {
    return character.match(regexp) !== null;
  }

  // #region interfaces
  export enum lexemeType {
    comment = '#comment', // "//...", "/*...*/"
    literal = '#literal', // 5.3e-4
    keyword = '#keyword', // let
    identifier = '#identifier', // identifier
    operator = '#operator' // +
  }

  export interface lexeme {
    value: string;
    type: lexemeType;
    idx: number; // index in the original file
  }

  interface identifierData {
    identifier: string;
    lastIdx: number;
  }

  interface commentData {
    comment: string;
    lastIdx: number;
  }

  interface operatorData {
    operator: string;
    lastIdx: number;
  }

  interface literalData {
    literal: string;
    lastIdx: number;
  }
  // #endregion

  // #region consume functions
  function consumeIdentifier(
    code: string, // assert: last char is space
    startIdx: number
  ): identifierData | never {
    const identifierData: identifierData = { identifier: '', lastIdx: -1 };

    let i = startIdx;
    while (i < code.length && matches(code[i], /[_a-zA-Z0-9]/g)) {
      identifierData.identifier += code[i];
      i++;
    }

    identifierData.lastIdx = i - 1;

    return identifierData;
  }

  function consumeComment(
    code: string, // assert: last char is space
    startIdx: number // assert: code[startIdx+1] is "/" or "*"
  ): commentData | never {
    const commentData: commentData = {
      comment: code[startIdx] /* `/` */,
      lastIdx: -1
    };

    let i = startIdx + 1;
    if (code[i] === '/') {
      // comment type 1: "//"

      while (i < code.length && code[i] !== '\n')
        commentData.comment += code[i++];

      // TODO
      if (i >= code.length)
        throw Error('Error in `consumeComment`: reached end of file');
    } else if (code[i] === '*') {
      // comment type 2: "/*"
      commentData.comment += code[i++]; // "*"

      // type 2 comment `/* */`
      while (
        !(
          i < code.length &&
          code[i] === '*' &&
          i + 1 < code.length &&
          code[i + 1] === '/'
        )
      )
        commentData.comment += code[i++];

      // TODO
      if (i >= code.length || i + 1 >= code.length)
        throw Error('Error in `consumeComment`: reached end of file');

      if (code[i] !== '*' || code[i + 1] !== '/')
        throw Error(
          // TODO
          'Error in `consumeComment`: comment of type "/*" was not finished properly.'
        );

      commentData.comment += '*/'; // code[i] + code[i+1]
      i += 2;
    }
    // else not a comment, handled before calling this function

    commentData.lastIdx = i - 1;

    return commentData;
  }

  function consumeOperator(
    code: string, // assert: last char is space
    startIdx: number
  ): operatorData | never {
    const operatorData: operatorData = { operator: '', lastIdx: -1 };
    let i = startIdx;

    operatorData.operator = code[i++]; // first char of the operator

    while (
      i < code.length &&
      symbols
        // only take the amount of characters needed
        .map((s) => [...s].slice(0, operatorData.operator.length + 1).join(''))
        // check if this operator and next are included
        .includes(operatorData.operator + code[i])
    )
      operatorData.operator += code[i++];

    /* Handles the case where
    operator "->*" exists but "->" does not,
    thought the later one is used in the code and would get parsed incorrectly

    "->" would be splited up into "-" and ">", thought the later one gets parsed in the next iteration of this function call
    if one of those two splited up chars is invalid, Error gets thrown
    */
    while (!symbols.includes(operatorData.operator)) {
      if (operatorData.operator === '')
        // invalid operator to begin with
        throw Error(
          // TODO
          `\`Lexer\` Error: Invalid character \`${code[startIdx]}\` found at position ${startIdx}`
        );

      // maybe just the last char was part of another symbol with more chars, so cut that off
      operatorData.operator = operatorData.operator.slice(
        0,
        operatorData.operator.length - 1
      );
      i--;
    }

    operatorData.lastIdx = i - 1;

    return operatorData;
  }

  function consumeNumericLiteral(
    code: string, // assert: last char is space
    startIdx: number
  ): literalData | never {
    function consumeDigits() {
      let lastCharWasDigit = false;
      while (i < code.length && matches(code[i], /[0-9]|_/g)) {
        if (matches(code[i], /[0-9]/g)) {
          // digit
          lastCharWasDigit = true;
          literalData.literal += code[i++];
        } else if (lastCharWasDigit && matches(code[i + 1], /[0-9]/g)) {
          // _
          lastCharWasDigit = false;
          literalData.literal += code[i++]; // must be "_"
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
      literalData.literal += code[i++]; // "e" or "E"

      // now optional "+" OR "-"
      if (code[i] === '+' || code[i] === '-') literalData.literal += code[i++];

      const literalBefore = literalData.literal;
      consumeDigits();
      const runned: boolean = literalBefore !== literalData.literal;

      if (!runned)
        // TODO
        throw Error(
          'Error in `consumeNumericLiteral`: unexpected end of numeric literal after `e`'
        );
    }

    function consumeHex() {
      literalData.literal += code[i++]; // 0
      literalData.literal += code[i++]; // x
      while (matches(code[i], /[0-9a-fA-F]/g)) literalData.literal += code[i++];
      // TODO, what if matches different numeric literal now, ERROR
    }

    function consumeBinary() {
      literalData.literal += code[i++]; // 0
      literalData.literal += code[i++]; // b
      while (matches(code[i], /[01]/g)) literalData.literal += code[i++];
      // TODO, what if matches different numeric literal now, ERROR
    }

    function consumeOctal() {
      literalData.literal += code[i++]; // 0
      literalData.literal += code[i++]; // o
      while (matches(code[i], /[0-7]/g)) literalData.literal += code[i++];
      // TODO, what if matches different numeric literal now, ERROR
    }

    const literalData: literalData = { literal: '', lastIdx: -1 };
    let i = startIdx;

    if (code[startIdx] === '0') {
      switch (code[startIdx + 1]) {
        case 'x':
          consumeHex();
          literalData.lastIdx = i - 1;
          return literalData;
        case 'b':
          consumeBinary();
          literalData.lastIdx = i - 1;
          return literalData;
        case 'o':
          consumeOctal();
          literalData.lastIdx = i - 1;
          return literalData;
        default:
          break;
      }
    }

    // first digits
    consumeDigits();

    if (code[i] === '.') {
      // is fraction
      literalData.literal += code[i++]; // "."

      const literalBefore = literalData.literal;
      consumeDigits();
      const runned: boolean = literalBefore !== literalData.literal;

      if (!runned)
        throw Error(
          'Error in `consumeNumericLiteral`: unexpected end of numeric literal after `.`'
        );
    }

    // `consumeE` could throw an error
    if (code[i].toLowerCase() === 'e') consumeE();

    literalData.lastIdx = i - 1;

    return literalData;
  }
  // #endregion

  export function lexe(code: string, file: string): lexeme[] | never {
    let hadError: boolean = false;

    code += ' '; // add space at the end

    const lexedCode: lexeme[] = [];
    for (let charIdx: number = 0; charIdx < code.length; ++charIdx) {
      if (matches(code[charIdx], /[ \n\t\r]/g)) {
        // is whitespace
        continue; // go to next character
      } else if (code[charIdx] === '/') {
        // could be `//` or `/*` for comment:
        if (code[charIdx + 1] === '/' || code[charIdx + 1] === '*') {
          // consume comment
          const commentData: commentData = consumeComment(code, charIdx);

          lexedCode.push({
            value: commentData.comment,
            type: lexemeType.comment,
            idx: charIdx
          });

          charIdx = commentData.lastIdx;
          continue;
        }
        // else, do not `continue` since it was the operator /
      }

      // character is not whitespace and is not a comment
      // it must be an identifier, keyword, literal or operator

      if (matches(code[charIdx], /[a-zA-Z_]/g)) {
        // is keyword or identifier
        const identifierData: identifierData = consumeIdentifier(code, charIdx);

        lexedCode.push({
          value: identifierData.identifier,
          type: keywords.includes(identifierData.identifier)
            ? lexemeType.keyword
            : lexemeType.identifier,
          idx: charIdx
        });

        charIdx = identifierData.lastIdx;
        continue;
      } else if (
        /*first character of some operator matches up with current symbol. does not mean this char is also an operator stand alone, so this could throw an error in this case.*/ symbols
          .map((s) => s[0])
          .includes(code[charIdx])
      ) {
        // is symbol
        const operatorData: operatorData = consumeOperator(code, charIdx);
        // TODO could be a symbol with multiple chars

        lexedCode.push({
          value: operatorData.operator,
          type: lexemeType.operator,
          idx: charIdx
        });

        charIdx = operatorData.lastIdx;
        continue;
      } else if (matches(code[charIdx], /[0-9]/g)) {
        // is numeric literal
        const literalData: literalData = consumeNumericLiteral(code, charIdx);

        lexedCode.push({
          value: literalData.literal,
          type: lexemeType.literal,
          idx: charIdx
        });

        charIdx = literalData.lastIdx;
        continue;
      } else {
        hadError = true;

        printMessage('error', {
          id: ErrorID.invalidCharacter,
          code: code,
          idx: charIdx,
          endIdx: charIdx,
          file: file
        } as any);

        // throw Error(
        //   // TODO
        //   `Error in \`lexer\`: unkown character \`${code[charIdx]}\` at position ${charIdx}`
        // );
      }
    }

    if (!hadError) return lexedCode;
    // else
    console.error('code could not compile');
    return [];
  }
}

// test: 5, 5.1e2,   5., 5e, 5e., 5.e, 5.1e, 5e1., 5e1.2
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
//   let a: u32 = IO.in[u32](0); // gets an u32 from the console
//   let b: u32 = Math.sq(a); // a ** 2, TODO compiler/interpreter must deduce that Math.sq[u32] is called and not Math.sq[f32]
//   let c: u32 = IO.out(b); // prints b and assigneds b to c

//   let d = func (x: u32) -> 5_4.1e-3;
//   // 5, 5.1e2,   5., 5e, 5e., 5.e, 5.1e, 5e1., 5e1.2
// `,
//     'src'
//   )
// );
