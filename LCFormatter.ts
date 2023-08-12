// prettier with syntax highlighting and bracket matching (see VSCode)
// + code region folding
// takes the ast as input and returns a string with annotations for VSCode

import { Parser } from './LCParser';
import { Lexer } from './LCLexer';

// TODO

export namespace prettier {
  function printExpression(expression: Parser.expressionT): string {
    // if two identifiers or operators are following one each other, put a space in between!!
    switch (expression.type) {
      case 'unary':
        return `${expression.operator} ${printExpression(expression.body)}`;
      case 'binary':
        return `${printExpression(expression.left)} ${
          expression.operator
        } ${printExpression(expression.right)}`;
      case 'func':
        return `func (TODO) -> ${printExpression(expression.body)}`;
      case 'grouping':
        return `(${printExpression(expression.value)})`;
      case 'literal':
        return expression.literal.lexeme;
      case 'identifier':
        return expression.identifier.lexeme;
      case 'identifier-path':
        return 'TODO';
      case 'functionCall':
        return 'TODO';
    }
    return '';
  }

  function printStatement(statement: Parser.statementT): string {
    function printImportStatement(path: Lexer.token[]): string {
      let str = '';
      for (const p of path) str += p.lexeme;
      return str;
    }

    // will have expressions in it
    switch (statement.type) {
      case ';':
        return ';';
      case 'import':
        return printImportStatement(statement.path) + ';';
      case 'namespace':
        const namespaceBody: string[] = [];
        for (const s of statement.body) {
          namespaceBody.push(printStatement(s));
        }
        return `${statement.public ? 'pub ' : ''}namespace ${
          statement.identifier.lexeme
        } {\n${namespaceBody.join('\n')}\n}`;
      case 'let':
        const expression = printExpression(statement.body);
        return `${statement.public ? 'pub ' : ''}let ${
          statement.identifier.lexeme
        } = ${expression};`;
    }
  }

  export function prettier(
    ast: Parser.statementT[],
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
