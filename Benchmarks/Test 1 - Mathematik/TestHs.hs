import Data.Time

fac :: Integer -> IO Integer
fac n = do
  if n == 0
    then do
      return 1
    else do
      next <- fac (n-1)
      return (n * next)

for :: Integer -> (Integer -> IO Integer) -> Integer -> IO Integer
for c func param = do
  if c == 0
    then do
      int <- (func param)
      return int
    else do
      next <- for (c-1) func param
      return next

main :: IO ()
main = do
  let iteration_count = toInteger 1000

  timestamp_before <- getCurrentTime

  s <- for iteration_count fac 100

  timestamp_after <- getCurrentTime

  print $ "fac(100) == " ++ show (s)
  let diff = diffUTCTime timestamp_after timestamp_before
  print $ "[Hs] Code with " ++ show iteration_count  ++ " iterations took: " ++ show (diff)