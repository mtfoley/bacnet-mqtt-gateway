// load, unload, save, deactivate, activate, delete
const fs = require('fs');
const { TemplateConfig } = require("../src/template_config.js");
const assert = require('assert');
const config = require('config');
const devicesFolder = config.get('bacnet.configFolder');
const name1 = "test1";
const exampleConfig1 = {
    device:{
        deviceId: 150001,
        address:"127.0.0.1"
    }
};
const path1 = `${devicesFolder}/tpl.${name1}.json`;
const name2 = "test2";
const exampleConfig2 = {
    device:{
        deviceId: 150002,
        address:"127.0.0.1"
    }
};
const path2 = `${devicesFolder}/tpl.${name2}.json`;
let templateConfig = null;

before((done)=>{
    if(fs.existsSync(path1)) fs.unlinkSync(path1);
    if(fs.existsSync(path2)) fs.unlinkSync(path2);
    done();
});

describe('TemplateConfig', function() {
    describe('#constructor()',function(){
        it('Succeeds',function(done){
            templateConfig = new TemplateConfig((error)=>{
                if(error) assert.fail(error);
                else assert.ok(1);
                done();
            });
        });
    });
    describe('#save(name,deviceConfig,callback)',function(){
        it('Saves File Successfully',function(done){
            templateConfig.save(name1,exampleConfig1,(err)=>{
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
            templateConfig.on('configLoaded',(name)=>{
                if(name == name1){
                    assert.equal(name,name1);
                    flag = false;
                }
            });
            templateConfig.load();
            setTimeout(()=>{
                if(flag){
                    assert.fail('No configLoaded Event');
                }
                done();
            },25);
        });
    });    
    describe('#list()',function(){
        it('Lists Example Config',function(done){
            let list = templateConfig.list();
            let index = list.findIndex((obj)=>{return obj.name == name1});
            assert.ok(index > -1);
            done();
        });
    });
    describe('#delete(name,callback)',function(){
        it('Removes File',function(done){
            templateConfig.save(name2,exampleConfig2);
            templateConfig.delete(name2,(err)=>{
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
            templateConfig.on('configUnloaded',()=>{
                    assert.ok(1);
                    done();
            });
            templateConfig.unload();
        });
        it('Empties Cache',function(done){
            let list = templateConfig.list();
            assert.equal(list.length,0);
            done();
        });
    });

});
after((done)=>{
    if(fs.existsSync(path1)) fs.unlinkSync(path1);
    if(fs.existsSync(path2)) fs.unlinkSync(path2);
    fs.rmdirSync(devicesFolder);
    done();
});