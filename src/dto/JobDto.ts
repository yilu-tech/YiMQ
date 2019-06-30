import { IsDefined, ValidationOptions, registerDecorator, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export class GetJobDto{
    @IsDefined()
    coordinator:string;
    @IsDefined()
    id:string;
}

export class CreateJobDto{
    @IsDefined()
    coordinator:string;
    @IsDefined()
    id:string;
}

