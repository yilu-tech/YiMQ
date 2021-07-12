
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../Messages/TransactionMessage';
import { MessageStatus } from '../../Constants/MessageConstants';
import { ConsumerSubtask } from './BaseSubtask/ConsumerSubtask';
import { HttpCoordinatorRequestException } from '../../Exceptions/HttpCoordinatorRequestException';
import { Exclude, Expose } from 'class-transformer';
import { Logger } from '@nestjs/common';
import { CoordinatorProcessResult } from '../Coordinator/Coordinator';
import { TransactionCallback } from '../../Handlers';
import { SubtaskPrepareResultModel } from '../../Models/SubtaskModel';
import { ClientSession, Model } from 'mongoose';

// export class TccSubtaskPrepareResult{
//     constructor(public status:any=null,public message:any=null, public data:any=null){
        
//     }
// }
@Exclude()
export class TccSubtask extends ConsumerSubtask{
    public type:SubtaskType = SubtaskType.TCC;
    @Expose()
    public prepareResult:SubtaskPrepareResultModel;
 
    constructor(message:TransactionMessage){
        super(message);
    }

    async initProperties(subtaskModel){
        await super.initProperties(subtaskModel);
        this.prepareResult = subtaskModel.prepareResult;
    }

    public async createModel(body){
        await super.createModel(body);
        this.model.status = SubtaskStatus.PREPARING;   
    }

    public async prepare(){

        let options = {
            timeout: this.timeout
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
        this.model.prepareResult = new this.database.SubtaskPrepareResultModel();
        try {
            this.model.prepareResult.status = 200;
            this.model.prepareResult.data = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.TRY,callContext,options);     

            await this.setStatusWithTransacation(SubtaskStatus.PREPARING,SubtaskStatus.PREPARED,async(session)=>{
                await this.model.save({session})
            })   

            
        } catch (error) {
            if(!(error instanceof HttpCoordinatorRequestException)){
               throw error;
            }
            
            //如果是 HttpCoordinatorRequestException 不抛出异常，以200状态码返回
            this.model.prepareResult.status = error.statusCode;
            this.model.prepareResult.message = error.message;
            this.model.prepareResult.data = error.response;

            await this.model.save({session:null});//清空create Model里面的session才能保存
        }
        await this.initProperties(this.model);

        return this;
     }

    async toDo():Promise<CoordinatorProcessResult>{
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let actor_result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        // await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);
        await this.completeAndCompleteMessage(SubtaskStatus.DOING,SubtaskStatus.DONE,MessageStatus.DOING,MessageStatus.DONE)
        return {
            result:'success',
            actor_result
        }
    }
    
    async toCancel():Promise<CoordinatorProcessResult>{
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let actor_result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CANCEL,callContext);
        // await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
        await this.completeAndCompleteMessage(SubtaskStatus.CANCELLING,SubtaskStatus.CANCELED,MessageStatus.CANCELLING,MessageStatus.CANCELED);
        return {
            result:'success',
            actor_result
        }
    }

    // public setPrepareResult(prepareResult){
    //     this.prepareResult = prepareResult;
    //     // this.model.property('prepareResult',this.prepareResult);
    //     return this;
    // }
}