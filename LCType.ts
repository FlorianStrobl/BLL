// resolve all the types, and check which function calls which function (because of namespaces), and check if they are even visible (public or not)
// 1. make an array of all lets with marks if its public or not and namespace resolve
// 2. resolve which functions are called from which functions
// 3. add trivial types
// 4. add T1-Tn types
// 5. if Ti and Tj must be the same => only have Ti
// 6. resolve all Ts by giving it actuall types
