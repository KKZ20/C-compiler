import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';
import { FORMERR } from 'dns';
import fs, { unwatchFile } from 'fs';
import { exit } from 'process';
import { Token } from './lexicalAnalyser.js';
import { Semantic, SemanticSymbol } from './semanticAnalyser.js';
import * as utils from './utils.js';

// 非法位置
const Npos = -1;

// 符号类型：空串/终结符/非终结符/终止符号
const Type = {
    Epsilon: 0,
    Terminal: 1,
    NonTerminal: 2,
    EndToken: 3
};

// 文法符号： 空/分隔符/产生符/结束符/开始符号/拓广文法开始符号
const GrammarSymbol = {
    EmptyStr: '@',
    SplitStr: '|',
    ProToken: '->',
    EndToken: '#',
    StartToken: 'Program',
    ExtendStart: 'S'
};

// 动作定义： 分析过程中的动作枚举定义
const Action = {
    ShiftIn: 0, // 移入
    Reduce: 1,  // 归约
    Accept: 2,  // 接受
    Error: 3    // 报错
};

// 打印格式化
const PrintFormat = {
    step_len: 5,
    status_len: 200,
    symbol_len: 300,
    input_len: 200,
    production_len: 60
};


/**
 * @brief 文法中的符号
 * @param id: 符号的字符串标识(唯一) string
 * @param type: 符号类型，包括空串/终结符/非终结符/终止符号(实际并不存在) Type //FIXME: 啥叫实际不存在
 * @param first_set: FIRST集 Set
 * @param follow_set: FOLLOW集 Set
 */ 
class Symbol {
    constructor(id_, type_) {
        this.id = id_;
        this.type = type_;
        this.first_set = new Set();
        this.follow_set = new Set();
    }
}

/**
 * @brief 文法中的产生式: left->right
 * @param left: 产生式左边在Symbol中的id Number
 * @param right: 产生式右边所有符号在Symbol中的id Array(Number)
 * @param isLR1Item: 是否是一个LR1产生式（最初的产生式不是没有点，不是一个LR1项目）Boolean
 * @param dotPosition: 点的位置 Number
 * @param productionIndex: 产生式在产生式列表中的索引 Number
 */

class Item {
    constructor(left_, right_, isLR1Item_, dotPosition_, productionIndex_) {
        this.left = left_;
        this.right = right_;
        this.isLR1Item = isLR1Item_;
        this.dotPosition = dotPosition_;
        this.productionIndex = productionIndex_;
    }
}

/**
 * @brief 文法类，包含产生式的集合
 * @param symbols: 所有的文法符号 Array(Symbol)
 * @param terminals: 终结符集合(存储终结符在symbols数组中的position)  Set
 * @param nonTerminals: 非终结符集合(存储终结符在symbols数组中的position)  Set
 * @param productions: 产生式集合  Array(Item)
 * @param startProduction: 起始产生式：S->Program在productions数组中的位置 Number
 */
class Grammar {
    constructor() {
        this.symbols = [];
        this.terminals = new Set();
        this.nonTerminals = new Set();
        this.productions = [];
        this.startProduction = -1;
    }
    // 工具函数 id: string
    getSymbolIndexById(id) {
        for (let i = 0; i < this.symbols.length; i++){
            if (id === this.symbols[i].id) {
                return i;
            }
        }
        return Npos;
    }

    // 合并两个集合 set1, set2: set
    mergeSetExceptEmpty(set1, set2) {
        if (utils.isSameSetInOrder(set1, set2)) {
            return false;
        }
        let epsilonIndex = this.getSymbolIndexById(GrammarSymbol.EmptyStr);
        let set1Existed = set1.has(epsilonIndex);
        let sizeBeforeAdd = set1.size;

        for (let s of set2) {
            // FIXME: 这里一定是要保证set是有序的
            // FIXME: 这里不能排序，否则block会有错
            set1.add(s);

        }
        // set1 = new Set(Array.from(set1).sort(function (a, b) { return a - b }));
        if (!set1Existed) {
            set1.delete(epsilonIndex);
        }
        return sizeBeforeAdd < set1.size;
    }

