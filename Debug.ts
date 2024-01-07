import { Lexer } from './LCLexer';
import { Parser } from './LCParser';

// #region test codes
const mustLexe: [string, number][] = [
  // TODO, should lexe those?
  [`5let`, 2],
  [`5test`, 2],
  ['0b1F', 2],
  ['0xAx', 2],
  [`09A4`, 2],
  ['0A', 2],
  ['0X', 2],
  ['0B', 2],
  ['0O', 2],
  ['0E0', 1],
  ['03434a35', 2],
  ['0x0243F02F_34FA_a', 1],
  ['nan', 1],
  ['inf', 1],
  ['//', 1],
  ['// ', 1],
  ['/**/', 1],
  ['/**/ ', 1],
  ['// 😀', 1],
  ['/*😀*/', 1],
  ['//test\n//other comment', 2],
  ['// ?', 1],
  ['.5', 2],
  [
    'a id+a _a___b3c_ + ++ -+ => 3 0.4e2 0.5e-2 0xff 0b10101 0o4025 /**comment / with * **/ let keywords // test comment ??',
    21
  ],
  ['', 0],
  ['let x = (func (a) => a)(3+1);', 17],
  [
    `
let num: i32 /* signed */ = + 5.5_3e+2; // an integer
/**/`,
    11
  ],
  [
    `
use std;
// use my_libs/./wrong_lib/../math_lib/./my_math_lib.bl l;

let num1 = 5;
let num2 = 0x5;
let num3 = 0b1;
let num4 = 0o7;

/* You can /* nest comments * / by escaping slashes */

// example code
let a: i32 = IO.in[i32](0); // gets an i32 from the console
let b: i32 = Math.sq(a); // a ** 2, TO DO compiler/interpreter must deduce that Math.sq[i32] is called and not Math.sq[f64]
let c: i32 = IO.out(b); // prints b and assigneds b to c
let a: i32 = 3 == 3;

let d = func (x: i32) => 5_4.1e-3;
// 5, 5.1e2,  5., 5e, 5e., 5.e, 5.1e, 5e1., 5e1.2
`,
    90
  ],
  [
    `;
/**//**/
/**/5
/**/let
/**/test
/**/+

5/**/
// 5"hey"
// 5let
// 5test
5+

let/**/
// let"hey", lexer error!
letlet // identifier
lettest // identifier
let+

test/**/
// test"hey", lexer error!
testlet // identifier
testtest
test+

+/**/
+5
+let
+test
+* // two operators

5 5.1e2 51.0e-3
01_23_45_67_89
0123456789 0b1010 0x0123456789ABCDEFabcdef 0o01234567

/* You can /* nest comments *e/ by escaping slashes */

- > * -> * - >* ->*

_

~ & | ^ + - * / % = ( ) [ ] { } < > : ; . , !

! * ** ** + - % / < > = == != <= >= << >> ~ & | ^ : ; . , -> => () [] {} //

********

~~5

// "string"

;`,
    132
  ],
  ['let x: i32 = 5;', 7],
  ['', 0],
  [' ', 0],
  [' \t\n\r', 0],
  ['5/**/identifier;3++hey//', 9],
  [';', 1],
  ['a', 1],
  ['_', 1],
  ['let', 1],
  ['identifier_', 1],
  ['id1_ id_2 _id3', 3],
  ['//', 1],
  [`*/`, 2],
  ['/**/', 1],
  ['.5', 2],
  [`/regexp/`, 3],
  ['0', 1],
  ['5', 1],
  ['5.3', 1],
  ['5.3e3', 1],
  ['5.3e+3', 1],
  ['5.3e-3', 1],
  ['5e3', 1],
  ['0b0', 1],
  ['0b01', 1],
  ['0x0', 1],
  ['0x0123456789abcdefABCDEF', 1],
  ['0o0', 1],
  ['0o01234567', 1],
  [`0_0_1_2_3_4_5_6_7_8_9_3.0_1_2_3e+0_1_2_3`, 1],
  [`_0_0_1_2_3_4_5_6_7_8_9_3.0_1_2_3e-0_1_2_3`, 3],
  ['~', 1],
  ['!', 1],
  ['%', 1],
  ['^', 1],
  ['&', 1],
  ['*', 1],
  ['(', 1],
  [')', 1],
  ['_', 1],
  ['-', 1],
  ['+', 1],
  ['=', 1],
  ['[', 1],
  ['{', 1],
  [']', 1],
  ['}', 1],
  ['|', 1],
  [';', 1],
  [':', 1],
  ['/', 1],
  ['.', 1],
  ['>', 1],
  [',', 1],
  ['<', 1],
  ['0xa+3', 3],
  ['0xE+3', 3],
  ['0xaE+3', 3],
  ['03_4.2', 1],
  ['0xeee', 1],
  ['534e354', 1],
  ['03_3.0_2', 1],
  ['0.0e-0', 1],
  ['0e0', 1],

  [
    `type test {
  t1,
  t2(a.x)
}

type a {
  x(i32, f64, i32)
}

type optional[t] {
  None,
  Some(t)
}

let f = func (x: test): optional[a] =>
  match(x): optional[a] {
    test.t1 => optional.None;
    test.t2(aa, bb, cc) => optional.Some(a.x(aa, bb, cc));
  };`,
    99
  ]
  //...symbols.map((e: string) => [e, 1] as [string, number]),
  //...keywords.map((e: string) => [e, 1] as [string, number])
];
const mustNotLexe: [string, number][] = [
  ['5E', 1],
  ['0x', 1],
  ['0b', 1],
  ['0o', 1],
  ['0o ', 1],
  ['0x ', 1],
  ['0b ', 1],
  ['0789_234_52._3_e3', 1],
  ['0789_234_52.3e3.3e2.', 1],
  ['4___2._3_', 1],
  ['4___2.__3_', 1],
  ['4___2._3__', 1],
  ['0x_0243F02F_34FA_a', 1],
  ['0x0243F02F_34FA_a_', 1],
  ['0b10230x1', 1],
  ['/*/', 1],
  ['/*/ ', 1],
  ['/*f/', 1],
  ['/**f/', 1],
  ['0xlk', 1],
  ['😀😀😀 3__4', 2],
  ['0b12', 1],
  ['0o78', 1],
  ['0o79', 1],
  ['0oA', 1],
  ['0bA', 1],
  ['03_.2', 1],
  ['03._2', 1],
  ['03.0__2', 1],
  ['03__3.0_2', 1],
  ['"string"', 1],
  ['5.3.2', 1],
  ['"😀"', 1],
  ['"""', 2],
  [`\\`, 1],
  [`'`, 1],
  [`\``, 1],
  [`"`, 1],
  [`?`, 1],
  [`@`, 1],
  [`#`, 1],
  [`$`, 1],
  [`0_3_.0_3e+0_3`, 1],
  [`😀 ඒ ქ ℂ ∑ ぜ ᾙ ⅶ 潼`, 9],
  [`5e1.`, 1],
  [`5e1.2`, 1],
  [`5.1e`, 1],
  [`5.e`, 1],
  [`5e.`, 1],
  [`5e`, 1],
  [`0b12A3`, 1],
  [`0xP`, 1],
  [`0o99A`, 1],
  ['/*', 1],
  ['/* ', 1],
  ['/**', 1],
  ['/** ', 1],
  ['/*/', 1],
  ['/* * /', 1],
  ['/*** /', 1],
  ['5.', 1],
  ['5_', 1],
  ['5_3_', 1],
  ['5__3', 1],
  ['5e', 1],
  ['5e+', 1],
  ['5e3.6', 1],
  ['5e-', 1],
  ['0x', 1],
  ['0o', 1],
  ['0b', 1],
  ['0b123', 1],
  ['0o178', 1],
  ['0_.0e-0', 1],
  ['0_.e-0', 1],
  ['0.e-0', 1],
  ['0.0e-', 1],
  ['0.0e+', 1],
  ['0.0e', 1],
  ['0.e', 1],
  ['0.e0', 1],
  ['\\u1234', 1],
  ['\\uFFfF', 1],
  ['\\uxy', 1],
  ['51.e-3', 1],
  ['0o012345678', 1],
  ['"', 1],
  ['5..3', 1],
  ['5e1e2', 1], // TODO, why?
  ["'\\u4zzz'", 1],
  ["'\\u '", 1],
  ["'\\t'", 1],
  ["'", 1],
  ["''", 1],
  ['``', 1],
  ['""', 1],
  ["'\\\\'", 1],
  ["'\\\\\\'", 1],
  [
    "'\
[hey'",
    1
  ],
  ['5e_4', 1]
];

