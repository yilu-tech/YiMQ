import axios from 'axios';
import {App} from "../CommandApp";
export async function reload({ logger, args ,options}){


  

    if(options.all){
        args.name = '*'
    }

    if(args.name == null){
        return console.error('Error:','Require name or --all.');
    }
    let app = new App();
    await app.initConfig();

    let result = await axios.get(`${app.config.system.adminApi}/admin/reload`,{params:{name:args.name}});
    console.info(result.data);
    return;
}