const assert = require('assert');
const { DeviceObjectId, DeviceObject, DeviceInfo, logger } = require("../src/common.js");
const checkProperties = function(obj,names){
    let flag = true;
    names.forEach((value)=>{
        flag &= obj.hasOwnProperty(value);
    })
    return flag;
}
describe('Common',function(){
    describe('DeviceObjectId',function(){
        const type = 1;
        const inst = 2;
        const obj = new DeviceObjectId(type,inst);
        const props = ['type','instance'];
        it('Has Properties '+props.join(', '),function(){
            assert.ok(checkProperties(obj,props));
        });
    });
    describe('DeviceObject',function(){
        const v = 1;
        const obj = new DeviceObject(v,v,v,v,v,v,v);
        const props = ['objectId','name','type','units','presentValue','stateText'];
        it('Has Properties '+props.join(', '),function(){
            assert.ok(checkProperties(obj,props));
        });
    });
    /*DeviceInfo {
    constructor(address,deviceId, name, description, servicesSupported)*/
    describe('DeviceInfo',function(){
        const v = 1;
        const obj = new DeviceInfo(v,v,v,v,{value:[255]});
        const props = ['address','deviceId', 'name', 'description', 'servicesSupported'];
        it('Has Properties '+props.join(', '),function(){
            assert.ok(checkProperties(obj,props));
        });
        it('BACnet BitString - Services Supported Input of [255] resolves to Output of [true,true,true,true,true,true,true,true]',function(){
            const svcsTrue = [true,true,true,true,true,true,true,true];
            assert.deepEqual(obj.servicesSupported,svcsTrue);
        });
    });
});