const mustParse: [string, number][] = [
  ['type t = (a,h) -> (b,c,) -> (c);', 1],
  [
    `type linkedList[T] {
  null,
  value(T, linkedList)
}

let my_list =
  linkedList->value(3, linkedList->value(2, linkedList->null));

let sum = func (ll) => match (ll) {
  null => 0,
  value(data, next) => data + sum(next)
};

let main = func (a) => sum(my_list);`,
    4
  ],
  [
    `
group ns {
  type BinTree[T] {
    empty,
    full(BinTree[T], T, BinTree[T])
  }

  let const = 3;
}

group inners {
let test: ns.BinTree[i32] = func (x) => x + multSwap + ns.const + y;
}

// 0
type Never { }
// 1
type Unit { u }
// 2
type Bool { true, false }

// *
type Tuple[A, B] { tup(A, B) }
// +
type Or[A, B] { either(A), or(B) }

type add[A, B] = Or[A, B];
type mult[A, B] = Tuple[A, B];

// commutativity of mult
let multSwap[A, B] = func (x: mult[A, B]): mult[B, A] =>
  match (x) {
    tup(a, b) => Tuple->tup(b, a)
  };
// associativity of mult 1
let multReorder1[A, B, C] = func (x: mult[A, mult[B, C]]): mult[mult[A, B], C] =>
  match (x) {
    tup(a, y) => match (y) {
      tup(b, c) => Tuple->tup(Tuple->tup(a, b), c)
    }
  };
// associativity of mult 2
let multReorder2[A, B, C] = func (x: mult[mult[A, B], C]): mult[A, mult[B, C]] =>
  match (x) {
    tup(y, c) => match (y) {
      tup(a, b) => Tuple->tup(a, Tuple->tup(b, c))
    }
  };
// identity of mult
let multIdentity[A] = func (x: mult[A, Unit]): A =>
  match (x) {
    tup(a, unit) => a
  };
// absorbtion of mult
let multAbsorb[A] = func (x: mult[A, Never]): Never => match (x) { => x /*TODO, empty match is ok for "Never" types*/ };

// identity of add
let addIdentity[A] = func (x: add[A, Never]): A =>
  match (x) {
    either(a) => a,
    or(b) => b // TODO is a "Never" type, so it is assignable to A
  };

let distributivity1[A, B, C] = func (x: mult[A, add[B, C]]): add[mult[A, B], mult[A, C]] =>
  match (x) {
    tup(a, y) => match (y) {
      either(b) => Or->either(Tuple->tup(a, b)),
      or(c) => Or->or(Tuple->tup(a, c))
    }
  };`,
    16
  ],
  [
    `// 0
type Never { }
// 1
type Unit { u }
// 2
type Bool { true, false }

// *
type Tuple[A, B] { tup(A, B) }
// +
type Or[A, B] { either(A), or(B) }

type add[A, B] = Or[A, B];
type mult[A, B] = Tuple[A, B];

// commutativity of mult
let multSwap[A, B] = func (x: mult[A, B]): mult[B, A] =>
  match (x) {
    tup(a, b) => Tuple.tup(b, a)
  };
// associativity of mult 1
let multReorder1[A, B, C] = func (x: mult[A, mult[B, C]]): mult[mult[A, B], C] =>
  match (x) {
    tup(a, y) => match (y) {
      tup(b, c) => Tuple.tup(Tuple.tup(a, b), c)
    }
  };
// associativity of mult 2
let multReorder2[A, B, C] = func (x: mult[mult[A, B], C]): mult[A, mult[B, C]] =>
  match (x) {
    tup(y, c) => match (y) {
      tup(a, b) => Tuple.tup(a, Tuple.tup(b, c))
    }
  };
// identity of mult
let multIdentity[A] = func (x: mult[A, Unit]): A =>
  match (x) {
    tup(a, unit) => a
  };
// absorbtion of mult
let multAbsorb[A] = func (x: mult[A, Never]): Never => match (x) { => x /*TODO, empty match is ok for "Never" types*/ };

// identity of add
let addIdentity[A] = func (x: add[A, Never]): A =>
  match (x) {
    either(a) => a,
    or(b) => b // TODO is a "Never" type, so it is assignable to A
  };

let distributivity1[A, B, C] = func (x: mult[A, add[B, C]]): add[mult[A, B], mult[A, C]] =>
  match (x) {
    tup(a, y) => match (y) {
      either(b) => Or.either(Tuple.tup(a, b)),
      or(c) => Or.or(Tuple.tup(a, c))
    }
  };`,
    14
  ],
  [
    `//let main = func () => 5;

//let x = 5 + hey; // should error because no hey is in scope
//let f = func (x) => func (x) => x+0; // x is of type i32
//let g = f(4)(5) == 5;

use std;

type l = std.h;

type a = i32;
type b = ((filename).a);
type c[a] = a -> b;

//type y = ((((i32)) -> ((f64)))).test.hey;

type lol[k] {
  a(i32),
  b(b, k, lol)
}

group hey {
  type x = ((((filename))).hey).inner.hasAccess;
  type x2 = hey.inner.hasAccess;
  type x3 = inner.hasAccess;
  // type x4 = hasAccess; // error
  type b = x[((i32)) -> i32];
  // type c = f; // cant find it

  group inner {
    type hasAccess = b[b, i32, x]; // should be /filename/hey/b
  }
}

group other {
  group inner {
    group inner {}
  }
  group val {}
}

group h {
  type f {
    g(i32, i32, i32, i32)
  }
}

let a = h.f->g(34,62,5,73);`,
    10
  ],
  [
    `group h {
  type f {
    g(i32, i32, i32, i32)
  }
}

let a = h.f->g(34,62,5,73);`,
    2
  ],
  [`let a = h.f->g(34,62,5,73);`, 1],
  [`type x = b[i32 -> i32];`, 1],
  [`type x = ((((i32)) -> ((f64)))).test.hey;`, 1],
  [`type x = (i32 -> f64).test;`, 1],
  [
    `// hey!
/*mhm*/
use std;
use hey;

let main = func () => 5;

let f = func (x) => func (x) => x;
let g = f(4)(5) == 5;

// group test {
//   type whut = i32;
// }

group test {
  group inner {
    let main: complex[(i32)] = other;
  }

  let main = 4;
  //use hey;
  type whut = /*above comment*/ (((i32))) -> ((f23));
  type lal {
    way1,
    // per branch comment
    way2(),
    way3((i32), f64)
  }

  let test[hey]: i32 -> hey = func /*first*/ (x: i32 = 5): i32 => /*above comment*/ /*and second*/ -x /*and third*/ + 1 / inf != nan;

  type test = i32;

  //let x = match (x) { /*test comment*/ };
  //let x = match (x): i32 { };
  let x = match (x) { => 4, };
  //let x = match (x) { a => 4, };
  //let x = match (x) { a(h,l,m) => 4, };
  //let x = match (x) { a(h,l,m) => 4, /*per branch comment*/ b => 5 };
  //let x = match (x) { a(h,l,m) => 4, => 5 };
}`,
    6
  ],
  [
    `let f = func (x) => func (x) => x;
let g = f(4)(5) == 5;`,
    2
  ],
  [`/*test*/type T[a] = a;\nlet x: () -> i32 = func (): T[(i32)] => 5-1;`, 2],
  [
    `
// hey!
/*mhm*/
use std;
use hey;

let main = 5;

group test {
let main = 4;
//use hey;
type whut = /*above comment*/ (((i32))) -> ((f23));
type lal {
way1,
// per branch comment
way2(),
way3((i32), f64)
}
let test[hey]: i32 -> hey = func /*first*/ (x: i32 = 5): i32 => /*above comment*/ /*and second*/ -x /*and third*/ + 1 / inf != nan;

//let x = match (x) { /*test comment*/ };
//let x = match (x): i32 { };
let x = match (x) { => 4, };
//let x = match (x) { a => 4, };
//let x = match (x) { a(h,l,m) => 4, };
//let x = match (x) { a(h,l,m) => 4, /*per branch comment*/ b => 5 };
//let x = match (x) { a(h,l,m) => 4, => 5 };
}`,
    4
  ],
  [
    `// hey!
/*mhm*/
use std;

group test {
  type whut = /*above comment*/ i32;
  type lal {
    way1,
    // per branch comment
    way2(),
    way3(i32, f64)
  }
  let test[hey]: i32 -> hey = func /*first*/ (x: i32 = 5): i32 => /*above comment*/ /*and second*/ -x /*and third*/ + 1 / inf != nan;

  //let x = match (x) { /*test comment*/ };
  //let x = match (x): i32 { };
  let x = match (x) { => 4, };
  let x = match (x) { a => 4, };
  let x = match (x) { a(h,l,m) => 4, };
  let x = match (x) { a(h,l,m) => 4, /*per branch comment*/ b => 5 };
  let x = match (x) { a(h,l,m) => 4, => 5 };
}`,
    2
  ],
  [
    `//let x = match (x) { };
  //let x = match (x): i32 { };
  let x = match (x) { => 4, };
  let x = match (x) { a => 4, };
  let x = match (x) { a(h,l,m) => 4, };
  let x = match (x) { a(h,l,m) => 4, b => 5 };
  let x = match (x) { a(h,l,m) => 4, => 5 };`,
    5
  ],
  [
    `  group t {
  let t = match (t) {
    f => match (x) { a() => f, g => c }
  };
}
    // hey!
  // more than one
  use test;
  let id[T]: T -> T = func (x: T -> T): T -> T => x /*lol*/ + 3;
  group lol {
    let a = 5;
    // yep
    group test {
      let x: i32 = 6;
      // test
      let y[T] = 4;
      group third {  }
      group thirdToo { let test2 = 4; }
      type what = i32;
    }
    type complex[T, U,] {
      a,
      // huh
      b(f64, i32, T),
      c,
    }
    let simple[T, B] = test.what;
  }
  let a: f64 = 4.5e3;
  // a
  type cmpx[hey] {
    // b
    A(i32 /*c*/, f64),
    // this test
    // F
    B,
    // d
    C(hey, i32, /*ok works*/),
    D
    // e
  }
  type two {
    // test
  }
  // other
  // test two
  type simpleType = f64 -> (f64, f64) -> i32;`,
    8
  ],
  [
    `let x[A]: A = func (x: A = 4
         +3): A => x;`,
    1
  ],
  [
    `let f = match (x) {
a => 5,
b => 3,
=> c // default value
};`,
    1
  ],
  [
    `let f = match (x) {
  a => 5,
  b => 3,
  => c, // default value
};`,
    1
  ],
  [
    `let x = func (x: i32 = 5) => x;
let a = 5(0)(3);`,
    2
  ],
  [`let id[T]: (T -> T) -> (T -> T) = func (x: T -> T): T -> T => x;`, 1],
  [
    `  let f = func (a: x[i32]): x[i32] => a;
type x[T] = T;
type ZeroVariants { }

type RustEnum {
A,
B(),
C(i32)
}
type t {
identifier1(),
identifier2(i32),
identifier3,
}

type t2 = t;

let x = func (a) => a * (t + 1) / 2.0;`,
    7
  ],
  [
    `type TypeAlias = i32;
use std;

type ZeroVariants { }

type RustEnum {
  A,
  B(),
  C(i32)
}
let f = 4;
let f = 5; // error
let f = 6; // error aswell! but what is the error message?`,
    8
  ],
  ['let id[T]: T -> T -> T = 5;', 1],
  [
    `
use file;

let i = nan;
let j = inf;
let u = i;
let x: i32 = 1;
let y: f64 = 2.0;
let z[A] =
  (func (x: A): A => x) (3);
let f[B,]: B -> i32 =
  func (y: B,): i32 => 4 + y;

type alias = f64;
type complex {
  type1,
  type2(),
  type3(i32, f64),
  type4
}

group G0 {
  group G1 { let a = 5; }
  let b = 6.0;
}
`,
    11
  ],
  ['type complexType { test, test2(), test3(i32 -> f64, hey, ) }', 1],
  ['let f[T,B,Z,]: ((T, B,) -> i32) -> Z = func (g) => g();', 1],
  [`group test { let a[b] = 5; let b = 3; let c = 2; }`, 1],
  [`let x = func (x, y, z) => 1;`, 1],
  [
    `type Tree[T] {
  empty(),
  otherEmpty,
  full(Tree, T, Tree,),
}

let getNodeCount[T] = func (tree: Tree = Tree.full(Tree.empty, 3, Tree.empty)): i32 =>
  match (tree): i32 { // is Tree here an identifier or expression!?
    empty => 0,
    otherEmpty() => 0,
    full(t1, _, t2,) => 1 + getNodeCount(t1) + getNodeCount(t2),
  };`,
    2
  ],
  [
    `type Tree[T] {
  empty(),
  full(Tree, T, Tree)
}

let tree = Tree.empty();

let value = match (tree): i32 {
  empty => -1,
  full(left, val, right) => val
};

let main = func (arg) => value == -1;`,
    4
  ],
  ['/*test*/;', 1],
  [';/*test*/', 2],
  ['', 0],
  ['let x = a()()();', 1],
  [`let x = a.b().c().d;`, 1],
  [`type t { i, /*comment 33*/ }`, 1],
  [`type t { /*comment 33*/ }`, 1],
  ['let x = x.a()/*comment 3*/()/**/().b;', 1],
  [`let x = x.a/*comment 3*/.b;`, 1],
  [
    `group t {
  let t = match (t) {
    f => match (x) { a() => f, g => c }
  };
}`,
    1
  ],
  [
    `type Tree[T] {
  empty(),
  otherEmpty,
  full(Tree, T, Tree,),
}

let getNodeCount[T] = func (tree: Tree = Tree.full(Tree.empty, 3, Tree.empty)): i32 =>
  match (tree): i32 { // is Tree here an identifier or expression!?
    empty => 0,
    otherEmpty() => 0,
    full(t1, _, t2,) => 1 + getNodeCount(t1) + getNodeCount(t2),
  };`,
    2
  ],
  [
    `let x = func (a) =>
  (- (2 - 3 - 4) == - -5)                  &
  (2 ** 3 ** 4  == 2.4178516392292583e+24) &
  (2 * 3 * 4 == 24)                        &
  ((2 + 3 * 4 == 2 + (3 * 4)) & ((2 + 3) * 4 != 2 + 3 * 4));`,
    1
  ],
  [
    `group test { let x = 5 + 2 * (func (x) => x + 3 | 1 << 2 > 4).a.b() + nan + inf + 3e-3; }`,
    1
  ],
  [
    `use std;

let x: i32 = 5 << 3;
let y: f64 = nan / inf;
let a[X] = func (x: X = 5): f64 => 5.3;

let b = (func (x) => x == x)(5);

type time[T,] = f64 -> (T, f64,) -> (i32);
type other = i32;

type hey[A] {
day1,
day2(time),
day3
}

type alias = hey;

group test {
let val = 4 + 3 * 3 % 3 & 3 - a(3);
}`,
    10
  ],
  ['', 0],
  ['      let f = func (x, a = 5, b = c) => a;', 1],
  ['//comment', 1],
  [`let x = func (a, b) => a + 4 - 2;`, 1],
  [
    `type
simpleType =

f64 ->  (f64     ,     f64,) -> i32

; // test
;/*test*/; group t {//ok
}`,
    4
  ],
  [
    `let x[A]: A = func (x: A = 4
+3): A => x;`,
    1
  ],
  [
    `
let a: () -> A = 0;
let b: B -> C = 1;
let c: (D,) -> E = 2;
let d: (F,G[H],) -> I = 3;
let e: (J,K,L) -> M = 4;
let f: (N) -> O = 5;
`,
    6
  ],
  ['let x: A -> (B) -> (C,) -> (D, E) -> (F) = 5;', 1],
  ['let x: A -> ((B) -> (C )) -> (D, E) -> (F) = 5;', 1],
  ['// test', 1],
  ['/* test */', 1],
  ['/*test*/ /*hey*/ ; /*tast*/ /*ok*/', 2],
  ['group test { let a[T, T2] = 5; let b = 3; let c = 2; }', 1],
  ['use test;', 1],
  ['let test = 5;', 1],
  ['type test = i32;', 1],
  ['type test { }', 1],
  ['group test { }', 1],
  [
    'let test = ! ~ + - 1 + 1 - 1 * 1 / 1 ** 1 ** 1 % 1 & 1 | 1 ^ 1 << 1 >> 1 == 1 != 1 <= 1 >= 1 < 1 > 1;',
    1
  ],
  [
    `let a: f64 = 4.5e3;
// a
type cmpx[hey] {
  // b
  A(i32 /*c*/, f64),
  // this test
  // F
  B,
  // d
  C(hey, i32, /*ok works*/),
  D
  // e
}
type two {
  // test
}
// other
// test two`,
    4
  ],
  [
    `type weekdays {
    Saturday,
    Sunday,
    Monday,
    Tuesday,
    Wednesday,
    Thursday,
    Friday
  }

  let f = func (weekday: weekdays): i32 =>
    match (weekday): i32 {
      Saturday => 1,
      Sunday => 1,
      //0 // default for the other days TODO
    };`,
    2
  ],
  ['let x = func (x: i32 -> i32,) => 5;', 1],
  ['let a = func (x: (i32) -> i32) => x(5);', 1],
  ['let a = func (x: () -> i32) => 5;', 1],
  [
    '/* comment */ let /*0*/ x /*1*/ : /*2*/ ( /*3*/ i32 /*4*/ , /*5*/ ) /*6*/ -> /*7*/ i32 /*8*/ = /*9*/ func /*10*/ ( /*11*/ x /*12*/ , /*13*/ ) /*14*/ => /*15*/ 5 /*16*/ ; /*17*/',
    2
  ],
  ['group test /*0*/ { /*1*/ let x = 5; /*2*/ } /*3*/', 2],
  [
    `group test {
  type t = i32;
  let a: ((t,t,) -> t,) -> t =
    func (x: (t,t,) -> t,): t => x(5, 3,);
}`,
    1
  ],
  [
    `type t {
  identifier1(),
  identifier2(i32),
  identifier3,
}

type t2 = t;`,
    2
  ],
  ['type complexType { test, test2(), test3(i32 -> f64, hey, ) }', 1],
  [
    `
use file;

let i = nan;
let j = inf;
let u = i;
let x: i32 = 1;
let y: f64 = 2.0;
let z[A] =
(func (x: A): A => x) (3); // A == i32
let f[B]: B -> i32 =
func (y: B): i32 => 4 + y; // B == i32

type alias = f64;
type complex {
type1,
type2(),
type3(i32, f64),
type4
}

group G0 {
group G1 { let a = 5; }
let b = 6.0;
}
`,
    11
  ]
];
const mustNotParseButLexe: string[] = [
  `let a: x[b = 5;`,
  `let a: x[b, = 5;`,
  `let a: x[ = 5;`,
  `let a: x[, = 5;`,
  `let a: a[b = 5;`,
  `let a: a[b, c[d] = 5;`,
  'group t { use std; }',
  'let x = match (x) { };',
  `let a = match (x) {
  a => 5
  => 4
};`,
  `let f = match (x) {
  a => 5,
  b => 3,
  => c, // default value
  => d, // default value
};`,
  `let f = match (x) {
  a => 5,
  => c, // default value
  b => 3,
};`,
  'use test let func ;',
  '+',
  'test',
  'let',
  'let;',
  'let x',
  'let =;',
  'let =',
  'let x = ;',
  'let x 5 ;',
  'let x = 5',
  'let = 5;',
  'let x = 5 /;/test',
  `type Test { id id id, id id };`,
  `type t { , }`,
  'let x = func (,) => 4; // invalid trailling comma',
  '}',
  `let f = func (x, a = 5, b) => a;`,
  'x = 5',
  'let x: A -> ((B) -> (C,)) -> (D, E) -> (F) = 5;',
  'test',
  '5',
  '5.0',
  'i32',
  'f64',
  'nan',
  'inf',
  'use',
  'let',
  'type',
  'group',
  'func',
  'match',
  'func (x) => x',
  'let x = func ( => 5;',
  'let x = func () 5;',
  'let x = func () => 5',
  '+',
  '!',
  'use;',
  'use',
  'use test',
  'group p {',
  'let nan',
  'let func',
  'let () => )',
  'let x',
  'let x]',
  'let x[',
  'let func ] =>',
  'let x = func (x: i32 => i32) => 5;',
  'let x = func (x: i32 -> i32) -> 5;',
  'let x',
  'let y =',
  'let x = 5',
  'let x = ;',
  'let x 5 ;',
  'let = 5 ;',
  'x = 5 ;',
  'let x: = 5;',
  `type t {
  identifier1()
  identifier2(i32)
  identifier3
}`
];
// #endregion

