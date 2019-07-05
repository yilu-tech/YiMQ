
import { Model } from "./Model";


export class ActorModel extends Model{
    protected _modelName = 'actors';
    protected _primaryKey = 'name';
    protected _indexs = [
        'key'
    ];
    protected _fields = [
        'name',
        'key',
        'api',
        'status'
    ]

    public name:string;
    public key:string;
    public api:string;
    public status:string;
}


