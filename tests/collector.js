const { Collector } = require("../src/collector.js");
const assert = require('assert');
describe('Collector', function() {
  const coll = new Collector();
  const exampleTrend = {id:'collector-test',source:'test'};
  const date = new Date();
  const exampleData = [
    {ts:date.getTime(),val:0.5},
    {ts:date.getTime()+5,val:0.7}
  ];
  coll.cleanup(exampleTrend.id,date.getTime()).then(()=>{

  }).catch(()=>{

  });
  describe('has dataFolder configured',function(){
    it('should have a dataFolder as a string value',function(){
      assert.equal(typeof coll.options.dataFolder,'string');
    });
    it('should have a dataFolder as a non-blank string',function(){
      assert.notEqual(coll.options.dataFolder,'');
    });
  });
  describe('#getIndex()', function() {
    it('should return an object', function() {
      return coll.rebuildIndex().then(()=>{
        assert.equal(typeof coll.getIndex(),'object');
      });
    });
  });
  describe('#update(data)',function(){
    it('should succeed with update',function(){
      return coll.update(exampleTrend).then(()=>{
        assert.equal(coll.getIndex().hasOwnProperty(exampleTrend.id),true);
      });
    });
  });
  describe('#enqueue(id,data)',function(){
    it('should succeed with adding trend data',function(){
      return coll.enqueue(exampleTrend.id,exampleData).then(()=>{
        assert.equal(true,true);
      });
    })
  });
  describe('#query(id,start,end)',function(){
    it('should respond with the added trend data',function(){
      return coll.query(exampleTrend.id,0).then((data)=>{
        assert.deepEqual(exampleData,data);
      });
    });
  });
});