// just for testing purposes
export function debugLexer(
  times: number = 2,
  timerAndIO: boolean = true,
  example: boolean = false
): boolean {
  const timerName: string = 'Lexer tests';

  const x = Lexer.lexe('let xyz: i32 = 52 == 0x5a; // test');
  if (times !== 0 && timerAndIO && example)
    console.log(`[Debug Lexer] Example tokens: '${JSON.stringify(x)}'`);

  let correct: boolean = false;

  for (let i = 0; i < times; ++i) {
    // #region tests
    if (timerAndIO) console.time(timerName);

    let successfullTests: number = 0;
    for (const code of mustLexe) {
      const lexed = Lexer.lexe(code[0]);
      if (lexed.valid === false || lexed.tokens.length !== code[1])
        console.error(
          'error in mustLexe, invalid lexer for code:',
          code[0],
          lexed,
          lexed.tokens.length
        );
      else successfullTests++;
    }
    for (const code of mustNotLexe) {
      const lexed = Lexer.lexe(code[0]);
      if (lexed.valid === true || lexed.lexerErrors.length !== code[1])
        console.error(
          'error in mustNotLexe, invalid lexer for code:',
          code[0],
          lexed
        );
      else successfullTests++;
    }
    if (timerAndIO) console.timeEnd(timerName);

    correct = successfullTests === mustLexe.length + mustNotLexe.length;
    if (timerAndIO && correct) {
      console.debug(
        `Lexer successfully lexed ${successfullTests} tests and ${
          mustLexe.map((e) => e[0]).join('').length +
          mustNotLexe.map((e) => e[0]).join('').length
        } characters.`
      );
    } else if (!correct)
      console.error(
        `${
          mustLexe.length + mustNotLexe.length - successfullTests
        } failed tests in the Lexer-stage!`
      );
    // #endregion
  }

  return correct;
}

