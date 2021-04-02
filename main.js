import { lexicalAnalysis } from './lexicalAnalyser.js';
/**
 * * 词法分析part
 * * 通过读取一段测试代码，输出词法分析后的单词流
 * TODO 需要确定好单词流的输出形式
 */

const testCodePath = './test/test_code.txt';
let lexAnalyse = new lexicalAnalysis();
lexAnalyse.readFile(testCodePath);
lexAnalyse.scanCode(lexAnalyse.sourceCode);
console.log(lexAnalyse.sourceCode);


