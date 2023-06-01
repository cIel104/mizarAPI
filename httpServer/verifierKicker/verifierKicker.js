//フォルダ作成はhttpServerが実行してくれる
//process.argv[2]にIDをもらう(node verifierKicker.js xxx)
//コマンドの情報からDBへアクセスし、必要な.mizファイルを見つける
//返ってきた情報を整理し、DBへ転送
const carrier = require('carrier');
const { spawn } = require('node:child_process');
const countLines = require('./countLines');
const path = require('path');
const redis = require('redis');
const { resolve } = require('node:path');
const makeErrorList = require('./makeErrorList')

let isVerifierSuccess = true;
let isMakeenvSuccess = true;
let isMakeenvFinish = false;
let makeenvText = '';
let numOfErrors = 0;
const MIZFILES = process.env.MIZFILES;
const ID = process.argv[2]
console.log(path.join(String(MIZFILES), 'verifier'));//デバッグ用
//コマンド作成
const makeenvCmd = path.join(String(MIZFILES), 'makeenv');
const verifierCmd = path.join(String(MIZFILES), 'verifier');

const redisCreateClient = new Promise(async function (resolve) {
    const client = await redis.createClient();
    client.hget(ID, 'filePath', function (error, result) {
        resolve([client, result]);
    })
})
redisCreateClient.then(function (result) {
    const makeenvProcess = spawn(makeenvCmd, [result[1]], { shell: true });
    //makeenv実行
    carrier.carry(makeenvProcess.stdout, line => {
        if (line.indexOf('*') === -1) {
            if (line !== '' && !/^-/.test(line)) {
                if (makeenvText !== '') {
                    makeenvText += "\r\n";
                }
                makeenvText += line;
            }
        }
        else {
            numOfErrors = parseInt(line.match(/\d+/));
            isMakeenvSuccess = false;
        }
    }, null, /\r\n/);

    //verifier実行
    makeenvProcess.on('close', async () => {
        const verifierProcess = spawn(verifierCmd, [result[1]], { shell: true });
        isMakeenvFinish = true;
        //makeenvが失敗していた場合はverifierを行わず終了
        if (isMakeenvSuccess !== true) {
            await makeErrorList(result[0], ID, result[1]);
            await updateDb(result[0], ID, 'false', 'Parser', 0, numOfErrors, makeenvText, isMakeenvFinish, isMakeenvSuccess, 'false');
            process.exit(1);
        }

        console.log('start verifier')
        try {
            await updateDb(result[0], ID, 'false', 'Parser', 0, numOfErrors, makeenvText, isMakeenvFinish, isMakeenvSuccess, isVerifierSuccess);
        } catch (e) {
            console.log(e)
        }
        carrier.carry(verifierProcess.stdout, (async (line) => {
            if (line.indexOf('*') !== -1) {
                isVerifierSuccess = false;
            }
            const cmdOutput = line.match(/^(\w+) +\[ *(\d+) *\**(\d*)\].*$/);
            if (cmdOutput === null) {
                console.log('return')
                return;
            }
            const phase = cmdOutput[1];
            const numOfParsedLines = Number(cmdOutput[2]);
            numOfErrors = Number(cmdOutput[3]);
            const [numOfEnvironmentalLines, numOfArficleLines] = countLines(result[1])
            //進捗計算(表記 : %,　小数点切り捨て)
            const progressPercent = Math.floor((numOfParsedLines - numOfEnvironmentalLines) / numOfArficleLines * 100)
            console.log(line)//デバッグ用
            try {
                await updateDb(result[0], ID, 'false', phase, progressPercent, numOfErrors, makeenvText, isMakeenvFinish, isMakeenvSuccess, isVerifierSuccess);
            } catch (e) {
                console.log(e)
            }
        }), null, /\r/);
        verifierProcess.on('close', async () => {
            console.log('c')
            //isVerifierFinishをtrueにprogressPercentを100にする
            try {
                await makeErrorList(result[0], ID, result[1]);
                await updateDb(result[0], ID, 'true', 'Checker', '100', numOfErrors, makeenvText, isMakeenvFinish, isMakeenvSuccess, isVerifierSuccess)
            } catch (e) {
                console.log(e)
            }
            process.exit(1);
        });
    });
})

//DBを更新(引数が多いので配列などにしたほうがよいかも)
async function updateDb(client, ID, isVerifierFinish, phase, progressPercent, numOfErrors, makeenvText, isMakeenvFinish, isMakeenvSuccess, isVerifierSuccess) {
    console.log(isVerifierFinish, progressPercent)
    try {
        client.hset(String(ID), 'isVerifierFinish', String(isVerifierFinish));
        client.hset(String(ID), 'progressPhase', String(phase));
        client.hset(String(ID), 'progressPercent', String(progressPercent));
        client.hset(String(ID), 'numOfErrors', String(numOfErrors));
        client.hset(String(ID), 'makeenvText', String(makeenvText));
        client.hset(String(ID), 'isMakeenvFinish', String(isMakeenvFinish));
        client.hset(String(ID), 'isMakeenvSuccess', String(isMakeenvSuccess));
        client.hset(String(ID), 'isVerifierSuccess', String(isVerifierSuccess));
    } catch (e) {
        console.log(e)
    }

}
