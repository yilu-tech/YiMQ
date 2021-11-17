import { Coordinator } from './Coordinator';

export class GrpcCoordinator extends Coordinator{
   
    public async processBootstrap(){

    };
    public async onCompletedBootstrap() {
        throw new Error("Method not implemented.");
    }
    public async callActor() {
        throw new Error("Method not implemented.");
        return null
    }
}