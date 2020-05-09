
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../Messages/TransactionMessage';
import { MessageStatus } from '../../Constants/MessageConstants';
import { ConsumerSubtask } from './BaseSubtask/ConsumerSubtask';
import { HttpCoordinatorRequestException } from '../../Exceptions/HttpCoordinatorRequestException';
import { Logger} from '../../Handlers/Logger';
export class TccSubtask extends ConsumerSubtask{
    public type:SubtaskType = SubtaskType.TCC;
    public prepareResult;
 
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
            processor: this.processor,
            data: this.data,
            options:options
        }
        this.prepareResult = {};
        try {
            this.prepareResult.status = 200;
         
            this.prepareResult.data = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.TRY,callContext,options);     
            if((await this.getStatus()) == SubtaskStatus.CANCELLING){
                Logger.warn(Logger.message(`Subtask ${this.id} status is CANCELLING after prepared.`,this.toJson()),`TccSubtask ${this.type}`)
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

            Logger.debug(Logger.message(`Subtask ${this.id} ${error.message}`,this.prepareResult),`TccSubtask ${this.type}`)
        }
        
        await this.setPrepareResult(this.prepareResult)
        .save()
        return this;
        
    }

    async toDo(){
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);
        return result;
    }
    async toCancel(){
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CANCEL,callContext);
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
        return result;
    }

    public setPrepareResult(prepareResult){
        this.prepareResult = prepareResult;
        this.model.property('prepareResult',this.prepareResult);
        return this;
    }


}