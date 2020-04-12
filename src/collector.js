const fs = require('fs');
const config = require('config');
//const { scheduleJob } = require('node-schedule');
const EventEmitter = require('events');
const {logger} = require('./common');

class Collector extends EventEmitter {
    constructor(){
        super();
        this.options = config.get('trends');
    }
    test(){
        this.rebuildIndex().then(()=>{
            const data ={id:"testPoint-123",type:"float",comm:{driver:"bacnet",deviceId:10000,address:"192.168.1.45",type:2,instance:0}}; 
            const ts = (new Date()).getTime();
            const dataSet = [
                {ts:ts-30000,val:Math.random()},
                {ts:ts-20000,val:Math.random()},
                {ts:ts-10000,val:Math.random()}
            ]
            this.update(data).then(()=>{
                this.enqueue(data.id,dataSet).then(()=>{
                    this.query(data.id,ts-50000).then((data)=>{
                        logger.info('Collector Query Result: '+JSON.stringify(data));
                    })
                });
            })
        })
    }
    getIndex(){
        return this.index;
    }
    rebuildIndex(){
        this.index = {};
        return new Promise((resolve,reject)=>{
            fs.readFile(this.options.indexFile, 'utf8', (error, contents) => {
                if (error) {
                    logger.log('error', `Error while reading index file: ${error}`);
                    this.index = {};
                    return this.update({});
                } else {
                    this.index = JSON.parse(contents);
                    resolve(this.index);
                    this.emit('indexed', this.index);
                }
            });    
        });
    }
    update(data){
        return new Promise((resolve,reject)=>{
            const updates = data.length ? data : [data];
            updates.forEach((d)=>{
                if(d.id) this.index[d.id] = Object.assign(this.index[d.id]||{},d);
            });
            fs.writeFile(this.options.indexFile,JSON.stringify(this.index),'utf8',(error)=>{
                if(error) {
                    logger.error(`Error while writing index file: ${error}`);
                    this.emit('index-update-error',error);
                    reject(error);
                } else {
                    this.emit('index-update',data);
                    resolve();
                }
            });
        });
    }
    destroy(){
        this.emit('destroy');
        this.detachAllListeners();
    }
    // Enqueue a value to a trend file
    enqueue(id,data){
        return new Promise((resolve,reject)=>{
            if(id && data && data.length > 0){

                const lines = data.map(JSON.stringify).join("\n")+"\n";
                const file = this.options.dataFolder+id+'.dat';
                fs.appendFile(file,lines,'utf8',(error)=>{
                    if(error){
                        logger.error(error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            } else {
                const error = 'ID and Non-Empty Data Required to Write Data to File';
                logger.error(error);
                reject(error);
            }
        });
    }
    _queryFileContents(contents,start,end){
        const noEnd = !end || (end == undefined);
        return contents.split('\n').filter((item)=>{
            return item !== '';
        }).map((line)=>{
            try {
                return JSON.parse(line);
            } catch(e){
                return null;
            }
        }).filter((item)=>{
            return item.ts > start && (noEnd || item.ts <= end);
        });
    }
    query(id,start,end){
        return new Promise((resolve,reject)=>{
            if(!start) start = 0;
            if(id){
                const file = this.options.dataFolder+id+'.dat';
                fs.readFile(file,'utf8',(error,contents)=>{
                    if(error){
                        logger.error(error);
                        reject(error);
                    } else {
                        resolve(this._queryFileContents(contents,start,end));
                    }
                });
            } else {
                const error = 'ID Required to Read Data from File';
                logger.error(error);
                reject(error);
            }
        });
    }
    // Dequeue a trend before a timestamp
    dequeue(id,timestamp){
        // trend  = trend.getById(id)
        // items = trend.queryAfter(timestamp)
        // return items
    }
    
}
module.exports = {Collector};