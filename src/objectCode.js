import fs from 'fs'
import * as utils from './utils.js';
import { Quadruple } from './semanticAnalyser.js';
import { exit } from 'process';

const REGNUM = 32;
const DATA_SEG_ADDR = 0x10010000;
const STACK_SEG_ADDR = 0x10040000;
const PARAM_OFFSET_INIT = 8;
const LOCALVAR_OFFSET_INIT = -4;
const REG_MAX_UNUSE_TIME = Number.MAX_SAFE_INTEGER;
const STR_SIZE = 28;
const VAR_REG_START = 8;
const VAR_REG_END = 15;
const Npos = -1;

let outputStream = '';

const Registers = [
    "$zero",  // 常量0
    "$at",    // 保留给汇编器
    "$v0", "$v1",  // 函数调用返回值
    "$a0", "$a1", "$a2", "$a3",  // 函数调用参数
    "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
    "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
    "$t8", "$t9",
    "$k0", "$k1",  // 操作系统／异常处理保留，至少要预留一个
    "$gp",    // 全局指针
    "$sp",    // 堆栈指针
    "$fp",    // 帧指针
    "$ra",    // 返回地址
]

/**
 * @brief 寄存器
 * @param regName 寄存器名称 String
 * @param regIdx 寄存器编号 Number
 * @param unuseTime 未使用时间 Number
 */
class Reg {
    constructor(name_, idx_, unusetime_) {
        this.regName = name_;
        this.regIdx = idx_;
        this.unuseTime = unusetime_;
    }
}

/**
 * @brief 目标代码生成
 * @param Rvalue 寄存器中的当前变量 Array[REGNUM]
 * @param Avalue 变量所在的寄存器数组 Map(String => Set(String))
 * @param regInfo 所有寄存器的使用信息 Array(Reg)
 * @param quaternary 四元式 Array(Quadruple)
 * @param localVarOffsetTable 局部变量相对于ebp的偏移（ebp+offset） Map(String => Number)
 * @param globalVarAddrTable 全局变量地址 Map(String => Number)
 * @param procedureName 过程块的名称 String
 * @param labelNeedOutput 需要进行输出的label Set(String)
 * @param paramOffset 实参区大小 Number
 * @param loclVarOffset 局部变量区大小 Number
 * @param globalVarAddr 全局变量区大小 Number
 */

class ASM {
    constructor() {
        this.Rvalue = new Array(REGNUM);
        this.Avalue = new Map();
        this.regInfo = [];
        this.quaternary = [];
        this.localVarOffsetTable = new Map();
        this.globalVarAddrTable = new Map();
        this.procedureName = '';
        this.labelNeedOutput = new Set();
        this.paramOffset = PARAM_OFFSET_INIT;
        this.loclVarOffset = LOCALVAR_OFFSET_INIT;
        this.globalVarAddr = DATA_SEG_ADDR;
    }
/**
 * @brief 四元式定义
 * @param label 四元式的标号 Number(int)
 * @param operate 操作类型 string
 * @param arg1 参数1 string
 * @param arg2 参数2 string
 * @param result 结果 string
 */
    // 初始化
    init(quadruples) {
        this.quaternary = quadruples;
        // console.log('初始四元式', this.quaternary);

        for (let qua of this.quaternary) {
            if (qua.operate === 'j' || qua.operate === 'j=' || qua.operate === 'j<' || qua.operate === 'j>' || qua.operate === 'j<=' || qua.operate === 'j>=') {
                //FIXME: 这里一定是要保证set是有序的
                this.labelNeedOutput.add(qua.result);
                this.labelNeedOutput = new Set(Array.from(this.labelNeedOutput).sort());
            }
        }
        // console.log('label: ', this.labelNeedOutput);
        for (let i = 0; i < REGNUM; i++){
            this.regInfo.push(new Reg(Registers[i], i, 0));
        }
        // console.log('init_regInfo.length: ', this.regInfo.length);
        // console.log('init_regInfo: ', this.regInfo);

        this.Rvalue[0] = '0';
        for (let i = 1; i < REGNUM; i++){
            this.Rvalue[i] = 'null';
        }
        // console.log('Rvalue: ', this.Rvalue);
    }