    // 读入产生式 path: string
    readProductions(path) {
        try {
            // 读入grammar的产生式，并且用split函数分割成数组，以代替getline
            const grammarIn = fs.readFileSync(path, 'utf-8').split('\n');

            // 添加 '#' 终止符号和 epsilon空串
            this.symbols.push(new Symbol(GrammarSymbol.EndToken, Type.EndToken));
            // '#'认为是终结符 
            //FIXME: 这里一定是要保证set是有序的
            this.terminals.add(this.symbols.length - 1);
            this.terminals = new Set(Array.from(this.terminals).sort(function (a, b) { return a - b }));
            this.symbols.push(new Symbol(GrammarSymbol.EmptyStr, Type.Epsilon));

            // 开始一行一行处理
            for (let i = 0; i < grammarIn.length; i++){
                // 处理空行和注释
                // FIXME: 人为保证产生式后没有#注释符
                if (grammarIn[i].trim() === '' || grammarIn[i][0] === '#') {
                    continue;
                }
                // 产生式的左右部
                let left, right;
                let strs_p;
                // strs_p = grammarIn[i].split(GrammarSymbol.ProToken); //FIXME: 用自己写的split
                strs_p = utils.mySplit(grammarIn[i], GrammarSymbol.ProToken);
                //FIXME: 这里面要把分割后的所有串去掉首尾空格

                // 通过->符号分割成左右两部
                if (strs_p.length === 2) {
                    left = strs_p[0];
                    right = strs_p[1];
                }
                else {
                    //FIXME: 如何直接在这里退出整个程序
                    console.log('\n文法文件有误！');
                    return utils.ERROR;
                }
                // 分隔右侧多个产生式
                // let rightSecs_p = right.split(GrammarSymbol.SplitStr); //FIXME: 用自己写的split
                let rightSecs_p = utils.mySplit(right, GrammarSymbol.SplitStr);
                
                if (left == '%token') {
                    for (let j = 0; j < rightSecs_p.length; j++){
                        this.symbols.push(new Symbol(rightSecs_p[j], Type.Terminal));
                        //FIXME: 这里一定是要保证set是有序的
                        this.terminals.add(this.symbols.length - 1);
                        this.terminals = new Set(Array.from(this.terminals).sort(function(a, b){return a - b}));
                        if (rightSecs_p[j] === '&&') {
                            this.symbols.push(new Symbol('||', Type.Terminal));
                            //FIXME: 这里一定是要保证set是有序的
                            this.terminals.add(this.symbols.length - 1);
                            this.terminals = new Set(Array.from(this.terminals).sort(function(a, b){return a - b}));
                        }
                    }
                }
                else {
                    let leftIndex = this.getSymbolIndexById(left);
                    if (leftIndex === Npos) {
                        this.symbols.push(new Symbol(left, Type.NonTerminal));
                        leftIndex = this.symbols.length - 1;
                        //FIXME: 这里一定是要保证set是有序的
                        this.nonTerminals.add(leftIndex);
                        this.nonTerminals = new Set(Array.from(this.nonTerminals).sort(function(a, b){return a - b}));
                    }
                    for (let str of rightSecs_p) {
                        // 产生式右部分割成基本单元
                        let basicUnit_p = str.split(" ");
                        let rightIndex = [];    // Number
                        for (let rightUnit of basicUnit_p) {
                            let rightUnitIndex = this.getSymbolIndexById(rightUnit);
                            if (rightUnitIndex === Npos) {
                                // 如果不存在 一定为非终结符 插入
                                this.symbols.push(new Symbol(rightUnit, Type.NonTerminal));
                                rightUnitIndex = this.symbols.length - 1;
                                //FIXME: 这里一定是要保证set是有序的
                                this.nonTerminals.add(rightUnitIndex);
                                this.nonTerminals = new Set(Array.from(this.nonTerminals).sort(function(a, b){return a - b}));
                            }
                            rightIndex.push(rightUnitIndex);
                        }
                        this.productions.push(new Item(leftIndex, rightIndex, 0, -1, -1));
                        if (this.symbols[leftIndex].id === GrammarSymbol.ExtendStart) {
                            this.startProduction = this.productions.length - 1;
                        }
                    }
                }
            }
            return utils.OK;
        }
        catch(err) {
            console.log('\n打开语法文件 ' + path + ' 失败！');
            console.error(err);
            process.exit(-1);
        }
    }

    // 获取终结符的FIRST集
    getFirstOfTerminal() {
        // 终结符的First集合为自身
        for (let ter of this.terminals) {
            //FIXME: 这里一定是要保证set是有序的
            this.symbols[ter].first_set.add(ter);
            this.symbols[ter].first_set = new Set(Array.from(this.symbols[ter].first_set).sort(function(a, b){return a - b}));
        }
    }

