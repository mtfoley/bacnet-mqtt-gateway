const os = require('os');
const mqtt = require('mqtt');
const config = require('config');
const { machineIdSync } = require('node-machine-id');
const { scheduleJob } = require('node-schedule');
const EventEmitter = require('events');
const {logger} = require('./common');

// load configs
const gatewayId = machineIdSync(true);
// const gatewayId = config.get('mqtt.gatewayId');
const host = config.get('mqtt.host');
const port = config.get('mqtt.port');
const protocol = config.get('mqtt.protocol');
//const certPath = config.get('mqtt.authentication.certPath');
//const keyPath = config.get('mqtt.authentication.keyPath');

const username = config.get('mqtt.authentication.username');
const password = config.get('mqtt.authentication.password');

class MqttClient extends EventEmitter {

    constructor() {
        super();

        var options = {
            host: host,
            port: port,
            protocol: protocol,
            username: username,
            password: password,
            rejectUnauthorized: false
        }
        this.pingJob = null;
        this.client = mqtt.connect(options);
        this.client.on('connect', () => {
            this._onConnect();
        });
        this.client.on('error', (error) => {
            logger.error('MQTT Connect Error: ' + error.message);
        });
    }
    destroy(){
        logger.info('MQTT Client Destroy');
        if(this.pingJob) this.pingJob.cancel();
        this.client.removeAllListeners();
        this.client.end();
        this.removeAllListeners();
    }
    _onConnect() {
        logger.info('MQTT Client Connected');
        this.client.on('message', (topic,msg) => this._onMessage(topic,msg));
        this.client.on('error', function (err) { logger.info('MQTT Error: '+err); });
        this.client.subscribe('devices/'+gatewayId+'/commands');
        this.client.subscribe('devices/'+gatewayId+'/update');
        this.pingJob = scheduleJob(config.get("mqtt.defaultSchedule"), () => {
            this.client.publish('devices/presence',JSON.stringify({
                gatewayId:gatewayId,
                hostname:os.hostname(),
                release:os.release(),
                arch:os.arch(),
                platform:os.platform()
            }));
        }); 
    };
    
    _onMessage(topic,msg) {
        logger.info(`MQTT Received Message [${topic}]`);
        try{
            const messageObj = JSON.parse(msg);
            if(messageObj.op == 'discover') this.emit('remoteDiscover',messageObj);
            else if(messageObj.op == 'scan') this.emit('remoteScan',messageObj);
            else if(messageObj.op == 'stopPolling') this.emit('remoteStopPolling',messageObj);
            else if(messageObj.op == 'scanSave') this.emit('remoteScanSave',messageObj);
            else if(messageObj.op == 'activate') this.emit('remoteActivate',messageObj);
            else if(messageObj.op == 'deactivate') this.emit('remoteDeactivate',messageObj);
            else if(messageObj.op == 'restart') this.emit('remoteRestart',messageObj);
            
        } catch(e){
            logger.log('error',e.message);
        }
    }

    publishMessage(messageJson) {
        const message = JSON.stringify(messageJson);
        const topic = 'devices/' + gatewayId + '/pollResult';
        logger.info(`MQTT Publish Message [${topic}]`);
        this.client.publish(topic, message);
    }

    publishCommandResult(messageJson){
        const message = JSON.stringify(messageJson);
        const topic = 'devices/' + gatewayId + '/commandResult';
        logger.info(`MQTT Publish Command Result [${topic}]`);
        this.client.publish(topic, message);

    }

}

module.exports = {MqttClient};
