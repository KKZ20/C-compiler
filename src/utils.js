/**
 * * 模拟C++的字符判断函数------------------------------------------/
 */
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

export { isSpace, isAlpha, isDigit };
export { isInteger, isFloat };
/* ------------------------end------------------------------------- */

