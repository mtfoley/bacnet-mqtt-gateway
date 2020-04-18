const { createLogger, format, transports } = require('winston');
const logFormat = format.printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});
const logger = createLogger({
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        logFormat
        //format.json()
    ),
    transports: [new transports.Console({
        silent:(process.env.NODE_ENV ==='test')
    })]
});

class DeviceObjectId {
    constructor(type, instance) {
        this.type = type;
        this.instance = instance;
    }
}

class DeviceObject {
    constructor(objectId, name, description, type, units, presentValue,stateText) {
        this.objectId = objectId;
        this.name = name;
        this.description = description;
        this.type = type;
        this.units = units;
        this.presentValue = presentValue;
        this.stateText = stateText;
    }
}

class DeviceInfo {
    constructor(address,deviceId, name, description, servicesSupported){
        this.address = address;
        this.deviceId = deviceId;
        this.name = name;
        this.description = description;
        const services = [];
        if(servicesSupported.value instanceof Array){
            servicesSupported.value.forEach(value => {
                [1,2,4,8,16,32,64,128].forEach(x=> {
                    services.push((value & x)>0)
                })
            });    
        }
        this.servicesSupported = services;
    }
}

module.exports = { DeviceObjectId, DeviceObject, DeviceInfo, logger };