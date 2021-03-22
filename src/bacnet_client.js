const bacnet = require('bacstack');
const { scheduleJob } = require('node-schedule');
const { EventEmitter } = require('events');
const appConfig = require('config');
const { BacnetConfig } = require('./bacnet_config');
const { DeviceObjectId, DeviceObject, DeviceInfo, logger } = require('./common');

class BacnetClient extends EventEmitter {

    constructor(collector) {
        super();
        this.collector = collector;
        this.client = new bacnet({ apduTimeout: 10000 });
        this.jobs = {};
        this.bacnetConfig = new BacnetConfig();
        this.bacnetConfig.on('configLoaded', (config) => {
            if(config.device && config.objects){
                this.startPolling(config.device, config.objects, config.polling.schedule||appConfig.get("bacnet.defaultSchedule"));

            }
        });
        this.bacnetConfig.load();
    }
    _trendValues(values){
        const ts = (new Date()).getTime();
        const promises = [];
        for(var k in values){
            const id = "bacnet_"+k;
            const data = {ts:ts,val:values[k]};
            promises.push(this.collector.enqueue(id,[data]));
        }
        Promise.all(promises).then(()=>{
            logger.info(`BACnet ${promises.length} Values Trended`);
        }).catch((error)=>{
            logger.error('BACnet Values Trending Error: ',error);
        })
    }
    destroy(){
        logger.info('BACnet Client Destroy');
        this.stopPolling();
        this.client.removeAllListeners();
        this.removeAllListeners();
    }
    _readObjectList(deviceAddress, deviceId, callback) {
        // Read Device Object
        const requestArray = [{
            objectId: { type: bacnet.enum.ObjectTypes.OBJECT_DEVICE, instance: deviceId },
            properties: [
                { id: bacnet.enum.PropertyIds.PROP_OBJECT_LIST }
            ]
        }];
        this.client.readPropertyMultiple(deviceAddress, requestArray, callback);
    }

    _readObject(deviceAddress, type, instance, properties) {
        return new Promise((resolve, reject) => {
            const requestArray = [{
                objectId: { type: type, instance: instance },
                properties: properties
            }];
            this.client.readPropertyMultiple(deviceAddress, requestArray, (error, value) => {
                resolve({
                    error: error,
                    value: value
                });
            });
        });
    }
    _readObjectFull(deviceAddress, type, instance) {
        return this._readObject(deviceAddress, type, instance, [
            { id: bacnet.enum.PropertyIds.PROP_OBJECT_IDENTIFIER },
            { id: bacnet.enum.PropertyIds.PROP_OBJECT_NAME },
            { id: bacnet.enum.PropertyIds.PROP_OBJECT_TYPE },
            { id: bacnet.enum.PropertyIds.PROP_DESCRIPTION },
            { id: bacnet.enum.PropertyIds.PROP_UNITS },
            { id: bacnet.enum.PropertyIds.PROP_PRESENT_VALUE },
            { id: bacnet.enum.PropertyIds.PROP_STATE_TEXT }
        ]);
    }

