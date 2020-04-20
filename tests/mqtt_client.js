const assert = require('assert');
const Aedes = require('aedes');
const config = require('config');
const {MqttClient} = require('../src/mqtt_client');
const mqttConfig = config.get("mqtt");
let aedes = null;
let server = null;
before(function(done){
    aedes = new Aedes({});
    server = require('net').createServer({}, aedes.handle);
    server.listen(mqttConfig.port, function () {
    });
    done();
});
describe('MqttClient',function(){
    let mqttClient = null;
    before(function(done){
        done();
    });
    describe('#constructor()',function(){
        it('authenticates',function(done){
            let usernameRcvd = '';
            const timeout = setTimeout(function(){
                assert.equal(usernameRcvd,mqttConfig.authentication.username);
                done();
            },200);
            aedes.authenticate = function(client,username,password,callback){
                usernameRcvd = username;
                callback(null,true);
            }
            mqttClient = new MqttClient();
        });
        it('has a non-null pingJob',function(done){
            assert.notEqual(null,mqttClient.pingJob);
            done();
        });
    });
    describe('#publishMessage(messageJson)',function(){
        it('succeeds',function(done){
            const timeout = setTimeout(function(){
                assert.fail();
                aedes.removeAllListeners('publish');
                done();
            },200);
            aedes.on('publish',function(packet,client){
                if(packet.topic.includes('pollResult')){
                    assert.ok(1);
                    clearTimeout(timeout);
                    aedes.removeAllListeners('publish');
                    done();
                }
            });
            mqttClient.publishMessage({msg:'hi'});
        });        
    });
    describe('#publishCommandResult(messageJson)',function(){
        it('succeeds',function(done){
            const timeout = setTimeout(function(){
                assert.fail();
                aedes.removeAllListeners('publish');
                done();
            },200);
            aedes.on('publish',function(packet,client){
                if(packet.topic.includes('commandResult')){
                    assert.ok(1);
                    clearTimeout(timeout);
                    aedes.removeAllListeners('publish');
                    done();
                }
            });
            mqttClient.publishCommandResult({msg:'hi'});
        });        
    });
    describe('pingJob',function(){
        it('advertises presence',function(done){
            const timeout = setTimeout(function(){
                assert.fail();
                aedes.removeAllListeners('publish');
                done();
            },1500);
            aedes.on('publish',function(packet,client){
                if(packet.topic.includes('presence')){
                    assert.ok(1);
                    clearTimeout(timeout);
                    aedes.removeAllListeners('publish');
                    done();
                }
            });
        });        
    });
    describe('receive',function(){
        let cmdTopic = '';
        before(function(done){
            let clients = aedes.clients;
            for(var id in clients){
                let subs = clients[id].subscriptions;
                for(var topic in subs){
                    if(topic.includes('/commands')) cmdTopic = topic;
                }
            }
            done();
        });
        const setupRemoteMsgTest =  function(sampleMsg,eventName,done){
            return function(){
                const timeout = setTimeout(function(){
                    assert.fail(`No Event for ${eventName}`);
                    done();
                },200);
                if(cmdTopic == ''){
                    clearTimeout(timeout);
                    assert.fail('No Command Topic Found on Server');
                    done();
                } else {
                    aedes.publish({topic:cmdTopic,payload:Buffer.from(JSON.stringify(sampleMsg))});
                    mqttClient.once(eventName,function(msg){
                        clearTimeout(timeout);
                        assert.deepEqual(sampleMsg,msg);
                        done();
                    });    
                }
            }
        }
        it('receives scan operation',function(done){
            setupRemoteMsgTest({op:'scan'},'remoteScan',done)();
        });
        it('receives discover operation',function(done){
            setupRemoteMsgTest({op:'discover'},'remoteDiscover',done)();
        });
        it('receives stopPolling operation',function(done){
            setupRemoteMsgTest({op:'stopPolling'},'remoteStopPolling',done)();
        });
        it('receives scanSave operation',function(done){
            setupRemoteMsgTest({op:'scanSave'},'remoteScanSave',done)();
        });
        it('receives activate operation',function(done){
            setupRemoteMsgTest({op:'activate'},'remoteActivate',done)();
        });
        it('receives deactivate operation',function(done){
            setupRemoteMsgTest({op:'deactivate'},'remoteDeactivate',done)();
        });
        it('receives restart operation',function(done){
            setupRemoteMsgTest({op:'restart'},'remoteRestart',done)();
        });
    });
    after(function(done){
        mqttClient.destroy();
        done();
    });
});
after(function(done){
    server.close(()=>{});
    aedes.close();
    done();
});
