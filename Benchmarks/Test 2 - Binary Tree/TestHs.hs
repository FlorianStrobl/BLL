import Data.Time.Clock.POSIX (getPOSIXTime)

data Tree t = Empty | Full (Tree t) t (Tree t)

build_test_tree :: Tree Int
build_test_tree = Full (Full (Full Empty 7 Empty) 4 Empty) 5 (Full Empty 1 Empty)

tree_sum :: Tree Int -> Int
tree_sum Empty = 0
tree_sum (Full left value right) = value + tree_sum left + tree_sum right

for :: Int -> (a -> b) -> a -> IO b
for count func param = do
  let answer = func param

  if count == 1
      then do
        return answer
      else do
        ans <- for (count-1) (func) (param)
        return ans

main :: IO ()
main = do
  let iteration_count = 1000 * 1000 * 10

  timestamp_before <- getPOSIXTime

  s <- for iteration_count tree_sum build_test_tree

  timestamp_after <- getPOSIXTime

  print $ "[Hs] Code with " ++ show iteration_count  ++ " iterations took: " ++ show (timestamp_after - timestamp_before)
  print $ "tree_sum(tree) == " ++ show s