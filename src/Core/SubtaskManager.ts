import { Actor } from "./Actor";

import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";
import { EcSubtask } from "./Subtask/EcSubtask";
import { TccSubtask } from "./Subtask/TccSubtask";
import { XaSubtask } from "./Subtask/XaSubtask";
import { BcstSubtask } from "./Subtask/BcstSubtask";
export class SubtaskManager{
    constructor(private actor:Actor){

    }

    async addSubtask(from:any,type,body){

        let now = new Date().getTime();

        let subtaskModel = new this.actor.subtaskModel();
        subtaskModel.id = String(await this.actor.actorManager.getSubtaskGlobalId());
        subtaskModel.property('message_id',from.id);
        subtaskModel.property('type',type);
        subtaskModel.property('status',SubtaskStatus.PREPARING);
        subtaskModel.property('data',body.data);
        subtaskModel.property('created_at',now);
        subtaskModel.property('updated_at',now);
        subtaskModel.property('processor',body.processor);
        
        if([SubtaskType.BCST,SubtaskType.LSTR].includes(type)){
            subtaskModel.property('topic',body.topic);
        }
        await subtaskModel.save() 

        return this.factory(from,subtaskModel);
    }

    async get(subtask_id){
        let subtaskModel = await this.actor.subtaskModel.load(subtask_id);
        let message = await this.actor.messageManager.get(subtaskModel.property('message_id'));
        return this.factory(message,subtaskModel);

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
        
            default:
                throw new Error('SubtaskType is not exists.');
        }
        return subtask;
    }
}