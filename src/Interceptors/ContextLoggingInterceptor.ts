import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { format } from 'date-fns';
import { map } from 'lodash';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ContextLogger } from '../Handlers/ContextLogger';

@Injectable()
export class ContextLoggingInterceptor implements NestInterceptor {
  constructor(private contextLogger:ContextLogger){

  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    let startTime = Date.now()
    let request = context.switchToHttp().getRequest();



    let content:any = {
      start_time: format(startTime,'yyyy-MM-dd HH:mm:ss'),
      action: `message.${context.getHandler().name}`,
      type: 'access',
      body: request.body,
    };

    return next
      .handle()
      .pipe(
  
        tap((responseContent) => {
          //todo: 增加action,通过url匹配转换为action
          content['success'] = true;
          content['response'] = responseContent;
          content['cost_time'] = Date.now() - startTime
          //tcc/xa事务preapre 业务方失败拦截
          if(responseContent.prepareResult && responseContent.prepareResult.status != 200){
            content['success'] = false;
            this.contextLogger.error(content);
          }else{
            this.contextLogger.info(content);
          }


          
          // console.debug(content);
          
        }),
        catchError((err)=>{
          content['success'] = false;
          if(err.response){
            content = Object.assign(content,err.response);
          }else{
            content['message'] = err.message
          }
          
          content['cost_time'] = Date.now() - startTime
          this.contextLogger.error(content);
          // console.debug(content)
          throw err;
        })
      );
  }
}


// success failure