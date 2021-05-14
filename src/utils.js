import { Type } from "./grammaticalAnalyser.js";

// 表示状态的常变量定义
const ERROR = -1;
const OK = 0;

/* -------------------------模拟C++的字符判断函数-------------------------------*/
// 判断一个字符是否是white-space
function isSpace(c) {
    // console.log('isSpace');
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\v' || c === '\f') {
        return true;
    }
    else {
        return false;
    }
}

// 判断一个字符串是不是整数
let isInteger = str => {
    [...str].forEach(element => {
        if (!isDigit(element)) {
            return false;
        }
    });
    return true;
}

// 判断一个字符串是否是浮点数
let isFloat = str => {
    if (!(str.indexOf('.') === str.lastIndexOf('.'))) {
        return false;
    }
    var tmp = str.split('.').join('');
    return isInteger(tmp);
}

// 判断单个字符是否是数字
let isDigit = c => c.length === 1 && '0123456789'.includes(c);

// 判断单个字符是否是字母
let isAlpha = c => c.length === 1 && c.match(/[a-z]/i) !== null;

/* ---------------------------------end------------------------------------- */


/* -------------------------语法分析判断的工具函数-------------------------------*/
// 判断两个数组是否相等
function arrayEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (var i = 0; i < a.length; i++){
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

// 判断两个集合是否相等
let isSameSetInOrder = (a, b) => {
    if (a.length != b.length) {
        return false;
    }
    var temp_a = Array.from(a);
    var temp_b = Array.from(b);
    for (let i = 0; i < a.size; i++){
        if (temp_a[i] !== temp_b[i]) {
            return false;
        }
    }
    return true;
}
// 判断两个产生式（Item，详见grammaticalAnalyser.js中定义）是否相等
let itemEqual = (item1, item2) => {
    return (item1.left === item2.left && arrayEqual(item1.right, item2.right) &&
            item1.isLR1Item === item2.isLR1Item && item1.dotPosition === item2.dotPosition &&
                item1.productionIndex === item2.productionIndex);
}

// 判断是否为非终结符
let isNonTerminal = (symbols, symbolIndex) => {
    if (symbolIndex < 0 || symbolIndex >= symbols.length) {
        return false;
    }
    return symbols[symbolIndex].type === Type.NonTerminal;
}

// 判断是否为终结符
let isTerminal = (symbols, symbolIndex) => {
    if (symbolIndex < 0 || symbolIndex >= symbols.length) {
        return false;
    }
    return symbols[symbolIndex].type === Type.Terminal || symbols[symbolIndex].type === Type.EndToken;
}

// 判断是否为epsilon
let isEpsilon = (symbols, symbolIndex) => {
    if (symbolIndex < 0 || symbolIndex >= symbols.length) {
        return false;
    }
    return symbols[symbolIndex].type === Type.Epsilon;
}

// 判断是否为终止符号
let isEndtoken = (symbols, symbolIndex) => {
    if (symbolIndex < 0 || symbolIndex >= symbols.length) {
        return false;
    }
    return symbols[symbolIndex].type === Type.EndToken;
}

// 判断两个LR1项（LR1Item，详见grammaticalAnalyser.js中定义）是否相等
let lr1ItemEqual = (a, b) => {
    return a.lrItem === b.lrItem && a.lookAheadSymbol === b.lookAheadSymbol;
}

// 判断两个closure闭包（Closure，详见grammaticalAnalyser.js中定义）是否相等
function closureEqual(a, b) {
    if (a.itemClosure.length !== b.itemClosure.length) {
        return false;
    }
    for (let i = 0; i < a.itemClosure.length; i++){
        if (!lr1ItemEqual(a.itemClosure[i], b.itemClosure[i])) {
            return false;
        }
    }
    return true;
}

// 工具函数：将两个int拼成一个用_分隔的字符串，作为key
let generateKey = (value1, value2) => {
    return String(value1) + '_' + String(value2);
}

// 工具函数：单层对象的深拷贝
//FIXME: 但下面的深拷贝方法遇到循环引用，会陷入一个循环的递归过程，从而导致爆栈。
function deepCopySingle(obj) {
    let result = Array.isArray(obj)?[]:{};
    if(obj && typeof obj === "object"){
        for(let key in obj){
            if(obj.hasOwnProperty(key)){
                if(obj[key] && typeof obj[key] === "object"){
                    result[key] = deepCopySingle(obj[key]);
                }
                else {
                    result[key] = obj[key];
                }
            }
        }
    }
    return result;
}
/* ---------------------------------end------------------------------------- */

export { ERROR, OK };
export { isSpace, isAlpha, isDigit };
export { isInteger, isFloat };
export { itemEqual, isSameSetInOrder, lr1ItemEqual, closureEqual };
export { isNonTerminal, isTerminal, isEpsilon, isEndtoken };
export { deepCopySingle };
export { generateKey };
