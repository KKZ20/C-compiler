import chalk from 'chalk';
import { lexicalAnalysis } from './lexicalAnalyser.js';
import { LR1 } from './grammaticalAnalyser.js';
import { ASM } from './objectCode.js';
import minimist from 'minimist';
//TODO: 如何使用node接收命令行参数（使用内置的process对象）
//TODO: 如何用npm打包
//TODO: 模块间的互相导入还是有点迷糊，导入*和只导入部分变量有什么区别
const paraNum = 6;
// const testCodePath = '../test/test_code.txt';
// const GrammarPath = '../test/Grammar.txt'
const tokenStreamPath = '../result/token_stream.json';
const lr1TablePath = '../result/lr1_table.csv'
const lr1ProcessPath = '../result/lr1_process.dat';
const quadruplePath = '../result/inter_code.txt';
const objectCodePath = '../result/object_code.asm';
let testCodePath = 'null';
let grammarPath = 'null';

//TODO: 
function usage() {
    console.log('请阅读本程序运行方法: ');
    console.log('\t1. 需要安装node.js环境（开发时所用版本为v15.7.0）');
    console.log('\t2. 请将文法文件放入和要进行编译的代码放入test文件夹中');
    console.log('运行指令为：');
    console.log('\tnode main.js --test xxxx --grammar xxxx');
}

var lexAnalyse = new lexicalAnalysis();
var LR1Analyse = new LR1();


/**
 * * 词法分析part
 * * 通过读取一段测试代码，输出词法分析后的单词流
 * TODO 需要确定好单词流的输出形式（json）
 */
// 词法分析函数
function lexicalAnalyse(testCodePath, tokenStreamPath) {
    console.log(chalk.magentaBright('\n开始词法分析......'));
    lexAnalyse.readSourceCode(testCodePath);
    lexAnalyse.scanCode(lexAnalyse.sourceCode);
    lexAnalyse.printToJson(tokenStreamPath);
    console.log(chalk.green('\n词法分析完成。'));
}

/**
 * * 语法 + 语义分析part
 * * 根据输入的文法构建LR1表；将词法分析生成的单词流输入，进行语法分析
 * * 语法分析同时调用语义分析
 * TODO 需要确定好单词流的输出形式
 */
// 语法 + 语义分析函数
function grammatical_semantic_Analyse(grammarPath) {
    console.log(chalk.magentaBright('\n开始语法和语义分析......'));
    LR1Analyse.grammarInitialize(grammarPath);             // Grammar类初始化
    LR1Analyse.LR_1();                                     // LR1类初始化（完成LR1表的建立，map形式）
    LR1Analyse.showLR1Table(lr1TablePath);                 // 打印LR1表
    // let errorCount = LR1Analyse.parseToken(lexAnalyse.getTokenStream());   // 进行语法和语义分析
    let outputStream = LR1Analyse.parser(lexAnalyse.getTokenStream());   // 进行语法和语义分析

    console.log('\n语法分析完成，未发现语法错误。');
    console.log('语义分析完成，未发现语义错误。');

    LR1Analyse.printLr1Process(outputStream, lr1ProcessPath);
    LR1Analyse.semanticAnalyse.printQuadruple(quadruplePath);

    
    console.log(chalk.green('\n语法和语义分析完成。'));
    return LR1Analyse.semanticAnalyse.getQuadruple();
}

function objectCodeGenarate(objectCodePath, quadruples) {
    console.log(chalk.magentaBright('\n开始目标代码生成......'));

    let asm = new ASM();
    asm.init(quadruples);
    asm.genarate(objectCodePath);

    console.log(chalk.green('\n目标代码导出完成。'));
}

function compiler() {
    // 词法分析
    lexicalAnalyse(testCodePath, tokenStreamPath);

    // 语法分析 + 语义分析
    let quadruples = grammatical_semantic_Analyse(grammarPath);

    // 目标代码生成
    objectCodeGenarate(objectCodePath, quadruples);
}

if (process.argv.length !== paraNum) {
    console.log('参数个数输入有误！');
    usage();
}
else {
    //FIXME: 看看能不能同时支持长短参数
    let args = minimist(process.argv.slice(2));
    testCodePath = args.test;
    grammarPath = args.grammar;
    if (testCodePath === undefined || grammarPath === undefined) {
        console.error('Invalid parameter!');
    }
    else {
        compiler();
        // // const ProgressBar = require('progress')

        // const bar = new ProgressBar(':bar', { total: 100 })
        // const timer = setInterval(() => {
        // bar.tick()
        // if (bar.complete) {
        //     clearInterval(timer)
        // }
        // }, 1000)
    }
}
