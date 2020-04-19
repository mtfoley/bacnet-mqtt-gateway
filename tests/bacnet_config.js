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
let bacnetConfig = null;
before((done)=>{
    if(fs.existsSync(path1)) fs.unlinkSync(path1);
    if(fs.existsSync(path2)) fs.unlinkSync(path2);
    if(fs.existsSync(path3)) fs.unlinkSync(path3);
    if(fs.existsSync(path4)) fs.unlinkSync(path4);
    done();
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
    describe('#save(deviceConfig)',function(){
        it('Saves File Successfully',function(done){
            bacnetConfig.save(exampleConfig1,(err)=>{
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
    describe('#load()',function(){
        it('Emits Example Config Added',function(done){
            let flag = true;
            bacnetConfig.on('configLoaded',(config)=>{
                if(config.device.deviceId == exampleConfig1.device.deviceId){
                    assert.deepEqual(config,exampleConfig1);
                    flag = false;
                }
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
    describe('Deactivation',function(){
        it('Follows Naming Convention',function(done){
            bacnetConfig.save(exampleConfig2);
            bacnetConfig.deactivate(exampleConfig2.device.deviceId,(err)=>{
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
    describe('Activation',function(){
        it('Follows Naming Convention',function(done){
            bacnetConfig.save(exampleConfig3,(err)=>{
                bacnetConfig.deactivate(exampleConfig3.device.deviceId,(err1)=>{
                    if(err1){
                        assert.fail('Could Not Initially Deactivate'+err1);
                        done(err1);
                    } else {
                        bacnetConfig.activate(exampleConfig3.device.deviceId,(err2)=>{
                            if(err2){
                                assert.fail(err2);
                                done(err2);
                            } else {
                                assert.ok(1);
                                done();
                            }
                        });
                    }
                });    
            });
        });
    });
    describe('#delete(deviceId)',function(){
        it('Removes File',function(done){
            bacnetConfig.save(exampleConfig4);
            bacnetConfig.delete(exampleConfig4.device.deviceId,(err)=>{
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
    if(fs.existsSync(path1)) fs.unlinkSync(path1);
    if(fs.existsSync(path2)) fs.unlinkSync(path2);
    if(fs.existsSync(path3)) fs.unlinkSync(path3);
    if(fs.existsSync(path4)) fs.unlinkSync(path4);
    fs.rmdirSync(devicesFolder);
    done();
});