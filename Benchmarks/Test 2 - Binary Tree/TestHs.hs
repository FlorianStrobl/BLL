import System.CPUTime

data Tree t = Empty | Full (Tree t) t (Tree t)

build_test_tree :: Tree Integer
build_test_tree = Full (Full (Full Empty 7 Empty) 4 Empty) 5 (Full Empty 1 Empty)

tree_sum :: Tree Integer -> Integer
tree_sum Empty = 0
tree_sum (Full left value right) = value + tree_sum left + tree_sum right

for :: Integer -> (Tree Integer -> Integer) -> Tree Integer -> IO Integer
for c func param = do
  if c == 0
    then do
      return (func param)
    else do
      next <- for (c-1) func param
      return (func param + next)

main :: IO ()
main = do
  let iteration_count = toInteger (1000 * 1000 * 10)

  timestamp_before <- getCPUTime

  s <- for iteration_count tree_sum build_test_tree

  timestamp_after <- getCPUTime

  print $ "tree_sum(tree) == " ++ show (s `div` iteration_count)
  print $ "[Hs] Code with " ++ show iteration_count  ++ " iterations took: " ++ show (fromIntegral (timestamp_after - timestamp_before) / 10^12)