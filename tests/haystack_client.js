const { HaystackClient } = require("../src/haystack_client");
const { Collector } = require("../src/collector");
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
const makeNockScopes = function(){
    const hcfg = config.get("haystack");
    let host = `${hcfg.protocol}://${hcfg.host}:${hcfg.port}`;
    if(
        (hcfg.protocol == 'https' && hcfg.port == 443)
        || (cfg.protcol == 'http' && hcfg.port == 80)
    ){
        host = `${hcfg.protocol}://${hcfg.host}`;
    }
    const scope = nock(host).persist();
    scope.get(`/api/${hcfg.project}/about`)
        .reply(
            200,
            JSON.stringify({meta:{cols:['productVersion']},rows:[{productVersion:"3.0"}]}),
            {'Content-Type':'application/json'}
        );
    scope.post(`/api/${hcfg.project}/commit`)
        .reply(
            200,
            JSON.stringify({meta:{cols:['id']},rows:[{id:testIdJson}]}),
            {'Content-Type':'application/json'}
        );
    scope.post(`/api/${hcfg.project}/hisWrite`)
        .reply(
            200,
            'ver: "3.0"\nempty\n'
        );
    // authScope1, authScope2, and authScope3 handle the server side of Haystack Authentication
    const authScope1 = nock(host,{
        reqheaders:{
            'Authorization': /HELLO/gi
        }
    });
    authScope1
        .get(`/api/${hcfg.project}/about/about`)
        .reply(
            401,
            '',
            {'WWW-Authenticate': 'SCRAM hash=SHA-256, handshakeToken=aabbcc'}
        );
    const authScope2 = nock(host,{
        reqheaders:{
            'Authorization': /scram data=(.*), handshakeToken=aabbcc/gi
        }
    });
    authScope2
        .get(`/api/${hcfg.project}/about/about`)
        .reply(
            401,
            '',
            {'WWW-Authenticate': 'SCRAM handshakeToken=authAABBCC, hash=SHA-256, data=cj1yT3ByTkdmd0ViZVJXZ2JORWtxTyVodllEcFdVYTJSYVRDQWZ1eEZJbGopaE5sRixzPVcyMlphSjBTTlk3c29Fc1VFamI2Z1E9PSxpPTQwOTYK'}
        );
    const authScope3 = nock(host,{
        reqheaders:{
            'Authorization': /scram data=(.*), handshakeToken=authAABBCC/gi
        }
    });
    authScope3
        .get(`/api/${hcfg.project}/about/about`)
        .reply(
            200,
            '',
            {'Authentication-Info': 'authToken=xxyyzz'}
        );

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
    describe('#connect()',function(){
        it('resolves with correct authToken',function(done){
            haystackClient.once('connected',(header)=>{
                assert.deepEqual(header,{Authorization:'bearer authToken=xxyyzz'});
                done();
            });
            haystackClient.connect().catch((error)=>{
                assert.fail(error);
                done();
            });
        });
    });
    describe('#isLoggedIn()',function(){
        it('returns true after successful connection',function(done){
            assert(haystackClient.isLoggedIn() == true);
            done();
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
