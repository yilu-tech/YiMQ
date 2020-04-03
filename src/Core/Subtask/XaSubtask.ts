import { TccSubtask } from './TccSubtask';
import { SubtaskType } from '../../Constants/SubtaskConstants';
export class XaSubtask extends TccSubtask{
    public type:SubtaskType = SubtaskType.XA;
}