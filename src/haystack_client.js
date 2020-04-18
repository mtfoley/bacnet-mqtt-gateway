const config = require('config');
const dayjs = require('dayjs');
var utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const dns = require('dns');
const axios = require('axios').default;
const haystackAuth = require('@skyfoundry/haystack-auth');
const EventEmitter = require('events');
const { scheduleJob } = require('node-schedule');
const haystackUnits = require('./haystack_bacnet_mapping.json');
const { logger } = require('./common');



class HaystackClient extends EventEmitter {

    constructor(collector) {
        super();
        this.collector = collector;
        this.authToken = null;
        this.options = config.get('haystack');
        this.pingJob = null;
        this.paths = {
            ABOUT: this._makePath('about'),
            READ: this._makePath('read'),
            HIS_WRITE: this._makePath('hisWrite'),
            HIS_READ: this._makePath('hisRead'),
            COMMIT: this._makePath('commit')
        };
    }
    commitTrend(trend){
        return new Promise((resolve,reject)=>{
            const data = Object.assign({},trend);
            const key = 'haystackId';
            if(!trend) reject('no trend definition');
            else if(trend.hasOwnProperty(key)==true) resolve(trend);
            else {
                this.commit(data).then((haystackData)=>{
                    this.collector.update({id:trend.id,haystackId:haystackData.rows[0].id});
                    resolve(haystackData);
                }).catch((error) => {
                    reject(error);
                });
            
            }
        });
    }
    startPush(){
        const self =this;
        logger.info('Haystack Scheduling Push for '+this.options.pushSchedule);
        this.pushJob = scheduleJob(this.options.pushSchedule,()=>{
            const index = self.collector.getIndex();
            const promises = [];
            const updates = [];
            for(var k in index){
                const trend = index[k];
                let updateFn = new Promise((resolve,reject)=>{
                    self.collector.query(trend.id,trend.lastUpload||0).then(data=>{
                        if(data.length == 0) resolve();
                        else self.hisWrite(trend.haystackId,data).then(()=>{
                            const ts = (new Date()).getTime();
                            updates.push({id:trend.id,lastUpload:ts});
                            // resolve whether we cleanup or not?
                            logger.info('Cleaning Up Trend ID '+trend.id);
                            self.collector.cleanup(trend.id,ts).then(()=>{
                                resolve();
                            }).catch(()=>{
                                resolve();
                            })
                        }).catch(error=>{
                            reject(error);
                        });
                    }).catch(error=>{
                        logger.error('Collection Query Error: '+error);
                        reject(error);
                    })
    
                });
                promises.push(updateFn);
            }
            logger.info(`Haystack Pushing ${promises.length} Trends`); 
            Promise.all(promises).then(()=>{
                logger.info(`Haystack Updating ${updates.length} Trends`)
                self.collector.update(updates);
            }).catch(error=>{
                logger.error('Haystack Push Error: '+error)
            });
        });
    }
    _encodeZinc(obj){
        let zinc = [];
        for(var k in obj){
            let value = obj[k];
            if(value == null) zinc.push("N");
            else if(typeof value == 'object') zinc.push("{}");//JSON.stringify(value);
            else if(value == "M") zinc.push(value);
            else if(typeof value == 'string') zinc.push(`\"${value}\"`);
            else if(typeof value == 'number') zinc.push(value);
        }
        return zinc.join(',');
    }
    _decodeJson(value){
        if(typeof value == 'array') return value.map((v)=>{ return this._decodeJson(v) });
        else if(typeof value == 'object'){
            let obj = {};
            for(var k in value){
                obj[k] = this._decodeJson(value[k]);
            }
            return obj;
        } else if(typeof value == 'string'){
            if(value.length < 2) return value;
            else {
                if(value == "m:") return true;
                const prefix = value.substring(0,2);
                const raw = value.substring(2);
                if(prefix == "u:" || prefix == "d:"){
                    return raw;
                } else if(prefix == "t:"){
                    return raw.split(' ')[0];
                } else if(prefix == "n:"){
                    return parseFloat(raw.split(' ')[0]);
                } else if(prefix == "r:"){
                    return "@"+raw.split(' ')[0];
                }
                return value;
            }
        }
        return value;
    }
    _makeTimestamp(value){
        return dayjs(value).local().format()+" New_York";
    }
    _makeHistoryGrid(id,data){
        const grid = [
            "ver: \"3.0\" id:"+id,
            "ts,val"
        ];
        const self = this;
        data.forEach((r)=>{
            grid.push(
                self._makeTimestamp(r.ts)+","+r.val
            );
        });
        return grid.join("\n");
    }
    _makeCommitGrid(data){
        const grid = [
            "ver: \"3.0\" commit:\"add\""
        ];
        let config = {
            point:"M",
            dis:data.name,
            his:"M",
            tz:"New_York",
            kind:"Number"
        };
        if(data.units !== null){
            const key = ""+data.units;
            if(haystackUnits.hasOwnProperty(key) == true) config.unit = haystackUnits[key];
        }
        grid.push(Object.keys(config).join(','));
        grid.push(this._encodeZinc(config));
        return grid.join("\n");
    }
    _makePath(path){
        return this.options.protocol+'://'+this.options.host+':'+this.options.port+'/api/'+this.options.project+'/'+path;
    }
    _postGrid(path,grid){
        return new Promise((resolve,reject)=>{
            axios.post(path,grid).then((response)=>{
                resolve(this._decodeJson(response.data));
            }).catch((error)=>{
                reject(error);
            });    
        });
    }
    isLoggedIn(){
        return this.authToken !== null;
    }
    destroy(){
        logger.info('Haystack Client Destroy');
        if(this.pingJob) this.pingJob.cancel();
        if(this.pushJob) this.pushJob.cancel();
        this.removeAllListeners();
    }
    ping(){
        const self = this;
        axios.get(self.paths.ABOUT).then((response)=>{
            const data = this._decodeJson(response.data);
            logger.info('Haystack Ping');
            self.emit('pingSuccess',data);
        }).catch(()=>{
            self.authToken = null;
            self.connect();
        });
    }
    connect(){
        const self = this;
        return new Promise((resolve,reject)=>{
            dns.lookup(self.options.host,(err)=>{
                if(err){
                    reject('DNS Error: '+err);
                } else {
                    if( !self.isLoggedIn() ){
                        let context = null;
                        try {
                            context = new haystackAuth.AuthClientContext(
                                self.paths.ABOUT,
                                self.options.authentication.username,
                                self.options.authentication.password,
                                (self.options.protocol=='https')
                            );    
                        } catch(error){
                            reject(error);
                        }
                        context.login((header)=>{
                            self.authToken = header['Authorization'];
                            axios.defaults.headers['Authorization'] = self.authToken;
                            axios.defaults.headers.post['Content-Type'] = 'text/zinc; charset=utf-8';
                            axios.defaults.headers['Accept'] = 'application/json';
                            if(!self.pingJob) self.pingJob = scheduleJob(self.options.pingSchedule,()=>{
                                self.ping();
                            });
                            self.emit('connected',header);
                            resolve(header);
                        },(error)=>{
                            reject(error||'Authentication Error');
                        });  
                    }
                }
            });
        });
    }
    commit(data){
        const grid = this._makeCommitGrid(data);
        return this._postGrid(this.paths.COMMIT,grid);
    }
    hisWrite(id,data){
        const grid = this._makeHistoryGrid(id,data);
        return this._postGrid(this.paths.HIS_WRITE,grid);
    }
}

module.exports = {HaystackClient};
