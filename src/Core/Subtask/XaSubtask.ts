import { TccSubtask } from './TccSubtask';
import { SubtaskType } from '../../Constants/SubtaskConstants';
import { Exclude } from 'class-transformer';

@Exclude()
export class XaSubtask extends TccSubtask{
    public type:SubtaskType = SubtaskType.XA;
}