    // 获取非终结符的FIRST集
    getFirstOfNonTerminal() {
        let changed;   // Boolean 标记 直到所有集合不发生变化
        while (1) {
            changed = false;
            // 遍历所有非终结符
            for (let non_ter of this.nonTerminals) {
                // console.log(non_ter);
                for (let product of this.productions) {
                    if (product.left != non_ter) {
                        continue;
                    }
                    let it = product.right[0];
                    
                    // 是终结符直接加入first集合并退出——改产生式不能继续使当前非终结符的First集合扩大
                    if (utils.isTerminal(this.symbols, it) || this.symbols[it].type === Type.Epsilon) {
                        // 短路运算  不能交换位置
                        changed = !this.symbols[non_ter].first_set.has(it) || changed;
                        //FIXME: 这里一定是要保证set是有序的
                        this.symbols[non_ter].first_set.add(it);
                        this.symbols[non_ter].first_set = new Set(Array.from(this.symbols[non_ter].first_set).sort(function(a, b){return a - b}));
                        continue;
                    }
                    // 右部以非终结符开始
                    let flag = true; // 可推导出空串的标记
                    let m;
                    for (m = 0; m < product.right.length; m++){
                        // 如果是终结符，停止迭代
                        if (utils.isTerminal(this.symbols, product.right[m])) {
                            changed = this.mergeSetExceptEmpty(this.symbols[non_ter].first_set, this.symbols[product.right[m]].first_set) || changed;
                            //FIXME: 函数出来再排序
                            this.symbols[non_ter].first_set = new Set(Array.from(this.symbols[non_ter].first_set).sort(function(a, b){return a - b}));
                            flag = false;
                            break;
                        }
                        changed = this.mergeSetExceptEmpty(this.symbols[non_ter].first_set, this.symbols[product.right[m]].first_set) || changed;
                        //FIXME: 函数出来再排序
                        this.symbols[non_ter].first_set = new Set(Array.from(this.symbols[non_ter].first_set).sort(function(a, b){return a - b}));
                        // 若该非终结符可推导出空串，则继续迭代
                        flag = flag && this.symbols[product.right[m]].first_set.has(this.getSymbolIndexById(GrammarSymbol.EmptyStr));
                        // 否则直接结束当前产生式的处理
                        if (!flag) {
                            break;
                        }
                    }
                    // 如果该产生式的所有右部均为非终结符且均可推导出空串，则将空串加入First集合
                    if (flag && m >= product.right.length) {
                        changed = !this.symbols[non_ter].first_set.has(this.getSymbolIndexById(GrammarSymbol.EmptyStr)) || changed;
                        //FIXME: 这里一定是要保证set是有序的
                        this.symbols[non_ter].first_set.add(this.getSymbolIndexById(GrammarSymbol.EmptyStr));
                        this.symbols[non_ter].first_set = new Set(Array.from(this.symbols[non_ter].first_set).sort(function(a, b){return a - b}));
                        continue;
                    }
                }
            }
            if (!changed) {
                break;
            }
        }
    }

    // 获取产生式的FIRST集 right: Array(Number)
    getFirstOfProduction(right) {
        let firstSet = new Set();
        if (right.length === 0) {
            return firstSet;
        }
        let it = right[0];
        // 若是终结符或空串 加入后返回
        if (utils.isTerminal(this.symbols, it) || this.symbols[it].type === Type.Epsilon) {
            //FIXME: 这里一定是要保证set是有序的
            firstSet.add(it);
            firstSet = new Set(Array.from(firstSet).sort(function(a, b){return a - b}));
            return firstSet;
        }
        // flag用于判断最终空串是否要加入到first集合
        let flag = true;
        for (let i = 0; i < right.length; i++){
            // 初次进循环一定不是终结符
            // 若是终结符，加入后直接退出——表示该右部不可能产生空串
            if (utils.isTerminal(this.symbols, right[i])) {
                this.mergeSetExceptEmpty(firstSet, this.symbols[right[i]].first_set);
                //FIXME: 函数出来再排序
                firstSet = new Set(Array.from(firstSet).sort(function(a, b){return a - b}));
                flag = false;
                break;
            }
            // 如是非终结符 合并first集合
            this.mergeSetExceptEmpty(firstSet, this.symbols[right[i]].first_set);
            //FIXME: 函数出来再排序
            firstSet = new Set(Array.from(firstSet).sort(function(a, b){return a - b}));
            flag = flag && this.symbols[right[i]].first_set.has(this.getSymbolIndexById(GrammarSymbol.EmptyStr));
            if (!flag) {
                break;
            }
        }
        if (flag && i == right.length) {
            // FIXME: 这里一定是要保证set是有序的
            firstSet.add(this.getSymbolIndexById(GrammarSymbol.EmptyStr));
            firstSet = new Set(Array.from(firstSet).sort(function(a, b){return a - b}));
        }
        return firstSet;
    }

    // Grammar类的初始化函数 path: string
    grammarInitialize(path) {
        this.readProductions(path) === utils.OK;
        this.getFirstOfTerminal();
        this.getFirstOfNonTerminal();
    }
}

/**
 * @brief LR1项
 * @para lrItem: LR1项目（含点）    Number
 * @para lookAheadSymbol: 向前展望的符号   Number
 */
class LR1Item {
    constructor(lrItem_, lookAheadSymbol_) {
        this.lrItem = lrItem_;
        this.lookAheadSymbol = lookAheadSymbol_;
    }
}

/**
 * @brief LR(1)文法计算项集族时使用的闭包类型
 * @para itemClosure: 该闭包中LR(1)项的集合  Array(LR1Item)
 */
class Closure {
    constructor() {
        this.itemClosure = [];
    }

    // 寻找Closure中有没有指定的LR1项
    search(lr1_item) {
        for (let item of this.itemClosure) {
            if (utils.lr1ItemEqual(item, lr1_item)) {
                return true;
            }
        }
        return false;
    }
}

