ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM ${BUILD_FROM}

RUN apk add --no-cache python3 bash py3-flask

WORKDIR /app
COPY app.py /app/app.py
COPY web /app/web
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD ["/run.sh"]