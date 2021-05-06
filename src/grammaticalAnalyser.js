import fs from 'fs';
import { isEqual } from './utils.js';
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

/**
 * @brief 文法中的符号
 * @param id: 符号的字符串标识(唯一) Number
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

export { Npos, Type, GrammarSymbol };