//TODO: ! Actioninfo形式为<int(Action), int(info)>
//TODO: ! pair形式为<int(当前Closure在itemCluster中的index), int(当前符号在symbols中的index)> 
/**
 * @brief LR(1) 文法，继承Grammar
 * @param lrItems: LR(0)项  Array(Item)
 * @param itemCluster: LR(1)项目集簇 Array(Closure)
 * @param gotoTemp: 记录转移信息的临时表,表示某个状态(Closure)下遇到某个符号转移到的下一个状态
 *                  其形式为<string, int> string由两个int拼接成，以下划线分隔
 *                  三个int值分别代表：当前Closure在itemCluster中的index，当前符号在symbols中的index，转移到的Closure在itemCluster中的index
 * @param gotoTable: GOTO表，GOTO[i, A] = j（goto中只用到Action Error(表示未定义)和ShiftIn(表示转移)）;
 * @param actionTable: ACTION表，ACTION[i, A] = "移入/规约/接受"
 *                  GOTO表和ACTION表的map键值对形式都是<string, string>其中第二个string由两个int拼接成，代表的是Actioninfo
 */
class LR1 extends Grammar {
    constructor() {
        super();
        this.lrItems = [];
        this.itemCluster = [];
        this.gotoTemp = new Map();
        this.gotoTable = new Map();
        this.actionTable = new Map();
        this.semanticAnalyse = new Semantic();
    }
    // 工具函数: 在Item集合中取LR项的索引
    // item: Item
    getLRItemsIndexByItem(item) {
        for (let i = 0; i < this.lrItems.length; i++){
            if (utils.itemEqual(item, this.lrItems[i])) {
                return i;
            }
        }
        return Npos;
    }

    // 产生LR(0)项目
    generateLRItems() {
        // 这里的 A->ε 产生式依旧生成两个项目：A->·ε和A->ε·  后续做特殊处理
        for (let i = 0; i < this.productions.length; i++){
            for (let dot = 0; dot <= this.productions[i].right.length; dot++){
                //FIXME: 深浅拷贝！！！！
                let temp = utils.deepCopySingle(this.productions[i]);
                this.lrItems.push(temp);
                this.lrItems[this.lrItems.length - 1].isLR1Item = true;
                this.lrItems[this.lrItems.length - 1].dotPosition = dot;
                this.lrItems[this.lrItems.length - 1].productionIndex = i;
            }
        }
    }

    // 工具函数：判断是否是已经存在的闭包
    // clo: Closure
    isExistedClosure(clo) {
        for (let i = 0; i < this.itemCluster.length; i++){
            if (utils.closureEqual(clo, this.itemCluster[i])) {
                return i;
            }
        }
        return Npos;
    }

    // 计算closure闭包: 
    // I: Closure
    calClosure(I) {
        for (let i = 0; i < I.itemClosure.length; i++){
            // console.log('START:-----', I.itemClosure);
            // for (let kkk = 0; kkk < I.itemClosure.length; kkk++){
            //     console.log('LrItems: ', this.lrItems[I.itemClosure[kkk].lrItem]);
            // }
            // 对每个lr1项：[A -> α·Bβ, a]
            const lr1_item = I.itemClosure[i];       // [A -> α·Bβ, a]
            const lr0_item = this.lrItems[lr1_item.lrItem]; // A -> α·Bβ, 是一个单一产生式
            // console.log('--------------');
            // console.log('LR1ITEM: ', lr1_item);
            // console.log('----------------');
            // console.log('LR0ITEM: ', lr0_item);
            // console.log('------------------');
            // '·'在最后一个位置 其后继没有非终结符
            if (lr0_item.dotPosition >= lr0_item.right.length) {
                continue;
            }
            const B = lr0_item.right[lr0_item.dotPosition];
            if (utils.isTerminal(this.symbols, B)) {
                continue;
            }
            if (utils.isEpsilon(this.symbols, B)) {
                // 如果B是ε，则当前项为 A->·ε
                // 为了不在ε上引出转移边，直接将项变为：A->ε·
                //FIXME: 我觉得这里会涉及深浅拷贝，去测试一下
                let tmp = utils.deepCopySingle(lr0_item);
                tmp.dotPosition++;
                I.itemClosure[i].lrItem = this.getLRItemsIndexByItem(tmp);
                continue;
            }
            let beta_a = [];
            //FIXME: 对应gp603行
            for (let k = lr0_item.dotPosition + 1; k < lr0_item.right.length; k++) {
                beta_a.push(lr0_item.right[k]);
            }
            // console.log('beta_a: ', beta_a);
            beta_a.push(lr1_item.lookAheadSymbol);
            // console.log('bbbeta_a: ', beta_a);
            let first_of_beta_a = this.getFirstOfProduction(beta_a);
            // console.log('firstbeta: ', first_of_beta_a);
            // 对每个 B -> ·γ 的lr0项
            for (let j = 0; j < this.lrItems.length; j++){
                if (this.lrItems[j].left !== B) {
                    continue;
                }
                else {
                    // 如果是 B->ε 则将 B->ε·项加入(为了不在ε上引出转移边)
                    let is_epsilon = utils.isEpsilon(this.symbols, this.lrItems[j].right[0]);
                    // 如果是ε产生式但dot不在尾部 继续遍历
                    if (is_epsilon && this.lrItems[j].dotPosition !== this.lrItems[j].right.length) {
                        continue;
                    }
                    // 如果不是ε产生式且dot不在起始位置 继续遍历
                    if (!is_epsilon && this.lrItems[j].dotPosition !== 0) {
                        continue;
                    }
                }
                /* 将 [B -> ·γ, b] 加入到 I 中 */
                /* 注意：1. 这里的b可能是'#'
                        2. 如果是 B->ε 产生式，会将 [B -> ε·, b] 加入到 I 中
                */
                for (let b of first_of_beta_a) {
                    if (!utils.isEpsilon(this.symbols, b)) {
                        if (!I.search(new LR1Item(j, b))) {
                            I.itemClosure.push(new LR1Item(j, b));
                        }
                    }
                }
            }
        }
        // console.log('in losur: ', I);
        return I;
    }

