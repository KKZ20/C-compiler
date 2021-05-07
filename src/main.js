import { lexicalAnalysis } from './lexicalAnalyser.js';
import { Type } from './grammaticalAnalyser.js';
import fs from 'fs';
/**
 * * 词法分析part
 * * 通过读取一段测试代码，输出词法分析后的单词流
 * TODO 需要确定好单词流的输出形式
 */


//TODO: 如何使用node接收命令行参数
//TODO: 如何用npm打包
//TODO: 模块间的互相导入还是有点迷糊，导入*和只导入部分变量有什么区别
const testCodePath = '../test/test_code.txt';
const tokenStreamPath = '../result/token_stream.json';

// 词法分析函数
function lexicalAnalyse(testCodePath, tokenStreamPath) {
    let lexAnalyse = new lexicalAnalysis();
    lexAnalyse.readSourceCode(testCodePath);
    lexAnalyse.scanCode(lexAnalyse.sourceCode);
    lexAnalyse.printToJson(tokenStreamPath);
}

function compiler() {
    // 词法分析
    lexicalAnalyse(testCodePath, tokenStreamPath);

    // 语法分析


    // 语义分析


    // 中间代码生成

}

compiler();
var tokenStream = fs.readFileSync(tokenStreamPath, 'utf-8');
let tokenStreamdata = JSON.parse(tokenStream);
console.log(tokenStreamdata);