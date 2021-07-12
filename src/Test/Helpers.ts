import { Test, TestingModule } from "@nestjs/testing";
import { join } from "path";
import { services } from "../app.module";
import { Application } from "../Application";
import { Config } from "../Config";
import { ActorConfigManager } from "../Core/ActorConfigManager";
import { ActorManager } from "../Core/ActorManager";
import { Database } from "../Database";
import { ContextLogger } from "../Handlers/ContextLogger";
import { RedisManager } from "../Handlers/redis/RedisManager";
import { MasterModels } from "../Models/MasterModels";
import { ActorService } from "../Services/ActorService";
import { MessageService } from "../Services/MessageService";

let connectionTotal = 1;

export class TestApplication{
    actorService:ActorService;
    config:Config;
    redisManager:RedisManager;
    messageService:MessageService;
    actorManager:ActorManager;
    application:Application;
    database:Database;
    async init(name){
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            Database,
            MasterModels,
            ActorConfigManager,
            ActorManager,
            Application,
            ContextLogger,
            ...services,
        ],
        }).compile();
        this.config = app.get<Config>(Config);
        await this.config.loadConfig();

        this.config.system.mongodbUri = `mongodb://localhost:27017,localhost:27027,localhost:27037/test?replicaSet=rs0`;
        this.config.system.connectionPrefix = `${name}-${connectionTotal++}-`
        this.redisManager = app.get<RedisManager>(RedisManager);
        // await this.redisManager.flushAllDb();


        this.application = app.get<Application>(Application);
        await this.application.baseBootstrap()
        this.database = this.application.database;

        await this.database.dropDatabase();//删除数据库


        this.actorService = app.get<ActorService>(ActorService);

        
        this.messageService = app.get<MessageService>(MessageService);
        this.actorManager = app.get<ActorManager>(ActorManager);
        await this.actorManager.bootstrap(false)
    }

    async shutdown(){
        await this.application.shutdown();
    }
}