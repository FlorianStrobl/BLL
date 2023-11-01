// prettier with syntax highlighting and bracket matching (see VSCode)
// + code region folding
// takes the ast as input and returns a string with annotations for VSCode

import { Parser } from './LCParser';

// TODO, do spaces correctly, do comments, break on too many lines, put use-statements on the very top

export namespace Formatter {
  let colorActive: boolean = false;
  const indentSize: string = '  ';

  const Colors = {
    symbol: `${0xab};${0xb2};${0xbf}`, // white
    comments: `${0x98};${0xc3};${0x79}`, // green
    numberLiteral: `${0xe5};${0xc0};${0x7b}`, // green
    standardKeyword: `${0x61};${0xaf};${0xef}`, // blue
    keywordLet: `${0xc6};${0x78};${0xdd}`, // magenta
    keywordType: `${0xc6};${0x78};${0xdd}`, // cyan
    identifier: `${0xe0};${0x6c};${0x75}` // yellow
  };

  // #region helper
  function printComments(
    comments: Parser.token[],
    indent: string,
    moreIndent: string = ''
  ): string {
    return comments.length === 0
      ? ''
      : comments
          .map((e) => indent + moreIndent + addColor(e.lex, Colors.comments))
          .join('\n') + '\n';
  }
  // #endregion

  function printTypeExpression(expression: Parser.typeExpression): string {
    // TODO comments
    switch (expression.type) {
      case 'grouping':
        return (
          printComments(expression.comments, '', '') +
          (addColor('(', Colors.symbol) +
            printTypeExpression(expression.body) +
            addColor(')', Colors.symbol))
        );
      case 'identifier':
        return (
          printComments(expression.comments, '', '') +
          (addColor(expression.identifierToken.lex, Colors.identifier) +
            (expression.generic.hasGenericSubstitution
              ? addColor('[', Colors.symbol) +
                expression.generic.substitutions
                  .map((e) => printTypeExpression(e.argument))
                  .join(addColor(', ', Colors.symbol)) +
                addColor(']', Colors.symbol)
              : ''))
        );
      case 'primitive-type':
        return (
          printComments(expression.comments, '', '') +
          addColor(expression.primitiveToken.lex, Colors.standardKeyword)
        );
      case 'func-type':
        return (
          printComments(expression.comments, '', '') +
          (addColor('(', Colors.symbol) +
            expression.parameters
              .map((e) => printTypeExpression(e.argument))
              .join(addColor(', ', Colors.symbol)) +
            addColor(')', Colors.symbol) +
            addColor(' -> ', Colors.symbol) +
            printTypeExpression(expression.returnType))
        );
    }
  }

  function printExpression(
    expression: Parser.expression,
    indentation: string
  ): string {
    switch (expression.type) {
      case 'grouping':
        return (
          printComments(expression.comments, indentation, '') +
          (addColor('(', Colors.symbol) +
            printExpression(expression.body, indentation) +
            addColor(')', Colors.symbol))
        );
      case 'literal':
        return (
          printComments(expression.comments, indentation, '') +
          addColor(expression.literalToken.lex, Colors.numberLiteral)
        );
      case 'identifier':
        return (
          printComments(expression.comments, indentation, '') +
          addColor(expression.identifierToken.lex, Colors.identifier)
        );
      case 'propertyAccess':
        return (
          printComments(expression.comments, indentation, '') +
          (printExpression(expression.source, indentation) +
            addColor('.', Colors.symbol) +
            addColor(expression.propertyToken.lex, Colors.identifier))
        );
      case 'call':
        return (
          printComments(expression.comments, indentation, '') +
          (printExpression(expression.function, indentation) +
            addColor('(', Colors.symbol) +
            expression.arguments
              .map((e) => printExpression(e.argument, indentation))
              .join(addColor(', ', Colors.symbol)) +
            addColor(')', Colors.symbol))
        );
      case 'unary':
        return (
          printComments(expression.comments, indentation, '') +
          (addColor(expression.operator, Colors.symbol) +
            ' ' +
            printExpression(expression.body, indentation))
        );
      case 'binary':
        return (
          printComments(expression.comments, indentation, '') +
          (printExpression(expression.leftSide, indentation) +
            ' ' +
            addColor(expression.operator, Colors.symbol) +
            ' ' +
            printExpression(expression.rightSide, indentation))
        );
      case 'func':
        return (
          printComments(expression.comments, indentation, '') +
          (addColor('func ', Colors.standardKeyword) +
            addColor('(', Colors.symbol) +
            expression.parameters
              .map(
                (e) =>
                  addColor(e.argument.identifierToken.lex, Colors.identifier) +
                  (e.argument.typeAnnotation.explicitType
                    ? addColor(': ', Colors.symbol) +
                      printTypeExpression(
                        e.argument.typeAnnotation.typeExpression
                      )
                    : '') +
                  (e.argument.defaultValue.hasDefaultValue
                    ? addColor(' = ', Colors.symbol) +
                      printExpression(
                        e.argument.defaultValue.value,
                        indentation
                      )
                    : '')
              )
              .join(addColor(', ', Colors.symbol)) +
            addColor(')', Colors.symbol) +
            (expression.returnType.explicitType
              ? addColor(': ', Colors.symbol) +
                printTypeExpression(expression.returnType.typeExpression)
              : '') +
            addColor(' => ', Colors.symbol) +
            printExpression(expression.body, indentation))
        );
      case 'match':
        // TODO, use indentation if more than one branch is used
        const moreThanOne: boolean = expression.body.length > 1;
        const exactlyOne: boolean = expression.body.length === 1;
        return (
          printComments(expression.comments, indentation, '') +
          (addColor('match ', Colors.standardKeyword) +
            addColor('(', Colors.symbol) +
            printExpression(expression.scrutinee, indentation) +
            addColor(')', Colors.symbol) +
            (expression.explicitType.explicitType
              ? addColor(': ', Colors.symbol) +
                printTypeExpression(expression.explicitType.typeExpression)
              : '') +
            addColor(' { ', Colors.symbol) +
            (moreThanOne ? '\n' + indentation + indentSize : '') +
            // TODO local comments, correct indentation AND args
            expression.body
              .map(
                (e) =>
                  (e.argument.isDefaultVal
                    ? ''
                    : addColor(
                        e.argument.identifierToken.lex,
                        Colors.identifier
                      ) +
                      (e.argument.parameters.length !== 0
                        ? addColor('(', Colors.symbol) +
                          e.argument.parameters
                            .map((a) =>
                              addColor(a.argument.lex, Colors.identifier)
                            )
                            .join(addColor(', ', Colors.symbol)) +
                          addColor(')', Colors.symbol)
                        : '')) +
                  addColor(' => ', Colors.symbol) +
                  printExpression(e.argument.body, indentation)
              )
              .join(
                addColor(
                  ', ' + (moreThanOne ? '\n' + indentation + indentSize : ''),
                  Colors.symbol
                )
              ) +
            (moreThanOne ? '\n' + indentation : exactlyOne ? ' ' : '') +
            addColor('}', Colors.symbol))
        );
    }
  }

