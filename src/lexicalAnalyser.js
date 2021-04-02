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

class lexicalAnalysis {
    constructor() {
        this.sourceCode = '';
        this.tokenStream = [];
        this.filePath = null;
    }

    // 根据指定路径读文件内容
    readFile(path) {
        this.sourceCode = fs.readFileSync(path, 'utf-8');
    }

    // 扫描并分析读入的代码
    scanCode(codeStream) {
        let i = 0;
        // console.log('scan code');
        let present_row = 1;
        let isFloat = false;
        let str;   // 一个标识符的字符串
        let j = -1;
        for (; i < codeStream.length; i++){
            
            // 如果是空白字符（回车或者空格），
            if (utils.isSpace(codeStream[i])) {
                if (codeStream[i] === '\n') {
                    present_row++;
                }
                continue;
            }
            // 经过这个就知道，肯定不会是空白字符了
            str = codeStream[i];
            // 如果当前字符是字母
            // if (utils.isAlpha(codeStream[i])) {
            //     while (1) {
            //         j = i + 1;
            //         if (j > codeStream.length) {
            //             break;
            //         }
            //     }
            // }
            

            console.log(codeStream[i]);
            console.log(present_row);
            
        }
    }
}

// console.log('辉哥好帅')

export { lexicalAnalysis };


