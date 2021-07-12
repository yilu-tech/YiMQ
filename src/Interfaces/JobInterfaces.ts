import { Job } from "../Core/Job/Job";

export interface JobEventListener{
    (job:Job,error:Error):void
};