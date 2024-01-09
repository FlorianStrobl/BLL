import time

class node:
  def __init__(self, val):
    self.value = val
    self.left = None
    self.right = None

def new_node(val):
  return node(val)

def build_test_tree():
  root = new_node(5)

  root.left = new_node(4)
  root.right = new_node(1)
  root.left.left = new_node(7)

  return root

def tree_sum(tree):
  if tree is None:
    return 0
  return tree.value + tree_sum(tree.left) + tree_sum(tree.right)

def main():
  tree = build_test_tree()

  iteration_count = 1000 * 1000 * 10
  answer = 0

  # start timer
  timestamp_before = time.time()

  for _ in range(iteration_count):
    answer += tree_sum(tree)

  # end timer
  timestamp_after = time.time()

  print("[Py] Code with " + str(iteration_count) + " iterations took: " + str(round(timestamp_after - timestamp_before, 3)) + "s")
  print("tree_sum(tree) == " + str(int(answer/iteration_count)))

main()
