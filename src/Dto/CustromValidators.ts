import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { difference } from "lodash";

@ValidatorConstraint({ name: 'StringArrayIsIn', async: false })
export class StringArrayIsIn implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    if(!text){
      return true;
    }
    if(typeof text != 'string'){
      return false;
    }
    let types = text.split(',');
    let diff = difference(types,args.constraints);
    return diff.length > 0 ? false : true;
  }
  defaultMessage(args: ValidationArguments) {
    return `($value) is not in ${args.constraints}!`;
  }
}