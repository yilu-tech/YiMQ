import { SubtaskType, SubtaskStatus } from "../../Constants/SubtaskConstants";
import { Message } from "../Messages/Message";
import { Actor } from "../Actor";

export abstract class Subtask{
    id:Number;
    type:SubtaskType;
    status: SubtaskStatus;
    data:any;
    created_at:Number;
    updated_at:Number;
    processer:string;
    actor:Actor;
    actorProcesserName:string;
    message:Message;
    constructor(message:Message,type:SubtaskType,subtaskJson){
        this.message = message;
        this.id = subtaskJson.id;
        this.type = type;
        this.status = subtaskJson.status;
        this.data = subtaskJson.data;
        
        this.processer = subtaskJson.processer;
       
        let [consumerName,actorProcesserName] = subtaskJson.processer.split('@');
        this.actor = this.message.producer.actorManager.get(consumerName);
        this.actorProcesserName = actorProcesserName;

        this.created_at = subtaskJson.created_at;
        this.updated_at = subtaskJson.updated_at;

    }

    abstract async prepare();

    public async update(){
        await this.message.update();
    }

      /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['message'];
        delete json['actor'];
        delete json['actorProcesserName'];
        return json;
    }
    
}