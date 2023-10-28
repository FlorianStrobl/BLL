#include <stdio.h>
#include <stdlib.h>
#include <time.h>

typedef struct node_t
{
  int value;
  struct node_t *left;
  struct node_t *right;
} Tree;

Tree *new_node(int val)
{
  Tree *n_node = (Tree *)calloc(1, sizeof(Tree));
  n_node->value = val;
  return n_node;
}

Tree *build_test_tree()
{
  Tree *root = new_node(5);

  root->left = new_node(4);
  root->right = new_node(1);
  root->left->left = new_node(7);

  return root;
}

int tree_sum(Tree *tree)
{
  if (tree == NULL)
    return 0;
  return tree->value + tree_sum(tree->left) + tree_sum(tree->right);
}

long get_nanosecond_timestamp()
{
  struct timespec data;
  clock_gettime(CLOCK_REALTIME, &data);
  return data.tv_nsec;
}

int main(int argc, char **argv)
{
  Tree *tree = build_test_tree();

  long long iteration_count = 1000 * 1000 * 10;
  int volatile answer = -1;

  // timer start
  long timestamp_before = get_nanosecond_timestamp();

  for (long long i = 0; i < iteration_count; ++i)
  {
    answer = tree_sum(tree);
  }

  // timer end
  long timestamp_after = get_nanosecond_timestamp();

  printf("[C]  Code with %ld iterations took: %lfs\n", iteration_count, ((double)(timestamp_after - timestamp_before)) * 1.0e-9);

  printf("tree_sum(tree) == %d\n", answer);

  return 0;
}