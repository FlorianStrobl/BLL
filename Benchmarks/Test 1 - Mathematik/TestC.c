#include <stdio.h>
#include <stdlib.h>
#include <time.h>

unsigned long long fac(unsigned long long n) {
  if (n == 0) return 1;
  else return n * fac(n - 1);
}

long get_nanosecond_timestamp()
{
  struct timespec data;
  clock_gettime(CLOCK_REALTIME, &data);
  return data.tv_nsec;
}

int main(void) {

  // timer start
  long timestamp_before = get_nanosecond_timestamp();

  unsigned long long tmp;
  for (int i = 0; i < 1000; ++i) {
    tmp = fac(100);
  }

  // timer end
  long timestamp_after = get_nanosecond_timestamp();


  printf("[C]  Code with %ld iterations took: %lfms\n", 1000, ((double)(timestamp_after - timestamp_before)) * 1.0e-6);

  printf("fac(100) == %d\n", tmp);
}