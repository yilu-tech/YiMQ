import * as bull from 'bull';
import { JobSender } from './JobSender';
import { BusinessException } from '../../Exceptions/BusinessException';


export abstract class Job {
    public id:number| string;
    public name:string;
    public sender:JobSender;
    
    constructor(public readonly context:bull.Job){
        this.id = this.context.id;
        this.name = this.context.data.name;
        this.sender = Object.assign(new JobSender(),this.context.data.sender);
    }
    /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['context'];
        return json;
    }

    public async retry():Promise<void>{
        try{
            await this.context.retry();
        }catch(error){
            throw new BusinessException(error.message);
        }
    }




}