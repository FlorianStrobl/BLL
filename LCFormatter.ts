import { Parser } from './LCParser';

// TODO fix comments, add line breaks on more than 80 chars per line, code folding, bracket matching, (imports at very top)

export namespace Formatter {
  export const Colors = {
    symbol: `${0xab};${0xb2};${0xbf}`, // white
    comments: `${0x80};${0x80};${0x80}`, // gray
    numberLiteral: `${0xe5};${0xc0};${0x7b}`, // yellow
    keywordGroup: `${0x05};${0x16};${0x50}`, // darker blue
    keywordUse: `${0x00};${0x04};${0x35}`, // dark blue - purple
    keywordMatch: `${0x61};${0xaf};${0xef}`, // blue
    keywordFunc: `${0x80};${0x00};${0x80}`, // purple
    keywordLet: `${0xc6};${0x78};${0xdd}`, // magenta
    keywordType: `${0xc6};${0x78};${0xdd}`, // cyan
    identifier: `${0xe0};${0x6c};${0x75}`, // yellow
    filename: `${0x98};${0xa8};${0xa4}`, // gray
    genericIdentifier: `${0x80};${0x80};${0x80}`, // gray
    primitiveType: `${0xff};${0xa5};${0x00}` // orange
  };

  let indentSize: string = '  ';
  let colorActive: boolean = true;
  let htmlActive: boolean = false;

  function printComments(
    comments: Parser.token[],
    indentation: string
  ): string {
    return comments.length === 0
      ? ''
      : comments
          .map((comment) => indentation + addColor(comment.l, Colors.comments))
          .join('\n') + '\n';
  }

  export function printTypeExpression(
    expression: Parser.typeExpression
  ): string {
    switch (expression.type) {
      case 'grouping':
        return (
          printComments(expression.comments, '') +
          (addColor('(', Colors.symbol) +
            printTypeExpression(expression.body) +
            addColor(')', Colors.symbol))
        );
      case 'primitive-type':
        return (
          printComments(expression.comments, '') +
          addColor(expression.primitiveToken.l, Colors.primitiveType)
        );
      case 'identifier':
        return (
          printComments(expression.comments, '') +
          addColor(expression.identifierToken.l, Colors.identifier)
        );
      case 'func-type':
        return (
          printComments(expression.comments, '') +
          (addColor('(', Colors.symbol) +
            expression.parameters
              .map((argument) => printTypeExpression(argument.argument))
              .join(addColor(', ', Colors.symbol)) +
            addColor(')', Colors.symbol) +
            addColor(' -> ', Colors.symbol) +
            printTypeExpression(expression.returnType))
        );
      case 'propertyAccess':
        return (
          printComments(expression.comments, '') +
          (printTypeExpression(expression.source) +
            addColor('.', Colors.symbol) +
            addColor(expression.propertyToken.l, Colors.identifier))
        );
      case 'genericSubstitution':
        return (
          printComments(expression.comments, '') +
          printTypeExpression(expression.expr) +
          addColor('[', Colors.symbol) +
          expression.substitutions
            .map((e) => printTypeExpression(e.argument))
            .join(addColor(', ', Colors.symbol)) +
          addColor(']', Colors.symbol)
        );
    }
  }

