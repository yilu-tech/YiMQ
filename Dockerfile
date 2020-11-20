FROM yilutech/cloud9:node-12

COPY . /apps

RUN cd /apps \
 && npm install \
 && npm run build \
 && mkdir -p /apps/logs

CMD ["bash", "-c", "cd /apps && pm2 start ecosystem.prod.config.js"]
