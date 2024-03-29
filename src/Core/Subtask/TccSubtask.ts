
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../Messages/TransactionMessage';
import { MessageStatus } from '../../Constants/MessageConstants';
import { ConsumerSubtask } from './BaseSubtask/ConsumerSubtask';
import { HttpCoordinatorRequestException } from '../../Exceptions/HttpCoordinatorRequestException';
import { Exclude, Expose } from 'class-transformer';
import { Logger } from '@nestjs/common';
import { CoordinatorProcessResult } from '../Coordinator/Coordinator';

export class TccSubtaskPrepareResult{
    constructor(public status:any=null,public message:any=null, public data:any=null){
        
    }
}
@Exclude()
export class TccSubtask extends ConsumerSubtask{
    public type:SubtaskType = SubtaskType.TCC;
    @Expose()
    public prepareResult:TccSubtaskPrepareResult;
 
    constructor(message:TransactionMessage){
        super(message);
    }

    async initProperties(subtaskModel){
        await super.initProperties(subtaskModel);
        this.prepareResult = subtaskModel.property('prepareResult');
    }
    
    async prepare() {
        let options = {
            timeout:this.options.timeout ? this.options.timeout : 1000*10
        }
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            producer: this.message.producer.name,
            processor: this.processor,
            data: this.data,
            options:options
        }
        this.prepareResult = new TccSubtaskPrepareResult();
        try {
            this.prepareResult.status = 200;
         
            let {callResult,callBody} = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.TRY,callContext,options);     
            this.prepareResult.data = callResult
            if((await this.getStatus()) == SubtaskStatus.CANCELLING){
                Logger.warn(`Subtask ${this.id} status is CANCELLING after prepared.`,`TccSubtask ${this.type}`)
            }else{
                this.setStatus(SubtaskStatus.PREPARED);
            }
            
        } catch (error) {
            if(!(error instanceof HttpCoordinatorRequestException)){
               throw error;
            }
            //如果是 HttpCoordinatorRequestException 不抛出异常，以200状态码返回
            this.prepareResult = {
                status: error.statusCode,
                message: error.message,
                data: error.response,
            };

            // Logger.debug(`Subtask ${this.id} ${error.message}`,`TccSubtask ${this.type}`)
        }
        
        await this.setPrepareResult(this.prepareResult)
        .save()
        return this;
        
    }

    async toDo():Promise<CoordinatorProcessResult>{
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let {callResult,callBody}= await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);
        return {
            message_id: this.message_id,
            process:'success',
            call_actor_body: callBody,
            actor_result:callResult
        }
    }
    async toCancel():Promise<CoordinatorProcessResult>{
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let {callResult,callBody} = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CANCEL,callContext);
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
        return {
            message_id: this.message_id,
            process:'success',
            call_actor_body: callBody,
            actor_result:callResult
        }
    }

    public setPrepareResult(prepareResult){
        this.prepareResult = prepareResult;
        this.model.property('prepareResult',this.prepareResult);
        return this;
    }
}