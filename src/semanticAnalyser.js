import * as utils from './utils.js';
import fs from 'fs';

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

    // 返回Number（找到的位置 or -1）id_name: string
    findSymbol(id_name) {
        for (let i = 0; i < this.table.length; i++){
            if (this.table[i].idName === id_name) {
                return i;
            }
        }
        return -1;
    }

    // 返回Number（添加后的位置 or -1）id: IdentifierInfo
    addSymbol(id) {
        let pos = this.findSymbol(id.idName);
        if (pos === -1) {
            this.table.push(id);
            pos = this.table.length - 1;
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
        this.tables.push(new SymbolTable(SymbolTableType.GlobalTable, [], 'global table'));

        // 当前作用域为全局作用域
        this.currentTableStack.push(0);

        // 创建临时变量表：所有临时变量存在一个表中
        this.tables.push(new SymbolTable(SymbolTableType.TempTable, [], 'temp variable table'));

        // 从 1 开始生成四元式标号；0号用于 (j, -, -, main_address)
        this.nextLabelNum = 1;

        // main函数标号置非法
        this.mainLabel = Npos;

        // 初始回填层次为0，表示不需要回填
        this.backpatchingLevel = 0;

        // 临时变量计数
        this.tempVarCount = 0;
    }

    // 将所有的符号信息放入symbolList symbol: SemanticSymbol
    addSymbolTolist(symbol) {
        this.symbolList.push(symbol);
    }

    // 打印四元式 path: string
    printQuadruple(path) {
        let quad = '';

        for (let q of this.quadruples) {
            quad += String(q.label);
            //FIXME: 为了对齐
            if (q.label < 10) {
                quad += ' ';
            }
            quad += ' : '
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

    // 获取四元式
    getQuadruple() {
        return this.quadruples;
    }

    // 总体分析过程, 输入参数为产生式左右边
    // left: string, right: Array(string)
    Analysis(left, right) {
        if (left === 'Program') {
            this.Analysis_Program(left, right);
        }
        else if (left === 'ExtDef') {
            this.Analysis_ExtDef(left, right);
        }
        else if (left === 'VarSpecifier') {
            this.Analysis_VarSpecifier(left, right);
        }
        else if (left === 'FunSpecifier') {
            this.Analysis_FunSpecifier(left, right);
        }
        else if (left === 'FunDec') {
            this.Analysis_FunDec(left, right);
        }
        else if (left === 'CreateFunTable_m') {
            this.Analysis_CreateFunTable_m(left, right);
        }
        else if (left === 'ParamDec') {
            this.Analysis_ParamDec(left, right);
        }
        else if (left === 'Block') {
            this.Analysis_Block(left, right);
        }
        else if (left === 'Def') {
            this.Analysis_Def(left, right);
        }
        else if (left === 'AssignStmt') {
            this.Analysis_AssignStmt(left, right);
        }
        else if (left === 'Exp') {
            this.Analysis_Exp(left, right);
        }
        else if (left === 'AddSubExp') {
            this.Analysis_AddSubExp(left, right);
        }
        else if (left === 'Item') {
            this.Analysis_Item(left, right);
        }
        else if (left === 'Factor') {
            this.Analysis_Factor(left, right);
        }
        else if (left === 'CallStmt') {
            this.Analysis_CallStmt(left, right);
        }
        else if (left === 'CallFunCheck') {
            this.Analysis_CallFunCheck(left, right);
        }
        else if (left === 'Args') {
            this.Analysis_Args(left, right);
        }
        else if (left === 'ReturnStmt') {
            this.Analysis_ReturnStmt(left, right);
        }
        else if (left === 'Relop') {
            this.Analysis_Relop(left, right);
        }
        else if (left === 'IfStmt') {
            this.Analysis_IfStmt(left, right);
        }
        else if (left === 'IfStmt_m1') {
            this.Analysis_IfStmt_m1(left, right);
        }
        else if (left === 'IfStmt_m2') {
            this.Analysis_IfStmt_m2(left, right);
        }
        else if (left === 'IfNext') {
            this.Analysis_IfNext(left, right);
        }
        else if (left === 'IfStmt_next') {
            this.Analysis_IfStmt_next(left, right);
        }
        else if (left === 'WhileStmt') {
            this.Analysis_WhileStmt(left, right);
        }
        else if (left === 'WhileStmt_m1') {
            this.Analysis_WhileStmt_m1(left, right);
        }
        else if (left === 'WhileStmt_m2') {
            this.Analysis_WhileStmt_m2(left, right);
        }
        else {
            if (right[0] !== '@') {
                let count = right.length;
                while (count--) {
                    this.symbolList.pop();
                }
            }
            this.symbolList.push(new SemanticSymbol(left, '', -1, -1, -1, -1));
        }
    }

    // Program ::= ExtDefList
    Analysis_Program(left, right) {
        if (this.mainLabel === -1) {
            console.log('\n未定义main函数');
            process.exit(-1);
        }
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        // 在最前面加入四元式
        this.quadruples.unshift(new Quadruple(0, 'j', '-', '-', String(this.mainLabel)));
        
        // 更新symbolList
        this.symbolList.push(new SemanticSymbol(left, '', -1, -1, -1, -1));
    }
    // ExtDef ::= VarSpecifier <ID> ; | FunSpecifier FunDec Block
    Analysis_ExtDef(left, right) {
        // 定义变量
        if (right.length === 3) {
            // 目前symbol_list的末尾是Specifier <ID> ;，由此找到Specifier和<ID>
            let specifier = this.symbolList[this.symbolList.length - 3];
            let identifier = this.symbolList[this.symbolList.length - 2];

            let existed = false;
            let currentTable = this.tables[this.currentTableStack[this.currentTableStack.length - 1]];
            if (currentTable.findSymbol(identifier.value) !== -1) {
                console.log('变量 %s 重定义 【row = %d】', identifier.value, identifier.row);
                process.exit(-1);
            }

            // 将这一变量加入table
            let variable = new IdentifierInfo(IdentifierType.Variable, specifier.value, identifier.value);
            // 加入table
            this.tables[this.currentTableStack[this.currentTableStack.length - 1]].addSymbol(variable);

            // 更新symbolList
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, identifier.value, identifier.row, -1,
                this.currentTableStack[this.currentTableStack.length - 1],
                this.tables[this.currentTableStack[this.currentTableStack.length - 1]].table.length - 1));
        }
        // 定义函数
        else {
            let identifier = this.symbolList[this.symbolList.length - 2];
            // 退出作用域
            this.currentTableStack.pop();
            // 更新symbolList
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, identifier.value, identifier.row, -1,
                identifier.tableIdx, identifier.index));
        }
    }
    // VarSpecifier ::= int
    Analysis_VarSpecifier(left, right) {
        // symbolList最后一个是int
        let specifier = this.symbolList[this.symbolList.length - 1];
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, specifier.value, specifier.row, -1, -1, -1));
    }
    // FunSpecifier ::= void | int
    Analysis_FunSpecifier(left, right) {
        // symbolList最后一个是int
        let specifier = this.symbolList[this.symbolList.length - 1];
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, specifier.value, specifier.row, -1, -1, -1));
    }
    // FunDec ::= <ID> CreateFunTable_m ( VarList )
    Analysis_FunDec(left, right) {
        // symbol_list的CreateFunTable_m记录了table信息
        let specifier = this.symbolList[this.symbolList.length - 4];
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, specifier.value, specifier.row, -1, specifier.tableIdx, specifier.index));
    }
    // CreateFunTable_m ::= @
    Analysis_CreateFunTable_m(left, right) {
        // 创建函数表
        // 此时symbol_list最后一个符号为函数名，倒数第二个为函数返回值
        let identifier = this.symbolList[this.symbolList.length - 1];
        let specifier = this.symbolList[this.symbolList.length - 2];

        // 首先在全局的table判断函数名是否重定义
        if (this.tables[0].findSymbol(identifier.value) !== -1) {
            console.log('变量 %s 重定义 【row = %d】', identifier.value, identifier.row);
            process.exit(-1);
        }

        // 创建函数表
        this.tables.push(new SymbolTable(SymbolTableType.FunctionTable, [], identifier.value));
        // 在全局符号表创建当前函数的符号项（这里参数个数和入口地址会进行回填）
        this.tables[0].addSymbol(new IdentifierInfo(IdentifierType.Function, specifier.value, identifier.value,
            0, 0, this.tables.length - 1));
        
        // 函数表压入栈
        this.currentTableStack.push(this.tables.length - 1);

        // 返回值
        let return_value = new IdentifierInfo(IdentifierType.ReturnVar, specifier.value, this.tables[this.tables.length - 1].tableName + '_return_value');

        // 如果是main函数，则记录
        if (identifier.value === 'main') {
            this.mainLabel = this.nextLabelNum;
        }

        // 加入四元式
        this.quadruples.push(new Quadruple(this.nextLabelNum++, identifier.value, '-', '-', '-'));

        // 向函数表中加入返回变量
        this.tables[this.currentTableStack[this.currentTableStack.length - 1]].addSymbol(return_value);

        // 空串不需要pop
        // 进行push
        this.symbolList.push(new SemanticSymbol(left, identifier.value, identifier.row, -1, 0, this.tables[0].table.length - 1));
    }
    // ParamDec ::= VarSpecifier <ID>
    Analysis_ParamDec(left, right) {
        // symbol_list最后一个为变量名，倒数第二个为类型
        let identifier = this.symbolList.slice(-1)[0];
        let specifier = this.symbolList[this.symbolList.length - 2];

        // 当前函数表
        let function_table = this.tables[this.currentTableStack.slice(-1)[0]];

        // 如果已经进行过定义
        if (function_table.findSymbol(identifier.value) !== -1) {
            console.log('函数参数 %s 重定义 【row = %d】', identifier.value, identifier.row);
            process.exit(-1);
        }

        // 函数表加入形参变量
        let new_position = function_table.addSymbol(new IdentifierInfo(IdentifierType.Variable, specifier.value,
            identifier.value, -1, -1, -1));
        
        // 当前函数在全局符号中的索引
        let table_position = this.tables[0].findSymbol(function_table.tableName);

        // 形参个数改变
        this.tables[0].table[table_position].parameterNum++;

        // 加入四元式
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'defpar', '-', '-', identifier.value));

        // symbollist更新
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, identifier.value, identifier.row, -1, this.currentTableStack.slice(-1)[0], new_position));
    }
    // Block ::= { DefList StmtList }
    Analysis_Block(left, right) {
        // symbolList更新
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, String(this.nextLabelNum), -1, -1, -1, -1));
    }
    // Def ::= VarSpecifier <ID> ;
    Analysis_Def(left, right) {
        // symbol_list的倒数第二个、倒数第三个是变量名和类型
        let identifier = this.symbolList[this.symbolList.length - 2];
        let specifier = this.symbolList[this.symbolList.length - 3];
        let current_table = this.tables[this.currentTableStack.slice(-1)[0]];

        // 重定义则报错
        if (current_table.findSymbol(identifier.value) !== -1) {
            console.log('函数参数 %s 重定义 【row = %d】', identifier.value, identifier.row);
            process.exit(-1);
        }

        current_table.addSymbol(new IdentifierInfo(IdentifierType.Variable, specifier.value, identifier.value, -1, -1, -1));

        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, identifier.value, identifier.row, -1,
            this.currentTableStack.slice(-1)[0], this.tables[this.currentTableStack.slice(-1)[0]].table.length - 1));
    }
    // AssignStmt ::= <ID> = Exp
    Analysis_AssignStmt(left, right) {
        // symbol_list的倒数第一个、倒数第三个是Exp和变量名
        let identifier = this.symbolList[this.symbolList.length - 3];
        let exp = this.symbolList.slice(-1)[0];

        // 检查id是否存在，不存在则报错
        let existed = false;
        let table_index = -1;
        let index = -1;

        // 从当前层开始向上遍历
        for (let scope_layer = this.currentTableStack.length - 1; scope_layer >= 0; scope_layer--){
            let current_table = this.tables[this.currentTableStack[scope_layer]];
            if ((index = current_table.findSymbol(identifier.value)) !== -1) {
                existed = true;
                table_index = this.currentTableStack[scope_layer];
                break;
            }
        }
        if (!existed) {
            console.log('变量 %s 未定义 【row = %d】', identifier.value, identifier.row);
            process.exit(-1);
        }

        this.quadruples.push(new Quadruple(this.nextLabelNum++, '=', exp.value, '-', identifier.value));

        // 更新symbol_list
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, identifier.value, identifier.row, -1, table_index, index));
    }
    // Exp ::= AddSubExp | Exp Relop AddSubExp
    Analysis_Exp(left, right) {
        if (right.length === 1) {
            let exp = this.symbolList.slice(-1)[0];
            // 更新symbolList
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, exp.value, exp.row, -1, exp.tableIdx, exp.index));
        }
        else {
            let sub_exp1 = this.symbolList[this.symbolList.length - 3];
            let op = this.symbolList[this.symbolList.length - 2];
            let sub_exp2 = this.symbolList[this.symbolList.length - 1];
            let next_label_num = this.nextLabelNum++;
            let new_tmp_var = 'T' + String(this.tempVarCount++);
            
            this.quadruples.push(new Quadruple(next_label_num, 'j' + op.value, sub_exp1.value, sub_exp2.value, String(next_label_num + 3)));
            this.quadruples.push(new Quadruple(this.nextLabelNum++, '=', '0', '-', new_tmp_var));
            this.quadruples.push(new Quadruple(this.nextLabelNum++, 'j', '-', '-', String(next_label_num + 4)));
            this.quadruples.push(new Quadruple(this.nextLabelNum++, '=', '1', '-', new_tmp_var));

            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, new_tmp_var, -1, -1, -1, -1));
        }
    }
    // AddSubExp ::= Item | Item + Item | Item - Item
    Analysis_AddSubExp(left, right) {
        if (right.length === 1) {
            let exp = this.symbolList.slice(-1)[0];
            // 更新symbol_list
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, exp.value, exp.row, -1, exp.tableIdx, exp.index));
        }
        else {
            let sub_exp1 = this.symbolList[this.symbolList.length - 3];
            let op = this.symbolList[this.symbolList.length - 2];
            let sub_exp2 = this.symbolList[this.symbolList.length - 1];
            let new_tmp_var = 'T' + String(this.tempVarCount++);

            this.quadruples.push(new Quadruple(this.nextLabelNum++, op.value, sub_exp1.value, sub_exp2.value, new_tmp_var));
            // 更新symbol_list
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, new_tmp_var, -1, -1, -1, -1));
        }
    }
    // Item ::= Factor | Factor * Factor | Factor / Factor
    Analysis_Item(left, right) {
        if (right.length === 1) {
            let exp = this.symbolList.slice(-1)[0];
            // 更新symbol_list
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, exp.value, exp.row, -1, exp.tableIdx, exp.index));
        }
        else {
            let sub_exp1 = this.symbolList[this.symbolList.length - 3];
            let op = this.symbolList[this.symbolList.length - 2];
            let sub_exp2 = this.symbolList[this.symbolList.length - 1];
            let new_tmp_var = 'T' + String(this.tempVarCount++);

            this.quadruples.push(new Quadruple(this.nextLabelNum++, op.value, sub_exp1.value, sub_exp2.value, new_tmp_var));

            // 更新symbol_list
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, new_tmp_var, -1, -1, -1, -1));
        }
    }
    // Factor ::= <INT> | ( Exp ) | <ID> | CallStmt
    Analysis_Factor(left, right) {
        // console.log(left);
        // console.log(right);
        // console.log(this.symbolList);
        if (right.length === 1) {
            let exp = this.symbolList.slice(-1)[0];
            // 如果是ID检查其是否进行过定义
            if (right[0] === '<ID>') {
                let existed = false;
                for (let scope_layer = this.currentTableStack.length - 1; scope_layer >= 0; scope_layer--){
                    let current_table = this.tables[this.currentTableStack[scope_layer]];
                    if (current_table.findSymbol(exp.value) !== -1) {
                        existed = true;
                        break;
                    }
                }
                if (!existed) {
                    console.log('变量 %s 未定义 【row = %d】', exp.value, exp.row);
                    process.exit(-1);
                }
            }
            // 更新symbol_list
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, exp.value, exp.row, -1, exp.tableIdx, exp.index));
        }
        else {
            let exp = this.symbolList[this.symbolList.length - 2];
            // 更新symbol_list
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, exp.value, exp.row, -1, exp.tableIdx, exp.index));
        }
    }
    // CallStmt ::= <ID> ( CallFunCheck Args )
    Analysis_CallStmt(left, right) {
        let identifier = this.symbolList[this.symbolList.length - 5];
        let check = this.symbolList[this.symbolList.length - 3];
        let args = this.symbolList[this.symbolList.length - 2];

        // 函数是否定义已在CallFunCheck时检查

        // 检查参数个数
        let para_num = this.tables[check.tableIdx].table[check.index].parameterNum;
        if (para_num > parseInt(args.value)) {
            console.log('函数 %s 参数过少 【row = %d】', identifier.value, identifier.row);
            process.exit(-1);
        }
        else if (para_num < parseInt(args.value)) {
            console.log('函数 %s 参数过多 【row = %d】', identifier.value, identifier.row);
            process.exit(-1);
        }

        // 生成函数调用的四元式
        let new_tmp_var = 'T' + String(this.tempVarCount++);
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'call', identifier.value, '-', new_tmp_var));

        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, new_tmp_var, -1, -1, -1, -1));
    }
    // CallFunCheck ::= @
    Analysis_CallFunCheck(left, right) {
        let fun_id = this.symbolList[this.symbolList.length - 2];
        let fun_id_pos = this.tables[0].findSymbol(fun_id.value);

        if (fun_id_pos === -1) {
            console.log('函数 %s 未定义 【row = %d】', fun_id.value, fun_id.row);
            process.exit(-1);
        }
        if (this.tables[0].table[fun_id_pos].idType !== IdentifierType.Function) {
            console.log('函数 %s 未定义 【row = %d】', fun_id.value, fun_id.row);
            process.exit(-1);
        }

        this.symbolList.push(new SemanticSymbol(left, fun_id.value, fun_id.row, -1, 0, fun_id_pos));
    }
    // Args ::= Exp , Args | Exp | @
    Analysis_Args(left, right) {
        if (right.length === 3) {
            let exp = this.symbolList[this.symbolList.length - 3];
            this.quadruples.push(new Quadruple(this.nextLabelNum++, 'param', exp.value, '-', '-'));
            let aru_num = parseInt(this.symbolList.slice(-1)[0].value) + 1;

            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, String(aru_num), -1, -1, -1, -1));
        }
        else if (right[0] === 'Exp') {
            let exp = this.symbolList.slice(-1)[0];
            this.quadruples.push(new Quadruple(this.nextLabelNum++, 'param', exp.value, '-', '-'));

            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, '1', -1, -1, -1, -1));
        }
        else if (right[0] === '@') {
            this.symbolList.push(new SemanticSymbol(left, '0', -1, -1, -1, -1));
        }
    }
    // ReturnStmt ::= return Exp | return
    Analysis_ReturnStmt(left, right) {
        if (right.length === 2) {
            // 返回值
            let return_exp = this.symbolList.slice(-1)[0];

            // 函数表
            let function_table = this.tables[this.currentTableStack.slice(-1)[0]];

            // 添加四元式
            this.quadruples.push(new Quadruple(this.nextLabelNum++, '=', return_exp.value, '-', function_table.table[0].idName));
            this.quadruples.push(new Quadruple(this.nextLabelNum++, 'return', function_table.table[0].idName, '-', function_table.tableName));

            // 更新symbolList
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, return_exp.value, -1, -1, -1, -1));
        }
        else {
            // 函数表
            let function_table = this.tables[this.currentTableStack.slice(-1)[0]];

            // 检查void
            if (this.tables[0].table[this.tables[0].findSymbol(function_table.tableName)].spType !== 'void') {
                console.log('函数 %s 必须有返回值 【row = %d】', function_table.tableName, this.symbolList.slice(-1)[0].row);
                process.exit(-1);
            }

            // 添加四元式
            this.quadruples.push(new Quadruple(this.nextLabelNum++, 'return', '-', '-', function_table.tableName));

            // 更新symbolList
            let count = right.length;
            while (count--) {
                this.symbolList.pop();
            }
            this.symbolList.push(new SemanticSymbol(left, '', -1, -1, -1, -1));
        }
    }
    // Relop ::= > | < | >= | <= | == | !=
    Analysis_Relop(left, right) {
        let op = this.symbolList.slice(-1)[0];
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, op.value, -1, -1, -1, -1));
    }
    // IfStmt ::= if IfStmt_m1 ( Exp ) IfStmt_m2 Block IfNext
    Analysis_IfStmt(left, right) {
        let ifstmt_m2 = this.symbolList[this.symbolList.length - 3];
        let ifnext = this.symbolList[this.symbolList.length - 1];

        if (ifnext.value.length === 0) {
            // 只有if 没有else
            // 真出口

            this.quadruples[this.backpatchingList.slice[-1]].result = ifstmt_m2.value;
            this.backpatchingList.pop();
            // 假出口
            this.quadruples[this.backpatchingList.slice(-1)[0]].result = String(this.nextLabelNum);
            this.backpatchingList.pop();
        }
        else {
            // if块出口
            this.quadruples[this.backpatchingList.slice(-1)[0]].result = String(this.nextLabelNum);
            this.backpatchingList.pop();

            // if真出口
            this.quadruples[this.backpatchingList.slice(-1)[0]].result = ifstmt_m2.value;
            this.backpatchingList.pop();

            // if假出口
            this.quadruples[this.backpatchingList.slice(-1)[0]].result = ifnext.value;
            this.backpatchingList.pop();
        }
        this.backpatchingLevel--;

        // symbolList更新
        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, '', -1, -1, -1, -1));
    }
    // IfStmt_m1 ::= @
    Analysis_IfStmt_m1(left, right) {
        this.backpatchingLevel++;
        this.symbolList.push(new SemanticSymbol(left, String(this.nextLabelNum), -1, -1, -1, -1));
    }
    // IfStmt_m2 ::= @
    Analysis_IfStmt_m2(left, right) {
        let if_exp = this.symbolList[this.symbolList.length - 2];

        // 待回填四元式（假出口）
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'j=', if_exp.value, '0', ''));
        this.backpatchingList.push(this.quadruples.length - 1);

        // 待回填四元式（真出口）
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'j=', '-', '-', ''));
        this.backpatchingList.push(this.quadruples.length - 1);

        this.symbolList.push(new SemanticSymbol(left, String(this.nextLabelNum), -1, -1, -1, -1));
    }
    // IfNext ::= IfStmt_next else Block
    Analysis_IfNext(left, right) {
        let if_stmt_next = this.symbolList[this.symbolList.length - 3];

        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, if_stmt_next.value, -1, -1, -1, -1));
    }
    // IfStmt_next ::= @
    Analysis_IfStmt_next(left, right) {
        // if的跳出语句(else之前)(待回填)
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'j', '-', '-', ''));
        this.backpatchingList.push(this.quadruples.length - 1);
        this.symbolList.push(new SemanticSymbol(left, String(this.nextLabelNum), -1, -1, -1, -1));
    }
    // WhileStmt ::= while WhileStmt_m1 ( Exp ) WhileStmt_m2 Block
    Analysis_WhileStmt(left, right) {
        let whilestmt_m1 = this.symbolList[this.symbolList.length - 6];
        let WhileStmt_m2 = this.symbolList[this.symbolList.length - 2];

        // 无条件跳转到 while 的条件判断语句处
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'j', '-', '-', whilestmt_m1.value));

        // 回填真出口
        this.quadruples[this.backpatchingList.slice(-1)[0]].result = WhileStmt_m2.value;
        this.backpatchingList.pop();

        // 回填假出口
        this.quadruples[this.backpatchingList.slice(-1)[0]].result = String(this.nextLabelNum);
        this.backpatchingList.pop();

        this.backpatchingLevel--;

        let count = right.length;
        while (count--) {
            this.symbolList.pop();
        }
        this.symbolList.push(new SemanticSymbol(left, '', -1, -1, -1, -1));
    }
    // WhileStmt_m1 ::= @
    Analysis_WhileStmt_m1(left, right) {
        this.backpatchingLevel++;
        this.symbolList.push(new SemanticSymbol(left, String(this.nextLabelNum), -1, -1, -1, -1));
    }
    // WhileStmt_m2 ::= @
    Analysis_WhileStmt_m2(left, right) {
        let while_exp = this.symbolList[this.symbolList.length - 2];
        
        // 假出口
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'j=', while_exp.value, '0', ''));
        this.backpatchingList.push(this.quadruples.length - 1);

        // 真出口
        this.quadruples.push(new Quadruple(this.nextLabelNum++, 'j', '-', '-', ''));
        this.backpatchingList.push(this.quadruples.length - 1);

        this.symbolList.push(new SemanticSymbol(left, String(this.nextLabelNum), -1, -1, -1, -1));
    }
}

export { Semantic, SemanticSymbol };
export { Quadruple };