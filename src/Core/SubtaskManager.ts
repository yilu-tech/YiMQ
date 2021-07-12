import { Actor } from "./Actor";

import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";

import { BusinessException } from "../Exceptions/BusinessException";
import { Subtask } from "./Subtask/BaseSubtask/Subtask";
import { Message } from "./Messages/Message";
import { SubtaskModel } from "../Models/SubtaskModel";
import { Database } from "../Database";
export class SubtaskManager{
    private database:Database;
    subtaskClasses = {
        EcSubtask: require("./Subtask/EcSubtask").EcSubtask,
        TccSubtask: require("./Subtask/TccSubtask").TccSubtask,
        XaSubtask: require("./Subtask/XaSubtask").XaSubtask,
        BcstSubtask: require("./Subtask/BcstSubtask").BcstSubtask,
        LstrSubtask: require("./Subtask/LstrSubtask").LstrSubtask,
    }
    constructor(private actor:Actor){
        this.database = actor.actorManager.application.database;
    }

    async get(subtask_id):Promise<any>{
        

        var subtaskModel = await this.database.SubtaskModel.findById(subtask_id);
        if(!subtaskModel){
            return null;
        }
        
        let message = await this.actor.messageManager.get(subtaskModel.message_id);
    
        let subtask = this.factory(message,subtaskModel.type);
        await subtask.restore(subtaskModel);
        return subtask;

    }
    // async getByMessage(message,subtask_id){
    //     let subtaskModel = await this.actor.subtaskModel.load(subtask_id);
    //     let subtask:Subtask =  this.factory(message,subtaskModel.property('type'));
    //     await subtask.restore(subtaskModel);
    //     return subtask;

    // }
    
    async restoreByModel(message:Message,subtaskModel:SubtaskModel){
        let subtask = this.factory(message,subtaskModel.type);
        await subtask.restore(subtaskModel);
        return subtask;
    }


    factory(message,type){
        let subtask:Subtask;
        switch (type) {
            case SubtaskType.EC:
                subtask = new this.subtaskClasses.EcSubtask(message);
                break;
            case SubtaskType.TCC:
                subtask = new this.subtaskClasses.TccSubtask(message);
                break;
            case SubtaskType.XA:
                subtask = new this.subtaskClasses.XaSubtask(message);
                break;
            case SubtaskType.BCST:
                subtask = new this.subtaskClasses.BcstSubtask(message);
                break;
            case SubtaskType.LSTR:
                subtask = new this.subtaskClasses.LstrSubtask(message);
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

    async getSubtaskModel(id){
        return await this.database.SubtaskModel.where({_id:id}).findOne();
    }
}