const { BacnetClient } = require('./bacnet_client');
const { Server } = require('./server');
const { logger } = require('./common');
const { MqttClient } = require('./mqtt_client');
const { HaystackClient} = require('./haystack_client');
const { Collector } = require('./collector');
const config = require('config');
// load configs
const httpServerEnabled = config.get('httpServer.enabled');

// init MQTT and BACnet clients
var mc = null;
var bc = null;
var hc = null;
var coll = null;

// called when device has been found



// some default init logic when starting the gateway
function stop() {
    if(mc) mc.destroy();
    if(bc) bc.destroy();
    if(hc) hc.destroy();
    if(coll) coll.destroy();
}
function start() {
    coll = new Collector();
    mc = new MqttClient();
    bc = new BacnetClient(coll);
    hc = new HaystackClient(coll);
    coll.rebuildIndex();
    mc.on('remoteDiscover',(params)=>{
        bc.scanForDevices(params).then(deviceInfoObjects => {
            mc.publishCommandResult({result:'discover',devices: deviceInfoObjects})
        }); 
    });
    mc.on('remoteScan',(params)=>{ bc.scanDevice(params) });
    mc.on('remoteScanSave',(params)=>{
        const device = {deviceId: params.deviceId, address: params.address};
        bc.scanDevice(device).then(deviceObjects => {
            const cfg = {
                'device': device,
                'objects': deviceObjects,
                'polling':  config.get("bacnet.defaultSchedule")
            }
            bc.saveConfig(cfg);
            bc.startPolling(cfg.device, cfg.objects, cfg.polling.schedule);    
        });
    });
    mc.on('remoteStopPolling',(params)=>{ bc.stopPolling(params); });
    mc.on('remoteDeactivate',(params)=>{ bc.deactivate(params); });
    mc.on('remoteActivate',(params)=>{ bc.activate(params); });
    mc.on('remoteRestart',(params)=>{
        logger.log('info','Remote Restart');
        restart();
    });
    bc.on('values', (device, values) => { mc.publishMessage({device:device,values:values}); });
    bc.on('deviceSaved', (device,objects) => {
        mc.publishCommandResult({result:'deviceSaved',device,objects});
    });
    bc.on('deviceObjects', (device,objects) => {
        mc.publishCommandResult({result:'deviceObjects',device,objects});
    });
    hc.connect().then((header)=>{
        logger.info('Haystack Authenticated');
        const index = coll.getIndex();
        const promises = [];
        for(var k in index){
            const trend = index[k];
            if(trend.hasOwnProperty("haystackId")==false) promises.push(hc.commitTrend(trend));
            else logger.info(`Trend Defined: ${trend.name} (${trend.haystackId})`);
        }
        logger.info(`Committing ${promises.length} trends`);
        Promise.all(promises).then(()=>{
            hc.startPush();
        }).catch(error=>{
            logger.error('Haystack Commit Error: '+error);
        });
    }).catch((error)=>{
        logger.error('Haystack Error: '+error);
    });
    if (httpServerEnabled) {
        new Server(bc);
    }
}
function restart(){
    stop();
    start();
    
}
start();