    // 计算GOTO状态转移
    // I: Closure，X: Number(int)
    gotoState(I, X) {
        let J = new Closure();
        // X必须是终结符或非终结符
        if (!utils.isTerminal(this.symbols, X) && !utils.isNonTerminal(this.symbols, X)) {
            return J;
        }
        for (let lr1_item of I.itemClosure) {
            // 对I中的每个 [A->α·Xβ, a]
            let lr0_item = this.lrItems[lr1_item.lrItem];
            // dot之后没有文法符号 继续遍历
            if (lr0_item.dotPosition >= lr0_item.right.length) {
                continue;
            }
            if (lr0_item.right[lr0_item.dotPosition] != X) {
                continue;
            }
            let tmp = utils.deepCopySingle(lr0_item);
            tmp.dotPosition++;
            J.itemClosure.push(new LR1Item(this.getLRItemsIndexByItem(tmp), lr1_item.lookAheadSymbol));
        }
        return this.calClosure(J);
    }

    // 计算LR1项目集簇
    getItems() {
        /* 初始化 item_cluster Closure({S' → ·S, $]}) */
        let initial_item = new Item(this.getSymbolIndexById(GrammarSymbol.ExtendStart),
            [this.getSymbolIndexById(GrammarSymbol.StartToken)],
            true, 0, this.startProduction);
        let initial_closure = new Closure();
        initial_closure.itemClosure.push(new LR1Item(this.getLRItemsIndexByItem(initial_item),
            this.getSymbolIndexById(GrammarSymbol.EndToken)));

        this.itemCluster.push(this.calClosure(initial_closure));
        // itemCluster中的每个项
        for (let i = 0; i < this.itemCluster.length; i++){
            for (let s = 0; s < this.symbols.length; s++){
                // 文法符号：终结符或非终结符
                if (this.symbols[s].type !== Type.Terminal && this.symbols[s].type !== Type.NonTerminal) {
                    continue;
                }
                // 计算 Goto(I,X)
                let transfer = this.gotoState(this.itemCluster[i], s);
                // if (i === 51) {
                //     console.log("s: ", s);
                //     console.log(transfer);
                //     if (s === 2) {
                //         console.log('就是你了！', this.itemCluster[29]);
                //     }
                    
                // }
                // 为空则跳过
                if (transfer.itemClosure.length === 0) {
                    // if (i === 51) {
                    //     console.log("空");
                    // }   
                    continue;
                }
                // 已经存在 记录转移状态即可
                let existed_index = this.isExistedClosure(transfer);
                // if (i === 51) {
                //     console.log("item_cluster: ", this.itemCluster.length);
                //     console.log("s(existed_index): ", s);
                //     console.log("existed_index: ", existed_index);
                // }
                
                if (existed_index !== Npos) {
                    this.gotoTemp.set(utils.generateKey(i, s), existed_index);
                    continue;
                }
                // 不存在也不为空 加入进item_cluster并记录转移状态
                this.itemCluster.push(transfer);
                // 记录closure之间的转移关系
                this.gotoTemp.set(utils.generateKey(i, s), this.itemCluster.length - 1);
            }
        }
    }

    // 构建LR1表
    //FIXME: 注意构建出的用来记录LR1表的map是无序的
    buildTable() {
        for (let cluster_idx = 0; cluster_idx < this.itemCluster.length; cluster_idx++){
            for (let lr_item_idx = 0; lr_item_idx < this.lrItems.length; lr_item_idx++){
                for (let ter of this.terminals) {
                    // 如果lr1项不在当前闭包中 继续遍历
                    if (!this.itemCluster[cluster_idx].search(new LR1Item(lr_item_idx, ter))) {
                        continue;
                    }
                    let lr0_item = this.lrItems[lr_item_idx];
                    let pro_index = lr0_item.productionIndex;
                    let pro_left = lr0_item.left;
                    let pro_dot_pos = lr0_item.dotPosition;
                    let la_symbol = ter;
                    // if (cluster_idx === 0 && lr_item_idx === 0) {
                    //     console.log('lr0_item: ', lr0_item);
                    //     console.log('pro_index: ', pro_index);
                    //     console.log('pro_left: ', pro_left);
                    //     console.log('pro_dot_pos: ', pro_dot_pos);
                    //     console.log('la_symbol: ', la_symbol);
                    // }
                    
                    if (pro_dot_pos >= lr0_item.right.length) {
                        if (this.symbols[pro_left].id !== GrammarSymbol.ExtendStart) {
                            this.actionTable.set(utils.generateKey(cluster_idx, la_symbol), utils.generateKey(Action.Reduce, pro_index));
                        }
                        else {
                            let end_index = this.getSymbolIndexById(GrammarSymbol.EndToken);
                            this.actionTable.set(utils.generateKey(cluster_idx, end_index), utils.generateKey(Action.Accept, -1));
                        }
                    }
                    else {
                        let item_after_dot = lr0_item.right[pro_dot_pos];
                        if (!utils.isTerminal(this.symbols, item_after_dot)) {
                            continue;
                        }
                        if (this.gotoTemp.has(utils.generateKey(cluster_idx, item_after_dot))) {
                            this.actionTable.set(utils.generateKey(cluster_idx, item_after_dot),
                                utils.generateKey(Action.ShiftIn, this.gotoTemp.get(utils.generateKey(cluster_idx, item_after_dot))));
                        }
                    }
                }
                for (let non_ter of this.nonTerminals) {
                    if (this.gotoTemp.has(utils.generateKey(cluster_idx, non_ter))) {
                        this.gotoTable.set(utils.generateKey(cluster_idx, non_ter),
                            utils.generateKey(Action.ShiftIn, this.gotoTemp.get(utils.generateKey(cluster_idx, non_ter))));
                    }
                }
            }
        }
    }

