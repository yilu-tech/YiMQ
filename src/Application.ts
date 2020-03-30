import { Injectable } from '@nestjs/common';

@Injectable()
export class Application {
    private online = true;

    public setOnline(){
        this.online = true;
    }
    public setOffline(){
        this.online = false;
    }
    public isOnline(){
        return this.online;
    }
}
