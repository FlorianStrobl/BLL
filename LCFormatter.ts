// prettier with syntax highlighting and bracket matching (see VSCode)
// + code region folding

export namespace prettier {
  function printExpression(expression: {}): string {
    // if two identifiers or operators are following one each other, put a space in between!!

    return '';
  }

  function printStatement(statement: {}): string {
    // will have expressions in it
    return '';
  }

  export function prettier(ast: {}[], withColor: boolean = false): string {
    let code = '';

    for (const [i, statement] of Object.entries(ast)) {
      code += printStatement(statement) + '\n';

      // if last statement was of type namespace, and next one is too:
      // code += "\n"
    }
    return code;
  }
}