    // 报错 token: Token
    raiseError(token) {
        console.log('\nError found near : ' + token.value + '【row = ' + token.row_no + '】');
    }

    // LR1类的初始化函数
    //FIXME: 注意调用LR_1之前一定要先调用Grammar类的初始化函数
    LR_1() {
        this.generateLRItems();
        this.getItems();
        this.buildTable();
    }

    // 输出LR1表
    showLR1Table(path) {
        let outputStream = ' ';
        let cnt = 1;
        for (let ter of this.terminals) {
            if (this.symbols[ter].id === ',') {
                // ,用`代替
                outputStream += (',`');
            }
            else {
                outputStream += (',' + this.symbols[ter].id);
            }
            cnt++;
        }
        
        for (let nonter of this.nonTerminals) {
            if(this.symbols[nonter].id === GrammarSymbol.ExtendStart){
                continue;
            }
            outputStream += (',' + this.symbols[nonter].id);
            cnt++;
        }
        outputStream += '\n';
        // 初始化一个固定大小的二维数组
        let arr = [];
        for(let i = 0; i < this.itemCluster.length; i++) {
            arr[i] = new Array();
            for(let j = 0; j < cnt; j++) {
                arr[i][j] = ' ';
            }
        }

        for (let [key, value] of this.actionTable) {
            let tmpkey = utils.parseKey(key);
            let tmpvalue = utils.parseValue(value);
            let str = '';
            if (tmpvalue.action === Action.ShiftIn) {
                str = 's' + String(tmpvalue.info);
            }
            else if (tmpvalue.action === Action.Reduce) {
                str = 'r' + String(tmpvalue.info);
            }
            else if (tmpvalue.action === Action.Accept) {
                str = 'acc';
            }
            // 差了个@，所以要减1
            arr[tmpkey.i][tmpkey.j - 1 < 0 ? 0 : tmpkey.j - 1] = str;
        }

        for (let [key, value] of this.gotoTable) {
            let tmpkey = utils.parseKey(key);
            let tmpvalue = utils.parseValue(value);
            let str = tmpvalue.info;
            // 差了个@和S（拓广文法起始符），所以要减2
            arr[tmpkey.i][tmpkey.j - 2] = str;
        }

        for (let i = 0; i < arr.length; i++){
            outputStream += (String(i));
            for (let j = 0; j < arr[i].length; j++){
                outputStream += (',' + arr[i][j]);
            }
            outputStream += '\n';
        }

        // 将LR1分析表写入文件
        try {
            const data = fs.writeFileSync(path, outputStream);
            console.log('\n语法分析的LR(1)分析表已导出至: ' + path);
        }
        catch (error) {
            console.log('\nLR(1)分析表导出失败！');
            console.error(error);
            process.exit(-1);
        }
    }

