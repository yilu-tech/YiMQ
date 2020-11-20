FROM yilutech/cloud9:ubuntu

COPY docker/startup /

#SHELL ["/bin/bash", "-c"]

RUN source /root/.nvm/nvm.sh && npm config set registry https://registry.npm.taobao.org && npm install -g yimq

COPY ecosystem.config.js /root/.nvm/versions/node/v11.7.0/lib/node_modules/yimq/ecosystem.config.js

WORKDIR /apps

CMD ["bash", "/startup"]