export function debugParser(
  count: number = 2,
  modifier: {
    timerAndIO: boolean;
    example: boolean;
    addComments: boolean;
    parserSkipComments: boolean;
  },
  timerName: string = 'Parser tests'
): void {
  if (count !== 0 && modifier.timerAndIO)
    console.log('lexer works: ', debugLexer(1, false, false));

  const x = Parser.parse('let xyz: i32 = 52 == 0x5a; // test', {
    ignoreComments: modifier.parserSkipComments
  });
  if (count !== 0 && modifier.timerAndIO && modifier.example)
    console.log(`[Debug Parser] Example parser: '${JSON.stringify(x)}'`);

  // TODO test all operator precedences

  for (let i = 0; i < count; ++i) {
    // #region tests
    // let _ = 1 + (2 - 3) * 4 / 5 ** 6 % 7;
    // invalid to do: `a.(b).c` but (a.b).c is ok
    // let _ = a(5+32,4)
    // use std; let _ = (func (x) => 3 * x)(5);
    // let x: (i32) -> ((f64), (tust,) -> tast -> (tist)) -> (test) = func (a, b, c) -> 4;
    // let x: (i32) -> ((f64), (tust,) -> tast -> () -> (tist)) -> (test) = func (a, b, c) => 4;

    // TODO add for each mustParse a comment in between each value
    // TODO for each mustParse, remove one by one the last token,
    // and check if the code does not crash
    const mustParseWithComments: [string, number][] = modifier.addComments
      ? mustParse.map((val, i) => [
          '/*first comment*/' +
            Lexer.lexe(val[0])
              .tokens.map(
                (t) =>
                  // t.ty === tokenType.comment
                  //   ? t.lex.startsWith('//')
                  //     ? `/*${t.lex.replaceAll('*/', '')}*/`
                  //     : t.lex
                  //   :
                  t.l
              )
              .join(`\n/*comment ${i}*/`) +
            '/*last comment*/',
          -1
        ])
      : [];

    if (modifier.timerAndIO) console.time(timerName);

    let successfullTests: number = 0;
    for (const code of modifier.addComments
      ? mustParseWithComments
      : mustParse) {
      try {
        let ans = Parser.parse(code[0], {
          ignoreComments: modifier.parserSkipComments
        });

        if (!ans?.valid) {
          console.error('Should parse:', code[0]);
          console.log(JSON.stringify(ans));
        } else if (
          !modifier.addComments &&
          !modifier.parserSkipComments &&
          ans.statements.length !== code[1]
        ) {
          // with added comments, it is not known how many statements should be parsed
          console.error(
            'Got wrong number of parsed statements:',
            ans.statements.length,
            'but expected: ',
            code[1],
            'code: ',
            code[0]
          );
        } else successfullTests++;
      } catch (e) {
        console.error('Internal parser error:', code, e);
      }
    }
    for (const code of mustNotParseButLexe) {
      if (!Lexer.lexe(code).valid)
        throw new Error('this code should be lexable: ' + code);

      try {
        let ans = Parser.parse(code, {
          ignoreComments: modifier.parserSkipComments
        });
        if (ans.valid) {
          console.log('Should not parse: ', code);
          console.log(JSON.stringify(ans));
        } else successfullTests++;
      } catch (e) {
        console.error('Internal parser error:', code, e);
      }
    }

    if (modifier.timerAndIO) console.timeEnd(timerName);

    if (
      modifier.timerAndIO &&
      successfullTests === mustParse.length + mustNotParseButLexe.length
    ) {
      console.debug(
        `Parsed successfully ${successfullTests} tests and ${
          (!modifier.addComments ? mustParse : mustParseWithComments)
            .map((e) => e[0])
            .reduce((a, b) => a + b).length +
          mustNotParseButLexe.reduce((a, b) => a + b).length
        } characters.`
      );
    } else if (
      successfullTests !==
      mustParse.length + mustNotParseButLexe.length
    )
      console.error(
        `${
          mustParse.length + mustNotParseButLexe.length - successfullTests
        } failed tests in the Parser-stage!`
      );
    // #endregion
  }
}

debugLexer(0, true, false);
debugParser(0, {
  timerAndIO: true,
  addComments: true,
  parserSkipComments: false,
  example: false
});
