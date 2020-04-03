import { Actor } from "./Actor";

import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";
import { EcSubtask } from "./Subtask/EcSubtask";
import { TccSubtask } from "./Subtask/TccSubtask";
import { XaSubtask } from "./Subtask/XaSubtask";
import { BcstSubtask } from "./Subtask/BcstSubtask";
import { LstrSubtask } from "./Subtask/LstrSubtask";
import { BusinessException } from "../Exceptions/BusinessException";
import { Subtask } from "./Subtask/BaseSubtask/Subtask";
import { ConsumerSubtask } from "./Subtask/BaseSubtask/ConsumerSubtask";
export class SubtaskManager{
    constructor(private actor:Actor){

    }

    async addSubtask(from:any,type,body):Promise<Subtask>{

        let subtask =  this.factory(from,type);
        await subtask.create(body);
        return subtask;
    }

    async get(subtask_id):Promise<any>{
        let subtaskModel = await this.actor.subtaskModel.load(subtask_id);
        let from:any;

        from = await this.actor.messageManager.get(subtaskModel.property('parent_id'));
        
        let subtask:Subtask =  this.factory(from,subtaskModel.property('type'));
        await subtask.restore(subtaskModel);
        return subtask;

    }
    async getByFrom(from,subtask_id){
        let subtaskModel = await this.actor.subtaskModel.load(subtask_id);
        let subtask:Subtask =  this.factory(from,subtaskModel.property('type'));
        await subtask.restore(subtaskModel);
        return subtask;

    }


    factory(from,type){
        let subtask:any;
        switch (type) {
            case SubtaskType.EC:
                subtask = new EcSubtask(from);
                break;
            case SubtaskType.TCC:
                subtask = new TccSubtask(from);
                break;
            case SubtaskType.XA:
                subtask = new XaSubtask(from);
                break;
            case SubtaskType.BCST:
                subtask = new BcstSubtask(from);
                break;
            case SubtaskType.LSTR:
                subtask = new LstrSubtask(from);
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