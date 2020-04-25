const fs = require('fs');
const EventEmitter = require('events');
const config = require('config');
const devicesFolder = config.get('bacnet.configFolder');
const { logger } = require('./common');

class TemplateConfig extends EventEmitter {
    constructor(callback){
        super();
        this.cache = {};
        fs.stat(devicesFolder,(error,stats)=>{
            if(error){
                fs.mkdir(devicesFolder,(error2)=>{
                    if(callback){
                        if(error2) callback(error2);
                        else callback(null);
                    }
                });
            } else {
                if(callback) callback(null);
            }
        });
    }
    _cleanName(name){
        return name.replace(/^a-z|0-9|_/gi,"_");
    }
    _getFilename(name){
        const _name = this._cleanName(name);
        return `tpl.${_name}.json`;
    }
    _parseFilename(filename){
        const match = filename.match(/tpl\.(.*)\.json/);
        if(match == null) return match;
        else return match[1];
    }
    list(){
        return Object.values(this.cache);
    }
    unload(){
        this.cache = {};
        this.emit('configUnloaded');
    }
    load(){
        fs.readdir(devicesFolder, (error, files) => {
            if (error) {
                fs.mkdir(devicesFolder,(error2)=>{
                    if(error2) logger.error(`Error Creating Config Folder: ${error2}`);
                });
            } else {
                logger.info(`Device configs found: ${files}`);
                files.forEach(file => {
                    // files with _ should be interpreted as deactivated and therefore are skipped
                    if (file.startsWith('tpl')) {
                        const name = this._parseFilename(file);
                        fs.readFile(devicesFolder + "/"+ file, 'utf8', (err, contents) => {
                            if (err) {
                                logger.error(`Error while reading config file: ${err}`);
                            } else {
                                try {
                                    const config = JSON.parse(contents);
                                    this.cache[name] = config;
                                    logger.info('Config Loaded: '+name);
                                    this.emit('configLoaded', name);    
                                } catch(e) {
                                    logger.error('Config Load Error: '+e);
                                    this.emit('configLoadError',name);
                                }
                            }
                        });
                    }
                });
            }
        });
    }
    save(name,config,callback){
        const _name = this._cleanName(name);
        const filename = this._getFilename(name);
        const _config = Object.assign(config,{name:_name});
        this.cache[_name] = _config;
        fs.writeFile(devicesFolder+"/"+filename,JSON.stringify(_config,null,4),(err)=>{
            if(err) logger.error('Template Save Error: '+err);
            if(callback) callback(err);
            this.emit('configSaved',_config);
        });
    }
    getByName(name){
        const _name = this._cleanName(name);
        return this.cache[_name];
    }
    delete(name,callback){
        const _name = this._cleanName(name);
        const filename = this._getFilename(name);
        delete this.cache[_name];
        fs.unlink(devicesFolder+"/"+filename,(err)=>{
            if(err) logger.error('Template Delete Error: '+err);
            if(callback) callback(err);
            this.emit('configDeleted',name);
        });
    }
}
module.exports = { TemplateConfig }