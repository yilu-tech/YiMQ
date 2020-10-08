import { Logger as BaseLogger} from '@nestjs/common';
import * as pino from "pino";

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';



const logger = pino({
  level: process.env.LOG_LEVEL,
  prettyPrint: true
})
export class LoggerClass extends BaseLogger {
  private logger = logger;
  private contextName = 'context';
  verbose(message: any, context?: string, ...args: any[]) {
    if (context) {
      this.logger.trace({ [this.contextName]: context }, message, ...args);
    } else {
      this.logger.trace(message, ...args);
    }
  }

  debug(message: any, context?: string, ...args: any[]) {
    this.call('debug',message,context,args)
  }

  log(message: any, context?: string, ...args: any[]) {
    this.call('info',message,context,args)
  }

  warn(message: any, context?: string, ...args: any[]) {
    this.call('warn',message,context,args)
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    if(typeof message === "string"){
      this.logger.error({ [this.contextName]: context,trace},message, ...args);
    }
    else if (typeof message === "object") {
      this.logger.error({ [this.contextName]: context,trace,log_extension: message.extension }, message.message, ...args);
    } else {
      this.logger.error(message, ...args);
    }
  }

  private call(method,message: any, context?: string, ...args: any[]) {
    if(typeof message === "string"){
      this.logger[method]({ [this.contextName]: context},message, ...args);
    }
    else if (typeof message === "object") {
      this.logger[method]({ [this.contextName]: context,log_extension: message.extension }, message.message, ...args);
    } else {
      this.logger[method](message, ...args);
    }
  }
  message(message,extension){
    return {
      message,
      extension
    }
  }
  
}

export const Logger = new LoggerClass();