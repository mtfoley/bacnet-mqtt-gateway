const { HaystackClient } = require("../src/haystack_client");
const { Collector } = require("../src/collector");
const url = require('url');
const assert = require('assert');
const nock = require('nock');
const config = require('config');
// Setup all testing parameters
const testIdZinc = "@testId";
const testIdJson = "r:testId"
const testTrend = {id:'collector-test',source:'test'};
const date = new Date();
const testData = [
  {ts:date.getTime(),val:0.5},
  {ts:date.getTime()+5,val:0.7}
];
// function for Haystack API Mocking
const getNockScope = function(host,headers){
    return nock(host,headers)
    //.log(console.log)
    .persist();
}
const makeNockScopes = function(){
    const hcfg = config.get("haystack");
    const baseUrl = new URL(hcfg.baseUrl);
    const host = baseUrl.protocol+"//"+baseUrl.host;
    const path = baseUrl.pathname;

    const authScope1 = getNockScope(host, { reqheaders: {'Authorization': /hello/gi } } );
    authScope1.get(`${path}/about`).reply(401,'',{'WWW-Authenticate': 'SCRAM hash=SHA-256, handshakeToken=aabbcc'});

    const authScope2 = getNockScope(host, { reqheaders:{'Authorization': /scram data=(.*), handshakeToken=aabbcc/gi}});
    authScope2.get(`${path}/about`).reply(401,'',{'WWW-Authenticate': 'SCRAM handshakeToken=authAABBCC, hash=SHA-256, data=cj1yT3ByTkdmd0ViZVJXZ2JORWtxTyVodllEcFdVYTJSYVRDQWZ1eEZJbGopaE5sRixzPVcyMlphSjBTTlk3c29Fc1VFamI2Z1E9PSxpPTQwOTYK'});

    const authScope3 = getNockScope(host,{ reqheaders:{ 'Authorization': /scram data=(.*), handshakeToken=authAABBCC/gi}});
    authScope3.get(`${path}/about`).reply(200,'',{'Authentication-Info': 'authToken=xxyyzz'});

    const pingScope = getNockScope(host,{reqheaders:{'Authorization':/bearer/gi}});
    const pingResponse = JSON.stringify({meta:{cols:['productVersion']},rows:[{productVersion:"3.0"}]});
    pingScope.get(`${path}/about`).reply(200,pingResponse,{'Content-Type':'application/json'});

    const commitScope = getNockScope(host,{reqheaders:{'Authorization':/bearer/gi}})
    const commitResponse = JSON.stringify({meta:{cols:['id']},rows:[{id:testIdJson}]});
    commitScope.post(`${path}/commit`).reply(200,commitResponse,{'Content-Type':'application/json'});

    const hisWriteScope = getNockScope(host,{reqheaders:{'Authorization':/bearer/gi}});
    hisWriteScope.post(`${path}/hisWrite`).reply(200,'ver: "3.0"\nempty\n');
}
describe('HaystackClient', function() {
    const collector = new Collector();
    collector.rebuildIndex();
    let haystackClient = null;
    makeNockScopes();
    describe('#constructor()',function(){
        haystackClient = new HaystackClient(collector);
        it('assigns collector',function(){
            assert.deepEqual(collector,haystackClient.collector);
        });
        it('has a null authToken',function(){
            assert.equal(haystackClient.authToken,null);
        });
    });
    describe('#connect()',function(){
        it('resolves with correct authToken',function(done){
            haystackClient.once('connected',(header)=>{
                assert.deepEqual(header,{Authorization:'bearer authToken=xxyyzz'});
                done();
            });
            assert.doesNotReject(haystackClient.connect().catch((error)=>{
                assert.fail(error);
                done();
            }));
        });
    });
    describe('#isLoggedIn()',function(){
        it('returns true after successful connection',function(done){
            assert(haystackClient.isLoggedIn() == true);
            done();
        });
    });
    describe('#ping()',function(){
        it('emits ping response',function(done){
            haystackClient.once('pingSuccess',(data)=>{
                assert.ok(data.rows[0].productVersion,"3.0");
                done();
            });
            haystackClient.ping();
        });
    });
    describe('#commitTrend(trend)',function(){
        it('rejects without trend',function(){
            return assert.rejects(haystackClient.commitTrend());
        });
        it('resolves when trend already has haystackId',function(){
            return assert.doesNotReject(haystackClient.commitTrend({haystackId:testIdZinc}));
        });
        it('resolves with new haystackId',function(done){
            haystackClient.commitTrend({id:"bacnet_0_0"}).catch((error)=>{
                assert.fail(error);
                done();
            }).then((haystackData)=>{
                assert.equal(haystackData.rows[0].id,testIdZinc);
                done();
            });
        });
    });
    describe('#hisWrite(id,data)',function(){
        it('resolves with id and data',function(){
            return assert.doesNotReject(haystackClient.hisWrite(testIdZinc,testData));
        });
    });
    describe('#startPush()',function(){
        it('makes a non-null pushJob field',function(done){
            haystackClient.startPush();
            setTimeout(function(){
                assert.notEqual(haystackClient.pushJob,null);
                done();    
            },1500);
        });
    });
    describe('destroy()',function(){
        it('cancels pingJob and pushJob',function(){
            haystackClient.destroy();
            const cancelled = (haystackClient.pushJob == null || haystackClient.pushJob.nextInvocation() == null) 
                && (haystackClient.pingJob == null || haystackClient.pingJob.nextInvocation() == null);
            assert.ok(cancelled);
        });
    });
});
