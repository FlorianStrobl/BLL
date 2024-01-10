function fac (n) {
 if (n == 0) return 1;
 return n * fac(n-1);
};


function main() {
  const iteration_count = 1000;
  let answer = 0;

  const timerMsg = `[JS] Code with ${iteration_count} iterations took`;

  console.time(timerMsg);
  for (let i = 0; i < iteration_count; ++i) {
    answer += fac(100);
  }
  console.timeEnd(timerMsg);

  console.log(`fac(100) == ${answer/iteration_count}`);
}

main();