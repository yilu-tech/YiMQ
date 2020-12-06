
import { classToPlain } from 'class-transformer';
import {ExposeGroups} from '../Constants/ToJsonConstants'
import { defaultMetadataStorage} from 'class-transformer/storage'
import { TransformationType } from 'class-transformer/TransformOperationExecutor';
export function OnDemand(name) {
    return function (target, methodName: string, descriptor: PropertyDescriptor) {

        Reflect.defineMetadata('OnDemand', true, target);
        Reflect.defineMetadata('OnDemand', methodName, target, name);
        // console.log('OnDemand', methodName, name)
    }
}
/**
 * 只能用于admin接口，不可用于工作接口，性能差距太大,和OnDemandFastTOJson差15倍以上
 * @param target 
 * @param exposeGroups 
 */
export function OnDemandToJson(target,exposeGroups:ExposeGroups[]=[]){
    //enableCircularCheck=true so fast
    return classToPlain(target,{enableCircularCheck:true,groups:exposeGroups})
}

/**
 * 速度快，但会没有处理嵌套问题
 * @param target 对象
 * @param exposeGroups 
 */
export function OnDemandFastToJson(target,exposeGroups:ExposeGroups[]=[]){
    let properties = defaultMetadataStorage.getExposedProperties(target.constructor,TransformationType.CLASS_TO_PLAIN);
    properties = properties.filter((propertie)=>{
        let propertieMetadata = defaultMetadataStorage.findExposeMetadata(target.constructor,propertie);
        // console.log(propertieMetadata);
        if(!propertieMetadata.options.groups){
            return propertie;
        }
        for (const group of exposeGroups) {
            if(propertieMetadata.options.groups.includes(group)){
                return propertie;
            }
        }
    })
    // console.debug('properties',properties)

    let json:object = {};
    for (const propertie of properties) {
        json[propertie] = target[propertie];
    }
    return json;
}

export async function OnDemandRun(object, switchs,layer = 2) {
    let origin = { layer: layer,total: 0, tree: { _layer: 0 },objects:{} };

    //如果不是数组，放入数组中
    if(!Array.isArray(object)){
        object = [object];
    }
    
    try {
        await OnDemandRunChildren(origin, origin.tree, object, switchs)
        // console.log(origin)
    } catch (error) {
        throw new Error(error);
    }

}


async function OnDemandRunChildren(origin, tree, object, switchs) {

    let properies = Object.getOwnPropertyNames(object);

    for (const targetKey of properies) {
        let target = object[targetKey];
        let runResult = await OnDemandRunTargetRun(origin,targetKey,target, switchs)
        if (['is_not_ondemand_object','is_ondemand_object'].includes(runResult)) {
            if (tree._layer > origin.layer) return;// 大于4层就不再向下搜索
            tree[targetKey] = { _layer: tree._layer + 1 };//创建层并且记录层级，向下传递当前层
            await OnDemandRunChildren(origin, tree[targetKey], target, switchs)//继续搜索子对象
        }
    }
}

async function OnDemandRunTargetRun(origin,targetKey,target, switchs) {

    if (typeof target != 'object') {
        return 'Not_object';
    }
    if (!target) {
        return 'Undefined'
    }

    if (!target.constructor) {
        return 'Not_have_constructor';
    }

    if(objectExist(origin,target)) return;


    // console.log(targetKey, '-->',typeof target, target.constructor.name, target.constructor.name == 'Array' ? target.length : '')

    let targetObject = {object:target,switch:null, method:null};
    origin.objects[origin.total] = targetObject;
    origin.total++;

    let iSOnDemandObject = Reflect.getMetadata('OnDemand', target);
    if (!iSOnDemandObject) {
        return 'is_not_ondemand_object';
    
    }
    for (const siwtchName of switchs) {
        let methodName = Reflect.getMetadata('OnDemand', target, siwtchName);
        if (methodName) {
            await target[methodName]();
            targetObject.switch = siwtchName;
            targetObject.method = methodName;
        }
    }
    return 'is_ondemand_object';
}

function objectExist(origin,target){
    for (const key in origin.objects) {
        let item = origin.objects[key];
        if(item.object == target){
            return true;
        }
    }
    return false;

}