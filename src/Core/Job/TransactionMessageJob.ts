import { Job } from "./Job";
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { TransactionMessage } from "../Messages/TransactionMessage";
import * as bull from 'bull';
import { SystemException } from "../../Exceptions/SystemException";
import { BusinessException } from "../../Exceptions/BusinessException";
import { MessageJob } from "./MessageJob";
export class TransactionMessageJob extends MessageJob{ //TODO 考虑取消TransactionMessageJob类


}