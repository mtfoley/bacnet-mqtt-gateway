const mqtt = require('mqtt');
const config = require('config');
const { scheduleJob } = require('node-schedule');
const EventEmitter = require('events');
const {logger} = require('./common');

// load configs
const gatewayId = config.get('mqtt.gatewayId');
const host = config.get('mqtt.host');
const port = config.get('mqtt.port');

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
            protocol: 'mqtts',
            username: username,
            password: password,
            rejectUnauthorized: false
        }

        this.client = mqtt.connect(options);
        this.client.on('connect', () => {
            this._onConnect();
        });
        this.client.on('error', (error) => {
            logger.log('error', 'Could not connect: ' + err.message);
        });
    }
    destroy(){
        logger.log('info','destroy MqttClient');
        this.client.removeAllListeners();
        this.removeAllListeners();
    }
    _onConnect() {
        logger.log('info', 'Client connected');
        this.client.on('message', (topic,msg) => this._onMessage(topic,msg));
        this.client.on('error', function (err) { logger.log('error', err); });
        this.client.subscribe('devices/'+gatewayId+'/commands');
        this.client.subscribe('devices/'+gatewayId+'/update');
        scheduleJob(config.get("mqtt.defaultSchedule"), () => {
            this.client.publish('devices/presence',JSON.stringify({gatewayId:gatewayId}));
        });
    };
    
    _onMessage(topic,msg) {
        logger.log('info', `[${topic}] Received message ${msg}`);
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

        logger.log('info', 'Publish message to MQTT Broker');
        this.client.publish(topic, message);
    }

    publishCommandResult(messageJson){
        const message = JSON.stringify(messageJson);
        const topic = 'devices/' + gatewayId + '/commandResult';
        logger.log('info', 'Publish command results to MQTT Broker');
        this.client.publish(topic, message);

    }

}

module.exports = {MqttClient};