  function printStatement(
    statement: Parser.statement,
    indent: string = ''
  ): string {
    // TODO comments
    switch (statement.type) {
      case 'empty':
        return (
          printComments(statement.comments, indent) +
          indent +
          addColor(';', Colors.symbol)
        );
      case 'import':
        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('use ', Colors.standardKeyword) +
              addColor(statement.filename.lex, Colors.identifier) +
              addColor(';', Colors.symbol)))
        );
      case 'group':
        if (statement.body.length === 0)
          return (
            printComments(statement.comments, indent) +
            indent +
            addColor('group ', Colors.standardKeyword) +
            addColor(statement.identifierToken.lex, Colors.identifier) +
            addColor(' { }', Colors.symbol)
          );

        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('group ', Colors.standardKeyword) +
              addColor(statement.identifierToken.lex, Colors.identifier) +
              addColor(' {\n', Colors.symbol) +
              beautify(statement.body, indent + indentSize) +
              // statement.body.map((e) => printStatement(e, withColor, indent + indentSize)).join('\n')
              indent +
              addColor('}', Colors.symbol)))
        );
      case 'let':
        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('let ', Colors.keywordLet) +
              addColor(statement.identifierToken.lex, Colors.identifier) +
              (statement.isGeneric
                ? addColor('[', Colors.symbol) +
                  statement.genericIdentifiers
                    .map((e) => addColor(e.argument.lex, Colors.identifier))
                    .join(addColor(', ', Colors.symbol)) +
                  addColor(']', Colors.symbol)
                : '') +
              (statement.explicitType
                ? addColor(': ', Colors.symbol) +
                  printTypeExpression(statement.typeExpression)
                : '') +
              addColor(' = ', Colors.symbol) +
              printExpression(statement.body, indent) +
              addColor(';', Colors.symbol)))
        );
      case 'comment':
        return printComments(statement.comments, indent).trimEnd();
      case 'complex-type':
        const bodyStr: string =
          statement.body.length === 0
            ? addColor(' { }', Colors.symbol)
            : addColor(' {\n', Colors.symbol) +
              statement.body
                .map(
                  (e) =>
                    printComments(e.argument.comments, indent, indentSize) +
                    indent +
                    indentSize +
                    addColor(
                      e.argument.identifierToken.lex,
                      Colors.identifier
                    ) +
                    (e.argument.parameters.hasParameterList
                      ? addColor('(', Colors.symbol) +
                        e.argument.parameters.value
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
              addColor(statement.identifierToken.lex, Colors.identifier) +
              (statement.isGeneric
                ? addColor('[', Colors.symbol) +
                  statement.genericIdentifiers
                    .map((e) => addColor(e.argument.lex, Colors.identifier))
                    .join(addColor(', ', Colors.symbol)) +
                  addColor(']', Colors.symbol)
                : '') +
              bodyStr))
        );
      case 'type-alias':
        return (
          printComments(statement.comments, indent) +
          (indent +
            (addColor('type ', Colors.keywordType) +
              addColor(statement.identifierToken.lex, Colors.identifier) +
              (statement.isGeneric
                ? addColor('[', Colors.symbol) +
                  statement.genericIdentifiers
                    .map((e) => addColor(e.argument.lex, Colors.identifier))
                    .join(addColor(', ', Colors.symbol)) +
                  addColor(']', Colors.symbol)
                : '') +
              addColor(' = ', Colors.symbol) +
              printTypeExpression(statement.body) +
              addColor(';', Colors.symbol)))
        );
    }
  }

  function addColor(msg: string, color: string): string {
    if (!colorActive) return msg;
    //return '\u001b[' + color + 'm' + msg + '\u001b[0m';
    return `\x1b[38;2;${color}m` + msg + `\u001b[0m`;
  }

  export function beautify(
    ast: Parser.statement[],
    indent: string = '',
    withColor: boolean = true
  ): string {
    colorActive = withColor;
    let code = '';

    for (const [i, statement] of Object.entries(ast))
      code += printStatement(statement, indent) + '\n';

    return code;
  }
}

console.log(
  Formatter.beautify(
    Parser.parse(`
let x: i32
// test
= /*ok*/5 /*hey*/;`).statements
  )
);
