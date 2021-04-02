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
// 判断一个字符是否是数字
function isDigit(c) {
    // console.log('isDigit');
    if (c >= '0' && c <= '9') {
        return true;
    }
    else {
        return false;
    }
}
// 判断一个字符是否是字母
function isAlpha(c) {
    // console.log('isAlpha');
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
        return true;
    }
    else {
        return false;
    }
}
export { isSpace, isAlpha, isDigit };
/* ------------------------end------------------------------------- */

// console.log('czh我女神')