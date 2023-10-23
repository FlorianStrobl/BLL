// prettier with syntax highlighting and bracket matching (see VSCode)
// + code region folding
// takes the ast as input and returns a string with annotations for VSCode

import { Parser } from './LCParser';

// TODO, do spaces correctly, do comments, break on too many lines, put use-statements on the very top

export namespace Formatter {
  const Colors = {
    symbol: `${0xab};${0xb2};${0xbf}`, // white
    comments: `${0x98};${0xc3};${0x79}`, // green
    numberLiteral: `${0xe5};${0xc0};${0x7b}`, // green
    standardKeyword: `${0x61};${0xaf};${0xef}`, // blue
    keywordLet: `${0xc6};${0x78};${0xdd}`, // magenta
    keywordType: `${0xc6};${0x78};${0xdd}`, // cyan
    identifier: `${0xe0};${0x6c};${0x75}` // yellow
  };

  const indentSize: string = '  ';

  // helper
  function printComments(
    comments: Parser.token[],
    indent: string,
    withColor: boolean,
    moreIndent: string = ''
  ): string {
    if (comments.length !== 0)
      return (
        comments
          .map(
            (e) =>
              indent + moreIndent + addColor(e.lex, Colors.comments, withColor)
          )
          .join('\n') + '\n'
      );
    return '';
  }

  function printTypeExpression(
    expression: Parser.typeExpression,
    withColor: boolean
  ): string {
    // TODO comments
    switch (expression.type) {
      case 'grouping':
        return (
          addColor('(', Colors.symbol, withColor) +
          printTypeExpression(expression.body, withColor) +
          addColor(')', Colors.symbol, withColor)
        );
      case 'identifier':
        return (
          addColor(
            expression.identifierToken.lex,
            Colors.identifier,
            withColor
            // TODO
          ) +
          (expression.generic.hasGenericSubstitution
            ? addColor('[', Colors.symbol, withColor) +
              expression.generic.values
                .map((e) => printTypeExpression(e.argument, withColor))
                .join(addColor(', ', Colors.symbol, withColor)) +
              addColor(']', Colors.symbol, withColor)
            : '')
        );
      case 'primitive-type':
        return addColor(
          expression.primitiveToken.lex,
          Colors.standardKeyword,
          withColor
        );
      case 'func-type':
        return (
          addColor('(', Colors.symbol, withColor) +
          expression.parameters
            .map((e) => printTypeExpression(e.argument, withColor))
            .join(addColor(', ', Colors.symbol, withColor)) +
          addColor(')', Colors.symbol, withColor) +
          addColor(' -> ', Colors.symbol, withColor) +
          printTypeExpression(expression.returnType, withColor)
        );
    }
  }

