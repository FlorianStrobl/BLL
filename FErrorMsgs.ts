const enum ErrorID {
  unexpectedEndOfFile = 0x0000,
  invalidToken = 0x0001,
  invalidNumericLiteralUnderscore = 0x0002,
  invalidNumericLiteralELast = 0x0003,
  invalidNumericLiteralEFollowedByPoint = 0x0004,
  invalidNumericLiteralPointLast = 0x0005,
  invalidCommentUnclosed = 0x0006
}

interface Error {
  id: ErrorID; // every error has an id

  idx: number; // start position in string with the error
  endIdx: number; // end position in string with the error

  msg: string; // the error message to print

  compilerStep?: 'lexer' | 'parser' | 'compiler'; // the part in the compiler where it caused the error
  internalFunctionName?: string; // optionally the name of the function where the error happend
}

const Errors: {
  [ErrorId: number]: { step: string; type: string; msg?: string };
} = {
  [ErrorID.unexpectedEndOfFile]: {
    step: 'lexer',
    type: 'unexpected end of line'
  },
  [ErrorID.invalidToken]: { step: 'lexer', type: 'invalid token' },
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
  }
};
