import { Actor } from "./Actor";

import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";
import { EcSubtask } from "./Subtask/EcSubtask";
import { TccSubtask } from "./Subtask/TccSubtask";
import { XaSubtask } from "./Subtask/XaSubtask";
import { BcstSubtask } from "./Subtask/BcstSubtask";
import { LstrSubtask } from "./Subtask/LstrSubtask";
import { BusinessException } from "../Exceptions/BusinessException";
import { Subtask } from "./Subtask/BaseSubtask/Subtask";
export class SubtaskManager{
    constructor(private actor:Actor){

    }

    async addSubtask(from:any,type,body):Promise<Subtask>{

        let now = new Date().getTime();

        let subtaskModel = new this.actor.subtaskModel();
        subtaskModel.id = body.subtask_id; 

        subtaskModel.property('parent_id',from.id);//rename parent_id

        subtaskModel.property('type',type);
        subtaskModel.property('status',SubtaskStatus.PREPARING);
        subtaskModel.property('data',body.data);
        subtaskModel.property('created_at',now);
        subtaskModel.property('updated_at',now);
        subtaskModel.property('consumer_id',body.consumer_id);
        subtaskModel.property('processor',body.processor);
    
        await subtaskModel.save() 

        return this.factory(from,subtaskModel);
    }

    async get(subtask_id):Promise<any>{
        let subtaskModel = await this.actor.subtaskModel.load(subtask_id);
        let from:any;

        if(subtaskModel.property('type') == SubtaskType.LSTR){ //不够优雅
            from  = await this.get(subtaskModel.property('parent_id'));
        }else{
            from = await this.actor.messageManager.get(subtaskModel.property('parent_id'));
        }
        
        let subtask:Subtask =  this.factory(from,subtaskModel);
        await subtask.restore();
        return subtask;

    }
    async getByFrom(from,subtask_id){
        let subtaskModel = await this.actor.subtaskModel.load(subtask_id);
        let subtask:Subtask =  this.factory(from,subtaskModel);
        await subtask.restore();
        return subtask;

    }


    factory(from,subtaskModel){
        let subtask:any;
        switch (subtaskModel.property('type')) {
            case SubtaskType.EC:
                subtask = new EcSubtask(from,subtaskModel);
                break;
            case SubtaskType.TCC:
                subtask = new TccSubtask(from,subtaskModel);
                break;
            case SubtaskType.XA:
                subtask = new XaSubtask(from,subtaskModel);
                break;
            case SubtaskType.BCST:
                subtask = new BcstSubtask(from,subtaskModel);
                break;
            case SubtaskType.LSTR:
                subtask = new LstrSubtask(from,subtaskModel);
                break;
        
            default:
                throw new Error('SubtaskType is not exists.');
        }
        return subtask;
    }

    getConsumerAndProcessor(processor){
        let [consumerName,consumerProcessorName] = processor.split('@');
        let consumer = this.actor.actorManager.get(consumerName);
        if(!consumer){
            throw new BusinessException(`Consumer <${consumerName}> not exists.`)
        }
        return {consumer,consumerProcessorName};
    }
}