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

// 判断两个产生式（Item，详见grammaticalAnalyser.js中定义）是否相等

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

let isEqual = (item1, item2) => {
    return (item1.left === item2.left && arrayEqual(item1.right, item2.right) &&
            item1.isLR1Item === item2.isLR1Item && item1.dotPosition === item2.dotPosition &&
                item1.productionIndex === item2.productionIndex);
}

export { ERROR, OK };
export { isSpace, isAlpha, isDigit };
export { isInteger, isFloat };
export { isEqual };
