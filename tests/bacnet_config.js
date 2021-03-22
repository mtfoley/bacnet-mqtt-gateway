// load, unload, save, deactivate, activate, delete
const fs = require('fs');
const { BacnetConfig } = require("../src/bacnet_config.js");
const assert = require('assert');
const config = require('config');

const devicesFolder = config.get('devicesFolder');

let deviceConfigs = {
    devices: {
        '150001':{
            device:{
                deviceId: 150001,
                address: '127.0.0.1'
            },
            objects:[{
                "objectId": {
                    "type": 0,
                    "instance": 50
                },
                "name": "standbyCoolSetpoint|A1st Floor HP's-4",
                "description": "",
                "type": 0,
                "units": 64,
                "presentValue": 77.01000213623047
            },
            {
                "objectId": {
                    "type": 1,
                    "instance": 1
                },
                "name": "spaceSetpoint|A4th Floor HP's-1",
                "description": "",
                "type": 1,
                "units": 64,
                "presentValue": 72.50399780273438
            }]
        },
        '150002':{
            template:'tstat',
            device:{
                deviceId: 150002,
                address: '127.0.0.1'
            }
        }
    },
    templates: {
        'tstat':{
            name:'tstat',
            objects:[{
                "objectId": {
                    "type": 0,
                    "instance": 1
                },
                "name": "zone temp",
                "description": "zone temperature",
                "type": 0,
                "units": 64,
                "presentValue": 77.01000213623047
            },
            {
                "objectId": {
                    "type": 1,
                    "instance": 1
                },
                "name": "setpoint",
                "description": "setpoint",
                "type": 1,
                "units": 64,
                "presentValue": 72.50399780273438
            }]
        }
    }
}
const configFilePath = devicesFolder + "/bacnet.json";
before((done)=>{
    fs.mkdirSync(devicesFolder);
    if(fs.existsSync(configFilePath)) fs.unlinkSync(configFilePath);
    const json = JSON.stringify(deviceConfigs,null,4);
    fs.writeFile(configFilePath, json,done);
});

describe('BacnetConfig', function() {
    describe('#constructor()',function(){
        it('Succeeds',function(done){
            bacnetConfig = new BacnetConfig((error)=>{
                if(error) assert.fail(error);
                else assert.ok(1);
                done();
            });
        });
    });
    describe('#load()',function(){
        it('Emits Example Config Added',function(done){
            let flag = true;
            bacnetConfig.on('configLoaded',(config)=>{
                assert.ok(config == null || (config.hasOwnProperty("device") && config.hasOwnProperty("objects")));
                flag = false;
            });
            bacnetConfig.load();
            setTimeout(()=>{
                if(flag){
                    assert.fail('No configLoaded Event');
                }
                done();
            },25);
        });
    });    
    describe('#saveTemplate(name,config,callback)',function(){
        it('Emits saveTemplate event',function(done){
            let flag = true;
            let expected = 'tstat';
            bacnetConfig.on('templateSaved',(name)=>{
                assert.equal(name,expected);
                flag = false;
            });
            bacnetConfig.saveTemplate('tstat',deviceConfigs.templates['tstat'],(err,name)=>{
                assert.equal(err,null);
                assert.equal(name,expected);                
            });
            setTimeout(()=>{
                if(flag){
                    assert.fail('No templateSaved Event');
                }
                done();
            },25);
        })

    });
    describe('#save(callback)',function(){
        it('Saves File Successfully',function(done){
            bacnetConfig.save((err)=>{
                if(err){
                    assert.fail(err);
                    done(err);
                } else {
                    assert.ok(1);
                    done();
                }
            });
        });
    });
    describe('Deactivation',function(){
        it('Emits deactivated event',function(done){
            let flag = true;
            let expected = '150001';
            bacnetConfig.on('deactivated',(deviceId)=>{
                assert.equal(deviceId,expected);
                flag = false;
            });
            bacnetConfig.deactivate(expected,(err,deviceId)=>{
                assert.equal(err,null);
                assert.equal(deviceId,expected);                
            });
            setTimeout(()=>{
                if(flag){
                    assert.fail('No deactivated Event');
                }
                done();
            },25);
        })
    });
    describe('Activation',function(){
        it('Emits activated event',function(done){
            let flag = true;
            let expected = '150001';
            bacnetConfig.on('activated',(deviceId)=>{
                assert.equal(deviceId,expected);
                flag = false;
            });
            bacnetConfig.activate(expected,(err,deviceId)=>{
                assert.equal(err,null);
                assert.equal(deviceId,expected);                
            });
            setTimeout(()=>{
                if(flag){
                    assert.fail('No deactivated Event');
                }
                done();
            },25);
        })
    });
    describe('#delete(deviceId)',function(){
        it('Emits deleted event',function(done){
            let flag = true;
            let expected = '150001';
            bacnetConfig.on('deleted',(deviceId)=>{
                assert.equal(deviceId,expected);
                flag = false;
            });
            bacnetConfig.delete(expected,(err,deviceId)=>{
                assert.equal(err,null);
                assert.equal(deviceId,expected);                
            });
            setTimeout(()=>{
                if(flag){
                    assert.fail('No deleted Event');
                }
                done();
            },25);
        })
    });
    describe('#unload()',function(){
        it('Emits Config Unloaded',function(done){
            bacnetConfig.on('configUnloaded',()=>{
                    assert.ok(1);
                    done();
            });
            bacnetConfig.unload();
        });
    });

});
after((done)=>{
    if(fs.existsSync(configFilePath)) fs.unlinkSync(configFilePath);
    fs.rmdirSync(devicesFolder);
    done();
});