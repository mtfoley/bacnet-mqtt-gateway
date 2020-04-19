const fs = require('fs');
const EventEmitter = require('events');
const config = require('config');
const { DeviceObjectId, DeviceObject, logger } = require('./common');

const devicesFolder = config.get('bacnet.configFolder');

class BacnetConfig extends EventEmitter {
    constructor(callback){
        super();
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
        fs.readdir(devicesFolder, (error, files) => {
            if (error) {
                fs.mkdir(devicesFolder,(error2)=>{
                    if(error2) logger.log('error', `Error Creating Config Folder: ${error2}`);
                });
            } else {
                logger.log('info', `Device configs found: ${files}`);
                files.forEach(file => {
                    // files with _ should be interpreted as deactivated and therefore are skipped
                    if (file.startsWith('_')) {
                        logger.log('info', `Skipping deactivated file ${file}`)
                    } else {
                        fs.readFile(devicesFolder + "/"+ file, 'utf8', (err, contents) => {
                            if (err) {
                                logger.log('error', `Error while reading config file: ${err}`);
                            } else {
                                const deviceConfig = JSON.parse(contents);
                                this.emit('configLoaded', deviceConfig);
                            }
                        });
                    }
                });
            }
        });
    }
    unload(){
        this.emit('configUnloaded');
    }
    save(deviceConfig,callback) {
        const filename = `device.${deviceConfig.device.deviceId}.json`;
        fs.writeFile(devicesFolder + "/"+filename, JSON.stringify(deviceConfig, null, 4), function (err) {
            if (err) {
                logger.log('error', `Error while writing config file: ${err}`);
            } else {
                logger.log('info', `Config file '${filename}' successfully saved.`);
            }
            if(callback) callback(err);
        });
    }
    deactivate(deviceId,callback){
        const filename = devicesFolder + `/device.${deviceId}.json`;
        const newFileName = devicesFolder + `/_device.${deviceId}.json`;
        fs.rename(filename,newFileName,(err)=>{
            if(err) logger.log('error',`Error while deactivating config file: ${err}`);
            else logger.log('info',`Config file '${filename} successfully deactivated.`);
            if(callback) callback(err);
        })
    }
    activate(deviceId,callback){
        const filename = devicesFolder + `/_device.${deviceId}.json`;
        const newFileName = devicesFolder + `/device.${deviceId}.json`;
        fs.rename(filename,newFileName,(err)=>{
            if(err) logger.log('error',`Error while activating config file: ${err}`);
            else logger.log('info',`Config file '${filename} successfully activated.`);
            if(callback) callback(err);
        })
    }
    delete(deviceId,callback) {
        const filename = devicesFolder + `/device.${deviceId}.json`;
        fs.unlink(filename, (err) => {
            if (err) {
                logger.log('error', `Error while deleting config file: ${err}`);
            } else {
                logger.log('info', `Config file '${filename}' successfully deleted.`);
            }
            if(callback) callback(err);
        });
    }
}

module.exports = { BacnetConfig };