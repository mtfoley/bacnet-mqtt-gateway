const { Collector } = require("../src/collector.js");
const assert = require('assert');
describe('Collector', function() {
  var coll = null;
  const exampleTrend = {id:'collector-test',source:'test'};
  const date = new Date();
  const exampleData = [
    {ts:date.getTime(),val:0.5},
    {ts:date.getTime()+5,val:0.7}
  ];
  describe('#constructor()',function(){
    it('should instantiate',function(){
      coll = new Collector();
      assert.ok(coll);
    });
  });
  describe('has dataFolder configured',function(){
    it('should have a dataFolder as a string value',function(){
      assert.equal(typeof coll.options.dataFolder,'string');
    });
    it('should have a dataFolder as a non-blank string',function(){
      assert.notEqual(coll.options.dataFolder,'');
    });
  });
  describe('#cleanup(id,start)',function(){
    it('should fail with no ID',function(){
      assert.rejects(coll.cleanup());
    });
    it('should fail with invalid id (e.g. "-")',function(){
      assert.rejects(coll.cleanup('-'));
    });
    it('should fail with invalid start',function(){
      assert.rejects(coll.cleanup(exampleTrend.id));
    });
    it('should succeed with cleanup',function(){
      return coll.cleanup(exampleTrend.id,date.getTime()).then(()=>{
        assert.ok(1);
      });
    });
  });
  describe('#rebuildIndex()',function(){
    it('should succed with rebuilding index',function(){
      return coll.rebuildIndex().then(()=>{
        assert.ok(1);
      });
    });
  });
  describe('#getIndex()', function() {
    it('should return an object', function() {
      assert.equal(typeof coll.getIndex(),'object');
    });
  });
  describe('#update(data)',function(){
    it('should fail with no ID',function(){
      assert.rejects(coll.update());
    });
    it('should succeed with update',function(){
      return coll.update(exampleTrend).then(()=>{
        assert.equal(coll.getIndex().hasOwnProperty(exampleTrend.id),true);
      });
    });
  });
  describe('#enqueue(id,data)',function(){
    it('should fail with no ID',function(){
      assert.rejects(coll.enqueue());
    });
    it('should succeed with adding trend data',function(){
      return coll.enqueue(exampleTrend.id,exampleData).then(()=>{
        assert.equal(true,true);
      });
    })
  });
  describe('#_queryFileContents(id,start,end)',function(){
    it('should return no results with invalid JSON on all lines',function(){
      const contents = exampleData.map((d)=>{return JSON.stringify(d)+'+'}).join('\n');
      const data = coll._queryFileContents(contents,0);
      assert.ok(data.length == 0);
    });
    it('should return return results',function(){
      const contents = exampleData.map(JSON.stringify).join('\n');
      const data = coll._queryFileContents(contents,0);
      assert.ok(data.length > 0);
    });
  });
  describe('#query(id,start,end)',function(){
    it('should fail with no ID',function(){
      assert.rejects(coll.query());
    });
    it('should fail with invalid ID (e.g. "-")',function(){
      assert.rejects(coll.query('-'));
    });
    it('should respond with the added trend data',function(){
      return coll.query(exampleTrend.id,0).then((data)=>{
        assert.deepEqual(exampleData,data);
      });
    });
  });
  describe('#destroy()',function(){
    it('should emit destroy event',function(){
      let flag = true;
      coll.once('destroy',function(event){
        flag = false;
        assert.ok(1);
      });
      coll.destroy();
      setTimeout(function(){
        if(flag == true) assert.fail('No Event');
      },250);
    });
  });
});