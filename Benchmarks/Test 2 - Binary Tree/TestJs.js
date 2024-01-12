class node {
  value = 0;
  left;
  right;

  constructor(val) {
    this.value = val;
  }
}

function new_node(val) {
  return new node(val);
}

function build_test_tree() {
  const root = new_node(5);

  root.left = new_node(4);
  root.right = new_node(1);
  root.left.left = new_node(7);

  return root;
}

function tree_sum(tree) {
  if (tree == undefined) return 0;
  return tree.value + tree_sum(tree.left) + tree_sum(tree.right);
}

function main() {
  const tree = build_test_tree();

  const iteration_count = 1000;
  let answer = 0;

  const timerMsg = `[JS] Code with ${iteration_count} iterations took`;

  console.time(timerMsg);
  for (let i = 0; i < iteration_count; ++i) {
    answer = tree_sum(tree);
  }
  console.timeEnd(timerMsg);

  console.log(`tree_sum(tree) == ${answer / iteration_count}`);
}

main();
