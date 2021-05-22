// var fs = require('fs');
import fs from 'fs'
import * as utils from './utils.js';

const Keyword = ['void', 'int', 'float', 'if', 'else', 'while', 'return'];
const Separator = [',', ';', '(', ')', '{', '}'];
const Operator = ['+', '-', '*', '/', '=', '+=', '-=', '*=', '/=', '&&',
'||', '!', '>', '<', '>=', '<=', '==', '!='];

const Identifier = '<ID>';
const ConstInt = '<INT>';
const ConstFloat = '<FLOAT>';

/**
 * Token对象构造器
 * @param token : string  符号
 * @param value : string  标识符名称/常量值
 * @param row_no : number 行号
 */
class Token {
    constructor(token, value, row_no) {
        this.token = token;
        this.value = value;
        this.row_no = row_no;
    }
}

/**
 * lexicalAnalysis对象
 * @param sourceCode : string, js无法像C++一样使用文件流，所以只能把代码读进一个字符串中进行处理
 * @param tokenStream : array, 其元素为Token对象，记录生成的单词流
 */
class lexicalAnalysis {
    constructor() {
        this.sourceCode = '';
        this.tokenStream = [];
    }

    // jx提出的修改
    findOperator(str) {
        for (let i = 0; i < Operator.length; i++){
            if (str === Operator[i] || str === Operator[i][0]) {
                return true;
            }
        }
        return false;
    }

    // 根据指定路径读文件内容
    readSourceCode(path) {
        try {
            this.sourceCode = fs.readFileSync(path, 'utf-8');
        }
        catch (err) {
            console.log("\n打开源代码文件失败！");
            console.error(err);
            process.exit(-1);
        }
    }

    // 扫描并分析读入的代码
    //FIXME: 解决一下gp循环输出的问题
    scanCode(codeStream) {
        const length = codeStream.length;
        let i = 0;
        let j = -1;
        let cur_row = 1;       // 记录当前行号
        let isFloat = false;       // 判断是否为浮点数
        let str = '';              // 一个标识符的字符串
        let temp;                  // 单个字符的临时变量
        for (; i < length; i++) {
            // 如果是空白字符（回车或者空格），
            if (utils.isSpace(codeStream[i])) {
                if (codeStream[i] === '\n') {
                    cur_row++;
                }
                continue;
            }
            // 经过这个就知道，肯定不会是空白字符了
            str = codeStream[i];
            // 如果当前字符是字母
            if (utils.isAlpha(codeStream[i])) {
                while (1) {
                    //FIXME: 这里不是很确定对不对
                    if (i == length - 1) {
                        break;
                    }
                    temp = codeStream[++i];
                    if (utils.isAlpha(temp) || utils.isDigit(temp)) {
                        str += temp;
                    }
                    else {
                        break;
                    }
                }
                //FIXME: 1. 为什么gp要回退一个字符
                // 因为我取了下一个字符，如果不回退，是空格还好，类似于'a=1'，直接就会把等号跳过去了
                i--;
                if (Keyword.includes(str)) {
                    this.tokenStream.push(new Token(str, str, cur_row));
                }
                else {
                    this.tokenStream.push(new Token(Identifier, str, cur_row));
                }
            }
            // 如果当前字符是数字
            else if (utils.isDigit(codeStream[i])) {
                isFloat = false;
                while (1) {
                    //FIXME: 这里不是很确定对不对
                    if (i == length - 1) {
                        break;
                    }
                    temp = codeStream[++i];
                    if (utils.isDigit(temp)) {
                        str += temp;
                    }
                    else {
                        isFloat = (temp == '.');
                        // if (temp == '.') {
                        //     console.log('zhaodao.');
                        //     console.log(str);
                        // }
                        if (isFloat) {
                            str += temp;
                        }
                        // console.log(isFloat);
                        // console.log(str);
                        break;
                    }
                }
                // 如果是浮点数，则开始读小数点后面的数，直到不是数字为止
                while (isFloat) {
                    if (i == length - 1) {
                        break;
                    }
                    temp = codeStream[++i];
                    if (utils.isDigit(temp)) {
                        str += temp;
                    }
                    else {
                        break;
                    }
                }
                // 要回退一个
                i--;
                if (isFloat) {
                    this.tokenStream.push(new Token(ConstFloat, str, cur_row));
                }
                else {
                    this.tokenStream.push(new Token(ConstInt, str, cur_row));
                }
            }
            // 如果是分隔符
            else if (Separator.includes(str)) {
                this.tokenStream.push(new Token(str, str, cur_row));
            }
            // 如果是操作符
            else if (this.findOperator(str)) {
                //FIXME: 为什么这里就break了? 解决：如果遇到单个字符的操作符结尾，我们就正常把它输入单词流
                if (i == length - 1) {
                    this.tokenStream.push(new Token(str, str, cur_row));
                    continue;
                }
                temp = codeStream[i + 1];
                
                if (str == '/') {
                    // 行注释
                    if (temp == '/') {
                        i++;
                        while ((i < length - 1) && ((temp = codeStream[++i]) != '\n')) {
                            ;
                        }
                        if (temp == '\n') {
                            cur_row++;
                        }
                    }
                    // 块注释
                    else if (temp == '*') {
                        let pre = '';
                        i++;
                        while ((i < length - 1) && ((temp = codeStream[++i]) != '/' || pre != '*')) {
                            pre = temp;
                            if (pre == '\n') {
                                cur_row++;
                            }
                        }
                    }
                    // "/="
                    else if (temp == '=') {
                        str += temp;
                        i++;
                        this.tokenStream.push(new Token(str, str, cur_row));
                    }
                    else {
                        this.tokenStream.push(new Token(str, str, cur_row));
                    }

                }
                else if (Operator.includes(str + temp)) {
                    i++;
                    this.tokenStream.push(new Token(str + temp, str + temp, cur_row));
                }
                else {
                    this.tokenStream.push(new Token(str, str, cur_row));
                }
            }
            // 报错
            else {
                console.log("第" + cur_row + "行发现非法字符: \""+ str + "\" 请及时终止程序！");
                break;
            }
        }
        //FIXME: 好像没必要？
        if (i < length) {
            return utils.ERROR;
        }
        else {
            return utils.OK;
        }
    }

    // 将结果输出在文件中
    printToJson(path) {
        let tokenStream_json = JSON.stringify(this.tokenStream, null, 4);
        try {
            const data = fs.writeFileSync(path, tokenStream_json);
            console.log('\n词法分析生成的单词流已导出至: ' + path);
        }
        catch (error) {
            console.log('\n单词流导出失败！');
            console.error(error);
            process.exit(-1);
        }
    }

    // 对外的一个单词流变量（叶神说的二进制方式读取）
    getTokenStream() {
        return this.tokenStream;
    }
}
export { Token };
export { lexicalAnalysis };