    _readObjectPresentValue(deviceAddress, type, instance) {
        return this._readObject(deviceAddress, type, instance, [
            { id: bacnet.enum.PropertyIds.PROP_PRESENT_VALUE }//,
//            { id: bacnet.enum.PropertyIds.PROP_OBJECT_NAME}
        ]);
    }
    _readDeviceInfo(deviceAddress, deviceId, callback) {
        // Read Device Object
        const requestArray = [{
            objectId: { type: bacnet.enum.ObjectTypes.OBJECT_DEVICE, instance: deviceId },
            properties: [
                { id: bacnet.enum.PropertyIds.PROP_OBJECT_NAME },
                { id: bacnet.enum.PropertyIds.PROP_DESCRIPTION },
                { id: bacnet.enum.PropertyIds.PROP_PROTOCOL_SERVICES_SUPPORTED }
            ]
        }];
        this.client.readPropertyMultiple(deviceAddress, requestArray, function(err,res){
            res.values[0].values.address = deviceAddress;
            res.values[0].values.deviceId = deviceId;
            callback(err,res);            
        });
    }
    _findValueById(properties, id) {
        const property = properties.find(function (element) {
            return element.id === id;
        });
        if (property && property.value && property.value.length > 0) {
            if(property.value.length > 1) return property.value.map((obj)=>{return obj.value});
            else return property.value[0].value;
        } else {
            return null;
        }
    };
    _mapToDeviceInfo(object) {
        if (!object || !object.values) {
            return null;
        }
        const objectProperties = object.values[0].values;
        const deviceId = objectProperties.deviceId;
        const address = objectProperties.address;
        const name = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_OBJECT_NAME);
        const description = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_DESCRIPTION);
        const servicesSupported = this._findValueById(objectProperties,bacnet.enum.PropertyIds.PROP_PROTOCOL_SERVICES_SUPPORTED);
        return new DeviceInfo(address,deviceId, name, description, servicesSupported);
    }

    _mapToDeviceObject(object) {
        if (!object || !object.values) {
            return null;
        }

        const objectInfo = object.values[0].objectId;
        const deviceObjectId = new DeviceObjectId(objectInfo.type, objectInfo.instance);
        const objectProperties = object.values[0].values;
        const name = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_OBJECT_NAME);
        const description = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_DESCRIPTION);
        const type = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_OBJECT_TYPE);
        const units = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_UNITS);
        const presentValue = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_PRESENT_VALUE);
        const stateText = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_STATE_TEXT);
        return new DeviceObject(deviceObjectId, name, description, type, units, presentValue, stateText);
    }

    scanForDevices(params) {
        const self = this;
        return new Promise((resolve,reject)=>{
            const deviceList = [];
            const addDevice = function(err,res){
                const deviceInfo = self._mapToDeviceInfo(res);
                deviceList.push(deviceInfo);    
            }
            const listener = function(device){
                self._readDeviceInfo(device.address, device.deviceId, addDevice);
            };
            try{
                self.client.on('iAm',listener);
                self.client.whoIs(params);
            } catch(e){
                reject(e);
            }
            setTimeout(function(){
                self.client.off('iAm',listener);
                resolve(deviceList);

            },3000);
        });
    }

    scanDevice(device) {
        return new Promise((resolve, reject) => {
            logger.log('info', `Reading full object list from device: ${device.address}`);
            this._readObjectList(device.address, device.deviceId, (err, result) => {
                if (!err) {
                    const objectArray = result.values[0].values[0].value;
                    const promises = [];
                    const valueTypes = [
                        bacnet.enum.ObjectTypes.OBJECT_ANALOG_INPUT,
                        bacnet.enum.ObjectTypes.OBJECT_ANALOG_OUTPUT ,
                        bacnet.enum.ObjectTypes.OBJECT_ANALOG_VALUE ,
                        bacnet.enum.ObjectTypes.OBJECT_BINARY_INPUT ,
                        bacnet.enum.ObjectTypes.OBJECT_BINARY_OUTPUT ,
                        bacnet.enum.ObjectTypes.OBJECT_BINARY_VALUE ,
                        bacnet.enum.ObjectTypes.OBJECT_MULTI_STATE_INPUT ,
                        bacnet.enum.ObjectTypes.OBJECT_MULTI_STATE_OUTPUT ,
                        bacnet.enum.ObjectTypes.OBJECT_MULTI_STATE_VALUE
                    ];
                    objectArray.forEach(object => {
                        if(valueTypes.includes(object.value.type)){
                            promises.push(this._readObjectFull(device.address, object.value.type, object.value.instance));
                        }
                    });

                    Promise.all(promises).then((result) => {
                        const successfulResults = result.filter(element => !element.error);
                        const deviceObjects = successfulResults.map(element => this._mapToDeviceObject(element.value));
                        logger.log('info', `Objects found: ${deviceObjects.length}`);
                        this.emit('deviceObjects', device, deviceObjects);
                        resolve(deviceObjects);
                    }).catch((error) => {
                        logger.log('error', `Error while fetching objects: ${error}`);
                        reject(error);
                    });
                } else {
                    logger.log('error', `Error while fetching objects: ${err}`);
                }
            });
        });
    }

    startPolling(device, objects, scheduleExpression) {
        logger.log('info', `Schedule polling for device ${device.address} with expression ${scheduleExpression}`);
        this.stopPolling(device);
        const trendObjects = [];
        objects.forEach((item)=>{
            const id = "bacnet_"+device.deviceId+"_"+item.objectId.type+"_"+item.objectId.instance;
            trendObjects.push(Object.assign(item,{id}));
        });
        this.collector.update(trendObjects);
        this.jobs[device.deviceId] = scheduleJob(scheduleExpression, () => {
            logger.log('info', 'Fetching device object values');
            const promises = [];
            objects.forEach(deviceObject => {
                promises.push(this._readObjectPresentValue(device.address, deviceObject.objectId.type, deviceObject.objectId.instance));
            });
            Promise.all(promises).then((result) => {
                const values = {};
                // remove errors and map to result element
                const successfulResults = result.filter(element => !element.error).map(element => element.value);
                successfulResults.forEach(object => {
                    const objectId = object.values[0].objectId.type + '_' + object.values[0].objectId.instance;
                    const presentValue = this._findValueById(object.values[0].values, bacnet.enum.PropertyIds.PROP_PRESENT_VALUE);
                    values[device.deviceId+"_"+objectId] = presentValue;
                });
                this._trendValues(values);
                this.emit('values', device, values);
            }).catch(function (error) {
                logger.log('error', `Error whilte fetching values: ${error}`);
            });
        });
        this.emit('startPolling',device,scheduleExpression);
    }
    stopPolling(device){
        if(!device){
            for(var deviceId in this.jobs){
                this.stopPolling({deviceId});
            }
        } else {
            if(this.jobs[device.deviceId]) this.jobs[device.deviceId].cancel();
            this.emit('stopPolling',device);
        }
    }
    saveConfig(config) {
        this.bacnetConfig.updateDevice(config,(err,id)=>{
            if(!err) this.bacnetConfig.save();
        });
    }
    deactivate(params){
        this.stopPolling(params);
        this.bacnetConfig.deactivate(params.deviceId);
        this.emit('deactivate',params.deviceId);
    }
}

module.exports = { BacnetClient };
