import { IsDefined, ValidationOptions, registerDecorator, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export class GetJobDto{
    @IsDefined()
    coordinator:string;
    @IsDefined()
    id:string;
}

