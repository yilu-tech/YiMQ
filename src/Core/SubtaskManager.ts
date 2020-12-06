import { Actor } from "./Actor";

import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";
import { EcSubtask } from "./Subtask/EcSubtask";
import { TccSubtask } from "./Subtask/TccSubtask";
import { XaSubtask } from "./Subtask/XaSubtask";
import { BcstSubtask } from "./Subtask/BcstSubtask";
import { LstrSubtask } from "./Subtask/LstrSubtask";
import { BusinessException } from "../Exceptions/BusinessException";
import { Subtask } from "./Subtask/BaseSubtask/Subtask";
import { Message } from "./Messages/Message";
export class SubtaskManager{
    constructor(private actor:Actor){

    }

    async addSubtask(message:Message,type,body):Promise<Subtask>{

        let subtask =  this.factory(message,type);
        await subtask.create(body);
        return subtask;
    }

    async get(subtask_id):Promise<any>{
        
        try{
            var subtaskModel = await this.actor.subtaskModel.load(subtask_id);
        }catch(error){
            if(error && error.message === 'not found'){
                return null;
            }
            throw error;
        }

        // let subtaskModel = await this.actor.subtaskModel.load(subtask_id);

        let message = await this.actor.messageManager.get(subtaskModel.property('message_id'));
        
        let subtask:Subtask =  this.factory(message,subtaskModel.property('type'));
        await subtask.restore(subtaskModel);
        return subtask;

    }
    async getByMessage(message,subtask_id){
        let subtaskModel = await this.actor.subtaskModel.load(subtask_id);
        let subtask:Subtask =  this.factory(message,subtaskModel.property('type'));
        await subtask.restore(subtaskModel);
        return subtask;

    }


    factory(message,type){
        let subtask:Subtask;
        switch (type) {
            case SubtaskType.EC:
                subtask = new EcSubtask(message);
                break;
            case SubtaskType.TCC:
                subtask = new TccSubtask(message);
                break;
            case SubtaskType.XA:
                subtask = new XaSubtask(message);
                break;
            case SubtaskType.BCST:
                subtask = new BcstSubtask(message);
                break;
            case SubtaskType.LSTR:
                subtask = new LstrSubtask(message);
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