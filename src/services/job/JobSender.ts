export class JobSender{
    public name:string;
    public header:object;
    public statusCheckUrl:string;

    checkCommitted():boolean
    {
        return true;
    }
}