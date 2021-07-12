import { Job } from "./Job";

import { Exclude, Expose } from "class-transformer";
import { JobStatus, JobType } from "../../Constants/JobConstants";
import { JobOptions } from "../../Interfaces/JobOptions";
import axios from 'axios';
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
// const CancelToken = axios.CancelToken;
@Exclude()
export class TestJob extends Job{
    type = JobType.TEST

    public async create(jobOptions:JobOptions){
        this.model.status = JobStatus.PENDING;
        let session = await this.database.connection.startSession();
        await session.withTransaction(async()=>{
            await super.create(jobOptions,session);
        })
        await session.endSession();
        return this;
    }

    async process() {
        await axios.get('/test/job')
        return <CoordinatorProcessResult>{result:'success'}
    }
}