    // 利用已经构建好的LR1分析表进行语法分析 tokenstream: Array(Token)
    parseToken(tokenStream) {
        let outputStream = '';
        tokenStream.push(new Token(GrammarSymbol.EndToken, GrammarSymbol.EndToken, Number.MAX_SAFE_INTEGER));
        class temp_pair {
            constructor(state_, symbol_) {
                this.first = state_;
                this.second = symbol_;
            }
        }
        let symbol_stack = [];  // temp_pair, first -> pstate; second -> psymbol
        let g_error_count = 0;  // 语法分析报错个数
        let s_error_count = 0;  // 词法分析报错个数
        
        //TODO: 语义分析部分 
        //TODO: semantic.AddSymbolToList(SymbolAttribute(StartToken));

        let step = 0;
        outputStream += '步骤 \t 符号栈 \t 产生式 \n';
        // 栈初始化
        symbol_stack.push(new temp_pair(0, this.getSymbolIndexById(GrammarSymbol.EndToken)));
        outputStream += (String(++step) + ' \t ');
        for (let p of symbol_stack) {
            outputStream += '(';
            outputStream += String(p.first);
            outputStream += ',';
            outputStream += this.symbols[p.second].id;
            outputStream += ')';
        }
        outputStream += ' \t \n';
        let endFlag = false;
        // 开始分析
        for (let i = 0; i < tokenStream.length; i++){
            let cur_state = symbol_stack[symbol_stack.length - 1].first;
            let token_idx = this.getSymbolIndexById(tokenStream[i].token);
            if (!this.actionTable.has(utils.generateKey(cur_state, token_idx))) {
                this.raiseError(tokenStream[i]);
                // process.exit(-1);
                do {
                    symbol_stack.pop();
                } while (!this.actionTable.has(utils.generateKey(symbol_stack[symbol_stack.length - 1].first, token_idx)));
                i--;
                g_error_count++;
            }
            else {
                let action_iter = this.actionTable.get(utils.generateKey(cur_state, token_idx));
                let action_info = utils.parseValue(action_iter);
                switch (action_info.action) {
                    case Action.ShiftIn:
                        symbol_stack.push(new temp_pair(action_info.info, token_idx));
                        outputStream += (String(++step) + ' \t ');
                        for (let p of symbol_stack) {
                            outputStream += '(';
                            outputStream += String(p.first);
                            outputStream += ',';
                            outputStream += this.symbols[p.second].id;
                            outputStream += ')';
                        }
                        outputStream += ' \t \n';
                        break;
                    case Action.Reduce:
                        let production = this.productions[action_info.info];
                        /* 非空串需要出栈 空串由于右部为空
                         * 不需要出栈(直接push空串对应产生式左部非终结符即可) */
                        if (!utils.isEpsilon(this.symbols, production.right[0])) {
                            let count = production.right.length;
                            while (count--) {
                                symbol_stack.pop();
                            }
                        }
                        if (!this.gotoTable.has(utils.generateKey(symbol_stack[symbol_stack.length - 1].first, production.left))) {
                            this.raiseError(tokenStream[i]);
                            do {
                                symbol_stack.pop();
                            } while (!this.gotoTable.has(utils.generateKey(symbol_stack[symbol_stack.length - 1], token_idx)));
                            i--;
                            g_error_count++;
                        }
                        else {
                            let goto_iter = this.gotoTable.get(utils.generateKey(symbol_stack[symbol_stack.length - 1].first, production.left));
                            symbol_stack.push(new temp_pair(utils.parseValue(goto_iter).info, production.left));
                            i--;
                            let pro_left = this.symbols[production.left].id;
                            let pro_right = [];
                            for (let r of production.right) {
                                pro_right.push(this.symbols[r].id);
                            }
                            //TODO: 语义分析
                            outputStream += (String(++step) + ' \t ');
                            for (let p of symbol_stack) {
                                outputStream += '(';
                                outputStream += String(p.first);
                                outputStream += ',';
                                outputStream += this.symbols[p.second].id;
                                outputStream += ')';
                            }
                            outputStream += ' \t ';
                            outputStream += pro_left;
                            outputStream += '->';
                            for (let m of pro_right) {
                                outputStream += m;
                                outputStream += ' ';
                            }
                            outputStream += '\n';
                        }
                        break;
                    case Action.Accept:
                        endFlag = true;
                        break;
                    default:
                        //TODO: error处理
                        endFlag = true;
                        break;
                }
            }
            if (endFlag) {
                break;
            }
        }

        // 将语法分析的栈写入文件
        let path = '../result/lr1_process.dat';
        try {
            const data = fs.writeFileSync(path, outputStream);
            console.log('\n语法分析的LR(1)分析过程已导出至: ' + path);
        }
        catch (error) {
            console.log('\nLR(1)分析过程导出失败！');
            console.error(error);
            process.exit(-1);
        }
        return [g_error_count, s_error_count];
    }

    // 工具函数：打印
    print_line(step, i, production_index, status_stack, symbol_stack, tokenStream) {
        let temp = '';
        // 输出第几步
        temp += String(step).padStart(PrintFormat.step_len, ' ');

        // 状态栈的string
        let statusStackStr = '';
        for (let status of status_stack) {
            statusStackStr += (' ' + String(status));
        }
        temp += statusStackStr.padStart(PrintFormat.status_len, ' ');

        // 符号栈的string
        let symbolStackStr = '';
        for (let symbol of symbol_stack) {
            symbolStackStr += ('(' + String(symbol) + ',' + this.symbols[symbol].id + ')');
        }
        temp += symbolStackStr.padStart(PrintFormat.symbol_len, ' ');

        // 输入串的string
        let inputStr = '';
        for (let j = 0 + i; j < tokenStream.length; j++){
            inputStr += tokenStream[j].token;
        }
        temp += inputStr.padStart(PrintFormat.input_len, ' ');

        // 产生式的string
        if (production_index !== -1) {
            let productionStr = '';
            productionStr += this.symbols[this.productions[production_index].left].id;
            productionStr += ' ::= ';
            for (let r of this.productions[production_index].right) {
                productionStr += (this.symbols[r].id + ' ');
            }
            temp += productionStr.padStart(PrintFormat.production_len, ' ');
        }
        temp += '\n';
        return temp;
    }

