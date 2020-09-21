import axios from 'axios';
import {App} from "../CommandApp";
export async function reload(){
    let app = new App();
    await app.initConfig();

    let result = await axios.get(`${app.config.system.adminApi}/admin/reload`);
    console.info(result.data);
    return;
}