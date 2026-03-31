ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache python3 py3-pip bash
RUN pip3 install --no-cache-dir flask==3.0.3 gunicorn==22.0.0

WORKDIR /app

COPY app.py /app/app.py
COPY web /app/web
COPY run.sh /run.sh

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]