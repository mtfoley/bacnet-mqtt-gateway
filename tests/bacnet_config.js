// load, unload, save, deactivate, activate, delete
const fs = require('fs');
const { BacnetConfig } = require("../src/bacnet_config.js");
const assert = require('assert');
const config = require('config');
const devicesFolder = config.get('bacnet.configFolder');

const exampleConfig1 = {
    device:{
        deviceId: 150001,
        address:"127.0.0.1"
    }
};
const exampleConfig2 = {
    device:{
        deviceId: 150002,
        address:"127.0.0.1"
    }
};
const exampleConfig3 = {
    device:{
        deviceId: 150003,
        address:"127.0.0.1"
    }
};
const exampleConfig4 = {
    device:{
        deviceId: 150004,
        address:"127.0.0.1"
    }
};
const path1 = `${devicesFolder}/device.${exampleConfig1.device.deviceId}.json`;
const path2 = `${devicesFolder}/_device.${exampleConfig2.device.deviceId}.json`;
const path3 = `${devicesFolder}/device.${exampleConfig3.device.deviceId}.json`;
const path4 = `${devicesFolder}/device.${exampleConfig4.device.deviceId}.json`;
const bacnetConfig = new BacnetConfig();

describe('BacnetConfig', function() {
    before((done)=>{
        if(fs.existsSync(path1)) fs.unlinkSync(path1);
        if(fs.existsSync(path4)) fs.unlinkSync(path4);
        done();
    })
    describe('Initial Lifecycle',function(){
        describe('#save(deviceConfig)',function(){
            it(`Saves File Successfully (${path1})`,function(done){
                bacnetConfig.save(exampleConfig1);
                fs.stat(path1,(err,stats)=>{
                    if(err) assert.fail();
                    else if(stats.isFile()) assert.ok(1);
                    done();
                });
            });
        });
        describe('#load()',function(){
            it('Emits Example Config Added',function(done){
                bacnetConfig.on('configLoaded',(config)=>{
                    if(config.device.deviceId == exampleConfig1.device.deviceId){
                        assert.deepEqual(config,exampleConfig1);
                        done();
                    }
                });
                bacnetConfig.load();
            });
        });    
    });
    describe('Deactivation',function(){
        it('Follows Naming Convention',function(done){
            bacnetConfig.save(exampleConfig2);
            bacnetConfig.deactivate(exampleConfig2.device.deviceId);
            fs.stat(path2,(err,stats)=>{
                if(err) assert.fail();
                else if(stats.isFile()) assert.ok(1);
                done();
            });
    });
    });
    describe('Activation',function(){
        it('Follows Naming Convention',function(done){
            bacnetConfig.save(exampleConfig3);
            bacnetConfig.deactivate(exampleConfig3.device.deviceId);
            bacnetConfig.activate(exampleConfig3.device.deviceId);
            fs.stat(path3,(err,stats)=>{
                if(err) assert.fail();
                else if(stats.isFile()) assert.ok(1);
                done();
            });
        });
    });
    describe('#delete(deviceId)',function(){
        it('Removes File',function(done){
            bacnetConfig.save(exampleConfig4);
            bacnetConfig.delete(exampleConfig4.device.deviceId);
            setTimeout(function(){
                assert.ok(fs.existsSync(path4) === false);
                done();
            },10);
        });
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
