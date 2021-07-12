import { connect, Db, MongoClient } from 'mongodb';
import { async } from 'rxjs';
import * as Ioredis from 'ioredis'
import { TestApplication } from '../Helpers';
import { Types } from 'mongoose';
import { JobStatus, JobType } from '../../Constants/JobConstants';
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Test', () => {

    let client: MongoClient;
    let i = 0;

    beforeAll(async () => {

        console.log('beforeAll')
    })

    beforeEach(async () => {
        console.log(i++)

    })
    afterAll(async () => {
        console.log('afterAll')
    })

    it('insert_find', async () => {


        // // let redis = new Ioredis();
        // // await redis.set('name','jack');

        // // console.time('redis_write')
        // // await redis.set('name','toms');
        // // await redis.set('age','12');
        // // console.timeEnd('redis_write')

        // // await redis.quit()

        // let uri = 'mongodb://localhost:27017,localhost:27027,localhost:27037/?replicaSet=rs0';
        // client = await connect(uri);
        

        // let db = await client.db('rs0');
        // await db.dropDatabase();
        // const message_coll = db.collection('message');


        // await message_coll.createIndex({ topic: 1 });

        // console.time('mongo_write')
        // let message1 = {
        //     topic: "user.create",
        //     actor_id: '1'
        // };


        // await message_coll.insertOne(message1)
        // console.timeEnd('mongo_write')

        // let message2 = {
        //     topic: "user.create",
        //     actor_id: '1'
        // };


        // let message2Result = await message_coll.insertOne(message2)
        
        // console.time('mongo_write_find')
        // await message_coll.updateOne({ _id: message2Result.insertedId }, {
        //     $set: {
        //         topic: 'user.update'
        //     }
        // })

        // let result = await message_coll.find({
        //     topic: 'user.create'
        // })
        // console.timeEnd('mongo_write_find')

        
        

        // expect(await result.count()).toBe(1)
    });

    it('watch', async () => {

    })
    it('watch', async () => {

    })

     it('.test123', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');
            let id = 'F00000000000000000000012';
            let result = await testApplication.database.JobModel.create({
                _id: Types.ObjectId(id),
                status: JobStatus.WAITING,
                type: JobType.MESSAGE
            })

            let jobModel = await testApplication.database.JobModel.find({_id:null});
            console.log(jobModel)

            await testApplication.shutdown()
        });
});