  export function printExpression(
    expression: Parser.expression,
    indentation: string
  ): string {
    switch (expression.type) {
      case 'grouping':
        return (
          printComments(expression.comments, indentation) +
          (addColor('(', Colors.symbol) +
            printExpression(expression.body, indentation) +
            addColor(')', Colors.symbol))
        );
      case 'literal':
        return (
          printComments(expression.comments, indentation) +
          addColor(expression.literalToken.l, Colors.numberLiteral)
        );
      case 'identifier':
        return (
          printComments(expression.comments, indentation) +
          addColor(expression.identifierToken.l, Colors.identifier)
        );
      case 'propertyAccess':
        return (
          printComments(expression.comments, indentation) +
          (printExpression(expression.source, indentation) +
            addColor('.', Colors.symbol) +
            addColor(expression.propertyToken.l, Colors.identifier))
        );
      case 'typeInstantiation':
        return (
          printComments(expression.comments, indentation) +
          (printExpression(expression.source, indentation) +
            addColor('->', Colors.symbol) +
            addColor(expression.typeLineToken.l, Colors.identifier))
        );
      case 'call':
        return (
          printComments(expression.comments, indentation) +
          (printExpression(expression.function, indentation) +
            addColor('(', Colors.symbol) +
            expression.arguments
              .map((argument) =>
                printExpression(argument.argument, indentation)
              )
              .join(addColor(', ', Colors.symbol)) +
            addColor(')', Colors.symbol))
        );
      case 'unary':
        return (
          printComments(expression.comments, indentation) +
          (addColor(expression.operator, Colors.symbol) +
            printExpression(expression.body, indentation))
        );
      case 'binary':
        return (
          printComments(expression.comments, indentation) +
          (printExpression(expression.leftSide, indentation) +
            ' ' +
            addColor(expression.operator, Colors.symbol) +
            ' ' +
            printExpression(expression.rightSide, indentation))
        );
      case 'func':
        const explicitType: string = expression.hasExplicitType
          ? addColor(': ', Colors.symbol) +
            printTypeExpression(expression.typeExpression)
          : '';
        return (
          printComments(expression.comments, indentation) +
          (addColor('func ', Colors.keywordFunc) +
            addColor('(', Colors.symbol) +
            expression.parameters
              .map(
                (parameter) =>
                  addColor(
                    parameter.argument.identifierToken.l,
                    Colors.identifier
                  ) +
                  (parameter.argument.hasExplicitType
                    ? addColor(': ', Colors.symbol) +
                      printTypeExpression(parameter.argument.typeExpression)
                    : '') +
                  (parameter.argument.hasDefaultValue
                    ? addColor(' = ', Colors.symbol) +
                      printExpression(
                        parameter.argument.defaultValue,
                        indentation
                      )
                    : '')
              )
              .join(addColor(', ', Colors.symbol)) +
            addColor(')', Colors.symbol) +
            explicitType +
            addColor(' => ', Colors.symbol) +
            printExpression(expression.body, indentation))
        );
      case 'match':
        const explicitType_: string = expression.hasExplicitType
          ? addColor(': ', Colors.symbol) +
            printTypeExpression(expression.typeExpression)
          : '';

        if (expression.body.length <= 1)
          return (
            printComments(expression.comments, indentation) +
            addColor('match ', Colors.keywordMatch) +
            addColor('(', Colors.symbol) +
            printExpression(expression.scrutinee, indentation) +
            addColor(')', Colors.symbol) +
            explicitType_ +
            addColor(' { ', Colors.symbol) +
            (expression.body.length === 0
              ? ''
              : (() => {
                  const arg: Parser.matchBodyLine = expression.body[0].argument;
                  const pattern: string = arg.isDefaultVal
                    ? ''
                    : addColor(arg.identifierToken.l, Colors.identifier) +
                      (arg.parameters.length === 0
                        ? ''
                        : addColor('(', Colors.symbol) +
                          arg.parameters
                            .map((parameter) =>
                              addColor(parameter.argument.l, Colors.identifier)
                            )
                            .join(addColor(', ', Colors.symbol)) +
                          addColor(')', Colors.symbol)) +
                      ' ';
                  return (
                    printComments(arg.comments, '') +
                    pattern +
                    addColor('=> ', Colors.symbol) +
                    printExpression(arg.body, indentation)
                  );
                })() + ' ') +
            addColor('}', Colors.symbol)
          );

        return (
          printComments(expression.comments, indentation) +
          (addColor('match ', Colors.keywordMatch) +
            addColor('(', Colors.symbol) +
            printExpression(expression.scrutinee, indentation) +
            addColor(')', Colors.symbol) +
            explicitType_ +
            addColor(' { ', Colors.symbol) +
            '\n' +
            indentation +
            indentSize +
            expression.body
              .map((bodyLine) => {
                return (
                  printComments(bodyLine.argument.comments, indentation) +
                  (bodyLine.argument.comments.length === 0
                    ? ''
                    : indentation + indentSize) +
                  ((bodyLine.argument.isDefaultVal
                    ? ''
                    : addColor(
                        bodyLine.argument.identifierToken.l,
                        Colors.identifier
                      ) +
                      (bodyLine.argument.parameters.length !== 0
                        ? addColor('(', Colors.symbol) +
                          bodyLine.argument.parameters
                            .map((a) =>
                              addColor(a.argument.l, Colors.identifier)
                            )
                            .join(addColor(', ', Colors.symbol)) +
                          addColor(')', Colors.symbol)
                        : '')) +
                    addColor(
                      bodyLine.argument.isDefaultVal ? '=> ' : ' => ',
                      Colors.symbol
                    ) +
                    printExpression(bodyLine.argument.body, indentation))
                );
              })
              .join(addColor(',\n' + indentation + indentSize, Colors.symbol)) +
            ('\n' + indentation) +
            addColor('}', Colors.symbol))
        );
    }
  }

