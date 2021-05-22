import * as utils from './utils.js';


// 非法位置
const Npos = -1;

/**
 * @brief 标识符类别：
 * 函数
 * 变量
 * 临时变量
 * 常量
 * 返回值
 */
const IdentifierType = {
    Function: 0,
    Variable: 1,
    TempVar: 2,
    ConstVar: 3,
    ReturnVar: 4
};

/**
 * @brief 符号表枚举类型定义：
 * 全局表
 * 函数表
 * 块级表
 * 临时表
 */
const SymbolTableType = {
    GlobalTable: 0,
    FunctionTable: 1,
    BlockTable: 2,
    TempTable: 3
}

/**
 * @brief 语义分析中的符号
 * @param token 符号标识 string
 * @param value 符号的具体值 string
 * @param row 行 Number(int)
 * @param col 列 Number(int)
 * @param tableIdx 符号所在的表的index Number(int)
 * @param index 符号在所在表内的index Number(int)
 */
class SemanticSymbol {
    constructor(token_ = '', value_ = '', row_ = -1, col_ = -1, tableIdx_ = -1, index_ = -1) {
        this.token = token_;
        this.value = value_;
        this.row = row_;
        this.col = col_;
        this.tableIdx = tableIdx_;
        this.index = index_;
    }
}

/**
 * @brief 语义分析过程中标识符的具体信息
 * @param idType 标识符类别 IdentifierType
 * @param spType 变(常)量类型/函数返回类型 string
 * @param idName 标识符名/常量值 string
 * @param parameterNum 函数参数个数 int
 * @param functionEntry 函数入口地址(四元式的标号) int
 * @param functionTableIdx 函数的函数符号表在整个程序的符号表列表中的索引 int
 */
class IdentifierInfo {
    constructor(idType_ = -1, spType_ = '', idName_ = '', parameterNum_ = 0, functionEntry_ = -1, functionTableIdx_ = -1) {
        this.idType = idType_;
        this.spType = spType_;
        this.idName = idName_;
        this.parameterNum = parameterNum_;
        this.functionEntry = functionEntry_;
        this.functionTableIdx = functionTableIdx_;
    }
}

/**
 * @brief 符号表定义
 * @param tableType 表类型 SymbolTableType
 * @param table 符号列表 Array(IdentifierInfo)
 * @param tableName 表名 string
 */
class SymbolTable {
    constructor(tableType_ = -1, table_ = [], tableName_ = '') {
        this.tableType = tableType_;
        this.table = table_;
        this.tableName = tableName_;
    }

    // 返回Number（找到的位置 or -1）
    findSymbol(id_name) {
        for (let i = 0; i < this.table.length; i++){
            if (this.table[i].idName === id_name) {
                return i;
            }
        }
        return -1;
    }

    // 返回Number（添加后的位置 or -1）
    addSymbol(id) {
        let pos = this.findSymbol(id.idName);
        if (pos === -1) {
            this.table.push(id);
            pos = table.length - 1;
        }
        else {
            pos = -1;
        }
        return pos;
    }
}

/**
 * @brief 四元式定义
 * @param label 四元式的标号 Number(int)
 * @param operate 操作类型 string
 * @param arg1 参数1 string
 * @param arg2 参数2 string
 * @param result 结果 string
 */
class Quadruple {
    constructor(label_, operate_, arg1_, arg2_, result_) {
        this.label = label_;
        this.operate = operate_;
        this.arg1 = arg1_;
        this.arg2 = arg2_;
        this.result = result_;
    }
}

/**
 * @brief 语义分析器
 * @param symbolList 语义分析过程的符号数组 Array(SemanticSymbol)
 * @param tables 程序所有符号表数组 Array(SymbolTable)
 * @param currentTableStack 当前作用域对应的符号表 索引栈 Array(Number(int))
 * @param nextLabelNum 下一个四元式的标号 Number(int)
 * @param tempVarCount 临时变量计数 Number(int)
 * @param quadruples 生成的四元式 Array(Quadruple)
 * @param backpatchingLevel 回填层次 Number(int)
 * @param backpatchingList 回填列表 Array(Number(int))
 * @param mainLabel main函数对应的四元式标号 Number(int)
 */
class Semantic {
    constructor() {
        this.symbolList = [];
        this.tables = [];
        this.currentTableStack = [];
        this.nextLabelNum = 1;
        this.tempVarCount = 0;
        this.quadruples = [];
        this.backpatchingLevel = 0;
        this.backpatchingList = [];
        this.mainLabel = -1;
    }

    // 初始化
    initialize() {
        // 创建全局符号表
        this.tables.push(new SymbolTable(SymbolTableType.GlobalTable, 'global table'));

        // 当前作用域为全局作用域
        this.currentTableStack.push(0);

        // 创建临时变量表：所有临时变量存在一个表中
        this.tables.push(new SymbolTable(SymbolTableType.TempTable, 'temp variable table'));

        // 从 1 开始生成四元式标号；0号用于 (j, -, -, main_address)
        this.nextLabelNum = 1;

        // main函数标号置非法
        this.mainLabel = Npos;

        // 初始回填层次为0，表示不需要回填
        this.backpatchingLevel = 0;

        // 临时变量计数
        this.tempVarCount = 0;
    }

    // 将所有的符号信息放入symbolList(symbol: SemanticSymbol)
    addSymbolTolist(symbol) {
        this.symbolList.push(symbol);
    }

    // 打印四元式
    printQuadruple(path) {
        let quad = '';

        for (let q of this.quadruples) {
            quad += String(q.label);
            //FIXME: 为了对齐
            if (q.label < 10) {
                quad += ' ';
            }
            quad += q.operate;
            quad += ', ';
            quad += q.arg1;
            quad += ', ';
            quad += q.arg2
            quad += ', ';
            quad += q.result;
            quad += '\n';
        }

        try {
            const data = fs.writeFileSync(path, quad);
            console.log('\n语义分析的四元式已导出至: ' + path);
        }
        catch (error) {
            console.log('\n四元式导出失败！');
            console.error(error);
            process.exit(-1);
        }
    }
}