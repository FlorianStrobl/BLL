// prettier with syntax highlighting and bracket matching (see VSCode)
// + code region folding
// takes the ast as input and returns a string with annotations for VSCode

import { Parser } from './LCParser';

// TODO

export namespace Prettier {
  function printTypeExpression(expression: Parser.typeExpression): string {
    // TODO comments
    switch (expression.type) {
      case 'grouping':
        return `(${printTypeExpression(expression.body)})`;
      case 'identifier':
        return expression.identifierToken.lexeme;
      case 'primitive-type':
        return expression.primitiveToken.lexeme;
      case 'func-type':
        return `(${expression.parameters
          .map((e) => printTypeExpression(e.argument))
          .join(', ')}) -> ${printTypeExpression(expression.returnType)}`;
    }
  }

  function printExpression(expression: Parser.expression): string {
    // TODO comments
    switch (expression.type) {
      case 'grouping':
        return `(${printExpression(expression.body)})`;
      case 'literal':
        return expression.literalToken.lexeme;
      case 'identifier':
        return expression.identifierToken.lexeme;
      case 'propertyAccess':
        return `${printExpression(expression.source)}.${
          expression.propertyToken.lexeme
        }`;
      case 'functionCall':
        return `${printExpression(expression.function)}(${expression.arguments
          .map((e) => printExpression(e.argument))
          .join(', ')})`;
      case 'unary':
        return `${expression.operator} ${printExpression(expression.body)}`;
      case 'binary':
        return `${printExpression(expression.leftSide)} ${
          expression.operator
        } ${printExpression(expression.rightSide)}`;
      case 'func':
        return `func (${expression.parameters
          .map(
            (e) =>
              e.argument.identifierToken.lexeme +
              (e.argument.typeAnnotation.hasTypeAnnotation
                ? `: ${printTypeExpression(
                    e.argument.typeAnnotation.typeExpression
                  )}`
                : '')
          )
          .join(', ')})${
          expression.returnType.explicitType === true
            ? ': ' + printTypeExpression(expression.returnType.typeExpression)
            : ''
        } => ${printExpression(expression.body)}`;
      case 'match':
        return 'TODO';
    }
  }

  function printStatement(statement: Parser.statement): string {
    // TODO comments
    switch (statement.type) {
      case 'empty':
        return ';';
      case 'import':
        return statement.filename + ';';
      case 'group':
        return `group ${statement.identifierToken.lexeme} {\n${statement.body
          .map(printStatement)
          .join('\n')}\n}`;
      case 'let':
        return `let ${statement.identifierToken.lexeme}${
          statement.isGeneric
            ? `[${statement.genericIdentifiers
                .map((e) => e.argument.lexeme)
                .join(', ')}]`
            : ''
        }${
          statement.explicitType === true
            ? ': ' + printTypeExpression(statement.typeExpression)
            : ''
        } = ${printExpression(statement.body)};`;
      case 'comment':
        return statement.comments.join('\n');
      case 'complex-type':
        return 'TODO';
      case 'type-alias':
        return `type ${
          statement.identifierToken.lexeme
        } = ${printTypeExpression(statement.typeValue)};`;
    }
  }

  export function prettier(
    ast: Parser.statement[],
    withColor: boolean = false
  ): string {
    let code = '';

    for (const [i, statement] of Object.entries(ast)) {
      code += printStatement(statement) + '\n';

      // if last statement was of type namespace, and next one is too:
      // code += "\n"
    }
    return code;
  }
}

console.log(
  Prettier.prettier(
    Parser.parse(
      'let id[T]: (T -> T) -> (T -> T) = func (x: T -> T): T -> T => x;'
    ).statements
  )
);
