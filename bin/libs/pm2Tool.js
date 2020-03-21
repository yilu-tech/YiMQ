const util = require('util');
var pm2 = require('pm2');



exports.describe = function(process){
    return new Promise((res,rej)=>{
        pm2.describe(process,(err,result)=>{
            if(err) return rej(err);
            res(result);
        })
    })
};

exports.stop = function(process){
    return new Promise((res,rej)=>{
        pm2.stop(process,(err,result)=>{
            if(err) return rej(err);
            res(result);
        })
    })
};

exports.start = function(options){
    return new Promise((res,rej)=>{
        pm2.start(options,(err,result)=>{
            if(err) return rej(err);
            res(result);
        })
    })
};
exports.restart = function(process){
    return new Promise((res,rej)=>{
        pm2.restart(process,(err,result)=>{
            if(err) return rej(err);
            res(result);
        })
    })
};

exports.delete = function(process){
    return new Promise((res,rej)=>{
        pm2.delete(process,(err,result)=>{
            if(err) return rej(err);
            res(result);
        })
    })
};





