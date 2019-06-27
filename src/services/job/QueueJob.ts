import { Job } from "./Job";
import { JobReceiver } from "./interfaces/JobReceiver";

export class QueueJob extends Job{
    public readonly receiver:JobReceiver;
}
