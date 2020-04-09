import { Controller } from "@nestjs/common";
import {GrpcMethod, GrpcStreamMethod, GrpcStreamCall} from '@nestjs/microservices';
import { Observable, Subject, ReplaySubject } from "rxjs";
const timeout = ms => new Promise(res => setTimeout(res, ms))
@Controller()
export class HeroService {

    private readonly items = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Doe' },
      { id: 3, name: 'jack' },
    ];
    @GrpcMethod('HeroService')
    findOne(data:any, metadata: any): any {
      const items = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Doe' },
      ];
      return items.find(({ id }) => id === data.id);
    }

    // @GrpcStreamMethod('HeroService')
    // findMany(data$: Observable<any>): Observable<any> {
    //   const hero$ = new Subject<any>();
  
    //   const onNext = async (heroById: any) => {
    //     console.log(heroById)
    //     if(heroById.id == 2){
    //       await timeout(3000)
    //     }
    //     const item = this.items.find(({ id }) => id === heroById.id);
    //     hero$.next(item);
    //   };
    //   const onComplete = () => hero$.complete();
    //   data$.subscribe(onNext, null, onComplete);
  
    //   return hero$.asObservable();
    // }

    @GrpcStreamMethod('HeroService')
    findMany(call$: Observable<any>): Observable<any> {

      
      const send$ = new ReplaySubject<any>();
      for (var index of [1,2,3]) {
        const item = this.items.find(({ id }) => id === index);
        send$.next(item);
      }

      setInterval(()=>{
        send$.next({id:123});
      },1000*3)

      
      const callOnNext = async (heroById: any) => {
        console.log(heroById)
      };
      

      call$.subscribe(callOnNext)
      

      return send$.asObservable()
    }
    // @GrpcStreamCall('HeroService')
    // findMany(stream: any) {
    //   stream.on('data', async (data: any) => {
    //     console.log(data);
    //     await timeout(3000)
    //     // Answer here or anywhere else using stream reference
    //     stream.write(this.items.find(({ id }) => id === data.id));
    //   });
    // }
  
}