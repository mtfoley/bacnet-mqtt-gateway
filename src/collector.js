const fs = require('fs');
const config = require('config');
const EventEmitter = require('events');
const {logger} = require('./common');

class Collector extends EventEmitter {
    constructor(){
        super();
        this.options = config.get('collector');
        this.index = {};
        fs.stat(this.options.dataFolder,(error,stats)=>{
            if(error){
                fs.mkdir(this.options.dataFolder,{},(error)=>{
                    if(error) logger.error('Could Not Create Collector Data Folder: '+error);
                });
            }
        });
    }
    getIndex(){
        return this.index;
    }
    rebuildIndex(){
        return new Promise((resolve,reject)=>{
            fs.readFile(this.options.dataFolder+"/index.json", 'utf8', (error, contents) => {
                if (error) {
                    logger.info(`Collector Index File Not Found`);
                    this.index = {};
                    this.emit('indexed', this.index);
                    resolve(this.index);
                } else {
                    try{
                        this.index = JSON.parse(contents);
                        this.emit('indexed', this.index);
                        resolve(this.index);
                    } catch(error) {
                        this.emit('error',error);
                        reject(error);
                    } finally {
                        resolve(this.index);
                    }
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
            fs.writeFile(this.options.dataFolder+"/index.json",JSON.stringify(this.index),'utf8',(error)=>{
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
        this.removeAllListeners();
    }
    enqueue(id,data){
        return new Promise((resolve,reject)=>{
            if(id && data && data.length > 0){

                const lines = data.map(JSON.stringify).join("\n")+"\n";
                const file = this.options.dataFolder+"/"+id+'.dat';
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
    cleanup(id,start){
        return new Promise((resolve,reject)=>{
            if(id && typeof start == 'number'){
                this.query(id,start).then((data)=>{
                    const lines = data.map(JSON.stringify).join("\n")+"\n";
                    const file = this.options.dataFolder+"/"+id+'.dat';
                    fs.writeFile(file,lines,'utf8',(error)=>{
                        if(error){
                            logger.error(error);
                            reject(error);
                        } else {
                            resolve(id);
                        }
                    });
                }).catch(()=>{
                    resolve(id);
                })
            } else {
                const error = 'ID and Timestamp Required to Clean Up Data File';
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
            return item && item.ts > start && (noEnd || item.ts <= end);
        });
    }
    query(id,start,end){
        return new Promise((resolve,reject)=>{
            if(!start) start = 0;
            if(id){
                const file = this.options.dataFolder+"/"+id+'.dat';
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
}
module.exports = {Collector};