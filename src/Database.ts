import { Injectable, Logger } from "@nestjs/common";
// import { connect, Db, MongoClient ,Collection} from "mongodb";
import { Mongoose,connect, Model, createConnection, Connection, disconnect } from "mongoose";
import { Config } from "./Config";
import { JobModel, JobSchema } from "./Models/JobModel";
import { MessageModel ,MessageSchema} from "./Models/MessageModel";
import { SubtaskModel, SubtaskSchema ,SubtaskPrepareResultModel,SubtaskPrepareResultSchema} from "./Models/SubtaskModel";

@Injectable()
export class Database {
    public connection:Connection;
    public MessageModel:Model<MessageModel>;
    public JobModel:Model<JobModel>
    public SubtaskModel:Model<SubtaskModel>
    public SubtaskPrepareResultModel:Model<SubtaskPrepareResultModel>
    constructor(private config:Config){

    }
    async init(){
        this.connection = createConnection(this.config.system.mongodbUri,{
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false
        });
        
        this.MessageModel = this.connection.model <MessageModel>(`${this.config.system.connectionPrefix}Message`,MessageSchema)
        this.JobModel = this.connection.model<JobModel>(`${this.config.system.connectionPrefix}Job`,JobSchema);
        this.SubtaskModel = this.connection.model<SubtaskModel>(`${this.config.system.connectionPrefix}Subtask`,SubtaskSchema)
        this.SubtaskPrepareResultModel = this.connection.model<SubtaskPrepareResultModel>(`${this.config.system.connectionPrefix}SubtaskPrepareResult`,SubtaskPrepareResultSchema)

    }

    async close(){
        await this.connection.close()
    }
    async dropDatabase(){
        await this.MessageModel.deleteMany()
        await this.JobModel.deleteMany()
        await this.SubtaskModel.deleteMany()
    }
}