  function printExpression(
    expression: Parser.expression,
    withColor: boolean,
    indentation: string
  ): string {
    // TODO comments
    switch (expression.type) {
      case 'grouping':
        return (
          addColor('(', Colors.symbol, withColor) +
          printExpression(expression.body, withColor, indentation) +
          addColor(')', Colors.symbol, withColor)
        );
      case 'literal':
        return addColor(
          expression.literalToken.lex,
          Colors.numberLiteral,
          withColor
        );
      case 'identifier':
        return addColor(
          expression.identifierToken.lex,
          Colors.identifier,
          withColor
        );
      case 'propertyAccess':
        return (
          printExpression(expression.source, withColor, indentation) +
          addColor('.', Colors.symbol, withColor) +
          addColor(expression.propertyToken.lex, Colors.identifier, withColor)
        );
      case 'functionCall':
        return (
          printExpression(expression.function, withColor, indentation) +
          addColor('(', Colors.symbol, withColor) +
          expression.arguments
            .map((e) => printExpression(e.argument, withColor, indentation))
            .join(addColor(', ', Colors.symbol, withColor)) +
          addColor(')', Colors.symbol, withColor)
        );
      case 'unary':
        return (
          addColor(expression.operator, Colors.symbol, withColor) +
          ' ' +
          printExpression(expression.body, withColor, indentation)
        );
      case 'binary':
        return (
          printExpression(expression.leftSide, withColor, indentation) +
          ' ' +
          addColor(expression.operator, Colors.symbol, withColor) +
          ' ' +
          printExpression(expression.rightSide, withColor, indentation)
        );
      case 'func':
        return (
          addColor('func ', Colors.standardKeyword, withColor) +
          addColor('(', Colors.symbol, withColor) +
          expression.parameters
            .map(
              (e) =>
                addColor(
                  e.argument.identifierToken.lex,
                  Colors.identifier,
                  withColor
                ) +
                (e.argument.typeAnnotation.explicitType
                  ? addColor(': ', Colors.symbol, withColor) +
                    printTypeExpression(
                      e.argument.typeAnnotation.typeExpression,
                      withColor
                    )
                  : '') +
                (e.argument.defaultValue.hasDefaultValue
                  ? addColor(' = ', Colors.symbol, withColor) +
                    printExpression(
                      e.argument.defaultValue.value,
                      withColor,
                      indentation
                    )
                  : '')
            )
            .join(addColor(', ', Colors.symbol, withColor)) +
          addColor(')', Colors.symbol, withColor) +
          (expression.returnType.explicitType
            ? addColor(': ', Colors.symbol, withColor) +
              printTypeExpression(
                expression.returnType.typeExpression,
                withColor
              )
            : '') +
          addColor(' => ', Colors.symbol, withColor) +
          printExpression(expression.body, withColor, indentation)
        );
      case 'match':
        // TODO, use indentation if more than one branch is used
        const moreThanOne: boolean = expression.body.length > 1;
        const exactlyOne: boolean = expression.body.length === 1;
        return (
          addColor('match ', Colors.standardKeyword, withColor) +
          addColor('(', Colors.symbol, withColor) +
          printExpression(expression.argBody, withColor, indentation) +
          addColor(')', Colors.symbol, withColor) +
          (expression.explicitType.explicitType
            ? addColor(': ', Colors.symbol, withColor) +
              printTypeExpression(
                expression.explicitType.typeExpression,
                withColor
              )
            : '') +
          addColor(' { ', Colors.symbol, withColor) +
          (moreThanOne ? '\n' + indentation + indentSize : '') +
          // TODO local comments, correct indentation AND args
          expression.body
            .map(
              (e) =>
                addColor(
                  e.argument.identifierToken.lex,
                  Colors.identifier,
                  withColor
                ) +
                (e.argument.parameters.hasParameters
                  ? addColor('(', Colors.symbol, withColor) +
                    e.argument.parameters.parameters
                      .map((a) =>
                        addColor(a.argument.lex, Colors.identifier, withColor)
                      )
                      .join(addColor(', ', Colors.symbol, withColor)) +
                    addColor(')', Colors.symbol, withColor)
                  : '') +
                addColor(' => ', Colors.symbol, withColor) +
                printExpression(e.argument.body, withColor, indentation)
            )
            .join(
              addColor(
                ', ' + (moreThanOne ? '\n' + indentation + indentSize : ''),
                Colors.symbol,
                withColor
              )
            ) +
          (moreThanOne ? '\n' + indentation : exactlyOne ? ' ' : '') +
          addColor('}', Colors.symbol, withColor)
        );
    }
  }