    // 新的parser tokenstream: Array(Token)
    parser(tokenStream) {
        let endFlag = false;
        let g_error_count = 0;
        let s_error_count = 0;
        let outputStream = '';
        tokenStream.push(new Token(GrammarSymbol.EndToken, GrammarSymbol.EndToken, Number.MAX_SAFE_INTEGER));

        let symbol_stack = [];  // Number(int)
        let status_stack = [];  // Number(int)

        let step = 1;

        // 首行
        outputStream += "步骤".padStart(PrintFormat.step_len, ' ');
        outputStream += "状态".padStart(PrintFormat.status_len, ' ');
        outputStream += "符号".padStart(PrintFormat.symbol_len, ' ');
        outputStream += "输入串".padStart(PrintFormat.input_len, ' ');
        outputStream += "产生式".padStart(PrintFormat.production_len, ' ');
        outputStream += '\n';

        //TODO: 语义分析
        this.semanticAnalyse.initialize();
        this.semanticAnalyse.addSymbolTolist(new SemanticSymbol(GrammarSymbol.StartToken, '', -1, -1, -1, -1));

        // 初始化栈
        symbol_stack.push(this.getSymbolIndexById(GrammarSymbol.EndToken));
        status_stack.push(0);

        outputStream += this.print_line(step, 0, -1, status_stack, symbol_stack, tokenStream);
        step++;

        // 开始遍历单词流
        for (let i = 0; i < tokenStream.length; i++){
            let current_state = status_stack[status_stack.length - 1];
            let current_token_index = this.getSymbolIndexById(tokenStream[i].token);
            // 如果找不到这个字符
            if (current_token_index === -1) {
                console.log('\n单词流中出现文法未知的终结符！');
                process.exit(-1);
            }
            if (!this.actionTable.has(utils.generateKey(current_state, current_token_index))) {
                this.raiseError(tokenStream[i]);
                g_error_count++;
                //FIXME: 
                process.exit(-1);
            }
            else {
                let current_action_iter = this.actionTable.get(utils.generateKey(current_state, current_token_index));
                let current_actionInfo = utils.parseValue(current_action_iter);

                // 根据ActionInfo的类别
                switch (current_actionInfo.action) {
                    case Action.ShiftIn:
                        symbol_stack.push(current_token_index);
                        status_stack.push(current_actionInfo.info);
                        outputStream += this.print_line(step, i + 1, -1, status_stack, symbol_stack, tokenStream);
                        step++;
                        //TODO: 语义分析
                        this.semanticAnalyse.addSymbolTolist(new SemanticSymbol(tokenStream[i].token,
                            tokenStream[i].value, tokenStream[i].row_no, -1, -1, -1));
                        break;
                    case Action.Reduce:
                        // 规约使用的production
                        let production_index = current_actionInfo.info;
                        let production = this.productions[production_index];
                        // 非空串需要出栈，空串不需要出栈（因为右部为空）
                        if (this.symbols[production.right[0]].type !== Type.Epsilon) {
                            let count = production.right.length;
                            while (count--) {
                                symbol_stack.pop();
                                status_stack.pop();
                            }
                        }
                        if (!this.gotoTable.has(utils.generateKey(status_stack[status_stack.length - 1], production.left))) {
                            this.raiseError(tokenStream[i]);
                            g_error_count++;
                            //FIXME: 
                            process.exit(-1);
                        }
                        else {
                            let current_goto_iter = this.gotoTable.get(utils.generateKey(status_stack[status_stack.length - 1], production.left));
                            // 移入符号栈和状态栈
                            symbol_stack.push(production.left);
                            status_stack.push(utils.parseValue(current_goto_iter).info);

                            outputStream += this.print_line(step, i, production_index, status_stack, symbol_stack, tokenStream);
                            step++;
                            i--;
                            //TODO: 语义分析
                            let pro_right = [];
                            for (let s of production.right) {
                                pro_right.push(this.symbols[s].id);
                            }
                            // if (this.symbols[production.left].id === 'ExtDef') {
                            //     console.log(pro_right);
                            // }
                            this.semanticAnalyse.Analysis(this.symbols[production.left].id, pro_right);
                        }
                        break;
                    case Action.Accept:
                        outputStream += (String(step).padStart(PrintFormat.step_len, ' ') + "acc!".padStart(PrintFormat.status_len, ' ') + '\n');
                        endFlag = true;
                        break;
                    case Action.Error:
                        endFlag = true;
                        break;
                }
            }
            if (endFlag) {
                break;
            }
        }
        return outputStream;
    }

    // 输出LR1过程
    printLr1Process(outputStream, path) {
        // 将语法分析的栈写入文件
        try {
            const data = fs.writeFileSync(path, outputStream);
            console.log('\n语法分析的LR(1)分析过程已导出至: ' + path);
        }
        catch (error) {
            console.log('\nLR(1)分析过程导出失败！');
            console.error(error);
            process.exit(-1);
        }
    }
}
export { Grammar, LR1 };
export { Type, GrammarSymbol, Action };

