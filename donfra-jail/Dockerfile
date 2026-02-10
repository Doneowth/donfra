FROM alpine:3.20

RUN apk add --no-cache python3 nodejs redis

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN adduser -D -u 1000 jail
USER jail

ENTRYPOINT ["/entrypoint.sh"]
