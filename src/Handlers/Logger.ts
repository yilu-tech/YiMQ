import { Logger as BaseLogger} from '@nestjs/common';

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'log';
const LOG_LEVELS = ['debug','log','warn','error']

export class Logger extends BaseLogger {
  static log(message: any, context?: string, isTimeDiffEnabled?: boolean) {
    
    this.checkLevel('log') && BaseLogger.log(message,context,isTimeDiffEnabled)
  }
  static debug(message: any, context?: string, isTimeDiffEnabled?: boolean){
    this.checkLevel('debug') && BaseLogger.debug(message,context,isTimeDiffEnabled)
  }
  static warn(message: any, context?: string, isTimeDiffEnabled?: boolean){
    this.checkLevel('warn') && BaseLogger.warn(message,context,isTimeDiffEnabled)
  }
  static error(message: any, trace?: string, context?: string, isTimeDiffEnabled?: boolean){
    this.checkLevel('error') && BaseLogger.error(message,trace,context,isTimeDiffEnabled)
  }


  static checkLevel(level){
      if(process.env.LOG_LEVEL == 'disable'){
          return false;
      }
      let defaultLevel = LOG_LEVELS.indexOf(process.env.LOG_LEVEL);
      let current_level = LOG_LEVELS.indexOf(level);
      return current_level >= defaultLevel;
  }
} 