    // 生成并输出目标代码
    genarate(path) {
        outputStream += ('addi $sp,$sp,' + String(STACK_SEG_ADDR));
        outputStream += '\n';
        outputStream += ('addi $fp,$fp,' + String(STACK_SEG_ADDR - 4));
        outputStream += '\n';

        let i = 0;
        for (let preQuaternary of this.quaternary) {
            for (let reginfo of this.regInfo) {
                if (reginfo.unuseTime < REG_MAX_UNUSE_TIME) {
                    reginfo.unuseTime++;
                }
            }

            // console.log(this.regInfo);
            // console.log('curno: ', i, ' ', preQuaternary);
            this.parseInStep(preQuaternary);
            // i++;
            // i=15
        }

        try {
            const data = fs.writeFileSync(path, outputStream);
            console.log('\n目标代码已导出至: ' + path);
        }
        catch (error) {
            console.log('\n目标代码导出失败！');
            console.error(error);
            process.exit(-1);
        }
    }

    parseInStep(preQuaternary) {
        // 需要输出标签的，则输出标签
        if (this.labelNeedOutput.has(String(preQuaternary.label))) {
            outputStream += ('Label_' + String(preQuaternary.label) + ' :');
            outputStream += '\n';
        }

        // 函数调用，需要创建栈帧并跳转(参数已完成压栈的情况)
        if (preQuaternary.operate === 'call') {
            for (let it of this.localVarOffsetTable) {
                //TODO: 这里我不确定是不是正确
                if (this.Avalue.get(it[0]).size === 0) {
                    continue;
                }
                let unuse_time = REG_MAX_UNUSE_TIME;
                let write_reg;
                for (let r of this.Avalue.get(it[0])) {
                    if (this.regInfo[this.getRegIdxByName(r)].unuseTime < unuse_time) {
                        unuse_time = this.regInfo[this.getRegIdxByName(r).unuseTime];
                        write_reg = r;
                    }
                }
                outputStream += ('sw ' + write_reg + ',' + it[1] + '($fp)');
                outputStream += '\n';
            }

            // 跳转
            outputStream += ('jal ' + preQuaternary.arg1);
            outputStream += '\n';

            //记录存储返回值的变量
            //返回值的变量可能已经在内存中，也可能是第一次出现，对其进行寄存器的分配
            let regIdx = this.getReg(preQuaternary.result, -1);

            // 存储返回变量前先恢复寄存器
            for (let it of this.localVarOffsetTable) {
                //TODO: 这里我不确定是不是正确
                if (this.Avalue.get(it[0]).size === 0) {
                    continue;
                }
                for (let r of this.Avalue.get(it[0])) {
                    outputStream += ('lw ' + r + ',' + it[1] + '($fp)');
                    outputStream += '\n';
                }
            }

            outputStream += ('move ' + Registers[regIdx] + ',$v1');
            outputStream += '\n';

            this.markRegInRegInfo(regIdx);
        }
        // 返回，需要撤销栈帧并跳转
        else if (preQuaternary.operate === 'return') {
            // 将返回值放在v1寄存器中
            if (preQuaternary.arg1 !== '-') {
                outputStream += ('move $v1,' + this.Avalue.get(preQuaternary.arg1).values().next().value);
                outputStream += '\n';
            }
            // 释放局部变量占用的寄存器,修改AVALUE与RVALUE 
            for (let it of this.localVarOffsetTable) {
                if (this.Avalue.has(it[0])) {
                    for (let reg of this.Avalue.get(it[0])) {
                        for (let i = 0; i < REGNUM; i++){
                            if (reg === Registers[i]) {
                                this.Rvalue[i] = 'null';
                            }
                        }
                    }
                    this.Avalue.delete(it[0]);
                }
            }
            // 修改esp($sp)，返回地址($fp)放到esp($sp)
            outputStream += ('move $sp,$fp');
            outputStream += '\n';

            outputStream += ('addi $sp,$sp,' + String(this.paramOffset));
            outputStream += '\n';

            // 返回地址赋给$ra
            outputStream += ('lw $ra,4($fp)');
            outputStream += '\n';

            // 修改ebp（$fp）
            outputStream += ('lw $fp,0($fp)');
            outputStream += '\n';

            if (this.procedureName !== 'main') {
                outputStream += ('jr $ra');
                outputStream += '\n';
            }

            this.paramOffset = PARAM_OFFSET_INIT;
            this.loclVarOffset = LOCALVAR_OFFSET_INIT;
            this.localVarOffsetTable.clear();
            this.procedureName = '';
        }
        // j
        else if (preQuaternary.operate === 'j') {
            outputStream += 'j ';
            // 跳转到标签
            if (!utils.isDigit(preQuaternary.result[0])) {
                for (let it of this.quaternary) {
                    if (preQuaternary.result === String(it.label)) {
                        outputStream += it.operate;
                        outputStream += '\n';
                    }
                }
            }
            // 跳转到函数
            else {
                outputStream += ('Label_' + preQuaternary.result);
                outputStream += '\n';
            }
        }
        // 计算（+/*/-）A:=B op C 或（+/*/-）A:=B op 立即数
        else if (preQuaternary.operate === '+' || preQuaternary.operate === '*' || preQuaternary.operate === '-' || preQuaternary.operate === '/') {
            let regIdxA = this.getReg(preQuaternary.result, -1);
            let regIdxB = -1;
            let regIdxC = -1;

            // 如果B的值不在寄存器中
            if (this.Avalue.get(preQuaternary.arg1).size === 0) {
                // console.log(this.Avalue);
                // exit(-1);
                // 局部变量
                if (this.localVarOffsetTable.has(preQuaternary.arg1)) {
                    let offset = this.localVarOffsetTable.get(preQuaternary.arg1);
                    outputStream += ('lw ' + Registers[regIdxA] + ',' + String(offset) + '($fp)');
                    outputStream += '\n';
                    // console.log(outputStream);
                    // exit(-1);
                }
                // 全局变量
                else if (this.globalVarAddrTable.has(preQuaternary.arg1)) {
                    let addr = this.globalVarAddrTable.get(preQuaternary.arg1);
                    outputStream += ('lw ' + Registers[regIdxA] + ',' + String(addr) + '($zero)');
                    outputStream += '\n';
                }
                regIdxB = regIdxA;
            }
            else {
                regIdxB = this.getRegIdxByName(this.Avalue.get(preQuaternary.arg1).values().next().value);
            }
            this.markRegInRegInfo(regIdxB);

            // C是立即数
            if (utils.isDigit(preQuaternary.arg2[0])) {
                if (preQuaternary.operate === '+') {
                    outputStream += ('addi ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',' + preQuaternary.arg2);
                    outputStream += '\n';
                }
                else if (preQuaternary.operate === '*') {
                    outputStream += ('addi $t8,$zero,' + preQuaternary.arg2);
                    outputStream += '\n';
                    outputStream += ('mul ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',$t8');
                    outputStream += '\n';
                }
                else if (preQuaternary.operate === '-') {
                    outputStream += ('subi ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',' + preQuaternary.arg2);
                    outputStream += '\n';
                }
                else if (preQuaternary.operate === '/') {
                    outputStream += ('addi $t8,$zero,' + preQuaternary.arg2);
                    outputStream += '\n';
                    outputStream += ('div ' + Registers[regIdxB] + ',$t8');
                    outputStream += '\n';
                    outputStream += ('mov ' + Registers[regIdxA] + ',$lo');
                    outputStream += '\n';
                }
            }

            // C不是立即数
            else {
                // C的值不在寄存器中
                if (this.Avalue.get(preQuaternary.arg2).size === 0) {
                    regIdxC = this.getReg(preQuaternary.arg2, regIdxA);
                }
                // C的值在寄存器中
                else {
                    regIdxC = this.getRegIdxByName(this.Avalue.get(preQuaternary.arg2).values().next().value);
                }
                this.markRegInRegInfo(regIdxC);

                if (preQuaternary.operate === '+') {
                    outputStream += ('add ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',' + Registers[regIdxC]);
                    outputStream += '\n';
                }
                else if (preQuaternary.operate === '*') {
                    outputStream += ('mul ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',' + Registers[regIdxC]);
                    outputStream += '\n';
                }
                else if (preQuaternary.operate === '-') {
                    outputStream += ('sub ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',' + Registers[regIdxC]);
                    outputStream += '\n';
                }
                else if (preQuaternary.operate === '/') {
                    outputStream += ('div ' + Registers[regIdxB] + ',' + Registers[regIdxC]);
                    outputStream += '\n';
                    outputStream += ('mov ' + Registers[regIdxA] + ',$lo');
                    outputStream += '\n';
                }
            }
        }
        // =
        else if (preQuaternary.operate === '=') {
            // console.log(preQuaternary);
            // exit(-1);
            let regIdx = this.getReg(preQuaternary.result, -1);
            // console.log(regIdx);
            // exit(-1);
            if (utils.isDigit(preQuaternary.arg1[0])) {
                outputStream += ('addi ' + Registers[regIdx] + ',$zero,' + preQuaternary.arg1);
                outputStream += '\n';
                this.markRegInRegInfo(regIdx);
            }
            else {
                // 右值B不在寄存器中
                if (this.Avalue.get(preQuaternary.arg1).size === 0) {
                    // 右值为局部变量
                    if (this.localVarOffsetTable.has(preQuaternary.arg1)) {
                        let offset = this.localVarOffsetTable.get(preQuaternary.arg1);
                        outputStream += ('lw ' + Registers[regIdx] + ',' + String(offset) + '($fp)');
                        outputStream += '\n';
                    }
                    // 右值为全局变量
                    else if (this.globalVarAddrTable.has(preQuaternary.arg1)) {
                        let addr = this.globalVarAddrTable.get(preQuaternary.arg1);
                        outputStream += ('lw' + Registers[regIdx] + ',' + String(addr) + '($zero)');
                        outputStream += '\n';
                    }
                    
                    this.markRegInRegInfo(regIdx);
                }

                // 右值B在寄存器中(A=B)
                else {
                    let regIdxB = this.getRegIdxByName(this.Avalue.get(preQuaternary.arg1).values().next().value);
                    outputStream += ('move ' + Registers[regIdx] + ',' + Registers[regIdxB]);
                    outputStream += '\n';
                    this.markRegInRegInfo(regIdx);
                    this.markRegInRegInfo(regIdxB);
                }
            }
        }
        // 实参声明
        else if (preQuaternary.operate === 'param') {
            let regIdx;
            if (this.Avalue.get(preQuaternary.arg1).size === 0) {
                // 局部变量
                if (this.localVarOffsetTable.has(preQuaternary.arg1)) {
                    let offset = this.localVarOffsetTable.get(preQuaternary.arg1);
                    regIdx = this.getReg(preQuaternary.arg1, -1);
                    outputStream += ('lw ' + Registers[regIdx] + ',' + String(offset) + '($fp)');
                    outputStream += '\n';

                    outputStream += ('subi $sp,$sp,4');
                    outputStream += '\n';

                    outputStream += ('sw ' + Registers[regIdx] + ',0($sp)');
                    outputStream += '\n';
                }
                // 全局变量
                else if (this.globalVarAddrTable.has(preQuaternary.arg1)) {
                    let addr = this.globalVarAddrTable.get(preQuaternary.arg1);
                    regIdx = this.getReg(preQuaternary.arg1, -1);

                    outputStream += ('lw ' + Registers[regIdx] + ',' + String(addr) + '($zero)');
                    outputStream += '\n';

                    outputStream += 'subi $sp,$sp,4';
                    outputStream += '\n';

                    outputStream += ('sw ' + Registers[regIdx] + ',0($sp)');
                    outputStream += '\n';
                }
            }
            else {
                regIdx = this.getRegIdxByName(this.Avalue.get(preQuaternary.arg1).values().next().value);
                outputStream += 'subi $sp,$sp,4';
                outputStream += '\n';
                outputStream += ('sw ' + Registers[regIdx] + ',0($sp)');
                outputStream += '\n';
            }
            this.markRegInRegInfo(regIdx);
        }
        // 形参声明
        else if (preQuaternary.operate === 'defpar') {
            this.localVarOffsetTable.set(preQuaternary.result, this.paramOffset);
            this.localVarOffsetTable = new Map(Array.from(this.localVarOffsetTable).sort());
            this.paramOffset += 4;
            this.Avalue.set(preQuaternary.result, new Set());
            this.Avalue = new Map(Array.from(this.Avalue).sort());
        }
        // 过程定义
        else if (preQuaternary.arg1 === '-' && preQuaternary.arg2 === '-' && preQuaternary.result === '-') {
            // console.log(preQuaternary);
            // process.exit(-1);
            // 进入一个过程块，重置局部偏移表和形参偏移表
            this.procedureName = preQuaternary.operate;
            this.localVarOffsetTable.clear();
            this.paramOffset = PARAM_OFFSET_INIT;
            this.loclVarOffset = LOCALVAR_OFFSET_INIT;

            // 过程标号
            outputStream += (preQuaternary.operate + ' :');
            outputStream += '\n';

            // 压栈返回地址
            outputStream += 'subi $sp,$sp,4';
            outputStream += '\n';

            // mips中ra会在j时自动存储之前的pc
            outputStream += 'sw $ra,0($sp)';
            outputStream += '\n';

            outputStream += 'subi $sp,$sp,4';
            outputStream += '\n';

            // 压栈旧的$fp
            outputStream += 'sw $fp,0($sp)';
            outputStream += '\n';

            // 赋值新$fp
            outputStream += 'move $fp,$sp';
            outputStream += '\n';

        }
        // j>
        else if (preQuaternary.operate === 'j>') {
            let regIdxA = -1;
            let regIdxB = -1;
            if (utils.isDigit(preQuaternary.arg1[0])) {
                outputStream += ('subi $t8,$zero,' + preQuaternary.arg1);
                outputStream += '\n';
                regIdxA = this.getRegIdxByName('$t8');
            }

            else {
                regIdxA = this.getReg(preQuaternary.arg1, -1);
            }

            if (utils.isDigit(preQuaternary.arg2[0])) {
                outputStream += ('subi $t9,$zero,' + preQuaternary.arg2);
                outputStream += '\n';
                regIdxB = this.getRegIdxByName('$t9');
            }

            else {
                regIdxB = this.getReg(preQuaternary.arg2, -1);
            }

            outputStream += ('bgt ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',Label_' + preQuaternary.result);
            outputStream += '\n';
        }
        // j<
        else if (preQuaternary.operate === 'j<') {
            let regIdxA = -1;
            let regIdxB = -1;
            if (utils.isDigit(preQuaternary.arg1[0])) {
                outputStream += ('subi $t8,$zero,' + preQuaternary.arg1);
                outputStream += '\n';
                regIdxA = this.getRegIdxByName('$t8');
            }

            else {
                regIdxA = this.getReg(preQuaternary.arg1, -1);
            }

            if (utils.isDigit(preQuaternary.arg2[0])) {
                outputStream += ('subi $t9,$zero,' + preQuaternary.arg2);
                outputStream += '\n';
                regIdxB = this.getRegIdxByName('$t9');
            }

            else {
                regIdxB = this.getReg(preQuaternary.arg2, -1);
            }

            outputStream += ('blt ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',Label_' + preQuaternary.result);
            outputStream += '\n';

        }
        // j>=
        else if (preQuaternary.operate === 'j>=') {
            let regIdxA = -1;
            let regIdxB = -1;
            // A是立即数
            if (utils.isDigit(preQuaternary.arg1[0])) {
                outputStream += ('addi $t8,$zero,' + preQuaternary.arg1);
                outputStream += '\n';
                regIdxA = this.getRegIdxByName('$t8');
            }

            else {
                regIdxA = this.getReg(preQuaternary.arg1, -1);
            }
            // B是立即数
            if (utils.isDigit(preQuaternary.arg2[0])) {
                outputStream += ('addi $t9,$zero,' + preQuaternary.arg2);
                outputStream += '\n';
                regIdxB = this.getRegIdxByName('$t9');
            }

            else {
                regIdxB = this.getReg(preQuaternary.arg2, -1);
            }

            outputStream += ('bge ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',Label_' + preQuaternary.result);
            outputStream += '\n';
        }
        // j<=
        else if (preQuaternary.operate === 'j<=') {
            let regIdxA = -1;
            let regIdxB = -1;
            // A是立即数
            if (utils.isDigit(preQuaternary.arg1[0])) {
                outputStream += ('addi $t8,$zero,' + preQuaternary.arg1);
                outputStream += '\n';
                regIdxA = this.getRegIdxByName('$t8');
            }

            else {
                regIdxA = this.getReg(preQuaternary.arg1, -1);
            }
            // B是立即数
            if (utils.isDigit(preQuaternary.arg2[0])) {
                outputStream += ('addi $t9,$zero,' + preQuaternary.arg2);
                outputStream += '\n';
                regIdxB = this.getRegIdxByName('$t9');
            }

            else {
                regIdxB = this.getReg(preQuaternary.arg2, -1);
            }

            outputStream += ('ble ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',Label_' + preQuaternary.result);
            outputStream += '\n';
        }
        // j=
        else if (preQuaternary.operate === 'j=') {
            let regIdxA = -1;
            let regIdxB = -1;
            // A是立即数
            if (utils.isDigit(preQuaternary.arg1[0])) {
                outputStream += ('subi $t8,$zero,' + preQuaternary.arg1);
                outputStream += '\n';
                regIdxA = this.getRegIdxByName('$t8');
            }

            else {
                regIdxA = this.getReg(preQuaternary.arg1, -1);
            }
            // B是立即数
            if (utils.isDigit(preQuaternary.arg2[0])) {
                outputStream += ('subi $t9,$zero,' + preQuaternary.arg2);
                outputStream += '\n';
                regIdxB = this.getRegIdxByName('$t9');
            }

            else {
                regIdxB = this.getReg(preQuaternary.arg2, -1);
            }

            outputStream += ('beq ' + Registers[regIdxA] + ',' + Registers[regIdxB] + ',Label_' + preQuaternary.result);
            outputStream += '\n';
        }
    }

    // 分配一个寄存器
    // variable: String exceptIdx: Number
    // return: Number
    getReg(variable, exceptIdx) {
        // 分配的寄存器编号和名称
        let regIdx = -1;

        // 如果全局和局部变量表都没有这一变量，则var是未分配好空间的变量
        if (!this.localVarOffsetTable.has(variable) && !this.globalVarAddrTable.has(variable)) {
            // 全局变量，则在全局变量地址表中分配地址
            if (this.procedureName === '') {
                this.globalVarAddrTable.set(variable, this.globalVarAddr);
                this.globalVarAddrTable = new Map(Array.from(this.globalVarAddrTable).sort());
                this.globalVarAddr += 4;
            }
            // 局部变量，在局部变量偏移表中分配
            else {
                this.localVarOffsetTable.set(variable, this.loclVarOffset);
                this.localVarOffsetTable = new Map(Array.from(this.localVarOffsetTable).sort());
                // console.log(this.localVarOffsetTable);
                this.loclVarOffset -= 4;
                outputStream += 'subi $sp,$sp,4';
                outputStream += '\n';
                // console.log(outputStream);
                // exit(-1);
            }
            this.Avalue.set(variable, new Set());
            this.Avalue = new Map(Array.from(this.Avalue).sort());
            // console.log(this.Avalue);
            // exit(-1);
        }
        // 如果不在寄存器中，则分配寄存器
        if (this.Avalue.get(variable).size === 0) {
            // console.log(this.Avalue);
            // exit(-1);
            //寄存器的分配算法（寄存器只能使用$t）空余优先，没有空余的则LRU
            for (let i = VAR_REG_START; i <= VAR_REG_END; i++){
                if (this.Rvalue[i] === 'null') {
                    regIdx = i;
                    //FIXME: 这里一定是要保证set是有序的
                    this.Avalue.get(variable).add(Registers[regIdx]);
                    let tmp = this.Avalue.get(variable);
                    this.Avalue.set(variable, new Set(Array.from(tmp).sort()));
                    this.Avalue = new Map(Array.from(this.Avalue).sort());
                    // console.log('Avalue: ', this.Avalue);
                    this.Rvalue[regIdx] = variable;
                    break;
                }
            }

            // 没有找到空闲的reg，准备抢占一个reg
            if (regIdx === -1) {
                let targetRegIdx = this.getLRURegIdx(exceptIdx);
                let targetRegName = this.Rvalue[targetRegIdx];
                // console.log(targetRegName);
                // console.log(this.Avalue);
                // console.log(outputStream);
                if (this.Avalue.get(targetRegName).size < 2) {
                    if (this.localVarOffsetTable.has(targetRegName)) {
                        let offset = this.localVarOffsetTable.get(targetRegName);
                        outputStream += ('sw ' + Registers[targetRegIdx] + ',' + String(offset) + '($fp)');
                        outputStream += '\n';
                    }
                    else if (this.globalVarAddrTable.has(targetRegName)) {
                        let addr = this.globalVarAddrTable.get(targetRegName);
                        outputStream += ('sw ' + Registers[targetRegIdx] + ',' + String(addr) + '($zero)');
                        outputStream += '\n';
                    }
                }
                // 更新AVALUE和RVALUE
                this.Avalue.get(targetRegName).delete(Registers[targetRegIdx]);
                regIdx = targetRegIdx;
                this.Rvalue[regIdx] = variable;
                //FIXME: 这里一定是要保证set是有序的
                this.Avalue.get(variable).add(Registers[targetRegIdx]);
                let tmp = this.Avalue.get(variable);
                this.Avalue.set(variable, new Set(Array.from(tmp).sort()));
                this.Avalue = new Map(Array.from(this.Avalue).sort());
                this.Rvalue[regIdx] = variable;
            }

            // 局部变量
            if (this.localVarOffsetTable.has(variable)) {
                let offset = this.localVarOffsetTable.get(variable);
                // console.log(offset);
                // exit(-1);
                outputStream += ('lw ' + Registers[regIdx] + ',' + String(offset) + '($fp)');
                outputStream += '\n';
                // console.log(outputStream);
            }
            // 全局变量
            else if (this.globalVarAddrTable.has(variable)) {
                let addr = this.globalVarAddrTable.get(variable);
                outputStream += ('lw ' + Registers[regIdx] + ',' + String(addr) + '($zero)');
                outputStream += '\n';
            }
        }
        else {
            let regName = this.Avalue.get(variable).values().next().value;
            for (let i = 0; i < REGNUM; i++){
                if (Registers[i] === regName) {
                    regIdx = i;
                    break;
                }
            }
        }
        // console.log(outputStream);
        // exit(-1);
        this.markRegInRegInfo(regIdx);
        return regIdx;
    }


    // 查找LRU寄存器
    getLRURegIdx(idx) {
        let maxIdx = 0;
        let maxUnuse = 0;
        for (let i = 0; i < this.regInfo.length; i++){
            // 要注意抢占的只能是范围内寄存器，不是idx
            if (this.regInfo[i].unuseTime > maxUnuse &&
                (this.regInfo[i].regIdx >= VAR_REG_START && this.regInfo[i].regIdx <= VAR_REG_END) &&
                (idx === Npos || idx !== this.regInfo[i].regIdx)) {
                maxIdx = i;
                maxUnuse = this.regInfo[i].unuseTime;
            }
        }
        return this.regInfo[maxIdx].regIdx;
    }

    // 更新寄存器信息
    markRegInRegInfo(idx) {
        for (let i = 0; i < this.regInfo.length; i++){
            if (this.regInfo[i].regIdx === idx) {
                this.regInfo[i].unuseTime = 0;
                break;
            }
        }
    }

    // 工具函数：通过寄存器名得到其编号
    // @param regName String
    // @return Number
    getRegIdxByName(regName) {
        for (let i = 0; i < Registers.length; i++){
            if (regName === Registers[i]) {
                return i;
            }
        }
        return Npos;
    }
    
}

export { ASM };