  export function printStatement(
    statement: Parser.statement,
    indent: string
  ): string {
    switch (statement.type) {
      case 'comment':
      case 'empty':
        // remove the ';' of empty statements
        return printComments(statement.comments, indent).trimEnd();
      case 'import':
        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('use ', Colors.keywordUse) +
              addColor(statement.filename.l, Colors.filename) +
              addColor(';', Colors.symbol)))
        );
      case 'group':
        // empty groups get handled differently
        if (statement.body.length === 0)
          return (
            printComments(statement.comments, indent) +
            indent +
            addColor('group ', Colors.keywordGroup) +
            addColor(statement.identifierToken.l, Colors.identifier) +
            addColor(' { }', Colors.symbol)
          );

        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('group ', Colors.keywordGroup) +
              addColor(statement.identifierToken.l, Colors.identifier) +
              addColor(' {\n', Colors.symbol) +
              beautifyAST(statement.body, indent + indentSize) +
              indent +
              addColor('}', Colors.symbol)))
        );
      case 'let':
        const genericPart: string = statement.isGeneric
          ? addColor('[', Colors.symbol) +
            statement.genericIdentifiers
              .map((genericIdentifier) =>
                addColor(genericIdentifier.argument.l, Colors.genericIdentifier)
              )
              .join(addColor(', ', Colors.symbol)) +
            addColor(']', Colors.symbol)
          : '';
        const typePart: string = statement.hasExplicitType
          ? addColor(': ', Colors.symbol) +
            printTypeExpression(statement.typeExpression)
          : '';
        // could include multiple comments
        const letBody: string = printExpression(
          statement.body,
          indent + indentSize
        ).trimStart();

        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('let ', Colors.keywordLet) +
              addColor(statement.identifierToken.l, Colors.identifier) +
              genericPart +
              typePart +
              addColor(' = ', Colors.symbol) +
              letBody +
              addColor(';', Colors.symbol)))
        );
      case 'type-alias':
        const genericPart_: string = statement.isGeneric
          ? addColor('[', Colors.symbol) +
            statement.genericIdentifiers
              .map((genericIdentifier) =>
                addColor(genericIdentifier.argument.l, Colors.genericIdentifier)
              )
              .join(addColor(', ', Colors.symbol)) +
            addColor(']', Colors.symbol)
          : '';

        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('type ', Colors.keywordType) +
              addColor(statement.identifierToken.l, Colors.identifier) +
              genericPart_ +
              addColor(' = ', Colors.symbol) +
              printTypeExpression(statement.body).trimStart() +
              addColor(';', Colors.symbol)))
        );
      case 'complex-type':
        const genericPart__: string = statement.isGeneric
          ? addColor('[', Colors.symbol) +
            statement.genericIdentifiers
              .map((genericIdentifier) =>
                addColor(genericIdentifier.argument.l, Colors.genericIdentifier)
              )
              .join(addColor(', ', Colors.symbol)) +
            addColor(']', Colors.symbol)
          : '';
        const bodyStr: string =
          statement.body.length === 0
            ? addColor(' { }', Colors.symbol)
            : addColor(' {\n', Colors.symbol) +
              statement.body
                .map(
                  (complexTypeLine) =>
                    printComments(
                      complexTypeLine.argument.comments,
                      indent + indentSize
                    ) +
                    indent +
                    indentSize +
                    addColor(
                      complexTypeLine.argument.identifierToken.l,
                      Colors.identifier
                    ) +
                    (complexTypeLine.argument.hasBrackets
                      ? addColor('(', Colors.symbol) +
                        complexTypeLine.argument.arguments
                          .map((a) => printTypeExpression(a.argument))
                          .join(addColor(', ', Colors.symbol)) +
                        addColor(')', Colors.symbol)
                      : '')
                )
                .join(addColor(', ', Colors.symbol) + '\n') +
              '\n' +
              indent +
              addColor('}', Colors.symbol);

        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('type ', Colors.keywordType) +
              addColor(statement.identifierToken.l, Colors.identifier) +
              genericPart__ +
              bodyStr))
        );
    }
  }

  function addColor(msg: string, color: string): string {
    if (!colorActive) return msg;

    return htmlActive
      ? `<span style="color: #${color
          .split(';')
          .map((n) => Number(n).toString(16))
          .join('')}">${msg}</span>`
      : `\x1b[38;2;${color}m` + msg + `\u001b[0m`;
  }

  export function beautify(
    code: string,
    settings: {
      withColor?: boolean;
      withComments?: boolean;
      defaultIndentation?: string;
      forHTML?: boolean;
    } = { withColor: true, withComments: true, defaultIndentation: '  ' }
  ): string {
    indentSize = settings.defaultIndentation ?? '  ';
    colorActive = settings.withColor ?? true;
    htmlActive = settings.forHTML ?? false;

    const ast = Parser.parse(code, { ignoreComments: !settings.withComments });
    if (!ast.valid)
      throw new Error(
        `Could not format code because code cannot be parsed. Errors: ${JSON.stringify(
          ast.parseErrors
        )}`
      );
    return beautifyAST(ast.statements);
  }

  export function beautifyAST(
    ast: Parser.statement[],
    currentIndent: string = ''
  ): string {
    let code = '';

    let lastStatementType: string = ast.at(0)?.type ?? '';
    for (const statement of ast) {
      if (lastStatementType !== statement.type) code += '\n';
      lastStatementType = statement.type;
      code += printStatement(statement, currentIndent) + '\n';
    }

    return code;
  }
}