  function printStatement(
    statement: Parser.statement,
    withColor: boolean = false,
    indent: string = ''
  ): string {
    // TODO comments
    switch (statement.type) {
      case 'empty':
        return (
          printComments(statement.comments, indent, withColor) +
          indent +
          addColor(';', Colors.symbol, withColor)
        );
      case 'import':
        return (
          printComments(statement.comments, indent, withColor) +
          (indent +
            (addColor('use ', Colors.standardKeyword, withColor) +
              addColor(statement.filename.lex, Colors.identifier, withColor) +
              addColor(';', Colors.symbol, withColor)))
        );
      case 'group':
        if (statement.body.length === 0)
          return (
            printComments(statement.comments, indent, withColor) +
            indent +
            addColor('group ', Colors.standardKeyword, withColor) +
            addColor(
              statement.identifierToken.lex,
              Colors.identifier,
              withColor
            ) +
            addColor(' { }', Colors.symbol, withColor)
          );

        return (
          printComments(statement.comments, indent, withColor) +
          (indent +
            (addColor('group ', Colors.standardKeyword, withColor) +
              addColor(
                statement.identifierToken.lex,
                Colors.identifier,
                withColor
              ) +
              addColor(' {\n', Colors.symbol, withColor) +
              beautify(statement.body, withColor, indent + indentSize) +
              // statement.body.map((e) => printStatement(e, withColor, indent + indentSize)).join('\n')
              indent +
              addColor('}', Colors.symbol, withColor)))
        );
      case 'let':
        return (
          printComments(statement.comments, indent, withColor) +
          (indent +
            (addColor('let ', Colors.keywordLet, withColor) +
              addColor(
                statement.identifierToken.lex,
                Colors.identifier,
                withColor
              ) +
              (statement.isGeneric
                ? addColor('[', Colors.symbol, withColor) +
                  statement.genericIdentifiers
                    .map((e) =>
                      addColor(e.argument.lex, Colors.identifier, withColor)
                    )
                    .join(addColor(', ', Colors.symbol, withColor)) +
                  addColor(']', Colors.symbol, withColor)
                : '') +
              (statement.explicitType
                ? addColor(': ', Colors.symbol, withColor) +
                  printTypeExpression(statement.typeExpression, withColor)
                : '') +
              addColor(' = ', Colors.symbol, withColor) +
              printExpression(statement.body, withColor, indent) +
              addColor(';', Colors.symbol, withColor)))
        );
      case 'comment':
        return printComments(statement.comments, indent, withColor).trimEnd();
      case 'complex-type':
        const bodyStr: string =
          statement.body.length === 0
            ? addColor(' { }', Colors.symbol, withColor)
            : addColor(' {\n', Colors.symbol, withColor) +
              statement.body
                .map(
                  (e) =>
                    printComments(
                      e.localComments,
                      indent,
                      withColor,
                      indentSize
                    ) +
                    indent +
                    indentSize +
                    addColor(
                      e.argument.identifierToken.lex,
                      Colors.identifier,
                      withColor
                    ) +
                    (e.argument.parameters.hasParametersList
                      ? addColor('(', Colors.symbol, withColor) +
                        e.argument.parameters.value
                          .map((a) =>
                            printTypeExpression(a.argument, withColor)
                          )
                          .join(addColor(', ', Colors.symbol, withColor)) +
                        addColor(')', Colors.symbol, withColor)
                      : '')
                )
                .join(addColor(', ', Colors.symbol, withColor) + '\n') +
              '\n' +
              indent +
              addColor('}', Colors.symbol, withColor);

        return (
          printComments(statement.comments, indent, withColor) +
          (indent +
            (addColor('type ', Colors.keywordType, withColor) +
              addColor(
                statement.identifierToken.lex,
                Colors.identifier,
                withColor
              ) +
              (statement.isGeneric
                ? addColor('[', Colors.symbol, withColor) +
                  statement.genericIdentifiers
                    .map((e) =>
                      addColor(e.argument.lex, Colors.identifier, withColor)
                    )
                    .join(addColor(', ', Colors.symbol, withColor)) +
                  addColor(']', Colors.symbol, withColor)
                : '') +
              bodyStr))
        );
      case 'type-alias':
        return (
          printComments(statement.comments, indent, withColor) +
          (indent +
            (addColor('type ', Colors.keywordType, withColor) +
              addColor(
                statement.identifierToken.lex,
                Colors.identifier,
                withColor
              ) +
              (statement.isGeneric
                ? addColor('[', Colors.symbol, withColor) +
                  statement.genericIdentifiers
                    .map((e) =>
                      addColor(e.argument.lex, Colors.identifier, withColor)
                    )
                    .join(addColor(', ', Colors.symbol, withColor)) +
                  addColor(']', Colors.symbol, withColor)
                : '') +
              addColor(' = ', Colors.symbol, withColor) +
              printTypeExpression(statement.body, withColor) +
              addColor(';', Colors.symbol, withColor)))
        );
    }
  }

  function addColor(msg: string, color: string, active: boolean): string {
    if (!active) return msg;
    //return '\u001b[' + color + 'm' + msg + '\u001b[0m';
    return `\x1b[38;2;${color}m` + msg + `\u001b[0m`;
  }

  export function beautify(
    ast: Parser.statement[],
    withColor: boolean = true,
    indent: string = ''
  ): string {
    let code = '';

    for (const [i, statement] of Object.entries(ast))
      code += printStatement(statement, withColor, indent) + '\n';

    return code;
  }
}

// console.log(
//   Formatter.beautify(
//     Parser.parse(`let x[A]: A = func (x: A = 4
//       +3): A => x;`).statements
//   )
// );

console.log(
  Formatter.beautify(
    Parser.parse(`
    group t {
      let t = match (t) {
        f => match (x) { a() => f, g => c }
      };
    }
`).statements
  )
);

if (false) {
  console.log(
    Formatter.beautify(
      Parser.parse(`
    // hey!
    // more than one
    use test;
    let id[T]: T -> T = func (x: T -> T): T -> T => x /*lol*/ + 3;
    group lol {
      let a = 5;
      // yep
      group test {
        let x: i32 = 6;
        // test
        let y[T] = 4;
        group third {  }
        group thirdToo { let test2 = 4; }
        type what = i32;
      }
      type complex[T, U,] {
        a,
        // huh
        b(f32, i32, T),
        c,
      }
      let simple[T, B] = test.what;
    }
    `).statements,
      true
    )
  );

  console.log(
    Formatter.beautify(
      Parser.parse(`
    let a: f32 = 4.5e3;
    // a
    type cmpx[hey] {
      // b
      A(i32 /*c*/, f32),
      // this test
      // F
      B,
      // d
      C(hey, i32, /*ok works*/),
      D
      // e
    }
    type two {
      // test
    }
    // other
    // test two
    type simpleType = f32 -> (f32, f32) -> i32;
    `).statements,
      true
    )
  );
}
