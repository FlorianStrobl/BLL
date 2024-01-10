import time

def fac(n):
  if n == 0: return 1
  return n * fac(n-1)

def main():
  iteration_count = 1000
  answer = 0

  # start timer
  timestamp_before = time.time()

  for _ in range(iteration_count):
    answer += fac(100)

  # end timer
  timestamp_after = time.time()

  print("[Py] Code with " + str(iteration_count) + " iterations took: " + str(round((timestamp_after - timestamp_before)*1000, 3)) + "ms")
  print("fac(100) == " + str(answer))

main()
