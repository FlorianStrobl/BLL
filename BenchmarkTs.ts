const iterCount: number = 10;

const len: number = 1_000_000;
const array: string[] = new Array(len)
  .fill(0)
  .map((_) => Math.random().toString());
const test: string =
  Math.random() < 0.5 ? '0.5260477071715572' : array[Math.floor(len / 2)];
const idx = array.indexOf(test);

// function call benchmark
function callme(): boolean {
  return array.includes(test);
}

for (let i = 0; i < iterCount; ++i) {
  console.time('a');

  //let answer = false;
  //for (const t of array) answer = !answer && t === test ? true : answer;
  //for (let i = len - 1; i >= 0; --i)
  //for (let i = 0; i < len; ++i)
  //  answer = !answer && array[i] === test ? true : answer;
  //for (let i = 0; i < len; ++i)
  //  answer = (() => (!answer && array[i] === test ? true : answer))() as any;
  //array.forEach((s) => (answer = !answer && s === test ? true : answer));

  // fast and same speed:
  //let answer = callme();
  //let answer = array.includes(test);
  //let answer = array.indexOf(test) !== -1;
  //let answer = array.lastIndexOf(test) !== -1; // always slower when not found

  // slow and same speed
  //let answer = array.findIndex((s) => s === test) !== -1;
  //let answer = array.some((s) => s === test);
  //let answer = !array.every(s => s !== test);
  //let answer = array.find((s) => s === test) !== undefined;
  //let answer = array.filter((s) => s === test).length !== 0; // no optimization after found

  //let answer = array.slice(0, len);
  //let answer = array.filter(() => true);
  //let answer = array.map((s) => s);
  //let answer = [...array];

  //let answer = array.copyWithin(0, len);

  //let answer = array.length;
  //let answer = array[0];
  //let answer = array[Math.floor(len/2)];
  //let answer = array[len - 1];
  //let answer = array.at(0);
  //let answer = array.at(Math.floor(len/2));
  //let answer = array.at(len - 1);

  console.timeEnd('a');
  console.log(idx /*, answer*/);
}
