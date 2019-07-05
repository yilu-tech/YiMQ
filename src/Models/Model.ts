import { ModelFactory } from "../Handlers/ModelFactory";




export abstract class Model {
    protected abstract _modelName :string;
    protected abstract _primaryKey: string;
    protected abstract _indexs: Array<string> = [];
    protected abstract _fields = [];
    protected _modelFactory: ModelFactory;

    create(){
    }

    public toJson(){
        let json:any = {};
        for(let key of this.getFileds()){
            json[key] = this[key];
        }
        return json;
    }
    public getModelName(){
        return this._modelName;
    }

    public getPrimaryValue(){
        return this[this._primaryKey];
    }
    public getValue(field){
        return this[field];
    }
    public getFileds(){
        return this._fields;
    }

    public getIndexs(){

        let indexs = Object.assign([],this._indexs)
        indexs.push(this._primaryKey,'id');
        return indexs;
    }

    public async save():Promise<boolean> {
        return await this._modelFactory.redisDao.update(this,this.getPrimaryValue());
    }
    public assign(updateData):Model{
        return Object.assign(this,updateData);
    }

    public copyAssign(ModelClass:any,updateData):Model{

        return Object.assign(new ModelClass(),this,updateData)
    }


    public setModelFactory(modelFactory:ModelFactory){
        this._modelFactory = modelFactory;
    }
}


