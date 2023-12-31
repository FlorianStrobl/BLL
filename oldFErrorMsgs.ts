export const enum ErrorID {
  unexpectedEndOfFile = 0x0000,
  invalidCharacter = 0x0001,
  invalidNumericLiteralUnderscore = 0x0002,
  invalidNumericLiteralELast = 0x0003,
  invalidNumericLiteralEFollowedByPoint = 0x0004,
  invalidNumericLiteralPointLast = 0x0005,
  invalidCommentUnclosed = 0x0006,
  // add invalidOperator, e.g. "->" even tho only "->*" is valid
  invalidBinOpNotSameType = 0x5001
}

interface Error {
  id: ErrorID;

  code: string; // the code
  file: string; // name of the file where the error occured
  idx: number; // start position in string with the error
  endIdx: number; // end position in string with the error

  msg: string; // the error message to print

  compilerStep?: 'lexer' | 'parser' | 'intermediate' | 'compiler'; // the part in the compiler where it caused the error
  internalFunctionName?: string; // optionally the name of the function where the error happend

  additionalInformations?: {};
}

// add invalidToken??
const Errors: {
  [ErrorId: number]: {
    step: string;
    type: string;
    msg?: string;
    solution?: string;
  };
} = {
  [ErrorID.unexpectedEndOfFile]: {
    step: 'lexer',
    type: 'unexpected end of line'
  },
  [ErrorID.invalidCharacter]: {
    step: 'lexer',
    type: 'invalid character',
    msg: 'invalid character #[0] at position #[1]',
    solution: 'remove the invalid character from your code'
  },
  [ErrorID.invalidNumericLiteralUnderscore]: {
    step: 'lexer',
    type: 'invalid numeric literal',
    msg: 'a `_` must be inbetween digits'
  },
  [ErrorID.invalidNumericLiteralELast]: {
    step: 'lexer',
    type: 'invalid numeric literal',
    msg: 'an `e` in a numeric literal, must be followed by digits'
  },
  [ErrorID.invalidNumericLiteralEFollowedByPoint]: {
    step: 'lexer',
    type: 'invalid numeric literal',
    msg: 'an `e` in a numeric literal, cannot be followed by a `.` anymore'
  },
  [ErrorID.invalidNumericLiteralPointLast]: {
    step: 'lexer',
    type: 'invalid numeric literal',
    msg: 'a fraction in a numeric literal started by `.`, must be followed by digits'
  },
  [ErrorID.invalidCommentUnclosed]: {
    step: 'lexer',
    type: 'invalid comment ',
    msg: 'a comment starting with `/*` must be closed by `*/`'
  },

  [ErrorID.invalidBinOpNotSameType]: {
    step: 'compiler',
    type: 'wrong types while using binary operator',
    msg: 'binary operators need the same data type on both sides.'
  }
};

function errorMainPart(error: Error): string {
  const errorInfo = Errors[error.id];

  let message: string = '';

  message = '\n' + getCodePart(error.code, error.idx, error.endIdx);

  // #region : lineNrOrSpace "|" message
  let finalCodeMessage: string[] = (message + '\n').split('\n');
  let spaceCount = 1; // for potential line numbers
  for (let i = 0; i < finalCodeMessage.length; ++i)
    // add line numbers
    finalCodeMessage[i] = `${' '.repeat(spaceCount)}| ${finalCodeMessage[i]}`;

  message = finalCodeMessage.join('\n') + '\n';
  // #endregion

  if (errorInfo.solution !== undefined)
    switch (error.id) {
      case ErrorID.invalidCharacter:
        message += addColor(`= ${errorInfo.solution}`, 'green');
        break;
      default:
        message += addColor(`= ${errorInfo.solution}`, 'green');
        break;
    }
  return message;
}

function numStrAddLeadingZero(n: number, minDigit: number): string {
  let str: string = n.toString();
  while (str.length < minDigit) str = '0' + str;
  return str;
}

function addColor(
  str: string,
  color:
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white'
    | 'gray'
): string {
  const colors: { [_: string]: string } = {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
  };

  return `${colors[color]}${str}\x1b[0m`;
}

function getLineIdx(str: string, idx: number): number {
  return str
    .slice(0, idx)
    .split('')
    .filter((e) => e === '\n').length;
}

function getIdxInLine(str: string, idx: number): number {
  return idx - getLineStartIdx(str, idx);
}

function getLineStartIdx(str: string, idx: number): number {
  return str.slice(0, idx).lastIndexOf('\n');
}

function getLine(str: string, lineIdx: number): string {
  return str.split('\n')[lineIdx];
}

function getCodePart(str: string, startIdx: number, endIdx: number): string {
  return str.slice(startIdx, endIdx + 1);
}

function errorMainMsgFormatted(error: Error): string {
  switch (error.id) {
    case ErrorID.invalidCharacter:
      return Errors[error.id]
        .msg!.replace('#[0]', error.code[error.idx])
        .replace('#[1]', error.idx.toString());
    default:
      return Errors[error.id].msg ?? '';
  }
}

export function printMessage(type: 'warning', value: string): void;
export function printMessage(type: 'message', value: string): void;
export function printMessage(type: 'error', value: Error): void;
export function printMessage(
  type: 'message' | 'error' | 'warning',
  value: string | Error
): void {
  let message = 'LC-BLL Version 1.0.0\n';

  switch (type) {
    case 'message':
    case 'warning':
      message += value;
      break;
    case 'error':
      value = value as Error;

      // https://discord.com/channels/@me/691250517820571649/1095310448359903233

      // .replaceAll("#[0]", error.code[error.idx]).replaceAll("#[0]", error.idx.toString())

      message += addColor(
        `error[E-${numStrAddLeadingZero(value.id, 5)}]: ${errorMainMsgFormatted(
          value
        )}\n`,
        'red'
      );

      message += addColor(
        `--> ${value.file}:${
          1 + getLineIdx(value.code, value.idx)
        }:${getIdxInLine(value.code, value.idx)}\n`,
        'blue'
      );

      message += errorMainPart(value);

      break;
  }

  console.log(message + '\n');
}
