import { EcSubtask } from "./EcSubtask";
import { SubtaskStatus, SubtaskType } from "../../Constants/SubtaskConstants";
import { MessageStatus } from "../../Constants/MessageConstants";
import { Subtask } from "./Subtask";
import { TransactionMessage } from "../Messages/TransactionMessage";
import Bull = require("bull");
import { JobType } from "../../Constants/JobConstants";
import { IStaticMethods } from "nohm";
import { ListenerModelClass } from "../../Models/ListenerModel";
import { LstrSubtask } from "./LstrSubtask";
import { SubtaskModelClass } from "../../Models/SubtaskModel";
import { Logger } from "@nestjs/common";

export class BcstSubtask extends Subtask{
    public topic:string;
    public ListenerModel:IStaticMethods<ListenerModelClass>;
    public listenerSubtasks:Array<LstrSubtask>;

    constructor(message:TransactionMessage,subtaskModel){
        super(message,subtaskModel);
        this.topic = subtaskModel.property('topic');
        this.ListenerModel =  this.message.producer.actorManager.masterModels.ListenerModel
    }


    async prepare() {
        await this.setStatus(SubtaskStatus.PREPARED).save();//最终一致由于不用try，直接进入准备成功状态
        return this;
    }


    /**
     * confirm 的时候需要传递data
     */
    async toDo(){

        let listenerContexts = await this.getListenerContexts()

        await this.setProperty('context',listenerContexts).save();

        await this.createListenerSubtasks(listenerContexts)

        //创建ListenerSubtasks后,完成当前任务
        await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);
        return null;

    }

    public async restore(){
        await super.restore();
        this.listenerSubtasks = await this.getAllListenerSubtasks();

    }

    private async getAllListenerSubtasks(){
        let subtaskIds = await this.model.getAll(SubtaskModelClass.modelName)

        let subtasks:Array<LstrSubtask> = [];
        for(var subtask_id of subtaskIds){
            let subtask:LstrSubtask = await this.message.producer.subtaskManager.getByFrom(this,subtask_id);
            await subtask.restore()
            subtasks.push(subtask);
        }
        return subtasks;
    }


    private async getListenerContexts(){
        let listenerModels = await this.ListenerModel.findAndLoad({
            topic: this.topic
        })
        let listenerContexts = [];
        for (const listenerModel of listenerModels) {
            let context = {
                actor_id: listenerModel.property('actor_id'),
                processor: listenerModel.property('processor'),
                subtask_id: await this.message.producer.actorManager.getSubtaskGlobalId()//提前占用subtask_id
            }
            listenerContexts.push(context);
        }
        return listenerContexts;
    }

    private async createListenerSubtasks(listenerContexts){
        this.listenerSubtasks = [];
        for (const context of listenerContexts) {
            await this.addListenerSubtask(context)
        }
        let ids = await this.model.getAll(SubtaskModelClass.modelName);
        
        Logger.debug(ids,'BcstSubtask Create Listener')
    }


    async addListenerSubtask(context){
       
        let body = {
            subtask_id: context.subtask_id,
            consumer_id: context.actor_id,
            processor: context.processor,
            data:{},
        }
        let subtask = await this.message.producer.subtaskManager.addSubtask(this,SubtaskType.LSTR,body)

        this.model.link(subtask.model);
        await this.model.save()
      

        await subtask.setStatusAddJobFor(SubtaskStatus.DOING);
        this.listenerSubtasks.push(subtask);
    }
    /**
     * ec subtask取消的时候只标记状态
     */
    async toCancel(){
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
    }
}