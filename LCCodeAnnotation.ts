import { Lexer } from './LCLexer';
import { Parser } from './LCParser';
import { Formatter } from './LCFormatter';

export namespace Annotate {
  let colorActive: boolean = false;

  const Colors = {
    error: `${0xff};${0x10};${0x10}`,
    warning: `${0x80};${0x80};${0x80}`,
    message: `${0xee};${0xee};${0xee}`,

    blue: `${0x00};${0x00};${0xff}`
  };

  // #region types
  export enum ErrorId {
    lInvalidChars = 0x0001,
    lInvalidNumericLiteral = 0x0002,
    lStringUsed = 0x0003,
    lUnexpectedEof = 0x0004,

    pUnexpectedEof = 0x2001,

    iIdentifierCantBeResolved = 0x4001,

    eInvalidBinaryOpType = 0x6001
  }

  type step = 'lexer' | 'parser' | 'intermediate' | 'executed';

  interface Annotation {
    code: string;
    filename: string;
    startIndex: number;
    endIndex: number;
  }

  const infos: {
    [ErrorId: number]: {
      step: string;
      description: string;
      message?: string;
      solution?: string;
    };
  } = {
    [ErrorId.lInvalidChars]: {
      step: 'lexer',
      description: 'invalid characters in source code.'
    },
    [ErrorId.eInvalidBinaryOpType]: {
      step: 'interpreter/compiler',
      description: 'used binary operator with two different datatypes'
    }
  };

  type ErrorAnnotation = Annotation &
    (
      | {
          errorId: ErrorId.lInvalidChars;
          startIndex: number;
          endIndex: number;
        }
      | {
          errorId: ErrorId.eInvalidBinaryOpType;
          binOpLex: Lexer.token;
          rightOperant: Parser.expression;
          rightType: string;
          leftOperant: Parser.expression;
          leftType: string;
        }
    );

  interface WarningAnnotation extends Annotation {}

  interface MessageAnnotation extends Annotation {}
  // #endregion

  // #region helper functions
  function addColor(msg: string, color: string): string {
    return colorActive ? `\x1b[38;2;${color}m` + msg + `\u001b[0m` : msg;
  }

  function pad(
    str: string,
    pad: string,
    toLength: number,
    type: 'front' | 'end' = 'front'
  ): string {
    while (str.length < toLength)
      if (type === 'front') str = pad + str;
      else str += pad;
    return str;
  }

  function getLineIdx(str: string, idx: number): number {
    let counter: number = 1;
    for (let i = 0; i < str.length && i < idx; ++i)
      if (str[i] === '\n') counter++;
    return counter;
  }

  // #endregion

  function generateLines(code: string, furtherData: any): string {
    return '';
  }

  function generateErrorMessage(error: ErrorAnnotation): string {
    switch (error.errorId) {
      case ErrorId.lInvalidChars:
        break;
      case ErrorId.eInvalidBinaryOpType:
        return (
          ` LINE_NUMBER | ` +
          Formatter.printExpression(error.leftOperant, '') +
          ` ${error.binOpLex.l} ` +
          Formatter.printExpression(error.rightOperant, '')
        );
        break;

      default:
        break;
    }
    return '';
  }

  export function annotate(
    annotation:
      | { type: 'error'; value: ErrorAnnotation }
      | { type: 'warning'; value: WarningAnnotation }
      | { type: 'message'; value: MessageAnnotation },
    withColor: boolean = true
  ): string {
    colorActive = withColor;

    let msg: string = 'LC-BLL Version 1.0.0\n';

    switch (annotation.type) {
      case 'error':
        const value = annotation.value;
        const errorId: number = annotation.value.errorId;

        msg += addColor(
          `error[${infos[errorId].step}: E-${pad(
            errorId.toString(16),
            '0',
            4,
            'front'
          )}]: ${infos[errorId].description}\n`,
          Colors.error
        );

        msg += addColor(
          `--> ${value.filename}:${value.startIndex}:${value.endIndex}\n`,
          Colors.blue
        );

        msg += generateErrorMessage(value);

        break;
      case 'message':
        break;
      case 'warning':
        break;
    }

    return msg;
  }
}
