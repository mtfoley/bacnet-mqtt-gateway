const fs = require('fs');
const EventEmitter = require('events');
const config = require('config');
const { DeviceObjectId, DeviceObject, logger } = require('./common');

const devicesFolder = config.get('devicesFolder');

class BacnetConfig extends EventEmitter {
    constructor(callback){
        super();
        if(!callback) callback = ()=>{};
        fs.stat(devicesFolder,(error,stats)=>{
            if(error){
                fs.mkdir(devicesFolder,(error2)=>{
                    if(error2) callback(error2);
                    else callback(null);
                });
            } else {
                callback(null);
            }
        });
    }
    load() {
        // read devices and templates into memory.
        // parse out templates first because the
        // objects definition to expand into the device definitions.
        let self = this;
        fs.readFile(devicesFolder+"/bacnet.json",'utf8',(err,contents)=>{
            self.templates = {};
            self.devices = {};
            try {
                const bacnetConfigs = JSON.parse(contents);
                self.templates = bacnetConfigs.templates;
                self.devices = bacnetConfigs.devices;
                
            } catch(err){
                self.emit('error','Error reading BACnet configurations');
                logger.log('error', `Error while reading config file: ${err}`);
                return;
            }
            for(var k in self.devices){
                if(self.devices[k].hasOwnProperty('template')){
                    let tpl = self.devices[k].template;
                    if(!self.devices[k].objects && self.templates[tpl]){
                        self.devices[k].objects = [...self.templates[tpl].objects];
                    }
                }
            }
            self.emit('configLoaded',Object.keys(self.devices));
        });
    }
    unload(){
        this.emit('configUnloaded');
    }
    addDevice(config,callback){

    }
    saveTemplate(name,config,callback){
        name = name.trim();
        if(!name || name == "") callback("empty name",null);
        if(!config || typeof config != "object" || config.hasOwnProperty("values")) callback("invalid config",null);
        let self = this;
        self.templates[name] = Object.assign(config,{name});
        self.emit('templateSaved',name);
        callback(null,name);
    }
    updateDevice(config,callback){

    }
    save(callback) {
        let self = this;
        let configs = {templates:{},devices:{}};
        configs.templates = Object.assign({},self.templates);
        for(let k in self.templates){
            configs.templates[k] = {name:self.templates[k].name, values:self.templates[k].values};    
        }
        const filename = "bacnet.json";
        fs.writeFile(devicesFolder + "/" + filename, JSON.stringify(configs,null,4),function(err){
            if (err) {
                logger.log('error', `Error while writing config file: ${err}`);
            } else {
                logger.log('info', `Config file '${filename}' successfully saved.`);
            }
            if(callback) callback(err);
        });
    }
    deactivate(deviceId,callback){
        let self = this;
        if(!self.devices.hasOwnProperty(deviceId)){
            callback('deviceId not found',null);
        } else {
            self.devices[deviceId].active = false;
            self.emit('deactivated',deviceId);
            callback(null,deviceId);
        }
    }
    activate(deviceId,callback){
        let self = this;
        if(!self.devices.hasOwnProperty(deviceId)){
            callback('deviceId not found',null);
        } else {
            self.devices[deviceId].active = true;
            self.emit('activated',deviceId);
            callback(null,deviceId);    
        }
    }
    delete(deviceId,callback) {
        let self = this;
        if(!self.devices.hasOwnProperty(deviceId)){
            callback('deviceId not found',null);
        } else {
            delete self.devices[deviceId];
            self.emit('deleted',deviceId);
            callback(null,deviceId);
        }
    }
}

module.exports = { BacnetConfig };